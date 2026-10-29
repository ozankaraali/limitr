// Renders dataset clips through the real engine chain (tests/engine-bench.html, silent GPU-free
// Chromium) with today's worklet or a variant, and optional preset overrides, for listening.
// RENDER_CLIPS: dataset IDs; RENDER_VERSIONS: name=worklet[+setting:value...], where worklet is
// "today" or a variant's name (w-NAME.js); RENDER_PRESETS: presets (Sleep alone by default).
// Writes OUT/ID-PRESET-NAME.wav, and OUT/ID-PRESET-0-input.wav for the input.
// Run: RENDER_CLIPS=t5tkhfzr RENDER_VERSIONS=today=today,calm=calm10u3t node variants/render.js . variants/listen
const path = require('path'), fs = require('fs');
const [REPO, OUT] = process.argv.slice(2).map(p => path.resolve(p));
const { chromium } = require(path.join(REPO, 'node_modules/playwright'));
const { startStaticServer } = require(path.join(REPO, 'tests/static-server'));
const { DATASET } = require(path.join(REPO, 'tools/dataset-file'));
const ENTRIES = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
const FS = 48000;
const clips = (process.env.RENDER_CLIPS || '').split(',').filter(Boolean);
const presets = (process.env.RENDER_PRESETS || 'sleep').split(',');
const versions = (process.env.RENDER_VERSIONS || 'today=today').split(',').map(v => {
  const [name, spec] = v.split('=');
  const [worklet, ...sets] = spec.split('+');
  const overrides = Object.fromEntries(sets.map(s => { const [k, x] = s.split(':'); return [k, Number.isNaN(Number(x)) ? x : Number(x)]; }));
  return { name, file: worklet === 'today' ? path.join(REPO, 'lib/dsp-worklet.js') : path.join(__dirname, `w-${worklet}.js`), overrides };
});

function wav(file, l, r) {
  const n = l.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(FS, 24); buf.writeUInt32LE(FS * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767))), 44 + i * 4); buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767))), 46 + i * 4); }
  fs.writeFileSync(file, buf);
}
const fromB64 = s => { const b = Buffer.from(s, 'base64'); const i16 = new Int16Array(b.buffer, b.byteOffset, b.length / 2); return Float32Array.from(i16, v => v / 32768); };

(async () => {
  let current = '';
  const routes = { '/lib/dsp-worklet.js': (req, res) => { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); res.end(current); } };
  for (const id of clips) {
    const e = ENTRIES.find(x => x.file.includes(id));
    if (!e) throw new Error(`no dataset clip ${id}`);
    const f = path.join(REPO, 'tests/fixtures/recordings/dataset', e.file);
    routes[`/clip/${encodeURIComponent(id)}`] = (req, res) => { res.writeHead(200, { 'Content-Type': f.endsWith('.ogg') ? 'audio/ogg' : 'audio/wav' }); fs.createReadStream(f).pipe(res); };
  }
  const { server, port } = await startStaticServer(REPO, routes);
  const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-audio-output', '--mute-audio'] });
  try {
    for (const id of clips) for (const preset of presets) for (const [k, v] of versions.entries()) {
      current = fs.readFileSync(v.file, 'utf8');
      const ctxB = await browser.newContext();
      const page = await ctxB.newPage();
      await page.goto(`http://127.0.0.1:${port}/tests/engine-bench.html`);
      await page.waitForFunction(() => window.benchReady === true);
      const r = await page.evaluate(async ([url, p, overrides]) => {
        const d = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(await (await fetch(url)).arrayBuffer());
        const left = d.getChannelData(0).slice(), right = (d.numberOfChannels > 1 ? d.getChannelData(1) : d.getChannelData(0)).slice();
        const out = await bench.renderThroughEngine(left, right, bench.presetSettings(p, overrides));
        const b64 = x => { const i16 = new Int16Array(x.length); for (let i = 0; i < x.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))); let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
        return { inL: b64(left), inR: b64(right), outL: b64(out.left), outR: b64(out.right) };
      }, [`/clip/${encodeURIComponent(id)}`, preset, v.overrides]);
      await ctxB.close();
      if (k === 0) wav(path.join(OUT, `${id}-${preset}-0-input.wav`), fromB64(r.inL), fromB64(r.inR));
      wav(path.join(OUT, `${id}-${preset}-${v.name}.wav`), fromB64(r.outL), fromB64(r.outR));
      console.error(`rendered ${id} ${preset} ${v.name}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
