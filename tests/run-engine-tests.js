#!/usr/bin/env node
// Renders synthetic stream audio through the real engine in Chromium and Firefox and checks
// that Limitr does what it promises. LIMITR_WORKLET=FILE runs the checks on another
// dsp-worklet.js, and LIMITR_SETTINGS=FILE on another settings.js (its presets), to try a candidate
// without touching lib/.
// Run: node tests/run-engine-tests.js [--browser=chromium|firefox]

const { chromium, firefox } = require('playwright');
const { startStaticServer } = require('./static-server');
const { streamWav } = require('./stream-audio');
const SETTINGS_FILE = require('path').resolve(process.env.LIMITR_SETTINGS || `${__dirname}/../lib/settings.js`);

const MAKEUP_CASES = [
  { threshold: -18, ratio: 6, knee: 10 },
  { threshold: -30, ratio: 12, knee: 6 },
  { threshold: -1, ratio: 20, knee: 0 },
  { threshold: -10, ratio: 20, knee: 0 },
  { threshold: -25, ratio: 10, knee: 10 },
  { threshold: -20, ratio: 3, knee: 20 },
  { threshold: -6, ratio: 4, knee: 30 }
];

// What each preset must achieve on the synthetic stream (dB above the talking level: the
// BS.1770-gated median, about 1 dB above a plain median of the talker, which includes its
// pauses; the engine's own normal is the gated upper quartile, about 1 dB higher still, so the
// numbers read about 1 dB above the pre-2.1.3 ones). Hits get 5 dB over their usual crest in
// every preset, as recorded streams need, so an alert's onset is tamed by the sustained
// readings: with Gentle's 7 dB headroom it can't come out under +7.
const PRESET_EXPECTATIONS = {
  gentle: { maxYellAbove: 9.5, maxAlertAbove: 8 },
  stream: { maxYellAbove: 6, maxAlertAbove: 5 },
  sleep: { maxYellAbove: 5.5, maxAlertAbove: 4.5 },
  movie: { maxYellAbove: 7, maxAlertAbove: 6 },
  tv90s: { maxYellAbove: 8.5, maxAlertAbove: 8.5 }
};
// How deep the guard may cut real speech (dB): untouched, except Sleep evens it a little
const SPEECH_MAX_CUT = { gentle: 0.5, stream: 1, sleep: 2, movie: 0.5, tv90s: 0.5 };

// About a minute of a streamer talking, spoken by macOS `say` (skipped where it's missing)
function realSpeech() {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const { execFileSync } = require('child_process');
  const text = 'Okay chat, welcome back! So today we are going to try the hardest level again. Last time I almost ' +
    'made it, remember? That jump at the end. Honestly, I think the timing is off. Let me check the settings real quick. ' +
    'Alright, here we go. Wait, wait, wait. Oh no. No no no. Okay, that was close. Thanks for the follows by the way, ' +
    'really appreciate you all. If I go left here, and then grab the key, maybe that works. Hmm. Interesting. Okay, so, ' +
    'the boss has three phases, and the second one is the hardest. Anyway. Drink some water, everyone. It is late, I know.';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-speech-'));
  try {
    execFileSync('say', ['-o', path.join(dir, 's.aiff'), text]);
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@48000', path.join(dir, 's.aiff'), path.join(dir, 's.wav')]);
    return fs.readFileSync(path.join(dir, 's.wav')).toString('base64');
  } catch (e) {
    return null;
  }
}
const SPEECH = realSpeech();
const TRANSPARENT_PRESETS = ['gentle', 'stream', 'movie'];

// Recorded streams, when the listener has them (they aren't in the repository): a folder named
// by LIMITR_RECORDINGS, or tests/fixtures/recordings. Each is a 48 kHz WAV. What each must get:
//   regular.wav   5 minutes of a regular Kick streamer who doesn't yell, with a game bed between
//                 phrases: the guard stays idle, the talking passes (or is evened, when louder
//                 than the preset's comfortable level)
//   yelling.wav   a 33 s clip of a streamer yelling, more than half of it, between calm talk:
//                 opened fresh, the yells held near the calm talk all the way through, the calm
//                 talk evened to the comfortable level
const RECORDINGS = {
  'regular.wav': { kind: 'regular', skip: 10, loops: 1 },
  'yelling.wav': { kind: 'yelling', skip: 5, loops: 1, yells: [[8, 9.7], [15.4, 26.4]], calm: [[14, 14.8], [27.4, 33]] }
};
function findRecordings() {
  const fs = require('fs');
  const path = require('path');
  const dir = process.env.LIMITR_RECORDINGS || path.join(__dirname, 'fixtures', 'recordings');
  const found = {};
  for (const name of Object.keys(RECORDINGS)) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) found[name] = file;
  }
  return found;
}
const RECORDING_FILES = findRecordings();

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

// Pure settings logic, no browser needed
function checkCaptionPrefs() {
  require(SETTINGS_FILE);
  const S = globalThis.LimitrSettings;
  console.log('\nCaption preferences');
  check('English browser starts on English captions', S.defaultCaptions('en-GB').language === 'en');
  check('other browsers start on automatic detection', S.defaultCaptions('tr-TR').language === 'auto');
  check('other languages use the standard model until another is chosen', S.normalizeCaptions(null, 'en').model === 'standard');
  check('choosing the faster or the larger model is kept',
    S.normalizeCaptions({ model: 'fast' }, 'en').model === 'fast' && S.normalizeCaptions({ model: 'large' }, 'en').model === 'large');
  check('a 2.1 "larger model" switch that was on carries over', S.normalizeCaptions({ largeModel: true }, 'en').model === 'large');
  check('anything else falls back to standard', S.normalizeCaptions({ model: 'huge' }, 'en').model === 'standard');
}

// Whisper sometimes "hears" the credit lines it learned from broadcast subtitles on silence or
// music. They are never live speech: drop those sentences, keep everything else.
async function checkCaptionText() {
  const { cleanText } = await import(require('url').pathToFileURL(require('path').join(__dirname, '../lib/caption-text.js')).href);
  console.log('\nCaption text');
  const gone = [
    'MİNT tarafından Sesli Betimleme Derneği\'ne yaptırılmıştır.',
    'Bu dizinin betimlemesi TRT/Karamel Film tarafından Sesli Betimleme Derneği\'ne yaptırılmıştır.',
    'Altyazı M.K.',
    'Bu dizinin betimle ilgili bir şey.',
    'Subtitles by the Amara.org community',
    'Untertitel im Auftrag des ZDF, 2017'
  ];
  const left = gone.map(t => cleanText(t, 5000)).filter(Boolean);
  check('credit lines Whisper makes up are dropped', left.length === 0, JSON.stringify(left));
  const mixed = cleanText('İyi akşamlar herkese. Bu dizinin betimlemesi TRT tarafından Sesli Betimleme Derneği\'ne yaptırılmıştır.', 5000);
  check('...but the real sentence next to one stays', mixed === 'İyi akşamlar herkese.', mixed);
  const real = ['Bu gece yayını izlediğiniz için teşekkürler.', 'Sesli kitap dinlemeyi seviyorum.', 'Thanks for the subscription!'];
  const kept = real.map(t => cleanText(t, 5000));
  check('real speech that only sounds similar is kept', kept.every((t, i) => t === real[i]), JSON.stringify(kept));
}

// Live captions from a whole-utterance model: the sentence is decoded again from a little before
// its last committed word, and a word is committed once two decodes in a row agree on it
async function checkLiveAgreement() {
  const { LiveAgreement, wordsOf } = await import(require('url').pathToFileURL(require('path').join(__dirname, '../lib/live-agreement.js')).href);
  console.log('\nLive agreement (Turkish live captions)');
  // A decode result as sherpa-onnx gives it: word pieces (a leading space starts a word), their
  // start times from the start of the decoded audio, and log-probabilities (sure, unless given)
  const decode = (pieces, offset = 0) => ({
    tokens: pieces.map(([t]) => t),
    timestamps: pieces.map(([, at]) => at - offset),
    ys_log_probs: pieces.map(([, , logProb = 0]) => logProb)
  });
  const words = wordsOf(decode([[' İ', 0], ['yi', 0.08], [' ak', 0.4], ['şamlar', 0.56], [' her', 1.1], ['kese', 1.3], [',', 1.7]]), 0);
  check('word pieces make words, punctuation joins the word before', words.map(w => w.text).join('|') === 'İyi|akşamlar|herkese,' &&
    words[1].start === 0.4 && Math.abs(words[1].end - 0.72) < 1e-9, JSON.stringify(words));

  // The model is often unsure of the punctuation after a word ("herkese." at 59%, its letters at
  // 100%): that is no doubt about the word
  const sure = wordsOf({ tokens: [' İ', 'yi', ' ak', 'şamlar', '.'], timestamps: [0, 0.08, 0.4, 0.56, 0.7], ys_log_probs: [-0.01, -0.3, -0.02, -0.05, -0.9] });
  check('each word carries how sure the model was of its letters (its least sure piece)', sure.map(w => w.logProb).join('|') === '-0.3|-0.05', JSON.stringify(sure));

  const live = new LiveAgreement({ contextSeconds: 1, maxPendingSeconds: 6 });
  let out = live.update(decode([[' İyi', 0], [' akşamlar', 0.4], [' her', 1.1]]), 0, 1.4, false);
  check('a first decode commits nothing, but shows its words', live.committed.length === 0 && out.line === 'İyi akşamlar her', JSON.stringify(out));
  out = live.update(decode([[' İyi', 0], [' akşamlar', 0.4], [' herkese', 1.1], [',', 1.5], [' yayına', 1.8]]), 0, 2.2, false);
  check('words two decodes agree on are committed; the rest stays open',
    live.committed.map(w => w.text).join(' ') === 'İyi akşamlar' && out.line === 'İyi akşamlar herkese yayına', JSON.stringify(out));
  // The next decode starts with a second of what is already committed (here, all of it)
  const from = live.windowStart();
  out = live.update(decode([[' akşamlar', 0.4], [' herkese', 1.1], [',', 1.5], [' yayına', 1.8], [' hoş', 2.3], [' geldiniz', 2.6], ['.', 3.1],
    [' Bugün', 3.4]], from), from, 3.6, false);
  check('the context is not committed twice', live.committed.map(w => w.text).join(' ') === 'İyi akşamlar herkese, yayına', JSON.stringify(live.committed.map(w => w.text)));
  out = live.update(decode([[' yayına', 1.8], [' hoş', 2.3], [' geldiniz', 2.6], ['.', 3.1], [' Bugün', 3.4], [' yeni', 3.8]], live.windowStart()),
    live.windowStart(), 4.0, false);
  check('a finished sentence comes out as a line of its own', out.done.length === 1 && out.done[0] === 'İyi akşamlar herkese, yayına hoş geldiniz.' &&
    out.line === 'Bugün yeni', JSON.stringify(out));
  out = live.update(decode([[' Bugün', 3.4], [' yeni', 3.8], [' oyunu', 4.1]], live.windowStart()), live.windowStart(), 4.6, true);
  check('the end of the sentence commits the rest and closes the line', out.done.join('|') === 'Bugün yeni oyunu' && out.line === '', JSON.stringify(out));

  // Decodes that never agree (music, crosstalk) still move on: the older words are committed
  const noisy = new LiveAgreement({ contextSeconds: 1, maxPendingSeconds: 4 });
  for (let t = 1; t <= 8; t++) {
    const pieces = [];
    for (let k = 0; k < t * 2; k++) pieces.push([` w${k}${t % 2 ? 'a' : 'b'}`, k * 0.5]);
    out = noisy.update(decode(pieces), 0, t, false);
  }
  const lastCommitted = noisy.committed[noisy.committed.length - 1];
  check('without agreement for too long, the older words are committed', noisy.committed.length > 0 && lastCommitted.end <= 8 - 2 + 0.5,
    `${noisy.committed.length} committed, up to ${lastCommitted && lastCommitted.end} s`);

  // The next decode starts at least a context before the last committed word ends, in the pause
  // before a word: cut inside one, the model hears half a word and makes up others around it
  const context = new LiveAgreement({ contextSeconds: 1.5 });
  const greeting = [[' İ', 0], ['yi', 0.08], [' ak', 0.4], ['şamlar', 0.56], [' her', 1.1], ['kese', 1.3], [' ya', 1.8]];
  context.update(decode(greeting), 0, 2, false);
  context.update(decode(greeting), 0, 2.5, false);
  check('the next decode starts in the pause before a word, a context before the last committed one ends',
    context.committed.map(w => w.text).join(' ') === 'İyi akşamlar herkese ya' && Math.abs(context.windowStart() - 0.24) < 1e-9,
    `${context.committed.map(w => w.text).join(' ')}; from ${context.windowStart()}`);

  // A word one decode missed is kept when the next ones hear it: the word before it ends where it is
  // spoken, not where the next word that decode heard starts
  const missed = new LiveAgreement({ contextSeconds: 1 });
  missed.update(decode([[' tut', 0], ['tum', 0.2], [' kobra', 0.6], [' ken', 1.0], ['di', 1.2]]), 0, 1.6, false);
  missed.update(decode([[' tut', 0], ['tum', 0.2], [' ken', 1.0], ['di', 1.2], [' yük', 1.6]]), 0, 2.1, false);
  const heard = [[' tut', 0], ['tum', 0.2], [' kobra', 0.6], [' ken', 1.0], ['di', 1.2], [' yük', 1.6], ['selirse', 1.9]];
  missed.update(decode(heard), 0, 2.6, false);
  missed.update(decode(heard), 0, 3.1, false);
  check('a word one decode missed is kept when the next ones hear it', missed.committed.map(w => w.text).join(' ') === 'tuttum kobra kendi yükselirse',
    missed.committed.map(w => w.text).join(' '));

  // Nothing new for a long while (music under a pause the segmenter took for speech): the window
  // moves on instead of growing with the sentence
  const quiet = new LiveAgreement({ contextSeconds: 1, maxPendingSeconds: 6 });
  quiet.update(decode([[' yol', 0.2], [' çekilsin', 0.6]]), 0, 1, false);
  quiet.update(decode([[' yol', 0.2], [' çekilsin', 0.6]]), 0, 1.5, false);
  for (let now = 2; now <= 30; now += 0.5) quiet.update(decode([]), quiet.windowStart(), now, false);
  check('with nothing new for a long while, the window still moves on', 30 - quiet.windowStart() <= 6 + 1 + 0.5,
    `the decode at 30 s would start at ${quiet.windowStart().toFixed(2)} s`);

  // The words in doubt show only while the model is sure of them (each piece at least 90%), so a
  // guess doesn't flicker on screen; agreed words always show
  const doubt = new LiveAgreement();
  const guess = [[' bol', 0, -0.01], [' su', 0.3, -0.02], [' iç', 0.6, -0.01], ['in', 0.7, -0.5], [' ve', 1.0, -0.01]];
  out = doubt.update(decode(guess), 0, 1.3, false);
  check('of the words in doubt, only those before the first unsure one show', out.line === 'bol su', JSON.stringify(out));
  out = doubt.update(decode(guess), 0, 1.8, false);
  check('agreed words show however unsure', out.line === 'bol su için ve', JSON.stringify(out));

  // A long stretch without a full stop doesn't fill the picture: once a line has run 4 s it ends at
  // the next pause (0.3 s or more), and past 8 s at the next word. The words after where it will
  // end wait for the next line rather than show at the end of this one and then move down.
  const words4 = (from, to, step, name) => {
    const list = [];
    for (let k = 0; from + k * step <= to + 1e-9; k++) list.push([` ${name}${k}`, Number((from + k * step).toFixed(2))]);
    return list;
  };
  const text = list => list.map(([w]) => w.trim()).join(' ');
  const paused = new LiveAgreement({ contextSeconds: 1, maxPendingSeconds: 20 });
  const before = words4(0, 5, 0.25, 'a');          // 0.09 s between words
  const after = words4(5.6, 6.1, 0.25, 'b');       // after a 0.44 s pause
  out = paused.update(decode([...before, ...after]), 0, 6.4, false);
  check('once a line has run 4 s, the words after a pause wait for the next line', out.done.length === 0 && out.line === text(before),
    JSON.stringify(out));
  out = paused.update(decode([...before, ...after]), 0, 6.9, false);
  check('and the line ends at that pause', out.done.length === 1 && out.done[0] === text(before) && out.line === text(after), JSON.stringify(out));

  const nonstop = new LiveAgreement({ contextSeconds: 1, maxPendingSeconds: 20 });
  const talk = words4(0, 10, 0.25, 'k');
  out = nonstop.update(decode(talk), 0, 10.4, false);
  check('past 8 s without a pause, the words from 8 s wait for the next line', out.line === text(talk.filter(([, t]) => t < 8)), JSON.stringify(out));
  out = nonstop.update(decode(talk), 0, 10.9, false);
  check('and the line ends there', out.done.length === 1 && out.done[0] === text(talk.filter(([, t]) => t < 8)) &&
    out.line === text(talk.filter(([, t]) => t >= 8)), JSON.stringify(out));

  // A full stop still in doubt holds back what follows it too, and shows once committed (the model
  // often puts one in and takes it out again)
  const stop = new LiveAgreement();
  out = stop.update(decode([[' hoş', 0], [' geldiniz', 0.3], ['.', 0.7], [' Bugün', 1.0]]), 0, 1.3, false);
  check('the words after a full stop in doubt wait for the next line', out.line === 'hoş geldiniz', JSON.stringify(out));
  out = stop.update(decode([[' hoş', 0], [' geldiniz', 0.3], ['.', 0.7], [' Bugün', 1.0]]), 0, 1.8, false);
  check('punctuation shows once its word is committed', out.done.join('|') === 'hoş geldiniz.' && out.line === 'Bugün', JSON.stringify(out));
}

// The captions resampler (lib/transcriber-capture-worklet.js) run in Node: speech passes, and
// content above 8 kHz must not fold back into the speech band when going down to 16 kHz
function checkCaptionResampler() {
  const vm = require('vm');
  const source = require('fs').readFileSync(require('path').join(__dirname, '../lib/transcriber-capture-worklet.js'), 'utf8');
  const through = (rate, freq, seconds = 2) => {
    const sandbox = { sampleRate: rate, Math, Float32Array, Float64Array, chunks: [] };
    sandbox.AudioWorkletProcessor = class { constructor() { this.port = { postMessage: m => sandbox.chunks.push(m.audio) }; } };
    sandbox.registerProcessor = (name, cls) => { sandbox.Processor = cls; };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    const processor = new sandbox.Processor();
    const total = Math.round(seconds * rate);
    for (let start = 0; start < total; start += 128) {
      const block = new Float32Array(128);
      for (let i = 0; i < 128; i++) block[i] = Math.sin(2 * Math.PI * freq * (start + i) / rate);
      processor.process([[block, block]]);
    }
    const out = new Float32Array(sandbox.chunks.length * 8000);
    sandbox.chunks.forEach((c, i) => out.set(c, i * 8000));
    return out;
  };
  // Level (dB re the input tone) at one frequency of the 16 kHz output, skipping the start
  const levelAt = (x, freq) => {
    const w = 2 * Math.PI * freq / 16000;
    let s1 = 0, s2 = 0;
    const from = Math.floor(x.length / 4);
    for (let i = from; i < x.length; i++) { const v = x[i] + 2 * Math.cos(w) * s1 - s2; s2 = s1; s1 = v; }
    const re = s1 - s2 * Math.cos(w), im = s2 * Math.sin(w);
    return 20 * Math.log10(2 * Math.hypot(re, im) / (x.length - from) + 1e-12);
  };
  console.log('\nCaptions resampler (to 16 kHz)');
  for (const rate of [48000, 44100]) {
    const pass = [1000, 6000].map(f => levelAt(through(rate, f), f));
    check(`${rate / 1000} kHz: speech passes (1 and 6 kHz)`, Math.abs(pass[0]) <= 0.5 && Math.abs(pass[1]) <= 1,
      pass.map(v => `${v.toFixed(1)} dB`).join(', '));
    const folded = [9000, 10000, 12000, 14000].map(f => ({ f, level: levelAt(through(rate, f), 16000 - f) }));
    const worst = folded.reduce((a, b) => (b.level > a.level ? b : a));
    check(`${rate / 1000} kHz: 9 to 14 kHz don't fold into the speech band (under -40 dB)`, worst.level <= -40,
      folded.map(x => `${x.f / 1000}k ${x.level.toFixed(1)}`).join(', '));
  }
}

// Upgrading from 1.x keeps the listener's tone and extras on top of the default preset
async function checkLegacyUpgrade() {
  const S = globalThis.LimitrSettings;
  console.log('\nUpgrade from 1.x');
  const area = {
    get: async () => ({
      limitrCurrentSettings: {
        outputGain: -3, monoMixEnabled: true, noiseSuppressionEnabled: true,
        eqEnabled: true, eq3Gain: 4, eq3Freq: 1200, filtersEnabled: true, bassCutFreq: 80,
        effectsEnabled: true, noiseLevel: 0.02, noiseType: 'pink',
        limiterEnabled: true, limiterThreshold: -6
      }
    })
  };
  const { settings, preset } = await S.load(area);
  const base = S.PRESETS[S.DEFAULT_PRESET].settings;
  check('volume carries over', settings.volume === -3);
  check('tone, EQ, mono, noise removal and tape hiss carry over',
    settings.toneEnabled && settings.eq3Gain === 4 && settings.eq3Freq === 1200 && settings.lowCut === 80 &&
    settings.monoEnabled && settings.denoiseEnabled && settings.noiseLevel === 0.02 && settings.noiseType === 'pink',
    JSON.stringify({ tone: settings.toneEnabled, eq3: [settings.eq3Gain, settings.eq3Freq], lowCut: settings.lowCut,
      mono: settings.monoEnabled, denoise: settings.denoiseEnabled, hiss: [settings.noiseLevel, settings.noiseType] }));
  check('the old limiter value (a compressor with hidden boost) is not reused as the ceiling',
    settings.limiterCeiling === base.limiterCeiling, `${settings.limiterCeiling} vs ${base.limiterCeiling}`);
  check('the spike guard comes from the default preset', settings.guardHeadroom === base.guardHeadroom && settings.guardEnabled);
  check('changed tone means no preset is shown as selected', preset === null, String(preset));
}

// 2.0 settings: the guard and comfortable level work differently now, so they come from the preset
async function checkUpgradeFrom20() {
  const S = globalThis.LimitrSettings;
  console.log('\nUpgrade from 2.0');
  const old = {
    volume: -4, guardEnabled: true, guardHeadroom: 5, guardCeiling: -16, guardRatio: 12, guardAttack: 3,
    guardHold: 200, guardRelease: 1000, levelEnabled: false, levelTarget: -24, levelMaxBoost: 6,
    toneEnabled: true, eq2Gain: 3
  };
  const area = { get: async () => ({ limitrSettings: old, limitrPreset: 'stream' }) };
  const { settings } = await S.load(area);
  const stream = S.PRESETS.stream.settings;
  check('the guard and comfortable level come from the preset',
    settings.guardMemory === stream.guardMemory && settings.levelEnabled === stream.levelEnabled &&
    settings.levelTarget === stream.levelTarget && settings.guardHeadroom === stream.guardHeadroom,
    JSON.stringify({ memory: settings.guardMemory, level: settings.levelEnabled, target: settings.levelTarget }));
  check('volume and tone stay', settings.volume === -4 && settings.toneEnabled && settings.eq2Gain === 3);
}

// 2.1 settings have no harsh-sound stage: it comes from the preset they were on, which stays shown
async function checkUpgradeFrom21() {
  const S = globalThis.LimitrSettings;
  console.log('\nUpgrade from 2.1');
  for (const [preset, expected] of [['stream', true], ['sleep', true], ['gentle', false], [null, false]]) {
    const old = { ...S.applyPreset({ volume: -3 }, preset || 'stream'), guardHeadroom: preset ? S.PRESETS[preset].settings.guardHeadroom : 9 };
    delete old.deharshEnabled;
    delete old.deharshMaxCut;
    const { settings, preset: shown } = await S.load({ get: async () => ({ limitrSettings: old, limitrPreset: preset }) });
    check(`${preset || 'own settings'}: harsh sound ${expected ? 'on' : 'off'}${preset ? `, still shown as ${preset}` : ''}`,
      settings.deharshEnabled === expected && settings.volume === -3 && (!preset || S.matchPreset(settings) === preset),
      JSON.stringify({ deharsh: settings.deharshEnabled, shown, matches: S.matchPreset(settings) }));
  }
}

// 2.2 settings have no raised-voice stage or room for speech: they come from the preset they were
// on, which stays shown; Sleep no longer lifts quiet streams, unless the listener set the lift
async function checkUpgradeFrom22() {
  const S = globalThis.LimitrSettings;
  console.log('\nUpgrade from 2.2');
  const RAISED_KEYS = ['shoutEnabled', 'shoutAllow', 'shoutMaxCut', 'speechRoomDb', 'speechRoomLevelDb', 'speechRoomFade'];
  for (const [preset, expected, lift] of [['stream', true, 0], ['sleep', true, 6], ['sleep', true, 3], ['gentle', false, 0], [null, false, 0]]) {
    const old = { ...S.applyPreset({ volume: -3 }, preset || 'stream'), levelMaxBoost: lift };
    if (!preset) old.guardHeadroom = 9;
    for (const key of RAISED_KEYS) delete old[key];
    const { settings } = await S.load({ get: async () => ({ limitrSettings: old, limitrPreset: preset }) });
    const fresh = preset ? { ...S.DEFAULTS, ...S.PRESETS[preset].settings } : S.DEFAULTS;
    const raised = RAISED_KEYS.every(key => settings[key] === fresh[key]);
    // Sleep's 2.2 lift (6 dB) is the preset's, now none; one the listener chose stays
    const keptLift = preset === 'sleep' && lift === 6 ? fresh.levelMaxBoost : lift;
    const shown = preset && lift === (preset === 'sleep' ? 6 : 0) ? preset : null;
    check(`${preset || 'own settings'}${preset === 'sleep' ? ` lifting ${lift} dB` : ''}: raised voice ${expected ? 'on' : 'off'}, lift ${keptLift} dB${shown ? `, still shown as ${preset}` : ''}`,
      raised && settings.shoutEnabled === expected && settings.levelMaxBoost === keptLift && settings.volume === -3 &&
      (!shown || S.matchPreset(settings) === shown),
      JSON.stringify({ shout: settings.shoutEnabled, room: settings.speechRoomDb, fade: settings.speechRoomFade, lift: settings.levelMaxBoost, matches: S.matchPreset(settings) }));
  }
}

// 2.3 settings don't say where a new stream starts or what counts as strained: that comes from the
// preset they were on, which stays shown (the defaults for the listener's own settings)
async function checkUpgradeFrom23() {
  const S = globalThis.LimitrSettings;
  console.log('\nUpgrade from 2.3');
  const BELIEF_KEYS = ['guardStartUnder', 'strainedDb', 'strainRaisedDb', 'strainMemory'];
  for (const [preset, under] of [['sleep', 3], ['stream', 0], [null, 0]]) {
    const old = S.applyPreset({ volume: -3 }, preset || 'sleep');
    if (!preset) old.guardHeadroom = 9;
    for (const key of BELIEF_KEYS) delete old[key];
    const { settings } = await S.load({ get: async () => ({ limitrSettings: old, limitrPreset: preset }) });
    const fresh = { ...S.DEFAULTS, ...(preset ? S.PRESETS[preset].settings : {}) };
    check(`${preset || 'own settings'}: a new stream starts ${under} dB under the comfortable level${preset ? `, still shown as ${preset}` : ''}`,
      BELIEF_KEYS.every(key => settings[key] === fresh[key]) && settings.guardStartUnder === under && settings.volume === -3 &&
      (!preset || S.matchPreset(settings) === preset),
      JSON.stringify({ under: settings.guardStartUnder, strained: settings.strainedDb, memory: settings.strainMemory, matches: S.matchPreset(settings) }));
  }
}

async function runIn(browserType, port) {
  // Offline rendering needs neither the GPU nor the speakers
  // Off the GPU and silent. Chromium: fake audio output device, so the speakers are never opened.
  // Firefox: volume scaled to zero (a null audio device would stop real-time Web Audio running).
  const browser = await browserType.launch(browserType.name() === 'chromium'
    ? { args: ['--disable-gpu', '--disable-audio-output', '--js-flags=--expose-gc'] }
    : { firefoxUserPrefs: { 'media.volume_scale': '0.0' } });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('  page error:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('  console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/tests/engine-bench.html`);
  await page.waitForFunction(() => window.benchReady === true);
  console.log(`\n=== ${browserType.name()} — ${await page.evaluate(() => bench.userAgent())}`);

  console.log('\nDynamicsCompressorNode hidden makeup gain vs compensation formula');
  for (const r of await page.evaluate(c => bench.makeupCases(c), MAKEUP_CASES)) {
    const err = Math.abs(r.measuredDb - r.formulaDb);
    check(`${r.threshold} dB / ${r.ratio}:1 / knee ${r.knee}: measured +${r.measuredDb} dB, formula +${r.formulaDb} dB`, err < 0.05);
  }

  console.log('\nCompressor with compensation leaves quiet audio at unity');
  const comp = await page.evaluate(() => bench.compensatedCompressor());
  check(`gain on -60 dBFS tone = ${comp.gainDb} dB`, Math.abs(comp.gainDb) < 0.1);

  console.log('\nBrickwall limiter (+8 dBFS bursts)');
  for (const ceiling of [-1, -3, -6]) {
    const r = await page.evaluate(c => bench.limiterCeiling(c), ceiling);
    check(`ceiling ${ceiling} dBFS → output peak ${r.outputPeakDbfs} dBFS`, r.outputPeakDbfs <= ceiling + 0.01);
  }
  const fb = await page.evaluate(() => bench.limiterCeiling(-1, true));
  check(`native fallback limiter (worklets blocked) → peak ${fb.outputPeakDbfs} dBFS`, fb.dsp === 'fallback' && fb.outputPeakDbfs <= 1.5);

  // Pages that block AudioWorklets get native compressors, whose times only go up to 1 s
  const rangeWarnings = [];
  const onWarning = m => { if (m.type() === 'warning' && /range|clamp/i.test(m.text())) rangeWarnings.push(m.text()); };
  page.on('console', onWarning);
  for (const id of await page.evaluate(() => bench.presetIds())) {
    await page.evaluate(p => bench.scenario(p, {}, { failWorklets: true }), id);
  }
  page.off('console', onWarning);
  check('native fallback: every preset fits the browser\'s compressor ranges', rangeWarnings.length === 0,
    rangeWarnings.slice(0, 2).join(' | '));

  console.log('\nTransparency');
  const bypass = await page.evaluate(() => bench.bypassExact());
  check(`disabled = bit-exact passthrough (max diff ${bypass.maxDiff})`, bypass.maxDiff === 0);
  const off = await page.evaluate(() => bench.offTransparent());
  check(`"Off" preset = pure delay (${off.latencyMs} ms latency, max diff ${off.maxDiff.toExponential(2)})`, off.maxDiff < 1e-6 && off.latencyMs <= 25);

  console.log('\nSpike guard on a synthetic stream (talking at -24 LUFS, yell +14, alert +16, clap +12)');
  const rows = [];
  for (const id of await page.evaluate(() => bench.presetIds())) {
    if (id === 'off') continue;
    const r = await page.evaluate(p => bench.scenario(p), id);
    rows.push(r);
    const exp = PRESET_EXPECTATIONS[id];
    console.log(`  ${id.padEnd(7)} normal ${r.normalInLufs}→${r.normalOutLufs} LUFS (gain ${r.normalGainDb} dB) | ` +
      `yell +${r.events.yell.inAboveNormal}→+${r.events.yell.outAboveNormal} | ` +
      `alert +${r.events.alert.inAboveNormal}→+${r.events.alert.outAboveNormal} | ` +
      `clap +${r.events.clap.inAboveNormal}→+${r.events.clap.outAboveNormal} | ` +
      `recovery ${r.recoverySeconds}s | peak ${r.outputPeakDbfs} dBFS`);
    if (exp) {
      check(`${id}: yell held to ≤ +${exp.maxYellAbove} dB over normal`, r.events.yell.outAboveNormal <= exp.maxYellAbove);
      check(`${id}: alert held to ≤ +${exp.maxAlertAbove} dB over normal`, r.events.alert.outAboveNormal <= exp.maxAlertAbove);
    }
    if (TRANSPARENT_PRESETS.includes(id)) {
      check(`${id}: normal talking untouched (|gain| ≤ 0.5 dB)`, Math.abs(r.normalGainDb) <= 0.5);
      check(`${id}: recovers within 3 s after the yell`, r.recoverySeconds !== null && r.recoverySeconds <= 3);
    }
  }

  console.log('\nSpike guard at real source levels (YouTube plays near -14 LUFS, loud streams near -10)');
  const LEVELS = [-36, -30, -24, -18, -14, -10];
  const sweep = async (id, overrides = {}) => {
    const rows = [];
    for (const level of LEVELS) {
      rows.push({ level, ...(await page.evaluate(([p, o, l]) => bench.scenario(p, o, { sourceDb: l }), [id, overrides, level])) });
    }
    return rows;
  };
  const perLevel = (rows, pick) => rows.map(r => `${r.level}: ${pick(r)}`).join(', ');
  for (const id of ['gentle', 'stream', 'movie', 'tv90s']) {
    const exp = PRESET_EXPECTATIONS[id];
    const comfortable = globalThis.LimitrSettings.PRESETS[id].settings.levelTarget;
    const rows = await sweep(id);
    if (id !== 'tv90s') {
      // 90s TV's own compressor shapes loud sources on purpose; the guard must still stay idle
      const quieter = rows.filter(r => r.level <= comfortable - 6);
      check(`${id}: streams quieter than ${comfortable} LUFS are untouched`, quieter.every(r => Math.abs(r.normalGainDb) <= 0.5),
        perLevel(quieter, r => r.normalGainDb));
      const louder = rows.filter(r => r.level >= comfortable + 4);
      if (louder.length) {
        const outs = louder.map(r => r.normalOutLufs);
        check(`${id}: louder streams come out at the comfortable level`,
          outs.every(v => v <= comfortable + 0.5 && v >= comfortable - 3) && Math.max(...outs) - Math.min(...outs) <= 1.5,
          perLevel(louder, r => r.normalOutLufs));
      }
    }
    check(`${id}: guard idle during plain talking at every level`, rows.every(r => r.guardBusy <= 0.1),
      perLevel(rows, r => r.guardBusy));
    check(`${id}: yell and alert held at every level`,
      rows.every(r => r.events.yell.outAboveNormal <= exp.maxYellAbove && r.events.alert.outAboveNormal <= exp.maxAlertAbove),
      perLevel(rows, r => `${r.events.yell.outAboveNormal}/${r.events.alert.outAboveNormal}`));
    if (id !== 'tv90s') {
      // The clap is short and may stay under the counter's 3 dB; the yell and the alert must count
      check(`${id}: counts the yell and the alert at every level`, rows.every(r => r.spikes >= 2 && r.spikes <= 3),
        perLevel(rows, r => r.spikes));
      // What the guard caught as a spike isn't counted again when the raised voice cuts it too
      check(`${id}: the spikes aren't counted again as raised voices`, rows.every(r => r.raisedVoices === 0),
        perLevel(rows, r => r.raisedVoices));
    }
    check(`${id}: alert onset doesn't slip through the lookahead`, rows.every(r => r.alertOnsetLeakDb <= 1),
      perLevel(rows, r => r.alertOnsetLeakDb));
  }

  console.log('\nSleep: every stream at one comfortable level, quiet ones left as they are, spikes held');
  const sleepRows = await sweep('sleep');
  const sleepTarget = (await page.evaluate(() => bench.scenario('sleep'))).normalOutLufs;
  check('sleep: -24 to -10 sources all come out at the same level',
    sleepRows.filter(r => r.level >= -24).every(r => Math.abs(r.normalOutLufs - sleepTarget) <= 1.5),
    perLevel(sleepRows, r => r.normalOutLufs));
  // Sleep never lifts a quiet stream (louds come down, quiet ones aren't brought up)
  const quiet = sleepRows.find(r => r.level === -36);
  check('sleep: a quiet stream is left as it is, not lifted', Math.abs(quiet.normalGainDb) <= 0.5,
    `${quiet.normalGainDb >= 0 ? '+' : ''}${quiet.normalGainDb} dB`);
  check('sleep: yell and alert held at every level',
    sleepRows.every(r => r.events.yell.outAboveNormal <= PRESET_EXPECTATIONS.sleep.maxYellAbove &&
      r.events.alert.outAboveNormal <= PRESET_EXPECTATIONS.sleep.maxAlertAbove),
    perLevel(sleepRows, r => `${r.events.yell.outAboveNormal}/${r.events.alert.outAboveNormal}`));
  check('sleep: counts the yell and the alert at every level', sleepRows.every(r => r.spikes >= 2 && r.spikes <= 3),
    perLevel(sleepRows, r => r.spikes));
  check("sleep: the spikes aren't counted again as raised voices", sleepRows.every(r => r.raisedVoices === 0),
    perLevel(sleepRows, r => r.raisedVoices));
  check('sleep: guard idle during plain talking at every level', sleepRows.every(r => r.guardBusy <= 0.1),
    perLevel(sleepRows, r => r.guardBusy));

  console.log('\nA loud stretch stays tamed for as long as the preset remembers normal');
  for (const [id, holdsFor15] of [['gentle', false], ['movie', true], ['stream', true], ['sleep', true]]) {
    const limit = PRESET_EXPECTATIONS[id].maxYellAbove;
    for (const sourceDb of [-30, -14]) {
      const r = await page.evaluate(([p, l]) => bench.sustained(p, { sourceDb: l }), [id, sourceDb]);
      const ok = r.at8 <= limit + 1 && (!holdsFor15 || r.at15 <= limit + 1);
      check(`${id} at ${sourceDb} LUFS: 20 s of yelling (+${r.inAbove} dB) held${holdsFor15 ? ' 15 s in' : ' 8 s in'}`, ok,
        `+${r.at8} dB at 8 s, +${r.at15} dB at 15 s`);
    }
  }

  console.log('\nA boom: the mic or the music turned up over 5 s, on purpose, and kept there');
  for (const [id, holdsFor15] of [['gentle', false], ['movie', true], ['stream', true], ['sleep', true]]) {
    const limit = PRESET_EXPECTATIONS[id].maxYellAbove;
    for (const sourceDb of [-30, -14]) {
      const r = await page.evaluate(([p, l]) => bench.boom(p, { sourceDb: l }), [id, sourceDb]);
      check(`${id} at ${sourceDb} LUFS: a boom (+${r.inAbove} dB) held to +${limit} dB${holdsFor15 ? ' 15 s in' : ' 8 s in'}`,
        r.at8 <= limit && (!holdsFor15 || r.at15 <= limit), `+${r.at8} dB at 8 s, +${r.at15} dB at 15 s`);
    }
  }

  // A big rise after minutes of talk (a song or an alert 15 dB up) is no voice arriving after a
  // setup (that is 20 dB and more): it stays held for as long as the preset remembers normal
  console.log('\nA song or an alert 15 dB up for 15 s, after two and a half minutes of talk');
  for (const id of ['movie', 'stream', 'sleep']) {
    const limit = PRESET_EXPECTATIONS[id].maxYellAbove;
    const r = await page.evaluate(p => bench.boom(p, { boomDb: 15, rampSeconds: 0.5, seconds: 15, talkSeconds: 150 }), id);
    check(`${id}: held to +${limit} dB 8 s in`, r.at8 <= limit, `+${r.inAbove} dB in, +${r.at8} dB at 8 s`);
  }

  // Gentle takes yelling for the stream's level once it fills a quarter of its familiar minute
  // (four times its 15 s memory), so it holds the fits of the first 25 s only
  console.log('\nA streamer who keeps yelling, from the stream\'s first seconds');
  for (const id of ['gentle', 'movie', 'stream', 'sleep']) {
    const limit = PRESET_EXPECTATIONS[id].maxYellAbove;
    const fits = await page.evaluate(p => bench.yellingFits(p), id);
    const held = fits.filter(f => id !== 'gentle' || f.at < 25);
    check(`${id}: ${id === 'gentle' ? 'the fits of the first 25 s' : 'every fit of yelling'} held to +${limit} dB over the calm talk`,
      held.every(f => f.outAbove <= limit), fits.map(f => `${f.at}s +${f.inAbove}→+${f.outAbove}`).join(', '));
  }

  // Stream and Sleep take the edge off harsh sound while it lasts (against the same preset with
  // it switched off) and leave the talk's tone alone; Gentle leaves both as they are
  console.log('\nHarsh sound: a crowd or a cymbal-heavy song, as loud as the talk');
  for (const [id, sourceDb] of [['stream', -30], ['stream', -14], ['sleep', -24]]) {
    const on = await page.evaluate(([p, l]) => bench.harshParts(p, { sourceDb: l }), [id, sourceDb]);
    const off = await page.evaluate(([p, l]) => bench.harshParts(p, { sourceDb: l, overrides: { deharshEnabled: false } }), [id, sourceDb]);
    const softened = on.parts.map((p, k) => +(off.parts[k].edgeOut - p.edgeOut).toFixed(1));
    check(`${id} at ${sourceDb} LUFS: each harsh part's edge (2-8 kHz) comes out at least 4 dB softer`,
      on.dsp === 'worklet' && softened.every(d => d >= 4), `${softened.join(', ')} dB; meters showed ${on.harshDb} dB`);
    check(`${id} at ${sourceDb} LUFS: the talk's tone moves at most 0.3 dB`,
      Math.abs(on.talkOut - off.talkOut) <= 0.3 && Math.abs(on.talkEdgeOut - off.talkEdgeOut) <= 0.3,
      `balance ${off.talkOut} → ${on.talkOut} dB, edge ${off.talkEdgeOut} → ${on.talkEdgeOut} dB`);
  }
  const gentle = await page.evaluate(() => bench.harshParts('gentle'));
  check('gentle: harsh sound is left as it is', gentle.parts.every(p => Math.abs(p.out - p.in) <= 0.5) && gentle.harshDb === 0,
    gentle.parts.map(p => `${p.in}→${p.out}`).join(', '));

  if (SPEECH) {
    console.log('\nReal speech (macOS say) is left alone');
    for (const id of ['gentle', 'stream', 'sleep', 'movie', 'tv90s']) {
      const cuts = [];
      for (const level of [-30, -14]) cuts.push({ level, ...(await page.evaluate(([p, w, l]) => bench.speechCut(p, w, l), [id, SPEECH, level])) });
      check(`${id}: real speech cut at most ${SPEECH_MAX_CUT[id]} dB at quiet and loud levels`,
        cuts.every(c => -c.deepest <= SPEECH_MAX_CUT[id]), cuts.map(c => `${c.level}: ${c.deepest.toFixed(1)} dB`).join(', '));
    }
  }

  console.log('\nA stream that starts quiet, then plays normally');
  for (const id of ['gentle', 'stream', 'movie', 'sleep']) {
    const r = await page.evaluate(p => bench.quietStart(p), id);
    check(`${id}: normal talking after a quiet start isn't treated as a loud stretch`, r.guardBusy <= 0.1,
      `cutting >1 dB ${Math.round(r.guardBusy * 100)}% of the time, deepest ${r.deepest} dB`);
  }

  console.log('\nA stream that opens on 10 s of room noise, then talking');
  for (const id of ['gentle', 'stream', 'movie', 'sleep']) {
    const r = await page.evaluate(p => bench.silentStart(p), id);
    check(`${id}: the room noise isn't taken for normal, so the voice is cut at most while it is learned (1.5 s)`,
      r.cutForSeconds <= 1.5 && r.deepestAfter >= -3, `cut >3 dB for ${r.cutForSeconds} s, deepest ${r.deepestAfter} dB after 1.5 s`);
  }

  // A stream's first seconds aren't trusted: calm talk is believed at its own level at once, a yell
  // only over time. Today's engine (2.3) took a yell at the start for normal, and held the talk
  // after it about 8-10 dB down; without the raised-voice gate, a quiet bright sound at the start
  // read as strain and held the talk after it on Sleep.
  console.log('\nA stream that opens loud: on calm talk, mid-yell, or after a quiet bright sound');
  for (const id of ['stream', 'sleep']) {
    const calm = await page.evaluate(p => bench.opening(p, { kind: 'calm' }), id);
    check(`${id}: calm talk opening a stream isn't held (at most 1 dB under where it settles)`,
      calm.talkAbove >= -1 && calm.laterAbove >= -1, JSON.stringify(calm));
    const yell = await page.evaluate(p => bench.opening(p, { kind: 'yell' }), id);
    check(`${id}: a strained yell opening a stream is held (its first 3 s at most 3.5 dB over the talk's level)`,
      yell.yellAbove <= 3.5, JSON.stringify(yell));
    check(`${id}: the talk after it isn't held down as the yell's level (at most 5.5 dB under where it settles)`,
      yell.talkAbove >= -5.5 && yell.laterAbove >= -5.5, JSON.stringify(yell));
    const bright = await page.evaluate(p => bench.opening(p, { kind: 'bright' }), id);
    check(`${id}: a quiet bright sound at the start isn't taken for strain (the talk after it at most 1 dB under where it settles${id === 'sleep' ? '' : ', from 4 s in'})`,
      bright.laterAbove >= -1 && (id !== 'sleep' || bright.talkAbove >= -1), JSON.stringify(bright));
  }

  // A new video starts no louder than the level listened to lately: an ad that talks calmly is
  // believed at the documentary's level before its own. 2.3 let a louder one in at +9 dB on Stream
  // after a quiet documentary. (Chromium only: Firefox can't suspend an offline render to send the
  // new video's reset.)
  if (browserType.name() === 'chromium') console.log('\nA louder video right after a quieter one (an ad after a documentary)');
  for (const id of browserType.name() === 'chromium' ? ['stream', 'sleep'] : []) {
    for (const [firstDb, secondDb, limit] of [[-24, -14, 3], [-34, -24, id === 'sleep' ? 3.5 : 6]]) {
      const r = await page.evaluate(([p, o]) => bench.louderAfter(p, o), [id, { firstDb, secondDb }]);
      check(`${id}: a video 10 dB louder after one at ${firstDb} LUFS comes in at most +${limit} dB over it`,
        r.resetInGap && r.secondAbove <= limit, JSON.stringify(r));
    }
  }

  // A new video's first 100 ms, before anything of it is measured, are tamed from where the preset
  // starts. Until 2.4 the guard defended -23 LUFS there whatever the preset: a loud opening came out
  // about 10 dB over the rest of Sleep's start, and on Stream after a quiet video. (After a quieter
  // video: Chromium only, like the checks above.)
  console.log('\nA new video\'s first 100 ms');
  for (const id of ['stream', 'sleep']) {
    const fresh = await page.evaluate(p => bench.firstMoments(p), id);
    check(`${id}: a loud opening's first 100 ms come out at most 1.5 dB over what follows until its normal is known`,
      fresh.firstOver <= 1.5, JSON.stringify(fresh));
    if (browserType.name() !== 'chromium') continue;
    const after = await page.evaluate(p => bench.firstMoments(p, { firstDb: -34 }), id);
    check(`${id}: so do they after a quieter video (at -34 LUFS), which starts the new one lower`,
      after.firstOver <= 1.5, JSON.stringify(after));
  }

  // Once the setup is the stream's familiar level, the voice becomes normal when it is familiar
  // in turn: seconds, not the preset's memory (60 s for Stream, 5 minutes for Sleep)
  console.log('\nTwo and a half minutes of setup room audio, then talking');
  for (const id of ['gentle', 'stream', 'movie', 'sleep']) {
    const r = await page.evaluate(p => bench.longSetup(p), id);
    check(`${id}: the voice after a long setup is cut for at most 12 s, not held down as a loud stretch`,
      r.cutForSeconds <= 12 && r.guardBusyAfter <= 0.1,
      `cut >3 dB for ${r.cutForSeconds} s, then cutting >1 dB ${Math.round(r.guardBusyAfter * 100)}% of the time`);
    // Once the voice re-seeds normal, every cut measured against the setup lets go with the guard
    check(`${id}: once the voice re-seeds normal, no cut measured against the setup lingers (at most 1 dB from 1.5 s in)`,
      r.deepestAfter >= -1, `deepest ${r.deepestAfter} dB from 1.5 to 5 s`);
  }

  console.log('\nA streamer talking in phrases over a quieter game bed (what real streams look like)');
  for (const id of ['gentle', 'stream', 'movie', 'sleep']) {
    const r = await page.evaluate(p => bench.talkWithBed(p), id);
    const limit = id === 'sleep' ? 0.2 : 0.05;
    check(`${id}: the talking passes untouched although the bed fills most of the pauses`,
      r.guardBusy <= limit && (id === 'sleep' ? r.talkGainDb <= -3 : Math.abs(r.talkGainDb) <= 0.5),
      `cutting >1 dB ${Math.round(r.guardBusy * 100)}% of the time, deepest ${r.deepest} dB, talking ${r.talkGainDb} dB`);
  }
  // A louder bed, only 12 dB under the voice, with the voice there less than half the time
  const loudBed = await page.evaluate(() => bench.talkWithBed('stream', { bedUnderDb: 12, talkShare: 0.45 }));
  check('stream: a game bed 12 dB under the voice is still not taken for normal', loudBed.guardBusy <= 0.05 && Math.abs(loudBed.talkGainDb) <= 0.5,
    `cutting >1 dB ${Math.round(loudBed.guardBusy * 100)}% of the time, deepest ${loudBed.deepest} dB, talking ${loudBed.talkGainDb} dB`);

  console.log('\nA long quiet intro (40 s of soft music), then the voice');
  for (const id of ['gentle', 'stream', 'movie', 'sleep']) {
    for (const pauseSeconds of [0, 3]) {
      const r = await page.evaluate(([p, s]) => bench.longQuietIntro(p, { pauseSeconds: s }), [id, pauseSeconds]);
      check(`${id}: the voice${pauseSeconds ? `, with ${pauseSeconds} s pauses over the music,` : ''} is cut for at most 25 s, not the preset's whole memory`,
        r.cutForSeconds <= 25 && r.guardBusyAfter <= 0.1,
        `cut >3 dB for ${r.cutForSeconds} s, then cutting >1 dB ${Math.round(r.guardBusyAfter * 100)}% of the time`);
      check(`${id}: once the voice${pauseSeconds ? ' with pauses' : ''} re-seeds normal, no cut measured against the intro lingers (at most 1 dB from 1.5 s in)`,
        r.deepestAfter >= -1, `deepest ${r.deepestAfter} dB from 1.5 to 5 s`);
    }
  }

  if (Object.keys(RECORDING_FILES).length) {
    console.log('\nRecorded streams');
    const targets = globalThis.LimitrSettings.PRESETS;
    for (const [name, file] of Object.entries(RECORDING_FILES)) {
      const spec = RECORDINGS[name];
      for (const id of ['gentle', 'stream', 'movie', 'sleep']) {
        const r = await page.evaluate(([p, u, o]) => bench.recording(p, u, o), [id, `/recordings/${name}`, spec]);
        const comfortable = targets[id].settings.levelTarget;
        const loudest = r.loudest.filter(l => l.inAbove > 0);
        console.log(`  ${name} ${id.padEnd(7)} cut >1 dB ${(r.guardBusy * 100).toFixed(1)}% | talking ${r.talkingIn}→${r.talkingOut} LUFS | ` +
          (spec.yells ? `calm talk ${r.calmIn}→${r.calmOut} LUFS, yells over it +${r.yellsOverCalmIn}→+${r.yellsOverCalmOut} dB`
            : `loudest moments above the talking level: ${loudest.map(l => `${l.t}s +${l.inAbove}→+${l.outAbove}`).join(', ')}`));
        // Louder than the comfortable level: evened to it (the louder half of the talking sits at
        // the level, so its median lands up to 3 dB under); otherwise untouched
        const levelOk = (input, output, kept = 1) => input > comfortable
          ? output <= comfortable + 0.5 && output >= comfortable - 3
          : Math.abs(output - input) <= kept;
        if (spec.kind === 'regular') {
          check(`${name}: ${id} leaves the talking alone (guard idle, level ${r.talkingIn > comfortable ? 'evened' : 'kept'})`,
            r.guardBusy <= (id === 'sleep' ? 0.2 : 0.05) && levelOk(r.talkingIn, r.talkingOut));
        } else {
          // The calm talk right after a yell is still in the guard's release: kept within 2.5 dB
          const limit = targets[id].settings.guardHeadroom + 1.5;
          check(`${name}: ${id} holds the yells to +${limit} dB over the calm talk, the calm talk at the comfortable level`,
            levelOk(r.calmIn, r.calmOut, 2.5) && r.yellsOverCalmOut <= limit, `yells +${r.yellsOverCalmOut} dB, calm talk ${r.calmOut} LUFS`);
        }
      }
    }
  }

  // The popup's "caught" count: a raised voice the raised-voice stage cuts by more than a spike
  // needs (3 dB) counts, as the trace shows its cut
  console.log('\nA strained voice 6 dB over the talk for 12 s: under the guard, cut by the raised voice');
  for (const id of ['gentle', 'stream', 'sleep']) {
    const r = await page.evaluate(p => bench.denseStretch(p, { kind: 'strained', overDb: 6 }), id);
    const detail = `${r.raisedVoices} raised voice(s), biggest ${r.maxRaisedDb} dB (cut up to ${r.deepestRaisedDb} dB), ${r.spikes} spike(s)`;
    if (id === 'gentle') {
      check('gentle: no raised voice counted (its raised-voice stage is off)', r.raisedVoices === 0, detail);
    } else {
      check(`${id}: the strained voice is counted as a raised voice, with how deep it was cut`,
        r.deepestRaisedDb > 3 && r.raisedVoices === 1 && Math.abs(r.maxRaisedDb - r.deepestRaisedDb) <= 0.2, detail);
    }
  }

  console.log('\nThings that used to fight the guard');
  for (const [id, overrides] of [['tv90s', {}], ['stream', { noiseLevel: 0.01, noiseType: 'pink' }]]) {
    const r = await page.evaluate(([p, o]) => bench.pauseAndResume(p, o), [id, overrides]);
    check(`${id}${overrides.noiseLevel ? ' + hiss' : ''}: talking comes back at its level after a 30 s pause`,
      Math.abs(r.after - r.before) <= 1.5, `${r.before} dB before, ${r.after} dB after`);
  }
  const plainGain = { compressorEnabled: true, compThreshold: 0, compRatio: 1, compKnee: 0 };
  const noMakeup = await page.evaluate(o => bench.scenario('stream', o, { sourceDb: -14 }), { ...plainGain, compMakeup: 0 });
  const makeup6 = await page.evaluate(o => bench.scenario('stream', o, { sourceDb: -14 }), { ...plainGain, compMakeup: 6 });
  const delivered = makeup6.normalOutLufs - noMakeup.normalOutLufs;
  check('compressor makeup +6 dB delivers +6 dB on a loud source', Math.abs(delivered - 6) <= 0.5, `${delivered.toFixed(1)} dB`);
  // Mid-render changes need OfflineAudioContext.suspend(), which Firefox doesn't have; the
  // worklet doing the work is the same in both
  for (const id of browserType.name() === 'chromium' ? ['gentle', 'sleep'] : []) {
    const r = await page.evaluate(p => bench.volumeSteps(p, -14), id);
    check(`${id}: moving the volume while the limiter works never passes 0 dBFS`, r.outputPeakDbfs <= 0.01, `${r.outputPeakDbfs} dBFS`);
  }

  console.log('\nMeters');
  const offRun = await page.evaluate(() => bench.scenario('off'));
  check('"Taming starts here" is hidden when the guard is off', offRun.thresholdShown === false);
  for (const sourceDb of [-24, -14]) {
    const r = await page.evaluate(l => bench.scenario('stream', {}, { sourceDb: l }), sourceDb);
    // What the spike itself lost, on top of any comfortable-level cut that applies to everything
    const heard = Math.max(...Object.values(r.events).map(e => e.tamedBy)) + r.normalGainDb;
    check(`"biggest cut" matches what was heard (stream at ${sourceDb} LUFS)`, Math.abs(r.maxSpikeDb - heard) <= 2.5,
      `shows ${r.maxSpikeDb.toFixed(1)} dB, heard ${heard.toFixed(1)} dB`);
  }

  console.log('\nVolume is a plain gain after the guard: louder or quieter, taming stays the same');
  for (const id of ['gentle', 'stream', 'sleep', 'movie']) {
    const at = {};
    for (const volume of [-12, 0, 6, 12]) at[volume] = await page.evaluate(([p, v]) => bench.scenario(p, { volume: v }), [id, volume]);
    const louder = at[6].normalOutLufs - at[0].normalOutLufs;
    const quieter = at[-12].normalOutLufs - at[0].normalOutLufs;
    check(`${id}: +6 dB on the slider is +6 dB of normal talking`, Math.abs(louder - 6) <= 0.5, `${louder.toFixed(1)} dB`);
    check(`${id}: -12 dB on the slider is -12 dB of normal talking`, Math.abs(quieter + 12) <= 0.5, `${quieter.toFixed(1)} dB`);
    const sameTaming = ['yell', 'alert'].every(e => Math.abs(at[-12].events[e].outAboveNormal - at[0].events[e].outAboveNormal) <= 0.5);
    check(`${id}: spikes tamed the same at -12 dB`, sameTaming,
      ['yell', 'alert'].map(e => `${e} ${at[-12].events[e].outAboveNormal} vs ${at[0].events[e].outAboveNormal}`).join(', '));
    check(`${id}: never over 0 dBFS at +12 dB`, at[12].outputPeakDbfs <= 0.01, `${at[12].outputPeakDbfs} dBFS`);
  }
  for (const id of ['stream', 'sleep']) {
    const base = await page.evaluate(p => bench.scenario(p, { volume: 0 }), id);
    const up = await page.evaluate(p => bench.scenario(p, { volume: 6 }), id);
    const same = ['yell', 'alert'].every(e => Math.abs(up.events[e].outAboveNormal - base.events[e].outAboveNormal) <= 0.5);
    check(`${id}: spikes tamed the same at +6 dB`, same,
      ['yell', 'alert'].map(e => `${e} ${up.events[e].outAboveNormal} vs ${base.events[e].outAboveNormal}`).join(', '));
  }

  console.log('\nPage script (content-audio.js)');
  const pageScript = await browser.newPage();
  await pageScript.goto(`http://127.0.0.1:${port}/tests/page-script-bench.html`);
  await pageScript.waitForFunction(() => window.benchReady === true);
  await pageScript.click('#play');
  await pageScript.waitForTimeout(1500);
  const status = await pageScript.evaluate(() => window.pageStatus);
  check('player attaches once a slow-starting AudioContext runs, with no second click',
    status && status.attached === 1 && status.waitingForGesture === 0, JSON.stringify(status));

  // The site's own volume reaches Limitr before the guard: changing it must act like a plain gain,
  // and a new video must start with a fresh idea of normal
  const pageMeters = () => pageScript.evaluate(() => new Promise(resolve => {
    const id = Math.random();
    const onMessage = e => {
      if (e.data && e.data.source === 'limitr-page' && e.data.type === 'meters' && e.data.id === id) {
        window.removeEventListener('message', onMessage);
        resolve(e.data.meters);
      }
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ source: 'limitr-bridge', type: 'get-meters', id }, '*');
  }));
  await pageScript.waitForTimeout(1500);
  const before = await pageMeters();
  await pageScript.evaluate(() => { document.getElementById('player').volume = 0.5; });
  await pageScript.waitForTimeout(300);
  const after = await pageMeters();
  const shifted = after.baselineDb - before.baselineDb;
  check('the site halving its player volume moves normal by -6 dB at once', Math.abs(shifted + 6.02) <= 0.5,
    `${shifted.toFixed(2)} dB`);
  await pageScript.evaluate(() => {
    const player = document.getElementById('player');
    player.volume = 1;
    player.src = player.src;
    player.play();
  });
  await pageScript.waitForTimeout(150);
  const fresh = await pageMeters();
  check('new media starts with a fresh idea of normal', fresh.spikes === 0 && Math.abs(fresh.baselineDb + 23) < 0.01,
    JSON.stringify({ normal: fresh.baselineDb, spikes: fresh.spikes }));

  if (browserType.name() === 'chromium') {
    // A player the page routes through its own Web Audio graph can't be reached. Once the page
    // lets go of it, Limitr must not keep it alive.
    await pageScript.evaluate(async () => {
      const el = new Audio(document.getElementById('player').src);
      el.loop = true;
      const own = new NativeAudioContext();
      own.createMediaElementSource(el).connect(own.destination);
      await el.play();
      await new Promise(resolve => setTimeout(resolve, 400));
      window.unreachableRef = new WeakRef(el);
      el.pause();
      el.removeAttribute('src');
      el.load();
      await own.close();
    });
    await pageScript.waitForTimeout(300);
    const skipped = await pageScript.evaluate(() => window.pageStatus.skipped);
    for (let i = 0; i < 3; i++) {
      await pageScript.evaluate(() => gc());
      await pageScript.waitForTimeout(100);
    }
    const released = await pageScript.evaluate(() => window.unreachableRef.deref() === undefined);
    check('an unreachable player the page dropped is not kept in memory',
      skipped['page-audio'] === 1 && released, JSON.stringify({ skipped, released }));

    console.log('\nDebug harness');
    const harness = await browser.newPage();
    const harnessErrors = [];
    harness.on('pageerror', e => harnessErrors.push(e.message));
    await harness.goto(`http://127.0.0.1:${port}/tests/debug-harness.html`);
    await harness.setInputFiles('#file', { name: 'stream.wav', mimeType: 'audio/wav', buffer: streamWav(4) });
    await harness.waitForFunction(() => !document.getElementById('play').disabled);
    await harness.click('#play');
    await harness.waitForTimeout(2500);
    const canvasState = await harness.evaluate(() => {
      const g = document.getElementById('trace').getContext('2d');
      return { alpha: g.globalAlpha, dash: g.getLineDash().length };
    });
    await harness.click('#stop');
    check('live trace draws without errors', harnessErrors.length === 0, harnessErrors.join(' | '));
    check('drawing leaves the canvas state as it found it', canvasState.alpha === 1 && canvasState.dash === 0,
      JSON.stringify(canvasState));
    await harness.close();
  }

  await browser.close();
  return rows;
}

(async () => {
  const only = (process.argv.find(a => a.startsWith('--browser=')) || '').split('=')[1];
  checkCaptionPrefs();
  checkCaptionResampler();
  await checkCaptionText();
  await checkLiveAgreement();
  await checkLegacyUpgrade();
  await checkUpgradeFrom20();
  await checkUpgradeFrom21();
  await checkUpgradeFrom22();
  await checkUpgradeFrom23();
  const routes = {};
  for (const [name, file] of Object.entries(RECORDING_FILES)) {
    routes[`/recordings/${name}`] = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'audio/wav' });
      res.end(require('fs').readFileSync(file));
    };
  }
  if (process.env.LIMITR_SETTINGS) {
    console.log(`Settings: ${process.env.LIMITR_SETTINGS}`);
    routes['/lib/settings.js'] = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(require('fs').readFileSync(SETTINGS_FILE));
    };
  }
  if (process.env.LIMITR_WORKLET) {
    console.log(`Worklet: ${process.env.LIMITR_WORKLET}`);
    routes['/lib/dsp-worklet.js'] = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(require('fs').readFileSync(process.env.LIMITR_WORKLET));
    };
  }
  const { server, port } = await startStaticServer(undefined, routes);
  try {
    for (const type of [chromium, firefox]) {
      if (only && type.name() !== only) continue;
      await runIn(type, port);
    }
  } finally {
    server.close();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
