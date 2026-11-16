self.Module = { locateFile: (p, d) => `${d || ''}sherpa-stream/${p}`, print: () => {}, printErr: t => console.warn('[sherpa]', t) };
const runtimeReady = new Promise(r => { self.Module.onRuntimeInitialized = r; });
importScripts('sherpa-stream/sherpa-onnx-wasm-main-asr.js', 'sherpa-stream/sherpa-onnx-asr.js');
const RATE = 16000;
onmessage = async ({ data: o }) => {
  try {
    const t0 = performance.now();
    const files = await Promise.all(['encoder.int8.onnx', 'decoder.int8.onnx', 'joiner.int8.onnx', 'tokens.txt'].map(async f => [f, new Uint8Array(await (await fetch('models/conformer/' + f)).arrayBuffer())]));
    await runtimeReady;
    const t1 = performance.now();
    for (const [f, d] of files) self.Module.FS_createDataFile('/', f, d, true, true, true);
    const rec = createOnlineRecognizer(self.Module, {
      featConfig: { sampleRate: RATE, featureDim: 80 },
      modelConfig: {
        transducer: { encoder: './encoder.int8.onnx', decoder: './decoder.int8.onnx', joiner: './joiner.int8.onnx' },
        paraformer: { encoder: '', decoder: '' }, zipformer2Ctc: { model: '' }, nemoCtc: { model: '' }, toneCtc: { model: '' },
        tokens: './tokens.txt', numThreads: 1, provider: 'cpu', debug: 0, modelType: '', modelingUnit: '', bpeVocab: ''
      },
      decodingMethod: o.method, maxActivePaths: 4, enableEndpoint: 0, blankPenalty: o.blank,
      hotwordsFile: '', hotwordsScore: 1.5, ctcFstDecoderConfig: { graph: '', maxActive: 3000 }, ruleFsts: '', ruleFars: ''
    });
    const initMs = performance.now() - t1;
    const out = [];
    for (const b64 of o.clips) {
      const bin = atob(b64);
      const audio = new Float32Array(new Uint8Array(Array.from(bin, c => c.charCodeAt(0))).buffer);
      const st = rec.createStream();
      const chunk = Math.round(o.chunk * RATE);
      const feed = a => { const s = new Float32Array(a.length); for (let i = 0; i < a.length; i++) s[i] = a[i] * o.gain; st.acceptWaveform(RATE, s); };
      feed(new Float32Array(Math.round(0.16 * RATE)));
      let busy = 0, worst = 0; const steps = [];
      for (let at = 0; at < audio.length; at += chunk) {
        feed(audio.subarray(at, at + chunk));
        const d0 = performance.now();
        while (rec.isReady(st)) rec.decode(st);
        const ms = performance.now() - d0; busy += ms; worst = Math.max(worst, ms);
        const r = rec.getResult(st);
        steps.push({ arrives: Math.min(at + chunk, audio.length) / RATE, ms, text: r.text, pieces: (r.tokens || []).length });
      }
      feed(new Float32Array(3 * RATE)); st.inputFinished();
      const d0 = performance.now(); while (rec.isReady(st)) rec.decode(st); busy += performance.now() - d0;
      const r = rec.getResult(st);
      out.push({ seconds: audio.length / RATE, busy, worst, text: r.text, tokens: r.tokens || [], timestamps: r.timestamps || [], steps });
      st.free();
    }
    postMessage({ type: 'done', loadMs: t1 - t0, initMs, out });
  } catch (e) { postMessage({ type: 'error', message: String(e && e.message || e) }); }
};
