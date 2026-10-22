#!/usr/bin/env node
// Tags every downloaded recording of tests/fixtures/dataset.json with what stands out in it
// (tools/stream-analysis.js): the parts much louder than the talking, and the harsh ones (bright:
// a clipping mic, cymbals, crowds, shrill alerts). They go into each entry's `auto`, apart from
// the listener's own labels, as proposals to review in tools/label-dataset.js and as provisional
// labels for tools/eval-dataset.js --auto. Needs ffmpeg.
// Run: node tools/autotag-dataset.js [name-filter]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { analyse, propose } = require('./stream-analysis');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'tests/fixtures/dataset.json');
const DIR = path.join(process.env.LIMITR_RECORDINGS || path.join(ROOT, 'tests/fixtures/recordings'), 'dataset');
const FS = 48000;
const filter = process.argv[2] || '';

const entries = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
for (const entry of entries) {
  const file = path.join(DIR, entry.file);
  if (!entry.file.includes(filter) || !fs.existsSync(file)) continue;
  const raw = execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', file, '-ac', '2', '-ar', String(FS),
    '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const frames = raw.length / 8;
  const samples = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + frames * 8));
  const left = new Float32Array(frames), right = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    left[i] = samples[2 * i];
    right[i] = samples[2 * i + 1];
  }
  entry.auto = propose(analyse([left, right], FS));
  console.log(`${entry.file.padEnd(36)} talking ${entry.auto.talk} LUFS: ${entry.auto.loud.length} too loud, ${entry.auto.harsh.length} harsh`);
}
fs.writeFileSync(MANIFEST, JSON.stringify(entries, null, 2) + '\n');
