// What the harsh-sound stage cuts across the local dataset, and what it would keep cutting if it
// skipped speech that reads calm: for every 100 ms block, its deepest shelf cut, whether it is
// speech-like (pulses), its 3 s strain, and whether it falls in a part the listener marked harsh or
// loud (within a second). For each strain limit, the cut (dB x seconds) left on the talk outside the
// marked parts, and the cut kept inside them, if speech under that strain were skipped.
// Run: node variants/harsh-scan.js lib/dsp-worklet.js $PWD/lib/settings.js $PWD/lib/engine.js [sleep] [name-filter]
const fs = require('fs'), vm = require('vm'), path = require('path'), { spawnSync } = require('child_process');
const [workletFile, settingsFile, engineFile, preset = 'sleep', filter = ''] = process.argv.slice(2);
require(settingsFile); require(engineFile);
const { LimitrSettings, LimitrEngine } = globalThis;
const REPO = path.resolve(__dirname, '..');
const { DATASET } = require(path.join(REPO, 'tools/dataset-file'));
const ENTRIES = JSON.parse(fs.readFileSync(DATASET, 'utf8')).filter(e => !filter || new RegExp(filter).test(e.file));
const FS = 48000, Q = 128, MARGIN_S = 1;
const LIMITS = [-Infinity, 1, 2, 3, 4, 5, 6];
const clock = { frame: 0 };
globalThis.sampleRate = FS;
Object.defineProperty(globalThis, 'currentTime', { get: () => clock.frame / FS, configurable: true });
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {} }; } };
let P = null;
vm.runInThisContext(`(function (registerProcessor) {${fs.readFileSync(workletFile, 'utf8')}\n})`)((n, c) => { P = c; });
const params = LimitrEngine.prototype.dspParams.call({ tabVolumeDb: 0, postGainDb: LimitrEngine.prototype.postGainDb }, LimitrSettings.normalize({ ...LimitrSettings.applyPreset({ volume: 0 }, preset) }));
const pct = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const f = v => (Number.isFinite(v) ? v.toFixed(1) : '-');

const totals = { talk: LIMITS.map(() => 0), marked: LIMITS.map(() => 0) };
const strains = { talk: [], marked: [] };
for (const e of ENTRIES) {
  const file = path.join(REPO, 'tests/fixtures/recordings/dataset', e.file);
  if (!fs.existsSync(file)) continue;
  const harsh = e.harsh || [], loud = e.loud || [];
  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 's16le', '-ac', '2', '-ar', String(FS), '-'], { maxBuffer: 1 << 30 }).stdout;
  const n = pcm.length / 4;
  const p = new P({ processorOptions: { params } });
  // The deepest shelf cut of each block, and the block's cues
  let deepest = 0;
  const blocks = [];
  const origShelf = p.updateShelf.bind(p);
  p.updateShelf = () => { origShelf(); if (p.shelfCut > deepest) deepest = p.shelfCut; };
  const origBlock = p.onSubBlock.bind(p);
  p.onSubBlock = (...a) => { origBlock(...a); blocks.push({ t: clock.frame / FS, cut: deepest, speech: p.speechLike, strain: p.strain }); deepest = 0; };
  const inL = new Float32Array(Q), inR = new Float32Array(Q), oL = new Float32Array(Q), oR = new Float32Array(Q);
  for (let k = 0; k + Q <= n; k += Q) {
    for (let i = 0; i < Q; i++) { inL[i] = pcm.readInt16LE((k + i) * 4) / 32768; inR[i] = pcm.readInt16LE((k + i) * 4 + 2) / 32768; }
    clock.frame = k; p.process([[inL, inR], []], [[oL, oR]]);
  }
  const near = (t, parts) => parts.some(([a, b]) => t >= a - MARGIN_S && t <= b + MARGIN_S);
  const row = { talk: LIMITS.map(() => 0), marked: LIMITS.map(() => 0) };
  let harshSeconds = 0;
  for (const b of blocks) {
    const where = near(b.t, harsh) ? 'marked' : near(b.t, loud) ? null : 'talk';
    if (!where) continue;
    if (where === 'marked') harshSeconds += 0.1;
    if (b.speech) strains[where].push(b.strain);
    // Kept: cut on blocks that aren't speech, or speech at or over the limit
    LIMITS.forEach((lim, i) => { if (!b.speech || b.strain >= lim) row[where][i] += b.cut * 0.1; });
  }
  for (const w of ['talk', 'marked']) row[w].forEach((v, i) => { totals[w][i] += v; });
  const talkMarked = blocks.filter(b => near(b.t, harsh) && b.speech).map(b => b.strain);
  console.log(`${e.file.replace(/^[^-]+-/, '')}: ${(blocks.length / 10).toFixed(0)} s, ${harshSeconds.toFixed(1)} s marked harsh` +
    ` | cut on the talk (dB s), all / skipping speech under ${LIMITS.slice(1).join(', ')} dB strain: ${row.talk.map(f).join(' ')}` +
    (harsh.length ? ` | in harsh parts: ${row.marked.map(f).join(' ')}, their speech's strain p10/p50/p90 ${f(pct(talkMarked, 0.1))}/${f(pct(talkMarked, 0.5))}/${f(pct(talkMarked, 0.9))}` : ''));
}
console.log(`\nAll (${preset}): cut on the talk outside marked parts, dB s: ${totals.talk.map(f).join(' ')}`);
console.log(`Inside marked harsh parts: ${totals.marked.map(f).join(' ')}`);
console.log(`(columns: no skipping, then skipping speech under ${LIMITS.slice(1).join(', ')} dB of strain)`);
console.log(`Speech strain, talk p10/p50/p90/p99: ${[0.1, 0.5, 0.9, 0.99].map(q => f(pct(strains.talk, q))).join('/')}; harsh parts: ${[0.1, 0.5, 0.9, 0.99].map(q => f(pct(strains.marked, q))).join('/')}`);
