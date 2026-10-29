// Limitr Transcriber — live captions, entirely on this computer
// Loaded as an ES module in the offscreen document (Chrome) or the background page (Firefox). The
// speech models run in a worker (lib/transcriber-worker.js): a Whisper call takes seconds, and
// this page shares its main thread with the popup.
//
//   audio (16 kHz, 0.5 s chunks) → pause-aware segmenter → engine → [translation] → broadcast
//
// Engines (via @huggingface/transformers):
//   - English: Moonshine base. Its cost scales with the audio length, so it can refresh the
//     line being spoken about once a second and finish it at the next pause.
//   - Turkish: ufak AI's ufakzeka-kulak (Apache-2.0), a whole-utterance model run by sherpa-onnx
//     (lib/stt-offline-worker.js) fast enough to be sent the sentence being spoken again every half
//     second. Each call decodes only from a little before the last word two calls agreed on, and
//     the line shows a word once two calls agree on it or the model is sure of it
//     (lib/live-agreement.js), so it grows like a streaming model's, within about a second.
//     Whisper carries the captions until it has loaded, and does the Turkish when only Whisper
//     can translate it into English.
//   - Everything else: Whisper base on the CPU, or Whisper small on the GPU when the user turned
//     on the larger model and the GPU can run it. Whisper pads every call to 30 s, so it only
//     transcribes finished sentences.
// Auto language: Whisper's language-ID step runs once on the first sentence and the result is
// kept for the rest of the session.
// Translation: only where the browser has the on-device Translator API (Chrome/Edge). When it
// can't do a pair into English, Whisper translates into English instead. Elsewhere (Firefox)
// captions are never translated.

import { MODELS } from './transcriber-models.js';
import { cleanText } from './caption-text.js';
import { LiveAgreement } from './live-agreement.js';

const SAMPLE_RATE = 16000;

// Segmenter tuning per engine: how long a pause ends a sentence, the longest piece sent at once,
// and how often the line being spoken is refreshed (not for Whisper)
const SEGMENTING = {
  moonshine: { hangoverMs: 240, maxMs: 8000, interimMs: 1000 },
  whisper: { hangoverMs: 450, maxMs: 9000, interimMs: 0 },
  // The open sentence again every half second; each call decodes only its last few seconds (see
  // liveLines), so a sentence may run long, its finished lines going out as it goes
  ufak: { hangoverMs: 300, maxMs: 30000, interimMs: 500 }
};
// ufak's live line: past this long a window (s), it is decoded at most once a second (noise and
// crosstalk keep words in doubt, and the window long, for seconds)
const LIVE_SLOW_WINDOW_S = 4;
const LIVE_SLOW_REFRESH_MS = 1000;

const FRAME = 320;               // 20 ms at 16 kHz
const FRAME_MS = 20;
const PREROLL_FRAMES = 15;       // keep 300 ms before speech starts
const MIN_SPEECH_MS = 300;       // shorter blips are dropped
const IDLE_FLUSH_MS = 1200;      // audio stopped (paused video): finish the open sentence
const DETECT_MIN_SPEECH_MS = 1000;
const DETECT_ATTEMPTS = 3;
const MAX_QUEUED = 2;            // captions are live: drop stale sentences rather than lag
const WHISPER_MERGE_SAMPLES = 16000 * 14; // Whisper costs the same up to 30 s, so batch backlog
// Whisper's token budget per second of audio: scripts its tokenizer splits finely (Devanagari,
// Arabic, Cyrillic, CJK) need far more tokens than Latin ones. Capped so a hallucination loop
// on music can't run for long.
const DENSE_SCRIPT_LANGUAGES = new Set(['hi', 'ar', 'ru', 'uk', 'ja', 'zh', 'ko']);
const WHISPER_MAX_TOKENS = 320;
function whisperTokenBudget(language, samples) {
  const perSecond = DENSE_SCRIPT_LANGUAGES.has(language) ? 20 : 10;
  return Math.min(WHISPER_MAX_TOKENS, Math.max(64, 16 + Math.ceil(samples / 16000 * perSecond)));
}

const loadedModels = new Set();
const loadingModels = new Map(); // model key -> Promise
let defaultPrefs = { language: 'en', translateTo: '', model: 'standard' };
const sessions = new Map();      // tabId -> session

// Track whether the worklet module has been registered (once per AudioContext)
const registeredContexts = new WeakSet();

function getExtensionRuntime() {
  return window.LimitrExtensionRuntime || chrome.runtime;
}

function getExtensionURL(path) {
  return getExtensionRuntime().getURL(path);
}

function sendExtensionMessage(payload) {
  try {
    const result = getExtensionRuntime().sendMessage(payload);
    if (result?.catch) result.catch(() => {});
  } catch (e) {}
}

// ── Models ───────────────────────────────────────────────────────

// The larger GPU model only runs where WebGPU is mature (Chromium). In Firefox, a speech model
// on WebGPU has had the GPU process killed under load, so Firefox always stays on WASM.
async function hasF16WebGpu() {
  try {
    if (!navigator.gpu || /Firefox\//.test(navigator.userAgent)) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return Boolean(adapter && adapter.features.has('shader-f16'));
  } catch (e) {
    return false;
  }
}

// The 410 MB GPU model is opt-in: it's a big download and keeps the graphics card busy
let gpuWhisperPromise = null;
async function whisperKey(prefs) {
  if (prefs && prefs.model === 'fast') return 'whisperTiny';
  if (!prefs || prefs.model !== 'large') return 'whisperBase';
  if (!gpuWhisperPromise) gpuWhisperPromise = hasF16WebGpu();
  return (await gpuWhisperPromise) ? 'whisperSmallGpu' : 'whisperBase';
}

// ── The model worker ────────────────────────────────────────────

let modelWorker = null;
let nextCallId = 1;
const pendingCalls = new Map();

function callModels(type, args) {
  if (!modelWorker) {
    modelWorker = new Worker(getExtensionURL('lib/transcriber-worker.js'), { type: 'module' });
    modelWorker.onmessage = ({ data }) => {
      const call = pendingCalls.get(data.id);
      if (!call) return;
      pendingCalls.delete(data.id);
      if (data.error) call.reject(new Error(data.error));
      else call.resolve(data.result);
    };
    // A worker that fails or crashes takes its models with it: fail what's waiting, and the next
    // call starts a fresh one
    modelWorker.onerror = (event) => {
      const error = new Error((event && event.message) || 'The speech model worker stopped');
      for (const call of pendingCalls.values()) call.reject(error);
      pendingCalls.clear();
      modelWorker.terminate();
      modelWorker = null;
      loadedModels.clear();
      loadingModels.clear();
    };
  }
  const id = nextCallId++;
  return new Promise((resolve, reject) => {
    pendingCalls.set(id, { resolve, reject });
    modelWorker.postMessage({ id, type, ...args });
  });
}

// Loads a model in the worker once, telling the popup while it downloads. Returns the key that
// loaded: the GPU model falls back to Whisper base on drivers that report fp16 but can't run it.
async function loadModel(key, tabId) {
  if (loadedModels.has(key)) return key;
  let loading = loadingModels.get(key);
  if (!loading) {
    broadcastStatus(tabId, 'loading', MODELS[key].loading);
    loading = callModels('load', { key }).then(() => { loadedModels.add(key); });
    loadingModels.set(key, loading);
    loading.catch(() => {}).finally(() => loadingModels.delete(key));
  }
  try {
    await loading;
    return key;
  } catch (error) {
    if (key === 'whisperSmallGpu') {
      console.warn('[Limitr Transcriber] GPU Whisper failed, using Whisper base:', error.message);
      gpuWhisperPromise = Promise.resolve(false);
      return loadModel('whisperBase', tabId);
    }
    throw error;
  }
}

// ── The whole-utterance Turkish model (ufak) ─────────────────────

const OFFLINE_LOADING = 'Downloading the live Turkish speech model (ufak, 43 MB, first time only)…';
let offlineWorker = null;
let offlineLoad = null;          // { promise, done }
let nextOfflineId = 1;
const offlineCalls = new Map();  // id -> { resolve, reject }

function offlineCall() {
  if (!offlineWorker) {
    offlineWorker = new Worker(getExtensionURL('lib/stt-offline-worker.js'));
    offlineWorker.onmessage = ({ data }) => {
      if (data.type === 'ready' && offlineLoad) offlineLoad.resolve();
      else if (data.type === 'text' || data.type === 'error') {
        const call = offlineCalls.get(data.id);
        if (data.type === 'error' && data.id === undefined && offlineLoad && !offlineLoad.done) offlineLoad.reject(new Error(data.message));
        if (!call) return;
        offlineCalls.delete(data.id);
        if (data.type === 'error') call.reject(new Error(data.message));
        else call.resolve(data);
      }
    };
    offlineWorker.onerror = (event) => {
      const error = new Error((event && event.message) || 'The Turkish speech worker stopped');
      if (offlineLoad && !offlineLoad.done) offlineLoad.reject(error);
      for (const call of offlineCalls.values()) call.reject(error);
      offlineCalls.clear();
      offlineWorker.terminate();
      offlineWorker = null;
      offlineLoad = null;
    };
  }
  return offlineWorker;
}

function loadOffline(tabId) {
  if (!offlineLoad) {
    broadcastStatus(tabId, 'loading', OFFLINE_LOADING);
    const load = {};
    load.promise = new Promise((resolve, reject) => {
      load.resolve = () => { load.done = true; resolve(); };
      load.reject = (error) => { load.done = true; reject(error); };
    });
    load.promise.catch(() => { if (offlineLoad === load) offlineLoad = null; });
    offlineLoad = load;
    offlineCall().postMessage({ type: 'load' });
  }
  return offlineLoad.promise;
}

function offlineReady() {
  return Boolean(offlineLoad && offlineLoad.done && offlineWorker);
}

function decodeOffline(samples) {
  const id = nextOfflineId++;
  return new Promise((resolve, reject) => {
    offlineCalls.set(id, { resolve, reject });
    offlineCall().postMessage({ type: 'decode', id, samples });
  });
}

function startOffline(session) {
  loadOffline(session.tabId).then(() => {
    if (session.enabled) broadcastStatus(session.tabId, 'active', 'Transcribing');
  }).catch(error => broadcastStatus(session.tabId, 'error', `Load failed: ${error.message}`));
}

// ── Pause-aware segmenter ────────────────────────────────────────
// Energy VAD with an adaptive noise floor: a frame is speech when it is clearly above the
// recent floor. Sentences end after a pause (hangover) or at the quietest point once too long.

class Segmenter {
  constructor(onSegment) {
    this.onSegment = onSegment;
    this.configure(SEGMENTING.moonshine);
    this.carry = new Float32Array(0);
    this.floorDb = -60;
    this.preroll = [];
    this.frames = null;          // frames of the open sentence (null = no sentence)
    this.frameDb = [];
    this.frameSpeech = [];
    this.speechMs = 0;
    this.silenceMs = 0;
    this.sinceInterimMs = 0;
    this.nextId = 1;
    this.lastPushAt = 0;
  }

  configure({ hangoverMs, maxMs, interimMs }) {
    this.hangoverMs = hangoverMs;
    this.maxMs = maxMs;
    this.interimMs = interimMs;
  }

  // Forget the sentence in progress (the language changed under it)
  reset() {
    this.frames = null;
    this.frameDb = [];
    this.frameSpeech = [];
    this.preroll = [];
    this.speechMs = 0;
    this.silenceMs = 0;
    this.sinceInterimMs = 0;
    this.nextId++;
  }

  push(audio) {
    this.lastPushAt = Date.now();
    let data = audio;
    if (this.carry.length) {
      data = new Float32Array(this.carry.length + audio.length);
      data.set(this.carry);
      data.set(audio, this.carry.length);
    }
    let offset = 0;
    for (; offset + FRAME <= data.length; offset += FRAME) this.frame(data.subarray(offset, offset + FRAME));
    this.carry = data.slice(offset);
  }

  frame(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const db = 10 * Math.log10(sum / samples.length + 1e-12);
    // Floor drops at once to quieter frames and creeps up 1 dB/s, so steady music raises it
    this.floorDb = db < this.floorDb ? Math.max(db, -75) : this.floorDb + 0.02;
    const speech = db > Math.max(this.floorDb + 9, -50);
    const copy = samples.slice();

    if (!this.frames) {
      this.preroll.push(copy);
      if (this.preroll.length > PREROLL_FRAMES) this.preroll.shift();
      if (!speech) return;
      this.frames = this.preroll;
      this.frameDb = this.preroll.map(() => -100);
      this.frameSpeech = this.preroll.map(() => false);
      this.preroll = [];
      this.speechMs = FRAME_MS;
      this.silenceMs = 0;
      this.sinceInterimMs = 0;
      return;
    }

    this.frames.push(copy);
    this.frameDb.push(db);
    this.frameSpeech.push(speech);
    this.sinceInterimMs += FRAME_MS;
    if (speech) {
      this.speechMs += FRAME_MS;
      this.silenceMs = 0;
    } else {
      this.silenceMs += FRAME_MS;
    }

    if (this.silenceMs >= this.hangoverMs) {
      this.finish(this.frames.length - Math.max(0, Math.round((this.silenceMs - 200) / FRAME_MS)));
    } else if (this.frames.length * FRAME_MS >= this.maxMs) {
      this.finish(this.cutPoint(), true);
    } else if (this.interimMs && this.sinceInterimMs >= this.interimMs && this.speechMs >= MIN_SPEECH_MS) {
      this.sinceInterimMs = 0;
      this.onSegment(concat(this.frames), { final: false, id: this.nextId, speechMs: this.speechMs });
    }
  }

  // Too long without a full pause: cut in the middle of the longest short pause of the last 2 s,
  // or at the quietest frame if there is none (cutting at "quiet" alone lands inside an "s")
  cutPoint() {
    const from = Math.max(1, this.frames.length - 100);
    let bestStart = -1;
    let bestLength = 0;
    let runStart = -1;
    for (let i = from; i <= this.frames.length; i++) {
      const silent = i < this.frames.length && !this.frameSpeech[i];
      if (silent && runStart < 0) runStart = i;
      if (!silent && runStart >= 0) {
        if (i - runStart > bestLength) {
          bestLength = i - runStart;
          bestStart = runStart;
        }
        runStart = -1;
      }
    }
    if (bestLength >= 2) return bestStart + Math.floor(bestLength / 2);
    let cut = this.frames.length;
    let quietest = Infinity;
    for (let i = from; i < this.frames.length; i++) {
      if (this.frameDb[i] < quietest) {
        quietest = this.frameDb[i];
        cut = i;
      }
    }
    return cut;
  }

  // Finish the open sentence at frame index `end`; with `carryOn`, the rest starts the next one
  finish(end, carryOn = false) {
    const frames = this.frames;
    const rest = frames.slice(end);
    const restDb = this.frameDb.slice(end);
    const restSpeech = this.frameSpeech.slice(end);
    if (this.speechMs >= MIN_SPEECH_MS) {
      this.onSegment(concat(frames.slice(0, end)), { final: true, id: this.nextId, speechMs: this.speechMs });
      this.nextId++;
    }
    if (carryOn && rest.length) {
      this.frames = rest;
      this.frameDb = restDb;
      this.frameSpeech = restSpeech;
      this.speechMs = restSpeech.filter(Boolean).length * FRAME_MS;
    } else {
      this.frames = null;
      this.frameDb = [];
      this.frameSpeech = [];
      this.speechMs = 0;
      this.preroll = rest.slice(-PREROLL_FRAMES);
    }
    this.silenceMs = 0;
    this.sinceInterimMs = 0;
  }

  // Called on a timer: when audio stops arriving (paused video), finish what was said
  flushIfIdle() {
    if (this.frames && Date.now() - this.lastPushAt > IDLE_FLUSH_MS) this.finish(this.frames.length);
  }
}

function concat(frames) {
  const out = new Float32Array(frames.length * FRAME);
  frames.forEach((frame, i) => out.set(frame, i * FRAME));
  return out;
}

// ── Translation ──────────────────────────────────────────────────

const translators = new Map();   // "src>dst" -> { translator, status, checkedAt }
const TRANSLATOR_RECHECK_MS = 10000;

function translatorApi() {
  return typeof self !== 'undefined' && self.Translator ? self.Translator : null;
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

// Chrome/Edge on-device translator for a pair, or null — never blocks captions. A pair that
// still needs downloading can only be created from a click, so the popup is asked to offer the
// download; one that is downloading is created in the background and used once ready.
async function translatorFor(tabId, source, target) {
  const api = translatorApi();
  if (!api || !source || !target || source === target) return null;
  const key = `${source}>${target}`;
  let entry = translators.get(key);
  if (entry) {
    if (entry.translator || entry.pending || Date.now() - entry.checkedAt < TRANSLATOR_RECHECK_MS) {
      return entry.translator;
    }
  }
  entry = { translator: null, pending: null, checkedAt: Date.now() };
  translators.set(key, entry);

  let status;
  try {
    status = await withTimeout(api.availability({ sourceLanguage: source, targetLanguage: target }), 2000);
  } catch (error) {
    return null;
  }
  if (status === 'available' || status === 'downloading') {
    entry.pending = api.create({ sourceLanguage: source, targetLanguage: target })
      .then(translator => { entry.translator = translator; })
      .catch(() => {})
      .finally(() => {
        entry.pending = null;
        entry.checkedAt = Date.now();
      });
    if (status === 'available') await withTimeout(entry.pending, 1500).catch(() => {});
  } else if (status === 'downloadable') {
    broadcastStatus(tabId, 'translation-download', 'Translation needs a one-time download', { source, target });
  }
  return entry.translator;
}

// ── Sessions ─────────────────────────────────────────────────────

function newSession(tabId, prefs) {
  const session = {
    tabId,
    prefs: { ...prefs },
    language: prefs.language === 'auto' ? null : prefs.language,
    detectAttempts: 0,
    queue: [],
    interim: null,
    busy: false,
    captureNode: null,
    enabled: true,
    generation: 0,      // bumped when the language changes; older jobs are discarded
    live: new Map()     // ufak's sentences being spoken: id → { agreement, lines, decodedAt }
  };
  session.segmenter = new Segmenter((audio, info) => onSegment(session, audio, info));
  applySegmenting(session);
  session.idleTimer = setInterval(() => session.segmenter.flushIfIdle(), 400);
  return session;
}

function engineFor(session) {
  if (session.language === 'en') return 'moonshine';
  if (session.language === 'tr') return 'ufak';
  return 'whisper';
}

// Until the language is known, cut like Whisper (detection needs whole sentences)
function applySegmenting(session, engine = session.language ? engineFor(session) : 'whisper') {
  session.segmenting = engine;
  session.segmenter.configure(SEGMENTING[engine]);
}

function onSegment(session, audio, info) {
  if (!session.enabled) return;
  info = { ...info, generation: session.generation };
  if (info.final) {
    session.queue.push({ audio, ...info });
    // Whisper merges a backlog into one call instead of dropping it (see pump)
    const limit = session.language && engineFor(session) === 'whisper' ? MAX_QUEUED * 3 : MAX_QUEUED;
    while (session.queue.length > limit) session.queue.shift();
    if (session.interim && session.interim.id === info.id) session.interim = null;
  } else if (session.language) {
    session.interim = { audio, ...info };
  }
  pump(session);
}

async function pump(session) {
  if (session.busy || !session.enabled) return;
  let job = session.queue.shift() || session.interim;
  if (!job) return;
  if (job === session.interim) session.interim = null;
  else if (session.language && engineFor(session) === 'whisper') job = mergeBacklog(session, job);
  session.busy = true;
  try {
    await runJob(session, job);
  } catch (error) {
    console.error('[Limitr Transcriber] Transcription error:', error);
  } finally {
    session.busy = false;
    if (session.enabled) pump(session);
  }
}

// Sentences that piled up while Whisper was busy go out as one call: same cost, nothing lost
function mergeBacklog(session, job) {
  const parts = [job];
  let samples = job.audio.length;
  while (session.queue.length && session.queue[0].generation === job.generation &&
    samples + session.queue[0].audio.length <= WHISPER_MERGE_SAMPLES) {
    const next = session.queue.shift();
    parts.push(next);
    samples += next.audio.length;
  }
  if (parts.length === 1) return job;
  const audio = new Float32Array(samples);
  let offset = 0;
  for (const part of parts) {
    audio.set(part.audio, offset);
    offset += part.audio.length;
  }
  const last = parts[parts.length - 1];
  return { ...last, audio, speechMs: parts.reduce((sum, p) => sum + p.speechMs, 0) };
}

async function runJob(session, job) {
  const { tabId } = session;
  const started = performance.now();
  let encodedKey = null;         // the model language detection just encoded this audio with

  if (!session.language) {
    if (job.speechMs < DETECT_MIN_SPEECH_MS && session.detectAttempts < DETECT_ATTEMPTS - 1) return;
    const key = await loadModel(await whisperKey(session.prefs), tabId);
    if (!session.enabled) return;
    const { language, probability } = await callModels('detect', { key, audio: job.audio });
    encodedKey = key;
    if (job.generation !== session.generation) return;
    session.detectAttempts++;
    if (probability >= 0.5 || session.detectAttempts >= DETECT_ATTEMPTS) {
      session.language = language;
      applySegmenting(session);
      broadcastStatus(tabId, 'language', `Listening in ${language}`, { language, probability });
      if (engineFor(session) === 'ufak') startOffline(session);
    }
    job = { ...job, language };
  }

  const language = session.language || job.language;
  const target = translatorApi() ? session.prefs.translateTo : '';
  const wantsTranslation = Boolean(target && target !== language);
  // Without an on-device translator, Whisper itself can turn any language but English into English
  let translator = null;
  if (wantsTranslation && language !== 'en') translator = await translatorFor(tabId, language, target);
  else if (job.final && wantsTranslation) translator = await translatorFor(tabId, language, target);
  const whisperTranslates = wantsTranslation && !translator && target === 'en' && language !== 'en';
  // Turkish goes to ufak, unless only Whisper can translate it; while ufak loads it waits for it
  // rather than downloading Whisper meanwhile (if ufak fails, Whisper does it)
  if (language === 'tr' && !whisperTranslates && offlineLoad && !offlineLoad.done) await offlineLoad.promise.catch(() => {});
  if (!session.enabled || job.generation !== session.generation) return;
  const engine = language === 'en' ? 'moonshine'
    : language === 'tr' && !whisperTranslates && offlineReady() ? 'ufak' : 'whisper';
  // Cut for the engine doing the work: Whisper takes Turkish over to translate it (or if ufak
  // failed), and gives it back once the browser can translate
  if (session.language && session.segmenting !== engine) applySegmenting(session, engine);
  // Whisper gets finished sentences only
  if (!job.final && engine === 'whisper') return;

  const key = engine === 'ufak' ? null : await loadModel(engine === 'moonshine' ? 'moonshine' : await whisperKey(session.prefs), tabId);
  if (!session.enabled) return;
  if (session.activeEngine !== engine) {
    // A model may just have finished downloading for this engine
    session.activeEngine = engine;
    broadcastStatus(tabId, 'active', 'Transcribing');
  }

  const lines = engine === 'ufak' ? await liveLines(session, job) : [{
    text: await callModels('transcribe', {
      key,
      audio: job.audio,
      options: engine === 'moonshine' ? null : {
        language,
        task: whisperTranslates ? 'translate' : 'transcribe',
        max_new_tokens: whisperTokenBudget(whisperTranslates ? 'en' : language, job.audio.length)
      },
      reuseEncoding: encodedKey === key
    }),
    final: job.final,
    segmentId: job.id
  }];
  for (const line of lines) {
    const text = cleanText(line.text, job.speechMs);
    if (!session.enabled || job.generation !== session.generation) return;
    if (!text) continue;
    const result = {
      text,
      final: line.final,
      segmentId: line.segmentId,
      language: whisperTranslates ? 'en' : language,
      engine,
      timestamp: Date.now(),
      latencyMs: Math.round(performance.now() - started)
    };
    if (whisperTranslates) result.translatedFrom = language;
    if (translator && line.final) {
      try {
        result.translation = await withTimeout(translator.translate(text), 4000);
        result.translatedTo = target;
      } catch (error) {
        console.warn('[Limitr Transcriber] Translation failed:', error.message);
      }
    }
    broadcastTranscription(tabId, result);
  }
}

// ufak, live: each call decodes the sentence only from a little before its last committed word,
// and the agreement turns that into lines. Those finished (at a full stop, at a pause once 4 s
// long, or at 8 s) go out as final lines of their own, `<sentence id>.<n>`, then the one being
// spoken as the next. Nothing for a call skipped to save time (a long window decoded under a
// second ago).
async function liveLines(session, job) {
  let live = session.live.get(job.id);
  if (!live) {
    live = { agreement: new LiveAgreement(), lines: 0, decodedAt: -Infinity };
    session.live.set(job.id, live);
  }
  const from = live.agreement.windowStart();
  const now = job.audio.length / SAMPLE_RATE;
  if (!job.final && now - from > LIVE_SLOW_WINDOW_S && performance.now() - live.decodedAt < LIVE_SLOW_REFRESH_MS) return [];
  live.decodedAt = performance.now();
  const decoded = await decodeOffline(job.audio.slice(Math.round(from * SAMPLE_RATE)));
  const { done, line } = live.agreement.update(decoded, from, now, job.final);
  const lines = done.map(text => ({ text, final: true, segmentId: `${job.id}.${live.lines++}` }));
  if (line) lines.push({ text: line, final: false, segmentId: `${job.id}.${live.lines}` });
  // The sentence is over, and so is any before it whose end was dropped from a backlog
  if (job.final) for (const id of session.live.keys()) if (id <= job.id) session.live.delete(id);
  return lines;
}

function getOrCreateSession(tabId, prefs) {
  let session = sessions.get(tabId);
  if (!session) {
    session = newSession(tabId, prefs || defaultPrefs);
    sessions.set(tabId, session);
  }
  return session;
}

function endSession(tabId) {
  const session = sessions.get(tabId);
  if (!session) return;
  session.enabled = false;
  session.queue = [];
  session.interim = null;
  clearInterval(session.idleTimer);
  if (session.captureNode) {
    session.captureNode.port.postMessage({ type: 'enable', enabled: false });
    try { session.captureNode.disconnect(); } catch (e) {}
  }
  sessions.delete(tabId);
}

function setPrefs(session, prefs) {
  const languageChanged = prefs.language !== session.prefs.language;
  session.prefs = { ...prefs };
  if (languageChanged) {
    session.language = prefs.language === 'auto' ? null : prefs.language;
    session.detectAttempts = 0;
    session.generation++;
    session.queue = [];
    session.interim = null;
    session.live.clear();
    session.segmenter.reset();
    applySegmenting(session);
  }
}

// Load the engine the session will most likely need, so the first sentence isn't late
async function preload(session) {
  // Turkish needs only ufak (Whisper is loaded if ever needed: to translate, or if ufak fails)
  if (session.language && engineFor(session) === 'ufak') {
    try {
      await loadOffline(session.tabId);
    } catch (error) {
      broadcastStatus(session.tabId, 'error', `Load failed: ${error.message}`);
      throw error;
    }
    session.activeEngine = 'ufak';
    if (session.enabled) broadcastStatus(session.tabId, 'active', 'Transcribing');
    return;
  }
  const key = session.language === 'en' ? 'moonshine' : await whisperKey(session.prefs);
  try {
    await loadModel(key, session.tabId);
  } catch (error) {
    broadcastStatus(session.tabId, 'error', `Load failed: ${error.message}`);
    throw error;
  }
  session.activeEngine = session.language ? engineFor(session) : null;
  if (session.enabled) broadcastStatus(session.tabId, 'active', 'Transcribing');
}

// ── Audio Capture (AudioWorkletNode) ─────────────────────────────

async function startCapture(session, audioContext, sourceNode) {
  // A tab captioned from page audio (startExternal) has a session but no capture node yet
  if (session.captureNode) return;

  if (!registeredContexts.has(audioContext)) {
    await audioContext.audioWorklet.addModule(getExtensionURL('lib/transcriber-capture-worklet.js'));
    registeredContexts.add(audioContext);
  }
  const captureNode = new AudioWorkletNode(audioContext, 'transcriber-capture-processor', {
    numberOfOutputs: 0
  });
  captureNode.port.onmessage = (event) => {
    if (event.data.type === 'audio-chunk' && session.enabled) session.segmenter.push(event.data.audio);
  };
  // The node has no outputs, so it's pulled without reaching destination
  sourceNode.connect(captureNode);
  session.captureNode = captureNode;
}

// ── Messaging ────────────────────────────────────────────────────

function broadcastTranscription(tabId, result) {
  sendExtensionMessage({ action: 'transcription-result', tabId, result });
}

function broadcastStatus(tabId, status, message, extra = {}) {
  const payload = { action: 'transcription-status', status, message, ...extra };
  if (tabId !== undefined) payload.tabId = tabId;
  sendExtensionMessage(payload);
}

// ── Public API (exposed on window for offscreen.js / background.js) ──

window.LimitrTranscriber = {
  // Capture mode: tap the captured stream directly
  async start(tabId, audioContext, sourceNode, prefs) {
    if (prefs) defaultPrefs = { ...prefs };
    const session = getOrCreateSession(tabId, prefs);
    if (prefs) setPrefs(session, prefs);
    await preload(session);
    await startCapture(session, audioContext, sourceNode);
  },

  // Page mode: audio arrives through pushAudio()
  async startExternal(tabId, prefs) {
    if (prefs) defaultPrefs = { ...prefs };
    const session = getOrCreateSession(tabId, prefs);
    if (prefs) setPrefs(session, prefs);
    await preload(session);
  },

  configure(prefs) {
    defaultPrefs = { ...prefs };
    for (const session of sessions.values()) {
      setPrefs(session, prefs);
      preload(session).catch(() => {});
    }
  },

  pushAudio(tabId, audio) {
    const session = sessions.get(tabId);
    if (session && session.enabled) session.segmenter.push(audio);
  },

  stop(tabId) {
    endSession(tabId);
    broadcastStatus(tabId, 'stopped', 'Stopped');
  },

  isActive(tabId) {
    return sessions.has(tabId);
  },

  isReady() {
    return loadedModels.size > 0 || offlineReady();
  },

  isModelLoading() {
    return loadingModels.size > 0 || Boolean(offlineLoad && !offlineLoad.done);
  },

  sessionInfo(tabId) {
    const session = sessions.get(tabId);
    return session ? { language: session.language, prefs: session.prefs } : null;
  }
};

console.log('[Limitr Transcriber] Module loaded');
