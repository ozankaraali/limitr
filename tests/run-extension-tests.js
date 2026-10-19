#!/usr/bin/env node
// End-to-end checks with the real extension loaded in Chromium (Playwright's bundled build,
// which still accepts --load-extension). Run: node tests/run-extension-tests.js [--screenshots=DIR]

const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
const { startStaticServer } = require('./static-server');

const EXTENSION = path.join(__dirname, '..');
// Unpacked extension IDs derive from the path; allowlisting it lets tabCapture run without
// the user clicking the toolbar icon (which a headless test can't do).
const EXTENSION_ID = require('crypto').createHash('sha256').update(EXTENSION).digest('hex')
  .slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
const screenshotDir = (process.argv.find(a => a.startsWith('--screenshots=')) || '').split('=')[1];

// 12 s mono WAV: quiet "talking" tone with two loud bursts (the spikes)
function makeWav() {
  const fs_ = 48000;
  const seconds = 12;
  const n = fs_ * seconds;
  const data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + n * 2, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(fs_, 24);
  data.writeUInt32LE(fs_ * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / fs_;
    const burst = (t > 4 && t < 5) || (t > 9 && t < 10);
    const syllable = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t);
    const v = burst
      ? 0.6 * Math.sin(2 * Math.PI * 1200 * t)
      : 0.04 * syllable * Math.sin(2 * Math.PI * 330 * t);
    data.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return data;
}

const WAV = makeWav();
const sendWav = (req, res) => {
  res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': WAV.length });
  res.end(WAV);
};

const page = crossOrigin => `<!DOCTYPE html><html><body>
<button id="play">Play</button>
<audio id="local" src="/tone.wav" loop></audio>
<audio id="remote" src="${crossOrigin}/tone.wav" loop></audio>
<iframe id="frame" src="/frame.html" width="300" height="80"></iframe>
<script>
document.getElementById('play').addEventListener('click', () => {
  document.getElementById('local').play();
  document.getElementById('remote').play();
});
</script></body></html>`;

const frame = `<!DOCTYPE html><html><body>
<button id="play">Play in frame</button>
<audio id="framed" src="/tone.wav" loop></audio>
<script>document.getElementById('play').onclick = () => document.getElementById('framed').play();</script>
</body></html>`;

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  let port = 0;
  const routes = {
    '/tone.wav': sendWav,
    '/page.html': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page(`http://localhost:${port}`));
    },
    '/frame.html': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(frame);
    }
  };
  const started = await startStaticServer(undefined, routes);
  port = started.port;
  const server = started.server;

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    // Playwright's default --mute-audio also silences what tab capture receives, so unmute but
    // send output to a fake device: capture still gets audio and nothing reaches the speakers
    ignoreDefaultArgs: ['--mute-audio'],
    args: [
      '--disable-audio-output',
      '--disable-gpu',
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      `--allowlisted-extension-id=${EXTENSION_ID}`
    ]
  });

  try {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    worker.on('console', m => { if (m.type() === 'error') console.log('  [sw]', m.text()); });

    const tab = await context.newPage();
    const pageErrors = [];
    tab.on('pageerror', e => pageErrors.push(e.message));
    tab.on('console', m => {
      if (m.type() === 'error' && !/favicon|status of 404/.test(m.text() + (m.location().url || ''))) pageErrors.push(m.text());
    });
    await tab.goto(`http://127.0.0.1:${port}/page.html`);
    await sleep(500);

    console.log('\nPage mode');
    const tabId = await worker.evaluate(async () => {
      const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      return t.id;
    });
    const frameStatus = () => worker.evaluate(async (id) => {
      const results = await chrome.scripting.executeScript({
        target: { tabId: id, allFrames: true },
        func: () => globalThis.__limitrBridgeStatus || null
      });
      return results.map(r => ({ frameId: r.frameId, ...r.result }));
    }, tabId);
    const meters = (frameId = 0) => worker.evaluate(({ id, frameId: f }) =>
      chrome.tabs.sendMessage(id, { action: 'limitr-get-meters' }, { frameId: f }), { id: tabId, frameId });

    let status = await frameStatus();
    check('content scripts present in page and iframe', status.length === 2 && status.every(s => s.attached === 0),
      JSON.stringify(status));

    await tab.click('#play');
    await tab.frameLocator('#frame').locator('#play').click();
    await sleep(1500);

    status = await frameStatus();
    const top = status.find(s => s.frameId === 0);
    const inner = status.find(s => s.frameId !== 0);
    check('same-origin player is processed', top.attached === 1, JSON.stringify(top));
    check('cross-origin player without CORS is left alone', (top.skipped || {})['cross-origin'] === 1);
    check('player inside an iframe is processed', inner && inner.attached === 1, JSON.stringify(inner));
    const remotePlaying = await tab.evaluate(() => !document.getElementById('remote').paused);
    check('skipped player keeps playing', remotePlaying);

    let m = await meters(0);
    check('engine running with the spike guard worklet', m && m.dsp === 'worklet' && m.contextState === 'running',
      m && `${m.dsp}, ${m.contextState}`);
    await sleep(5000);
    m = await meters(0);
    check('loud burst counted as a caught spike', m && m.spikes >= 1, m && `spikes=${m.spikes}, biggest=${m.maxSpikeDb?.toFixed(1)} dB`);
    check('normal level learned', m && m.baselineDb > -45 && m.baselineDb < -15, m && `${m.baselineDb?.toFixed(1)} LUFS`);

    console.log('\nLive settings');
    await worker.evaluate(() => chrome.storage.local.set({ limitrEnabled: false }));
    await sleep(1500);
    m = await meters(0);
    check('turning Limitr off bypasses processing without reload', m && m.inDb < -60, m && `in ${m.inDb?.toFixed(1)}`);
    await worker.evaluate(() => chrome.storage.local.set({ limitrEnabled: true }));
    await sleep(800);
    m = await meters(0);
    check('turning it back on resumes processing', m && m.inDb > -60, m && `in ${m.inDb?.toFixed(1)}`);
    const { limitrSettings } = await worker.evaluate(() => chrome.storage.local.get('limitrSettings'));
    await worker.evaluate((s) => chrome.storage.local.set({ limitrSettings: { ...s, guardHeadroom: 2 } }), limitrSettings);
    await sleep(800);
    m = await meters(0);
    check('setting change reaches the running engine', m && Math.abs(m.thresholdDb - Math.min(m.baselineDb + 2, limitrSettings.guardCeiling)) < 1.5,
      m && `threshold ${m.thresholdDb?.toFixed(1)}, normal ${m.baselineDb?.toFixed(1)}`);
    await worker.evaluate((s) => chrome.storage.local.set({ limitrSettings: s }), limitrSettings);

    check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

    console.log('\nPopup');
    const popup = await context.newPage();
    const popupErrors = [];
    popup.on('pageerror', e => popupErrors.push(e.message));
    popup.on('console', msg => { if (msg.type() === 'error') popupErrors.push(msg.text()); });
    await popup.setViewportSize({ width: 360, height: 640 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${tabId}`);
    await sleep(2500);
    const statusText = await popup.textContent('#status');
    check('popup reports the player is being tamed', /Taming/.test(statusText), statusText);
    const caption = await popup.textContent('#traceCaption');
    check('popup shows caught spikes', /Caught/.test(caption), caption);
    if (screenshotDir) {
      await popup.screenshot({ path: path.join(screenshotDir, 'popup-main.png'), fullPage: true });
      await popup.click('#fineTune > summary');
      await sleep(300);
      await popup.screenshot({ path: path.join(screenshotDir, 'popup-finetune.png'), fullPage: true });
      await popup.click('#processing > summary');
      await sleep(300);
      await popup.screenshot({ path: path.join(screenshotDir, 'popup-processing.png'), fullPage: true });
    }
    await popup.click('[role="radio"]:has-text("Sleep")');
    await sleep(400);
    const stored = await worker.evaluate(() => chrome.storage.local.get(['limitrSettings', 'limitrPreset']));
    check('preset click is saved', stored.limitrPreset === 'sleep' && stored.limitrSettings.guardHeadroom === 3);
    check('no popup errors', popupErrors.length === 0, popupErrors.join(' | '));

    console.log('\nWhole-tab capture mode');
    await popup.click('#processing > summary').catch(() => {});
    await worker.evaluate(() => chrome.storage.local.set({ limitrMode: 'capture' }));
    const captureResult = await worker.evaluate(id => captureTab(id).then(() => 'ok', e => e.message), tabId);
    check('tab capture starts', captureResult === 'ok', captureResult);
    await sleep(3000);
    const captureMeters = await worker.evaluate(id => chrome.runtime.sendMessage({ target: 'offscreen', action: 'capture-meters', tabId: id }), tabId);
    const cm = captureMeters && captureMeters.meters;
    check('captured audio runs through the engine', cm && cm.dsp === 'worklet' && cm.inDb > -60, cm && `${cm.dsp}, in ${cm.inDb?.toFixed(1)}`);
    m = await meters(0);
    check('page-mode engine steps aside while captured', m && m.inDb < -60, m && `page in ${m.inDb?.toFixed(1)}`);
    await sleep(3500);
    const cm2 = (await worker.evaluate(id => chrome.runtime.sendMessage({ target: 'offscreen', action: 'capture-meters', tabId: id }), tabId)).meters;
    check('capture engine catches the bursts', cm2 && cm2.spikes >= 1, cm2 && `spikes=${cm2.spikes}`);
    await worker.evaluate(() => chrome.storage.local.set({ limitrMode: 'page' }));
    await sleep(1500);
    const listAfter = await worker.evaluate(() => capturedTabIds());
    check('switching back to page mode releases the tab', listAfter.length === 0, JSON.stringify(listAfter));
    m = await meters(0);
    check('page-mode engine resumes', m && m.inDb > -60, m && `page in ${m.inDb?.toFixed(1)}`);
  } finally {
    await context.close();
    server.close();
  }

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
