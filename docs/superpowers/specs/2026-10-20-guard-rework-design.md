# Spike guard rework (2.1.0)

## Why

Two independent reviews (a calculation audit and a chain-design review, 2026-10-20) measured the
2.0 spike guard against realistic source levels. The core maths (K-weighting, LUFS, limiter,
compressor makeup compensation) is right. The design around it is not:

- The guard's absolute ceiling (`guardCeiling`, e.g. Stream −16 LUFS) sits in the guard's input,
  which already includes the site's own volume and YouTube's loudness normalization. On a −14 LUFS
  YouTube video, Stream and Movie turn normal talking down 5–7 dB, cutting 100% of the time; the
  site's volume slider stops working; Sleep pins every source to about −31 LUFS. It is the volume
  bug fixed in 2.0.1, triggered by the source instead of Limitr's slider.
- The ceiling is compared against a 20 ms detector that reads about 4 dB above the 400 ms LUFS it
  is labelled in, and the detector rises slower than the 10 ms lookahead, so onsets leak ~20 ms.
- A loud stretch becomes "normal" after 6–8 s (75th percentile of 20 s), so a yelling fit comes
  through, and an alert right after it is barely tamed.
- Tape hiss and compressor makeup sit before the guard: the guard learns its own hiss during
  pauses (normal talk comes back ~20 dB too quiet for ~10 s in 90s TV) and cancels makeup gain.
- The spike counter gets stuck at 1 under a steady cut; "biggest cut" reads the 20 ms detector,
  not what was heard; "Taming starts here" is stale with the guard off; a fast volume change can
  pass 0 dBFS because the volume ramps outside the worklet.

## What the listener wants (from the user)

Set the volume once, where quiet talking and whispers are audible, and fall asleep. Sudden yells
and alerts are pulled down at once; a stream that gets loud and stays loud is turned down too, so
there's never a reason to turn the volume down (which would lose the whispers). Quiet parts are
never cut. The user chose a comfortable level per preset over a learned normal with a duration
("turn louds down, never silents up"); the learned normal stays internal, for spikes.

## Design (as built)

**Normal loudness.** The median of the last 20 s of non-silent momentary loudness (400 ms, LUFS).
A jump of more than 3 dB only becomes the new normal once it has lasted `guardMemory` seconds
(internal per preset: Gentle 15, Movie 30, Stream 60, 90s TV 60, Sleep 300), counted on a timer
so it works from the first seconds of a stream. Returning to the stream's familiar level (median
over 4 × `guardMemory`, once 2 min of audio are known) is always followed, and normal never sinks
more than 6 dB under it, so a quiet stretch doesn't leave the voice ducked. The median (not the
75th percentile) keeps spikes from becoming normal unless they fill half the window.

**The guard's loudness reading.** The largest of three K-weighted readings, each minus the crest it
normally has on this stream (learned over the last 20 s): fast (2 ms rise, 30 ms fall) for hits,
50 ms for onsets of sustained sound, 400 ms-like (0.2 s one-pole) for sustained sound. All in
LUFS, so `guardHeadroom` means dB above normal loudness, as labelled. Lookahead 20 ms (total latency
25 ms) so the reaction time completes before an onset leaves the delay line.

**Comfortable level.** `levelTarget` per preset (Gentle −14, Movie −18, Stream −20, 90s TV −20,
Sleep −28 LUFS): normal loudness above it is turned down to it (τ 1 s, at most `levelMaxCut`,
24 dB); below it is left alone, except Sleep lifts quiet streams up to `levelMaxBoost` (6 dB, τ 2 s).
The guard compares against the same normal, so the two never fight. The absolute `guardCeiling`
is removed.

**After the guard, inside the worklet.** Tape hiss on a second worklet input, mixed after the guard
gain. Volume, tab volume and compressor makeup are one post gain, smoothed per sample before the
limiter, whose ceiling is `min(limiterCeiling + post gain, 0 dBFS)`. The native fallback keeps a
GainNode after its limiter.

**Page mode.** `loadstart`/`emptied` of an attached player resets the analysis; `volumechange` of
the only playing attached player shifts it by the change in dB.

**Meters.** A spike counts when the cut exceeds its slow steady value by 3 dB (the cut present when
normal is first learned is the steady one); "biggest cut" is the cut averaged like 400 ms loudness;
`thresholdDb` is normal + level + headroom + post gain, null with the guard off.

**Migration.** 2.0 settings (no `guardMemory`) get the guard and comfortable-level fields from
their preset; volume, tone and extras stay.

## Tests (tests/run-engine-tests.js)

- Source sweep −36 … −10 LUFS for Gentle, Stream, Movie, 90s TV: streams 6 dB or more under the
  comfortable level untouched (±0.5 dB), streams 4 dB or more over it come out at it, guard idle
  (>1 dB) under 10% of plain talking, yell/alert within each preset's targets.
- Sleep: sources from −24 to −10 all come out at the target band; a −36 source is lifted at most
  `levelMaxBoost`; spikes within targets at every level.
- Sustained 20 s yell (+11 dB): held to the preset's yell target while within `guardMemory`.
- Pause with hiss (90s TV): talk after a 30 s pause within 1.5 dB of before.
- Makeup +6 dB delivers +6 dB at a −14 source; volume steps during limiting never pass 0 dBFS.
- Onset: the first 20 ms of the alert no more than 1 dB above its settled level.
- Counter: the yell and the alert are counted at every level (the short clap may stay under
  3 dB); threshold null when the guard is off; "biggest cut" within 2.5 dB of what was heard.
- Page mode: halving the site's player volume moves normal by −6 dB at once; new media resets.
- Also checked by hand: on 100 s of real (macOS `say`) speech, Stream never cuts more than 0.4 dB
  at −30, −24 or −14 LUFS.

## Out of scope (2.1.0)

Native fallback (no worklet) loudness tracking; 90s TV's compressor threshold depending on source
level; summing limiter across tabs; RNNoise switch-on click; faster whisper lift.
