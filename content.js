// Limitr Content Script - CRT Visual Effects
// Uses fixed-position overlays to avoid breaking video player layouts

(function() {
  'use strict';

  if (window.limitrCrtInitialized) return;
  window.limitrCrtInitialized = true;

  let isEnabled = false;
  let styleElement = null;
  const overlays = new Map(); // video -> { overlay, updatePosition }
  let animationFrameId = null;

  const CRT_STYLES = `
.limitr-crt-overlay {
  position: fixed;
  pointer-events: none;
  z-index: 2147483647;
  /* Scanlines */
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 2px,
    rgba(0, 0, 0, 0.3) 2px,
    rgba(0, 0, 0, 0.3) 4px
  );
  /* Vignette */
  box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.5);
}

.limitr-crt-overlay::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* RGB phosphor stripes */
  background: repeating-linear-gradient(
    90deg,
    rgba(255, 0, 0, 0.02) 0px,
    rgba(0, 255, 0, 0.02) 1px,
    rgba(0, 0, 255, 0.02) 2px,
    transparent 3px
  );
  pointer-events: none;
}

/* Only apply filter to video - no parent modifications */
video.limitr-crt-video {
  filter: contrast(1.1) brightness(0.95) saturate(1.15);
}
`;

  function injectStyles() {
    if (styleElement) return;
    styleElement = document.createElement('style');
    styleElement.id = 'limitr-crt-styles';
    styleElement.textContent = CRT_STYLES;
    (document.head || document.documentElement).appendChild(styleElement);
  }

  function removeStyles() {
    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }
  }

  function createOverlay(video) {
    if (overlays.has(video)) return;

    // Skip tiny or hidden videos
    const rect = video.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 50) return;

    // Create fixed overlay
    const overlay = document.createElement('div');
    overlay.className = 'limitr-crt-overlay';
    document.body.appendChild(overlay);

    // Add filter to video (minimal modification)
    video.classList.add('limitr-crt-video');

    // Position update function
    const updatePosition = () => {
      const r = video.getBoundingClientRect();
      // Hide if video not visible or too small
      if (r.width < 50 || r.height < 50 || r.bottom < 0 || r.top > window.innerHeight) {
        overlay.style.display = 'none';
        return;
      }
      overlay.style.display = 'block';
      overlay.style.top = `${r.top}px`;
      overlay.style.left = `${r.left}px`;
      overlay.style.width = `${r.width}px`;
      overlay.style.height = `${r.height}px`;
    };

    updatePosition();
    overlays.set(video, { overlay, updatePosition });
  }

  function removeOverlay(video) {
    const data = overlays.get(video);
    if (data) {
      data.overlay.remove();
      overlays.delete(video);
    }
    video.classList.remove('limitr-crt-video');
  }

  // Continuous position updates for scrolling/resizing/fullscreen
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

  let observer = null;

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

  function enable() {
    if (isEnabled) return;
    isEnabled = true;
    console.log('[Limitr CRT] Enabled');
    injectStyles();
    processVideos();
    startObserver();
    startPositionUpdates();
  }

  function disable() {
    if (!isEnabled) return;
    isEnabled = false;
    console.log('[Limitr CRT] Disabled');
    stopPositionUpdates();
    stopObserver();
    overlays.forEach((data, video) => removeOverlay(video));
    overlays.clear();
    removeStyles();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'set-crt-visual') {
      if (message.enabled) {
        enable();
      } else {
        disable();
      }
      chrome.storage.local.set({ crtVisualEnabled: message.enabled });
      sendResponse({ success: true });
    } else if (message.action === 'get-crt-visual') {
      sendResponse({ enabled: isEnabled });
    }
    return true;
  });

  // Script is injected on-demand, so enable immediately when injected
  if (document.body) {
    enable();
  } else {
    document.addEventListener('DOMContentLoaded', () => enable());
  }

  console.log('[Limitr CRT] Content script injected');
})();
