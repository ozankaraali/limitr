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

import { pipeline, env } from './transformers.min.js';

const MODEL_ID = 'onnx-community/moonshine-base-ONNX';
const SAMPLE_RATE = 16000;
const CHUNK_DURATION_S = 2;

let transcriber = null;
let isLoading = false;

// Per-tab transcription state
const tabTranscriptionState = new Map();

// Track whether the worklet module has been registered (once per AudioContext)
const registeredContexts = new WeakSet();

// ── Pipeline Management ──────────────────────────────────────────

async function ensurePipeline() {
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
    // Configure ONNX Runtime to use local WASM files
    const libUrl = chrome.runtime.getURL('lib/');
    env.backends.onnx.wasm.wasmPaths = libUrl;

    // Allow remote models from HuggingFace Hub (for downloading model weights)
    env.allowRemoteModels = true;
    env.allowLocalModels = false;

    broadcastStatus('loading', 'Downloading Moonshine model...');

    transcriber = await pipeline(
      'automatic-speech-recognition',
      MODEL_ID,
      {
        dtype: 'q8',
        device: 'wasm'
      }
    );

    console.log('[Limitr Transcriber] Moonshine pipeline ready');
    broadcastStatus('ready', 'Transcriber ready');
    return transcriber;
  } catch (error) {
    console.error('[Limitr Transcriber] Failed to load pipeline:', error);
    broadcastStatus('error', `Load failed: ${error.message}`);
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
    const workletUrl = chrome.runtime.getURL('lib/transcriber-capture-worklet.js');
    await audioContext.audioWorklet.addModule(workletUrl);
    registeredContexts.add(audioContext);
    console.log('[Limitr Transcriber] Capture worklet registered');
  }

  const captureNode = new AudioWorkletNode(audioContext, 'transcriber-capture-processor');

  const state = {
    captureNode,
    transcribing: false,
    enabled: true,
    pendingAudio: null // latest chunk waiting to be processed
  };

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

  tabTranscriptionState.set(tabId, state);
  console.log('[Limitr Transcriber] Capture started for tab', tabId,
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

    const result = await asr(audioData);

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

// ── Public API (exposed on window for offscreen.js) ──────────────

window.LimitrTranscriber = {
  async start(tabId, audioContext, sourceNode) {
    broadcastStatus('loading', 'Loading Moonshine model...');
    await ensurePipeline();
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
