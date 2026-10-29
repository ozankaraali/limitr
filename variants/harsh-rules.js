// Rules for when the harsh-sound stage cuts, scored across the local dataset without rendering: at
// every look the stage takes (32 samples), the cut each rule would aim for, summed in dB x seconds
// on the talk outside the listener's marked parts, inside their marked harsh parts, and in marked
// loud parts that aren't marked harsh (a raised or strained voice). Today's rule
// cuts by how far the 100 ms balance (2-8 kHz over 150-600 Hz) passes the stream's usual one plus
// 3 dB. The others also ask the brightness to last (a slower balance over usual by some dB), or skip
// speech under some strain, or both only on speech; the "calm" ones ask it only of calm talk (not
// raised, as the raised-voice stage or the 3 s loudness reads it, and not strained).
// Run: node variants/harsh-rules.js lib/dsp-worklet.js $PWD/lib/settings.js $PWD/lib/engine.js [sleep] [name-filter]
const fs = require('fs'), vm = require('vm'), path = require('path'), { spawnSync } = require('child_process');
const [workletFile, settingsFile, engineFile, preset = 'sleep', filter = ''] = process.argv.slice(2);
require(settingsFile); require(engineFile);
const { LimitrSettings, LimitrEngine } = globalThis;
const REPO = path.resolve(__dirname, '..');
const { DATASET } = require(path.join(REPO, 'tools/dataset-file'));
const ENTRIES = JSON.parse(fs.readFileSync(DATASET, 'utf8')).filter(e => !filter || new RegExp(filter).test(e.file));
const FS = 48000, Q = 128, MARGIN_S = 1, EVERY = 32, ALLOW = 3, RATIO = 1.2;
const clock = { frame: 0 };
globalThis.sampleRate = FS;
Object.defineProperty(globalThis, 'currentTime', { get: () => clock.frame / FS, configurable: true });
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {} }; } };
let P = null;
vm.runInThisContext(`(function (registerProcessor) {${fs.readFileSync(workletFile, 'utf8')}\n})`)((n, c) => { P = c; });
const params = LimitrEngine.prototype.dspParams.call({ tabVolumeDb: 0, postGainDb: LimitrEngine.prototype.postGainDb }, LimitrSettings.normalize({ ...LimitrSettings.applyPreset({ volume: 0 }, preset) }));
const SLOW_TAUS = [0.3, 0.6, 1];
// [name, (look) => counts]: look has excess (100 ms), slow[i] (excess of the slower balances),
// speech, strain
const RULES = [['today', () => true]];
for (const [i, tau] of SLOW_TAUS.entries()) for (const s of [0, 1, 2]) {
  RULES.push([`lasts ${tau}s>${s}`, l => l.slow[i] >= s]);
  RULES.push([`lasts ${tau}s>${s} on speech`, l => !l.speech || l.slow[i] >= s]);
}
for (const lim of [2, 3]) RULES.push([`skip speech strain<${lim}`, l => !l.speech || l.strain >= lim]);
// Only calm talk has to last 1 s: a voice the raised-voice stage is cutting, or 3 s loudness over
// normal, or strain at the strain memory's 6 dB, is cut at once
const i1 = SLOW_TAUS.indexOf(1);
for (const cut of [0.5, 1.5]) RULES.push([`1s>1 calm (raised cut<${cut})`, l => !l.speech || l.raisedCut >= cut || l.strain >= 6 || l.slow[i1] >= 1]);
for (const over of [1, 2, 3]) RULES.push([`1s>1 calm (3 s over<${over})`, l => !l.speech || l.shortOver >= over || l.strain >= 6 || l.slow[i1] >= 1]);
for (const over of [2, 4]) RULES.push([`1s>1 calm (now over<${over})`, l => !l.speech || l.over >= over || l.strain >= 6 || l.slow[i1] >= 1]);
RULES.push(['1s>1 on speech, strain<6', l => !l.speech || l.strain >= 6 || l.slow[i1] >= 1]);
// ...or cut calm talk at once too when its 100 ms balance overshoots by this much (past the allowance)
for (const x of [4, 6, 8, 10]) RULES.push([`1s>1 calm (3 s over<1), at once over ${x}`, l => !l.speech || l.shortOver >= 1 || l.strain >= 6 || l.excess >= x || l.slow[i1] >= 1]);
const f = v => (Number.isFinite(v) ? v.toFixed(0) : '-');

const totals = Object.fromEntries(['talk', 'marked', 'loud', 'natgeo'].map(k => [k, RULES.map(() => 0)]));
const rows = [];
for (const e of ENTRIES) {
  const file = path.join(REPO, 'tests/fixtures/recordings/dataset', e.file);
  if (!fs.existsSync(file)) continue;
  const harsh = e.harsh || [], loud = e.loud || [];
  const near = (t, parts) => parts.some(([a, b]) => t >= a - MARGIN_S && t <= b + MARGIN_S);
  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 's16le', '-ac', '2', '-ar', String(FS), '-'], { maxBuffer: 1 << 30 }).stdout;
  const n = pcm.length / 4;
  const p = new P({ processorOptions: { params } });
  const a = SLOW_TAUS.map(tau => 1 - Math.exp(-EVERY / (tau * FS)));
  const slowBody = SLOW_TAUS.map(() => 0), slowEdge = SLOW_TAUS.map(() => 0);
  const sums = { talk: RULES.map(() => 0), marked: RULES.map(() => 0), loud: RULES.map(() => 0) };
  const orig = p.updateShelf.bind(p);
  p.updateShelf = () => {
    const body = p.harshAccBody / EVERY, edge = p.harshAccEdge / EVERY;
    // the gate the stage applies before any rule: a cut it may make at all
    const open = p.harshMaxCut > 0 && p.normalLocked && p.slow >= p.harshFloor;
    orig();
    for (let i = 0; i < SLOW_TAUS.length; i++) { slowBody[i] += (body - slowBody[i]) * a[i]; slowEdge[i] += (edge - slowEdge[i]) * a[i]; }
    if (!open) return;
    const t = clock.frame / FS;
    const where = near(t, harsh) ? 'marked' : near(t, loud) ? 'loud' : 'talk';
    if (!where) return;
    const excess = 10 * Math.log10((p.harshEdge + 1e-20) / (p.harshBody + 1e-20)) - p.usualBalance - ALLOW;
    if (excess <= 0) return;
    const cut = Math.min(p.harshMaxCut, excess * RATIO);
    const momentary = -0.691 + 10 * Math.log10((p.subBlocks[0] + p.subBlocks[1] + p.subBlocks[2] + p.subBlocks[3]) / Math.max(1, p.subBlocksSeen) + 1e-20);
    const look = {
      slow: SLOW_TAUS.map((_, i) => 10 * Math.log10((slowEdge[i] + 1e-20) / (slowBody[i] + 1e-20)) - p.usualBalance - ALLOW),
      speech: p.speechLike, strain: p.strain, raisedCut: -p.shoutGain, shortOver: p.shortOver, over: momentary - p.normalMomentary, excess
    };
    RULES.forEach(([, rule], r) => { if (rule(look)) sums[where][r] += cut * EVERY / FS; });
  };
  const inL = new Float32Array(Q), inR = new Float32Array(Q), oL = new Float32Array(Q), oR = new Float32Array(Q);
  for (let k = 0; k + Q <= n; k += Q) {
    for (let i = 0; i < Q; i++) { inL[i] = pcm.readInt16LE((k + i) * 4) / 32768; inR[i] = pcm.readInt16LE((k + i) * 4 + 2) / 32768; }
    clock.frame = k; p.process([[inL, inR], []], [[oL, oR]]);
  }
  const id = e.file.replace(/^[^-]+-/, '').replace(/\.ogg$/, '');
  rows.push({ id, sums, natgeo: /natgeo/.test(e.file) });
  for (const w of ['talk', 'marked', 'loud']) sums[w].forEach((v, r) => { totals[w][r] += v; });
  if (/natgeo/.test(e.file)) sums.talk.forEach((v, r) => { totals.natgeo[r] += v; });
  console.error(`scanned ${id}`);
}
const pctOf = (v, base) => (base > 0 ? `${Math.round(100 * v / base)}%` : '-');
console.log(`Cut the harsh-sound stage aims for, dB x s (${preset}); % of today's`);
const col = (w, r) => `${f(totals[w][r])} ${pctOf(totals[w][r], totals[w][0])}`;
console.log(`${'rule'.padEnd(30)} ${'talk'.padStart(12)} ${'NatGeo talk'.padStart(12)} ${'marked harsh'.padStart(13)} ${'marked loud'.padStart(12)}`);
RULES.forEach(([name], r) => console.log(`${name.padEnd(30)} ${col('talk', r).padStart(12)} ${col('natgeo', r).padStart(12)} ${col('marked', r).padStart(13)} ${col('loud', r).padStart(12)}`));
// RULES_SHOWN (names, comma-separated) picks the rules in the per-recording lists
const shown = process.env.RULES_SHOWN ? RULES.map(([name], r) => [name, r]).filter(([name]) => process.env.RULES_SHOWN.split(',').includes(name)) : RULES.slice(1).map(([name], r) => [name, r + 1]);
for (const [w, title] of [['marked', 'Marked harsh parts'], ['loud', 'Marked loud parts (not marked harsh)'], ['talk', 'Talk']]) {
  console.log(`\n${title} by recording, % of today's cut kept:`);
  for (const row of rows.filter(x => x.sums[w][0] > 1)) console.log(`  ${row.id.padEnd(14)} ${f(row.sums[w][0])} dB s: ${shown.map(([name, r]) => `${name} ${pctOf(row.sums[w][r], row.sums[w][0])}`).join(', ')}`);
}
