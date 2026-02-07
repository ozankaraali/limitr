// Limitr Content Script — Video Subtitle Overlay
// Anchors transcription captions to the bottom of video elements,
// using the same fixed-position + rAF tracking pattern as content.js (CRT)

(function () {
  'use strict';

  if (window.__limitrTranscribeInjected) return;
  window.__limitrTranscribeInjected = true;

  const MAX_LINES = 3;
  const FADE_DELAY_MS = 8000;

  let isEnabled = false;
  let styleElement = null;
  let animationFrameId = null;
  let hideTimeout = null;
  let observer = null;

  // video -> { overlay, updatePosition }
  const overlays = new Map();

  // Rolling transcript lines (shared across all video overlays)
  let lines = [];

  // ── Styles ──────────────────────────────────────────────────────

  const SUBTITLE_STYLES = `
.limitr-subtitle-overlay {
  position: fixed;
  pointer-events: none;
  z-index: 2147483647;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 24px;
}

.limitr-subtitle-text {
  display: inline-block;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: clamp(14px, 1.8vw, 22px);
  line-height: 1.4;
  padding: 6px 14px;
  border-radius: 4px;
  max-width: 90%;
  text-align: center;
  white-space: pre-line;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  transition: opacity 0.3s ease;
}
`;

  function injectStyles() {
    if (styleElement) return;
    styleElement = document.createElement('style');
    styleElement.id = 'limitr-subtitle-styles';
    styleElement.textContent = SUBTITLE_STYLES;
    (document.head || document.documentElement).appendChild(styleElement);
  }

  function removeStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }
  }

  // ── Per-video overlay (same pattern as CRT) ─────────────────────

  function createOverlay(video) {
    if (overlays.has(video)) return;

    const rect = video.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 50) return;

    const overlay = document.createElement('div');
    overlay.className = 'limitr-subtitle-overlay';

    const textEl = document.createElement('div');
    textEl.className = 'limitr-subtitle-text';
    overlay.appendChild(textEl);
    document.body.appendChild(overlay);

    const updatePosition = () => {
      const r = video.getBoundingClientRect();
      if (r.width < 50 || r.height < 50 || r.bottom < 0 || r.top > window.innerHeight) {
        overlay.style.display = 'none';
        return;
      }
      overlay.style.display = '';
      overlay.style.top = `${r.top}px`;
      overlay.style.left = `${r.left}px`;
      overlay.style.width = `${r.width}px`;
      overlay.style.height = `${r.height}px`;
    };

    updatePosition();
    overlays.set(video, { overlay, textEl, updatePosition });

    // Apply current transcript immediately
    renderLines();
  }

  function removeOverlay(video) {
    const data = overlays.get(video);
    if (data) {
      data.overlay.remove();
      overlays.delete(video);
    }
  }

  // ── Position tracking (rAF loop, same as CRT) ──────────────────

  function startPositionUpdates() {
    if (animationFrameId) return;
    function update() {
      overlays.forEach(({ updatePosition }) => updatePosition());
      animationFrameId = requestAnimationFrame(update);
    }
    animationFrameId = requestAnimationFrame(update);
  }

  function stopPositionUpdates() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // ── Video discovery ─────────────────────────────────────────────

  function processVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (isEnabled) {
        createOverlay(video);
      } else {
        removeOverlay(video);
      }
    });
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (isEnabled) processVideos();
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // ── Render transcript text into all video overlays ──────────────

  function renderLines() {
    const text = lines.join('\n');
    overlays.forEach(({ textEl, overlay }) => {
      textEl.textContent = text;
      textEl.style.opacity = text ? '1' : '0';
    });
  }

  function showSubtitle(text) {
    lines.push(text);
    while (lines.length > MAX_LINES) lines.shift();
    renderLines();

    // Reset fade timer
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      lines = [];
      renderLines();
    }, FADE_DELAY_MS);
  }

  // ── Enable / disable ───────────────────────────────────────────

  function enable() {
    if (isEnabled) return;
    isEnabled = true;
    injectStyles();
    processVideos();
    startObserver();
    startPositionUpdates();
  }

  function disable() {
    if (!isEnabled) return;
    isEnabled = false;
    stopPositionUpdates();
    stopObserver();
    overlays.forEach((_, video) => removeOverlay(video));
    overlays.clear();
    removeStyles();
    lines = [];
    if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
  }

  // ── Messages from background ────────────────────────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'transcription-result') {
      if (!isEnabled) enable();
      showSubtitle(message.result.text);
    }

    if (message.action === 'transcription-status') {
      if (message.status === 'stopped') {
        disable();
      }
    }
  });

  // Enable immediately on injection (popup already validated state)
  if (document.body) {
    enable();
  } else {
    document.addEventListener('DOMContentLoaded', () => enable());
  }
})();
