// Limitr Content Bridge - runs in ISOLATED world
// Forwards messages between chrome.runtime and the MAIN world content-audio.js

(function() {
  'use strict';

  if (window._limitrBridgeInitialized) return;
  window._limitrBridgeInitialized = true;
  let transcriberModulePromise = null;

  // On Firefox the background runs as a document and hosts the transcriber
  // there — loading it in this content-script sandbox hits cross-realm
  // instanceof failures inside transformers.js/ORT. Feature-detect via the
  // absence of chrome.offscreen (Chrome has it, Firefox doesn't).
  const delegateTranscriberToBackground = !chrome.offscreen?.createDocument;

  function postBridgeResponse(id, payload) {
    window.postMessage({
      type: 'limitr-bridge-response',
      id,
      payload
    }, '*');
  }

  async function ensureTranscriberModule() {
    if (window.LimitrTranscriber) return window.LimitrTranscriber;

    if (!window.LimitrExtensionRuntime) {
      const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;
      window.LimitrExtensionRuntime = {
        getURL: path => runtime.getURL(path),
        sendMessage: payload => runtime.sendMessage(payload)
      };
    }

    if (!transcriberModulePromise) {
      transcriberModulePromise = import(chrome.runtime.getURL('lib/transcriber.js'));
    }

    await transcriberModulePromise;
    return window.LimitrTranscriber;
  }

  async function sendTranscriberActionToBackground(action, payload = {}) {
    const response = await chrome.runtime.sendMessage({ action, ...payload });
    return response;
  }

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
    'lib/peak-guard-worklet.js',
    'lib/rnnoise.wasm',
    'lib/transcriber-capture-worklet.js'
  ]);

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'limitr-bridge-storage-set') {
      try {
        chrome.storage.local.set(event.data.data);
      } catch (e) {
        // Extension context invalidated (e.g. after update/reload)
      }
    } else if (event.data && event.data.type === 'limitr-bridge-transcriber-start') {
      const { id, tabId } = event.data;

      (async () => {
        try {
          if (delegateTranscriberToBackground) {
            const response = await sendTranscriberActionToBackground('bg-transcriber-start', { tabId });
            postBridgeResponse(id, response || { success: true });
          } else {
            const transcriber = await ensureTranscriberModule();
            await transcriber.startExternal(tabId);
            postBridgeResponse(id, { success: true });
          }
        } catch (error) {
          postBridgeResponse(id, { success: false, error: error.message });
        }
      })();
    } else if (event.data && event.data.type === 'limitr-bridge-transcriber-audio') {
      const { tabId, audio } = event.data;
      if (delegateTranscriberToBackground) {
        // Fire-and-forget: structured clone copies the Float32Array into the
        // background document's realm where transformers.js will accept it.
        chrome.runtime.sendMessage({ action: 'bg-transcriber-audio', tabId, audio }).catch(() => {});
      } else if (window.LimitrTranscriber) {
        window.LimitrTranscriber.pushAudio(tabId, audio);
      }
    } else if (event.data && event.data.type === 'limitr-bridge-transcriber-stop') {
      const { id, tabId } = event.data;

      (async () => {
        try {
          if (delegateTranscriberToBackground) {
            const response = await sendTranscriberActionToBackground('bg-transcriber-stop', { tabId });
            postBridgeResponse(id, response || { success: true });
          } else {
            const transcriber = await ensureTranscriberModule();
            transcriber.stop(tabId);
            postBridgeResponse(id, { success: true });
          }
        } catch (error) {
          postBridgeResponse(id, { success: false, error: error.message });
        }
      })();
    } else if (event.data && event.data.type === 'limitr-bridge-transcriber-status') {
      const { id, tabId } = event.data;

      (async () => {
        if (delegateTranscriberToBackground) {
          try {
            const response = await sendTranscriberActionToBackground('bg-transcriber-status', { tabId });
            postBridgeResponse(id, response || { active: false, ready: false, loading: false });
          } catch (e) {
            postBridgeResponse(id, { active: false, ready: false, loading: false });
          }
          return;
        }

        if (transcriberModulePromise) {
          try { await transcriberModulePromise; } catch (e) {}
        }

        const transcriber = window.LimitrTranscriber;
        postBridgeResponse(id, {
          active: transcriber ? transcriber.isActive(tabId) : false,
          ready: transcriber ? transcriber.isReady() : false,
          loading: transcriber ? transcriber.isModelLoading() : false
        });
      })();
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
