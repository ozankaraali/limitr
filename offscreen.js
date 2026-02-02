// Offscreen document for audio processing
// Stores per-tab audio state and processes streams

// Per-tab audio state
const tabAudioState = new Map();

// Default compressor settings (must match popup.js and background.js)
const defaultSettings = {
  enabled: true,
  threshold: -24,
  ratio: 8,
  knee: 12,
  attack: 0.005,
  release: 0.1,
  makeupGain: 0,
  outputGain: 0,
  highpassFreq: 0,
  lowpassFreq: 22050,
  noiseLevel: 0
};

// Create white noise buffer for CRT effect
function createNoiseBuffer(audioContext) {
  const bufferSize = audioContext.sampleRate * 2; // 2 seconds of noise
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1; // Random values between -1 and 1
  }
  return buffer;
}

// Create audio processing chain for a tab
async function createAudioChain(tabId, mediaStreamId) {
  // If already exists, return existing state
  if (tabAudioState.has(tabId)) {
    return tabAudioState.get(tabId);
  }

  try {
    // Get the media stream from the tab
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: mediaStreamId
        }
      }
    });

    // Create audio context
    const audioContext = new AudioContext();

    // Create source from stream
    const source = audioContext.createMediaStreamSource(stream);

    // Create nodes
    const highpassFilter = audioContext.createBiquadFilter();
    highpassFilter.type = 'highpass';
    highpassFilter.frequency.value = 0;

    const lowpassFilter = audioContext.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.value = 22050;

    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = defaultSettings.threshold;
    compressor.ratio.value = defaultSettings.ratio;
    compressor.knee.value = defaultSettings.knee;
    compressor.attack.value = defaultSettings.attack;
    compressor.release.value = defaultSettings.release;

    const makeupGain = audioContext.createGain();
    makeupGain.gain.value = 1;

    const outputGain = audioContext.createGain();
    outputGain.gain.value = 1;

    // Create noise source for CRT effect
    const noiseBuffer = createNoiseBuffer(audioContext);
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseGain = audioContext.createGain();
    noiseGain.gain.value = 0; // Start with no noise

    noiseSource.connect(noiseGain);
    noiseSource.start();

    // Create destination to output processed audio
    const destination = audioContext.createMediaStreamDestination();

    // Connect the chain
    source.connect(highpassFilter);
    highpassFilter.connect(lowpassFilter);
    lowpassFilter.connect(compressor);
    compressor.connect(makeupGain);
    makeupGain.connect(outputGain);

    // Mix noise into output
    noiseGain.connect(outputGain);

    outputGain.connect(destination);

    // Also connect to audio context destination for playback
    outputGain.connect(audioContext.destination);

    // Store state
    const state = {
      tabId,
      audioContext,
      source,
      stream,
      highpassFilter,
      lowpassFilter,
      compressor,
      makeupGain,
      outputGain,
      noiseSource,
      noiseGain,
      destination,
      settings: { ...defaultSettings },
      enabled: true
    };

    tabAudioState.set(tabId, state);

    // Start reduction monitoring
    startReductionMonitoring(tabId);

    return state;
  } catch (error) {
    console.error('Failed to create audio chain:', error);
    throw error;
  }
}

// Update compressor settings for a tab
function updateSettings(tabId, newSettings) {
  const state = tabAudioState.get(tabId);
  if (!state) return false;

  const { compressor, makeupGain, outputGain, highpassFilter, lowpassFilter, noiseGain } = state;

  // Update settings object
  Object.assign(state.settings, newSettings);
  const s = state.settings;

  // Apply to nodes
  if (newSettings.threshold !== undefined) {
    compressor.threshold.value = s.threshold;
  }
  if (newSettings.ratio !== undefined) {
    compressor.ratio.value = s.ratio;
  }
  if (newSettings.knee !== undefined) {
    compressor.knee.value = s.knee;
  }
  if (newSettings.attack !== undefined) {
    compressor.attack.value = s.attack / 1000; // Convert ms to seconds
  }
  if (newSettings.release !== undefined) {
    compressor.release.value = s.release / 1000; // Convert ms to seconds
  }
  if (newSettings.makeupGain !== undefined) {
    makeupGain.gain.value = Math.pow(10, s.makeupGain / 20);
  }
  if (newSettings.outputGain !== undefined) {
    outputGain.gain.value = Math.pow(10, s.outputGain / 20);
  }
  if (newSettings.highpassFreq !== undefined) {
    highpassFilter.frequency.value = s.highpassFreq;
  }
  if (newSettings.lowpassFreq !== undefined) {
    lowpassFilter.frequency.value = s.lowpassFreq;
  }
  if (newSettings.noiseLevel !== undefined) {
    noiseGain.gain.value = s.noiseLevel;
  }

  return true;
}

// Enable/disable processing for a tab
function setEnabled(tabId, enabled) {
  const state = tabAudioState.get(tabId);
  if (!state) return false;

  state.enabled = enabled;
  state.settings.enabled = enabled;

  const { source, highpassFilter, compressor, outputGain, audioContext } = state;

  if (enabled) {
    // Reconnect through processing chain
    source.disconnect();
    source.connect(highpassFilter);
  } else {
    // Bypass: connect source directly to output
    source.disconnect();
    source.connect(audioContext.destination);
  }

  return true;
}

// Get current state for a tab
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

// Get gain reduction value
function getReduction(tabId) {
  const state = tabAudioState.get(tabId);
  if (!state) return 0;
  return state.compressor.reduction;
}

// Clean up when tab is closed
function cleanupTab(tabId) {
  const state = tabAudioState.get(tabId);
  if (!state) return;

  // Stop noise source
  if (state.noiseSource) {
    state.noiseSource.stop();
  }

  // Stop all tracks
  state.stream.getTracks().forEach(track => track.stop());

  // Close audio context
  state.audioContext.close();

  // Remove from map
  tabAudioState.delete(tabId);
}

// Monitor reduction values and send updates
function startReductionMonitoring(tabId) {
  const interval = setInterval(() => {
    const state = tabAudioState.get(tabId);
    if (!state) {
      clearInterval(interval);
      return;
    }

    // Send reduction update to popup if it's listening
    chrome.runtime.sendMessage({
      action: 'reduction-update',
      tabId,
      reduction: state.compressor.reduction
    }).catch(() => {
      // Popup might be closed, ignore error
    });
  }, 50); // 20fps updates
}

// Check if tab has audio processing active
function hasAudioState(tabId) {
  return tabAudioState.has(tabId);
}

// Get all active tab IDs
function getActiveTabIds() {
  return Array.from(tabAudioState.keys());
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  switch (message.action) {
    case 'init-audio': {
      createAudioChain(message.tabId, message.mediaStreamId)
        .then(state => {
          sendResponse({ success: true, settings: state.settings });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Async response
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
      const reduction = getReduction(message.tabId);
      sendResponse({ reduction });
      break;
    }

    case 'has-audio': {
      const hasAudio = hasAudioState(message.tabId);
      sendResponse({ hasAudio });
      break;
    }

    case 'cleanup-tab': {
      cleanupTab(message.tabId);
      sendResponse({ success: true });
      break;
    }

    case 'get-active-tabs': {
      const tabIds = getActiveTabIds();
      sendResponse({ tabIds });
      break;
    }

    case 'set-volume': {
      const state = tabAudioState.get(message.tabId);
      if (state) {
        // Convert dB to linear gain and update both the node and settings
        state.outputGain.gain.value = Math.pow(10, message.volume / 20);
        state.settings.outputGain = message.volume;
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
      break;
    }

    case 'get-all-volumes': {
      // Return current output gain (in dB) for all active tabs
      const volumes = {};
      for (const [tabId, state] of tabAudioState) {
        // Convert linear gain back to dB
        const linearGain = state.outputGain.gain.value;
        const db = linearGain > 0 ? 20 * Math.log10(linearGain) : -60;
        volumes[tabId] = Math.round(db);
      }
      sendResponse({ volumes });
      break;
    }
  }
});

console.log('Limitr offscreen document loaded');
