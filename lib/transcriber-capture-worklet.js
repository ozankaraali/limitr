// Limitr Transcriber Audio Capture Worklet
// Captures PCM audio, resamples to 16kHz, and posts buffers to the main thread
//
// Uses double-buffering so audio is NEVER dropped during inference.
// Follows the same AudioWorkletProcessor pattern as noise-suppressor-worklet.js

const WHISPER_SAMPLE_RATE = 16000;
const CHUNK_DURATION_S = 2;
const SAMPLES_PER_CHUNK = WHISPER_SAMPLE_RATE * CHUNK_DURATION_S; // 32000

class TranscriberCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Double buffer — one fills while the other is being processed
    this._buffers = [
      new Float32Array(SAMPLES_PER_CHUNK),
      new Float32Array(SAMPLES_PER_CHUNK)
    ];
    this._active = 0; // index of the buffer currently being filled
    this._writeOffset = 0;
    this._enabled = true;

    this.port.onmessage = (event) => {
      if (event.data.type === 'enable') {
        this._enabled = event.data.enabled;
        if (!event.data.enabled) {
          this._writeOffset = 0;
        }
      }
    };
  }

  process(inputs) {
    if (!this._enabled) return true;

    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const channelData = input[0];

    // Resample from sampleRate to 16kHz using linear interpolation
    const ratio = WHISPER_SAMPLE_RATE / sampleRate;
    const resampledLength = Math.floor(channelData.length * ratio);
    const buf = this._buffers[this._active];

    for (let i = 0; i < resampledLength; i++) {
      if (this._writeOffset >= SAMPLES_PER_CHUNK) {
        // Buffer full — post it and swap to the other buffer immediately
        this.port.postMessage({ type: 'audio-chunk', audio: buf.slice(0) });
        this._active = 1 - this._active;
        this._writeOffset = 0;
        // Continue filling the new buffer with remaining samples
        const newBuf = this._buffers[this._active];
        for (let j = i; j < resampledLength; j++) {
          const srcIndex = j / ratio;
          const lo = Math.floor(srcIndex);
          const hi = Math.min(lo + 1, channelData.length - 1);
          const frac = srcIndex - lo;
          newBuf[this._writeOffset++] = channelData[lo] * (1 - frac) + channelData[hi] * frac;
        }
        return true;
      }

      const srcIndex = i / ratio;
      const lo = Math.floor(srcIndex);
      const hi = Math.min(lo + 1, channelData.length - 1);
      const frac = srcIndex - lo;
      buf[this._writeOffset++] = channelData[lo] * (1 - frac) + channelData[hi] * frac;
    }

    return true;
  }
}

registerProcessor('transcriber-capture-processor', TranscriberCaptureProcessor);
