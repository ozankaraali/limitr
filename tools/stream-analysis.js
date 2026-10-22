// What stands out in a recorded stream, for labelling the dataset: per 400 ms block (every
// 100 ms) its K-weighted loudness (BS.1770) and how much of its sound sits above 4 kHz, where
// harshness lives (a clipping mic's distortion, cymbals, crowds, shrill alerts); the stream's
// talking level; and the moments that are much louder than the talking, or harsh. Shared by
// tools/label-dataset.html (in the page) and tools/autotag-dataset.js (in Node).
(function (root) {
  'use strict';

  const LOUDER_DB = 8;          // louder than the talking by this much: too loud
  const BRIGHTER_DB = 6;        // brighter than the stream's usual talking by this much: harsh...
  const BRIGHT_SHARE_DB = -12;  // ...or this much of the sound above 4 kHz, whatever the stream
  const AUDIBLE_DB = -10;       // harsh only counts within this much of the talking level
  const JOIN_S = 1;             // runs closer than this are one moment

  // One biquad (transposed direct form II) over a whole channel
  function biquad(x, [b0, b1, b2, a1, a2]) {
    const y = new Float32Array(x.length);
    let z1 = 0, z2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + z1;
      z1 = b1 * x[i] - a1 * v + z2;
      z2 = b2 * x[i] - a2 * v;
      y[i] = v;
    }
    return y;
  }

  function coefficients(fs) {
    // BS.1770 K-weighting: a high shelf, then the RLB high-pass (unnormalised numerator)
    let K = Math.tan(Math.PI * 1681.974450955533 / fs);
    let Q = 0.7071752369554196;
    const Vh = Math.pow(10, 3.999843853973347 / 20);
    const Vb = Math.pow(Vh, 0.4996667741545416);
    let a0 = 1 + K / Q + K * K;
    const shelf = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0,
      2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
    K = Math.tan(Math.PI * 38.13547087602444 / fs);
    Q = 0.5003270373238773;
    a0 = 1 + K / Q + K * K;
    const rlb = [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
    // A Butterworth high-pass at 4 kHz, used twice (24 dB per octave)
    K = Math.tan(Math.PI * 4000 / fs);
    a0 = 1 + K * Math.SQRT2 + K * K;
    const high = [1 / a0, -2 / a0, 1 / a0, 2 * (K * K - 1) / a0, (1 - K * Math.SQRT2 + K * K) / a0];
    return { shelf, rlb, high };
  }

  // channels: one or two Float32Arrays at `fs`
  function analyse(channels, fs) {
    const { shelf, rlb, high } = coefficients(fs);
    const hop = Math.round(fs / 10);
    const n = Math.floor(channels[0].length / hop);
    const k = new Float64Array(n), all = new Float64Array(n), top = new Float64Array(n);
    for (const x of channels.slice(0, 2)) {
      const kw = biquad(biquad(x, shelf), rlb);
      const hf = biquad(biquad(x, high), high);
      for (let b = 0; b < n; b++) {
        let e = 0, a = 0, t = 0;
        for (let i = b * hop; i < (b + 1) * hop; i++) {
          e += kw[i] * kw[i];
          a += x[i] * x[i];
          t += hf[i] * hf[i];
        }
        k[b] += e;
        all[b] += a;
        top[b] += t;
      }
    }
    // A mono stream plays on both sides
    if (channels.length === 1) for (let b = 0; b < n; b++) k[b] *= 2;
    const blocks = [];
    for (let b = 3; b < n; b++) {
      const sum = a => a[b] + a[b - 1] + a[b - 2] + a[b - 3];
      blocks.push({
        t: (b + 1) / 10,
        lufs: -0.691 + 10 * Math.log10(sum(k) / (4 * hop) + 1e-20),
        share: 10 * Math.log10((sum(top) + 1e-20) / (sum(all) + 1e-18))
      });
    }
    return blocks;
  }

  const median = values => {
    const s = [...values].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  // The talking level: the median after the BS.1770 relative gate (pauses and beds don't count)
  function talkingLevel(blocks) {
    const heard = blocks.map(b => b.lufs).filter(v => v > -70);
    const mean = -0.691 + 10 * Math.log10(heard.reduce((s, v) => s + Math.pow(10, (v + 0.691) / 10), 0) / heard.length);
    return median(heard.filter(v => v > mean - 10));
  }

  // How bright the talking usually is: the median share above 4 kHz around the talking level
  function usualShare(blocks, talk) {
    return median(blocks.filter(b => Math.abs(b.lufs - talk) <= 6).map(b => b.share));
  }

  // Runs of blocks that pass `test`, joined across short gaps: [{ range, louder, brighter }]
  function runs(blocks, talk, usual, test) {
    const out = [];
    for (const b of blocks) {
      if (!test(b)) continue;
      const louder = b.lufs - talk;
      const brighter = b.share - usual;
      const last = out[out.length - 1];
      if (last && b.t - 0.4 - last.range[1] < JOIN_S) {
        last.range[1] = b.t;
        last.louder = Math.max(last.louder, louder);
        last.brighter = Math.max(last.brighter, brighter);
      } else {
        out.push({ range: [+(b.t - 0.4).toFixed(1), +b.t.toFixed(1)], louder, brighter });
      }
    }
    return out;
  }

  const isHarsh = (b, talk, usual) => b.lufs >= talk + AUDIBLE_DB &&
    (b.share - usual >= BRIGHTER_DB || b.share >= BRIGHT_SHARE_DB);

  // Everything worth a look: blocks at least `louderDb` over the talking, or harsh
  function moments(blocks, talk, usual, louderDb = LOUDER_DB) {
    return runs(blocks, talk, usual, b => b.lufs - talk >= louderDb || isHarsh(b, talk, usual));
  }

  // Proposed labels: too loud (LOUDER_DB over the talking) and harsh, as separate lists of ranges
  function propose(blocks) {
    const talk = talkingLevel(blocks);
    const usual = usualShare(blocks, talk);
    const ranges = test => runs(blocks, talk, usual, test).map(r => r.range);
    return {
      talk: +talk.toFixed(1),
      usualShare: +usual.toFixed(1),
      loud: ranges(b => b.lufs - talk >= LOUDER_DB),
      harsh: ranges(b => isHarsh(b, talk, usual))
    };
  }

  const api = { LOUDER_DB, BRIGHTER_DB, BRIGHT_SHARE_DB, AUDIBLE_DB, analyse, talkingLevel, usualShare, moments, propose, isHarsh };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StreamAnalysis = api;
})(typeof self !== 'undefined' ? self : this);
