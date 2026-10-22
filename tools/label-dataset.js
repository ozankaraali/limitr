#!/usr/bin/env node
// A local page for labelling the recorded-stream dataset: plays each file with its loudness and
// the moments that jump well above the stream's talking level or turn harsh (a mic clipping), so
// the listener can mark each one too loud, harsh or fine. Every mark is written back into
// tests/fixtures/dataset.json as it is made.
// Run: node tools/label-dataset.js [port], then open the address it prints (port 8723 by default).

const fs = require('fs');
const path = require('path');
const { startStaticServer } = require('../tests/static-server');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'tests/fixtures/dataset.json');
const DIR = path.join(process.env.LIMITR_RECORDINGS || path.join(ROOT, 'tests/fixtures/recordings'), 'dataset');

const readManifest = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const isRanges = v => Array.isArray(v) && v.every(r => Array.isArray(r) && r.length === 2 &&
  r.every(Number.isFinite) && r[0] < r[1]);

const routes = {
  '/': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'label-dataset.html')));
  },
  '/stream-analysis.js': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'stream-analysis.js')));
  },
  '/dataset.json': (req, res) => {
    const entries = readManifest().map(e => ({ ...e, present: fs.existsSync(path.join(DIR, e.file)) }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(entries));
  },
  '/save': (req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { file, loud, fine, harsh = [], notes } = JSON.parse(body);
        if (![loud, fine, harsh].every(isRanges)) throw new Error('bad ranges');
        const entries = readManifest();
        const entry = entries.find(e => e.file === file);
        if (!entry) throw new Error('unknown file');
        Object.assign(entry, { loud, fine, harsh, reviewed: true });
        if (typeof notes === 'string' && notes.trim()) entry.notes = notes.trim();
        fs.writeFileSync(MANIFEST, JSON.stringify(entries, null, 2) + '\n');
        res.writeHead(200);
        res.end('saved');
      } catch (e) {
        res.writeHead(400);
        res.end(e.message);
      }
    });
  }
};
for (const entry of readManifest()) {
  routes[`/audio/${entry.file}`] = (req, res) => {
    const file = path.join(DIR, entry.file);
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'audio/ogg' });
    fs.createReadStream(file).pipe(res);
  };
}

startStaticServer(path.join(__dirname, 'empty-root'), routes, Number(process.argv[2]) || 8723).then(({ port }) => {
  console.log(`Label the dataset at http://127.0.0.1:${port}/  (Ctrl+C to stop)`);
});
