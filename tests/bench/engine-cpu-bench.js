#!/usr/bin/env node
// What limiting costs on the audio thread in the browser: a real recording rendered offline through
// the real engine (tests/engine-bench.html: LimitrEngine with its worklet, filters, compressor and
// hiss) in a silent, GPU-free Chromium, for each preset, with Limitr switched off (`passthrough`:
// the engine bypassed, as on a page while Limitr is off) and without Limitr at all (`bare`: the
// recording straight to the output, the price of the audio graph itself). Offline rendering runs
// the graph as fast as it can on one thread, so render time per second of audio is the CPU the
// graph takes while listening; ×100 it is the share of one core in real time. The browser's CPU
// time over each render (from ps; it also counts setting the render up, about the same for every
// render) is reported too: on a busy machine it doesn't grow while the render waits for a core.
// Medians of --runs; copies of the worklet (--worklet=FILE, repeatable; the default is this
// tree's) take turns, so a busy machine slows them all alike. The recording is decoded by ffmpeg,
// as in tests/bench/worklet-bench.js, so both get the same samples and their output fingerprints
// can be compared.
// Run: node tests/bench/engine-cpu-bench.js [--worklet=FILE ...] [--file=REC] [--minutes=10]
//        [--runs=5] [--presets=bare,passthrough,off,gentle,stream,movie,sleep,tv90s]
//   --file  any recording ffmpeg reads (default: the first one in $LIMITR_RECORDINGS/dataset)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./common');
const { startStaticServer } = require('../static-server');

const FS = 48000;

function defaultRecording() {
  const dir = path.join(process.env.LIMITR_RECORDINGS || path.join(B.ROOT, 'tests/fixtures/recordings'), 'dataset');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.ogg')).sort() : [];
  return files.length ? path.join(dir, files[0]) : null;
}

// `seconds` of stereo float PCM at 48 kHz (the recording looped if shorter), planar: all of the
// left channel, then all of the right
function decodePlanar(file, seconds) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-t', String(seconds), '-f', 'f32le', '-ac', '2', '-ar', String(FS), '-'],
    { maxBuffer: 2 ** 31 - 1 });
  const interleaved = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
  const decoded = interleaved.length >> 1;
  const n = Math.round(seconds * FS);
  const planar = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) {
    const j = i % decoded;
    planar[i] = interleaved[2 * j];
    planar[n + i] = interleaved[2 * j + 1];
  }
  return { planar, decodedSeconds: decoded / FS };
}

(async () => {
  const files = (B.args('worklet').length ? B.args('worklet') : [path.join(B.ROOT, 'lib/dsp-worklet.js')]).map(f => path.resolve(f));
  const recording = B.arg('file', defaultRecording());
  if (!recording) throw new Error('No recording: pass --file=REC or set LIMITR_RECORDINGS');
  const minutes = Number(B.arg('minutes', 10));
  const runs = Number(B.arg('runs', 5));
  const presets = B.arg('presets', 'bare,passthrough,off,gentle,stream,movie,sleep,tv90s').split(',');
  const variants = files.map(file => ({ file, label: files.length > 1 ? path.basename(file) : 'worklet' }));

  const { planar, decodedSeconds } = decodePlanar(recording, minutes * 60);
  console.log(`Recording: ${path.basename(recording)} (${decodedSeconds.toFixed(0)} s, looped to ${minutes} min)`);
  const pcm = Buffer.from(planar.buffer);
  let current = variants[0].file;
  const { server, port } = await startStaticServer(B.ROOT, {
    '/bench/pcm': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(pcm);
    },
    // The worklet copy whose turn it is; never cached, so the next context loads the next copy
    '/lib/dsp-worklet.js': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(current));
    }
  });
  const silence = B.watchSilence();
  // B.launch: headless, --disable-gpu and --disable-audio-output; the profile is ours, to find the
  // browser's processes for their CPU time
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-engine-cpu-'));
  const { context, close } = await B.launch(null, { profile, extraArgs: ['--mute-audio'] });
  const results = {};
  const fingerprints = {};
  try {
    const page = await context.newPage();
    page.on('pageerror', e => console.log('  page error:', e.message));
    await page.goto(`http://127.0.0.1:${port}/tests/engine-bench.html`);
    await page.waitForFunction(() => window.benchReady === true);
    console.log(await page.evaluate(() => navigator.userAgent));
    await page.evaluate(async () => {
      const buffer = await (await fetch('/bench/pcm')).arrayBuffer();
      const n = buffer.byteLength / 8;
      window.pcm = [new Float32Array(buffer, 0, n), new Float32Array(buffer, n * 4, n)];
    });

    const render = id => page.evaluate(async id => {
      const [left, right] = window.pcm;
      const bare = async () => {
        const ctx = new OfflineAudioContext(2, left.length, 48000);
        const buffer = ctx.createBuffer(2, left.length, 48000);
        buffer.copyToChannel(left, 0);
        buffer.copyToChannel(right, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
        const start = performance.now();
        const rendered = await ctx.startRendering();
        return { left: rendered.getChannelData(0), right: rendered.getChannelData(1), meters: [], renderMs: performance.now() - start };
      };
      const passthrough = id === 'passthrough';
      const out = id === 'bare' ? await bare()
        : await bench.renderThroughEngine(left, right, bench.presetSettings(passthrough ? 'off' : id), { enabled: !passthrough });
      window.lastOut = out;
      return { renderMs: out.renderMs, seconds: left.length / 48000 };
    }, id);

    const fingerprint = () => page.evaluate(() => {
      const out = window.lastOut;
      window.lastOut = null;
      let energy = 0;
      let peak = 0;
      for (const ch of [out.left, out.right]) {
        for (let i = 0; i < ch.length; i++) {
          const v = ch[i];
          energy += v * v;
          const a = v < 0 ? -v : v;
          if (a > peak) peak = a;
        }
      }
      const last = out.meters[out.meters.length - 1] || {};
      return {
        energyDb: +(10 * Math.log10(energy / (2 * out.left.length) + 1e-30)).toFixed(4),
        peakDb: +(20 * Math.log10(peak + 1e-30)).toFixed(4),
        spikes: last.spikes,
        normal: last.baselineDb === undefined ? null : +last.baselineDb.toFixed(3),
        meters: out.meters.length
      };
    });

    // Warm-up: compile the worklet and the page's code paths once
    current = variants[0].file;
    await page.evaluate(() => { window.fullPcm = window.pcm; window.pcm = window.pcm.map(c => c.subarray(0, 48000 * 20)); });
    await render('stream');
    await page.evaluate(() => { window.pcm = window.fullPcm; window.lastOut = null; });

    for (let run = 0; run < runs; run++) {
      for (const id of presets) {
        for (const v of variants) {
          current = v.file;
          const cpuBefore = B.browserCpuMs(profile);
          const r = await render(id);
          const cpuMs = B.browserCpuMs(profile) - cpuBefore;
          const msPerS = r.renderMs / r.seconds;
          B.record(results, `${id.padEnd(11)} render ms per s of audio`, v.label, msPerS);
          B.record(results, `${id.padEnd(11)} % of one core in real time`, v.label, msPerS / 10);
          B.record(results, `${id.padEnd(11)} browser CPU ms per s (ps)`, v.label, cpuMs / r.seconds);
          fingerprints[`${id} ${v.label}`] = await fingerprint();
          process.stdout.write('.');
        }
      }
    }
    console.log('');
  } finally {
    await close();
    fs.rmSync(profile, { recursive: true, force: true });
    server.close();
    silence.stop();
  }

  B.report(`Offline render of ${minutes} min through the engine, Chromium (medians of ${runs} runs)`, results);
  // What Limitr adds to the bare graph
  if (presets.includes('bare')) {
    console.log('\nLimitr\'s cost over the bare graph (medians), % of one core in real time');
    for (const v of variants) {
      const base = B.median(results[`${'bare'.padEnd(11)} % of one core in real time`][v.label]);
      const cells = presets.filter(id => id !== 'bare')
        .map(id => `${id} ${(B.median(results[`${id.padEnd(11)} % of one core in real time`][v.label]) - base).toFixed(3)}`);
      console.log(`  ${v.label}: ${cells.join(', ')}`);
    }
  }
  console.log('\nEvery run, render ms per s of audio (the spread shows how busy the machine was)');
  for (const [metric, byLabel] of Object.entries(results)) {
    if (!metric.endsWith('render ms per s of audio')) continue;
    for (const [lbl, samples] of Object.entries(byLabel)) console.log(`  ${metric.slice(0, 11)} ${lbl.padEnd(22)} ${samples.map(v => v.toFixed(2)).join('  ')}`);
  }
  console.log('\nOutput fingerprints (last run)');
  for (const [key, f] of Object.entries(fingerprints)) console.log(`  ${key.padEnd(30)} ${JSON.stringify(f)}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
