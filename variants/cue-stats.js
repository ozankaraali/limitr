// How the strain reads on speech-like blocks of a WAV, split into spans: the existing 3 s strain,
// the same over the last second, and per block (each against the stream's usual tilt at the time).
// node variants/cue-stats.js WORKLET SETTINGS ENGINE FILE.wav PRESET 'name:a-b,a-b;name:a-b' [loud-from]
const fs = require('fs'), vm = require('vm');
const [workletFile, settingsFile, engineFile, wavFile, preset, spanArg = '', loudFrom = '-70'] = process.argv.slice(2);
require(settingsFile); require(engineFile);
const { LimitrSettings, LimitrEngine } = globalThis;
const FS = 48000, Q = 128, clock = { frame: 0 };
globalThis.sampleRate = FS;
Object.defineProperty(globalThis, 'currentTime', { get: () => clock.frame / FS, configurable: true });
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {} }; } };
let P = null;
vm.runInThisContext(`(function (registerProcessor) {${fs.readFileSync(workletFile, 'utf8')}\n})`)((n, c) => { P = c; });
const params = LimitrEngine.prototype.dspParams.call({ tabVolumeDb: 0, postGainDb: LimitrEngine.prototype.postGainDb }, LimitrSettings.normalize({ ...LimitrSettings.applyPreset({ volume: 0 }, preset) }));
const b = fs.readFileSync(wavFile);
let off = 12, data = null, ch = 2;
while (off < b.length) { const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4); if (id === 'fmt ') ch = b.readUInt16LE(off + 10); if (id === 'data') { data = off + 8; break; } off += 8 + size; }
const n = (b.length - data) / 2 / ch;
const p = new P({ processorOptions: { params } });
const inL = new Float32Array(Q), inR = new Float32Array(Q), oL = new Float32Array(Q), oR = new Float32Array(Q);
const blocks = [];
const orig = p.onSubBlock.bind(p);
p.onSubBlock = (...a) => {
  orig(...a);
  const k = (p.shortPos - 1 + 30) % 30;
  let b1 = 0, p1 = 0;
  for (let i = 1; i <= 10; i++) { const j = (p.shortPos - i + 30) % 30; b1 += p.shortBody[j]; p1 += p.shortPres[j]; }
  blocks.push({
    t: clock.frame / FS, m: 10 * Math.log10((p.subBlocks[0] + p.subBlocks[1] + p.subBlocks[2] + p.subBlocks[3]) / Math.max(1, p.subBlocksSeen)) - 0.691,
    speech: p.speechLike, s3: p.strain, s1: b1 > 0 ? 10 * Math.log10((p1 + 1e-20) / b1) - p.usualTilt : NaN,
    sb: p.shortBody[k] > 0 ? 10 * Math.log10((p.shortPres[k] + 1e-20) / p.shortBody[k]) - p.usualTilt : NaN
  });
};
for (let k = 0; k + Q <= n; k += Q) {
  for (let i = 0; i < Q; i++) { inL[i] = b.readInt16LE(data + (k + i) * 2 * ch) / 32768; inR[i] = b.readInt16LE(data + ((k + i) * ch + (ch > 1 ? 1 : 0)) * 2) / 32768; }
  clock.frame = k; p.process([[inL, inR], []], [[oL, oR]]);
}
const pct = (a, q) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const f = v => (Number.isFinite(v) ? v.toFixed(1).padStart(5) : '    -');
console.log(`${wavFile.split('/').pop()} (${preset}), speech-like blocks louder than ${loudFrom} LUFS: strain percentiles 10/25/50/75/90`);
for (const part of spanArg.split(';').filter(Boolean)) {
  const [name, list] = part.split(':');
  const spans = list.split(',').map(s => s.split('-').map(Number));
  const sel = blocks.filter(x => x.speech && x.m > Number(loudFrom) && spans.some(([a, z]) => x.t >= a && x.t < z));
  const row = key => [0.1, 0.25, 0.5, 0.75, 0.9].map(q => f(pct(sel.map(x => x[key]), q))).join(' ');
  console.log(`  ${name.padEnd(22)} ${String(sel.length).padStart(4)} blocks | 3 s ${row('s3')} | 1 s ${row('s1')} | block ${row('sb')}`);
}
