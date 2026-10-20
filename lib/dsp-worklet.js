// Limitr DSP core (AudioWorklet)
//
// Stage 1 — Spike guard. Learns the content's "normal" loudness (75th percentile of
//   K-weighted 400 ms loudness over the last ~20 s of non-silent audio) and pulls anything
//   that jumps more than `guardHeadroom` dB above it — or above the absolute `guardCeiling` —
//   back down. Alerts, blerps and sudden yelling get caught; normal content passes untouched.
//   A 10 ms lookahead lets the gain move before the loud onset reaches the output.
// Optional auto-level: slowly steers the learned normal loudness toward `levelTarget`.
// Stage 2 — Brickwall limiter. Sample-peak lookahead limiter (sliding-minimum hold, release,
//   then box smoothing over the lookahead window). The smoothed gain is provably at or below
//   the gain each delayed sample needs, so output peaks never exceed `limiterCeiling`.
//
// Both stages are always in the signal path with constant latency, so toggling them is
// click-free: a disabled stage simply holds unity gain.
// The volume is applied after this processor (lib/engine.js), so both stages judge the stream at
// its own level; the engine lowers `limiterCeiling` by any volume boost.

const GUARD_LOOKAHEAD_MS = 10;
const LIMITER_LOOKAHEAD_MS = 5;
const DETECTOR_TAU_S = 0.02;      // fast loudness detector window
const SUB_BLOCK_S = 0.1;          // momentary loudness = mean of 4 sub-blocks (400 ms)
const HISTORY_BLOCKS = 200;       // 20 s of non-silent momentary loudness
const BASELINE_PERCENTILE = 0.75;
const BASELINE_TAU_S = 1;
const SILENCE_GATE_DB = -60;
const DEFAULT_BASELINE_DB = -23;
const MIN_BLOCKS_FOR_BASELINE = 5;
const LEVEL_TAU_S = 3;
const METER_INTERVAL_S = 0.05;
const SPIKE_START_DB = 3;
const SPIKE_END_DB = 1;
const MAX_CHANNELS = 8;

const dbToLin = db => Math.pow(10, db / 20);
const linToDb = x => 20 * Math.log10(x > 1e-12 ? x : 1e-12);
const msToLufs = ms => 10 * Math.log10(ms > 1e-20 ? ms : 1e-20) - 0.691;
const coeff = (seconds, fs) => (seconds > 0 ? 1 - Math.exp(-1 / (seconds * fs)) : 1);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ITU-R BS.1770 K-weighting for an arbitrary sample rate
function kWeighting(fs) {
  let K = Math.tan(Math.PI * 1681.974450955533 / fs);
  let Q = 0.7071752369554196;
  const Vh = Math.pow(10, 3.999843853973347 / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = [
    (Vh + Vb * K / Q + K * K) / a0,
    2 * (K * K - Vh) / a0,
    (Vh - Vb * K / Q + K * K) / a0,
    2 * (K * K - 1) / a0,
    (1 - K / Q + K * K) / a0
  ];
  K = Math.tan(Math.PI * 38.13547087602444 / fs);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  const highpass = [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  return { shelf, highpass };
}

class LimitrDspProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const fs = sampleRate;
    this.fs = fs;

    this.params = {
      guardEnabled: true,
      guardHeadroom: 6,
      guardCeiling: -14,
      guardRatio: 10,
      guardKnee: 4,
      guardAttack: 5,
      guardHold: 150,
      guardRelease: 800,
      guardMaxReduction: 30,
      levelEnabled: false,
      levelTarget: -23,
      levelMaxBoost: 9,
      levelMaxCut: 12,
      limiterEnabled: true,
      limiterCeiling: -1,
      limiterRelease: 80
    };

    const initial = options && options.processorOptions && options.processorOptions.params;
    if (initial) this.applyParams(initial);

    const k = kWeighting(fs);
    this.kShelf = k.shelf;
    this.kHighpass = k.highpass;
    this.aDetector = coeff(DETECTOR_TAU_S, fs);

    this.guardDelay = Math.max(1, Math.round(fs * GUARD_LOOKAHEAD_MS / 1000));
    this.limDelay = Math.max(1, Math.round(fs * LIMITER_LOOKAHEAD_MS / 1000));

    this.subBlockLength = Math.round(fs * SUB_BLOCK_S);
    this.meterInterval = Math.round(fs * METER_INTERVAL_S);
    this.aBaseline = 1 - Math.exp(-SUB_BLOCK_S / BASELINE_TAU_S);
    this.aLevel = coeff(LEVEL_TAU_S, fs);
    this.aDisplay = coeff(0.1, fs);

    this.channels = 0;
    this.allocate(2);
    this.resetAnalysis();
    this.updateDerived();

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'config') {
        this.applyParams(data.params || {});
        this.updateDerived();
      } else if (data.type === 'reset') {
        this.resetAnalysis();
      }
    };
  }

  applyParams(params) {
    for (const key of Object.keys(this.params)) {
      if (params[key] !== undefined) this.params[key] = params[key];
    }
  }

  allocate(channels) {
    this.channels = channels;
    this.kState = new Float64Array(channels * 4);
    this.guardBuffers = Array.from({ length: channels }, () => new Float32Array(this.guardDelay));
    this.limBuffers = Array.from({ length: channels }, () => new Float32Array(this.limDelay));
    this.stage1 = new Float64Array(channels);
    this.guardWrite = 0;
    this.limWrite = 0;

    // Sliding-minimum deque over limDelay + 1 samples
    const cap = this.limDelay + 2;
    this.dqValue = new Float64Array(cap);
    this.dqIndex = new Float64Array(cap);
    this.dqHead = 0;
    this.dqTail = 0;
    this.dqCap = cap;
    this.sampleIndex = 0;

    this.boxBuffer = new Float64Array(this.limDelay).fill(1);
    this.boxPos = 0;
    this.limHold = 1;
  }

  resetAnalysis() {
    this.detector = 0;
    this.display = 0;
    this.subAccum = 0;
    this.subCount = 0;
    this.subBlocks = [0, 0, 0, 0];
    this.subBlockPos = 0;
    this.subBlocksSeen = 0;
    this.history = new Float64Array(HISTORY_BLOCKS);
    this.historyPos = 0;
    this.historyCount = 0;
    this.sorted = new Float64Array(HISTORY_BLOCKS);
    this.baseline = DEFAULT_BASELINE_DB;
    this.baselineLocked = false;
    this.guardGain = 0;
    this.holdLeft = 0;
    this.levelGain = 0;
    this.meterCountdown = 0;
    this.inSpike = false;
    this.spikePeak = 0;
    this.spikes = 0;
    this.lastSpikeDb = 0;
    this.maxSpikeDb = 0;
    this.lastSpikeAt = 0;
    this.limMin = 1;
    this.peakOut = 0;
    this.threshold = DEFAULT_BASELINE_DB + this.params.guardHeadroom;
  }

  updateDerived() {
    const p = this.params;
    this.aAttack = coeff(Math.max(0.1, p.guardAttack) / 1000, this.fs);
    this.aRelease = coeff(Math.max(10, p.guardRelease) / 1000, this.fs);
    this.holdSamples = Math.round(Math.max(0, p.guardHold) / 1000 * this.fs);
    this.aLimRelease = coeff(Math.max(5, p.limiterRelease) / 1000, this.fs);
    this.limCeilingLin = dbToLin(Math.min(0, p.limiterCeiling));
    this.slopeFactor = p.guardRatio > 1 ? 1 - 1 / p.guardRatio : 0;
  }

  // Momentary loudness bookkeeping, runs every 100 ms of audio
  onSubBlock(meanSquare) {
    this.subBlocks[this.subBlockPos] = meanSquare;
    this.subBlockPos = (this.subBlockPos + 1) & 3;
    if (this.subBlocksSeen < 4) this.subBlocksSeen++;
    const momentary = msToLufs(
      (this.subBlocks[0] + this.subBlocks[1] + this.subBlocks[2] + this.subBlocks[3]) / this.subBlocksSeen
    );

    if (momentary > SILENCE_GATE_DB) {
      this.history[this.historyPos] = momentary;
      this.historyPos = (this.historyPos + 1) % HISTORY_BLOCKS;
      if (this.historyCount < HISTORY_BLOCKS) this.historyCount++;

      if (this.historyCount >= MIN_BLOCKS_FOR_BASELINE) {
        const n = this.historyCount;
        const sorted = this.sorted.subarray(0, n);
        sorted.set(this.history.subarray(0, n));
        sorted.sort();
        const raw = sorted[Math.min(n - 1, Math.floor(n * BASELINE_PERCENTILE))];
        if (!this.baselineLocked) {
          this.baseline = raw;
          this.baselineLocked = true;
        } else {
          this.baseline += (raw - this.baseline) * this.aBaseline;
        }
      }
    }

    const p = this.params;
    this.levelTargetGain = p.levelEnabled
      ? clamp(p.levelTarget - this.baseline, -p.levelMaxCut, p.levelMaxBoost)
      : 0;
  }

  process(inputs, outputs) {
    const input = inputs[0] || [];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outChannels = Math.min(output.length, MAX_CHANNELS);
    if (outChannels !== this.channels) this.allocate(outChannels);

    const p = this.params;
    const frames = output[0].length;
    const channels = this.channels;
    const inChannels = input.length;
    const [s0, s1, s2, s3, s4] = this.kShelf;
    const [h0, h1, h2, h3, h4] = this.kHighpass;
    const kState = this.kState;
    const L = this.limDelay;

    // Re-sum the box filter each block so floating-point drift can never accumulate
    let boxSum = 0;
    for (let j = 0; j < L; j++) boxSum += this.boxBuffer[j];

    const ceilingDb = p.guardCeiling;
    const headroom = p.guardHeadroom;
    const kneeHalf = Math.max(0.01, p.guardKnee) / 2;
    const kneeWidth = kneeHalf * 2;
    const maxReduction = p.guardMaxReduction;
    const slopeFactor = this.slopeFactor;
    const guardOn = p.guardEnabled;
    const limiterOn = p.limiterEnabled;
    const ceilLin = this.limCeilingLin;
    if (this.levelTargetGain === undefined) this.levelTargetGain = 0;

    for (let i = 0; i < frames; i++) {
      // --- Loudness detector (K-weighted, channel-summed mean square) ---
      let ms = 0;
      for (let ch = 0; ch < channels; ch++) {
        const src = ch < inChannels ? input[ch] : (inChannels > 0 ? input[inChannels - 1] : null);
        const x = src ? src[i] : 0;
        const o = ch * 4;
        // Transposed direct form II, two cascaded biquads
        const y1 = s0 * x + kState[o];
        kState[o] = s1 * x - s3 * y1 + kState[o + 1];
        kState[o + 1] = s2 * x - s4 * y1;
        const y2 = h0 * y1 + kState[o + 2];
        kState[o + 2] = h1 * y1 - h3 * y2 + kState[o + 3];
        kState[o + 3] = h2 * y1 - h4 * y2;
        ms += y2 * y2;
      }
      this.detector += (ms - this.detector) * this.aDetector;
      this.display += (ms - this.display) * this.aDisplay;
      this.subAccum += ms;
      if (++this.subCount >= this.subBlockLength) {
        this.onSubBlock(this.subAccum / this.subCount);
        this.subAccum = 0;
        this.subCount = 0;
      }

      // --- Auto-level (slow) ---
      this.levelGain += (this.levelTargetGain - this.levelGain) * this.aLevel;
      const levelGain = this.levelGain;

      // --- Spike guard gain computer (dB domain) ---
      let target = 0;
      if (guardOn) {
        const threshold = Math.min(this.baseline + levelGain + headroom, ceilingDb);
        this.threshold = threshold;
        const over = msToLufs(this.detector) + levelGain - threshold;
        let reduction;
        if (over <= -kneeHalf) {
          reduction = 0;
        } else if (over < kneeHalf) {
          const t = over + kneeHalf;
          reduction = slopeFactor * t * t / (2 * kneeWidth);
        } else {
          reduction = slopeFactor * over;
        }
        target = -(reduction < maxReduction ? reduction : maxReduction);
      }
      if (target < this.guardGain) {
        this.guardGain += (target - this.guardGain) * this.aAttack;
        this.holdLeft = this.holdSamples;
      } else if (this.holdLeft > 0) {
        this.holdLeft--;
      } else {
        this.guardGain += (target - this.guardGain) * this.aRelease;
      }

      // Spike bookkeeping for the UI ("caught N spikes")
      const reductionNow = -this.guardGain;
      if (!this.inSpike && reductionNow > SPIKE_START_DB) {
        this.inSpike = true;
        this.spikePeak = reductionNow;
        this.spikes++;
        this.lastSpikeAt = currentTime;
      } else if (this.inSpike) {
        if (reductionNow > this.spikePeak) this.spikePeak = reductionNow;
        if (reductionNow < SPIKE_END_DB) {
          this.inSpike = false;
          this.lastSpikeDb = this.spikePeak;
          if (this.spikePeak > this.maxSpikeDb) this.maxSpikeDb = this.spikePeak;
        }
      }

      const stage1Gain = dbToLin(this.guardGain + levelGain);

      // --- Guard delay line ---
      const gw = this.guardWrite;
      let peak = 0;
      for (let ch = 0; ch < channels; ch++) {
        const src = ch < inChannels ? input[ch] : (inChannels > 0 ? input[inChannels - 1] : null);
        const buf = this.guardBuffers[ch];
        const delayed = buf[gw];
        buf[gw] = src ? src[i] : 0;
        const v = delayed * stage1Gain;
        this.stage1[ch] = v;
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
      this.guardWrite = gw + 1 === this.guardDelay ? 0 : gw + 1;

      // --- Brickwall limiter: required gain -> sliding min -> release -> box smoothing ---
      const required = limiterOn && peak > ceilLin ? ceilLin / peak : 1;
      const n = this.sampleIndex++;
      while (this.dqTail !== this.dqHead) {
        const back = this.dqTail === 0 ? this.dqCap - 1 : this.dqTail - 1;
        if (this.dqValue[back] >= required) this.dqTail = back;
        else break;
      }
      this.dqValue[this.dqTail] = required;
      this.dqIndex[this.dqTail] = n;
      this.dqTail = this.dqTail + 1 === this.dqCap ? 0 : this.dqTail + 1;
      while (this.dqIndex[this.dqHead] < n - L) {
        this.dqHead = this.dqHead + 1 === this.dqCap ? 0 : this.dqHead + 1;
      }
      const held = this.dqValue[this.dqHead];
      const released = this.limHold + (1 - this.limHold) * this.aLimRelease;
      this.limHold = held < released ? held : released;
      boxSum += this.limHold - this.boxBuffer[this.boxPos];
      this.boxBuffer[this.boxPos] = this.limHold;
      this.boxPos = this.boxPos + 1 === L ? 0 : this.boxPos + 1;
      const limGain = boxSum / L;
      if (limGain < this.limMin) this.limMin = limGain;

      // --- Limiter delay line -> output ---
      const lw = this.limWrite;
      for (let ch = 0; ch < channels; ch++) {
        const buf = this.limBuffers[ch];
        const outSample = buf[lw] * limGain;
        buf[lw] = this.stage1[ch];
        output[ch][i] = outSample;
        const a = outSample < 0 ? -outSample : outSample;
        if (a > this.peakOut) this.peakOut = a;
      }
      this.limWrite = lw + 1 === L ? 0 : lw + 1;
    }

    // Any extra output channels beyond MAX_CHANNELS stay silent
    for (let ch = channels; ch < output.length; ch++) output[ch].fill(0);

    this.meterCountdown -= frames;
    if (this.meterCountdown <= 0) {
      this.meterCountdown = this.meterInterval;
      const inDb = msToLufs(this.display);
      const limiterDb = linToDb(this.limMin);
      this.port.postMessage({
        type: 'meters',
        inDb,
        outDb: inDb + this.levelGain + this.guardGain + limiterDb,
        guardDb: this.guardGain,
        limiterDb,
        levelDb: this.levelGain,
        baselineDb: this.baseline,
        thresholdDb: this.threshold,
        peakOutDb: linToDb(this.peakOut),
        spikes: this.spikes,
        lastSpikeDb: this.inSpike ? this.spikePeak : this.lastSpikeDb,
        maxSpikeDb: this.inSpike ? Math.max(this.maxSpikeDb, this.spikePeak) : this.maxSpikeDb,
        lastSpikeAt: this.lastSpikeAt,
        time: currentTime
      });
      this.limMin = 1;
      this.peakOut = 0;
    }

    return true;
  }
}

registerProcessor('limitr-dsp-processor', LimitrDspProcessor);
