// Turkish caption engines side by side inside an extension page, on the CPU only (WebGPU is hidden
// from this page before ONNX Runtime loads, as in asr-bench.js): Whisper through transformers.js on
// the finished sentences the captions segmenter would send it, and the Turkish Moonshine
// (lib/turkish-moonshine.js) in the captions' own model worker (lib/transcriber-worker.js, on the
// product's threads) on the pieces it would get, read as lib/transcriber.js reads them
// (lib/turkish-reading.js). Driven by tests/bench/turkish-captions-bench.js.

import { readingFor, afterReading, interimWait, keptText } from '../../lib/turkish-reading.js';

Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });

const WHISPER = {
  tiny: { id: 'onnx-community/whisper-tiny', options: { dtype: 'q8', device: 'wasm' } },
  base: { id: 'onnx-community/whisper-base', options: { dtype: 'q8', device: 'wasm' } },
  small: { id: 'onnx-community/whisper-small', options: { dtype: 'q8', device: 'wasm' } }
};
const SAMPLE_RATE = 16000;

let transformers = null;
const pipelines = {};
let models = null;           // lib/transcriber-worker.js, as the captions page runs it
let nextCall = 1;
const calls = new Map();     // id -> { resolve, reject }

function decodePcm(base64) {
  const binary = atob(base64);
  const audio = new Float32Array(binary.length >> 1);
  for (let i = 0; i < audio.length; i++) {
    audio[i] = ((binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8)) << 16 >> 16) / 0x8000;
  }
  return audio;
}

function askModels(type, args) {
  const id = nextCall++;
  return new Promise((resolve, reject) => {
    calls.set(id, { resolve, reject });
    models.postMessage({ id, type, ...args });
  });
}

window.bench = {
  // The Turkish model, loaded in the model worker; base: where its files are (else the Hub);
  // stitch: its encoder stitching's lengths, or false (else the product's); threads: ONNX Runtime's
  // (else the product's)
  async turkishLoad(base, stitch, threads) {
    const started = performance.now();
    models = new Worker(chrome.runtime.getURL('lib/transcriber-worker.js'), { type: 'module' });
    models.onmessage = ({ data }) => {
      const call = calls.get(data.id);
      if (!call) return;
      calls.delete(data.id);
      if (data.error) call.reject(new Error(data.error));
      else call.resolve(data.result);
    };
    models.onerror = event => {
      for (const call of calls.values()) call.reject(new Error(event.message || 'worker error'));
      calls.clear();
    };
    await askModels('load', { key: 'moonshineTr', base, ...(stitch !== undefined && stitch !== null && { stitch }), ...(threads && { threads }) });
    return { loadMs: performance.now() - started };
  },

  // The clip read as the captions read it, on a clock of its own that runs at the speed of the
  // readings: units are what the segmenter sends ({ sentence, final, time, piece: [start, end] },
  // seconds); as lib/transcriber.js serves them, one reading at a time, finished sentences first,
  // and of the open sentence only its latest version waits, read once the budget allows. Each
  // reading: { sentence, final, done (s), ms, text, kept (the words the next goes on from) }
  async turkishLive(base64, units, policy) {
    const audio = decodePcm(base64);
    const events = units.slice().sort((a, b) => a.time - b.time || (a.final ? 1 : -1));
    const shown = [];
    const queue = [];
    let interim = null;
    let clock = 0;
    let nextInterimAt = 0;
    let line = null;
    let i = 0;
    const admit = e => {
      if (e.final) {
        queue.push(e);
        if (interim && interim.sentence === e.sentence) interim = null;
      } else {
        interim = e;
      }
    };
    while (i < events.length || queue.length || interim) {
      while (i < events.length && events[i].time <= clock) admit(events[i++]);
      let job = null;
      if (queue.length) job = queue.shift();
      else if (interim && clock >= nextInterimAt) {
        job = interim;
        interim = null;
      }
      if (!job) {
        const next = Math.min(i < events.length ? events[i].time : Infinity, interim ? nextInterimAt : Infinity);
        clock = Math.max(clock, next);
        continue;
      }
      const piece = { piece: `bench:${job.sentence}`, final: job.final, cut: Boolean(job.cut) };
      const [start, end] = job.piece;
      const samples = audio.slice(Math.round(start * SAMPLE_RATE), Math.round(end * SAMPLE_RATE));
      const started = performance.now();
      const said = await askModels('transcribe', { key: 'moonshineTr', audio: samples, options: readingFor(line, piece, policy) });
      const ms = performance.now() - started;
      clock += ms / 1000;
      nextInterimAt = clock + interimWait(ms, policy) / 1000;
      line = afterReading(line, piece, said, policy);
      // kept: the words of this reading the next goes on from (the line, shown without the others)
      shown.push({ sentence: job.sentence, final: job.final, done: clock, ms, text: said.text, kept: keptText(line) });
    }
    return shown;
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
