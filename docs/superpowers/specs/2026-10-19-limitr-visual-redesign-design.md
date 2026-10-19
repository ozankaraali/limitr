# Limitr visual redesign

**Date:** 2026-10-19
**Branch:** `redesign-spike-guard` (on top of the v2 engine and popup rewrite)
**Reference assets:** `docs/superpowers/specs/2026-10-19-limitr-visual-redesign/`

## Intent

Limitr's look was put together early, before there was any real design process: a generic purple
waveform badge, purple everything, and controls that grew one feature at a time. The owner's Kauth
project showed what a considered identity feels like. A meaningful mark came first (an hourglass-K the
owner drew), then a calm palette, consistent line icons and generous spacing, all derived from it.

Limitr should get the same treatment. Its audience is mostly people watching streams at night, often in
bed, who want sudden spikes (alerts, blerps, yelling, explosions) tamed without losing audio quality.
The owner prefers the daylight version of the design but recognises the product is night-first, so the
popup follows the system's light/dark setting.

Success means opening the popup at night feels calm and obvious. In one glance you can see that Limitr
is on, that it's working on this tab, and what it caught. Everything stays readable, nothing glares, and
nothing feels bolted on.

## Goals

1. A new mark, used everywhere: toolbar, app tile, popup header, README and store listing.
2. Toolbar icon states that tell you, at 16 px, whether Limitr is off, on, working on this tab, or needs you.
3. Two themes, night and day, that are twins of each other and switch with the system setting.
4. A redesigned popup: main screen, Fine-tune, captions settings and listening mode, all in the new
   visual language.
5. Updated README screenshots and debug harness styling so the project looks like one thing.

## Non-goals

- No change to audio processing, presets' behaviour, or the meaning of any setting.
- No new features, except the "needs attention" icon state.
- No manual theme picker. The system setting decides.
- No change to how captions work. That is a separate piece of work being built in parallel (see
  Constraints). This redesign only restyles its controls.

## Anti-goals

These would make the work a failure even if it technically ships:

- **Horizontal scrollbar:** the popup must never show one, at any height, with any drawer open, in
  Chrome or Firefox. This was a real bug and must stay fixed.
- **Scrolling the main screen:** reaching the main controls, including the "Fine-tune ›" and "How
  Limitr listens ›" rows, must not need scrolling. Only the body of a secondary screen may scroll.
- **Network requests for design assets:** fonts and icons ship inside the extension. The privacy policy
  promises no external requests for anything except the optional caption model.
- **Red as decoration or "busy":** red means only "sound is playing unprotected and you need to act".
  Alarm fatigue would ruin the signal.
- **Kauth's colours:** Limitr must not borrow Kauth's teal, orange, ink or paper. The owner explicitly
  ruled them out for this project.
- **Glare at night:** large saturated purple surfaces in the night theme. Purple is for controls, gold
  for caught spikes, and the rest is neutral.

## Decided by the owner

### The mark

One period of a filled sine wave on a horizontal midline. The crest is on the left, above the line; the
trough is on the right, below it. Both lobes are filled down to the line and touch at a single point.
The midline runs a little past both ends of the wave ("line runs past", option A in
`mark-options.png`).

The exact geometry is in `mark.svg` (viewBox 0–100):
- lobes span x 14–86, with the axis at y 50 and amplitude 31;
- the midline runs x 9–91, is 3.6 thick, and has round ends.

The owner sketched this, building on the idea of Kauth's hourglass-K: two halves meeting in a waist, but
soft like a sine wave.

### Themes

- Night: "cool graphite", option 3 in `night-themes.png`.
- Day: "purple and gold, day", shown under the nights in `night-themes.png`.
- The popup switches between them with `prefers-color-scheme`.

Colour tokens, taken from the approved mockups:

| Token | Night (cool graphite) | Day |
|---|---|---|
| background | `#1c1d21` | `#f6f4ef` |
| raised surface | `#26272c` | `#ffffff` |
| line / border | `#36383f` | `#e2ded5` |
| text | `#eff0f4` | `#1d1a2b` |
| muted text | `#a3a6b0` | `#6c6680` |
| accent (controls, "on") | `#9586f7` | `#6b5ce7` |
| text on accent | `#16122b` | `#ffffff` |
| spike (caught, gold) | `#f0b84a` | `#d4920f` |

### Toolbar icon states

| State | Colour | Meaning |
|---|---|---|
| Off | gray | Limitr is turned off |
| On | purple | on, but not processing anything in this tab |
| Working | gold | processing this tab, in either listening mode |
| Needs attention | red | sound is playing in this tab unprotected, and the user can fix it |

The owner was happy for "working or not" to be the only distinction; the icon does not show which
listening mode is active. The popup's status line says that instead.

Triggers for **needs attention** (decided, from the conversation):
- the browser is waiting for one click on the page before Limitr may start;
- a playing player can't be reached from inside the page (cross-origin without CORS, DRM, or the
  page's own Web Audio), so Whole tab would fix it;
- Whole-tab capture failed.

### Popup screens

Match the approved mockups: `main-night.png` and `main-day.png` for the main screen, and
`fine-tune-and-captions.png` for the other two.

Main screen, top to bottom:
1. mark, "Limitr", power switch;
2. one plain sentence about what is happening on this tab;
3. the live loudness trace (purple for what you hear, gold for what was shaved off, a dashed line where
   taming starts);
4. a "CAUGHT" bar with the spike count and the biggest cut;
5. six presets in a 3 × 2 grid, each with a line icon (Off, Gentle, Stream, Sleep, Movie, 90s TV);
6. a one-line explanation of the selected preset;
7. volume;
8. quick switches for Remove background noise, Even out levels and Live captions. Captions show a
   language chip when on.

Fine-tune:
- Collapsible sections: Spike guard, Even out levels, Peak limiter, Tone, Compressor, Extras.
- Each has a small line icon in a circle, a title, its on/off switch and a chevron.
- Only Spike guard is open by default.
- "Save these settings as a preset" sits at the bottom.

Captions settings, revealed when captions are on:
- Language (Auto shows what it picked, for example "Auto: Türkçe") and Translate to.
- A short transcript in the popup shows the original line; the translation goes on the video.

Listening mode, labelled "How Limitr listens":
- Two choice cards: Inside the page, and Whole tab (Chrome only, disabled with an explanation
  elsewhere).
- In Whole-tab mode, a per-tab volume list follows.

### Navigation: secondary screens, not drawers

The owner found drawers that unfold below the main screen cluttered. They worried that separate screens
would make tuning slow, going back and forth to hear the effect. They leaned toward separate screens and
left the call to design. Decision:

- **Separate screens:** Fine-tune, Captions settings and How Limitr listens each open as their own
  screen. Each replaces the main screen, with a header row of "← Title". Only the screen body scrolls.
- **Entry points:**
  - rows at the bottom of the main screen, "Fine-tune ›" and "How Limitr listens ›", always visible
    without scrolling;
  - captions settings open from the language chip on the Live captions row, or from the row itself
    when captions are on.
- **No back-and-forth to hear changes:**
  - Fine-tune pins a slim live strip under its header: a compact loudness trace (same drawing, about
    40 px tall) and the "CAUGHT …" line. Slider changes show their effect without leaving the screen.
  - The current preset name, or "Adjusted from Stream · Reset", sits in that strip too.
- **Speed:** switching screens is instant, with no slide animation. Esc and the back arrow return to
  the main screen.
- **Opening state:** the popup always opens on the main screen. Within Fine-tune, the open/closed state
  of each section is remembered (`limitrUi` already does this).
- **Tests:** the E2E and Firefox overflow checks must open each secondary screen and check for no
  horizontal overflow there too.

### Answers to the builder check

- **Spike guard sliders:** all six stay: Allow above normal, Never louder than, Strength, Reaction time,
  Hold before recovering, Recovery time. The mockup showed a shortened list. Every other Fine-tune
  section keeps its current contents too: the Tone section's EQ curve and five bands, and the
  compressor's six sliders. No setting changes (see Non-goals).
- **Order relative to captions:** the parallel captions work owns the Language and Translate-to
  controls. Plan the captions restyle last and build on whatever has landed. If its popup controls still
  aren't there when everything else is finished, stop and report rather than building them.

### Store artwork (owner request)

Ready-to-upload artwork for publishing on the Chrome Web Store, Firefox Add-ons and Microsoft Edge
Add-ons.

**Sizes (my call):** these were the store requirements as last known. Check them on each store's
developer page before publishing; the script makes re-sizing cheap.
- Store icon: 128 × 128, the manifest app tile.
- Edge store logo: 300 × 300.
- Small promo tile: 440 × 280.
- Marquee promo tile: 1400 × 560.
- Screenshots: 1280 × 800, three or four of them. Firefox accepts the same screenshots.

**How it's produced:**
- A script renders HTML templates with the real popup markup and theme tokens through Playwright. It
  writes PNGs to `docs/store/`, so artwork is regenerated when the UI changes, never hand-edited.

**Look:**
- The night theme leads, since the product is night-first.
- At least one screenshot uses the day theme, to show both.
- Tiles use the mark large, the name in Plex Sans, and one short line.

**Screenshots:** each pairs the real popup with one plain headline:
- the main screen with caught spikes ("Sudden yells and alerts, tamed");
- Sleep preset at night ("Fall asleep to streams");
- Fine-tune ("Tune exactly how strict");
- captions with translation ("Live captions, on your computer").

**Copy:** final copy is the builder's call. It must stay in plain language and use no claims the
product can't back up: no "AI-powered", no numbers that weren't measured.

## Calls made during design (not explicitly confirmed by the owner)

- **Main-screen switches:** the main screen has two quick switches, Remove background noise and Live
  captions, as in the approved mockup. Even out levels lives only in Fine-tune; the Sleep preset still
  turns it on. This corrects item 8 above, which listed three.
- **Saved presets:** they appear as a row of small chips under the preset grid, only when the user has
  saved at least one. The row wraps, never scrolls sideways. Tapping a chip applies it, and a small ×
  deletes it. Chips have no icons.
- **Store listing:** the owner asked for promo artwork so Limitr is ready to publish (see Store artwork
  below).
- **Popup transcript:** shows the original line. When translation is on, the translation appears as a
  smaller muted second line, as in `fine-tune-and-captions.png`. The video overlay shows only the
  translation.

The owner saw these in mockups and didn't object, but didn't decide them either:

- **Typeface:** IBM Plex Sans for everything, plus IBM Plex Mono only for the small "CAUGHT" tag.
  Bundle them locally as woff2 (OFL), replacing Nunito and its NOTICE entry.
- **App tile:** the mark on a rounded-square tile for the manifest `icons` (store, `chrome://extensions`):
  ink mark on a white tile, matching the day theme.
- **Icon colours:**
  - toolbar colours must read on both light and dark browser toolbars; use mid-tone values such as
    gray `#9aa1a8` / `#7d838c`, purple `#8f7ff5` and gold `#efb646`;
  - pick a red of similar weight, for example around `#e5534b`, and check it on both toolbar colours.
- **Preset line icons:** power (Off), leaf/feather (Gentle), microphone (Stream), moon (Sleep), film
  strip (Movie), retro TV (90s TV), as drawn in the mockups.
- **Fine-tune section icons:**
  - shield with a wave (Spike guard), sliders (Even out levels), ceiling over a wave (Peak limiter),
  - EQ faders (Tone), squeezed wave (Compressor), plus/sparkle (Extras).
- **Mono label:** "CAUGHT" in the spike colour is the only all-caps, mono label in the popup. Don't
  spread mono eyebrows everywhere.
- **Needs-attention status lines:** each trigger gets a status sentence that says what to do: "Click
  anywhere on the page once…", "Switch to Whole tab…", or "Couldn't listen to this tab: …". These
  already exist in `popup.js`; restyle them, don't rewrite them.

## Constraints

- **Popup size limits:**
  - Chrome caps popups at 800 × 600 px; the current width is 360 px.
  - Scrolling must happen in an inner container that reserves its scrollbar gutter (see `styles.css`).
  - Absolutely positioned hidden inputs must sit inside a positioned parent, or they extend the
    document height.
- **Extension page CSP:** `script-src 'self'`, so no inline scripts and no remote scripts.
- **Icon formats:** Chrome's `action.setIcon` needs raster images (PNG paths or ImageData) at
  16/32/48/128. Generate them from `mark.svg` with a script checked into the repo; `sharp` is available
  in `node_modules`. Firefox accepts the same PNGs.
- **Icon plumbing:**
  - `background.js` sets per-tab icons today via `setTabIcon(tabId, active, enabled)` with
    `ICONS.off/on/active`.
  - The new red state needs one more set, plus status signals from content bridges for the attention
    triggers.
  - Today the bridge only reports `attached`; it must also report "waiting for a gesture" and
    "skipped while playing".
  - Whole-tab capture failures are known in `background.js` (`autoCapture`, the `capture-tab` message).
- **Firefox 140+** must keep working. `build-firefox.js` copies everything except Chrome-only files.
- **Tests:** the existing suites must stay green, with selectors updated where the DOM changes:
  - `npm test` (engine + Chromium E2E), `tests/run-firefox-tests.js` (including the
    no-horizontal-scrollbar checks), and `web-ext lint`;
  - `tests/run-extension-tests.js --screenshots=docs/assets` regenerates the README screenshots.
- **Captions work in parallel:**
  - A separate change is upgrading captions: Whisper for non-English, a Language picker, Translate to,
    and pause-aware chunking.
  - It touches `lib/transcriber.js`, the caption host plumbing, `content-transcribe.js`, and adds
    minimal Language / Translate selects to the captions row in `popup.html`/`popup.js`.
  - Build the redesign on top of that change once it lands, and restyle its controls rather than
    re-implementing them.

## Left to the builder

- Exact spacing, sizes and CSS structure, as long as the result matches the mockups and the main screen
  fits in 600 px without scrolling.
- Motion: keep it to responses to the user's actions (drawer open, switch, preset select) and respect
  `prefers-reduced-motion`.
- How to derive the needs-attention state from bridge, offscreen and background signals, and when it
  clears (for example when the media pauses or the user switches mode).
- The PNG export pipeline and file names, as long as the manifest, `background.js` and the build stay
  consistent.
- Restyling the debug harness (`tests/debug-harness.html`) to the new tokens.
- README layout around the new screenshots.
