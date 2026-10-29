# Handoff, 2026-10-30

## Current state

Squashed onto master on 2026-10-30 as one commit, which keeps the mihu prototype out of master's
history. Branch `turkish-streaming-stt` keeps the commits below, locally. Nothing is pushed, and the
version still reads 2.3.1.

| commits | what |
|---|---|
| 8bb1569, fced070 | prototypes: mihu (streaming), then ufak next to it |
| a276525, 9be22e4 | Turkish captions from ufak AI's ufakzeka-kulak (Apache-2.0); token times |
| e9f6e29, 36483c5 | LocalAgreement, whole-dB volume steps, one known stream in the capture check; live lines whose shown words stay |
| 9d120ab, 943209c | `variants/` and this handoff; seq2.js and split.js fixes |
| 9d17670, c46019f, 1d9b501 | the loud-start fix in `lib/`; the variant tooling and the A/B player; task 4's blind round |
| b8e4a89 | task 4 in `lib/`: the harsh-sound stage leaves calm talk bright |
| the one after b8e4a89 | the taming threshold: a new video's first 100 ms, the speech room while held, the trace's line |

**Built in `lib/`, and tested:**
- **Turkish captions** decode from just before the last agreed word and commit what two decodes agree on.
- **A word still in doubt** shows only when ufak is at least 90% sure of it.
- **A line ends** at a full stop, at a 0.3 s pause once it has run 4 s, or at 8 s.
- **Whisper cuts the sentences** when it does the Turkish.
- **The loud-start fix** (since 2026-10-24): `w-calm10u3t-m30-g3.js`, the listener's pick. See "Built into lib" below.
  - **A new stream starts** at the comfortable level (`guardStartUnder`: 3 dB under it on Sleep), or at the level listened to lately if lower (the Stream carry).
  - **Calm talk is believed at once,** up to the level listened to lately; the rest of a louder normal halfway after 10 s of sound.
  - **Strain only counts in a raised voice** (`strainedDb` 6, `strainRaisedDb` 3, `strainMemory` 30 s). All four are settings, with no slider.
- **Task 4** (since 2026-10-24): the harsh-sound stage cuts calm talk only while its brightness lasts a second; a raised or strained voice, a crowd and anything that isn't speech are cut at once, as before. See "Task 4" below.
- **The taming threshold** (since 2026-10-30): a new video's first 100 ms are tamed from where the preset starts; a stream held because it isn't believed yet gets no speech room; the trace's "Taming starts here" is where the guard starts cutting. See "The taming threshold" below.
- **`dist/firefox`** is rebuilt from the task 4 commit for the listener's real use, not yet with the taming threshold fix; its manifest reads 2.4.0, set by hand at the listener's request. The rest of `dist/` is from 36483c5.

## Decisions so far, and why

- **ufak over mihu.** mihu's license is too limiting to distribute; ufak is Apache-2.0 (NOTICE).
- **Steady captions over fast ones.** Words changing after they show felt wrong. The captions test allows at most 10 changed in every 100 shown; it measures 2.
- **Don't trust a stream's first second.** A loud opening used to become normal, so the guard idled and the talk was then held down. At or under the starting level, normal moves as today. The first speech still re-seeds, capped at the starting level.
- **The upward carry is set aside.** It gave a clip opening mid-yell the earlier clips' level, and didn't help short clips.
- **The downward carry, as built, never engages.** NatGeo's long-term level is -23.3; Sleep starts at -33.5 and Stream at -23.0, already at or under it.
- **Carry (answer):** one scored try of the version that engages on Stream; drop it if it doesn't help.
  - **Scored** as `w-b5u3t.js` (see "The Stream-engaging carry" below). It helps a music ad by 1.6 dB and the voice-over ad by 0.2 dB. After a quiet video, it fades a regular stream in from up to 13 dB down.
  - **The listener keeps it,** having heard both Stream renders, though it was recommended dropped. The fade-in after a quiet documentary is fine for them. So Stream's "normal talk untouched" rule has an exception: the first seconds after a quieter video.
- **Belief speed (answer, after listening):** one speed can't serve every clip.
  - **The listener's picks:** today on NatGeo alone (the hold is audible on the narration), 5 s on NatGeo-ad-NatGeo, 10 s on vp05.
  - **So the speed depends on what's playing.** Calm speech (it pulses, and it isn't strained) is believed fast, like today. Sound that doesn't pulse or is strained (yells, music) is believed at 10 s. This uses the existing pulse and strain measures.
  - **Built as `w-calm10u3t.js`,** described in "The calm-speech belief" below. The listener compares its renders with today's and their picks in `node variants/ab.js`.
  - **They also asked for a check** that the voice-over ad doesn't lose its protection by reading as calm speech. It does read as calm, but it stays protected (see below).
- **Second listen, of calm speech against today and their picks:**
  - **NatGeo alone:** today "feels total bright", but calm's entrance "is great". From 1 s on the two renders are bit-identical (`compare.js`). In the first second, before normal is known, calm is 5 dB quieter and 4 dB duller, since the guard's fast gain cuts consonants hardest.
  - **NatGeo, ad, NatGeo:** "the original is bright and warm"; 5 s and calm are on par, 5 s a bit better, today worst. Measured, calm's ad is 0.5-0.8 dB quieter than 5 s's, and 5 s keeps NatGeo 1.3 dB quieter for 20 s after the ad.
  - **vp05:** 10 s tamed the yells best. Calm's later yells came out at today's level: the 10 s strain memory had run out, so the talk was believed at its own level. Hence `w-calm10u3t-m30.js`, with a 30 s memory (below).
  - **Brightness against the original:** every Sleep version is about 2 dB duller than the input. That's Sleep's tone (a -4 dB high shelf at 6 kHz, a 60 Hz low cut) plus the harsh-sound stage: task 4, and possibly the tone's shelf, which is the listener's call.
- **Density (answer):** yes, an integrated-loudness comfortable level as a follow-up, after the harsh-sound work.
- **Third listen (2026-10-24), with blind picks in the player:**
  - **Sleep's 6 kHz shelf stays at -4 dB.** The listener picked today's shelf blind on all three groups (NatGeo 23 Oct, rqyr58kg, k434e), over -1.5 dB and none.
  - **The strain memory is 30 s,** and **strain only counts when raised** (`-g3`).
  - **Build it into `lib/`** with the Stream carry, the strain thresholds as settings; then task 4, judged by the listener's blind picks.

## Scorecard and the listener's preferences

- **NatGeo is what the listener sleeps to.** A slightly quieter or flatter start is fine; what matters is whether it sounds wrong.
- **Muffled sound is a dealbreaker,** worse than a slightly louder moment. Report brightness (the eval's "talk balance") for every variant.

The yardsticks are `tools/eval-dataset.js`, the engine suite and the `variants/` scripts. The clips:
- NatGeo 23 Oct;
- vp05dspr, which opens mid-yell;
- the talk clips jfns3dvx and 4cbdjvb8.

| | today | 10 s | 5 s |
|---|---|---|---|
| vp05dspr yells over its talk, Sleep / Stream (mean of 5) | +13.0 / +11.8 | +5.8 / +8.6 | +8.5 / +11.2 |
| NatGeo 23 Oct, Sleep: time cut, range, held | 23%, 11.4 LU, none | 40%, 9.0 LU, 43 s | 29%, 10.7 LU, 17.5 s |
| NatGeo brightness, Sleep / Stream | -2.5 / -1.5 dB | same | same |
| Music ad over NatGeo, Sleep (its onset) | +4.7 (+7.4) | +2.9 (+2.6) | +2.4 (+1.8) |
| Voice-over ad over NatGeo, Sleep (its onset) | +3.3 (+8.8) | +3.6 (+5.4) | +2.9 (+4.8) |
| Ads over NatGeo, Stream (music / voice) | +6.1 / +5.1 | +6.0 / +4.4 | +6.0 / +4.8 |
| NatGeo re-held after the ad, Sleep | no | 48 s | 18 s |
| Engine checks failing | 0 | 24 | 15 |

- **vp05dspr after the two short clips (Sleep):** at 5 s, its first yell comes out 6.6 dB quieter than today and the next two 3–4 dB louder.
- **The 16 s clips** are held for their whole length on Sleep, at about today's level.
- **The burst tone's bursts stay about +20 dB over the talk after 12 s** in every variant. That's the burst-edge problem.

### The Stream-engaging carry (`w-b5u3t.js`, scored 2026-10-23)

A new video's believed normal starts no higher than the long-term speech level minus the preset's
headroom, so its threshold starts at that level. The worklet carries -22.1 from NatGeo 23 Oct on
Stream, so the ad starts from -25.1 instead of -23.0.

| Stream | today | 5 s | 5 s + carry |
|---|---|---|---|
| Music ad over NatGeo (its first 3 s) | +6.1 (+6.2) | +6.0 (+6.3) | +4.4 (+4.3) |
| Voice-over ad over NatGeo (its first 3 s) | +5.1 (+6.8) | +4.8 (+6.8) | +4.6 (+5.9) |
| NatGeo after the music ad, its first 10 s against its first play | -0.1 | -0.1 | -0.5 |
| A regular stream after NatGeo, 0-3 / 3-10 s against today | 0 / 0 | 0.0 / -0.7 | -1.8 / -0.7 |
| The same stream after NatGeo 10 dB down, 0-3 / 3-10 / 10-30 s | 0 / 0 / 0 | 0.0 / -0.7 / -0.2 | -12.7 / -5.6 / -0.8 |

- **The 10 s version** is alike on the ads (+4.2 / +4.3). After the quiet NatGeo it fades the stream in slower: -12.8 / -8.6 / -3.7.
- **On Sleep it engages only after quiet content.** That needs a long-term level under -31, as the quiet NatGeo has. The stream's first 3 s then come out -8.0 against today, where 5 s alone gives -7.2. Everything else on Sleep is unchanged.
- **The short clips then vp05dspr are unchanged,** on both presets. Neither short clip has 10 s of speech, so there's no long-term level to carry.
- **The eval scores it the same as 5 s, clip for clip,** because every clip starts fresh. That includes NatGeo's brightness: -2.5 dB on Sleep, -1.5 on Stream.
- **Why it was recommended dropped.** The real gain is on the music-only ad, and real ads mostly talk. The cost breaks Stream's rule that normal talk isn't touched: a regular stream after a quieter video is held under where it settles for about 10 s. The listener kept it anyway (see the decisions).

### The calm-speech belief (`w-calm10u3t.js`, 2026-10-23)

Built on `w-b10u3t.js`, so it has the carry and Sleep's start 3 dB under its comfortable level. The
believed normal is min(measured normal, max(slow, calm)).
- **slow:** the start, plus the rest of the measured normal believed halfway after 10 s of any sound. In the earlier variants only speech counted.
- **calm:** the level of the calm speech of the last 20 s, as soon as 1 s of it is there. Until then it's the speech that seeds normal, so calm speech comes in as fast as today learns normal. It's capped at the level listened to lately (the carry's long-term level), when there is one.
- **Calm speech:** a block that counts as speech for normal, with no speech-like block in the last 10 s whose 3 s strain was 6 dB or more. Strain is only read once the 3 s window holds 1 s of sound.
- **A jump in belief over 3 dB** lets the guard's hold go as fast as when normal is first learned.

**Why these choices.** Measured with `cue-stats.js`:
- **The cues alone don't separate the clips.** vp05's yells pulse like talk (pulse 20-50 dB). After its first 3 s, its long opening yell reads *less* strained than NatGeo's narration (3 s strain median 1.7 against 2.6-3.1). The usual tilt is learned from the yell, since normal locks onto it.
- **What does stand out is the yell's first 3 s,** at a strain of 6-11 dB. NatGeo's narration never reaches 5, so a strained moment is remembered for 10 s.
- **Calm speech is believed at its own level, not at the measured normal.** vp05's normal is inflated by the yell, and believing it fast brought back today's failure.
- **The voice-over ad reads as calm speech** (strain under 6, pulses). What keeps it down after NatGeo is the cap: it's believed at NatGeo's level (-22.1) until the slow belief passes it, at about 12 s.
- **Three bugs fixed along the way:**
  - calm blocks were judged on the second before them, missing a stream's opening phrase;
  - the strain read from the block before paired room noise's strain with a voice's first block;
  - one bright first block (jfns3dvx, 6.3 dB) set off the 10 s memory.

| Sleep unless marked | today | 5 s | 10 s | calm speech |
|---|---|---|---|---|
| NatGeo 23 Oct: held, cut on the talk, brightness | none, 1.08 dB, -2.0 | 17.5 s | 43 s | first 1.0 s only, 1.14 dB, -2.0 |
| Voice-over ad over NatGeo (its first 3 s) | +3.3 (+8.8) | +2.9 (+4.8) | +3.6 (+5.4) | +1.8 (+3.7) |
| NatGeo re-held after the ad | no | 18 s | 48 s | 1.0 s |
| Music ad over NatGeo (its first 3 s) | +4.7 (+7.4) | +2.4 (+1.8) | +2.9 (+2.6) | +3.7 (+1.3) |
| Ads over NatGeo, Stream (music / voice), with the carry | +6.1 / +5.1 | +4.4 / +4.6 | +4.2 / +4.3 | +5.6 / +4.2 |
| vp05 alone, yells over its talk (eval, mean of 5) | +13.0 | +8.5 | +5.8 | +5.7 |
| vp05 after the short clips (seq2, mean of 5) | +14.1 | +11.3 | +8.6 | +9.3 |
| jfns3dvx, time cut (eval) | 4% | 91% | 100% | 4.5% |
| Engine checks failing (Chromium) | 0 | 15 | 24 | 0 of 224 |

- **Brightness is today's on every clip, both presets,** with two exceptions:
  - 4cbdjvb8 on Sleep comes out -2.9 dB against -1.5 (as with 10 s). Its talk comes out 3.9 dB louder than today's, so the harsh-sound shelf catches more of it (task 4).
  - vp05 on Sleep reads +5.9. That's the eval's talk selection after the levels shift: a direct render's brightness matches 10 s's everywhere.
- **The music ad is less protected than with 5 or 10 s.** Music is now believed at 10 s instead of never, as the listener specified.
- **9fmyzw9n's yells** (a clip with an early yell) come out +0.2 dB over today on average, where 10 s gives -0.6.
- **Every belief variant still holds the first second** before normal is known. NatGeo's opening second comes out about 4 dB under today's.

**With a 30 s strain memory (`w-calm10u3t-m30.js`).** NatGeo, the ads, jfns3dvx and the synthetic voice are unchanged, since they never strain.
- **vp05 after the short clips:** its yells come out +5.9 +7.5 +10.3 +7.4 +8.3 over its talk (mean +7.9). Calm had +11.3 and +11.4 on the last two; 10 s has +5.7 +11.3 +10.5 +7.3 +8.4 (mean +8.6).
- **Clips that strain are held longer on Sleep.** t5tkhfzr is cut 63% of the time (calm 39%, today 30%), 9fmyzw9n 84% (79%). 9fmyzw9n's yells come out +7.9 (calm +8.6, today +8.4, 10 s +7.8).
- **On Stream,** k434e and 5eak67hd come out 0.3 dB louder than with calm.
- **Every Chromium engine check passes** (224).

Renders for the listener, Sleep, in `variants/listen/`, all in the player (`node variants/ab.js`):
`natgeo-23oct-sleep-calm10u3t.wav`, `natgeo-voicead-natgeo-sleep-calm10u3t.wav`,
`clips-vp05-sleep-calm10u3t.wav`, `clips-vp05-sleep-calm10u3t-m30.wav`, next to the `-today` renders and
their picks (`-b5u3d`, `-b10u3`).

### Before building: Firefox, the strain memory across the dataset, Sleep's shelf (2026-10-23)

Asked by the listener after the second listen. In the player: t5tkhfzr and 9fmyzw9n with every
calm version, and Sleep's shelf on NatGeo, rqyr58kg and k434e. Blind mode records picks to
`variants/results/ab-picks.jsonl`.

**The engine suites pass in full** with every calm version: Chromium 224/224 and Firefox 219/219, for `w-calm10u3t`, `-m30`, `-g3` and `-m30-g3`.

**The 6 dB strain memory goes off on calm talk often** (`strain-scan.js`, Sleep, whole local dataset):
- **157 episodes fall outside the marked parts, 7 inside.** Of those outside:
  - 21 are 6 dB or more over normal, and 5 are 3-6 dB over;
  - 68 are at talk level (-6 to +3 dB);
  - 60 are well under the talk;
  - 3 happen before normal is known.
- **Calm talk and quiet bright sounds read as strained** against a usual tilt learned from the talk, or not learned yet.
- **Every session has episodes at talk level, as do the starts of t5tkhfzr and 4cbdjvb8.** NatGeo, rqyr58kg and jfns3dvx have none.
- **In a long session it barely matters,** since the slow belief has caught up after about a minute. At a video's start it holds calm talk like 10 s.
- **t5tkhfzr's misfire:** a quiet bright sound at 0:01 (-30 LUFS), before its own tilt was learned. With the 30 s memory, its talk is held for the whole clip.

**`-g3`: strain starts the memory only in a raised voice,** 3 dB over the guard's threshold (believed normal + headroom).
- **A first version measured from the measured normal + 3 dB.** It missed vp05's opening yell whenever normal locked onto the yell first, as it did after the short clips.
- **What's left:** 23 unmarked episodes, all 5.5 dB or more over normal except one session's loud start. All the marked yells that set off the memory are still caught (vp05's two, k434e, 5eak67hd), apart from two:
  - mpw9gysz's second marked part, which sits 2.9 dB under its talk;
  - 9fmyzw9n's opening strained moment, marked harsh. It's quieter than Sleep's comfortable level when its strain registers.
- **vp05, the ads and NatGeo are bit-identical** to the ungated versions. t5tkhfzr comes out as today after its first second.
- **With the gate, 10 s and 30 s differ only on real raised strain:** on vp05, 30 s tames the two later yells (+7.4 and +8.3 against +11.3 and +11.4).

| Sleep: loud parts over the talk / time cut | today | 10 s | calm | 30 s memory | raised only (10 or 30 s) |
|---|---|---|---|---|---|
| vp05 (eval) | +13.0 / 5% | +5.8 / 80% | +5.7 / 74% | +5.9 / 75% | +5.7 / 74% (30 s: +5.9 / 75%) |
| t5tkhfzr | +7.4 / 30% | +5.8 / 85% | +6.7 / 39% | +6.4 / 63% | +7.8 / 38% |
| 9fmyzw9n | +8.4 / 53% | +7.8 / 85% | +8.6 / 79% | +7.9 / 84% | +8.3 / 57% |

**Sleep's 6 kHz shelf** (`bands.js` on today's engine, the tone against the input on the talk, relative to the body):

| NatGeo 23 Oct, Sleep | 2-4 kHz | 4-8 kHz | 8-16 kHz air |
|---|---|---|---|
| shelf -4 dB (today) | -2.1 | -4.3 | -5.6 |
| shelf -1.5 dB | -1.9 | -3.5 | -3.9 |
| no shelf | -1.8 | -2.9 | -2.7 |

- **rqyr58kg's air:** -4.3 / -2.3 / -1.0 dB. **k434e's:** -9.6 / -7.7 / -6.7.
- **The rest is the harsh-sound stage.** On NatGeo that's about 2-3 dB with no shelf; on k434e, most of it.
- **The eval's talk balance** (2-8 kHz) on NatGeo reads -2.5 / -2.1 / -1.8. Harsh parts against the talk stay put: +3.3 / +3.4 / +3.5.

### Built into lib (2026-10-24)

`lib/dsp-worklet.js` is `w-calm10u3t-m30-g3.js`, its constants turned into settings:
`guardStartUnder` (Sleep 3, others 0; it replaces the variant's "memory of 300 s means Sleep" test),
`strainedDb` 6, `strainRaisedDb` 3, `strainMemory` 30. They're in `DEFAULTS`, `RANGES` and
`DSP_PARAM_KEYS`, with no slider (like `guardMemory`). 2.3 settings take them from the preset they
were on, so Sleep stays shown as Sleep. The meters also carry `believedDb` and `startDb`, and the
trace's "Taming starts here" follows the believed normal.

**One change from the variant: strain is checked before the belief.**
- **The bug, found by a new engine check:** a stream opening on a strained, pulsing yell.
  - Normal was learned from the yell in its first second, and in that same block the calm belief, with no strain remembered yet, believed it at once.
  - The raised-voice gate then measured from that new belief, so the yell was never "raised" and never held.
- **Now strain is measured against the threshold defended until that block.** The synthetic yell is held: on Sleep, its first 3 s come out +2.3 dB over the talk's level (today +5.7).
- **Every dataset recording comes out bit-identical to the variant,** Sleep and Stream (`variants/results/same-lib-vs-m30g3.txt`). In real clips, normal and the strain register in different blocks.

**Other differences, none of them heard in the renders:**
- **A preset change** forgets the carry when the config arrives, not at the next block.
- **The site's volume moving** shifts the believed normal and the carried level along with normal.
- **The level listened to lately** is stored as Float32 like the momentary history (the values were already Float32).

**New engine checks** (`bench.opening`, `bench.louderAfter`), Stream and Sleep:

| | today (36483c5) | lib |
|---|---|---|
| Calm talk opening at -14: its first seconds against where it settles, Stream / Sleep | -0.1 / -0.3 | same |
| A strained yell opening (+10 dB): its first 3 s over the talk's level, Sleep | +5.7 | +2.3 |
| The talk after that yell, its first seconds against where it settles, Stream / Sleep | -10.0 / -7.9 | -3.3 / -1.6 |
| The talk after a quiet bright sound (-30), Sleep (without the raised gate: -2.0) | -0.4 | +0.2 |
| A video 10 dB louder after one at -34, its first 3 s over it, Stream / Sleep | +9.2 / +4.1 | +4.5 / +3.1 |

- **The bench's resets now land where they're sent:** the render waits 100 ms while suspended, so the worklet reads the message. Without the wait, an offline render never got it. Firefox can't suspend an offline render, so those two checks run in Chromium only, like the volume-steps check.
- **Also new:** the 2.3 settings upgrade check.
- **Engine suite:** Chromium 239/239, Firefox 230/230.

**The full dataset scorecard** (`tools/eval-dataset.js`, all four presets, 24 recordings, 27 marked loud parts; `variants/results/eval3-lib.txt` against `eval3-today.txt`, today being 36483c5's worklet):

| | today | lib |
|---|---|---|
| Sleep: loud parts over the talk, at their loudest / first 2 s / whole | +7.3 / +7.8 / +5.0 | +6.1 / +6.7 / +4.0 |
| Sleep: 1-4 kHz of loud parts over the talk's | +7.7 | +4.8 |
| Sleep: cutting the talk, range, harsh parts over the talk, talk balance | 20.8%, 10.8 LU, +3.3, -1.01 dB | 24.5%, 10.5 LU, +2.3, -0.78 dB |
| Stream: loud parts at their loudest / first 2 s | +7.5 / +8.0 | +7.0 / +7.5 |
| Stream: cutting the talk, harsh parts, talk balance | 12.2%, +3.5, -0.42 | 13.0%, +3.5, -0.42 |
| Gentle: loud parts at their loudest, cutting the talk | +9.3, 5.3% | +9.6, 4.8% |
| Movie: loud parts at their loudest, cutting the talk | +8.4, 12.0% | +8.4, 12.0% |

- **Most of the gain is vp05dspr:** Sleep +13.0 to +5.9, Stream +11.8 to +8.9. Its talk is held 74.5% of the time on Sleep (4.6% today), most of the rise in "cutting the talk". Its talk balance reads +5.9, the known artifact of the eval's talk selection.
- **Small costs:** t5tkhfzr on Sleep +7.4 to +7.8 (cut 30% to 38%); 5eak67hd +3.5 to +4.2 on Sleep, +3.7 to +4.3 on Stream; 4cbdjvb8's talk balance on Sleep -1.5 to -2.9 (its talk comes out louder, so the harsh-sound shelf catches more: task 4).
- **k434e on Gentle reads +5.8 to +7.3, but its loud parts come out identical** (Chromium and Node renders agree). Its last 1.5 s, marked harsh, are cut 3.5-4 dB more: on Gentle, which never reads strain, the belief follows the last 20 s of talk down faster than normal does. The eval counts that moment as talk, so the talk level drops 1.5 dB.
- **wssp571g on Gentle:** its talk is cut 11.9% of the time instead of 24.5%.

### Task 4: the harsh-sound stage and calm speech (started 2026-10-24)

**Where the stage cuts calm talk** (`harsh-scan.js` on lib, Sleep). Its shelf cut adds up to 7785 dB·s on the talk outside the marked parts and 348 inside the marked harsh parts; NatGeo 23 Oct's narration takes 107.5. It answers sibilants and bright syllables: a 100 ms balance passing the usual one by 3 dB.

**Skipping speech by its strain doesn't separate them.** The marked harsh parts' speech reads a median 3 s strain of 1.2 dB, the talk's 0.8. Skipping speech under 3 dB of strain takes 58% of the cut off the talk and 34% off the harsh parts (9fmyzw9n keeps 29% of its cut).

**How long the brightness lasts does** (`harsh-rules.js`, what each rule aims for, as % of today's):

| rule (Sleep) | talk | NatGeo's talk | marked harsh |
|---|---|---|---|
| a 0.6 s balance also 1 dB past the allowance | 64% | 44% | 84% |
| the same, on speech only (alerts, crowds cut at once) | 68% | 53% | 88% |
| a 1 s balance also 1 dB past it | 55% | 33% | 82% |
| the same, on speech only | 60% | 43% | 86% |
| skip speech under 3 dB of strain | 50% | 49% | 73% |

- **The candidates are the speech-only ones:** `w-hl0.6s1sp.js` and `w-hl1s1sp.js`. Only speech the speech gate recognises has to stay bright for the shelf to cut. Measured with the shelf's attack and release (`harsh-scan.js`), the talk keeps 62% and 53% of today's cut, NatGeo 23 Oct 60% and 45%, the marked harsh parts 88% and 83%.

**Renders against their input** (`bands.js`, tone relative to the body; lib / 0.6 s / 1 s):

| | 4-8 kHz | 8-16 kHz air |
|---|---|---|
| NatGeo 23 Oct, Sleep (with the -4 dB shelf) | -4.5 / -3.2 / -2.8 | -5.7 / -4.6 / -4.3 |
| NatGeo 23 Oct, Stream | -3.0 / -1.4 / -1.0 | -2.4 / -1.1 / -0.8 |
| k434e's harsh part (0:14.9-0:26.8), Sleep | -5.5 / -5.3 / -5.2 | -7.5 / -7.4 / -7.3 |
| 5eak67hd's long harsh part (0:23.4-0:35.2), Sleep | -6.6 / -6.5 / -6.5 | -9.7 / -9.6 / -9.6 |
| 9fmyzw9n's harsh stretch (0:03.5-0:13.2), Sleep | -2.6 / -1.7 / -1.0 | -2.5 / -1.5 / -1.4 |
| rqyr58kg's strained voice (0:24.2-0:36), Sleep | -1.8 / -1.3 / -1.3 | -3.6 / -3.1 / -3.1 |
| mpw9gysz's harsh part (0:07.5-0:10.8), Sleep | -10.6, all three | -11.3, all three |

- **9fmyzw9n loses about 1 dB of softening** in its harsh stretch, and rqyr58kg 0.5 dB. The shelf took little of rqyr58kg's strained voice even now (a mean 0.42 dB over it; 0.10 with either candidate): the raised-voice stage holds it.
- **Engine suite (Chromium):** 0.6 s passes 239/239. 1 s fails 3: the bench's crowd and cymbal hits pulse like speech, so its second harsh part (3 s) comes out only 2.3 dB softer at the edge, against at least 4. It would need that fixed before it could ship.
- **In the player** (`node variants/ab.js`), first round, "Harsh sound leaves calm talk alone": NatGeo on Sleep and Stream, k434e, 5eak67hd, 9fmyzw9n, rqyr58kg and mpw9gysz, each as lib, 0.6 s and 1 s.

**The listener's blind picks** (`variants/results/ab-picks.jsonl`):
- **1 s** on NatGeo (Sleep and Stream), 9fmyzw9n and mpw9gysz;
- **0.6 s** on k434e;
- **lib** on 5eak67hd and rqyr58kg. Both were picked inside a raised, harsh voice (0:30.1 and 0:29.4).

Their verdict: "keep calm talk bright (the 1 s rule), and soften raised or strained voices quickly, like lib." No more rounds; they judge the result in real use.

**Built into lib: the hybrid (`w-hl1s1calm13.js`).**
- **Calm talk keeps its brightness.** Speech that pulses, isn't raised (its last 3 s under 1 dB over normal) and isn't strained (under `strainedDb`) is only cut while a 1 s balance is also 1 dB past the allowance.
- **Everything else is cut at once, as lib did:** a raised or strained voice, anything that isn't speech, and calm talk 13 dB or more past the allowance.
- **Why the 13 dB.** The bench's crowd and cymbal hits (noise above 3 kHz) pulse like syllables, so they passed as calm talk. That's how the 1 s versions failed three checks (their second 3 s part only 2.3 dB softer).
  - With the 13 dB limit they come out 6.2-7.0 dB softer, against lib's 6.7-7.2 (the check needs 4).
  - 10 dB also passed, but held 9fmyzw9n's 0:03.5-0:13.2 stretch back from the 1 s version (30.5 against 28.2 dB·s).
- **The raised condition is the one the lib picks need:** without it, 5eak67hd's harsh moments after 0:36 get 8.2 dB·s instead of 20.4, and rqyr58kg's strained voice 1.2 instead of 4.5.

**Shelf cut per clip** (Sleep, dB·s, Node; less is brighter; `variants/results/t4-cuts-by-clip.txt`):

| | lib 9d17670 | 0.6 s | 1 s | hybrid |
|---|---|---|---|---|
| NatGeo 23 Oct | 86.3 | 51.8 | 39.6 | 39.8 |
| NatGeo 22 Oct | 44.4 | 16.8 | 13.9 | 15.7 |
| 9fmyzw9n (0:03.5-0:13.2) | 42.7 (32.6) | 34.1 (28.6) | 33.7 (28.2) | 34.7 (28.2) |
| mpw9gysz | 69.4 | 60.0 | 56.9 | 57.0 |
| k434e (harsh part 0:14.9-0:26.8) | 83.6 (56.0) | 76.8 (55.0) | 72.9 (54.1) | 83.3 (55.8) |
| 5eak67hd (harsh moments 0:36-0:52) | 116.2 (22.4) | 102.4 (12.4) | 94.6 (6.2) | 109.4 (20.4) |
| rqyr58kg (strained voice 0:24.2-0:36) | 32.3 (5.0) | 11.2 (1.2) | 5.3 (1.2) | 8.6 (4.5) |

- **It matches the picks.** NatGeo, 9fmyzw9n and mpw9gysz come out as the 1 s version. k434e, 5eak67hd's harsh moments and rqyr58kg's strained voice come out as lib.
- **Two small departures,** both following the rule the listener stated:
  - 9fmyzw9n's last marked loud part (0:30.9-0:33.3) is a raised voice, softened like lib: 1.0 dB·s, about 0.5 dB of air.
  - rqyr58kg's calm talk before the strained voice (0:18-0:24.2) is as bright as the 1 s version: 4.1 dB·s against lib's 14.8.

**Every suite passes:**
- engine: Chromium 239/239, Firefox 230/230;
- extension end to end: Chromium 94/94, Firefox 21/21.

**The full scorecard** (`variants/results/eval4-t4.txt` against `eval3-lib.txt`; Gentle and Movie have no harsh-sound stage and are unchanged):

| | lib 9d17670 | hybrid |
|---|---|---|
| Sleep: talk balance / harsh parts over the talk | -0.78 / +2.3 dB | -0.55 / +2.5 dB |
| Sleep: loud parts at their loudest / first 2 s | +6.1 / +6.7 | +5.9 / +6.5 |
| Stream: talk balance / harsh parts over the talk | -0.42 / +3.5 dB | -0.20 / +3.8 dB |
| Stream: loud parts at their loudest / first 2 s | +7.0 / +7.5 | +6.8 / +7.3 |
| NatGeo 23 Oct's talk balance, Stream / Sleep | -1.5 / -2.5 dB | -0.5 / -1.5 dB |
| NatGeo 22 Oct's talk balance, Stream / Sleep | -0.3 / -0.9 dB | -0.1 / -0.8 dB |

- **What's left of NatGeo's dulling on Sleep is mostly the -4 dB shelf,** which the listener kept.

### The taming threshold (2026-10-30)

The listener asked for the flaw in the taming threshold. Three, all fixed:

**1. A new video's first 100 ms were tamed from -23 LUFS, whatever the preset.**
- **Why:** a reset set the believed normal to the engine's default, -23. The preset's start (the comfortable level, `guardStartUnder` under it, or the carry if lower) was only applied at the first 100 ms block.
- **How much:** on Sleep the threshold sat at -20.5 instead of -31. On Stream after a quieter video it sat at -20 instead of the carried level.
- **When it showed:**
  - the engine's first video;
  - the next video after a paused tab's audio was suspended (10 s);
  - a reset while sound plays.
- **When it didn't:** silence processed after a reset already applies the start (`rest()` keeps running the blocks), so a gap between videos hid it.
- **Why the checks missed it:** -23 is exactly Stream's start (-20 - 3), and the opening checks average over 1-3 s.
- **The fix:** `startOf()`, used by `resetAnalysis()` as well as every block.
- **New engine checks** (`bench.firstMoments`): the loudest 50 ms of a loud opening's first 120 ms against the loudest of what follows until its normal is known (0.15-0.9 s). The "after a quieter video" case runs in Chromium only, like the other reset checks.

| loudest 50 ms of the first 120 ms, over what follows | before | after |
|---|---|---|
| Stream, a -14 LUFS opening | 0 | 0 |
| Sleep, a -14 LUFS opening | +10.0 | +0.2 |
| Stream, the same after a video at -34 (reset as its sound arrives) | +12.1 | 0 |
| Sleep, the same | +11.5 | +0.2 |

**2. A stream held because it isn't believed yet kept the speech room.**
- **Why:** the room's fade measured the climb over the *measured* normal, while the threshold sits on the *believed* one. A stream that opens mid-yell has the yell as its measured normal, so the yell never climbed and kept the full 3 dB.
- **On Sleep:** that cancelled `guardStartUnder`. vp05's held yell came out at the comfortable level, not 3 dB under it.
- **The fix:** the fade now measures from the believed normal. Nothing changes while the two agree, which is almost always for calm talk.
- **Dataset scorecard** (`variants/results/eval5-fix.txt` against `eval5-base.txt`, base being b8e4a89):
  - Stream: loud parts at their loudest / first 2 s / whole +6.8 / +7.3 / +4.7 → +6.7 / +7.2 / +4.5.
  - Sleep: +5.9 / +6.5 / +3.8 → +6.0 / +6.5 / +3.9.
  - Gentle and Movie are unchanged (no speech room).
- **vp05dspr:**
  - Sleep: its worst 3 s come out +6.3 → +4.7. Its loud parts are unchanged in absolute level.
  - Its talk between the yells comes out 1 dB quieter (held 77.3% of the time against 74.5%).
  - Stream: worst 3 s +7.7 → +6.5; its third loud part +3.8 → +1.2.
- **The cut elsewhere** (guard or raised voice, Sleep, dB·s): NatGeo 23 Oct +0.3 over 70 s, rqyr58kg +1.0 over 36 s, k434e +0.4 over 33 s.
- **Brightness is unchanged.** The harsh-sound shelf cuts exactly the same on vp05, NatGeo 23 Oct, rqyr58kg and k434e (Sleep), and the guard is broadband. NatGeo 23 Oct's talk balance stays -1.5 (Sleep) / -0.5 (Stream).
- **The summary's Sleep brightness rows all move with vp05 alone:**
  - talk balance -0.55 → -0.88 (-0.86 → -0.86 without vp05);
  - harsh parts over the talk +2.5 → +3.6;
  - loud parts' 1-4 kHz +4.6 → +7.0.
  - vp05's talk is measured 1 dB lower, so its known +5.9 talk-balance artifact is gone (now -1.2). Its harsh parts read 11.8 over the talk, as on the other presets, where they read 4.7 before.

**3. The trace's "Taming starts here" sat too high.** It included the full speech room even when the guard had faded it, and it marked the centre of the guard's 4 dB knee, 2 dB over where cutting starts.
- **Now:** the line is the foot of the knee, with the room the guard is giving at that moment.
- **Jitter:** on NatGeo 23 Oct (Sleep) the line moves over 2 dB between meter ticks 0.3% of the time (0.1% before); on k434e 2.4%, where the yells take the room away.
- **Not on the line:** the raised-voice stage judges the last 3 s against the talk, so it can still cut under the line.

**Every suite passes:**
- engine: Chromium 243/243, Firefox 232/232;
- extension end to end: Chromium 94/94, Firefox 21/21.

## Measurement gotchas

- **Meters tick 20 times a second:** seconds are the count divided by 20.
- **Reset at exact sample positions.** In offline renders, a reset sent from the page lands late, or never. `seq2.js` builds the resets into the worklet copy. Late resets once showed an ad +8.8 dB over NatGeo in every variant, which was wrong. The engine bench suspends the render, sends the reset and waits 100 ms before resuming; then it lands in the gap.
- **Compare ads in integrated loudness** (BS.1770, gated), not talk medians: a dense ad's median sits at its upper quartile, a documentary's 6 dB under.
- **"Held" means** the believed normal is more than the preset's headroom under the measured one.
- **The eval skips** the first 10 s of reference recordings (3 s of clips), so it hides part of a hold.
- **The music-only ad never counts as speech,** so it never gets believed. Use the voice-over ad.
- **NatGeo 23 Oct is only 70.3 s.**
- **Sleep's tone EQ runs outside the worklet,** so heard levels need the bench page, not Node.
- **Before captions tests,** clear the reused profile's service-worker ScriptCache and Database.
- **Test browsers** always run silent and GPU-free.
- **A monitor switch can crash the machine,** and the reboot wipes `/private/tmp`. Keep work in the repo.

## Next tasks, in order

1. **The Stream-engaging carry:** done, kept by the listener.
2. **The listener's picks:** done. A 30 s strain memory, strain only when raised, Sleep's shelf kept at -4 dB (blind, three of three).
3. **Built into `lib/`:** done (see "Built into lib"). `dist/firefox` is rebuilt for real use.
4. **The harsh-sound stage leaves calm talk bright:** done (see "Task 4"). The listener judges it in real use. Sleep's 6 kHz shelf stays at -4 dB and the 60 Hz cut stays.
5. **The burst-edge fix:** a burst's abrupt edges pulse like syllables, count as speech, and hold normal halfway (-14 dB).
6. **The integrated-loudness comfortable level** (density).
7. **Squash onto master:** done 2026-10-30, with the taming threshold fix. Release (ufak captions would be 2.4.0), push and publish only when asked.

Parked: the guard's speech room dropping at once on a +10 dB jump; a parametric EQ.
