#!/usr/bin/env node
// Analyze scream suppression from debug harness CSV log
const fs = require('fs');

const csv = fs.readFileSync(process.argv[2] || 'limitr-log-1770324771025.csv', 'utf8');
const lines = csv.trim().split('\n');
const headers = lines[0].split(',');
const rows = lines.slice(1).map(line => {
  const vals = line.split(',');
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = h === 'preset' || h === 'clipped' || h === 'gateOpen' ? vals[i] : parseFloat(vals[i]);
  });
  obj.clipped = obj.clipped === 'true';
  obj.gateOpen = obj.gateOpen === 'true';
  return obj;
});

// Group by preset
const presets = {};
rows.forEach(r => {
  if (!presets[r.preset]) presets[r.preset] = [];
  presets[r.preset].push(r);
});

// Detect screams: frames where inRMS jumps above a threshold (loud transients)
// Use the "off" preset as baseline to find scream timestamps
const offFrames = presets['off'] || [];
const SCREAM_THRESHOLD_RMS = -15; // dBFS — screams are usually very loud
const SCREAM_THRESHOLD_PEAK = -6;

console.log('=== SCREAM DETECTION (from "off" preset baseline) ===\n');

// Find scream regions in off preset
let inScream = false;
let screamStart = 0;
const screams = [];
offFrames.forEach((f, i) => {
  const isLoud = f.inRMS > SCREAM_THRESHOLD_RMS || f.inPeak > SCREAM_THRESHOLD_PEAK;
  if (isLoud && !inScream) {
    inScream = true;
    screamStart = f.t;
  } else if (!isLoud && inScream) {
    inScream = false;
    screams.push({ start: screamStart, end: f.t });
  }
});
if (inScream) screams.push({ start: screamStart, end: offFrames[offFrames.length - 1].t });

console.log(`Detected ${screams.length} scream region(s) in "off" baseline:`);
screams.forEach((s, i) => {
  const dur = ((s.end - s.start) / 1000).toFixed(1);
  console.log(`  Scream ${i + 1}: ${(s.start / 1000).toFixed(1)}s – ${(s.end / 1000).toFixed(1)}s (${dur}s)`);
});

// For each preset, analyze behavior during scream windows and quiet periods
console.log('\n=== PER-PRESET SCREAM ANALYSIS ===\n');
console.log('Preset'.padEnd(16) +
  'InPk'.padStart(7) + 'OutPk'.padStart(7) + 'ΔPeak'.padStart(7) +
  'InRMS'.padStart(7) + 'OutRMS'.padStart(8) + 'ΔRMS'.padStart(7) +
  'MaxGR'.padStart(7) + 'AvgGR'.padStart(7) + 'AGC'.padStart(6) +
  'LimGR'.padStart(7) + 'Clip%'.padStart(7) + 'Clip#'.padStart(6));
console.log('-'.repeat(100));

const presetOrder = ['off', 'music', 'lofi', 'streamWatch', 'podcast', 'voiceFocus',
  'movie', 'bassTamer', 'tv90s', 'streamSafe', 'antiScream', 'nightMode', 'sleep'];

// Also compute quiet-period stats for comparison
const results = {};

for (const name of presetOrder) {
  const frames = presets[name];
  if (!frames) continue;

  // Separate scream frames from quiet frames using relative timing
  // Map scream windows from off-preset time to this preset's time proportionally
  const tStart = frames[0].t;
  const tEnd = frames[frames.length - 1].t;
  const offStart = offFrames[0]?.t || 0;
  const offEnd = offFrames[offFrames.length - 1]?.t || 1;

  // Find the loudest frames as screams (top 10% by inRMS, or frames above threshold)
  const screamFrames = frames.filter(f => f.inRMS > SCREAM_THRESHOLD_RMS || f.inPeak > SCREAM_THRESHOLD_PEAK);
  const quietFrames = frames.filter(f => f.inRMS <= SCREAM_THRESHOLD_RMS && f.inPeak <= SCREAM_THRESHOLD_PEAK && f.inRMS > -60);

  if (screamFrames.length === 0) {
    // No screams detected in this preset's data — skip or show minimal
    continue;
  }

  const avg = (arr, key) => arr.reduce((s, f) => s + f[key], 0) / arr.length;
  const max = (arr, key) => Math.max(...arr.map(f => f[key]));
  const min = (arr, key) => Math.min(...arr.map(f => f[key]));
  const pct = (arr, fn) => (arr.filter(fn).length / arr.length * 100);

  const inPeak = max(screamFrames, 'inPeak');
  const outPeak = max(screamFrames, 'outPeak');
  const inRMS = avg(screamFrames, 'inRMS');
  const outRMS = avg(screamFrames, 'outRMS');
  const maxGR = min(screamFrames, 'gr'); // GR is negative
  const avgGR = avg(screamFrames, 'gr');
  const agc = avg(screamFrames, 'agcGain');
  const limGR = min(screamFrames, 'limiterGR');
  const clipPct = pct(screamFrames, f => f.clipped);
  const clipCount = screamFrames.filter(f => f.clipped).length;

  results[name] = {
    screamFrames: screamFrames.length,
    quietFrames: quietFrames.length,
    inPeak, outPeak, inRMS, outRMS, maxGR, avgGR, agc, limGR, clipPct, clipCount,
    quietOutRMS: quietFrames.length > 0 ? avg(quietFrames, 'outRMS') : null,
    quietOutPeak: quietFrames.length > 0 ? max(quietFrames, 'outPeak') : null
  };

  console.log(
    name.padEnd(16) +
    inPeak.toFixed(1).padStart(7) +
    outPeak.toFixed(1).padStart(7) +
    (outPeak - inPeak).toFixed(1).padStart(7) +
    inRMS.toFixed(1).padStart(7) +
    outRMS.toFixed(1).padStart(8) +
    (outRMS - inRMS).toFixed(1).padStart(7) +
    maxGR.toFixed(1).padStart(7) +
    avgGR.toFixed(1).padStart(7) +
    agc.toFixed(1).padStart(6) +
    limGR.toFixed(1).padStart(7) +
    clipPct.toFixed(1).padStart(7) +
    String(clipCount).padStart(6)
  );
}

// Quiet period comparison
console.log('\n=== QUIET PERIOD BEHAVIOR (non-scream frames, inRMS > -60dBFS) ===\n');
console.log('Preset'.padEnd(16) + 'InRMS'.padStart(7) + 'OutRMS'.padStart(8) + 'ΔRMS'.padStart(7) +
  'OutPk'.padStart(7) + 'AGC'.padStart(6) + 'Frames'.padStart(8));
console.log('-'.repeat(60));

for (const name of presetOrder) {
  const r = results[name];
  if (!r || !r.quietOutRMS) continue;
  const frames = presets[name];
  const quietFrames = frames.filter(f => f.inRMS <= SCREAM_THRESHOLD_RMS && f.inPeak <= SCREAM_THRESHOLD_PEAK && f.inRMS > -60);
  const avg = (arr, key) => arr.reduce((s, f) => s + f[key], 0) / arr.length;

  const inRMS = avg(quietFrames, 'inRMS');
  const outRMS = r.quietOutRMS;
  const agc = avg(quietFrames, 'agcGain');

  console.log(
    name.padEnd(16) +
    inRMS.toFixed(1).padStart(7) +
    outRMS.toFixed(1).padStart(8) +
    (outRMS - inRMS).toFixed(1).padStart(7) +
    r.quietOutPeak.toFixed(1).padStart(7) +
    agc.toFixed(1).padStart(6) +
    String(quietFrames.length).padStart(8)
  );
}

// Scream suppression ranking
console.log('\n=== SCREAM SUPPRESSION RANKING (by peak reduction) ===\n');
const ranked = Object.entries(results)
  .filter(([n]) => n !== 'off')
  .map(([name, r]) => ({ name, peakDelta: r.outPeak - r.inPeak, rmsDelta: r.outRMS - r.inRMS, ...r }))
  .sort((a, b) => a.peakDelta - b.peakDelta);

ranked.forEach((r, i) => {
  const verdict = r.outPeak > -3 ? '⚠ STILL LOUD' : r.outPeak > -6 ? '~ marginal' : '✓ controlled';
  console.log(`${(i + 1 + '.').padEnd(4)} ${r.name.padEnd(16)} Peak: ${r.inPeak.toFixed(1)} → ${r.outPeak.toFixed(1)} (${r.peakDelta.toFixed(1)}dB)  RMS: ${r.inRMS.toFixed(1)} → ${r.outRMS.toFixed(1)} (${r.rmsDelta.toFixed(1)}dB)  ${verdict}`);
});

// Detailed frame-by-frame for anti-scream during scream moments
console.log('\n=== ANTI-SCREAM DETAIL (frame-by-frame during screams) ===\n');
const asFrames = presets['antiScream'];
if (asFrames) {
  const loud = asFrames.filter(f => f.inRMS > SCREAM_THRESHOLD_RMS || f.inPeak > SCREAM_THRESHOLD_PEAK);
  console.log('Time(s)   InRMS  InPk  OutRMS OutPk   GR    AGC  LimGR  Clip');
  console.log('-'.repeat(75));
  loud.forEach(f => {
    console.log(
      (f.t / 1000).toFixed(2).padStart(7) +
      f.inRMS.toFixed(1).padStart(8) +
      f.inPeak.toFixed(1).padStart(6) +
      f.outRMS.toFixed(1).padStart(8) +
      f.outPeak.toFixed(1).padStart(6) +
      f.gr.toFixed(1).padStart(6) +
      f.agcGain.toFixed(1).padStart(7) +
      f.limiterGR.toFixed(1).padStart(7) +
      (f.clipped ? '  YES' : '')
    );
  });
}

// Check if compressor is even engaging during screams
console.log('\n=== COMPRESSOR ENGAGEMENT DURING SCREAMS ===\n');
for (const name of ['streamSafe', 'antiScream', 'nightMode', 'sleep']) {
  const frames = presets[name];
  if (!frames) continue;
  const loud = frames.filter(f => f.inRMS > SCREAM_THRESHOLD_RMS || f.inPeak > SCREAM_THRESHOLD_PEAK);
  if (loud.length === 0) continue;

  const avgGR = loud.reduce((s, f) => s + f.gr, 0) / loud.length;
  const maxGR = Math.min(...loud.map(f => f.gr));
  const avgLimGR = loud.reduce((s, f) => s + f.limiterGR, 0) / loud.length;
  const maxLimGR = Math.min(...loud.map(f => f.limiterGR));
  const avgMbSub = loud.reduce((s, f) => s + (f.grSub || 0), 0) / loud.length;
  const avgMbMid = loud.reduce((s, f) => s + (f.grMid || 0), 0) / loud.length;
  const avgMbHigh = loud.reduce((s, f) => s + (f.grHigh || 0), 0) / loud.length;

  console.log(`${name}:`);
  console.log(`  Compressor: avg ${avgGR.toFixed(1)}dB, max ${maxGR.toFixed(1)}dB`);
  console.log(`  Limiter:    avg ${avgLimGR.toFixed(1)}dB, max ${maxLimGR.toFixed(1)}dB`);
  if (avgMbSub || avgMbMid || avgMbHigh) {
    console.log(`  Multiband:  sub ${avgMbSub.toFixed(1)}dB, mid ${avgMbMid.toFixed(1)}dB, high ${avgMbHigh.toFixed(1)}dB`);
  }
  console.log();
}
