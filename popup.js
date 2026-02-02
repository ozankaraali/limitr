// Limitr Popup - TabCapture Version
// Communicates with service worker for per-tab audio processing

// Default settings
const defaults = {
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

// Presets (Off first, then ordered light to heavy)
const presets = {
  off: {
    name: 'Off',
    threshold: 0, ratio: 1, knee: 0, attack: 0, release: 0,
    makeupGain: 0, highpassFreq: 0, lowpassFreq: 22050, noiseLevel: 0, noiseType: 'brown'
  },
  voiceClarity: {
    name: 'Voice Clarity',
    threshold: -30, ratio: 6, knee: 10, attack: 5, release: 150,
    makeupGain: 4, highpassFreq: 80, lowpassFreq: 12000, noiseLevel: 0, noiseType: 'brown'
  },
  normalize: {
    name: 'Normalize',
    threshold: -24, ratio: 8, knee: 12, attack: 5, release: 100,
    makeupGain: 6, highpassFreq: 0, lowpassFreq: 22050, noiseLevel: 0, noiseType: 'brown'
  },
  bassTamer: {
    name: 'Bass Tamer',
    threshold: -30, ratio: 10, knee: 8, attack: 2, release: 100,
    makeupGain: 4, highpassFreq: 120, lowpassFreq: 22050, noiseLevel: 0, noiseType: 'brown'
  },
  nightMode: {
    name: 'Night Mode',
    threshold: -40, ratio: 15, knee: 6, attack: 1, release: 50,
    makeupGain: 6, highpassFreq: 120, lowpassFreq: 22050, noiseLevel: 0, noiseType: 'brown'
  },
  tv90s: {
    name: '90s TV',
    threshold: -35, ratio: 15, knee: 6, attack: 2, release: 100,
    makeupGain: 5, highpassFreq: 200, lowpassFreq: 8000, noiseLevel: 0.15, noiseType: 'brown'
  }
};

const presetKeys = ['threshold', 'ratio', 'knee', 'attack', 'release', 'makeupGain', 'highpassFreq', 'lowpassFreq', 'noiseLevel', 'noiseType'];

// State
let elements = {};
let currentTabId = null;
let currentSettings = { ...defaults };
let advancedMode = false;
let isCapturing = false;
let audibleTabs = [];
let processingTabIds = [];
let crtVisualEnabled = false;
let mixerMode = false; // true = tabCapture (mixer), false = content script (default, fullscreen works)

// Initialize
async function init() {
  // Get DOM elements
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
    bassCut: document.getElementById('bassCut'),
    bassCutValue: document.getElementById('bassCutValue'),
    trebleCut: document.getElementById('trebleCut'),
    trebleCutValue: document.getElementById('trebleCutValue'),
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
    highpassFreq: document.getElementById('highpassFreq'),
    highpassFreqValue: document.getElementById('highpassFreqValue'),
    lowpassFreq: document.getElementById('lowpassFreq'),
    lowpassFreqValue: document.getElementById('lowpassFreqValue'),
    noiseLevel: document.getElementById('noiseLevel'),
    noiseLevelValue: document.getElementById('noiseLevelValue'),
    noiseType: document.getElementById('noiseType'),
    reductionMeter: document.getElementById('reductionMeter'),
    reductionValue: document.getElementById('reductionValue'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    mixerToggle: document.getElementById('mixerToggle'),
    mixerPanel: document.getElementById('mixerPanel'),
    mixerList: document.getElementById('mixerList'),
    mediaCount: document.getElementById('mediaCount')
  };

  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id;

  // Load UI preferences
  const stored = await chrome.storage.local.get(['limitrAdvancedMode', 'limitrMixerMode']);
  advancedMode = stored.limitrAdvancedMode || false;
  mixerMode = stored.limitrMixerMode || false;

  // Update mixer mode toggle
  if (elements.mixerModeToggle) {
    elements.mixerModeToggle.checked = mixerMode;
  }

  // Update mixer section visibility
  updateMixerAvailability();

  if (mixerMode) {
    // Mixer mode: use tabCapture (multi-tab, no fullscreen)
    const stateResponse = await sendToBackground({ action: 'get-state', tabId: currentTabId });
    if (stateResponse.success && stateResponse.state) {
      currentSettings = { ...defaults, ...stateResponse.state.settings };
      isCapturing = true;
    } else {
      await initCapture();
    }
  } else {
    // Default mode: use content script (single tab, fullscreen works)
    await initFallbackCapture();
  }

  // Update UI
  updateUI();
  updateModeDisplay();
  updateStatusIndicator();

  // Setup event listeners
  setupEventListeners();

  // Check if TV+ was active (content script injected) - try to get state
  try {
    const crtResponse = await chrome.tabs.sendMessage(currentTabId, { action: 'get-crt-visual' });
    if (crtResponse && crtResponse.enabled) {
      crtVisualEnabled = true;
      updateTvButtonState();
    }
  } catch (err) {
    // Content script not injected yet - that's fine, TV+ not active
  }

  // Load audible tabs for mixer
  await refreshAudibleTabs();

  // Start reduction meter polling
  startReductionPolling();
}

// Send message to background service worker
async function sendToBackground(message) {
  return chrome.runtime.sendMessage({ ...message, target: 'background' });
}

// Initialize audio capture for current tab
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

// Initialize fallback capture (content script, fullscreen compatible)
async function initFallbackCapture() {
  if (!currentTabId) return false;

  try {
    // Check if content script is already injected
    let alreadyInjected = false;
    try {
      const response = await chrome.tabs.sendMessage(currentTabId, { action: 'fallback-ping' });
      if (response && response.active) {
        alreadyInjected = true;
        isCapturing = true;
        // Load current settings from content script
        if (response.settings) {
          currentSettings = { ...defaults, ...response.settings };
        }
      }
    } catch (e) {
      // Not injected yet
    }

    if (!alreadyInjected) {
      // Inject the fallback audio content script
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ['content-audio.js']
      });
      isCapturing = true;

      // Wait a moment for script to initialize, then sync settings
      await new Promise(resolve => setTimeout(resolve, 100));

      // Load settings from storage if available
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

// Update settings for fallback mode
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

// Update settings on current tab
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

// Enable/disable processing
async function setEnabled(enabled) {
  currentSettings.enabled = enabled;

  if (enabled && !isCapturing) {
    // Start capture if not already capturing
    await initCapture();
  } else if (isCapturing) {
    // Update enabled state
    await sendToBackground({
      action: 'set-enabled',
      tabId: currentTabId,
      enabled: enabled
    });
  }

  updateStatusIndicator();
}

// Refresh list of audible tabs
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

    // Fetch actual volumes from all processing tabs
    const volumesResponse = await sendToBackground({ action: 'get-all-volumes' });
    if (volumesResponse.success && volumesResponse.volumes) {
      // Sync local tabVolumes with actual values
      for (const [tabId, volume] of Object.entries(volumesResponse.volumes)) {
        tabVolumes[parseInt(tabId)] = volume;
      }
    }

    updateMixerList();
  } catch (error) {
    console.error('Error refreshing tabs:', error);
  }
}

// Update UI from current settings
function updateUI() {
  elements.enabled.checked = currentSettings.enabled;

  // Simple mode controls
  if (elements.outputGainSimple) {
    elements.outputGainSimple.value = currentSettings.outputGain;
    elements.outputGainSimpleValue.textContent = formatGain(currentSettings.outputGain);
  }
  if (elements.bassCut) {
    elements.bassCut.value = currentSettings.highpassFreq;
    elements.bassCutValue.textContent = currentSettings.highpassFreq > 0
      ? `${currentSettings.highpassFreq} Hz` : 'Off';
  }
  if (elements.trebleCut) {
    elements.trebleCut.value = currentSettings.lowpassFreq;
    elements.trebleCutValue.textContent = currentSettings.lowpassFreq < 22050
      ? `${(currentSettings.lowpassFreq / 1000).toFixed(1)}k Hz` : 'Off';
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
  if (elements.highpassFreq) {
    elements.highpassFreq.value = currentSettings.highpassFreq;
    elements.highpassFreqValue.textContent = currentSettings.highpassFreq > 0
      ? `${currentSettings.highpassFreq} Hz` : 'Off';
  }
  if (elements.lowpassFreq) {
    elements.lowpassFreq.value = currentSettings.lowpassFreq;
    elements.lowpassFreqValue.textContent = currentSettings.lowpassFreq < 22050
      ? `${(currentSettings.lowpassFreq / 1000).toFixed(1)}k Hz` : 'Off';
  }
  if (elements.noiseLevel) {
    elements.noiseLevel.value = currentSettings.noiseLevel;
    elements.noiseLevelValue.textContent = formatNoiseLevel(currentSettings.noiseLevel);
  }
  if (elements.noiseType) {
    elements.noiseType.value = currentSettings.noiseType || 'brown';
  }

  updatePresetButtons();
}

function formatGain(value) {
  if (value > 0) return `+${value} dB`;
  if (value < 0) return `${value} dB`;
  return '0 dB';
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

    const isActive = presetKeys.every(key => currentSettings[key] === preset[key]);
    btn.classList.toggle('active', isActive);
  });
}

// Per-tab volume state (in dB)
let tabVolumes = {};

// Update mixer list with OTHER audible tabs (not current tab)
function updateMixerList() {
  if (!elements.mixerList) return;

  // Filter out current tab - Output Volume already controls it
  const otherTabs = audibleTabs.filter(tab => tab.id !== currentTabId);

  // Update count (only other tabs)
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

  // Add click handlers on header to switch to that tab
  elements.mixerList.querySelectorAll('.mixer-item-header').forEach(header => {
    header.addEventListener('click', async () => {
      const tabId = parseInt(header.parentElement.dataset.tabId);
      await chrome.tabs.update(tabId, { active: true });
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
    });
  });

  // Add slider event handlers for per-tab volume
  elements.mixerList.querySelectorAll('.mixer-slider').forEach(slider => {
    slider.addEventListener('input', async (e) => {
      const tabId = parseInt(e.target.dataset.tabId);
      const volume = parseInt(e.target.value);
      tabVolumes[tabId] = volume;
      e.target.parentElement.querySelector('.mixer-value').textContent = formatGain(volume);

      // Update per-tab volume via background
      await sendToBackground({
        action: 'set-tab-volume',
        tabId,
        volume
      });
    });

    // Prevent click from bubbling to parent (don't switch tabs when adjusting slider)
    slider.addEventListener('click', (e) => e.stopPropagation());
  });
}

function updateMeter(reductionDb) {
  if (!elements.reductionMeter || !elements.reductionValue) return;
  const percentage = Math.min(100, Math.max(0, (Math.abs(reductionDb) / 30) * 100));
  elements.reductionMeter.style.width = `${percentage}%`;
  elements.reductionValue.textContent = `${reductionDb.toFixed(1)} dB`;
}

// Setup event listeners
function setupEventListeners() {
  // Enable toggle
  elements.enabled.addEventListener('change', (e) => {
    setEnabled(e.target.checked);
  });

  // Mode toggle
  if (elements.modeToggle) {
    elements.modeToggle.addEventListener('change', (e) => {
      advancedMode = e.target.checked;
      updateModeDisplay();
      chrome.storage.local.set({ limitrAdvancedMode: advancedMode });
    });
  }

  // Mixer mode toggle
  if (elements.mixerModeToggle) {
    elements.mixerModeToggle.addEventListener('change', async (e) => {
      const newMixerMode = e.target.checked;

      // Cleanup current mode before switching
      if (mixerMode && !newMixerMode) {
        // Switching FROM mixer mode TO default - cleanup tabCapture
        await sendToBackground({ action: 'cleanup-tab', tabId: currentTabId });
      }

      await chrome.storage.local.set({ limitrMixerMode: newMixerMode });
      // Reload popup to switch modes cleanly
      window.location.reload();
    });
  }

  // Mixer toggle
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
  setupSlider('bassCut', 'highpassFreq', 'bassCutValue', v => v > 0 ? `${v} Hz` : 'Off', true);
  setupSlider('trebleCut', 'lowpassFreq', 'trebleCutValue', v => v < 22050 ? `${(v/1000).toFixed(1)}k Hz` : 'Off', true);

  // Advanced controls
  setupSlider('threshold', 'threshold', 'thresholdValue', v => `${v} dB`, true);
  setupSlider('ratio', 'ratio', 'ratioValue', v => `${v}:1`, true);
  setupSlider('knee', 'knee', 'kneeValue', v => `${v} dB`, true);
  setupSlider('attack', 'attack', 'attackValue', v => `${v} ms`, true);
  setupSlider('release', 'release', 'releaseValue', v => `${v} ms`, true);
  setupSlider('makeupGain', 'makeupGain', 'makeupGainValue', v => `${v} dB`, true);
  setupSlider('outputGain', 'outputGain', 'outputGainValue', formatGain, false);
  setupSlider('highpassFreq', 'highpassFreq', 'highpassFreqValue', v => v > 0 ? `${v} Hz` : 'Off', true);
  setupSlider('lowpassFreq', 'lowpassFreq', 'lowpassFreqValue', v => v < 22050 ? `${(v/1000).toFixed(1)}k Hz` : 'Off', true);
  setupSlider('noiseLevel', 'noiseLevel', 'noiseLevelValue', formatNoiseLevel, true);

  // Noise type dropdown
  if (elements.noiseType) {
    elements.noiseType.addEventListener('change', (e) => {
      currentSettings.noiseType = e.target.value;
      updatePresetButtons();
      updateTabSettings();
    });
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

    // Sync simple/advanced controls
    syncControls(settingKey, value);

    if (updatePresets) updatePresetButtons();
    updateTabSettings();
  });
}

function syncControls(key, value) {
  // Sync outputGain between simple and advanced
  if (key === 'outputGain') {
    if (elements.outputGainSimple) elements.outputGainSimple.value = value;
    if (elements.outputGain) elements.outputGain.value = value;
    if (elements.outputGainSimpleValue) elements.outputGainSimpleValue.textContent = formatGain(value);
    if (elements.outputGainValue) elements.outputGainValue.textContent = formatGain(value);
  }
  // Sync highpassFreq / bassCut
  if (key === 'highpassFreq') {
    if (elements.bassCut) elements.bassCut.value = value;
    if (elements.highpassFreq) elements.highpassFreq.value = value;
    const text = value > 0 ? `${value} Hz` : 'Off';
    if (elements.bassCutValue) elements.bassCutValue.textContent = text;
    if (elements.highpassFreqValue) elements.highpassFreqValue.textContent = text;
  }
  // Sync lowpassFreq / trebleCut
  if (key === 'lowpassFreq') {
    if (elements.trebleCut) elements.trebleCut.value = value;
    if (elements.lowpassFreq) elements.lowpassFreq.value = value;
    const text = value < 22050 ? `${(value/1000).toFixed(1)}k Hz` : 'Off';
    if (elements.trebleCutValue) elements.trebleCutValue.textContent = text;
    if (elements.lowpassFreqValue) elements.lowpassFreqValue.textContent = text;
  }
}

function applyPreset(presetName) {
  const preset = presets[presetName];
  if (!preset) return;

  // TV+ mode: if TV preset is already active, toggle CRT visual
  if (presetName === 'tv90s') {
    const isTvActive = presetKeys.every(key => currentSettings[key] === preset[key]);
    if (isTvActive) {
      toggleCrtVisual();
      return;
    }
  } else {
    // Switching away from TV preset - disable CRT visual
    if (crtVisualEnabled) {
      setCrtVisual(false);
    }
  }

  // Apply preset but preserve outputGain
  const savedOutputGain = currentSettings.outputGain;
  Object.assign(currentSettings, preset);
  currentSettings.outputGain = savedOutputGain;

  updateUI();
  updateTabSettings();
}

// Toggle CRT visual effect
function toggleCrtVisual() {
  setCrtVisual(!crtVisualEnabled);
}

// Set CRT visual effect state
async function setCrtVisual(enabled) {
  crtVisualEnabled = enabled;
  try {
    if (enabled) {
      // Inject content script on-demand (only when TV+ is activated)
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ['content.js']
      });
    }
    // Send message to toggle the effect
    await chrome.tabs.sendMessage(currentTabId, {
      action: 'set-crt-visual',
      enabled: enabled
    });
    updateTvButtonState();
  } catch (err) {
    console.error('[Limitr] Failed to toggle CRT visual:', err);
  }
}

// Update TV button appearance for TV+ mode
function updateTvButtonState() {
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

// Poll for reduction meter updates
function startReductionPolling() {
  setInterval(async () => {
    if (!isCapturing || !currentTabId) {
      updateMeter(0);
      return;
    }

    try {
      if (mixerMode) {
        // Mixer mode: get reduction from offscreen document
        const response = await chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'get-reduction',
          tabId: currentTabId
        });
        if (response && response.reduction !== undefined) {
          updateMeter(response.reduction);
        }
      } else {
        // Default mode: get reduction from content script
        const response = await chrome.tabs.sendMessage(currentTabId, {
          action: 'fallback-get-reduction'
        });
        if (response && response.reduction !== undefined) {
          updateMeter(response.reduction);
        }
      }
    } catch (e) {
      // Document might not exist yet
    }
  }, 50);
}

// Listen for reduction updates from offscreen
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'reduction-update' && message.tabId === currentTabId) {
    updateMeter(message.reduction);
  }
});

// Initialize
init();
