// Offscreen document for audio processing
// Stores per-tab audio state and processes streams

// Per-tab audio state
const tabAudioState = new Map();

// Shared noise data cache (raw Float32Array) - generated once, reused across all tabs
const noiseDataCache = {
  white: null,
  pink: null,
  brown: null
};
const NOISE_BUFFER_SECONDS = 2;

// Default settings (must match popup.js and background.js)
const defaultSettings = {
  enabled: true,
  outputGain: 0,

  // === GLOBAL COMPRESSOR (single-band dynamics) ===
  compressorEnabled: true,
  threshold: -24,
  ratio: 8,
  knee: 12,
  attack: 5,      // ms
  release: 100,   // ms
  makeupGain: 0,

  // === 3-BAND MULTIBAND COMPRESSOR (frequency-specific dynamics) ===
  multibandEnabled: false,
  crossover1: 200,      // Sub/Mid boundary (Hz)
  crossover2: 3000,     // Mid/High boundary (Hz)
  // Sub band (20-200Hz)
  subThreshold: -20,
  subRatio: 8,
  subGain: 0,
  // Mid band (200-3000Hz)
  midThreshold: -24,
  midRatio: 4,
  midGain: 0,
  // High band (3000-20000Hz)
  highThreshold: -24,
  highRatio: 6,
  highGain: 0,

  // === 5-BAND PARAMETRIC EQ (tonal shaping) ===
  eqEnabled: false,
  // Band 1
  eq1Freq: 80,
  eq1Gain: 0,
  eq1Q: 0.7,
  eq1Type: 'highpass',
  // Band 2
  eq2Freq: 250,
  eq2Gain: 0,
  eq2Q: 1.0,
  eq2Type: 'peaking',
  // Band 3
  eq3Freq: 1000,
  eq3Gain: 0,
  eq3Q: 1.0,
  eq3Type: 'peaking',
  // Band 4
  eq4Freq: 4000,
  eq4Gain: 0,
  eq4Q: 1.0,
  eq4Type: 'peaking',
  // Band 5
  eq5Freq: 12000,
  eq5Gain: 0,
  eq5Q: 0.7,
  eq5Type: 'highshelf',

  // === FILTERS (independent bass/treble cut) ===
  bassCutFreq: 0,        // Highpass: 0 = off, otherwise Hz (e.g., 80, 120, 200)
  trebleCutFreq: 22050,  // Lowpass: 22050 = off, otherwise Hz (e.g., 8000, 12000)

  // === AI NOISE SUPPRESSION (RNNoise) ===
  noiseSuppressionEnabled: false,

  // === LIMITER (brick wall, prevents clipping) ===
  limiterEnabled: true,
  limiterThreshold: -1,  // dB ceiling

  // === AUTO-GAIN (AGC - automatic level control) ===
  autoGainEnabled: false,
  autoGainTarget: -16,   // Target level in dB (RMS)

  // === EFFECTS ===
  noiseLevel: 0,
  noiseType: 'brown'
};

// Generate noise data (raw samples) - cached globally
function generateNoiseData(sampleRate, noiseType) {
  const bufferSize = sampleRate * NOISE_BUFFER_SECONDS;
  const data = new Float32Array(bufferSize);

  if (noiseType === 'white') {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (noiseType === 'pink') {
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

function getCachedNoiseData(sampleRate, noiseType) {
  if (!noiseDataCache[noiseType]) {
    console.log(`[Limitr] Generating ${noiseType} noise buffer`);
    noiseDataCache[noiseType] = generateNoiseData(sampleRate, noiseType);
  }
  return noiseDataCache[noiseType];
}

function createNoiseBuffer(audioContext, noiseType = 'brown') {
  const cachedData = getCachedNoiseData(audioContext.sampleRate, noiseType);
  const buffer = audioContext.createBuffer(1, cachedData.length, audioContext.sampleRate);
  buffer.getChannelData(0).set(cachedData);
  return buffer;
}

// Create a crossover filter pair for multiband
function createCrossoverPair(audioContext, frequency) {
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

// Create a per-band compressor with gain stage
function createBandProcessor(audioContext, threshold, ratio, knee, attack, release, gain) {
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = threshold;
  compressor.ratio.value = ratio;
  compressor.knee.value = knee;
  compressor.attack.value = attack / 1000;
  compressor.release.value = release / 1000;

  const gainNode = audioContext.createGain();
  gainNode.gain.value = Math.pow(10, gain / 20);

  compressor.connect(gainNode);
  return { compressor, gainNode };
}

// Create audio processing chain for a tab
async function createAudioChain(tabId, mediaStreamId) {
  if (tabAudioState.has(tabId)) {
    return tabAudioState.get(tabId);
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: mediaStreamId
        }
      }
    });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);

    // === GLOBAL COMPRESSOR ===
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = defaultSettings.threshold;
    compressor.ratio.value = defaultSettings.ratio;
    compressor.knee.value = defaultSettings.knee;
    compressor.attack.value = defaultSettings.attack / 1000;
    compressor.release.value = defaultSettings.release / 1000;

    const makeupGain = audioContext.createGain();
    makeupGain.gain.value = Math.pow(10, defaultSettings.makeupGain / 20);

    // === 3-BAND MULTIBAND COMPRESSOR ===
    const crossover1 = createCrossoverPair(audioContext, defaultSettings.crossover1);
    const crossover2 = createCrossoverPair(audioContext, defaultSettings.crossover2);

    const subBand = createBandProcessor(audioContext,
      defaultSettings.subThreshold, defaultSettings.subRatio, defaultSettings.knee,
      defaultSettings.attack, defaultSettings.release, defaultSettings.subGain);

    const midBand = createBandProcessor(audioContext,
      defaultSettings.midThreshold, defaultSettings.midRatio, defaultSettings.knee,
      defaultSettings.attack, defaultSettings.release, defaultSettings.midGain);

    const highBand = createBandProcessor(audioContext,
      defaultSettings.highThreshold, defaultSettings.highRatio, defaultSettings.knee,
      defaultSettings.attack, defaultSettings.release, defaultSettings.highGain);

    const multibandSum = audioContext.createGain();
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

    // === 5-BAND PARAMETRIC EQ ===
    const eqBands = [];
    for (let i = 1; i <= 5; i++) {
      const band = audioContext.createBiquadFilter();
      band.type = defaultSettings[`eq${i}Type`];
      band.frequency.value = defaultSettings[`eq${i}Freq`];
      band.gain.value = defaultSettings[`eq${i}Gain`];
      band.Q.value = defaultSettings[`eq${i}Q`];
      eqBands.push(band);
    }
    // Connect EQ bands in series
    for (let i = 0; i < 4; i++) {
      eqBands[i].connect(eqBands[i + 1]);
    }

    // === BASS CUT / TREBLE CUT FILTERS ===
    const bassCutFilter = audioContext.createBiquadFilter();
    bassCutFilter.type = 'highpass';
    bassCutFilter.frequency.value = defaultSettings.bassCutFreq || 20;
    bassCutFilter.Q.value = 0.707; // Butterworth response

    const trebleCutFilter = audioContext.createBiquadFilter();
    trebleCutFilter.type = 'lowpass';
    trebleCutFilter.frequency.value = defaultSettings.trebleCutFreq || 22050;
    trebleCutFilter.Q.value = 0.707;

    // === LIMITER (brick wall, prevents clipping) ===
    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.value = defaultSettings.limiterThreshold;
    limiter.ratio.value = 20;        // Very high ratio = limiting
    limiter.knee.value = 0;          // Hard knee for true limiting
    limiter.attack.value = 0.001;    // 1ms - very fast attack
    limiter.release.value = 0.1;     // 100ms release

    // === PRE-RNNOISE SAFETY LIMITER (protects noise suppressor from loud transients) ===
    const preLimiter = audioContext.createDynamicsCompressor();
    preLimiter.threshold.value = -1;     // -1dB ceiling
    preLimiter.ratio.value = 20;         // Hard limiting
    preLimiter.knee.value = 0;
    preLimiter.attack.value = 0.001;     // 1ms
    preLimiter.release.value = 0.1;      // 100ms

    // === AUTO-GAIN (AGC) ===
    const autoGainNode = audioContext.createGain();
    autoGainNode.gain.value = 1;

    // Analyser for measuring levels (used by AGC)
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const analyserBuffer = new Float32Array(analyser.fftSize);

    // AGC state
    let agcEnabled = defaultSettings.autoGainEnabled;
    let agcTarget = defaultSettings.autoGainTarget;
    let agcCurrentGain = 1;
    let agcIntervalId = null;

    // AGC measurement and adjustment function
    const updateAutoGain = () => {
      if (!agcEnabled) return;

      analyser.getFloatTimeDomainData(analyserBuffer);

      // Calculate RMS (root mean square)
      let sumSquares = 0;
      for (let i = 0; i < analyserBuffer.length; i++) {
        sumSquares += analyserBuffer[i] * analyserBuffer[i];
      }
      const rms = Math.sqrt(sumSquares / analyserBuffer.length);

      // Convert to dB
      const currentDb = rms > 0 ? 20 * Math.log10(rms) : -100;

      // Only adjust if we have meaningful audio (not silence)
      if (currentDb > -60) {
        // Calculate needed gain adjustment
        const targetDb = agcTarget;
        const diffDb = targetDb - currentDb;

        // Convert to linear gain
        const targetGain = Math.pow(10, diffDb / 20);

        // Smooth the gain change (slower attack, faster release)
        const smoothing = targetGain > agcCurrentGain ? 0.05 : 0.1;
        agcCurrentGain = agcCurrentGain + (targetGain - agcCurrentGain) * smoothing;

        // Clamp gain to reasonable range (0.1x to 10x = -20dB to +20dB)
        agcCurrentGain = Math.max(0.1, Math.min(10, agcCurrentGain));

        autoGainNode.gain.setTargetAtTime(agcCurrentGain, audioContext.currentTime, 0.1);
      }
    };

    // Start AGC interval
    const startAgc = () => {
      if (agcIntervalId) return;
      agcIntervalId = setInterval(updateAutoGain, 50); // 20Hz update rate
    };

    const stopAgc = () => {
      if (agcIntervalId) {
        clearInterval(agcIntervalId);
        agcIntervalId = null;
      }
      // Reset gain to unity
      agcCurrentGain = 1;
      autoGainNode.gain.setTargetAtTime(1, audioContext.currentTime, 0.1);
    };

    // === AI NOISE SUPPRESSION (RNNoise) ===
    // Will be initialized asynchronously
    let noiseSuppressorNode = null;
    let noiseSuppressorReady = false;

    const initNoiseSuppressor = async () => {
      console.log('[Limitr] Starting noise suppressor initialization...');
      try {
        // Load the AudioWorklet module
        const workletUrl = chrome.runtime.getURL('lib/noise-suppressor-worklet.js');
        console.log('[Limitr] Loading worklet from:', workletUrl);
        await audioContext.audioWorklet.addModule(workletUrl);
        console.log('[Limitr] Worklet module loaded');

        // Create the AudioWorkletNode
        noiseSuppressorNode = new AudioWorkletNode(audioContext, 'noise-suppressor-processor');
        console.log('[Limitr] AudioWorkletNode created');

        // Set up message handler IMMEDIATELY after creating node (before any async work)
        noiseSuppressorNode.port.onmessage = (event) => {
          if (event.data.type === 'initialized') {
            noiseSuppressorReady = true;
            console.log('[Limitr] RNNoise noise suppressor ready');
            // Rebuild signal chain if noise suppression is enabled
            const currentState = tabAudioState.get(tabId);
            if (currentState && currentState.settings.noiseSuppressionEnabled) {
              rebuildSignalChain(currentState);
            }
          } else if (event.data.type === 'error') {
            console.error('[Limitr] Noise suppressor error:', event.data.error);
          }
        };

        // Load and compile WASM in main thread (avoids CSP issues in worklet)
        const wasmUrl = chrome.runtime.getURL('lib/rnnoise.wasm');
        console.log('[Limitr] Loading WASM from:', wasmUrl);
        const wasmResponse = await fetch(wasmUrl);
        if (!wasmResponse.ok) {
          throw new Error(`WASM fetch failed: ${wasmResponse.status}`);
        }
        const wasmBinary = await wasmResponse.arrayBuffer();
        console.log('[Limitr] WASM loaded, size:', wasmBinary.byteLength);

        // Send WASM binary to worklet (ArrayBuffer can be transferred)
        // Worklet will compile it - CSP with wasm-unsafe-eval should allow this
        // The worklet will compile it - CSP should now allow this with wasm-unsafe-eval
        console.log('[Limitr] Sending WASM binary to worklet...');
        noiseSuppressorNode.port.postMessage({
          type: 'wasm-binary',
          binary: wasmBinary
        }, [wasmBinary]); // Transfer the ArrayBuffer for efficiency

        console.log('[Limitr] Noise suppressor worklet loaded, waiting for WASM init...');
      } catch (error) {
        console.error('[Limitr] Failed to initialize noise suppressor:', error);
      }
    };

    // Start async initialization (don't await - let it complete in background)
    console.log('[Limitr] Scheduling noise suppressor init...');
    initNoiseSuppressor();

    // === OUTPUT ===
    const outputGain = audioContext.createGain();
    outputGain.gain.value = Math.pow(10, defaultSettings.outputGain / 20);

    // === NOISE ===
    const noiseBuffer = createNoiseBuffer(audioContext, defaultSettings.noiseType);
    let noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseGain = audioContext.createGain();
    noiseGain.gain.value = defaultSettings.noiseLevel;

    noiseSource.connect(noiseGain);
    noiseGain.connect(outputGain);
    noiseSource.start();

    const changeNoiseType = (newType) => {
      const newBuffer = createNoiseBuffer(audioContext, newType);
      const newNoiseSource = audioContext.createBufferSource();
      newNoiseSource.buffer = newBuffer;
      newNoiseSource.loop = true;
      noiseSource.stop();
      noiseSource.disconnect();
      newNoiseSource.connect(noiseGain);
      newNoiseSource.start();
      noiseSource = newNoiseSource;
    };

    // === DESTINATION ===
    const destination = audioContext.createMediaStreamDestination();
    outputGain.connect(destination);
    outputGain.connect(audioContext.destination);

    // Default signal chain: source -> compressor -> makeupGain -> outputGain
    source.connect(compressor);
    compressor.connect(makeupGain);
    makeupGain.connect(outputGain);

    const state = {
      tabId,
      audioContext,
      source,
      stream,
      // Global compressor
      compressor,
      makeupGain,
      outputGain,
      // 3-band multiband
      crossover1,
      crossover2,
      subBand,
      midBand,
      highBand,
      multibandSum,
      multibandActive: false,
      // 5-band EQ
      eqBands,
      eqActive: false,
      // Bass/Treble cut filters
      bassCutFilter,
      trebleCutFilter,
      // Limiter
      limiter,
      preLimiter,
      // Auto-gain (AGC)
      autoGainNode,
      analyser,
      setAgcEnabled: (enabled) => {
        agcEnabled = enabled;
        if (enabled) {
          startAgc();
        } else {
          stopAgc();
        }
      },
      setAgcTarget: (target) => {
        agcTarget = target;
      },
      // Noise suppression
      getNoiseSuppressor: () => ({ node: noiseSuppressorNode, ready: noiseSuppressorReady }),
      setNoiseSuppressorEnabled: (enabled) => {
        if (noiseSuppressorNode) {
          noiseSuppressorNode.port.postMessage({ type: 'enable', enabled });
        }
      },
      // Noise
      noiseSource,
      noiseGain,
      changeNoiseType,
      // Output
      destination,
      settings: { ...defaultSettings },
      enabled: true
    };

    tabAudioState.set(tabId, state);
    startReductionMonitoring(tabId);
    return state;
  } catch (error) {
    console.error('Failed to create audio chain:', error);
    throw error;
  }
}

// Rebuild the signal chain based on current settings
function rebuildSignalChain(state) {
  const { source, compressor, makeupGain, outputGain,
          crossover1, multibandSum, eqBands, bassCutFilter, trebleCutFilter,
          limiter, preLimiter, autoGainNode, analyser, setAgcEnabled,
          getNoiseSuppressor, setNoiseSuppressorEnabled, settings } = state;

  // Get noise suppressor state
  const { node: noiseSuppressorNode, ready: noiseSuppressorReady } = getNoiseSuppressor();

  // Disconnect everything
  source.disconnect();
  if (noiseSuppressorNode) {
    try { noiseSuppressorNode.disconnect(); } catch (e) {}
  }
  bassCutFilter.disconnect();
  compressor.disconnect();
  makeupGain.disconnect();
  multibandSum.disconnect();
  eqBands[4].disconnect();
  trebleCutFilter.disconnect();
  autoGainNode.disconnect();
  analyser.disconnect();
  limiter.disconnect();
  preLimiter.disconnect();

  // If disabled, bypass all processing
  if (!settings.enabled) {
    source.connect(outputGain);
    state.eqActive = false;
    state.multibandActive = false;
    if (noiseSuppressorNode) setNoiseSuppressorEnabled(false);
    setAgcEnabled(false);
    console.log('[Limitr] Signal chain: BYPASSED (disabled)');
    return;
  }

  // Signal chain: source -> [Dynamics] -> [PreLimiter*] -> [NoiseSuppression] -> [BassCut] -> [EQ] -> [TrebleCut] -> [AutoGain] -> [Limiter] -> outputGain
  // *PreLimiter is a fixed safety limiter, only active when noise suppression is on (protects RNNoise from loud transients)
  // Limiter is the user-controllable output limiter at the end (prevents clipping from EQ/AGC boosts)
  let currentNode = source;

  // Dynamics stage FIRST (compressor tames loud peaks before noise suppression)
  if (settings.multibandEnabled) {
    currentNode.connect(crossover1.lowpass);
    currentNode.connect(crossover1.highpass);
    currentNode = multibandSum;
    state.multibandActive = true;
  } else if (settings.compressorEnabled) {
    currentNode.connect(compressor);
    compressor.connect(makeupGain);
    currentNode = makeupGain;
    state.multibandActive = false;
  } else {
    state.multibandActive = false;
  }

  // Pre-RNNoise safety limiter (fixed, not user-controllable) - only when noise suppression is active
  const noiseSuppressionActive = settings.noiseSuppressionEnabled && noiseSuppressorReady && noiseSuppressorNode;
  if (noiseSuppressionActive) {
    currentNode.connect(preLimiter);
    currentNode = preLimiter;
  }

  // Noise suppression (AI denoise) - after dynamics+preLimiter so it receives controlled signal
  if (noiseSuppressionActive) {
    currentNode.connect(noiseSuppressorNode);
    currentNode = noiseSuppressorNode;
    setNoiseSuppressorEnabled(true);
  } else if (noiseSuppressorNode) {
    setNoiseSuppressorEnabled(false);
  }

  // Bass cut filter (highpass) - active when freq > 20Hz
  const bassCutActive = settings.bassCutFreq > 20;
  if (bassCutActive) {
    currentNode.connect(bassCutFilter);
    currentNode = bassCutFilter;
  }

  // EQ stage (5 bands in series)
  if (settings.eqEnabled) {
    currentNode.connect(eqBands[0]);
    currentNode = eqBands[4]; // Last EQ band
    state.eqActive = true;
  } else {
    state.eqActive = false;
  }

  // Treble cut filter (lowpass) - active when freq < 20kHz
  if (settings.trebleCutFreq < 20000) {
    currentNode.connect(trebleCutFilter);
    currentNode = trebleCutFilter;
  }

  // Auto-Gain (AGC) - measures and adjusts level
  if (settings.autoGainEnabled) {
    currentNode.connect(analyser);      // Analyser for measurement (parallel)
    currentNode.connect(autoGainNode);  // Gain adjustment
    currentNode = autoGainNode;
    setAgcEnabled(true);
  } else {
    setAgcEnabled(false);
  }

  // Limiter (user-controllable, brick wall output limiter - prevents clipping from EQ/AGC boosts)
  if (settings.limiterEnabled) {
    currentNode.connect(limiter);
    currentNode = limiter;
  }

  // Final output
  currentNode.connect(outputGain);

  console.log(`[Limitr] Signal chain: Dynamics=${settings.multibandEnabled ? 'multiband' : settings.compressorEnabled ? 'compressor' : 'off'} -> PreLimiter=${noiseSuppressionActive ? '-1dB' : 'off'} -> NoiseSuppression=${noiseSuppressionActive ? 'on' : 'off'} -> BassCut=${bassCutActive ? settings.bassCutFreq + 'Hz' : 'off'} -> EQ=${settings.eqEnabled} -> TrebleCut=${settings.trebleCutFreq < 20000 ? settings.trebleCutFreq + 'Hz' : 'off'} -> AutoGain=${settings.autoGainEnabled ? settings.autoGainTarget + 'dB' : 'off'} -> Limiter=${settings.limiterEnabled ? settings.limiterThreshold + 'dB' : 'off'}`);
}

// Update settings for a tab
function updateSettings(tabId, newSettings) {
  const state = tabAudioState.get(tabId);
  if (!state) return false;

  const { compressor, makeupGain, outputGain, noiseGain,
          crossover1, crossover2, subBand, midBand, highBand, eqBands,
          bassCutFilter, trebleCutFilter, limiter, setAgcTarget } = state;

  const oldNoiseType = state.settings.noiseType;
  const oldBassCut = state.settings.bassCutFreq;
  const oldTrebleCut = state.settings.trebleCutFreq;

  // Check if bass/treble cut routing needs to change (crossing the active threshold)
  const bassCutRoutingChanged = newSettings.bassCutFreq !== undefined &&
    ((newSettings.bassCutFreq > 20) !== (oldBassCut > 20));
  const trebleCutRoutingChanged = newSettings.trebleCutFreq !== undefined &&
    ((newSettings.trebleCutFreq < 20000) !== (oldTrebleCut < 20000));

  const needsRebuild = (
    newSettings.eqEnabled !== undefined && newSettings.eqEnabled !== state.settings.eqEnabled ||
    newSettings.multibandEnabled !== undefined && newSettings.multibandEnabled !== state.settings.multibandEnabled ||
    newSettings.compressorEnabled !== undefined && newSettings.compressorEnabled !== state.settings.compressorEnabled ||
    newSettings.noiseSuppressionEnabled !== undefined && newSettings.noiseSuppressionEnabled !== state.settings.noiseSuppressionEnabled ||
    newSettings.limiterEnabled !== undefined && newSettings.limiterEnabled !== state.settings.limiterEnabled ||
    newSettings.autoGainEnabled !== undefined && newSettings.autoGainEnabled !== state.settings.autoGainEnabled ||
    bassCutRoutingChanged || trebleCutRoutingChanged
  );

  Object.assign(state.settings, newSettings);
  const s = state.settings;

  // Rebuild signal chain if routing changed
  if (needsRebuild) {
    rebuildSignalChain(state);
  }

  // Global compressor settings
  if (newSettings.threshold !== undefined) compressor.threshold.value = s.threshold;
  if (newSettings.ratio !== undefined) compressor.ratio.value = s.ratio;
  if (newSettings.knee !== undefined) compressor.knee.value = s.knee;
  if (newSettings.attack !== undefined) compressor.attack.value = s.attack / 1000;
  if (newSettings.release !== undefined) compressor.release.value = s.release / 1000;
  if (newSettings.makeupGain !== undefined) makeupGain.gain.value = Math.pow(10, s.makeupGain / 20);
  if (newSettings.outputGain !== undefined) outputGain.gain.value = Math.pow(10, s.outputGain / 20);

  // Multiband crossovers
  if (newSettings.crossover1 !== undefined) {
    crossover1.lowpass.frequency.value = s.crossover1;
    crossover1.highpass.frequency.value = s.crossover1;
  }
  if (newSettings.crossover2 !== undefined) {
    crossover2.lowpass.frequency.value = s.crossover2;
    crossover2.highpass.frequency.value = s.crossover2;
  }

  // Multiband per-band settings
  if (newSettings.subThreshold !== undefined) subBand.compressor.threshold.value = s.subThreshold;
  if (newSettings.subRatio !== undefined) subBand.compressor.ratio.value = s.subRatio;
  if (newSettings.subGain !== undefined) subBand.gainNode.gain.value = Math.pow(10, s.subGain / 20);
  if (newSettings.midThreshold !== undefined) midBand.compressor.threshold.value = s.midThreshold;
  if (newSettings.midRatio !== undefined) midBand.compressor.ratio.value = s.midRatio;
  if (newSettings.midGain !== undefined) midBand.gainNode.gain.value = Math.pow(10, s.midGain / 20);
  if (newSettings.highThreshold !== undefined) highBand.compressor.threshold.value = s.highThreshold;
  if (newSettings.highRatio !== undefined) highBand.compressor.ratio.value = s.highRatio;
  if (newSettings.highGain !== undefined) highBand.gainNode.gain.value = Math.pow(10, s.highGain / 20);

  // Apply shared settings to multiband compressors
  if (newSettings.knee !== undefined || newSettings.attack !== undefined || newSettings.release !== undefined) {
    [subBand, midBand, highBand].forEach(band => {
      band.compressor.knee.value = s.knee;
      band.compressor.attack.value = s.attack / 1000;
      band.compressor.release.value = s.release / 1000;
    });
  }

  // EQ band settings
  for (let i = 1; i <= 5; i++) {
    const band = eqBands[i - 1];
    if (newSettings[`eq${i}Freq`] !== undefined) band.frequency.value = s[`eq${i}Freq`];
    if (newSettings[`eq${i}Gain`] !== undefined) band.gain.value = s[`eq${i}Gain`];
    if (newSettings[`eq${i}Q`] !== undefined) band.Q.value = s[`eq${i}Q`];
    if (newSettings[`eq${i}Type`] !== undefined) band.type = s[`eq${i}Type`];
  }

  // Bass/Treble cut filters
  if (newSettings.bassCutFreq !== undefined) {
    bassCutFilter.frequency.value = Math.max(20, s.bassCutFreq);
  }
  if (newSettings.trebleCutFreq !== undefined) {
    trebleCutFilter.frequency.value = Math.min(22050, s.trebleCutFreq);
  }

  // Limiter
  if (newSettings.limiterThreshold !== undefined) {
    limiter.threshold.value = s.limiterThreshold;
  }

  // Auto-Gain
  if (newSettings.autoGainTarget !== undefined) {
    setAgcTarget(s.autoGainTarget);
  }

  // Noise
  if (newSettings.noiseLevel !== undefined) noiseGain.gain.value = s.noiseLevel;
  if (newSettings.noiseType !== undefined && newSettings.noiseType !== oldNoiseType) {
    state.changeNoiseType(newSettings.noiseType);
  }

  return true;
}

// Enable/disable processing
function setEnabled(tabId, enabled) {
  const state = tabAudioState.get(tabId);
  if (!state) return false;

  state.enabled = enabled;
  state.settings.enabled = enabled;

  const { source, outputGain, noiseGain } = state;

  if (enabled) {
    rebuildSignalChain(state);
    noiseGain.gain.value = state.settings.noiseLevel;
  } else {
    // Bypass: direct to output
    source.disconnect();
    source.connect(outputGain);
    noiseGain.gain.value = 0;
  }

  return true;
}

function getState(tabId) {
  const state = tabAudioState.get(tabId);
  if (!state) return null;

  return {
    tabId,
    enabled: state.enabled,
    settings: { ...state.settings },
    reduction: state.compressor.reduction
  };
}

function getReduction(tabId) {
  const state = tabAudioState.get(tabId);
  if (!state) return 0;

  if (state.multibandActive) {
    return Math.min(
      state.subBand.compressor.reduction,
      state.midBand.compressor.reduction,
      state.highBand.compressor.reduction
    );
  }
  return state.compressor.reduction;
}

function getMultibandReduction(tabId) {
  const state = tabAudioState.get(tabId);
  if (!state) return { sub: 0, mid: 0, high: 0 };

  return {
    sub: state.subBand.compressor.reduction,
    mid: state.midBand.compressor.reduction,
    high: state.highBand.compressor.reduction
  };
}

function cleanupTab(tabId) {
  const state = tabAudioState.get(tabId);
  if (!state) return;

  if (state.noiseSource) state.noiseSource.stop();
  state.stream.getTracks().forEach(track => track.stop());
  state.audioContext.close();
  tabAudioState.delete(tabId);
}

function startReductionMonitoring(tabId) {
  const interval = setInterval(() => {
    const state = tabAudioState.get(tabId);
    if (!state) {
      clearInterval(interval);
      return;
    }

    // Report the appropriate reduction based on active processing mode
    let reduction;
    if (state.multibandActive) {
      // Use minimum (most negative) of all band reductions
      reduction = Math.min(
        state.subBand.compressor.reduction,
        state.midBand.compressor.reduction,
        state.highBand.compressor.reduction
      );
    } else {
      reduction = state.compressor.reduction;
    }

    chrome.runtime.sendMessage({
      action: 'reduction-update',
      tabId,
      reduction
    }).catch(() => {});
  }, 50);
}

function hasAudioState(tabId) {
  return tabAudioState.has(tabId);
}

function getActiveTabIds() {
  return Array.from(tabAudioState.keys());
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  switch (message.action) {
    case 'init-audio': {
      createAudioChain(message.tabId, message.mediaStreamId)
        .then(state => sendResponse({ success: true, settings: state.settings }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'update-settings': {
      const success = updateSettings(message.tabId, message.settings);
      sendResponse({ success });
      break;
    }

    case 'set-enabled': {
      const success = setEnabled(message.tabId, message.enabled);
      sendResponse({ success });
      break;
    }

    case 'get-state': {
      const state = getState(message.tabId);
      sendResponse({ success: !!state, state });
      break;
    }

    case 'get-reduction': {
      sendResponse({ reduction: getReduction(message.tabId) });
      break;
    }

    case 'get-multiband-reduction': {
      sendResponse({ reduction: getMultibandReduction(message.tabId) });
      break;
    }

    case 'has-audio': {
      sendResponse({ hasAudio: hasAudioState(message.tabId) });
      break;
    }

    case 'cleanup-tab': {
      cleanupTab(message.tabId);
      sendResponse({ success: true });
      break;
    }

    case 'get-active-tabs': {
      sendResponse({ tabIds: getActiveTabIds() });
      break;
    }

    case 'set-volume': {
      const state = tabAudioState.get(message.tabId);
      if (state) {
        state.outputGain.gain.value = Math.pow(10, message.volume / 20);
        state.settings.outputGain = message.volume;
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
      break;
    }

    case 'get-all-volumes': {
      const volumes = {};
      for (const [tabId, state] of tabAudioState) {
        const linearGain = state.outputGain.gain.value;
        volumes[tabId] = Math.round(linearGain > 0 ? 20 * Math.log10(linearGain) : -60);
      }
      sendResponse({ volumes });
      break;
    }
  }
});

console.log('Limitr offscreen document loaded');
