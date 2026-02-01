// Default settings
const defaults = {
  enabled: false,
  threshold: -24,
  ratio: 8,
  knee: 12,
  attack: 5,
  release: 100,
  makeupGain: 0,
  outputGain: 0,
  highpassFreq: 0,
  lowpassFreq: 20000,
  highpassEnabled: false,
  lowpassEnabled: false
};

// User-friendly presets with descriptions (ordered light to heavy)
// Note: outputGain is NOT included - user's output volume is preserved across presets
const presets = {
  music: {
    name: 'Music',
    description: 'Light touch for music videos',
    threshold: -18,
    ratio: 3,
    knee: 20,
    attack: 10,
    release: 200,
    makeupGain: 2,
    highpassFreq: 0,
    lowpassFreq: 20000,
    highpassEnabled: false,
    lowpassEnabled: false
  },
  voiceClarity: {
    name: 'Voice Clarity',
    description: 'Optimize for speech and podcasts',
    threshold: -30,
    ratio: 6,
    knee: 10,
    attack: 5,
    release: 150,
    makeupGain: 4,
    highpassFreq: 80,
    lowpassFreq: 12000,
    highpassEnabled: true,
    lowpassEnabled: true
  },
  normalize: {
    name: 'Normalize',
    description: 'Balanced volume across all content',
    threshold: -24,
    ratio: 8,
    knee: 12,
    attack: 5,
    release: 100,
    makeupGain: 6,
    highpassFreq: 0,
    lowpassFreq: 20000,
    highpassEnabled: false,
    lowpassEnabled: false
  },
  bassTamer: {
    name: 'Bass Tamer',
    description: 'Reduce boomy bass with moderate limiting',
    threshold: -30,
    ratio: 10,
    knee: 8,
    attack: 2,
    release: 100,
    makeupGain: 4,
    highpassFreq: 120,
    lowpassFreq: 20000,
    highpassEnabled: true,
    lowpassEnabled: false
  },
  nightMode: {
    name: 'Night Mode',
    description: 'Heavy limiting + bass cut for late-night',
    threshold: -40,
    ratio: 15,
    knee: 6,
    attack: 1,
    release: 50,
    makeupGain: 6,
    highpassFreq: 120,
    lowpassFreq: 20000,
    highpassEnabled: true,
    lowpassEnabled: false
  },
  tv90s: {
    name: '90s TV',
    description: 'Flat, warm sound like old CRT speakers',
    threshold: -35,
    ratio: 15,
    knee: 6,
    attack: 2,
    release: 100,
    makeupGain: 5,
    highpassFreq: 200,
    lowpassFreq: 8000,
    highpassEnabled: true,
    lowpassEnabled: true
  }
};

// Keys to check for preset matching (excludes outputGain - that's independent)
const presetKeys = ['threshold', 'ratio', 'knee', 'attack', 'release', 'makeupGain',
  'highpassFreq', 'lowpassFreq', 'highpassEnabled', 'lowpassEnabled'];

// UI Elements (will be populated after DOM loads)
let elements = {};

// State
let currentSettings = { ...defaults };
let advancedMode = false;
let mixerExpanded = false;
let meterInterval = null;
let currentMediaList = [];
let isSliderActive = false; // Don't update while user is dragging

// Initialize
async function init() {
  // Get DOM elements
  elements = {
    enabled: document.getElementById('enabled'),
    status: document.getElementById('status'),
    modeToggle: document.getElementById('modeToggle'),
    modeLabel: document.getElementById('modeLabel'),
    simpleControls: document.getElementById('simpleControls'),
    advancedControls: document.getElementById('advancedControls'),
    // Simple mode controls
    outputGainSimple: document.getElementById('outputGainSimple'),
    outputGainSimpleValue: document.getElementById('outputGainSimpleValue'),
    bassCut: document.getElementById('bassCut'),
    bassCutValue: document.getElementById('bassCutValue'),
    trebleCut: document.getElementById('trebleCut'),
    trebleCutValue: document.getElementById('trebleCutValue'),
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
    highpassFreq: document.getElementById('highpassFreq'),
    highpassFreqValue: document.getElementById('highpassFreqValue'),
    lowpassFreq: document.getElementById('lowpassFreq'),
    lowpassFreqValue: document.getElementById('lowpassFreqValue'),
    // Meter and presets
    reductionMeter: document.getElementById('reductionMeter'),
    reductionValue: document.getElementById('reductionValue'),
    mediaCount: document.getElementById('mediaCount'),
    presetsSimple: document.getElementById('presetsSimple'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    // Mixer
    mixerToggle: document.getElementById('mixerToggle'),
    mixerPanel: document.getElementById('mixerPanel'),
    mixerList: document.getElementById('mixerList')
  };

  // Load saved settings and mode
  const stored = await chrome.storage.local.get(['limitrSettings', 'limitrAdvancedMode', 'limitrMixerExpanded']);
  if (stored.limitrSettings) {
    currentSettings = { ...defaults, ...stored.limitrSettings };
  }
  advancedMode = stored.limitrAdvancedMode || false;
  mixerExpanded = stored.limitrMixerExpanded || false;

  // Update UI with loaded settings
  updateUI();
  updateModeDisplay();
  updateMixerDisplay();

  // Set up event listeners
  setupEventListeners();

  // Start meter polling
  startMeterPolling();

  // Get initial status from content script
  queryContentScript({ type: 'GET_STATUS' });
}

// Update UI from current settings
function updateUI() {
  elements.enabled.checked = currentSettings.enabled;
  updateStatusIndicator();

  // Simple mode controls
  if (elements.outputGainSimple) {
    elements.outputGainSimple.value = currentSettings.outputGain;
    elements.outputGainSimpleValue.textContent = formatGain(currentSettings.outputGain);
  }
  if (elements.bassCut) {
    elements.bassCut.value = currentSettings.highpassEnabled ? currentSettings.highpassFreq : 0;
    elements.bassCutValue.textContent = currentSettings.highpassEnabled && currentSettings.highpassFreq > 0
      ? `${currentSettings.highpassFreq} Hz` : 'Off';
  }
  if (elements.trebleCut) {
    elements.trebleCut.value = currentSettings.lowpassEnabled ? currentSettings.lowpassFreq : 20000;
    elements.trebleCutValue.textContent = currentSettings.lowpassEnabled && currentSettings.lowpassFreq < 20000
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
    elements.lowpassFreqValue.textContent = currentSettings.lowpassFreq < 20000
      ? `${(currentSettings.lowpassFreq / 1000).toFixed(1)}k Hz` : 'Off';
  }

  // Update active preset button
  updatePresetButtons();
}

// Format gain value with sign
function formatGain(value) {
  if (value > 0) return `+${value} dB`;
  if (value < 0) return `${value} dB`;
  return '0 dB';
}

// Update mode display (simple vs advanced)
function updateModeDisplay() {
  if (elements.modeToggle) {
    elements.modeToggle.checked = advancedMode;
  }
  if (elements.modeLabel) {
    elements.modeLabel.textContent = advancedMode ? 'Advanced' : 'Simple';
  }
  if (elements.simpleControls) {
    elements.simpleControls.style.display = advancedMode ? 'none' : 'block';
  }
  if (elements.advancedControls) {
    elements.advancedControls.style.display = advancedMode ? 'block' : 'none';
  }
}

// Update mixer panel display
function updateMixerDisplay() {
  if (elements.mixerToggle) {
    elements.mixerToggle.classList.toggle('expanded', mixerExpanded);
  }
  if (elements.mixerPanel) {
    elements.mixerPanel.style.display = mixerExpanded ? 'block' : 'none';
  }
}

// Update status indicator
function updateStatusIndicator() {
  if (currentSettings.enabled) {
    elements.status.classList.add('active');
    elements.status.querySelector('.status-text').textContent = 'Active';
  } else {
    elements.status.classList.remove('active');
    elements.status.querySelector('.status-text').textContent = 'Inactive';
  }
}

// Update preset button states
function updatePresetButtons() {
  elements.presetBtns.forEach(btn => {
    const presetName = btn.dataset.preset;
    const preset = presets[presetName];
    if (!preset) return;

    // Check if all preset values match current settings (excluding outputGain)
    const isActive = presetKeys.every(key => currentSettings[key] === preset[key]);
    btn.classList.toggle('active', isActive);
  });
}

// Update mixer list with media from current tab
function updateMixerList(mediaList) {
  if (!elements.mixerList) return;

  currentMediaList = mediaList || [];

  // Update media count
  if (elements.mediaCount) {
    elements.mediaCount.textContent = currentMediaList.length;
  }

  // Don't update DOM while user is dragging a slider
  if (isSliderActive) return;

  if (currentMediaList.length === 0) {
    elements.mixerList.innerHTML = '<div class="mixer-empty">No media detected<br><span style="font-size: 9px; opacity: 0.7;">Embedded players (iframes) not supported</span></div>';
    return;
  }

  // Build mixer HTML
  const html = currentMediaList.map(media => {
    const icon = media.tagName === 'VIDEO' ? 'V' : 'A';
    const statusClass = media.paused ? 'paused' : 'playing';
    const displayName = media.displayName || 'Media';
    const truncatedName = displayName.length > 25 ? displayName.substring(0, 22) + '...' : displayName;

    return `
      <div class="mixer-item" data-media-id="${media.id}">
        <div class="mixer-item-header">
          <span class="mixer-icon ${statusClass}">${icon}</span>
          <span class="mixer-name" title="${displayName}">${truncatedName}</span>
        </div>
        <div class="mixer-volume">
          <input type="range" class="mixer-slider" min="-24" max="12" value="${media.volume || 0}" step="1" data-media-id="${media.id}">
          <span class="mixer-value">${formatGain(media.volume || 0)}</span>
        </div>
      </div>
    `;
  }).join('');

  elements.mixerList.innerHTML = html;

  // Add event listeners to sliders
  elements.mixerList.querySelectorAll('.mixer-slider').forEach(slider => {
    slider.addEventListener('mousedown', () => { isSliderActive = true; });
    slider.addEventListener('mouseup', () => { isSliderActive = false; });
    slider.addEventListener('mouseleave', () => { isSliderActive = false; });

    slider.addEventListener('input', (e) => {
      const mediaId = e.target.dataset.mediaId;
      const volume = parseInt(e.target.value);

      // Update display
      e.target.parentElement.querySelector('.mixer-value').textContent = formatGain(volume);

      // Update stored value
      const media = currentMediaList.find(m => m.id === mediaId);
      if (media) media.volume = volume;

      // Send to content script
      sendToContentScript({
        type: 'SET_MEDIA_VOLUME',
        mediaId: mediaId,
        volume: volume
      });
    });
  });
}

// Set up event listeners
function setupEventListeners() {
  // Enable toggle
  elements.enabled.addEventListener('change', (e) => {
    currentSettings.enabled = e.target.checked;
    updateStatusIndicator();
    saveAndApply();
  });

  // Mode toggle
  if (elements.modeToggle) {
    elements.modeToggle.addEventListener('change', (e) => {
      advancedMode = e.target.checked;
      updateModeDisplay();
      chrome.storage.local.set({ limitrAdvancedMode: advancedMode });
    });
  }

  // Mixer toggle
  if (elements.mixerToggle) {
    elements.mixerToggle.addEventListener('click', () => {
      mixerExpanded = !mixerExpanded;
      updateMixerDisplay();
      chrome.storage.local.set({ limitrMixerExpanded: mixerExpanded });
    });
  }

  // Simple mode controls
  if (elements.outputGainSimple) {
    elements.outputGainSimple.addEventListener('input', (e) => {
      currentSettings.outputGain = parseInt(e.target.value);
      elements.outputGainSimpleValue.textContent = formatGain(currentSettings.outputGain);
      // Sync with advanced control
      if (elements.outputGain) {
        elements.outputGain.value = currentSettings.outputGain;
        elements.outputGainValue.textContent = formatGain(currentSettings.outputGain);
      }
      saveAndApply();
    });
  }

  if (elements.bassCut) {
    elements.bassCut.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentSettings.highpassFreq = value;
      currentSettings.highpassEnabled = value > 0;
      elements.bassCutValue.textContent = value > 0 ? `${value} Hz` : 'Off';
      // Sync with advanced control
      if (elements.highpassFreq) {
        elements.highpassFreq.value = value;
        elements.highpassFreqValue.textContent = value > 0 ? `${value} Hz` : 'Off';
      }
      updatePresetButtons();
      saveAndApply();
    });
  }

  if (elements.trebleCut) {
    elements.trebleCut.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentSettings.lowpassFreq = value;
      currentSettings.lowpassEnabled = value < 20000;
      elements.trebleCutValue.textContent = value < 20000
        ? `${(value / 1000).toFixed(1)}k Hz` : 'Off';
      // Sync with advanced control
      if (elements.lowpassFreq) {
        elements.lowpassFreq.value = value;
        elements.lowpassFreqValue.textContent = value < 20000
          ? `${(value / 1000).toFixed(1)}k Hz` : 'Off';
      }
      updatePresetButtons();
      saveAndApply();
    });
  }

  // Advanced controls
  if (elements.threshold) {
    elements.threshold.addEventListener('input', (e) => {
      currentSettings.threshold = parseInt(e.target.value);
      elements.thresholdValue.textContent = `${currentSettings.threshold} dB`;
      updatePresetButtons();
      saveAndApply();
    });
  }

  if (elements.ratio) {
    elements.ratio.addEventListener('input', (e) => {
      currentSettings.ratio = parseFloat(e.target.value);
      elements.ratioValue.textContent = `${currentSettings.ratio}:1`;
      updatePresetButtons();
      saveAndApply();
    });
  }

  if (elements.knee) {
    elements.knee.addEventListener('input', (e) => {
      currentSettings.knee = parseInt(e.target.value);
      elements.kneeValue.textContent = `${currentSettings.knee} dB`;
      updatePresetButtons();
      saveAndApply();
    });
  }

  if (elements.attack) {
    elements.attack.addEventListener('input', (e) => {
      currentSettings.attack = parseInt(e.target.value);
      elements.attackValue.textContent = `${currentSettings.attack} ms`;
      updatePresetButtons();
      saveAndApply();
    });
  }

  if (elements.release) {
    elements.release.addEventListener('input', (e) => {
      currentSettings.release = parseInt(e.target.value);
      elements.releaseValue.textContent = `${currentSettings.release} ms`;
      updatePresetButtons();
      saveAndApply();
    });
  }

  if (elements.makeupGain) {
    elements.makeupGain.addEventListener('input', (e) => {
      currentSettings.makeupGain = parseInt(e.target.value);
      elements.makeupGainValue.textContent = `${currentSettings.makeupGain} dB`;
      updatePresetButtons();
      saveAndApply();
    });
  }

  if (elements.outputGain) {
    elements.outputGain.addEventListener('input', (e) => {
      currentSettings.outputGain = parseInt(e.target.value);
      elements.outputGainValue.textContent = formatGain(currentSettings.outputGain);
      // Sync with simple control
      if (elements.outputGainSimple) {
        elements.outputGainSimple.value = currentSettings.outputGain;
        elements.outputGainSimpleValue.textContent = formatGain(currentSettings.outputGain);
      }
      saveAndApply();
    });
  }

  if (elements.highpassFreq) {
    elements.highpassFreq.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentSettings.highpassFreq = value;
      currentSettings.highpassEnabled = value > 0;
      elements.highpassFreqValue.textContent = value > 0 ? `${value} Hz` : 'Off';
      // Sync with simple control
      if (elements.bassCut) {
        elements.bassCut.value = value;
        elements.bassCutValue.textContent = value > 0 ? `${value} Hz` : 'Off';
      }
      updatePresetButtons();
      saveAndApply();
    });
  }

  if (elements.lowpassFreq) {
    elements.lowpassFreq.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentSettings.lowpassFreq = value;
      currentSettings.lowpassEnabled = value < 20000;
      elements.lowpassFreqValue.textContent = value < 20000
        ? `${(value / 1000).toFixed(1)}k Hz` : 'Off';
      // Sync with simple control
      if (elements.trebleCut) {
        elements.trebleCut.value = value;
        elements.trebleCutValue.textContent = value < 20000
          ? `${(value / 1000).toFixed(1)}k Hz` : 'Off';
      }
      updatePresetButtons();
      saveAndApply();
    });
  }

  // Preset buttons
  elements.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const presetName = btn.dataset.preset;
      applyPreset(presetName);
    });
  });
}

// Apply a preset (preserves outputGain)
function applyPreset(presetName) {
  const preset = presets[presetName];
  if (!preset) return;

  // Apply preset values but preserve outputGain
  const { name, description, ...presetValues } = preset;
  Object.assign(currentSettings, presetValues);
  // Note: outputGain is NOT in preset, so it stays unchanged

  updateUI();
  saveAndApply();
}

// Save settings and apply to content script
async function saveAndApply() {
  // Save to storage
  await chrome.storage.local.set({ limitrSettings: currentSettings });

  // Send to content script
  sendToContentScript({
    type: 'UPDATE_SETTINGS',
    settings: currentSettings
  });
}

// Send message to content script
async function sendToContentScript(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, message);
    }
  } catch (e) {
    // Content script might not be loaded yet
  }
}

// Query content script
async function queryContentScript(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not available
          return;
        }
        if (response) {
          handleContentResponse(response);
        }
      });
    }
  } catch (e) {
    // Content script might not be loaded
  }
}

// Handle responses from content script
function handleContentResponse(response) {
  if (response.reduction !== undefined) {
    updateMeter(response.reduction);
  }
  if (response.mediaList !== undefined) {
    updateMixerList(response.mediaList);
  }
  if (response.mediaCount !== undefined && elements.mediaCount) {
    elements.mediaCount.textContent = response.mediaCount;
  }
}

// Update gain reduction meter
function updateMeter(reductionDb) {
  // Clamp and convert to percentage (0 to -30 dB range)
  const percentage = Math.min(100, Math.max(0, (Math.abs(reductionDb) / 30) * 100));
  elements.reductionMeter.style.width = `${percentage}%`;
  elements.reductionValue.textContent = `${reductionDb.toFixed(1)} dB`;
}

// Start polling for meter and media data from current tab
function startMeterPolling() {
  // Poll every 150ms - balances meter responsiveness with performance
  meterInterval = setInterval(() => {
    queryContentScript({ type: 'GET_METER' });
  }, 150);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'METER_UPDATE') {
    updateMeter(message.reduction);
  }
  if (message.type === 'MEDIA_COUNT') {
    elements.mediaCount.textContent = `${message.count} media element${message.count !== 1 ? 's' : ''}`;
  }
});

// Clean up on popup close
window.addEventListener('unload', () => {
  if (meterInterval) {
    clearInterval(meterInterval);
  }
});

// Initialize
init();
