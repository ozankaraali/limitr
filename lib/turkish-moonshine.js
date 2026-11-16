// Turkish speech recognition for live captions: QiTV ASR's Turkish Moonshine small (CC BY 4.0,
// "QiTV ASR Turkish - Ozan Karaali"; Moonshine Streaming Small trained further on Turkish TV
// dialogue). It reads whole pieces of speech, as English Moonshine does, and writes cased,
// punctuated text, numbers as words.
//
// Its int8 Moonshine v2 files, as sherpa-onnx reads them, are run here with onnxruntime-web
// (lib/ort.bundle.min.mjs, the one transformers.js uses): the encoder over the piece, then the
// merged decoder one piece of a word at a time, greedily, with its key-value cache. Read whole,
// this gives sherpa-onnx's own text (measured 2026-11-16, variants/qitv-asr/); read again as a
// sentence grows, it can go on from its last reading (below).
//
// On real Turkish with hand-made subtitles (variants/qitv-asr/README.md), 18.7 % of words wrong,
// against 22.1 % for ufakzeka-kulak, which it replaced, and 27.3 % against 35.4 % in conversation.

// A pinned revision: its decoder stores the weights unsigned, read exactly on every processor
const REVISION = 'a4dea6126a4d4dad52f459f31590691f281a8e92';
const MODEL_URL = `https://huggingface.co/ozankaraali/qitv-asr-tr-moonshine-small/resolve/${REVISION}/onnx/`;
const ENCODER = 'encoder_model_quantized.onnx';
const DECODER = 'decoder_model_merged_quantized.onnx';
const TOKENS = 'tokens.txt';
const CACHE = 'limitr-qitv-asr-tr-moonshine-small';
export const TURKISH_MOONSHINE_MB = 144;

const SAMPLE_RATE = 16000;
const FRAME = 80;          // the encoder reads whole 80-sample (5 ms) frames
const BOS = 1;
const EOS = 2;
const HEADS = 8;           // the decoder's attention heads, and each one's size
const HEAD_SIZE = 64;
// QiTV's cap on a piece's tokens (services/captions/guards.py): about three words a second at
// most in fast speech, a word a token or two. It leaves room for that and stops a loop early.
const TOKENS_BASE = 8;
const TOKENS_PER_S = 6;

// A model file from the Cache API, or downloaded once into it
async function modelFile(base, name) {
  const url = base + name;
  const cache = await caches.open(CACHE);
  let response = await cache.match(url);
  if (!response) {
    response = await fetch(url);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    await cache.put(url, response.clone());
  }
  return new Uint8Array(await response.arrayBuffer());
}

// tokens.txt: each piece's bytes in base64, then its id. The first four (the specials) are a NUL.
function readPieces(text) {
  const decoder = new TextDecoder();
  const pieces = [];
  for (const line of text.split('\n')) {
    const [encoded, id] = line.trim().split(' ');
    if (!encoded || id === undefined) continue;
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    pieces[Number(id)] = bytes.length === 1 && bytes[0] === 0 ? '' : decoder.decode(bytes);
  }
  return pieces;
}

// Reading the line being spoken again as it grows (lib/transcriber.js), most of the cost was
// reading what was already read. So a reading may be given:
//   - prefix: the tokens already shown, which the decoder takes in one call instead of writing
//     them again a token at a time; it goes on from there;
//   - key: the piece it continues (the same sentence, longer). The encoder then reads only the
//     new sound and STITCH.leftS before it, and its output is joined to the last reading's,
//     whose last STITCH.rightS (heard without what followed) is read again. A piece no longer
//     than the last reading (the finished sentence) takes the start of its output.
// A reading's result: { text, tokens, words }, words being each of its words but the last (the
// word being spoken, which the next reading often changes) as { tokens, text }.
// The decoder's cached calls never read the encoder's output (its keys and values come in the
// cache), so they get a one-frame stand-in: same tokens (measured), less work a token.
const HOP = 320;                         // sound samples to an encoder frame (20 ms)
const STITCH = { leftS: 1.0, rightS: 0.5 };
const KEPT = 2;                          // encoder outputs kept, for the pieces being read

// ort: onnxruntime-web, its threads already set. base: where the files are (tests), else the Hub.
// stitch: STITCH's lengths instead (benches), or false to read every piece whole.
export async function loadTurkishMoonshine(ort, { base = MODEL_URL, stitch = STITCH } = {}) {
  const [encoderBytes, decoderBytes, tokenBytes] = await Promise.all([ENCODER, DECODER, TOKENS].map(name => modelFile(base, name)));
  const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
  const encoder = await ort.InferenceSession.create(encoderBytes, options);
  const decoder = await ort.InferenceSession.create(decoderBytes, options);
  const pieces = readPieces(new TextDecoder().decode(tokenBytes));
  const past = decoder.inputNames.filter(name => name.startsWith('past_key_values.'));
  const selfPast = past.filter(name => name.includes('.decoder.'));
  const crossPast = past.filter(name => name.includes('.encoder.'));
  const present = name => name.replace('past_key_values.', 'present.');
  const stepFetches = ['logits', ...selfPast.map(present)];
  const empty = new ort.Tensor('float32', new Float32Array(0), [1, HEADS, 0, HEAD_SIZE]);
  const ids = list => new ort.Tensor('int64', BigInt64Array.from(list, BigInt), [1, list.length]);
  const kept = new Map();                // key -> { length, hidden }
  let standIn = null;

  async function encodeWhole(samples) {
    const { last_hidden_state: hidden } = await encoder.run({ input_values: new ort.Tensor('float32', samples, [1, samples.length]) });
    return hidden;
  }

  // The encoder's output for `samples`, from the last reading of the same piece where it can
  async function encode(samples, key) {
    const prior = key != null && stitch ? kept.get(key) : null;
    let hidden = null;
    if (prior && samples.length <= prior.length && samples.length % HOP === 0) {
      // No new sound (the finished sentence, its trailing pause trimmed): the start of the last
      // reading's output, which heard all of it and a little after
      const [, frames, width] = prior.hidden.dims;
      const take = Math.min(frames, samples.length / HOP);
      hidden = new ort.Tensor('float32', prior.hidden.data.slice(0, take * width), [1, take, width]);
    } else if (prior && samples.length > prior.length && prior.length % HOP === 0) {
      const [, frames, width] = prior.hidden.dims;
      const keep = Math.max(0, frames - Math.round(stitch.rightS * SAMPLE_RATE / HOP));
      const from = Math.max(0, keep - Math.round(stitch.leftS * SAMPLE_RATE / HOP));
      if (from > 0) {
        const part = await encodeWhole(samples.subarray(from * HOP));
        const skip = keep - from;
        const total = keep + part.dims[1] - skip;
        const data = new Float32Array(total * width);
        data.set(prior.hidden.data.subarray(0, keep * width));
        data.set(part.data.subarray(skip * width), keep * width);
        hidden = new ort.Tensor('float32', data, [1, total, width]);
      }
    }
    if (!hidden) hidden = await encodeWhole(samples);
    if (key != null && stitch) {
      kept.delete(key);
      kept.set(key, { length: samples.length, hidden });
      while (kept.size > KEPT) kept.delete(kept.keys().next().value);
    }
    return hidden;
  }

  // The best token of a call's last row of logits
  function best(logits) {
    const width = logits.dims[logits.dims.length - 1];
    const data = logits.data;
    const offset = data.length - width;
    let top = 0;
    for (let v = 1; v < width; v++) if (data[offset + v] > data[offset + top]) top = v;
    return top;
  }

  // One piece of 16 kHz mono speech (from its start) to text. key: the piece it continues, so
  // the encoder can go on from there; prefix: tokens it already said, to go on from
  async function transcribe(audio, { prefix = [], key = null } = {}) {
    const length = Math.ceil(audio.length / FRAME) * FRAME;
    if (!length) return { text: '', tokens: [], words: [] };
    let samples = audio;
    if (length !== audio.length || !(audio instanceof Float32Array)) {
      samples = new Float32Array(length);
      samples.set(audio);
    }
    const hidden = await encode(samples, key);
    const cap = Math.floor(TOKENS_BASE + TOKENS_PER_S * audio.length / SAMPLE_RATE);
    const written = prefix.slice(0, cap);
    const feeds = { input_ids: ids([BOS, ...written]), encoder_hidden_states: hidden, use_cache_branch: new ort.Tensor('bool', [false], [1]) };
    for (const name of past) feeds[name] = empty;
    let out = await decoder.run(feeds);
    // The encoder's keys and values come from the first call only; the decoder's own grow
    const cross = Object.fromEntries(crossPast.map(name => [name, out[present(name)]]));
    if (!standIn) standIn = new ort.Tensor('float32', new Float32Array(hidden.dims[2]), [1, 1, hidden.dims[2]]);
    while (written.length < cap) {
      const token = best(out.logits);
      if (token === EOS) break;
      written.push(token);
      if (written.length >= cap) break;
      const step = { input_ids: ids([token]), encoder_hidden_states: standIn, use_cache_branch: new ort.Tensor('bool', [true], [1]), ...cross };
      for (const name of selfPast) step[name] = out[present(name)];
      out = await decoder.run(step, stepFetches);
    }
    // A word starts at a piece with a space before it
    const words = [];
    for (const token of written) {
      const piece = pieces[token] || '';
      if (!words.length || piece.startsWith(' ')) words.push({ tokens: [token], text: piece });
      else {
        words[words.length - 1].tokens.push(token);
        words[words.length - 1].text += piece;
      }
    }
    return { text: written.map(id => pieces[id] || '').join('').trim(), tokens: written, words: words.slice(0, -1) };
  }

  return { transcribe };
}
