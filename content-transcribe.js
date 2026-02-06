// Limitr Content Script — Subtitle Overlay
// Displays transcription results as captions overlaid on the page

(function () {
  'use strict';

  // Prevent double-injection
  if (window.__limitrTranscribeInjected) return;
  window.__limitrTranscribeInjected = true;

  let overlay = null;
  let textEl = null;
  let hideTimeout = null;
  const MAX_LINES = 3;
  const FADE_DELAY_MS = 8000; // hide subtitles after 8s of no new text

  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'limitr-subtitle-overlay';
    overlay.style.cssText = [
      'position: fixed',
      'bottom: 60px',
      'left: 50%',
      'transform: translateX(-50%)',
      'z-index: 2147483647',
      'pointer-events: none',
      'max-width: 80vw',
      'text-align: center',
      'transition: opacity 0.3s ease',
      'opacity: 1'
    ].join(';');

    textEl = document.createElement('div');
    textEl.style.cssText = [
      'display: inline-block',
      'background: rgba(0, 0, 0, 0.8)',
      'color: #fff',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 16px',
      'line-height: 1.5',
      'padding: 8px 16px',
      'border-radius: 6px',
      'max-width: 100%',
      'word-wrap: break-word',
      'text-shadow: 0 1px 2px rgba(0,0,0,0.5)'
    ].join(';');

    overlay.appendChild(textEl);
    document.body.appendChild(overlay);
  }

  function removeOverlay() {
    if (overlay) {
      overlay.remove();
      overlay = null;
      textEl = null;
    }
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  }

  function showSubtitle(text) {
    ensureOverlay();

    // Split into lines, keep only the last MAX_LINES
    const lines = textEl.innerText ? textEl.innerText.split('\n') : [];
    lines.push(text);
    while (lines.length > MAX_LINES) lines.shift();
    textEl.innerText = lines.join('\n');

    overlay.style.opacity = '1';

    // Auto-hide after delay
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (overlay) overlay.style.opacity = '0';
    }, FADE_DELAY_MS);
  }

  // Listen for transcription messages from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'transcription-result') {
      showSubtitle(message.result.text);
    }

    if (message.action === 'transcription-status') {
      if (message.status === 'stopped') {
        removeOverlay();
      }
    }
  });
})();
