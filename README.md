# Limitr

A browser extension for real-time audio compression, limiting, and normalization. Perfect for streaming sites like Twitch and Kick where audio levels can vary wildly.

## Features

- **Real-time audio compression** using Web Audio API's DynamicsCompressorNode
- **Adjustable parameters**: Threshold, Ratio, Knee, Attack, Release, Makeup Gain
- **Presets**: Gentle, Moderate, and Aggressive compression profiles
- **Gain reduction meter**: Visual feedback showing compression activity
- **Per-page processing**: Automatically captures all audio/video elements
- **No external dependencies**: Pure Web Audio API

## Installation

### Chrome / Chromium-based browsers

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
3. Adjust parameters or select a preset:
   - **Gentle**: Light compression for slight volume evening
   - **Moderate**: Balanced compression for streaming
   - **Aggressive**: Heavy limiting for very dynamic content
4. The gain reduction meter shows how much compression is being applied

## Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| Threshold | -60 to 0 dB | Level above which compression begins |
| Ratio | 1:1 to 20:1 | Amount of compression applied |
| Knee | 0 to 40 dB | Smoothness of compression onset |
| Attack | 0 to 100 ms | How quickly compression engages |
| Release | 10 to 1000 ms | How quickly compression releases |
| Makeup Gain | 0 to 24 dB | Volume boost after compression |

## How It Works

The extension injects a content script into web pages that:

1. Creates a Web Audio API context with a DynamicsCompressorNode
2. Scans for all `<video>` and `<audio>` elements
3. Routes their audio through the compressor chain
4. Monitors the DOM for dynamically added media elements

## Custom Icons

The placeholder icons are simple colored squares. To generate nicer icons:

1. Open `icons/generate-icons.html` in your browser
2. Click "Download All Icons" to save the generated PNGs
3. Replace the existing icon files

## License

MIT
