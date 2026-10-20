#!/usr/bin/env node
// Live-captions checks with real speech, in Chromium with the extension loaded: English
// (Moonshine), Turkish (Whisper), automatic language detection, and translation into English.
// Speech is synthesized with macOS `say` (Turkish needs the Yelda voice). Models download on
// the first run and are cached in a reused browser profile.
// Run: node tests/run-captions-tests.js [--idle] [--fresh]
//   --idle   also waits 40 s with nothing playing to check the caption host stays alive
//   --fresh  start from an empty browser profile (re-downloads the models)

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { startStaticServer } = require('./static-server');

const EXTENSION = path.join(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const SPEECH = {
  en: { voice: null, text: 'Good evening everyone. Thanks for watching the stream tonight. Remember to stay hydrated and get some sleep.' },
  tr: { voice: 'Yelda', text: 'İyi akşamlar herkese. Bu gece yayını izlediğiniz için teşekkürler. Bol su için ve biraz uyuyun.' }
};
// Words a decent English translation of the Turkish sentence should contain
const TRANSLATION_WORDS = ['good', 'evening', 'everyone', 'thank', 'watching', 'water', 'sleep'];

function synthesize(lang) {
  const { voice, text } = SPEECH[lang];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-speech-'));
  try {
    const args = voice ? ['-v', voice] : [];
    execFileSync('say', [...args, '-o', path.join(dir, 's.aiff'), text]);
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@48000', path.join(dir, 's.aiff'), path.join(dir, 's.wav')]);
    return fs.readFileSync(path.join(dir, 's.wav'));
  } catch (e) {
    return null;
  }
}

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

const words = s => s.toLocaleLowerCase('tr').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
// Fraction of the spoken sentence's words that show up in the captions
function wordRecall(lang, captions) {
  const heard = new Set(words(captions.join(' ')));
  const expected = words(SPEECH[lang].text);
  return expected.filter(w => heard.has(w)).length / expected.length;
}

(async () => {
  const audio = { en: synthesize('en'), tr: synthesize('tr') };
  if (!audio.en) {
    console.log('No speech synthesizer here (macOS `say`), skipping caption tests.');
    process.exit(0);
  }
  const { server, port } = await startStaticServer(undefined, {
    '/en.wav': (req, res) => { res.writeHead(200, { 'Content-Type': 'audio/wav' }); res.end(audio.en); },
    '/tr.wav': (req, res) => { res.writeHead(200, { 'Content-Type': 'audio/wav' }); res.end(audio.tr || audio.en); },
    '/page.html': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<button id="en">English</button><button id="tr">Türkçe</button>' +
        '<audio id="a-en" src="/en.wav" loop></audio><audio id="a-tr" src="/tr.wav" loop></audio>' +
        '<script>for (const l of ["en", "tr"]) document.getElementById(l).onclick = () => {' +
        'document.querySelectorAll("audio").forEach(a => a.pause()); const a = document.getElementById("a-" + l); a.currentTime = 0; a.play(); };</script>');
    }
  });

  const profile = path.join(os.tmpdir(), 'limitr-captions-profile');
  if (process.argv.includes('--fresh')) fs.rmSync(profile, { recursive: true, force: true });
  // A run that was killed leaves the profile locked; Chromium then hangs on launch
  for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    fs.rmSync(path.join(profile, lock), { force: true });
  }
  console.log('Launching Chromium with the extension\u2026');
  // Muted (Playwright's default) and GPU-free: page audio still reaches the extension's
  // Web Audio graph, and Whisper must run on WASM here (WebGPU runs crashed a GPU process)
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, '--disable-gpu', '--disable-audio-output']
  });

  try {
    // Everything goes through an extension page: with a reused profile Chrome may stop the
    // idle service worker, and evaluating in a stopped worker never returns.
    const extensionId = require('crypto').createHash('sha256').update(EXTENSION).digest('hex')
      .slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
    const tab = await context.newPage();
    await tab.goto(`http://127.0.0.1:${port}/page.html`);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const tabId = await popup.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/*' }))[0].id);
    // An extension page standing in for the popup: sends commands, collects results
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${tabId}`);
    await popup.evaluate(() => {
      window.__results = [];
      window.__statuses = [];
      // How long this extension page's main thread gets stuck (the popup shares it in Chrome)
      window.__stalls = [];
      let last = performance.now();
      setInterval(() => { const now = performance.now(); window.__stalls.push(now - last - 50); last = now; }, 50);
      chrome.runtime.onMessage.addListener(m => {
        if (m.action === 'transcription-result' && m.result) window.__results.push({ ...m.result, at: Date.now() });
        if (m.action === 'transcription-status') window.__statuses.push(m);
      });
    });
    const take = () => popup.evaluate(() => window.__results.splice(0));
    const statuses = () => popup.evaluate(() => window.__statuses.splice(0));
    const toBackground = msg => popup.evaluate(m => chrome.runtime.sendMessage({ ...m, target: 'background' }), msg);
    const setPrefs = prefs => popup.evaluate(p => chrome.storage.local.set({ limitrCaptions: p }), prefs);
    const finals = results => results.filter(r => r.final);

    const translator = await popup.evaluate(async () => {
      if (!self.Translator) return 'no Translator API';
      try {
        return `Translator API, tr>en ${await Promise.race([Translator.availability({ sourceLanguage: 'tr', targetLanguage: 'en' }),
          new Promise(r => setTimeout(() => r('no answer'), 3000))])}`;
      } catch (e) {
        return `Translator API error: ${e.message}`;
      }
    });
    console.log(`\nThis browser: ${translator}`);

    // Each run starts in silence, once captions still being worked on from the last run are out
    // (a Whisper call can't be cut short), and plays its recording from the start
    async function settle() {
      await tab.evaluate(() => document.querySelectorAll('audio').forEach(a => a.pause()));
      for (let quietMs = 0, waitedMs = 0; quietMs < 3000 && waitedMs < 30000; waitedMs += 500) {
        await sleep(500);
        quietMs = (await take()).length ? 0 : quietMs + 500;
      }
    }

    async function play(lang, seconds) {
      await settle();
      const clicked = Date.now();
      await tab.click(`#${lang}`);
      await sleep(seconds * 1000);
      // Auto runs Whisper twice on the first sentence (detect, then transcribe), which can take
      // longer than the window on a busy machine: wait up to 20 s more for a finished caption
      const results = [];
      for (let waitedMs = 0; ; waitedMs += 1000) {
        results.push(...(await take()).filter(r => r.at > clicked));
        if (finals(results).length || waitedMs >= 20000) break;
        await sleep(1000);
      }
      const first = finals(results)[0];
      return { results, firstFinalMs: first ? first.at - clicked : null, latencies: finals(results).map(r => r.latencyMs) };
    }

    console.log('\nEnglish (Moonshine)');
    await setPrefs({ language: 'en', translateTo: '' });
    const started = Date.now();
    const start = await toBackground({ action: 'captions-start', tabId });
    check('captions start before anything plays', start && start.success, `${((Date.now() - started) / 1000).toFixed(1)} s`);

    if (process.argv.includes('--idle')) {
      await sleep(40000);
      const docs = await popup.evaluate(async () => (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length);
      const status = await toBackground({ action: 'captions-status', tabId });
      check('caption host survives 40 s of silence', docs === 1 && status.active);
    }

    let run = await play('en', 16);
    let text = finals(run.results).map(r => r.text);
    check('player that attaches later gets captions', text.length > 0, JSON.stringify(text.slice(0, 2)));
    check('English captions match the spoken words', wordRecall('en', text) >= 0.6, `${Math.round(wordRecall('en', text) * 100)}% of words`);
    check('the line being spoken updates live', run.results.some(r => !r.final));
    console.log(`        first caption ${run.firstFinalMs} ms after play; processing per sentence ${run.latencies.join(', ')} ms`);

    await tab.reload();
    await sleep(800);
    run = await play('en', 12);
    check('captions continue after a reload', finals(run.results).length > 0);

    if (audio.tr) {
      console.log('\nTürkçe (Whisper)');
      await setPrefs({ language: 'tr', translateTo: '' });
      await sleep(500);
      await toBackground({ action: 'captions-start', tabId });
      await popup.evaluate(() => { window.__stalls = []; });
      run = await play('tr', 24);
      const stall = await popup.evaluate(() => Math.max(...window.__stalls));
      check('the popup stays responsive while Whisper works (longest stall under 0.5 s)', stall < 500, `${Math.round(stall)} ms`);
      text = finals(run.results).map(r => r.text);
      check('Turkish captions match the spoken words', wordRecall('tr', text) >= 0.6,
        `${Math.round(wordRecall('tr', text) * 100)}% of words: ${JSON.stringify(text.slice(0, 1))}`);
      console.log(`        first caption ${run.firstFinalMs} ms after play; processing per sentence ${run.latencies.join(', ')} ms`);

      console.log('\nTürkçe, faster model (Whisper tiny)');
      await setPrefs({ language: 'tr', translateTo: '', model: 'fast' });
      await sleep(500);
      run = await play('tr', 24);
      text = finals(run.results).map(r => r.text);
      check('the faster model gets most Turkish words', wordRecall('tr', text) >= 0.5,
        `${Math.round(wordRecall('tr', text) * 100)}% of words: ${JSON.stringify(text.slice(0, 1))}`);
      console.log(`        first caption ${run.firstFinalMs} ms after play; processing per sentence ${run.latencies.join(', ')} ms`);
      await setPrefs({ language: 'tr', translateTo: '' });

      console.log('\nDetect automatically');
      await setPrefs({ language: 'auto', translateTo: '' });
      await sleep(500);
      await statuses();
      run = await play('tr', 26);
      const detected = (await statuses()).find(s => s.status === 'language');
      check('Auto picks Turkish for Turkish speech', detected && detected.language === 'tr', detected && `${detected.language} p=${detected.probability?.toFixed(3)}`);
      text = finals(run.results).map(r => r.text);
      check('then transcribes it in Turkish', wordRecall('tr', text) >= 0.6, `${Math.round(wordRecall('tr', text) * 100)}% of words`);
      console.log(`        first caption ${run.firstFinalMs} ms after play (includes detection)`);

      console.log('\nTranslate Turkish into English');
      await setPrefs({ language: 'tr', translateTo: 'en' });
      await sleep(500);
      run = await play('tr', 26);
      const shown = finals(run.results).map(r => r.translation || (r.translatedFrom ? r.text : '')).filter(Boolean);
      const english = new Set(words(shown.join(' ')));
      const hits = TRANSLATION_WORDS.filter(w => english.has(w));
      check('overlay gets English words', hits.length >= 3, `${hits.join(', ')}: ${JSON.stringify(shown.slice(0, 1))}`);
      const via = finals(run.results).some(r => r.translation) ? 'on-device translator' : 'Whisper translate';
      console.log(`        translated by ${via}`);
    } else {
      console.log('\nNo Turkish voice (say -v Yelda) here; skipping Turkish checks.');
    }

    await setPrefs({ language: 'en', translateTo: '' });
    await toBackground({ action: 'captions-stop', tabId });
    await sleep(4000);
    await take();
    await sleep(6000);
    const after = await take();
    check('captions stay off after stopping', after.length === 0, JSON.stringify(after.map(r => r.text)));
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
