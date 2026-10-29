// From the sequence renders: each part's talk median, upper quartile (what the engine calls normal,
// roughly: gated blocks), and gated integrated loudness, in and out
const fs = require('fs');
const FS = 48000;
function read(file) { const b = fs.readFileSync(file); const n = (b.length - 44) / 4, l = new Float32Array(n), r = new Float32Array(n); for (let i = 0; i < n; i++) { l[i] = b.readInt16LE(44 + i * 4) / 32768; r[i] = b.readInt16LE(46 + i * 4) / 32768; } return [l, r]; }
function biquad(x, [b0, b1, b2, a1, a2]) { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
const K1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585], K2 = [1, -2, 1, -1.99004745483398, 0.99007225036621];
function momentary([l, r]) { const kl = biquad(biquad(l, K1), K2), kr = biquad(biquad(r, K1), K2), hop = FS / 10, out = []; for (let s = 0; s + 4 * hop <= l.length; s += hop) { let k = 0; for (let i = s; i < s + 4 * hop; i++) k += kl[i] * kl[i] + kr[i] * kr[i]; out.push({ t: s / FS + 0.4, lufs: -0.691 + 10 * Math.log10(k / (4 * hop) + 1e-20) }); } return out; }
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function levels(m) {
  const a = m.filter(v => v.lufs > -70).map(v => v.lufs);
  const mean = 10 * Math.log10(a.reduce((s, v) => s + Math.pow(10, v / 10), 0) / a.length);
  const g = a.filter(v => v > mean - 10);
  const integ = 10 * Math.log10(g.reduce((s, v) => s + Math.pow(10, v / 10), 0) / g.length);
  return `median ${q(g, 0.5).toFixed(1)}, upper quartile ${q(g, 0.75).toFixed(1)}, integrated ${integ.toFixed(1)}`;
}
const NAT = 70.339, parts = [['NatGeo', 0.5, 0.5 + NAT], ['ad', 0.5 + NAT + 0.5, 0.5 + NAT + 0.5 + 20], ['NatGeo again', 0.5 + NAT + 0.5 + 20 + 0.5, 0.5 + NAT + 0.5 + 20 + 0.5 + NAT]];
for (const name of ['0-input', 'today']) {
  const m = momentary(read(`${process.argv[2]}/${process.argv[3] || 'natgeo-voicead-natgeo'}-sleep-${name}.wav`));
  console.log(`${name === '0-input' ? 'in' : 'out, today (Sleep)'}:`);
  for (const [p, a, b] of parts) console.log(`  ${p.padEnd(13)} ${levels(m.filter(v => v.t >= a + 0.4 && v.t < b))}`);
}
