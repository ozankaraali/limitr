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
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'limitr-bridge-storage-set') {
      try {
        chrome.storage.local.set(event.data.data);
      } catch (e) {
        // Extension context invalidated (e.g. after update/reload)
      }
    }
  });
})();
