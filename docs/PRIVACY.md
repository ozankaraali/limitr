# Privacy Policy for Limitr

**Last updated:** October 19, 2026

## Overview

Limitr is a browser extension that processes audio in real time to tame sudden loud spikes on streaming
and video sites.

## Data collection

**Limitr does not collect, store or transmit any personal data.**

### What is stored locally

- Your audio settings and saved presets
- Whether Limitr is on, and how it listens (inside the page or the whole tab)

This data is stored with the browser's extension storage API and never leaves your device.

### What Limitr doesn't do

- It doesn't collect browsing history or personal information
- It doesn't track your activity or use analytics
- It doesn't send audio or any other data to a server

### Live captions

The first time you turn on live captions, Limitr downloads open speech-recognition models from
Hugging Face: Moonshine for English, and Whisper (77 MB) the first time you pick another language or
automatic detection. On Chrome or Edge you can switch on a larger, more accurate 410 MB Whisper model
that runs on a capable graphics card; it is only downloaded if you do. Recognition then runs entirely
on your computer. No audio is uploaded.

Translated captions use your browser's built-in on-device translator (Chrome and Edge; Firefox has
none, so it doesn't offer translation). The first
time you translate between two languages, the browser downloads that language pack itself. Text is
translated on your computer and is not sent anywhere by Limitr.

## Permissions explained

- **storage**: saves your settings locally
- **tabs**: shows which tabs are playing audio and updates the toolbar icon per tab
- **scripting** and **host access to all sites**: routes video and audio players through Limitr's audio
  engine on the sites you visit, and draws captions or the CRT look over videos when you turn them on
- **contextMenus**: adds the Debug Harness entry to the toolbar icon's menu
- **tabCapture** and **offscreen** (Chrome only): the Whole tab listening mode

## Open source

Limitr is open source. You can review the complete source code at
https://github.com/ozankaraali/limitr

## Contact

For questions about this policy, open an issue on GitHub.

## Changes

Changes to this policy will be reflected in this document with an updated date.
