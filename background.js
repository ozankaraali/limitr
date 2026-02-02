// Limitr Background Service Worker
// Orchestrates audio capture and processing via offscreen document

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

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

// Check if offscreen document exists
async function hasOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });
  return contexts.length > 0;
}

// Create offscreen document if it doesn't exist
async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['USER_MEDIA'],
    justification: 'Audio processing for tab capture'
  });
}

// Initialize audio capture for a tab
async function initAudioCapture(tabId) {
  // Ensure offscreen document exists
  await ensureOffscreenDocument();

  // Check if tab already has audio processing
  const hasAudioResponse = await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'has-audio',
    tabId
  });

  if (hasAudioResponse.hasAudio) {
    // Already capturing this tab
    const stateResponse = await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'get-state',
      tabId
    });
    return stateResponse.state;
  }

  // Get media stream ID for the tab
  const mediaStreamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId
  });

  // Send to offscreen document to create audio chain
  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'init-audio',
    tabId,
    mediaStreamId
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to initialize audio');
  }

  // Load saved settings for this tab if any
  const stored = await chrome.storage.local.get([`tabSettings_${tabId}`]);
  if (stored[`tabSettings_${tabId}`]) {
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'update-settings',
      tabId,
      settings: stored[`tabSettings_${tabId}`]
    });
  }

  return response.settings;
}

// Update settings for a tab
async function updateTabSettings(tabId, settings) {
  await ensureOffscreenDocument();

  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'update-settings',
    tabId,
    settings
  });

  // Save settings for this tab
  await chrome.storage.local.set({ [`tabSettings_${tabId}`]: settings });

  return response.success;
}

// Enable/disable processing for a tab
async function setTabEnabled(tabId, enabled) {
  await ensureOffscreenDocument();

  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'set-enabled',
    tabId,
    enabled
  });

  return response.success;
}

// Get current state for a tab
async function getTabState(tabId) {
  if (!(await hasOffscreenDocument())) {
    return null;
  }

  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'get-state',
    tabId
  });

  return response.state;
}

// Get all tabs currently playing audio
async function getAudibleTabs() {
  const tabs = await chrome.tabs.query({ audible: true });
  return tabs.map(tab => ({
    id: tab.id,
    title: tab.title,
    url: tab.url,
    favIconUrl: tab.favIconUrl
  }));
}

// Get tabs with active audio processing
async function getProcessingTabs() {
  if (!(await hasOffscreenDocument())) {
    return [];
  }

  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'get-active-tabs'
  });

  return response.tabIds || [];
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (await hasOffscreenDocument()) {
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'cleanup-tab',
      tabId
    });
  }

  // Clean up stored settings
  await chrome.storage.local.remove([`tabSettings_${tabId}`]);
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') {
    // Pass through to offscreen document
    return;
  }

  if (message.target !== 'background') {
    return;
  }

  switch (message.action) {
    case 'init-capture': {
      initAudioCapture(message.tabId)
        .then(settings => sendResponse({ success: true, settings }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'update-settings': {
      updateTabSettings(message.tabId, message.settings)
        .then(success => sendResponse({ success }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'set-enabled': {
      setTabEnabled(message.tabId, message.enabled)
        .then(success => sendResponse({ success }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'get-state': {
      getTabState(message.tabId)
        .then(state => sendResponse({ success: true, state }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'get-audible-tabs': {
      getAudibleTabs()
        .then(tabs => sendResponse({ success: true, tabs }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'get-processing-tabs': {
      getProcessingTabs()
        .then(tabIds => sendResponse({ success: true, tabIds }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'set-tab-volume': {
      // Forward to offscreen document AND save to tab settings
      const tabId = message.tabId;
      const volume = message.volume;

      ensureOffscreenDocument()
        .then(async () => {
          // Update the volume in the audio chain
          await chrome.runtime.sendMessage({
            target: 'offscreen',
            action: 'set-volume',
            tabId,
            volume
          });

          // Also save to tab settings so it persists when switching tabs
          const stored = await chrome.storage.local.get([`tabSettings_${tabId}`]);
          const settings = stored[`tabSettings_${tabId}`] || { ...defaults };
          settings.outputGain = volume;
          await chrome.storage.local.set({ [`tabSettings_${tabId}`]: settings });

          return { success: true };
        })
        .then(response => sendResponse({ success: response?.success || false }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'get-all-volumes': {
      // Get volumes from offscreen document
      hasOffscreenDocument()
        .then(exists => {
          if (!exists) return { volumes: {} };
          return chrome.runtime.sendMessage({
            target: 'offscreen',
            action: 'get-all-volumes'
          });
        })
        .then(response => sendResponse({ success: true, volumes: response?.volumes || {} }))
        .catch(error => sendResponse({ success: false, volumes: {} }));
      return true;
    }
  }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ limitrDefaults: defaults });
    console.log('[Limitr] Extension installed');
  }
});

console.log('[Limitr] Service worker loaded');
