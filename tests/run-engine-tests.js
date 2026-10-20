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
  gentle: { maxYellAbove: 11, maxAlertAbove: 12 },
  stream: { maxYellAbove: 7.5, maxAlertAbove: 8 },
  sleep: { maxYellAbove: 5, maxAlertAbove: 5.5 },
  movie: { maxYellAbove: 9.5, maxAlertAbove: 10 },
  tv90s: { maxYellAbove: 9, maxAlertAbove: 9 }
};
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
  check('the larger 410 MB model is off until chosen', S.normalizeCaptions(null, 'en').largeModel === false);
  check('choosing the larger model is kept', S.normalizeCaptions({ largeModel: true }, 'en').largeModel === true);
  check('anything else is not a yes', S.normalizeCaptions({ largeModel: 'yes' }, 'en').largeModel === false);
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

  console.log('\nTransparency');
  const bypass = await page.evaluate(() => bench.bypassExact());
  check(`disabled = bit-exact passthrough (max diff ${bypass.maxDiff})`, bypass.maxDiff === 0);
  const off = await page.evaluate(() => bench.offTransparent());
  check(`"Off" preset = pure delay (${off.latencyMs} ms latency, max diff ${off.maxDiff.toExponential(2)})`, off.maxDiff < 1e-6 && off.latencyMs < 20);

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

  console.log('\nPage script (content-audio.js)');
  const pageScript = await browser.newPage();
  await pageScript.goto(`http://127.0.0.1:${port}/tests/page-script-bench.html`);
  await pageScript.waitForFunction(() => window.benchReady === true);
  await pageScript.click('#play');
  await pageScript.waitForTimeout(1500);
  const status = await pageScript.evaluate(() => window.pageStatus);
  check('player attaches once a slow-starting AudioContext runs, with no second click',
    status && status.attached === 1 && status.waitingForGesture === 0, JSON.stringify(status));

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
