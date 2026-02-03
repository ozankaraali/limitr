// Limitr Popup - TabCapture Version
// Communicates with service worker for per-tab audio processing

// Default settings - matches offscreen.js and content-audio.js
const defaults = {
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
  bassCutFreq: 0,       // 0 = off, otherwise highpass Hz (e.g., 80, 120, 200)
  trebleCutFreq: 22050, // 22050 = off, otherwise lowpass Hz (e.g., 8000, 12000)

  // AI Noise Suppression (RNNoise)
  noiseSuppressionEnabled: false,

  // Limiter (brick wall, prevents clipping)
  limiterEnabled: true,
  limiterThreshold: -1,

  // Auto-Gain (AGC - automatic level control)
  autoGainEnabled: false,
  autoGainTarget: -16,

  // Effects
  noiseLevel: 0,
  noiseType: 'brown'
};

// Presets (Off first, then ordered light to heavy)
const presets = {
  off: {
    name: 'Off',
    compressorEnabled: false,
    multibandEnabled: false,
    eqEnabled: false,
    threshold: 0, ratio: 1, knee: 0, attack: 0, release: 0,
    makeupGain: 0, bassCutFreq: 0, trebleCutFreq: 22050,
    noiseLevel: 0, noiseType: 'brown'
  },
  voiceFocus: {
    name: 'Voice Focus',
    compressorEnabled: false,
    multibandEnabled: true,
    eqEnabled: true,
    // Multiband: duck bass, preserve mids, tame highs
    crossover1: 200,
    crossover2: 3000,
    subThreshold: -15,
    subRatio: 12,
    subGain: -8,
    midThreshold: -35,
    midRatio: 2,
    midGain: 4,
    highThreshold: -25,
    highRatio: 6,
    highGain: -2,
    // EQ: highpass rumble, boost presence
    eq1Freq: 80, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 200, eq2Gain: -2, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 2500, eq3Gain: 3, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 5000, eq4Gain: 2, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 12000, eq5Gain: -2, eq5Q: 0.7, eq5Type: 'highshelf',
    noiseLevel: 0, noiseType: 'brown'
  },
  voiceClarity: {
    name: 'Voice Clarity',
    compressorEnabled: true,
    multibandEnabled: false,
    eqEnabled: true,
    threshold: -30, ratio: 6, knee: 10, attack: 5, release: 150,
    makeupGain: 4,
    eq1Freq: 80, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: 0, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 2000, eq3Gain: 2, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: 0, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 12000, eq5Gain: -3, eq5Q: 0.7, eq5Type: 'lowpass',
    noiseLevel: 0, noiseType: 'brown'
  },
  normalize: {
    name: 'Normalize',
    compressorEnabled: true,
    multibandEnabled: false,
    eqEnabled: false,
    threshold: -24, ratio: 8, knee: 12, attack: 5, release: 100,
    makeupGain: 6,
    noiseLevel: 0, noiseType: 'brown'
  },
  bassTamer: {
    name: 'Bass Tamer',
    compressorEnabled: true,
    multibandEnabled: false,
    eqEnabled: true,
    threshold: -30, ratio: 10, knee: 8, attack: 2, release: 100,
    makeupGain: 4,
    eq1Freq: 120, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: -3, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 1000, eq3Gain: 0, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: 0, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 22050, eq5Gain: 0, eq5Q: 0.7, eq5Type: 'highshelf',
    noiseLevel: 0, noiseType: 'brown'
  },
  nightMode: {
    name: 'Night Mode',
    compressorEnabled: true,
    multibandEnabled: false,
    eqEnabled: true,
    threshold: -40, ratio: 15, knee: 6, attack: 1, release: 50,
    makeupGain: 6,
    eq1Freq: 120, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: -4, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 1000, eq3Gain: 0, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: 0, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 22050, eq5Gain: 0, eq5Q: 0.7, eq5Type: 'highshelf',
    noiseLevel: 0, noiseType: 'brown'
  },
  tv90s: {
    name: '90s TV',
    compressorEnabled: true,
    multibandEnabled: false,
    eqEnabled: false,
    threshold: -35, ratio: 15, knee: 6, attack: 2, release: 100,
    makeupGain: 5,
    // Dedicated filters for that classic narrow bandwidth TV sound
    bassCutFreq: 200,    // Remove deep bass (old TV speakers can't reproduce)
    trebleCutFreq: 8000, // Roll off highs (limited HF response)
    noiseLevel: 0.15, noiseType: 'brown'
  }
};

// Keys used for preset comparison
const presetKeys = [
  'compressorEnabled', 'multibandEnabled', 'eqEnabled',
  'threshold', 'ratio', 'knee', 'attack', 'release', 'makeupGain',
  'noiseLevel', 'noiseType',
  // Filters
  'bassCutFreq', 'trebleCutFreq',
  // Noise suppression
  'noiseSuppressionEnabled',
  // Limiter & Auto-Gain
  'limiterEnabled', 'limiterThreshold',
  'autoGainEnabled', 'autoGainTarget',
  // Multiband
  'crossover1', 'crossover2',
  'subThreshold', 'subRatio', 'subGain',
  'midThreshold', 'midRatio', 'midGain',
  'highThreshold', 'highRatio', 'highGain',
  // EQ
  'eq1Freq', 'eq1Gain', 'eq1Q', 'eq1Type',
  'eq2Freq', 'eq2Gain', 'eq2Q', 'eq2Type',
  'eq3Freq', 'eq3Gain', 'eq3Q', 'eq3Type',
  'eq4Freq', 'eq4Gain', 'eq4Q', 'eq4Type',
  'eq5Freq', 'eq5Gain', 'eq5Q', 'eq5Type'
];

// State
let elements = {};
let currentTabId = null;
let currentSettings = { ...defaults };
let advancedMode = false;
let isCapturing = false;
let audibleTabs = [];
let processingTabIds = [];
let crtVisualEnabled = false;
let mixerMode = false;

// Initialize
async function init() {
  elements = {
    enabled: document.getElementById('enabled'),
    status: document.getElementById('status'),
    mixerModeToggle: document.getElementById('mixerModeToggle'),
    mixerModeLabel: document.getElementById('mixerModeLabel'),
    modeToggle: document.getElementById('modeToggle'),
    modeLabel: document.getElementById('modeLabel'),
    simpleControls: document.getElementById('simpleControls'),
    advancedControls: document.getElementById('advancedControls'),
    outputGainSimple: document.getElementById('outputGainSimple'),
    outputGainSimpleValue: document.getElementById('outputGainSimpleValue'),
    // Advanced controls
    threshold: document.getElementById('threshold'),
    thresholdValue: document.getElementById('thresholdValue'),
    ratio: document.getElementById('ratio'),
    ratioValue: document.getElementById('ratioValue'),
    knee: document.getElementById('knee'),
    kneeValue: document.getElementById('kneeValue'),
    attack: document.getElementById('attack'),
    attackValue: document.getElementById('attackValue'),
    release: document.getElementById('release'),
    releaseValue: document.getElementById('releaseValue'),
    makeupGain: document.getElementById('makeupGain'),
    makeupGainValue: document.getElementById('makeupGainValue'),
    outputGain: document.getElementById('outputGain'),
    outputGainValue: document.getElementById('outputGainValue'),
    noiseLevel: document.getElementById('noiseLevel'),
    noiseLevelValue: document.getElementById('noiseLevelValue'),
    noiseType: document.getElementById('noiseType'),
    reductionMeter: document.getElementById('reductionMeter'),
    reductionValue: document.getElementById('reductionValue'),
    // 3-Band Multiband controls
    multibandToggle: document.getElementById('multibandToggle'),
    multibandLabel: document.getElementById('multibandLabel'),
    multibandControls: document.getElementById('multibandControls'),
    crossover1: document.getElementById('crossover1'),
    crossover1Value: document.getElementById('crossover1Value'),
    crossover2: document.getElementById('crossover2'),
    crossover2Value: document.getElementById('crossover2Value'),
    subThreshold: document.getElementById('subThreshold'),
    subThresholdValue: document.getElementById('subThresholdValue'),
    midThreshold: document.getElementById('midThreshold'),
    midThresholdValue: document.getElementById('midThresholdValue'),
    highThreshold: document.getElementById('highThreshold'),
    highThresholdValue: document.getElementById('highThresholdValue'),
    subGain: document.getElementById('subGain'),
    subGainValue: document.getElementById('subGainValue'),
    midGain: document.getElementById('midGain'),
    midGainValue: document.getElementById('midGainValue'),
    highGain: document.getElementById('highGain'),
    highGainValue: document.getElementById('highGainValue'),
    // 5-Band EQ controls
    eqToggle: document.getElementById('eqToggle'),
    eqLabel: document.getElementById('eqLabel'),
    eqControls: document.getElementById('eqControls'),
    eqCanvas: document.getElementById('eqCanvas'),
    // Per-band EQ controls (freq, gain, Q, type)
    eq1Freq: document.getElementById('eq1Freq'),
    eq1FreqValue: document.getElementById('eq1FreqValue'),
    eq1Gain: document.getElementById('eq1Gain'),
    eq1GainValue: document.getElementById('eq1GainValue'),
    eq1Type: document.getElementById('eq1Type'),
    eq2Freq: document.getElementById('eq2Freq'),
    eq2FreqValue: document.getElementById('eq2FreqValue'),
    eq2Gain: document.getElementById('eq2Gain'),
    eq2GainValue: document.getElementById('eq2GainValue'),
    eq2Type: document.getElementById('eq2Type'),
    eq3Freq: document.getElementById('eq3Freq'),
    eq3FreqValue: document.getElementById('eq3FreqValue'),
    eq3Gain: document.getElementById('eq3Gain'),
    eq3GainValue: document.getElementById('eq3GainValue'),
    eq3Type: document.getElementById('eq3Type'),
    eq4Freq: document.getElementById('eq4Freq'),
    eq4FreqValue: document.getElementById('eq4FreqValue'),
    eq4Gain: document.getElementById('eq4Gain'),
    eq4GainValue: document.getElementById('eq4GainValue'),
    eq4Type: document.getElementById('eq4Type'),
    eq5Freq: document.getElementById('eq5Freq'),
    eq5FreqValue: document.getElementById('eq5FreqValue'),
    eq5Gain: document.getElementById('eq5Gain'),
    eq5GainValue: document.getElementById('eq5GainValue'),
    eq5Type: document.getElementById('eq5Type'),
    // Bass/Treble Cut filters
    bassCutFreq: document.getElementById('bassCutFreq'),
    bassCutFreqValue: document.getElementById('bassCutFreqValue'),
    trebleCutFreq: document.getElementById('trebleCutFreq'),
    trebleCutFreqValue: document.getElementById('trebleCutFreqValue'),
    // AI Noise Suppression
    noiseSuppressionToggle: document.getElementById('noiseSuppressionToggle'),
    noiseSuppressionLabel: document.getElementById('noiseSuppressionLabel'),
    noiseSuppressionNote: document.getElementById('noiseSuppressionNote'),
    // Limiter
    limiterToggle: document.getElementById('limiterToggle'),
    limiterLabel: document.getElementById('limiterLabel'),
    limiterThreshold: document.getElementById('limiterThreshold'),
    limiterThresholdValue: document.getElementById('limiterThresholdValue'),
    // Auto-Gain
    autoGainToggle: document.getElementById('autoGainToggle'),
    autoGainLabel: document.getElementById('autoGainLabel'),
    autoGainTarget: document.getElementById('autoGainTarget'),
    autoGainTargetValue: document.getElementById('autoGainTargetValue'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    mixerToggle: document.getElementById('mixerToggle'),
    mixerPanel: document.getElementById('mixerPanel'),
    mixerList: document.getElementById('mixerList'),
    mediaCount: document.getElementById('mediaCount'),
    crtToggle: document.getElementById('crtToggle'),
    crtLabel: document.getElementById('crtLabel')
  };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id;

  const stored = await chrome.storage.local.get(['limitrAdvancedMode', 'limitrMixerMode']);
  advancedMode = stored.limitrAdvancedMode || false;
  mixerMode = stored.limitrMixerMode || false;

  if (elements.mixerModeToggle) {
    elements.mixerModeToggle.checked = mixerMode;
  }

  updateMixerAvailability();

  if (mixerMode) {
    const stateResponse = await sendToBackground({ action: 'get-state', tabId: currentTabId });
    if (stateResponse.success && stateResponse.state) {
      currentSettings = { ...defaults, ...stateResponse.state.settings };
      isCapturing = true;
    } else {
      await initCapture();
    }
  } else {
    await initFallbackCapture();
  }

  updateUI();
  updateModeDisplay();
  updateStatusIndicator();
  setupEventListeners();

  try {
    const crtResponse = await chrome.tabs.sendMessage(currentTabId, { action: 'get-crt-visual' });
    if (crtResponse && crtResponse.enabled) {
      crtVisualEnabled = true;
      updateTvButtonState();
    }
  } catch (err) {}

  await refreshAudibleTabs();
  startReductionPolling();
}

async function sendToBackground(message) {
  return chrome.runtime.sendMessage({ ...message, target: 'background' });
}

async function initCapture() {
  if (!currentTabId) return false;

  try {
    const response = await sendToBackground({ action: 'init-capture', tabId: currentTabId });
    if (response.success) {
      isCapturing = true;
      currentSettings = { ...defaults, ...response.settings };
      updateUI();
      return true;
    } else {
      console.error('Failed to init capture:', response.error);
      return false;
    }
  } catch (error) {
    console.error('Error initializing capture:', error);
    return false;
  }
}

async function initFallbackCapture() {
  if (!currentTabId) return false;

  try {
    let alreadyInjected = false;
    try {
      const response = await chrome.tabs.sendMessage(currentTabId, { action: 'fallback-ping' });
      if (response && response.active) {
        alreadyInjected = true;
        isCapturing = true;
        if (response.settings) {
          currentSettings = { ...defaults, ...response.settings };
        }
      }
    } catch (e) {}

    if (!alreadyInjected) {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ['content-audio.js']
      });
      isCapturing = true;

      await new Promise(resolve => setTimeout(resolve, 100));

      const stored = await chrome.storage.local.get(['limitrFallbackSettings']);
      if (stored.limitrFallbackSettings) {
        currentSettings = { ...defaults, ...stored.limitrFallbackSettings };
      }
    }

    updateUI();
    return true;
  } catch (error) {
    console.error('Error initializing fallback capture:', error);
    return false;
  }
}

async function updateFallbackSettings() {
  if (!currentTabId) return;

  try {
    await chrome.tabs.sendMessage(currentTabId, {
      action: 'fallback-update-settings',
      settings: currentSettings
    });
  } catch (err) {
    console.error('Failed to update fallback settings:', err);
  }
}

async function updateTabSettings() {
  if (!currentTabId || !isCapturing) return;

  if (mixerMode) {
    await sendToBackground({
      action: 'update-settings',
      tabId: currentTabId,
      settings: currentSettings
    });
  } else {
    await updateFallbackSettings();
  }
}

async function setEnabled(enabled) {
  currentSettings.enabled = enabled;

  if (mixerMode) {
    if (enabled && !isCapturing) {
      await initCapture();
    } else if (isCapturing) {
      await sendToBackground({
        action: 'set-enabled',
        tabId: currentTabId,
        enabled: enabled
      });
    }
  } else {
    if (enabled && !isCapturing) {
      await initFallbackCapture();
    } else if (isCapturing) {
      await updateFallbackSettings();
    }
  }

  updateStatusIndicator();
}

async function refreshAudibleTabs() {
  try {
    const response = await sendToBackground({ action: 'get-audible-tabs' });
    if (response.success) {
      audibleTabs = response.tabs;
    }

    const processingResponse = await sendToBackground({ action: 'get-processing-tabs' });
    if (processingResponse.success) {
      processingTabIds = processingResponse.tabIds;
    }

    const volumesResponse = await sendToBackground({ action: 'get-all-volumes' });
    if (volumesResponse.success && volumesResponse.volumes) {
      for (const [tabId, volume] of Object.entries(volumesResponse.volumes)) {
        tabVolumes[parseInt(tabId)] = volume;
      }
    }

    updateMixerList();
  } catch (error) {
    console.error('Error refreshing tabs:', error);
  }
}

function updateUI() {
  elements.enabled.checked = currentSettings.enabled;

  // Simple mode controls
  if (elements.outputGainSimple) {
    elements.outputGainSimple.value = currentSettings.outputGain;
    elements.outputGainSimpleValue.textContent = formatGain(currentSettings.outputGain);
  }

  // Advanced controls
  if (elements.threshold) {
    elements.threshold.value = currentSettings.threshold;
    elements.thresholdValue.textContent = `${currentSettings.threshold} dB`;
  }
  if (elements.ratio) {
    elements.ratio.value = currentSettings.ratio;
    elements.ratioValue.textContent = `${currentSettings.ratio}:1`;
  }
  if (elements.knee) {
    elements.knee.value = currentSettings.knee;
    elements.kneeValue.textContent = `${currentSettings.knee} dB`;
  }
  if (elements.attack) {
    elements.attack.value = currentSettings.attack;
    elements.attackValue.textContent = `${currentSettings.attack} ms`;
  }
  if (elements.release) {
    elements.release.value = currentSettings.release;
    elements.releaseValue.textContent = `${currentSettings.release} ms`;
  }
  if (elements.makeupGain) {
    elements.makeupGain.value = currentSettings.makeupGain;
    elements.makeupGainValue.textContent = `${currentSettings.makeupGain} dB`;
  }
  if (elements.outputGain) {
    elements.outputGain.value = currentSettings.outputGain;
    elements.outputGainValue.textContent = formatGain(currentSettings.outputGain);
  }
  if (elements.noiseLevel) {
    elements.noiseLevel.value = currentSettings.noiseLevel;
    elements.noiseLevelValue.textContent = formatNoiseLevel(currentSettings.noiseLevel);
  }
  if (elements.noiseType) {
    elements.noiseType.value = currentSettings.noiseType || 'brown';
  }

  // 3-Band Multiband controls
  if (elements.multibandToggle) {
    elements.multibandToggle.checked = currentSettings.multibandEnabled;
  }
  if (elements.multibandLabel) {
    elements.multibandLabel.textContent = currentSettings.multibandEnabled ? 'On' : 'Off';
    elements.multibandLabel.classList.toggle('active', currentSettings.multibandEnabled);
  }
  if (elements.multibandControls) {
    elements.multibandControls.style.display = currentSettings.multibandEnabled ? 'block' : 'none';
  }
  // Crossovers
  if (elements.crossover1) {
    elements.crossover1.value = currentSettings.crossover1;
    elements.crossover1Value.textContent = `${currentSettings.crossover1} Hz`;
  }
  if (elements.crossover2) {
    elements.crossover2.value = currentSettings.crossover2;
    elements.crossover2Value.textContent = `${(currentSettings.crossover2 / 1000).toFixed(1)}k Hz`;
  }
  // Per-band thresholds
  if (elements.subThreshold) {
    elements.subThreshold.value = currentSettings.subThreshold;
    elements.subThresholdValue.textContent = `${currentSettings.subThreshold} dB`;
  }
  if (elements.midThreshold) {
    elements.midThreshold.value = currentSettings.midThreshold;
    elements.midThresholdValue.textContent = `${currentSettings.midThreshold} dB`;
  }
  if (elements.highThreshold) {
    elements.highThreshold.value = currentSettings.highThreshold;
    elements.highThresholdValue.textContent = `${currentSettings.highThreshold} dB`;
  }
  // Per-band gains
  if (elements.subGain) {
    elements.subGain.value = currentSettings.subGain;
    elements.subGainValue.textContent = formatGain(currentSettings.subGain);
  }
  if (elements.midGain) {
    elements.midGain.value = currentSettings.midGain;
    elements.midGainValue.textContent = formatGain(currentSettings.midGain);
  }
  if (elements.highGain) {
    elements.highGain.value = currentSettings.highGain;
    elements.highGainValue.textContent = formatGain(currentSettings.highGain);
  }

  // Bass/Treble Cut filters
  if (elements.bassCutFreq) {
    elements.bassCutFreq.value = currentSettings.bassCutFreq;
    elements.bassCutFreqValue.textContent = currentSettings.bassCutFreq <= 20 ? 'Off' : `${currentSettings.bassCutFreq} Hz`;
  }
  if (elements.trebleCutFreq) {
    elements.trebleCutFreq.value = currentSettings.trebleCutFreq;
    const v = currentSettings.trebleCutFreq;
    elements.trebleCutFreqValue.textContent = v >= 20000 ? 'Off' : v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v} Hz`;
  }

  // AI Noise Suppression
  if (elements.noiseSuppressionToggle) {
    elements.noiseSuppressionToggle.checked = currentSettings.noiseSuppressionEnabled;
  }
  if (elements.noiseSuppressionLabel) {
    elements.noiseSuppressionLabel.textContent = currentSettings.noiseSuppressionEnabled ? 'On' : 'Off';
    elements.noiseSuppressionLabel.classList.toggle('active', currentSettings.noiseSuppressionEnabled);
  }

  // Limiter
  if (elements.limiterToggle) {
    elements.limiterToggle.checked = currentSettings.limiterEnabled;
  }
  if (elements.limiterLabel) {
    elements.limiterLabel.textContent = currentSettings.limiterEnabled ? 'On' : 'Off';
    elements.limiterLabel.classList.toggle('active', currentSettings.limiterEnabled);
  }
  if (elements.limiterThreshold) {
    elements.limiterThreshold.value = currentSettings.limiterThreshold;
    elements.limiterThresholdValue.textContent = `${currentSettings.limiterThreshold} dB`;
  }

  // Auto-Gain
  if (elements.autoGainToggle) {
    elements.autoGainToggle.checked = currentSettings.autoGainEnabled;
  }
  if (elements.autoGainLabel) {
    elements.autoGainLabel.textContent = currentSettings.autoGainEnabled ? 'On' : 'Off';
    elements.autoGainLabel.classList.toggle('active', currentSettings.autoGainEnabled);
  }
  if (elements.autoGainTarget) {
    elements.autoGainTarget.value = currentSettings.autoGainTarget;
    elements.autoGainTargetValue.textContent = `${currentSettings.autoGainTarget} dB`;
  }

  // 5-Band EQ controls
  if (elements.eqToggle) {
    elements.eqToggle.checked = currentSettings.eqEnabled;
  }
  if (elements.eqLabel) {
    elements.eqLabel.textContent = currentSettings.eqEnabled ? 'On' : 'Off';
    elements.eqLabel.classList.toggle('active', currentSettings.eqEnabled);
  }
  if (elements.eqControls) {
    elements.eqControls.style.display = currentSettings.eqEnabled ? 'block' : 'none';
  }

  // EQ band sliders
  for (let i = 1; i <= 5; i++) {
    const freqEl = elements[`eq${i}Freq`];
    const freqValEl = elements[`eq${i}FreqValue`];
    const gainEl = elements[`eq${i}Gain`];
    const gainValEl = elements[`eq${i}GainValue`];
    const typeEl = elements[`eq${i}Type`];

    if (freqEl) {
      freqEl.value = currentSettings[`eq${i}Freq`];
      freqValEl.textContent = formatFreq(currentSettings[`eq${i}Freq`]);
    }
    if (gainEl) {
      gainEl.value = currentSettings[`eq${i}Gain`];
      gainValEl.textContent = formatGain(currentSettings[`eq${i}Gain`]);
    }
    if (typeEl) {
      typeEl.value = currentSettings[`eq${i}Type`];
    }
  }

  // Update EQ canvas
  if (currentSettings.eqEnabled && elements.eqCanvas) {
    drawEqCurve();
  }

  updatePresetButtons();
}

function formatGain(value) {
  if (value > 0) return `+${value} dB`;
  if (value < 0) return `${value} dB`;
  return '0 dB';
}

function formatFreq(value) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return `${Math.round(value)} Hz`;
}

function formatNoiseLevel(value) {
  if (value <= 0) return 'Off';
  return `${Math.round(value * 100)}%`;
}

function updateModeDisplay() {
  if (elements.modeToggle) elements.modeToggle.checked = advancedMode;
  if (elements.modeLabel) elements.modeLabel.textContent = advancedMode ? 'Advanced' : 'Simple';
  if (elements.simpleControls) elements.simpleControls.style.display = advancedMode ? 'none' : 'block';
  if (elements.advancedControls) elements.advancedControls.style.display = advancedMode ? 'block' : 'none';
}

function updateMixerAvailability() {
  const mixerSection = document.querySelector('.mixer-section');
  if (mixerSection) {
    if (mixerMode) {
      mixerSection.classList.remove('disabled');
      mixerSection.title = '';
    } else {
      mixerSection.classList.add('disabled');
      mixerSection.title = 'Enable Mixer mode to control multiple tabs';
    }
  }
}

function updateStatusIndicator() {
  const statusEl = elements.status;
  const textEl = statusEl?.querySelector('.status-text');

  if (currentSettings.enabled && isCapturing) {
    statusEl?.classList.add('active');
    if (textEl) textEl.textContent = mixerMode ? 'Mix' : 'On';
  } else {
    statusEl?.classList.remove('active');
    if (textEl) textEl.textContent = 'Off';
  }
}

function updatePresetButtons() {
  elements.presetBtns.forEach(btn => {
    const presetName = btn.dataset.preset;
    const preset = presets[presetName];
    if (!preset) return;

    const isActive = presetKeys.every(key => {
      if (!(key in preset)) return true;
      return currentSettings[key] === preset[key];
    });
    btn.classList.toggle('active', isActive);
  });
}

let tabVolumes = {};

function updateMixerList() {
  if (!elements.mixerList) return;

  const otherTabs = audibleTabs.filter(tab => tab.id !== currentTabId);

  if (elements.mediaCount) {
    elements.mediaCount.textContent = otherTabs.length;
  }

  if (otherTabs.length === 0) {
    elements.mixerList.innerHTML = '<div class="mixer-empty">No other tabs playing audio</div>';
    return;
  }

  const html = otherTabs.map(tab => {
    const isProcessing = processingTabIds.includes(tab.id);
    const statusClass = isProcessing ? 'playing' : '';
    const favicon = tab.favIconUrl || 'icons/icon16.png';
    const title = tab.title || 'Unknown tab';
    const truncatedTitle = title.length > 35 ? title.substring(0, 32) + '...' : title;
    const tabVolume = tabVolumes[tab.id] || 0;

    return `
      <div class="mixer-item" data-tab-id="${tab.id}">
        <div class="mixer-item-header">
          <img src="${favicon}" class="mixer-favicon" onerror="this.src='icons/icon16.png'">
          <span class="mixer-name" title="${title}">${truncatedTitle}</span>
          <span class="mixer-status ${statusClass}">${isProcessing ? '●' : '○'}</span>
        </div>
        <div class="mixer-volume">
          <input type="range" class="mixer-slider" min="-24" max="12" value="${tabVolume}" step="1" data-tab-id="${tab.id}">
          <span class="mixer-value">${formatGain(tabVolume)}</span>
        </div>
      </div>
    `;
  }).join('');

  elements.mixerList.innerHTML = html;

  elements.mixerList.querySelectorAll('.mixer-item-header').forEach(header => {
    header.addEventListener('click', async () => {
      const tabId = parseInt(header.parentElement.dataset.tabId);
      await chrome.tabs.update(tabId, { active: true });
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
    });
  });

  elements.mixerList.querySelectorAll('.mixer-slider').forEach(slider => {
    slider.addEventListener('input', async (e) => {
      const tabId = parseInt(e.target.dataset.tabId);
      const volume = parseInt(e.target.value);
      tabVolumes[tabId] = volume;
      e.target.parentElement.querySelector('.mixer-value').textContent = formatGain(volume);

      await sendToBackground({
        action: 'set-tab-volume',
        tabId,
        volume
      });
    });

    slider.addEventListener('click', (e) => e.stopPropagation());
  });
}

function updateMeter(reductionDb) {
  if (!elements.reductionMeter || !elements.reductionValue) return;
  const percentage = Math.min(100, Math.max(0, (Math.abs(reductionDb) / 30) * 100));
  elements.reductionMeter.style.width = `${percentage}%`;
  elements.reductionValue.textContent = `${reductionDb.toFixed(1)} dB`;
}

function setupEventListeners() {
  elements.enabled.addEventListener('change', (e) => {
    setEnabled(e.target.checked);
  });

  if (elements.modeToggle) {
    elements.modeToggle.addEventListener('change', (e) => {
      advancedMode = e.target.checked;
      updateModeDisplay();
      chrome.storage.local.set({ limitrAdvancedMode: advancedMode });
    });
  }

  if (elements.mixerModeToggle) {
    elements.mixerModeToggle.addEventListener('change', async (e) => {
      const newMixerMode = e.target.checked;

      if (mixerMode && !newMixerMode) {
        await sendToBackground({ action: 'cleanup-tab', tabId: currentTabId });
      }

      await chrome.storage.local.set({ limitrMixerMode: newMixerMode });
      window.location.reload();
    });
  }

  if (elements.crtToggle) {
    elements.crtToggle.addEventListener('change', (e) => {
      setCrtVisual(e.target.checked);
    });
  }

  if (elements.mixerToggle) {
    elements.mixerToggle.addEventListener('click', () => {
      const panel = elements.mixerPanel;
      const isExpanded = panel.style.display !== 'none';
      panel.style.display = isExpanded ? 'none' : 'block';
      elements.mixerToggle.classList.toggle('expanded', !isExpanded);
      if (!isExpanded) refreshAudibleTabs();
    });
  }

  // Simple mode controls
  setupSlider('outputGainSimple', 'outputGain', 'outputGainSimpleValue', formatGain, false);

  // Advanced controls
  setupSlider('threshold', 'threshold', 'thresholdValue', v => `${v} dB`, true);
  setupSlider('ratio', 'ratio', 'ratioValue', v => `${v}:1`, true);
  setupSlider('knee', 'knee', 'kneeValue', v => `${v} dB`, true);
  setupSlider('attack', 'attack', 'attackValue', v => `${v} ms`, true);
  setupSlider('release', 'release', 'releaseValue', v => `${v} ms`, true);
  setupSlider('makeupGain', 'makeupGain', 'makeupGainValue', v => `${v} dB`, true);
  setupSlider('outputGain', 'outputGain', 'outputGainValue', formatGain, false);
  setupSlider('noiseLevel', 'noiseLevel', 'noiseLevelValue', formatNoiseLevel, true);

  if (elements.noiseType) {
    elements.noiseType.addEventListener('change', (e) => {
      currentSettings.noiseType = e.target.value;
      updatePresetButtons();
      updateTabSettings();
    });
  }

  // 3-Band Multiband toggle
  if (elements.multibandToggle) {
    elements.multibandToggle.addEventListener('change', (e) => {
      currentSettings.multibandEnabled = e.target.checked;
      if (e.target.checked) {
        // If enabling multiband, disable global compressor
        currentSettings.compressorEnabled = false;
      } else {
        // If disabling multiband, re-enable global compressor
        currentSettings.compressorEnabled = true;
      }
      updateUI();
      updateTabSettings();
    });
  }

  // Multiband sliders
  setupSlider('crossover1', 'crossover1', 'crossover1Value', v => `${v} Hz`, true);
  setupSlider('crossover2', 'crossover2', 'crossover2Value', v => `${(v/1000).toFixed(1)}k Hz`, true);
  setupSlider('subThreshold', 'subThreshold', 'subThresholdValue', v => `${v} dB`, true);
  setupSlider('midThreshold', 'midThreshold', 'midThresholdValue', v => `${v} dB`, true);
  setupSlider('highThreshold', 'highThreshold', 'highThresholdValue', v => `${v} dB`, true);
  setupSlider('subGain', 'subGain', 'subGainValue', formatGain, true);
  setupSlider('midGain', 'midGain', 'midGainValue', formatGain, true);
  setupSlider('highGain', 'highGain', 'highGainValue', formatGain, true);

  // Bass/Treble Cut filter sliders
  const formatBassCut = v => v <= 20 ? 'Off' : `${v} Hz`;
  const formatTrebleCut = v => v >= 20000 ? 'Off' : v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v} Hz`;
  setupSlider('bassCutFreq', 'bassCutFreq', 'bassCutFreqValue', formatBassCut, true);
  setupSlider('trebleCutFreq', 'trebleCutFreq', 'trebleCutFreqValue', formatTrebleCut, true);

  // AI Noise Suppression toggle
  if (elements.noiseSuppressionToggle) {
    elements.noiseSuppressionToggle.addEventListener('change', (e) => {
      currentSettings.noiseSuppressionEnabled = e.target.checked;
      updateUI();
      updateTabSettings();
    });
  }

  // Limiter toggle and threshold
  if (elements.limiterToggle) {
    elements.limiterToggle.addEventListener('change', (e) => {
      currentSettings.limiterEnabled = e.target.checked;
      updateUI();
      updateTabSettings();
    });
  }
  setupSlider('limiterThreshold', 'limiterThreshold', 'limiterThresholdValue', v => `${v} dB`, true);

  // Auto-Gain toggle and target
  if (elements.autoGainToggle) {
    elements.autoGainToggle.addEventListener('change', (e) => {
      currentSettings.autoGainEnabled = e.target.checked;
      updateUI();
      updateTabSettings();
    });
  }
  setupSlider('autoGainTarget', 'autoGainTarget', 'autoGainTargetValue', v => `${v} dB`, true);

  // 5-Band EQ toggle
  if (elements.eqToggle) {
    elements.eqToggle.addEventListener('change', (e) => {
      currentSettings.eqEnabled = e.target.checked;
      updateUI();
      updateTabSettings();
    });
  }

  // EQ band sliders and dropdowns
  for (let i = 1; i <= 5; i++) {
    setupSlider(`eq${i}Freq`, `eq${i}Freq`, `eq${i}FreqValue`, formatFreq, true);
    setupSlider(`eq${i}Gain`, `eq${i}Gain`, `eq${i}GainValue`, formatGain, true);

    const typeEl = elements[`eq${i}Type`];
    if (typeEl) {
      typeEl.addEventListener('change', (e) => {
        currentSettings[`eq${i}Type`] = e.target.value;
        updatePresetButtons();
        updateTabSettings();
        if (currentSettings.eqEnabled && elements.eqCanvas) {
          drawEqCurve();
        }
      });
    }
  }

  // EQ canvas interaction
  if (elements.eqCanvas) {
    setupEqCanvasInteraction();
  }

  // Preset buttons
  elements.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });
}

function setupSlider(elementId, settingKey, valueId, formatter, updatePresets) {
  const slider = elements[elementId];
  const valueEl = elements[valueId];
  if (!slider) return;

  slider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    currentSettings[settingKey] = value;
    if (valueEl) valueEl.textContent = formatter(value);

    syncControls(settingKey, value);

    if (updatePresets) updatePresetButtons();
    updateTabSettings();

    // Update EQ canvas for relevant settings
    if (settingKey.startsWith('eq') && currentSettings.eqEnabled && elements.eqCanvas) {
      drawEqCurve();
    }
  });
}

function syncControls(key, value) {
  if (key === 'outputGain') {
    if (elements.outputGainSimple) elements.outputGainSimple.value = value;
    if (elements.outputGain) elements.outputGain.value = value;
    if (elements.outputGainSimpleValue) elements.outputGainSimpleValue.textContent = formatGain(value);
    if (elements.outputGainValue) elements.outputGainValue.textContent = formatGain(value);
  }
}

function applyPreset(presetName) {
  const preset = presets[presetName];
  if (!preset) return;

  if (presetName === 'tv90s') {
    const isTvActive = presetKeys.every(key => {
      if (!(key in preset)) return true;
      return currentSettings[key] === preset[key];
    });
    if (isTvActive) {
      toggleCrtVisual();
      return;
    }
  } else {
    if (crtVisualEnabled) {
      setCrtVisual(false);
    }
  }

  const savedOutputGain = currentSettings.outputGain;
  Object.assign(currentSettings, preset);
  currentSettings.outputGain = savedOutputGain;

  updateUI();
  updateTabSettings();
}

function toggleCrtVisual() {
  setCrtVisual(!crtVisualEnabled);
}

async function setCrtVisual(enabled) {
  crtVisualEnabled = enabled;
  try {
    if (enabled) {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ['content.js']
      });
    }
    await chrome.tabs.sendMessage(currentTabId, {
      action: 'set-crt-visual',
      enabled: enabled
    });
    updateTvButtonState();
  } catch (err) {
    console.error('[Limitr] Failed to toggle CRT visual:', err);
  }
}

function updateTvButtonState() {
  if (elements.crtToggle) {
    elements.crtToggle.checked = crtVisualEnabled;
  }
  if (elements.crtLabel) {
    elements.crtLabel.classList.toggle('active', crtVisualEnabled);
  }
  const tvBtn = document.querySelector('[data-preset="tv90s"]');
  if (tvBtn) {
    const descEl = tvBtn.querySelector('.preset-desc');
    if (crtVisualEnabled) {
      tvBtn.classList.add('tv-plus');
      if (descEl) descEl.textContent = 'TV+ active';
    } else {
      tvBtn.classList.remove('tv-plus');
      if (descEl) descEl.textContent = 'Tap twice for TV+';
    }
  }
}

function startReductionPolling() {
  setInterval(async () => {
    if (!isCapturing || !currentTabId) {
      updateMeter(0);
      return;
    }

    try {
      if (mixerMode) {
        const response = await chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'get-reduction',
          tabId: currentTabId
        });
        if (response && response.reduction !== undefined) {
          updateMeter(response.reduction);
        }
      } else {
        const response = await chrome.tabs.sendMessage(currentTabId, {
          action: 'fallback-get-reduction'
        });
        if (response && response.reduction !== undefined) {
          updateMeter(response.reduction);
        }
      }
    } catch (e) {}
  }, 50);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'reduction-update' && message.tabId === currentTabId) {
    updateMeter(message.reduction);
  }
});

// ============ 5-BAND EQ CANVAS VISUALIZATION ============

let eqDragging = null;
let eqHovering = null;

// Band colors for 5-band EQ
const bandColors = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#a855f7'];

function drawEqCurve() {
  const canvas = elements.eqCanvas;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);

  // Draw grid
  ctx.strokeStyle = '#252542';
  ctx.lineWidth = 1;

  // Horizontal grid lines
  const gainLevels = [-12, -6, 0, 6, 12];
  gainLevels.forEach(gain => {
    const y = gainToY(gain, height);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });

  // Vertical grid lines
  const freqMarkers = [100, 300, 1000, 3000, 10000];
  freqMarkers.forEach(freq => {
    const x = freqToX(freq, width);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  });

  // Draw 0dB reference line
  ctx.strokeStyle = '#444466';
  ctx.setLineDash([4, 4]);
  const zeroY = gainToY(0, height);
  ctx.beginPath();
  ctx.moveTo(0, zeroY);
  ctx.lineTo(width, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw composite EQ curve
  ctx.beginPath();
  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth = 2;

  const numPoints = 200;
  for (let i = 0; i <= numPoints; i++) {
    const freq = 20 * Math.pow(20000 / 20, i / numPoints);
    let totalGain = 0;

    // Sum contribution from each EQ band
    for (let b = 1; b <= 5; b++) {
      const bandFreq = currentSettings[`eq${b}Freq`];
      const bandGain = currentSettings[`eq${b}Gain`];
      const bandQ = currentSettings[`eq${b}Q`];
      const bandType = currentSettings[`eq${b}Type`];

      totalGain += calculateFilterResponse(freq, bandFreq, bandGain, bandQ, bandType);
    }

    totalGain = Math.max(-15, Math.min(15, totalGain));
    const x = freqToX(freq, width);
    const y = gainToY(totalGain, height);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // Fill under curve
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(79, 70, 229, 0.3)');
  gradient.addColorStop(1, 'rgba(79, 70, 229, 0.05)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw band nodes (5 bands)
  for (let b = 1; b <= 5; b++) {
    const freq = currentSettings[`eq${b}Freq`];
    const gain = currentSettings[`eq${b}Gain`];
    const x = freqToX(freq, width);
    const y = gainToY(gain, height);
    drawBandNode(ctx, x, y, b, bandColors[b - 1]);
  }

  // Draw frequency labels
  ctx.fillStyle = '#666';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('100', freqToX(100, width), height - 4);
  ctx.fillText('1k', freqToX(1000, width), height - 4);
  ctx.fillText('10k', freqToX(10000, width), height - 4);

  // Draw gain labels
  ctx.textAlign = 'left';
  ctx.fillText('+12', 2, gainToY(12, height) + 3);
  ctx.fillText('0', 2, gainToY(0, height) + 3);
  ctx.fillText('-12', 2, gainToY(-12, height) + 3);
}

// Calculate filter frequency response at a given frequency
function calculateFilterResponse(freq, filterFreq, filterGain, filterQ, filterType) {
  const ratio = freq / filterFreq;
  const logRatio = Math.log2(ratio);

  switch (filterType) {
    case 'highpass':
      if (freq < filterFreq) {
        return -24 * Math.pow(filterFreq / freq, 2) / (1 + Math.pow(filterFreq / freq, 2));
      }
      return 0;

    case 'lowpass':
      if (freq > filterFreq) {
        return -24 * Math.pow(freq / filterFreq, 2) / (1 + Math.pow(freq / filterFreq, 2));
      }
      return 0;

    case 'lowshelf':
      if (freq < filterFreq) {
        return filterGain * (1 - Math.pow(freq / filterFreq, 2));
      }
      return 0;

    case 'highshelf':
      if (freq > filterFreq) {
        return filterGain * (1 - Math.pow(filterFreq / freq, 2));
      }
      return 0;

    case 'notch':
      const notchWidth = 1 / filterQ;
      const notchEffect = Math.exp(-Math.pow(logRatio / notchWidth, 2) * 4);
      return -12 * notchEffect;

    case 'peaking':
    default:
      const bandwidth = 1 / filterQ;
      const bellEffect = Math.exp(-Math.pow(logRatio / bandwidth, 2) * 2);
      return filterGain * bellEffect;
  }
}

function drawBandNode(ctx, x, y, band, color) {
  const isHovered = eqHovering === band;
  const isDragging = eqDragging === band;
  const radius = isDragging ? 10 : (isHovered ? 9 : 7);

  if (isHovered || isDragging) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = color + '40';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Band number label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(band.toString(), x, y);
}

function freqToX(freq, width) {
  const minFreq = 20;
  const maxFreq = 20000;
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logFreq = Math.log10(freq);
  return ((logFreq - logMin) / (logMax - logMin)) * width;
}

function xToFreq(x, width) {
  const minFreq = 20;
  const maxFreq = 20000;
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logFreq = logMin + (x / width) * (logMax - logMin);
  return Math.pow(10, logFreq);
}

function gainToY(gain, height) {
  const minGain = -15;
  const maxGain = 15;
  return height - ((gain - minGain) / (maxGain - minGain)) * height;
}

function yToGain(y, height) {
  const minGain = -15;
  const maxGain = 15;
  return minGain + ((height - y) / height) * (maxGain - minGain);
}

function setupEqCanvasInteraction() {
  const canvas = elements.eqCanvas;
  if (!canvas) return;

  function getNodePositions() {
    const width = canvas.width;
    const height = canvas.height;
    const positions = {};
    for (let b = 1; b <= 5; b++) {
      positions[b] = {
        x: freqToX(currentSettings[`eq${b}Freq`], width),
        y: gainToY(currentSettings[`eq${b}Gain`], height)
      };
    }
    return positions;
  }

  function hitTest(x, y) {
    const nodes = getNodePositions();
    const hitRadius = 15;

    for (const [band, pos] of Object.entries(nodes)) {
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (dist <= hitRadius) return parseInt(band);
    }
    return null;
  }

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  canvas.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);

    if (eqDragging) {
      // X = frequency, Y = gain
      const freq = xToFreq(pos.x, canvas.width);
      const gain = yToGain(pos.y, canvas.height);

      // Clamp values
      const clampedFreq = Math.max(20, Math.min(20000, Math.round(freq)));
      const clampedGain = Math.max(-12, Math.min(12, Math.round(gain)));

      currentSettings[`eq${eqDragging}Freq`] = clampedFreq;
      currentSettings[`eq${eqDragging}Gain`] = clampedGain;

      // Update sliders
      const freqEl = elements[`eq${eqDragging}Freq`];
      const freqValEl = elements[`eq${eqDragging}FreqValue`];
      const gainEl = elements[`eq${eqDragging}Gain`];
      const gainValEl = elements[`eq${eqDragging}GainValue`];

      if (freqEl) freqEl.value = clampedFreq;
      if (freqValEl) freqValEl.textContent = formatFreq(clampedFreq);
      if (gainEl) gainEl.value = clampedGain;
      if (gainValEl) gainValEl.textContent = formatGain(clampedGain);

      drawEqCurve();
      updatePresetButtons();
      updateTabSettings();
    } else {
      const hoveredNode = hitTest(pos.x, pos.y);
      if (hoveredNode !== eqHovering) {
        eqHovering = hoveredNode;
        canvas.style.cursor = hoveredNode ? 'grab' : 'default';
        drawEqCurve();
      }
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);
    const node = hitTest(pos.x, pos.y);
    if (node) {
      eqDragging = node;
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (eqDragging) {
      eqDragging = null;
      canvas.style.cursor = eqHovering ? 'grab' : 'default';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    eqDragging = null;
    eqHovering = null;
    canvas.style.cursor = 'default';
    drawEqCurve();
  });

  // Double-click to reset band
  canvas.addEventListener('dblclick', (e) => {
    const pos = getMousePos(e);
    const node = hitTest(pos.x, pos.y);

    if (node) {
      currentSettings[`eq${node}Gain`] = 0;

      const gainEl = elements[`eq${node}Gain`];
      const gainValEl = elements[`eq${node}GainValue`];
      if (gainEl) gainEl.value = 0;
      if (gainValEl) gainValEl.textContent = formatGain(0);

      drawEqCurve();
      updatePresetButtons();
      updateTabSettings();
    }
  });
}

// Initialize
init();
