// Limitr Content Script
// Captures audio/video elements and routes through compressor with filters

(function() {
  'use strict';

  // Avoid multiple injections
  if (window.limitrInitialized) return;
  window.limitrInitialized = true;

  // Audio context and nodes
  let audioContext = null;
  let compressor = null;
  let makeupGain = null;
  let highpassFilter = null;
  let lowpassFilter = null;
  let outputGain = null;
  let analyser = null;

  // Track connected media elements with unique IDs for future per-tab control
  const connectedMedia = new Map();
  let mediaIdCounter = 0;

  // Current settings
  let settings = {
    enabled: false,
    threshold: -24,
    ratio: 8,
    knee: 12,
    attack: 5,    // ms
    release: 100, // ms
    makeupGain: 0,
    // New settings
    outputGain: 0,        // Final output gain (-24 to +24 dB)
    highpassFreq: 0,      // Highpass filter frequency (0 = off, up to 300Hz)
    lowpassFreq: 20000,   // Lowpass filter frequency (20000 = off, down to 2000Hz)
    highpassEnabled: false,
    lowpassEnabled: false
  };

  // Initialize audio context and nodes
  function initAudio() {
    if (audioContext) return;

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Create compressor
      compressor = audioContext.createDynamicsCompressor();

      // Create makeup gain
      makeupGain = audioContext.createGain();

      // Create highpass filter (for bass cut)
      highpassFilter = audioContext.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.value = 0;
      highpassFilter.Q.value = 0.707; // Butterworth response

      // Create lowpass filter (for treble cut / 90s TV mode)
      lowpassFilter = audioContext.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.value = 20000;
      lowpassFilter.Q.value = 0.707;

      // Create output gain (final volume control)
      outputGain = audioContext.createGain();

      // Create analyser for metering
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      // Connect chain: compressor -> makeupGain -> highpass -> lowpass -> outputGain -> analyser -> destination
      compressor.connect(makeupGain);
      makeupGain.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(outputGain);
      outputGain.connect(analyser);
      analyser.connect(audioContext.destination);

      // Apply initial settings
      applySettings();

      console.log('[Limitr] Audio context initialized with filters');
    } catch (e) {
      console.error('[Limitr] Failed to initialize audio context:', e);
    }
  }

  // Apply current settings to audio nodes
  function applySettings() {
    if (!compressor || !makeupGain || !outputGain) return;

    // Compressor parameters
    compressor.threshold.setValueAtTime(settings.threshold, audioContext.currentTime);
    compressor.knee.setValueAtTime(settings.knee, audioContext.currentTime);
    compressor.ratio.setValueAtTime(settings.ratio, audioContext.currentTime);
    compressor.attack.setValueAtTime(settings.attack / 1000, audioContext.currentTime); // Convert ms to seconds
    compressor.release.setValueAtTime(settings.release / 1000, audioContext.currentTime);

    // Makeup gain (convert dB to linear)
    const makeupLinear = Math.pow(10, settings.makeupGain / 20);
    makeupGain.gain.setValueAtTime(makeupLinear, audioContext.currentTime);

    // Highpass filter (bass cut)
    if (settings.highpassEnabled && settings.highpassFreq > 0) {
      highpassFilter.frequency.setValueAtTime(settings.highpassFreq, audioContext.currentTime);
    } else {
      // Set to very low frequency to effectively bypass
      highpassFilter.frequency.setValueAtTime(1, audioContext.currentTime);
    }

    // Lowpass filter (treble cut)
    if (settings.lowpassEnabled && settings.lowpassFreq < 20000) {
      lowpassFilter.frequency.setValueAtTime(settings.lowpassFreq, audioContext.currentTime);
    } else {
      // Set to very high frequency to effectively bypass
      lowpassFilter.frequency.setValueAtTime(22000, audioContext.currentTime);
    }

    // Output gain (convert dB to linear)
    const outputLinear = Math.pow(10, settings.outputGain / 20);
    outputGain.gain.setValueAtTime(outputLinear, audioContext.currentTime);
  }

  // Connect a media element to the processing chain
  function connectMedia(element) {
    if (!element || connectedMedia.has(element)) return;

    // Initialize audio context on first media connection
    initAudio();
    if (!audioContext) return;

    // Resume audio context if suspended (Chrome autoplay policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    try {
      // Create source from media element
      const source = audioContext.createMediaElementSource(element);

      // Assign unique ID for future per-tab/per-media control
      const mediaId = `media_${++mediaIdCounter}`;

      // Store reference with metadata
      connectedMedia.set(element, {
        source,
        id: mediaId,
        tagName: element.tagName,
        src: element.src || element.currentSrc || 'unknown'
      });

      // Connect based on enabled state
      if (settings.enabled) {
        source.connect(compressor);
      } else {
        source.connect(audioContext.destination);
      }

      console.log('[Limitr] Connected media element:', mediaId, element.tagName, element.src || element.currentSrc);
    } catch (e) {
      if (e.name === 'InvalidStateError') {
        // Element already connected to another context - skip
        console.log('[Limitr] Element already has audio context');
      } else {
        console.error('[Limitr] Failed to connect media:', e);
      }
    }
  }

  // Reconnect all media elements (when enabled state changes)
  function reconnectAllMedia() {
    if (!audioContext) return;

    connectedMedia.forEach((data, element) => {
      const { source } = data;

      // Disconnect from everything
      source.disconnect();

      // Reconnect based on enabled state
      if (settings.enabled) {
        source.connect(compressor);
      } else {
        source.connect(audioContext.destination);
      }
    });
  }

  // Get list of connected media (for future per-tab control)
  function getMediaList() {
    const list = [];
    connectedMedia.forEach((data, element) => {
      list.push({
        id: data.id,
        tagName: data.tagName,
        src: data.src,
        paused: element.paused,
        currentTime: element.currentTime,
        duration: element.duration
      });
    });
    return list;
  }

  // Scan for media elements
  function scanForMedia() {
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(connectMedia);
  }

  // Observe DOM for new media elements
  function observeDOM() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          // Check if node itself is media
          if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
            connectMedia(node);
          }

          // Check descendants
          if (node.querySelectorAll) {
            node.querySelectorAll('video, audio').forEach(connectMedia);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Get gain reduction value from compressor
  function getGainReduction() {
    if (!compressor) return 0;
    return compressor.reduction; // Returns negative dB value
  }

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'UPDATE_SETTINGS':
        settings = { ...settings, ...message.settings };
        applySettings();
        reconnectAllMedia();
        break;

      case 'GET_STATUS':
        sendResponse({
          mediaCount: connectedMedia.size,
          reduction: getGainReduction(),
          mediaList: getMediaList()
        });
        break;

      case 'GET_METER':
        sendResponse({
          reduction: getGainReduction(),
          mediaCount: connectedMedia.size
        });
        break;

      case 'GET_MEDIA_LIST':
        sendResponse({
          mediaList: getMediaList()
        });
        break;
    }
    return true; // Keep message channel open for async response
  });

  // Load settings from storage
  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get(['limitrSettings']);
      if (stored.limitrSettings) {
        settings = { ...settings, ...stored.limitrSettings };
      }
    } catch (e) {
      console.error('[Limitr] Failed to load settings:', e);
    }
  }

  // Initialize
  async function init() {
    await loadSettings();

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        scanForMedia();
        observeDOM();
      });
    } else {
      scanForMedia();
      observeDOM();
    }

    // Also scan on window load (for lazy-loaded media)
    window.addEventListener('load', scanForMedia);

    // Re-scan periodically for dynamically added elements that mutation observer might miss
    setInterval(scanForMedia, 2000);
  }

  init();
})();
