// Speech-model timing inside an extension page (same origin, headers and model cache as the
// offscreen document). WASM only: WebGPU is hidden from this page before ONNX Runtime loads.
// Driven by tests/bench/captions-bench.js. URL options: ?threads=N (ORT thread count; default is
// ONNX Runtime's own choice) and ?proxy=1 (run ORT in its proxy worker).

Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });

const MODELS = {
  moonshine: { id: 'onnx-community/moonshine-base-ONNX', options: { dtype: 'q8', device: 'wasm' } },
  whisper: { id: 'onnx-community/whisper-base', options: { dtype: 'q8', device: 'wasm' } }
};
const params = new URLSearchParams(location.search);

let ort = null;
let transformers = null;

async function modules() {
  const started = performance.now();
  if (!transformers) {
    ort = await import('../../lib/ort.bundle.min.mjs');
    globalThis[Symbol.for('onnxruntime')] = ort;
    transformers = await import('../../lib/transformers.min.js');
    const { env } = transformers;
    env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('lib/');
    if (params.get('threads')) env.backends.onnx.wasm.numThreads = Number(params.get('threads'));
    if (params.get('proxy') === '1') env.backends.onnx.wasm.proxy = true;
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
  }
  return performance.now() - started;
}

// Longest gap between 10 ms timer ticks while `work` runs: how long this page's main thread
// (in the product: the offscreen document answering messages) was blocked
async function measureStall(work) {
  let last = performance.now();
  let worst = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    worst = Math.max(worst, now - last);
    last = now;
  }, 10);
  try {
    const result = await work();
    worst = Math.max(worst, performance.now() - last);
    return { result, stallMs: worst };
  } finally {
    clearInterval(timer);
  }
}

const pipelines = {};

window.bench = {
  info() {
    return {
      crossOriginIsolated: self.crossOriginIsolated,
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      hardwareConcurrency: navigator.hardwareConcurrency,
      numThreads: ort ? ort.env.wasm.numThreads : null,
      proxy: ort ? ort.env.wasm.proxy : null
    };
  },

  // Import time plus pipeline creation (model files come from the Cache API after the first run)
  async load(key) {
    const importMs = await modules();
    const started = performance.now();
    const { stallMs } = await measureStall(async () => {
      pipelines[key] = await transformers.pipeline('automatic-speech-recognition', MODELS[key].id, MODELS[key].options);
    });
    return { importMs, loadMs: performance.now() - started, stallMs, numThreads: ort.env.wasm.numThreads };
  },

  // Transcribes the first `seconds` of the 16 kHz clip, returns milliseconds and text
  async transcribe(key, pcmBase64, seconds, language) {
    const binary = atob(pcmBase64);
    const int16 = new Int16Array(binary.length >> 1);
    for (let i = 0; i < int16.length; i++) {
      int16[i] = (binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8)) << 16 >> 16;
    }
    const samples = Math.min(int16.length, Math.round(seconds * 16000));
    const audio = new Float32Array(samples);
    for (let i = 0; i < samples; i++) audio[i] = int16[i] / 0x8000;
    const started = performance.now();
    const { result: output, stallMs } = await measureStall(() => (key === 'moonshine'
      ? pipelines[key](audio)
      : pipelines[key](audio, { language, task: 'transcribe', max_new_tokens: 96 })));
    return { ms: performance.now() - started, stallMs, text: output && output.text };
  }
};

window.benchReady = true;
