// Limitr offscreen document (Chrome only).
// Tab capture mode: each captured tab's stream runs through its own LimitrEngine on a shared
// AudioContext. Also hosts the caption transcriber for both modes.

const captures = new Map();   // tabId -> { stream, source, engine, volumeDb }
let ctx = null;
let settings = null;
let enabled = true;

function getContext() {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
  return ctx;
}

const loadModule = path => getContext().audioWorklet.addModule(chrome.runtime.getURL(path));
const loadBinary = path => fetch(chrome.runtime.getURL(path)).then(r => r.arrayBuffer());

async function startCapture(tabId, streamId, nextSettings, nextEnabled) {
  settings = nextSettings;
  enabled = nextEnabled;
  if (captures.has(tabId)) {
    captures.get(tabId).engine.update(settings, enabled);
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }
  });
  const audioContext = getContext();
  if (audioContext.state === 'suspended') await audioContext.resume();

  const engine = new LimitrEngine(audioContext, {
    loadModule,
    loadBinary,
    log: (...args) => console.debug('[Limitr]', ...args)
  });
  engine.update(settings, enabled);
  await engine.init();

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(engine.input);
  engine.output.connect(audioContext.destination);

  // The capture ends if the tab's audio goes away for good (tab closed, capture revoked)
  stream.getAudioTracks().forEach(track => {
    track.addEventListener('ended', () => {
      stopCapture(tabId);
      chrome.runtime.sendMessage({ action: 'limitr-capture-ended', tabId }).catch(() => {});
    });
  });

  captures.set(tabId, { stream, source, engine, volumeDb: 0 });
}

function stopCapture(tabId) {
  const capture = captures.get(tabId);
  if (!capture) return;
  if (window.LimitrTranscriber) window.LimitrTranscriber.stop(tabId);
  capture.source.disconnect();
  capture.engine.dispose();
  capture.stream.getTracks().forEach(track => track.stop());
  captures.delete(tabId);
}

// Audio only flows while a tab wants captions. Audio for an unknown tab means this document
// was recreated since captions started, so pick them back up (unless they were just stopped).
const captionsStoppedAt = new Map();
const restartingCaptions = new Set();

function receiveCaptionAudio(tabId, pcm) {
  const t = window.LimitrTranscriber;
  if (!t || Date.now() - (captionsStoppedAt.get(tabId) || 0) < 3000) return;
  if (t.isActive(tabId)) {
    t.pushAudio(tabId, decodePcm(pcm));
  } else if (!restartingCaptions.has(tabId)) {
    restartingCaptions.add(tabId);
    chrome.runtime.sendMessage({ target: 'background', action: 'captions-prefs' })
      .then(prefs => t.startExternal(tabId, prefs))
      .catch(() => {})
      .finally(() => restartingCaptions.delete(tabId));
  }
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Caption audio streamed straight from page-mode content scripts
  if (message.action === 'limitr-transcriber-audio' && sender.tab) {
    receiveCaptionAudio(sender.tab.id, message.pcm);
    return false;
  }
  if (message.target !== 'offscreen') return false;

  switch (message.action) {
    case 'capture-start':
      startCapture(message.tabId, message.streamId, message.settings, message.enabled)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'capture-stop':
      stopCapture(message.tabId);
      sendResponse({ success: true });
      return false;

    case 'capture-settings':
      settings = message.settings;
      enabled = message.enabled;
      for (const capture of captures.values()) capture.engine.update(settings, enabled);
      sendResponse({ success: true });
      return false;

    case 'capture-volume': {
      const capture = captures.get(message.tabId);
      if (capture) {
        capture.volumeDb = message.volumeDb;
        capture.engine.setTabVolume(message.volumeDb);
      }
      sendResponse({ success: Boolean(capture) });
      return false;
    }

    case 'capture-list':
      sendResponse({
        tabs: [...captures.entries()].map(([tabId, c]) => ({ tabId, volumeDb: c.volumeDb }))
      });
      return false;

    case 'capture-meters': {
      const capture = captures.get(message.tabId);
      sendResponse({ meters: capture ? { attached: 1, captured: true, ...capture.engine.getMeters(Boolean(message.trace)) } : null });
      return false;
    }

    case 'captions-start': {
      captionsStoppedAt.delete(message.tabId);
      if (!window.LimitrTranscriber) {
        sendResponse({ success: false, error: 'Transcriber module not loaded' });
        return false;
      }
      const capture = captures.get(message.tabId);
      const started = capture
        ? window.LimitrTranscriber.start(message.tabId, capture.source.context, capture.source, message.prefs)
        : window.LimitrTranscriber.startExternal(message.tabId, message.prefs);
      started
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'captions-config':
      if (window.LimitrTranscriber) window.LimitrTranscriber.configure(message.prefs);
      sendResponse({ success: true });
      return false;

    case 'captions-stop':
      captionsStoppedAt.set(message.tabId, Date.now());
      if (window.LimitrTranscriber) window.LimitrTranscriber.stop(message.tabId);
      sendResponse({ success: true });
      return false;

    case 'captions-status': {
      const t = window.LimitrTranscriber;
      sendResponse({
        active: t ? t.isActive(message.tabId) : false,
        loading: t ? t.isModelLoading() : false,
        session: t ? t.sessionInfo(message.tabId) : null
      });
      return false;
    }
  }
  return false;
});
