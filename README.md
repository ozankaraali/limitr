<p align="center">
  <img src="icons/icon128.png" alt="Limitr" width="80">
</p>

<h1 align="center">Limitr</h1>

<p align="center">
  A browser extension for real-time audio compression, limiting, EQ, and normalization.<br>
  Perfect for streaming sites where audio levels can vary wildly.
</p>

<table align="center">
  <tr>
    <td valign="top"><img src="docs/assets/screenshot-1-simple-mode.png" alt="Simple Mode" width="270"></td>
    <td valign="top"><img src="docs/assets/screenshot-2-active-exclusive.png" alt="Active Exclusive Mode" width="270"></td>
    <td valign="top"><img src="docs/assets/screenshot-3-advanced-mode.png" alt="Advanced Mode" width="270"></td>
  </tr>
</table>

## Features

- **Real-time audio processing** using the Web Audio API
- **Simple & Advanced modes**: Quick presets or full control over every parameter
- **12 Audio Presets** (lightest to heaviest):
  - **Off** — No processing (bypass)
  - **Music** — Light compression preserving dynamics
  - **Lo-Fi** — Warm & mellow sound
  - **Stream Watch** — Single-band compression for Twitch & YouTube
  - **Podcast** — Voice clarity and consistency
  - **Voice Focus** — Multiband compression + EQ optimized for speech
  - **Movie** — Compression + dialog EQ for action & dialog balance
  - **Bass Tamer** — Heavy compression with bass reduction
  - **90s TV** — Warm CRT-style sound with noise, and optional TV+ visual mode
  - **Night Mode** — Comfy low-volume watching with scream frequency taming
  - **Anti-Scream** — Crushes all peaks (12:1 compression + scream EQ cuts)
  - **Sleep** — Fall asleep easy (heavy compression + treble cuts + volume reduction)
- **Single-band compressor** with full parameter control (threshold, ratio, knee, attack, release)
- **3-band multiband compressor** with independent per-band threshold, ratio, and gain
- **5-band parametric EQ** with selectable filter types per band and live curve visualization
- **Brick-wall limiter** with adjustable threshold and timing for peak protection
- **Noise gate** with configurable threshold, hold, and release (Exclusive mode)
- **Bass & Treble Cut** filters for additional frequency shaping
- **Background noise** (white/pink/brown) for vintage audio effect
- **Gain reduction meter** showing real-time compression activity
- **Collapsible sections** with independent on/off toggles per processing block
- **Two processing modes**: Regular (fullscreen-friendly) or Exclusive (multi-tab with AI features)
- **Exclusive mode extras**: AI noise suppression (RNNoise), auto-gain (AGC), noise gate
- **No external dependencies** (except RNNoise WASM for AI noise suppression)

## Installation

### Chrome Web Store

Coming soon

### Chrome / Chromium-based browsers (Manual)

1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `limitr` folder

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in the `limitr` folder (e.g., `manifest.json`)

Note: For permanent Firefox installation, the extension needs to be signed or installed via `about:config` with `xpinstall.signatures.required` set to `false`.

## Usage

1. Click the Limitr icon in your browser toolbar
2. Toggle the master switch to enable/disable processing
3. Select a preset or switch to Advanced mode for full control
4. Each processing section (Compressor, Gain, EQ, Limiter, Filters, Effects) can be independently toggled on/off and collapsed
5. The gain reduction meter shows real-time compression activity

## Advanced Parameters

### Compressor

| Parameter | Range | Description |
|-----------|-------|-------------|
| Threshold | -60 to 0 dB | Level above which compression begins |
| Ratio | 1:1 to 20:1 | Amount of compression applied |
| Knee | 0 to 40 dB | Smoothness of compression onset |
| Attack | 0 to 100 ms | How quickly compression engages |
| Release | 10 to 1000 ms | How quickly compression releases |

### Gain

| Parameter | Range | Description |
|-----------|-------|-------------|
| Makeup Gain | -24 to +24 dB | Volume adjustment after compression |
| Output Gain | -24 to +24 dB | Final volume adjustment (master) |

### 5-Band Parametric EQ

| Parameter | Range | Description |
|-----------|-------|-------------|
| Frequency | 20 to 20000 Hz | Center frequency per band |
| Gain | -12 to +12 dB | Boost/cut per band |
| Q | 0.1 to 10 | Bandwidth (narrow to wide) |
| Type | Highpass/Lowshelf/Peaking/Highshelf/Lowpass | Filter shape per band |

### Limiter

| Parameter | Range | Description |
|-----------|-------|-------------|
| Threshold | -30 to 0 dB | Ceiling above which audio is brick-wall limited |
| Attack | 0 to 50 ms | How quickly the limiter engages |
| Release | 10 to 500 ms | How quickly the limiter releases |

### Multiband Compressor

| Parameter | Range | Description |
|-----------|-------|-------------|
| Crossover 1 | 20 to 500 Hz | Split point between sub and mid bands |
| Crossover 2 | 500 to 10000 Hz | Split point between mid and high bands |
| Band Threshold | -60 to 0 dB | Per-band compression threshold |
| Band Ratio | 1:1 to 20:1 | Per-band compression amount |
| Band Gain | -12 to +12 dB | Per-band output gain |

### Filters

| Parameter | Range | Description |
|-----------|-------|-------------|
| Bass Cut (Highpass) | 0 to 300 Hz | Removes frequencies below this value |
| Treble Cut (Lowpass) | 2000 to 22050 Hz | Removes frequencies above this value |

### Effects

| Parameter | Range | Description |
|-----------|-------|-------------|
| Noise Level | 0 to 30% | Background noise amount |
| Noise Type | White/Pink/Brown | Noise character (harsh to cozy) |

### Exclusive Mode Only

| Parameter | Range | Description |
|-----------|-------|-------------|
| AI Noise Suppression | On/Off | RNNoise-based background noise removal |
| Auto-Gain (AGC) | On/Off | Automatic level control |
| AGC Target | -30 to 0 dB | Target loudness for auto-gain |
| Noise Gate | On/Off | Silence noise in quiet sections |
| Gate Threshold | -80 to -20 dB | Level below which audio is gated |
| Gate Hold | 10 to 500 ms | How long the gate stays open after signal drops |
| Gate Release | 10 to 500 ms | How quickly the gate closes |

## How It Works

### Signal Chain

```
Source → [Compressor OR Multiband] → [Pre-Limiter] → [Noise Suppression] → [Bass Cut] → [5-Band EQ] → [Treble Cut] → [Auto-Gain] → [Noise Gate] → [Limiter] → Output Gain → Destination
```

Each block in brackets is optional — only wired into the chain when its toggle is enabled. The compressor and multiband compressor are mutually exclusive (enabling one disables the other).

### Processing Modes

**Regular Mode** (fullscreen compatible):
- Injects a content script that uses `MediaElementSource` to process audio
- Scans for all `<video>` and `<audio>` elements
- Works in fullscreen video playback
- Supports: Compressor, Multiband, EQ, Limiter, Filters, Gain, Effects

**Exclusive Mode** (multi-tab with AI features):
- Uses Chrome's `tabCapture` API to capture tab audio
- Processes audio in an offscreen document
- All Regular mode features plus: AI Noise Suppression (RNNoise), Auto-Gain (AGC), and Noise Gate
- Note: Fullscreen may be restricted in this mode

## Privacy

Limitr does not collect, store, or transmit any personal data. All audio processing happens locally in your browser. See [Privacy Policy](docs/PRIVACY.md).

## License

[MIT](LICENSE) - Ozan Karaali
