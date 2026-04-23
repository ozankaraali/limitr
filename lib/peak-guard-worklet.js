class PeakGuardProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.enabled = false;
    this.thresholdDb = -6;
    this.threshold = this.dbToLinear(this.thresholdDb);
    this.lookaheadMs = 8;
    this.releaseMs = 120;
    this.gain = 1;
    this.writeIndex = 0;
    this.bufferLength = 0;
    this.buffers = [];
    this.releaseCoeff = 0.001;

    this.configure({});

    this.port.onmessage = (event) => {
      if (event.data?.type === 'config') {
        this.configure(event.data);
      }
    };
  }

  dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  configure(config) {
    if (typeof config.enabled === 'boolean') {
      this.enabled = config.enabled;
    }
    if (typeof config.thresholdDb === 'number') {
      this.thresholdDb = Math.max(-48, Math.min(0, config.thresholdDb));
      this.threshold = this.dbToLinear(this.thresholdDb);
    }
    if (typeof config.lookaheadMs === 'number') {
      this.lookaheadMs = Math.max(0, Math.min(30, config.lookaheadMs));
      this.bufferLength = 0;
    }
    if (typeof config.releaseMs === 'number') {
      this.releaseMs = Math.max(20, Math.min(1000, config.releaseMs));
    }

    const releaseSeconds = this.releaseMs / 1000;
    this.releaseCoeff = releaseSeconds > 0
      ? 1 - Math.exp(-1 / (releaseSeconds * sampleRate))
      : 1;
  }

  ensureBuffers(channelCount) {
    const nextLength = Math.max(1, Math.round(sampleRate * this.lookaheadMs / 1000));
    if (this.bufferLength === nextLength && this.buffers.length === channelCount) return;

    this.bufferLength = nextLength;
    this.writeIndex = 0;
    this.buffers = Array.from({ length: channelCount }, () => new Float32Array(this.bufferLength));
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!output || output.length === 0) return true;

    const outputChannels = output.length;
    const inputChannels = input?.length || 0;
    this.ensureBuffers(outputChannels);

    const frameCount = output[0].length;
    for (let i = 0; i < frameCount; i++) {
      let peak = 0;

      for (let ch = 0; ch < inputChannels; ch++) {
        const value = Math.abs(input[ch]?.[i] || 0);
        if (value > peak) peak = value;
      }

      const targetGain = this.enabled && peak > this.threshold && peak > 0
        ? this.threshold / peak
        : 1;

      if (targetGain < this.gain) {
        this.gain = targetGain;
      } else {
        this.gain += (1 - this.gain) * this.releaseCoeff;
      }

      for (let ch = 0; ch < outputChannels; ch++) {
        const sourceChannel = inputChannels > 0 ? input[Math.min(ch, inputChannels - 1)] : null;
        const buffer = this.buffers[ch];
        output[ch][i] = buffer[this.writeIndex] * this.gain;
        buffer[this.writeIndex] = sourceChannel?.[i] || 0;
      }

      this.writeIndex = (this.writeIndex + 1) % this.bufferLength;
    }

    return true;
  }
}

registerProcessor('peak-guard-processor', PeakGuardProcessor);
