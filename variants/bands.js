// How renders change each band against their input, on the louder half of the 400 ms blocks (the
// talk, not the pauses): 150-600 Hz body, 2-4 kHz presence, 4-8 kHz edge, 8-16 kHz air, each in dB
// against the input, and the bands over the body (tone, ignoring overall level).
// node variants/bands.js INPUT.wav A.wav [B.wav...] [-- from-to]
const fs = require('fs');
const args = process.argv.slice(2), cut = args.indexOf('--');
const files = cut < 0 ? args : args.slice(0, cut), [from, to] = cut < 0 ? [0, Infinity] : args[cut + 1].split('-').map(Number);
function read(f) {
  const b = fs.readFileSync(f); let off = 12, data = 0, ch = 2, fsr = 48000;
  while (off < b.length) { const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4); if (id === 'fmt ') { ch = b.readUInt16LE(off + 10); fsr = b.readUInt32LE(off + 12); } if (id === 'data') { data = off + 8; break; } off += 8 + size; }
  const n = Math.floor((b.length - data) / 2 / ch), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) s += b.readInt16LE(data + (i * ch + c) * 2); x[i] = s / ch / 32768; }
  return { x, fsr };
}
const biq = (c, x) => { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
const hp = (f0, fsr) => { const w = 2 * Math.PI * f0 / fsr, al = Math.sin(w) / Math.SQRT2, c = Math.cos(w), a0 = 1 + al; return [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - al) / a0]; };
const lp = (f0, fsr) => { const w = 2 * Math.PI * f0 / fsr, al = Math.sin(w) / Math.SQRT2, c = Math.cos(w), a0 = 1 + al; return [(1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, -2 * c / a0, (1 - al) / a0]; };
const BANDS = [['body', 150, 600], ['2-4k', 2000, 4000], ['4-8k', 4000, 8000], ['8-16k', 8000, 16000]];
const band = (x, fsr, a, z) => biq(lp(z, fsr), biq(lp(z, fsr), biq(hp(a, fsr), biq(hp(a, fsr), x))));
const input = read(files[0]);
// The input's louder half of 400 ms blocks picks the moments every file is measured on
const hop = Math.round(0.4 * input.fsr), i0 = Math.round(from * input.fsr), i1 = Math.min(input.x.length, Math.round(to * input.fsr));
const blocks = [];
for (let s = i0; s + hop <= i1; s += hop) { let e = 0; for (let i = s; i < s + hop; i++) e += input.x[i] * input.x[i]; blocks.push({ s, e }); }
const loud = blocks.slice().sort((a, b) => b.e - a.e).slice(0, Math.ceil(blocks.length / 2));
const energies = f => { const { x, fsr } = read(f); return BANDS.map(([, a, z]) => { const y = band(x, fsr, a, z); let e = 0; for (const b of loud) for (let i = b.s; i < b.s + hop; i++) e += y[i] * y[i]; return e; }); };
const ein = energies(files[0]);
console.log(`${'file'.padEnd(46)} ${BANDS.map(b => b[0].padStart(7)).join('')}   tone: ${BANDS.slice(1).map(b => b[0].padStart(7)).join('')}`);
for (const f of files.slice(1)) {
  const e = energies(f), d = e.map((v, k) => 10 * Math.log10(v / ein[k]));
  console.log(`${f.split('/').pop().padEnd(46)} ${d.map(v => v.toFixed(1).padStart(7)).join('')}         ${d.slice(1).map(v => (v - d[0]).toFixed(1).padStart(7)).join('')}`);
}
