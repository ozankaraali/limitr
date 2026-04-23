// Limitr Transcriber — Moonshine-based automatic speech recognition
// Uses @huggingface/transformers (ONNX Runtime Web + Moonshine) for real-time captions
//
// Architecture:
//   - Loaded as an ES module in the offscreen document
//   - Captures audio via AudioWorkletNode (transcriber-capture-processor)
//   - Worklet double-buffers and resamples to 16kHz, posts 2s PCM chunks
//   - Main thread runs Moonshine inference, latest-wins (no audio dropped)
//   - Sends transcription results via chrome.runtime.sendMessage
//
// Moonshine Tiny (27M params) is 5-15x faster than Whisper Tiny (39M) because
// its compute scales with actual audio length (no 30s padding like Whisper).

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

const MODEL_ID = 'onnx-community/moonshine-base-ONNX';
const SAMPLE_RATE = 16000;
const CHUNK_DURATION_S = 2;

let transcriber = null;
let isLoading = false;
let transformersModulePromise = null;
let pipeline = null;
let env = null;
let RawAudio = null;

// Per-tab transcription state
const tabTranscriptionState = new Map();

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
  if (pipeline && env && RawAudio) return;

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
      RawAudio = transformers.RawAudio;
    })();
  }

  await transformersModulePromise;
}

function getOrCreateState(tabId) {
  let state = tabTranscriptionState.get(tabId);
  if (!state) {
    state = {
      captureNode: null,
      transcribing: false,
      enabled: true,
      pendingAudio: null
    };
    tabTranscriptionState.set(tabId, state);
  }
  return state;
}

// ── Pipeline Management ──────────────────────────────────────────

async function ensurePipeline(tabId) {
  if (transcriber) return transcriber;
  if (isLoading) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (transcriber) { clearInterval(check); resolve(transcriber); }
        if (!isLoading) { clearInterval(check); reject(new Error('Pipeline load failed')); }
      }, 200);
    });
  }

  isLoading = true;
  console.log('[Limitr Transcriber] Loading Moonshine pipeline...');

  try {
    await ensureTransformersModule();

    // Configure ONNX Runtime to use local WASM files
    const libUrl = getExtensionURL('lib/');
    env.backends.onnx.wasm.wasmPaths = libUrl;

    // Allow remote models from HuggingFace Hub (for downloading model weights)
    env.allowRemoteModels = true;
    env.allowLocalModels = false;

    broadcastStatus(tabId, 'loading', 'Downloading Moonshine model...');

    transcriber = await pipeline(
      'automatic-speech-recognition',
      MODEL_ID,
      {
        dtype: 'q8',
        device: 'auto'
      }
    );

    console.log('[Limitr Transcriber] Moonshine pipeline ready');
    broadcastStatus(tabId, 'ready', 'Transcriber ready');
    return transcriber;
  } catch (error) {
    console.error('[Limitr Transcriber] Failed to load pipeline:', error);
    broadcastStatus(tabId, 'error', `Load failed: ${error.message}`);
    throw error;
  } finally {
    isLoading = false;
  }
}

// ── Audio Capture (AudioWorkletNode) ─────────────────────────────

async function startCapture(tabId, audioContext, sourceNode) {
  if (tabTranscriptionState.has(tabId)) {
    console.log('[Limitr Transcriber] Already capturing tab', tabId);
    return;
  }

  // Register the worklet module once per AudioContext
  if (!registeredContexts.has(audioContext)) {
    const workletUrl = getExtensionURL('lib/transcriber-capture-worklet.js');
    await audioContext.audioWorklet.addModule(workletUrl);
    registeredContexts.add(audioContext);
    console.log('[Limitr Transcriber] Capture worklet registered');
  }

  const captureNode = new AudioWorkletNode(audioContext, 'transcriber-capture-processor');

  const state = getOrCreateState(tabId);
  state.captureNode = captureNode;
  state.enabled = true;
  state.pendingAudio = null;

  // Handle audio chunks posted by the worklet.
  // Latest-wins: always save the newest chunk. If we're not busy, process
  // immediately. If we are, it'll be picked up when inference finishes.
  captureNode.port.onmessage = (event) => {
    if (event.data.type === 'audio-chunk' && state.enabled) {
      state.pendingAudio = event.data.audio;
      if (!state.transcribing) {
        processNextChunk(tabId, state);
      }
    }
  };

  // Connect in parallel — worklet has no outputs so no silent gain needed
  sourceNode.connect(captureNode);

  console.log('[Limitr Transcriber] Capture started for tab', tabId,
    `(${audioContext.sampleRate}Hz -> 16kHz, ${CHUNK_DURATION_S}s chunks)`);
}

function stopCapture(tabId) {
  const state = tabTranscriptionState.get(tabId);
  if (!state) return;

  state.enabled = false;
  state.pendingAudio = null;
  if (state.captureNode) {
    state.captureNode.port.postMessage({ type: 'enable', enabled: false });
    try { state.captureNode.disconnect(); } catch (e) {}
  }
  tabTranscriptionState.delete(tabId);

  console.log('[Limitr Transcriber] Capture stopped for tab', tabId);
}

// ── Transcription ────────────────────────────────────────────────

async function processNextChunk(tabId, state) {
  if (state.transcribing || !state.enabled || !state.pendingAudio) return;

  // Grab the latest chunk and clear the pending slot
  const audioData = state.pendingAudio;
  state.pendingAudio = null;
  state.transcribing = true;

  try {
    const asr = await ensurePipeline();

    if (audioData.length < SAMPLE_RATE) {
      return;
    }

    // Firefox content-script sandboxes put transcriber.js and transformers.js
    // in different realms, so a Float32Array we hand the pipeline fails its
    // `instanceof` check inside transformers.js. Route through a Blob URL —
    // transformers.js's `read_audio()` fetches and decodes it via AudioContext,
    // producing a Float32Array in its own realm. Overhead is ~10ms/chunk and
    // this path works identically in Chrome, so one code path serves both.
    const rawAudio = new RawAudio(audioData, SAMPLE_RATE);
    const audioUrl = URL.createObjectURL(rawAudio.toBlob());
    let result;
    try {
      result = await asr(audioUrl);
    } finally {
      URL.revokeObjectURL(audioUrl);
    }

    if (result && result.text && result.text.trim()) {
      console.log('[Limitr Transcriber]', result.text.trim());
      broadcastTranscription(tabId, {
        text: result.text.trim(),
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('[Limitr Transcriber] Transcription error:', error);
  } finally {
    state.transcribing = false;
    // If a new chunk arrived while we were busy, process it now
    if (state.pendingAudio && state.enabled) {
      processNextChunk(tabId, state);
    }
  }
}

// ── Messaging ────────────────────────────────────────────────────

function broadcastTranscription(tabId, result) {
  sendExtensionMessage({
    action: 'transcription-result',
    tabId,
    result
  });
}

function broadcastStatus(tabId, status, message) {
  const payload = {
    action: 'transcription-status',
    status,
    message
  };

  if (tabId !== undefined) {
    payload.tabId = tabId;
  }

  sendExtensionMessage(payload);
}

// ── Public API (exposed on window for offscreen.js) ──────────────

window.LimitrTranscriber = {
  async start(tabId, audioContext, sourceNode) {
    broadcastStatus(tabId, 'loading', 'Loading Moonshine model...');
    await ensurePipeline(tabId);
    await startCapture(tabId, audioContext, sourceNode);
    broadcastStatus(tabId, 'active', 'Transcribing');
  },

  async startExternal(tabId) {
    broadcastStatus(tabId, 'loading', 'Loading Moonshine model...');
    await ensurePipeline(tabId);
    const state = getOrCreateState(tabId);
    state.enabled = true;
    state.pendingAudio = null;
    broadcastStatus(tabId, 'active', 'Transcribing');
  },

  pushAudio(tabId, audio) {
    const state = tabTranscriptionState.get(tabId);
    if (!state || !state.enabled) return;

    state.pendingAudio = audio;
    if (!state.transcribing) {
      processNextChunk(tabId, state);
    }
  },

  stop(tabId) {
    stopCapture(tabId);
    broadcastStatus(tabId, 'stopped', 'Stopped');
  },

  isActive(tabId) {
    return tabTranscriptionState.has(tabId);
  },

  isReady() {
    return !!transcriber;
  },

  isModelLoading() {
    return isLoading;
  },

  async preload() {
    await ensurePipeline();
  }
};

console.log('[Limitr Transcriber] Module loaded');
