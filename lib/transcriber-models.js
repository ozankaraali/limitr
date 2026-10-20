// Limitr speech models (transformers.js + ONNX Runtime), loaded by lib/transcriber-worker.js.
// They run in a dedicated worker: a Whisper call takes seconds, and the offscreen document (or
// Firefox's background page) that hosts captions shares its main thread with the popup.
//
// Engines:
//   - English: Moonshine base.
//   - Everything else: Whisper base on the CPU by default; Whisper tiny when the user picks the
//     faster model (about twice as fast, less accurate); Whisper small on the GPU when they pick
//     the larger model and the GPU can run it.

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

export const MODELS = {
  moonshine: {
    id: 'onnx-community/moonshine-base-ONNX',
    options: { dtype: 'q8', device: 'wasm' },
    loading: 'Downloading the English speech model (first time only)…'
  },
  whisperTiny: {
    id: 'onnx-community/whisper-tiny',
    options: { dtype: 'q8', device: 'wasm' },
    loading: 'Downloading the faster speech model for other languages (first time only)…'
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

let transformersModulePromise = null;
let pipeline = null;
let env = null;
let Tensor = null;
const pipelines = new Map();     // model key -> Promise<pipeline>

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
          // Defensive: if realms ever split, fall back to a Blob URL string, which ORT checks
          // with typeof rather than instanceof.
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

// ONNX Runtime only uses threads by itself in cross-origin isolated pages. Chrome's extension
// pages can share memory without that, and threads make Whisper much faster per sentence. Only a
// quarter of the cores, though (2 on an 8-thread laptop): with more, video decoding and the rest
// of the browser start to starve. Where memory can't be shared it stays single-threaded.
// (COOP/COEP headers would isolate the pages too, but measured slower and add side effects.)
function wasmThreads() {
  try {
    new MessageChannel().port1.postMessage(new SharedArrayBuffer(1));
  } catch (e) {
    return 1;
  }
  return Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 1) / 4)));
}

export async function loadModel(key) {
  if (!pipelines.has(key)) {
    const model = MODELS[key];
    const promise = (async () => {
      await ensureTransformersModule();
      env.backends.onnx.wasm.wasmPaths = new URL('./', import.meta.url).href;
      const threads = wasmThreads();
      if (threads > 1) env.backends.onnx.wasm.numThreads = threads;
      env.allowRemoteModels = true;
      env.allowLocalModels = false;
      return pipeline('automatic-speech-recognition', model.id, model.options);
    })();
    pipelines.set(key, promise);
    promise.catch(() => pipelines.delete(key));
  }
  return pipelines.get(key);
}

// The last language-ID pass, so transcribing the same audio skips a second encoder pass (the
// encoder is most of Whisper's cost on a short sentence)
let lastEncoding = null;

// Whisper language ID: one decoder step after <|startoftranscript|>, argmax over the
// language tokens. transformers.js 3.x defaults to English instead of detecting.
export async function detectLanguage(key, audio) {
  const asr = await loadModel(key);
  const config = asr.model.generation_config;
  const { input_features } = await asr.processor(audio);
  const { encoder_outputs } = await asr.model._prepare_encoder_decoder_kwargs_for_generation({
    inputs_tensor: input_features,
    model_inputs: { input_features },
    model_input_name: 'input_features',
    generation_config: {}
  });
  const decoderInputIds = new Tensor('int64', BigInt64Array.from([BigInt(config.decoder_start_token_id)]), [1, 1]);
  const { logits } = await asr.model({ encoder_outputs, decoder_input_ids: decoderInputIds });
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
  lastEncoding = { key, encoderOutputs: encoder_outputs };
  return { language: best.replace(/[<|>]/g, ''), probability: 1 / total };
}

// Text for one piece of audio. options (Whisper only): language, task, max_new_tokens.
// reuseEncoding: this is the audio the last detectLanguage() call encoded.
export async function transcribe(key, audio, options, reuseEncoding) {
  const asr = await loadModel(key);
  const encoding = reuseEncoding && lastEncoding && lastEncoding.key === key ? lastEncoding.encoderOutputs : null;
  lastEncoding = null;
  if (!options) return (await asr(audio)).text;
  if (encoding) {
    // generate() only takes inputs named in forward_params, which for Whisper leaves out
    // encoder_outputs; without this the precomputed encoder output is silently ignored
    const params = asr.model.forward_params;
    if (Array.isArray(params) && !params.includes('encoder_outputs')) params.push('encoder_outputs');
  }
  const output = await asr(audio, { ...options, ...(encoding && { encoder_outputs: encoding }) });
  return output && output.text;
}
