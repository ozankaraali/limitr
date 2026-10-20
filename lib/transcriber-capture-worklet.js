// Limitr Transcriber Audio Capture Worklet
// Downmixes to mono, low-passes, resamples to 16 kHz and posts 0.5 s chunks to the main thread.
// Short chunks let the caption segmenter notice pauses quickly; it assembles them into
// sentence-sized pieces itself.
//
// The resampler keeps its phase across render quanta: resampling each 128-frame block on its
// own drops the fractional remainder (about 2/3 of a sample per block at 48 kHz), which
// time-compresses the audio and clicks at every block edge.

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_DURATION_S = 0.5;
const SAMPLES_PER_CHUNK = TARGET_SAMPLE_RATE * CHUNK_DURATION_S;

class TranscriberCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._step = sampleRate / TARGET_SAMPLE_RATE; // input samples per output sample
    this._phase = 0;
    this._prev = 0;

    // 2nd-order Butterworth low-pass below the new Nyquist, so content above 8 kHz
    // doesn't fold back into the speech band when decimating
    const fc = Math.min(7000, sampleRate * 0.45);
    const w = 2 * Math.PI * fc / sampleRate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
    const a0 = 1 + alpha;
    this._b0 = (1 - cos) / 2 / a0;
    this._b1 = (1 - cos) / a0;
    this._b2 = this._b0;
    this._a1 = -2 * cos / a0;
    this._a2 = (1 - alpha) / a0;
    this._x1 = 0; this._x2 = 0; this._y1 = 0; this._y2 = 0;

    this._buffer = new Float32Array(SAMPLES_PER_CHUNK);
    this._offset = 0;
    this._enabled = true;

    this.port.onmessage = (event) => {
      if (event.data.type === 'enable') {
        this._enabled = event.data.enabled;
        if (!event.data.enabled) this._offset = 0;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!this._enabled || !input || input.length === 0 || !input[0]) return true;

    const channels = input.length;
    const frames = input[0].length;
    for (let i = 0; i < frames; i++) {
      let x = 0;
      for (let ch = 0; ch < channels; ch++) x += input[ch][i];
      x /= channels;

      const y = this._b0 * x + this._b1 * this._x1 + this._b2 * this._x2 - this._a1 * this._y1 - this._a2 * this._y2;
      this._x2 = this._x1; this._x1 = x;
      this._y2 = this._y1; this._y1 = y;

      // Emit every output sample whose time falls between the previous input sample and this one
      while (this._phase < 1) {
        this._buffer[this._offset++] = this._prev + (y - this._prev) * this._phase;
        if (this._offset === SAMPLES_PER_CHUNK) {
          this.port.postMessage({ type: 'audio-chunk', audio: this._buffer.slice(0) });
          this._offset = 0;
        }
        this._phase += this._step;
      }
      this._phase -= 1;
      this._prev = y;
    }
    return true;
  }
}

registerProcessor('transcriber-capture-processor', TranscriberCaptureProcessor);
