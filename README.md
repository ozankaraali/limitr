# Limitr

A browser extension for real-time audio compression, limiting, and normalization. Perfect for streaming sites where audio levels can vary wildly.

![Simple Mode](docs/assets/screenshot-1-simple-mode.png)
![Advanced Mode](docs/assets/screenshot-2-advanced-mode.png)
![Active](docs/assets/screenshot-3-active-night-mode.png)

## Features

- **Real-time audio compression** using Web Audio API's DynamicsCompressorNode
- **Simple & Advanced modes**: Quick presets or full control over parameters
- **6 Audio Presets**:
  - **Off** - No compression (bypass)
  - **Voice Clarity** - Optimized for speech and podcasts
  - **Normalize** - Balanced volume leveling
  - **Bass Tamer** - Moderate compression with bass cut
  - **Night Mode** - Heavy compression with bass cut for quiet listening
  - **90s TV** - Warm CRT-style sound with optional TV+ visual mode
- **Bass & Treble Cut** filters for additional control
- **Background noise** (white/pink/brown) for vintage audio effect
- **Gain reduction meter** showing real-time compression activity
- **Dual processing modes**: Default (fullscreen-friendly) or Mixer (multi-tab)
- **No external dependencies**: Pure Web Audio API

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
2. Toggle the switch to enable/disable processing
3. Select a preset or adjust parameters:
   - **Simple mode**: Output volume control
   - **Advanced mode**: Full compressor controls (threshold, ratio, knee, attack, release, gains, filters, noise)
4. The gain reduction meter shows how much compression is being applied

## Advanced Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| Threshold | -60 to 0 dB | Level above which compression begins |
| Ratio | 1:1 to 20:1 | Amount of compression applied |
| Knee | 0 to 40 dB | Smoothness of compression onset |
| Attack | 0 to 100 ms | How quickly compression engages |
| Release | 10 to 1000 ms | How quickly compression releases |
| Makeup Gain | 0 to 24 dB | Volume boost after compression |
| Output Gain | -24 to +24 dB | Final volume adjustment |
| Highpass | 0 to 300 Hz | Bass cut filter frequency |
| Lowpass | 2000 to 22050 Hz | Treble cut filter frequency |
| Noise Level | 0 to 30% | Background noise amount |
| Noise Type | White/Pink/Brown | Noise character (harsh to cozy) |

## How It Works

Limitr offers two processing modes:

**Default Mode** (fullscreen compatible):
- Injects a content script that uses `MediaElementSource` to process audio
- Scans for all `<video>` and `<audio>` elements
- Routes audio through a processing chain (compressor → gains → filters → output)
- Works in fullscreen video playback

**Mixer Mode** (multi-tab control):
- Uses Chrome's `tabCapture` API to capture tab audio
- Processes audio in an offscreen document
- Allows individual volume control of multiple tabs
- Note: Fullscreen may be restricted in this mode

## Privacy

Limitr does not collect, store, or transmit any personal data. All audio processing happens locally in your browser. See [Privacy Policy](docs/PRIVACY.md).

## License

[MIT](LICENSE) - Ozan Karaali
