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
  bassCutFreq: 0,
  trebleCutFreq: 22050,
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

// Track muted state before capture (to restore on cleanup)
const tabMutedState = new Map();

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

  // Get current muted state before we mute
  const tab = await chrome.tabs.get(tabId);
  tabMutedState.set(tabId, tab.mutedInfo?.muted || false);

  // Mute the tab to prevent double audio (processed + original)
  await chrome.tabs.update(tabId, { muted: true });

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
    // Restore muted state on failure
    const wasMuted = tabMutedState.get(tabId) || false;
    await chrome.tabs.update(tabId, { muted: wasMuted });
    tabMutedState.delete(tabId);
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

  // Clean up stored settings and muted state tracking
  await chrome.storage.local.remove([`tabSettings_${tabId}`]);
  tabMutedState.delete(tabId);
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') {
    // Pass through to offscreen document
    return;
  }

  // Forward transcription results from offscreen to popup and content scripts
  if (message.action === 'transcription-result' || message.action === 'transcription-status') {
    // Forward to the tab's content script for subtitle overlay
    if (message.tabId) {
      chrome.tabs.sendMessage(message.tabId, message).catch(() => {});
    }
    // No response needed — fire-and-forget broadcast
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

    case 'start-transcription': {
      ensureOffscreenDocument()
        .then(() => chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'start-transcription',
          tabId: message.tabId
        }))
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'stop-transcription': {
      ensureOffscreenDocument()
        .then(() => chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'stop-transcription',
          tabId: message.tabId
        }))
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'get-transcription-status': {
      hasOffscreenDocument()
        .then(exists => {
          if (!exists) return { active: false, ready: false, loading: false };
          return chrome.runtime.sendMessage({
            target: 'offscreen',
            action: 'get-transcription-status',
            tabId: message.tabId
          });
        })
        .then(response => sendResponse(response))
        .catch(() => sendResponse({ active: false, ready: false, loading: false }));
      return true;
    }

    case 'cleanup-tab': {
      // Forward cleanup to offscreen document and remove stored settings
      const tabId = message.tabId;
      hasOffscreenDocument()
        .then(async (exists) => {
          if (exists) {
            await chrome.runtime.sendMessage({
              target: 'offscreen',
              action: 'cleanup-tab',
              tabId
            });
          }
          // Restore original muted state only if we tracked it
          if (tabMutedState.has(tabId)) {
            const wasMuted = tabMutedState.get(tabId);
            try {
              await chrome.tabs.update(tabId, { muted: wasMuted });
            } catch (e) {
              // Tab might be closed already
            }
            tabMutedState.delete(tabId);
          }
          // Remove stored settings for this tab
          await chrome.storage.local.remove([`tabSettings_${tabId}`]);
          return { success: true };
        })
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
  }
});

// Context menu: right-click extension icon -> Debug Harness
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'limitr-debug-harness',
      title: 'Debug Harness',
      contexts: ['action']
    });
  });
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'limitr-debug-harness') {
    chrome.tabs.create({ url: chrome.runtime.getURL('tests/debug-harness.html') });
  }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ limitrDefaults: defaults });
    console.log('[Limitr] Extension installed');
  }
  createContextMenus();
});

console.log('[Limitr] Service worker loaded');
