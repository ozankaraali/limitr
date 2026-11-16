// Cleaning what the speech models return before it becomes a caption (used by lib/transcriber.js).

// Short stock phrases Whisper produces on near-silence
const STOCK_HALLUCINATIONS = /^(you|thank you\.?|thanks for watching!?|bye\.?|subtitles by .*|altyazı .*)$/i;

// Credit lines Whisper learned from broadcast subtitles and "hears" on silence or music, for
// example the Turkish audio-description credit "… tarafından Sesli Betimleme Derneği'ne
// yaptırılmıştır" with TRT, MİNT or another studio. Never live speech, so a sentence that matches
// is dropped whatever else came with it. Matched on Turkish-aware lowercase text.
const CREDIT_LINES = [
  /sesli betimleme/,
  /betimlemesi .{0,80}tarafından/,
  /^bu dizinin betimle/,             // the same credit, garbled
  /altyazı(lar)? .{0,60}(tarafından|m\.k\.)/,
  /^altyazı m\.k\.?$/,
  /amara\.org/,
  /subtitles (by|created by|made by)/,
  /untertitel (im auftrag|von|der amara)/,
  /sous-titr(age|es réalisés)/,
  /sottotitoli (creati|a cura)/,
  /napisy (stworzone|wykonał)/,
  /ondertiteling (door|ingevoegd)/,
  /субтитры (сделал|создавал|подогнал)|редактор субтитров/,
  /字幕(由|提供)/,
  /点赞.{0,10}订阅/
];

function isCredit(sentence) {
  const lower = sentence.toLocaleLowerCase('tr');
  return CREDIT_LINES.some(pattern => pattern.test(lower));
}

// QiTV's guard (services/captions/guards.py) for the Turkish Moonshine, measured on its broadcasts:
// over music or noise it can write a phrase again and again, or a video channel's subscribe outro
// over a short blip. People repeat themselves for real ("Hayır hayır hayır!", "Gol! Gol! Gol!"),
// so a repetition shows as said; only a loop no one speaks drops the whole caption: one word ten
// or more times in a row, two words five or more, three words four or more, four to eight words
// three or more ("iki bin on yedide, iki bin on yedide, iki bin on yedide!" over a song).
const LOOP_TIMES = { 1: 10, 2: 5, 3: 4 };  // four to eight words: 3
// A caption that is nothing but a subscribe outro, six words at most ("Abone ol.", "Beğen ve abone
// ol!"), is the model's habit (its training text has video makers' endings); inside a longer line
// the words stay.
const OUTRO_WORDS = new Set(('abone ol olun olmayı olmayi unutmayın unutmayin kanalıma kanalımıza kanalima kanalimiza ' +
  'beğen beğenin beğenmeyi begen begenin begenmeyi ve lütfen lutfen videoyu bildirimleri aç açın ' +
  'açmayı zile basın basmayı').split(' '));
const OUTRO_KEYS = ['abone', 'beğen', 'begen', 'bildirim'];

const guardWords = text => String(text).split(/\s+/)
  .map(w => w.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}_]+/gu, '')).filter(Boolean);

export function looped(text) {
  const words = guardWords(text);
  for (let size = 1; size <= 8; size++) {
    const need = LOOP_TIMES[size] || 3;
    for (let start = 0; start + size * need <= words.length; start++) {
      let times = 1;
      for (let at = start + size; at + size <= words.length; at += size) {
        let same = true;
        for (let k = 0; k < size && same; k++) same = words[at + k] === words[start + k];
        if (!same) break;
        times++;
      }
      if (times >= need) return true;
    }
  }
  return false;
}

export function outroOnly(text) {
  const words = guardWords(text);
  return words.length > 0 && words.length <= 6 && words.every(w => OUTRO_WORDS.has(w)) &&
    words.some(w => OUTRO_KEYS.some(key => w.startsWith(key)));
}

// asSaid: the Turkish Moonshine's text (QiTV's guard), else Whisper's and English Moonshine's
export function cleanText(text, speechMs, { asSaid = false } = {}) {
  let t = String(text || '')
    // A multi-byte letter the model cut in half decodes as U+FFFD
    .replace(/�/g, '')
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (asSaid) {
    if (looped(t) || outroOnly(t)) return '';
  } else {
    // A phrase stuck on repeat: short ones three times, longer ones twice
    t = t.replace(/(\b.{3,40}?)(?:\s*\1){2,}/giu, '$1').replace(/(\b.{12,60}?)(?:\s*\1)+/giu, '$1');
  }
  // Drop made-up credit sentences, keep the rest
  t = t.split(/(?<=[.!?。！？])\s+/).filter(sentence => !isCredit(sentence)).join(' ').trim();
  if (!/[\p{L}\p{N}]/u.test(t)) return '';
  if (speechMs < 1200 && STOCK_HALLUCINATIONS.test(t)) return '';
  return t;
}
