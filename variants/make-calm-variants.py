# The calm-speech belief, from the threshold-carry variant w-b10u3t.js (make-carry-variants.py):
#   w-calm{half}u3t.js  calm speech (it pulses, and nothing strained for the last 10 s) is believed at
#                       its own level as soon as 1 s of it is heard, up to the level listened to lately
#                       (the carry); the rest of a louder normal over time, halfway after {half} s of sound
#   w-calm10u3t-m30.js  the same, with nothing calm for 30 s after a strained moment instead of 10
#   w-calm10u3t-g3.js, w-calm10u3t-m30-g3.js  strain counts only in a raised voice: 3 dB over the
#                       guard's threshold (believed normal + headroom)
# Run: python3 variants/make-calm-variants.py variants
import sys
d = sys.argv[1]

def calm(s, strained_db=6, memory_s=10, raised_db=None):
    def rep(old, new):
        nonlocal s
        assert s.count(old) == 1, old[:80]
        s = s.replace(old, new)
    rep("""const BELIEF_HALF_S = """, f"""// Calm speech is believed at its own level once this much of it is there (1 s)...
const CALM_NEED_BLOCKS = 10;
// ...where calm is speech-like and not strained: no speech this strained (3 s strain, dB) in the
// last this many seconds (a yell's strain fades in its 3 s window while the yell goes on)
const STRAINED_DB = {strained_db};
const STRAIN_MEMORY_S = {memory_s};
// (read once the 3 s window holds this many blocks of sound: one bright first block isn't strain)
const STRAIN_SOUND_BLOCKS = 10;
const STRAIN_SOUND_MS = Math.pow(10, (SILENCE_GATE_DB + 0.691) / 10);
// The rest of a louder normal is believed over time: halfway after this much sound
const BELIEF_HALF_S = """)
    rep("""    this.speechHistory = new Uint8Array(MAX_BLOCKS);
""", """    this.speechHistory = new Uint8Array(MAX_BLOCKS);
    this.calmHistory = new Uint8Array(MAX_BLOCKS);
""")
    rep("""    this.speechHeard = 0;
    this.believed = DEFAULT_NORMAL_DB;""", """    this.speechHeard = 0;
    this.soundHeard = 0;
    this.sinceStrained = STRAIN_MEMORY_S;
    this.calmLevelDb = null;
    this.believed = DEFAULT_NORMAL_DB;""")
    rep("""      this.speechHistory[slot] = 0;
""", """      this.speechHistory[slot] = 0;
      this.calmHistory[slot] = 0;
""")
    rep("""  speechLevel(take, need) {""", """  calmLevel(take, need) {
    const n = Math.min(this.historyCount, take, MAX_BLOCKS);
    let j = this.historyPos % MAX_BLOCKS;
    let sum = 0, count = 0;
    for (let i = 0; i < n; i++) {
      j = j === 0 ? MAX_BLOCKS - 1 : j - 1;
      if (this.calmHistory[j]) { sum += this.momentaryPower[j]; count++; }
    }
    if (count < need) return null;
    const gate = msToLufs(sum / count) - RELATIVE_GATE_DB;
    let m = 0;
    j = this.historyPos % MAX_BLOCKS;
    for (let i = 0; i < n; i++) {
      j = j === 0 ? MAX_BLOCKS - 1 : j - 1;
      if (this.calmHistory[j] && this.momentaryHistory[j] > gate) this.scratch[m++] = this.momentaryHistory[j];
    }
    return m ? this.usualLevel(this.scratch, m) : null;
  }

  speechLevel(take, need) {""")
    rep("""    if (this.speechLike) this.speechHeard += SUB_BLOCK_S;
""", """    if (this.speechLike) this.speechHeard += SUB_BLOCK_S;
    if (momentary > SILENCE_GATE_DB) this.soundHeard += SUB_BLOCK_S;
    // Calm speech: it pulses, and no speech was strained lately (judged like speech, on the 1.5 s
    // centred on the block)
    if (centerSlot >= 0) this.calmHistory[centerSlot] = this.speechHistory[centerSlot] && this.sinceStrained >= STRAIN_MEMORY_S ? 1 : 0;
""")
    rep("""      const w = 1 - Math.pow(2, -this.speechHeard / BELIEF_HALF_S);
      this.believed = Math.min(this.normalMomentary, start + w * Math.max(0, this.normalMomentary - start));""",
        """      // Calm speech at its own level at once, up to the level listened to lately; the rest of a
      // louder normal over time
      const w = 1 - Math.pow(2, -this.soundHeard / BELIEF_HALF_S);
      const slow = start + w * Math.max(0, this.normalMomentary - start);
      // (until a second of it is in the history, the speech that seeds normal, as soon as it does)
      this.calmLevelDb = this.calmLevel(SHORT_BLOCKS, CALM_NEED_BLOCKS);
      if (this.calmLevelDb === null && this.speechNow && this.sinceStrained >= STRAIN_MEMORY_S) this.calmLevelDb = this.seedLevel();
      const calm = this.calmLevelDb === null ? -Infinity : Math.min(this.calmLevelDb, this.carryLow === null ? Infinity : this.carryLow);
      const before = this.believed;
      this.believed = Math.min(this.normalMomentary, Math.max(slow, calm));
      // Calm speech believed at once: what the guard held is let go as fast as when normal is learned
      if (this.believed > before + DRIFT_DB) this.lockReleaseLeft = Math.round(LOCK_RELEASE_S * this.fs);""")
    rep("""    this.strain = bodySum > 0 ? 10 * Math.log10((presSum + 1e-20) / bodySum) - this.usualTilt : 0;
""", """    this.strain = bodySum > 0 ? 10 * Math.log10((presSum + 1e-20) / bodySum) - this.usualTilt : 0;
    let soundBlocks = 0;
    for (let i = 0; i < SHOUT_BLOCKS; i++) if (this.shortBlocks[i] > STRAIN_SOUND_MS) soundBlocks++;
    if (this.speechLike && soundBlocks >= STRAIN_SOUND_BLOCKS && this.strain >= STRAINED_DB) this.sinceStrained = 0;
    else this.sinceStrained += SUB_BLOCK_S;
""")
    if raised_db is not None:
        rep("""const STRAIN_SOUND_BLOCKS = 10;""", f"""const STRAIN_SOUND_BLOCKS = 10;
// ...and only strain in a raised voice: this much over the threshold the guard defends (the believed
// normal plus the preset's headroom; the measured normal can be the yell itself). Calm talk and quiet
// bright sounds read strained too, against a usual tilt learned from the talk or not learned yet.
const STRAIN_RAISED_DB = {raised_db};""")
        rep("""    if (this.speechLike && soundBlocks >= STRAIN_SOUND_BLOCKS && this.strain >= STRAINED_DB) this.sinceStrained = 0;""",
            """    const raisedFrom = this.believed + p.guardHeadroom + STRAIN_RAISED_DB;
    if (this.speechLike && soundBlocks >= STRAIN_SOUND_BLOCKS && this.strain >= STRAINED_DB && momentary >= raisedFrom) this.sinceStrained = 0;""")
    rep("""      startDb: this.startLevel,""", """      startDb: this.startLevel,
      calmDb: this.calmLevelDb,""")
    return s

base = open(f"{d}/w-b10u3t.js").read()
open(f"{d}/w-calm10u3t.js", "w").write(calm(base))
# A stream that strained isn't calm for 30 s after it (vp05's later yells came out as today's with 10)
open(f"{d}/w-calm10u3t-m30.js", "w").write(calm(base, memory_s=30))
# Strain only counts in a raised voice (the dataset scan: 128 of 157 unmarked episodes were calm talk
# or quieter sounds)
open(f"{d}/w-calm10u3t-g3.js", "w").write(calm(base, raised_db=3))
open(f"{d}/w-calm10u3t-m30-g3.js", "w").write(calm(base, memory_s=30, raised_db=3))
