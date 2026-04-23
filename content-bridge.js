// Limitr Content Bridge - runs in ISOLATED world
// Forwards messages between chrome.runtime and the MAIN world content-audio.js

(function() {
  'use strict';

  if (window._limitrBridgeInitialized) return;
  window._limitrBridgeInitialized = true;

  // Forward chrome.runtime messages to MAIN world
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message.action || !message.action.startsWith('fallback-')) return;

      const id = Math.random().toString(36).slice(2);

      function onResponse(event) {
        if (event.data && event.data.type === 'limitr-bridge-response' && event.data.id === id) {
          window.removeEventListener('message', onResponse);
          sendResponse(event.data.payload);
        }
      }
      window.addEventListener('message', onResponse);

      window.postMessage({
        type: 'limitr-bridge-request',
        id,
        action: message.action,
        payload: message
      }, '*');

      return true; // async response
    });
  } catch (e) {
    // Extension context invalidated
  }

  // Forward storage data to MAIN world on init
  try {
    chrome.storage.local.get(['limitrFallbackSettings', 'limitrCurrentSettings', 'limitrGlobalEnabled'], (stored) => {
      window.postMessage({
        type: 'limitr-bridge-init',
        stored
      }, '*');
    });
  } catch (e) {
    // Extension context invalidated — send empty init so content script starts with defaults
    window.postMessage({ type: 'limitr-bridge-init', stored: {} }, '*');
  }

  // Listen for storage write requests from MAIN world
  const allowedResourcePaths = new Set([
    'lib/noise-suppressor-worklet.js',
    'lib/rnnoise.wasm'
  ]);

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'limitr-bridge-storage-set') {
      try {
        chrome.storage.local.set(event.data.data);
      } catch (e) {
        // Extension context invalidated (e.g. after update/reload)
      }
    } else if (event.data && event.data.type === 'limitr-bridge-fetch-resource') {
      const { id, path, responseType } = event.data;

      (async () => {
        try {
          if (!allowedResourcePaths.has(path)) {
            throw new Error(`Resource not allowed: ${path}`);
          }

          if (responseType === 'url') {
            window.postMessage({
              type: 'limitr-bridge-resource-response',
              id,
              success: true,
              payload: chrome.runtime.getURL(path)
            }, '*');
            return;
          }

          const response = await fetch(chrome.runtime.getURL(path));
          if (!response.ok) {
            throw new Error(`Failed to load ${path}: ${response.status}`);
          }

          const payload = responseType === 'arrayBuffer'
            ? await response.arrayBuffer()
            : await response.text();
          const message = {
            type: 'limitr-bridge-resource-response',
            id,
            success: true,
            payload
          };

          if (payload instanceof ArrayBuffer) {
            window.postMessage(message, '*', [payload]);
          } else {
            window.postMessage(message, '*');
          }
        } catch (error) {
          window.postMessage({
            type: 'limitr-bridge-resource-response',
            id,
            success: false,
            error: error.message
          }, '*');
        }
      })();
    }
  });
})();
