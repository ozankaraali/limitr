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

export function cleanText(text, speechMs) {
  let t = String(text || '')
    // A multi-byte letter the model cut in half decodes as U+FFFD
    .replace(/�/g, '')
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // A phrase stuck on repeat: short ones three times, longer ones twice
  t = t.replace(/(\b.{3,40}?)(?:\s*\1){2,}/giu, '$1').replace(/(\b.{12,60}?)(?:\s*\1)+/giu, '$1');
  // Drop made-up credit sentences, keep the rest
  t = t.split(/(?<=[.!?。！？])\s+/).filter(sentence => !isCredit(sentence)).join(' ').trim();
  if (!/[\p{L}\p{N}]/u.test(t)) return '';
  if (speechMs < 1200 && STOCK_HALLUCINATIONS.test(t)) return '';
  return t;
}
