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

  const connectedMedia = new Map();
  let currentNoiseType = 'brown';

  let settings = {
    enabled: true,
    outputGain: 0,

    // Global compressor
    compressorEnabled: true,
    threshold: -24,
    ratio: 8,
    knee: 12,
    attack: 5,
    release: 100,
    makeupGain: 0,

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

    // AI Noise Suppression (not supported in fallback mode - requires AudioWorklet)
    noiseSuppressionEnabled: false,

    // Limiter (not fully supported in fallback mode)
    limiterEnabled: true,
    limiterThreshold: -1,

    // Auto-Gain (not supported in fallback mode - requires AudioWorklet)
    autoGainEnabled: false,
    autoGainTarget: -16,

    // Effects
    noiseLevel: 0,
    noiseType: 'brown'
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

      console.log('[Limitr Fallback] Audio chain initialized with EQ + Multiband support');
    } catch (e) {
      console.error('[Limitr Fallback] Init failed:', e);
    }
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
  // Chain: Source → [Bass Cut] → [EQ] → [Dynamics] → [Treble Cut] → Output
  function rebuildSignalChain() {
    if (!audioContext) return;

    // Disconnect all sources from their current routing
    connectedMedia.forEach(({ source }) => {
      try { source.disconnect(); } catch (e) {}
    });

    // Disconnect shared processing nodes
    try { bassCutFilter.disconnect(); } catch (e) {}
    try { compressor.disconnect(); } catch (e) {}
    try { makeupGain.disconnect(); } catch (e) {}
    try { multibandSum.disconnect(); } catch (e) {}
    try { eqBands[4].disconnect(); } catch (e) {}
    try { trebleCutFilter.disconnect(); } catch (e) {}

    // Determine the entry point for sources based on current settings
    let entryNode;
    const bassCutActive = settings.bassCutFreq > 20;
    const trebleCutActive = settings.trebleCutFreq < 20000;

    if (!settings.enabled) {
      // Bypass: sources connect directly to output
      entryNode = outputGain;
      eqActive = false;
      multibandActive = false;
    } else {
      // Determine where bass cut output should go
      let afterBassCut;
      if (settings.eqEnabled) {
        afterBassCut = eqBands[0];
        eqActive = true;
      } else if (settings.multibandEnabled) {
        afterBassCut = null; // Special: connect to crossovers
        eqActive = false;
      } else if (settings.compressorEnabled) {
        afterBassCut = compressor;
        eqActive = false;
      } else {
        afterBassCut = trebleCutActive ? trebleCutFilter : outputGain;
        eqActive = false;
      }

      // Entry point: bass cut if active, otherwise afterBassCut
      if (bassCutActive) {
        entryNode = bassCutFilter;
        if (afterBassCut === null) {
          bassCutFilter.connect(crossover1.lowpass);
          bassCutFilter.connect(crossover1.highpass);
        } else {
          bassCutFilter.connect(afterBassCut);
        }
      } else {
        entryNode = afterBassCut;
      }

      // Dynamics output (where dynamics connects to)
      const dynamicsOutput = trebleCutActive ? trebleCutFilter : outputGain;

      // Wire up the rest of the chain based on settings
      if (settings.eqEnabled) {
        // EQ output goes to dynamics stage
        if (settings.multibandEnabled) {
          eqBands[4].connect(crossover1.lowpass);
          eqBands[4].connect(crossover1.highpass);
          multibandSum.connect(dynamicsOutput);
          multibandActive = true;
        } else if (settings.compressorEnabled) {
          eqBands[4].connect(compressor);
          compressor.connect(makeupGain);
          makeupGain.connect(dynamicsOutput);
          multibandActive = false;
        } else {
          eqBands[4].connect(dynamicsOutput);
          multibandActive = false;
        }
      } else {
        // No EQ
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
      }

      // Connect treble cut to output if active
      if (trebleCutActive) {
        trebleCutFilter.connect(outputGain);
      }
    }

    // Connect all sources to the entry point
    connectedMedia.forEach(({ source }) => {
      if (entryNode === null) {
        // Multiband without EQ and without bass cut: sources connect to crossovers
        source.connect(crossover1.lowpass);
        source.connect(crossover1.highpass);
      } else {
        source.connect(entryNode);
      }
    });

    // Handle noise
    noiseGain.gain.value = settings.enabled ? settings.noiseLevel : 0;
  }

  function applySettings() {
    if (!audioContext) return;

    // Global compressor
    compressor.threshold.value = settings.threshold;
    compressor.ratio.value = settings.ratio;
    compressor.knee.value = settings.knee;
    compressor.attack.value = settings.attack / 1000;
    compressor.release.value = settings.release / 1000;
    makeupGain.gain.value = Math.pow(10, settings.makeupGain / 20);
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

    // Noise
    if (settings.noiseType !== currentNoiseType) {
      changeNoiseType(settings.noiseType);
    }
  }

  function connectMedia(element) {
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
    document.querySelectorAll('video, audio').forEach(connectMedia);
  }

  function observeDOM() {
    const observer = new MutationObserver(() => scanMedia());
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Message handler
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fallback-update-settings') {
      const oldEq = settings.eqEnabled;
      const oldMultiband = settings.multibandEnabled;
      const oldCompressor = settings.compressorEnabled;
      const oldEnabled = settings.enabled;
      const oldBassCut = settings.bassCutFreq;
      const oldTrebleCut = settings.trebleCutFreq;

      settings = { ...settings, ...message.settings };

      // Check if bass/treble cut routing needs to change (crossing the active threshold)
      const bassCutRoutingChanged = (settings.bassCutFreq > 20) !== (oldBassCut > 20);
      const trebleCutRoutingChanged = (settings.trebleCutFreq < 20000) !== (oldTrebleCut < 20000);

      // Check if routing needs rebuild
      const needsRebuild = (
        oldEq !== settings.eqEnabled ||
        oldMultiband !== settings.multibandEnabled ||
        oldCompressor !== settings.compressorEnabled ||
        oldEnabled !== settings.enabled ||
        bassCutRoutingChanged || trebleCutRoutingChanged
      );

      if (needsRebuild) {
        rebuildSignalChain();
      }
      applySettings();

      chrome.storage.local.set({ limitrFallbackSettings: settings });
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
    } else if (message.action === 'fallback-ping') {
      sendResponse({ active: true, mediaCount: connectedMedia.size, settings });
    }
    return true;
  });

  // Load saved settings and init
  async function init() {
    try {
      const stored = await chrome.storage.local.get(['limitrFallbackSettings']);
      if (stored.limitrFallbackSettings) {
        settings = { ...settings, ...stored.limitrFallbackSettings };
      }
    } catch (e) {
      console.log('[Limitr Fallback] Could not load saved settings');
    }

    if (document.body) {
      scanMedia();
      observeDOM();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        scanMedia();
        observeDOM();
      });
    }

    setInterval(scanMedia, 2000);
    console.log('[Limitr Fallback] Content script loaded - EQ + Multiband + fullscreen compatible');
  }

  init();
})();
