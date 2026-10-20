// A realistic-sounding test stream for screenshots: talking (voiced syllables with pauses),
// one alert chime and one sudden yell. Deterministic, mono, 48 kHz, 16-bit WAV.

const RATE = 48000;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function talk(out, start, end, level, seed, pitch = 150) {
  const r = rng(seed);
  let i = Math.round(start * RATE);
  const stop = Math.round(end * RATE);
  let phase = 0;
  let syllables = 0;
  while (i < stop) {
    const length = Math.round((0.12 + r() * 0.16) * RATE);
    const f0 = pitch * (0.85 + r() * 0.3);
    for (let j = 0; j < length && i < stop; j++, i++) {
      const env = Math.min(1, j / (0.015 * RATE)) * Math.pow(1 - j / length, 0.6);
      phase = (phase + f0 / RATE) % 1;
      const voiced = Math.sin(2 * Math.PI * phase) + 0.5 * Math.sin(4 * Math.PI * phase) + 0.25 * Math.sin(6 * Math.PI * phase);
      out[i] += level * env * (0.8 * voiced + 0.2 * (r() * 2 - 1));
    }
    syllables++;
    i += Math.round((syllables % 7 === 0 ? 0.35 + r() * 0.3 : 0.04 + r() * 0.1) * RATE);
  }
}

function chime(out, start, level) {
  const first = Math.round(start * RATE);
  const hit = Math.round(0.27 * RATE);
  for (let k = 0; k < hit * 3; k++) {
    const env = Math.exp(-(k % hit) / (0.08 * RATE));
    const t = k / RATE;
    out[first + k] += level * env * (Math.sin(2 * Math.PI * 880 * t) + 0.6 * Math.sin(2 * Math.PI * 1320 * t));
  }
}

function streamWav(seconds = 24) {
  const n = seconds * RATE;
  const samples = new Float32Array(n);
  talk(samples, 0, 14.5, 0.06, 7);
  chime(samples, 7, 0.45);
  talk(samples, 14.5, 16.5, 0.35, 99, 290);   // the yell
  talk(samples, 16.5, seconds, 0.06, 11);

  const data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 2, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(RATE, 24); data.writeUInt32LE(RATE * 2, 28); data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  return data;
}

module.exports = { streamWav };
