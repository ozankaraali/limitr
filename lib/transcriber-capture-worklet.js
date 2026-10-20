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

// Kaiser-windowed sinc low-pass: flat to 7 kHz, 60 dB down from 9 kHz. Below the new 8 kHz
// Nyquist, so sibilants, cymbals and hiss above it don't fold back into the speech band.
const PASS_HZ = 7000;
const STOP_HZ = 9000;
const STOP_DB = 60;

function besselI0(x) {
  let sum = 1;
  let term = 1;
  for (let k = 1; k < 30; k++) {
    term *= (x / (2 * k)) * (x / (2 * k));
    sum += term;
  }
  return sum;
}

function lowPassTaps(rate) {
  if (rate < 2 * STOP_HZ) return Float64Array.of(1);
  const beta = 0.1102 * (STOP_DB - 8.7);
  const transition = 2 * Math.PI * (STOP_HZ - PASS_HZ) / rate;
  let count = Math.ceil((STOP_DB - 8) / (2.285 * transition)) + 1;
  if (count % 2 === 0) count++;
  const cutoff = (PASS_HZ + STOP_HZ) / 2 / rate;
  const middle = (count - 1) / 2;
  const taps = new Float64Array(count);
  let total = 0;
  for (let i = 0; i < count; i++) {
    const t = i - middle;
    const sinc = t === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * t) / (Math.PI * t);
    const r = t / middle;
    taps[i] = sinc * besselI0(beta * Math.sqrt(1 - r * r)) / besselI0(beta);
    total += taps[i];
  }
  for (let i = 0; i < count; i++) taps[i] /= total;
  return taps;
}

class TranscriberCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._step = sampleRate / TARGET_SAMPLE_RATE; // input samples per output sample
    this._phase = 0;
    this._prev = 0;

    this._taps = lowPassTaps(sampleRate);
    // Input history twice over, so the newest `taps.length` samples are always contiguous
    this._history = new Float64Array(this._taps.length * 2);
    this._historyPos = 0;

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

      const taps = this._taps;
      const count = taps.length;
      const history = this._history;
      this._historyPos = this._historyPos === 0 ? count - 1 : this._historyPos - 1;
      history[this._historyPos] = x;
      history[this._historyPos + count] = x;
      let y = 0;
      for (let k = 0, at = this._historyPos; k < count; k++, at++) y += taps[k] * history[at];

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
