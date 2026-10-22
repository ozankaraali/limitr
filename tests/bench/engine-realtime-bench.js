#!/usr/bin/env node
// What a page with Limitr costs in real time while the popup is closed: a real AudioContext in a
// silent, GPU-free Chromium (fake audio output device) plays a recording looped through the engine.
// For --seconds the CPU of the whole browser is read from ps (no tracing running); for another
// --seconds a browser-wide Chrome trace splits the page's CPU into its main thread (meter messages
// land there) and its other threads (the audio thread runs the worklet). Tracing adds its own
// cost to every task, so its numbers only compare with each other.
// States: `playing`; `paused` (zeros through the engine, like a paused <video> it is attached to);
// `off` (Limitr switched off: the engine bypassed); `none` (no Limitr: the audio straight to the
// output). Medians of --rounds; copies of the worklet (--worklet=FILE, repeatable) take turns.
// Run: node tests/bench/engine-realtime-bench.js [--worklet=FILE ...] [--file=REC] [--seconds=20]
//        [--rounds=3] [--preset=stream] [--states=playing,paused,off,none] [--threads]

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./common');
const T = require('./trace');
const { startStaticServer } = require('../static-server');

const FS = 48000;
const LOOP_SECONDS = 30;

function defaultRecording() {
  const dir = path.join(process.env.LIMITR_RECORDINGS || path.join(B.ROOT, 'tests/fixtures/recordings'), 'dataset');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.ogg')).sort() : [];
  return files.length ? path.join(dir, files[0]) : null;
}

// LOOP_SECONDS of stereo PCM from 60 s into the recording, planar
function decodePlanar(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', '60', '-i', file, '-t', String(LOOP_SECONDS), '-f', 'f32le', '-ac', '2', '-ar', String(FS), '-'],
    { maxBuffer: 2 ** 30 });
  const interleaved = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
  const n = interleaved.length >> 1;
  const planar = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) {
    planar[i] = interleaved[2 * i];
    planar[n + i] = interleaved[2 * i + 1];
  }
  return planar;
}

// Runs in the bench page: the engine in a real AudioContext, fed the looped recording (or zeros)
async function startPlayback({ state, preset }) {
  const [left, right] = window.pcm;
  const ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
  await ctx.resume();
  const buffer = ctx.createBuffer(2, left.length, 48000);
  if (state !== 'paused') {
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  if (state === 'none') {
    source.connect(ctx.destination);
  } else {
    const engine = new LimitrEngine(ctx, {
      loadModule: p => ctx.audioWorklet.addModule('../' + p),
      loadBinary: p => fetch('../' + p).then(r => r.arrayBuffer())
    });
    engine.update(bench.presetSettings(preset), state !== 'off');
    await engine.init();
    source.connect(engine.input);
    engine.output.connect(ctx.destination);
    window.engine = engine;
  }
  source.start();
  window.ctx = ctx;
  return ctx.state;
}

(async () => {
  const files = (B.args('worklet').length ? B.args('worklet') : [path.join(B.ROOT, 'lib/dsp-worklet.js')]).map(f => path.resolve(f));
  const recording = B.arg('file', defaultRecording());
  if (!recording) throw new Error('No recording: pass --file=REC or set LIMITR_RECORDINGS');
  const seconds = Number(B.arg('seconds', 20));
  const rounds = Number(B.arg('rounds', 3));
  const preset = B.arg('preset', 'stream');
  const states = B.arg('states', 'playing,paused,off,none').split(',');
  const variants = files.map(file => ({ file, label: files.length > 1 ? path.basename(file) : 'worklet' }));

  const pcm = Buffer.from(decodePlanar(recording).buffer);
  let current = variants[0].file;
  const { server, port } = await startStaticServer(B.ROOT, {
    '/bench/pcm': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(pcm);
    },
    '/lib/dsp-worklet.js': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(current));
    }
  });
  console.log(`Recording: ${path.basename(recording)} (${LOOP_SECONDS} s looped), preset ${preset}, ${seconds} s per state`);
  const results = {};
  const silence = B.watchSilence();
  let debugPort = 9700 + Math.floor(Math.random() * 200);
  try {
    for (let round = 0; round < rounds; round++) {
      for (const st of states) {
        for (const v of (st === 'none' ? variants.slice(0, 1) : variants)) {
          current = v.file;
          debugPort++;
          const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-realtime-'));
          const { context, close } = await B.launch(null, {
            profile,
            extraArgs: [`--remote-debugging-port=${debugPort}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio']
          });
          const { browser, session } = await T.connect(debugPort);
          try {
            const page = await context.newPage();
            await page.goto(`http://127.0.0.1:${port}/tests/engine-bench.html`);
            await page.waitForFunction(() => window.benchReady === true);
            await page.evaluate(async () => {
              const buf = await (await fetch('/bench/pcm')).arrayBuffer();
              const n = buf.byteLength / 8;
              window.pcm = [new Float32Array(buf, 0, n), new Float32Array(buf, n * 4, n)];
            });
            const ctxState = await page.evaluate(startPlayback, { state: st, preset });
            if (ctxState !== 'running') throw new Error(`AudioContext ${ctxState}`);
            await B.sleep(2000);
            const lbl = st === 'none' ? 'no Limitr' : v.label;
            const cpuBefore = B.browserCpuMs(profile);
            const wallBefore = Date.now();
            await B.sleep(seconds * 1000);
            const cpuMs = B.browserCpuMs(profile) - cpuBefore;
            B.record(results, `${st.padEnd(8)} browser CPU ms/s (ps, all processes)`, lbl, cpuMs / ((Date.now() - wallBefore) / 1000));
            await T.start(session);
            await B.sleep(seconds * 1000);
            const events = await T.stop(session);
            const threads = T.busyByThread(events);
            const renderer = threads.filter(t => t.process === 'Renderer');
            const main = renderer.filter(t => t.thread === 'CrRendererMain');
            const others = renderer.filter(t => t.thread !== 'CrRendererMain');
            const sum = list => list.reduce((s, t) => s + t.ms, 0);
            B.record(results, `${st.padEnd(8)} traced: page main thread CPU ms/s`, lbl, sum(main) / seconds);
            B.record(results, `${st.padEnd(8)} traced: page other threads CPU ms/s`, lbl, sum(others) / seconds);
            if (round === 0 && process.argv.includes('--threads')) {
              console.log(`\n[${st} ${lbl}] busiest renderer threads over ${seconds} s`);
              renderer.slice(0, 8).forEach(t => console.log(`  ${t.ms.toFixed(1).padStart(8)} ms  ${t.thread}`));
            }
          } finally {
            await browser.close().catch(() => {});
            await close();
            fs.rmSync(profile, { recursive: true, force: true });
          }
          process.stdout.write('.');
        }
      }
    }
  } finally {
    server.close();
    silence.stop();
  }
  B.report(`Real time, popup closed (medians of ${rounds} rounds of ${seconds} s)`, results);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
