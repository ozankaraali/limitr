// Videos back to back in one page, each new one making the engine forget at an exact sample (the
// scratch worklet copies carry the schedule: a message from the page would land late in an offline
// render). Real engine chain (tests/engine-bench.html), silent GPU-free Chromium.
// Clips are named by the ID in their file name and found in the local dataset
// (tests/fixtures/dataset.local.json); the voice-over is made with macOS `say` if it isn't there.
// Run: node variants/seq2.js . variants/listen
// SEQ_VARIANTS=b5u3,b5u3t picks the variants next to today's, SEQ_WAVS=today,b5u3t the renders and
// SEQ_WAV_PRESETS=sleep,stream their presets (Sleep alone by default), SEQ_ONLY=regex the sequences
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const [REPO, OUT] = process.argv.slice(2).map(p => path.resolve(p));
const { chromium } = require(path.join(REPO, 'node_modules/playwright'));
const { startStaticServer } = require(path.join(REPO, 'tests/static-server'));
const FS = 48000, GAP_S = 0.5;
const D = path.join(REPO, 'tests/fixtures/recordings/dataset');
const { DATASET } = require(path.join(path.resolve(REPO), 'tools/dataset-file'));
const ENTRIES = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
const entryOf = id => { const e = ENTRIES.find(x => x.file.includes(id)); if (!e) throw new Error(`no dataset clip ${id}`); return e; };
const VOICEOVER_TEXT = 'Yeni sezon burada. Şimdi sipariş verin, ilk siparişinizde kargo bizden. Bu fırsatı kaçırmayın, stoklar sınırlı. Hemen indirin, hemen deneyin.';
const WORKLETS = [['today', path.join(REPO, 'lib/dsp-worklet.js')],
  ...(process.env.SEQ_VARIANTS || 'b10u3,b5u3,b10u3d,b5u3d').split(',').map(n => [n, path.join(__dirname, `w-${n}.js`)])];
const WAVS_FOR = (process.env.SEQ_WAVS || 'today,b10u3d,b5u3d').split(',');
const WAV_PRESETS = (process.env.SEQ_WAV_PRESETS || 'sleep').split(',');
const VP05_LOUD = entryOf('vp05dspr').loud;   // the listener's marked loud parts

function biquad(x, [b0, b1, b2, a1, a2]) { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
const K1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585], K2 = [1, -2, 1, -1.99004745483398, 0.99007225036621];
function momentary(l, r) { const kl = biquad(biquad(l, K1), K2), kr = biquad(biquad(r, K1), K2), hop = FS / 10, out = []; for (let s = 0; s + 4 * hop <= l.length; s += hop) { let k = 0; for (let i = s; i < s + 4 * hop; i++) k += kl[i] * kl[i] + kr[i] * kr[i]; out.push({ t: s / FS + 0.4, lufs: -0.691 + 10 * Math.log10(k / (4 * hop) + 1e-20) }); } return out; }
// Gated integrated loudness (BS.1770-4: -70 absolute, -10 relative) of momentary blocks
function integrated(m) { const a = m.filter(v => v.lufs > -70); if (!a.length) return NaN; const mean = 10 * Math.log10(a.reduce((s, v) => s + Math.pow(10, v.lufs / 10), 0) / a.length); const g = a.filter(v => v.lufs > mean - 10); return 10 * Math.log10(g.reduce((s, v) => s + Math.pow(10, v.lufs / 10), 0) / g.length); }
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
function talking(m) { const a = m.filter(v => v.lufs > -70); const mean = 10 * Math.log10(a.reduce((s, v) => s + Math.pow(10, v.lufs / 10), 0) / Math.max(1, a.length)); return median(a.filter(v => v.lufs > mean - 10).map(v => v.lufs)); }
function wav(file, l, r) { const n = l.length, buf = Buffer.alloc(44 + n * 4); buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(FS, 24); buf.writeUInt32LE(FS * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40); for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767))), 44 + i * 4); buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767))), 46 + i * 4); } fs.writeFileSync(file, buf); }
function readWavMono(file) { const b = fs.readFileSync(file); let off = 12, data = null, ch = 1; while (off < b.length) { const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4); if (id === 'fmt ') ch = b.readUInt16LE(off + 10); if (id === 'data') { data = b.subarray(off + 8, off + 8 + size); break; } off += 8 + size; } const n = data.length / 2 / ch, x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = data.readInt16LE(i * 2 * ch) / 32768; return x; }
const fromB64 = s => { const b = Buffer.from(s, 'base64'); const i16 = new Int16Array(b.buffer, b.byteOffset, b.length / 2); return Float32Array.from(i16, v => v / 32768); };

// The music bed of an ad (chords, a bright hi-hat, a kick), and a voice over it when given
function makeAd(voice, seconds = 20) {
  const n = seconds * FS, l = new Float32Array(n);
  let seed = 11, hp = 0, prev = 0;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    let music = 0;
    for (const f of [220, 277, 330, 440, 554]) music += 0.3 * Math.sin(2 * Math.PI * f * t);
    const noise = rnd() * 2 - 1;
    hp = 0.95 * (hp + noise - prev); prev = noise;
    const hat = hp * Math.exp(-((t % 0.25) / 0.03)) * 0.8;
    const kick = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-((t % 0.5) / 0.08)) * 1.2;
    let v;
    if (voice) {
      const k = i - Math.round(0.5 * FS), len = voice.length, gapN = Math.round(0.3 * FS);
      const j = k >= 0 ? k % (len + gapN) : -1;
      v = j >= 0 && j < len ? voice[j] * 6 : 0;
      l[i] = v + 0.12 * (music + hat + kick);
    } else {
      v = 0;
      for (const f of [160, 320, 480, 800, 1600]) v += Math.sin(2 * Math.PI * f * t) / (f / 160);
      const env = (0.5 - 0.5 * Math.cos(2 * Math.PI * ((t % 0.2) / 0.2))) * ((t % 3) < 2.7 ? 1 : 0);
      l[i] = v * env * 0.6 + 0.35 * (music + hat + kick);
    }
  }
  const gain = Math.pow(10, (-14 - integrated(momentary(l, l))) / 20);
  for (let i = 0; i < n; i++) l[i] *= gain;
  return l;
}
const duration = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

(async () => {
  const vo = path.join(__dirname, 'voiceover/vo.wav');
  if (!fs.existsSync(vo)) {
    fs.mkdirSync(path.dirname(vo), { recursive: true });
    execFileSync('say', ['-v', 'Yelda', '-o', vo.replace(/\.wav$/, '.aiff'), VOICEOVER_TEXT]);
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@48000', '-c', '1', vo.replace(/\.wav$/, '.aiff'), vo]);
  }
  const ads = { 'music ad': makeAd(null), 'voice-over ad': makeAd(readWavMono(vo)) };
  const files = {};
  for (const [name, x] of Object.entries(ads)) { const f = path.join(OUT, `${name.replace(/ /g, '-')}.wav`); wav(f, x, x); files[name] = f; }
  for (const id of ['jfns3dvx', '4cbdjvb8', 'vp05dspr', 'natgeo-tr-2026-10-23']) files[id] = path.join(D, entryOf(id).file);
  // A regular stream at its usual level: the first minute of a session, which SEQ_REGULAR names
  // (its file name in the local dataset) the first time
  files['regular stream'] = path.join(OUT, 'regular-stream-60s.wav');
  if (!fs.existsSync(files['regular stream'])) {
    if (!process.env.SEQ_REGULAR) throw new Error('set SEQ_REGULAR to a session in the local dataset for the regular stream');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(D, entryOf(process.env.SEQ_REGULAR).file), '-t', '60', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', files['regular stream']]);
  }
  // A quiet video that leaves a long-term level (4cbdjvb8 has too little speech for one): NatGeo 10 dB down
  files['quiet NatGeo'] = path.join(OUT, 'natgeo-23oct-minus10.wav');
  if (!fs.existsSync(files['quiet NatGeo'])) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', files['natgeo-tr-2026-10-23'], '-af', 'volume=-10dB', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', files['quiet NatGeo']]);
  const SEQUENCES = {
    'NatGeo, music ad, NatGeo': [['NatGeo', 'natgeo-tr-2026-10-23'], ['ad', 'music ad'], ['NatGeo again', 'natgeo-tr-2026-10-23']],
    'NatGeo, voice-over ad, NatGeo': [['NatGeo', 'natgeo-tr-2026-10-23'], ['ad', 'voice-over ad'], ['NatGeo again', 'natgeo-tr-2026-10-23']],
    'jfns3dvx, 4cbdjvb8, vp05dspr (short talk clips, then one that opens mid-yell)': [['jfns3dvx', 'jfns3dvx'], ['4cbdjvb8', '4cbdjvb8'], ['vp05', 'vp05dspr']],
    'NatGeo, then a regular stream (a louder one)': [['NatGeo', 'natgeo-tr-2026-10-23'], ['the stream', 'regular stream']],
    'NatGeo 10 dB down, then a regular stream (a much louder one)': [['quiet NatGeo', 'quiet NatGeo'], ['the stream', 'regular stream']]
  };
  for (const name of Object.keys(SEQUENCES)) if (process.env.SEQ_ONLY && !new RegExp(process.env.SEQ_ONLY).test(name)) delete SEQUENCES[name];
  let current = '';
  const routes = { '/lib/dsp-worklet.js': (req, res) => { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); res.end(current); } };
  for (const [key, f] of Object.entries(files)) routes[`/clip/${encodeURIComponent(key)}`] = (req, res) => { res.writeHead(200, { 'Content-Type': f.endsWith('.ogg') ? 'audio/ogg' : 'audio/wav' }); fs.createReadStream(f).pipe(res); };
  const { server, port } = await startStaticServer(REPO, routes);
  const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-audio-output', '--mute-audio'] });
  const results = {};
  try {
    for (const [seqName, seq] of Object.entries(SEQUENCES)) {
      const lengths = seq.map(([, key]) => Math.round(duration(files[key]) * FS) / FS);
      const resetAt = [];
      let t = 0;
      lengths.forEach((len, k) => { if (k) resetAt.push(+t.toFixed(4)); t += GAP_S + len; });
      for (const [wname, wfile] of WORKLETS) {
        for (const preset of ['sleep', 'stream']) {
          current = fs.readFileSync(wfile, 'utf8')
            .replace(/\n/, `\nconst RESET_AT = ${JSON.stringify(resetAt)};\n`)
            .replace('  process(inputs, outputs) {\n', '  process(inputs, outputs) {\n    if (RESET_AT.length && currentTime >= RESET_AT[0] - 1e-9) { RESET_AT.shift(); this.resetAnalysis(); }\n');
          const ctxB = await browser.newContext();
          const page = await ctxB.newPage();
          await page.goto(`http://127.0.0.1:${port}/tests/engine-bench.html`);
          await page.waitForFunction(() => window.benchReady === true);
          const r = await page.evaluate(async ([urls, id, gap]) => {
            const decoded = [];
            for (const url of urls) decoded.push(await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(await (await fetch(url)).arrayBuffer()));
            const gapN = Math.round(gap * 48000);
            const total = decoded.reduce((s, d) => s + d.length + gapN, 0);
            const left = new Float32Array(total), right = new Float32Array(total), starts = [];
            let at = 0;
            for (const d of decoded) { at += gapN; starts.push(at / 48000); left.set(d.getChannelData(0), at); right.set(d.numberOfChannels > 1 ? d.getChannelData(1) : d.getChannelData(0), at); at += d.length; }
            const out = await bench.renderThroughEngine(left, right, bench.presetSettings(id));
            const b64 = x => { const i16 = new Int16Array(x.length); for (let i = 0; i < x.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))); let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
            return { starts, lengths: decoded.map(d => d.length / 48000), inL: b64(left), inR: b64(right), outL: b64(out.left), outR: b64(out.right),
              meters: out.meters.map(m => ({ time: m.time, guardDb: m.guardDb, shoutDb: m.shoutDb, baselineDb: m.baselineDb, believedDb: m.believedDb, startDb: m.startDb })) };
          }, [seq.map(([, key]) => `/clip/${encodeURIComponent(key)}`), preset, GAP_S]);
          await ctxB.close();
          const inL = fromB64(r.inL), inR = fromB64(r.inR), outL = fromB64(r.outL), outR = fromB64(r.outR);
          const tag = seqName.startsWith('NatGeo, music') ? 'natgeo-musicad-natgeo' : seqName.startsWith('NatGeo, voice') ? 'natgeo-voicead-natgeo'
            : seqName.startsWith('NatGeo, then') ? 'natgeo-stream' : seqName.startsWith('NatGeo 10 dB down') ? 'quietnatgeo-stream'
            : seqName.startsWith('jfns3dvx, 4cbdjvb8') ? 'clips-vp05' : null;
          if (tag && preset === 'sleep' && wname === 'today') wav(path.join(OUT, `${tag}-sleep-0-input.wav`), inL, inR);
          if (tag && WAV_PRESETS.includes(preset) && WAVS_FOR.includes(wname)) wav(path.join(OUT, `${tag}-${preset}-${wname}.wav`), outL, outR);
          results[`${seqName}|${wname}|${preset}`] = { r, inM: momentary(inL, inR), outM: momentary(outL, outR) };
          console.error(`done ${seqName} ${wname} ${preset}`);
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  const f1 = v => (Number.isFinite(v) ? (v > 0 ? '+' : '') + v.toFixed(1) : '-');
  const g1 = v => (Number.isFinite(v) ? v.toFixed(1) : '-');
  const HEAD = { sleep: 2.5, stream: 3 };
  for (const [seqName, seq] of Object.entries(SEQUENCES)) {
    console.log(`\n== ${seqName}`);
    for (const preset of ['sleep', 'stream']) {
      const today = results[`${seqName}|today|${preset}`];
      for (const [wname] of WORKLETS) {
        const { r, inM, outM } = results[`${seqName}|${wname}|${preset}`];
        const seg = (m, a, b) => m.filter(v => v.t >= a && v.t < b);
        const parts = seq.map(([name], k) => ({ name, a: r.starts[k], b: r.starts[k] + r.lengths[k] }));
        const held = p => r.meters.filter(m => m.time >= p.a && m.time < p.b && Number.isFinite(m.believedDb) && m.baselineDb - m.believedDb > HEAD[preset]).length / 20;
        const busy = p => { const x = r.meters.filter(m => m.time >= p.a && m.time < p.b); return Math.round(100 * x.filter(m => Math.min(m.guardDb, m.shoutDb || 0) < -1).length / Math.max(1, x.length)); };
        const startAt = p => { const m = r.meters.find(x => x.time >= p.a + 0.2 && Number.isFinite(x.startDb)); return m ? m.startDb : NaN; };
        let text = `  ${preset.padEnd(6)} ${wname.padEnd(7)}`;
        if (seq.length === 2) {
          // The stream after another video, against the same stream after it with today's engine
          const [first, next] = parts, tn = today.r.starts[1];
          const spans = [[0.4, 3], [3, 10], [10, 30], [30, 60]].map(([x, y]) => integrated(seg(outM, next.a + x, next.a + y)) - integrated(seg(today.outM, tn + x, tn + y)));
          text += ` ${first.name} ${g1(integrated(seg(outM, first.a + 0.4, first.b)))} LUFS, the stream ${g1(integrated(seg(outM, next.a + 0.4, next.b)))} (today ${g1(integrated(seg(today.outM, tn + 0.4, tn + next.b - next.a)))}); the stream started from ${g1(startAt(next))}, held ${g1(held(next))} s, cut ${busy(next)}%, against today ${spans.map(f1).join(' / ')} (0-3, 3-10, 10-30, 30-60 s)`;
        } else if (seq[1][0] === 'ad') {
          const [g1p, adp, g2p] = parts;
          const natI = integrated(seg(outM, g1p.a + 0.4, g1p.b)), adI = integrated(seg(outM, adp.a + 0.4, adp.b));
          const adFirst = Math.max(...seg(outM, adp.a + 0.4, adp.a + 3).map(v => v.lufs)) - natI;
          const spans = [[0.4, 10], [10, 30], [30, 70]].map(([x, y]) => integrated(seg(outM, g2p.a + x, g2p.a + y)) - integrated(seg(today.outM, today.r.starts[0] + x, today.r.starts[0] + y)));
          text += ` NatGeo ${g1(natI)} LUFS, the ad ${g1(adI)}: ${f1(adI - natI)} dB over NatGeo (its first 3 s at most ${f1(adFirst)}); ad started from ${g1(startAt(adp))}, held ${g1(held(adp))} s; NatGeo again held ${g1(held(g2p))} s, against its first play with today's engine ${spans.map(f1).join(' / ')} (0-10, 10-30, 30-70 s)`;
        } else {
          const v = parts[2];
          const near = t => VP05_LOUD.some(([x, y]) => t >= v.a + x - 1 && t <= v.a + y + 1.4);
          const talk = talking(seg(outM, v.a + 3, v.b).filter(x => !near(x.t)));
          const yells = VP05_LOUD.map(([x, y]) => Math.max(...seg(outM, v.a + x, v.a + y + 0.4).map(q => q.lufs)));
          text += ' ' + parts.map(p => `${p.name}: ${g1(integrated(seg(inM, p.a + 0.4, p.b)))}→${g1(integrated(seg(outM, p.a + 0.4, p.b)))} LUFS, cut ${busy(p)}%, held ${g1(held(p))} s, started from ${g1(startAt(p))}`).join(' | ') +
            ` | vp05's yells ${yells.map(g1).join(' ')} LUFS (over its talk ${yells.map(y => f1(y - talk)).join(' ')})`;
        }
        console.log(text);
      }
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
