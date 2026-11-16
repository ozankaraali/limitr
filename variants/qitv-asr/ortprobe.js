// The Turkish Moonshine through onnxruntime-web (lib/ort.bundle.min.mjs, simd-threaded), greedy,
// at several thread counts, in the extension's bench page: encoder and decoder milliseconds
// node ortprobe.js [--models=small,mid] [--threads=1,2,4]
const path = require('path');
const fs = require('fs');
const os = require('os');
const ROOT = path.join(__dirname, '..', '..');
const B = require(path.join(ROOT, 'tests/bench/common'));
const { startStaticServer } = require(path.join(ROOT, 'tests/static-server'));

const S = __dirname;
const models = B.arg('models', 'small,mid').split(',');
const threadCounts = B.arg('threads', '1,2,4').split(',').map(Number);
const windows = B.arg('windows', '4,8,15').split(',').map(Number);
const clips = fs.readdirSync(path.join(S, 'clips')).filter(f => f.endsWith('.wav'));

// pcm_f32le wav: the samples after the 'data' chunk header
function samples(file) {
  const buf = fs.readFileSync(file);
  const at = buf.indexOf('data') + 8;
  return Buffer.from(buf.subarray(at)).toString('base64');
}

async function probe(model, base, clipsB64, windows, threads) {
  const ort = await import(chrome.runtime.getURL('lib/ort.bundle.min.mjs'));
  ort.env.wasm.wasmPaths = chrome.runtime.getURL('lib/');
  ort.env.wasm.numThreads = threads;
  const opts = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
  const t0 = performance.now();
  const encoder = await ort.InferenceSession.create(base + 'encoder_model_quantized.onnx', opts);
  const decoder = await ort.InferenceSession.create(base + 'decoder_model_merged_quantized.onnx', opts);
  const loadMs = performance.now() - t0;
  const tokenText = (await (await fetch(base + 'tokens.txt')).text()).trim().split('\n').map(l => {
    const [b64] = l.split(' ');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes).replace(/▁/g, ' ');
  });
  const past = decoder.inputNames.filter(n => n.startsWith('past_key_values.'));
  const heads = model === 'mid' ? 10 : 8;
  const empty = new ort.Tensor('float32', new Float32Array(0), [1, heads, 0, 64]);
  const out = [];
  for (const b64 of clipsB64) {
    const bin = atob(b64);
    const all = new Float32Array(new Uint8Array(Array.from(bin, c => c.charCodeAt(0))).buffer);
    for (const w of windows) {
      let n = Math.min(all.length, w * 16000);
      n = Math.ceil(n / 80) * 80;
      const audio = new Float32Array(n);
      audio.set(all.subarray(0, Math.min(n, all.length)));
      const e0 = performance.now();
      const enc = await encoder.run({ input_values: new ort.Tensor('float32', audio, [1, n]) });
      const hidden = enc.last_hidden_state;
      const encMs = performance.now() - e0;
      const d0 = performance.now();
      const cap = Math.ceil(8 * n / 16000) + 16;
      let feeds = { input_ids: new ort.Tensor('int64', BigInt64Array.from([1n]), [1, 1]), encoder_hidden_states: hidden, use_cache_branch: new ort.Tensor('bool', [false], [1]) };
      for (const p of past) feeds[p] = empty;
      const ids = [];
      let cross = null;
      for (let step = 0; step < cap; step++) {
        const r = await decoder.run(feeds);
        const logits = r.logits.data;
        const V = r.logits.dims[2];
        let best = 0;
        for (let v = 1; v < V; v++) if (logits[v] > logits[best]) best = v;
        if (best === 2) break;
        ids.push(best);
        if (!cross) cross = Object.fromEntries(past.filter(p => p.includes('.encoder.')).map(p => [p, r[p.replace('past_key_values.', 'present.')]]));
        feeds = { input_ids: new ort.Tensor('int64', BigInt64Array.from([BigInt(best)]), [1, 1]), encoder_hidden_states: hidden, use_cache_branch: new ort.Tensor('bool', [true], [1]), ...cross };
        for (const p of past) if (p.includes('.decoder.')) feeds[p] = r[p.replace('past_key_values.', 'present.')];
      }
      out.push({ w, encMs, decMs: performance.now() - d0, steps: ids.length, text: ids.map(i => tokenText[i]).join('').trim() });
    }
  }
  return { loadMs, isolated: self.crossOriginIsolated, threads: ort.env.wasm.numThreads, out };
}

(async () => {
  const { server, port } = await startStaticServer(path.join(S, 'models'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-ort-probe-'));
  const { context, extensionId, close } = await B.launch(B.ROOT, { profile });
  const clipsB64 = clips.map(c => samples(path.join(S, 'clips', c)));
  try {
    for (const model of models) {
      for (const threads of threadCounts) {
        const page = await context.newPage();
        page.on('pageerror', e => console.log(`  page error: ${e.message}`));
        await page.goto(`chrome-extension://${extensionId}/tests/bench/stt-bench.html`);
        await page.waitForFunction(() => window.benchReady === true);
        const r = await page.evaluate(`(${probe.toString()})(${JSON.stringify(model)}, ${JSON.stringify(`http://127.0.0.1:${port}/${model}/`)}, ${JSON.stringify(clipsB64)}, ${JSON.stringify(windows)}, ${threads})`);
        console.log(`\n${model}, ${r.threads} thread(s) (isolated: ${r.isolated}), sessions in ${(r.loadMs / 1000).toFixed(1)} s`);
        r.out.forEach((o, i) => {
          const clip = clips[Math.floor(i / windows.length)].slice(0, 22);
          console.log(`  ${clip.padEnd(22)} ${String(o.w).padStart(2)} s: encoder ${o.encMs.toFixed(0).padStart(5)} ms, decoder ${o.decMs.toFixed(0).padStart(5)} ms (${o.steps} steps) = ${((o.encMs + o.decMs) / o.w / 10).toFixed(1)}% of real time  ${o.text.slice(0, 110)}`);
        });
        await page.close();
      }
    }
  } finally {
    await close();
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exit(1); });
