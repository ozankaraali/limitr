// A/B player for the renders in variants/listen: serves this folder on 127.0.0.1 and opens ab.html
// in the default browser. Blind picks are appended to variants/results/ab-picks.jsonl.
// Run: node variants/ab.js (PORT=… picks another port, NO_OPEN=1 skips opening)
const path = require('path'), fs = require('fs'), { execFile } = require('child_process');
const { startStaticServer } = require(path.join(__dirname, '../tests/static-server'));
const PORT = Number(process.env.PORT) || 8731;
const PICKS = process.env.AB_PICKS || path.join(__dirname, 'results/ab-picks.jsonl');
const routes = {
  '/pick': (req, res) => {
    if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      try {
        const entry = JSON.parse(body);
        fs.mkdirSync(path.dirname(PICKS), { recursive: true });
        fs.appendFileSync(PICKS, JSON.stringify(entry) + '\n');
        res.writeHead(204);
      } catch {
        res.writeHead(400);
      }
      res.end();
    });
  }
};
startStaticServer(__dirname, routes, PORT).then(({ port }) => {
  const url = `http://127.0.0.1:${port}/ab.html`;
  console.log(`A/B player at ${url} (Ctrl+C stops it)`);
  if (!process.env.NO_OPEN) execFile('open', [url]);
});
