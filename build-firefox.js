#!/usr/bin/env node
// Builds dist/firefox: same code, Firefox manifest (no Chrome-only tab capture / offscreen).

const fs = require('fs/promises');
const path = require('path');
const { ROOT, outputDir, copyExtension } = require('./tools/extension-files');

// --test adds a small agent the Firefox E2E test drives (never ship that build).
// --out=DIR builds elsewhere, so linting doesn't overwrite a dist/firefox that Firefox has loaded.
const testBuild = process.argv.includes('--test');

async function writeFirefoxManifest(outDir) {
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
  manifest.permissions = manifest.permissions.filter(p => p !== 'tabCapture' && p !== 'offscreen');
  manifest.background = {
    scripts: manifest.background.scripts,
    preferred_environment: ['document']
  };
  if (testBuild) {
    manifest.background.scripts.push('tests/firefox-test-hook.js');
    manifest.content_scripts.push({
      matches: ['http://127.0.0.1/*'],
      js: ['tests/firefox-test-agent.js'],
      run_at: 'document_start'
    });
  }
  await fs.writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const outDir = outputDir(testBuild ? 'firefox-test' : 'firefox');
  await copyExtension(outDir, {
    testFiles: testBuild ? ['tests/firefox-test-agent.js', 'tests/firefox-test-hook.js'] : []
  });
  await writeFirefoxManifest(outDir);
  console.log(`Firefox build written to ${path.relative(ROOT, outDir)}`);
  console.log(`Load this file in Firefox: ${path.join(outDir, 'manifest.json')}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
