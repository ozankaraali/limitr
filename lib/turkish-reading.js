// How the Turkish Moonshine (lib/turkish-moonshine.js) is given the line being spoken: by
// lib/transcriber.js, and by the bench that measures it (tests/bench/stt-bench.js), the same way.
//
// The segmenter sends the open sentence again about once a second, from its start, and the whole
// sentence at its pause. Read whole every time, a sentence of 8 s is read about 4.5 times over:
// on one thread (Firefox) the captions took two thirds of a core. So:
//   - prefix: a reading goes on from words the last readings of the sentence said, which the
//     decoder takes in one call: 'agreed', the words two readings in a row said alike (as QiTV's
//     growing writer, LocalAgreement); 'shown', all the last one showed (a word heard early is
//     then kept even when what follows says otherwise); or 'none';
//   - finalPrefix: the finished sentence goes on from them too (else it is read afresh; and so
//     is one cut short for its length, whose last words may be past the cut);
//   - stitch: the encoder goes on from its last reading of the sentence, reading only the new
//     sound and a little before it; stitchFinal: the finished sentence too (else read whole).
//     Read whole, it held up the line for seconds on a slow core (2.5 s for 8 s of fast speech
//     on a 2017 laptop's thread) and the line came in bursts; now it mostly takes the encoder's
//     output the line already had (measured: +0.1 point of words wrong, -0.2 to +0.5);
//   - budget: the line being spoken is read again only once the readings have taken no more than
//     this share of the time (on one thread, of a core); a finished sentence is read at once.

export const TURKISH_READING = {
  prefix: 'agreed',
  finalPrefix: true,
  stitch: true,
  stitchFinal: true,
  budget: 0.6
};

const flat = words => words.flatMap(word => word.tokens);
const same = (a, b) => a.tokens.length === b.tokens.length && a.tokens.every((t, i) => t === b.tokens[i]);

// The text of the words a reading goes on from
export const keptText = state => (state ? state.kept.map(word => word.text).join('').trim() : '');

// What a reading of `job` ({ piece, final, cut }) is given, after `state` (the readings' so far)
export function readingFor(state, job, policy = TURKISH_READING) {
  const going = Boolean(state) && state.piece === job.piece && policy.prefix !== 'none' &&
    (!job.final || (policy.finalPrefix && !job.cut));
  const stitch = policy.stitch && (!job.final || policy.stitchFinal);
  return { prefix: going ? flat(state.kept) : [], key: stitch ? job.piece : null };
}

// What the next reading of the sentence goes on from, after this one's `result` (its words but
// the last, the kept ones first), until the sentence ends
export function afterReading(state, job, result, policy = TURKISH_READING) {
  if (job.final || policy.prefix === 'none') return null;
  const before = state && state.piece === job.piece ? state : { kept: [], heard: [] };
  if (policy.prefix === 'shown') return { piece: job.piece, kept: result.words, heard: [] };
  // The words after the kept ones that this reading and the last said alike are kept too
  const heard = result.words.slice(before.kept.length);
  let agreed = 0;
  while (agreed < heard.length && agreed < before.heard.length && same(heard[agreed], before.heard[agreed])) agreed++;
  return { piece: job.piece, kept: [...before.kept, ...heard.slice(0, agreed)], heard: heard.slice(agreed) };
}

// How long after a reading that took `ms` the line being spoken may be read again
export function interimWait(ms, policy = TURKISH_READING) {
  return policy.budget >= 1 ? 0 : ms * (1 / policy.budget - 1);
}
