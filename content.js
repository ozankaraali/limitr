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

  // Track connected media elements with unique IDs and per-media gain
  const connectedMedia = new Map();
  let mediaIdCounter = 0;

  // Per-media volume settings (persisted)
  let mediaVolumes = {};

  // Current settings
  let settings = {
    enabled: false,
    threshold: -24,
    ratio: 8,
    knee: 12,
    attack: 5,    // ms
    release: 100, // ms
    makeupGain: 0,
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

  // Get a display name for a media element
  function getMediaDisplayName(element) {
    // Try to get a meaningful name from various sources
    const src = element.src || element.currentSrc || '';

    // Check for title attribute
    if (element.title) return element.title;

    // Check for aria-label
    if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');

    // Try to extract filename from src
    if (src) {
      try {
        const url = new URL(src, window.location.href);
        const pathname = url.pathname;
        const filename = pathname.split('/').pop();
        if (filename && filename.length > 0 && filename.length < 50) {
          // Remove extension and clean up
          const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
          if (name.length > 0) return name;
        }
        // Use hostname for external content
        if (url.hostname !== window.location.hostname) {
          return url.hostname;
        }
      } catch (e) {}
    }

    // Check page title as last resort for single video pages
    if (document.title && connectedMedia.size <= 1) {
      return document.title.substring(0, 40);
    }

    return `${element.tagName.toLowerCase()}`;
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

      // Create per-media gain node for mixer control
      const mediaGain = audioContext.createGain();

      // Assign unique ID
      const mediaId = `media_${++mediaIdCounter}`;

      // Get display name
      const displayName = getMediaDisplayName(element);

      // Restore saved volume if exists, otherwise default to 0 dB (gain = 1)
      const savedVolume = mediaVolumes[mediaId] !== undefined ? mediaVolumes[mediaId] : 0;
      const gainLinear = Math.pow(10, savedVolume / 20);
      mediaGain.gain.setValueAtTime(gainLinear, audioContext.currentTime);

      // Store reference with metadata
      connectedMedia.set(element, {
        source,
        mediaGain,
        id: mediaId,
        tagName: element.tagName,
        src: element.src || element.currentSrc || 'unknown',
        displayName,
        volume: savedVolume
      });

      // Connect: source -> mediaGain -> (compressor or destination)
      source.connect(mediaGain);

      if (settings.enabled) {
        mediaGain.connect(compressor);
      } else {
        mediaGain.connect(audioContext.destination);
      }

      console.log('[Limitr] Connected media element:', mediaId, displayName);
    } catch (e) {
      if (e.name === 'InvalidStateError') {
        // Element already connected to another context - skip
        console.log('[Limitr] Element already has audio context');
      } else {
        console.error('[Limitr] Failed to connect media:', e);
      }
    }
  }

  // Set volume for a specific media element
  function setMediaVolume(mediaId, volumeDb) {
    connectedMedia.forEach((data, element) => {
      if (data.id === mediaId) {
        const gainLinear = Math.pow(10, volumeDb / 20);
        data.mediaGain.gain.setValueAtTime(gainLinear, audioContext.currentTime);
        data.volume = volumeDb;
        mediaVolumes[mediaId] = volumeDb;
      }
    });
  }

  // Reconnect all media elements (when enabled state changes)
  function reconnectAllMedia() {
    if (!audioContext) return;

    connectedMedia.forEach((data, element) => {
      const { mediaGain } = data;

      // Disconnect mediaGain from everything (source stays connected to mediaGain)
      mediaGain.disconnect();

      // Reconnect based on enabled state
      if (settings.enabled) {
        mediaGain.connect(compressor);
      } else {
        mediaGain.connect(audioContext.destination);
      }
    });
  }

  // Get list of connected media (for mixer panel)
  function getMediaList() {
    const list = [];
    connectedMedia.forEach((data, element) => {
      list.push({
        id: data.id,
        tagName: data.tagName,
        src: data.src,
        displayName: data.displayName,
        paused: element.paused,
        currentTime: element.currentTime,
        duration: element.duration,
        volume: data.volume || 0
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
          mediaCount: connectedMedia.size,
          mediaList: getMediaList()
        });
        break;

      case 'GET_MEDIA_LIST':
        sendResponse({
          mediaList: getMediaList()
        });
        break;

      case 'SET_MEDIA_VOLUME':
        setMediaVolume(message.mediaId, message.volume);
        sendResponse({ success: true });
        break;
    }
    return true; // Keep message channel open for async response
  });

  // Load settings from storage
  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get(['limitrSettings', 'limitrMediaVolumes']);
      if (stored.limitrSettings) {
        settings = { ...settings, ...stored.limitrSettings };
      }
      if (stored.limitrMediaVolumes) {
        mediaVolumes = stored.limitrMediaVolumes;
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
