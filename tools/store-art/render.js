#!/usr/bin/env node
// Renders store artwork into docs/store/ from HTML templates, the real popup screenshots in
// docs/assets/ (made by `node tests/run-extension-tests.js --screenshots=docs/assets`) and
// icons/mark.svg. Run: npm run store-art

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const TEMPLATES = path.join(__dirname, 'templates');
const OUT = path.join(ROOT, 'docs', 'store');

const SCREENSHOTS = [
  {
    image: 'popup-main-night.png', theme: 'night',
    headline: 'Sudden yells and alerts, tamed',
    sub: 'Limitr learns how loud the stream normally is and pulls anything that jumps above it back down. Normal talking stays untouched.'
  },
  {
    image: 'popup-sleep-night.png', theme: 'night',
    headline: 'Fall asleep to streams',
    sub: 'Sleep keeps everything quiet and even, with softer highs, so a sudden spike barely rises above the talking.'
  },
  {
    image: 'popup-finetune-day.png', theme: 'day',
    headline: 'Tune exactly how strict',
    sub: 'Fine-tune shows the live loudness while you adjust, so you see what each change does.'
  },
  {
    image: 'popup-captions-night.png', theme: 'night',
    headline: 'Live captions, on your computer',
    sub: 'Speech is recognised and translated locally. No audio leaves your browser.'
  }
];

async function main() {
  for (const shot of SCREENSHOTS) {
    if (!fs.existsSync(path.join(ROOT, 'docs', 'assets', shot.image))) {
      throw new Error(`Missing docs/assets/${shot.image}. Run: node tests/run-extension-tests.js --screenshots=docs/assets`);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });

  const markSvg = fs.readFileSync(path.join(ROOT, 'icons', 'mark.svg'), 'utf8');
  const shapes = markSvg.slice(markSvg.indexOf('<path'), markSvg.lastIndexOf('</svg>'));
  const symbol = `<svg width="0" height="0" style="position:absolute"><symbol id="wave" viewBox="0 0 100 100">${shapes}</symbol></svg>`;

  const browser = await chromium.launch({ args: ['--disable-gpu'] });
  const page = await browser.newPage();
  const render = async (template, query, width, height, file) => {
    await page.setViewportSize({ width, height });
    const url = `file://${path.join(TEMPLATES, template)}${query ? `?${new URLSearchParams(query)}` : ''}`;
    await page.goto(url);
    await page.evaluate(markup => document.body.insertAdjacentHTML('afterbegin', markup), symbol);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(img => img.complete));
    // A popup cut off by the artwork's edge reads as a mistake, so never ship one
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.popup')].some(img => {
      const box = img.getBoundingClientRect();
      return box.top < 0 || box.left < 0 || box.bottom > innerHeight || box.right > innerWidth;
    }));
    if (clipped) throw new Error(`${file}: the popup image runs past the edge of the artwork`);
    await page.screenshot({ path: path.join(OUT, file) });
    console.log(`  ${file}`);
  };

  fs.copyFileSync(path.join(ROOT, 'icons', 'app-128.png'), path.join(OUT, 'icon-128.png'));
  console.log('  icon-128.png');
  await render('logo-edge.html', null, 300, 300, 'logo-edge-300.png');
  await render('tile-small.html', null, 440, 280, 'promo-small-440x280.png');
  await render('tile-marquee.html', null, 1400, 560, 'promo-marquee-1400x560.png');
  for (const [i, shot] of SCREENSHOTS.entries()) {
    await render('screenshot.html', shot, 1280, 800, `screenshot-${i + 1}-1280x800.png`);
  }
  await browser.close();
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
