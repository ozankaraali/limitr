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
  let highpassFilter = null;
  let lowpassFilter = null;
  let noiseGain = null;
  let noiseSource = null;

  const connectedMedia = new Map();

  let settings = {
    enabled: true,
    threshold: -24,
    ratio: 8,
    knee: 12,
    attack: 5,
    release: 100,
    makeupGain: 0,
    outputGain: 0,
    highpassFreq: 0,
    lowpassFreq: 22050,
    noiseLevel: 0,
    noiseType: 'brown'
  };

  // Noise generation (same as offscreen.js)
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

      // Compressor
      compressor = audioContext.createDynamicsCompressor();

      // Gains
      makeupGain = audioContext.createGain();
      outputGain = audioContext.createGain();

      // Filters
      highpassFilter = audioContext.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.value = 1;

      lowpassFilter = audioContext.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.value = 22050;

      // Noise
      noiseGain = audioContext.createGain();
      noiseGain.gain.value = 0;

      const noiseData = generateNoiseBuffer(audioContext.sampleRate, settings.noiseType);
      const noiseBuffer = audioContext.createBuffer(1, noiseData.length, audioContext.sampleRate);
      noiseBuffer.getChannelData(0).set(noiseData);

      noiseSource = audioContext.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      noiseSource.connect(noiseGain);
      noiseSource.start();

      // Chain: compressor -> makeupGain -> highpass -> lowpass -> outputGain -> destination
      compressor.connect(makeupGain);
      makeupGain.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(outputGain);
      noiseGain.connect(outputGain);
      outputGain.connect(audioContext.destination);

      applySettings();
      console.log('[Limitr Fallback] Audio chain initialized');
    } catch (e) {
      console.error('[Limitr Fallback] Init failed:', e);
    }
  }

  function applySettings() {
    if (!compressor) return;

    compressor.threshold.value = settings.threshold;
    compressor.knee.value = settings.knee;
    compressor.ratio.value = settings.ratio;
    compressor.attack.value = settings.attack / 1000;
    compressor.release.value = settings.release / 1000;

    makeupGain.gain.value = Math.pow(10, settings.makeupGain / 20);
    outputGain.gain.value = Math.pow(10, settings.outputGain / 20);

    highpassFilter.frequency.value = settings.highpassFreq > 0 ? settings.highpassFreq : 1;
    lowpassFilter.frequency.value = settings.lowpassFreq < 22050 ? settings.lowpassFreq : 22050;

    noiseGain.gain.value = settings.noiseLevel;
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
      source.connect(compressor);
      connectedMedia.set(element, { source });
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
      settings = { ...settings, ...message.settings };
      applySettings();
      // Save to storage for persistence
      chrome.storage.local.set({ limitrFallbackSettings: settings });
      sendResponse({ success: true });
    } else if (message.action === 'fallback-get-reduction') {
      sendResponse({ reduction: compressor ? compressor.reduction : 0 });
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
    console.log('[Limitr Fallback] Content script loaded - fullscreen compatible mode');
  }

  init();
})();
