# Noise Gate — Design Notes (Not Implementing Yet)

## Status: Pending testing
After the preset tuning fixes (zeroed makeup gain on AGC presets, reduced Stream Safe aggressiveness), the noise floor issue may be resolved. Need to test before deciding if a gate is needed.

## Context
- In Vocal Suite Software, the gate was at the *beginning* of the chain to reduce input floor noise before processing
- In Limitr, the concern is about *output* noise — artifacts exposed by heavy compression + EQ cuts (e.g., Stream Safe's presence cuts unmasking hiss)
- The recent fixes (lighter EQ cuts, less aggressive multiband, normal AGC speed) may have already addressed this

## Implementation Approach (if needed)
A noise gate is trivial compared to RNNoise. No new worklet required.

### Option A: Reuse AGC pattern (simplest)
The AGC already uses `AnalyserNode` + `GainNode` + `setInterval`. A gate is the same pattern inverted:
- Measure RMS via AnalyserNode
- If RMS < gateThreshold → ramp GainNode to 0 (with hold + release smoothing)
- If RMS >= gateThreshold → ramp GainNode to 1 (with attack smoothing)

### Option B: AudioWorkletProcessor (more precise)
- Sample-accurate gating with per-sample envelope follower
- Better for fast transients, but probably overkill for output noise gating

### Chain Position
- **Before compression** (Vocal Suite Software style): catches input noise before it gets amplified. Better for mic-like scenarios.
- **After compression, before output**: catches noise floor exposed by heavy compression. Better for Limitr's use case.
- **After AGC, before limiter**: catches AGC-amplified noise. Most targeted position.

Recommended: after AGC, before limiter. This is where noise exposure is worst.

### Settings
```
gateEnabled: false      // off by default
gateThreshold: -50      // dB below which audio is considered noise
gateHold: 100           // ms to keep gate open after signal drops
gateRelease: 200        // ms fade-out when gate closes
```

### UI
- Add to Exclusive Features group (since it would use AnalyserNode, same as AGC)
- Toggle + threshold slider, maybe hold/release for advanced users
- Or: just a simple on/off with a single sensitivity slider

## Decision
Test the current fixes first. If Sleep/Night Mode/Stream Safe still expose noise floor artifacts, then implement. If clean, skip it.
