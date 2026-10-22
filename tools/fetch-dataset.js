#!/usr/bin/env node
// Downloads the recorded-stream dataset listed in tests/fixtures/dataset.json into
// tests/fixtures/recordings/dataset/ (or the folder named by LIMITR_RECORDINGS, plus /dataset),
// as 48 kHz stereo Opus. A `url` source is a stretch of a Kick broadcast (HLS, through ffmpeg);
// a `ytdlp` source is a page yt-dlp understands (a Kick clip, whole, or a stretch of a YouTube
// video). Kick clips go through yt-dlp because their playlists address one file by byte ranges,
// which ffmpeg drops parts of. Files already there are skipped. Needs ffmpeg and yt-dlp.
// Run: node tools/fetch-dataset.js [name-filter]

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const entries = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/dataset.json'), 'utf8'));
const dir = path.join(process.env.LIMITR_RECORDINGS || path.join(ROOT, 'tests/fixtures/recordings'), 'dataset');
const filter = process.argv[2] || '';
fs.mkdirSync(dir, { recursive: true });

// Opus at 160 kbps: the sources are already lossy, and loudness comes through within 0.1 dB
const ENCODE = ['-vn', '-ac', '2', '-ar', '48000', '-c:a', 'libopus', '-b:a', '160k'];

let failed = 0;
for (const entry of entries) {
  if (!entry.file.includes(filter)) continue;
  const out = path.join(dir, entry.file);
  if (fs.existsSync(out)) continue;
  if (entry.source.local) {
    console.log(`${entry.file}: a local recording (${entry.source.local}), copy it in by hand`);
    continue;
  }
  const { start, seconds } = entry.source;
  const partial = `${out}.part.ogg`;
  try {
    if (entry.source.url) {
      execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-ss', String(start), '-i', entry.source.url,
        '-t', String(seconds), ...ENCODE, '-y', partial], { stdio: 'inherit' });
    } else if (entry.source.ytdlp) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-dl-'));
      const sections = seconds ? ['--download-sections', `*${start}-${start + seconds}`] : [];
      execFileSync('yt-dlp', ['--no-warnings', '--quiet', '--no-progress', '-f', 'bestaudio/best', ...sections,
        '-o', path.join(tmp, 'audio.%(ext)s'), entry.source.ytdlp], { stdio: 'inherit' });
      const [downloaded] = fs.readdirSync(tmp);
      execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', path.join(tmp, downloaded),
        ...ENCODE, '-y', partial], { stdio: 'inherit' });
      fs.rmSync(tmp, { recursive: true, force: true });
    } else {
      throw new Error('no source');
    }
    fs.renameSync(partial, out);
    console.log(`${entry.file}  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  } catch (e) {
    failed++;
    fs.rmSync(partial, { force: true });
    console.error(`${entry.file}: ${e.message.split('\n')[0]}`);
  }
}
process.exit(failed ? 1 : 0);
