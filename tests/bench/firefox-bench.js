#!/usr/bin/env node
// Popup performance in a real Firefox: each extension copy is built as a --test build into a
// scratch folder (never dist/firefox), with tests/bench/firefox-bench-hook.js added to its
// background page, and the popup opened in a popup-sized window while a tab plays a stream.
// Firefox output is scaled to silence (media.volume_scale 0) and WebGPU is off.
// Run: node tests/bench/firefox-bench.js [--ext=DIR ...] [--rounds=3] [--opens=5] [--firefox=PATH]

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const B = require('./common');
const { startStaticServer } = require('../static-server');
const { streamWav } = require('../stream-audio');

const ADDON_ID = 'limitr@ozankaraali.dev';
const UUID = '6b0c3f1e-2f4f-4a51-9d55-6c1d1a4c7e01';
const FIREFOX = B.arg('firefox', process.platform === 'darwin' ? '/Applications/Firefox.app/Contents/MacOS/firefox' : 'firefox');

function build(dir) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-bench-firefox-'));
  execFileSync('node', [path.join(dir, 'build-firefox.js'), '--test', `--out=${out}`], { stdio: 'ignore' });
  fs.copyFileSync(path.join(__dirname, 'firefox-bench-hook.js'), path.join(out, 'tests', 'firefox-bench-hook.js'));
  const manifestPath = path.join(out, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.background.scripts.push('tests/firefox-bench-hook.js');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return out;
}

(async () => {
  const rounds = Number(B.arg('rounds', 3));
  const opens = Number(B.arg('opens', 5));
  const variants = B.extensionDirs().map(dir => ({ lbl: B.label(dir), out: build(dir) }));
  const wav = streamWav();
  const { server, port } = await startStaticServer(undefined, {
    '/stream.wav': (q, r) => { r.writeHead(200, { 'Content-Type': 'audio/wav' }); r.end(wav); },
    '/play.html': (q, r) => {
      r.writeHead(200, { 'Content-Type': 'text/html' });
      r.end('<!DOCTYPE html><button id="play">Play</button><audio id="a" src="/stream.wav" loop></audio>' +
        '<script>play.onclick = () => a.play();</script>');
    }
  });
  const results = {};
  try {
    for (let round = 0; round < rounds; round++) {
      for (const { lbl, out } of variants) {
        const browser = await puppeteer.launch({
          browser: 'firefox',
          executablePath: FIREFOX,
          headless: true,
          extraPrefsFirefox: {
            'media.volume_scale': '0.0',
            'dom.webgpu.enabled': false,
            'extensions.webextensions.uuids': JSON.stringify({ [ADDON_ID]: UUID })
          }
        });
        try {
          await browser.installExtension(out);
          const tab = await browser.newPage();
          await tab.goto(`http://127.0.0.1:${port}/play.html`);
          await B.sleep(800);
          await tab.click('#play');
          await B.sleep(2000);
          const ask = query => tab.evaluate(q => new Promise((resolve, reject) => {
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
          await ask({ op: 'bench-popup' });   // warm-up, not counted
          for (let i = 0; i < opens; i++) {
            const { t, screens } = await ask({ op: 'bench-popup' });
            for (const key of ['fcp', 'domContentLoaded', 'load', 'rendered', 'status', 'meters']) {
              B.record(results, `load: ${key} (ms)`, lbl, t[key]);
            }
            for (const [name, v] of Object.entries(screens)) {
              B.record(results, `screen ${name}: sync (ms)`, lbl, v.sync);
              B.record(results, `screen ${name}: to next frame (ms)`, lbl, v.frame);
            }
          }
        } finally {
          await browser.close();
        }
      }
    }
  } finally {
    server.close();
    for (const { out } of variants) fs.rmSync(out, { recursive: true, force: true });
  }
  B.report(`Firefox popup (medians of ${rounds} rounds x ${opens} opens)`, results);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
