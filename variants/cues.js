// What the speech cues read on a WAV, every half second: momentary loudness, how many of its
// blocks pulse like speech, the strain (3 s presence over body against the stream's usual tilt),
// and the measured and believed normal. Run in Node with a worklet variant:
// node variants/cues.js variants/w-b10u3.js $PWD/lib/settings.js $PWD/lib/engine.js FILE.wav sleep
// Several files joined with + play as videos back to back (the engine forgets between them); the
// rows are for the last one.
const fs = require('fs'), vm = require('vm');
const [workletFile, settingsFile, engineFile, wavFile, preset = 'sleep'] = process.argv.slice(2);
require(settingsFile); require(engineFile);
const { LimitrSettings, LimitrEngine } = globalThis;
const FS = 48000, Q = 128, clock = { frame: 0 };
globalThis.sampleRate = FS;
Object.defineProperty(globalThis, 'currentTime', { get: () => clock.frame / FS, configurable: true });
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {} }; } };
let P = null;
vm.runInThisContext(`(function (registerProcessor) {${fs.readFileSync(workletFile, 'utf8')}\n})`)((n, c) => { P = c; });
const params = LimitrEngine.prototype.dspParams.call({ tabVolumeDb: 0, postGainDb: LimitrEngine.prototype.postGainDb }, LimitrSettings.normalize({ ...LimitrSettings.applyPreset({ volume: 0 }, preset) }));
const p = new P({ processorOptions: { params } });
const inL = new Float32Array(Q), inR = new Float32Array(Q), oL = new Float32Array(Q), oR = new Float32Array(Q);
// The worklet's onSubBlock, wrapped: what each 100 ms block read
const blocks = [];
const orig = p.onSubBlock.bind(p);
let t0 = 0;
p.onSubBlock = (...a) => { orig(...a); if (!blocks.length) t0 = clock.frame / FS; blocks.push({ t: clock.frame / FS - t0, m: 10 * Math.log10((p.subBlocks[0] + p.subBlocks[1] + p.subBlocks[2] + p.subBlocks[3]) / Math.max(1, p.subBlocksSeen)) - 0.691, pulse: p.pulse, speech: p.speechLike, strain: p.strain, tilt: p.usualTilt, normal: p.normalMomentary, believed: p.believed, locked: p.normalLocked, calm: p.calmLevelDb }); };
const files = wavFile.split('+');
let base = 0;
files.forEach((file, fi) => {
  const b = fs.readFileSync(file);
  let off = 12, data = null, ch = 2;
  while (off < b.length) { const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4); if (id === 'fmt ') ch = b.readUInt16LE(off + 10); if (id === 'data') { data = off + 8; break; } off += 8 + size; }
  const n = (b.length - data) / 2 / ch;
  if (fi) { p.resetAnalysis(); blocks.length = 0; }
  for (let k = 0; k + Q <= n; k += Q) {
    for (let i = 0; i < Q; i++) { inL[i] = b.readInt16LE(data + (k + i) * 2 * ch) / 32768; inR[i] = b.readInt16LE(data + ((k + i) * ch + (ch > 1 ? 1 : 0)) * 2) / 32768; }
    clock.frame = base + k; p.process([[inL, inR], []], [[oL, oR]]);
  }
  base += n;
});
const f = v => (Number.isFinite(v) ? v.toFixed(1).padStart(6) : '     -');
// STRAINED=6 lists the speech-like blocks strained that much or more instead
if (process.env.STRAINED) {
  for (const x of blocks) if (x.speech && x.strain >= Number(process.env.STRAINED)) console.log(`${x.t.toFixed(1).padStart(5)} s: loud ${f(x.m)}, strain ${f(x.strain)}, usual tilt ${f(x.tilt)}`);
  process.exit(0);
}
console.log("    t   loud  pulse speech strain   tilt normal believed  calm");
for (let i = 0; i + 5 <= blocks.length; i += 5) {
  const g = blocks.slice(i, i + 5), last = g[4];
  console.log(`${last.t.toFixed(1).padStart(5)} ${f(Math.max(...g.map(x => x.m)))} ${f(g.reduce((s, x) => s + x.pulse, 0) / 5)}  ${g.filter(x => x.speech).length}/5  ${f(last.strain)} ${f(last.tilt)} ${f(last.locked ? last.normal : NaN)} ${f(last.believed)} ${f(last.calm === null ? NaN : last.calm)}`);
}
