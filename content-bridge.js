// Limitr content bridge — ISOLATED world, all frames, document_start.
// Feeds settings from chrome.storage to content-audio.js (MAIN world) and relays status,
// meters, worklet resources and caption audio between the page and the extension.

(function () {
  'use strict';

  const api = typeof browser !== 'undefined' ? browser : chrome;
  // After a Chrome extension update, freshly injected scripts can share the isolated world
  // with the previous version's orphaned bridge. Only a live bridge blocks a new one.
  const alive = () => {
    try { return Boolean(api.runtime && api.runtime.id); } catch (e) { return false; }
  };
  const previous = globalThis.__limitrBridge;
  if (previous && previous.alive()) return;
  globalThis.__limitrBridge = { alive };
  const { LimitrSettings } = globalThis;
  const BRIDGE = 'limitr-bridge';
  const PAGE = 'limitr-page';
  const ALLOWED_RESOURCES = new Set([
    'lib/dsp-worklet.js',
    'lib/noise-suppressor-worklet.js',
    'lib/rnnoise.wasm',
    'lib/transcriber-capture-worklet.js'
  ]);
  const WATCHED_KEYS = [
    LimitrSettings.STORAGE_KEYS.settings,
    LimitrSettings.STORAGE_KEYS.enabled,
    LimitrSettings.STORAGE_KEYS.mode
  ];

  const current = { settings: null, enabled: false, captured: false, captions: false };
  // Read by the popup via scripting.executeScript to find the frame that holds the media
  globalThis.__limitrBridgeStatus = { attached: 0, skipped: {}, waitingForGesture: 0 };
  let lastReported = '';
  let reportTimer = null;

  function postToPage(type, payload = {}, transfer) {
    window.postMessage({ source: BRIDGE, type, ...payload }, '*', transfer || []);
  }

  function sendConfig() {
    if (!current.settings) return;
    postToPage('config', {
      settings: current.settings,
      enabled: current.enabled,
      captured: current.captured,
      captions: current.captions,
      extensionBase: api.runtime.getURL('')
    });
  }

  // Tells the background what this frame is doing so it can colour the toolbar icon. A change is
  // sent straight away; further changes within 250 ms are coalesced into one trailing report.
  let lastSentAt = 0;

  function sendReport(report) {
    const key = JSON.stringify(report);
    if (key === lastReported) return;
    // The background starts every frame at nothing, so most frames (no players) never need to
    // wake it; reports begin with the first change from there
    if (!lastReported && !report.attached && !report.waitingForGesture && !report.playingSkipped) return;
    lastReported = key;
    lastSentAt = Date.now();
    api.runtime.sendMessage({ action: 'limitr-status', ...report }).catch(() => {});
  }

  function currentReport() {
    const status = globalThis.__limitrBridgeStatus;
    return {
      attached: status.attached || 0,
      waitingForGesture: status.waitingForGesture || 0,
      playingSkipped: status.playingSkipped || 0,
      enabled: current.enabled
    };
  }

  function reportStatusToBackground() {
    if (reportTimer) return;
    const wait = 250 - (Date.now() - lastSentAt);
    if (wait <= 0) {
      sendReport(currentReport());
      return;
    }
    reportTimer = setTimeout(() => {
      reportTimer = null;
      sendReport(currentReport());
    }, wait);
  }

  // A frame that goes away (an ad iframe removed, a navigation) stops counting immediately
  window.addEventListener('pagehide', () => {
    clearTimeout(reportTimer);
    reportTimer = null;
    if (lastReported) sendReport({ attached: 0, waitingForGesture: 0, playingSkipped: 0, enabled: current.enabled });
  });
  // Back/forward cache: the same page comes back with its players, so report them again
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) reportStatusToBackground();
  });

  async function loadState() {
    try {
      const state = await LimitrSettings.load(api.storage.local);
      current.settings = state.settings;
      current.enabled = state.enabled;
      sendConfig();
      reportStatusToBackground();
    } catch (e) {
      // Extension context invalidated (extension reloaded) — leave the page alone
    }
  }

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (WATCHED_KEYS.some(key => key in changes)) loadState();
  });

  api.runtime.sendMessage({ action: 'limitr-frame-hello' }).then(response => {
    if (response && (response.captured || response.captions)) {
      current.captured = Boolean(response.captured);
      current.captions = Boolean(response.captions);
      sendConfig();
    }
  }).catch(() => {});

  loadState();

  // ---------- caption audio: Float32 PCM → base64 int16 (extension messaging is JSON in Chrome) ----------
  function encodePcm(float32) {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const v = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  // ---------- page → bridge ----------
  const meterRequests = new Map();

  function onPageMessage(event) {
    if (event.source !== window || !event.data || event.data.source !== PAGE) return;
    if (!alive()) {
      // This bridge belongs to an unloaded version of the extension; let the live one answer
      window.removeEventListener('message', onPageMessage);
      return;
    }
    const msg = event.data;
    switch (msg.type) {
      case 'hello':
        sendConfig();
        break;
      case 'status':
        globalThis.__limitrBridgeStatus = msg.status;
        reportStatusToBackground();
        break;
      case 'meters': {
        const resolve = meterRequests.get(msg.id);
        if (resolve) {
          meterRequests.delete(msg.id);
          resolve(msg.meters);
        }
        break;
      }
      case 'fetch-resource':
        fetchResource(msg);
        break;
      case 'transcriber-audio':
        api.runtime.sendMessage({ action: 'limitr-transcriber-audio', pcm: encodePcm(msg.audio) }).catch(() => {});
        break;
      case 'log':
        console.debug('[Limitr]', msg.message);
        break;
    }
  }
  window.addEventListener('message', onPageMessage);

  async function fetchResource({ id, path, as }) {
    try {
      if (!ALLOWED_RESOURCES.has(path)) throw new Error(`Resource not allowed: ${path}`);
      const response = await fetch(api.runtime.getURL(path));
      if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
      const payload = as === 'arrayBuffer' ? await response.arrayBuffer() : await response.text();
      postToPage('response', { id, payload }, payload instanceof ArrayBuffer ? [payload] : []);
    } catch (error) {
      postToPage('response', { id, error: error.message });
    }
  }

  function requestMeters() {
    const id = Math.random().toString(36).slice(2);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        meterRequests.delete(id);
        resolve(null);
      }, 500);
      meterRequests.set(id, meters => {
        clearTimeout(timer);
        resolve(meters);
      });
      postToPage('get-meters', { id });
    });
  }

  // ---------- extension → bridge ----------
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.action !== 'string') return false;
    switch (message.action) {
      case 'limitr-get-meters':
        requestMeters().then(sendResponse);
        return true;
      case 'limitr-capture-state':
        current.captured = Boolean(message.captured);
        sendConfig();
        sendResponse({ ok: true });
        return false;
      case 'limitr-captions':
        // Remembered so players that attach later (any frame) start streaming caption audio
        current.captions = Boolean(message.enabled);
        sendConfig();
        return false;
      case 'limitr-reset-analysis':
        postToPage('reset-analysis');
        return false;
      default:
        return false;
    }
  });
})();
