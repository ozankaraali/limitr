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

## Normal is the talking level (2.1.3)

### What went wrong

Two 48 kHz recordings of real Kick streams showed the 2.1 guard taming normal streams. On
5 minutes of a regular streamer who doesn't yell (kick.com/videoyun, −22.6 LUFS plain median,
−18.8 LUFS BS.1770 integrated), Gentle turned the talking down to −33 LUFS and cut more than 1 dB
43% of the time; Stream to −41 LUFS, 62% of the time; Sleep 82%. Instrumenting the worklet's
meters showed why:

- The momentary loudness of the recording is bimodal: 1096 of 3000 blocks sit at −50…−42 LUFS (the
  game bed between phrases) and about 1500 at −24…−16 (the voice). The −60 LUFS silence gate keeps
  the bed, so the "median of the last 20 s" flips between the two clusters depending on which
  fills more than half the window. The stream opens on 18 s of bed, so normal locked at −47; the
  voice at −20 was +27 dB "over normal" and cut 20–28 dB.
- The 3 dB drift limit then held the voice down: the loud-stretch timer only runs while the 20 s
  median stays above normal + 3, and it was reset every time the median flipped back into the
  bed, so normal reached −20 only at 112 s. Every quieter passage (180–220 s, 270–300 s) put the
  median back in the bed, normal sank (sinking is always followed; the familiar floor was
  contaminated the same way) and the returning voice was cut 9–17 dB again.
- With normal right, the readings still touched the talking: a real talker's fast reading
  reaches 4–5 dB over its median crest (3 dB of hit headroom touched 15% of Gentle's time), and
  momentary loudness reaches +3 dB (p95) to +4 dB (max) over the talking level, inside Stream's
  3 dB headroom. The 2.1 numbers were tuned on synthetic talkers and macOS `say`, whose level
  barely varies.

Both hypotheses in the brief held: quiet passages drag the median down, and the drift limit then
fires on the swings.

### What the standards do

- ITU-R BS.1770-4 / EBU R128 integrated loudness: 400 ms blocks, an absolute gate at −70 LUFS,
  then a relative gate 10 LU under the mean of what passed. The relative gate exists for this
  exact problem: pauses and quiet beds would otherwise pull a programme's loudness down. On the
  recording it sits at −31 LUFS and separates the two clusters cleanly: gated loudness −18.8,
  gated median −18.9, and a 20 s gated median that only moves between −21.3 and −17.5 (p5–p95),
  with 10 s changes under 2.5 dB.
- EBU Tech 3342 loudness range: short-term (3 s) loudness, a −20 LU relative gate, and the
  10th–95th percentiles. The recording's LRA is 7.8 LU; its short-term loudness spans
  −25.4…−17.6 around a −20.8 median, i.e. normal talking legitimately reaches +3 LU short-term
  and +4 LU momentary over its own level. Broadcast delivery specs allow more (+5…+6 LU
  short-term, +8 LU momentary over the integrated level).
- Dialogue-gated loudness (Dolby Dialogue Intelligence, ATSC A/85's dialogue "anchor element",
  Netflix's dialogue-gated −27 LUFS) measures only the speech; night modes in AV receivers (AC-3
  DRC around `dialnorm`, Dolby Volume, Audyssey Dynamic Volume) cut above the dialogue level and
  leave it alone. We have no speech detector; the relative gate is the level-only approximation.
- Streaming platforms (YouTube, Spotify, Apple) normalise by the integrated, gated loudness and
  only turn louder material down. A plain median of all non-silent blocks is not a quantity any
  of them uses.

### Design

**Normal** is the talking level of the last 20 s of sound: of the non-silent momentary blocks,
those more than 10 LU under the window's mean loudness don't count (BS.1770-4's relative gate,
applied to the window), and of the rest, the upper quartile (`NORMAL_PERCENTILE` 0.75). The
quartile rather than the median keeps a louder bed from taking over as long as the voice is there
a quarter of the time: with a game bed only 12 dB under the voice, which passes the gate, the
median already belongs to the bed when the streamer talks less than half the time; the quartile
holds down to about 35%. The crests of the fast and medium readings are learned on the same gated
blocks, so a bed-filled window can't flatten them (that also cut consonants). The familiar level
is the same statistic over 4 × `guardMemory`.

**Loud stretches** work as before (a rise of more than 3 dB above normal or the familiar level is
followed only after it has lasted `guardMemory` seconds on the timer), but how long it must last
depends on how new the stream was when the rise began: 3 s in the stream's first 20 s of sound
(what came first, a quiet intro, a pause, the end of an ad, isn't a level to defend, but a chime
or a 2 s yell isn't the new normal either: with the gate, a loud burst is briefly *all* of the
gated window, so "most of what plays" can't tell them apart), 20 s until the familiar level is
known (2 min of sound, or half the long window), then the preset's memory. A 40 s quiet intro
then the voice used to cost the whole memory (60 s in Stream, 5 min in Sleep) of the voice cut
20–30 dB; now at most 25 s. The 2.1 rule (normal simply follows the 20 s median in the first
20 s) worked because the plain median needed 10 s of a yell to move; the gated upper quartile
moves in under a second, and a 2 s yell at a stream's start must still not become normal.

**Hits** get 5 dB over their usual crest instead of 3 (`HIT_HEADROOM_DB`). On the recordings a
talker's fast reading reaches +4.6 dB (p99) over its median crest; 3 dB touched the consonants a
sixth of the time in Gentle.

**Presets** keep their numbers. With normal at the talking level's upper quartile, the sustained
thresholds effectively sit about 1.3 dB higher than against the median, which is what real
talking needs (Stream's 3 dB headroom cut more than 1 dB 8.6% of the time against the median).
The comfortable level evens the same statistic, so the louder half of the talking sits at the
preset's level and its median about 1–1.5 dB under it; the test tolerance (−3…+0.5 dB) already
allowed this.

Rejected: keeping the median with recalibrated headrooms (Stream 4, Sleep 3.5: 3.4% and 6.5% busy
on the recording, but a bed 12 dB under the voice takes normal whenever the voice is there less
than half the time); a gate referenced to the window's loud quarter instead of its mean (handles
that bed down to 25% talk, but alerts filling 12% of a window pull the gate above the voice, and
normal rises 1.8 dB for 20 s after every 2 s yell); learning each crest at its 90th percentile
instead of a fixed headroom (adapts per stream, but 2–3 alerts per 20 s inflate it and the alert
onset slips through); a 10 s "settle" rule instead of the first-20 s rule (a stream opening on
18 s of bed, like the recording, then cost 20 s of cut voice); following a jump in the first
20 s when it is the majority of the gated window (the extension test's chime, 0.8 s and 17 dB
over the talking, became normal: once it is in the window the gate throws the talking out).

### Results (recordings; talking level = gated median; husam looped so the engine is settled)

| Recording | Preset | Talking in→out | Guard >1 dB before → after |
|---|---|---|---|
| videoyun | Gentle | −18.9 → −18.9 | 43% → 1.9% |
| | Stream | −18.9 → −21.5 (evened; comfortable −20) | 62% → 3.3% |
| | Movie | −18.9 → −19.5 | 52% → 2.4% |
| | Sleep | −18.9 → −29.9 (comfortable −28) | 82% → 5.2% |
| husam | Gentle | −8.1 → −15.2 (comfortable −14) | 39% → 0% |
| | Stream | −8.1 → −21.4 | 49% → 3.4% |
| | Movie | −8.1 → −19.3 | 45% → 0% |
| | Sleep | −8.1 → −29.3 | 61% → 10.4% |

Of what remains on videoyun, about half is the start: the stream opens on 18 s of bed, and the
voice is held 3 s plus the guard's release before it becomes normal. The clip's loudest moments
are +3.6 dB over its local talking level, i.e. loud talking, and come
out at +2.5…+3.5; what the ear hears as peaks on it is its overall loudness, which the
comfortable level takes down 7–21 dB.

### Tests

Synthetic: a streamer talking in phrases over a game bed that fills 55% of the time 22 dB under
(reproduces the failure on 2.1: 100% busy, talking −22…−24 dB; now 0%), the same with a bed
12 dB under, and a 40 s quiet intro then the voice. The sustained-yell test now starts its yell
after 25 s of talking rather than 15 s, since the first 20 s are not defended by design. The spike targets are now measured against
the gated talking level (about 1 dB above the plain median of the synthetic talker, which includes
its pauses) and allow for hits getting 5 dB: Gentle yell/alert ≤ +9.5/+8 (its 7 dB headroom
can't bring an alert under +7 without the hit reading), Sleep ≤ +5.5/+4, Movie ≤ +7/+6, 90s TV
≤ +7/+7.5; Stream unchanged at ≤ +6/+5. Recorded streams run when present (see
tests/fixtures/README.md).
