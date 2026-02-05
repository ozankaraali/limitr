#!/usr/bin/env node
// Limitr Preset Level Calculator
// Offline simulation of the audio processing chain for all presets
// Run: node tests/preset-levels.js
//
// Signal chain modeled:
//   inputDb -> compress(threshold, ratio, knee) -> +makeupGain -> AGC(target, maxGain) -> limiter(ceiling) -> +outputGain -> finalDb

'use strict';

// ─── AGC Profiles (from offscreen.js:299-302) ───────────────────────────────
// Only maxGain matters for steady-state (converged) simulation
const AGC_PROFILES = {
  slow:   { maxGain: 6 },   // +15.6 dB cap
  normal: { maxGain: 6 },   // +15.6 dB cap
  fast:   { maxGain: 4 }    // +12.0 dB cap
};

// ─── All 13 Presets (extracted from popup.js) ────────────────────────────────
// For multiband presets, mid-band params are used (dominant speech range)
const presets = {
  off: {
    name: 'Off',
    compressorEnabled: false, multibandEnabled: false,
    threshold: 0, ratio: 1, knee: 0,
    makeupGain: 0, gainEnabled: true,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    limiterEnabled: false, limiterThreshold: -1,
    // Multiband mid-band (unused, for completeness)
    midThreshold: -24, midRatio: 4, midGain: 0
  },
  music: {
    name: 'Music',
    compressorEnabled: true, multibandEnabled: false,
    threshold: -20, ratio: 3, knee: 20,
    makeupGain: 2, gainEnabled: true,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -0.5
  },
  lofi: {
    name: 'Lo-Fi',
    compressorEnabled: true, multibandEnabled: false,
    threshold: -25, ratio: 3, knee: 20,
    makeupGain: 2, gainEnabled: true,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -1
  },
  streamWatch: {
    name: 'Stream Watch',
    compressorEnabled: true, multibandEnabled: false,
    threshold: -28, ratio: 5, knee: 10,
    makeupGain: 0, gainEnabled: true,
    autoGainEnabled: true, autoGainTarget: -20, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -3
  },
  podcast: {
    name: 'Podcast',
    compressorEnabled: true, multibandEnabled: false,
    threshold: -30, ratio: 5, knee: 10,
    makeupGain: 0, gainEnabled: true,
    autoGainEnabled: true, autoGainTarget: -18, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -1
  },
  voiceFocus: {
    name: 'Voice Focus',
    compressorEnabled: false, multibandEnabled: true,
    threshold: 0, ratio: 1, knee: 12,  // Global unused; knee shared
    // Mid-band (200-3000Hz) — dominant speech range
    midThreshold: -35, midRatio: 3, midGain: 4,
    makeupGain: 0, gainEnabled: true,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -1
  },
  movie: {
    name: 'Movie',
    compressorEnabled: false, multibandEnabled: true,
    threshold: 0, ratio: 1, knee: 12,
    midThreshold: -30, midRatio: 3, midGain: 2,
    makeupGain: 0, gainEnabled: true,
    autoGainEnabled: true, autoGainTarget: -18, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -1
  },
  bassTamer: {
    name: 'Bass Tamer',
    compressorEnabled: true, multibandEnabled: false,
    threshold: -30, ratio: 10, knee: 8,
    makeupGain: 4, gainEnabled: true,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -1
  },
  tv90s: {
    name: '90s TV',
    compressorEnabled: true, multibandEnabled: false,
    threshold: -35, ratio: 15, knee: 6,
    makeupGain: 5, gainEnabled: true,
    autoGainEnabled: false, autoGainTarget: -16, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -2
  },
  streamSafe: {
    name: 'Stream Safe',
    compressorEnabled: false, multibandEnabled: true,
    threshold: 0, ratio: 1, knee: 6,  // knee: 6 explicitly
    midThreshold: -25, midRatio: 4, midGain: 2,
    makeupGain: 0, gainEnabled: true,
    autoGainEnabled: true, autoGainTarget: -20, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -6
  },
  antiScream: {
    name: 'Anti-Scream',
    compressorEnabled: true, multibandEnabled: false,
    threshold: -35, ratio: 12, knee: 6,
    makeupGain: 0, gainEnabled: true,
    autoGainEnabled: true, autoGainTarget: -10, autoGainSpeed: 'fast',
    limiterEnabled: true, limiterThreshold: -6
  },
  nightMode: {
    name: 'Night Mode',
    compressorEnabled: true, multibandEnabled: false,
    threshold: -28, ratio: 8, knee: 6,
    makeupGain: 0, gainEnabled: true,
    autoGainEnabled: true, autoGainTarget: -20, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -3
  },
  sleep: {
    name: 'Sleep',
    compressorEnabled: true, multibandEnabled: false,
    threshold: -30, ratio: 6, knee: 6,
    makeupGain: 0, gainEnabled: true,
    autoGainEnabled: true, autoGainTarget: -24, autoGainSpeed: 'normal',
    limiterEnabled: true, limiterThreshold: -6
  }
};

// Ordered lightest -> heaviest (per MEMORY.md)
const PRESET_ORDER = [
  'off', 'music', 'lofi', 'streamWatch', 'podcast', 'voiceFocus',
  'movie', 'bassTamer', 'tv90s', 'streamSafe', 'antiScream', 'nightMode', 'sleep'
];

// Test input levels (dBFS)
const INPUT_LEVELS = [-60, -50, -40, -30, -20, -10, 0];

// ─── Core Math Functions ─────────────────────────────────────────────────────

/**
 * W3C DynamicsCompressor soft-knee compression.
 * Knee region is centered on threshold.
 *
 * Below (threshold - knee/2): output = input (unity)
 * In knee region: quadratic interpolation
 * Above (threshold + knee/2): output = threshold + (input - threshold) / ratio
 */
function compress(inputDb, threshold, ratio, knee) {
  if (ratio <= 1) return inputDb;

  if (knee <= 0) {
    // Hard knee
    if (inputDb <= threshold) return inputDb;
    return threshold + (inputDb - threshold) / ratio;
  }

  const kneeStart = threshold - knee / 2;
  const kneeEnd = threshold + knee / 2;

  if (inputDb < kneeStart) {
    return inputDb;
  } else if (inputDb > kneeEnd) {
    return threshold + (inputDb - threshold) / ratio;
  } else {
    // Soft knee region: quadratic interpolation
    const xk = inputDb - kneeStart;
    return inputDb + xk * xk * (1 / ratio - 1) / (2 * knee);
  }
}

/**
 * Steady-state AGC (converged).
 * boost = target - level, clamped to [-20dB, 20*log10(maxGain)]
 * Inactive below -60dB (per offscreen.js:331)
 */
function agc(levelDb, targetDb, maxGainLinear) {
  if (levelDb <= -60) return levelDb;  // AGC inactive in silence

  const maxBoostDb = 20 * Math.log10(maxGainLinear);
  const diffDb = targetDb - levelDb;
  const clampedBoost = Math.max(-20, Math.min(maxBoostDb, diffDb));
  return levelDb + clampedBoost;
}

/**
 * Brick-wall limiter: clamps to ceiling.
 */
function limit(levelDb, ceilingDb) {
  return Math.min(levelDb, ceilingDb);
}

// ─── Process Chain ───────────────────────────────────────────────────────────

/**
 * Process a single input level through a preset's chain.
 * Returns an object with intermediate and final levels.
 */
function processLevel(inputDb, preset) {
  let compressed = inputDb;
  let afterMakeup = inputDb;
  let afterAgc = inputDb;
  let afterLimiter = inputDb;
  let finalDb = inputDb;

  // Step 1: Compression
  if (preset.multibandEnabled) {
    // Multiband: use mid-band params (dominant speech range)
    const thresh = preset.midThreshold;
    const ratio = preset.midRatio;
    const knee = preset.knee || 12;  // Default knee for multiband
    compressed = compress(inputDb, thresh, ratio, knee);
    // Add mid-band gain (equivalent to makeup for this band)
    afterMakeup = compressed + (preset.midGain || 0);
  } else if (preset.compressorEnabled) {
    compressed = compress(inputDb, preset.threshold, preset.ratio, preset.knee);
    // Add makeup gain (if gainEnabled)
    afterMakeup = compressed + (preset.gainEnabled ? (preset.makeupGain || 0) : 0);
  } else {
    compressed = inputDb;
    afterMakeup = inputDb;
  }

  // Step 2: AGC (steady-state)
  if (preset.autoGainEnabled) {
    const profile = AGC_PROFILES[preset.autoGainSpeed] || AGC_PROFILES.normal;
    afterAgc = agc(afterMakeup, preset.autoGainTarget, profile.maxGain);
  } else {
    afterAgc = afterMakeup;
  }

  // Step 3: Limiter
  if (preset.limiterEnabled) {
    afterLimiter = limit(afterAgc, preset.limiterThreshold);
  } else {
    afterLimiter = afterAgc;
  }

  // Step 4: Output gain (defaults to 0 dB — user setting, not part of presets)
  finalDb = afterLimiter;

  return { inputDb, compressed, afterMakeup, afterAgc, afterLimiter, finalDb };
}

// ─── Output Formatting ──────────────────────────────────────────────────────

function pad(str, width) {
  return String(str).padStart(width);
}

function fmtDb(val) {
  return val.toFixed(1);
}

// ─── Run All Presets ─────────────────────────────────────────────────────────

function runAllPresets() {
  const allResults = {};

  for (const key of PRESET_ORDER) {
    const preset = presets[key];
    const results = INPUT_LEVELS.map(db => processLevel(db, preset));
    allResults[key] = results;

    // Describe compression type
    let compType = 'none';
    if (preset.multibandEnabled) {
      compType = `multiband mid (${preset.midThreshold}dB, ${preset.midRatio}:1, knee:${preset.knee || 12})`;
    } else if (preset.compressorEnabled) {
      compType = `single (${preset.threshold}dB, ${preset.ratio}:1, knee:${preset.knee})`;
    }

    const agcDesc = preset.autoGainEnabled
      ? `AGC ${preset.autoGainTarget}dB ${preset.autoGainSpeed} (max +${(20 * Math.log10((AGC_PROFILES[preset.autoGainSpeed] || AGC_PROFILES.normal).maxGain)).toFixed(1)}dB)`
      : 'off';
    const limDesc = preset.limiterEnabled ? `${preset.limiterThreshold}dB` : 'off';

    console.log(`\n=== ${preset.name} [${key}] ===`);
    console.log(`  Compression: ${compType}`);
    console.log(`  Makeup: ${preset.makeupGain || 0}dB | AGC: ${agcDesc} | Limiter: ${limDesc}`);
    console.log('  ─────────────────────────────────────────────────────────────────');
    console.log('  Input    Compress   +Makeup    AGC\'d    Limited    Final');

    for (const r of results) {
      console.log(
        `  ${pad(fmtDb(r.inputDb), 7)}` +
        `  ${pad(fmtDb(r.compressed), 9)}` +
        `  ${pad(fmtDb(r.afterMakeup), 8)}` +
        `  ${pad(fmtDb(r.afterAgc), 8)}` +
        `  ${pad(fmtDb(r.afterLimiter), 8)}` +
        `  ${pad(fmtDb(r.finalDb), 8)}`
      );
    }
  }

  return allResults;
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

/**
 * Check for dynamic inversions: louder input producing quieter output.
 * Flag any preset where final[i] > final[i+1] when input[i] < input[i+1]
 */
function checkInversions(allResults) {
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('  INVERSION CHECK');
  console.log('  (quieter input -> louder output = BAD)');
  console.log('════════════════════════════════════════════════════════════════');

  let anyFound = false;

  for (const key of PRESET_ORDER) {
    const results = allResults[key];
    const preset = presets[key];
    const inversions = [];

    for (let i = 0; i < results.length - 1; i++) {
      if (results[i].inputDb < results[i + 1].inputDb &&
          results[i].finalDb > results[i + 1].finalDb) {
        inversions.push({
          quietInput: results[i].inputDb,
          quietOutput: results[i].finalDb,
          loudInput: results[i + 1].inputDb,
          loudOutput: results[i + 1].finalDb
        });
      }
    }

    if (inversions.length > 0) {
      anyFound = true;
      console.log(`\n  !! ${preset.name}: ${inversions.length} inversion(s)`);
      for (const inv of inversions) {
        console.log(
          `     Input ${fmtDb(inv.quietInput)} -> ${fmtDb(inv.quietOutput)} dB, ` +
          `but input ${fmtDb(inv.loudInput)} -> ${fmtDb(inv.loudOutput)} dB`
        );
      }
    }
  }

  if (!anyFound) {
    console.log('\n  NONE found. All presets are monotonic.');
  }
}

/**
 * Loudness ranking: average final level at speech-range inputs (-30, -20, -10 dB).
 */
function loudnessRanking(allResults) {
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('  LOUDNESS RANKING');
  console.log('  (average final dB at -30, -20, -10 inputs — quietest first)');
  console.log('════════════════════════════════════════════════════════════════');

  const speechInputs = [-30, -20, -10];
  const rankings = [];

  for (const key of PRESET_ORDER) {
    const results = allResults[key];
    const preset = presets[key];

    const speechResults = results.filter(r => speechInputs.includes(r.inputDb));
    const avgFinal = speechResults.reduce((sum, r) => sum + r.finalDb, 0) / speechResults.length;
    rankings.push({ name: preset.name, key, avgFinal });
  }

  rankings.sort((a, b) => a.avgFinal - b.avgFinal);

  for (let i = 0; i < rankings.length; i++) {
    const r = rankings[i];
    console.log(`  ${pad(i + 1, 3)}. ${r.name.padEnd(15)} avg: ${fmtDb(r.avgFinal)} dBFS`);
  }
}

/**
 * Dynamic range: final(0dB input) - final(-30dB input) per preset.
 */
function dynamicRange(allResults) {
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('  DYNAMIC RANGE');
  console.log('  (final at 0dB input - final at -30dB input)');
  console.log('════════════════════════════════════════════════════════════════');

  const rankings = [];

  for (const key of PRESET_ORDER) {
    const results = allResults[key];
    const preset = presets[key];

    const at0 = results.find(r => r.inputDb === 0);
    const atMinus30 = results.find(r => r.inputDb === -30);

    if (at0 && atMinus30) {
      const range = at0.finalDb - atMinus30.finalDb;
      rankings.push({ name: preset.name, key, range, at0: at0.finalDb, atMinus30: atMinus30.finalDb });
    }
  }

  rankings.sort((a, b) => b.range - a.range);

  for (const r of rankings) {
    const bar = '█'.repeat(Math.max(0, Math.round(r.range)));
    console.log(
      `  ${r.name.padEnd(15)} ${pad(fmtDb(r.range), 6)} dB  ` +
      `(${fmtDb(r.atMinus30)} -> ${fmtDb(r.at0)})  ${bar}`
    );
  }
}

/**
 * Clipping risk: flag any preset where final > 0dBFS.
 */
function clippingRisk(allResults) {
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('  CLIPPING RISK');
  console.log('  (any preset where final > 0 dBFS)');
  console.log('════════════════════════════════════════════════════════════════');

  let anyClipping = false;

  for (const key of PRESET_ORDER) {
    const results = allResults[key];
    const preset = presets[key];

    const clipped = results.filter(r => r.finalDb > 0);
    if (clipped.length > 0) {
      anyClipping = true;
      const worstCase = Math.max(...clipped.map(r => r.finalDb));
      console.log(`  !! ${preset.name}: peak ${fmtDb(worstCase)} dBFS at inputs ${clipped.map(r => fmtDb(r.inputDb)).join(', ')}`);
    }
  }

  if (!anyClipping) {
    console.log('\n  No clipping risk detected. All outputs <= 0 dBFS.');
  }
}

/**
 * Compression amount: how much gain reduction at various levels.
 */
function compressionSummary(allResults) {
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('  COMPRESSION SUMMARY');
  console.log('  (gain reduction in dB at key input levels)');
  console.log('════════════════════════════════════════════════════════════════');

  console.log(`  ${'Preset'.padEnd(15)} ${pad('-40dB', 7)} ${pad('-30dB', 7)} ${pad('-20dB', 7)} ${pad('-10dB', 7)} ${pad('0dB', 7)}`);
  console.log('  ' + '─'.repeat(55));

  for (const key of PRESET_ORDER) {
    const results = allResults[key];
    const preset = presets[key];

    const levels = [-40, -30, -20, -10, 0];
    const reductions = levels.map(lev => {
      const r = results.find(x => x.inputDb === lev);
      if (!r) return '  N/A';
      const gr = r.compressed - r.inputDb;
      return pad(fmtDb(gr), 7);
    });

    console.log(`  ${preset.name.padEnd(15)} ${reductions.join(' ')}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║           Limitr Preset Level Calculator                     ║');
console.log('║  Offline simulation of audio processing chain                ║');
console.log('║  Chain: Input -> Compress -> +Makeup -> AGC -> Limiter       ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');

const allResults = runAllPresets();

checkInversions(allResults);
loudnessRanking(allResults);
dynamicRange(allResults);
clippingRisk(allResults);
compressionSummary(allResults);

console.log('\n\nDone.');
