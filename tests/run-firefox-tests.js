#!/usr/bin/env node
// End-to-end checks in a real Firefox with dist/firefox installed as a temporary add-on.
// Needs puppeteer-core (npm i -D puppeteer-core) and Firefox 128+.
// Run: node build-firefox.js --test && node tests/run-firefox-tests.js [--firefox=/path/to/firefox] [--captions]
//   --captions  also checks live captions with real speech (macOS `say`; downloads the models)

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const puppeteer = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const { startStaticServer } = require('./static-server');

const DIST = path.join(__dirname, '..', 'dist', 'firefox-test');
const ADDON_ID = 'limitr@ozankaraali.dev';
const UUID = '6b0c3f1e-2f4f-4a51-9d55-6c1d1a4c7e01';
const FIREFOX = (process.argv.find(a => a.startsWith('--firefox=')) || '').split('=')[1] ||
  (process.platform === 'darwin' ? '/Applications/Firefox.app/Contents/MacOS/firefox' : 'firefox');

function makeWav() {
  const fs_ = 48000;
  const n = fs_ * 12;
  const data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 2, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(fs_, 24); data.writeUInt32LE(fs_ * 2, 28); data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / fs_;
    const burst = (t > 4 && t < 5) || (t > 9 && t < 10);
    const v = burst ? 0.6 * Math.sin(2 * Math.PI * 1200 * t)
      : 0.04 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t)) * Math.sin(2 * Math.PI * 330 * t);
    data.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return data;
}

const SPEECH = {
  en: { voice: null, text: 'Good evening everyone. Thanks for watching the stream tonight. Remember to stay hydrated and get some sleep.' },
  tr: { voice: 'Yelda', text: 'İyi akşamlar herkese. Bu gece yayını izlediğiniz için teşekkürler. Bol su için ve biraz uyuyun.' }
};

function synthesize(lang) {
  const { voice, text } = SPEECH[lang];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-speech-'));
  try {
    execFileSync('say', [...(voice ? ['-v', voice] : []), '-o', path.join(dir, 's.aiff'), text]);
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@48000', path.join(dir, 's.aiff'), path.join(dir, 's.wav')]);
    return fs.readFileSync(path.join(dir, 's.wav'));
  } catch (e) {
    return null;
  }
}

const words = s => s.toLocaleLowerCase('tr').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
function wordRecall(lang, captions) {
  const heard = new Set(words(captions.join(' ')));
  const expected = words(SPEECH[lang].text);
  return expected.filter(w => heard.has(w)).length / expected.length;
}

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const WAV = makeWav();
  const withCaptions = process.argv.includes('--captions');
  const speech = withCaptions ? { en: synthesize('en'), tr: synthesize('tr') } : {};
  let port = 0;
  const html = body => (req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(body()); };
  const { server, port: p } = await startStaticServer(undefined, {
    '/tone.wav': (req, res) => { res.writeHead(200, { 'Content-Type': 'audio/wav' }); res.end(WAV); },
    '/page.html': html(() => `<!DOCTYPE html><html><body><button id="play">Play</button>
      <audio id="local" src="/tone.wav" loop></audio>
      <audio id="remote" src="http://localhost:${port}/tone.wav" loop></audio>
      <iframe id="frame" src="/frame.html"></iframe>
      <script>play.onclick = () => { local.play(); remote.play(); };</script></body></html>`),
    '/en.wav': (req, res) => { res.writeHead(200, { 'Content-Type': 'audio/wav' }); res.end(speech.en || WAV); },
    '/tr.wav': (req, res) => { res.writeHead(200, { 'Content-Type': 'audio/wav' }); res.end(speech.tr || WAV); },
    '/speech.html': html(() => `<!DOCTYPE html><html><body><button id="en">English</button><button id="tr">Turkish</button>
      <audio id="a-en" src="/en.wav" loop></audio><audio id="a-tr" src="/tr.wav" loop></audio>
      <script>for (const l of ['en', 'tr']) document.getElementById(l).onclick = () => {
        document.querySelectorAll('audio').forEach(a => a.pause()); const a = document.getElementById('a-' + l); a.currentTime = 0; a.play(); };</script></body></html>`),
    '/remote-only.html': html(() => `<!DOCTYPE html><html><body><button id="play">Play</button>
      <audio id="remote" src="http://localhost:${port}/tone.wav" loop></audio>
      <script>play.onclick = () => remote.play();</script></body></html>`),
    '/frame.html': html(() => `<!DOCTYPE html><html><body><button id="play">Play</button>
      <audio id="framed" src="/tone.wav" loop></audio>
      <script>play.onclick = () => framed.play();</script></body></html>`)
  });
  port = p;

  const browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath: FIREFOX,
    headless: true,
    extraPrefsFirefox: {
      // Audio is still processed, just scaled to silence at the output. (A null audio device,
      // media.cubeb.force_null_context, would stop real-time Web Audio from running at all.)
      'media.volume_scale': '0.0',
      // No WebGPU: speech-model GPU runs have crashed Firefox's GPU process
      'dom.webgpu.enabled': false,
      'extensions.webextensions.uuids': JSON.stringify({ [ADDON_ID]: UUID })
    }
  });

  try {
    await browser.installExtension(DIST);
    console.log(`\n=== ${await browser.version()}`);

    const tab = await browser.newPage();
    const pageErrors = [];
    tab.on('pageerror', e => pageErrors.push(e.message));
    await tab.goto(`http://127.0.0.1:${port}/page.html`);
    await sleep(800);

    // Extension APIs are reached through the test agent (BiDi can't open moz-extension pages)
    const askIn = (page, query) => page.evaluate(q => new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      const onReply = (event) => {
        const reply = event.data && event.data.limitrTestReply;
        if (!reply || reply.id !== id) return;
        window.removeEventListener('message', onReply);
        if (reply.error) reject(new Error(reply.error)); else resolve(reply.result);
      };
      window.addEventListener('message', onReply);
      window.postMessage({ limitrTestQuery: { id, query: q } }, '*');
    }), query);
    const ask = query => askIn(tab, query);
    const frameStatus = () => ask({ op: 'frame-status' });
    const meters = frameId => ask({ op: 'meters', frameId });

    console.log('\nPage mode');
    let status = await frameStatus();
    check('content scripts present in page and iframe', status.length === 2, JSON.stringify(status));

    await tab.click('#play');
    const frame = tab.frames().find(f => f.url().endsWith('/frame.html'));
    await frame.click('#play');
    await sleep(1500);

    status = await frameStatus();
    const top = status.find(s => s.frameId === 0) || {};
    const inner = status.find(s => s.frameId !== 0) || {};
    check('same-origin player is processed', top.attached === 1, JSON.stringify(top));
    check('cross-origin player without CORS is left alone', (top.skipped || {})['cross-origin'] === 1);
    check('player inside an iframe is processed', inner.attached === 1, JSON.stringify(inner));

    let m = await meters(0);
    check('engine running with the spike guard worklet', m && m.dsp === 'worklet' && m.contextState === 'running',
      m && `${m.dsp}, ${m.contextState}`);
    await sleep(5000);
    m = await meters(0);
    check('loud burst counted as a caught spike', m && m.spikes >= 1, m && `spikes=${m.spikes}`);

    console.log('\nLive settings');
    await ask({ op: 'storage-set', values: { limitrEnabled: false } });
    await sleep(1500);
    m = await meters(0);
    check('turning Limitr off bypasses processing without reload', m && m.inDb < -60, m && `in ${m.inDb?.toFixed(1)}`);
    await ask({ op: 'storage-set', values: { limitrEnabled: true } });
    await sleep(1000);
    m = await meters(0);
    check('turning it back on resumes processing', m && m.inDb > -60, m && `in ${m.inDb?.toFixed(1)}`);

    console.log('\nToolbar icon');
    const remoteTab = await browser.newPage();
    await remoteTab.goto(`http://127.0.0.1:${port}/remote-only.html`);
    await sleep(800);
    await remoteTab.click('#play');
    await sleep(1500);
    const remoteIcon = await askIn(remoteTab, { op: 'icon-state' });
    check('unreachable player in Firefox: not red (Whole tab is not available here)', remoteIcon === 'on', remoteIcon);
    await remoteTab.close();

    console.log('\nPopup');
    const popup = await ask({ op: 'popup' });
    check('popup reports the player is being tamed', popup && /Taming/.test(popup.status), popup && popup.status);
    check('popup shows caught spikes', popup && /CAUGHT \d+ spikes?\./.test(popup.caption), popup && popup.caption);
    check('whole-tab capture is offered as unavailable', popup && popup.captureDisabled);
    check('captions: no translation offered (Firefox has no on-device translator)', popup && popup.translateShown === false);
    check('captions: faster and standard models offered, not the graphics-card one',
      popup && popup.models && popup.models.join() === 'fast,standard', popup && popup.models && popup.models.join());
    const metrics = await ask({ op: 'popup-metrics' });
    const noOverflow = m => m.docScrollW <= m.docClientW && m.innerScrollW <= m.innerClientW;
    check('popup has no horizontal scrollbar', metrics && noOverflow(metrics.closed), metrics && JSON.stringify(metrics.closed));
    for (const screen of ['finetune', 'listening', 'captions']) {
      check(`no horizontal scrollbar on the ${screen} screen`, metrics && metrics[screen] && noOverflow(metrics[screen]),
        metrics && JSON.stringify(metrics[screen]));
    }
    check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

    if (withCaptions && speech.en) {
      console.log('\nCaptions (hosted in the background page)');
      await tab.goto(`http://127.0.0.1:${port}/speech.html`);
      await sleep(800);
      // Only captions produced after the click count. Each run starts in silence, once sentences
      // still in flight from the last run are out (a Whisper call can't be cut short), and plays
      // its recording from the start
      const play = async (lang, seconds) => {
        await tab.evaluate(() => document.querySelectorAll('audio').forEach(a => a.pause()));
        for (let quietMs = 0, waitedMs = 0; quietMs < 3000 && waitedMs < 30000; waitedMs += 500) {
          await sleep(500);
          quietMs = (await ask({ op: 'caption-results' })).length ? 0 : quietMs + 500;
        }
        const clicked = Date.now();
        await tab.click(`#${lang}`);
        await sleep(seconds * 1000);
        return (await ask({ op: 'caption-results' })).filter(r => r.final && r.timestamp > clicked);
      };
      await ask({ op: 'storage-set', values: { limitrCaptions: { language: 'en', translateTo: '' } } });
      const start = await ask({ op: 'captions-start' });
      check('captions start', start && start.success);
      let finals = await play('en', 16);
      check('English captions match the spoken words', wordRecall('en', finals.map(r => r.text)) >= 0.6,
        `${Math.round(wordRecall('en', finals.map(r => r.text)) * 100)}%, ${finals.map(r => r.latencyMs).join('/')} ms per sentence`);
      if (speech.tr) {
        await ask({ op: 'storage-set', values: { limitrCaptions: { language: 'tr', translateTo: '' } } });
        await sleep(500);
        finals = await play('tr', 26);
        check('Turkish captions match the spoken words', wordRecall('tr', finals.map(r => r.text)) >= 0.6,
          `${Math.round(wordRecall('tr', finals.map(r => r.text)) * 100)}%, ${finals.map(r => r.latencyMs).join('/')} ms per sentence`);
        await ask({ op: 'storage-set', values: { limitrCaptions: { language: 'tr', translateTo: '', model: 'fast' } } });
        await sleep(500);
        finals = await play('tr', 26);
        check('the faster model gets most Turkish words', wordRecall('tr', finals.map(r => r.text)) >= 0.5,
          `${Math.round(wordRecall('tr', finals.map(r => r.text)) * 100)}%, ${finals.map(r => r.latencyMs).join('/')} ms per sentence`);
        await ask({ op: 'storage-set', values: { limitrCaptions: { language: 'auto', translateTo: '' } } });
        await sleep(500);
        await ask({ op: 'caption-statuses' });
        finals = await play('tr', 26);
        const detected = (await ask({ op: 'caption-statuses' })).find(m => m.status === 'language');
        check('Auto picks Turkish for Turkish speech', detected && detected.language === 'tr', detected && detected.language);
        await ask({ op: 'storage-set', values: { limitrCaptions: { language: 'tr', translateTo: 'en' } } });
        await sleep(500);
        finals = await play('tr', 26);
        // A translation setting saved in another browser profile must not switch Firefox to English
        check('a stored translation setting is ignored: captions stay Turkish',
          finals.length > 0 && finals.every(r => !r.translatedFrom && !r.translation) && wordRecall('tr', finals.map(r => r.text)) >= 0.6,
          JSON.stringify(finals.map(r => r.text)));
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
