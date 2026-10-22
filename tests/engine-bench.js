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

  // The talking level: the median of momentary loudness after the BS.1770-4 relative gate
  // (blocks more than 10 LU under the mean don't count), so pauses and a background bed between
  // phrases don't pull it down. The engine gates the same way for "normal" (and then takes the
  // upper quartile, where the talking usually sits).
  function talkingLevel(values) {
    const heard = values.filter(v => v > -70);
    if (!heard.length) return NaN;
    const mean = -0.691 + 10 * Math.log10(heard.reduce((s, v) => s + Math.pow(10, (v + 0.691) / 10), 0) / heard.length);
    return median(heard.filter(v => v > mean - 10));
  }

  // A game or music bed: dull, slowly swelling noise
  function bed(seconds, seed) {
    const r = rng(seed);
    const n = Math.round(seconds * FS);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = (r() * 2 - 1) * (0.7 + 0.3 * Math.sin(2 * Math.PI * i / (3.7 * FS)));
    onePoleLowpass(out, 1200);
    onePoleHighpass(out, 60);
    return out;
  }

  // Keep `data` only inside the [from, to] phrases (20 ms ramps at the edges)
  function phrased(data, phrases) {
    const out = new Float32Array(data.length);
    const ramp = Math.round(0.02 * FS);
    for (const [from, to] of phrases) {
      const a = Math.round(from * FS);
      const b = Math.min(data.length, Math.round(to * FS));
      for (let i = a; i < b; i++) {
        const edge = Math.min(1, (i - a) / ramp, (b - i) / ramp);
        out[i] = data[i] * edge;
      }
    }
    return out;
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
    const normalIn = talkingLevel(within(inM, ...normalWindow).map(v => v.lufs));
    const normalOut = talkingLevel(within(outM, ...normalWindow).map(v => v.lufs));
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
  // the normal talking afterwards must not be treated as a loud stretch (it becomes normal after
  // 3 s; the guard's release then takes a few seconds more in Sleep, so measure from 10 s)
  async function quietStart(id, { introDb = -45, sourceDb = -14, seconds = 30 } = {}) {
    const program = new Float32Array(seconds * FS);
    mix(program, scaleTo(voice(2, 3), introDb), 0);
    mix(program, scaleTo(voice(seconds - 2, 7), sourceDb), 2);
    const out = await renderThroughEngine(program, program, presetSettings(id));
    const talk = out.meters.filter(m => m.time >= 10);
    const inM = momentary(program, program).filter(v => v.t >= 10);
    const outM = momentary(out.left, out.right).filter(v => v.t >= 10);
    return {
      guardBusy: +(talk.filter(m => m.guardDb < -1).length / talk.length).toFixed(2),
      deepest: +Math.min(...talk.map(m => m.guardDb)).toFixed(1),
      normalGainDb: +(median(outM.map(v => v.lufs)) - median(inM.map(v => v.lufs))).toFixed(1)
    };
  }

  // A stream that opens on room noise (a muted mic, an empty scene) before anyone talks: the noise
  // is not a level to defend, so the voice must not be cut once Limitr has heard a second of it.
  // Returns how long the guard cut the voice by more than 3 dB, and its deepest cut after the
  // voice's first 1.5 s.
  async function silentStart(id, { silenceSeconds = 10, roomDb = -62, sourceDb = -16, seconds = 30 } = {}) {
    const program = new Float32Array(seconds * FS);
    mix(program, scaleTo(bed(seconds, 5), roomDb), 0);
    mix(program, scaleTo(voice(seconds - silenceSeconds, 7), sourceDb), silenceSeconds);
    const out = await renderThroughEngine(program, program, presetSettings(id));
    const voiceMeters = out.meters.filter(m => m.time >= silenceSeconds);
    let cutFor = 0;
    for (const m of voiceMeters) if (m.guardDb < -3) cutFor = m.time - silenceSeconds;
    return {
      cutForSeconds: +cutFor.toFixed(1),
      deepestAfter: +Math.min(0, ...voiceMeters.filter(m => m.time >= silenceSeconds + 1.5).map(m => m.guardDb)).toFixed(1)
    };
  }

  // Most streams open on the broadcaster setting up: minutes of room audio (a fan, the keyboard,
  // quiet music) loud enough to be learned as the stream's level, then the voice. The voice must
  // not be held down as a loud stretch for the preset's memory. Returns how long the guard cut it
  // by more than 3 dB, and the guard's share of time cutting >1 dB once that is over.
  async function longSetup(id, { setupSeconds = 150, roomDb = -42, sourceDb = -16, talkSeconds = 40 } = {}) {
    const seconds = setupSeconds + talkSeconds;
    const program = new Float32Array(seconds * FS);
    mix(program, scaleTo(bed(seconds, 5), roomDb), 0);
    mix(program, scaleTo(voice(talkSeconds, 7), sourceDb), setupSeconds);
    const out = await renderThroughEngine(program, program, presetSettings(id));
    const voiceMeters = out.meters.filter(m => m.time >= setupSeconds);
    let cutFor = 0;
    for (const m of voiceMeters) if (m.guardDb < -3) cutFor = m.time - setupSeconds;
    const after = voiceMeters.filter(m => m.time >= setupSeconds + cutFor + 5);
    return {
      cutForSeconds: +cutFor.toFixed(1),
      guardBusyAfter: after.length ? +(after.filter(m => m.guardDb < -1).length / after.length).toFixed(2) : 0
    };
  }

  // What real streams look like: a streamer talking in phrases over a quieter game bed that
  // fills the pauses (on a recorded stream, the bed filled 43% of the time, 27 dB under the
  // voice). The talking must pass as if the bed weren't there. Returns the guard's share of
  // time cutting >1 dB during the phrases (after the first 25 s), its deepest cut, and how much
  // the talking level moved.
  async function talkWithBed(id, { sourceDb = -24, bedUnderDb = 22, talkShare = 0.45, seconds = 120 } = {}) {
    const r = rng(21);
    const phrases = [];
    for (let t = 0; t < seconds;) {
      const on = 1.5 + r() * 3.5;
      phrases.push([t, t + on]);
      t += on + on * (1 - talkShare) / talkShare * (0.5 + r());
    }
    const program = new Float32Array(seconds * FS);
    mix(program, scaleTo(bed(seconds, 11), sourceDb - bedUnderDb), 0);
    mix(program, phrased(scaleTo(voice(seconds, 7), sourceDb), phrases), 0);
    const out = await renderThroughEngine(program, program, presetSettings(id));
    const inPhrase = t => phrases.some(([a, b]) => t >= a + 0.4 && t <= b);
    const talk = out.meters.filter(m => m.time >= 25 && inPhrase(m.time));
    const inM = momentary(program, program).filter(v => v.t >= 25 && inPhrase(v.t));
    const outM = momentary(out.left, out.right).filter(v => v.t >= 25 && inPhrase(v.t));
    return {
      guardBusy: +(talk.filter(m => m.guardDb < -1).length / talk.length).toFixed(2),
      deepest: +Math.min(...talk.map(m => m.guardDb)).toFixed(1),
      talkGainDb: +(talkingLevel(outM.map(v => v.lufs)) - talkingLevel(inM.map(v => v.lufs))).toFixed(1)
    };
  }

  // A long quiet intro (a "starting soon" screen with soft music), then the voice: normal must
  // not defend the intro for the preset's whole memory. Returns how long the voice was cut by
  // more than 3 dB after it started, and the guard's share of time cutting once that is over.
  // With `pauseSeconds`, the voice comes in 4 s phrases with pauses that long, the music still
  // playing under them.
  async function longQuietIntro(id, { introSeconds = 40, introDb = -45, sourceDb = -14, seconds = 100, pauseSeconds = 0 } = {}) {
    const program = new Float32Array(seconds * FS);
    mix(program, scaleTo(bed(seconds, 11), introDb), 0);
    let talk = scaleTo(voice(seconds - introSeconds, 7), sourceDb);
    if (pauseSeconds) {
      const phrases = [];
      for (let t = 0; t < seconds - introSeconds; t += 4 + pauseSeconds) phrases.push([t, t + 4]);
      talk = phrased(talk, phrases);
    }
    mix(program, talk, introSeconds);
    const out = await renderThroughEngine(program, program, presetSettings(id));
    const voiceMeters = out.meters.filter(m => m.time >= introSeconds + 1);
    let lastDeep = null;
    for (const m of voiceMeters) if (m.guardDb < -3) lastDeep = m.time;
    const cutFor = lastDeep === null ? 0 : lastDeep - introSeconds;
    const after = voiceMeters.filter(m => m.time >= introSeconds + cutFor + 5);
    return {
      cutForSeconds: +cutFor.toFixed(1),
      guardBusyAfter: after.length ? +(after.filter(m => m.guardDb < -1).length / after.length).toFixed(2) : 0
    };
  }

  // A recorded stream (served by the test runner): the guard's share of time cutting >1 dB after
  // the first `skip` seconds, the talking level in and out, and the loudest moments measured
  // against the talking level of the 20 s around them, in and out. A short clip can be looped so
  // the engine is settled when the measured pass starts. With `yells` and `calm` (time ranges in
  // the recording, measured in the last pass), also how far the yells sit above the calm talk,
  // in and out, and the calm talk's level.
  async function recording(id, url, { skip = 10, loops = 1, yells = null, calm = null } = {}) {
    if (!window.recordings) window.recordings = {};
    if (!window.recordings[url]) {
      const decoded = await new OfflineAudioContext(2, FS, FS).decodeAudioData(await (await fetch(url)).arrayBuffer());
      window.recordings[url] = [decoded.getChannelData(0), decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : decoded.getChannelData(0)];
    }
    const [l, r] = window.recordings[url];
    const left = new Float32Array(l.length * loops);
    const right = new Float32Array(l.length * loops);
    for (let k = 0; k < loops; k++) {
      left.set(l, k * l.length);
      right.set(r, k * l.length);
    }
    const from = (loops - 1) * l.length / FS + skip;
    const out = await renderThroughEngine(left, right, presetSettings(id));
    const meters = out.meters.filter(m => m.time > from);
    const inM = momentary(left, right);
    const outM = momentary(out.left, out.right);
    const after = m => m.filter(v => v.t > from).map(v => v.lufs);
    const local = (m, t) => talkingLevel(m.filter(v => v.t > from && Math.abs(v.t - t) < 10).map(v => v.lufs));
    // The loudest moments, at least 3 s apart
    const order = inM.map((v, i) => i).filter(i => inM[i].t > from).sort((a, b) => inM[b].lufs - inM[a].lufs);
    const picked = [];
    for (const i of order) {
      if (picked.every(j => Math.abs(inM[j].t - inM[i].t) > 3)) picked.push(i);
      if (picked.length === 6) break;
    }
    const offset = (loops - 1) * l.length / FS;
    const level = (m, ranges) => {
      const v = m.filter(x => ranges.some(([a, b]) => x.t >= offset + a + 0.4 && x.t <= offset + b)).map(x => Math.pow(10, x.lufs / 10));
      return 10 * Math.log10(v.reduce((s, x) => s + x, 0) / v.length);
    };
    const yelling = yells && calm ? {
      yellsOverCalmIn: +(level(inM, yells) - level(inM, calm)).toFixed(1),
      yellsOverCalmOut: +(level(outM, yells) - level(outM, calm)).toFixed(1),
      calmIn: +level(inM, calm).toFixed(1),
      calmOut: +level(outM, calm).toFixed(1)
    } : {};
    return {
      ...yelling,
      guardBusy: +(meters.filter(m => m.guardDb < -1).length / meters.length).toFixed(3),
      talkingIn: +talkingLevel(after(inM)).toFixed(1),
      talkingOut: +talkingLevel(after(outM)).toFixed(1),
      loudest: picked.map(i => ({
        t: +inM[i].t.toFixed(0),
        inAbove: +(inM[i].lufs - local(inM, inM[i].t)).toFixed(1),
        outAbove: +(outM[i].lufs - local(outM, inM[i].t)).toFixed(1)
      }))
    };
  }

  // A long loud stretch (+11 dB yelling for `seconds`) inside normal talking, after 25 s of it
  // (the stream's first 20 s aren't defended): how far above normal does it come out 8 and 15 s in?
  async function sustained(id, { sourceDb = NORMAL_LUFS, seconds = 20, overrides = {} } = {}) {
    const from = 25;
    const total = from + seconds + 10;
    const program = new Float32Array(total * FS);
    const talk = scaleTo(voice(total, 7), NORMAL_LUFS);
    for (let i = from * FS; i < (from + seconds) * FS; i++) talk[i] = 0;
    mix(program, talk, 0);
    mix(program, scaleTo(voice(seconds, 99, { pitch: 300, brightness: 7000, continuous: true }), NORMAL_LUFS + 11), from);
    const input = scaled(program, sourceDb);
    const out = await renderThroughEngine(input, input, presetSettings(id, overrides));
    const inM = momentary(input, input);
    const outM = momentary(out.left, out.right);
    const within = (m, a, b) => m.filter(v => v.t >= a && v.t <= b).map(v => v.lufs);
    const normalOut = talkingLevel(within(outM, 5, from - 0.5));
    const normalIn = talkingLevel(within(inM, 5, from - 0.5));
    const above = at => median(within(outM, from + at - 0.5, from + at + 0.5)) - normalOut;
    return {
      inAbove: +(median(within(inM, from + 5, from + 10)) - normalIn).toFixed(1),
      at8: +above(8).toFixed(1),
      at15: +above(15).toFixed(1)
    };
  }

  // Loudness range (EBU Tech 3342): the spread, 10th to 95th percentile, of 3 s short-term
  // loudness every 100 ms, gated at -70 LUFS and 20 LU under the gated mean. A calm dubbed
  // documentary measures about 5 LU; streams 10 to 20.
  function loudnessRange(left, right) {
    const kl = kWeight(left), kr = kWeight(right);
    const hop = FS / 10;
    const n = Math.floor(kl.length / hop);
    const sub = new Float64Array(n);
    for (let b = 0; b < n; b++) {
      let e = 0;
      for (let i = b * hop; i < (b + 1) * hop; i++) e += kl[i] * kl[i] + kr[i] * kr[i];
      sub[b] = e / hop;
    }
    const st = [];
    for (let b = 29, sum = sub.slice(0, 29).reduce((s, v) => s + v, 0); b < n; b++) {
      sum += sub[b];
      st.push(sum / 30);
      sum -= sub[b - 29];
    }
    const heard = st.filter(p => -0.691 + 10 * Math.log10(p + 1e-20) > -70);
    if (!heard.length) return NaN;
    const gate = -0.691 + 10 * Math.log10(heard.reduce((s, p) => s + p, 0) / heard.length) - 20;
    const kept = heard.map(p => -0.691 + 10 * Math.log10(p)).filter(v => v > gate).sort((a, b) => a - b);
    const at = q => kept[Math.min(kept.length - 1, Math.floor(kept.length * q))];
    return at(0.95) - at(0.1);
  }

  // A labelled recording from the dataset (tools/eval-dataset.js): the talking level outside the
  // loud parts, in and out; the guard's share of that time cutting >1 dB; and each loud part's
  // loudest 400 ms over the talking level, in and out. After the first `skip` seconds.
  async function datasetFile(id, url, { loud = [], skip = 10 } = {}) {
    const decoded = await new OfflineAudioContext(2, FS, FS).decodeAudioData(await (await fetch(url)).arrayBuffer());
    const left = decoded.getChannelData(0);
    const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : left;
    const out = await renderThroughEngine(left, right, presetSettings(id));
    const inM = momentary(left, right);
    const outM = momentary(out.left, out.right);
    // A loud part's own blocks, and a second either side (onsets and the guard's release)
    const nearLoud = t => loud.some(([a, b]) => t >= a - 1 && t <= b + 1.4);
    const normal = m => m.filter(v => v.t >= skip && !nearLoud(v.t)).map(v => v.lufs);
    const talkIn = talkingLevel(normal(inM));
    const talkOut = talkingLevel(normal(outM));
    const meters = out.meters.filter(m => m.time >= skip && !nearLoud(m.time));
    const from = Math.round(skip * FS);
    return {
      talkIn: +talkIn.toFixed(1),
      talkOut: +talkOut.toFixed(1),
      rangeIn: +loudnessRange(left.subarray(from), right.subarray(from)).toFixed(1),
      rangeOut: +loudnessRange(out.left.subarray(from), out.right.subarray(from)).toFixed(1),
      guardBusy: meters.length ? +(meters.filter(m => m.guardDb < -1).length / meters.length).toFixed(3) : 0,
      loud: loud.map(([a, b]) => {
        let k = -1;
        inM.forEach((v, i) => { if (v.t >= a + 0.4 && v.t <= b + 0.4 && (k < 0 || v.lufs > inM[k].lufs)) k = i; });
        return k < 0 ? null : { at: a, inAbove: +(inM[k].lufs - talkIn).toFixed(1), outAbove: +(outM[k].lufs - talkOut).toFixed(1) };
      }).filter(Boolean)
    };
  }

  // A streamer who turns the mic (or the music) up on purpose, over a few seconds, and keeps it
  // there for 20 s after 40 s of talking: a slow rise must not walk normal up with it. Returns how
  // far above normal talking the boom comes out 8 and 15 s after it is fully up.
  async function boom(id, { boomDb = 9, rampSeconds = 5, seconds = 20, sourceDb = NORMAL_LUFS, talkSeconds = 40 } = {}) {
    const from = talkSeconds;
    const total = from + rampSeconds + seconds + 10;
    const talk = scaleTo(voice(total, 7), NORMAL_LUFS);
    for (let i = from * FS; i < total * FS; i++) {
      const t = i / FS - from;
      const up = t < rampSeconds ? t / rampSeconds : t < rampSeconds + seconds ? 1 : 0;
      talk[i] *= Math.pow(10, boomDb * up / 20);
    }
    const input = scaled(talk, sourceDb);
    const out = await renderThroughEngine(input, input, presetSettings(id));
    const inM = momentary(input, input);
    const outM = momentary(out.left, out.right);
    const within = (m, a, b) => m.filter(v => v.t >= a && v.t <= b).map(v => v.lufs);
    const normalIn = talkingLevel(within(inM, 25, from));
    const normalOut = talkingLevel(within(outM, 25, from));
    const up = from + rampSeconds;
    const above = (m, normal, at) => talkingLevel(within(m, up + at - 2, up + at + 2)) - normal;
    return {
      inAbove: +above(inM, normalIn, 10).toFixed(1),
      at8: +above(outM, normalOut, 8).toFixed(1),
      at15: +above(outM, normalOut, 15).toFixed(1)
    };
  }

  // A streamer who keeps yelling: fits of +11 dB, 4 to 12 s long, from the stream's first seconds,
  // with calm talk in between. However often they come, the fits are spikes the listener didn't
  // set the volume for. Returns how far each fit comes out above the calm talk's talking level
  // (the median of its momentary loudness), in and out.
  async function yellingFits(id, { fits = [[6, 10], [14, 24], [29, 35], [40, 52]], seconds = 58 } = {}) {
    const program = new Float32Array(seconds * FS);
    const talk = scaleTo(voice(seconds, 7), NORMAL_LUFS);
    for (const [a, b] of fits) for (let i = a * FS; i < b * FS; i++) talk[i] = 0;
    mix(program, talk, 0);
    fits.forEach(([a, b], k) => mix(program, scaleTo(voice(b - a, 99 + k, { pitch: 300, brightness: 7000, continuous: true }), NORMAL_LUFS + 11), a));
    const out = await renderThroughEngine(program, program, presetSettings(id));
    const inM = momentary(program, program);
    const outM = momentary(out.left, out.right);
    const within = (m, ranges) => m.filter(v => ranges.some(([a, b]) => v.t >= a + 0.5 && v.t <= b)).map(v => v.lufs);
    // The calm talk: before the first fit and between them
    const calm = fits.map(([a], k) => [k === 0 ? 1 : fits[k - 1][1], a]).concat([[fits[fits.length - 1][1], seconds]]);
    const calmIn = talkingLevel(within(inM, calm));
    const calmOut = talkingLevel(within(outM, calm));
    return fits.map(fit => ({
      at: fit[0],
      inAbove: +(median(within(inM, [fit])) - calmIn).toFixed(1),
      outAbove: +(median(within(outM, [fit])) - calmOut).toFixed(1)
    }));
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
    boom,
    yellingFits,
    quietStart,
    silentStart,
    longSetup,
    talkWithBed,
    longQuietIntro,
    recording,
    datasetFile,
    pauseAndResume,
    volumeSteps,
    speechCut: (id, base64, sourceDb) => speechCut(id, Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer, sourceDb),
    presetIds: () => LimitrSettings.PRESET_ORDER.slice(),
    userAgent: () => navigator.userAgent
  };
  window.benchReady = true;
})();
