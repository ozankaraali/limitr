// Limitr Transcriber — Whisper-based automatic speech recognition
// Uses @huggingface/transformers (ONNX Runtime Web + Whisper) for real-time captions
//
// Architecture:
//   - Loaded as an ES module in the offscreen document
//   - Captures audio via ScriptProcessorNode from the source stream
//   - Buffers PCM samples, resamples to 16kHz
//   - Runs Whisper inference every CHUNK_DURATION_S seconds
//   - Sends transcription results via chrome.runtime.sendMessage

import { pipeline, env } from './transformers.min.js';

const MODEL_ID = 'Xenova/whisper-tiny.en';
const WHISPER_SAMPLE_RATE = 16000;
const CHUNK_DURATION_S = 5; // seconds of audio per transcription chunk
const BUFFER_SIZE = 4096;   // ScriptProcessorNode buffer size

let transcriber = null;
let isLoading = false;

// Per-tab transcription state
const tabTranscriptionState = new Map();

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
  console.log('[Limitr Transcriber] Loading Whisper pipeline...');

  try {
    // Configure ONNX Runtime to use local WASM files
    const libUrl = chrome.runtime.getURL('lib/');
    env.backends.onnx.wasm.wasmPaths = libUrl;
    // Allow remote models from HuggingFace Hub (for downloading Whisper weights)
    env.allowRemoteModels = true;
    env.allowLocalModels = false;

    broadcastStatus('loading', 'Downloading Whisper model...');

    transcriber = await pipeline(
      'automatic-speech-recognition',
      MODEL_ID,
      {
        dtype: 'q8',
        device: 'wasm'
      }
    );

    console.log('[Limitr Transcriber] Whisper pipeline ready');
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

// ── Audio Capture ────────────────────────────────────────────────

function startCapture(tabId, audioContext, sourceNode) {
  if (tabTranscriptionState.has(tabId)) {
    console.log('[Limitr Transcriber] Already capturing tab', tabId);
    return;
  }

  const captureNode = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
  const sourceSampleRate = audioContext.sampleRate;
  const samplesPerChunk = WHISPER_SAMPLE_RATE * CHUNK_DURATION_S;

  const state = {
    captureNode,
    audioBuffer: new Float32Array(samplesPerChunk),
    writeOffset: 0,
    sourceSampleRate,
    transcribing: false,
    enabled: true,
    silentGain: null
  };

  captureNode.onaudioprocess = (event) => {
    if (!state.enabled || state.transcribing) return;

    const inputData = event.inputBuffer.getChannelData(0);

    // Resample from source rate to 16kHz using linear interpolation
    const ratio = WHISPER_SAMPLE_RATE / sourceSampleRate;
    const resampledLength = Math.floor(inputData.length * ratio);

    for (let i = 0; i < resampledLength; i++) {
      if (state.writeOffset >= samplesPerChunk) {
        // Buffer full — trigger transcription
        runTranscription(tabId, state);
        return;
      }
      const srcIndex = i / ratio;
      const srcIdxFloor = Math.floor(srcIndex);
      const srcIdxCeil = Math.min(srcIdxFloor + 1, inputData.length - 1);
      const frac = srcIndex - srcIdxFloor;
      state.audioBuffer[state.writeOffset++] =
        inputData[srcIdxFloor] * (1 - frac) + inputData[srcIdxCeil] * frac;
    }
  };

  // Connect capture node in parallel (doesn't affect audio output)
  // ScriptProcessorNode requires connection to destination to fire events
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  sourceNode.connect(captureNode);
  captureNode.connect(silentGain);
  silentGain.connect(audioContext.destination);
  state.silentGain = silentGain;

  tabTranscriptionState.set(tabId, state);
  console.log('[Limitr Transcriber] Capture started for tab', tabId,
    `(${sourceSampleRate}Hz -> 16kHz, ${CHUNK_DURATION_S}s chunks)`);
}

function stopCapture(tabId) {
  const state = tabTranscriptionState.get(tabId);
  if (!state) return;

  state.enabled = false;
  try { state.captureNode.disconnect(); } catch (e) {}
  try { state.silentGain.disconnect(); } catch (e) {}
  tabTranscriptionState.delete(tabId);

  console.log('[Limitr Transcriber] Capture stopped for tab', tabId);
}

// ── Transcription ────────────────────────────────────────────────

async function runTranscription(tabId, state) {
  if (state.transcribing || !state.enabled) return;
  state.transcribing = true;

  try {
    const whisper = await ensurePipeline();

    // Copy the buffer (capture continues during inference)
    const audioData = state.audioBuffer.slice(0, state.writeOffset);
    state.writeOffset = 0;

    if (audioData.length < WHISPER_SAMPLE_RATE) {
      // Less than 1 second of audio — skip
      return;
    }

    const result = await whisper(audioData, {
      return_timestamps: true,
      chunk_length_s: CHUNK_DURATION_S,
      stride_length_s: 1
    });

    if (result && result.text && result.text.trim()) {
      console.log('[Limitr Transcriber]', result.text.trim());
      broadcastTranscription(tabId, {
        text: result.text.trim(),
        chunks: result.chunks || [],
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('[Limitr Transcriber] Transcription error:', error);
  } finally {
    state.transcribing = false;
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
    broadcastStatus('loading', 'Loading Whisper model...');
    await ensurePipeline();
    startCapture(tabId, audioContext, sourceNode);
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
