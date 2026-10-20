// Limitr background — Chrome service worker / Firefox background page.
// Page mode needs nothing from here: content scripts read settings straight from storage.
// This script handles tab capture mode (Chrome), captions, icons and install-time chores.

if (typeof browser !== 'undefined') {
  globalThis.chrome = browser;
}
if (typeof importScripts === 'function' && !globalThis.LimitrSettings) {
  importScripts('lib/settings.js');
}

const S = globalThis.LimitrSettings;
const KEYS = S.STORAGE_KEYS;
const OFFSCREEN_PATH = 'offscreen.html';

const ICON_SIZES = [16, 32, 48, 128];
const iconSet = state => Object.fromEntries(ICON_SIZES.map(size => [size, `icons/toolbar-${state}-${size}.png`]));
const ICONS = {
  off: iconSet('off'),
  on: iconSet('on'),
  working: iconSet('working'),
  attention: iconSet('attention')
};

const LEGACY_KEYS = [
  'limitrCurrentSettings', 'limitrFallbackSettings', 'limitrGlobalEnabled', 'limitrMixerMode',
  'limitrPendingPreset', 'limitrDefaults', 'limitrAdvancedMode', 'limitrCollapseState',
  'limitrCustomPresets'
];

function captureSupported() {
  return Boolean(chrome.offscreen?.createDocument && chrome.tabCapture?.getMediaStreamId);
}

function isRestrictedUrl(url) {
  return !url || !/^(https?|file):/.test(url);
}

// ---------- icons ----------
// Gray: off. Purple: on. Gold: working on this tab. Red: playing unprotected, needs the user.
const tabIconStates = new Map();   // tabId -> last icon state (read by tests)
const tabFrames = new Map();       // tabId -> Map(frameId -> { attached, waitingForGesture, playingSkipped })
const capturedTabs = new Set();
const captureFailures = new Set();
let globalEnabled = true;

// Off beats everything; then working (anything processed), then attention, then on
function iconStateFor(tabId) {
  if (!globalEnabled) return 'off';
  const frames = [...(tabFrames.get(tabId) || new Map()).values()];
  if (capturedTabs.has(tabId) || frames.some(f => f.attached > 0)) return 'working';
  // An unreachable player only needs the user where Whole-tab capture exists to fix it
  const unreachable = captureSupported() && frames.some(f => f.playingSkipped > 0);
  if (captureFailures.has(tabId) || unreachable || frames.some(f => f.waitingForGesture > 0)) return 'attention';
  return 'on';
}

function updateTabIcon(tabId) {
  setTabIcon(tabId, iconStateFor(tabId));
}

function updateAllTabIcons() {
  const tabs = [...tabFrames.keys(), ...capturedTabs, ...captureFailures, ...tabIconStates.keys()];
  for (const tabId of new Set(tabs)) updateTabIcon(tabId);
}

// What a tab without an icon of its own shows: the global icon
const defaultIconState = () => (globalEnabled ? 'on' : 'off');

// The global icon outlives the service worker, so a worker that merely restarted leaves it alone
// unless it changed (remembered in storage.session). Install, update and browser startup reset
// the icon, so those always set it.
const GLOBAL_ICON_KEY = 'limitrGlobalIcon';
const sessionArea = chrome.storage.session;

async function refreshGlobalIcon(always = false) {
  const [{ enabled }, session] = await Promise.all([
    S.load(chrome.storage.local),
    sessionArea ? sessionArea.get(GLOBAL_ICON_KEY).catch(() => ({})) : {}
  ]);
  globalEnabled = enabled;
  const iconState = defaultIconState();
  if (!always && session[GLOBAL_ICON_KEY] === iconState) return;
  await chrome.action.setIcon({ path: ICONS[iconState] });
  if (sessionArea) await sessionArea.set({ [GLOBAL_ICON_KEY]: iconState }).catch(() => {});
}

// Every frame of every page reports in, and each setIcon makes the service worker fetch and
// decode four PNGs, so only changes go out. A tab with no record shows the global icon; a page
// with nothing to show never reports, so it costs nothing.
function setTabIcon(tabId, iconState) {
  if (tabIconStates.get(tabId) === iconState) return;
  tabIconStates.set(tabId, iconState);
  Promise.resolve(chrome.action.setIcon({ tabId, path: ICONS[iconState] })).catch(() => {});
}

// ---------- offscreen document (Chrome tab capture + captions) ----------
let creatingOffscreen = null;

async function hasOffscreen() {
  if (!chrome.offscreen?.createDocument) return false;
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      // AUDIO_PLAYBACK alone gets the document closed after 30 s of silence (a paused captured
      // tab, or captions in page mode). WORKERS — the caption model runs ONNX Runtime workers —
      // has no such limit.
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK', 'WORKERS'],
      justification: 'Process captured tab audio and run live captions locally'
    }).finally(() => { creatingOffscreen = null; });
  }
  await creatingOffscreen;
}

function toOffscreen(message) {
  return chrome.runtime.sendMessage({ ...message, target: 'offscreen' });
}

// ---------- tab capture ----------
const captureJobs = new Map();

async function capturedTabIds() {
  if (!(await hasOffscreen())) return [];
  const response = await toOffscreen({ action: 'capture-list' });
  return (response?.tabs || []).map(t => t.tabId);
}

function captureTab(tabId) {
  if (!captureSupported()) return Promise.reject(new Error('Tab capture is not available in this browser'));
  if (captureJobs.has(tabId)) return captureJobs.get(tabId);

  const job = (async () => {
    await ensureOffscreen();
    if ((await capturedTabIds()).includes(tabId)) return;
    const state = await S.load(chrome.storage.local);
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    const response = await toOffscreen({
      action: 'capture-start', tabId, streamId, settings: state.settings, enabled: state.enabled
    });
    if (!response?.success) throw new Error(response?.error || 'Capture failed');
    // Page-mode engines in this tab step aside so audio isn't processed twice
    await chrome.tabs.sendMessage(tabId, { action: 'limitr-capture-state', captured: true }).catch(() => {});
    capturedTabs.add(tabId);
    captureFailures.delete(tabId);
    updateTabIcon(tabId);
    // Captions running from page audio move over to the captured stream
    if ((await captionsStatus(tabId)).active) {
      await toOffscreen({ action: 'captions-start', tabId, prefs: await loadCaptionPrefs() });
    }
  })().finally(() => captureJobs.delete(tabId));

  captureJobs.set(tabId, job);
  return job;
}

async function releaseTab(tabId) {
  const hadCaptions = (await captionsStatus(tabId)).active;
  if (await hasOffscreen()) await toOffscreen({ action: 'capture-stop', tabId });
  await chrome.tabs.sendMessage(tabId, { action: 'limitr-capture-state', captured: false }).catch(() => {});
  capturedTabs.delete(tabId);
  updateTabIcon(tabId);
  // Stopping the capture also stopped its captions; carry on from page audio
  if (hadCaptions) await startCaptions(tabId).catch(() => {});
}

async function releaseAll() {
  for (const tabId of await capturedTabIds()) await releaseTab(tabId);
}

async function autoCapture(tabId) {
  const state = await S.load(chrome.storage.local);
  if (!state.enabled || state.mode !== 'capture' || !captureSupported()) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || isRestrictedUrl(tab.url)) return;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await captureTab(tabId);
      return;
    } catch (error) {
      // Page mode keeps working in this tab if capture isn't allowed
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  // Only turns the icon red if page mode isn't protecting anything here either
  noteCaptureFailure(tabId);
}

// Red asks the user to act, so browser pages (where nothing can be done) never turn red
async function noteCaptureFailure(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || isRestrictedUrl(tab.url)) return;
  captureFailures.add(tabId);
  updateTabIcon(tabId);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.audible === true) autoCapture(tabId);
  if (changeInfo.status !== 'loading') return;
  // 'loading' also fires for same-page navigations (history.pushState), where the browser keeps
  // the tab's icon and the frames keep their players. So the icon shown is unknown from here, and
  // frames that are still there are asked to report again; a new page's frames start at nothing.
  tabIconStates.delete(tabId);
  if (tabFrames.has(tabId) || captureFailures.has(tabId) || capturedTabs.has(tabId)) {
    tabFrames.delete(tabId);
    captureFailures.delete(tabId);
    updateTabIcon(tabId);
    Promise.resolve(chrome.tabs.sendMessage(tabId, { action: 'limitr-report-status' })).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  forgetTranscript(tabId);
  tabFrames.delete(tabId);
  capturedTabs.delete(tabId);
  captureFailures.delete(tabId);
  tabIconStates.delete(tabId);
  if (await hasOffscreen()) {
    await toOffscreen({ action: 'capture-stop', tabId }).catch(() => {});
    await toOffscreen({ action: 'captions-stop', tabId }).catch(() => {});
  }
  if (transcriberInBackground && backgroundTranscriber) (await backgroundTranscriber).stop(tabId);
});

// ---------- transcripts: each tab's finished caption lines, kept so they can be saved as text ----------
// Session storage keeps them while the service worker sleeps; they go when the tab closes.
const TRANSCRIPT_MAX_LINES = 5000;
const transcriptKey = tabId => `limitrTranscript:${tabId}`;
const transcripts = new Map();       // tabId -> Promise<lines>
const transcriptSaves = new Map();   // tabId -> pending save timer

function transcriptLines(tabId) {
  if (!transcripts.has(tabId)) {
    transcripts.set(tabId, sessionArea
      ? sessionArea.get(transcriptKey(tabId)).then(stored => stored[transcriptKey(tabId)] || [], () => [])
      : Promise.resolve([]));
  }
  return transcripts.get(tabId);
}

async function recordTranscript(tabId, result) {
  if (tabId == null || !result || !result.final || !result.text) return;
  const lines = await transcriptLines(tabId);
  lines.push({
    at: result.timestamp || Date.now(),
    text: result.text,
    ...(result.translation && { translation: result.translation })
  });
  if (lines.length > TRANSCRIPT_MAX_LINES) lines.splice(0, lines.length - TRANSCRIPT_MAX_LINES);
  if (sessionArea && !transcriptSaves.has(tabId)) {
    transcriptSaves.set(tabId, setTimeout(() => {
      transcriptSaves.delete(tabId);
      sessionArea.set({ [transcriptKey(tabId)]: lines }).catch(() => {});
    }, 1000));
  }
}

function forgetTranscript(tabId) {
  transcripts.delete(tabId);
  clearTimeout(transcriptSaves.get(tabId));
  transcriptSaves.delete(tabId);
  if (sessionArea) sessionArea.remove(transcriptKey(tabId)).catch(() => {});
}

// ---------- captions host: offscreen in Chrome, this background page in Firefox ----------
const transcriberInBackground = !chrome.offscreen?.createDocument && typeof window !== 'undefined';
let backgroundTranscriber = null;
// Caption audio still in flight right after Off must not restart captions
const captionsStoppedAt = new Map();
const recentlyStopped = tabId => Date.now() - (captionsStoppedAt.get(tabId) || 0) < 3000;
const restartingCaptions = new Set();

async function loadCaptionPrefs() {
  const stored = await chrome.storage.local.get(KEYS.captions);
  return S.normalizeCaptions(stored[KEYS.captions], chrome.i18n?.getUILanguage?.() || navigator.language);
}

function ensureBackgroundTranscriber() {
  if (!backgroundTranscriber) {
    backgroundTranscriber = (async () => {
      // Background pages don't receive their own runtime messages, so relay explicitly
      window.LimitrExtensionRuntime = {
        getURL: path => chrome.runtime.getURL(path),
        sendMessage: payload => {
          if (payload?.action === 'transcription-result') recordTranscript(payload.tabId, payload.result);
          chrome.runtime.sendMessage(payload).catch(() => {});
          if (payload?.tabId != null) chrome.tabs.sendMessage(payload.tabId, payload).catch(() => {});
        }
      };
      await import(chrome.runtime.getURL('lib/transcriber.js'));
      return window.LimitrTranscriber;
    })();
  }
  return backgroundTranscriber;
}

function decodePcm(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;
  return float32;
}

// Audio only flows while a tab wants captions, so audio for a tab the transcriber doesn't
// know means this background page was suspended and restarted: pick captions back up.
async function receiveCaptionAudio(tabId, pcm) {
  if (recentlyStopped(tabId)) return;
  const transcriber = await ensureBackgroundTranscriber();
  if (transcriber.isActive(tabId)) {
    transcriber.pushAudio(tabId, decodePcm(pcm));
  } else if (!restartingCaptions.has(tabId)) {
    restartingCaptions.add(tabId);
    loadCaptionPrefs()
      .then(prefs => transcriber.startExternal(tabId, prefs))
      .catch(() => {})
      .finally(() => restartingCaptions.delete(tabId));
  }
}

async function startCaptions(tabId) {
  captionsStoppedAt.delete(tabId);
  const prefs = await loadCaptionPrefs();
  let response;
  if (transcriberInBackground) {
    const transcriber = await ensureBackgroundTranscriber();
    await transcriber.startExternal(tabId, prefs);
    response = { success: true };
  } else {
    await ensureOffscreen();
    response = await toOffscreen({ action: 'captions-start', tabId, prefs });
  }
  // Every frame remembers this, so players that attach later stream audio too
  if (response?.success) {
    await chrome.tabs.sendMessage(tabId, { action: 'limitr-captions', enabled: true }).catch(() => {});
  }
  return response;
}

async function stopCaptions(tabId) {
  captionsStoppedAt.set(tabId, Date.now());
  await chrome.tabs.sendMessage(tabId, { action: 'limitr-captions', enabled: false }).catch(() => {});
  if (transcriberInBackground) {
    if (backgroundTranscriber) (await backgroundTranscriber).stop(tabId);
  } else if (await hasOffscreen()) {
    await toOffscreen({ action: 'captions-stop', tabId });
  }
  return { success: true };
}

async function captionsStatus(tabId) {
  if (transcriberInBackground) {
    if (!backgroundTranscriber) return { active: false, loading: false };
    const t = await backgroundTranscriber;
    return { active: t.isActive(tabId), loading: t.isModelLoading(), session: t.sessionInfo(tabId) };
  }
  if (!(await hasOffscreen())) return { active: false, loading: false };
  return toOffscreen({ action: 'captions-status', tabId });
}

// ---------- messages ----------
function respond(promise, sendResponse) {
  promise.then(sendResponse, error => sendResponse({ success: false, error: error.message }));
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target === 'offscreen') return false;

  switch (message.action) {
    // From content bridges
    case 'limitr-frame-hello':
      if (!sender.tab) return false;
      return respond(Promise.all([capturedTabIds(), captionsStatus(sender.tab.id)]).then(([ids, captions]) => ({
        captured: ids.includes(sender.tab.id),
        captions: Boolean(captions && captions.active)
      })), sendResponse);
    case 'limitr-status': {
      if (!sender.tab) return false;
      const tabId = sender.tab.id;
      if (!tabFrames.has(tabId)) tabFrames.set(tabId, new Map());
      tabFrames.get(tabId).set(sender.frameId || 0, {
        attached: message.attached || 0,
        waitingForGesture: message.waitingForGesture || 0,
        playingSkipped: message.playingSkipped || 0
      });
      updateTabIcon(tabId);
      return false;
    }
    case 'limitr-transcriber-audio':
      // Firefox hosts captions here; Chrome's offscreen document handles this message itself
      if (transcriberInBackground && sender.tab) receiveCaptionAudio(sender.tab.id, message.pcm);
      return false;

    // From the offscreen document
    case 'limitr-capture-ended':
      releaseTab(message.tabId);
      return false;
    case 'transcription-result':
    case 'transcription-status':
      // Lines only count from the extension itself (the offscreen document), never a web page
      if (message.action === 'transcription-result' && (sender.url || '').startsWith(chrome.runtime.getURL(''))) {
        recordTranscript(message.tabId, message.result);
      }
      // Forward to the tab so the caption overlay can render it
      if (message.tabId != null && !sender.tab) chrome.tabs.sendMessage(message.tabId, message).catch(() => {});
      return false;
  }

  if (message.target !== 'background') return false;

  switch (message.action) {
    case 'get-capabilities':
      sendResponse({ capture: captureSupported() });
      return false;
    case 'capture-tab':
      return respond(captureTab(message.tabId).then(() => ({ success: true }), async error => {
        await noteCaptureFailure(message.tabId);
        throw error;
      }), sendResponse);
    case 'release-tab':
      return respond(releaseTab(message.tabId).then(() => ({ success: true })), sendResponse);
    case 'capture-list':
      return respond((async () => {
        if (!(await hasOffscreen())) return { tabs: [] };
        const { tabs = [] } = await toOffscreen({ action: 'capture-list' });
        const withInfo = await Promise.all(tabs.map(async t => {
          const tab = await chrome.tabs.get(t.tabId).catch(() => null);
          return tab ? { ...t, title: tab.title, favIconUrl: tab.favIconUrl, audible: tab.audible } : null;
        }));
        return { tabs: withInfo.filter(Boolean) };
      })(), sendResponse);
    case 'capture-volume':
      return respond(toOffscreen({ action: 'capture-volume', tabId: message.tabId, volumeDb: message.volumeDb }), sendResponse);
    case 'capture-meters':
      return respond((async () => {
        if (!(await hasOffscreen())) return { meters: null };
        return toOffscreen({ action: 'capture-meters', tabId: message.tabId });
      })(), sendResponse);
    case 'captions-start':
      return respond(startCaptions(message.tabId), sendResponse);
    case 'captions-stop':
      return respond(stopCaptions(message.tabId), sendResponse);
    case 'captions-status':
      return respond(captionsStatus(message.tabId), sendResponse);
    case 'captions-transcript':
      return respond(transcriptLines(message.tabId).then(lines => ({ lines })), sendResponse);
    case 'captions-prefs':
      // The offscreen document has no storage access; it asks when restarting captions
      return respond(loadCaptionPrefs(), sendResponse);
  }
  return false;
});

// ---------- settings changes ----------
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (KEYS.settings in changes || KEYS.enabled in changes) {
    const state = await S.load(chrome.storage.local);
    if (await hasOffscreen()) {
      toOffscreen({ action: 'capture-settings', settings: state.settings, enabled: state.enabled }).catch(() => {});
    }
    if (KEYS.enabled in changes) {
      refreshGlobalIcon();
      globalEnabled = state.enabled;
      updateAllTabIcons();
    }
  }
  if (KEYS.mode in changes && changes[KEYS.mode].newValue === 'page') {
    captureFailures.clear();
    updateAllTabIcons();
    releaseAll();
  }
  if (KEYS.captions in changes) {
    const prefs = await loadCaptionPrefs();
    if (transcriberInBackground) {
      if (backgroundTranscriber) (await backgroundTranscriber).configure(prefs);
    } else if (await hasOffscreen()) {
      toOffscreen({ action: 'captions-config', prefs }).catch(() => {});
    }
  }
});

// ---------- install / update ----------
async function migrateStorage() {
  const stored = await chrome.storage.local.get(null);
  const state = await S.load(chrome.storage.local);
  const updates = {};
  if (!stored[KEYS.settings]) updates[KEYS.settings] = state.settings;
  if (typeof stored[KEYS.enabled] !== 'boolean') updates[KEYS.enabled] = state.enabled;
  if (!stored[KEYS.mode]) updates[KEYS.mode] = captureSupported() ? state.mode : 'page';
  // null when the 1.x tone and extras that carried over don't match any preset
  if (!stored[KEYS.preset] && !stored[KEYS.settings]) updates[KEYS.preset] = state.preset;
  if (stored.limitrCustomPresets && !stored[KEYS.customPresets]) {
    updates[KEYS.customPresets] = S.migrateLegacyCustomPresets(stored.limitrCustomPresets);
  }
  await chrome.storage.local.set(updates);
  const stale = Object.keys(stored).filter(key => LEGACY_KEYS.includes(key) || key.startsWith('tabSettings_'));
  if (stale.length) await chrome.storage.local.remove(stale);
}

// Declared content scripts only run on page loads, so wire up tabs that are already open
async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter(tab => !isRestrictedUrl(tab.url)).map(async tab => {
    const target = { tabId: tab.id, allFrames: true };
    await chrome.scripting.executeScript({ target, files: ['lib/settings.js', 'content-bridge.js'] });
    await chrome.scripting.executeScript({ target, world: 'MAIN', files: ['lib/engine.js', 'content-audio.js'] });
  }));
}

async function createContextMenus() {
  await Promise.resolve(chrome.contextMenus.removeAll()).catch(() => {});
  chrome.contextMenus.create({ id: 'limitr-debug-harness', title: 'Debug Harness', contexts: ['action'] });
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'limitr-debug-harness') {
    chrome.tabs.create({ url: chrome.runtime.getURL('tests/debug-harness.html') });
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await migrateStorage();
  await createContextMenus();
  await refreshGlobalIcon(true);
  injectIntoOpenTabs();
});

chrome.runtime.onStartup?.addListener(() => refreshGlobalIcon(true));
refreshGlobalIcon();
capturedTabIds().then(ids => ids.forEach(id => capturedTabs.add(id))).catch(() => {});
