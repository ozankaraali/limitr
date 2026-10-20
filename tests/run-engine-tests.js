#!/usr/bin/env node
// Renders synthetic stream audio through the real engine in Chromium and Firefox and checks
// that Limitr does what it promises. Run: node tests/run-engine-tests.js [--browser=chromium|firefox]

const { chromium, firefox } = require('playwright');
const { startStaticServer } = require('./static-server');
const { streamWav } = require('./stream-audio');

const MAKEUP_CASES = [
  { threshold: -18, ratio: 6, knee: 10 },
  { threshold: -30, ratio: 12, knee: 6 },
  { threshold: -1, ratio: 20, knee: 0 },
  { threshold: -10, ratio: 20, knee: 0 },
  { threshold: -25, ratio: 10, knee: 10 },
  { threshold: -20, ratio: 3, knee: 20 },
  { threshold: -6, ratio: 4, knee: 30 }
];

// What each preset must achieve on the synthetic stream (dB above normal talking level)
const PRESET_EXPECTATIONS = {
  gentle: { maxYellAbove: 8.5, maxAlertAbove: 6 },
  stream: { maxYellAbove: 6, maxAlertAbove: 5 },
  sleep: { maxYellAbove: 5, maxAlertAbove: 4 },
  movie: { maxYellAbove: 6.5, maxAlertAbove: 5 },
  tv90s: { maxYellAbove: 6.5, maxAlertAbove: 6.2 }
};
// How deep the guard may cut real speech (dB): untouched, except Sleep evens it a little
const SPEECH_MAX_CUT = { gentle: 0.5, stream: 1, sleep: 2, movie: 0.5, tv90s: 0.5 };

// About a minute of a streamer talking, spoken by macOS `say` (skipped where it's missing)
function realSpeech() {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const { execFileSync } = require('child_process');
  const text = 'Okay chat, welcome back! So today we are going to try the hardest level again. Last time I almost ' +
    'made it, remember? That jump at the end. Honestly, I think the timing is off. Let me check the settings real quick. ' +
    'Alright, here we go. Wait, wait, wait. Oh no. No no no. Okay, that was close. Thanks for the follows by the way, ' +
    'really appreciate you all. If I go left here, and then grab the key, maybe that works. Hmm. Interesting. Okay, so, ' +
    'the boss has three phases, and the second one is the hardest. Anyway. Drink some water, everyone. It is late, I know.';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-speech-'));
  try {
    execFileSync('say', ['-o', path.join(dir, 's.aiff'), text]);
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@48000', path.join(dir, 's.aiff'), path.join(dir, 's.wav')]);
    return fs.readFileSync(path.join(dir, 's.wav')).toString('base64');
  } catch (e) {
    return null;
  }
}
const SPEECH = realSpeech();
const TRANSPARENT_PRESETS = ['gentle', 'stream', 'movie'];

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

// Pure settings logic, no browser needed
function checkCaptionPrefs() {
  require('../lib/settings.js');
  const S = globalThis.LimitrSettings;
  console.log('\nCaption preferences');
  check('English browser starts on English captions', S.defaultCaptions('en-GB').language === 'en');
  check('other browsers start on automatic detection', S.defaultCaptions('tr-TR').language === 'auto');
  check('other languages use the standard model until another is chosen', S.normalizeCaptions(null, 'en').model === 'standard');
  check('choosing the faster or the larger model is kept',
    S.normalizeCaptions({ model: 'fast' }, 'en').model === 'fast' && S.normalizeCaptions({ model: 'large' }, 'en').model === 'large');
  check('a 2.1 "larger model" switch that was on carries over', S.normalizeCaptions({ largeModel: true }, 'en').model === 'large');
  check('anything else falls back to standard', S.normalizeCaptions({ model: 'huge' }, 'en').model === 'standard');
}

// The captions resampler (lib/transcriber-capture-worklet.js) run in Node: speech passes, and
// content above 8 kHz must not fold back into the speech band when going down to 16 kHz
function checkCaptionResampler() {
  const vm = require('vm');
  const source = require('fs').readFileSync(require('path').join(__dirname, '../lib/transcriber-capture-worklet.js'), 'utf8');
  const through = (rate, freq, seconds = 2) => {
    const sandbox = { sampleRate: rate, Math, Float32Array, Float64Array, chunks: [] };
    sandbox.AudioWorkletProcessor = class { constructor() { this.port = { postMessage: m => sandbox.chunks.push(m.audio) }; } };
    sandbox.registerProcessor = (name, cls) => { sandbox.Processor = cls; };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    const processor = new sandbox.Processor();
    const total = Math.round(seconds * rate);
    for (let start = 0; start < total; start += 128) {
      const block = new Float32Array(128);
      for (let i = 0; i < 128; i++) block[i] = Math.sin(2 * Math.PI * freq * (start + i) / rate);
      processor.process([[block, block]]);
    }
    const out = new Float32Array(sandbox.chunks.length * 8000);
    sandbox.chunks.forEach((c, i) => out.set(c, i * 8000));
    return out;
  };
  // Level (dB re the input tone) at one frequency of the 16 kHz output, skipping the start
  const levelAt = (x, freq) => {
    const w = 2 * Math.PI * freq / 16000;
    let s1 = 0, s2 = 0;
    const from = Math.floor(x.length / 4);
    for (let i = from; i < x.length; i++) { const v = x[i] + 2 * Math.cos(w) * s1 - s2; s2 = s1; s1 = v; }
    const re = s1 - s2 * Math.cos(w), im = s2 * Math.sin(w);
    return 20 * Math.log10(2 * Math.hypot(re, im) / (x.length - from) + 1e-12);
  };
  console.log('\nCaptions resampler (to 16 kHz)');
  for (const rate of [48000, 44100]) {
    const pass = [1000, 6000].map(f => levelAt(through(rate, f), f));
    check(`${rate / 1000} kHz: speech passes (1 and 6 kHz)`, Math.abs(pass[0]) <= 0.5 && Math.abs(pass[1]) <= 1,
      pass.map(v => `${v.toFixed(1)} dB`).join(', '));
    const folded = [9000, 10000, 12000, 14000].map(f => ({ f, level: levelAt(through(rate, f), 16000 - f) }));
    const worst = folded.reduce((a, b) => (b.level > a.level ? b : a));
    check(`${rate / 1000} kHz: 9 to 14 kHz don't fold into the speech band (under -40 dB)`, worst.level <= -40,
      folded.map(x => `${x.f / 1000}k ${x.level.toFixed(1)}`).join(', '));
  }
}

// Upgrading from 1.x keeps the listener's tone and extras on top of the default preset
async function checkLegacyUpgrade() {
  const S = globalThis.LimitrSettings;
  console.log('\nUpgrade from 1.x');
  const area = {
    get: async () => ({
      limitrCurrentSettings: {
        outputGain: -3, monoMixEnabled: true, noiseSuppressionEnabled: true,
        eqEnabled: true, eq3Gain: 4, eq3Freq: 1200, filtersEnabled: true, bassCutFreq: 80,
        effectsEnabled: true, noiseLevel: 0.02, noiseType: 'pink',
        limiterEnabled: true, limiterThreshold: -6
      }
    })
  };
  const { settings, preset } = await S.load(area);
  const base = S.PRESETS[S.DEFAULT_PRESET].settings;
  check('volume carries over', settings.volume === -3);
  check('tone, EQ, mono, noise removal and tape hiss carry over',
    settings.toneEnabled && settings.eq3Gain === 4 && settings.eq3Freq === 1200 && settings.lowCut === 80 &&
    settings.monoEnabled && settings.denoiseEnabled && settings.noiseLevel === 0.02 && settings.noiseType === 'pink',
    JSON.stringify({ tone: settings.toneEnabled, eq3: [settings.eq3Gain, settings.eq3Freq], lowCut: settings.lowCut,
      mono: settings.monoEnabled, denoise: settings.denoiseEnabled, hiss: [settings.noiseLevel, settings.noiseType] }));
  check('the old limiter value (a compressor with hidden boost) is not reused as the ceiling',
    settings.limiterCeiling === base.limiterCeiling, `${settings.limiterCeiling} vs ${base.limiterCeiling}`);
  check('the spike guard comes from the default preset', settings.guardHeadroom === base.guardHeadroom && settings.guardEnabled);
  check('changed tone means no preset is shown as selected', preset === null, String(preset));
}

// 2.0 settings: the guard and comfortable level work differently now, so they come from the preset
async function checkUpgradeFrom20() {
  const S = globalThis.LimitrSettings;
  console.log('\nUpgrade from 2.0');
  const old = {
    volume: -4, guardEnabled: true, guardHeadroom: 5, guardCeiling: -16, guardRatio: 12, guardAttack: 3,
    guardHold: 200, guardRelease: 1000, levelEnabled: false, levelTarget: -24, levelMaxBoost: 6,
    toneEnabled: true, eq2Gain: 3
  };
  const area = { get: async () => ({ limitrSettings: old, limitrPreset: 'stream' }) };
  const { settings } = await S.load(area);
  const stream = S.PRESETS.stream.settings;
  check('the guard and comfortable level come from the preset',
    settings.guardMemory === stream.guardMemory && settings.levelEnabled === stream.levelEnabled &&
    settings.levelTarget === stream.levelTarget && settings.guardHeadroom === stream.guardHeadroom,
    JSON.stringify({ memory: settings.guardMemory, level: settings.levelEnabled, target: settings.levelTarget }));
  check('volume and tone stay', settings.volume === -4 && settings.toneEnabled && settings.eq2Gain === 3);
}

async function runIn(browserType, port) {
  // Offline rendering needs neither the GPU nor the speakers
  // Off the GPU and silent. Chromium: fake audio output device, so the speakers are never opened.
  // Firefox: volume scaled to zero (a null audio device would stop real-time Web Audio running).
  const browser = await browserType.launch(browserType.name() === 'chromium'
    ? { args: ['--disable-gpu', '--disable-audio-output', '--js-flags=--expose-gc'] }
    : { firefoxUserPrefs: { 'media.volume_scale': '0.0' } });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('  page error:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('  console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/tests/engine-bench.html`);
  await page.waitForFunction(() => window.benchReady === true);
  console.log(`\n=== ${browserType.name()} — ${await page.evaluate(() => bench.userAgent())}`);

  console.log('\nDynamicsCompressorNode hidden makeup gain vs compensation formula');
  for (const r of await page.evaluate(c => bench.makeupCases(c), MAKEUP_CASES)) {
    const err = Math.abs(r.measuredDb - r.formulaDb);
    check(`${r.threshold} dB / ${r.ratio}:1 / knee ${r.knee}: measured +${r.measuredDb} dB, formula +${r.formulaDb} dB`, err < 0.05);
  }

  console.log('\nCompressor with compensation leaves quiet audio at unity');
  const comp = await page.evaluate(() => bench.compensatedCompressor());
  check(`gain on -60 dBFS tone = ${comp.gainDb} dB`, Math.abs(comp.gainDb) < 0.1);

  console.log('\nBrickwall limiter (+8 dBFS bursts)');
  for (const ceiling of [-1, -3, -6]) {
    const r = await page.evaluate(c => bench.limiterCeiling(c), ceiling);
    check(`ceiling ${ceiling} dBFS → output peak ${r.outputPeakDbfs} dBFS`, r.outputPeakDbfs <= ceiling + 0.01);
  }
  const fb = await page.evaluate(() => bench.limiterCeiling(-1, true));
  check(`native fallback limiter (worklets blocked) → peak ${fb.outputPeakDbfs} dBFS`, fb.dsp === 'fallback' && fb.outputPeakDbfs <= 1.5);

  // Pages that block AudioWorklets get native compressors, whose times only go up to 1 s
  const rangeWarnings = [];
  const onWarning = m => { if (m.type() === 'warning' && /range|clamp/i.test(m.text())) rangeWarnings.push(m.text()); };
  page.on('console', onWarning);
  for (const id of await page.evaluate(() => bench.presetIds())) {
    await page.evaluate(p => bench.scenario(p, {}, { failWorklets: true }), id);
  }
  page.off('console', onWarning);
  check('native fallback: every preset fits the browser\'s compressor ranges', rangeWarnings.length === 0,
    rangeWarnings.slice(0, 2).join(' | '));

  console.log('\nTransparency');
  const bypass = await page.evaluate(() => bench.bypassExact());
  check(`disabled = bit-exact passthrough (max diff ${bypass.maxDiff})`, bypass.maxDiff === 0);
  const off = await page.evaluate(() => bench.offTransparent());
  check(`"Off" preset = pure delay (${off.latencyMs} ms latency, max diff ${off.maxDiff.toExponential(2)})`, off.maxDiff < 1e-6 && off.latencyMs <= 25);

  console.log('\nSpike guard on a synthetic stream (talking at -24 LUFS, yell +14, alert +16, clap +12)');
  const rows = [];
  for (const id of await page.evaluate(() => bench.presetIds())) {
    if (id === 'off') continue;
    const r = await page.evaluate(p => bench.scenario(p), id);
    rows.push(r);
    const exp = PRESET_EXPECTATIONS[id];
    console.log(`  ${id.padEnd(7)} normal ${r.normalInLufs}→${r.normalOutLufs} LUFS (gain ${r.normalGainDb} dB) | ` +
      `yell +${r.events.yell.inAboveNormal}→+${r.events.yell.outAboveNormal} | ` +
      `alert +${r.events.alert.inAboveNormal}→+${r.events.alert.outAboveNormal} | ` +
      `clap +${r.events.clap.inAboveNormal}→+${r.events.clap.outAboveNormal} | ` +
      `recovery ${r.recoverySeconds}s | peak ${r.outputPeakDbfs} dBFS`);
    if (exp) {
      check(`${id}: yell held to ≤ +${exp.maxYellAbove} dB over normal`, r.events.yell.outAboveNormal <= exp.maxYellAbove);
      check(`${id}: alert held to ≤ +${exp.maxAlertAbove} dB over normal`, r.events.alert.outAboveNormal <= exp.maxAlertAbove);
    }
    if (TRANSPARENT_PRESETS.includes(id)) {
      check(`${id}: normal talking untouched (|gain| ≤ 0.5 dB)`, Math.abs(r.normalGainDb) <= 0.5);
      check(`${id}: recovers within 3 s after the yell`, r.recoverySeconds !== null && r.recoverySeconds <= 3);
    }
  }

  console.log('\nSpike guard at real source levels (YouTube plays near -14 LUFS, loud streams near -10)');
  const LEVELS = [-36, -30, -24, -18, -14, -10];
  const sweep = async (id, overrides = {}) => {
    const rows = [];
    for (const level of LEVELS) {
      rows.push({ level, ...(await page.evaluate(([p, o, l]) => bench.scenario(p, o, { sourceDb: l }), [id, overrides, level])) });
    }
    return rows;
  };
  const perLevel = (rows, pick) => rows.map(r => `${r.level}: ${pick(r)}`).join(', ');
  for (const id of ['gentle', 'stream', 'movie', 'tv90s']) {
    const exp = PRESET_EXPECTATIONS[id];
    const comfortable = globalThis.LimitrSettings.PRESETS[id].settings.levelTarget;
    const rows = await sweep(id);
    if (id !== 'tv90s') {
      // 90s TV's own compressor shapes loud sources on purpose; the guard must still stay idle
      const quieter = rows.filter(r => r.level <= comfortable - 6);
      check(`${id}: streams quieter than ${comfortable} LUFS are untouched`, quieter.every(r => Math.abs(r.normalGainDb) <= 0.5),
        perLevel(quieter, r => r.normalGainDb));
      const louder = rows.filter(r => r.level >= comfortable + 4);
      if (louder.length) {
        const outs = louder.map(r => r.normalOutLufs);
        check(`${id}: louder streams come out at the comfortable level`,
          outs.every(v => v <= comfortable + 0.5 && v >= comfortable - 3) && Math.max(...outs) - Math.min(...outs) <= 1.5,
          perLevel(louder, r => r.normalOutLufs));
      }
    }
    check(`${id}: guard idle during plain talking at every level`, rows.every(r => r.guardBusy <= 0.1),
      perLevel(rows, r => r.guardBusy));
    check(`${id}: yell and alert held at every level`,
      rows.every(r => r.events.yell.outAboveNormal <= exp.maxYellAbove && r.events.alert.outAboveNormal <= exp.maxAlertAbove),
      perLevel(rows, r => `${r.events.yell.outAboveNormal}/${r.events.alert.outAboveNormal}`));
    if (id !== 'tv90s') {
      // The clap is short and may stay under the counter's 3 dB; the yell and the alert must count
      check(`${id}: counts the yell and the alert at every level`, rows.every(r => r.spikes >= 2 && r.spikes <= 3),
        perLevel(rows, r => r.spikes));
    }
    check(`${id}: alert onset doesn't slip through the lookahead`, rows.every(r => r.alertOnsetLeakDb <= 1),
      perLevel(rows, r => r.alertOnsetLeakDb));
  }

  console.log('\nSleep: every stream at one comfortable level, quiet ones lifted a little, spikes held');
  const sleepRows = await sweep('sleep');
  const sleepTarget = (await page.evaluate(() => bench.scenario('sleep'))).normalOutLufs;
  check('sleep: -24 to -10 sources all come out at the same level',
    sleepRows.filter(r => r.level >= -24).every(r => Math.abs(r.normalOutLufs - sleepTarget) <= 1.5),
    perLevel(sleepRows, r => r.normalOutLufs));
  const quiet = sleepRows.find(r => r.level === -36);
  const maxBoost = globalThis.LimitrSettings.PRESETS.sleep.settings.levelMaxBoost;
  check('sleep: a quiet stream is lifted, at most by its maximum boost', quiet.normalGainDb > 1 && quiet.normalGainDb <= maxBoost + 0.5,
    `+${quiet.normalGainDb} dB`);
  check('sleep: yell and alert held at every level',
    sleepRows.every(r => r.events.yell.outAboveNormal <= PRESET_EXPECTATIONS.sleep.maxYellAbove &&
      r.events.alert.outAboveNormal <= PRESET_EXPECTATIONS.sleep.maxAlertAbove),
    perLevel(sleepRows, r => `${r.events.yell.outAboveNormal}/${r.events.alert.outAboveNormal}`));
  check('sleep: counts the yell and the alert at every level', sleepRows.every(r => r.spikes >= 2 && r.spikes <= 3),
    perLevel(sleepRows, r => r.spikes));
  check('sleep: guard idle during plain talking at every level', sleepRows.every(r => r.guardBusy <= 0.1),
    perLevel(sleepRows, r => r.guardBusy));

  console.log('\nA loud stretch stays tamed for as long as the preset remembers normal');
  for (const [id, holdsFor15] of [['gentle', false], ['movie', true], ['stream', true], ['sleep', true]]) {
    const limit = PRESET_EXPECTATIONS[id].maxYellAbove;
    for (const sourceDb of [-30, -14]) {
      const r = await page.evaluate(([p, l]) => bench.sustained(p, { sourceDb: l }), [id, sourceDb]);
      const ok = r.at8 <= limit + 1 && (!holdsFor15 || r.at15 <= limit + 1);
      check(`${id} at ${sourceDb} LUFS: 20 s of yelling (+${r.inAbove} dB) held${holdsFor15 ? ' 15 s in' : ' 8 s in'}`, ok,
        `+${r.at8} dB at 8 s, +${r.at15} dB at 15 s`);
    }
  }

  if (SPEECH) {
    console.log('\nReal speech (macOS say) is left alone');
    for (const id of ['gentle', 'stream', 'sleep', 'movie', 'tv90s']) {
      const cuts = [];
      for (const level of [-30, -14]) cuts.push({ level, ...(await page.evaluate(([p, w, l]) => bench.speechCut(p, w, l), [id, SPEECH, level])) });
      check(`${id}: real speech cut at most ${SPEECH_MAX_CUT[id]} dB at quiet and loud levels`,
        cuts.every(c => -c.deepest <= SPEECH_MAX_CUT[id]), cuts.map(c => `${c.level}: ${c.deepest.toFixed(1)} dB`).join(', '));
    }
  }

  console.log('\nThings that used to fight the guard');
  for (const [id, overrides] of [['tv90s', {}], ['stream', { noiseLevel: 0.01, noiseType: 'pink' }]]) {
    const r = await page.evaluate(([p, o]) => bench.pauseAndResume(p, o), [id, overrides]);
    check(`${id}${overrides.noiseLevel ? ' + hiss' : ''}: talking comes back at its level after a 30 s pause`,
      Math.abs(r.after - r.before) <= 1.5, `${r.before} dB before, ${r.after} dB after`);
  }
  const plainGain = { compressorEnabled: true, compThreshold: 0, compRatio: 1, compKnee: 0 };
  const noMakeup = await page.evaluate(o => bench.scenario('stream', o, { sourceDb: -14 }), { ...plainGain, compMakeup: 0 });
  const makeup6 = await page.evaluate(o => bench.scenario('stream', o, { sourceDb: -14 }), { ...plainGain, compMakeup: 6 });
  const delivered = makeup6.normalOutLufs - noMakeup.normalOutLufs;
  check('compressor makeup +6 dB delivers +6 dB on a loud source', Math.abs(delivered - 6) <= 0.5, `${delivered.toFixed(1)} dB`);
  // Mid-render changes need OfflineAudioContext.suspend(), which Firefox doesn't have; the
  // worklet doing the work is the same in both
  for (const id of browserType.name() === 'chromium' ? ['gentle', 'sleep'] : []) {
    const r = await page.evaluate(p => bench.volumeSteps(p, -14), id);
    check(`${id}: moving the volume while the limiter works never passes 0 dBFS`, r.outputPeakDbfs <= 0.01, `${r.outputPeakDbfs} dBFS`);
  }

  console.log('\nMeters');
  const offRun = await page.evaluate(() => bench.scenario('off'));
  check('"Taming starts here" is hidden when the guard is off', offRun.thresholdShown === false);
  for (const sourceDb of [-24, -14]) {
    const r = await page.evaluate(l => bench.scenario('stream', {}, { sourceDb: l }), sourceDb);
    // What the spike itself lost, on top of any comfortable-level cut that applies to everything
    const heard = Math.max(...Object.values(r.events).map(e => e.tamedBy)) + r.normalGainDb;
    check(`"biggest cut" matches what was heard (stream at ${sourceDb} LUFS)`, Math.abs(r.maxSpikeDb - heard) <= 2.5,
      `shows ${r.maxSpikeDb.toFixed(1)} dB, heard ${heard.toFixed(1)} dB`);
  }

  console.log('\nVolume is a plain gain after the guard: louder or quieter, taming stays the same');
  for (const id of ['gentle', 'stream', 'sleep', 'movie']) {
    const at = {};
    for (const volume of [-12, 0, 6, 12]) at[volume] = await page.evaluate(([p, v]) => bench.scenario(p, { volume: v }), [id, volume]);
    const louder = at[6].normalOutLufs - at[0].normalOutLufs;
    const quieter = at[-12].normalOutLufs - at[0].normalOutLufs;
    check(`${id}: +6 dB on the slider is +6 dB of normal talking`, Math.abs(louder - 6) <= 0.5, `${louder.toFixed(1)} dB`);
    check(`${id}: -12 dB on the slider is -12 dB of normal talking`, Math.abs(quieter + 12) <= 0.5, `${quieter.toFixed(1)} dB`);
    const sameTaming = ['yell', 'alert'].every(e => Math.abs(at[-12].events[e].outAboveNormal - at[0].events[e].outAboveNormal) <= 0.5);
    check(`${id}: spikes tamed the same at -12 dB`, sameTaming,
      ['yell', 'alert'].map(e => `${e} ${at[-12].events[e].outAboveNormal} vs ${at[0].events[e].outAboveNormal}`).join(', '));
    check(`${id}: never over 0 dBFS at +12 dB`, at[12].outputPeakDbfs <= 0.01, `${at[12].outputPeakDbfs} dBFS`);
  }
  for (const id of ['stream', 'sleep']) {
    const base = await page.evaluate(p => bench.scenario(p, { volume: 0 }), id);
    const up = await page.evaluate(p => bench.scenario(p, { volume: 6 }), id);
    const same = ['yell', 'alert'].every(e => Math.abs(up.events[e].outAboveNormal - base.events[e].outAboveNormal) <= 0.5);
    check(`${id}: spikes tamed the same at +6 dB`, same,
      ['yell', 'alert'].map(e => `${e} ${up.events[e].outAboveNormal} vs ${base.events[e].outAboveNormal}`).join(', '));
  }

  console.log('\nPage script (content-audio.js)');
  const pageScript = await browser.newPage();
  await pageScript.goto(`http://127.0.0.1:${port}/tests/page-script-bench.html`);
  await pageScript.waitForFunction(() => window.benchReady === true);
  await pageScript.click('#play');
  await pageScript.waitForTimeout(1500);
  const status = await pageScript.evaluate(() => window.pageStatus);
  check('player attaches once a slow-starting AudioContext runs, with no second click',
    status && status.attached === 1 && status.waitingForGesture === 0, JSON.stringify(status));

  // The site's own volume reaches Limitr before the guard: changing it must act like a plain gain,
  // and a new video must start with a fresh idea of normal
  const pageMeters = () => pageScript.evaluate(() => new Promise(resolve => {
    const id = Math.random();
    const onMessage = e => {
      if (e.data && e.data.source === 'limitr-page' && e.data.type === 'meters' && e.data.id === id) {
        window.removeEventListener('message', onMessage);
        resolve(e.data.meters);
      }
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ source: 'limitr-bridge', type: 'get-meters', id }, '*');
  }));
  await pageScript.waitForTimeout(1500);
  const before = await pageMeters();
  await pageScript.evaluate(() => { document.getElementById('player').volume = 0.5; });
  await pageScript.waitForTimeout(300);
  const after = await pageMeters();
  const shifted = after.baselineDb - before.baselineDb;
  check('the site halving its player volume moves normal by -6 dB at once', Math.abs(shifted + 6.02) <= 0.5,
    `${shifted.toFixed(2)} dB`);
  await pageScript.evaluate(() => {
    const player = document.getElementById('player');
    player.volume = 1;
    player.src = player.src;
    player.play();
  });
  await pageScript.waitForTimeout(150);
  const fresh = await pageMeters();
  check('new media starts with a fresh idea of normal', fresh.spikes === 0 && Math.abs(fresh.baselineDb + 23) < 0.01,
    JSON.stringify({ normal: fresh.baselineDb, spikes: fresh.spikes }));

  if (browserType.name() === 'chromium') {
    // A player the page routes through its own Web Audio graph can't be reached. Once the page
    // lets go of it, Limitr must not keep it alive.
    await pageScript.evaluate(async () => {
      const el = new Audio(document.getElementById('player').src);
      el.loop = true;
      const own = new NativeAudioContext();
      own.createMediaElementSource(el).connect(own.destination);
      await el.play();
      await new Promise(resolve => setTimeout(resolve, 400));
      window.unreachableRef = new WeakRef(el);
      el.pause();
      el.removeAttribute('src');
      el.load();
      await own.close();
    });
    await pageScript.waitForTimeout(300);
    const skipped = await pageScript.evaluate(() => window.pageStatus.skipped);
    for (let i = 0; i < 3; i++) {
      await pageScript.evaluate(() => gc());
      await pageScript.waitForTimeout(100);
    }
    const released = await pageScript.evaluate(() => window.unreachableRef.deref() === undefined);
    check('an unreachable player the page dropped is not kept in memory',
      skipped['page-audio'] === 1 && released, JSON.stringify({ skipped, released }));

    console.log('\nDebug harness');
    const harness = await browser.newPage();
    const harnessErrors = [];
    harness.on('pageerror', e => harnessErrors.push(e.message));
    await harness.goto(`http://127.0.0.1:${port}/tests/debug-harness.html`);
    await harness.setInputFiles('#file', { name: 'stream.wav', mimeType: 'audio/wav', buffer: streamWav(4) });
    await harness.waitForFunction(() => !document.getElementById('play').disabled);
    await harness.click('#play');
    await harness.waitForTimeout(2500);
    const canvasState = await harness.evaluate(() => {
      const g = document.getElementById('trace').getContext('2d');
      return { alpha: g.globalAlpha, dash: g.getLineDash().length };
    });
    await harness.click('#stop');
    check('live trace draws without errors', harnessErrors.length === 0, harnessErrors.join(' | '));
    check('drawing leaves the canvas state as it found it', canvasState.alpha === 1 && canvasState.dash === 0,
      JSON.stringify(canvasState));
    await harness.close();
  }

  await browser.close();
  return rows;
}

(async () => {
  const only = (process.argv.find(a => a.startsWith('--browser=')) || '').split('=')[1];
  checkCaptionPrefs();
  checkCaptionResampler();
  await checkLegacyUpgrade();
  await checkUpgradeFrom20();
  const { server, port } = await startStaticServer();
  try {
    for (const type of [chromium, firefox]) {
      if (only && type.name() !== only) continue;
      await runIn(type, port);
    }
  } finally {
    server.close();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
