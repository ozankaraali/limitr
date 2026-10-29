// Turkish speech recognition for live captions from a whole-utterance model: ufak AI's
// ufakzeka-kulak (Apache-2.0, trained on openly licensed Turkish speech; a 31.5M FastConformer
// TDT, 43 MB in int8) run by sherpa-onnx's offline WebAssembly build (lib/sherpa-offline/), in a
// worker of its own, on one thread. It isn't a streaming model, but it decodes several seconds of
// speech in a few hundredths of the time, so the captions pipeline sends it the sentence being
// spoken again every half second, as it does for Moonshine, and the finished one at its pause.
//
// In:  { type: 'load' }
//      { type: 'decode', id, samples: Float32Array }   16 kHz, one utterance
// Out: { type: 'progress', loaded, total }            model download, in bytes
//      { type: 'ready', downloadMs, initMs }
//      { type: 'text', id, text, tokens, timestamps, durations, ys_log_probs, decodeMs }   each
//                                                     token's start and length in seconds, and
//                                                     its log-probability
//      { type: 'error', id, message }

const MODEL_URL = 'https://huggingface.co/ufakai/ufakzeka-kulak/resolve/main/sherpa-onnx-tdt/';
const MODEL_FILES = [
  ['encoder.int8.onnx', 37776818],
  ['decoder.int8.onnx', 3955864],
  ['joiner.int8.onnx', 1247562],
  ['tokens.txt', 10138]
];
const MODEL_CACHE = 'limitr-ufakzeka-kulak';
const SAMPLE_RATE = 16000;
// The shipped sherpa-onnx files expect the audio 8 times louder (the model card's "input gain")
const INPUT_GAIN = 8;

self.Module = {
  locateFile: (path, dir) => `${dir || ''}sherpa-offline/${path}`,
  print: () => {},
  printErr: text => console.warn('[sherpa-onnx]', text)
};
const runtimeReady = new Promise(resolve => { self.Module.onRuntimeInitialized = resolve; });
importScripts('sherpa-offline/sherpa-onnx-wasm-main-vad-asr.js', 'sherpa-offline/sherpa-onnx-asr.js');

let recognizer = null;
let loading = null;

// A model file from the Cache API, or downloaded once into it
async function modelFile(name, onBytes) {
  const url = MODEL_URL + name;
  const cache = await caches.open(MODEL_CACHE);
  let response = await cache.match(url);
  if (!response) {
    response = await fetch(url);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    await cache.put(url, response.clone());
  }
  const data = new Uint8Array(await response.arrayBuffer());
  onBytes(data.length);
  return data;
}

async function load() {
  const started = performance.now();
  const total = MODEL_FILES.reduce((sum, [, size]) => sum + size, 0);
  let loaded = 0;
  const files = await Promise.all(MODEL_FILES.map(([name]) => modelFile(name, bytes => {
    loaded += bytes;
    postMessage({ type: 'progress', loaded, total });
  }).then(data => [name, data])));
  const downloadMs = performance.now() - started;
  await runtimeReady;
  const initStarted = performance.now();
  for (const [name, data] of files) self.Module.FS_createDataFile('/', name, data, true, true, true);
  recognizer = new OfflineRecognizer({
    featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
    modelConfig: {
      transducer: { encoder: './encoder.int8.onnx', decoder: './decoder.int8.onnx', joiner: './joiner.int8.onnx' },
      modelType: 'nemo_transducer',
      tokens: './tokens.txt',
      numThreads: 1,
      provider: 'cpu',
      debug: 0
    },
    decodingMethod: 'greedy_search'
  }, self.Module);
  postMessage({ type: 'ready', downloadMs, initMs: performance.now() - initStarted });
}

function decode(samples) {
  const louder = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) louder[i] = samples[i] * INPUT_GAIN;
  const stream = recognizer.createStream();
  try {
    stream.acceptWaveform(SAMPLE_RATE, louder);
    recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    return {
      text: (result.text || '').trim(), tokens: result.tokens || [], timestamps: result.timestamps || [],
      durations: result.durations || [], ys_log_probs: result.ys_log_probs || []
    };
  } finally {
    stream.free();
  }
}

onmessage = async event => {
  const msg = event.data || {};
  try {
    if (msg.type === 'load') {
      loading = loading || load();
      await loading;
    } else if (msg.type === 'decode') {
      await loading;
      const started = performance.now();
      postMessage({ type: 'text', id: msg.id, ...decode(msg.samples), decodeMs: performance.now() - started });
    }
  } catch (e) {
    postMessage({ type: 'error', id: msg.id, message: e && e.message ? e.message : String(e) });
  }
};
