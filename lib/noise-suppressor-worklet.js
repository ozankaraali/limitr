/**
 * RNNoise Noise Suppressor AudioWorklet Processor
 * Based on @jitsi/rnnoise-wasm
 *
 * RNNoise processes 480 samples at a time (10ms at 48kHz)
 * AudioWorklet processes 128 samples at a time
 * We use a circular buffer to bridge this gap
 *
 * Supports per-channel processing for stereo audio
 */

// RNNoise constants
const RNNOISE_SAMPLE_LENGTH = 480;
const BUFFER_SIZE = 480 * 4; // Multiple of 480 for clean wraparound
const MAX_CHANNELS = 2; // Support up to stereo

class NoiseSuppressorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this._initialized = false;
    this._enabled = true;
    this._numChannels = 0;

    // Per-channel circular buffers for input samples
    this._inputBuffers = [];
    this._inputWritePos = [];
    this._inputReadPos = [];
    this._inputSamplesAvailable = [];

    // Per-channel output buffers (denoised samples waiting to be output)
    this._outputBuffers = [];
    this._outputWritePos = [];
    this._outputReadPos = [];
    this._outputSamplesAvailable = [];

    // Per-channel RNNoise state
    this._exports = null;
    this._denoiseStates = [];
    this._wasmInputPtrs = [];
    this._wasmOutputPtrs = [];

    // Handle messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'enable') {
        this._enabled = event.data.enabled;
      } else if (event.data.type === 'wasm-binary') {
        this._initializeFromBinary(event.data.binary);
      }
    };
  }

  _initializeChannel(ch) {
    // Initialize buffers for this channel
    this._inputBuffers[ch] = new Float32Array(BUFFER_SIZE);
    this._inputWritePos[ch] = 0;
    this._inputReadPos[ch] = 0;
    this._inputSamplesAvailable[ch] = 0;

    this._outputBuffers[ch] = new Float32Array(BUFFER_SIZE);
    this._outputWritePos[ch] = 0;
    this._outputReadPos[ch] = 0;
    this._outputSamplesAvailable[ch] = 0;

    // Create RNNoise state for this channel
    this._denoiseStates[ch] = this._exports.f();
    if (!this._denoiseStates[ch]) {
      throw new Error(`rnnoise_create returned null for channel ${ch}`);
    }

    // Allocate WASM buffers for this channel (480 floats * 4 bytes = 1920 bytes each)
    this._wasmInputPtrs[ch] = this._exports.g(RNNOISE_SAMPLE_LENGTH * 4);
    this._wasmOutputPtrs[ch] = this._exports.g(RNNOISE_SAMPLE_LENGTH * 4);

    if (!this._wasmInputPtrs[ch] || !this._wasmOutputPtrs[ch]) {
      throw new Error(`malloc failed for channel ${ch}`);
    }
  }

  async _initializeFromBinary(wasmBinary) {
    try {
      // HEAP view (will be set after instantiation)
      let HEAPU8 = null;

      // Emscripten helper functions
      const emscripten_memcpy_big = (dest, src, num) => {
        HEAPU8.copyWithin(dest, src, src + num);
      };

      const emscripten_resize_heap = (requestedSize) => {
        return false; // Fixed memory, no resize
      };

      // Import object - namespace "a" with functions "a" and "b"
      const imports = {
        a: {
          a: emscripten_resize_heap,
          b: emscripten_memcpy_big
        }
      };

      // Compile and instantiate WASM binary
      const result = await WebAssembly.instantiate(wasmBinary, imports);
      this._exports = result.instance.exports;

      // Get memory from exports (export "c")
      const wasmMemory = this._exports.c;
      if (!wasmMemory) {
        throw new Error('Memory export "c" not found');
      }
      HEAPU8 = new Uint8Array(wasmMemory.buffer);

      // Call __wasm_call_ctors (export "d") to initialize runtime
      if (this._exports.d) {
        this._exports.d();
      }

      // rnnoise_init (export "e") - optional initialization
      if (this._exports.e) {
        this._exports.e();
      }

      // Initialize all channels upfront
      for (let ch = 0; ch < MAX_CHANNELS; ch++) {
        this._initializeChannel(ch);
      }
      this._numChannels = MAX_CHANNELS;

      this._initialized = true;
      this.port.postMessage({ type: 'initialized' });
    } catch (error) {
      console.error('[NoiseSuppressor] Init failed:', error);
      this.port.postMessage({ type: 'error', error: error.message });
    }
  }

  _processRnnoiseFrame(ch) {
    if (!this._initialized || !this._denoiseStates[ch]) return;

    // Get fresh view of WASM memory
    const wasmMemory = this._exports.c;
    const heapF32 = new Float32Array(wasmMemory.buffer);
    const inputOffset = this._wasmInputPtrs[ch] >> 2;
    const outputOffset = this._wasmOutputPtrs[ch] >> 2;

    // Copy 480 samples from input buffer to WASM memory
    // Convert from [-1, 1] to [-32768, 32767] (16-bit PCM range that RNNoise expects)
    for (let i = 0; i < RNNOISE_SAMPLE_LENGTH; i++) {
      const sample = this._inputBuffers[ch][(this._inputReadPos[ch] + i) % BUFFER_SIZE];
      heapF32[inputOffset + i] = sample * 32768.0;
    }

    // Advance input read position
    this._inputReadPos[ch] = (this._inputReadPos[ch] + RNNOISE_SAMPLE_LENGTH) % BUFFER_SIZE;
    this._inputSamplesAvailable[ch] -= RNNOISE_SAMPLE_LENGTH;

    // Process with RNNoise (export "j": rnnoise_process_frame)
    this._exports.j(this._denoiseStates[ch], this._wasmOutputPtrs[ch], this._wasmInputPtrs[ch]);

    // Copy denoised samples to output buffer
    // Convert back from PCM range to [-1, 1]
    for (let i = 0; i < RNNOISE_SAMPLE_LENGTH; i++) {
      const sample = heapF32[outputOffset + i] / 32768.0;
      this._outputBuffers[ch][(this._outputWritePos[ch] + i) % BUFFER_SIZE] = sample;
    }

    // Advance output write position
    this._outputWritePos[ch] = (this._outputWritePos[ch] + RNNOISE_SAMPLE_LENGTH) % BUFFER_SIZE;
    this._outputSamplesAvailable[ch] += RNNOISE_SAMPLE_LENGTH;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) {
      return true;
    }

    const totalChannels = Math.min(input.length, output.length);
    const processChannels = Math.min(totalChannels, this._numChannels || MAX_CHANNELS);
    const numSamples = input[0].length;

    // If disabled or not initialized, pass through all channels
    if (!this._enabled || !this._initialized) {
      for (let ch = 0; ch < totalChannels; ch++) {
        output[ch].set(input[ch]);
      }
      return true;
    }

    // Process first MAX_CHANNELS through RNNoise
    for (let ch = 0; ch < processChannels; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch];

      // Write input samples to channel's input buffer
      for (let i = 0; i < numSamples; i++) {
        this._inputBuffers[ch][this._inputWritePos[ch]] = inputChannel[i];
        this._inputWritePos[ch] = (this._inputWritePos[ch] + 1) % BUFFER_SIZE;
        this._inputSamplesAvailable[ch]++;
      }

      // Process complete frames (480 samples each)
      while (this._inputSamplesAvailable[ch] >= RNNOISE_SAMPLE_LENGTH) {
        this._processRnnoiseFrame(ch);
      }

      // Output denoised samples if available
      if (this._outputSamplesAvailable[ch] >= numSamples) {
        for (let i = 0; i < numSamples; i++) {
          outputChannel[i] = this._outputBuffers[ch][this._outputReadPos[ch]];
          this._outputReadPos[ch] = (this._outputReadPos[ch] + 1) % BUFFER_SIZE;
        }
        this._outputSamplesAvailable[ch] -= numSamples;
      } else {
        // Not enough denoised samples yet, output silence (startup latency)
        outputChannel.fill(0);
      }
    }

    // Pass through any channels beyond MAX_CHANNELS (e.g., 5.1 surround)
    for (let ch = processChannels; ch < totalChannels; ch++) {
      output[ch].set(input[ch]);
    }

    return true;
  }
}

registerProcessor('noise-suppressor-processor', NoiseSuppressorProcessor);
