// Limitr audio engine — the single processing graph shared by page mode (content-audio.js),
// tab-capture mode (offscreen.js), the debug harness and the tests.
//
//   input → [mono] → [RNNoise] → [low cut → 5-band EQ → high cut] → [compressor]
//         → lib/dsp-worklet.js: spike guard + comfortable level → (+ tape hiss) → post gain
//           (volume, tab volume, compressor makeup) → brickwall limiter → output
//
// Gains come after the guard, so it always judges the stream itself: taming is the same at every
// volume, and the volume and makeup change loudness only. The tape hiss joins after the guard so
// it's never measured or ducked. The limiter works on exactly what is output, with its ceiling
// moved by the post gain and never above 0 dBFS.
//
// If the page refuses AudioWorklets (strict CSP), the guard and limiter fall back to native
// DynamicsCompressorNodes. That fallback has no adaptive "normal loudness", so it is coarser,
// and status.dsp reports 'fallback' so the UI can say so.
//
// Every DynamicsCompressorNode applies a hidden automatic makeup gain (Web Audio spec:
// (1 / curve(1.0)) ^ 0.6) that cannot be disabled — e.g. +15 dB at -30 dB / 12:1. Left alone it
// boosts quiet audio, which is the opposite of what Limitr is for, so each one is followed by
// an exact compensation gain (compressorMakeupDb below, verified against Chromium and Firefox).

(function (root) {
  'use strict';

  if (root.LimitrEngine) return;

  const dbToLin = db => Math.pow(10, db / 20);
  const linToDb = x => 20 * Math.log10(x);

  // The popup's loudness trace (popup.js draws 150 points, 66 ms apart): the engine keeps the
  // last of them while the popup is closed, so it opens on what just happened
  const TRACE_POINTS = 150;
  const TRACE_STEP_MS = 66;

  // Port of the DynamicsCompressorKernel static curve (Blink, also used by Gecko).
  function compressorMakeupDb(threshold, knee, ratio) {
    const linearThreshold = dbToLin(threshold);
    const slope = 1 / ratio;
    const kneeCurve = (x, k) => (x < linearThreshold
      ? x
      : linearThreshold + (1 - Math.exp(-k * (x - linearThreshold))) / k);
    const slopeAt = (x, k) => {
      if (x < linearThreshold) return 1;
      const x2 = x * 1.001;
      return (linToDb(kneeCurve(x2, k)) - linToDb(kneeCurve(x, k))) / (linToDb(x2) - linToDb(x));
    };

    const kneeThresholdDb = threshold + knee;
    const kneeThreshold = dbToLin(kneeThresholdDb);
    let minK = 0.1;
    let maxK = 10000;
    let k = 5;
    for (let i = 0; i < 15; i++) {
      if (slopeAt(kneeThreshold, k) < slope) maxK = k;
      else minK = k;
      k = Math.sqrt(minK * maxK);
    }

    const yKneeThresholdDb = linToDb(kneeCurve(kneeThreshold, k));
    const fullRangeGain = 1 < kneeThreshold
      ? kneeCurve(1, k)
      : dbToLin(yKneeThresholdDb + slope * (0 - kneeThresholdDb));
    return 0.6 * linToDb(1 / fullRangeGain);
  }

  function noiseSamples(sampleRate, type) {
    const length = sampleRate * 2;
    const data = new Float32Array(length);
    if (type === 'white') {
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.5;
      }
    }
    return data;
  }

  // Native stand-in for the guard when the worklet can't load. DynamicsCompressorNode detects
  // peaks, not loudness, so the threshold sits a typical speech crest factor above the target.
  const FALLBACK_BASELINE_DB = -23;
  const FALLBACK_CREST_DB = 9;

  const DSP_PARAM_KEYS = [
    'guardEnabled', 'guardHeadroom', 'guardMemory', 'guardRatio', 'guardAttack', 'guardHold',
    'guardRelease', 'guardStartUnder', 'strainedDb', 'strainRaisedDb', 'strainMemory', 'levelEnabled',
    'levelTarget', 'levelMaxCut', 'levelMaxBoost', 'deharshEnabled', 'deharshMaxCut', 'shoutEnabled',
    'shoutAllow', 'shoutMaxCut', 'speechRoomDb', 'speechRoomLevelDb', 'speechRoomFade',
    'limiterEnabled', 'limiterCeiling', 'limiterRelease'
  ];

  class LimitrEngine {
    // options.loadModule(path): Promise — registers an AudioWorklet module from the extension
    // options.loadBinary(path): Promise<ArrayBuffer> — fetches an extension resource
    constructor(context, options = {}) {
      this.context = context;
      this.loadModule = options.loadModule;
      this.loadBinary = options.loadBinary;
      this.onStatus = options.onStatus || (() => {});
      this.log = options.log || (() => {});

      this.settings = null;
      this.enabled = true;
      this.tabVolumeDb = 0;
      this.status = { dsp: 'loading', denoise: 'off' };
      this.meters = null;
      this.trace = [];
      this.tracedAt = 0;
      this.topologyKey = '';

      const ctx = context;
      this.input = ctx.createGain();
      this.output = ctx.createGain();

      this.mono = ctx.createGain();
      this.mono.channelCount = 1;
      this.mono.channelCountMode = 'explicit';
      this.mono.channelInterpretation = 'speakers';

      this.lowCut = ctx.createBiquadFilter();
      this.lowCut.type = 'highpass';
      this.lowCut.Q.value = Math.SQRT1_2;
      this.highCut = ctx.createBiquadFilter();
      this.highCut.type = 'lowpass';
      this.highCut.Q.value = Math.SQRT1_2;
      this.eq = [];
      for (let i = 0; i < 5; i++) {
        const band = ctx.createBiquadFilter();
        if (i > 0) this.eq[i - 1].connect(band);
        this.eq.push(band);
      }

      this.compressor = ctx.createDynamicsCompressor();
      this.compCompensation = ctx.createGain();
      this.compressor.connect(this.compCompensation);

      // The worklet takes the hiss on its second input; the native fallback mixes it in after its
      // guard and applies the post gain with a GainNode
      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.value = 0;
      this.noiseSource = null;
      this.noiseType = null;
      this.fbHissMix = ctx.createGain();
      this.volume = ctx.createGain();

      this.fbGuard = ctx.createDynamicsCompressor();
      this.fbGuardCompensation = ctx.createGain();
      this.fbLimiter = ctx.createDynamicsCompressor();
      this.fbLimiter.ratio.value = 20;
      this.fbLimiter.knee.value = 0;
      this.fbLimiter.attack.value = 0.001;
      this.fbLimiterCompensation = ctx.createGain();
      this.fbGuard.connect(this.fbGuardCompensation);
      this.fbLimiter.connect(this.fbLimiterCompensation);

      this.dspNode = null;
      this.denoiseNode = null;
      this.denoiseLoading = null;
    }

    async init() {
      try {
        await this.loadModule('lib/dsp-worklet.js');
        this.dspNode = new AudioWorkletNode(this.context, 'limitr-dsp-processor', {
          numberOfInputs: 2,
          numberOfOutputs: 1,
          channelCount: 2,
          channelCountMode: 'explicit',
          outputChannelCount: [2],
          processorOptions: { params: this.settings ? this.dspParams(this.settings) : null }
        });
        this.dspNode.port.onmessage = (event) => {
          if (event.data && event.data.type === 'meters') {
            this.meters = event.data;
            this.recordTrace(event.data);
          }
        };
        // A processor that throws outputs silence forever; switch to the native fallback
        this.dspNode.onprocessorerror = () => {
          this.log('Spike guard worklet crashed, using native fallback');
          try { this.dspNode.disconnect(); } catch (e) { /* not connected */ }
          this.dspNode = null;
          this.status.dsp = 'fallback';
          this.onStatus(this.status);
          if (this.settings) this.update(this.settings, this.enabled, true);
        };
        this.status.dsp = 'worklet';
      } catch (error) {
        this.log('Spike guard worklet unavailable, using native fallback:', error && error.message);
        this.dspNode = null;
        this.status.dsp = 'fallback';
      }
      if (this.settings) this.update(this.settings, this.enabled, true);
      this.onStatus(this.status);
      return this;
    }

    update(settings, enabled = true, force = false) {
      this.settings = settings;
      this.enabled = enabled;
      const s = settings;
      const ctx = this.context;
      const now = ctx.currentTime;

      // Post gain for the native fallback (the worklet smooths its own)
      this.volume.gain.setTargetAtTime(dbToLin(this.postGainDb(s)), now, 0.02);

      // Compressor with makeup compensation
      this.compressor.threshold.value = s.compThreshold;
      this.compressor.ratio.value = s.compRatio;
      this.compressor.knee.value = s.compKnee;
      this.compressor.attack.value = s.compAttack / 1000;
      this.compressor.release.value = s.compRelease / 1000;
      this.compCompensation.gain.value = dbToLin(-compressorMakeupDb(s.compThreshold, s.compKnee, s.compRatio));

      // Tone
      this.lowCut.frequency.value = Math.max(20, s.lowCut);
      this.highCut.frequency.value = Math.min(20000, s.highCut);
      for (let i = 0; i < 5; i++) {
        const band = this.eq[i];
        const n = i + 1;
        band.type = s[`eq${n}Type`];
        band.frequency.value = s[`eq${n}Freq`];
        band.gain.value = s[`eq${n}Gain`];
        band.Q.value = s[`eq${n}Q`];
      }

      // Lo-fi noise
      if (s.noiseLevel > 0 && enabled) {
        if (!this.noiseSource || this.noiseType !== s.noiseType) this.startNoise(s.noiseType);
        this.noiseGain.gain.setTargetAtTime(s.noiseLevel, now, 0.05);
      } else {
        this.noiseGain.gain.setTargetAtTime(0, now, 0.05);
      }

      // Spike guard + limiter
      if (this.dspNode) {
        this.dspNode.port.postMessage({ type: 'config', params: this.dspParams(s) });
      } else {
        const threshold = FALLBACK_BASELINE_DB + FALLBACK_CREST_DB + s.guardHeadroom;
        const guardThreshold = Math.max(-60, Math.min(-1, threshold));
        const guardKnee = 4;
        const guardRatio = Math.min(20, s.guardRatio);
        this.fbGuard.threshold.value = guardThreshold;
        this.fbGuard.knee.value = guardKnee;
        this.fbGuard.ratio.value = guardRatio;
        // DynamicsCompressorNode times only go up to 1 s
        this.fbGuard.attack.value = Math.min(1, s.guardAttack / 1000);
        this.fbGuard.release.value = Math.min(1, s.guardRelease / 1000);
        this.fbGuardCompensation.gain.value = dbToLin(-compressorMakeupDb(guardThreshold, guardKnee, guardRatio));
        const ceiling = this.limiterCeilingBeforeVolume(s);
        this.fbLimiter.threshold.value = ceiling;
        this.fbLimiter.release.value = Math.min(1, s.limiterRelease / 1000);
        this.fbLimiterCompensation.gain.value = dbToLin(-compressorMakeupDb(ceiling, 0, 20));
      }

      // RNNoise loads lazily the first time it's wanted
      if (s.denoiseEnabled && enabled && !this.denoiseNode && !this.denoiseLoading) {
        this.loadDenoise();
      }

      const key = this.computeTopologyKey();
      if (force || key !== this.topologyKey) {
        this.topologyKey = key;
        this.rebuild();
      }
    }

    dspParams(s) {
      const params = {};
      for (const key of DSP_PARAM_KEYS) params[key] = s[key];
      params.postGainDb = this.postGainDb(s);
      return params;
    }

    // Volume, tab volume and compressor makeup: plain gain after the guard
    postGainDb(s = this.settings) {
      return s.volume + this.tabVolumeDb + (s.compressorEnabled ? s.compMakeup : 0);
    }

    // The native fallback's limiter runs before its post gain: its ceiling there is the chosen
    // one, lowered as far as a boost needs so the output can't pass 0 dBFS
    limiterCeilingBeforeVolume(s) {
      return Math.min(s.limiterCeiling, -this.postGainDb(s));
    }

    computeTopologyKey() {
      const s = this.settings;
      return [
        this.enabled,
        s.monoEnabled,
        s.denoiseEnabled && this.status.denoise === 'on',
        s.toneEnabled,
        s.toneEnabled && s.lowCut > 20,
        s.toneEnabled && s.highCut < 20000,
        s.compressorEnabled,
        this.status.dsp,
        !this.dspNode && s.guardEnabled,
        !this.dspNode && s.limiterEnabled
      ].join('|');
    }

    rebuild() {
      const s = this.settings;
      for (const node of [this.input, this.mono, this.denoiseNode, this.lowCut, this.highCut,
        this.eq[4], this.compCompensation, this.volume, this.dspNode, this.noiseGain,
        this.fbGuardCompensation, this.fbHissMix, this.fbLimiterCompensation]) {
        if (node) {
          try { node.disconnect(); } catch (e) { /* not connected */ }
        }
      }

      if (!this.enabled) {
        // Bypass is exactly unity: no volume, no processing.
        this.input.connect(this.output);
        return;
      }

      let node = this.input;
      const chain = next => { node.connect(next); node = next; };

      if (s.monoEnabled) chain(this.mono);
      if (s.denoiseEnabled && this.denoiseNode && this.status.denoise === 'on') chain(this.denoiseNode);
      if (s.toneEnabled) {
        if (s.lowCut > 20) chain(this.lowCut);
        chain(this.eq[0]);
        node = this.eq[4];
        if (s.highCut < 20000) chain(this.highCut);
      }
      if (s.compressorEnabled) {
        node.connect(this.compressor);
        node = this.compCompensation;
      }

      if (this.dspNode) {
        chain(this.dspNode);
        this.noiseGain.connect(this.dspNode, 0, 1);
      } else {
        if (s.guardEnabled) {
          node.connect(this.fbGuard);
          node = this.fbGuardCompensation;
        }
        chain(this.fbHissMix);
        this.noiseGain.connect(this.fbHissMix);
        if (s.limiterEnabled) {
          node.connect(this.fbLimiter);
          node = this.fbLimiterCompensation;
        }
        chain(this.volume);
      }
      node.connect(this.output);
    }

    startNoise(type) {
      const ctx = this.context;
      if (this.noiseSource) {
        try { this.noiseSource.stop(); } catch (e) { /* already stopped */ }
        this.noiseSource.disconnect();
      }
      const data = noiseSamples(ctx.sampleRate, type);
      const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.getChannelData(0).set(data);
      this.noiseSource = ctx.createBufferSource();
      this.noiseSource.buffer = buffer;
      this.noiseSource.loop = true;
      this.noiseSource.connect(this.noiseGain);
      this.noiseSource.start();
      this.noiseType = type;
    }

    async loadDenoise() {
      this.status.denoise = 'loading';
      this.onStatus(this.status);
      this.denoiseLoading = (async () => {
        try {
          await this.loadModule('lib/noise-suppressor-worklet.js');
          const node = new AudioWorkletNode(this.context, 'noise-suppressor-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: 2,
            channelCountMode: 'explicit',
            outputChannelCount: [2]
          });
          const ready = new Promise((resolve, reject) => {
            node.port.onmessage = (event) => {
              if (event.data.type === 'initialized') resolve();
              else if (event.data.type === 'error') reject(new Error(event.data.error));
            };
          });
          const wasm = await this.loadBinary('lib/rnnoise.wasm');
          node.port.postMessage({ type: 'wasm-binary', binary: wasm }, [wasm]);
          await ready;
          node.onprocessorerror = () => {
            this.log('RNNoise worklet crashed');
            try { node.disconnect(); } catch (e) { /* not connected */ }
            this.denoiseNode = null;
            this.status.denoise = 'error';
            this.onStatus(this.status);
            if (this.settings) this.update(this.settings, this.enabled, true);
          };
          this.denoiseNode = node;
          this.status.denoise = 'on';
        } catch (error) {
          this.log('RNNoise unavailable:', error && error.message);
          this.status.denoise = 'error';
        }
        this.onStatus(this.status);
        if (this.settings) this.update(this.settings, this.enabled);
      })();
    }

    setTabVolume(db) {
      this.tabVolumeDb = db;
      // The limiter ceiling depends on the volume too
      if (this.settings) this.update(this.settings, this.enabled);
    }

    // The source got `db` louder or quieter without the content changing (the site's volume)
    shiftAnalysis(db) {
      if (this.dspNode && Number.isFinite(db) && db !== 0) this.dspNode.port.postMessage({ type: 'shift', db });
    }

    resetAnalysis() {
      if (this.dspNode) this.dspNode.port.postMessage({ type: 'reset' });
    }

    // On a 66 ms grid, like the popup's own polling (meters arrive every 50 ms)
    recordTrace(meters) {
      const now = performance.now();
      if (now < this.tracedAt || !Number.isFinite(meters.outDb)) return;
      this.tracedAt = Math.max(this.tracedAt + TRACE_STEP_MS, now - TRACE_STEP_MS);
      this.trace.push({ out: meters.outDb, cut: Math.max(0, -Math.min(meters.guardDb || 0, meters.shoutDb || 0)), limit: meters.thresholdDb });
      if (this.trace.length > TRACE_POINTS) this.trace.shift();
    }

    // withTrace: also the last ~10 s of the loudness trace (the popup asks once, as it opens)
    getMeters(withTrace = false) {
      const base = {
        dsp: this.status.dsp,
        denoise: this.status.denoise,
        compressorDb: this.settings && this.settings.compressorEnabled ? this.compressor.reduction : 0,
        contextState: this.context.state
      };
      if (withTrace) base.trace = this.trace.slice();
      if (this.dspNode) return { ...base, ...(this.meters || {}) };
      return {
        ...base,
        guardDb: this.fbGuard.reduction,
        limiterDb: this.fbLimiter.reduction
      };
    }

    dispose() {
      if (this.noiseSource) {
        try { this.noiseSource.stop(); } catch (e) { /* already stopped */ }
      }
      for (const node of [this.input, this.output, this.dspNode, this.denoiseNode]) {
        if (node) {
          try { node.disconnect(); } catch (e) { /* not connected */ }
        }
      }
    }
  }

  LimitrEngine.compressorMakeupDb = compressorMakeupDb;
  root.LimitrEngine = LimitrEngine;
})(typeof globalThis !== 'undefined' ? globalThis : self);
