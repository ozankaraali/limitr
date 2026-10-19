#!/usr/bin/env node
// Checks generated assets: toolbar/app icons, the paths the manifest and background point at,
// and that toolbar colours stay visible on light and dark browser toolbars.
// Run: node tests/run-asset-tests.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SIZES = [16, 32, 48, 128];
const TOOLBAR_COLOURS = { off: '#7d838c', on: '#8574ee', working: '#b07d18', attention: '#e5534b' };
const TOOLBARS = { 'Chrome light toolbar': '#f1f3f4', 'Chrome dark toolbar': '#35363a' };

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

const exists = rel => fs.existsSync(path.join(ROOT, rel));
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

async function dominantOpaqueColour(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] !== 255) continue;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best ? best[0].split(',').map(Number) : null;
}

// Icon paths the background script uses: evaluate just its icon definitions in a sandbox
function backgroundIconPaths() {
  const source = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
  const start = source.includes('const ICON_SIZES') ? source.indexOf('const ICON_SIZES') : source.indexOf('const ICONS');
  const end = source.indexOf('};', source.indexOf('const ICONS')) + 2;
  const icons = require('vm').runInNewContext(`${source.slice(start, end)}\nICONS`);
  return Object.values(icons).flatMap(set => Object.values(set));
}

(async () => {
  console.log('\nToolbar and app icons');
  for (const state of Object.keys(TOOLBAR_COLOURS)) {
    for (const size of SIZES) {
      const rel = `icons/toolbar-${state}-${size}.png`;
      const meta = exists(rel) ? await sharp(path.join(ROOT, rel)).metadata() : null;
      check(`${rel} is ${size}×${size}`, meta && meta.width === size && meta.height === size, meta ? `${meta.width}×${meta.height}` : 'missing');
    }
  }
  for (const size of SIZES) {
    const rel = `icons/app-${size}.png`;
    const meta = exists(rel) ? await sharp(path.join(ROOT, rel)).metadata() : null;
    check(`${rel} is ${size}×${size}`, meta && meta.width === size && meta.height === size, meta ? `${meta.width}×${meta.height}` : 'missing');
  }

  console.log('\nIcon colours');
  for (const [state, hex] of Object.entries(TOOLBAR_COLOURS)) {
    const rel = `icons/toolbar-${state}-32.png`;
    const rgb = exists(rel) ? await dominantOpaqueColour(path.join(ROOT, rel)) : null;
    const want = hexToRgb(hex);
    check(`${state} icon is drawn in ${hex}`, rgb && rgb.every((v, i) => Math.abs(v - want[i]) <= 2), rgb ? `rgb(${rgb})` : 'missing');
    for (const [name, bg] of Object.entries(TOOLBARS)) {
      const ratio = contrast(hex, bg);
      check(`${state} ${hex} readable on ${name}`, ratio >= 3, `${ratio.toFixed(2)}:1`);
    }
  }

  console.log('\nReferenced icon files');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const manifestPaths = [...Object.values(manifest.action.default_icon), ...Object.values(manifest.icons)];
  for (const rel of manifestPaths) check(`manifest → ${rel}`, exists(rel));
  const bgPaths = backgroundIconPaths();
  check('background.js ICONS has four states × four sizes', bgPaths.length === 16, `${bgPaths.length} paths`);
  for (const rel of bgPaths) check(`background.js → ${rel}`, exists(rel));

  console.log('\nIcon files referenced by pages and docs');
  for (const page of ['popup.html', 'README.md', 'tests/debug-harness.html']) {
    const text = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const refs = [...new Set([...text.matchAll(/(?:\.\.\/)?(icons\/[\w.-]+\.(?:png|svg))/g)].map(m => m[1]))];
    for (const rel of refs) check(`${page} → ${rel}`, exists(rel));
  }

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
