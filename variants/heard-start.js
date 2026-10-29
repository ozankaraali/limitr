// What is heard at a stream's start: the voice's output level (dB RMS per 100 ms, talk only),
// every 3 s after the voice starts, against where it settles (its median from 45 to 60 s in).
// Scenarios: the voice from the first moment, after 10 s of room noise, after a 40 s quiet intro.
const fs = require('fs'), vm = require('vm');
const [workletFile, settingsFile, engineFile, preset = 'sleep', voiceDb = '-14'] = process.argv.slice(2);
require(settingsFile); require(engineFile);
const { LimitrSettings, LimitrEngine } = globalThis;
const FS = 48000, Q = 128, clock = { frame: 0 };
globalThis.sampleRate = FS;
Object.defineProperty(globalThis, 'currentTime', { get: () => clock.frame / FS, configurable: true });
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { log: [], postMessage(m) { this.log.push(m); } }; } };
let P = null;
vm.runInThisContext(`(function (registerProcessor) {${fs.readFileSync(workletFile, 'utf8')}\n})`)((n, c) => { P = c; });
const settings = LimitrSettings.normalize({ ...LimitrSettings.applyPreset({ volume: 0 }, preset) });
const params = LimitrEngine.prototype.dspParams.call({ tabVolumeDb: 0, postGainDb: LimitrEngine.prototype.postGainDb }, settings);
const amp = d => Math.pow(10, d / 20);
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const syl = [];
for (let t = 0; t < 200; t += 0.18 + rnd() * 0.12) syl.push([t, 0.6 + rnd() * 0.8]);
const voiceAt = t => {
  const phrase = (t % 6) < 5.2;
  let s = 0;
  for (const f of [180, 360, 540, 900]) s += Math.sin(2 * Math.PI * f * t) / (f / 180);
  const k = Math.floor(t / 0.22);
  const env = 0.5 - 0.5 * Math.cos(2 * Math.PI * ((t % 0.22) / 0.22));
  return phrase ? s * env * (syl[k % syl.length][1]) * 0.55 : 0;
};
const room = () => (rnd() * 2 - 1);
const music = t => Math.sin(2 * Math.PI * 220 * t) + 0.7 * Math.sin(2 * Math.PI * 277 * t) + 0.5 * Math.sin(2 * Math.PI * 330 * t);
const scenarios = [
  ['voice from the start', 0, () => 0],
  ['after 10 s of room noise (-62)', 10, t => room() * amp(-62) * 1.7],
  ['after a 40 s quiet intro (-45)', 40, t => music(t) * amp(-45) * 0.7]
];
for (const [name, lead, under] of scenarios) {
  const p = new P({ processorOptions: { params } });
  const inL = new Float32Array(Q), oL = new Float32Array(Q), oR = new Float32Array(Q);
  const total = lead + 60;
  const slots = [];
  let acc = 0, accV = 0, n = 0;
  for (let b = 0; b < Math.floor(total * FS / Q); b++) {
    for (let i = 0; i < Q; i++) {
      const t = (b * Q + i) / FS;
      inL[i] = (t >= lead ? voiceAt(t - lead) * amp(Number(voiceDb)) * 2 : 0) + under(t);
    }
    clock.frame = b * Q; p.process([[inL, inL], []], [[oL, oR]]);
    for (let i = 0; i < Q; i++) {
      acc += oL[i] * oL[i]; n++;
      const t = (b * Q + i) / FS;
      accV += t >= lead && ((t - lead) % 6) < 5.2 ? 1 : 0;
      if (n === FS / 10) { slots.push({ t: slots.length / 10, db: 10 * Math.log10(acc / n + 1e-20), talk: accV === n }); acc = 0; accV = 0; n = 0; }
    }
  }
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  const settled = med(slots.filter(s => s.talk && s.t >= lead + 45).map(s => s.db));
  const row = [];
  for (let a = 0; a < 45; a += 3) row.push((med(slots.filter(s => s.talk && s.t >= lead + a && s.t < lead + a + 3).map(s => s.db)) - settled).toFixed(1).padStart(5));
  console.log(`  ${name.padEnd(32)} ${row.join(' ')}`);
}
