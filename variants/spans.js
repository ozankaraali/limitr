// NatGeo, ad, NatGeo renders: each span of the second NatGeo against the same span of the first
const fs = require('fs');
const FS = 48000;
function read(file) {
  const b = fs.readFileSync(file);
  const n = (b.length - 44) / 4, l = new Float32Array(n), r = new Float32Array(n);
  for (let i = 0; i < n; i++) { l[i] = b.readInt16LE(44 + i * 4) / 32768; r[i] = b.readInt16LE(46 + i * 4) / 32768; }
  return [l, r];
}
function biquad(x, [b0, b1, b2, a1, a2]) {
  const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
const K1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585];
const K2 = [1, -2, 1, -1.99004745483398, 0.99007225036621];
function momentary([l, r]) {
  const kl = biquad(biquad(l, K1), K2), kr = biquad(biquad(r, K1), K2), hop = FS / 10, out = [];
  for (let s = 0; s + 4 * hop <= l.length; s += hop) { let k = 0; for (let i = s; i < s + 4 * hop; i++) k += kl[i] * kl[i] + kr[i] * kr[i]; out.push({ t: s / FS + 0.4, lufs: -0.691 + 10 * Math.log10(k / (4 * hop) + 1e-20) }); }
  return out;
}
const median = a => { const s = a.sort((x, y) => x - y); return s[s.length >> 1]; };
function talking(m) {
  const a = m.filter(v => v.lufs > -70);
  const mean = 10 * Math.log10(a.reduce((s, v) => s + Math.pow(10, v.lufs / 10), 0) / a.length);
  return median(a.filter(v => v.lufs > mean - 10).map(v => v.lufs));
}
const NAT = 70.339, first = 0.5, second = 0.5 + NAT + 0.5 + 20 + 0.5;
const spans = [[0.4, 10], [10, 30], [30, 70]];
for (const name of ['0-input', 'today', 'b10u3c', 'b5u3c']) {
  const m = momentary(read(`${process.argv[2]}/${process.argv[3] || 'natgeo-voicead-natgeo'}-sleep-${name}.wav`));
  const at = (a, b) => talking(m.filter(v => v.t >= a && v.t < b));
  const rows = spans.map(([a, b]) => { const one = at(first + a, first + b), two = at(second + a, second + b); return `${a.toFixed(0)}-${b} s: ${one.toFixed(1)} then ${two.toFixed(1)} (${(two - one >= 0 ? '+' : '') + (two - one).toFixed(1)})`; });
  console.log(`${name.padEnd(8)} ${rows.join(' | ')}`);
}
