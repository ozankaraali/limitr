// Limitr DSP core (AudioWorklet). Input 0 is the program, input 1 the optional tape hiss.
//
// Spike guard. Pulls loudness back down wherever it goes more than `guardHeadroom` dB above the
//   stream's normal loudness. Loudness is the largest of three K-weighted readings, each minus the
//   crest it normally has on this stream: a fast one (2 ms rise) for hits, a 50 ms one for onsets
//   of sustained sound, and a 400 ms-like one for what the ear hears of sustained sound. A 20 ms
//   lookahead lets the gain move before an onset reaches the output.
// Normal loudness is the talking level: the upper quartile of the last 20 s of momentary loudness
//   after the BS.1770-4 relative gate (blocks more than 10 LU under the window's mean loudness
//   don't count: pauses and the game or music bed between phrases, which otherwise drag a plain
//   median 20 dB under the voice; the quartile, where the talking usually sits, keeps a louder
//   bed from taking over while the voice is there a quarter of the time). Normal follows drifts
//   of up to 3 dB around the level it is defending; a jump of more than 3 dB above that level
//   (however slowly it builds: a mic or music turned up over a few seconds) only becomes the
//   new normal once it has lasted `guardMemory` seconds (20 s until the familiar level is
//   known; 3 s while the stream is new, if the jump is 12 dB or more: an intro or a pause came
//   first): a yelling fit stays a spike. A smaller jump, a yell's size, starts over whenever the
//   stream is back at normal for 2 s, so a streamer's fits never add up to a new normal however
//   often they come. Coming back to the stream's familiar level (the same statistic over the
//   last 4 × `guardMemory` seconds) is always allowed, and normal never sinks more than 6 dB
//   under it, so a quiet stretch (a BRB screen) doesn't leave the voice ducked. Blocks under
//   -50 LUFS (silence, a muted mic or an empty room while the streamer sets up) are never
//   learned; normal is first known after 1 s of sound, and what the guard cut before that, or
//   while a new stream's real level arrived, is let go at once.
// Harsh sound (`deharshEnabled`): a yell into the mic, a shrill alert or a crowd tips the sound
//   from the voice's body (150-600 Hz) to its edge (2-8 kHz). Against the stream's own usual
//   balance while it talks, a moment near its talking level or louder that tips brighter gets a
//   high shelf cut (at most `deharshMaxCut`) for as long as it lasts. Quiet brightness is left alone.
// Comfortable level (the evener): turns the same normal loudness down to `levelTarget` within about
//   a second when the stream is louder (at most `levelMaxCut`), and lifts a quieter one slowly by
//   at most `levelMaxBoost` (0 in most presets: quieter sound is left alone).
// The hiss joins after the guard, so it's never measured or ducked. Then the post gain (volume,
//   tab volume and compressor makeup, smoothed per sample), so the guard always judges the stream
//   at its own level and the volume changes loudness only.
// Brickwall limiter on what is output: ceiling min(`limiterCeiling` + post gain, 0 dBFS). Sample-
//   peak lookahead limiter (sliding-minimum hold, release, then box smoothing over the lookahead
//   window); the smoothed gain is provably at or below the gain each delayed sample needs.
//
// Every stage is always in the signal path with constant latency, so toggling them is click-free:
// a disabled stage simply holds unity gain.

const GUARD_LOOKAHEAD_MS = 20;
const LIMITER_LOOKAHEAD_MS = 5;
const FAST_RISE_S = 0.002;
const FAST_FALL_S = 0.03;
const MEDIUM_TAU_S = 0.05;
const SLOW_TAU_S = 0.2;           // a one-pole at 0.2 s weighs about like a 400 ms window
const DISPLAY_TAU_S = 0.1;
const MAX_CREST_DB = 12;
// How far under the knee (as a fraction of mean square, about 4e-9 dB) loudness must be for the
// guard to skip computing it in dB: far more than rounding can move it, far less than matters
const KNEE_MARGIN = 1e-9;
// Hits (the fast reading) get at most this much headroom whatever the preset: on recorded
// streams, a talker's hits reach 4–5 dB over their usual crest (3 dB touched them a sixth of
// the time), and more lets alert and clap onsets through. The preset's headroom still sets how
// loud sustained sound may get.
const HIT_HEADROOM_DB = 5;
const SUB_BLOCK_S = 0.1;          // momentary loudness = mean of 4 sub-blocks (400 ms)
const SHORT_BLOCKS = 200;         // 20 s of non-silent audio
const MAX_MEMORY_S = 300;
const MAX_BLOCKS = 4 * MAX_MEMORY_S * 10;
const ESTABLISHED_BLOCKS = 1200;  // the familiar level needs 2 min of audio (or half its window)
const LONG_EVERY_BLOCKS = 10;     // the familiar level is refreshed once a second
const NORMAL_PERCENTILE = 0.75;   // where the talking usually sits; spikes must fill a quarter of the window
const RELATIVE_GATE_DB = 10;      // BS.1770-4 relative gate: blocks this far under the mean don't count
const DRIFT_DB = 3;               // normal follows drifts this small right away
const NEW_MEMORY_S = 3;           // a jump becomes normal this fast while the stream is new (20 s)...
const NEW_JUMP_DB = 12;           // ...if it is this big (an intro or a pause came first; a yell is smaller)
const YOUNG_MEMORY_S = 20;        // ...and this fast while the familiar level is unknown
const RETURN_S = 2;               // back at normal this long, a yell-sized jump was a fit: it starts over
const FLOOR_DB = 6;
const NORMAL_TAU_S = 1;
const SILENCE_GATE_DB = -50;     // quieter blocks are silence or room noise (a muted mic): never learned from
// Before normal is known, the guard judges against a default; once it is, whatever that cut is let
// go this fast, for this long, instead of at the preset's release
const LOCK_RELEASE_TAU_S = 0.05;
const LOCK_RELEASE_S = 0.5;
const DEFAULT_NORMAL_DB = -23;
const DEFAULT_FAST_CREST_DB = 6;  // typical block peaks above momentary loudness, before learning
const DEFAULT_MEDIUM_CREST_DB = 3;
const MIN_BLOCKS_FOR_NORMAL = 10;  // 1 s of sound: the first 400 ms window is still filling as a voice starts
const LEVEL_CUT_TAU_S = 1;
const LEVEL_LIFT_TAU_S = 2;
const POST_TAU_S = 0.02;
const HEARD_TAU_S = 0.15;         // reduction averaged about like 400 ms loudness
const STEADY_TAU_S = 5;           // a steady cut is not a spike
const STEADY_TAU_IN_SPIKE_S = 60; // ...but a stuck one eventually stops counting as one
const METER_INTERVAL_S = 0.05;
const SPIKE_START_DB = 3;
const SPIKE_END_DB = 1;
const MAX_CHANNELS = 8;
// After this long of digital silence (nothing connected: Limitr off, or the tab captured instead;
// or only zeros: a paused player) the worklet stops computing until sound comes back. By then
// silence has released every gain and emptied every filter (the slowest, the steady cut that
// spikes are counted against, to under 1%), so it holds that settled state instead.
const IDLE_AFTER_S = 30;
// Harsh sound: how its balance is read and how the shelf answers
const HARSH_EVERY = 32;            // samples between looks at the balance (under a millisecond)
const HARSH_TAU_S = 0.1;           // the band energies are smoothed this much
const HARSH_ALLOW_DB = 3;          // brighter than usual by this much is still the voice
const HARSH_RATIO = 1.2;           // each dB of excess brightness takes this much off the top
const HARSH_LOUD_DB = -6;          // only within this much of the talking level, or louder
const HARSH_LEARN_TAU_S = 20;      // the usual balance follows the talking this slowly
const HARSH_DEFAULT_DB = -10;      // until the stream's own is known
const HARSH_LEARN_DB = 6;          // blocks this close to the talking level are talking
const HARSH_ON_DB = 0.05;          // a smaller cut is none: the shelf is left out
const SHELF_HZ = 2000;
const SHELF_SLOPE = 0.8;
const SHELF_ATTACK_S = 0.01;
const SHELF_RELEASE_S = 0.25;

const dbToLin = db => Math.pow(10, db / 20);
const linToDb = x => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const msToLufs = ms => (ms > 1e-12 ? -0.691 + 10 * Math.log10(ms) : -120);
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

// RBJ cookbook biquads, as [b0, b1, b2, a1, a2]
function bandpass(f0, q, fs) {
  const w = 2 * Math.PI * f0 / fs;
  const al = Math.sin(w) / (2 * q);
  const a0 = 1 + al;
  return [al / a0, 0, -al / a0, -2 * Math.cos(w) / a0, (1 - al) / a0];
}

function highpass(f0, fs) {
  const w = 2 * Math.PI * f0 / fs;
  const al = Math.sin(w) / Math.SQRT2;
  const c = Math.cos(w);
  const a0 = 1 + al;
  return [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - al) / a0];
}

function lowpass(f0, fs) {
  const w = 2 * Math.PI * f0 / fs;
  const al = Math.sin(w) / Math.SQRT2;
  const c = Math.cos(w);
  const a0 = 1 + al;
  return [(1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, -2 * c / a0, (1 - al) / a0];
}

// A high shelf of gainDb, written into out (it changes while a harsh moment comes and goes, so
// it makes no garbage)
function highShelf(f0, slope, gainDb, fs, out) {
  const A = Math.pow(10, gainDb / 40);
  const w = 2 * Math.PI * f0 / fs;
  const c = Math.cos(w);
  const al = Math.sin(w) / 2 * Math.sqrt((A + 1 / A) * (1 / slope - 1) + 2);
  const sq = 2 * Math.sqrt(A) * al;
  const a0 = (A + 1) - (A - 1) * c + sq;
  out[0] = A * ((A + 1) + (A - 1) * c + sq) / a0;
  out[1] = -2 * A * ((A - 1) + (A + 1) * c) / a0;
  out[2] = A * ((A + 1) + (A - 1) * c - sq) / a0;
  out[3] = 2 * ((A - 1) - (A + 1) * c) / a0;
  out[4] = ((A + 1) - (A - 1) * c - sq) / a0;
}

// Whether every channel of an input holds only zeros (true for one with nothing connected)
function silent(channels) {
  for (let ch = 0; ch < channels.length; ch++) {
    const data = channels[ch];
    for (let i = 0; i < data.length; i++) if (data[i] !== 0) return false;
  }
  return true;
}

// k-th smallest of a[0..n) (Hoare quickselect, reorders a)
function select(a, n, k) {
  let lo = 0;
  let hi = n - 1;
  while (hi > lo) {
    const pivot = a[(lo + hi) >> 1];
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) {
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
        i++;
        j--;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else break;
  }
  return a[k];
}

class LimitrDspProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const fs = sampleRate;
    this.fs = fs;

    this.params = {
      guardEnabled: true,
      guardHeadroom: 4,
      guardMemory: 60,
      guardRatio: 10,
      guardKnee: 4,
      guardAttack: 5,
      guardHold: 150,
      guardRelease: 800,
      guardMaxReduction: 30,
      levelEnabled: false,
      levelTarget: -23,
      levelMaxBoost: 6,
      levelMaxCut: 24,
      deharshEnabled: false,
      deharshMaxCut: 8,
      limiterEnabled: true,
      limiterCeiling: -1,
      limiterRelease: 80,
      postGainDb: 0
    };

    const initial = options && options.processorOptions && options.processorOptions.params;
    if (initial) this.applyParams(initial);

    const k = kWeighting(fs);
    this.kShelf = k.shelf;
    this.kHighpass = k.highpass;
    this.aRise = coeff(FAST_RISE_S, fs);
    this.aFall = coeff(FAST_FALL_S, fs);
    this.aMedium = coeff(MEDIUM_TAU_S, fs);
    this.aSlow = coeff(SLOW_TAU_S, fs);
    this.aDisplay = coeff(DISPLAY_TAU_S, fs);
    this.aLevelCut = coeff(LEVEL_CUT_TAU_S, fs);
    this.aLevelLift = coeff(LEVEL_LIFT_TAU_S, fs);
    this.aPost = coeff(POST_TAU_S, fs);
    this.aHeard = coeff(HEARD_TAU_S, fs);
    this.aSteady = coeff(STEADY_TAU_S, fs);
    this.aSteadyInSpike = coeff(STEADY_TAU_IN_SPIKE_S, fs);
    this.aNormal = 1 - Math.exp(-SUB_BLOCK_S / NORMAL_TAU_S);

    this.guardDelay = Math.max(1, Math.round(fs * GUARD_LOOKAHEAD_MS / 1000));
    this.limDelay = Math.max(1, Math.round(fs * LIMITER_LOOKAHEAD_MS / 1000));
    this.subBlockLength = Math.round(fs * SUB_BLOCK_S);
    this.meterInterval = Math.round(fs * METER_INTERVAL_S);
    this.idleAfter = Math.round(fs * IDLE_AFTER_S);
    this.silentFor = 0;
    this.resting = false;

    // Harsh sound: the detector's bands on the mono sum (body and edge), and the shelf it sets
    this.bandBody = bandpass(300, 0.7, fs);
    this.bandEdgeHigh = highpass(2000, fs);
    this.bandEdgeLow = lowpass(8000, fs);
    this.harshState = new Float64Array(6);
    this.aHarsh = 1 - Math.exp(-HARSH_EVERY / (HARSH_TAU_S * fs));
    this.aShelfAttack = 1 - Math.exp(-HARSH_EVERY / (SHELF_ATTACK_S * fs));
    this.aShelfRelease = 1 - Math.exp(-HARSH_EVERY / (SHELF_RELEASE_S * fs));
    this.shelf = new Float64Array(5);
    this.harshBody = 0;
    this.harshEdge = 0;
    this.harshCount = 0;
    this.harshAccBody = 0;
    this.harshAccEdge = 0;
    this.harshFloor = 0;
    this.harshMaxCut = 0;
    this.subBody = 0;
    this.subEdge = 0;
    this.shelfCut = 0;
    this.shelfCutApplied = 0;
    this.shelfOn = false;
    this.shelf[0] = 1;

    // Momentary loudness of the last 4 × guardMemory seconds; block peaks of the faster readings
    // for the last 20 s (their crest only needs to be recent)
    this.momentaryHistory = new Float32Array(MAX_BLOCKS);
    this.momentaryPower = new Float32Array(MAX_BLOCKS);  // the same, as mean square, for the gate
    this.fastPeaks = new Float32Array(SHORT_BLOCKS);
    this.mediumPeaks = new Float32Array(SHORT_BLOCKS);
    this.scratch = new Float64Array(MAX_BLOCKS);
    this.scratchFast = new Float64Array(SHORT_BLOCKS);
    this.scratchMedium = new Float64Array(SHORT_BLOCKS);

    this.channels = 0;
    this.allocate(2);
    this.resetAnalysis();
    this.postLin = dbToLin(this.params.postGainDb);
    this.updateDerived();

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'config') {
        this.applyParams(data.params || {});
        this.updateDerived();
      } else if (data.type === 'reset') {
        this.resetAnalysis();
      } else if (data.type === 'shift' && Number.isFinite(data.db)) {
        this.shiftAnalysis(data.db);
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
    this.kState = new Float64Array(Math.max(2, channels) * 4);
    this.guardBuffers = Array.from({ length: channels }, () => new Float32Array(this.guardDelay));
    this.limBuffers = Array.from({ length: channels }, () => new Float32Array(this.limDelay));
    this.stage1 = new Float64Array(channels);
    this.shelfState = new Float64Array(Math.max(2, channels) * 2);
    this.sources = new Array(channels).fill(null);
    this.noises = new Array(channels).fill(null);
    this.outs = new Array(channels).fill(null);
    this.silence = new Float32Array(128);
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

  // Forget what "normal" was: a new video, or the listener said so
  resetAnalysis() {
    this.fast = 0;
    this.medium = 0;
    this.slow = 0;
    this.display = 0;
    this.subAccum = 0;
    this.subFastPeak = 0;
    this.subMediumPeak = 0;
    this.subCount = 0;
    this.subBlocks = [0, 0, 0, 0];
    this.subBlockPos = 0;
    this.subBlocksSeen = 0;
    this.historyPos = 0;
    this.historyCount = 0;
    this.blocksSinceLong = 0;
    this.familiar = null;
    this.normalMomentary = DEFAULT_NORMAL_DB;
    this.settled = DEFAULT_NORMAL_DB;
    this.normalLocked = false;
    this.loudFor = 0;
    this.backFor = 0;
    this.jumpAge = 0;
    this.fastCrest = DEFAULT_FAST_CREST_DB;
    this.mediumCrest = DEFAULT_MEDIUM_CREST_DB;
    this.guardGain = 0;
    this.holdLeft = 0;
    this.lockReleaseLeft = 0;
    this.usualBalance = HARSH_DEFAULT_DB;
    this.balanceHeard = 0;
    this.levelGain = 0;
    this.levelTargetGain = 0;
    this.meterCountdown = 0;
    this.heard = 0;
    this.steady = 0;
    this.inSpike = false;
    this.spikePeak = 0;
    this.spikes = 0;
    this.lastSpikeDb = 0;
    this.maxSpikeDb = 0;
    this.lastSpikeAt = 0;
    this.limMin = 1;
    this.peakOut = 0;
  }

  // The source got louder or quieter by `db` without the content changing (the site's volume)
  shiftAnalysis(db) {
    const n = Math.min(this.historyCount, MAX_BLOCKS);
    const power = Math.pow(10, db / 10);
    for (let i = 0; i < n; i++) {
      this.momentaryHistory[i] += db;
      this.momentaryPower[i] *= power;
    }
    const m = Math.min(this.historyCount, SHORT_BLOCKS);
    for (let i = 0; i < m; i++) {
      this.fastPeaks[i] += db;
      this.mediumPeaks[i] += db;
    }
    if (this.familiar !== null) this.familiar += db;
    this.normalMomentary += db;
    this.settled += db;
    this.fast *= power;
    this.medium *= power;
    this.slow *= power;
    this.display *= power;
  }

  updateDerived() {
    const p = this.params;
    this.aAttack = coeff(Math.max(0.1, p.guardAttack) / 1000, this.fs);
    this.aRelease = coeff(Math.max(10, p.guardRelease) / 1000, this.fs);
    this.aLockRelease = coeff(LOCK_RELEASE_TAU_S, this.fs);
    this.holdSamples = Math.round(Math.max(0, p.guardHold) / 1000 * this.fs);
    this.aLimRelease = coeff(Math.max(5, p.limiterRelease) / 1000, this.fs);
    this.slopeFactor = p.guardRatio > 1 ? 1 - 1 / p.guardRatio : 0;
    this.longBlocks = clamp(Math.round(4 * p.guardMemory / SUB_BLOCK_S), SHORT_BLOCKS, MAX_BLOCKS);
    this.postTarget = dbToLin(p.postGainDb);
    this.aSettled = 1 - Math.exp(-SUB_BLOCK_S / Math.max(1, p.guardMemory));
  }

  // The newest `take` blocks that pass the relative gate (BS.1770-4: more than 10 LU under the
  // window's mean loudness is not what the window is about: pauses, a game or music bed between
  // phrases). Their loudness goes to `scratch`; with `peaks`, the block peaks of the fast and
  // medium readings go to `scratchFast`/`scratchMedium` (only kept for the last 20 s). Returns
  // how many passed; the loudest block always does.
  gated(take, peaks) {
    const n = Math.min(this.historyCount, take, MAX_BLOCKS);
    let j = this.historyPos % MAX_BLOCKS;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      j = j === 0 ? MAX_BLOCKS - 1 : j - 1;
      sum += this.momentaryPower[j];
    }
    const gate = msToLufs(sum / n) - RELATIVE_GATE_DB;
    let m = 0;
    j = this.historyPos % MAX_BLOCKS;
    for (let i = 0; i < n; i++) {
      j = j === 0 ? MAX_BLOCKS - 1 : j - 1;
      const v = this.momentaryHistory[j];
      if (v > gate) {
        this.scratch[m] = v;
        if (peaks) {
          this.scratchFast[m] = this.fastPeaks[j % SHORT_BLOCKS];
          this.scratchMedium[m] = this.mediumPeaks[j % SHORT_BLOCKS];
        }
        m++;
      }
    }
    return m;
  }

  // Where the first n `values` usually sit (their upper quartile; reorders them)
  usualLevel(values, n) {
    return select(values, n, Math.min(n - 1, Math.floor(n * NORMAL_PERCENTILE)));
  }

  // Loudness bookkeeping, every 100 ms of audio
  onSubBlock(meanSquare, fastPeak, mediumPeak) {
    this.subBlocks[this.subBlockPos] = meanSquare;
    this.subBlockPos = (this.subBlockPos + 1) & 3;
    if (this.subBlocksSeen < 4) this.subBlocksSeen++;
    const momentary = msToLufs(
      (this.subBlocks[0] + this.subBlocks[1] + this.subBlocks[2] + this.subBlocks[3]) / this.subBlocksSeen
    );
    const p = this.params;

    // The stream's usual balance, learned while it talks
    if (this.subBody > 0) {
      if (this.normalLocked && Math.abs(momentary - this.normalMomentary) <= HARSH_LEARN_DB) {
        const balance = 10 * Math.log10((this.subEdge + 1e-20) / (this.subBody + 1e-20));
        this.balanceHeard += SUB_BLOCK_S;
        const tau = Math.min(HARSH_LEARN_TAU_S, Math.max(1, this.balanceHeard));
        this.usualBalance += (balance - this.usualBalance) * (1 - Math.exp(-SUB_BLOCK_S / tau));
      }
      this.subBody = 0;
      this.subEdge = 0;
    }

    if (momentary > SILENCE_GATE_DB) {
      const slot = this.historyPos % MAX_BLOCKS;
      this.momentaryHistory[slot] = momentary;
      this.momentaryPower[slot] = Math.pow(10, (momentary + 0.691) / 10);
      this.fastPeaks[this.historyPos % SHORT_BLOCKS] = msToLufs(fastPeak);
      this.mediumPeaks[this.historyPos % SHORT_BLOCKS] = msToLufs(mediumPeak);
      this.historyPos = (this.historyPos + 1) % (MAX_BLOCKS * SHORT_BLOCKS);
      if (this.historyCount < MAX_BLOCKS) this.historyCount++;

      if (this.historyCount >= MIN_BLOCKS_FOR_NORMAL) {
        const m = this.gated(SHORT_BLOCKS, true);
        const recent = this.usualLevel(this.scratch, m);
        this.fastCrest = clamp(this.usualLevel(this.scratchFast, m) - recent, 0, MAX_CREST_DB);
        this.mediumCrest = clamp(this.usualLevel(this.scratchMedium, m) - recent, 0, MAX_CREST_DB);

        const established = this.historyCount >= Math.min(this.longBlocks / 2, ESTABLISHED_BLOCKS);
        if (++this.blocksSinceLong >= LONG_EVERY_BLOCKS) {
          this.blocksSinceLong = 0;
          if (established) this.familiar = this.usualLevel(this.scratch, this.gated(this.longBlocks, false));
        }
        const familiar = established && this.familiar !== null ? this.familiar : -Infinity;

        if (!this.normalLocked) {
          this.normalMomentary = recent;
          this.settled = recent;
          this.normalLocked = true;
          // A loud start was cut before normal was known: that cut is the steady one, not a spike,
          // and it is let go at once if the stream turns out to be at its normal
          this.steady = Math.max(this.steady, -this.guardGain);
          this.holdLeft = 0;
          this.lockReleaseLeft = Math.round(LOCK_RELEASE_S * this.fs);
        } else {
          // Drifts and returns to the familiar level are followed; a jump only after it has
          // lasted: 3 s while the stream is new (its first 20 s of sound) if the jump is big
          // (what came first, a quiet intro, a pause, the end of an ad, isn't a level to defend,
          // but a chime or a 2 s yell isn't the new normal either), 20 s until the familiar
          // level is known (a long quiet intro, then the voice; a yell early on), the preset's
          // memory after that. How new the stream was when the jump began is what counts. A
          // yell-sized jump starts over whenever the stream is back at normal for 2 s, so fits
          // of yelling with calm talk between them never add up; a big one doesn't (the voice's
          // pauses after an intro fall back to the intro's level). Rises are measured from the
          // level normal is defending, not from normal itself: following each step of a slow
          // rise would walk normal up a boom 3 dB at a time.
          const jump = recent > Math.max(this.settled, familiar) + DRIFT_DB;
          const big = recent >= this.settled + NEW_JUMP_DB;
          if (momentary <= this.normalMomentary + DRIFT_DB) {
            this.backFor += SUB_BLOCK_S;
            if (this.backFor >= RETURN_S && !big) this.loudFor = 0;
          } else {
            this.backFor = 0;
          }
          let follow = !jump;
          if (!jump) {
            this.loudFor = Math.max(0, this.loudFor - SUB_BLOCK_S);
          } else {
            if (this.loudFor === 0) this.jumpAge = this.historyCount < SHORT_BLOCKS ? 0 : established ? 2 : 1;
            this.loudFor += SUB_BLOCK_S;
            const needed = this.jumpAge === 0 && big ? NEW_MEMORY_S
              : this.jumpAge < 2 ? Math.min(p.guardMemory, YOUNG_MEMORY_S) : p.guardMemory;
            follow = this.loudFor >= needed;
          }
          if (jump && follow) {
            this.normalMomentary = recent;
            this.settled = recent;
            this.loudFor = 0;
            // What was cut while the level arrived was no spike: let it go fast
            if (big && this.jumpAge === 0) this.lockReleaseLeft = Math.round(LOCK_RELEASE_S * this.fs);
          } else if (follow) {
            this.normalMomentary += (recent - this.normalMomentary) * this.aNormal;
          }
          if (this.normalMomentary < familiar - FLOOR_DB) this.normalMomentary = familiar - FLOOR_DB;
          // The defended level learns freely while the stream is new; after that it rises only
          // with an accepted jump, and sinks to normal over the preset's memory (a quiet stretch
          // is followed at once, but coming back from it is a return, not a rise)
          if (this.historyCount < SHORT_BLOCKS) this.settled = this.normalMomentary;
          else if (this.normalMomentary < this.settled) this.settled += (this.normalMomentary - this.settled) * this.aSettled;
        }
      }
    }

    this.levelTargetGain = p.levelEnabled
      ? clamp(p.levelTarget - this.normalMomentary, -p.levelMaxCut, p.levelMaxBoost)
      : 0;
  }

  process(inputs, outputs) {
    const input = inputs[0] || [];
    const hiss = inputs[1] || [];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outChannels = Math.min(output.length, MAX_CHANNELS);
    if (outChannels !== this.channels) this.allocate(outChannels);

    if (silent(input) && silent(hiss)) {
      if (this.silentFor >= this.idleAfter) return this.rest(output);
      this.silentFor += output[0].length;
    } else {
      this.silentFor = 0;
      this.resting = false;
    }

    const p = this.params;
    const frames = output[0].length;
    const channels = this.channels;
    const inChannels = input.length;
    const hissChannels = hiss.length;
    // Read one by one: destructuring the arrays builds an iterator every block, garbage that the
    // audio thread has to collect
    const ks = this.kShelf;
    const kh = this.kHighpass;
    const s0 = ks[0], s1 = ks[1], s2 = ks[2], s3 = ks[3], s4 = ks[4];
    const h0 = kh[0], h1 = kh[1], h2 = kh[2], h3 = kh[3], h4 = kh[4];
    const kState = this.kState;
    const L = this.limDelay;

    // Each channel's source, hiss and output for the block (a missing source or hiss reads as
    // silence). The browser passes them in frozen arrays, which are slow to index sample by
    // sample: picked out once here, the worklet takes about a third less time.
    if (this.silence.length < frames) this.silence = new Float32Array(frames);
    const silence = this.silence;
    const sources = this.sources;
    const noises = this.noises;
    const outs = this.outs;
    for (let ch = 0; ch < channels; ch++) {
      sources[ch] = ch < inChannels ? input[ch] : (inChannels > 0 ? input[inChannels - 1] : silence);
      noises[ch] = ch < hissChannels ? hiss[ch] : (hissChannels > 0 ? hiss[hissChannels - 1] : silence);
      outs[ch] = output[ch];
    }
    // Stereo, which the engine always asks for, gets each channel's arrays and filter state in
    // locals: the same arithmetic in the same order, without a loop over the channels and its
    // lookups for every sample (about a tenth less time)
    const stereo = channels === 2;
    const srcL = sources[0];
    const srcR = stereo ? sources[1] : srcL;
    const noiseL = noises[0];
    const noiseR = stereo ? noises[1] : noiseL;
    const guardL = this.guardBuffers[0];
    const guardR = stereo ? this.guardBuffers[1] : guardL;
    const limL = this.limBuffers[0];
    const limR = stereo ? this.limBuffers[1] : limL;
    const outL = outs[0];
    const outR = stereo ? outs[1] : outL;
    let k0 = kState[0], k1 = kState[1], k2 = kState[2], k3 = kState[3];
    let k4 = kState[4], k5 = kState[5], k6 = kState[6], k7 = kState[7];

    // Harsh sound: the detector reads the incoming sound (the guard's lookahead lets the shelf
    // arrive in time), the shelf works on what leaves the guard's delay line. Switched off, the
    // detector still runs until a cut in progress has let go.
    const harshMaxCut = p.deharshEnabled ? p.deharshMaxCut : 0;
    const harshOn = p.deharshEnabled || this.shelfOn;
    // Loud enough to be harsh: within HARSH_LOUD_DB of the talking level, as mean square. These
    // and the band energies reach updateShelf() in fields: numbers passed to a call that isn't
    // inlined are boxed, garbage the audio thread has to collect.
    this.harshFloor = Math.pow(10, (this.normalMomentary + HARSH_LOUD_DB + 0.691) / 10);
    this.harshMaxCut = harshMaxCut;
    const bb = this.bandBody;
    const ebh = this.bandEdgeHigh;
    const ebl = this.bandEdgeLow;
    const bb0 = bb[0], bb2 = bb[2], bb3 = bb[3], bb4 = bb[4];
    const eh0 = ebh[0], eh1 = ebh[1], eh2 = ebh[2], eh3 = ebh[3], eh4 = ebh[4];
    const el0 = ebl[0], el1 = ebl[1], el2 = ebl[2], el3 = ebl[3], el4 = ebl[4];
    const hs = this.harshState;
    let t0 = hs[0], t1 = hs[1], t2 = hs[2], t3 = hs[3], t4 = hs[4], t5 = hs[5];
    let harshCount = this.harshCount;
    let accBody = this.harshAccBody;
    let accEdge = this.harshAccEdge;
    const shelf = this.shelf;
    let shelfOn = this.shelfOn;
    let sh0 = shelf[0], sh1 = shelf[1], sh2 = shelf[2], sh3 = shelf[3], sh4 = shelf[4];
    const shelfState = this.shelfState;
    let q0 = shelfState[0], q1 = shelfState[1], q2 = shelfState[2], q3 = shelfState[3];

    // Re-sum the box filter each block so floating-point drift can never accumulate
    let boxSum = 0;
    for (let j = 0; j < L; j++) boxSum += this.boxBuffer[j];

    const threshold = this.normalMomentary + p.guardHeadroom;
    // Each reading minus the crest it normally has, as a power factor (hits also get their own,
    // smaller headroom)
    const fastScale = Math.pow(10, -(this.fastCrest - Math.max(0, p.guardHeadroom - HIT_HEADROOM_DB)) / 10);
    const mediumScale = Math.pow(10, -this.mediumCrest / 10);
    const kneeHalf = Math.max(0.01, p.guardKnee) / 2;
    const kneeWidth = kneeHalf * 2;
    // Loudness under the knee needs no reduction. Compared as mean square, it skips the per-sample
    // logarithm, the guard's biggest cost, whenever the guard is idle; the bound sits a hair under
    // the knee, so rounding can't make a sample take the other path.
    const kneeStartMs = Math.pow(10, (threshold - kneeHalf + 0.691) / 10) * (1 - KNEE_MARGIN);
    const maxReduction = p.guardMaxReduction;
    const slopeFactor = this.slopeFactor;
    const guardOn = p.guardEnabled;
    const limiterOn = p.limiterEnabled;
    // The ceiling follows the post gain as it is applied, and never goes past 0 dBFS
    const ceilLin = Math.min(1, dbToLin(p.limiterCeiling) * this.postLin);

    for (let i = 0; i < frames; i++) {
      // --- Fast loudness detector (K-weighted, channel-summed mean square) ---
      let ms = 0;
      if (stereo) {
        // Transposed direct form II, two cascaded biquads per channel
        const xl = srcL[i];
        const yl1 = s0 * xl + k0;
        k0 = s1 * xl - s3 * yl1 + k1;
        k1 = s2 * xl - s4 * yl1;
        const yl2 = h0 * yl1 + k2;
        k2 = h1 * yl1 - h3 * yl2 + k3;
        k3 = h2 * yl1 - h4 * yl2;
        const xr = srcR[i];
        const yr1 = s0 * xr + k4;
        k4 = s1 * xr - s3 * yr1 + k5;
        k5 = s2 * xr - s4 * yr1;
        const yr2 = h0 * yr1 + k6;
        k6 = h1 * yr1 - h3 * yr2 + k7;
        k7 = h2 * yr1 - h4 * yr2;
        ms += yl2 * yl2;
        ms += yr2 * yr2;
      } else {
        for (let ch = 0; ch < channels; ch++) {
          const x = sources[ch][i];
          const o = ch * 4;
          const y1 = s0 * x + kState[o];
          kState[o] = s1 * x - s3 * y1 + kState[o + 1];
          kState[o + 1] = s2 * x - s4 * y1;
          const y2 = h0 * y1 + kState[o + 2];
          kState[o + 2] = h1 * y1 - h3 * y2 + kState[o + 3];
          kState[o + 3] = h2 * y1 - h4 * y2;
          ms += y2 * y2;
        }
      }
      this.fast += (ms - this.fast) * (ms > this.fast ? this.aRise : this.aFall);
      this.medium += (ms - this.medium) * this.aMedium;
      this.slow += (ms - this.slow) * this.aSlow;
      this.display += (ms - this.display) * this.aDisplay;
      this.subAccum += ms;

      // --- Harsh sound: body and edge energy of the mono sum ---
      if (harshOn) {
        let x;
        if (stereo) {
          x = (srcL[i] + srcR[i]) * 0.5;
        } else {
          x = 0;
          for (let ch = 0; ch < channels; ch++) x += sources[ch][i];
          x /= channels;
        }
        const body = bb0 * x + t0;
        t0 = -bb3 * body + t1;
        t1 = bb2 * x - bb4 * body;
        const e1 = eh0 * x + t2;
        t2 = eh1 * x - eh3 * e1 + t3;
        t3 = eh2 * x - eh4 * e1;
        const edge = el0 * e1 + t4;
        t4 = el1 * e1 - el3 * edge + t5;
        t5 = el2 * e1 - el4 * edge;
        accBody += body * body;
        accEdge += edge * edge;
        if (++harshCount === HARSH_EVERY) {
          this.harshAccBody = accBody;
          this.harshAccEdge = accEdge;
          this.updateShelf();
          harshCount = 0;
          accBody = 0;
          accEdge = 0;
          shelfOn = this.shelfOn;
          sh0 = shelf[0]; sh1 = shelf[1]; sh2 = shelf[2]; sh3 = shelf[3]; sh4 = shelf[4];
        }
      }
      if (this.fast > this.subFastPeak) this.subFastPeak = this.fast;
      if (this.medium > this.subMediumPeak) this.subMediumPeak = this.medium;
      if (++this.subCount >= this.subBlockLength) {
        this.onSubBlock(this.subAccum / this.subCount, this.subFastPeak, this.subMediumPeak);
        this.subAccum = 0;
        this.subFastPeak = 0;
        this.subMediumPeak = 0;
        this.subCount = 0;
      }

      // --- Comfortable level: turns down within a second, lifts slowly ---
      const levelStep = this.levelTargetGain - this.levelGain;
      this.levelGain += levelStep * (levelStep < 0 ? this.aLevelCut : this.aLevelLift);

      // --- Spike guard gain computer (dB domain) ---
      let target = 0;
      if (guardOn) {
        const hit = this.fast * fastScale;
        const onset = this.medium * mediumScale;
        const loudness = Math.max(hit, onset, this.slow);
        let reduction = 0;
        if (!(loudness > 1e-12 && loudness < kneeStartMs)) {
          const over = msToLufs(loudness) - threshold;
          if (over <= -kneeHalf) {
            reduction = 0;
          } else if (over < kneeHalf) {
            const t = over + kneeHalf;
            reduction = slopeFactor * t * t / (2 * kneeWidth);
          } else {
            reduction = slopeFactor * over;
          }
        }
        target = -(reduction < maxReduction ? reduction : maxReduction);
      }
      if (target < this.guardGain) {
        this.guardGain += (target - this.guardGain) * this.aAttack;
        this.holdLeft = this.holdSamples;
      } else if (this.holdLeft > 0) {
        this.holdLeft--;
      } else {
        this.guardGain += (target - this.guardGain) * (this.lockReleaseLeft > 0 ? this.aLockRelease : this.aRelease);
      }
      if (this.lockReleaseLeft > 0) this.lockReleaseLeft--;

      // Spike bookkeeping for the UI ("caught N spikes"), against the cut that's steady
      const reductionNow = -this.guardGain;
      this.heard += (reductionNow - this.heard) * this.aHeard;
      this.steady += (reductionNow - this.steady) * (this.inSpike ? this.aSteadyInSpike : this.aSteady);
      const aboveSteady = this.heard - this.steady;
      if (!this.inSpike && this.normalLocked && reductionNow - this.steady > SPIKE_START_DB) {
        this.inSpike = true;
        this.spikePeak = aboveSteady;
        this.spikes++;
        this.lastSpikeAt = currentTime;
      } else if (this.inSpike) {
        if (aboveSteady > this.spikePeak) this.spikePeak = aboveSteady;
        if (reductionNow - this.steady < SPIKE_END_DB) {
          this.inSpike = false;
          this.lastSpikeDb = this.spikePeak;
          if (this.spikePeak > this.maxSpikeDb) this.maxSpikeDb = this.spikePeak;
        }
      }

      const stage1Gain = dbToLin(this.guardGain + this.levelGain);
      this.postLin += (this.postTarget - this.postLin) * this.aPost;
      const post = this.postLin;

      // --- Guard delay line, then hiss, then the post gain ---
      const gw = this.guardWrite;
      let peak = 0;
      let vl = 0;
      let vr = 0;
      if (stereo) {
        let dl = guardL[gw];
        guardL[gw] = srcL[i];
        let dr = guardR[gw];
        guardR[gw] = srcR[i];
        if (shelfOn) {
          // Transposed direct form II
          const wl = sh0 * dl + q0;
          q0 = sh1 * dl - sh3 * wl + q1;
          q1 = sh2 * dl - sh4 * wl;
          dl = wl;
          const wr = sh0 * dr + q2;
          q2 = sh1 * dr - sh3 * wr + q3;
          q3 = sh2 * dr - sh4 * wr;
          dr = wr;
        }
        vl = (dl * stage1Gain + noiseL[i]) * post;
        const al = vl < 0 ? -vl : vl;
        if (al > peak) peak = al;
        vr = (dr * stage1Gain + noiseR[i]) * post;
        const ar = vr < 0 ? -vr : vr;
        if (ar > peak) peak = ar;
      } else {
        for (let ch = 0; ch < channels; ch++) {
          const buf = this.guardBuffers[ch];
          let delayed = buf[gw];
          buf[gw] = sources[ch][i];
          if (shelfOn) {
            const o = ch * 2;
            const w = sh0 * delayed + shelfState[o];
            shelfState[o] = sh1 * delayed - sh3 * w + shelfState[o + 1];
            shelfState[o + 1] = sh2 * delayed - sh4 * w;
            delayed = w;
          }
          const v = (delayed * stage1Gain + noises[ch][i]) * post;
          this.stage1[ch] = v;
          const a = v < 0 ? -v : v;
          if (a > peak) peak = a;
        }
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
      if (stereo) {
        const ol = limL[lw] * limGain;
        limL[lw] = vl;
        outL[i] = ol;
        const al = ol < 0 ? -ol : ol;
        if (al > this.peakOut) this.peakOut = al;
        const or = limR[lw] * limGain;
        limR[lw] = vr;
        outR[i] = or;
        const ar = or < 0 ? -or : or;
        if (ar > this.peakOut) this.peakOut = ar;
      } else {
        for (let ch = 0; ch < channels; ch++) {
          const buf = this.limBuffers[ch];
          const outSample = buf[lw] * limGain;
          buf[lw] = this.stage1[ch];
          outs[ch][i] = outSample;
          const a = outSample < 0 ? -outSample : outSample;
          if (a > this.peakOut) this.peakOut = a;
        }
      }
      this.limWrite = lw + 1 === L ? 0 : lw + 1;
    }
    if (stereo) {
      kState[0] = k0; kState[1] = k1; kState[2] = k2; kState[3] = k3;
      kState[4] = k4; kState[5] = k5; kState[6] = k6; kState[7] = k7;
      shelfState[0] = q0; shelfState[1] = q1; shelfState[2] = q2; shelfState[3] = q3;
    }
    hs[0] = t0; hs[1] = t1; hs[2] = t2; hs[3] = t3; hs[4] = t4; hs[5] = t5;
    this.harshCount = harshCount;
    this.harshAccBody = accBody;
    this.harshAccEdge = accEdge;

    // Any extra output channels beyond MAX_CHANNELS stay silent
    for (let ch = channels; ch < output.length; ch++) output[ch].fill(0);

    this.postMeters(frames);
    return true;
  }

  // Every HARSH_EVERY samples: how much brighter than usual the sound is (from the bands' energy
  // summed since the last look), and the shelf for it
  updateShelf() {
    const body = this.harshAccBody;
    const edge = this.harshAccEdge;
    const maxCut = this.harshMaxCut;
    this.harshBody += (body / HARSH_EVERY - this.harshBody) * this.aHarsh;
    this.harshEdge += (edge / HARSH_EVERY - this.harshEdge) * this.aHarsh;
    this.subBody += body;
    this.subEdge += edge;
    let target = 0;
    if (maxCut > 0 && this.normalLocked && this.slow >= this.harshFloor) {
      const balance = 10 * Math.log10((this.harshEdge + 1e-20) / (this.harshBody + 1e-20));
      target = Math.min(maxCut, Math.max(0, (balance - this.usualBalance - HARSH_ALLOW_DB) * HARSH_RATIO));
    }
    this.shelfCut += (target - this.shelfCut) * (target > this.shelfCut ? this.aShelfAttack : this.aShelfRelease);
    if (target === 0 && this.shelfCut < HARSH_ON_DB) this.shelfCut = 0;
    if (Math.abs(this.shelfCut - this.shelfCutApplied) > HARSH_ON_DB ||
      (this.shelfCut === 0 && this.shelfCutApplied !== 0)) {
      this.shelfCutApplied = this.shelfCut;
      if (this.shelfCut === 0) {
        this.shelf.fill(0);
        this.shelf[0] = 1;
      } else {
        highShelf(SHELF_HZ, SHELF_SLOPE, -this.shelfCut, this.fs, this.shelf);
      }
      this.shelfOn = true;
    } else if (this.shelfCutApplied === 0) {
      // A flat shelf since the last look: its state has emptied, so it can be left out
      this.shelfOn = false;
    }
  }

  // Silence for a while: the state is what silence settles it to, so a block outputs silence and
  // only keeps the clocks running (the sub-blocks, so a preset changed meanwhile still reaches the
  // comfortable level, and the meters)
  rest(output) {
    const frames = output[0].length;
    if (!this.resting) {
      this.resting = true;
      this.settle();
    }
    for (let ch = 0; ch < output.length; ch++) output[ch].fill(0);
    this.subCount += frames;
    while (this.subCount >= this.subBlockLength) {
      this.subCount -= this.subBlockLength;
      this.onSubBlock(0, 0, 0);
    }
    // A comfortable level or volume changed meanwhile still glides there, as sample by sample
    const levelStep = this.levelTargetGain - this.levelGain;
    this.levelGain = this.levelTargetGain -
      levelStep * Math.pow(1 - (levelStep < 0 ? this.aLevelCut : this.aLevelLift), frames);
    this.postLin = this.postTarget - (this.postTarget - this.postLin) * Math.pow(1 - this.aPost, frames);
    this.sampleIndex += frames;
    this.dqIndex[this.dqHead] = this.sampleIndex - 1;
    this.postMeters(frames);
    return true;
  }

  // Where silence takes everything: filters and delay lines empty, every gain released (a spike
  // still being counted ends here, as it would)
  settle() {
    this.kState.fill(0);
    this.fast = 0;
    this.medium = 0;
    this.slow = 0;
    this.display = 0;
    this.subAccum = 0;
    this.subFastPeak = 0;
    this.subMediumPeak = 0;
    this.subBlocks.fill(0);
    this.guardGain = 0;
    this.holdLeft = 0;
    this.heard = 0;
    this.steady = 0;
    if (this.inSpike) {
      this.inSpike = false;
      this.lastSpikeDb = this.spikePeak;
      if (this.spikePeak > this.maxSpikeDb) this.maxSpikeDb = this.spikePeak;
    }
    for (let ch = 0; ch < this.channels; ch++) {
      this.guardBuffers[ch].fill(0);
      this.limBuffers[ch].fill(0);
    }
    this.stage1.fill(0);
    this.harshState.fill(0);
    this.shelfState.fill(0);
    this.shelf.fill(0);
    this.shelf[0] = 1;
    this.shelfCut = 0;
    this.shelfCutApplied = 0;
    this.shelfOn = false;
    this.harshBody = 0;
    this.harshEdge = 0;
    this.harshCount = 0;
    this.harshAccBody = 0;
    this.harshAccEdge = 0;
    this.subBody = 0;
    this.subEdge = 0;
    this.dqHead = 0;
    this.dqTail = 1;
    this.dqValue[0] = 1;
    this.dqIndex[0] = this.sampleIndex - 1;
    this.limHold = 1;
    this.boxBuffer.fill(1);
  }

  // The meters, every METER_INTERVAL_S. While resting they stay the same until the listener changes
  // something (a preset, the volume, a reset), so only a change is sent: a paused tab doesn't keep
  // waking the page.
  postMeters(frames) {
    this.meterCountdown -= frames;
    if (this.meterCountdown > 0) return;
    this.meterCountdown = this.meterInterval;
    const p = this.params;
    const inDb = msToLufs(this.display);
    const limiterDb = linToDb(this.limMin);
    const postDb = linToDb(this.postLin);
    // In what-you-hear terms, like the trace: after the evener and the volume
    const outDb = inDb + this.levelGain + this.guardGain + limiterDb + postDb;
    const thresholdDb = p.guardEnabled ? this.normalMomentary + this.levelGain + p.guardHeadroom + postDb : null;
    const peakOutDb = linToDb(this.peakOut);
    const lastSpikeDb = this.inSpike ? this.spikePeak : this.lastSpikeDb;
    const maxSpikeDb = this.inSpike ? Math.max(this.maxSpikeDb, this.spikePeak) : this.maxSpikeDb;
    this.limMin = 1;
    this.peakOut = 0;
    const last = this.lastMeters;
    if (this.resting && last && last.outDb === outDb && last.thresholdDb === thresholdDb &&
      last.levelDb === this.levelGain && last.baselineDb === this.normalMomentary &&
      last.spikes === this.spikes && last.lastSpikeDb === lastSpikeDb && last.maxSpikeDb === maxSpikeDb) return;
    this.lastMeters = {
      type: 'meters',
      inDb,
      outDb,
      guardDb: this.guardGain,
      harshDb: -this.shelfCut,
      limiterDb,
      levelDb: this.levelGain,
      baselineDb: this.normalMomentary,
      thresholdDb,
      peakOutDb,
      spikes: this.spikes,
      lastSpikeDb,
      maxSpikeDb,
      lastSpikeAt: this.lastSpikeAt,
      time: currentTime
    };
    this.port.postMessage(this.lastMeters);
  }
}

registerProcessor('limitr-dsp-processor', LimitrDspProcessor);
