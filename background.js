// Limitr Background
// Orchestrates audio capture and processing via offscreen document

if (typeof browser !== 'undefined') {
  globalThis.chrome = browser;
}

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
const EXCLUSIVE_UNSUPPORTED_ERROR = 'Exclusive mode requires Chrome offscreen/tabCapture APIs. Use Regular mode in this browser.';
let creatingOffscreenDocument = null;

function hasExclusiveModeSupport() {
  const offscreenApi = chrome['offscreen'];
  const tabCaptureApi = chrome['tabCapture'];

  return Boolean(
    offscreenApi?.['createDocument'] &&
    tabCaptureApi?.['getMediaStreamId']
  );
}

// Firefox MV3 runs background as a document (preferred_environment: "document"),
// which means we can host the transcriber here — same realm as its deps, no
// cross-realm instanceof issues that plague content-script dynamic imports.
// Chrome's background is a service worker, so it uses the offscreen document
// instead. Feature-detect rather than browser-sniff.
const hostsTranscriberInBackground =
  !chrome.offscreen?.createDocument && typeof window !== 'undefined';

let backgroundTranscriberPromise = null;

async function ensureBackgroundTranscriber() {
  if (!hostsTranscriberInBackground) return null;
  if (!backgroundTranscriberPromise) {
    backgroundTranscriberPromise = (async () => {
      // Let transcriber.js broadcast to both the popup (via runtime) and the
      // active tab (via tabs) — background's own sendMessage doesn't loopback,
      // so we relay explicitly.
      window.LimitrExtensionRuntime = {
        getURL: path => chrome.runtime.getURL(path),
        sendMessage: payload => {
          chrome.runtime.sendMessage(payload).catch(() => {});
          if (payload?.tabId != null) {
            chrome.tabs.sendMessage(payload.tabId, payload).catch(() => {});
          }
        }
      };
      await import(chrome.runtime.getURL('lib/transcriber.js'));
      return window.LimitrTranscriber;
    })();
  }
  return backgroundTranscriberPromise;
}

// Default settings
const defaults = {
  enabled: true,
  threshold: -18,
  ratio: 6,
  knee: 10,
  attack: 5,
  release: 100,
  makeupGain: 0,
  outputGain: 0,
  peakGuardEnabled: false,
  peakGuardThreshold: -6,
  peakGuardLookahead: 8,
  peakGuardRelease: 120,
  bassCutFreq: 0,
  trebleCutFreq: 22050,
  monoMixEnabled: false,
  noiseLevel: 0,
  noiseType: 'brown'
};

function isGloballyEnabled(value) {
  return value !== false;
}

async function getStoredSettingsForTab(tabId) {
  const storageKey = `tabSettings_${tabId}`;
  const stored = await chrome.storage.local.get([
    storageKey,
    'limitrCurrentSettings',
    'limitrFallbackSettings',
    'limitrGlobalEnabled'
  ]);

  return {
    ...(stored.limitrFallbackSettings || {}),
    ...(stored.limitrCurrentSettings || {}),
    ...(stored[storageKey] || {}),
    enabled: isGloballyEnabled(stored.limitrGlobalEnabled)
  };
}

// Check if offscreen document exists
async function hasOffscreenDocument() {
  if (!hasExclusiveModeSupport()) {
    return false;
  }

  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  if (chrome.runtime?.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    return contexts.length > 0;
  }

  if (typeof clients !== 'undefined') {
    const matchedClients = await clients.matchAll();
    return matchedClients.some(client => client.url === offscreenUrl);
  }

  return false;
}

// Create offscreen document if it doesn't exist
async function ensureOffscreenDocument() {
  if (!hasExclusiveModeSupport()) {
    throw new Error(EXCLUSIVE_UNSUPPORTED_ERROR);
  }

  if (await hasOffscreenDocument()) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome['offscreen']['createDocument']({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification: 'Audio processing and playback for tab capture'
    }).finally(() => {
      creatingOffscreenDocument = null;
    });
  }

  await creatingOffscreenDocument;
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
    const settings = stateResponse.state?.settings || defaults;
    const storedSettings = await getStoredSettingsForTab(tabId);
    if (settings.enabled !== storedSettings.enabled) {
      await chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'set-enabled',
        tabId,
        enabled: storedSettings.enabled
      });
      settings.enabled = storedSettings.enabled;
    }
    return settings;
  }

  // Get media stream ID for the tab
  // tabCapture redirects the tab's audio to the captured stream,
  // so no muting is needed — the tab audio is already taken over.
  const mediaStreamId = await chrome['tabCapture']['getMediaStreamId']({
    targetTabId: tabId
  });

  const settings = await getStoredSettingsForTab(tabId);

  // Send to offscreen document to create audio chain
  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'init-audio',
    tabId,
    mediaStreamId,
    settings
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to initialize audio');
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

  // Clear badge if no more tabs are being processed
  const remainingTabs = await getProcessingTabs();
  if (remainingTabs.length === 0) {
    updateBadge(false);
  }
});

// React to global enabled toggle from popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.limitrGlobalEnabled) {
    if (!changes.limitrGlobalEnabled.newValue) {
      disableActiveProcessing().catch(error => {
        console.log('[Limitr] Failed to disable active processing:', error.message);
      });
      updateBadge(false);
    }
  }
});

async function disableActiveProcessing() {
  const tabs = await chrome.tabs.query({});
  const tabIds = new Set([
    ...autoInjectedTabs,
    ...tabs.map(tab => tab.id).filter(tabId => tabId !== undefined)
  ]);

  await Promise.allSettled(Array.from(tabIds, tabId =>
    chrome.tabs.sendMessage(tabId, {
      action: 'fallback-update-settings',
      settings: { enabled: false }
    })
  ));

  if (await hasOffscreenDocument()) {
    const tabIds = await getProcessingTabs();
    await Promise.allSettled(tabIds.map(tabId =>
      chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'set-enabled',
        tabId,
        enabled: false
      })
    ));
  }
}

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

  // Firefox-hosted transcriber: content-bridge forwards regular-mode transcriber
  // actions here because the content-script sandbox can't safely run the module.
  if (hostsTranscriberInBackground && message.action?.startsWith('bg-transcriber-')) {
    const { action, tabId, audio } = message;
    if (action === 'bg-transcriber-audio') {
      ensureBackgroundTranscriber().then(t => t?.pushAudio(tabId, audio)).catch(() => {});
      return;
    }
    (async () => {
      try {
        const transcriber = await ensureBackgroundTranscriber();
        if (!transcriber) throw new Error('Background transcriber unavailable');
        if (action === 'bg-transcriber-start') {
          await transcriber.startExternal(tabId);
          sendResponse({ success: true });
        } else if (action === 'bg-transcriber-stop') {
          transcriber.stop(tabId);
          sendResponse({ success: true });
        } else if (action === 'bg-transcriber-status') {
          sendResponse({
            active: transcriber.isActive(tabId),
            ready: transcriber.isReady(),
            loading: transcriber.isModelLoading()
          });
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.target !== 'background') {
    return;
  }

  switch (message.action) {
    case 'get-capabilities': {
      sendResponse({ success: true, exclusiveMode: hasExclusiveModeSupport() });
      return;
    }

    case 'init-capture': {
      initAudioCapture(message.tabId)
        .then(async (settings) => {
          const activeTabs = await getProcessingTabs();
          updateBadge(activeTabs.length > 0);
          sendResponse({ success: true, settings });
        })
        .catch(async (error) => {
          const activeTabs = await getProcessingTabs();
          updateBadge(activeTabs.length > 0);
          sendResponse({ success: false, error: error.message });
        });
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
          // Remove stored settings for this tab
          await chrome.storage.local.remove([`tabSettings_${tabId}`]);
          // Update icon to reflect remaining active tabs
          const remaining = await getProcessingTabs();
          updateBadge(remaining.length > 0);
          return { success: true };
        })
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
  }
});

// Context menu: right-click extension icon -> Debug Harness
async function createContextMenus() {
  if (typeof browser !== 'undefined') {
    await chrome.contextMenus.removeAll();
  } else {
    await new Promise(resolve => chrome.contextMenus.removeAll(resolve));
  }

  chrome.contextMenus.create({
    id: 'limitr-debug-harness',
    title: 'Debug Harness',
    contexts: ['action']
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
  await createContextMenus();
  // Set gray icon on install/update (inactive by default)
  updateBadge(false);
});

// --- Auto-activation: process tabs without needing to open the popup ---

// Track which tabs have been auto-injected (simple mode) to avoid duplicates
const autoInjectedTabs = new Set();

// Icon paths for each state
const ICONS = {
  // Gold — active in exclusive (mixer) mode
  exclusive: {
    16: 'icons/icon16-active.png',
    32: 'icons/icon32-active.png',
    48: 'icons/icon48-active.png',
    128: 'icons/icon128-active.png'
  },
  // Purple — active in regular (non-exclusive) mode
  regular: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png'
  },
  // Gray — inactive/disabled
  inactive: {
    16: 'icons/icon16-gray.png',
    32: 'icons/icon32-gray.png',
    48: 'icons/icon48-gray.png',
    128: 'icons/icon128-gray.png'
  }
};

// Update the toolbar icon to reflect active/inactive state and mode
async function updateBadge(active) {
  if (!active) {
    chrome.action.setIcon({ path: ICONS.inactive });
    return;
  }
  const stored = await chrome.storage.local.get(['limitrMixerMode']);
  const iconSet = stored.limitrMixerMode && hasExclusiveModeSupport() ? ICONS.exclusive : ICONS.regular;
  chrome.action.setIcon({ path: iconSet });
}

// Inject content scripts (bridge + audio) and send settings.
// Shared by autoActivateSimple and earlyInjectContentScript.
async function injectContentScripts(tabId) {
  // Read storage before injecting so global Off never creates page audio hooks.
  const stored = await chrome.storage.local.get([
    'limitrFallbackSettings',
    'limitrCurrentSettings',
    'limitrGlobalEnabled'
  ]);
  if (!isGloballyEnabled(stored.limitrGlobalEnabled)) {
    return false;
  }

  // Inject bridge in ISOLATED world (for chrome.runtime messaging)
  // and content-audio.js in MAIN world (for reliable Web Audio API access)
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-bridge.js']
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    files: ['content-audio.js']
  });
  autoInjectedTabs.add(tabId);

  // Use the user's actual settings from storage, with exclusive-only features disabled
  let settings;
  if (stored.limitrCurrentSettings) {
    settings = { ...defaults, ...stored.limitrCurrentSettings, enabled: true };
  } else {
    settings = { ...defaults, ...(stored.limitrFallbackSettings || {}), enabled: true };
  }
  // Disable exclusive-only features for fallback
  settings.autoGainEnabled = false;
  settings.noiseSuppressionEnabled = false;
  settings.gateEnabled = false;
  settings.duckingEnabled = false;

  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'fallback-update-settings',
      settings
    });
  } catch (e) {
    // Content script may not be ready yet — it will use stored settings
  }

  return true;
}

// Check if content script is already running in a tab
async function isContentScriptActive(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'fallback-ping' });
    if (response && response.active) {
      autoInjectedTabs.add(tabId);
      return true;
    }
  } catch (e) {
    // Not injected
  }
  return false;
}

// Auto-activate on a tab (simple mode: inject content script)
async function autoActivateSimple(tabId) {
  const stored = await chrome.storage.local.get(['limitrGlobalEnabled']);
  if (!isGloballyEnabled(stored.limitrGlobalEnabled)) {
    chrome.action.setIcon({ path: ICONS.inactive, tabId });
    return;
  }

  if (autoInjectedTabs.has(tabId)) {
    // Already injected — just ensure icon is correct
    chrome.action.setIcon({ path: ICONS.regular, tabId });
    return;
  }

  if (await isContentScriptActive(tabId)) {
    chrome.action.setIcon({ path: ICONS.regular, tabId });
    return;
  }

  try {
    const injected = await injectContentScripts(tabId);
    if (injected) {
      chrome.action.setIcon({ path: ICONS.regular, tabId });
      console.log(`[Limitr] Auto-injected simple mode on tab ${tabId}`);
    }
  } catch (error) {
    console.log(`[Limitr] Could not auto-inject on tab ${tabId}:`, error.message);
  }
}

// Pre-inject the content script on page load so MutationObserver catches
// video/audio elements as soon as they're added to the DOM.
// This is lightweight — the script does nothing if no media is found.
async function earlyInjectContentScript(tabId) {
  const stored = await chrome.storage.local.get(['limitrGlobalEnabled']);
  if (!isGloballyEnabled(stored.limitrGlobalEnabled)) return;
  if (autoInjectedTabs.has(tabId)) return;
  if (await isContentScriptActive(tabId)) return;

  try {
    await injectContentScripts(tabId);
    console.log(`[Limitr] Early-injected content script on tab ${tabId}`);
  } catch (e) {
    // Normal for restricted pages
  }
}

// Try to auto-activate on a tab based on current settings
async function tryAutoActivate(tabId) {
  try {
    const stored = await chrome.storage.local.get(['limitrGlobalEnabled', 'limitrMixerMode']);
    if (!isGloballyEnabled(stored.limitrGlobalEnabled)) return;

    // Get tab info to validate it's a real page (not chrome://, etc.)
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
      return;
    }

    if (stored.limitrMixerMode && hasExclusiveModeSupport()) {
      // Exclusive mode: tabCapture via offscreen document.
      // MV3's getMediaStreamId does NOT require a user gesture (unlike MV2's capture()).
      // Retry once after a short delay if first attempt fails (tab may not be fully ready).
      let exclusiveOk = false;
      for (let attempt = 0; attempt < 2 && !exclusiveOk; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, 1000));
          await initAudioCapture(tabId);
          const activeTabs = await getProcessingTabs();
          if (activeTabs.includes(tabId)) {
            exclusiveOk = true;
            chrome.action.setIcon({ path: ICONS.exclusive, tabId });
            // Disable the early-injected content script so it doesn't double-process
            try {
              await chrome.tabs.sendMessage(tabId, {
                action: 'fallback-update-settings',
                settings: { enabled: false }
              });
            } catch (e) {}
            console.log(`[Limitr] Auto-activated exclusive mode on tab ${tabId} (attempt ${attempt + 1})`);
          }
        } catch (e) {
          console.log(`[Limitr] Exclusive attempt ${attempt + 1} failed for tab ${tabId}: ${e.message}`);
        }
      }

      if (!exclusiveOk) {
        // Exclusive failed after retries — fall back to simple mode
        console.log(`[Limitr] Exclusive autoinit failed for tab ${tabId}, falling back to simple`);
        await autoActivateSimple(tabId);
      }
    } else {
      if (stored.limitrMixerMode) {
        console.log('[Limitr] Exclusive mode is unavailable in this browser, using regular mode');
      }
      await autoActivateSimple(tabId);
    }
  } catch (error) {
    console.log(`[Limitr] Autoinit error on tab ${tabId}: ${error.message}, falling back to simple`);
    try {
      await autoActivateSimple(tabId);
    } catch (e) {
      console.log(`[Limitr] Simple fallback also failed on tab ${tabId}:`, e.message);
    }
  }
}

// Listen for tabs that start playing audio
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.audible === true) {
    tryAutoActivate(tabId);
  }

  // Inject content script early on page load so it's ready when video appears.
  // Sites like Kick load the page first, then the video stream later.
  // The content script's MutationObserver will catch the video element as soon
  // as it's added to the DOM, so processing starts the moment audio begins.
  if (changeInfo.status === 'complete' && tab.url &&
      !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('about:') && !tab.url.startsWith('edge://')) {
    earlyInjectContentScript(tabId);
  }
});

// Clean up auto-injected tracking when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  autoInjectedTabs.delete(tabId);
});

// On startup, restore badge state based on active processing tabs
async function restoreBadgeState() {
  const stored = await chrome.storage.local.get(['limitrGlobalEnabled', 'limitrMixerMode']);
  if (!isGloballyEnabled(stored.limitrGlobalEnabled)) {
    updateBadge(false);
    return;
  }

  if (stored.limitrMixerMode && hasExclusiveModeSupport()) {
    const activeTabs = await getProcessingTabs();
    updateBadge(activeTabs.length > 0);
  } else {
    // For simple mode, check if any injected tabs exist
    // Badge will update on next auto-activation
    updateBadge(false);
  }
}

restoreBadgeState();

console.log('[Limitr] Background loaded');
