#!/usr/bin/env node
// Scores the engine on the labelled recordings of the stream dataset (fetched by
// tools/fetch-dataset.js): for each recording and preset, how far its loud parts come out above
// the streamer's talking level, how often the guard touches that talking, and the loudness range
// (EBU LRA; a calm dubbed documentary, the comfort reference, measures about 5 LU). Offline in a
// silent, GPU-free Chromium. --worklet=FILE scores another dsp-worklet.js against the same
// recordings, to compare a candidate with the current engine, and --settings=FILE another
// settings.js (a candidate's presets). --auto scores the recordings no
// listener has reviewed yet on their automatic tags (tools/autotag-dataset.js), provisionally.
// Run: node tools/eval-dataset.js [--worklet=FILE] [--settings=FILE] [--presets=gentle,stream] [--auto] [name-filter]
//   name-filter: part of a file name, or a regular expression ("k434e|vp05")

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startStaticServer } = require('../tests/static-server');
const { DATASET } = require('./dataset-file');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(process.env.LIMITR_RECORDINGS || path.join(ROOT, 'tests/fixtures/recordings'), 'dataset');
const arg = name => (process.argv.find(a => a.startsWith(`--${name}=`)) || '').split('=')[1];
const worklet = arg('worklet');
const settings = arg('settings');
const presets = (arg('presets') || 'gentle,stream,movie,sleep').split(',');
const useAuto = process.argv.includes('--auto');
const filter = new RegExp(process.argv.slice(2).find(a => !a.startsWith('--')) || '');
// The listener's labels, or (with --auto, where nobody has reviewed it) the automatic tags
const loudOf = e => e.reviewed || e.loud ? e.loud || [] : useAuto && e.auto ? e.auto.loud : [];
const harshOf = e => e.reviewed ? e.harsh || [] : useAuto && e.auto ? e.auto.harsh : [];
const labelled = e => e.reviewed || e.loud ? 'labelled' : useAuto && e.auto ? 'auto-tagged' : 'not labelled';

const entries = JSON.parse(fs.readFileSync(DATASET, 'utf8'))
  .filter(e => filter.test(e.file) && fs.existsSync(path.join(DIR, e.file)));
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;

(async () => {
  const routes = {};
  for (const e of entries) {
    routes[`/dataset/${e.file}`] = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'audio/ogg' });
      fs.createReadStream(path.join(DIR, e.file)).pipe(res);
    };
  }
  if (worklet) {
    routes['/lib/dsp-worklet.js'] = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(fs.readFileSync(path.resolve(worklet)));
    };
  }
  if (settings) {
    routes['/lib/settings.js'] = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(fs.readFileSync(path.resolve(settings)));
    };
  }
  const { server, port } = await startStaticServer(ROOT, routes);
  const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-audio-output', '--mute-audio'] });
  const totals = Object.fromEntries(presets.map(p => [p, { above: [], whole: [], first: [], presence: [], busy: [], range: [], rangeIn: [], harshIn: [], harshOut: [], duller: [] }]));
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/tests/engine-bench.html`);
    await page.waitForFunction(() => window.benchReady === true);
    console.log(worklet ? `Worklet: ${worklet}` : 'Worklet: lib/dsp-worklet.js');
    if (settings) console.log(`Settings: ${settings}`);
    for (const e of entries) {
      console.log(`\n${e.file}  (${e.channel}, ${e.kind}, ${labelled(e)}, ${loudOf(e).length} loud parts)`);
      for (const id of presets) {
        const r = await page.evaluate(([p, u, o]) => bench.datasetFile(p, u, o),
          [id, `/dataset/${e.file}`, { loud: loudOf(e), harsh: harshOf(e), skip: e.kind === 'clip' ? 3 : 10 }]);
        if (r.dsp !== 'worklet') throw new Error(`the worklet didn't run (${r.dsp}): is ${worklet || 'lib/dsp-worklet.js'} valid?`);
        totals[id].busy.push(r.guardBusy);
        if (e.kind !== 'reference') { totals[id].range.push(r.rangeOut); totals[id].rangeIn.push(r.rangeIn); }
        for (const l of r.loud) { totals[id].above.push(l.outAbove); totals[id].whole.push(l.outWhole); totals[id].first.push(l.outFirst); totals[id].presence.push(l.outPresence); }
        for (const h of r.harsh) { totals[id].harshIn.push(h.inAbove); totals[id].harshOut.push(h.outAbove); }
        if (e.kind !== 'reference' && Number.isFinite(r.talkDuller)) totals[id].duller.push(r.talkDuller);
        const loud = r.loud.length
          ? ` | loud parts over the talk: ${r.loud.map(l => `+${l.inAbove}→+${l.outAbove} (first 2 s +${l.inFirst}→+${l.outFirst}, whole +${l.inWhole}→+${l.outWhole}, 1-4 kHz +${l.inPresence}→+${l.outPresence})`).join(', ')}` : '';
        const harsh = r.harsh.length
          ? ` | harsh parts brighter than the talk: ${(r.harsh.reduce((s, h) => s + h.inAbove, 0) / r.harsh.length).toFixed(1)}→${(r.harsh.reduce((s, h) => s + h.outAbove, 0) / r.harsh.length).toFixed(1)} dB (${r.harsh.length})` : '';
        console.log(`  ${id.padEnd(7)} talk ${r.talkIn}→${r.talkOut} LUFS, range ${r.rangeIn}→${r.rangeOut} LU, talk cut ${r.talkCut} dB${r.farCut === null ? '' : ` (${r.farCut} away from loud parts)`}, worst 3 s +${r.worst3In}→+${r.worst3Out}, 99% +${r.p99In}→+${r.p99Out}, cut on it ${(r.guardBusy * 100).toFixed(1)}%, ${r.farGain === null ? '' : `away from loud parts ${r.farGain >= 0 ? '+' : ''}${r.farGain} dB, `}talk balance ${r.talkDuller >= 0 ? '+' : ''}${r.talkDuller} dB${loud}${harsh}`);
      }
    }
    console.log('\nSummary (loud parts: mean over every marked part; guard and range: mean over recordings, the reference left out)');
    for (const id of presets) {
      const t = totals[id];
      console.log(`  ${id.padEnd(7)} loud parts come out +${mean(t.above).toFixed(1)} dB over the talk at their loudest, +${mean(t.first).toFixed(1)} in their first 2 s, +${mean(t.whole).toFixed(1)} on the whole, 1-4 kHz +${mean(t.presence).toFixed(1)} (${t.above.length} parts), ` +
        `Limitr cutting the talk ${(mean(t.busy) * 100).toFixed(1)}% of the time, loudness range ${mean(t.rangeIn).toFixed(1)}→${mean(t.range).toFixed(1)} LU, ` +
        `harsh parts +${mean(t.harshIn).toFixed(1)}→+${mean(t.harshOut).toFixed(1)} dB brighter than the talk (${t.harshIn.length} parts), talk balance ${mean(t.duller) >= 0 ? '+' : ''}${mean(t.duller).toFixed(2)} dB`);
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
