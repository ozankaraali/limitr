// The engine bench's synthetic voice (tests/engine-bench.js, voice() and bed()) written as a WAV, so
// the Node scripts can read the speech cues on it: 10 s of room noise at -62, then the voice at -16
// (its level set by plain RMS here, not K-weighted). Run: node variants/synth-voice.js OUT.wav
const fs = require('fs');
const FS = 48000;
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const lowpass = (d, c) => { const a = 1 - Math.exp(-2 * Math.PI * c / FS); let y = 0; for (let i = 0; i < d.length; i++) { y += (d[i] - y) * a; d[i] = y; } };
const highpass = (d, c) => { const a = 1 - Math.exp(-2 * Math.PI * c / FS); let lp = 0; for (let i = 0; i < d.length; i++) { lp += (d[i] - lp) * a; d[i] -= lp; } };
function voice(seconds, seed, pitch = 140, brightness = 3500) {
  const r = rng(seed), n = Math.round(seconds * FS), out = new Float32Array(n);
  let phase = 0, i = 0, syllables = 0;
  while (i < n) {
    const dur = Math.round((0.12 + r() * 0.16) * FS), f0 = pitch * (0.85 + r() * 0.3);
    for (let j = 0; j < dur && i < n; j++, i++) {
      const t = j / dur, env = Math.min(1, j / (0.015 * FS)) * Math.pow(1 - t, 0.6);
      phase += f0 / FS; if (phase >= 1) phase -= 1;
      out[i] = env * (0.7 * (2 * phase - 1) + 0.3 * (r() * 2 - 1));
    }
    syllables++;
    i += Math.round((syllables % 8 === 0 ? 0.3 + r() * 0.4 : 0.04 + r() * 0.1) * FS);
  }
  highpass(out, 120); lowpass(out, brightness);
  return out;
}
function bed(seconds, seed) {
  const r = rng(seed), n = Math.round(seconds * FS), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (r() * 2 - 1) * (0.7 + 0.3 * Math.sin(2 * Math.PI * i / (3.7 * FS)));
  lowpass(out, 1200); highpass(out, 60);
  return out;
}
const rmsTo = (d, db) => { let s = 0; for (const v of d) s += v * v; const g = Math.pow(10, db / 20) / Math.sqrt(s / d.length); for (let i = 0; i < d.length; i++) d[i] *= g; return d; };
const x = rmsTo(bed(30, 5), -62), v = rmsTo(voice(20, 7), -16);
for (let i = 0; i < v.length; i++) x[10 * FS + i] += v[i];
const buf = Buffer.alloc(44 + x.length * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + x.length * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(FS, 24); buf.writeUInt32LE(FS * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(x.length * 4, 40);
for (let i = 0; i < x.length; i++) { const s = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))); buf.writeInt16LE(s, 44 + i * 4); buf.writeInt16LE(s, 46 + i * 4); }
fs.writeFileSync(process.argv[2], buf);
