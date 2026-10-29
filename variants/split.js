// Renders recordings through the real engine (tests/engine-bench.html, silent GPU-free Chromium)
// with today's worklet and each loud-start variant, writes WAVs, and splits the numbers at the end
// of the variant's holding phase (while its believed normal is under the stream's measured one).
// Run: node split.js REPO OUTDIR
const path = require('path'), fs = require('fs');
const [REPO, OUT] = process.argv.slice(2).map(p => path.resolve(p));
const { chromium } = require(path.join(REPO, 'node_modules/playwright'));
const { startStaticServer } = require(path.join(REPO, 'tests/static-server'));
const FS = 48000;
const WORKLETS = [['today', path.join(REPO, 'lib/dsp-worklet.js')],
  ...(process.env.SPLIT_VARIANTS || 'b10u3,b5u3,b10u0,b5u0').split(',').map(n => [n, path.join(__dirname, `w-${n}.js`)])];
const CLIPS = {
  natgeo: { file: path.join(REPO, 'tests/fixtures/recordings/dataset/natgeo-tr-2026-10-23.ogg'), type: 'audio/ogg' },
  yelling: { file: path.join(REPO, 'tests/fixtures/recordings/yelling.wav'), type: 'audio/wav' }
};
const RUNS = [['natgeo', 'sleep'], ['natgeo', 'stream'], ['yelling', 'sleep']];
// The guard holds the talk while the believed normal sits more than the preset's headroom under the
// stream's measured one (its threshold under the talk itself)
const HEADROOM = { sleep: 2.5, stream: 3 };
const YELLING = { yells: [[8, 9.7], [15.4, 26.4]], calm: [[14, 14.8], [27.4, 33]] };

// ---------- analysis ----------
function biquad(x, [b0, b1, b2, a1, a2]) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const K1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585];
const K2 = [1, -2, 1, -1.99004745483398, 0.99007225036621];
function bandpass(f0, q) {
  const w = 2 * Math.PI * f0 / FS, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
  return [alpha / a0, 0, -alpha / a0, -2 * Math.cos(w) / a0, (1 - alpha) / a0];
}
// Per 100 ms: momentary loudness (400 ms, K-weighted) and the edge (2-8 kHz) over body (150-600 Hz) balance
function analyse(l, r) {
  const kl = biquad(biquad(l, K1), K2), kr = biquad(biquad(r, K1), K2);
  const mono = Float64Array.from(l, (v, i) => (v + r[i]) / 2);
  const body = biquad(biquad(mono, bandpass(300, 0.667)), bandpass(300, 0.667));
  const edge = biquad(biquad(mono, bandpass(4000, 0.667)), bandpass(4000, 0.667));
  const hop = FS / 10, out = [];
  for (let s = 0; s + 4 * hop <= l.length; s += hop) {
    let k = 0, b = 0, e = 0;
    for (let i = s; i < s + 4 * hop; i++) { k += kl[i] * kl[i] + kr[i] * kr[i]; b += body[i] * body[i]; e += edge[i] * edge[i]; }
    const n = 4 * hop;
    out.push({ t: s / FS + 0.4, lufs: -0.691 + 10 * Math.log10(k / n + 1e-20), balance: 10 * Math.log10((e + 1e-20) / (b + 1e-20)) });
  }
  return out;
}
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (a, q) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
// The talk: blocks over -70 LUFS and no more than 10 LU under their mean (BS.1770-4's relative gate)
function talkBlocks(m) {
  const a = m.filter(v => v.lufs > -70);
  const mean = 10 * Math.log10(a.reduce((s, v) => s + Math.pow(10, v.lufs / 10), 0) / Math.max(1, a.length));
  return a.filter(v => v.lufs > mean - 10);
}
// EBU loudness range over 3 s windows (10th to 95th percentile, gated -70 and -20 LU)
function lra(m) {
  const st = [];
  for (let i = 29; i < m.length; i++) {
    let s = 0;
    for (let j = i - 29; j <= i; j += 1) s += Math.pow(10, m[j].lufs / 10);
    st.push(10 * Math.log10(s / 30));
  }
  const a = st.filter(v => v > -70);
  if (a.length < 10) return NaN;
  const mean = 10 * Math.log10(a.reduce((s, v) => s + Math.pow(10, v / 10), 0) / a.length);
  const g = a.filter(v => v > mean - 20);
  return pct(g, 0.95) - pct(g, 0.10);
}
function stats(inM, outM, meters, a, b) {
  const within = (x, t) => t >= a && t < b;
  const inT = talkBlocks(inM.filter(v => within(v, v.t))), times = new Set(inT.map(v => v.t.toFixed(1)));
  const outT = outM.filter(v => times.has(v.t.toFixed(1)));
  const met = meters.filter(m => m.time >= a && m.time < b);
  let w = 0, g = 0, busy = 0, shelf = 0, shelfOn = 0;
  for (const m of met) {
    const p = Math.pow(10, m.inDb / 10);
    const cut = Math.min(m.guardDb, m.shoutDb || 0) + (m.limiterDb || 0);
    w += p; g += p * Math.pow(10, cut / 10);
    if (Math.min(m.guardDb, m.shoutDb || 0) < -1) busy++;
    shelf += -(m.harshDb || 0) * p;
    if ((m.harshDb || 0) < -1) shelfOn++;
  }
  return {
    talkIn: median(inT.map(v => v.lufs)), talkOut: median(outT.map(v => v.lufs)),
    cut: w ? -10 * Math.log10(g / w) : NaN, busy: met.length ? busy / met.length : NaN,
    shelf: w ? shelf / w : NaN, shelfOn: met.length ? shelfOn / met.length : NaN,
    duller: median(outT.map(v => v.balance)) - median(inT.map(v => v.balance)),
    lraIn: lra(inM.filter(v => within(v, v.t))), lraOut: lra(outM.filter(v => within(v, v.t)))
  };
}
const levelIn = (m, ranges) => median(m.filter(v => ranges.some(([a, b]) => v.t >= a + 0.4 && v.t <= b)).map(v => v.lufs));

function wav(file, l, r) {
  const n = l.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(FS, 24);
  buf.writeUInt32LE(FS * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767))), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}
const fromB64 = s => { const b = Buffer.from(s, 'base64'); const i16 = new Int16Array(b.buffer, b.byteOffset, b.length / 2); return Float32Array.from(i16, v => v / 32768); };

(async () => {
  let current = WORKLETS[0][1];
  const routes = {
    '/lib/dsp-worklet.js': (req, res) => { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(current)); }
  };
  for (const [name, c] of Object.entries(CLIPS)) routes[`/clip/${name}`] = (req, res) => { res.writeHead(200, { 'Content-Type': c.type }); fs.createReadStream(c.file).pipe(res); };
  const { server, port } = await startStaticServer(REPO, routes);
  const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-audio-output', '--mute-audio'] });
  const results = {};
  try {
    for (const [wname, wfile] of WORKLETS) {
      current = wfile;
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}/tests/engine-bench.html`);
      await page.waitForFunction(() => window.benchReady === true);
      for (const [clip, preset] of RUNS) {
        const r = await page.evaluate(async ([url, id]) => {
          const decoded = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(await (await fetch(url)).arrayBuffer());
          const left = decoded.getChannelData(0), right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : left;
          const out = await bench.renderThroughEngine(left, right, bench.presetSettings(id));
          const b64 = x => {
            const i16 = new Int16Array(x.length);
            for (let i = 0; i < x.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767)));
            let s = ''; const u8 = new Uint8Array(i16.buffer);
            for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
            return btoa(s);
          };
          return { inL: b64(left), inR: b64(right), outL: b64(out.left), outR: b64(out.right), dsp: out.dsp,
            meters: out.meters.map(m => ({ time: m.time, guardDb: m.guardDb, shoutDb: m.shoutDb, limiterDb: m.limiterDb, harshDb: m.harshDb, inDb: m.inDb, baselineDb: m.baselineDb, believedDb: m.believedDb, levelDb: m.levelDb })) };
        }, [`/clip/${clip}`, preset]);
        const data = { inL: fromB64(r.inL), inR: fromB64(r.inR), outL: fromB64(r.outL), outR: fromB64(r.outR), meters: r.meters };
        if (clip === 'natgeo' && preset === 'sleep' && !process.env.NO_WAV) {
          if (wname === 'today') wav(path.join(OUT, 'natgeo-23oct-sleep-0-input.wav'), data.inL, data.inR);
          wav(path.join(OUT, `natgeo-23oct-sleep-${wname}.wav`), data.outL, data.outR);
        }
        const inM = analyse(data.inL, data.inR), outM = analyse(data.outL, data.outR);
        const hold = data.meters.filter(m => Number.isFinite(m.believedDb) && m.baselineDb - m.believedDb > HEADROOM[preset]);
        results[`${wname}/${clip}/${preset}`] = { inM, outM, meters: data.meters, holdEnd: hold.length ? hold[hold.length - 1].time : 0, length: data.inL.length / FS };
        console.error(`rendered ${wname} ${clip} ${preset} (${r.dsp}), holding until ${results[`${wname}/${clip}/${preset}`].holdEnd.toFixed(1)} s`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const f1 = v => (Number.isFinite(v) ? v.toFixed(1) : '-');
  const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : '-');
  const pc = v => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '-');
  const row = (label, s) => `    ${label.padEnd(30)} talk ${f1(s.talkIn)}→${f1(s.talkOut)} LUFS, cut on the talk ${f2(s.cut)} dB (${pc(s.busy)} of the time), harsh shelf ${f2(s.shelf)} dB (on >1 dB ${pc(s.shelfOn)}), brightness ${s.duller >= 0 ? '+' : ''}${f1(s.duller)} dB, range ${f1(s.lraIn)}→${f1(s.lraOut)} LU`;
  for (const [clip, preset] of RUNS) {
    console.log(`\n${clip} ${preset}`);
    const today = results[`today/${clip}/${preset}`];
    console.log(row('today, whole', stats(today.inM, today.outM, today.meters, 0, today.length)));
    for (const [wname] of WORKLETS.slice(1)) {
      const v = results[`${wname}/${clip}/${preset}`];
      const end = v.holdEnd;
      console.log(`  ${wname}: holding phase 0-${f1(end)} s of ${f1(v.length)} s`);
      console.log(row(`${wname}, whole`, stats(v.inM, v.outM, v.meters, 0, v.length)));
      if (end >= v.length - 3 && end > 0) console.log('    (held to the end: no after)');
      if (end > 0 && end < v.length - 3) {
        console.log(row(`${wname}, holding (0-${f1(end)} s)`, stats(v.inM, v.outM, v.meters, 0, end)));
        console.log(row(`today, same span`, stats(today.inM, today.outM, today.meters, 0, end)));
        console.log(row(`${wname}, after`, stats(v.inM, v.outM, v.meters, end, v.length)));
        console.log(row(`today, same span`, stats(today.inM, today.outM, today.meters, end, v.length)));
      }
      if (clip === 'yelling') {
        for (const w of [today, v]) {
          const parts = [...YELLING.yells.map(r => ['yell', r]), ...YELLING.calm.map(r => ['calm', r])].sort((x, y) => x[1][0] - y[1][0]);
          const calmOut = levelIn(w.outM, YELLING.calm);
          console.log(`    ${(w === today ? 'today' : wname).padEnd(8)} ${parts.map(([k, r]) => `${k} ${r[0]}-${r[1]} s ${f1(levelIn(w.inM, [r]))}→${f1(levelIn(w.outM, [r]))}`).join(', ')}; calm talk ${f1(calmOut)} LUFS, yells over it +${f1(levelIn(w.outM, YELLING.yells) - calmOut)} dB`);
        }
      }
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
