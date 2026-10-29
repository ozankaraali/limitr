// Live captions from a whole-utterance model (ufak): while a sentence is spoken it is decoded again
// every half second, but only from a little before its last committed word, and a word is
// committed once two decodes in a row agree on it (local agreement). So each decode stays a few
// seconds long however long the sentence gets, a committed word never changes, and of the words
// still in doubt, those the model is sure of show after the committed ones (a guess would flicker).

const SAME_WORD = word => word.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]/gu, '');
// A word is spoken until a moment after its last piece (or until the next one starts, if sooner)
const LAST_PIECE_S = 0.16;
// A word that starts this early before the last committed word ends is that word read again
const CONTEXT_SLACK_S = 0.04;
// A decode starts this long before the word it starts with, if the word before has ended by then
const WORD_ONSET_S = 0.25;

// The words of one decode, with their times in seconds from `offset` (where the decoded audio
// starts in the sentence), and how sure the model was of each: the log-probability of its least
// sure piece of letters (it is often unsure of the punctuation after a word, not of the word).
// sherpa-onnx gives word pieces: one with a leading space starts a word, any other joins the word
// before (so punctuation stays on its word).
export function wordsOf({ tokens = [], timestamps = [], ys_log_probs: logProbs = [] }, offset = 0) {
  const words = [];
  tokens.forEach((piece, i) => {
    const at = offset + (timestamps[i] || 0);
    const logProb = logProbs[i] === undefined || !/[\p{L}\p{N}]/u.test(piece) ? 0 : logProbs[i];
    if (i === 0 || /^\s/.test(piece) || !words.length) words.push({ text: piece.trim(), start: at, last: at, logProb });
    else {
      const word = words[words.length - 1];
      word.text += piece;
      word.last = at;
      word.logProb = Math.min(word.logProb, logProb);
    }
  });
  return words.filter(w => w.text).map((w, i, all) => ({
    text: w.text,
    start: w.start,
    end: Math.min(w.last + LAST_PIECE_S, i + 1 < all.length ? all[i + 1].start : Infinity),
    logProb: w.logProb
  }));
}

export class LiveAgreement {
  // contextSeconds: audio before the last committed word that each decode starts with, so the
  // model hears the words around the ones still open; maxPendingSeconds: how long words may stay
  // in doubt (music, crosstalk) before the older ones are committed anyway; lineSeconds: how long
  // a line may run without a full stop (once it has run half that, it ends at a pause of
  // linePauseSeconds); sureLogProb: how sure the model must be of a word in doubt to show it
  constructor({ contextSeconds = 1.5, maxPendingSeconds = 6, lineSeconds = 8, linePauseSeconds = 0.3, sureLogProb = Math.log(0.9) } = {}) {
    this.contextSeconds = contextSeconds;
    this.maxPendingSeconds = maxPendingSeconds;
    this.lineSeconds = lineSeconds;
    this.linePauseSeconds = linePauseSeconds;
    this.sureLogProb = sureLogProb;
    this.reset();
  }

  reset() {
    this.committed = [];   // { text, start, end, logProb }, seconds into the sentence
    this.pending = [];     // the last decode's words after the committed ones
    this.shown = 0;        // committed words already shown as finished lines
    this.floor = 0;        // decoded up to here with nothing in it to commit (s)
  }

  committedEnd() {
    const last = this.committed[this.committed.length - 1];
    return last ? last.end : 0;
  }

  // Where the next decode should start, in seconds into the sentence: a context before the last
  // committed word ends, in the pause before a word (cut inside one, the model hears half a word
  // and makes up others around it)
  windowStart() {
    const from = Math.max(this.committedEnd(), this.floor) - this.contextSeconds;
    if (from <= 0) return 0;
    const k = this.committed.findIndex(w => w.end > from);
    if (k < 0) return from;
    const before = k ? this.committed[k - 1].end : 0;
    return Math.max(before, Math.min(from, this.committed[k].start - WORD_ONSET_S));
  }

  // One decode of the sentence from `windowStart` to `now` (seconds into it); `final`: the sentence
  // has ended. Returns the lines finished now and the line being spoken ('' when there is none).
  update(result, windowStart, now, final) {
    const from = this.committedEnd() - CONTEXT_SLACK_S;
    const words = wordsOf(result, windowStart).filter(w => w.start >= from);
    if (final) {
      this.committed.push(...words);
      this.pending = [];
    } else {
      let agreed = 0;
      while (agreed < words.length && agreed < this.pending.length && SAME_WORD(words[agreed].text) === SAME_WORD(this.pending[agreed].text)) agreed++;
      this.committed.push(...words.slice(0, agreed));
      this.pending = words.slice(agreed);
      // Nothing settled for too long: commit what is old enough to have settled if it ever will,
      // and move the window on past what never became words (music, a pause taken for speech)
      if (now - Math.max(this.committedEnd(), this.floor) > this.maxPendingSeconds) {
        const settledBy = now - this.maxPendingSeconds / 2;
        const settled = this.pending.filter(w => w.end <= settledBy);
        this.committed.push(...settled);
        this.pending = this.pending.slice(settled.length);
        this.floor = Math.max(this.floor, this.pending.length ? Math.min(this.pending[0].start, settledBy) : settledBy);
      }
    }
    return this.lines(final);
  }

  // Where the line starting at words[from] ends (the index of the next line's first word): after a
  // full stop; once it has run half its length, at a pause; past its length, at the next word
  lineEnd(words, from) {
    const first = words[from].start;
    for (let i = from + 1; i < words.length; i++) {
      const ran = words[i].start - first;
      if (/[.!?]$/.test(words[i - 1].text) || ran >= this.lineSeconds ||
        (ran >= this.lineSeconds / 2 && words[i].start - words[i - 1].end >= this.linePauseSeconds)) return i;
    }
    return words.length;
  }

  // Lines whose words are all committed and whose end is known come out finished; the line being
  // spoken shows up to where it will end (what follows waits for the next line, rather than show
  // here and move down), and of its words in doubt, those before the first one the model is unsure
  // of, without their punctuation (the model often puts a full stop in and takes it out again)
  lines(final) {
    const done = [];
    const words = [...this.committed, ...this.pending];
    while (this.shown < this.committed.length) {
      const end = this.lineEnd(words, this.shown);
      // At the sentence's end every word is committed and every line ends
      if (!final && (end >= words.length || end > this.committed.length)) break;
      done.push(words.slice(this.shown, end).map(w => w.text).join(' '));
      this.shown = end;
    }
    if (final || this.shown >= words.length) return { done, line: '' };
    let end = this.lineEnd(words, this.shown);
    const unsure = this.pending.findIndex(w => w.logProb < this.sureLogProb);
    if (unsure >= 0) end = Math.min(end, this.committed.length + unsure);
    const shown = words.slice(this.shown, end).map((w, i) =>
      this.shown + i < this.committed.length ? w.text : w.text.replace(/[^\p{L}\p{N}]+$/u, ''));
    return { done, line: shown.filter(Boolean).join(' ') };
  }
}
