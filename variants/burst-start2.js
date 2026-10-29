// The extension test's tone (talk with a 1 s burst at 4-5 s and 9-10 s of a 12 s loop), the stream
// starting at a given point of the loop. Per 12 s of the stream: the talk's output level (dB, RMS),
// how far the bursts come out over it, and the spike count at the end. For a worklet, settings, engine.
const fs = require('fs'), vm = require('vm');
const [workletFile, settingsFile, engineFile, preset = 'sleep', phases = '3.95,4.0,4.05,4.3,9.0', seconds = '60'] = process.argv.slice(2);
require(settingsFile); require(engineFile);
const { LimitrSettings, LimitrEngine } = globalThis;
const FS = 48000, Q = 128, clock = { frame: 0 };
globalThis.sampleRate = FS;
Object.defineProperty(globalThis, 'currentTime', { get: () => clock.frame / FS, configurable: true });
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { log: [], postMessage(m) { this.log.push(m); } }; } };
let P = null;
vm.runInThisContext(`(function (registerProcessor) {${fs.readFileSync(workletFile, 'utf8')}\n})`)((n, c) => { P = c; });
const inBurst = u => (u > 4 && u < 5) || (u > 9 && u < 10);
const tone = t => {
  const u = t % 12;
  const syllable = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * u);
  return inBurst(u) ? 0.6 * Math.sin(2 * Math.PI * 1200 * u) : 0.04 * syllable * Math.sin(2 * Math.PI * 330 * u);
};
const settings = LimitrSettings.normalize({ ...LimitrSettings.applyPreset({ volume: 0 }, preset) });
const params = LimitrEngine.prototype.dspParams.call({ tabVolumeDb: 0, postGainDb: LimitrEngine.prototype.postGainDb }, settings);
const db = ms => 10 * Math.log10(ms + 1e-20);
for (const start of phases.split(',').map(Number)) {
  const p = new P({ processorOptions: { params } });
  const inL = new Float32Array(Q), oL = new Float32Array(Q), oR = new Float32Array(Q);
  const total = Number(seconds);
  const slots = [];
  let acc = 0, n = 0, kinds = new Set();
  for (let b = 0; b < Math.floor(total * FS / Q); b++) {
    for (let i = 0; i < Q; i++) inL[i] = tone(start + (b * Q + i) / FS);
    clock.frame = b * Q; p.process([[inL, inL], []], [[oL, oR]]);
    for (let i = 0; i < Q; i++) {
      acc += oL[i] * oL[i]; n++;
      kinds.add(inBurst((start + (b * Q + i) / FS) % 12) ? 'b' : 't');
      if (n === FS / 10) { slots.push({ t: slots.length / 10, out: db(acc / n), kind: kinds.size === 1 ? [...kinds][0] : 'x' }); acc = 0; n = 0; kinds = new Set(); }
    }
  }
  const m = p.port.log.filter(e => e && e.type === 'meters');
  const row = [];
  for (let from = 0; from < total; from += 12) {
    const part = slots.filter(s => s.t >= from && s.t < from + 12);
    const talk = part.filter(s => s.kind === 't').map(s => s.out).sort((a, b) => a - b);
    const bursts = part.filter(s => s.kind === 'b').map(s => s.out);
    const talkOut = talk.length ? talk[talk.length >> 1] : NaN;
    row.push(`${String(from).padStart(2)}-${from + 12}s talk ${talkOut.toFixed(0)} bursts +${(Math.max(...bursts) - talkOut).toFixed(0)}`);
  }
  console.log(`  start ${start.toFixed(2)} s: ${row.join(' | ')} | ${m[m.length - 1].spikes} spikes`);
}
