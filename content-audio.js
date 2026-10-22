// Limitr page mode — runs in the page's MAIN world (all frames, document_start).
// Routes <video>/<audio> elements through LimitrEngine with MediaElementSource.
//
// Rerouting a media element into Web Audio can't be undone, so this script only does it
// when the result is guaranteed to be audible:
//   - the AudioContext is confirmed running (autoplay policy), otherwise it waits for a gesture
//   - the media is not cross-origin without CORS (Web Audio would output silence)
//   - the media is not DRM-protected (EME output is silent in Web Audio)
//   - the media is not a WebRTC/MediaStream (calls)
// Anything skipped plays exactly as the page intended.
//
// Settings arrive from content-bridge.js (ISOLATED world), which reads chrome.storage.

(function () {
  'use strict';

  const FLAG = Symbol.for('limitr.page');
  if (window[FLAG]) return;
  Object.defineProperty(window, FLAG, { value: true });

  const Engine = window.LimitrEngine;
  if (!Engine) return;

  const BRIDGE = 'limitr-bridge';
  const PAGE = 'limitr-page';
  const RESUME_TIMEOUT_MS = 300;
  // A running AudioContext costs the browser's real-time audio thread several percent of a core
  // even when nothing plays, so after this long with no processed player playing it is suspended,
  // and the next play wakes it
  const IDLE_SUSPEND_MS = 10000;

  const state = {
    configured: false,
    settings: null,
    enabled: false,
    captured: false,
    captions: false,
    extensionBase: ''
  };

  let ctx = null;
  let engine = null;
  let enginePromise = null;
  const attached = new WeakSet();
  let attachedCount = 0;
  const waiting = new Set();     // elements waiting for the AudioContext to be allowed to start
  const skipped = new Map();     // reason -> count of distinct elements
  const skippedElements = new WeakSet();
  // Skipped players Whole tab could reach; while one plays, the toolbar asks for attention
  const ATTENTION_REASONS = new Set(['cross-origin', 'drm', 'page-audio']);
  const unreachable = new Set();  // WeakRefs, so a player the page drops can still be collected
  const sources = [];
  let gestureListening = false;
  let idleTimer = null;
  let idleSuspended = false;
  let gestureListener = null;
  let transcriber = null;
  let transcriberPending = null;
  const GESTURES = ['pointerdown', 'keydown', 'touchend', 'click'];

  // ---------- bridge messaging ----------
  function post(type, payload = {}, transfer) {
    window.postMessage({ source: PAGE, type, ...payload }, '*', transfer || []);
  }

  const pendingRequests = new Map();
  function request(type, payload = {}, timeoutMs = 10000) {
    const id = Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Timed out: ${type}`));
      }, timeoutMs);
      pendingRequests.set(id, { resolve, reject, timer });
      post(type, { id, ...payload });
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== BRIDGE) return;
    const msg = event.data;
    switch (msg.type) {
      case 'config':
        applyConfig(msg);
        break;
      case 'response': {
        const pending = pendingRequests.get(msg.id);
        if (!pending) return;
        pendingRequests.delete(msg.id);
        clearTimeout(pending.timer);
        if (msg.error) pending.reject(new Error(msg.error));
        else pending.resolve(msg.payload);
        break;
      }
      case 'get-meters':
        post('meters', { id: msg.id, meters: meters(Boolean(msg.trace)) });
        break;
      case 'reset-analysis':
        if (engine) engine.resetAnalysis();
        break;
    }
  });

  // ---------- resources from the extension ----------
  async function loadModule(path) {
    try {
      await ctx.audioWorklet.addModule(state.extensionBase + path);
      return;
    } catch (e) {
      // Some pages block extension URLs for worklets; try a blob URL with the same source.
    }
    const source = await request('fetch-resource', { path, as: 'text' });
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function loadBinary(path) {
    return request('fetch-resource', { path, as: 'arrayBuffer' });
  }

  // ---------- engine lifecycle ----------
  function ensureEngine() {
    if (enginePromise) return enginePromise;
    ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
    engine = new Engine(ctx, {
      loadModule,
      loadBinary,
      onStatus: reportStatus,
      log: (...args) => console.debug('[Limitr]', ...args)
    });
    engine.update(state.settings, isActive());
    engine.output.connect(ctx.destination);
    // The context can start after resume() stopped waiting for it (a slow start, or a gesture we
    // didn't see); players parked until then must attach without needing another click.
    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'running') {
        idleSuspended = false;
        attachWaiting();
      }
    });
    enginePromise = engine.init().then(() => engine);
    return enginePromise;
  }

  function isActive() {
    return state.enabled && !state.captured;
  }

  function applyConfig(msg) {
    state.settings = msg.settings;
    state.enabled = Boolean(msg.enabled);
    state.captured = Boolean(msg.captured);
    state.captions = Boolean(msg.captions);
    if (msg.extensionBase) state.extensionBase = msg.extensionBase;
    const first = !state.configured;
    state.configured = true;
    if (engine) engine.update(state.settings, isActive());
    if (isActive()) scanPlaying();
    syncTranscriber();
    if (first) reportStatus();
  }

  // ---------- deciding whether an element can be processed ----------
  function blockedReason(el) {
    if (el.srcObject) return 'stream';
    if (el.mediaKeys) return 'drm';
    const src = el.currentSrc || el.src;
    if (!src) return 'no-source';
    let url;
    try {
      url = new URL(src, location.href);
    } catch (e) {
      return 'no-source';
    }
    if (url.protocol === 'blob:' || url.protocol === 'data:') return null;
    if (url.origin === location.origin) return null;
    if (el.crossOrigin === 'anonymous' || el.crossOrigin === 'use-credentials') return null;
    return 'cross-origin';
  }

  function isAudible(el) {
    return !el.paused && !el.muted && el.volume > 0;
  }

  async function contextRunning() {
    if (ctx.state === 'running') return true;
    try {
      await Promise.race([
        ctx.resume(),
        new Promise(resolve => setTimeout(resolve, RESUME_TIMEOUT_MS))
      ]);
    } catch (e) { /* not allowed yet */ }
    return ctx.state === 'running';
  }

  function listenForGesture() {
    if (gestureListening) return;
    gestureListening = true;
    const onGesture = () => {
      if (!ctx) return;
      ctx.resume().then(() => {
        if (ctx.state === 'running') attachWaiting();
      }).catch(() => {});
    };
    gestureListener = onGesture;
    for (const type of GESTURES) window.addEventListener(type, onGesture, true);
  }

  function attachWaiting() {
    if (gestureListening) {
      gestureListening = false;
      for (const type of GESTURES) window.removeEventListener(type, gestureListener, true);
    }
    const pending = [...waiting];
    waiting.clear();
    pending.forEach(el => considerElement(el));
  }

  async function considerElement(el) {
    if (!state.configured || !isActive() || attached.has(el) || !isAudible(el)) return;

    const reason = blockedReason(el);
    if (reason === 'no-source') {
      el.addEventListener('loadedmetadata', () => considerElement(el), { once: true });
      return;
    }
    if (reason) {
      if (!skippedElements.has(el)) {
        skippedElements.add(el);
        skipped.set(reason, (skipped.get(reason) || 0) + 1);
        if (ATTENTION_REASONS.has(reason)) trackUnreachable(el);
        reportStatus();
      }
      return;
    }

    await ensureEngine();
    if (attached.has(el) || !isActive()) return;
    if (!(await contextRunning())) {
      waiting.add(el);
      listenForGesture();
      reportStatus();
      return;
    }
    if (attached.has(el)) return;

    try {
      const source = ctx.createMediaElementSource(el);
      source.connect(engine.input);
      if (transcriber) source.connect(transcriber.input);
      attached.add(el);
      attachedCount++;
      sources.push(source);
      engine.resetAnalysis();
      followSiteVolume(el);
      followPlayback(el);
      reportStatus();
      syncTranscriber();
    } catch (e) {
      // The page already routes this element through its own Web Audio graph
      if (!skippedElements.has(el)) {
        skippedElements.add(el);
        skipped.set('page-audio', (skipped.get('page-audio') || 0) + 1);
        trackUnreachable(el);
        reportStatus();
      }
    }
  }

  function scanPlaying() {
    const elements = document.querySelectorAll('video, audio');
    for (const el of elements) {
      if (isAudible(el)) considerElement(el);
    }
  }

  // Media events don't bubble, but capture-phase listeners on window still see them.
  const onMediaEvent = (event) => {
    const el = event.target;
    if (el instanceof HTMLMediaElement) considerElement(el);
  };
  window.addEventListener('play', onMediaEvent, true);
  window.addEventListener('playing', onMediaEvent, true);
  window.addEventListener('volumechange', onMediaEvent, true);

  // Elements that never enter the document (new Audio()) or live in shadow roots don't
  // dispatch events we can see, so also catch play() calls directly.
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play() {
    const result = nativePlay.apply(this, arguments);
    const el = this;
    if (state.configured && isActive() && !attached.has(el)) {
      Promise.resolve(result).then(() => considerElement(el), () => {});
    }
    return result;
  };

  // The site's own volume reaches the engine before the guard: a change there is a plain gain,
  // not louder or quieter content. And new media starts with a fresh idea of normal.
  const siteVolume = new WeakMap();
  function followSiteVolume(el) {
    siteVolume.set(el, el.muted ? 0 : el.volume);
    el.addEventListener('volumechange', () => {
      const before = siteVolume.get(el);
      const now = el.muted ? 0 : el.volume;
      siteVolume.set(el, now);
      // Only when this player is the one playing through the engine
      const playing = sources.filter(s => isAudible(s.mediaElement)).length;
      if (engine && before > 0 && now > 0 && playing <= 1) engine.shiftAnalysis(20 * Math.log10(now / before));
    });
    for (const type of ['loadstart', 'emptied']) {
      el.addEventListener(type, () => { if (engine) engine.resetAnalysis(); });
    }
  }

  // ---------- idle: no processed player playing ----------
  // Listened for on the element itself, so detached and shadow-DOM players count too
  function followPlayback(el) {
    for (const type of ['play', 'playing']) el.addEventListener(type, wake);
    for (const type of ['pause', 'ended', 'emptied']) el.addEventListener(type, scheduleIdle);
  }

  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(suspendIfIdle, IDLE_SUSPEND_MS);
  }

  // Only once the page has had a gesture: then the browser always lets the context resume, so a
  // processed player is never left silent (one that autoplayed without a gesture stays running)
  function suspendIfIdle() {
    idleTimer = null;
    if (!ctx || ctx.state !== 'running' || sources.some(s => !s.mediaElement.paused)) return;
    if (!(navigator.userActivation && navigator.userActivation.hasBeenActive)) return;
    idleSuspended = true;
    ctx.suspend().catch(() => { idleSuspended = false; }).finally(reportStatus);
  }

  function wake() {
    clearTimeout(idleTimer);
    idleTimer = null;
    if (!idleSuspended) return;
    idleSuspended = false;
    ctx.resume().catch(() => {}).finally(reportStatus);
  }

  // Listen on the element itself: detached and shadow-DOM players don't reach window listeners
  function trackUnreachable(el) {
    unreachable.add(new WeakRef(el));
    for (const type of ['play', 'playing', 'pause', 'ended', 'volumechange', 'emptied']) {
      el.addEventListener(type, reportStatus);
    }
  }

  function playingUnreachable() {
    let count = 0;
    for (const ref of unreachable) {
      const el = ref.deref();
      if (!el) unreachable.delete(ref);
      else if (isAudible(el)) count++;
    }
    return count;
  }

  // ---------- status & meters ----------
  let statusTimer = null;
  function reportStatus() {
    if (statusTimer) return;
    statusTimer = setTimeout(() => {
      statusTimer = null;
      post('status', {
        status: {
          attached: attachedCount,
          waitingForGesture: waiting.size,
          playingSkipped: playingUnreachable(),
          skipped: Object.fromEntries(skipped),
          contextState: ctx ? ctx.state : 'none',
          dsp: engine ? engine.status.dsp : 'none',
          denoise: engine ? engine.status.denoise : 'off'
        }
      });
    }, 50);
  }

  function meters(withTrace = false) {
    return {
      attached: attachedCount,
      waitingForGesture: waiting.size,
      skipped: Object.fromEntries(skipped),
      ...(engine ? engine.getMeters(withTrace) : {})
    };
  }

  // ---------- captions: stream pre-processing audio to the extension transcriber ----------
  // Whole-tab capture taps audio itself, so pages only stream while not captured.
  function syncTranscriber() {
    const wanted = state.captions && !state.captured && attachedCount > 0;
    if (wanted && !transcriber && !transcriberPending) {
      transcriberPending = startTranscriber()
        .catch(err => post('log', { message: `Captions: ${err.message}` }))
        .finally(() => {
          transcriberPending = null;
          syncTranscriber();
        });
    } else if (!wanted && transcriber && !transcriberPending) {
      transcriber.node.port.postMessage({ type: 'enable', enabled: false });
      transcriber.input.disconnect();
      transcriber = null;
    }
  }

  async function startTranscriber() {
    await ensureEngine();
    await loadModule('lib/transcriber-capture-worklet.js');
    const input = ctx.createGain();
    // No outputs: the node is a pure sink and gets pulled without connecting to destination
    const node = new AudioWorkletNode(ctx, 'transcriber-capture-processor', { numberOfOutputs: 0 });
    node.port.onmessage = (event) => {
      if (event.data.type !== 'audio-chunk') return;
      const audio = event.data.audio;
      post('transcriber-audio', { audio }, [audio.buffer]);
    };
    input.connect(node);
    transcriber = { input, node };
    sources.forEach(source => source.connect(input));
  }

  post('hello');
})();
