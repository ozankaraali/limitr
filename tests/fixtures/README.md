# Test Audio Fixtures

Generate test audio files for the Limitr debug harness. Any source content works — these commands create clips with the right dynamic range.

## Required Files

### test-speech-30s.webm
30 seconds of varied speech (quiet whisper to normal to loud).

```bash
# From any speech source (podcast, audiobook, etc.)
ffmpeg -i source.mp4 -ss 00:01:00 -t 30 -vn -c:a libopus -b:a 128k test-speech-30s.webm
```

### test-mixed-30s.webm
30 seconds of speech + music + sound effects (simulates a Twitch stream).

```bash
# From a stream VOD or gaming video
ffmpeg -i stream-vod.mp4 -ss 00:05:00 -t 30 -vn -c:a libopus -b:a 128k test-mixed-30s.webm
```

### test-silence-10s.webm
10 seconds of silence for noise floor measurement.

```bash
ffmpeg -f lavfi -i anullsrc=r=48000:cl=mono -t 10 -c:a libopus -b:a 64k test-silence-10s.webm
```

### Synthetic test tone (optional)
Generates a sweep from -60 to 0 dBFS over 30 seconds — useful for verifying the transfer curve.

```bash
ffmpeg -f lavfi -i "sine=frequency=440:duration=30,volume='0.001*exp(log(1000)*t/30)'" \
  -c:a libopus -b:a 128k test-sweep-30s.webm
```

## Usage

1. Place generated files in this directory (`tests/fixtures/`)
2. Open `tests/debug-harness.html` in Chrome
3. Drop a fixture file onto the page or use the file picker
4. Select a preset and click Play, or use "Run All Presets"

## Recorded streams (engine tests)

`tests/run-engine-tests.js` also runs real recordings through the engine when it finds them in
`tests/fixtures/recordings/` (ignored by git) or in the folder named by `LIMITR_RECORDINGS`.
They are 48 kHz WAVs captured from live streams, and the checks are specific to each:

- `videoyun.wav`: 5 minutes of a regular streamer who doesn't yell, with a game bed between
  phrases. The guard must stay idle and the talking pass (or be evened when it is louder than
  the preset's comfortable level).
- `husam.wav`: a 33 s clip that is loud overall, with loud moments. It is looped so the engine is
  settled; it must be evened to the comfortable level with the loud moments held.

Missing files are skipped.
