#!/usr/bin/env node
// Builds dist/firefox: same code, Firefox manifest (no Chrome-only tab capture / offscreen).

const fs = require('fs/promises');
const path = require('path');

const rootDir = __dirname;
// --test adds a small agent the Firefox E2E test drives (never ship that build)
const testBuild = process.argv.includes('--test');
const outDir = path.join(rootDir, 'dist', testBuild ? 'firefox-test' : 'firefox');
const skippedRootEntries = new Set(['.claude', '.git', '.playwright-mcp', 'dist', 'node_modules', 'docs']);
const skippedFiles = new Set([
  'build-firefox.js',
  'package.json',
  'package-lock.json',
  'icons/build-icons.js',
  'icons/mark.svg',
  'offscreen.html',
  'offscreen.js'
]);
// Only the debug harness ships from tests/
const keptTestFiles = new Set(['tests/debug-harness.html', 'tests/debug-harness.js']);
if (testBuild) {
  keptTestFiles.add('tests/firefox-test-agent.js');
  keptTestFiles.add('tests/firefox-test-hook.js');
}

function toRelativePath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

async function copyDirectory(sourceDir, targetDir, isRoot = false) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (isRoot && skippedRootEntries.has(entry.name)) continue;
    if (entry.name.startsWith('.') || entry.name.endsWith('.csv')) continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    const relativePath = toRelativePath(sourcePath);
    if (skippedFiles.has(relativePath)) continue;
    if (relativePath.startsWith('tests/') && entry.isFile() && !keptTestFiles.has(relativePath)) continue;
    if (relativePath.startsWith('tests/') && entry.isDirectory()) continue;

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function writeFirefoxManifest() {
  const manifest = JSON.parse(await fs.readFile(path.join(rootDir, 'manifest.json'), 'utf8'));
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
  await fs.rm(outDir, { recursive: true, force: true });
  await copyDirectory(rootDir, outDir, true);
  await writeFirefoxManifest();
  console.log(`Firefox build written to ${path.relative(rootDir, outDir)}`);
  console.log(`Load this file in Firefox: ${path.join(outDir, 'manifest.json')}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
