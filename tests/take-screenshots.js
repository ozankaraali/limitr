// Take screenshots of Limitr popup for README
// Usage: node tests/take-screenshots.js
const { chromium } = require('playwright');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'docs', 'assets');

// Helper: freeze GR meter by overriding updateMeter, then set values
async function freezeGR(page, widthPct, dbText) {
  await page.evaluate(({ w, db }) => {
    // Kill the polling loop's ability to reset the meter
    window.updateMeter = () => {};
    const meter = document.getElementById('reductionMeter');
    const value = document.getElementById('reductionValue');
    if (meter) meter.style.width = w + '%';
    if (value) value.textContent = db;
  }, { w: widthPct, db: dbText });
}

// Helper: set status to active
async function setActive(page) {
  await page.evaluate(() => {
    const status = document.querySelector('.status');
    const text = document.querySelector('.status-text');
    if (status) status.classList.add('active');
    if (text) text.textContent = 'Active';
  });
}

// Helper: simulate exclusive mode visuals + remove grayed-out state
async function setExclusiveMode(page) {
  await page.evaluate(() => {
    // Set the JS variable so any subsequent calls see exclusive mode
    window.mixerMode = true;

    // Mode badge
    const badge = document.getElementById('modeBadge');
    const note = document.getElementById('modeNote');
    if (badge) {
      badge.textContent = 'Exclusive';
      badge.classList.remove('regular');
      badge.classList.add('exclusive');
    }
    if (note) {
      note.textContent = 'AI Denoise \u2022 AGC \u2022 No fullscreen';
      note.classList.add('exclusive');
    }

    // Exclusive toggle
    const toggle = document.getElementById('mixerModeToggle');
    if (toggle) toggle.checked = true;

    // Remove "unavailable" grayed-out state from exclusive features
    const excGroup = document.getElementById('exclusiveFeaturesGroup');
    if (excGroup) excGroup.classList.remove('unavailable');

    // Activate the exclusive badge ("Active" instead of "Requires Exclusive Mode")
    const excBadge = document.getElementById('exclusiveBadge');
    if (excBadge) {
      excBadge.textContent = 'Active';
      excBadge.classList.add('active');
    }

    // Un-gray simple mode ANC row too
    const simpleAnc = document.getElementById('simpleAncRow');
    if (simpleAnc) simpleAnc.classList.remove('unavailable');
  });
}

// Helper: enable noise suppression visually
async function enableNoiseSuppression(page) {
  await page.evaluate(() => {
    const toggleSimple = document.getElementById('noiseSuppressionToggleSimple');
    if (toggleSimple) toggleSimple.checked = true;
    const labelSimple = document.getElementById('noiseSuppressionLabelSimple');
    if (labelSimple) { labelSimple.textContent = 'On'; labelSimple.classList.add('active'); }
    // Advanced mode toggle too
    const toggleAdv = document.getElementById('noiseSuppressionToggle');
    if (toggleAdv) toggleAdv.checked = true;
    const labelAdv = document.getElementById('noiseSuppressionLabel');
    if (labelAdv) { labelAdv.textContent = 'On'; labelAdv.classList.add('active'); }
  });
}

// Helper: clip screenshot to container height
async function containerClip(page, width) {
  const h = await page.evaluate(() => document.querySelector('.container').scrollHeight + 20);
  return { x: 0, y: 0, width, height: Math.min(h, 900) };
}

(async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-gpu',
    ],
    viewport: { width: 440, height: 900 },
  });

  // Get extension ID
  let extensionId;
  for (let i = 0; i < 10; i++) {
    const workers = context.serviceWorkers();
    const w = workers.find(w => w.url().includes('chrome-extension://'));
    if (w) { extensionId = w.url().split('/')[2]; break; }
    await new Promise(r => setTimeout(r, 500));
  }
  if (!extensionId) { console.error('No extension ID'); await context.close(); process.exit(1); }
  console.log(`Extension ID: ${extensionId}`);
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;

  // ─── Screenshot 1: Simple Mode — clean overview ──────────────────────
  const page = await context.newPage();
  await page.goto(popupUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Make sure toggle is off so it matches the "Off" status text
  const enabledToggle = page.locator('#enabled');
  if (await enabledToggle.isChecked()) {
    await page.locator('.toggle:has(#enabled)').click();
    await page.waitForTimeout(200);
  }

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'screenshot-1-simple-mode.png'),
    clip: await containerClip(page, 440),
  });
  console.log('1/3 Simple mode');

  // ─── Screenshot 2: Active Exclusive + Night Mode + GR meter ──────────
  // Enable extension
  if (!(await page.locator('#enabled').isChecked())) {
    await page.locator('.toggle:has(#enabled)').click();
    await page.waitForTimeout(200);
  }

  // Set exclusive mode visuals + active status
  await setExclusiveMode(page);
  await setActive(page);

  // Select Night Mode
  await page.locator('.preset-btn[data-preset="nightMode"]').click();
  await page.waitForTimeout(300);

  // Enable RNNoise
  await enableNoiseSuppression(page);

  // Freeze and simulate GR meter
  await freezeGR(page, 35, '-8.4 dB');

  await page.waitForTimeout(100);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'screenshot-2-active-exclusive.png'),
    clip: await containerClip(page, 440),
  });
  console.log('2/3 Active Exclusive + Night Mode + GR');

  // ─── Screenshot 3: Advanced Mode with sections open ──────────────────
  // Switch to advanced mode
  await page.locator('.toggle:has(#modeToggle)').click();
  await page.waitForTimeout(500);

  // Re-apply exclusive visuals (mode toggle may reset badge)
  await setExclusiveMode(page);
  await setActive(page);
  await enableNoiseSuppression(page);
  await freezeGR(page, 28, '-6.2 dB');

  // Expand EQ section (visually interesting with the curve)
  const eqSection = page.locator('#eqSection');
  if (await eqSection.count() > 0) {
    const collapsed = await eqSection.evaluate(el => el.classList.contains('collapsed'));
    if (collapsed) {
      await eqSection.locator('.section-header').click();
      await page.waitForTimeout(200);
    }
  }

  await page.waitForTimeout(100);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'screenshot-3-advanced-mode.png'),
    fullPage: true,
  });
  console.log('3/3 Advanced mode (Exclusive + EQ open)');

  await page.close();
  await context.close();
  console.log('\nAll screenshots saved to docs/assets/');
})();
