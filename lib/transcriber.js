// Limitr Transcriber — live captions, entirely on this computer
// Loaded as an ES module in the offscreen document (Chrome) or the background page (Firefox).
//
//   audio (16 kHz, 0.5 s chunks) → pause-aware segmenter → engine → [translation] → broadcast
//
// Engines (via @huggingface/transformers):
//   - English: Moonshine base. Its cost scales with the audio length, so it can refresh the
//     line being spoken about once a second and finish it at the next pause.
//   - Everything else: Whisper base on the CPU, or Whisper small on the GPU when the user turned
//     on the larger model and the GPU can run it. Whisper pads every call to 30 s, so it only
//     transcribes finished sentences.
// Auto language: Whisper's language-ID step runs once on the first sentence and the result is
// kept for the rest of the session.
// Translation: only where the browser has the on-device Translator API (Chrome/Edge). When it
// can't do a pair into English, Whisper translates into English instead. Elsewhere (Firefox)
// captions are never translated.

// ── Suppress "powerPreference is currently ignored" Chrome/Windows warning ──
// ONNX Runtime probes WebGPU by calling navigator.gpu.requestAdapter() with
// powerPreference even when we only use WASM. Patch it before any import.
if (typeof navigator !== 'undefined' && navigator.gpu && navigator.gpu.requestAdapter) {
  const _origRA = navigator.gpu.requestAdapter.bind(navigator.gpu);
  navigator.gpu.requestAdapter = (opts) => {
    if (opts) {
      const { powerPreference, ...rest } = opts;
      return _origRA(Object.keys(rest).length ? rest : undefined);
    }
    return _origRA(opts);
  };
}

const SAMPLE_RATE = 16000;

const MODELS = {
  moonshine: {
    id: 'onnx-community/moonshine-base-ONNX',
    options: { dtype: 'q8', device: 'wasm' },
    loading: 'Downloading the English speech model (first time only)…'
  },
  whisperBase: {
    id: 'onnx-community/whisper-base',
    options: { dtype: 'q8', device: 'wasm' },
    loading: 'Downloading the speech model for other languages (77 MB, first time only)…'
  },
  whisperSmallGpu: {
    id: 'onnx-community/whisper-small',
    options: { dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' }, device: 'webgpu' },
    loading: 'Downloading the larger speech model for this graphics card (410 MB, first time only)…'
  }
};

// Segmenter tuning per engine: how long a pause ends a sentence, the longest piece sent at once,
// and how often the line being spoken is refreshed (Moonshine only)
const SEGMENTING = {
  moonshine: { hangoverMs: 240, maxMs: 8000, interimMs: 1000 },
  whisper: { hangoverMs: 450, maxMs: 9000, interimMs: 0 }
};

const FRAME = 320;               // 20 ms at 16 kHz
const FRAME_MS = 20;
const PREROLL_FRAMES = 15;       // keep 300 ms before speech starts
const MIN_SPEECH_MS = 300;       // shorter blips are dropped
const IDLE_FLUSH_MS = 1200;      // audio stopped (paused video): finish the open sentence
const DETECT_MIN_SPEECH_MS = 1000;
const DETECT_ATTEMPTS = 3;
const MAX_QUEUED = 2;            // captions are live: drop stale sentences rather than lag
const WHISPER_MERGE_SAMPLES = 16000 * 14; // Whisper costs the same up to 30 s, so batch backlog

let transformersModulePromise = null;
let pipeline = null;
let env = null;
let Tensor = null;

const pipelines = new Map();     // model key -> Promise<pipeline>
const loadedModels = new Set();
let loadingCount = 0;
let defaultPrefs = { language: 'en', translateTo: '', largeModel: false };
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

// Cross-realm-safe model input normalization.
// In Firefox content-script sandboxes, `instanceof` fails across realms, so we
// must lead with Object.prototype.toString tags and fall back to structural
// checks. The goal: always return a string path or a local-realm Uint8Array,
// never pass a foreign typed array to ORT.
async function normalizeOnnxModelInput(input) {
  if (input == null) return input;
  const tag = Object.prototype.toString.call(input);

  if (typeof input === 'string') return input;

  // Same-realm Uint8Array — zero-copy.
  if (input instanceof Uint8Array) return input;

  // Cross-realm Uint8Array — rewrap so ORT's instanceof check passes.
  if (tag === '[object Uint8Array]') {
    const buf = input.buffer;
    if (buf) return new Uint8Array(buf, input.byteOffset || 0, input.byteLength);
    const copy = new Uint8Array(input.length >>> 0);
    for (let i = 0; i < copy.length; i++) copy[i] = input[i];
    return copy;
  }

  // Any other typed array view (same- or cross-realm).
  if (
    ArrayBuffer.isView(input) ||
    /^\[object (?:Int|Uint|Float|BigInt|BigUint)(?:8|16|32|64)(?:Clamped)?Array\]$/.test(tag)
  ) {
    const buf = input.buffer;
    if (buf) return new Uint8Array(buf, input.byteOffset || 0, input.byteLength);
  }

  // ArrayBuffer / SharedArrayBuffer (same- or cross-realm).
  if (
    input instanceof ArrayBuffer ||
    tag === '[object ArrayBuffer]' ||
    tag === '[object SharedArrayBuffer]' ||
    (typeof SharedArrayBuffer !== 'undefined' && input instanceof SharedArrayBuffer)
  ) {
    return new Uint8Array(input);
  }

  // Object-shape with a buffer property.
  if (input.buffer) {
    const bufTag = Object.prototype.toString.call(input.buffer);
    if (
      input.buffer instanceof ArrayBuffer ||
      bufTag === '[object ArrayBuffer]' ||
      bufTag === '[object SharedArrayBuffer]'
    ) {
      return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength || input.buffer.byteLength);
    }
  }

  // Blob or blob-like.
  if ((typeof Blob !== 'undefined' && input instanceof Blob) || typeof input.arrayBuffer === 'function') {
    return new Uint8Array(await input.arrayBuffer());
  }

  return input;
}

async function ensureTransformersModule() {
  if (pipeline && env && Tensor) return;

  if (!transformersModulePromise) {
    transformersModulePromise = (async () => {
      const ort = await import('./ort.bundle.min.mjs');
      const InferenceSession = ort.InferenceSession;
      const originalCreate = InferenceSession.create.bind(InferenceSession);

      const patched = async (model, ...args) => {
        const normalized = await normalizeOnnxModelInput(model);
        try {
          return await originalCreate(normalized, ...args);
        } catch (e) {
          // Defensive: if realms ever split inside a document context (shouldn't
          // happen on Firefox background or Chrome offscreen, but kept for
          // content-script loads), fall back to a Blob URL string which is
          // typeof-checked rather than instanceof-checked.
          // Firefox content-script dynamic imports can place ORT, transformers,
          // and this module in separate realms, so `instanceof Uint8Array`
          // inside ORT fails regardless of how cleanly we wrap the bytes.
          // The string-path branch of ORT.create uses `typeof === 'string'`,
          // which is realm-agnostic — hand it a Blob URL instead.
          const byteLength = normalized?.byteLength;
          if (
            e instanceof TypeError &&
            typeof e.message === 'string' &&
            e.message.includes("'path' or 'buffer'") &&
            typeof byteLength === 'number'
          ) {
            const bytes = normalized instanceof Uint8Array
              ? normalized
              : new Uint8Array(normalized.buffer || normalized);
            const url = URL.createObjectURL(new Blob([bytes]));
            try {
              return await originalCreate(url, ...args);
            } finally {
              URL.revokeObjectURL(url);
            }
          }
          throw e;
        }
      };

      // Prefer defineProperty so we fail loudly rather than silently if the
      // bundler marked `.create` non-writable (rare, but possible).
      try {
        Object.defineProperty(InferenceSession, 'create', {
          value: patched,
          writable: true,
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        InferenceSession.create = patched;
      }

      globalThis[Symbol.for('onnxruntime')] = ort;

      const transformers = await import('./transformers.min.js');
      pipeline = transformers.pipeline;
      env = transformers.env;
      Tensor = transformers.Tensor;
    })();
  }

  await transformersModulePromise;
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
  if (!prefs || !prefs.largeModel) return 'whisperBase';
  if (!gpuWhisperPromise) gpuWhisperPromise = hasF16WebGpu();
  return (await gpuWhisperPromise) ? 'whisperSmallGpu' : 'whisperBase';
}

async function getPipeline(key, tabId) {
  if (!pipelines.has(key)) {
    const model = MODELS[key];
    const promise = (async () => {
      loadingCount++;
      broadcastStatus(tabId, 'loading', model.loading);
      try {
        await ensureTransformersModule();
        env.backends.onnx.wasm.wasmPaths = getExtensionURL('lib/');
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        const asr = await pipeline('automatic-speech-recognition', model.id, model.options);
        loadedModels.add(key);
        return asr;
      } finally {
        loadingCount--;
      }
    })();
    pipelines.set(key, promise);
    promise.catch(() => pipelines.delete(key));
  }
  try {
    return await pipelines.get(key);
  } catch (error) {
    // The GPU model can fail on drivers that report fp16 support but can't run it
    if (key === 'whisperSmallGpu') {
      console.warn('[Limitr Transcriber] GPU Whisper failed, using Whisper base:', error.message);
      gpuWhisperPromise = Promise.resolve(false);
      return getPipeline('whisperBase', tabId);
    }
    throw error;
  }
}

async function whisperPipeline(session) {
  return getPipeline(await whisperKey(session.prefs), session.tabId);
}

// Whisper language ID: one decoder step after <|startoftranscript|>, argmax over the
// language tokens. transformers.js 3.x defaults to English instead of detecting.
async function detectLanguage(asr, audio) {
  const config = asr.model.generation_config;
  const inputs = await asr.processor(audio);
  const decoderInputIds = new Tensor('int64', BigInt64Array.from([BigInt(config.decoder_start_token_id)]), [1, 1]);
  const { logits } = await asr.model({ ...inputs, decoder_input_ids: decoderInputIds });
  const vocab = logits.dims[logits.dims.length - 1];
  const last = logits.data.length - vocab;
  let best = null;
  let max = -Infinity;
  const scores = [];
  for (const [token, id] of Object.entries(config.lang_to_id)) {
    const value = logits.data[last + id];
    scores.push(value);
    if (value > max) {
      max = value;
      best = token;
    }
  }
  const total = scores.reduce((sum, v) => sum + Math.exp(v - max), 0);
  return { language: best.replace(/[<|>]/g, ''), probability: 1 / total };
}

// ── Cleaning model output ────────────────────────────────────────

const STOCK_HALLUCINATIONS = /^(you|thank you\.?|thanks for watching!?|bye\.?|subtitles by .*|altyazı .*)$/i;

function cleanText(text, speechMs) {
  let t = String(text || '')
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // A phrase stuck on repeat: short ones three times, longer ones twice
  t = t.replace(/(\b.{3,40}?)(?:\s*\1){2,}/giu, '$1').replace(/(\b.{12,60}?)(?:\s*\1)+/giu, '$1');
  if (!/[\p{L}\p{N}]/u.test(t)) return '';
  if (speechMs < 1200 && STOCK_HALLUCINATIONS.test(t)) return '';
  return t;
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
    generation: 0       // bumped when the language changes; older jobs are discarded
  };
  session.segmenter = new Segmenter((audio, info) => onSegment(session, audio, info));
  applySegmenting(session);
  session.idleTimer = setInterval(() => session.segmenter.flushIfIdle(), 400);
  return session;
}

function engineFor(session) {
  return session.language === 'en' ? 'moonshine' : 'whisper';
}

function applySegmenting(session) {
  // Until the language is known, cut like Whisper (detection needs whole sentences)
  session.segmenter.configure(SEGMENTING[session.language ? engineFor(session) : 'whisper']);
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

  if (!session.language) {
    if (job.speechMs < DETECT_MIN_SPEECH_MS && session.detectAttempts < DETECT_ATTEMPTS - 1) return;
    const asr = await whisperPipeline(session);
    if (!session.enabled) return;
    const { language, probability } = await detectLanguage(asr, job.audio);
    if (job.generation !== session.generation) return;
    session.detectAttempts++;
    if (probability >= 0.5 || session.detectAttempts >= DETECT_ATTEMPTS) {
      session.language = language;
      applySegmenting(session);
      broadcastStatus(tabId, 'language', `Listening in ${language}`, { language, probability });
    }
    job = { ...job, language };
  }

  const language = session.language || job.language;
  const target = translatorApi() ? session.prefs.translateTo : '';
  const wantsTranslation = Boolean(target && target !== language);
  const engine = language === 'en' ? 'moonshine' : 'whisper';

  // Without an on-device translator, Whisper itself can turn any language into English
  let translator = null;
  if (job.final && wantsTranslation) translator = await translatorFor(tabId, language, target);
  const whisperTranslates = wantsTranslation && !translator && target === 'en' && engine === 'whisper';
  if (!job.final && whisperTranslates) return;

  const asr = engine === 'moonshine' ? await getPipeline('moonshine', tabId) : await whisperPipeline(session);
  if (!session.enabled) return;
  if (session.activeEngine !== engine) {
    // A model may just have finished downloading for this engine
    session.activeEngine = engine;
    broadcastStatus(tabId, 'active', 'Transcribing');
  }

  const output = engine === 'moonshine'
    ? await asr(job.audio)
    : await asr(job.audio, {
      language,
      task: whisperTranslates ? 'translate' : 'transcribe',
      max_new_tokens: 96
    });
  const text = cleanText(output && output.text, job.speechMs);
  if (!text || !session.enabled || job.generation !== session.generation) return;

  const result = {
    text,
    final: job.final,
    segmentId: job.id,
    language: whisperTranslates ? 'en' : language,
    engine,
    timestamp: Date.now(),
    latencyMs: Math.round(performance.now() - started)
  };
  if (whisperTranslates) result.translatedFrom = language;
  if (translator && job.final) {
    try {
      result.translation = await withTimeout(translator.translate(text), 4000);
      result.translatedTo = target;
    } catch (error) {
      console.warn('[Limitr Transcriber] Translation failed:', error.message);
    }
  }
  broadcastTranscription(tabId, result);
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
    session.segmenter.reset();
    applySegmenting(session);
  }
}

// Load the engine the session will most likely need, so the first sentence isn't late
async function preload(session) {
  const key = session.language === 'en' ? 'moonshine' : await whisperKey(session.prefs);
  try {
    await getPipeline(key, session.tabId);
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
    return loadedModels.size > 0;
  },

  isModelLoading() {
    return loadingCount > 0;
  },

  sessionInfo(tabId) {
    const session = sessions.get(tabId);
    return session ? { language: session.language, prefs: session.prefs } : null;
  }
};

console.log('[Limitr Transcriber] Module loaded');
