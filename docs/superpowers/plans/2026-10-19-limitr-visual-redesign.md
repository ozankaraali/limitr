# Limitr Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Limitr its new identity: the sine-wave mark, four toolbar icon states, night and day
themes, a popup built from a main screen plus three secondary screens, and store artwork. Audio
behaviour does not change.

**Architecture:**
- **Popup:** stays one static page (`popup.html` + `popup.js` + `styles.css`). Screens are sibling
  `<section data-screen>` elements toggled by `showScreen()`. Colours are CSS custom properties switched
  by `prefers-color-scheme`. Canvas drawings read those properties at draw time.
- **Toolbar icons:** PNGs generated from one SVG mark by a node script. `background.js` picks one of
  four states per tab from status that the content bridges report.

**Tech Stack:**
- Plain MV3 extension JS (Chrome + Firefox 140+).
- `sharp`, already in `node_modules`, for icon PNGs.
- Playwright (Chromium) and puppeteer-core (real Firefox) for tests, including store artwork rendering.

**Spec:** `docs/superpowers/specs/2026-10-19-limitr-visual-redesign-design.md`, with reference images in
`docs/superpowers/specs/2026-10-19-limitr-visual-redesign/`.

## Global Constraints

**Order and branch**
- **Captions dependency:** start only after the parallel captions work has landed. `popup.html` must
  already contain `#captionsLanguage`, `#captionsTranslate`, `#captionsHint` and `#translationDownload`,
  and `popup.js` must contain `buildCaptionOptions()`, `prepareTranslation()` and
  `showTranscriptLine()`. Restyle those; don't reimplement them.
- **Commits:** branch `redesign-spike-guard`. Commit only once the owner has said committing is OK.
  Until then, treat each "Commit" step as "run the full suite and leave the tree green".

**Popup layout**
- Popup width is 360 px.
- The main screen, including the "Fine-tune ›" and "How Limitr listens ›" rows, must fit in 600 px
  with no scrolling.
- Only the body of a secondary screen may scroll, inside the existing inner scroller that reserves its
  scrollbar gutter.
- No horizontal overflow on any screen, in Chrome or Firefox.

**Theme tokens** (CSS custom property names in brackets)

| Token | Night (`prefers-color-scheme: dark`) | Day |
|---|---|---|
| background (`--bg`) | `#1c1d21` | `#f6f4ef` |
| raised surface (`--raised`) | `#26272c` | `#ffffff` |
| line / border (`--line`) | `#36383f` | `#e2ded5` |
| text (`--text`) | `#eff0f4` | `#1d1a2b` |
| muted text (`--muted`) | `#a3a6b0` | `#6c6680` |
| accent (`--accent`) | `#9586f7` | `#6b5ce7` |
| text on accent (`--on-accent`) | `#16122b` | `#ffffff` |
| spike gold (`--spike`) | `#f0b84a` | `#d4920f` |

**Toolbar icons**
- One colour per state, each at least 3:1 against both `#f1f3f4` (Chrome light toolbar) and `#35363a`
  (Chrome dark toolbar):

  | State | Colour |
  |---|---|
  | off | `#7d838c` |
  | on | `#8574ee` |
  | working | `#b07d18` |
  | attention | `#e5534b` |

- The spec's mockup gold `#efb646` measures 1.8:1 on a light toolbar, so toolbar icons use the
  darkened gold. The popup keeps `--spike`.

**Mark**
- Geometry is exactly `docs/superpowers/specs/2026-10-19-limitr-visual-redesign/mark.svg` (viewBox
  0–100).
- App tile: mark in `#1d1a2b` on a `#ffffff` rounded square, `rx` 22 in the 100 viewBox.

**Typography**
- IBM Plex Sans (400/500/600/700) for everything.
- IBM Plex Mono 500 only for the "CAUGHT" tag.
- Both are bundled as local woff2 files. No network requests for fonts or icons.

**Banned**
- Kauth colours: teal, orange, ink `#17212b`, paper `#f3f1ec`.
- Red anywhere except the attention state.
- All-caps mono labels other than "CAUGHT".

**Motion**
- Screen switches are instant.
- Transitions only respond to user actions, and are disabled under `prefers-reduced-motion`.

**Settings, presets and copy**
- No setting, preset value or storage key changes meaning.
- New UI-only keys go inside the existing `limitrUi` object.
- Copy: sentence case, plain language. Keep the existing status sentences in `renderStatus()`.

**Tests that must stay green after every task**

| What | Command |
|---|---|
| Engine | `node tests/run-engine-tests.js` |
| Chromium E2E | `node tests/run-extension-tests.js` |
| Assets | `node tests/run-asset-tests.js` (new in Task 1) |
| Firefox E2E | `node build-firefox.js --test && node tests/run-firefox-tests.js` |
| Firefox lint | `npm run lint:firefox`, 0 errors |

`npm install` first: it adds `puppeteer-core` and `web-ext` from `package.json`.

## Review Focus

| Input or condition | Expected behaviour | Pinned in |
|---|---|---|
| Many or long saved preset names (eight presets, 24-character names) | Main screen still fits 600 px with no horizontal overflow; the chips row stays one line and shows "+N" | Task 3 |
| System theme flips while the popup is open | Trace, mini trace and EQ curve redraw in the new theme's colours | Task 2, Task 4 |
| Popup opened on a restricted tab (`chrome://`, PDF viewer) | Main screen renders with its status sentence; secondary screens open; the tab icon is never `attention` | Task 4, Task 5 |
| A protected player and an unreachable one (for example an ad) play together | Icon is `working`, not `attention` | Task 5 |
| Popup reopened after closing it on a secondary screen | It opens on the main screen | Task 4 |

---

### Task 1: Mark and toolbar icons

**Files:**
- Create:
  - `icons/mark.svg`: copy of the spec's `mark.svg`.
  - `icons/build-icons.js`: the icon generator.
  - `tests/run-asset-tests.js`: asset checks.
- Delete: `icons/icon*.png`, `icons/generate-icons.html`, `icons/genicons.js`.
- Modify:
  - `manifest.json`: `action.default_icon` and `icons`.
  - `background.js`: `ICONS` and `setTabIcon`, around lines 16–46.
  - `build-firefox.js`: skip `icons/build-icons.js` and `icons/mark.svg`.
  - `package.json`: add the `"icons": "node icons/build-icons.js"` script.

**Interfaces:**
- Produces:
  - Files `icons/toolbar-{off,on,working,attention}-{16,32,48,128}.png` and
    `icons/app-{16,32,48,128}.png`.
  - In `background.js`, `ICONS` with keys `off`, `on`, `working` and `attention`. Each maps size to
    path.
  - `setTabIcon(tabId: number, iconState: 'off'|'on'|'working'|'attention'): void`, which also records
    `tabIconStates.set(tabId, iconState)` (`const tabIconStates = new Map()`, exposed for tests).
- Consumes: nothing.

- [ ] **Step 1: Write failing asset checks** in `tests/run-asset-tests.js`, using the same
  `check(label, ok, detail)` style as the other runners and `sharp(...).metadata()` for sizes:
  - every toolbar state × size and every app size exists, with width = height = size;
  - every icon path in `manifest.json` (`action.default_icon`, `icons`) and in
    `background.js` `ICONS` exists on disk. Read `ICONS` by evaluating `background.js` with stubbed
    `chrome`, or parse the paths with a regex;
  - in each `toolbar-*-32.png`, the most common opaque pixel colour is within ±2 per channel of that
    state's colour (`#7d838c`, `#8574ee`, `#b07d18`, `#e5534b`);
  - each of those four colours has a contrast ratio of at least 3.0 against both `#f1f3f4` and
    `#35363a`, using the WCAG relative luminance formula.
- [ ] **Step 2: Run** `node tests/run-asset-tests.js`. Expected: FAIL on the missing toolbar and app
  files.
- [ ] **Step 3: Implement `icons/build-icons.js`.**
  - Read `icons/mark.svg`, substitute `currentColor` per state, and rasterise with `sharp` at 16, 32, 48
    and 128.
  - Toolbar icons have a transparent background.
  - App tiles add `<rect width="100" height="100" rx="22" fill="#ffffff"/>` under the mark, which is
    drawn in `#1d1a2b`.
  - Run it once to produce the PNGs.
- [ ] **Step 4: Wire the icons in.**
  - `manifest.json`: `action.default_icon` points to the `toolbar-off-*` set and `icons` to `app-*`.
  - `background.js`: replace `ICONS.off/on/active` with the four new sets.
  - Change `setTabIcon` to the signature above and update its callers:
    - `refreshGlobalIcon` uses `on`/`off`;
    - capture success uses `working`;
    - `limitr-status` uses `working` when `attached > 0`, else `on`, until Task 5 adds `attention`.
- [ ] **Step 5: Run** the asset tests, Chromium E2E and Firefox E2E. Expected: all PASS.
- [ ] **Step 6: Commit:** `git commit -m "Add sine-wave mark and four toolbar icon states"`

### Task 2: Theme tokens and typography

**Files:**
- Create:
  - `fonts/ibm-plex-sans-{400,500,600,700}-latin.woff2` and `fonts/ibm-plex-mono-500-latin.woff2`. Fetch
    the latin subset URLs from `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500`
    with a modern browser User-Agent, the same way `fonts/nunito-latin.woff2` was fetched.
  - `fonts/OFL.txt`: replace with IBM Plex's licence from `https://github.com/IBM/plex/blob/master/LICENSE.txt`.
- Delete: `fonts/nunito-latin.woff2`.
- Modify:
  - `styles.css`: `@font-face` blocks, the `:root` tokens and a `@media (prefers-color-scheme: dark)`
    block. Rename `--night/--dusk/--haze/--mist/--moon/--iris/--lamp` usages to the token names in
    Global Constraints.
  - `popup.js`: `drawTrace()` and `drawEqCurve()` read colours via a new `themeColors()`.
  - `NOTICE`: replace the Nunito entry with IBM Plex.
  - `tests/debug-harness.html`: the same tokens and fonts, through `../styles.css` variables or a copy
    of the `:root` blocks.
  - `tests/run-extension-tests.js`: add theme checks.

**Interfaces:**
- Produces:
  - In `popup.js`, `themeColors(): { bg, raised, line, text, muted, accent, onAccent, spike }`. Each is
    a CSS colour string read from `getComputedStyle(document.documentElement)` at call time.
  - The CSS custom properties `--bg --raised --line --text --muted --accent --on-accent --spike`.
- Consumes: nothing.

- [ ] **Step 1: Write failing E2E checks** in `tests/run-extension-tests.js`, in a new "Theme" block on
  the popup page:
  - `await popup.emulateMedia({ colorScheme: 'dark' })`, then
    `getComputedStyle(document.body).backgroundColor === 'rgb(28, 29, 33)'`;
  - `emulateMedia({ colorScheme: 'light' })`, then `'rgb(246, 244, 239)'`;
  - after switching to dark, `themeColors().spike` (via `popup.evaluate`) equals `#f0b84a` or its
    `rgb()` form;
  - `document.fonts.check('600 14px "IBM Plex Sans"')` is true after `document.fonts.ready`;
  - every request URL the popup makes is `chrome-extension://` (record them with `popup.on('request')`).
- [ ] **Step 2: Run** `node tests/run-extension-tests.js`. Expected: the new theme checks FAIL.
- [ ] **Step 3: Implement** the tokens, the fonts and `themeColors()`.
  - Replace every hard-coded colour in `drawTrace()` and `drawEqCurve()` with `themeColors()` values.
  - Add `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', …)` to redraw both.
  - Restyle `tests/debug-harness.html` to the tokens.
- [ ] **Step 4: Run** Chromium E2E, Firefox E2E and the lint. Expected: all PASS.
- [ ] **Step 5: Commit:** `git commit -m "Night and day themes with IBM Plex"`

### Task 3: Main screen

**Files:**
- Modify:
  - `popup.html`: wrap the main content in `<section class="screen" data-screen="main">`.
  - `popup.js`: `renderPresets()`, new `renderPresetChips()`, and the CAUGHT bar in `renderCaption()`.
    Remove the `levelEnabled` quick toggle wiring from `bindEvents()`/`renderControls()`.
  - `styles.css`.
  - `tests/run-extension-tests.js`.

**Main screen order** (spec, "Popup screens"):
1. mark + "Limitr" + power switch;
2. `#status`;
3. `#trace`;
4. CAUGHT bar (`<p id="traceCaption" class="caught">` with `<span class="tag">CAUGHT</span>`);
5. `#presetGrid` (3 × 2);
6. `#presetChips`;
7. `#presetExplainer`;
8. volume;
9. two quick switches: `#denoiseEnabled`, then `#captions` with `#captionsChip`;
10. nav rows `<button class="nav-row" data-open="finetune">Fine-tune</button>` and
    `data-open="listening"` ("How Limitr listens").

**Header mark:** inline the mark SVG with `fill="currentColor"`.

**Preset icons:** exact markup, `viewBox="0 0 24 24"`, `stroke="currentColor"`, stroke-width 1.7,
round caps and joins, no fill.

```js
const PRESET_ICONS = {
  off: '<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  gentle: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
  stream: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
  sleep: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
  movie: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4"/>',
  tv90s: '<rect x="3.5" y="7" width="17" height="13" rx="2.5"/><path d="M8.5 3.5L12 7l3.5-3.5"/>'
};
```

**Interfaces:**
- Consumes: `themeColors()` (Task 2).
- Produces:
  - `renderPresetChips(): void`. It renders saved presets as `<button class="chip" data-preset=id>`
    with an inner `<button class="chip-remove" aria-label="Delete preset NAME">`.
  - `.chip-row`: one line, `overflow: hidden`, `flex-wrap: nowrap`. Chips that don't fit collapse into
    a trailing `<button class="chip more">+N</button>`, which calls `showScreen('finetune')` and focuses
    `#savedPresets` (Task 4).
  - `#captionsChip`: shows the caption language name and is hidden when captions are off.

- [ ] **Step 1: Write failing E2E checks**, popup at 360 × 600 in both colour schemes:
  - `.screen[data-screen="main"]` `scrollHeight <= 600`;
  - both `.nav-row` elements are fully inside the viewport;
  - `document.querySelectorAll('#presetGrid .preset svg').length === 6`;
  - no `#levelEnabled` element on the main screen;
  - after seeding `limitrUserPresets` with 8 presets named `'A long preset name 1234'` and reloading:
    - main `scrollHeight <= 600`;
    - `.chip-row` `scrollWidth <= clientWidth + 1`;
    - a `.chip.more` exists;
    - document `scrollWidth <= 360`.
- [ ] **Step 2: Run** the new checks. Expected: FAIL.
- [ ] **Step 3: Implement** the layout and `renderPresetChips()`.
  - Selecting a factory preset still calls `applyPreset(id)`; chips call it too.
  - `deletePreset(id)` is unchanged.
  - Measure the fitting chips after layout with `requestAnimationFrame` and replace the overflow with
    the "+N" chip.
- [ ] **Step 4: Run** the full suite. Update selectors in the existing checks: the old
  `#fineTune > summary` and `#processing > summary` clicks become `.nav-row` clicks once Task 4 lands,
  so mark them `TODO(Task 4)` for now only if they fail. Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Redesigned main screen"`

### Task 4: Secondary screens, Fine-tune and listening mode

**Files:**
- Modify:
  - `popup.html`: replace the `<details id="fineTune">` and `<details id="processing">` drawers with
    `<section class="screen" data-screen="finetune" hidden>` and `data-screen="listening"`. Each starts
    with `<header class="screen-head"><button class="back" aria-label="Back">←</button><h2>Title</h2></header>`.
  - `popup.js`: `showScreen()`, `buildFineTune()` (section icons, saved presets list, live strip),
    `drawTrace()` refactor, and Esc handling.
  - `styles.css`.
  - The tests listed in Steps 1–2.

**Fine-tune live strip:** pinned under the header and outside the scrolling body. It contains:
- `<canvas id="miniTrace" width="656" height="80">`, shown at 40 px tall;
- a copy of the CAUGHT line, `#miniCaught`;
- `#miniPreset`: the preset name, or "Adjusted from NAME · Reset", reusing the logic in
  `renderPresets()`.

**Fine-tune sections:**
- Add an `icon` key to each `GROUPS` entry, drawn in a 28 px circle with a 1 px `--line` border and the
  stroke in `--accent`.
- Keep every existing control: all six Spike guard sliders, the EQ curve and its five bands, all six
  compressor sliders, and the extras.
- Section open state stays in `state.ui.groups`.
- Exact icon markup:

```js
const SECTION_ICONS = {
  'Spike guard': '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M8.5 12.5c1-1.6 2-1.6 3 0s2 1.6 3 0"/>',
  'Even out levels': '<path d="M4 8h16M4 16h16"/><circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/>',
  'Peak limiter': '<path d="M4 6h16"/><path d="M4 18c3 0 3-8 6-8s3 8 6 8"/>',
  'Tone': '<path d="M5 20V4M12 20V4M19 20V4"/><circle cx="5" cy="14" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="16" r="2"/>',
  'Compressor': '<path d="M4 12h4l2-5 4 10 2-5h4"/>',
  'Extras': '<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/><circle cx="12" cy="12" r="2"/>'
};
```

**Saved presets:** a final section `#savedPresets` ("Your presets") lists every saved preset as a row
with apply and delete buttons. It sits above the existing save form (`#savePresetForm`,
`#savePresetButton`).

**Listening screen:** the existing mode radios (`input[name="mode"]`), restyled as cards, then `#mixer`.

**Interfaces:**
- Consumes: `themeColors()` (Task 2); `renderPresetChips()` and `.chip.more` (Task 3).
- Produces:
  - `showScreen(name: 'main'|'finetune'|'captions'|'listening'): void`. It sets `hidden` on every
    `.screen` except the one named, sets `state.screen`, moves focus to that screen's `.back` button (or
    to `#power` on main), and scrolls the new screen's body to the top.
  - `drawTrace(canvas: HTMLCanvasElement, history: Array<{out:number, cut:number, limit:number}>,
    options?: { label?: boolean }): void`. The main trace passes `{ label: true }`, which draws
    "Taming starts here"; the mini trace passes nothing.
  - `pollMeters()` draws both canvases each tick.
  - Escape on a secondary screen calls `preventDefault()` and `showScreen('main')`. If the browser
    closes the popup on Esc anyway, that's acceptable, because the popup always opens on main.

- [ ] **Step 1: Write failing E2E checks** (Chromium):
  - clicking `.nav-row[data-open="finetune"]` shows `[data-screen="finetune"]` and hides main;
  - `#miniTrace` is visible;
  - six `.gi svg` icons;
  - all six Spike guard sliders exist (`#ctl-guardHeadroom`, `#ctl-guardCeiling`, `#ctl-guardRatio`,
    `#ctl-guardAttack`, `#ctl-guardHold`, `#ctl-guardRelease`);
  - setting `#ctl-guardHeadroom` to 8 and dispatching `input` stores `limitrSettings.guardHeadroom === 8`;
  - `.back` click returns to main;
  - `keyboard.press('Escape')` on finetune returns to main;
  - on the listening screen, both mode cards are visible;
  - for each secondary screen at 360 × 600, document `scrollWidth <= 360` and the scroller's
    `scrollWidth <= clientWidth`;
  - after `popup.reload()` while on finetune, main is visible;
  - with the popup opened for a `chrome://newtab/` tab (`?tabId=` of that tab):
    - main renders;
    - `#status` contains "can’t be processed";
    - the finetune screen opens;
  - after `emulateMedia({ colorScheme: 'light' })` on the finetune screen, the pixel colour sampled at
    a filled area of `#miniTrace` differs from the dark-scheme sample.
- [ ] **Step 2: Extend** `tests/firefox-test-hook.js` `popup-metrics` to also open each secondary
  screen (`view.document.querySelector('.nav-row[data-open="…"]').click()`) and return its overflow
  numbers. Assert them in `tests/run-firefox-tests.js`.
- [ ] **Step 3: Run** both runners. Expected: the new checks FAIL.
- [ ] **Step 4: Implement** the screens, `showScreen()`, the `drawTrace()` refactor, the live strip,
  section icons, saved presets and the listening screen. Remove the `<details>` drawer CSS that is no
  longer used.
- [ ] **Step 5: Run** the full suite, including Firefox, and regenerate the screenshots:
  `node tests/run-extension-tests.js --screenshots=/tmp/limitr-shots`. Inspect them against
  `main-night.png` and `fine-tune-and-captions.png`. Expected: PASS, and the screenshots match the
  reference layout.
- [ ] **Step 6: Commit:** `git commit -m "Fine-tune and listening as secondary screens"`

### Task 5: "Needs attention" icon state

**Files:**
- Modify:
  - `content-audio.js`: track skipped elements that are playing.
  - `content-bridge.js`: report attention changes.
  - `background.js`: compute the icon state and record capture failures.
  - `tests/run-extension-tests.js`.

**Rules** (spec, "Toolbar icon states"):
- State precedence: `off` (Limitr disabled) > `working` (`attached > 0` in any frame, or captured) >
  `attention` > `on`.
- `attention` when any of these hold:
  - `waitingForGesture > 0`;
  - `playingSkipped > 0` (a skipped element, reason `cross-origin`, `drm` or `page-audio`, that is not
    paused, not muted and has volume > 0);
  - a Whole-tab capture failure for the tab.
- The state clears to `on` when:
  - those counts drop to 0, for example on pause;
  - the mode changes to `page`;
  - the tab starts loading a new page (`tabs.onUpdated` with `status: 'loading'`), which also clears
    the tab's frame map.

**Interfaces:**
- Consumes: `setTabIcon(tabId, iconState)` and `tabIconStates` (Task 1).
- Produces:
  - Bridge → background message
    `{ action: 'limitr-status', attached: number, waitingForGesture: number, playingSkipped: number, enabled: boolean }`.
    It is sent whenever any of those values changes, including back to 0.
  - In `background.js`:
    - `iconStateFor(tabId: number): 'off'|'on'|'working'|'attention'`, which combines all frames;
    - `tabFrames: Map<tabId, Map<frameId, {attached, waitingForGesture, playingSkipped}>>`;
    - `captureFailures: Set<tabId>`, set in `autoCapture` and `capture-tab` failures, deleted on
      success.

- [ ] **Step 1: Write failing E2E checks.** Add a route `/remote-only.html` with only the cross-origin
  `<audio>` and a play button. Read the state through `worker.evaluate(id => tabIconStates.get(id))`.
  - Main test page after play: `'working'`. It has a protected player plus an unreachable one, which
    pins Review Focus row 4.
  - `/remote-only.html` after play: `'attention'`.
  - The same page after `tab.evaluate(() => document.querySelector('audio').pause())` and 500 ms:
    `'on'`.
  - After `limitrEnabled = false`: `'off'`.
  - A `chrome://newtab/` tab: never `'attention'`.
  - The popup `#status` on `/remote-only.html` contains "can’t be reached".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the rules above.
  - In `content-audio.js`, keep the skipped elements in a `Set`. Recount `playingSkipped` on `play`,
    `pause`, `volumechange` and `ended`, and call `reportStatus()`.
  - Remove the bridge's "only report when attached was ever > 0" gate.
  - Throttle reporting to at most one message per 250 ms per frame.
- [ ] **Step 4: Run** the full suite, Chromium and Firefox. Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Red toolbar state when Limitr needs the user"`

### Task 6: Captions screen

**Files:**
- Modify:
  - `popup.html`: move the captions controls (`#captionsLanguage`, `#captionsTranslate`, `#captionsHint`,
    `#translationDownload`, `#transcript`) into `<section class="screen" data-screen="captions" hidden>`.
    The main screen keeps only the `#captions` switch and `#captionsChip`.
  - `popup.js`: `#captionsChip` click and a click on the captions row text open
    `showScreen('captions')`; restyle `showTranscriptLine()`.
  - `styles.css`.
  - `tests/run-extension-tests.js`.

**Interfaces:**
- Consumes: `showScreen()` (Task 4); the captions work's `buildCaptionOptions()`,
  `prepareTranslation()` and `showTranscriptLine(result: { text: string, translation?: string })`.
- Produces: `showTranscriptLine` renders `<li><span class="orig">text</span><span class="tr">translation</span></li>`.
  `.tr` is muted at 12 px and omitted when there's no translation. The list keeps the last 6 lines.

- [ ] **Step 1: Write failing E2E checks:**
  - with captions toggled on through storage plus the popup, `#captionsChip` is visible and clicking it
    shows `[data-screen="captions"]`;
  - in the captions screen, `#captionsLanguage` and `#captionsTranslate` are visible;
  - sending
    `chrome.runtime.sendMessage({ action: 'transcription-result', tabId, result: { text: 'Herkese iyi akşamlar', translation: 'Good evening everyone' } })`
    from the service worker renders one `#transcript li` with `.orig` and `.tr`;
  - no horizontal overflow on this screen in Chromium and in the Firefox `popup-metrics` hook.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Keep `prepareTranslation()` on the user's click, because the Chrome
  Translator download needs that user activation.
- [ ] **Step 4: Run** the full suite plus `node tests/run-captions-tests.js`. Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Captions settings screen"`

### Task 7: Screenshots, store artwork and docs

**Files:**
- Create:
  - `tools/store-art/render.js`;
  - `tools/store-art/templates/{tile-small,tile-marquee,logo-edge,screenshot}.html`;
  - outputs in `docs/store/`.
- Modify:
  - `tests/run-extension-tests.js`: `--screenshots` also captures the main, finetune, captions and
    listening screens under `colorScheme` dark and light, named `popup-{screen}-{night|day}.png`.
  - `tests/run-asset-tests.js`.
  - `README.md`: new screenshots and mark.
  - `build-firefox.js`: add `tools` to `skippedRootEntries`.
  - `package.json`: `"store-art": "node tests/run-extension-tests.js --screenshots=docs/assets && node tools/store-art/render.js"`.
- Delete: `docs/assets/popup-main.png`, `popup-finetune.png` and `popup-processing.png`, once README
  points at the new files.

**Store outputs and pixel sizes** (spec, "Store artwork"):

| File | Size (px) |
|---|---|
| `docs/store/icon-128.png` | 128 × 128, a copy of `icons/app-128.png` |
| `docs/store/logo-edge-300.png` | 300 × 300 |
| `docs/store/promo-small-440x280.png` | 440 × 280 |
| `docs/store/promo-marquee-1400x560.png` | 1400 × 560 |
| `docs/store/screenshot-{1..4}-1280x800.png` | 1280 × 800 each |

**Screenshot headlines and themes:**

| # | Headline | Popup screen | Theme |
|---|---|---|---|
| 1 | Sudden yells and alerts, tamed | main | night |
| 2 | Fall asleep to streams | main with the Sleep preset | night |
| 3 | Tune exactly how strict | finetune | day |
| 4 | Live captions, on your computer | captions | night |

Copy rules: plain language, no "AI-powered", no unmeasured numbers.

**Interfaces:**
- Consumes: the screenshot PNGs from the E2E runner; `icons/app-*.png` and `icons/mark.svg` (Task 1);
  the theme tokens (Task 2).
- Produces: the `docs/store/*` files above.

- [ ] **Step 1: Write failing asset checks.** Each `docs/store` file exists with exactly the
  dimensions in the table, and `README.md` references only image files that exist.
- [ ] **Step 2: Run** `node tests/run-asset-tests.js`. Expected: FAIL.
- [ ] **Step 3: Implement `render.js`.**
  - It loads each template in Playwright with `file://` URLs and the viewport set to the output size,
    and screenshots it.
  - Templates use the local Plex fonts and the theme tokens.
  - Tiles show the large mark, "Limitr" and one line: "Tames sudden loud spikes".
  - Screenshots place the real popup PNG beside the headline, on `--bg` of the theme shown.
- [ ] **Step 4: Run** `npm run store-art`, then the asset tests and the full suite. Open each
  `docs/store` PNG and check the text isn't clipped. Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Store artwork and new README screenshots"`
