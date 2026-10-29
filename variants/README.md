# Engine variants (loud-start fix, not shipped)

Candidate versions of `lib/dsp-worklet.js` and the scripts that score them. See `docs/HANDOFF.md`
for what was decided and what's next.

`w-calm10u3t-m30-g3.js` is in `lib/` since 2026-10-24, with its thresholds as settings
(`guardStartUnder`, `strainedDb`, `strainRaisedDb`, `strainMemory`). One change on the way: strain
is checked before the belief, against the threshold defended until then, so a yell that normal has
just been learned from still counts as raised. Every dataset recording comes out bit-identical.

## Files

- `w-b{half}u{under}.js`: normal is believed louder than the preset's starting threshold only as
  speech is heard, halfway after `{half}` s; Sleep's start is `{under}` dB under its comfortable
  level (other presets start at theirs).
- `w-b{half}u3c.js`: plus an upward carry (a new video starts from the level the one before was
  believed at). Set aside.
- `w-b{half}u3d.js`: plus a downward carry (a new video starts no higher than the long-term speech
  level, across videos). Never engaged as built.
- `w-b{half}u3t.js`: the downward carry on the starting threshold instead (a new video's believed
  normal starts no higher than the long-term speech level minus the preset's headroom), so it
  engages on Stream. Scored in `docs/HANDOFF.md`.
- `w-calm10u3t.js`: the belief speed set by what's playing, on top of `w-b10u3t.js`:
  - calm speech (it pulses, and no speech-like block was strained ≥6 dB in the last 10 s) is
    believed at its own level at once, up to the level listened to lately (the carry);
  - the rest of a louder normal is believed halfway after 10 s of any sound.
- `make-variants.py`, `make-carry-variants.py`, `make-calm-variants.py`: rebuild all fourteen from
  36483c5's `lib/dsp-worklet.js` (the engine before the belief), in that order. Their edits match
  exact text, so they fail loudly on any other base.
- `cues.js`, `cue-stats.js`: what the speech cues (pulse, strain, the usual tilt) and the belief read
  on a WAV, every half second or as percentiles over spans. `synth-voice.js` writes the engine
  bench's synthetic voice after room noise as a WAV for them.
- `compare.js`: renders of one input compared span by span (level, edge over body, how far apart).
- `w-calm10u3t-m30.js`: `w-calm10u3t.js` with nothing calm for 30 s after a strained moment, not 10.
- `w-calm10u3t-g3.js`, `w-calm10u3t-m30-g3.js`: strain starts the memory only in a raised voice, 3 dB
  over the guard's threshold (the believed normal plus the preset's headroom).
- `strain-scan.js`: every moment the strain memory goes off across the local dataset, with its level
  over normal and whether it's in a marked part.
- `harsh-scan.js`: what the harsh-sound stage cuts across the dataset, on the talk and in the
  marked harsh parts, and what it would keep cutting if it skipped speech under some strain.
- `harsh-rules.js`: rules for when the harsh-sound stage cuts, scored on the dataset without
  rendering (dB x s it aims for on the talk, NatGeo's talk and the marked harsh parts).
- `make-harsh-variants.py`: task 4's variants of 9d17670's `lib/dsp-worklet.js`.
  `w-hl{tau}s{dB}sp.js`: on speech, the shelf cuts only brightness that lasts (the balance over
  `tau` s also `dB` past the allowance); alerts and crowds are cut at once, as before.
  `w-hl1s1calm13.js`, the hybrid now in `lib/`: only calm talk (not raised, not strained) has to
  last, and even calm talk 13 dB past the allowance is cut at once.
- `render.js`: dataset clips through the real engine, with a variant and preset overrides, for
  listening (`RENDER_CLIPS`, `RENDER_VERSIONS=name=worklet+setting:value`, `RENDER_PRESETS`).
- `bands.js`: renders against their input, band by band (body, 2-4 kHz, 4-8 kHz, 8-16 kHz air).
- `make-tone-settings.py`: `settings-shelf1.5.js` and `settings-shelf0.js`, Sleep with its 6 kHz shelf
  at -1.5 dB or none, for `eval-dataset.js --settings=`.
- `ab.js`, `ab.html`: an A/B player for the renders in `listen/` (`node variants/ab.js` opens it):
  every version of a group plays in sync, number keys switch between them where you are, the last
  one plays the original at today's level; with a loop, marks, the levels drawn, a listening boost,
  and a blind mode whose picks go to `results/ab-picks.jsonl`.
- Local only (gitignored): `listen/` (renders of NatGeo and dataset audio), `results/` (score logs,
  which name the clips) and `voiceover/` (the ad's voice, from macOS `say`).

## Scoring

All browsers are headless Chromium with `--disable-gpu` and `--disable-audio-output`.

```sh
git show 36483c5:lib/dsp-worklet.js > "$TMPDIR/w-36483c5.js"
python3 variants/make-variants.py "$TMPDIR/w-36483c5.js" variants
python3 variants/make-carry-variants.py variants
python3 variants/make-calm-variants.py variants

# Real clips: loud parts over the talk, time cut, range, talk balance (brightness)
node tools/eval-dataset.js --worklet=variants/w-b5u3.js --presets=stream,sleep "vp05dspr|natgeo-tr-2026-10-23|jfns3dvx|4cbdjvb8|2026-10-20-0m|2026-10-21-60m"
# The engine suite
LIMITR_WORKLET=variants/w-b5u3.js node tests/run-engine-tests.js --browser=chromium
# NatGeo 23 Oct and yelling.wav split at the end of the holding phase, with NatGeo renders
SPLIT_VARIANTS=b10u3,b5u3 node variants/split.js . variants/listen   # NO_WAV=1 skips the renders
# Videos back to back with resets at exact samples: NatGeo, an ad, NatGeo; short clips, then vp05dspr;
# a regular stream after NatGeo, and after NatGeo 10 dB down. SEQ_VARIANTS picks the variants next to
# today's, SEQ_ONLY (a regex) the sequences, SEQ_WAVS and SEQ_WAV_PRESETS the renders
node variants/seq2.js . variants/listen
SEQ_ONLY='then a regular' SEQ_VARIANTS=b5u3,b5u3t SEQ_WAVS=today,b5u3,b5u3t SEQ_WAV_PRESETS=stream node variants/seq2.js . variants/listen
# Synthetic: the extension test's burst tone, a loud voice's heard level at the start
node variants/burst-start2.js variants/w-b5u3.js $PWD/lib/settings.js $PWD/lib/engine.js sleep
node variants/heard-start.js variants/w-b5u3.js $PWD/lib/settings.js $PWD/lib/engine.js sleep -14
# Diagnostics: the engine's state once a second on a WAV; the carry's fresh starts; levels of a render
node variants/watch.js variants/w-b5u3.js $PWD/lib/settings.js $PWD/lib/engine.js variants/listen/voice-over-ad.wav sleep
node variants/carry-check.js variants/w-b5u3t.js $PWD/lib/settings.js $PWD/lib/engine.js
node variants/cues.js variants/w-calm10u3t.js $PWD/lib/settings.js $PWD/lib/engine.js variants/listen/vp05dspr.wav sleep
# (files joined with + play back to back; STRAINED=6 lists the strained speech-like blocks instead)
node variants/cues.js variants/w-calm10u3t.js $PWD/lib/settings.js $PWD/lib/engine.js variants/listen/natgeo-23oct.wav+variants/listen/voice-over-ad.wav sleep
node variants/levels.js variants/listen natgeo-voicead-natgeo
node variants/spans.js variants/listen natgeo-voicead-natgeo
```
