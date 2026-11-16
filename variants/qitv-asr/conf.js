const path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.join(__dirname, '..', '..');
const B = require(path.join(ROOT, 'tests/bench/common'));
const { startStaticServer } = require(path.join(ROOT, 'tests/static-server'));
const { changedPer100 } = require(path.join(ROOT, 'tests/caption-steadiness'));
const LEAD_S = 0.16;  // silence fed before the speech

// When each word of the final text first showed on a live clock (pieces arrive every chunk, each
// decode waits for the one before), minus when the model puts its first piece
function liveDelays(o) {
  let busyUntil = 0;
  const shownAt = o.steps.map(s => (busyUntil = Math.max(busyUntil, s.arrives) + s.ms / 1000));
  const delays = [];
  o.tokens.forEach((piece, i) => {
    if (i > 0 && !/^\s/.test(piece)) return;
    const k = o.steps.findIndex(s => s.pieces > i);
    if (k >= 0) delays.push(shownAt[k] - (o.timestamps[i] - LEAD_S));
  });
  return delays;
}
const S = __dirname;
const clips = (B.arg('clips', '') ? B.arg('clips').split(',') : fs.readdirSync(path.join(S, 'clips')).filter(f => f.endsWith('.wav')));
const samples = f => { const b = fs.readFileSync(path.join(S, 'clips', f)); return Buffer.from(b.subarray(b.indexOf('data') + 8)).toString('base64'); };
(async () => {
  const { server, port } = await startStaticServer(S);
  const { context, close } = await B.launch(null);
  try {
    for (const cfg of JSON.parse(B.arg('cfgs', '[{"method":"greedy_search","gain":32768,"blank":0.5,"chunk":0.5}]'))) {
      const page = await context.newPage();
      page.on('console', m => { if (/warn|error/.test(m.type())) console.log('  console:', m.text().slice(0, 200)); });
      await page.goto(`http://127.0.0.1:${port}/conf.html`);
      const r = await page.evaluate(o => window.run(o), { ...cfg, clips: clips.map(samples) });
      console.log(`\n${JSON.stringify(cfg)}: files ${(r.loadMs / 1000).toFixed(1)} s, start ${(r.initMs / 1000).toFixed(1)} s`);
      r.out.forEach((o, i) => {
        const d = liveDelays(o);
        const versions = o.steps.map(s => s.text).filter((t, k, all) => k === 0 || t !== all[k - 1]);
        if (process.env.DUMP) fs.writeFileSync(`${process.env.DUMP}-${i}.json`, JSON.stringify(versions));
        if (B.arg('dump')) fs.writeFileSync(`${B.arg('dump')}${clips[i].replace(/\.wav$/, '')}.conformer.txt`, o.text + '\n');
        console.log(`  ${clips[i].slice(0, 30).padEnd(30)} ${o.seconds.toFixed(0).padStart(3)} s: ${(o.busy / o.seconds / 10).toFixed(1)}% of real time, worst chunk ${o.worst.toFixed(0)} ms; a word shows after ${B.median(d).toFixed(2)} s (median), ${B.quantile(d, 0.9).toFixed(2)} s (p90); shown words changed per 100: ${changedPer100([versions]).toFixed(1)}`);
        console.log(`    ${o.text.slice(0, B.arg('chars', 260) | 0)}`);
      });
      await page.close();
    }
  } finally { await close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
