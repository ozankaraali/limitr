# QiTV ASR's Turkish models in the browser (2026-11-16; small shipped in Limitr 2.5.0)

Can QiTV ASR's Turkish models (CC BY 4.0, credit "QiTV ASR Turkish - Ozan Karaali") take ufak's
place in the live Turkish captions? Measured on a 2017 Intel i7-7820HQ (4 cores, 8 threads) in a
silent, GPU-free headless Chromium. Limitr's Chrome rule (a quarter of the cores, at most 4) gives
this machine 2 threads.

## Moonshine small and medium (whole-utterance): small fits the English Moonshine pipeline

**Correction (2026-11-16):** this section first said neither model could work live. That judged
them against ufak's half-second live agreement. Limitr's English captions run Moonshine base in a
plainer pipeline: the whole open sentence again once a second, a 240 ms pause ends it, 8 s at
most. Turkish small fits that pipeline.

**English Moonshine base costs about two thirds of what Turkish small does per decode.** Base
(transformers.js q8, wasm) takes 20-24% of the window on 1 thread and 14-18% on 2 threads.

**Through the English pipeline** (`tests/bench/turkish-captions-bench.js --engines=ufak
--ufak-refresh=1 --ufak-pause=0.24 --ufak-max=8 --ufak-slow-after=1000 --offline-model=M`), on the
sherpa wasm and 1 thread:

| | NatGeo 23 Oct, 0-70 s | a streamer's talk, 60-180 s |
|---|---|---|
| ufak | 21.0% / 0.88 s, 2.26 s / 39.3 | 12.6% / 0.76 s, 1.21 s / 23.1 |
| qitv-small | 89.3% / 3.21 s, 5.19 s / 19.4 | 63.7% / 1.40 s, 2.70 s / 20.5 |
| qitv-mid | 100.2% / 5.85 s, 8.11 s / 12.1 | 88.5% / 3.46 s, 7.22 s / 10.2 |

Each cell is the share of real time, then when a word shows (median, p90), then shown words
changed per 100. Moonshine's word times are spread over the sentence, since it gives none.

- **Leaving the word being spoken off the line until the sentence ends** cuts the changes to:
  small 6.0 and 9.4, mid 3.4 and 7.0, ufak 19.6 and 15.3.
- **On onnxruntime-web with Chrome's 2 threads** a decode costs about 0.6 of the sherpa 1-thread
  figure, so small would be roughly 40-55% of real time here. That is estimated, not run through
  the pipeline.
- **Small looped** "Gel. Gel. Gel. Gel..." at NatGeo's end. QiTV has a guard for this
  (`services/captions/guards.py`).

**Per-decode cost, as a share of the window's length:**


| | small | medium | ufak |
|---|---:|---:|---:|
| sherpa-onnx wasm (Limitr's `lib/sherpa-offline/`), 1 thread | 32-41% | 56-73% | 4-5% |
| onnxruntime-web 1.21 (`lib/ort.bundle.min.mjs`), 1 / 2 / 4 threads | 36-48 / 20-29 / 14-24% | 62-106 / 39-64 / 28-55% | |
| native sherpa-onnx 2.0.1, 1 thread | 12-16% | 22-29% | |

- **The encoder re-reads the whole window on every call**, and the decoder is autoregressive. ufak's
  half-second live agreement doesn't suit them; the English pipeline's once-a-second refresh does.
- **No word times and no confidence** come back, so `lib/live-agreement.js` can't run on them.
- **The text is right in the browser.** Given the same float audio, onnxruntime-web's greedy text
  equals native sherpa-onnx's.
- **The sherpa wasm run got the clip as 16-bit audio**, and native got float. Its few different
  greedy choices, and one empty result where native gave a line, may come from that.
- **Memory wasn't measured cleanly.** The models' pages shared one renderer.

## The conformer (streaming FastConformer, 142 MB): fits in Chromium

Fed in 0.5 s pieces, as Limitr's capture sends them, on one thread. The streaming sherpa wasm is
v1.13.7, from the mihu prototype (`git show 8bb1569:lib/sherpa/...`).

**Delay:** for the conformer, a word shows when its first piece is in a result, on a live clock
(pieces arrive every 0.5 s, and each decode waits for the one before), minus the model's own time
for that piece. A word is readable only once it is whole, so these are lower bounds. ufak's live
line comes from `tests/bench/turkish-captions-bench.js --engines=ufak-live`, with ufak's own word
times.

| 70-120 s stretches | conformer: real time / a word shows after (median, p90) | ufak live |
|---|---|---|
| NatGeo 23 Oct, 0-70 s | 19.9% / 1.16 s, 1.64 s | 24.7% / 0.93 s, 1.37 s |
| a streamer's talk, 15 Oct recording, 60-180 s | 19.6% / 1.18 s, 1.63 s | 16.4% / 0.97 s, 1.64 s |
| another streamer's game stream, 20 Oct recording, 300-420 s | 19.0% / 1.24 s, 1.75 s | 23.0% / 1.22 s, 2.30 s |

**Shown words never change.**
- On all three stretches each version of the text extends the one before: words are added, or
  the last one grows.
- `changedPer100` says 0.0, 1.2 and 5.8 anyway. That comes from its matching: when a word comes
  again in the new text, it can pair the last shown word with the later copy and count the words
  in between as put in ("bunları ne" to "bunları ne hiç okudum, ne bir şey yaptım" counts 3).
- ufak's 3.6 and 5.4 may hold some of this too, so they are upper bounds.

**How it behaves:**
- **The text:** cased and punctuated, with a time for every word piece.
- **The cost doesn't depend on what plays:** it reads all the sound, music included, while ufak
  reads only what the segmenter calls speech.
- **The audio must be fed 32768 times louder.** That stands in for the card's
  `normalize_samples=False`, which this JS API doesn't expose. At gain 1 it writes nothing.
- **Greedy only:** `modified_beam_search` exits this wasm with exit(-1).

**Next to native sherpa-onnx 2.0.1:**
- Native 2.0.1 runs at 8.5% of real time greedy, and 10-11.5% with a beam of 4.
- Its greedy text differs from this build's in a few words. It wrote "süt stoğunu" where this
  build wrote "süt sütunu" (ufak also writes "süt stoğunu"), and it kept a first "Ya".
- Whether a newer build would remove that is unknown. Native 1.13.7 doesn't load on this
  macOS 13, so wasm against native and 1.13.7 against 2.0.1 can't be told apart here.
- v1.13.7 is the newest sherpa-onnx release with a streaming-ASR wasm build. Later releases ship
  only TTS and VAD wasm, so a 2.0.1 build would have to be compiled with emscripten.

**The card's word error rates,** measured with a beam of 4 (it gives no greedy figure, and this
build runs greedy only):
- Drama A: conformer 16.5, ufak 24.8.
- YouTube talk: 24.4 against 24.8.
- Read speech is worse: FLEURS 11.4 against 9.4, Common Voice 11.0 against 9.3.

**Not run:** Firefox, and more than one thread.

## Real subtitled Turkish (2026-11-16): small leads cue by cue, the conformer live

The cards' test sets aren't on this machine, so this uses public YouTube videos with Turkish
subtitles written by people (manual tracks, not automatic ones). From each, a 10-minute section is
taken, 50 minutes in all:
- a conversation: a comedy duo on a relationship-quiz show
- an episode of a TV drama
- a Turkish feature film
- a TEDx talk
- a presenter's narrated video

The audio and subtitles are used locally only and not kept in the repo. The video ids and
sections head `variants/results/qitv-subs-cues.txt` ("name id from to", in seconds; the
`sources.txt` that `subs-prep.py` reads).

**Cue by cue**, with qitv-asr's own tools:
- `eval/build_subtitle_test.py` cuts the cue clips: 747 clips, 0.60 h.
- `eval/read.py` reads them with Limitr's settings: ufak at gain 8 with no padding, Moonshine
  greedy, the conformer greedy (`--paths 1`) with 0.16 s before and 3 s after.
- `eval/score.py` scores them.

Words wrong, % (95% interval):

| | all | conversation | drama | film | TEDx | presenter |
|---|---:|---:|---:|---:|---:|---:|
| ufak | 22.1 (20.2-24.1) | 35.4 | 31.5 | 26.9 | 9.0 | 12.7 |
| small | **18.7** (16.7-20.7) | **27.3** | 28.6 | 30.0 | 7.8 | 10.3 |
| mid | 16.9 (15.1-18.9) | 24.6 | 22.5 | 28.9 | 7.5 | 9.6 |
| conformer, greedy | 20.7 (18.9-22.5) | 30.9 | 29.5 | 24.7 | 9.9 | 13.3 |

- **Against ufak overall,** paired on the same resamples: small -3.4 points (-4.9 to -2.0), mid
  -5.2, conformer -1.4 (-2.6 to -0.2).
- **On conversation** small is 8.2 points ahead of ufak (-11.6 to -4.9). The cards' YouTube talk
  set said the opposite.
- **The film is the exception.** Small writes 7.1% extra words there against ufak's 3.1%, mostly
  on cues whose audio doesn't hold the subtitle's words, where every model writes noise. Once,
  on an unclear cue, small switched to English ("He was the son of beş yüz metreyle asylum...")
  where ufak had "beş yüz metre ilerisinde" right.

**Live, end to end (on the gpu box, x86-64, 32 threads):** the five sections through Limitr's
pipelines in the browser, each engine's whole captions scored against each section's whole
subtitle text with `eval/score.py` (`live-score.py`).
- ufak's live line runs from the old code.
- small runs as built: the model worker on Chrome's threads (4 there), the English pipeline, the
  word being spoken held back.
- The conformer runs streaming, greedy, in the v1.13.7 wasm.

The texts and the run's log are in `variants/results/qitv-live/`.

| words wrong, % | ufak live | small, as built | conformer |
|---|---:|---:|---:|
| all five | 23.2 | 22.4 (-0.8, -2.1 to +0.4) | **21.0** (-2.2, -5.7 to +0.2) |
| conversation | 33.8 | **31.2** | 32.2 |
| drama | 38.7 | 36.7 | **27.9** |
| film | 31.1 | 31.5 | **27.7** |
| TEDx | 11.6 | 11.6 | **8.3** |
| presenter | **12.0** | 12.5 | 13.5 |
| shown words changed later, per 100 | 3.1-6.2 | 3.1-26.5 | 0.7-4.6 |
| a word shows after (median) | 0.73-1.28 s | 0.86-1.33 s | 1.09-1.15 s |
| CPU, share of real time | 7-15%, 1 thread | 14-41%, 4 threads | 10%, 1 thread |

- **Most of small's cue-by-cue lead is lost live.** It re-reads up to 8 s at a time and is cut
  where no pause was heard.
- **Its extra words in the drama are mostly background voices and sounds** the subtitles leave
  out ("hahahaaaa", "ahhh tamam tamam"), not loops.
- **Small's shown words change the most:** 26.5 per 100 in conversation and 17.3 in the drama,
  even with the word being spoken held back.
- **The conformer's output is append-only.** Its changes per 100 are all the metric's
  repeated-word artifact.

## Small, read with less work (branch `qitv-asr-small-perf`, 2026-11-16; in 2.5.0)

On a listener's laptop small spun the fans, where QiTV runs it lightly. QiTV reads each
utterance once, after it ends: the app keeps the picture 8 s behind and runs native
onnxruntime, and the site transcribes whole files. Limitr can't delay the picture. It read the
open sentence (up to 8 s) again from its start every second, so an 8 s sentence was read about
4.5 times over, on one thread in Firefox.

Measured on one thread (the Mac, a busy machine, so roughly):
- **The encoder** takes about 0.22 s per second of sound, every reading. Its convolutions are
  27% of it and its int8 matrix products 57%.
- **The decoder** takes about 40 ms a token. Of that, about 27 ms is int8 products on one row,
  about 25 ms is the overhead of the graph's many small operators, and 5-10 ms re-projects the
  encoder's output on every cached call.

What changed (`lib/turkish-moonshine.js`, `lib/turkish-reading.js`, `lib/transcriber.js`):
- **onnxruntime-web 1.31.1** in place of 1.21.0 (the same three files).
- **A stand-in for the encoder's output.** The decoder's cached calls never read it, so they get
  one frame of zeros instead. The tokens are the same in all 9 test readings.
- **Agreed words go forward.** A reading starts from the words that two readings in a row said
  alike, taken by the decoder in one call. The finished sentence starts from them too, unless
  the sentence was cut for its length.
- **The encoder goes on.** The line being spoken is encoded from 1 s before the new sound, and
  joined to the last reading's output (its last 0.5 s read again). The finished sentence,
  which has no new sound once its trailing pause is trimmed, takes the start of that output
  (added second, below).
- **A budget.** The line being spoken is read again only when the readings have taken no more
  than a share of the time (0.4 first, 0.6 now). A finished sentence is read at once.

The five sections on the gpu box through `tests/bench/turkish-captions-bench.js` (its
`--turkish-*` options), scored with `eval/score.py` on rows from `perf-score.py`:

| read | words wrong, all five | vs read as before |
|---|---:|---|
| as before (1.31.1) | 22.7 | |
| budget only | 22.7 | the same text |
| agreed words forward, budget | 22.6 | -0.0 (-0.4 to +0.2) |
| **all of the above (on the branch)** | 22.7 | +0.0 (-0.4 to +0.4) |
| all, the finished sentence read afresh | 22.7 | the same text |
| every shown word forward (no agreement) | 25.1 | **+2.4 (+0.7 to +6.3)**: an early word is kept |
| all, the finished sentence's encoder continued too | 23.0 | +0.3 (-0.0 to +0.8), and no faster |

Against the committed small on 1.21.0 (22.4), the same reading on 1.31.1 and this branch's decode
loop scores 22.7 (+0.3, +0.0 to +0.8). Most of that is the runtime, whose int8 kernels round
differently: alone, it changed a word in 4 of 9 test readings, where the stand-in changed none.

**One thread (Firefox), before -> after:**

| | conversation | drama | film | TEDx | presenter |
|---|---|---|---|---|---|
| CPU, share of real time | 76 -> 44% | 24 -> 21% | 25 -> 20% | 33 -> 30% | 77 -> 45% |
| a word shows after (median) | 1.87 -> 2.29 s | 1.04 -> 1.04 s | 1.24 -> 1.23 s | 1.13 -> 1.11 s | 1.88 -> 2.30 s |
| ... p90 | 3.16 -> 4.01 s | 1.66 -> 1.74 s | 2.48 -> 2.72 s | 1.71 -> 1.71 s | 2.91 -> 3.91 s |
| shown words changed later, per 100 | 23.1 -> 13.0 | 15.4 -> 13.8 | 17.2 -> 10.7 | 3.1 -> 2.6 | 9.8 -> 6.4 |

**Chrome's threads (4 there):** CPU in conversation 34 -> 28% and from the presenter 34 -> 28%;
about the same in the other three. A word shows as soon as before (0.85-1.26 s), and shown
words change less (conversation 25.6 -> 21.9, film 17.8 -> 11.5).

- **The budget cuts the CPU where small couldn't keep up** (fast conversation, long
  sentences), and words show later there. The cheaper readings let it read more often within
  the budget: in conversation 2.66 s with the budget alone, 2.29 s with all of it.
- **Elsewhere the finished sentences, read whole, are most of the cost.** Continuing their
  encoder only when they had new sound saved nothing and cost words (the last row above): a
  finished sentence is shorter than the last reading of its line, its trailing pause trimmed,
  so it was read whole anyway.
- **Showing only the agreed words** would leave 1.0-3.8 changes per 100, but words would show
  0.5-1.3 s later (p90 up to 6.3 s). The live line still shows all its words but the last.

**The listener's try (Firefox on the 2017 i7 laptop): fans quieter, but the line came slowly,
in bursts.** On that core a finished sentence read whole took about 2.5 s for 8 s of fast
speech, the line waited through it, and the budget then waited 1.5 times as long again. So a
finished sentence now takes the start of the encoder's output the line already had (its words
heard with a little after them), and only the words past the agreed ones are decoded.

The laptop, one thread, 150 s of the conversation and of the drama (a busy machine, so roughly):

| | conversation: CPU | a word shows after (median / p90) | drama: CPU | a word shows after |
|---|---:|---|---:|---|
| as before | 97% | 4.2 / 6.3 s | 65% | 1.6 / 4.1 s |
| the first try: budget 0.4 | 57% | 4.7 / 8.5 s | 38% | 1.3 / 3.2 s |
| budget 0.6 | 74% | 4.4 / 7.5 s | 46% | 1.3 / 3.0 s |
| no budget | 96% | 2.8 / 6.9 s | 49% | 1.2 / 2.5 s |
| **the finished sentence from the line's output, budget 0.6 (the branch)** | 65% | 2.6 / 3.8 s | 39% | 1.2 / 2.3 s |
| the same, no budget | 82% | 1.8 / 3.0 s | 41% | 1.2 / 2.2 s |

The five sections on the gpu box, one thread:
- **Words wrong:** 22.8, +0.1 (-0.2 to +0.5) against as before, with budget 0.6 or none.
- **CPU and delay, before -> after (budget 0.6):** conversation 76 -> 50%, 1.87 -> 1.47 s
  (p90 3.16 -> 2.53 s); presenter 77 -> 48%, 1.88 -> 1.45 s (p90 2.91 -> 2.22 s); drama, film
  and TEDx 20-28%, words a little sooner than before (0.98-1.11 s).
- **Shown words changed later, per 100:** 2.5-19.5, against 3.1-23.1 before.
- **Budget 0.6 against none:** the same there, as the budget seldom holds now on that core.

## MiLMMT-46-1B translation (QiTV 2.10's caption translator): doesn't fit on the CPU as exported

The model is Gemma 3 1B (Gemma terms), int4 ONNX from onnxruntime-genai with the greedy pick in
the graph: 692 MB plus a 33 MB tokenizer, at Hub revision `73356cb2ee11aeb7be2b2bbe14e37126612bc66b`.
These are Turkish caption lines into English, with QiTV's prompt (`mtprobe.js`, `mt-native.py`).

| | prompt (30-39 tokens) | each new token | a caption line |
|---|---:|---:|---:|
| native onnxruntime 1.23.2, 4 threads | 0.35 s | 34 ms | about 0.9 s |
| onnxruntime-web 1.23.2, wasm, 2 threads | 4.6-4.7 s | 3.6-7.6 s | 59-127 s |
| onnxruntime-web 1.23.2, wasm, 4 threads | 2.3-8.0 s | 1.9-2.9 s | 32-61 s |

- **Limitr's bundled onnxruntime-web 1.21 can't load it.** It throws a wasm exception at session
  creation, most likely because its GroupQueryAttention nodes take 12 inputs, a newer form than
  1.21 has. 1.23.2 loads it, so a translator would need a newer onnxruntime-web next to
  transformers.js's.
- **The wasm CPU build is about 60 times slower than native.** Setting `accuracy_level` from 4 to 1
  (fp32 compute) changes nothing. The cost scales with threads, so it is compute: most likely a
  slow fallback for the int4 matmuls in wasm.
- **The translations are very good**, and the same in the browser and natively. For example
  "Beslenme alanlarına ulaşmak için anne yavrularını kayalık ve tehlikeli arazide yönlendirmek
  zorunda." becomes "In order to reach feeding grounds, the mother must guide her cubs across
  rocky and dangerous terrain."
- **Not measured:** WebGPU, where int4 matmuls are well supported (tests here stay GPU-free), and
  an int8 export, which would be about 1 GB with its 262k-token embedding.

## Running the probes

The scripts read `models/`, `clips/`, `sherpa-stream/` and `venv-sherpa/` from their own
folder. Those are gitignored.

- **Models:** from the Hub, at pinned revisions.
  - small: `a4dea6126a4d4dad52f459f31590691f281a8e92`
  - mid: `d81f33cbdc992b78b7dd9e4a949f2862bd47f62c`
  - conformer: `42ad10a3042c3fbfe8a9be28c97a6d4adb7971c8`

  Each comes from `https://huggingface.co/ozankaraali/qitv-asr-tr-<name>/resolve/<rev>/onnx/<file>`.
  The copies in `~/qitv-asr-release` have the older signed-weight decoders.
- **Clips:** 16 kHz mono `pcm_f32le` wavs cut from `tests/fixtures/recordings/dataset/` with
  `ffmpeg -ss FROM -i REC -t SECONDS -ac 1 -ar 16000 -c:a pcm_f32le`.
  - The 15 s ones: the 22 Oct NatGeo recording from 20 s, a raised-voice stream from 5 s and the
    15 Oct streamer's talk from 120 s (names in the gitignored `tests/fixtures/dataset.local.json`).
  - The long ones, as `long-<name>.wav`: the 23 Oct NatGeo recording 0-70 s, the 15 Oct
    streamer's talk 60-180 s and the 20 Oct game stream 300-420 s.
- **The scripts:**
  - `check.js`: the sherpa wasm through 2.4.0's `lib/stt-offline-worker.js` (its `qitv-*` models),
    which this branch removed: run it from a checkout of 2.4.0 with that table added.
  - `ortprobe.js`: onnxruntime-web. It passes every clip into the page, so with the 10-minute
    sections in `clips/` the page runs out of memory: keep only the short clips there.
  - The live runs of small: `tests/bench/turkish-captions-bench.js --engines=turkish
    --turkish-base=URL --turkish-threads=1 --file=SECTION.wav --seconds=600 --dump=PREFIX`, with
    `--turkish-prefix`, `--turkish-final-afresh`, `--turkish-stitch`, `--turkish-stitch-final=0`
    and `--turkish-budget` for the ways of reading (the defaults are the branch's);
    `perf-score.py` turns their texts into rows.
  - `conf.js` with `conf.html` and `conf-worker.js`: the streaming conformer.
  - `native.py` and `native-conf.py`: native sherpa-onnx 2.0.1, run with `pip install
    sherpa-onnx==2.0.1 numpy soundfile`.
  - `mtprobe.js` (`--ort=DIR` for another onnxruntime-web's `dist/`), with `mt-tokens.py`
    (`pip install tokenizers`) and `mt-native.py` (`pip install onnxruntime`): the translator.
