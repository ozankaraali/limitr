// Turkish caption engines side by side inside an extension page, on the CPU only (WebGPU is hidden
// from this page before ONNX Runtime loads, as in asr-bench.js): Whisper through transformers.js on
// the finished sentences the captions segmenter would send it, and ufak (lib/stt-offline-worker.js)
// on the pieces it would get, whole or through the live agreement (lib/live-agreement.js). Driven
// by tests/bench/turkish-captions-bench.js.

Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });

const WHISPER = {
  tiny: { id: 'onnx-community/whisper-tiny', options: { dtype: 'q8', device: 'wasm' } },
  base: { id: 'onnx-community/whisper-base', options: { dtype: 'q8', device: 'wasm' } },
  small: { id: 'onnx-community/whisper-small', options: { dtype: 'q8', device: 'wasm' } }
};
const SAMPLE_RATE = 16000;

let transformers = null;
const pipelines = {};
let offline = null;
let offlinePending = null;   // the reply the ufak worker owes us

function decodePcm(base64) {
  const binary = atob(base64);
  const audio = new Float32Array(binary.length >> 1);
  for (let i = 0; i < audio.length; i++) {
    audio[i] = ((binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8)) << 16 >> 16) / 0x8000;
  }
  return audio;
}

function askOffline(message, transfer = []) {
  return new Promise((resolve, reject) => {
    offlinePending = { resolve, reject };
    offline.postMessage(message, transfer);
  });
}

window.bench = {
  async offlineLoad() {
    const started = performance.now();
    offline = new Worker(chrome.runtime.getURL('lib/stt-offline-worker.js'));
    offline.onmessage = event => {
      const msg = event.data;
      if (msg.type === 'progress' || !offlinePending) return;
      const { resolve, reject } = offlinePending;
      offlinePending = null;
      if (msg.type === 'error') reject(new Error(msg.message));
      else resolve(msg);
    };
    offline.onerror = event => {
      if (offlinePending) offlinePending.reject(new Error(event.message || 'worker error'));
      offlinePending = null;
    };
    const ready = await askOffline({ type: 'load' });
    return { ...ready, loadMs: performance.now() - started };
  },

  // Each [start, end] piece (seconds) of the clip decoded on its own: milliseconds and text
  async offlineDecode(base64, pieces) {
    const audio = decodePcm(base64);
    const out = [];
    for (const [start, end] of pieces) {
      const samples = audio.slice(Math.round(start * SAMPLE_RATE), Math.round(end * SAMPLE_RATE));
      const r = await askOffline({ type: 'decode', id: out.length, samples }, [samples.buffer]);
      out.push({ ms: r.decodeMs, text: r.text, tokens: r.tokens, timestamps: r.timestamps, ys_log_probs: r.ys_log_probs });
    }
    return out;
  },

  // ufak through the live agreement, served as the captions pipeline would: sentences
  // [[start, end, sentAt, ticks]] (seconds; ticks: [pieceStart, at]) in time order, one call at a
  // time, finished sentences first, only the newest call for an open sentence waiting. Returns
  // every call made (when it was done on a live clock, and the lines it sent: id, text, final),
  // and per sentence its lines and final words
  async offlineLive(base64, sentences, options = {}) {
    const { LiveAgreement } = await import('../../lib/live-agreement.js');
    const audio = decodePcm(base64);
    const events = [];
    sentences.forEach(([, , sentAt, ticks], s) => {
      for (const [, at] of ticks) events.push({ s, time: at, final: false });
      events.push({ s, time: sentAt, final: true });
    });
    events.sort((a, b) => a.time - b.time || (a.final ? 1 : -1));
    const states = sentences.map(() => ({ live: new LiveAgreement(options), lines: [] }));
    const calls = [];
    const queue = [];
    let interim = null;
    let busyUntil = 0;
    let i = 0;
    // options.slowWindow: past this many seconds of window, an open sentence is decoded at most
    // once a second (options.slowRefresh)
    const slowWindow = options.slowWindow || Infinity;
    const slowRefresh = options.slowRefresh || 1;
    const admit = e => {
      if (e.final) {
        queue.push(e);
        if (interim && interim.s === e.s) interim = null;
      } else {
        const st = states[e.s];
        const [start] = sentences[e.s];
        if (st.lastCall !== undefined && e.time - start - st.live.windowStart() > slowWindow && e.time - st.lastCall < slowRefresh - 1e-6) return;
        interim = e;
      }
    };
    while (i < events.length || queue.length || interim) {
      while (i < events.length && events[i].time <= busyUntil) admit(events[i++]);
      if (!queue.length && !interim) {
        if (i >= events.length) break;
        busyUntil = Math.max(busyUntil, events[i].time);
        continue;
      }
      const job = queue.shift() || interim;
      if (job === interim) interim = null;
      const [start, end] = sentences[job.s];
      const now = job.final ? end : job.time;
      const st = states[job.s];
      st.lastCall = job.time;
      const from = st.live.windowStart();
      const samples = audio.slice(Math.round((start + from) * SAMPLE_RATE), Math.round(now * SAMPLE_RATE));
      const seconds = samples.length / SAMPLE_RATE;
      const r = await askOffline({ type: 'decode', id: calls.length, samples }, [samples.buffer]);
      const done = Math.max(busyUntil, job.time) + r.decodeMs / 1000;
      busyUntil = done;
      const out = st.live.update(r, from, now - start, job.final);
      // The lines the overlay gets, as lib/transcriber.js sends them
      const lines = out.done.map((text, k) => ({ id: `${job.s}.${st.lines.length + k}`, text, final: true }));
      st.lines.push(...out.done);
      if (out.line) lines.push({ id: `${job.s}.${st.lines.length}`, text: out.line, final: false });
      calls.push({ s: job.s, time: job.time, done, ms: r.decodeMs, final: job.final, seconds, from: start + from, text: r.text, lines });
    }
    return {
      calls,
      sentences: states.map((st, s) => ({
        lines: st.lines,
        words: st.live.committed.map(w => ({ text: w.text, start: sentences[s][0] + w.start }))
      }))
    };
  },

  // threads: ONNX Runtime's thread count for Whisper (the product gives it a quarter of the cores
  // in Chrome, 1 in Firefox); fixed by the first model this page loads
  async whisperLoad(key, threads = 1) {
    const started = performance.now();
    if (!transformers) {
      const ort = await import('../../lib/ort.bundle.min.mjs');
      globalThis[Symbol.for('onnxruntime')] = ort;
      transformers = await import('../../lib/transformers.min.js');
      transformers.env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('lib/');
      if (threads > 1) transformers.env.backends.onnx.wasm.numThreads = threads;
      transformers.env.allowRemoteModels = true;
      transformers.env.allowLocalModels = false;
    }
    pipelines[key] = await transformers.pipeline('automatic-speech-recognition', WHISPER[key].id, WHISPER[key].options);
    return { loadMs: performance.now() - started, threads: transformers.env.backends.onnx.wasm.numThreads };
  },

  // Each [start, end] sentence (seconds) of the clip, one call each: milliseconds and text
  async whisper(key, base64, segments, language) {
    const audio = decodePcm(base64);
    const out = [];
    for (const [start, end] of segments) {
      const piece = audio.subarray(Math.round(start * SAMPLE_RATE), Math.round(end * SAMPLE_RATE));
      const started = performance.now();
      const result = await pipelines[key](piece, { language, task: 'transcribe', max_new_tokens: 128 });
      out.push({ ms: performance.now() - started, text: (result && result.text || '').trim() });
    }
    return out;
  }
};

window.benchReady = true;
