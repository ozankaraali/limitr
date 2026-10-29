#!/usr/bin/env node
// Turkish captions, Whisper against ufak (lib/stt-offline-worker.js), in an extension page on the
// CPU (tests/bench/stt-bench.html): how much of real time each engine takes, and how long after a
// word is spoken it shows. Whisper gets the sentences the captions segmenter would send it
// (lib/transcriber.js: a 450 ms pause ends one, 9 s at most), one after another; a sentence shows
// when it is transcribed, so its words wait for its end. ufak gets what the segmenter sends it: the
// open sentence again every half second, and the finished one at its pause; a word shows with the
// first of those that has it. ufak-live decodes the open sentence only from a little before its last
// committed word and commits words two decodes agree on (lib/live-agreement.js); a word shows
// with the first decode that has it, and is committed (stays) later. Word times come from ufak.
// How steady a live line is: of the words shown, how many a later version of the sentence changed
// or took back, per 100 words it ends with.
// Accuracy needs a reference: a Turkish passage spoken by macOS `say` (the Yelda voice) is scored
// on word error rate; recordings (--file) print each engine's transcript to compare by ear.
// Run: node tests/bench/turkish-captions-bench.js [--file=REC ...] [--from=0] [--seconds=60]
//        [--whisper=tiny,base] [--threads=1,2] [--engines=whisper,ufak] [--ext=DIR]
//        [--ufak-refresh=0.5] [--ufak-slow-after=3] [--ufak-pause=0.3] [--ufak-max=9] [--verbose]
//        [--live-refresh=0.5] [--live-pause=0.3] [--live-max=30] [--live-context=1.5] [--live-pending=6]
//        [--live-slow-window=4] [--live-sure=0.9]
//   --ufak-*   how the segmenter feeds ufak: how often the open sentence is
//              sent again (twice as rarely once it is longer than slow-after), how long a pause
//              ends a sentence, the longest one (seconds); as SEGMENTING.ufak in lib/transcriber.js
//   --live-*   the same for ufak-live, plus the context each decode starts with before the last
//              committed word, how long words may stay uncommitted, and past how long a window an
//              open sentence is decoded only once a second (seconds; 0: always every refresh);
//              --live-sure: how sure ufak must be of a word in doubt to show it (several to compare)
//   --threads  Whisper's thread counts to try (the product: a quarter of the cores in Chrome, at
//              most 4; 1 in Firefox). ufak always runs on one.

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

// A recording's stretch as 16 kHz mono int16 (ffmpeg)
function clip(file, from, seconds) {
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
    if (speechMs >= MIN_SPEECH_MS && end > 0) out.push([frames[0] * FRAME_MS / 1000, (frames[end - 1] + 1) * FRAME_MS / 1000, (now + 1) * FRAME_MS / 1000, ticks]);
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

// ufak, served as the captions pipeline serves it: one call at a time,
// finished sentences first, and of the open sentence only its latest version waits. Per sentence,
// a word shows with the first result that has that many words.
function offlineTimeline(units, decoded) {
  const events = [];
  units.forEach((u, k) => events.push({ ...u, k }));
  events.sort((a, b) => a.time - b.time || (a.final ? 1 : -1));
  let busyUntil = 0;
  let i = 0;
  const queue = [];
  let interim = null;
  const shown = [];   // { sentence, final, done, words }
  const admit = e => {
    if (e.final) {
      queue.push(e);
      if (interim && interim.sentence === e.sentence) interim = null;
    } else {
      interim = e;
    }
  };
  while (i < events.length || queue.length || interim) {
    while (i < events.length && events[i].time <= busyUntil) admit(events[i++]);
    if (!queue.length && !interim) {
      busyUntil = events[i].time;
      continue;
    }
    const job = queue.shift() || interim;
    if (job === interim) interim = null;
    const done = Math.max(busyUntil, job.time) + decoded[job.k].ms / 1000;
    busyUntil = done;
    shown.push({ sentence: job.sentence, final: job.final, done, ms: decoded[job.k].ms, words: words(decoded[job.k].text).length, text: decoded[job.k].text });
  }
  return shown;
}

// When each sentence's first word first shows, after it is spoken (s)
function offlineFirstWaits(segments, shown, starts) {
  return segments.map((seg, s) => {
    const first = shown.find(r => r.sentence === s && r.words > 0);
    return first && starts[s] && starts[s].length ? first.done - starts[s][0] : NaN;
  }).filter(Number.isFinite);
}

// starts: each sentence's final decode's word start times (s), from ufak
function offlineDelays(segments, shown, starts) {
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
  const engines = new Set(B.arg('engines', 'whisper,ufak,ufak-live').split(','));
  const { wordsOf } = await import(require('url').pathToFileURL(path.join(__dirname, '../../lib/live-agreement.js')).href);
  const liveOptions = {
    contextSeconds: Number(B.arg('live-context', 1.5)), maxPendingSeconds: Number(B.arg('live-pending', 6)),
    slowWindow: Number(B.arg('live-slow-window', 4)) || undefined
  };
  const sureLevels = B.arg('live-sure', '0.9').split(',').map(Number);
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
    // As the segmenter cuts for Moonshine-style engines, sent again every half second
    input.offlineSegments = sentences(input.audio, {
      hangoverMs: Number(B.arg('ufak-pause', 0.3)) * 1000,
      maxMs: Number(B.arg('ufak-max', 9)) * 1000,
      interimMs: Number(B.arg('ufak-refresh', 0.5)) * 1000,
      slowAfterMs: Number(B.arg('ufak-slow-after', 3)) * 1000
    });
    input.liveSegments = sentences(input.audio, {
      hangoverMs: Number(B.arg('live-pause', 0.3)) * 1000,
      maxMs: Number(B.arg('live-max', 30)) * 1000,
      interimMs: Number(B.arg('live-refresh', 0.5)) * 1000
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
    // ufak, on one thread
    if (engines.has('ufak')) {
      const page = await benchPage();
      const l = await page.evaluate(() => bench.offlineLoad());
      console.log(`Loaded ufak: ${f1(l.loadMs / 1000)} s (download or cache ${f1(l.downloadMs / 1000)} s, start ${f1(l.initMs / 1000)} s)`);
      for (const input of inputs) {
        const units = [];
        input.offlineSegments.forEach(([start, end, sentAt, ticks], sentence) => {
          for (const [a, t] of ticks) units.push({ sentence, final: false, time: t, piece: [a, t] });
          units.push({ sentence, final: true, time: sentAt, piece: [start, end] });
        });
        const decoded = await page.evaluate(([b, p]) => bench.offlineDecode(b, p), [input.base64, units.map(u => u.piece)]);
        const shown = offlineTimeline(units, decoded);
        // Real time it needs: the calls the pipeline makes (it skips live lines that went stale)
        const busy = shown.reduce((sum, r) => sum + r.ms, 0) / 1000;
        if (B.args('verbose').length || process.argv.includes('--verbose')) {
          input.offlineSegments.forEach(([a, e, sent], k) => {
            const final = shown.find(r => r.sentence === k && r.final);
            console.log(`    ${input.name} ufak sentence ${f2(a)}-${f2(e)} s (sent ${f2(sent)} s, ${shown.filter(r => r.sentence === k).length} calls, final ${final ? f1(final.ms) : '-'} ms): ${final ? final.text : ''}`);
          });
        }
        const starts = input.offlineSegments.map((seg, s) => {
          const k = units.findIndex(u => u.sentence === s && u.final);
          return k < 0 ? [] : wordsOf(decoded[k], seg[0]).map(w => w.start);
        });
        const delays = offlineDelays(input.offlineSegments, shown, starts);
        const text = shown.filter(r => r.final).map(r => r.text).join(' ');
        const versions = input.offlineSegments.map((seg, s) => shown.filter(r => r.sentence === s).map(r => r.text));
        input.rows.push({ engine: 'ufak, 1 thr', share: busy / input.duration, typical: median(delays), worst: pct(delays, 0.9), first: median(offlineFirstWaits(input.offlineSegments, shown, starts)), changed: changedPer100(versions), wer: input.reference ? wer(input.reference, text) : NaN });
        // The same with the word being spoken left off the line until the sentence ends
        const held = shown.map(r => r.final ? r : { ...r, words: Math.max(0, r.words - 1), text: words(r.text).slice(0, -1).join(' ') });
        const heldDelays = offlineDelays(input.offlineSegments, held, starts);
        const heldVersions = input.offlineSegments.map((seg, s) => held.filter(r => r.sentence === s).map(r => r.text));
        input.rows.push({ engine: '  but the last word', share: NaN, typical: median(heldDelays), worst: pct(heldDelays, 0.9), first: median(offlineFirstWaits(input.offlineSegments, held, starts)), changed: changedPer100(heldVersions), wer: NaN });
        input.transcripts.push(['ufak', text]);
      }
      await page.close();
    }
    // ufak through the live agreement, on one thread
    if (engines.has('ufak-live')) {
      const page = await benchPage();
      await page.evaluate(() => bench.offlineLoad());
      for (const input of inputs) {
        for (const sure of sureLevels) {
          const r = await page.evaluate(([b, segs, o]) => bench.offlineLive(b, segs, o), [input.base64, input.liveSegments, { ...liveOptions, sureLogProb: Math.log(sure) }]);
          const busy = r.calls.reduce((sum, c) => sum + c.ms, 0) / 1000;
          const lines = r.sentences.flatMap(x => x.lines);
          // As the overlay gets them: each line's versions, and per sentence when its k-th word
          // first showed (on any of its lines)
          const versions = new Map();
          const after = [];
          const firstWaits = [];
          r.sentences.forEach((x, s) => {
            const finished = [];
            let firstShown = -1;
            for (const c of r.calls.filter(c => c.s === s)) {
              for (const line of c.lines) versions.set(line.id, [...(versions.get(line.id) || []), line.text]);
              finished.push(...c.lines.filter(l => l.final).map(l => l.text));
              const open = c.lines.find(l => !l.final);
              const visible = words([...finished, open ? open.text : ''].join(' ')).length;
              for (; firstShown + 1 < Math.min(visible, x.words.length); firstShown++) after.push(c.done - x.words[firstShown + 1].start);
              if (visible && !firstWaits[s]) firstWaits[s] = c.done - x.words[0].start;
            }
          });
          const name = sureLevels.length > 1 ? `ufak-live, sure ${Math.round(sure * 100)}%` : 'ufak-live, 1 thr';
          input.rows.push({ engine: name, share: busy / input.duration, typical: median(after), worst: pct(after, 0.9), first: median(firstWaits.filter(Number.isFinite)), changed: changedPer100([...versions.values()]), wer: input.reference ? wer(input.reference, lines.join(' ')) : NaN });
          if (sure !== sureLevels[0]) continue;
          if (B.args('verbose').length || process.argv.includes('--verbose')) {
            for (const c of r.calls) console.log(`    ${input.name} ufak-live ${c.final ? 'final' : 'live '} ${f2(c.from)}-${f2(c.from + c.seconds)} s: ${c.text}  => ${c.lines.map(l => `${l.id}${l.final ? '!' : ''} ${l.text}`).join(' / ')}`);
          }
          const longest = Math.max(...r.calls.map(c => c.seconds));
          input.liveNote = `ufak-live: ${r.calls.length} calls, the longest decoding ${f1(longest)} s of audio; ${lines.length} lines`;
          input.transcripts.push(['ufak-live', lines.join(' | ')]);
        }
      }
      await page.close();
    }
  } finally {
    await close();
    silence.stop();
  }

  for (const input of inputs) {
    console.log(`\n${input.name}: ${f1(input.duration)} s, ${input.segments.length} sentences for Whisper`);
    console.log('  engine                 share of real time   a word shows after (median)   worst (Whisper: max, live: p90)   a sentence\'s first word waits   shown words changed per 100   WER');
    for (const r of input.rows) {
      console.log(`  ${r.engine.padEnd(22)} ${(f1(r.share * 100) + '%').padStart(18)}   ${(f2(r.typical) + ' s').padStart(27)}   ${(f2(r.worst) + ' s').padStart(36)}   ${(Number.isFinite(r.first) ? f2(r.first) + ' s' : 'shows as spoken').padStart(29)}   ${f1(r.changed).padStart(27)}   ${Number.isFinite(r.wer) ? (r.wer * 100).toFixed(1) + '%' : '-'}`);
    }
    if (input.liveNote) console.log(`  ${input.liveNote}`);
    if (input.reference) console.log(`  reference:    ${input.reference}`);
    for (const [engine, t] of input.transcripts) console.log(`  ${engine.padEnd(15)} ${t}`);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
