// Limitr Transcriber — Qwen3-ASR-0.6B WASM-based automatic speech recognition
// Uses qwen3-asr.cpp compiled to WebAssembly via Emscripten + GGML
//
// Architecture:
//   - Loaded as an ES module in the offscreen document
//   - Captures audio via AudioWorkletNode (transcriber-capture-processor)
//   - Worklet double-buffers and resamples to 16kHz, posts 2s PCM chunks
//   - Main thread runs Qwen3-ASR WASM inference, latest-wins
//   - Sends transcription results via chrome.runtime.sendMessage
//
// Model (GGUF Q8_0) is downloaded on first use and cached in IndexedDB.

const SAMPLE_RATE = 16000;
const CHUNK_DURATION_S = 2;

// Model configuration — adjust URL to point to your hosted GGUF file.
// To generate the GGUF model:
//   1. git clone --recursive https://github.com/predict-woo/qwen3-asr.cpp
//   2. pip install torch transformers safetensors
//   3. huggingface-cli download Qwen/Qwen3-ASR-0.6B --local-dir ./Qwen3-ASR-0.6B
//   4. python qwen3-asr.cpp/scripts/convert_hf_to_gguf.py \
//        --input ./Qwen3-ASR-0.6B --output qwen3-asr-0.6b-q8_0.gguf --type q8_0
//   5. Host the resulting .gguf file and set MODEL_URL below.
const MODEL_URL = 'https://huggingface.co/TODO-UPLOAD-GGUF/resolve/main/qwen3-asr-0.6b-q8_0.gguf';
const MODEL_FILENAME = 'qwen3-asr-0.6b-q8_0.gguf';
const IDB_NAME = 'limitr-qwen3-asr';
const IDB_STORE = 'models';
const IDB_KEY = 'qwen3-asr-0.6b-q8_0';

let wasmModule = null;
let modelLoaded = false;
let isLoading = false;

// Per-tab transcription state
const tabTranscriptionState = new Map();

// Track whether the worklet module has been registered
const registeredContexts = new WeakSet();

// ── IndexedDB Model Cache ───────────────────────────────────────────

function openModelDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedModel() {
  try {
    const db = await openModelDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[Qwen3-ASR] IndexedDB cache read failed:', e);
    return null;
  }
}

async function cacheModel(data) {
  try {
    const db = await openModelDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(data, IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[Qwen3-ASR] IndexedDB cache write failed:', e);
  }
}

// ── WASM Module Loading ─────────────────────────────────────────────

async function loadWasmModule() {
  if (wasmModule) return wasmModule;

  const wasmUrl = chrome.runtime.getURL('lib/qwen3-asr-wasm.wasm');

  // createQwen3ASR is loaded as a global from qwen3-asr-wasm.js (non-module script)
  if (typeof createQwen3ASR === 'undefined') {
    throw new Error('createQwen3ASR not found — qwen3-asr-wasm.js must be loaded first');
  }

  // Initialize the WASM module
  wasmModule = await createQwen3ASR({
    locateFile: (path) => {
      if (path.endsWith('.wasm')) return wasmUrl;
      return path;
    },
    print: (text) => console.log('[Qwen3-ASR]', text),
    printErr: (text) => console.warn('[Qwen3-ASR]', text),
  });

  // Initialize the ASR engine
  const initOk = wasmModule._qwen3_asr_init();
  if (!initOk) {
    const err = wasmModule.UTF8ToString(wasmModule._qwen3_asr_get_error());
    throw new Error('Failed to init ASR engine: ' + err);
  }

  console.log('[Qwen3-ASR] WASM module initialized');
  return wasmModule;
}

// ── Model Download & Load ───────────────────────────────────────────

async function ensureModelLoaded() {
  if (modelLoaded) return;
  if (isLoading) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (modelLoaded) { clearInterval(check); resolve(); }
        if (!isLoading) { clearInterval(check); reject(new Error('Model load failed')); }
      }, 200);
    });
  }

  isLoading = true;
  console.log('[Qwen3-ASR] Loading Qwen3-ASR pipeline...');

  try {
    broadcastStatus('loading', 'Initializing Qwen3-ASR WASM...');
    const mod = await loadWasmModule();

    // Check IndexedDB cache first
    broadcastStatus('loading', 'Checking model cache...');
    let modelData = await getCachedModel();

    if (!modelData) {
      broadcastStatus('loading', 'Downloading Qwen3-ASR model (~1.3GB)...');
      console.log('[Qwen3-ASR] Downloading model from', MODEL_URL);

      const response = await fetch(MODEL_URL);
      if (!response.ok) {
        throw new Error(`Model download failed: ${response.status} ${response.statusText}`);
      }

      modelData = await response.arrayBuffer();
      console.log('[Qwen3-ASR] Model downloaded:', (modelData.byteLength / 1e6).toFixed(1), 'MB');

      // Cache for next time
      broadcastStatus('loading', 'Caching model...');
      await cacheModel(modelData);
    } else {
      console.log('[Qwen3-ASR] Model loaded from cache:', (modelData.byteLength / 1e6).toFixed(1), 'MB');
    }

    // Write model to Emscripten virtual filesystem
    broadcastStatus('loading', 'Loading model into WASM...');
    const uint8 = new Uint8Array(modelData);
    mod.FS.writeFile('/' + MODEL_FILENAME, uint8);

    // Free the JS-side copy
    modelData = null;

    // Load model in the C engine (use ccall for automatic string marshalling)
    const loadOk = mod.ccall(
      'qwen3_asr_load_model', 'number', ['string'], ['/' + MODEL_FILENAME]
    );

    if (!loadOk) {
      const err = mod.UTF8ToString(mod._qwen3_asr_get_error());
      throw new Error('Failed to load model: ' + err);
    }

    modelLoaded = true;
    console.log('[Qwen3-ASR] Model loaded successfully');
    broadcastStatus('ready', 'Qwen3-ASR ready');
  } catch (error) {
    console.error('[Qwen3-ASR] Failed to load:', error);
    broadcastStatus('error', `Load failed: ${error.message}`);
    throw error;
  } finally {
    isLoading = false;
  }
}

// ── Audio Capture (AudioWorkletNode) ─────────────────────────────────

async function startCapture(tabId, audioContext, sourceNode) {
  if (tabTranscriptionState.has(tabId)) {
    console.log('[Qwen3-ASR] Already capturing tab', tabId);
    return;
  }

  // Register the worklet module once per AudioContext
  if (!registeredContexts.has(audioContext)) {
    const workletUrl = chrome.runtime.getURL('lib/transcriber-capture-worklet.js');
    await audioContext.audioWorklet.addModule(workletUrl);
    registeredContexts.add(audioContext);
    console.log('[Qwen3-ASR] Capture worklet registered');
  }

  const captureNode = new AudioWorkletNode(audioContext, 'transcriber-capture-processor');

  const state = {
    captureNode,
    transcribing: false,
    enabled: true,
    pendingAudio: null
  };

  // Handle audio chunks — latest-wins strategy
  captureNode.port.onmessage = (event) => {
    if (event.data.type === 'audio-chunk' && state.enabled) {
      state.pendingAudio = event.data.audio;
      if (!state.transcribing) {
        processNextChunk(tabId, state);
      }
    }
  };

  sourceNode.connect(captureNode);

  tabTranscriptionState.set(tabId, state);
  console.log('[Qwen3-ASR] Capture started for tab', tabId,
    `(${audioContext.sampleRate}Hz -> 16kHz, ${CHUNK_DURATION_S}s chunks)`);
}

function stopCapture(tabId) {
  const state = tabTranscriptionState.get(tabId);
  if (!state) return;

  state.enabled = false;
  state.pendingAudio = null;
  state.captureNode.port.postMessage({ type: 'enable', enabled: false });
  try { state.captureNode.disconnect(); } catch (e) {}
  tabTranscriptionState.delete(tabId);

  console.log('[Qwen3-ASR] Capture stopped for tab', tabId);
}

// ── Transcription ────────────────────────────────────────────────────

async function processNextChunk(tabId, state) {
  if (state.transcribing || !state.enabled || !state.pendingAudio) return;

  const audioData = state.pendingAudio;
  state.pendingAudio = null;
  state.transcribing = true;

  try {
    if (!wasmModule || !modelLoaded) return;

    if (audioData.length < SAMPLE_RATE) return;

    // Allocate WASM heap memory for audio samples
    const nSamples = audioData.length;
    const bytesNeeded = nSamples * 4; // float32 = 4 bytes
    const ptr = wasmModule._malloc(bytesNeeded);

    if (!ptr) {
      console.error('[Qwen3-ASR] Failed to allocate WASM memory for audio');
      return;
    }

    try {
      // Copy audio data to WASM heap
      wasmModule.HEAPF32.set(audioData, ptr / 4);

      // Run transcription
      const ok = wasmModule._qwen3_asr_transcribe(ptr, nSamples);

      if (ok) {
        const textPtr = wasmModule._qwen3_asr_get_text();
        const text = wasmModule.UTF8ToString(textPtr);

        if (text && text.trim()) {
          console.log('[Qwen3-ASR]', text.trim());
          broadcastTranscription(tabId, {
            text: text.trim(),
            timestamp: Date.now()
          });
        }
      } else {
        const errPtr = wasmModule._qwen3_asr_get_error();
        const err = wasmModule.UTF8ToString(errPtr);
        console.error('[Qwen3-ASR] Transcription error:', err);
      }
    } finally {
      wasmModule._free(ptr);
    }
  } catch (error) {
    console.error('[Qwen3-ASR] Transcription error:', error);
  } finally {
    state.transcribing = false;
    if (state.pendingAudio && state.enabled) {
      processNextChunk(tabId, state);
    }
  }
}

// ── Messaging ────────────────────────────────────────────────────────

function broadcastTranscription(tabId, result) {
  chrome.runtime.sendMessage({
    action: 'transcription-result',
    tabId,
    result
  }).catch(() => {});
}

function broadcastStatus(status, message) {
  chrome.runtime.sendMessage({
    action: 'transcription-status',
    status,
    message
  }).catch(() => {});
}

// ── Public API (exposed on window for offscreen.js) ──────────────────

window.LimitrTranscriber = {
  async start(tabId, audioContext, sourceNode) {
    broadcastStatus('loading', 'Loading Qwen3-ASR model...');
    await ensureModelLoaded();
    await startCapture(tabId, audioContext, sourceNode);
    broadcastStatus('active', 'Transcribing');
  },

  stop(tabId) {
    stopCapture(tabId);
    broadcastStatus('stopped', 'Stopped');
  },

  isActive(tabId) {
    return tabTranscriptionState.has(tabId);
  },

  isReady() {
    return modelLoaded;
  },

  isModelLoading() {
    return isLoading;
  },

  async preload() {
    await ensureModelLoaded();
  }
};

console.log('[Qwen3-ASR] Transcriber module loaded');
