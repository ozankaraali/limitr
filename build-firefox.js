#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const rootDir = __dirname;
const outDir = path.join(rootDir, 'dist', 'firefox');
const skippedRootEntries = new Set([
  '.claude',
  '.git',
  '.playwright-mcp',
  'dist',
  'node_modules'
]);
const skippedFirefoxDirectories = new Set([
  'lib',
  'tests'
]);
const skippedFirefoxFiles = new Set([
  'build-firefox.js',
  'content-transcribe.js',
  'icons/generate-icons.html',
  'icons/genicons.js',
  'offscreen.html',
  'offscreen.js'
]);

function toRelativePath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

async function copyDirectory(sourceDir, targetDir, isRoot = false) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (isRoot && skippedRootEntries.has(entry.name)) continue;
    if (entry.name === '.DS_Store' || entry.name.endsWith('.csv')) continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    const relativePath = toRelativePath(sourcePath);
    if (skippedFirefoxFiles.has(relativePath)) continue;

    if (entry.isDirectory()) {
      if (skippedFirefoxDirectories.has(relativePath)) continue;
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function writeFirefoxManifest() {
  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

  manifest.permissions = manifest.permissions.filter(
    permission => permission !== 'tabCapture' && permission !== 'offscreen'
  );
  manifest.background = {
    scripts: ['background.js'],
    preferred_environment: ['document']
  };
  delete manifest.web_accessible_resources;

  await fs.writeFile(
    path.join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
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
