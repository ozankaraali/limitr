#!/usr/bin/env node
// Caption model timing, WASM only: module import + model load (from the Cache API) and
// transcription latency for fixed speech clips, in an extension page. Also reports how long the
// page's main thread stalls meanwhile (the offscreen document can't answer messages then).
// Run: node tests/bench/captions-bench.js [--ext=DIR ...] [--query=threads=4 ...] [--rounds=3] [--reps=3] [--only=models|pipeline]
//   --query  bench page options to compare (see asr-bench.js); '' is the extension's own setup
//   models   (asr-bench.html) model load and transcription time per clip
//   pipeline (transcriber-bench.html) lib/transcriber.js end to end: the first finished caption
//            for Turkish speech with Turkish picked and with Detect automatically
// Speech comes from macOS `say` (Turkish needs the Yelda voice). The models are cached in a
// browser profile per extension ID, so the first round for a new copy also downloads them.

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const B = require('./common');

const SPEECH = {
  en: { voice: null, text: 'Good evening everyone. Thanks for watching the stream tonight. Remember to stay hydrated and get some sleep.' },
  tr: { voice: 'Yelda', text: 'İyi akşamlar herkese. Bu gece yayını izlediğiniz için teşekkürler. Bol su için ve biraz uyuyun.' }
};

// 16 kHz mono int16 PCM, base64 (what the bench page decodes)
function speechPcm(lang) {
  const { voice, text } = SPEECH[lang];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-bench-speech-'));
  try {
    execFileSync('say', [...(voice ? ['-v', voice] : []), '-o', path.join(dir, 's.aiff'), text]);
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', path.join(dir, 's.aiff'), path.join(dir, 's.wav')]);
    const wav = fs.readFileSync(path.join(dir, 's.wav'));
    const at = wav.indexOf('data');
    const size = wav.readUInt32LE(at + 4);
    return { base64: wav.subarray(at + 8, at + 8 + size).toString('base64'), seconds: size / 2 / 16000 };
  } catch (e) {
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

(async () => {
  const rounds = Number(B.arg('rounds', 3));
  const reps = Number(B.arg('reps', 3));
  const dirs = B.extensionDirs();
  const queries = B.args('query');
  if (!queries.length) queries.push('');
  const only = B.arg('only', '');
  // --config=DIR?query (repeatable) picks exact pairs instead of every --ext with every --query
  const picked = B.args('config').map(c => {
    const [dir, query = ''] = c.split('?');
    return { dir: require('path').resolve(dir), query };
  });
  picked.forEach(({ dir }) => { if (!dirs.includes(dir)) dirs.push(dir); });
  const configs = (picked.length ? picked : dirs.flatMap(dir => queries.map(query => ({ dir, query }))))
    .map(c => ({ ...c, lbl: `${B.label(c.dir)}${c.query ? `?${c.query}` : ''}` }));
  dirs.forEach(dir => B.installBenchPages(dir, ['asr-bench.html', 'asr-bench.js', 'transcriber-bench.html', 'transcriber-bench.js']));
  const speech = { en: speechPcm('en'), tr: speechPcm('tr') };
  if (!speech.en) {
    console.log('No speech synthesizer (macOS `say`); skipping.');
    return;
  }
  console.log(`Speech clips: en ${speech.en.seconds.toFixed(1)} s, tr ${speech.tr ? speech.tr.seconds.toFixed(1) : '-'} s`);
  const results = {};
  const silence = B.watchSilence();

  // Round 0 warms each copy's model cache and is not counted
  for (let round = 0; round <= rounds; round++) {
    for (const { dir, query, lbl } of configs) {
      const profile = path.join(os.tmpdir(), `limitr-bench-asr-${B.extensionIdFor(dir)}`);
      const { context, extensionId, close } = await B.launch(dir, { profile });
      try {
        const keep = round > 0;
        if (only !== 'models' && speech.tr) {
          const page = await context.newPage();
          page.on('pageerror', e => console.log(`  [${lbl}] page error: ${e.message}`));
          await page.goto(`chrome-extension://${extensionId}/tests/bench/transcriber-bench.html${query ? `?${query}` : ''}`);
          await page.waitForFunction(() => window.benchReady === true);
          for (const language of ['tr', 'auto']) {
            for (let i = 0; i < reps; i++) {
              await page.evaluate(prefs => bench.start(prefs), { language, translateTo: '' });
              const r = await page.evaluate(([b, s]) => bench.firstCaption(b, s), [speech.tr.base64, speech.tr.seconds]);
              if (round === 0 && i === 0) console.log(`  [${lbl}] first caption (${language}): ${r && `${r.language}: ${r.text}`}`);
              if (keep && r) {
                const name = language === 'auto' ? 'Detect automatically' : 'Turkish picked';
                B.record(results, `first caption, ${name}: processing (ms)`, lbl, r.latencyMs);
                B.record(results, `first caption, ${name}: after the sentence (ms)`, lbl, r.wallMs);
              }
            }
          }
          const before = B.browserCpuMs(profile);
          await B.sleep(3000);
          if (keep) B.record(results, 'pipeline: whole browser CPU in the 3 s after (ms/s)', lbl, (B.browserCpuMs(profile) - before) / 3);
          await page.close();
        }
        if (only === 'pipeline') continue;
        const page = await context.newPage();
        page.on('pageerror', e => console.log(`  [${lbl}] page error: ${e.message}`));
        await page.goto(`chrome-extension://${extensionId}/tests/bench/asr-bench.html${query ? `?${query}` : ''}`);
        await page.waitForFunction(() => window.benchReady === true);
        const moon = await page.evaluate(() => bench.load('moonshine'));
        const info = await page.evaluate(() => bench.info());
        if (round === 0) {
          console.log(`  [${lbl}] crossOriginIsolated=${info.crossOriginIsolated} cores=${info.hardwareConcurrency} ` +
            `ORT threads=${info.numThreads} proxy=${info.proxy}`);
        }
        if (keep) {
          B.record(results, 'import transformers+ORT (ms)', lbl, moon.importMs);
          B.record(results, 'load Moonshine (ms)', lbl, moon.loadMs);
          B.record(results, 'load Moonshine, longest stall (ms)', lbl, moon.stallMs);
        }
        for (const seconds of [2, 4, 8]) {
          await page.evaluate(([b, s]) => bench.transcribe('moonshine', b, s), [speech.en.base64, seconds]);
          for (let i = 0; i < reps; i++) {
            const r = await page.evaluate(([b, s]) => bench.transcribe('moonshine', b, s), [speech.en.base64, seconds]);
            if (keep) {
              B.record(results, `Moonshine ${seconds} s clip (ms)`, lbl, r.ms);
              if (seconds === 8) B.record(results, 'Moonshine 8 s, longest stall (ms)', lbl, r.stallMs);
            }
            if (round === 0 && i === 0 && seconds === 8) console.log(`  [${lbl}] Moonshine heard: ${r.text}`);
          }
        }
        if (speech.tr) {
          const whisper = await page.evaluate(() => bench.load('whisper'));
          if (keep) B.record(results, 'load Whisper base (ms)', lbl, whisper.loadMs);
          for (const seconds of [4, 8]) {
            await page.evaluate(([b, s]) => bench.transcribe('whisper', b, s, 'tr'), [speech.tr.base64, seconds]);
            for (let i = 0; i < reps; i++) {
              const r = await page.evaluate(([b, s]) => bench.transcribe('whisper', b, s, 'tr'), [speech.tr.base64, seconds]);
              if (keep) {
                B.record(results, `Whisper ${seconds} s clip (ms)`, lbl, r.ms);
                if (seconds === 8) B.record(results, 'Whisper 8 s, longest stall (ms)', lbl, r.stallMs);
              }
              if (round === 0 && i === 0 && seconds === 8) console.log(`  [${lbl}] Whisper heard: ${r.text}`);
            }
          }
          // Thread pools can keep spinning after a call; the whole browser should go quiet
          const before = B.browserCpuMs(profile);
          await B.sleep(3000);
          if (keep) B.record(results, 'whole browser CPU in the 3 s after (ms/s)', lbl, (B.browserCpuMs(profile) - before) / 3);
        }
      } finally {
        await close();
      }
    }
  }
  silence.stop();
  B.report(`Captions models, WASM (median of ${rounds} rounds x ${reps} reps)`, results);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
