// Limitr Transcriber Audio Capture Worklet
// Captures PCM audio, resamples to 16kHz, and posts buffers to the main thread
//
// Follows the same AudioWorkletProcessor pattern as noise-suppressor-worklet.js

const WHISPER_SAMPLE_RATE = 16000;
const CHUNK_DURATION_S = 2;
const SAMPLES_PER_CHUNK = WHISPER_SAMPLE_RATE * CHUNK_DURATION_S; // 32000

class TranscriberCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(SAMPLES_PER_CHUNK);
    this._writeOffset = 0;
    this._enabled = true;
    this._busy = false; // true while main thread is processing a chunk

    this.port.onmessage = (event) => {
      if (event.data.type === 'enable') {
        this._enabled = event.data.enabled;
        if (!event.data.enabled) {
          this._writeOffset = 0;
        }
      } else if (event.data.type === 'chunk-consumed') {
        // Main thread finished processing, we can fill a new buffer
        this._busy = false;
      }
    };
  }

  process(inputs) {
    if (!this._enabled || this._busy) return true;

    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    // Use first channel (mono)
    const channelData = input[0];

    // Resample from sampleRate to 16kHz using linear interpolation
    const ratio = WHISPER_SAMPLE_RATE / sampleRate;
    const resampledLength = Math.floor(channelData.length * ratio);

    for (let i = 0; i < resampledLength; i++) {
      if (this._writeOffset >= SAMPLES_PER_CHUNK) {
        // Buffer full — send to main thread
        this.port.postMessage(
          { type: 'audio-chunk', audio: this._buffer.slice(0, this._writeOffset) },
        );
        this._writeOffset = 0;
        this._busy = true;
        return true;
      }

      const srcIndex = i / ratio;
      const lo = Math.floor(srcIndex);
      const hi = Math.min(lo + 1, channelData.length - 1);
      const frac = srcIndex - lo;
      this._buffer[this._writeOffset++] = channelData[lo] * (1 - frac) + channelData[hi] * frac;
    }

    return true;
  }
}

registerProcessor('transcriber-capture-processor', TranscriberCaptureProcessor);
