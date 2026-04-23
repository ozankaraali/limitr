// Limitr Content Script - Fallback Audio Processing
// Uses MediaElementSource for fullscreen compatibility (no tabCapture)

(function() {
  'use strict';

  if (window.limitrAudioInitialized) return;
  window.limitrAudioInitialized = true;

  let audioContext = null;
  let compressor = null;
  let makeupGain = null;
  let outputGain = null;
  let noiseGain = null;
  let noiseSource = null;

  // 3-Band Multiband Compressor nodes
  let crossover1 = null;
  let crossover2 = null;
  let subBand = null;
  let midBand = null;
  let highBand = null;
  let multibandSum = null;
  let multibandActive = false;

  // 5-Band Parametric EQ nodes
  let eqBands = [];
  let eqActive = false;

  // Bass/Treble cut filters
  let bassCutFilter = null;
  let trebleCutFilter = null;

  // Limiter (brick wall)
  let limiter = null;
  let preLimiter = null;

  // Auto-gain (AGC)
  let autoGainInput = null;
  let autoGainNode = null;
  let analyser = null;
  let analyserBuffer = null;
  let agcEnabled = false;
  let agcTarget = -16;
  let agcSpeed = 'normal';
  let agcCurrentGain = 1;
  let agcIntervalId = null;

  // Noise gate
  let gateInput = null;
  let gateNode = null;
  let gateAnalyser = null;
  let gateAnalyserBuffer = null;
  let gateIsOpen = true;
  let gateHoldCounter = 0;
  let gateIntervalId = null;

  // Audio ducking
  let duckingSidechainBP = null;
  let duckingAnalyser = null;
  let duckingAnalyserBuffer = null;
  let duckLowShelf = null;
  let duckHighShelf = null;
  let duckingIntervalId = null;
  let duckingActive = false;

  // Regular-mode transcriber capture
  let transcriberInput = null;
  let transcriberCaptureNode = null;
  let transcriberCaptureWorkletLoaded = false;
  let transcriberActive = false;
  let transcriberTabId = null;

  // RNNoise AI noise suppression
  let noiseSuppressorNode = null;
  let noiseSuppressorReady = false;
  let noiseSuppressorInitStarted = false;

  // LUFS meter
  // Soft clipper (WaveShaperNode for smooth peak taming)
  let softClipper = null;
  let softClipDriveGain = null;
  let softClipCompGain = null;

  // Lookahead peak guard (hidden safety stage for streamer scream presets)
  let peakGuardNode = null;
  let peakGuardReady = false;
  let peakGuardInitStarted = false;

  // Mono-to-stereo fixer (forces mono downmix, upmixed to both channels by default)
  let monoMixer = null;

  let lufsPreFilter = null;
  let lufsRlbFilter = null;
  let lufsAnalyser = null;
  let lufsAnalyserBuffer = null;

  const connectedMedia = new Map();
  let scanObserver = null;
  let scanIntervalId = null;
  let scanStarted = false;
  let currentNoiseType = 'brown';

  let settings = {
    enabled: true,
    outputGain: 0,

    // Global compressor
    compressorEnabled: true,
    threshold: -18,
    ratio: 6,
    knee: 10,
    attack: 5,
    release: 100,
    makeupGain: 0,
    gainEnabled: true,

    // 3-Band Multiband Compressor
    multibandEnabled: false,
    crossover1: 200,
    crossover2: 3000,
    subThreshold: -20,
    subRatio: 8,
    subGain: 0,
    midThreshold: -24,
    midRatio: 4,
    midGain: 0,
    highThreshold: -24,
    highRatio: 6,
    highGain: 0,

    // 5-Band Parametric EQ
    eqEnabled: false,
    eq1Freq: 80, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: 0, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 1000, eq3Gain: 0, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: 0, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 12000, eq5Gain: 0, eq5Q: 0.7, eq5Type: 'highshelf',

    // Filters (independent bass/treble cut)
    bassCutFreq: 0,
    trebleCutFreq: 22050,
    filtersEnabled: false,

    // AI Noise Suppression
    noiseSuppressionEnabled: false,

    // Soft clipper (smooth peak taming)
    softClipEnabled: false,
    softClipDrive: 0,

    // Lookahead peak guard
    peakGuardEnabled: false,
    peakGuardThreshold: -6,
    peakGuardLookahead: 8,
    peakGuardRelease: 120,

    // Mono-to-stereo fixer
    monoMixEnabled: false,

    // Limiter (brick wall, prevents clipping / auto-level)
    limiterEnabled: true,
    limiterThreshold: -1,

    // Auto-Gain (AGC - automatic level control)
    autoGainEnabled: false,
    autoGainTarget: -16,
    autoGainSpeed: 'normal',

    // Limiter timing
    limiterAttack: 1,
    limiterRelease: 100,

    // Noise Gate
    gateEnabled: false,
    gateThreshold: -50,
    gateHold: 100,
    gateRelease: 200,

    // Audio Ducking (speech-aware dynamic range)
    duckingEnabled: false,
    duckingThreshold: -35,
    duckingAmount: -12,
    duckingRelease: 300,

    // Effects
    noiseLevel: 0,
    noiseType: 'brown',
    effectsEnabled: false
  };

  // Create a crossover filter pair
  function createCrossoverPair(frequency) {
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = frequency;
    lowpass.Q.value = 0.707;

    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = frequency;
    highpass.Q.value = 0.707;

    return { lowpass, highpass };
  }

  // Create a per-band processor
  function createBandProcessor(threshold, ratio, knee, attack, release, gain) {
    const comp = audioContext.createDynamicsCompressor();
    comp.threshold.value = threshold;
    comp.ratio.value = ratio;
    comp.knee.value = knee;
    comp.attack.value = attack / 1000;
    comp.release.value = release / 1000;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = Math.pow(10, gain / 20);

    comp.connect(gainNode);
    return { compressor: comp, gainNode };
  }

  // Noise generation
  const AGC_PROFILES = {
    slow:   { interval: 100, attack: 0.02, release: 0.05, maxGain: 6 },
    normal: { interval: 50,  attack: 0.05, release: 0.10, maxGain: 6 },
    fast:   { interval: 20,  attack: 0.15, release: 0.25, maxGain: 4  }
  };

  function calculateAnalyserDb(analyserNode, buffer) {
    analyserNode.getFloatTimeDomainData(buffer);

    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      sumSquares += buffer[i] * buffer[i];
    }

    const rms = Math.sqrt(sumSquares / buffer.length);
    return rms > 0 ? 20 * Math.log10(rms) : -100;
  }

  function updateAutoGain() {
    if (!agcEnabled || !analyser || !analyserBuffer) return;

    const profile = AGC_PROFILES[agcSpeed] || AGC_PROFILES.normal;
    const currentDb = calculateAnalyserDb(analyser, analyserBuffer);
    if (currentDb <= -60) return;

    const diffDb = agcTarget - currentDb;
    const targetGain = Math.pow(10, diffDb / 20);
    const smoothing = targetGain > agcCurrentGain ? profile.attack : profile.release;
    agcCurrentGain += (targetGain - agcCurrentGain) * smoothing;
    agcCurrentGain = Math.max(0.1, Math.min(profile.maxGain, agcCurrentGain));
    autoGainNode.gain.setTargetAtTime(agcCurrentGain, audioContext.currentTime, 0.02);
  }

  function startAgc() {
    if (agcIntervalId) return;
    agcEnabled = true;
    const profile = AGC_PROFILES[agcSpeed] || AGC_PROFILES.normal;
    agcIntervalId = setInterval(updateAutoGain, profile.interval);
  }

  function stopAgc() {
    agcEnabled = false;
    if (agcIntervalId) {
      clearInterval(agcIntervalId);
      agcIntervalId = null;
    }
    agcCurrentGain = 1;
    if (autoGainNode) {
      autoGainNode.gain.setTargetAtTime(1, audioContext.currentTime, 0.1);
    }
  }

  function setAgcSpeed(speed) {
    agcSpeed = speed || 'normal';
    if (agcIntervalId) {
      clearInterval(agcIntervalId);
      agcIntervalId = null;
      startAgc();
    }
  }

  function updateGate() {
    if (!gateAnalyser || !gateAnalyserBuffer || !gateNode) return;

    const currentDb = calculateAnalyserDb(gateAnalyser, gateAnalyserBuffer);
    const threshold = settings.gateThreshold;
    const holdTicks = Math.max(1, Math.round(settings.gateHold / 20));
    const releaseTime = settings.gateRelease / 1000;

    if (currentDb >= threshold) {
      if (!gateIsOpen) {
        gateNode.gain.setTargetAtTime(1, audioContext.currentTime, 0.006);
        gateIsOpen = true;
      }
      gateHoldCounter = holdTicks;
    } else if (gateHoldCounter > 0) {
      gateHoldCounter--;
    } else if (gateIsOpen) {
      gateNode.gain.setTargetAtTime(0, audioContext.currentTime, releaseTime / 3);
      gateIsOpen = false;
    }
  }

  function startGate() {
    if (gateIntervalId) return;
    gateIsOpen = true;
    gateHoldCounter = 0;
    gateNode.gain.setTargetAtTime(1, audioContext.currentTime, 0.006);
    gateIntervalId = setInterval(updateGate, 20);
  }

  function stopGate() {
    if (gateIntervalId) {
      clearInterval(gateIntervalId);
      gateIntervalId = null;
    }
    gateIsOpen = true;
    gateHoldCounter = 0;
    if (gateNode) {
      gateNode.gain.setTargetAtTime(1, audioContext.currentTime, 0.006);
    }
  }

  function updateDucking() {
    if (!duckingAnalyser || !duckingAnalyserBuffer || !duckLowShelf || !duckHighShelf) return;

    const currentDb = calculateAnalyserDb(duckingAnalyser, duckingAnalyserBuffer);
    const threshold = settings.duckingThreshold;
    const amount = settings.duckingAmount;
    const releaseTime = settings.duckingRelease / 1000;

    if (currentDb >= threshold) {
      duckingActive = true;
      duckLowShelf.gain.setTargetAtTime(amount, audioContext.currentTime, 0.02);
      duckHighShelf.gain.setTargetAtTime(amount, audioContext.currentTime, 0.02);
    } else if (duckingActive) {
      duckLowShelf.gain.setTargetAtTime(0, audioContext.currentTime, releaseTime / 3);
      duckHighShelf.gain.setTargetAtTime(0, audioContext.currentTime, releaseTime / 3);
      duckingActive = false;
    }
  }

  function startDucking() {
    if (duckingIntervalId) return;
    duckingActive = false;
    duckLowShelf.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);
    duckHighShelf.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);
    duckingIntervalId = setInterval(updateDucking, 20);
  }

  function stopDucking() {
    if (duckingIntervalId) {
      clearInterval(duckingIntervalId);
      duckingIntervalId = null;
    }
    duckingActive = false;
    if (duckLowShelf && duckHighShelf) {
      duckLowShelf.gain.setTargetAtTime(0, audioContext.currentTime, 0.05);
      duckHighShelf.gain.setTargetAtTime(0, audioContext.currentTime, 0.05);
    }
  }

  function generateNoiseBuffer(sampleRate, type) {
    const bufferSize = sampleRate * 2;
    const data = new Float32Array(bufferSize);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      // Brown noise
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }
    }
    return data;
  }

  function initAudio() {
    if (audioContext) return;

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Global compressor
      compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = settings.threshold;
      compressor.ratio.value = settings.ratio;
      compressor.knee.value = settings.knee;
      compressor.attack.value = settings.attack / 1000;
      compressor.release.value = settings.release / 1000;

      makeupGain = audioContext.createGain();
      makeupGain.gain.value = Math.pow(10, settings.makeupGain / 20);

      outputGain = audioContext.createGain();
      outputGain.gain.value = Math.pow(10, settings.outputGain / 20);

      // 3-Band Multiband Compressor
      crossover1 = createCrossoverPair(settings.crossover1);
      crossover2 = createCrossoverPair(settings.crossover2);

      subBand = createBandProcessor(
        settings.subThreshold, settings.subRatio, settings.knee,
        settings.attack, settings.release, settings.subGain
      );
      midBand = createBandProcessor(
        settings.midThreshold, settings.midRatio, settings.knee,
        settings.attack, settings.release, settings.midGain
      );
      highBand = createBandProcessor(
        settings.highThreshold, settings.highRatio, settings.knee,
        settings.attack, settings.release, settings.highGain
      );

      multibandSum = audioContext.createGain();
      multibandSum.gain.value = 1;

      // Connect multiband internal routing
      crossover1.lowpass.connect(subBand.compressor);
      crossover1.highpass.connect(crossover2.lowpass);
      crossover1.highpass.connect(crossover2.highpass);
      crossover2.lowpass.connect(midBand.compressor);
      crossover2.highpass.connect(highBand.compressor);
      subBand.gainNode.connect(multibandSum);
      midBand.gainNode.connect(multibandSum);
      highBand.gainNode.connect(multibandSum);

      // 5-Band Parametric EQ
      eqBands = [];
      for (let i = 1; i <= 5; i++) {
        const band = audioContext.createBiquadFilter();
        band.type = settings[`eq${i}Type`];
        band.frequency.value = settings[`eq${i}Freq`];
        band.gain.value = settings[`eq${i}Gain`];
        band.Q.value = settings[`eq${i}Q`];
        eqBands.push(band);
      }
      // Connect EQ bands in series
      for (let i = 0; i < 4; i++) {
        eqBands[i].connect(eqBands[i + 1]);
      }

      // Bass Cut / Treble Cut filters
      bassCutFilter = audioContext.createBiquadFilter();
      bassCutFilter.type = 'highpass';
      bassCutFilter.frequency.value = settings.bassCutFreq || 20;
      bassCutFilter.Q.value = 0.707;

      trebleCutFilter = audioContext.createBiquadFilter();
      trebleCutFilter.type = 'lowpass';
      trebleCutFilter.frequency.value = settings.trebleCutFreq || 22050;
      trebleCutFilter.Q.value = 0.707;

      // Limiter (brick wall, prevents clipping / auto-level)
      limiter = audioContext.createDynamicsCompressor();
      limiter.threshold.value = settings.limiterThreshold;
      limiter.ratio.value = 20;
      limiter.knee.value = 0;
      limiter.attack.value = (settings.limiterAttack || 1) / 1000;
      limiter.release.value = (settings.limiterRelease || 100) / 1000;

      // Auto-gain
      autoGainInput = audioContext.createGain();
      autoGainNode = audioContext.createGain();
      autoGainNode.gain.value = 1;
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserBuffer = new Float32Array(analyser.fftSize);
      agcTarget = settings.autoGainTarget;
      agcSpeed = settings.autoGainSpeed || 'normal';

      // Noise gate
      gateInput = audioContext.createGain();
      gateNode = audioContext.createGain();
      gateNode.gain.value = 1;
      gateAnalyser = audioContext.createAnalyser();
      gateAnalyser.fftSize = 2048;
      gateAnalyserBuffer = new Float32Array(gateAnalyser.fftSize);

      // Audio ducking
      duckingSidechainBP = audioContext.createBiquadFilter();
      duckingSidechainBP.type = 'bandpass';
      duckingSidechainBP.frequency.value = 1000;
      duckingSidechainBP.Q.value = 0.5;
      duckingAnalyser = audioContext.createAnalyser();
      duckingAnalyser.fftSize = 2048;
      duckingAnalyserBuffer = new Float32Array(duckingAnalyser.fftSize);
      duckLowShelf = audioContext.createBiquadFilter();
      duckLowShelf.type = 'lowshelf';
      duckLowShelf.frequency.value = 300;
      duckLowShelf.gain.value = 0;
      duckHighShelf = audioContext.createBiquadFilter();
      duckHighShelf.type = 'highshelf';
      duckHighShelf.frequency.value = 3000;
      duckHighShelf.gain.value = 0;

      // Transcriber capture input; connected to media sources only while active.
      transcriberInput = audioContext.createGain();
      transcriberInput.gain.value = 1;

      // Fixed safety limiter before RNNoise to avoid feeding it clipped transients.
      preLimiter = audioContext.createDynamicsCompressor();
      preLimiter.threshold.value = -1;
      preLimiter.ratio.value = 20;
      preLimiter.knee.value = 0;
      preLimiter.attack.value = 0.001;
      preLimiter.release.value = 0.1;

      // Soft clipper (smooth peak taming via tanh waveshaper)
      softClipper = audioContext.createWaveShaper();
      const clipCurve = new Float32Array(8192);
      for (let i = 0; i < 8192; i++) {
        const x = (2 * i / 8192) - 1;
        clipCurve[i] = Math.tanh(x);
      }
      softClipper.curve = clipCurve;
      softClipper.oversample = '2x';

      softClipDriveGain = audioContext.createGain();
      softClipDriveGain.gain.value = 1;
      softClipCompGain = audioContext.createGain();
      softClipCompGain.gain.value = 1;

      softClipDriveGain.connect(softClipper);
      softClipper.connect(softClipCompGain);

      // Mono-to-stereo fixer (forces mono downmix → auto upmix to both channels)
      monoMixer = audioContext.createGain();
      monoMixer.channelCount = 1;
      monoMixer.channelCountMode = 'explicit';
      monoMixer.channelInterpretation = 'speakers';
      monoMixer.gain.value = 1;

      // LUFS meter (K-weighted loudness measurement)
      lufsPreFilter = audioContext.createBiquadFilter();
      lufsPreFilter.type = 'highshelf';
      lufsPreFilter.frequency.value = 1500;
      lufsPreFilter.gain.value = 4;
      lufsPreFilter.Q.value = 0.707;

      lufsRlbFilter = audioContext.createBiquadFilter();
      lufsRlbFilter.type = 'highpass';
      lufsRlbFilter.frequency.value = 38;
      lufsRlbFilter.Q.value = 0.5;

      lufsAnalyser = audioContext.createAnalyser();
      lufsAnalyser.fftSize = 16384;
      lufsAnalyserBuffer = new Float32Array(lufsAnalyser.fftSize);

      lufsPreFilter.connect(lufsRlbFilter);
      lufsRlbFilter.connect(lufsAnalyser);

      // Noise
      noiseGain = audioContext.createGain();
      noiseGain.gain.value = settings.noiseLevel;

      const noiseData = generateNoiseBuffer(audioContext.sampleRate, settings.noiseType);
      const noiseBuffer = audioContext.createBuffer(1, noiseData.length, audioContext.sampleRate);
      noiseBuffer.getChannelData(0).set(noiseData);

      noiseSource = audioContext.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      noiseSource.connect(noiseGain);
      noiseGain.connect(outputGain);
      noiseSource.start();
      currentNoiseType = settings.noiseType;

      // Default chain: compressor -> makeupGain -> outputGain -> destination
      compressor.connect(makeupGain);
      makeupGain.connect(outputGain);
      outputGain.connect(audioContext.destination);

      initPeakGuard();
      initNoiseSuppressor();

      console.log('[Limitr Fallback] Audio chain initialized with EQ + Multiband + Limiter support');
    } catch (e) {
      console.error('[Limitr Fallback] Init failed:', e);
    }
  }

  function requestBridgeResource(path, responseType = 'text') {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      const timeout = setTimeout(() => {
        window.removeEventListener('message', onResponse);
        reject(new Error(`Timed out loading ${path}`));
      }, 10000);

      function onResponse(event) {
        if (!event.data || event.data.type !== 'limitr-bridge-resource-response' || event.data.id !== id) {
          return;
        }

        clearTimeout(timeout);
        window.removeEventListener('message', onResponse);
        if (event.data.success) {
          resolve(event.data.payload);
        } else {
          reject(new Error(event.data.error || `Failed to load ${path}`));
        }
      }

      window.addEventListener('message', onResponse);
      window.postMessage({
        type: 'limitr-bridge-fetch-resource',
        id,
        path,
        responseType
      }, '*');
    });
  }

  function requestBridgeAction(type, payload = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      const timeout = setTimeout(() => {
        window.removeEventListener('message', onResponse);
        reject(new Error(`Timed out waiting for ${type}`));
      }, timeoutMs);

      function onResponse(event) {
        if (!event.data || event.data.type !== 'limitr-bridge-response' || event.data.id !== id) {
          return;
        }

        clearTimeout(timeout);
        window.removeEventListener('message', onResponse);
        resolve(event.data.payload);
      }

      window.addEventListener('message', onResponse);
      window.postMessage({ type, id, ...payload }, '*');
    });
  }

  async function loadExtensionResource(path, responseType = 'text') {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      if (responseType === 'url') {
        return chrome.runtime.getURL(path);
      }

      const response = await fetch(chrome.runtime.getURL(path));
      if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
      }
      return responseType === 'arrayBuffer' ? response.arrayBuffer() : response.text();
    }

    return requestBridgeResource(path, responseType);
  }

  async function loadNoiseSuppressorWorklet() {
    const extensionUrl = await loadExtensionResource('lib/noise-suppressor-worklet.js', 'url');

    try {
      await audioContext.audioWorklet.addModule(extensionUrl);
      return;
    } catch (extensionUrlError) {
      console.log('[Limitr Fallback] Extension worklet URL failed, trying blob URL:', extensionUrlError.message);
    }

    const workletSource = await loadExtensionResource('lib/noise-suppressor-worklet.js', 'text');
    const workletUrl = URL.createObjectURL(new Blob([workletSource], { type: 'application/javascript' }));
    try {
      await audioContext.audioWorklet.addModule(workletUrl);
    } finally {
      URL.revokeObjectURL(workletUrl);
    }
  }

  async function loadPeakGuardWorklet() {
    const extensionUrl = await loadExtensionResource('lib/peak-guard-worklet.js', 'url');

    try {
      await audioContext.audioWorklet.addModule(extensionUrl);
      return;
    } catch (extensionUrlError) {
      console.log('[Limitr Fallback] Extension peak guard worklet URL failed, trying blob URL:', extensionUrlError.message);
    }

    const workletSource = await loadExtensionResource('lib/peak-guard-worklet.js', 'text');
    const workletUrl = URL.createObjectURL(new Blob([workletSource], { type: 'application/javascript' }));
    try {
      await audioContext.audioWorklet.addModule(workletUrl);
    } finally {
      URL.revokeObjectURL(workletUrl);
    }
  }

  function configurePeakGuard(enabled = settings.enabled && settings.peakGuardEnabled) {
    if (!peakGuardNode) return;
    peakGuardNode.port.postMessage({
      type: 'config',
      enabled,
      thresholdDb: settings.peakGuardThreshold,
      lookaheadMs: settings.peakGuardLookahead,
      releaseMs: settings.peakGuardRelease
    });
  }

  async function initPeakGuard() {
    if (peakGuardInitStarted || !audioContext?.audioWorklet || typeof AudioWorkletNode === 'undefined') {
      return;
    }

    peakGuardInitStarted = true;

    try {
      await loadPeakGuardWorklet();
      peakGuardNode = new AudioWorkletNode(audioContext, 'peak-guard-processor');
      peakGuardReady = true;
      configurePeakGuard();
      rebuildSignalChain();
      console.log('[Limitr Fallback] Peak guard ready');
    } catch (error) {
      console.error('[Limitr Fallback] Failed to initialize peak guard:', error);
    }
  }

  async function loadTranscriberCaptureWorklet() {
    if (transcriberCaptureWorkletLoaded) return;

    const extensionUrl = await loadExtensionResource('lib/transcriber-capture-worklet.js', 'url');
    try {
      await audioContext.audioWorklet.addModule(extensionUrl);
    } catch (extensionUrlError) {
      console.log('[Limitr Fallback] Extension transcriber worklet URL failed, trying blob URL:', extensionUrlError.message);
      const workletSource = await loadExtensionResource('lib/transcriber-capture-worklet.js', 'text');
      const workletUrl = URL.createObjectURL(new Blob([workletSource], { type: 'application/javascript' }));
      try {
        await audioContext.audioWorklet.addModule(workletUrl);
      } finally {
        URL.revokeObjectURL(workletUrl);
      }
    }

    transcriberCaptureWorkletLoaded = true;
  }

  async function initNoiseSuppressor() {
    if (noiseSuppressorInitStarted || !audioContext?.audioWorklet || typeof AudioWorkletNode === 'undefined') {
      return;
    }

    noiseSuppressorInitStarted = true;

    try {
      await loadNoiseSuppressorWorklet();

      noiseSuppressorNode = new AudioWorkletNode(audioContext, 'noise-suppressor-processor');
      noiseSuppressorNode.port.onmessage = (event) => {
        if (event.data.type === 'initialized') {
          noiseSuppressorReady = true;
          noiseSuppressorNode.port.postMessage({ type: 'enable', enabled: settings.noiseSuppressionEnabled });
          rebuildSignalChain();
          console.log('[Limitr Fallback] RNNoise noise suppressor ready');
        } else if (event.data.type === 'error') {
          console.error('[Limitr Fallback] RNNoise error:', event.data.error);
        }
      };

      const wasmBinary = await loadExtensionResource('lib/rnnoise.wasm', 'arrayBuffer');
      noiseSuppressorNode.port.postMessage({
        type: 'wasm-binary',
        binary: wasmBinary
      }, [wasmBinary]);
    } catch (error) {
      console.error('[Limitr Fallback] Failed to initialize RNNoise:', error);
    }
  }

  async function ensureTranscriberCapture() {
    if (!audioContext?.audioWorklet || typeof AudioWorkletNode === 'undefined') {
      throw new Error('AudioWorklet is not available in this browser');
    }

    await loadTranscriberCaptureWorklet();

    if (!transcriberCaptureNode) {
      transcriberCaptureNode = new AudioWorkletNode(audioContext, 'transcriber-capture-processor');
      transcriberCaptureNode.port.onmessage = (event) => {
        if (event.data.type !== 'audio-chunk' || !transcriberActive || !transcriberTabId) return;

        const audio = event.data.audio;
        window.postMessage({
          type: 'limitr-bridge-transcriber-audio',
          tabId: transcriberTabId,
          audio
        }, '*', [audio.buffer]);
      };
    }

    try { transcriberInput.disconnect(); } catch (e) {}
    transcriberInput.connect(transcriberCaptureNode);
    transcriberCaptureNode.port.postMessage({ type: 'enable', enabled: true });
  }

  function connectSourcesToTranscriber() {
    if (!transcriberActive || !transcriberInput) return;

    connectedMedia.forEach(({ source }) => {
      try { source.connect(transcriberInput); } catch (e) {}
    });
  }

  async function startRegularTranscription(tabId) {
    initAudio();
    if (!audioContext) throw new Error('Audio processing is not initialized');
    if (audioContext.state === 'suspended') await audioContext.resume();

    const response = await requestBridgeAction(
      'limitr-bridge-transcriber-start',
      { tabId },
      300000
    );
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to start transcriber');
    }

    transcriberTabId = tabId;
    transcriberActive = true;
    await ensureTranscriberCapture();
    rebuildSignalChain();
    return { success: true };
  }

  async function stopRegularTranscription(tabId) {
    transcriberActive = false;
    transcriberTabId = null;
    if (transcriberCaptureNode) {
      transcriberCaptureNode.port.postMessage({ type: 'enable', enabled: false });
    }
    try { transcriberInput?.disconnect(); } catch (e) {}

    const response = await requestBridgeAction('limitr-bridge-transcriber-stop', { tabId });
    return response || { success: true };
  }

  function changeNoiseType(newType) {
    if (!audioContext || !noiseSource) return;

    const noiseData = generateNoiseBuffer(audioContext.sampleRate, newType);
    const noiseBuffer = audioContext.createBuffer(1, noiseData.length, audioContext.sampleRate);
    noiseBuffer.getChannelData(0).set(noiseData);

    const newNoiseSource = audioContext.createBufferSource();
    newNoiseSource.buffer = noiseBuffer;
    newNoiseSource.loop = true;

    noiseSource.stop();
    noiseSource.disconnect();
    newNoiseSource.connect(noiseGain);
    newNoiseSource.start();
    noiseSource = newNoiseSource;
    currentNoiseType = newType;
  }

  // Rebuild signal chain based on settings
  // Chain: Source → [MonoMix] → [Dynamics] → [RNNoise] → [Bass Cut] → [EQ] → [Treble Cut] → [Gate] → [AGC] → [SoftClip] → [Limiter] → Output
  // Dynamics FIRST so loud sounds get tamed before hitting any frequency shaping
  function rebuildSignalChain() {
    if (!audioContext) return;

    // Disconnect all sources from their current routing
    connectedMedia.forEach(({ source }) => {
      try { source.disconnect(); } catch (e) {}
    });

    // Disconnect shared processing nodes
    try { compressor.disconnect(); } catch (e) {}
    try { makeupGain.disconnect(); } catch (e) {}
    try { multibandSum.disconnect(); } catch (e) {}
    try { bassCutFilter.disconnect(); } catch (e) {}
    try { eqBands[4].disconnect(); } catch (e) {}
    try { trebleCutFilter.disconnect(); } catch (e) {}
    try { preLimiter.disconnect(); } catch (e) {}
    try { noiseSuppressorNode?.disconnect(); } catch (e) {}
    try { gateInput.disconnect(); } catch (e) {}
    try { gateNode.disconnect(); } catch (e) {}
    try { gateAnalyser.disconnect(); } catch (e) {}
    try { autoGainInput.disconnect(); } catch (e) {}
    try { autoGainNode.disconnect(); } catch (e) {}
    try { analyser.disconnect(); } catch (e) {}
    try { duckingSidechainBP.disconnect(); } catch (e) {}
    try { duckingAnalyser.disconnect(); } catch (e) {}
    try { duckLowShelf.disconnect(); } catch (e) {}
    try { duckHighShelf.disconnect(); } catch (e) {}
    try { softClipDriveGain.disconnect(); } catch (e) {}
    try { softClipCompGain.disconnect(); } catch (e) {}
    try { peakGuardNode?.disconnect(); } catch (e) {}
    try { limiter.disconnect(); } catch (e) {}
    try { monoMixer.disconnect(); } catch (e) {}

    const bassCutActive = settings.filtersEnabled && settings.bassCutFreq > 20;
    const trebleCutActive = settings.filtersEnabled && settings.trebleCutFreq < 22050;

    // Build tail of chain: [soft clipper] -> [limiter] -> [peak guard] -> outputGain
    let finalNode = outputGain;
    const peakGuardActive = settings.peakGuardEnabled && peakGuardReady && peakGuardNode;
    if (peakGuardActive) {
      configurePeakGuard(true);
      peakGuardNode.connect(outputGain);
      finalNode = peakGuardNode;
    } else {
      configurePeakGuard(false);
    }
    if (settings.limiterEnabled) {
      limiter.connect(finalNode);
      finalNode = limiter;
    }
    if (settings.softClipEnabled) {
      softClipDriveGain.connect(softClipper);
      softClipper.connect(softClipCompGain);
      softClipCompGain.connect(finalNode);
      finalNode = softClipDriveGain;
    }

    if (!settings.enabled) {
      // Bypass must be unity gain; do not route through outputGain while disabled.
      connectedMedia.forEach(({ source }) => {
        source.connect(audioContext.destination);
      });
      eqActive = false;
      multibandActive = false;
      noiseGain.gain.value = 0;
      noiseSuppressorNode?.port.postMessage({ type: 'enable', enabled: false });
      configurePeakGuard(false);
      stopDucking();
      stopGate();
      stopAgc();
      return;
    }

    // Build tail of chain: [gate] -> [AGC] -> [soft clipper] -> [limiter] -> outputGain.
    const gateActive = settings.gateEnabled;
    const autoGainActive = settings.autoGainEnabled;
    if (autoGainActive) {
      autoGainInput.connect(analyser);
      autoGainInput.connect(autoGainNode);
      autoGainNode.connect(finalNode);
      finalNode = autoGainInput;
      startAgc();
    } else {
      stopAgc();
    }
    if (gateActive) {
      gateInput.connect(gateAnalyser);
      gateInput.connect(gateNode);
      gateNode.connect(finalNode);
      finalNode = gateInput;
      startGate();
    } else {
      stopGate();
    }

    const noiseSuppressionActive = settings.noiseSuppressionEnabled && noiseSuppressorReady && noiseSuppressorNode;
    const firstPostNoiseNode = bassCutActive
      ? bassCutFilter
      : settings.eqEnabled
        ? eqBands[0]
        : trebleCutActive
          ? trebleCutFilter
          : finalNode;
    const firstPostDynamicsNode = noiseSuppressionActive ? preLimiter : firstPostNoiseNode;

    // Build the chain from dynamics -> bass cut -> EQ -> treble cut -> [limiter] -> output
    // Step 1: Determine dynamics output (where dynamics connects to)
    let dynamicsOutput;
    if (bassCutActive) {
      dynamicsOutput = firstPostDynamicsNode;
    } else if (settings.eqEnabled) {
      dynamicsOutput = firstPostDynamicsNode;
    } else if (trebleCutActive) {
      dynamicsOutput = firstPostDynamicsNode;
    } else {
      dynamicsOutput = firstPostDynamicsNode;
    }

    // Step 2: Connect dynamics stage
    if (settings.multibandEnabled) {
      multibandSum.connect(dynamicsOutput);
      multibandActive = true;
    } else if (settings.compressorEnabled) {
      compressor.connect(makeupGain);
      makeupGain.connect(dynamicsOutput);
      multibandActive = false;
    } else {
      multibandActive = false;
    }

    if (noiseSuppressionActive) {
      preLimiter.connect(noiseSuppressorNode);
      noiseSuppressorNode.connect(firstPostNoiseNode);
      noiseSuppressorNode.port.postMessage({ type: 'enable', enabled: true });
    } else {
      noiseSuppressorNode?.port.postMessage({ type: 'enable', enabled: false });
    }

    // Step 3: Determine entry point for sources before optional ducking.
    let entryNode;
    if (settings.multibandEnabled) {
      entryNode = null; // Special: sources connect to crossovers
    } else if (settings.compressorEnabled) {
      entryNode = compressor;
    } else if (noiseSuppressionActive) {
      entryNode = preLimiter;
    } else if (bassCutActive) {
      entryNode = bassCutFilter;
    } else if (settings.eqEnabled) {
      entryNode = eqBands[0];
    } else if (trebleCutActive) {
      entryNode = trebleCutFilter;
    } else {
      entryNode = finalNode;
    }

    const connectToEntry = (node) => {
      if (entryNode === null) {
        node.connect(crossover1.lowpass);
        node.connect(crossover1.highpass);
      } else {
        node.connect(entryNode);
      }
    };

    const duckingEnabled = settings.duckingEnabled;
    if (duckingEnabled) {
      duckingSidechainBP.connect(duckingAnalyser);
      duckLowShelf.connect(duckHighShelf);
      connectToEntry(duckHighShelf);
      startDucking();
    } else {
      stopDucking();
    }

    // Step 4: Connect bass cut -> next stage (EQ or treble cut or finalNode)
    if (bassCutActive) {
      if (settings.eqEnabled) {
        bassCutFilter.connect(eqBands[0]);
      } else if (trebleCutActive) {
        bassCutFilter.connect(trebleCutFilter);
      } else {
        bassCutFilter.connect(finalNode);
      }
    }

    // Step 5: Connect EQ -> next stage (treble cut or finalNode)
    if (settings.eqEnabled) {
      eqActive = true;
      if (trebleCutActive) {
        eqBands[4].connect(trebleCutFilter);
      } else {
        eqBands[4].connect(finalNode);
      }
    } else {
      eqActive = false;
    }

    // Step 6: Connect treble cut -> finalNode
    if (trebleCutActive) {
      trebleCutFilter.connect(finalNode);
    }

    // Connect all sources to the entry point (optionally through mono mixer and ducking).
    if (settings.monoMixEnabled) {
      connectedMedia.forEach(({ source }) => source.connect(monoMixer));
      if (duckingEnabled) {
        monoMixer.connect(duckingSidechainBP);
        monoMixer.connect(duckLowShelf);
      } else {
        connectToEntry(monoMixer);
      }
    } else {
      connectedMedia.forEach(({ source }) => {
        if (duckingEnabled) {
          source.connect(duckingSidechainBP);
          source.connect(duckLowShelf);
        } else {
          connectToEntry(source);
        }
      });
    }

    connectSourcesToTranscriber();

    // Handle noise
    noiseGain.gain.value = settings.effectsEnabled ? settings.noiseLevel : 0;

    // LUFS meter tap: outputGain → K-weighting → analyser (parallel, read-only)
    if (lufsPreFilter) {
      try { lufsPreFilter.disconnect(); } catch (e) {}
      try { lufsRlbFilter.disconnect(); } catch (e) {}
      outputGain.connect(lufsPreFilter);
      lufsPreFilter.connect(lufsRlbFilter);
      lufsRlbFilter.connect(lufsAnalyser);
    }
  }

  function applySettings() {
    if (!audioContext) return;

    // Global compressor
    compressor.threshold.value = settings.threshold;
    compressor.ratio.value = settings.ratio;
    compressor.knee.value = settings.knee;
    compressor.attack.value = settings.attack / 1000;
    compressor.release.value = settings.release / 1000;
    makeupGain.gain.value = settings.gainEnabled ? Math.pow(10, settings.makeupGain / 20) : 1;
    outputGain.gain.value = Math.pow(10, settings.outputGain / 20);

    // Multiband crossovers
    crossover1.lowpass.frequency.value = settings.crossover1;
    crossover1.highpass.frequency.value = settings.crossover1;
    crossover2.lowpass.frequency.value = settings.crossover2;
    crossover2.highpass.frequency.value = settings.crossover2;

    // Multiband per-band settings
    subBand.compressor.threshold.value = settings.subThreshold;
    subBand.compressor.ratio.value = settings.subRatio;
    subBand.gainNode.gain.value = Math.pow(10, settings.subGain / 20);
    midBand.compressor.threshold.value = settings.midThreshold;
    midBand.compressor.ratio.value = settings.midRatio;
    midBand.gainNode.gain.value = Math.pow(10, settings.midGain / 20);
    highBand.compressor.threshold.value = settings.highThreshold;
    highBand.compressor.ratio.value = settings.highRatio;
    highBand.gainNode.gain.value = Math.pow(10, settings.highGain / 20);

    // Apply shared settings to multiband
    [subBand, midBand, highBand].forEach(band => {
      band.compressor.knee.value = settings.knee;
      band.compressor.attack.value = settings.attack / 1000;
      band.compressor.release.value = settings.release / 1000;
    });

    // EQ bands
    for (let i = 1; i <= 5; i++) {
      const band = eqBands[i - 1];
      band.type = settings[`eq${i}Type`];
      band.frequency.value = settings[`eq${i}Freq`];
      band.gain.value = settings[`eq${i}Gain`];
      band.Q.value = settings[`eq${i}Q`];
    }

    // Bass/Treble cut filters
    bassCutFilter.frequency.value = Math.max(20, settings.bassCutFreq);
    trebleCutFilter.frequency.value = Math.min(22050, settings.trebleCutFreq);

    // Soft clipper drive
    if (softClipDriveGain && softClipCompGain) {
      const driveLinear = Math.pow(10, (settings.softClipDrive || 0) / 20);
      softClipDriveGain.gain.value = driveLinear;
      softClipCompGain.gain.value = 1 / driveLinear;
    }

    // Limiter
    if (limiter) {
      limiter.threshold.value = settings.limiterThreshold;
      limiter.attack.value = (settings.limiterAttack || 1) / 1000;
      limiter.release.value = (settings.limiterRelease || 100) / 1000;
    }

    configurePeakGuard();

    // Auto-gain
    agcTarget = settings.autoGainTarget;
    setAgcSpeed(settings.autoGainSpeed || 'normal');

    // Noise
    noiseGain.gain.value = (settings.enabled && settings.effectsEnabled) ? settings.noiseLevel : 0;
    if (settings.noiseType !== currentNoiseType) {
      changeNoiseType(settings.noiseType);
    }
  }

  function connectMedia(element) {
    if (!settings.enabled) return;
    if (!element || connectedMedia.has(element)) return;

    initAudio();
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    try {
      const source = audioContext.createMediaElementSource(element);
      connectedMedia.set(element, { source });

      // Connect based on current settings
      rebuildSignalChain();

      console.log('[Limitr Fallback] Connected media element');
    } catch (e) {
      if (e.name === 'InvalidStateError') {
        console.log('[Limitr Fallback] Element already connected elsewhere');
      } else {
        console.error('[Limitr Fallback] Connect failed:', e);
      }
    }
  }

  function scanMedia() {
    if (!settings.enabled) return;
    document.querySelectorAll('video, audio').forEach(connectMedia);
  }

  function observeDOM() {
    if (scanObserver) return;
    scanObserver = new MutationObserver(() => scanMedia());
    scanObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function stopScan() {
    if (scanObserver) {
      scanObserver.disconnect();
      scanObserver = null;
    }
    if (scanIntervalId) {
      clearInterval(scanIntervalId);
      scanIntervalId = null;
    }
    scanStarted = false;
  }

  // Message handler — works via bridge (window.postMessage) in MAIN world
  // and directly via chrome.runtime.onMessage in ISOLATED world
  function handleMessage(message, sendResponse) {
    if (message.action === 'fallback-update-settings') {
      const oldEq = settings.eqEnabled;
      const oldMultiband = settings.multibandEnabled;
      const oldCompressor = settings.compressorEnabled;
      const oldEnabled = settings.enabled;
      const oldBassCut = settings.bassCutFreq;
      const oldTrebleCut = settings.trebleCutFreq;
      const oldLimiter = settings.limiterEnabled;
      const oldFilters = settings.filtersEnabled;
      const oldSoftClip = settings.softClipEnabled;
      const oldPeakGuard = settings.peakGuardEnabled;
      const oldMonoMix = settings.monoMixEnabled;
      const oldNoiseSuppression = settings.noiseSuppressionEnabled;
      const oldAutoGain = settings.autoGainEnabled;
      const oldGate = settings.gateEnabled;
      const oldDucking = settings.duckingEnabled;

      settings = { ...settings, ...message.settings };

      if (settings.enabled) {
        startScan();
      } else {
        stopScan();
      }

      // Check if bass/treble cut routing needs to change (crossing the active threshold)
      const bassCutRoutingChanged = (settings.bassCutFreq > 20) !== (oldBassCut > 20);
      const trebleCutRoutingChanged = (settings.trebleCutFreq < 22050) !== (oldTrebleCut < 22050);

      // Check if routing needs rebuild
      const needsRebuild = (
        oldEq !== settings.eqEnabled ||
        oldMultiband !== settings.multibandEnabled ||
        oldCompressor !== settings.compressorEnabled ||
        oldEnabled !== settings.enabled ||
        oldLimiter !== settings.limiterEnabled ||
        oldFilters !== settings.filtersEnabled ||
        oldSoftClip !== settings.softClipEnabled ||
        oldPeakGuard !== settings.peakGuardEnabled ||
        oldMonoMix !== settings.monoMixEnabled ||
        oldNoiseSuppression !== settings.noiseSuppressionEnabled ||
        oldAutoGain !== settings.autoGainEnabled ||
        oldGate !== settings.gateEnabled ||
        oldDucking !== settings.duckingEnabled ||
        bassCutRoutingChanged || trebleCutRoutingChanged
      );

      if (needsRebuild) {
        rebuildSignalChain();
      }
      applySettings();

      saveToStorage({ limitrFallbackSettings: settings });
      sendResponse({ success: true });
    } else if (message.action === 'fallback-get-reduction') {
      let reduction = 0;
      if (multibandActive && subBand && midBand && highBand) {
        reduction = Math.min(
          subBand.compressor.reduction,
          midBand.compressor.reduction,
          highBand.compressor.reduction
        );
      } else if (compressor) {
        reduction = compressor.reduction;
      }
      sendResponse({ reduction });
    } else if (message.action === 'fallback-get-multiband-reduction') {
      if (subBand && midBand && highBand) {
        sendResponse({
          reduction: {
            sub: subBand.compressor.reduction,
            mid: midBand.compressor.reduction,
            high: highBand.compressor.reduction
          }
        });
      } else {
        sendResponse({ reduction: { sub: 0, mid: 0, high: 0 } });
      }
    } else if (message.action === 'fallback-get-lufs') {
      let lufs = -Infinity;
      if (lufsAnalyser && lufsAnalyserBuffer) {
        lufsAnalyser.getFloatTimeDomainData(lufsAnalyserBuffer);
        let sumSquares = 0;
        for (let i = 0; i < lufsAnalyserBuffer.length; i++) {
          sumSquares += lufsAnalyserBuffer[i] * lufsAnalyserBuffer[i];
        }
        const meanSquare = sumSquares / lufsAnalyserBuffer.length;
        if (meanSquare > 0) {
          lufs = -0.691 + 10 * Math.log10(meanSquare);
        }
      }
      sendResponse({ lufs });
    } else if (message.action === 'fallback-start-transcription') {
      startRegularTranscription(message.tabId)
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    } else if (message.action === 'fallback-stop-transcription') {
      stopRegularTranscription(message.tabId)
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    } else if (message.action === 'fallback-get-transcription-status') {
      requestBridgeAction('limitr-bridge-transcriber-status', { tabId: message.tabId })
        .then(response => sendResponse(response))
        .catch(() => sendResponse({ active: false, ready: false, loading: false }));
      return true;
    } else if (message.action === 'fallback-ping') {
      sendResponse({ active: true, mediaCount: connectedMedia.size, settings });
    }
  }

  // Storage helper — uses chrome.storage in ISOLATED world, bridge in MAIN world
  function saveToStorage(data) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(data);
    } else {
      window.postMessage({ type: 'limitr-bridge-storage-set', data }, '*');
    }
  }

  // Register both ISOLATED (chrome.runtime) and MAIN world (window.postMessage) listeners
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message, sendResponse);
      return true;
    });
  }

  // MAIN world bridge listener
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'limitr-bridge-request') {
      handleMessage(event.data.payload, (response) => {
        window.postMessage({
          type: 'limitr-bridge-response',
          id: event.data.id,
          payload: response
        }, '*');
      });
    }
  });

  // Load saved settings and init
  let initResolved = false;

  function applyStoredSettings(stored) {
    if (initResolved) return;
    initResolved = true;
    try {
      settings = {
        ...settings,
        ...(stored.limitrFallbackSettings || {}),
        ...(stored.limitrCurrentSettings || {})
      };
      if (stored.limitrGlobalEnabled !== undefined) {
        settings.enabled = stored.limitrGlobalEnabled;
      }
    } catch (e) {
      console.log('[Limitr Fallback] Could not load saved settings');
    }
    if (settings.enabled) {
      startScan();
    } else {
      console.log('[Limitr Fallback] Content script loaded inactive (extension disabled)');
    }
  }

  function startScan() {
    if (scanStarted) return;
    scanStarted = true;

    const beginScan = () => {
      if (!settings.enabled) {
        scanStarted = false;
        return;
      }
      scanMedia();
      observeDOM();
      if (!scanIntervalId) {
        scanIntervalId = setInterval(scanMedia, 2000);
      }
      console.log('[Limitr Fallback] Content script loaded (MAIN world) - EQ + Multiband + Limiter + fullscreen compatible');
    };

    if (document.body) {
      beginScan();
    } else {
      document.addEventListener('DOMContentLoaded', beginScan, { once: true });
    }
  }

  async function init() {
    // Try chrome.storage first (ISOLATED world)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const stored = await chrome.storage.local.get(['limitrFallbackSettings', 'limitrCurrentSettings', 'limitrGlobalEnabled']);
        applyStoredSettings(stored);
        return;
      } catch (e) {
        // Not in isolated world or storage unavailable
      }
    }

    // MAIN world: wait for bridge to send stored settings
    window.addEventListener('message', function onBridgeInit(event) {
      if (event.data && event.data.type === 'limitr-bridge-init') {
        window.removeEventListener('message', onBridgeInit);
        applyStoredSettings(event.data.stored || {});
      }
    });

    // Fallback: if bridge doesn't respond in 500ms, start with defaults
    setTimeout(() => {
      if (!initResolved) {
        applyStoredSettings({});
      }
    }, 500);
  }

  init();
})();
