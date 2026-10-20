#!/usr/bin/env node
// Builds dist/chrome: what Chrome loads, ready to zip for the Chrome Web Store or Load unpacked.
// --out=DIR builds elsewhere (a folder directly inside dist/).

const path = require('path');
const { ROOT, outputDir, copyExtension } = require('./tools/extension-files');

async function main() {
  const outDir = outputDir('chrome');
  await copyExtension(outDir, { rootEntries: ['offscreen.html', 'offscreen.js'] });
  console.log(`Chrome build written to ${path.relative(ROOT, outDir)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
