// The real caption pipeline (lib/transcriber.js: segmenter, language detection, engines) in an
// extension page, with its broadcasts captured here instead of sent. WASM only: WebGPU is hidden
// from this page. Driven by tests/bench/captions-bench.js.

Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });

const TAB = 1;
const messages = [];
window.LimitrExtensionRuntime = {
  getURL: path => chrome.runtime.getURL(path),
  sendMessage: payload => { messages.push({ ...payload, at: performance.now() }); }
};

function decode(pcmBase64, seconds) {
  const binary = atob(pcmBase64);
  const int16 = new Int16Array(binary.length >> 1);
  for (let i = 0; i < int16.length; i++) {
    int16[i] = (binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8)) << 16 >> 16;
  }
  const samples = Math.min(int16.length, Math.round(seconds * 16000));
  const audio = new Float32Array(samples);
  for (let i = 0; i < samples; i++) audio[i] = int16[i] / 0x8000;
  return audio;
}

window.bench = {
  // Starts a fresh session (Auto forgets the detected language) and waits for its model
  async start(prefs) {
    await import('../../lib/transcriber.js');
    window.LimitrTranscriber.stop(TAB);
    const started = performance.now();
    await window.LimitrTranscriber.startExternal(TAB, prefs);
    return performance.now() - started;
  },

  // Feeds a whole clip plus a second of silence and waits for the first finished caption.
  // latencyMs is the transcriber's own processing time for that sentence (detection included).
  async firstCaption(pcmBase64, seconds) {
    messages.length = 0;
    const pushedAt = performance.now();
    window.LimitrTranscriber.pushAudio(TAB, decode(pcmBase64, seconds));
    window.LimitrTranscriber.pushAudio(TAB, new Float32Array(16000));
    const deadline = pushedAt + 90000;
    while (performance.now() < deadline) {
      const hit = messages.find(m => m.action === 'transcription-result' && m.result && m.result.final);
      if (hit) {
        const detected = messages.find(m => m.action === 'transcription-status' && m.status === 'language');
        return { wallMs: hit.at - pushedAt, latencyMs: hit.result.latencyMs, text: hit.result.text, language: detected ? detected.language : hit.result.language };
      }
      await new Promise(r => setTimeout(r, 20));
    }
    return null;
  }
};

window.benchReady = true;
