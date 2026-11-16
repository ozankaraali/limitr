// Checks 1 and 2: what each Turkish model returns from the wasm build, and what a call costs.
// Needs 2.4.0's lib/stt-offline-worker.js with the qitv-* models (removed on this branch).
// node check.js [--models=ufak,qitv-small,qitv-mid] [--file=REC --from=S]...
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const B = require(path.join(ROOT, 'tests/bench/common'));
const { startStaticServer } = require(path.join(ROOT, 'tests/static-server'));

const MODELS_DIR = path.join(__dirname, 'models');
const REC = path.join(ROOT, 'tests/fixtures/recordings/dataset/');
const models = B.arg('models', 'ufak,qitv-small,qitv-mid').split(',');
const windows = B.arg('windows', '1,2,4,8,15').split(',').map(Number);
// --clip=FILE@SECONDS (files in the dataset folder), one or more
const clips = B.args('clip')
  .map(c => { const [file, from] = c.split('@'); return { file, from: Number(from) }; });

function pcm(file, from, seconds) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(from), '-i', REC + file, '-t', String(seconds),
    '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { maxBuffer: 2 ** 30 });
  return Buffer.from(raw).toString('base64');
}

function treeRssMb(profileDir) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,command='], { encoding: 'utf8' }).split('\n')
    .map(l => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .map(([, pid, ppid, rss, command]) => ({ pid: +pid, ppid: +ppid, rss: +rss, command }));
  const root = rows.find(r => r.command.includes(`--user-data-dir=${profileDir}`) && !/--type=/.test(r.command));
  if (!root) return NaN;
  const tree = new Set([root.pid]);
  for (let grew = true; grew;) { grew = false; for (const r of rows) if (!tree.has(r.pid) && tree.has(r.ppid)) { tree.add(r.pid); grew = true; } }
  const renderers = rows.filter(r => tree.has(r.pid) && /--type=renderer/.test(r.command));
  return Math.max(...renderers.map(r => r.rss)) / 1024;
}

(async () => {
  const { server, port } = await startStaticServer(MODELS_DIR);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-qitv-check-'));
  const { context, extensionId, close } = await B.launch(B.ROOT, { profile });
  const audio = clips.map(c => ({ ...c, b64: pcm(c.file, c.from, Math.max(...windows)) }));
  try {
    for (const model of models) {
      const page = await context.newPage();
      page.on('pageerror', e => console.log(`  page error: ${e.message}`));
      page.on('console', m => { if (/error|warn/.test(m.type())) console.log(`  console: ${m.text().slice(0, 300)}`); });
      await page.goto(`chrome-extension://${extensionId}/tests/bench/stt-bench.html`);
      await page.waitForFunction(() => window.benchReady === true);
      const rssBefore = treeRssMb(profile);
      const base = model === 'ufak' ? undefined : `http://127.0.0.1:${port}/${model.replace('qitv-', '')}/`;
      let peak = rssBefore;
      const timer = setInterval(() => { peak = Math.max(peak, treeRssMb(profile)); }, 200);
      const l = await page.evaluate(([m, b]) => bench.offlineLoad(m, b), [model, base]);
      console.log(`\n${model}: loaded in ${(l.loadMs / 1000).toFixed(1)} s (files ${(l.downloadMs / 1000).toFixed(1)} s, start ${(l.initMs / 1000).toFixed(1)} s)`);
      for (const c of audio) {
        const pieces = windows.flatMap(w => [[0, w], [0, w], [0, w]]);
        const out = await page.evaluate(([b, p]) => bench.offlineDecode(b, p), [c.b64, pieces]);
        console.log(`  ${c.file} from ${c.from} s`);
        windows.forEach((w, k) => {
          const runs = out.slice(3 * k, 3 * k + 3);
          const ms = B.median(runs.map(r => r.ms));
          const r = runs[0];
          console.log(`    ${String(w).padStart(2)} s: ${ms.toFixed(0).padStart(5)} ms (${(ms / w / 10).toFixed(1)}% of real time)  tokens ${r.tokens.length}, times ${r.timestamps.length}, logprobs ${r.ys_log_probs.length}  ${r.text.slice(0, 160)}`);
        });
        if (c === audio[0]) {
          const r = out[out.length - 1];
          console.log(`    pieces: ${JSON.stringify(r.tokens.slice(0, 12))} times: ${JSON.stringify(r.timestamps.slice(0, 12))}`);
        }
      }
      clearInterval(timer);
      peak = Math.max(peak, treeRssMb(profile));
      console.log(`  largest renderer: ${rssBefore.toFixed(0)} MB before load, ${peak.toFixed(0)} MB at peak`);
      await page.close();
    }
  } finally {
    await close();
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exit(1); });
