// Where the calm-speech belief's strain memory goes off across the local dataset: every moment a
// speech-like block's 3 s strain reaches 6 dB (the memory restarts), grouped into episodes, with its
// level over the stream's normal and whether it falls in a part the listener marked loud or harsh
// (or within a second of one). Outside those, it's calm talk (or an unmarked raised voice) that
// stops calm speech being believed for the memory's length.
// Run: node variants/strain-scan.js variants/w-calm10u3t.js $PWD/lib/settings.js $PWD/lib/engine.js [sleep] [name-filter]
const fs = require('fs'), vm = require('vm'), path = require('path'), { spawnSync } = require('child_process');
const [workletFile, settingsFile, engineFile, preset = 'sleep', filter = ''] = process.argv.slice(2);
require(settingsFile); require(engineFile);
const { LimitrSettings, LimitrEngine } = globalThis;
const REPO = path.resolve(__dirname, '..');
const { DATASET } = require(path.join(REPO, 'tools/dataset-file'));
const ENTRIES = JSON.parse(fs.readFileSync(DATASET, 'utf8')).filter(e => !filter || new RegExp(filter).test(e.file));
const FS = 48000, Q = 128, MARGIN_S = 1, EPISODE_GAP_S = 3;
const clock = { frame: 0 };
globalThis.sampleRate = FS;
Object.defineProperty(globalThis, 'currentTime', { get: () => clock.frame / FS, configurable: true });
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {} }; } };
let P = null;
vm.runInThisContext(`(function (registerProcessor) {${fs.readFileSync(workletFile, 'utf8')}\n})`)((n, c) => { P = c; });
const params = LimitrEngine.prototype.dspParams.call({ tabVolumeDb: 0, postGainDb: LimitrEngine.prototype.postGainDb }, LimitrSettings.normalize({ ...LimitrSettings.applyPreset({ volume: 0 }, preset) }));
const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const covered = (speech, triggers, memory) => {
  let k = 0, n = 0;
  for (const t of speech) { while (k < triggers.length && triggers[k] <= t) k++; if (k && t - triggers[k - 1] < memory) n++; }
  return speech.length ? n / speech.length : 0;
};

const summary = [];
for (const e of ENTRIES) {
  const file = path.join(REPO, 'tests/fixtures/recordings/dataset', e.file);
  if (!fs.existsSync(file)) { console.log(`${e.file}: missing`); continue; }
  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 's16le', '-ac', '2', '-ar', String(FS), '-'], { maxBuffer: 1 << 30 }).stdout;
  const n = pcm.length / 4;
  const p = new P({ processorOptions: { params } });
  const triggers = [], speech = [];
  const orig = p.onSubBlock.bind(p);
  p.onSubBlock = (...a) => {
    const before = p.sinceStrained;
    orig(...a);
    const t = clock.frame / FS;
    const momentary = -0.691 + 10 * Math.log10((p.subBlocks[0] + p.subBlocks[1] + p.subBlocks[2] + p.subBlocks[3]) / Math.max(1, p.subBlocksSeen) + 1e-20);
    if (p.speechLike) speech.push(t);
    if (p.sinceStrained === 0 && before !== undefined) triggers.push({ t, over: p.normalLocked ? momentary - p.normalMomentary : NaN, strain: p.strain });
  };
  const inL = new Float32Array(Q), inR = new Float32Array(Q), oL = new Float32Array(Q), oR = new Float32Array(Q);
  for (let k = 0; k + Q <= n; k += Q) {
    for (let i = 0; i < Q; i++) { inL[i] = pcm.readInt16LE((k + i) * 4) / 32768; inR[i] = pcm.readInt16LE((k + i) * 4 + 2) / 32768; }
    clock.frame = k; p.process([[inL, inR], []], [[oL, oR]]);
  }
  const marked = [...(e.loud || []), ...(e.harsh || [])];
  const labelled = !!(e.loud && e.loud.length) || !!(e.harsh && e.harsh.length) || e.reviewed;
  const inMarked = t => marked.some(([a, b]) => t >= a - MARGIN_S && t <= b + MARGIN_S);
  // Episodes: triggers less than 3 s apart
  const episodes = [];
  for (const x of triggers) {
    const last = episodes[episodes.length - 1];
    if (last && x.t - last.end < EPISODE_GAP_S) { last.end = x.t; last.maxOver = Math.max(last.maxOver, x.over); last.maxStrain = Math.max(last.maxStrain, x.strain); last.marked = last.marked || inMarked(x.t); }
    else episodes.push({ start: x.t, end: x.t, maxOver: x.over, maxStrain: x.strain, marked: inMarked(x.t) });
  }
  const unmarked = episodes.filter(x => !x.marked);
  const speechMin = speech.length * 0.1 / 60;
  const times = triggers.map(x => x.t);
  const row = {
    file: e.file, kind: e.kind, labelled, seconds: n / FS, speechMin, episodes: episodes.length, unmarked: unmarked.length,
    cover10: covered(speech, times, 10), cover30: covered(speech, times, 30)
  };
  summary.push(row);
  console.log(`\n${e.file} (${e.kind}${labelled ? ', labelled' : ', not labelled'}): ${fmt(row.seconds)} long, ${speechMin.toFixed(1)} min of speech`);
  console.log(`  strain memory set off in ${episodes.length} episode(s), ${unmarked.length} outside the marked loud/harsh parts; speech under the memory: ${(100 * row.cover10).toFixed(1)}% with 10 s, ${(100 * row.cover30).toFixed(1)}% with 30 s`);
  for (const x of episodes) console.log(`    ${fmt(x.start)}${x.end > x.start ? `-${fmt(x.end)}` : ''}  ${x.marked ? 'marked  ' : 'UNMARKED'}  ${Number.isFinite(x.maxOver) ? `${x.maxOver >= 0 ? '+' : ''}${x.maxOver.toFixed(1)} dB over normal` : 'before normal is known'}, strain ${x.maxStrain.toFixed(1)}`);
}
console.log('\nSummary: speech under the strain memory, 10 s / 30 s, and episodes outside marked parts');
for (const r of summary) console.log(`  ${r.file.padEnd(38)} ${(100 * r.cover10).toFixed(1).padStart(5)}% / ${(100 * r.cover30).toFixed(1).padStart(5)}%   ${r.unmarked} of ${r.episodes}${r.labelled ? '' : ' (not labelled)'}`);
