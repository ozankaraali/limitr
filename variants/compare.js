// Two or more renders of the same input, compared span by span: loudness, the edge (2-8 kHz) over
// the body (150-600 Hz) on the louder half of each span's 400 ms blocks, and how far apart they are.
// node variants/compare.js A.wav B.wav [C.wav...] -- 0-1,1-3,3-70
const fs = require('fs');
const args = process.argv.slice(2), cut = args.indexOf('--');
const files = args.slice(0, cut), spans = args[cut + 1].split(',').map(s => s.split('-').map(Number));
function read(f) {
  const b = fs.readFileSync(f); let off = 12, data = 0, ch = 2, fsr = 48000;
  while (off < b.length) { const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4); if (id === 'fmt ') { ch = b.readUInt16LE(off + 10); fsr = b.readUInt32LE(off + 12); } if (id === 'data') { data = off + 8; break; } off += 8 + size; }
  const n = Math.floor((b.length - data) / 2 / ch), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) s += b.readInt16LE(data + (i * ch + c) * 2); x[i] = s / ch / 32768; }
  return { x, fsr };
}
const biq = (c, x) => { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
const bp = (f0, q, fsr) => { const w = 2 * Math.PI * f0 / fsr, al = Math.sin(w) / (2 * q), a0 = 1 + al; return [al / a0, 0, -al / a0, -2 * Math.cos(w) / a0, (1 - al) / a0]; };
const rows = files.map(f => {
  const { x, fsr } = read(f);
  const body = biq(bp(300, 0.6, fsr), x), edge = biq(bp(4000, 0.5, fsr), x), hop = Math.round(0.4 * fsr);
  const blocks = [];
  for (let s = 0; s + hop <= x.length; s += hop) { let e = 0, eb = 0, ee = 0; for (let i = s; i < s + hop; i++) { e += x[i] * x[i]; eb += body[i] * body[i]; ee += edge[i] * edge[i]; } blocks.push({ t: s / fsr, db: 10 * Math.log10(e / hop + 1e-12), tilt: 10 * Math.log10((ee + 1e-12) / (eb + 1e-12)) }); }
  return { f, x, fsr, blocks };
});
for (const [a, z] of spans) {
  console.log(`${a}-${z} s`);
  for (const r of rows) {
    const sel = r.blocks.filter(b => b.t >= a && b.t + 0.4 <= z).sort((p, q) => q.db - p.db);
    const top = sel.slice(0, Math.max(1, Math.ceil(sel.length / 2)));
    const lvl = 10 * Math.log10(sel.reduce((s, b) => s + Math.pow(10, b.db / 10), 0) / Math.max(1, sel.length));
    const tilt = top.reduce((s, b) => s + b.tilt, 0) / top.length;
    let d = 0, e0 = 0; const i0 = Math.round(a * r.fsr), i1 = Math.min(r.x.length, Math.round(z * r.fsr)), x0 = rows[0].x;
    for (let i = i0; i < i1; i++) { const v = r.x[i] - x0[i]; d += v * v; e0 += x0[i] * x0[i]; }
    console.log(`  ${r.f.split('/').pop().padEnd(44)} level ${lvl.toFixed(1).padStart(6)} dB, edge over body ${tilt.toFixed(1).padStart(6)} dB` + (r === rows[0] ? '' : `, apart from the first by ${(10 * Math.log10(d / (e0 + 1e-20) + 1e-12)).toFixed(1)} dB`));
  }
}
