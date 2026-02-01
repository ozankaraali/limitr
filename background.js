// Limitr Background Service Worker
// Handles extension lifecycle and settings sync

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

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    await chrome.storage.local.set({ limitrSettings: defaults });
    console.log('[Limitr] Extension installed with default settings');
  } else if (details.reason === 'update') {
    // Merge new defaults with existing settings on update
    const stored = await chrome.storage.local.get(['limitrSettings']);
    if (stored.limitrSettings) {
      const mergedSettings = { ...defaults, ...stored.limitrSettings };
      await chrome.storage.local.set({ limitrSettings: mergedSettings });
      console.log('[Limitr] Extension updated, settings merged');
    }
  }
});

// Listen for settings changes and broadcast to all tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.limitrSettings) {
    const newSettings = changes.limitrSettings.newValue;

    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'UPDATE_SETTINGS',
            settings: newSettings
          }).catch(() => {
            // Tab might not have content script loaded
          });
        }
      });
    });
  }
});

// Handle extension icon click when popup is disabled (optional future feature)
chrome.action.onClicked.addListener(async (tab) => {
  // Toggle enabled state when clicking icon (if popup is disabled)
  const stored = await chrome.storage.local.get(['limitrSettings']);
  const settings = stored.limitrSettings || defaults;
  settings.enabled = !settings.enabled;
  await chrome.storage.local.set({ limitrSettings: settings });
});
