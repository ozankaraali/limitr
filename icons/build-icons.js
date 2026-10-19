#!/usr/bin/env node
// Renders the toolbar icon states and the app tile from icons/mark.svg.
// Run: node icons/build-icons.js   (or npm run icons)

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SIZES = [16, 32, 48, 128];
// Each at least 3:1 against Chrome's light (#f1f3f4) and dark (#35363a) toolbars
const TOOLBAR_COLOURS = { off: '#7d838c', on: '#8574ee', working: '#b07d18', attention: '#e5534b' };
const TILE = { background: '#ffffff', mark: '#1d1a2b', radius: 22 };

const mark = fs.readFileSync(path.join(__dirname, 'mark.svg'), 'utf8');

function render(svg, size, file) {
  // Render large and downsample so small sizes stay crisp and evenly antialiased
  return sharp(Buffer.from(svg), { density: Math.max(72, (size / 100) * 72 * 8) })
    .resize(size, size)
    .png()
    .toFile(path.join(__dirname, file));
}

async function main() {
  // The toolbar slot is tiny, so frame the wave tighter than the app tile does
  const toolbarMark = mark.replace('viewBox="0 0 100 100"', 'viewBox="7 7 86 86"');
  for (const [state, colour] of Object.entries(TOOLBAR_COLOURS)) {
    const svg = toolbarMark.replace(/currentColor/g, colour);
    for (const size of SIZES) await render(svg, size, `toolbar-${state}-${size}.png`);
  }
  const tile = mark
    .replace(/currentColor/g, TILE.mark)
    .replace(/(<svg[^>]*>)/, `$1<rect width="100" height="100" rx="${TILE.radius}" fill="${TILE.background}"/>`);
  for (const size of SIZES) await render(tile, size, `app-${size}.png`);
  console.log(`Wrote ${Object.keys(TOOLBAR_COLOURS).length * SIZES.length + SIZES.length} icons to icons/`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
