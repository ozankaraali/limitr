// Default settings
const defaults = {
  enabled: false,
  threshold: -24,
  ratio: 8,
  knee: 12,
  attack: 5,
  release: 100,
  makeupGain: 0
};

// Presets
const presets = {
  gentle: {
    threshold: -18,
    ratio: 3,
    knee: 20,
    attack: 10,
    release: 200,
    makeupGain: 3
  },
  moderate: {
    threshold: -24,
    ratio: 8,
    knee: 12,
    attack: 5,
    release: 100,
    makeupGain: 6
  },
  aggressive: {
    threshold: -35,
    ratio: 15,
    knee: 6,
    attack: 1,
    release: 50,
    makeupGain: 12
  }
};

// UI Elements
const elements = {
  enabled: document.getElementById('enabled'),
  status: document.getElementById('status'),
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
  reductionMeter: document.getElementById('reductionMeter'),
  reductionValue: document.getElementById('reductionValue'),
  mediaCount: document.getElementById('mediaCount'),
  presetBtns: document.querySelectorAll('.preset-btn')
};

// State
let currentSettings = { ...defaults };
let meterInterval = null;

// Initialize
async function init() {
  // Load saved settings
  const stored = await chrome.storage.local.get(['limitrSettings']);
  if (stored.limitrSettings) {
    currentSettings = { ...defaults, ...stored.limitrSettings };
  }

  // Update UI with loaded settings
  updateUI();

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

  elements.threshold.value = currentSettings.threshold;
  elements.thresholdValue.textContent = `${currentSettings.threshold} dB`;

  elements.ratio.value = currentSettings.ratio;
  elements.ratioValue.textContent = `${currentSettings.ratio}:1`;

  elements.knee.value = currentSettings.knee;
  elements.kneeValue.textContent = `${currentSettings.knee} dB`;

  elements.attack.value = currentSettings.attack;
  elements.attackValue.textContent = `${currentSettings.attack} ms`;

  elements.release.value = currentSettings.release;
  elements.releaseValue.textContent = `${currentSettings.release} ms`;

  elements.makeupGain.value = currentSettings.makeupGain;
  elements.makeupGainValue.textContent = `${currentSettings.makeupGain} dB`;

  // Update active preset button
  updatePresetButtons();
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
    const isActive = Object.keys(preset).every(
      key => currentSettings[key] === preset[key]
    );
    btn.classList.toggle('active', isActive);
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

  // Threshold
  elements.threshold.addEventListener('input', (e) => {
    currentSettings.threshold = parseInt(e.target.value);
    elements.thresholdValue.textContent = `${currentSettings.threshold} dB`;
    updatePresetButtons();
    saveAndApply();
  });

  // Ratio
  elements.ratio.addEventListener('input', (e) => {
    currentSettings.ratio = parseFloat(e.target.value);
    elements.ratioValue.textContent = `${currentSettings.ratio}:1`;
    updatePresetButtons();
    saveAndApply();
  });

  // Knee
  elements.knee.addEventListener('input', (e) => {
    currentSettings.knee = parseInt(e.target.value);
    elements.kneeValue.textContent = `${currentSettings.knee} dB`;
    updatePresetButtons();
    saveAndApply();
  });

  // Attack
  elements.attack.addEventListener('input', (e) => {
    currentSettings.attack = parseInt(e.target.value);
    elements.attackValue.textContent = `${currentSettings.attack} ms`;
    updatePresetButtons();
    saveAndApply();
  });

  // Release
  elements.release.addEventListener('input', (e) => {
    currentSettings.release = parseInt(e.target.value);
    elements.releaseValue.textContent = `${currentSettings.release} ms`;
    updatePresetButtons();
    saveAndApply();
  });

  // Makeup Gain
  elements.makeupGain.addEventListener('input', (e) => {
    currentSettings.makeupGain = parseInt(e.target.value);
    elements.makeupGainValue.textContent = `${currentSettings.makeupGain} dB`;
    updatePresetButtons();
    saveAndApply();
  });

  // Preset buttons
  elements.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const presetName = btn.dataset.preset;
      applyPreset(presetName);
    });
  });
}

// Apply a preset
function applyPreset(presetName) {
  const preset = presets[presetName];
  if (!preset) return;

  Object.assign(currentSettings, preset);
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
  if (response.mediaCount !== undefined) {
    elements.mediaCount.textContent = `${response.mediaCount} media element${response.mediaCount !== 1 ? 's' : ''}`;
  }
  if (response.reduction !== undefined) {
    updateMeter(response.reduction);
  }
}

// Update gain reduction meter
function updateMeter(reductionDb) {
  // Clamp and convert to percentage (0 to -30 dB range)
  const percentage = Math.min(100, Math.max(0, (Math.abs(reductionDb) / 30) * 100));
  elements.reductionMeter.style.width = `${percentage}%`;
  elements.reductionValue.textContent = `${reductionDb.toFixed(1)} dB`;
}

// Start polling for meter data
function startMeterPolling() {
  meterInterval = setInterval(() => {
    queryContentScript({ type: 'GET_METER' });
  }, 50);
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
