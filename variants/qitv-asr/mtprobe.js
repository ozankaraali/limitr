// QiTV's caption translator, MiLMMT-46-1B (Gemma 3 1B, int4 ONNX, greedy pick in the graph), through
// onnxruntime-web (lib/ort.bundle.min.mjs) on the CPU in the extension's bench page: how long a
// caption line's prompt and each new token take. The prompts are tokenized by mt-tokens.py.
// node mtprobe.js [--threads=2,4]   (models/mt/ next to this file; see README.md)
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const B = require(path.join(ROOT, 'tests/bench/common'));
const { startStaticServer } = require(path.join(ROOT, 'tests/static-server'));

const threadCounts = B.arg('threads', '2,4').split(',').map(Number);
const python = B.arg('python', path.join(__dirname, 'venv-sherpa/bin/python'));
const LINES = [
  'Beslenme alanlarına ulaşmak için anne yavrularını kayalık ve tehlikeli arazide yönlendirmek zorunda.',
  'Ya evinde sorun olmayan bizim ev dört dörtlük, her şeyini müteahhitimiz çok iyi düşünmüş.',
  'Sohbette sorularınızı yazabilirsiniz, hepsini sırayla okuyacağım.'
];

// ortBase: where ort.bundle.min.mjs and its wasm are (the extension's lib/ by default)
async function probe(base, prompts, threads, ortBase, modelFile) {
  globalThis.MT_MODEL = modelFile;
  ortBase = ortBase || chrome.runtime.getURL('lib/');
  const ort = await import(ortBase + 'ort.bundle.min.mjs');
  ort.env.wasm.wasmPaths = ortBase;
  ort.env.wasm.numThreads = threads;
  ort.env.logLevel = 'warning';
  const t0 = performance.now();
  const stage = async (name, f) => { try { return await f(); } catch (e) { throw new Error(`${name}: ${typeof e === 'number' ? 'wasm exception ' + e : e && e.message || e}`); } };
  const session = await stage('session', () => ort.InferenceSession.create(base + (globalThis.MT_MODEL || 'model.onnx'), {
    executionProviders: ['wasm'],
    externalData: [{ path: 'model.onnx.data', data: base + 'model.onnx.data' }]
  }));
  const loadMs = performance.now() - t0;
  const past = session.inputNames.filter(n => n.startsWith('past_key_values.'));
  const empty = new ort.Tensor('float32', new Float32Array(0), [1, 1, 0, 256]);
  const out = [];
  for (const ids of prompts) {
    let feeds = { input_ids: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]) };
    for (const p of past) feeds[p] = empty;
    let total = ids.length;
    const made = [];
    let prefillMs = 0;
    const s0 = performance.now();
    for (let step = 0; step < 96; step++) {
      feeds.attention_mask = new ort.Tensor('int64', new BigInt64Array(total).fill(1n), [1, total]);
      const c0 = performance.now();
      const r = await stage(`run ${step}`, () => session.run(feeds));
      if (step === 0) prefillMs = performance.now() - c0;
      const next = Number(r.next_token.data[0]);
      if (next === 1 || next === 106) break;
      made.push(next);
      feeds = { input_ids: new ort.Tensor('int64', BigInt64Array.from([BigInt(next)]), [1, 1]) };
      for (const p of past) feeds[p] = r[p.replace('past_key_values.', 'present.')];
      total++;
    }
    const allMs = performance.now() - s0;
    out.push({ promptTokens: ids.length, prefillMs, steps: made.length, perTokenMs: made.length > 1 ? (allMs - prefillMs) / (made.length - 1) : NaN, allMs, made });
  }
  return { loadMs, threads: ort.env.wasm.numThreads, isolated: self.crossOriginIsolated, out };
}

const tokenize = texts => JSON.parse(execFileSync(python, ['-I', path.join(__dirname, 'mt-tokens.py'), 'encode', JSON.stringify(texts)], { encoding: 'utf8' }));
const detokenize = ids => JSON.parse(execFileSync(python, ['-I', path.join(__dirname, 'mt-tokens.py'), 'decode', JSON.stringify(ids)], { encoding: 'utf8' }));

// --ort=DIR: another onnxruntime-web's dist/ instead, in a plain cross-origin-isolated page (the
// extension's pages may only load its own scripts)
const ortDir = B.arg('ort');
function isolatedServer() {
  const http = require('http');
  const TYPES = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const headers = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin' };
    if (url === '/page.html') { res.writeHead(200, { ...headers, 'Content-Type': 'text/html' }); res.end('<!DOCTYPE html><title>mt</title>'); return; }
    const [, top, ...rest] = url.split('/');
    const root = top === 'ort' ? path.resolve(ortDir) : top === 'mt' ? path.join(__dirname, 'models', 'mt') : null;
    const file = root && path.join(root, ...rest);
    if (!file || !file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404, headers); res.end(); return; }
    res.writeHead(200, { ...headers, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

(async () => {
  const prompts = tokenize(LINES.map(t => `Translate this from Turkish to English:\nTurkish: ${t}\nEnglish:`));
  const { server, port } = ortDir ? await isolatedServer() : await startStaticServer(path.join(__dirname, 'models'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-mt-probe-'));
  const { context, extensionId, close } = await B.launch(ortDir ? null : B.ROOT, { profile });
  try {
    for (const threads of threadCounts) {
      const page = await context.newPage();
      page.on('pageerror', e => console.log(`  page error: ${e.message}`));
      page.on('console', m => { if (/error|warn/.test(m.type())) console.log(`  console: ${m.text().slice(0, 400)}`); });
      if (ortDir) await page.goto(`http://127.0.0.1:${port}/page.html`);
      else {
        await page.goto(`chrome-extension://${extensionId}/tests/bench/stt-bench.html`);
        await page.waitForFunction(() => window.benchReady === true);
      }
      const ortBase = ortDir ? `http://127.0.0.1:${port}/ort/` : null;
      const r = await page.evaluate(`(${probe.toString()})(${JSON.stringify(`http://127.0.0.1:${port}/mt/`)}, ${JSON.stringify(prompts)}, ${threads}, ${JSON.stringify(ortBase)}, ${JSON.stringify(B.arg('model', 'model.onnx'))})`);
      console.log(`\nMiLMMT-46-1B int4, onnxruntime-web ${ortDir ? path.basename(path.dirname(path.resolve(ortDir))) : '1.21 (lib/)'}, ${r.threads} thread(s), isolated ${r.isolated}: session in ${(r.loadMs / 1000).toFixed(1)} s`);
      const texts = detokenize(r.out.map(o => o.made));
      r.out.forEach((o, i) => {
        console.log(`  prompt ${o.promptTokens} tokens in ${(o.prefillMs / 1000).toFixed(2)} s, then ${o.steps} tokens at ${o.perTokenMs.toFixed(0)} ms each: ${(o.allMs / 1000).toFixed(1)} s for the line`);
        console.log(`    ${LINES[i]}\n    -> ${texts[i]}`);
      });
      await page.close();
    }
  } finally {
    await close();
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exit(1); });
