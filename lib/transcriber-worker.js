// Limitr speech-model worker: runs lib/transcriber-models.js off the main thread of the page that
// hosts captions. lib/transcriber.js sends { id, type, ...args } and gets { id, result | error }.

import { loadModel, detectLanguage, transcribe } from './transcriber-models.js';

const handlers = {
  load: ({ key }) => loadModel(key).then(() => true),
  detect: ({ key, audio }) => detectLanguage(key, audio),
  transcribe: ({ key, audio, options, reuseEncoding }) => transcribe(key, audio, options, reuseEncoding)
};

self.onmessage = async (event) => {
  const { id, type, ...args } = event.data || {};
  try {
    const result = await handlers[type](args);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: (error && error.message) || String(error) });
  }
};
