// Browser side of the engine test bench. Renders synthetic "stream" audio offline through the
// real LimitrEngine + worklets and returns measurements. Driven by tests/run-engine-tests.js.

(function () {
  'use strict';

  const FS = 48000;
  const { LimitrSettings, LimitrEngine } = window;

  // ---------- deterministic signal generation ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function onePoleLowpass(data, cutoff) {
    const a = 1 - Math.exp(-2 * Math.PI * cutoff / FS);
    let y = 0;
    for (let i = 0; i < data.length; i++) { y += (data[i] - y) * a; data[i] = y; }
  }
  function onePoleHighpass(data, cutoff) {
    const a = 1 - Math.exp(-2 * Math.PI * cutoff / FS);
    let lp = 0;
    for (let i = 0; i < data.length; i++) { lp += (data[i] - lp) * a; data[i] -= lp; }
  }

  // Voiced + noisy syllables with pauses: crest factor and dynamics roughly like talking.
  function voice(seconds, seed, { pitch = 140, brightness = 3500, continuous = false } = {}) {
    const r = rng(seed);
    const n = Math.round(seconds * FS);
    const out = new Float32Array(n);
    let phase = 0;
    let i = 0;
    let syllables = 0;
    while (i < n) {
      const dur = Math.round((continuous ? 0.25 + r() * 0.35 : 0.12 + r() * 0.16) * FS);
      const f0 = pitch * (0.85 + r() * 0.3);
      for (let j = 0; j < dur && i < n; j++, i++) {
        const t = j / dur;
        const env = Math.min(1, j / (0.015 * FS)) * (continuous ? 1 : Math.pow(1 - t, 0.6));
        phase += f0 / FS;
        if (phase >= 1) phase -= 1;
        const saw = 2 * phase - 1;
        out[i] = env * (0.7 * saw + 0.3 * (r() * 2 - 1));
      }
      syllables++;
      const gap = continuous ? 0.02 : (syllables % 8 === 0 ? 0.3 + r() * 0.4 : 0.04 + r() * 0.1);
      i += Math.round(gap * FS);
    }
    onePoleHighpass(out, 120);
    onePoleLowpass(out, brightness);
    return out;
  }

  function chime(seconds) {
    const n = Math.round(seconds * FS);
    const out = new Float32Array(n);
    const hit = Math.round(0.27 * FS);
    for (let i = 0; i < n; i++) {
      const k = i % hit;
      const env = Math.exp(-k / (0.08 * FS));
      const t = i / FS;
      out[i] = env * (Math.sin(2 * Math.PI * 880 * t) + 0.6 * Math.sin(2 * Math.PI * 1320 * t) +
        0.4 * Math.sin(2 * Math.PI * 1760 * t));
    }
    return out;
  }

  function burst(seconds, seed) {
    const r = rng(seed);
    const n = Math.round(seconds * FS);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = (r() * 2 - 1) * Math.exp(-i / (0.04 * FS));
    return out;
  }

  // ---------- K-weighted loudness ----------
  function kWeight(data) {
    let K = Math.tan(Math.PI * 1681.974450955533 / FS);
    let Q = 0.7071752369554196;
    const Vh = Math.pow(10, 3.999843853973347 / 20);
    const Vb = Math.pow(Vh, 0.4996667741545416);
    let a0 = 1 + K / Q + K * K;
    const s = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0,
      2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
    K = Math.tan(Math.PI * 38.13547087602444 / FS);
    Q = 0.5003270373238773;
    a0 = 1 + K / Q + K * K;
    const h = [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
    const out = new Float64Array(data.length);
    let z1 = 0, z2 = 0, w1 = 0, w2 = 0;
    for (let i = 0; i < data.length; i++) {
      const x = data[i];
      const y = s[0] * x + z1;
      z1 = s[1] * x - s[3] * y + z2;
      z2 = s[2] * x - s[4] * y;
      const v = h[0] * y + w1;
      w1 = h[1] * y - h[3] * v + w2;
      w2 = h[2] * y - h[4] * v;
      out[i] = v;
    }
    return out;
  }

  // Momentary (400 ms) loudness every 100 ms, stereo-summed like BS.1770
  function momentary(left, right) {
    const kl = kWeight(left);
    const kr = kWeight(right);
    const win = Math.round(0.4 * FS);
    const hop = Math.round(0.1 * FS);
    const values = [];
    for (let start = 0; start + win <= kl.length; start += hop) {
      let sum = 0;
      for (let i = start; i < start + win; i++) sum += kl[i] * kl[i] + kr[i] * kr[i];
      values.push({ t: (start + win) / FS, lufs: -0.691 + 10 * Math.log10(sum / win + 1e-20) });
    }
    return values;
  }

  function integrated(data) {
    const k = kWeight(data);
    let sum = 0;
    for (let i = 0; i < k.length; i++) sum += k[i] * k[i];
    // Stereo with identical channels: +3 dB relative to one channel
    return -0.691 + 10 * Math.log10(2 * sum / k.length + 1e-20);
  }

  function scaleTo(data, lufs) {
    const gain = Math.pow(10, (lufs - integrated(data)) / 20);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
    return data;
  }

  function mix(target, source, atSeconds) {
    const offset = Math.round(atSeconds * FS);
    for (let i = 0; i < source.length && offset + i < target.length; i++) target[offset + i] += source[i];
  }

  // Timeline: normal talking with a sudden yell, an alert chime and a hard transient
  const NORMAL_LUFS = -24;
  const EVENTS = {
    yell: { start: 20, end: 22, lufs: NORMAL_LUFS + 14 },
    alert: { start: 30, end: 30.8, lufs: NORMAL_LUFS + 16 },
    clap: { start: 36, end: 36.15, lufs: NORMAL_LUFS + 12 }
  };
  const SCENARIO_SECONDS = 40;

  function buildScenario() {
    const n = SCENARIO_SECONDS * FS;
    const program = new Float32Array(n);
    const talk = scaleTo(voice(SCENARIO_SECONDS, 7), NORMAL_LUFS);
    // Silence the talker during the yell so the yell isn't double-counted
    const ys = EVENTS.yell.start * FS;
    const ye = EVENTS.yell.end * FS;
    for (let i = ys; i < ye; i++) talk[i] = 0;
    mix(program, talk, 0);
    mix(program, scaleTo(voice(2, 99, { pitch: 300, brightness: 7000, continuous: true }), EVENTS.yell.lufs), EVENTS.yell.start);
    mix(program, scaleTo(chime(0.8), EVENTS.alert.lufs), EVENTS.alert.start);
    mix(program, scaleTo(burst(0.15, 5), EVENTS.clap.lufs), EVENTS.clap.start);
    return program;
  }

  // ---------- rendering through the real engine ----------
  // changes: [{ at: seconds, settings }] applied mid-render, like a listener moving a control.
  // Returns the rendered audio and every meter message the worklet sent.
  async function renderThroughEngine(left, right, settings, { enabled = true, failWorklets = false, changes = [] } = {}) {
    const ctx = new OfflineAudioContext(2, left.length, FS);
    const buffer = ctx.createBuffer(2, left.length, FS);
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const engine = new LimitrEngine(ctx, {
      loadModule: failWorklets
        ? () => Promise.reject(new Error('blocked by test'))
        : path => ctx.audioWorklet.addModule('../' + path),
      loadBinary: path => fetch('../' + path).then(r => r.arrayBuffer())
    });
    engine.update(settings, enabled);
    await engine.init();
    const meters = [];
    if (engine.dspNode) {
      engine.dspNode.port.addEventListener('message', e => { if (e.data && e.data.type === 'meters') meters.push(e.data); });
    }
    for (const change of changes) {
      ctx.suspend(change.at).then(() => {
        engine.update(change.settings, enabled);
        ctx.resume();
      });
    }
    source.connect(engine.input);
    engine.output.connect(ctx.destination);
    source.start();
    const rendered = await ctx.startRendering();
    await new Promise(resolve => setTimeout(resolve, 50)); // let queued meter messages arrive
    return { left: rendered.getChannelData(0), right: rendered.getChannelData(1), status: engine.status, meters };
  }

  const LATENCY_S = 0.025; // guard lookahead + limiter lookahead

  function peakIn(data, from, to) {
    let peak = 0;
    for (let i = Math.round(from * FS); i < Math.round(to * FS) && i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    return peak;
  }

  // How much louder the first 20 ms of an event come through than the rest of it (dB)
  function onsetLeakDb(input, output, start) {
    const gain = (a, b) => peakIn(output, a + LATENCY_S, b + LATENCY_S) / (peakIn(input, a, b) + 1e-12);
    return 20 * Math.log10(gain(start, start + 0.02) / gain(start + 0.1, start + 0.25));
  }

  function scaled(program, sourceDb) {
    const g = Math.pow(10, (sourceDb - NORMAL_LUFS) / 20);
    return program.map(v => v * g);
  }

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
  }

  function peakDb(...channels) {
    let peak = 0;
    for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
    return 20 * Math.log10(peak + 1e-12);
  }

  function presetSettings(id, overrides = {}) {
    return LimitrSettings.normalize({ ...LimitrSettings.applyPreset({ volume: 0 }, id), ...overrides });
  }

  // options.sourceDb: how loud the stream's normal talking is (default -24 LUFS)
  async function scenario(id, overrides = {}, options = {}) {
    const program = scaled(buildScenario(), options.sourceDb ?? NORMAL_LUFS);
    const settings = presetSettings(id, overrides);
    const out = await renderThroughEngine(program, program, settings, options);
    const inM = momentary(program, program);
    const outM = momentary(out.left, out.right);

    const within = (m, a, b) => m.filter(v => v.t >= a && v.t <= b);
    const gainDiff = (a, b) => within(outM, a, b).map((v, i) => v.lufs - within(inM, a, b)[i].lufs);

    const normalWindow = [8, 19.5];
    const normalIn = median(within(inM, ...normalWindow).map(v => v.lufs));
    const normalOut = median(within(outM, ...normalWindow).map(v => v.lufs));
    const normalGain = median(gainDiff(...normalWindow));

    const eventReport = {};
    for (const [name, ev] of Object.entries(EVENTS)) {
      const inPeak = Math.max(...within(inM, ev.start + 0.1, ev.end + 0.4).map(v => v.lufs));
      const outPeak = Math.max(...within(outM, ev.start + 0.1, ev.end + 0.4).map(v => v.lufs));
      eventReport[name] = {
        inAboveNormal: +(inPeak - normalIn).toFixed(1),
        outAboveNormal: +(outPeak - normalOut).toFixed(1),
        tamedBy: +(inPeak - outPeak).toFixed(1)
      };
    }

    // Recovery: first window after the yell where gain is back within 1 dB of the normal gain
    const after = within(outM, EVENTS.yell.end + 0.4, 29).map((v, i) => ({
      t: v.t, diff: v.lufs - within(inM, EVENTS.yell.end + 0.4, 29)[i].lufs
    }));
    const recovered = after.find(v => Math.abs(v.diff - normalGain) < 1);

    // Share of plain talking where the guard cuts more than 1 dB, and what the popup would say
    const talkMeters = out.meters.filter(m => m.time >= normalWindow[0] && m.time <= normalWindow[1]);
    const guardBusy = talkMeters.length ? talkMeters.filter(m => m.guardDb < -1).length / talkMeters.length : 0;
    const last = out.meters[out.meters.length - 1] || {};

    return {
      preset: id,
      dsp: out.status.dsp,
      guardBusy: +guardBusy.toFixed(2),
      spikes: last.spikes,
      maxSpikeDb: last.maxSpikeDb,
      thresholdShown: out.meters.some(m => Number.isFinite(m.thresholdDb)),
      alertOnsetLeakDb: +onsetLeakDb(program, out.left, EVENTS.alert.start).toFixed(2),
      normalInLufs: +normalIn.toFixed(1),
      normalOutLufs: +normalOut.toFixed(1),
      normalGainDb: +normalGain.toFixed(2),
      events: eventReport,
      recoverySeconds: recovered ? +(recovered.t - EVENTS.yell.end).toFixed(1) : null,
      outputPeakDbfs: +peakDb(out.left, out.right).toFixed(2)
    };
  }

  // A stream that starts quiet (an intro, a pause, the end of an ad) and then plays normally:
  // the normal talking afterwards must not be treated as a loud stretch
  async function quietStart(id, { introDb = -45, sourceDb = -14, seconds = 30 } = {}) {
    const program = new Float32Array(seconds * FS);
    mix(program, scaleTo(voice(2, 3), introDb), 0);
    mix(program, scaleTo(voice(seconds - 2, 7), sourceDb), 2);
    const out = await renderThroughEngine(program, program, presetSettings(id));
    const talk = out.meters.filter(m => m.time >= 8);
    const inM = momentary(program, program).filter(v => v.t >= 8);
    const outM = momentary(out.left, out.right).filter(v => v.t >= 8);
    return {
      guardBusy: +(talk.filter(m => m.guardDb < -1).length / talk.length).toFixed(2),
      deepest: +Math.min(...talk.map(m => m.guardDb)).toFixed(1),
      normalGainDb: +(median(outM.map(v => v.lufs)) - median(inM.map(v => v.lufs))).toFixed(1)
    };
  }

  // A long loud stretch (+11 dB yelling for `seconds`) inside normal talking: how far above normal
  // does it come out 8 and 15 s in?
  async function sustained(id, { sourceDb = NORMAL_LUFS, seconds = 20, overrides = {} } = {}) {
    const total = 15 + seconds + 10;
    const program = new Float32Array(total * FS);
    const talk = scaleTo(voice(total, 7), NORMAL_LUFS);
    for (let i = 15 * FS; i < (15 + seconds) * FS; i++) talk[i] = 0;
    mix(program, talk, 0);
    mix(program, scaleTo(voice(seconds, 99, { pitch: 300, brightness: 7000, continuous: true }), NORMAL_LUFS + 11), 15);
    const input = scaled(program, sourceDb);
    const out = await renderThroughEngine(input, input, presetSettings(id, overrides));
    const inM = momentary(input, input);
    const outM = momentary(out.left, out.right);
    const within = (m, a, b) => m.filter(v => v.t >= a && v.t <= b).map(v => v.lufs);
    const normalOut = median(within(outM, 5, 14.5));
    const normalIn = median(within(inM, 5, 14.5));
    const above = at => median(within(outM, 15 + at - 0.5, 15 + at + 0.5)) - normalOut;
    return {
      inAbove: +(median(within(inM, 20, 25)) - normalIn).toFixed(1),
      at8: +above(8).toFixed(1),
      at15: +above(15).toFixed(1)
    };
  }

  // Talking, a 30 s pause (silence from the site, the preset's own hiss still playing), talking:
  // normal talk must come back at the level it left
  async function pauseAndResume(id, overrides = {}) {
    const program = new Float32Array(70 * FS);
    const talk = scaleTo(voice(70, 7), NORMAL_LUFS);
    for (let i = 20 * FS; i < 50 * FS; i++) talk[i] = 0;
    mix(program, talk, 0);
    const out = await renderThroughEngine(program, program, presetSettings(id, overrides));
    const inM = momentary(program, program);
    const outM = momentary(out.left, out.right);
    const gainIn = (a, b) => median(outM.filter(v => v.t >= a && v.t <= b).map((v, i) => v.lufs -
      inM.filter(w => w.t >= a && w.t <= b)[i].lufs));
    return { before: +gainIn(10, 19).toFixed(1), after: +gainIn(51, 57).toFixed(1) };
  }

  // Real recorded speech (a WAV from the test runner) at a source level: how often and how deep
  // the guard cuts it. Normal talking should be left alone.
  async function speechCut(id, wav, sourceDb) {
    const decoded = await new OfflineAudioContext(1, FS, FS).decodeAudioData(wav);
    const talk = scaleTo(Float32Array.from(decoded.getChannelData(0)), sourceDb);
    const out = await renderThroughEngine(talk, talk, presetSettings(id));
    const meters = out.meters.filter(m => m.time > 5);
    return {
      busy: meters.filter(m => m.guardDb < -1).length / meters.length,
      deepest: Math.min(...meters.map(m => m.guardDb))
    };
  }

  // Volume moved up and down while the limiter is working: the output must stay under 0 dBFS
  async function volumeSteps(id, sourceDb) {
    const program = scaled(buildScenario(), sourceDb);
    const base = presetSettings(id, { volume: 12 });
    const at = (seconds, volume) => ({ at: seconds, settings: { ...base, volume } });
    const out = await renderThroughEngine(program, program, base, {
      changes: [at(20.05, 0), at(20.6, 12), at(30.02, 0), at(30.3, 12), at(36.0, 0)]
    });
    return { outputPeakDbfs: +peakDb(out.left, out.right).toFixed(2) };
  }

  // Native DynamicsCompressorNode measured makeup vs our formula
  async function makeupCases(cases) {
    const results = [];
    for (const c of cases) {
      const ctx = new OfflineAudioContext(1, FS, FS);
      const osc = ctx.createOscillator();
      osc.frequency.value = 1000;
      const pre = ctx.createGain();
      pre.gain.value = Math.pow(10, -60 / 20);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = c.threshold;
      comp.ratio.value = c.ratio;
      comp.knee.value = c.knee;
      osc.connect(pre).connect(comp).connect(ctx.destination);
      osc.start();
      const data = (await ctx.startRendering()).getChannelData(0);
      let peak = 0;
      for (let i = FS / 2; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
      results.push({
        ...c,
        measuredDb: +(20 * Math.log10(peak) + 60).toFixed(3),
        formulaDb: +LimitrEngine.compressorMakeupDb(c.threshold, c.knee, c.ratio).toFixed(3)
      });
    }
    return results;
  }

  // Compressor enabled, quiet tone far below threshold: must come out at unity
  async function compensatedCompressor() {
    const n = FS * 2;
    const tone = new Float32Array(n);
    for (let i = 0; i < n; i++) tone[i] = 0.001 * Math.sin(2 * Math.PI * 1000 * i / FS);
    const settings = presetSettings('off', {
      compressorEnabled: true, compThreshold: -30, compRatio: 12, compKnee: 6
    });
    const out = await renderThroughEngine(tone, tone, settings);
    const inDb = peakDb(tone.subarray(FS));
    const outDb = peakDb(out.left.subarray(FS));
    return { gainDb: +(outDb - inDb).toFixed(3) };
  }

  // Loud bursts well over 0 dBFS: output peaks must never exceed the ceiling
  async function limiterCeiling(ceiling, failWorklets = false) {
    const n = FS * 3;
    const r = rng(3);
    const sig = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const env = (i % FS) < FS * 0.3 ? 2.5 : 0.1;  // +8 dBFS bursts
      sig[i] = env * (r() * 2 - 1);
    }
    const settings = presetSettings('off', { limiterEnabled: true, limiterCeiling: ceiling });
    const out = await renderThroughEngine(sig, sig, settings, { failWorklets });
    return { ceiling, outputPeakDbfs: +peakDb(out.left, out.right).toFixed(3), dsp: out.status.dsp };
  }

  // Disabled engine must be bit-exact passthrough
  async function bypassExact() {
    const program = buildScenario().subarray(0, FS * 5);
    const settings = presetSettings('sleep', { volume: -10 });
    const out = await renderThroughEngine(program, program, settings, { enabled: false });
    let maxDiff = 0;
    for (let i = 0; i < program.length; i++) maxDiff = Math.max(maxDiff, Math.abs(out.left[i] - program[i]));
    return { maxDiff };
  }

  // "Off" preset while enabled: only latency, no level or tone change
  async function offTransparent() {
    const program = buildScenario().subarray(0, FS * 5);
    const out = await renderThroughEngine(program, program, presetSettings('off'));
    let best = { lag: 0, err: Infinity };
    for (let lag = 0; lag < 2000; lag += 1) {
      let err = 0;
      for (let i = FS; i < FS + 4000; i++) err += Math.abs(out.left[i + lag] - program[i]);
      if (err < best.err) best = { lag, err };
    }
    let maxDiff = 0;
    for (let i = 0; i + best.lag < program.length; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(out.left[i + best.lag] - program[i]));
    }
    return { latencyMs: +(best.lag / FS * 1000).toFixed(2), maxDiff };
  }

  window.bench = {
    makeupCases,
    compensatedCompressor,
    limiterCeiling,
    bypassExact,
    offTransparent,
    scenario,
    sustained,
    quietStart,
    pauseAndResume,
    volumeSteps,
    speechCut: (id, base64, sourceDb) => speechCut(id, Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer, sourceDb),
    presetIds: () => LimitrSettings.PRESET_ORDER.slice(),
    userAgent: () => navigator.userAgent
  };
  window.benchReady = true;
})();
