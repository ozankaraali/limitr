#!/usr/bin/env node
// Builds both packages and zips them for a release: dist/limitr-<version>-chrome.zip and
// dist/limitr-<version>-firefox.zip, with the manifest at the zip root as both stores expect.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./extension-files');

const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
for (const [browser, script] of [['chrome', 'build-chrome.js'], ['firefox', 'build-firefox.js']]) {
  execFileSync('node', [script], { cwd: ROOT, stdio: 'inherit' });
  const zip = path.join(ROOT, 'dist', `limitr-${version}-${browser}.zip`);
  fs.rmSync(zip, { force: true }); // zip would add to an existing archive
  execFileSync('zip', ['-r', '-X', '-q', zip, '.'], { cwd: path.join(ROOT, 'dist', browser) });
  console.log(`${path.relative(ROOT, zip)}  ${(fs.statSync(zip).size / 1e6).toFixed(1)} MB`);
}
