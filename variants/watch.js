// A WAV through a worklet in Node: once a second, the measured normal, the believed one, the
// guard's cut, the comfortable level's gain, and whether the last 1.5 s counts as speech
const fs = require('fs'), vm = require('vm');
const [workletFile, settingsFile, engineFile, wavFile, preset = 'sleep'] = process.argv.slice(2);
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
const b = fs.readFileSync(wavFile), n = (b.length - 44) / 4;
const p = new P({ processorOptions: { params } });
const inL = new Float32Array(Q), inR = new Float32Array(Q), oL = new Float32Array(Q), oR = new Float32Array(Q);
for (let k = 0; k + Q <= n; k += Q) {
  for (let i = 0; i < Q; i++) { inL[i] = b.readInt16LE(44 + (k + i) * 4) / 32768; inR[i] = b.readInt16LE(46 + (k + i) * 4) / 32768; }
  clock.frame = k; p.process([[inL, inR], []], [[oL, oR]]);
  if (k % FS < Q) console.log(`${(k / FS).toFixed(0).padStart(3)} s: normal ${p.normalMomentary.toFixed(1)}, believed ${p.believed !== undefined ? p.believed.toFixed(1) : '-'}, locked ${p.normalLocked}, provisional ${p.provisional}, speech heard ${(p.speechHeard || 0).toFixed(1)} s, speech now ${p.speechNow}, guard ${p.guardGain.toFixed(1)}, level ${p.levelGain.toFixed(1)}`);
}
