#!/usr/bin/env node
// What the limiting engine's worklet (lib/dsp-worklet.js) costs on the audio thread, measured in
// Node: the worklet is fed 128-frame blocks of a real recording (decoded by ffmpeg), the way the
// browser's audio thread calls it (frozen arrays of Float32Arrays), with each preset's parameters.
// Nothing is played and no browser is started.
// Reports, per preset (medians of --runs): process() time per second of audio (the same as a
// share of one core while listening in real time), the slowest blocks (each one has to finish
// within 2.67 ms, together with everything else on the page's audio thread), and garbage
// collections during the run (an allocation in process() ends up as a pause on the audio thread).
// Compare copies of the worklet with --worklet=FILE (repeatable; the default is this tree's);
// runs interleave them so a busy machine slows them all alike.
// Run: node tests/bench/worklet-bench.js [--worklet=FILE ...] [--file=REC] [--minutes=10]
//        [--runs=5] [--presets=off,gentle,stream,movie,sleep,tv90s] [--profile] [--alloc]
//   --file     any recording ffmpeg reads (default: the first one in $LIMITR_RECORDINGS/dataset);
//              it is looped to fill --minutes, so the long-term statistics reach their full size
//   --profile  V8 CPU profile of the runs: self time per line of each worklet
//   --alloc    V8 sampling heap profile of the runs: what each worklet allocates, per function
//   --exact    instead of timing, run every --worklet copy next to the first on the same audio and
//              count output samples and meter readings that differ (a pure speed fix changes none)
// Each worklet's output fingerprint (energy, peak, spikes caught, last normal) is printed too,
// to check against tests/bench/engine-cpu-bench.js that the browser does the same work.
// Node doesn't flush denormal numbers to zero as Chrome's audio thread does, so stretches of
// digital silence (where filters and envelopes decay into them) cost several times more here.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const inspector = require('inspector');
const { execFileSync } = require('child_process');
const { performance, PerformanceObserver } = require('perf_hooks');
const B = require('./common');

require('../../lib/settings.js');
require('../../lib/engine.js');
const { LimitrSettings, LimitrEngine } = globalThis;

const FS = 48000;
const QUANTUM = 128;
const QUANTUM_MS = QUANTUM / FS * 1000;

function defaultRecording() {
  const dir = path.join(process.env.LIMITR_RECORDINGS || path.join(B.ROOT, 'tests/fixtures/recordings'), 'dataset');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.ogg')).sort() : [];
  return files.length ? path.join(dir, files[0]) : null;
}

// Stereo float PCM at 48 kHz, planar, decoded by ffmpeg
function decode(file, seconds) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-t', String(seconds), '-f', 'f32le', '-ac', '2', '-ar', String(FS), '-'],
    { maxBuffer: 2 ** 31 - 1 });
  const interleaved = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
  const n = interleaved.length >> 1;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    left[i] = interleaved[2 * i];
    right[i] = interleaved[2 * i + 1];
  }
  return { left, right };
}

// The AudioWorklet globals the worklet uses, on this realm's global object (a vm context's global
// goes through interceptors, which would slow every Math lookup and skew the profile)
const clock = { frame: 0 };
globalThis.sampleRate = FS;
Object.defineProperty(globalThis, 'currentTime', { get: () => clock.frame / FS, configurable: true });
globalThis.AudioWorkletProcessor = class {
  constructor() {
    const port = { onmessage: null, messages: 0, lastMessage: null };
    port.postMessage = message => {
      port.lastMessage = message;
      port.messages++;
    };
    this.port = port;
  }
};

// Each copy of the worklet gets its own function scope, so their top-level constants don't clash
function loadWorklet(file) {
  const source = fs.readFileSync(file, 'utf8');
  const wrapped = vm.runInThisContext(`(function (registerProcessor) {${source}\n})`, { filename: file });
  let Processor = null;
  wrapped((name, cls) => { Processor = cls; });
  return Processor;
}

// What LimitrEngine sends the worklet for a preset (volume 0, no tab volume)
function dspParams(id) {
  const settings = LimitrSettings.normalize({ ...LimitrSettings.applyPreset({ volume: 0 }, id) });
  const params = LimitrEngine.prototype.dspParams.call({ tabVolumeDb: 0, postGainDb: LimitrEngine.prototype.postGainDb }, settings);
  return { params, hiss: settings.noiseLevel };
}

// Quiet brown noise standing in for the tape hiss on the worklet's second input (seeded, so every
// run and every worklet copy gets the same)
function hissBuffer(level) {
  const data = new Float32Array(FS * 2);
  let seed = 12345;
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    last = (last + 0.02 * (seed / 2147483648 - 1)) / 1.02;
    data[i] = last * 3.5 * level;
  }
  return data;
}

// Every copy of the worklet on the same blocks: how many output samples and meter readings differ
// from the first copy's, and by how much at most
function compareOnce(variants, preset, audio, totalFrames) {
  const { params, hiss } = dspParams(preset);
  const noise = hiss > 0 ? hissBuffer(hiss) : null;
  const inL = new Float32Array(QUANTUM);
  const inR = new Float32Array(QUANTUM);
  const noiseIn = new Float32Array(QUANTUM);
  const inputs = Object.freeze([Object.freeze([inL, inR]), Object.freeze(noise ? [noiseIn] : [])]);
  const runs = variants.map(v => ({
    processor: new v.Processor({ processorOptions: { params: { ...params } } }),
    outputs: Object.freeze([Object.freeze([new Float32Array(QUANTUM), new Float32Array(QUANTUM)])]),
    seen: 0,
    samples: 0,
    maxDiff: 0,
    messages: 0,
    maxMeterDiff: 0
  }));
  const { left, right } = audio;
  let pos = 0;
  let noisePos = 0;
  const blocks = Math.floor(totalFrames / QUANTUM);
  for (let b = 0; b < blocks; b++) {
    inL.set(left.subarray(pos, pos + QUANTUM));
    inR.set(right.subarray(pos, pos + QUANTUM));
    if (noise) {
      noiseIn.set(noise.subarray(noisePos, noisePos + QUANTUM));
      noisePos = noisePos + QUANTUM >= noise.length ? 0 : noisePos + QUANTUM;
    }
    pos = pos + 2 * QUANTUM > left.length ? 0 : pos + QUANTUM;
    clock.frame = b * QUANTUM;
    for (const r of runs) r.processor.process(inputs, r.outputs);
    const ref = runs[0];
    for (const r of runs.slice(1)) {
      for (let ch = 0; ch < 2; ch++) {
        const a = ref.outputs[0][ch];
        const o = r.outputs[0][ch];
        for (let i = 0; i < QUANTUM; i++) {
          if (a[i] !== o[i]) {
            r.samples++;
            r.maxDiff = Math.max(r.maxDiff, Math.abs(a[i] - o[i]));
          }
        }
      }
      if (r.processor.port.messages !== ref.processor.port.messages) throw new Error(`${preset}: meter messages out of step`);
      if (r.processor.port.messages !== r.seen) {
        r.seen = r.processor.port.messages;
        const m = ref.processor.port.lastMessage;
        const n = r.processor.port.lastMessage;
        let differs = false;
        for (const key of Object.keys(m)) {
          if (m[key] === n[key] || (Number.isNaN(m[key]) && Number.isNaN(n[key]))) continue;
          differs = true;
          if (typeof m[key] === 'number' && typeof n[key] === 'number') r.maxMeterDiff = Math.max(r.maxMeterDiff, Math.abs(m[key] - n[key]));
          else r.maxMeterDiff = Infinity;
        }
        if (differs) r.messages++;
      }
    }
  }
  return runs.slice(1).map((r, i) => ({ label: variants[i + 1].label, samples: r.samples, of: blocks * QUANTUM * 2, maxDiff: r.maxDiff, messages: r.messages, ofMessages: r.seen, maxMeterDiff: r.maxMeterDiff }));
}

function runOnce(Processor, preset, audio, totalFrames) {
  const { params, hiss } = dspParams(preset);
  const processor = new Processor({ processorOptions: { params } });
  const inL = new Float32Array(QUANTUM);
  const inR = new Float32Array(QUANTUM);
  const outL = new Float32Array(QUANTUM);
  const outR = new Float32Array(QUANTUM);
  const noise = hiss > 0 ? hissBuffer(hiss) : null;
  const noiseIn = new Float32Array(QUANTUM);
  // Frozen, as the browser passes them (FrozenArray in the spec): indexing them is slower, and
  // the worklet's cost depends on how often it does
  const inputs = Object.freeze([Object.freeze([inL, inR]), Object.freeze(noise ? [noiseIn] : [])]);
  const outputs = Object.freeze([Object.freeze([outL, outR])]);
  const blocks = Math.floor(totalFrames / QUANTUM);
  const times = new Float64Array(blocks);
  const { left, right } = audio;
  const length = left.length;
  let energy = 0;
  let peak = 0;
  let pos = 0;
  let noisePos = 0;
  const cpu0 = process.cpuUsage();
  const start = performance.now();
  for (let b = 0; b < blocks; b++) {
    for (let i = 0; i < QUANTUM; i++) {
      inL[i] = left[pos + i];
      inR[i] = right[pos + i];
    }
    if (noise) {
      for (let i = 0; i < QUANTUM; i++) noiseIn[i] = noise[noisePos + i];
      noisePos = noisePos + QUANTUM >= noise.length ? 0 : noisePos + QUANTUM;
    }
    pos = pos + 2 * QUANTUM > length ? 0 : pos + QUANTUM;
    clock.frame = b * QUANTUM;
    const t0 = performance.now();
    processor.process(inputs, outputs);
    times[b] = performance.now() - t0;
    for (let i = 0; i < QUANTUM; i++) {
      const l = outL[i];
      const r = outR[i];
      energy += l * l + r * r;
      const a = Math.max(l < 0 ? -l : l, r < 0 ? -r : r);
      if (a > peak) peak = a;
    }
  }
  const wallMs = performance.now() - start;
  const cpu = process.cpuUsage(cpu0);
  let sum = 0;
  for (let b = 0; b < blocks; b++) sum += times[b];
  const sorted = Float64Array.from(times).sort();
  const seconds = blocks * QUANTUM / FS;
  const meters = processor.port.lastMessage || {};
  return {
    seconds,
    start,
    end: start + wallMs,
    processMsPerS: sum / seconds,
    cpuMsPerS: (cpu.user + cpu.system) / 1000 / seconds,
    p99Us: sorted[Math.floor(0.99 * blocks)] * 1000,
    p999Us: sorted[Math.floor(0.999 * blocks)] * 1000,
    maxUs: sorted[blocks - 1] * 1000,
    over1ms: sorted.filter(t => t > 1).length,
    messages: processor.port.messages,
    fingerprint: {
      energyDb: +(10 * Math.log10(energy / (2 * blocks * QUANTUM) + 1e-30)).toFixed(4),
      peakDb: +(20 * Math.log10(peak + 1e-30)).toFixed(4),
      spikes: meters.spikes,
      normal: meters.baselineDb === undefined ? null : +meters.baselineDb.toFixed(3)
    }
  };
}

// ---------- profiles: time and allocations per line of a worklet ----------
function post(session, method, params = {}) {
  return new Promise((resolve, reject) => session.post(method, params, (err, result) => (err ? reject(err) : resolve(result))));
}

function lineReport(title, nodes, files, valueOf, unit) {
  console.log(`\n${title}`);
  for (const file of files) {
    const byLine = new Map();
    const byFunction = new Map();
    let total = 0;
    let all = 0;
    for (const node of nodes) {
      const value = valueOf(node);
      all += value.total;
      if (node.callFrame.url !== file && node.callFrame.url !== `file://${file}`) continue;
      total += value.total;
      const fn = node.callFrame.functionName || '(anonymous)';
      byFunction.set(fn, (byFunction.get(fn) || 0) + value.total);
      for (const [line, v] of value.lines) byLine.set(line, (byLine.get(line) || 0) + v);
    }
    console.log(`  ${path.relative(B.ROOT, file) || file}: ${unit(total)} self (${(100 * total / all).toFixed(1)}% of everything sampled)`);
    console.log('  by function:');
    [...byFunction.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .forEach(([fn, v]) => console.log(`    ${(100 * v / total).toFixed(1).padStart(5)}%  ${fn}`));
    if (!byLine.size) continue;
    console.log('  hottest lines:');
    const source = fs.readFileSync(file, 'utf8').split('\n');
    [...byLine.entries()].sort((a, b) => b[1] - a[1]).filter(([, v]) => v / total >= 0.003)
      .forEach(([line, v]) => console.log(`    ${(100 * v / total).toFixed(1).padStart(5)}%  ${String(line).padStart(4)}  ${(source[line - 1] || '').trim().slice(0, 90)}`));
  }
}

(async () => {
  const files = (B.args('worklet').length ? B.args('worklet') : [path.join(B.ROOT, 'lib/dsp-worklet.js')]).map(f => path.resolve(f));
  const recording = B.arg('file', defaultRecording());
  if (!recording) throw new Error('No recording: pass --file=REC or set LIMITR_RECORDINGS');
  const minutes = Number(B.arg('minutes', 10));
  const runs = Number(B.arg('runs', 5));
  const presets = B.arg('presets', 'off,gentle,stream,movie,sleep,tv90s').split(',');
  const profile = process.argv.includes('--profile');
  const alloc = process.argv.includes('--alloc');

  const audio = decode(recording, minutes * 60);
  const totalFrames = Math.round(minutes * 60 * FS);
  console.log(`Recording: ${path.basename(recording)} (${(audio.left.length / FS).toFixed(0)} s, looped to ${minutes} min)`);
  console.log(`Node ${process.version}, ${require('os').cpus()[0].model}`);
  const variants = files.map(file => ({ file, label: files.length > 1 ? path.basename(file) : 'worklet', Processor: loadWorklet(file) }));

  if (process.argv.includes('--exact')) {
    if (variants.length < 2) throw new Error('--exact compares worklet copies: pass --worklet=FILE at least twice');
    console.log(`\nOutput of each copy against ${variants[0].label}, on ${minutes} min of audio`);
    for (const preset of presets) {
      for (const d of compareOnce(variants, preset, audio, totalFrames)) {
        console.log(`  ${preset.padEnd(7)} ${d.label}: ${d.samples} of ${d.of} samples differ (max ${d.maxDiff.toExponential(2)}), ` +
          `${d.messages} of ${d.ofMessages} meter readings differ (max ${d.maxMeterDiff.toExponential(2)})`);
      }
    }
    return;
  }

  // Garbage collections during each run
  const gcs = [];
  const observer = new PerformanceObserver(list => gcs.push(...list.getEntries()));
  observer.observe({ entryTypes: ['gc'] });

  let session = null;
  if (profile || alloc) {
    session = new inspector.Session();
    session.connect();
    if (profile) {
      await post(session, 'Profiler.enable');
      await post(session, 'Profiler.setSamplingInterval', { interval: 50 });
      await post(session, 'Profiler.start');
    }
    if (alloc) {
      await post(session, 'HeapProfiler.enable');
      await post(session, 'HeapProfiler.startSampling', {
        samplingInterval: 64, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true
      });
    }
  }

  // One short warm-up per worklet, so every measured run uses optimized code
  for (const v of variants) runOnce(v.Processor, 'stream', audio, FS * 20);

  const results = {};
  const fingerprints = {};
  const runsByKey = {};
  for (let run = 0; run < runs; run++) {
    for (const preset of presets) {
      for (const v of variants) {
        const r = runOnce(v.Processor, preset, audio, totalFrames);
        const key = `${preset} ${v.label}`;
        (runsByKey[key] = runsByKey[key] || []).push(r);
        fingerprints[key] = r.fingerprint;
        process.stdout.write('.');
      }
    }
  }
  console.log('');
  await new Promise(resolve => setImmediate(resolve)); // deliver the GC entries
  observer.disconnect();

  for (const [key, list] of Object.entries(runsByKey)) {
    const [preset, label] = key.split(' ');
    const metric = name => `${preset.padEnd(7)} ${name}`;
    for (const r of list) {
      const during = gcs.filter(g => g.startTime >= r.start && g.startTime <= r.end);
      B.record(results, metric('process() ms per s of audio'), label, r.processMsPerS);
      B.record(results, metric('% of one core in real time'), label, r.processMsPerS / 10);
      B.record(results, metric('CPU ms per s (whole loop)'), label, r.cpuMsPerS);
      B.record(results, metric('slowest 1% of blocks (µs)'), label, r.p99Us);
      B.record(results, metric('slowest 0.1% of blocks (µs)'), label, r.p999Us);
      B.record(results, metric('slowest block (µs)'), label, r.maxUs);
      B.record(results, metric(`blocks over 1 ms (of ${Math.floor(totalFrames / QUANTUM)})`), label, r.over1ms);
      B.record(results, metric('GCs per minute of audio'), label, during.length / (r.seconds / 60));
      B.record(results, metric('meter messages per s'), label, r.messages / r.seconds);
    }
  }
  B.report(`Worklet cost on ${minutes} min of audio (medians of ${runs} runs; one block = ${QUANTUM_MS.toFixed(2)} ms of audio)`, results);

  console.log('\nOutput fingerprints (last run)');
  for (const [key, f] of Object.entries(fingerprints)) console.log(`  ${key.padEnd(30)} ${JSON.stringify(f)}`);

  if (profile) {
    const { profile: cpu } = await post(session, 'Profiler.stop');
    const interval = (cpu.endTime - cpu.startTime) / cpu.samples.length;
    lineReport('CPU profile (self time)', cpu.nodes, files, node => ({
      total: node.hitCount,
      lines: (node.positionTicks || []).map(t => [t.line, t.ticks])
    }), ticks => `${(ticks * interval / 1000).toFixed(0)} ms`);
  }
  if (alloc) {
    const { profile: heap } = await post(session, 'HeapProfiler.stopSampling');
    const nodes = [];
    const walk = node => {
      nodes.push({ callFrame: node.callFrame, selfSize: node.selfSize });
      node.children.forEach(walk);
    };
    walk(heap.head);
    lineReport('Allocations (sampled, collected ones included; per function only)', nodes, files,
      node => ({ total: node.selfSize, lines: [] }), bytes => `${(bytes / 1024).toFixed(0)} KiB`);
  }
  if (session) session.disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
