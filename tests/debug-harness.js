'use strict';

// ─── Presets (same as popup.js) ────────────────────────────────────────────
const presets = {
  off: {
    name: 'Off',
    compressorEnabled: false, multibandEnabled: false, eqEnabled: false, filtersEnabled: false,
    threshold: 0, ratio: 1, knee: 0, attack: 0, release: 0,
    makeupGain: 0, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: false, limiterThreshold: -1, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 200, crossover2: 3000,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -24, midRatio: 4, midGain: 0,
    highThreshold: -24, highRatio: 6, highGain: 0,
    eq1Freq: 80, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: 0, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 1000, eq3Gain: 0, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: 0, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 12000, eq5Gain: 0, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  music: {
    name: 'Music',
    compressorEnabled: true, multibandEnabled: false, eqEnabled: true, filtersEnabled: false,
    threshold: -20, ratio: 3, knee: 20, attack: 10, release: 200,
    makeupGain: 2, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: true, limiterThreshold: -0.5, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 200, crossover2: 3000,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -24, midRatio: 4, midGain: 0,
    highThreshold: -24, highRatio: 6, highGain: 0,
    eq1Freq: 50, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 100, eq2Gain: 1, eq2Q: 1.0, eq2Type: 'lowshelf',
    eq3Freq: 1000, eq3Gain: 0, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: 1, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 10000, eq5Gain: 1, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  lofi: {
    name: 'Lo-Fi',
    compressorEnabled: true, multibandEnabled: false, eqEnabled: true, filtersEnabled: true,
    threshold: -25, ratio: 3, knee: 20, attack: 15, release: 200,
    makeupGain: 2, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 14000,
    limiterEnabled: true, limiterThreshold: -1, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0.05, noiseType: 'brown', effectsEnabled: true,
    crossover1: 200, crossover2: 3000,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -24, midRatio: 4, midGain: 0,
    highThreshold: -24, highRatio: 6, highGain: 0,
    eq1Freq: 80, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 200, eq2Gain: 2, eq2Q: 1.0, eq2Type: 'lowshelf',
    eq3Freq: 1000, eq3Gain: 0, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: 0, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 8000, eq5Gain: -4, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  streamWatch: {
    name: 'Stream Watch',
    compressorEnabled: true, multibandEnabled: false, eqEnabled: true, filtersEnabled: false,
    threshold: -28, ratio: 5, knee: 10, attack: 2, release: 150,
    makeupGain: 0, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: true, limiterThreshold: -3, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: true, autoGainTarget: -20, autoGainSpeed: 'normal',
    gateEnabled: true, gateThreshold: -45, gateHold: 150, gateRelease: 250,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 200, crossover2: 3000,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -24, midRatio: 4, midGain: 0,
    highThreshold: -24, highRatio: 6, highGain: 0,
    eq1Freq: 60, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: 0, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 3000, eq3Gain: 1, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 6000, eq4Gain: -2, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 10000, eq5Gain: -1, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  podcast: {
    name: 'Podcast',
    compressorEnabled: true, multibandEnabled: false, eqEnabled: true, filtersEnabled: false,
    threshold: -30, ratio: 6, knee: 10, attack: 3, release: 150,
    makeupGain: 0, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: true, limiterThreshold: -2, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: true, autoGainTarget: -20, autoGainSpeed: 'normal',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 200, crossover2: 3000,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -24, midRatio: 4, midGain: 0,
    highThreshold: -24, highRatio: 6, highGain: 0,
    eq1Freq: 80, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 200, eq2Gain: -2, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 2000, eq3Gain: 2, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 6000, eq4Gain: -3, eq4Q: 1.5, eq4Type: 'peaking',
    eq5Freq: 12000, eq5Gain: 0, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  voiceFocus: {
    name: 'Voice Focus',
    compressorEnabled: false, multibandEnabled: true, eqEnabled: true, filtersEnabled: false,
    threshold: -24, ratio: 8, knee: 12, attack: 5, release: 100,
    makeupGain: 0, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: true, limiterThreshold: -1, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 200, crossover2: 3000,
    subThreshold: -15, subRatio: 12, subGain: -8,
    midThreshold: -35, midRatio: 3, midGain: 4,
    highThreshold: -25, highRatio: 6, highGain: -2,
    eq1Freq: 80, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 200, eq2Gain: -2, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 2500, eq3Gain: 3, eq3Q: 1.5, eq3Type: 'peaking',
    eq4Freq: 5000, eq4Gain: 2, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 12000, eq5Gain: -2, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  movie: {
    name: 'Movie',
    compressorEnabled: false, multibandEnabled: true, eqEnabled: true, filtersEnabled: false,
    threshold: -24, ratio: 8, knee: 12, attack: 5, release: 100,
    makeupGain: 0, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: true, limiterThreshold: -3, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: true, autoGainTarget: -20, autoGainSpeed: 'normal',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 250, crossover2: 2500,
    subThreshold: -25, subRatio: 10, subGain: -4,
    midThreshold: -30, midRatio: 3, midGain: 2,
    highThreshold: -20, highRatio: 4, highGain: 0,
    eq1Freq: 40, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 200, eq2Gain: -2, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 2000, eq3Gain: 3, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: 1, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 8000, eq5Gain: -1, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  bassTamer: {
    name: 'Bass Tamer',
    compressorEnabled: true, multibandEnabled: false, eqEnabled: true, filtersEnabled: false,
    threshold: -30, ratio: 10, knee: 8, attack: 2, release: 100,
    makeupGain: 4, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: true, limiterThreshold: -1, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 200, crossover2: 3000,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -24, midRatio: 4, midGain: 0,
    highThreshold: -24, highRatio: 6, highGain: 0,
    eq1Freq: 120, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: -4, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 500, eq3Gain: -2, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 2000, eq4Gain: 1, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 8000, eq5Gain: 0, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  tv90s: {
    name: '90s TV',
    compressorEnabled: true, multibandEnabled: false, eqEnabled: false, filtersEnabled: true,
    threshold: -35, ratio: 15, knee: 6, attack: 2, release: 100,
    makeupGain: 5, gainEnabled: true,
    bassCutFreq: 200, trebleCutFreq: 8000,
    limiterEnabled: true, limiterThreshold: -2, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0.15, noiseType: 'brown', effectsEnabled: true,
    crossover1: 200, crossover2: 3000,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -24, midRatio: 4, midGain: 0,
    highThreshold: -24, highRatio: 6, highGain: 0,
    eq1Freq: 80, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: 0, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 1000, eq3Gain: 0, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: 0, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 12000, eq5Gain: 0, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  streamSafe: {
    name: 'Stream Safe',
    compressorEnabled: false, multibandEnabled: true, eqEnabled: true, filtersEnabled: false,
    threshold: -24, ratio: 8, knee: 6, attack: 1, release: 100,
    makeupGain: 0, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: true, limiterThreshold: -6, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: true, autoGainTarget: -20, autoGainSpeed: 'normal',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 200, crossover2: 2500,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -25, midRatio: 4, midGain: 2,
    highThreshold: -25, highRatio: 8, highGain: -2,
    eq1Freq: 80, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: 0, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 3500, eq3Gain: -2, eq3Q: 1.5, eq3Type: 'peaking',
    eq4Freq: 5000, eq4Gain: -1, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 12000, eq5Gain: 0, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  antiScream: {
    name: 'Anti-Scream',
    compressorEnabled: true, multibandEnabled: false, eqEnabled: false, filtersEnabled: false,
    threshold: -35, ratio: 12, knee: 6, attack: 1, release: 200,
    makeupGain: 0, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: true, limiterThreshold: -6, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: true, autoGainTarget: -10, autoGainSpeed: 'fast',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 200, crossover2: 3000,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -24, midRatio: 4, midGain: 0,
    highThreshold: -24, highRatio: 6, highGain: 0,
    eq1Freq: 80, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: 0, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 1000, eq3Gain: 0, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: 0, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 8000, eq5Gain: 0, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  nightMode: {
    name: 'Night Mode',
    compressorEnabled: true, multibandEnabled: false, eqEnabled: true, filtersEnabled: false,
    threshold: -28, ratio: 6, knee: 6, attack: 1, release: 200,
    makeupGain: 0, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: true, limiterThreshold: -3, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: true, autoGainTarget: -22, autoGainSpeed: 'normal',
    gateEnabled: false, gateThreshold: -50, gateHold: 100, gateRelease: 200,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 200, crossover2: 3000,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -24, midRatio: 4, midGain: 0,
    highThreshold: -24, highRatio: 6, highGain: 0,
    eq1Freq: 120, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: -4, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 1000, eq3Gain: 0, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 4000, eq4Gain: -3, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 8000, eq5Gain: -3, eq5Q: 0.7, eq5Type: 'highshelf'
  },
  sleep: {
    name: 'Sleep',
    compressorEnabled: true, multibandEnabled: false, eqEnabled: true, filtersEnabled: false,
    threshold: -25, ratio: 10, knee: 6, attack: 1, release: 200,
    makeupGain: 0, gainEnabled: true,
    bassCutFreq: 0, trebleCutFreq: 22050,
    limiterEnabled: true, limiterThreshold: -10, limiterAttack: 1, limiterRelease: 100,
    autoGainEnabled: true, autoGainTarget: -30, autoGainSpeed: 'slow',
    gateEnabled: true, gateThreshold: -50, gateHold: 200, gateRelease: 300,
    noiseLevel: 0, noiseType: 'brown', effectsEnabled: false,
    crossover1: 200, crossover2: 3000,
    subThreshold: -20, subRatio: 8, subGain: 0,
    midThreshold: -24, midRatio: 4, midGain: 0,
    highThreshold: -24, highRatio: 6, highGain: 0,
    eq1Freq: 120, eq1Gain: 0, eq1Q: 0.7, eq1Type: 'highpass',
    eq2Freq: 250, eq2Gain: -4, eq2Q: 1.0, eq2Type: 'peaking',
    eq3Freq: 1000, eq3Gain: 0, eq3Q: 1.0, eq3Type: 'peaking',
    eq4Freq: 3000, eq4Gain: -6, eq4Q: 1.0, eq4Type: 'peaking',
    eq5Freq: 6000, eq5Gain: -8, eq5Q: 0.7, eq5Type: 'highshelf'
  }
};

const PRESET_ORDER = [
  'off', 'music', 'lofi', 'streamWatch', 'podcast', 'voiceFocus',
  'movie', 'bassTamer', 'tv90s', 'streamSafe', 'antiScream', 'nightMode', 'sleep'
];

const AGC_PROFILES = {
  slow:   { interval: 100, attack: 0.02, release: 0.05, maxGain: 6 },
  normal: { interval: 50,  attack: 0.05, release: 0.10, maxGain: 6 },
  fast:   { interval: 20,  attack: 0.15, release: 0.25, maxGain: 4 }
};

// ─── State ─────────────────────────────────────────────────────────────────
let audioContext = null;
let mediaElement = null;
let sourceNode = null;
let chain = null;       // Current audio processing chain
let logData = [];       // Per-frame log entries
let isPlaying = false;
let isRunningAll = false;
let meterAnimId = null;
let agcIntervalId = null;
let gateIntervalId = null;
let agcCurrentGain = 1;
let gateIsOpen = true;
let gateHoldCounter = 0;
let currentPresetKey = 'off';
let fileLoaded = false;

// Extension BroadcastChannel
let extChannel = null;
let extLastData = null;
let extLastTime = 0;

// ─── DOM ───────────────────────────────────────────────────────────────────
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const presetSelect = document.getElementById('presetSelect');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const runAllBtn = document.getElementById('runAllBtn');
const runStatus = document.getElementById('runStatus');

// Populate preset selector
for (const key of PRESET_ORDER) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = presets[key].name;
  presetSelect.appendChild(opt);
}

// ─── File Loading ──────────────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) loadFile(e.target.files[0]);
});

function loadFile(file) {
  // Tear down existing chain and source (new element = new source needed)
  teardownChain();
  sourceNode = null;  // Force re-creation for new media element
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (mediaElement) {
    mediaElement.pause();
    mediaElement.removeEventListener('ended', onPlaybackEnded);
    URL.revokeObjectURL(mediaElement.src);
  }

  // Create audio or video element based on file type
  if (file.type.startsWith('video/')) {
    mediaElement = document.createElement('video');
  } else {
    mediaElement = document.createElement('audio');
  }
  mediaElement.src = URL.createObjectURL(file);
  mediaElement.crossOrigin = 'anonymous';
  mediaElement.loop = false;

  dropZone.textContent = `Loaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  dropZone.classList.add('loaded');

  fileLoaded = true;
  playBtn.disabled = false;
  runAllBtn.disabled = false;

  mediaElement.addEventListener('ended', onPlaybackEnded);
}

// ─── Audio Chain Builder ───────────────────────────────────────────────────

function createCrossoverPair(ctx, frequency) {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = frequency; lp.Q.value = 0.707;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = frequency; hp.Q.value = 0.707;
  return { lowpass: lp, highpass: hp };
}

function ensureSourceNode() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  // createMediaElementSource can only be called ONCE per element
  if (!sourceNode) {
    sourceNode = audioContext.createMediaElementSource(mediaElement);
  } else {
    sourceNode.disconnect();
  }
}

function buildChain(preset) {
  ensureSourceNode();

  // Input analyser (before processing)
  const inputAnalyser = audioContext.createAnalyser();
  inputAnalyser.fftSize = 2048;

  // Global compressor
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = preset.threshold;
  compressor.ratio.value = Math.max(1, preset.ratio);
  compressor.knee.value = preset.knee;
  compressor.attack.value = preset.attack / 1000;
  compressor.release.value = preset.release / 1000;

  // Makeup gain
  const makeupGain = audioContext.createGain();
  makeupGain.gain.value = preset.gainEnabled ? Math.pow(10, preset.makeupGain / 20) : 1;

  // Multiband crossovers + compressors
  const xover1 = createCrossoverPair(audioContext, preset.crossover1);
  const xover2 = createCrossoverPair(audioContext, preset.crossover2);

  const createBandProc = (thresh, ratio, knee, attack, release, gain) => {
    const comp = audioContext.createDynamicsCompressor();
    comp.threshold.value = thresh;
    comp.ratio.value = Math.max(1, ratio);
    comp.knee.value = knee;
    comp.attack.value = attack / 1000;
    comp.release.value = release / 1000;
    const g = audioContext.createGain();
    g.gain.value = Math.pow(10, gain / 20);
    comp.connect(g);
    return { compressor: comp, gainNode: g };
  };

  const subBand = createBandProc(preset.subThreshold, preset.subRatio, preset.knee, preset.attack, preset.release, preset.subGain);
  const midBand = createBandProc(preset.midThreshold, preset.midRatio, preset.knee, preset.attack, preset.release, preset.midGain);
  const highBand = createBandProc(preset.highThreshold, preset.highRatio, preset.knee, preset.attack, preset.release, preset.highGain);

  const multibandSum = audioContext.createGain();
  multibandSum.gain.value = 1;

  // Internal multiband routing
  xover1.lowpass.connect(subBand.compressor);
  xover1.highpass.connect(xover2.lowpass);
  xover1.highpass.connect(xover2.highpass);
  xover2.lowpass.connect(midBand.compressor);
  xover2.highpass.connect(highBand.compressor);
  subBand.gainNode.connect(multibandSum);
  midBand.gainNode.connect(multibandSum);
  highBand.gainNode.connect(multibandSum);

  // EQ bands
  const eqBands = [];
  for (let i = 1; i <= 5; i++) {
    const band = audioContext.createBiquadFilter();
    band.type = preset[`eq${i}Type`];
    band.frequency.value = preset[`eq${i}Freq`];
    band.gain.value = preset[`eq${i}Gain`];
    band.Q.value = preset[`eq${i}Q`];
    eqBands.push(band);
  }
  for (let i = 0; i < 4; i++) eqBands[i].connect(eqBands[i + 1]);

  // Bass/treble cut
  const bassCut = audioContext.createBiquadFilter();
  bassCut.type = 'highpass';
  bassCut.frequency.value = Math.max(20, preset.bassCutFreq);
  bassCut.Q.value = 0.707;

  const trebleCut = audioContext.createBiquadFilter();
  trebleCut.type = 'lowpass';
  trebleCut.frequency.value = Math.min(22050, preset.trebleCutFreq);
  trebleCut.Q.value = 0.707;

  // AGC
  const autoGainNode = audioContext.createGain();
  autoGainNode.gain.value = 1;
  const agcAnalyser = audioContext.createAnalyser();
  agcAnalyser.fftSize = 2048;

  // Gate
  const gateNode = audioContext.createGain();
  gateNode.gain.value = 1;
  const gateAnalyser = audioContext.createAnalyser();
  gateAnalyser.fftSize = 2048;

  // Limiter
  const limiter = audioContext.createDynamicsCompressor();
  limiter.threshold.value = preset.limiterThreshold;
  limiter.ratio.value = 20;
  limiter.knee.value = 0;
  limiter.attack.value = preset.limiterAttack / 1000;
  limiter.release.value = preset.limiterRelease / 1000;

  // Output gain (0 dB in test mode)
  const outputGain = audioContext.createGain();
  outputGain.gain.value = 1;

  // Output analyser (after processing)
  const outputAnalyser = audioContext.createAnalyser();
  outputAnalyser.fftSize = 2048;

  // ─── Wire signal chain ───
  // Input analyser (parallel tap)
  sourceNode.connect(inputAnalyser);

  let currentNode = sourceNode;

  // Dynamics
  if (preset.multibandEnabled) {
    currentNode.connect(xover1.lowpass);
    currentNode.connect(xover1.highpass);
    currentNode = multibandSum;
  } else if (preset.compressorEnabled) {
    currentNode.connect(compressor);
    compressor.connect(makeupGain);
    currentNode = makeupGain;
  }

  // Bass cut
  if (preset.filtersEnabled && preset.bassCutFreq > 20) {
    currentNode.connect(bassCut);
    currentNode = bassCut;
  }

  // EQ
  if (preset.eqEnabled) {
    currentNode.connect(eqBands[0]);
    currentNode = eqBands[4];
  }

  // Treble cut
  if (preset.filtersEnabled && preset.trebleCutFreq < 20000) {
    currentNode.connect(trebleCut);
    currentNode = trebleCut;
  }

  // Gate
  if (preset.gateEnabled) {
    currentNode.connect(gateAnalyser);
    currentNode.connect(gateNode);
    currentNode = gateNode;
  }

  // AGC
  if (preset.autoGainEnabled) {
    currentNode.connect(agcAnalyser);
    currentNode.connect(autoGainNode);
    currentNode = autoGainNode;
  }

  // Limiter
  if (preset.limiterEnabled) {
    currentNode.connect(limiter);
    currentNode = limiter;
  }

  // Output
  currentNode.connect(outputGain);
  outputGain.connect(outputAnalyser);
  outputGain.connect(audioContext.destination);

  return {
    inputAnalyser, outputAnalyser,
    compressor, makeupGain,
    subBand, midBand, highBand, multibandSum,
    eqBands, bassCut, trebleCut,
    autoGainNode, agcAnalyser,
    gateNode, gateAnalyser,
    limiter, outputGain,
    preset
  };
}

function teardownChain() {
  stopAgc();
  stopGate();
  if (chain) {
    // Disconnect all chain nodes from destination to prevent orphaned connections
    try { chain.outputGain.disconnect(); } catch (e) {}
    try { chain.outputAnalyser.disconnect(); } catch (e) {}
  }
  if (sourceNode) {
    try { sourceNode.disconnect(); } catch (e) {}
    // Do NOT null sourceNode — createMediaElementSource can only be called once
  }
  chain = null;
}

// ─── AGC Implementation (mirrors offscreen.js) ────────────────────────────

function startAgc(preset) {
  stopAgc();
  agcCurrentGain = 1;
  const profile = AGC_PROFILES[preset.autoGainSpeed] || AGC_PROFILES.normal;

  agcIntervalId = setInterval(() => {
    if (!chain) return;
    const buf = new Float32Array(chain.agcAnalyser.fftSize);
    chain.agcAnalyser.getFloatTimeDomainData(buf);

    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;

    if (db > -60) {
      const target = Math.pow(10, (preset.autoGainTarget - db) / 20);
      const smoothing = target > agcCurrentGain ? profile.attack : profile.release;
      agcCurrentGain += (target - agcCurrentGain) * smoothing;
      agcCurrentGain = Math.max(0.1, Math.min(profile.maxGain, agcCurrentGain));
      chain.autoGainNode.gain.setTargetAtTime(agcCurrentGain, audioContext.currentTime, 0.02);
    }
  }, profile.interval);
}

function stopAgc() {
  if (agcIntervalId) { clearInterval(agcIntervalId); agcIntervalId = null; }
  agcCurrentGain = 1;
}

// ─── Gate Implementation (mirrors offscreen.js) ───────────────────────────

function startGate(preset) {
  stopGate();
  gateIsOpen = true;
  gateHoldCounter = 0;

  gateIntervalId = setInterval(() => {
    if (!chain) return;
    const buf = new Float32Array(chain.gateAnalyser.fftSize);
    chain.gateAnalyser.getFloatTimeDomainData(buf);

    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;

    const holdTicks = Math.max(1, Math.round(preset.gateHold / 20));
    const releaseTime = preset.gateRelease / 1000;

    if (db >= preset.gateThreshold) {
      if (!gateIsOpen) {
        chain.gateNode.gain.setTargetAtTime(1, audioContext.currentTime, 0.006);
        gateIsOpen = true;
      }
      gateHoldCounter = holdTicks;
    } else {
      if (gateHoldCounter > 0) {
        gateHoldCounter--;
      } else if (gateIsOpen) {
        chain.gateNode.gain.setTargetAtTime(0, audioContext.currentTime, releaseTime / 3);
        gateIsOpen = false;
      }
    }
  }, 20);
}

function stopGate() {
  if (gateIntervalId) { clearInterval(gateIntervalId); gateIntervalId = null; }
  gateIsOpen = true;
  gateHoldCounter = 0;
}

// ─── Metering ──────────────────────────────────────────────────────────────

function getRMS(analyser) {
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let sum = 0, peak = 0;
  for (let i = 0; i < buf.length; i++) {
    sum += buf[i] * buf[i];
    const abs = Math.abs(buf[i]);
    if (abs > peak) peak = abs;
  }
  const rms = Math.sqrt(sum / buf.length);
  return {
    rms: rms > 0 ? 20 * Math.log10(rms) : -100,
    peak: peak > 0 ? 20 * Math.log10(peak) : -100
  };
}

function getFrequencyBands(analyser) {
  const binCount = analyser.frequencyBinCount;
  const freqData = new Float32Array(binCount);
  analyser.getFloatFrequencyData(freqData);

  const sampleRate = audioContext ? audioContext.sampleRate : 48000;
  const binWidth = sampleRate / (binCount * 2);

  // Band boundaries in Hz
  const bassMax = 250, midMax = 4000;
  const bassEndBin = Math.min(binCount - 1, Math.floor(bassMax / binWidth));
  const midEndBin = Math.min(binCount - 1, Math.floor(midMax / binWidth));
  const startBin = Math.max(1, Math.floor(20 / binWidth)); // skip DC

  let bassPower = 0, midPower = 0, treblePower = 0;
  let bassCount = 0, midCount = 0, trebleCount = 0;
  let centroidNum = 0, centroidDen = 0;

  for (let i = startBin; i < binCount; i++) {
    const power = Math.pow(10, freqData[i] / 10); // dB to linear power
    const freq = i * binWidth;

    // Spectral centroid
    centroidNum += freq * power;
    centroidDen += power;

    if (i <= bassEndBin) { bassPower += power; bassCount++; }
    else if (i <= midEndBin) { midPower += power; midCount++; }
    else { treblePower += power; trebleCount++; }
  }

  const toDB = (p, n) => n > 0 && p > 0 ? 10 * Math.log10(p / n) : -100;
  return {
    bass: toDB(bassPower, bassCount),
    mid: toDB(midPower, midCount),
    treble: toDB(treblePower, trebleCount),
    centroid: centroidDen > 0 ? centroidNum / centroidDen : 0
  };
}

function getMultibandGR() {
  if (!chain || !chain.preset.multibandEnabled) return { grSub: 0, grMid: 0, grHigh: 0 };
  return {
    grSub: chain.subBand.compressor.reduction || 0,
    grMid: chain.midBand.compressor.reduction || 0,
    grHigh: chain.highBand.compressor.reduction || 0
  };
}

function getGainReduction() {
  if (!chain) return 0;
  if (chain.preset.multibandEnabled) {
    return Math.min(
      chain.subBand.compressor.reduction,
      chain.midBand.compressor.reduction,
      chain.highBand.compressor.reduction
    );
  }
  return chain.compressor.reduction;
}

function dbToPercent(db, minDb = -60) {
  return Math.max(0, Math.min(100, ((db - minDb) / (0 - minDb)) * 100));
}

function updateMeters() {
  if (!chain || !isPlaying) {
    meterAnimId = requestAnimationFrame(updateMeters);
    return;
  }

  const input = getRMS(chain.inputAnalyser);
  const output = getRMS(chain.outputAnalyser);
  const gr = getGainReduction();
  const agcDb = agcCurrentGain > 0 ? 20 * Math.log10(agcCurrentGain) : 0;

  // Update meter bars
  document.getElementById('meterInput').style.width = dbToPercent(input.rms) + '%';
  document.getElementById('meterInputVal').textContent = `${input.rms.toFixed(1)} dBFS`;

  document.getElementById('meterOutput').style.width = dbToPercent(output.rms) + '%';
  document.getElementById('meterOutputVal').textContent = `${output.rms.toFixed(1)} dBFS`;

  const grPct = Math.min(100, Math.abs(gr) / 30 * 100);
  document.getElementById('meterGR').style.width = grPct + '%';
  document.getElementById('meterGRVal').textContent = `${gr.toFixed(1)} dB`;

  const agcPct = Math.min(100, Math.max(0, (agcDb + 20) / 36 * 100));
  document.getElementById('meterAGC').style.width = agcPct + '%';
  document.getElementById('meterAGCVal').textContent = `${agcDb >= 0 ? '+' : ''}${agcDb.toFixed(1)} dB`;

  // Frequency bands (input + output)
  const inBands = getFrequencyBands(chain.inputAnalyser);
  const outBands = getFrequencyBands(chain.outputAnalyser);
  const mbGR = getMultibandGR();

  // Update band meters (showing output bands)
  document.getElementById('meterBass').style.width = dbToPercent(outBands.bass) + '%';
  document.getElementById('meterBassVal').textContent = `${outBands.bass.toFixed(1)} dBFS`;
  document.getElementById('meterMid').style.width = dbToPercent(outBands.mid) + '%';
  document.getElementById('meterMidVal').textContent = `${outBands.mid.toFixed(1)} dBFS`;
  document.getElementById('meterTreble').style.width = dbToPercent(outBands.treble) + '%';
  document.getElementById('meterTrebleVal').textContent = `${outBands.treble.toFixed(1)} dBFS`;

  // Log frame
  logData.push({
    t: performance.now(),
    preset: currentPresetKey,
    inRMS: +input.rms.toFixed(2),
    inPeak: +input.peak.toFixed(2),
    outRMS: +output.rms.toFixed(2),
    outPeak: +output.peak.toFixed(2),
    gr: +gr.toFixed(2),
    agcGain: +agcDb.toFixed(2),
    gateOpen: gateIsOpen,
    limiterGR: +(chain.limiter.reduction || 0).toFixed(2),
    clipped: output.peak >= -0.1,
    inBass: +inBands.bass.toFixed(2),
    inMid: +inBands.mid.toFixed(2),
    inTreble: +inBands.treble.toFixed(2),
    outBass: +outBands.bass.toFixed(2),
    outMid: +outBands.mid.toFixed(2),
    outTreble: +outBands.treble.toFixed(2),
    centroid: +outBands.centroid.toFixed(1),
    grSub: +mbGR.grSub.toFixed(2),
    grMid: +mbGR.grMid.toFixed(2),
    grHigh: +mbGR.grHigh.toFixed(2)
  });

  document.getElementById('statEntries').textContent = logData.length.toLocaleString();

  // Draw waveform
  drawWaveform(input, output);

  meterAnimId = requestAnimationFrame(updateMeters);
}

// ─── Waveform Drawing ──────────────────────────────────────────────────────

const waveCanvas = document.getElementById('waveform');
const waveCtx = waveCanvas.getContext('2d');
let waveHistory = [];

function drawWaveform(input, output) {
  waveHistory.push({ inRMS: input.rms, outRMS: output.rms });
  if (waveHistory.length > 600) waveHistory.shift();

  const w = waveCanvas.width = waveCanvas.clientWidth * 2;
  const h = waveCanvas.height = waveCanvas.clientHeight * 2;
  waveCtx.clearRect(0, 0, w, h);
  waveCtx.fillStyle = '#111';
  waveCtx.fillRect(0, 0, w, h);

  // 0dB line
  const zeroY = h * 0.05;
  waveCtx.strokeStyle = '#333';
  waveCtx.setLineDash([4, 4]);
  waveCtx.beginPath();
  waveCtx.moveTo(0, zeroY);
  waveCtx.lineTo(w, zeroY);
  waveCtx.stroke();
  waveCtx.setLineDash([]);

  const dbToY = (db) => {
    const norm = Math.max(0, Math.min(1, (db + 60) / 60)); // -60..0 -> 0..1
    return h - norm * h;
  };

  // Input line
  waveCtx.beginPath();
  waveCtx.strokeStyle = 'rgba(79,70,229,0.6)';
  waveCtx.lineWidth = 1.5;
  for (let i = 0; i < waveHistory.length; i++) {
    const x = (i / 600) * w;
    const y = dbToY(waveHistory[i].inRMS);
    if (i === 0) waveCtx.moveTo(x, y);
    else waveCtx.lineTo(x, y);
  }
  waveCtx.stroke();

  // Output line
  waveCtx.beginPath();
  waveCtx.strokeStyle = 'rgba(34,197,94,0.8)';
  waveCtx.lineWidth = 1.5;
  for (let i = 0; i < waveHistory.length; i++) {
    const x = (i / 600) * w;
    const y = dbToY(waveHistory[i].outRMS);
    if (i === 0) waveCtx.moveTo(x, y);
    else waveCtx.lineTo(x, y);
  }
  waveCtx.stroke();

  // Labels
  waveCtx.font = '18px monospace';
  waveCtx.fillStyle = 'rgba(79,70,229,0.8)';
  waveCtx.fillText('Input', 8, h - 28);
  waveCtx.fillStyle = 'rgba(34,197,94,0.8)';
  waveCtx.fillText('Output', 8, h - 8);
}

// ─── Transfer Curve ────────────────────────────────────────────────────────

function drawTransferCurve() {
  const canvas = document.getElementById('transferCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * 2;
  const h = canvas.height = canvas.clientHeight * 2;

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  for (let db = -60; db <= 0; db += 10) {
    const x = ((db + 60) / 60) * w;
    const y = h - ((db + 60) / 60) * h;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Unity line
  ctx.strokeStyle = '#333';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.stroke();
  ctx.setLineDash([]);

  // Plot logged data points
  if (logData.length === 0) return;

  ctx.fillStyle = 'rgba(34,197,94,0.15)';
  for (const entry of logData) {
    if (entry.inRMS <= -60 && entry.outRMS <= -60) continue;
    const x = ((entry.inRMS + 60) / 60) * w;
    const y = h - ((entry.outRMS + 60) / 60) * h;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Labels
  ctx.font = '18px monospace';
  ctx.fillStyle = '#666';
  ctx.fillText('Input (dBFS) →', 8, h - 8);
  ctx.save();
  ctx.translate(18, h - 8);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Output (dBFS) →', 0, 0);
  ctx.restore();
}

// ─── Summary Computation ───────────────────────────────────────────────────

function computeSummary() {
  if (logData.length === 0) return;

  const currentPresetLogs = logData.filter(e => e.preset === currentPresetKey);
  if (currentPresetLogs.length === 0) return;

  const clipping = currentPresetLogs.filter(e => e.clipped).length;
  const avgLoudness = currentPresetLogs.reduce((s, e) => s + e.outRMS, 0) / currentPresetLogs.length;
  const peakOutput = Math.max(...currentPresetLogs.map(e => e.outPeak));
  const voiced = currentPresetLogs.filter(e => e.outRMS > -50);
  const dynRange = voiced.length > 0
    ? Math.max(...voiced.map(e => e.outRMS)) - Math.min(...voiced.map(e => e.outRMS))
    : 0;
  const avgGR = currentPresetLogs.reduce((s, e) => s + e.gr, 0) / currentPresetLogs.length;

  const el = (id, text, cls) => {
    const e = document.getElementById(id);
    e.textContent = text;
    e.className = 'stat-value' + (cls ? ' ' + cls : '');
  };

  const avgBass = voiced.length > 0 ? voiced.reduce((s, e) => s + e.outBass, 0) / voiced.length : -100;
  const avgMid = voiced.length > 0 ? voiced.reduce((s, e) => s + e.outMid, 0) / voiced.length : -100;
  const avgTreble = voiced.length > 0 ? voiced.reduce((s, e) => s + e.outTreble, 0) / voiced.length : -100;
  const avgCentroid = voiced.length > 0 ? voiced.reduce((s, e) => s + e.centroid, 0) / voiced.length : 0;

  el('statClipping', clipping, clipping > 0 ? 'bad' : 'ok');
  el('statLoudness', `${avgLoudness.toFixed(1)} dBFS`);
  el('statDynRange', `${dynRange.toFixed(1)} dB`);
  el('statPeak', `${peakOutput.toFixed(1)} dBFS`, peakOutput > -0.5 ? 'warn' : 'ok');
  el('statGR', `${avgGR.toFixed(1)} dB`);
  el('statBass', `${avgBass.toFixed(1)} dBFS`);
  el('statMid', `${avgMid.toFixed(1)} dBFS`);
  el('statTreble', `${avgTreble.toFixed(1)} dBFS`);
  el('statCentroid', `${avgCentroid.toFixed(0)} Hz`);

  drawTransferCurve();
}

// ─── Playback Controls ─────────────────────────────────────────────────────

function applyPreset(key) {
  currentPresetKey = key;
  presetSelect.value = key;
  const preset = presets[key];

  teardownChain();
  chain = buildChain(preset);

  if (preset.autoGainEnabled) startAgc(preset);
  if (preset.gateEnabled) startGate(preset);
}

async function play() {
  if (!mediaElement || !fileLoaded) return;

  try {
    applyPreset(currentPresetKey);

    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    mediaElement.currentTime = 0;
    await mediaElement.play();
    isPlaying = true;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    waveHistory = [];

    if (!meterAnimId) updateMeters();
  } catch (err) {
    console.error('Play failed:', err);
    runStatus.textContent = `Error: ${err.message}`;
  }
}

function stop() {
  if (mediaElement) mediaElement.pause();
  isPlaying = false;
  playBtn.disabled = false;
  stopBtn.disabled = true;

  computeSummary();
}

function onPlaybackEnded() {
  isPlaying = false;
  playBtn.disabled = false;
  stopBtn.disabled = true;
  computeSummary();

  if (isRunningAll) {
    runNextPreset();
  }
}

// ─── Run All Presets ───────────────────────────────────────────────────────

let runAllQueue = [];

async function runAll() {
  if (!fileLoaded) return;
  isRunningAll = true;
  runAllQueue = [...PRESET_ORDER];
  logData = [];
  runAllBtn.disabled = true;
  runNextPreset();
}

async function runNextPreset() {
  if (runAllQueue.length === 0) {
    isRunningAll = false;
    runAllBtn.disabled = false;
    playBtn.disabled = false;
    runStatus.textContent = `Done! ${logData.length.toLocaleString()} frames logged across ${PRESET_ORDER.length} presets.`;
    computeSummary();
    document.getElementById('dlJson').disabled = false;
    document.getElementById('dlCsv').disabled = false;
    return;
  }

  const key = runAllQueue.shift();
  const remaining = runAllQueue.length;
  runStatus.textContent = `Running: ${presets[key].name} (${PRESET_ORDER.length - remaining}/${PRESET_ORDER.length})`;

  try {
    applyPreset(key);
    mediaElement.currentTime = 0;
    await mediaElement.play();
    isPlaying = true;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    waveHistory = [];
  } catch (err) {
    console.error(`Failed to play preset ${key}:`, err);
    runStatus.textContent = `Error on ${presets[key].name}: ${err.message}. Skipping...`;
    // Skip to next preset after a short delay
    setTimeout(() => runNextPreset(), 500);
  }
}

// ─── Event Listeners ───────────────────────────────────────────────────────

playBtn.addEventListener('click', play);
stopBtn.addEventListener('click', stop);
runAllBtn.addEventListener('click', runAll);
presetSelect.addEventListener('change', (e) => {
  currentPresetKey = e.target.value;
  if (isPlaying) applyPreset(currentPresetKey);
});

document.getElementById('clearLogs').addEventListener('click', () => {
  logData = [];
  document.getElementById('statEntries').textContent = '0';
});

document.getElementById('dlJson').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `limitr-log-${Date.now()}.json`);
});

document.getElementById('dlCsv').addEventListener('click', () => {
  if (logData.length === 0) return;
  const headers = Object.keys(logData[0]);
  const rows = logData.map(e => headers.map(h => e[h]).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `limitr-log-${Date.now()}.csv`);
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Extension BroadcastChannel Listener ───────────────────────────────────

const isExtensionPage = location.protocol === 'chrome-extension:';

if (isExtensionPage) {
  document.getElementById('extStatus').textContent = 'Listening for extension processing data...';
  document.getElementById('extNote').textContent = 'Running inside extension — BroadcastChannel active. Play audio in another tab with Limitr enabled to see live data.';
  try {
    extChannel = new BroadcastChannel('limitr-debug');
    extChannel.onmessage = (event) => {
      extLastData = event.data;
      extLastTime = performance.now();
      document.getElementById('extIndicator').classList.add('active');
      document.getElementById('extStatus').textContent =
        `Live! AGC: ${event.data.agcGain?.toFixed(1) ?? '--'}dB | GR: ${event.data.gr?.toFixed(1) ?? '--'}dB | Gate: ${event.data.gateOpen ? 'open' : 'closed'}`;
    };
    setInterval(() => {
      if (extLastTime && performance.now() - extLastTime > 2000) {
        document.getElementById('extIndicator').classList.remove('active');
        document.getElementById('extStatus').textContent = 'Channel idle (no active processing >2s)';
      }
    }, 1000);
  } catch (e) {
    document.getElementById('extStatus').textContent = 'BroadcastChannel error: ' + e.message;
  }
} else {
  document.getElementById('extStatus').textContent = 'Standalone mode (no extension link)';
  document.getElementById('extNote').textContent = 'Open via right-click on Limitr icon → "Debug Harness" for live extension data.';
}

// Start meter loop
updateMeters();
