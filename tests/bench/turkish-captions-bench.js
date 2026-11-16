#!/usr/bin/env node
// Turkish captions, Whisper against the Turkish Moonshine (lib/turkish-moonshine.js), in an
// extension page on the CPU (tests/bench/stt-bench.html): how much of real time each engine takes,
// and how long after a word is spoken it shows. Whisper gets the sentences the captions segmenter
// would send it (lib/transcriber.js: a 450 ms pause ends one, 9 s at most), one after another; a
// sentence shows when it is transcribed, so its words wait for its end. The Turkish model runs in
// the captions' own model worker, on the product's threads, and gets what the segmenter sends it:
// the open sentence again once a second, and the finished one at its pause, read as
// lib/turkish-reading.js says (each reading going on from the last, the line being spoken read
// within a budget), on a clock that runs at the speed of the readings. Its live line leaves off
// the word being spoken, as lib/transcriber.js shows it; a word shows with the first result that
// has it. It gives no word times, so a sentence's words are spread over its length.
// How steady a live line is: of the words shown, how many a later version of the sentence changed
// or took back, per 100 words it ends with.
// Accuracy needs a reference: a Turkish passage spoken by macOS `say` (the Yelda voice) is scored
// on word error rate; recordings (--file) print each engine's transcript to compare by ear.
// Run: node tests/bench/turkish-captions-bench.js [--file=REC ...] [--from=0] [--seconds=60]
//        [--whisper=tiny,base] [--threads=1,2] [--engines=whisper,turkish] [--ext=DIR]
//        [--turkish-refresh=1] [--turkish-pause=0.24] [--turkish-max=8] [--turkish-base=URL]
//        [--turkish-prefix=agreed|shown|none] [--turkish-final-afresh] [--turkish-stitch=1.0,0.5|0]
//        [--turkish-stitch-final=1|0] [--turkish-budget=0.6] [--turkish-threads=N] [--dump=PREFIX]
//        [--verbose]
//   --turkish-*  how the segmenter feeds the Turkish model: how often the open sentence is sent
//                again, how long a pause ends a sentence, the longest one (seconds), as
//                SEGMENTING.moonshineTr in lib/transcriber.js; --turkish-base: where its files
//                are (a local copy), else the Hub; prefix, final-afresh (finalPrefix off), stitch
//                (left and right seconds, or 0 for none), stitch-final and budget:
//                TURKISH_READING's in lib/turkish-reading.js; threads: the model's (else the
//                product's: a quarter of the cores in Chrome, at most 4; 1 in Firefox)
//   --threads    Whisper's thread counts to try (the product: a quarter of the cores in Chrome,
//                at most 4; 1 in Firefox)
//   --dump       each engine's whole text to PREFIX.<engine>.txt, for scoring

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./common');
const { changedPer100 } = require('../caption-steadiness');

const SAMPLE_RATE = 16000;
const PASSAGE = 'İyi akşamlar herkese, yayına hoş geldiniz. Bugün yeni oyunu birlikte deneyeceğiz. ' +
  'Önce ayarları yapalım, sonra ilk bölüme geçelim. Sohbette sorularınızı yazabilirsiniz, ' +
  'hepsini sırayla okuyacağım. Bol su için ve biraz uyumayı unutmayın.';

// ---------- audio ----------
function toBase64(int16) {
  return Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength).toString('base64');
}

function int16ToFloat(int16) {
  const out = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
  return out;
}

// A 16 kHz mono WAV (16-bit or float) as int16, read here; else null
function wav16k(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let at = 12;
  let format = null;
  while (at + 8 <= buf.length) {
    const id = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === 'fmt ') format = { tag: buf.readUInt16LE(at + 8), channels: buf.readUInt16LE(at + 10), rate: buf.readUInt32LE(at + 12), bits: buf.readUInt16LE(at + 22) };
    if (id === 'data' && format && format.channels === 1 && format.rate === SAMPLE_RATE) {
      const data = buf.subarray(at + 8, Math.min(buf.length, at + 8 + size));
      if (format.tag === 3 && format.bits === 32) {
        const out = new Int16Array(data.length >> 2);
        for (let i = 0; i < out.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(data.readFloatLE(4 * i) * 0x8000)));
        return out;
      }
      if (format.tag === 1 && format.bits === 16) return new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + (data.length & ~1)));
      return null;
    }
    at += 8 + size + (size & 1);
  }
  return null;
}

// A recording's stretch as 16 kHz mono int16 (read here if it already is, else with ffmpeg)
function clip(file, from, seconds) {
  const pcm = wav16k(file);
  if (pcm) return pcm.slice(Math.round(from * SAMPLE_RATE), Math.round((from + seconds) * SAMPLE_RATE));
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(from), '-i', file, '-t', String(seconds),
    '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', '-'], { maxBuffer: 2 ** 30 });
  return new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
}

function spokenPassage() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-stt-bench-'));
  try {
    execFileSync('say', ['-v', 'Yelda', '-o', path.join(dir, 's.aiff'), PASSAGE]);
    return clip(path.join(dir, 's.aiff'), 0, 600);
  } catch (e) {
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- the captions segmenter (lib/transcriber.js), as Whisper is fed ----------
// Sentences as [start, end, sentAt] in seconds: sentAt is when the segmenter hands one over
// With interimMs, each also lists when the open sentence was sent again (as for Moonshine)
function sentences(audio, { hangoverMs = 450, maxMs = 9000, interimMs = 0, slowAfterMs = Infinity } = {}) {
  const FRAME = 320;
  const FRAME_MS = 20;
  const PREROLL = 15;
  const MIN_SPEECH_MS = 300;
  const out = [];
  let floorDb = -60;
  let preroll = [];
  let frames = null;           // absolute frame indices of the open sentence
  let frameDb = [];
  let frameSpeech = [];
  let speechMs = 0;
  let silenceMs = 0;
  let sinceInterimMs = 0;
  let ticks = [];
  const finish = (end, now, carryOn) => {
    if (speechMs >= MIN_SPEECH_MS && end > 0) out.push([frames[0] * FRAME_MS / 1000, (frames[end - 1] + 1) * FRAME_MS / 1000, (now + 1) * FRAME_MS / 1000, ticks, carryOn]);
    ticks = [];
    sinceInterimMs = 0;
    const rest = frames.slice(end);
    if (carryOn && rest.length) {
      const restSpeech = frameSpeech.slice(end);
      frames = rest;
      frameDb = frameDb.slice(end);
      frameSpeech = restSpeech;
      speechMs = restSpeech.filter(Boolean).length * FRAME_MS;
    } else {
      frames = null;
      frameDb = [];
      frameSpeech = [];
      speechMs = 0;
      preroll = rest.slice(-PREROLL);
    }
    silenceMs = 0;
  };
  const cutPoint = () => {
    const from = Math.max(1, frames.length - 100);
    let bestStart = -1;
    let bestLength = 0;
    let runStart = -1;
    for (let i = from; i <= frames.length; i++) {
      const silent = i < frames.length && !frameSpeech[i];
      if (silent && runStart < 0) runStart = i;
      if (!silent && runStart >= 0) {
        if (i - runStart > bestLength) {
          bestLength = i - runStart;
          bestStart = runStart;
        }
        runStart = -1;
      }
    }
    if (bestLength >= 2) return bestStart + Math.floor(bestLength / 2);
    let cut = frames.length;
    let quietest = Infinity;
    for (let i = from; i < frames.length; i++) if (frameDb[i] < quietest) { quietest = frameDb[i]; cut = i; }
    return cut;
  };
  const count = Math.floor(audio.length / FRAME);
  for (let f = 0; f < count; f++) {
    let sum = 0;
    for (let i = f * FRAME; i < (f + 1) * FRAME; i++) sum += audio[i] * audio[i];
    const db = 10 * Math.log10(sum / FRAME + 1e-12);
    floorDb = db < floorDb ? Math.max(db, -75) : floorDb + 0.02;
    const speech = db > Math.max(floorDb + 9, -50);
    if (!frames) {
      preroll.push(f);
      if (preroll.length > PREROLL) preroll.shift();
      if (!speech) continue;
      frames = preroll;
      frameDb = preroll.map(() => -100);
      frameSpeech = preroll.map(() => false);
      preroll = [];
      speechMs = FRAME_MS;
      silenceMs = 0;
      sinceInterimMs = 0;
      continue;
    }
    frames.push(f);
    frameDb.push(db);
    frameSpeech.push(speech);
    sinceInterimMs += FRAME_MS;
    if (speech) {
      speechMs += FRAME_MS;
      silenceMs = 0;
    } else {
      silenceMs += FRAME_MS;
    }
    if (silenceMs >= hangoverMs) finish(frames.length - Math.max(0, Math.round((silenceMs - 200) / FRAME_MS)), f, false);
    else if (frames.length * FRAME_MS >= maxMs) finish(cutPoint(), f, true);
    else if (interimMs && speechMs >= MIN_SPEECH_MS && sinceInterimMs >= interimMs * (frames.length * FRAME_MS > slowAfterMs ? 2 : 1)) {
      sinceInterimMs = 0;
      ticks.push([frames[0] * FRAME_MS / 1000, (f + 1) * FRAME_MS / 1000]);
    }
  }
  if (frames) finish(frames.length, count, false);
  return out;
}

// ---------- scoring ----------
const words = text => text.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
function wer(reference, hypothesis) {
  const r = words(reference);
  const h = words(hypothesis);
  let prev = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) {
    const row = [i];
    for (let j = 1; j <= h.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    prev = row;
  }
  return r.length ? prev[h.length] / r.length : 0;
}
const median = v => B.median ? B.median(v) : v.slice().sort((a, b) => a - b)[v.length >> 1];
const pct = (v, q) => {
  const s = v.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
};
const f1 = v => (Number.isFinite(v) ? v.toFixed(1) : '-');
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : '-');

// Whisper: sentences one after another; each shows once it is transcribed
function whisperDelays(segments, results) {
  let busyUntil = 0;
  const typical = [];
  const first = [];
  segments.forEach(([start, end, sentAt], i) => {
    const shown = Math.max(sentAt, busyUntil) + results[i].ms / 1000;
    busyUntil = shown;
    typical.push(shown - (start + end) / 2);
    first.push(shown - start);
  });
  return { typical, first };
}

// When each sentence's first word first shows, after the sentence starts (s)
function offlineFirstWaits(segments, shown) {
  return segments.map(([start], s) => {
    const first = shown.find(r => r.sentence === s && r.words > 0);
    return first ? first.done - start : NaN;
  }).filter(Number.isFinite);
}

// When each word first shows, after it is spoken (s); with no word times (starts), a sentence's
// words are spread evenly over it
function offlineDelays(segments, shown, starts = []) {
  const delays = [];
  segments.forEach(([start, end], s) => {
    const results = shown.filter(r => r.sentence === s);
    const final = results.find(r => r.final);
    if (!final || !final.words) return;
    for (let k = 0; k < final.words; k++) {
      const first = results.find(r => r.words > k);
      const spoken = starts[s] && starts[s][k] !== undefined ? starts[s][k] : start + (end - start) * (k + 0.5) / final.words;
      delays.push(first.done - spoken);
    }
  });
  return delays;
}

(async () => {
  const whisperKeys = B.arg('whisper', 'tiny,base').split(',').filter(Boolean);
  const threadCounts = B.arg('threads', '1,2').split(',').map(Number).filter(n => n >= 1);
  const engines = new Set(B.arg('engines', 'whisper,turkish').split(','));
  const from = Number(B.arg('from', 0));
  const seconds = Number(B.arg('seconds', 60));
  const [dir] = B.extensionDirs();
  B.installBenchPages(dir, ['stt-bench.html', 'stt-bench.js']);

  const inputs = [];
  const passage = spokenPassage();
  if (passage) inputs.push({ name: 'spoken passage (macOS say, Yelda)', pcm: passage, reference: PASSAGE });
  for (const file of B.args('file')) inputs.push({ name: `${path.basename(file)} from ${from} s`, pcm: clip(file, from, seconds) });
  if (!inputs.length) throw new Error('Nothing to transcribe: no macOS `say` Yelda voice and no --file');
  for (const input of inputs) {
    input.audio = int16ToFloat(input.pcm);
    input.duration = input.audio.length / SAMPLE_RATE;
    input.base64 = toBase64(input.pcm);
    input.segments = sentences(input.audio);
    // As the segmenter cuts for the Turkish model, the open sentence sent again once a second
    input.offlineSegments = sentences(input.audio, {
      hangoverMs: Number(B.arg('turkish-pause', 0.24)) * 1000,
      maxMs: Number(B.arg('turkish-max', 8)) * 1000,
      interimMs: Number(B.arg('turkish-refresh', 1)) * 1000
    });
    input.rows = [];
    input.transcripts = [];
  }

  const profile = path.join(os.tmpdir(), `limitr-bench-stt-${B.extensionIdFor(dir)}`);
  const silence = B.watchSilence();
  const { context, extensionId, close } = await B.launch(dir, { profile });
  const benchPage = async () => {
    const page = await context.newPage();
    page.on('pageerror', e => console.log(`  page error: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') console.log(`  console: ${m.text()}`); });
    await page.goto(`chrome-extension://${extensionId}/tests/bench/stt-bench.html`);
    await page.waitForFunction(() => window.benchReady === true);
    return page;
  };
  try {
    // Whisper, one fresh page per thread count (ONNX Runtime fixes it when it starts)
    for (const threads of engines.has('whisper') ? threadCounts : []) {
      const page = await benchPage();
      const loaded = [];
      for (const key of whisperKeys) {
        const l = await page.evaluate(([k, t]) => bench.whisperLoad(k, t), [key, threads]);
        loaded.push(`Whisper ${key} ${f1(l.loadMs / 1000)} s`);
      }
      console.log(`Loaded on ${threads} thread${threads > 1 ? 's' : ''}: ${loaded.join(', ')}`);
      for (const input of inputs) {
        for (const key of whisperKeys) {
          const results = await page.evaluate(([k, b, s]) => bench.whisper(k, b, s, 'tr'), [key, input.base64, input.segments.map(([a, e]) => [a, e])]);
          const busy = results.reduce((sum, r) => sum + r.ms, 0) / 1000;
          const { typical, first } = whisperDelays(input.segments, results);
          const text = results.map(r => r.text).join(' ');
          const engine = `Whisper ${key}, ${threads} thr`;
          input.rows.push({ engine, share: busy / input.duration, typical: median(typical), worst: Math.max(...typical), first: median(first), wer: input.reference ? wer(input.reference, text) : NaN });
          if (threads === threadCounts[0]) input.transcripts.push([`Whisper ${key}`, text]);
        }
      }
      await page.close();
    }
    // The Turkish model, in the captions' model worker
    if (engines.has('turkish')) {
      const page = await benchPage();
      const stitchArg = B.arg('turkish-stitch', '1.0,0.5');
      const stitch = stitchArg === '0' ? false : (([leftS, rightS]) => ({ leftS, rightS }))(stitchArg.split(',').map(Number));
      const policy = {
        prefix: B.arg('turkish-prefix', 'agreed'),
        finalPrefix: !process.argv.includes('--turkish-final-afresh'),
        stitch: Boolean(stitch),
        stitchFinal: B.arg('turkish-stitch-final', '1') !== '0',
        budget: Number(B.arg('turkish-budget', 0.6))
      };
      const threads = Number(B.arg('turkish-threads', 0)) || undefined;
      const l = await page.evaluate(([b, st, t]) => bench.turkishLoad(b, st, t), [B.arg('turkish-base'), stitch || false, threads]);
      console.log(`Loaded the Turkish Moonshine: ${f1(l.loadMs / 1000)} s (download or cache, and start); reading ${JSON.stringify({ ...policy, stitch })}, ${threads || 'product'} thread(s)`);
      for (const input of inputs) {
        const units = [];
        input.offlineSegments.forEach(([start, end, sentAt, ticks, cut], sentence) => {
          for (const [a, t] of ticks) units.push({ sentence, final: false, time: t, piece: [a, t] });
          units.push({ sentence, final: true, cut: Boolean(cut), time: sentAt, piece: [start, end] });
        });
        const shown = (await page.evaluate(([b, u, p]) => bench.turkishLive(b, u, p), [input.base64, units, policy]))
          .map(r => ({ ...r, words: words(r.text).length }));
        // Real time it needs: the calls the pipeline makes (it skips live lines that went stale)
        const busy = shown.reduce((sum, r) => sum + r.ms, 0) / 1000;
        if (B.args('verbose').length || process.argv.includes('--verbose')) {
          input.offlineSegments.forEach(([a, e, sent], k) => {
            const final = shown.find(r => r.sentence === k && r.final);
            console.log(`    ${input.name} Turkish sentence ${f2(a)}-${f2(e)} s (sent ${f2(sent)} s, ${shown.filter(r => r.sentence === k).length} calls, final ${final ? f1(final.ms) : '-'} ms): ${final ? final.text : ''}`);
          });
        }
        const text = shown.filter(r => r.final).map(r => r.text).join(' ');
        // As lib/transcriber.js shows it: the live line leaves off the word being spoken
        const held = shown.map(r => r.final ? r : { ...r, words: Math.max(0, r.words - 1), text: words(r.text).slice(0, -1).join(' ') });
        const row = (engine, results, share) => {
          const delays = offlineDelays(input.offlineSegments, results);
          const versions = input.offlineSegments.map((seg, s) => results.filter(r => r.sentence === s).map(r => r.text));
          return { engine, share, typical: median(delays), worst: pct(delays, 0.9), first: median(offlineFirstWaits(input.offlineSegments, results)), changed: changedPer100(versions), wer: input.reference ? wer(input.reference, text) : NaN };
        };
        input.rows.push(row('Turkish Moonshine', held, busy / input.duration));
        input.rows.push({ ...row('  with the last word', shown, NaN), wer: NaN });
        // The line being spoken as only the words kept for the next reading (lib/turkish-reading.js)
        if (policy.prefix !== 'none') {
          const kept = shown.map(r => r.final ? r : { ...r, words: words(r.kept).length, text: r.kept });
          input.rows.push({ ...row('  kept words only', kept, NaN), wer: NaN });
        }
        input.transcripts.push(['turkish', text]);
      }
      await page.close();
    }
  } finally {
    await close();
    silence.stop();
  }

  for (const input of inputs) {
    console.log(`\n${input.name}: ${f1(input.duration)} s, ${input.segments.length} sentences for Whisper`);
    console.log('  engine                 share of real time   a word shows after (median)   worst (Whisper: max, Turkish: p90)   a sentence\'s first word waits   shown words changed per 100   WER');
    for (const r of input.rows) {
      console.log(`  ${r.engine.padEnd(22)} ${(f1(r.share * 100) + '%').padStart(18)}   ${(f2(r.typical) + ' s').padStart(27)}   ${(f2(r.worst) + ' s').padStart(36)}   ${(Number.isFinite(r.first) ? f2(r.first) + ' s' : 'shows as spoken').padStart(29)}   ${f1(r.changed).padStart(27)}   ${Number.isFinite(r.wer) ? (r.wer * 100).toFixed(1) + '%' : '-'}`);
    }
    if (input.reference) console.log(`  reference:    ${input.reference}`);
    for (const [engine, t] of input.transcripts) console.log(`  ${engine.padEnd(15)} ${t}`);
    // --dump=PREFIX: each engine's whole text to PREFIX.<engine>.txt (lines joined), for scoring
    if (B.arg('dump')) for (const [engine, t] of input.transcripts) fs.writeFileSync(`${B.arg('dump')}.${engine.replace(/[^\w.-]+/g, '-')}.txt`, t.replace(/ \| /g, ' ') + '\n');
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
