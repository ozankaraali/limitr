#!/usr/bin/env node
// End-to-end checks with the real extension loaded in Chromium (Playwright's bundled build,
// which still accepts --load-extension). Run: node tests/run-extension-tests.js [--screenshots=DIR]

const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
const { startStaticServer } = require('./static-server');
const { streamWav } = require('./stream-audio');

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
    '/stream.wav': (req, res) => {
      const wav = streamWav();
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length });
      res.end(wav);
    },
    '/stream.html': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><body><button id="play">Play</button><audio id="a" src="/stream.wav" loop></audio>' +
        '<script>document.getElementById("play").onclick = () => document.getElementById("a").play();</script></body></html>');
    },
    '/remote-only.html': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body><button id="play">Play</button>
<audio id="remote" src="http://localhost:${port}/tone.wav" loop></audio>
<script>document.getElementById('play').onclick = () => document.getElementById('remote').play();</script>
</body></html>`);
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
    // Screenshots are used for the store and README, so render them at 2x
    deviceScaleFactor: screenshotDir ? 2 : 1,
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

    // Every screen in both themes, cropped to the popup's real height (README + store artwork)
    async function takeScreenshots() {
      await worker.evaluate(() => chrome.storage.local.set({ limitrCaptions: { language: 'tr', translateTo: 'en' } }));
      // A realistic stream (talking, an alert at 7 s, a yell at 14.5 s) instead of the test tones
      const streamTab = await context.newPage();
      await streamTab.goto(`http://127.0.0.1:${port}/stream.html`);
      const streamId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/stream.html' }))[0].id);
      await streamTab.click('#play');
      const shot = await context.newPage();
      await shot.setViewportSize({ width: 360, height: 600 });
      await shot.goto(`chrome-extension://${extensionId}/popup.html?tabId=${streamId}`);
      const save = async name => {
        const height = await shot.evaluate(() => Math.ceil(document.querySelector('.popup').getBoundingClientRect().height));
        await shot.screenshot({ path: path.join(screenshotDir, `${name}.png`), clip: { x: 0, y: 0, width: 360, height } });
      };
      const say = (text, translation) => worker.evaluate(m => chrome.runtime.sendMessage(m),
        { action: 'transcription-result', tabId: streamId, result: { text, translation } });
      const themes = [['dark', 'night'], ['light', 'day']];

      // Main screen right after the yell, while the alert and the yell are both in the trace
      await sleep(17000);
      for (const [scheme, tag] of themes) {
        await shot.emulateMedia({ colorScheme: scheme });
        await sleep(300);
        await save(`popup-main-${tag}`);
      }
      for (const [scheme, tag] of themes) {
        await shot.emulateMedia({ colorScheme: scheme });
        await shot.click('.nav-row[data-open="finetune"]');
        await sleep(400);
        await save(`popup-finetune-${tag}`);
        await shot.click('[data-screen="finetune"] .back');
        await shot.click('.nav-row[data-open="listening"]');
        await sleep(300);
        await save(`popup-listening-${tag}`);
        await shot.click('[data-screen="listening"] .back');
        await worker.evaluate(id => chrome.runtime.sendMessage({ action: 'transcription-status', tabId: id, status: 'active' }), streamId);
        await sleep(200);
        await shot.click('#captionsChip');
        await shot.evaluate(() => { document.getElementById('transcript').replaceChildren(); });
        await say('Herkese iyi ak\u015famlar, yay\u0131na ho\u015f geldiniz.', 'Good evening everyone, welcome to the stream.');
        await say('Bug\u00fcn biraz sessiz oynayaca\u011f\u0131z.', 'We\u2019ll keep it quiet tonight.');
        await sleep(300);
        await save(`popup-captions-${tag}`);
        await shot.click('[data-screen="captions"] .back');
        await worker.evaluate(id => chrome.runtime.sendMessage({ action: 'transcription-status', tabId: id, status: 'stopped' }), streamId);
      }
      // Sleep preset at night, after the stream loops back round to its alert and yell
      await shot.emulateMedia({ colorScheme: 'dark' });
      await shot.click('[role="radio"]:has-text("Sleep")');
      const loopedAt = 24000 + 16500;
      await sleep(Math.max(0, loopedAt - 17000 - 12000));
      await save('popup-sleep-night');
      await shot.click('[role="radio"]:has-text("Stream")');
      await shot.close();
      await streamTab.close();
      await worker.evaluate(() => chrome.storage.local.remove('limitrCaptions'));
    }

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

    console.log('\nToolbar icon');
    const iconState = id => worker.evaluate(t => (typeof tabIconStates === 'undefined' ? null : tabIconStates.get(t)), id);
    check('protected player plus an unreachable one: working (gold)', (await iconState(tabId)) === 'working', await iconState(tabId));
    const remoteTab = await context.newPage();
    await remoteTab.goto(`http://127.0.0.1:${port}/remote-only.html`);
    await sleep(500);
    const remoteId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/remote-only.html' }))[0].id);
    await remoteTab.click('#play');
    await sleep(1500);
    check('only an unreachable player plays: needs attention (red)', (await iconState(remoteId)) === 'attention', await iconState(remoteId));
    const remotePopup = await context.newPage();
    await remotePopup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${remoteId}`);
    await sleep(2000);
    const remoteStatus = await remotePopup.textContent('#status');
    check('popup says why it needs attention', /can\u2019t be reached/.test(remoteStatus), remoteStatus);
    await remotePopup.close();
    await remoteTab.evaluate(() => document.getElementById('remote').pause());
    await sleep(800);
    check('pausing it clears the red state', (await iconState(remoteId)) === 'on', await iconState(remoteId));
    await worker.evaluate(() => chrome.storage.local.set({ limitrEnabled: false }));
    await sleep(800);
    check('turning Limitr off: off (gray)', (await iconState(tabId)) === 'off', await iconState(tabId));
    await worker.evaluate(() => chrome.storage.local.set({ limitrEnabled: true }));
    await sleep(800);
    const newTab = await context.newPage();
    await newTab.goto('chrome://newtab/').catch(() => {});
    await sleep(800);
    const newTabId = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const t = tabs.find(x => (x.url || x.pendingUrl || '').startsWith('chrome://new'));
      return t && t.id;
    });
    check('browser pages never show red', (await iconState(newTabId)) !== 'attention', await iconState(newTabId));
    await newTab.close();
    await remoteTab.close();

    console.log('\nPopup');
    const popup = await context.newPage();
    const popupErrors = [];
    popup.on('pageerror', e => popupErrors.push(e.message));
    const popupRequests = [];
    popup.on('request', r => popupRequests.push(r.url()));
    popup.on('console', msg => { if (msg.type() === 'error') popupErrors.push(msg.text()); });
    await popup.setViewportSize({ width: 360, height: 640 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${tabId}`);
    await sleep(2500);
    const statusText = await popup.textContent('#status');
    check('popup reports the player is being tamed', /Taming/.test(statusText), statusText);
    const caption = await popup.textContent('#traceCaption');
    check('popup shows caught spikes', /CAUGHT \d+ spikes?\./.test(caption), caption);
    if (screenshotDir) await takeScreenshots();
    await popup.click('[role="radio"]:has-text("Sleep")');
    await sleep(400);
    const stored = await worker.evaluate(() => chrome.storage.local.get(['limitrSettings', 'limitrPreset']));
    check('preset click is saved', stored.limitrPreset === 'sleep' && stored.limitrSettings.guardHeadroom === 3);
    check('no popup errors', popupErrors.length === 0, popupErrors.join(' | '));

    console.log('\nMain screen');
    await popup.setViewportSize({ width: 360, height: 600 });
    const mainLayout = () => popup.evaluate(() => {
      const main = document.querySelector('.screen[data-screen="main"]');
      const rows = [...document.querySelectorAll('.nav-row')];
      const chipRow = document.querySelector('.chip-row');
      return {
        mainHeight: main ? main.scrollHeight : null,
        rowsVisible: rows.length === 2 && rows.every(r => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.bottom <= 600; }),
        presetIcons: document.querySelectorAll('#presetGrid .preset svg').length,
        levelOnMain: Boolean(main && main.querySelector('#levelEnabled')),
        chipOverflow: chipRow ? chipRow.scrollWidth - chipRow.clientWidth : null,
        more: Boolean(document.querySelector('.chip.more')),
        docWidth: document.documentElement.scrollWidth
      };
    });
    for (const scheme of ['dark', 'light']) {
      await popup.emulateMedia({ colorScheme: scheme });
      const l = await mainLayout();
      check(`${scheme}: main screen fits in 600 px`, l.mainHeight !== null && l.mainHeight <= 600, `${l.mainHeight} px`);
      check(`${scheme}: Fine-tune and listening rows visible without scrolling`, l.rowsVisible);
    }
    // Tabbing to the bottom row must not slide the main screen sideways
    await popup.focus('.nav-row[data-open="listening"]');
    const sideways = await popup.evaluate(() => {
      const main = document.querySelector('.screen[data-screen="main"]');
      return { scrollLeft: main.scrollLeft, overflow: main.scrollWidth - main.clientWidth };
    });
    check('main screen never scrolls sideways', sideways.scrollLeft === 0 && sideways.overflow <= 0, JSON.stringify(sideways));
    let layout = await mainLayout();
    check('six presets with line icons', layout.presetIcons === 6, layout.presetIcons);
    check('Even out levels is not on the main screen', !layout.levelOnMain);
    const longPresets = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`custom_test_${i}`, {
      name: `A long preset name 123${i}`, desc: 'Custom', settings: { guardHeadroom: 4 + i }
    }]));
    await worker.evaluate(p => chrome.storage.local.set({ limitrUserPresets: p }), longPresets);
    await popup.reload();
    await sleep(1500);
    layout = await mainLayout();
    check('eight long saved presets: main screen still fits', layout.mainHeight !== null && layout.mainHeight <= 600, `${layout.mainHeight} px`);
    check('saved presets stay on one line', layout.chipOverflow !== null && layout.chipOverflow <= 1, layout.chipOverflow);
    check('extra saved presets collapse into "+N"', layout.more);
    check('no horizontal overflow with long preset names', layout.docWidth <= 360, layout.docWidth);
    await worker.evaluate(() => chrome.storage.local.remove('limitrUserPresets'));

    console.log('\nSecondary screens');
    const visible = sel => popup.evaluate(q => {
      const el = document.querySelector(q);
      return Boolean(el && !el.closest('[hidden]') && el.getClientRects().length);
    }, sel);
    const overflow = () => popup.evaluate(() => {
      const scroller = document.querySelector('.popup');
      return { doc: document.documentElement.scrollWidth, inner: scroller.scrollWidth - scroller.clientWidth };
    });
    await popup.click('.nav-row[data-open="finetune"]');
    await sleep(400);
    check('Fine-tune opens as its own screen', (await visible('[data-screen="finetune"]')) && !(await visible('[data-screen="main"]')));
    check('Fine-tune shows the live loudness strip', await visible('#miniTrace'));
    check('Fine-tune sections have icons', (await popup.$$eval('[data-screen="finetune"] .gi svg', els => els.length)) === 6);
    const guardSliders = ['guardHeadroom', 'guardCeiling', 'guardRatio', 'guardAttack', 'guardHold', 'guardRelease'];
    const presentSliders = await popup.evaluate(ids => ids.filter(id => document.getElementById(`ctl-${id}`)), guardSliders);
    check('all six Spike guard sliders are there', presentSliders.length === 6, presentSliders.join(', '));
    await popup.evaluate(() => {
      const slider = document.getElementById('ctl-guardHeadroom');
      slider.value = 8;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await sleep(300);
    const tuned = await worker.evaluate(() => chrome.storage.local.get('limitrSettings'));
    check('a Fine-tune slider change is saved', tuned.limitrSettings && tuned.limitrSettings.guardHeadroom === 8,
      tuned.limitrSettings && tuned.limitrSettings.guardHeadroom);
    let o = await overflow();
    check('Fine-tune: no horizontal overflow', o.doc <= 360 && o.inner <= 0, JSON.stringify(o));
    const mini = () => popup.evaluate(() => {
      const c = document.getElementById('miniTrace');
      if (!c) return null;
      const px = c.getContext('2d').getImageData(c.width - 4, c.height - 3, 1, 1).data;
      return Array.from(px).join(',');
    });
    await popup.emulateMedia({ colorScheme: 'dark' });
    await sleep(300);
    const darkPixel = await mini();
    await popup.emulateMedia({ colorScheme: 'light' });
    await sleep(300);
    const lightPixel = await mini();
    check('live strip redraws in the new theme', darkPixel !== lightPixel && darkPixel !== '0,0,0,0', `${darkPixel} vs ${lightPixel}`);
    await popup.click('[data-screen="finetune"] .back');
    check('back returns to the main screen', await visible('[data-screen="main"]'));
    await popup.click('.nav-row[data-open="finetune"]');
    await popup.keyboard.press('Escape');
    await sleep(200);
    check('Esc returns to the main screen', await visible('[data-screen="main"]'));
    await popup.click('.nav-row[data-open="listening"]');
    await sleep(300);
    check('listening screen shows both modes', (await popup.$$eval('[data-screen="listening"] .mode-option', els => els.filter(e => e.getClientRects().length).length)) === 2);
    o = await overflow();
    check('listening: no horizontal overflow', o.doc <= 360 && o.inner <= 0, JSON.stringify(o));
    await popup.click('.nav-row[data-open="finetune"]').catch(() => {});
    await popup.reload();
    await sleep(800);
    check('popup reopens on the main screen', await visible('[data-screen="main"]'));

    const restricted = await context.newPage();
    await restricted.goto('chrome://newtab/').catch(() => {});
    const restrictedId = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const t = tabs.find(x => (x.url || x.pendingUrl || '').startsWith('chrome://new'));
      return t && t.id;
    });
    const rPopup = await context.newPage();
    await rPopup.setViewportSize({ width: 360, height: 600 });
    await rPopup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${restrictedId}`);
    await sleep(1200);
    const rStatus = await rPopup.textContent('#status');
    check('restricted tab: main screen explains it can’t be processed', /can\u2019t be processed/.test(rStatus), rStatus);
    await rPopup.click('.nav-row[data-open="finetune"]');
    check('restricted tab: Fine-tune still opens', await rPopup.evaluate(() => !document.querySelector('[data-screen="finetune"]').hidden));
    await rPopup.close();
    await restricted.close();

    console.log('\nCaptions screen');
    // Drive the popup with the transcriber's own messages instead of downloading a speech model
    await worker.evaluate(id => chrome.runtime.sendMessage({ action: 'transcription-status', tabId: id, status: 'active' }), tabId);
    await sleep(300);
    check('captions on: the language chip shows', await visible('#captionsChip'));
    await popup.click('#captionsChip').catch(() => {});
    await sleep(300);
    check('the chip opens the captions screen', await visible('[data-screen="captions"]'));
    check('Language and Translate to are on it', (await visible('#captionsLanguage')) && (await visible('#captionsTranslate')));
    await worker.evaluate(id => chrome.runtime.sendMessage({
      action: 'transcription-result', tabId: id,
      result: { text: 'Herkese iyi ak\u015famlar', translation: 'Good evening everyone' }
    }), tabId);
    await sleep(300);
    const lines = await popup.$$eval('#transcript li', items => items.map(li => ({
      orig: li.querySelector('.orig') && li.querySelector('.orig').textContent,
      tr: li.querySelector('.tr') && li.querySelector('.tr').textContent
    })));
    const last = lines[lines.length - 1] || {};
    check('transcript shows the original with its translation under it',
      last.orig === 'Herkese iyi ak\u015famlar' && last.tr === 'Good evening everyone', JSON.stringify(last));
    o = await overflow();
    check('captions: no horizontal overflow', o.doc <= 360 && o.inner <= 0, JSON.stringify(o));
    check('captions screen has a way back', await visible('[data-screen="captions"] .back'));
    await popup.click('[data-screen="captions"] .back').catch(() => {});
    await worker.evaluate(id => chrome.runtime.sendMessage({ action: 'transcription-status', tabId: id, status: 'stopped' }), tabId);

    console.log('\nTheme');
    const bodyBackground = () => popup.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await popup.emulateMedia({ colorScheme: 'dark' });
    check('night theme background is cool graphite', (await bodyBackground()) === 'rgb(28, 29, 33)', await bodyBackground());
    await popup.emulateMedia({ colorScheme: 'light' });
    check('day theme background is warm paper', (await bodyBackground()) === 'rgb(246, 244, 239)', await bodyBackground());
    await popup.emulateMedia({ colorScheme: 'dark' });
    const spike = await popup.evaluate(() => (typeof themeColors === 'function' ? themeColors().spike : null));
    check('canvas colours follow the theme (night spike gold)', ['#f0b84a', 'rgb(240, 184, 74)'].includes(spike), spike);
    // fonts.check() is true when no face matches at all, so look for a loaded Plex face instead
    const plex = await popup.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some(f => f.family.replace(/["']/g, '') === 'IBM Plex Sans' && f.status === 'loaded');
    });
    check('IBM Plex Sans is loaded', plex);
    const remote = popupRequests.filter(url => !url.startsWith('chrome-extension://'));
    check('popup makes no network requests', remote.length === 0, remote.join(' | '));

    console.log('\nWhole-tab capture mode');
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
