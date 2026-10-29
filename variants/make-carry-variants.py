# The carry-over variants, from the loud-start variants w-b{10,5}u3.js (make-variants.py):
#   w-b{half}u3c.js  upward carry: a new video starts from the higher of the preset's start and the
#                    level the video before was believed at (tried and set aside: see docs/HANDOFF.md)
#   w-b{half}u3d.js  downward carry: a new video starts from the lower of the preset's start and the
#                    long-term speech level, across videos (4 x guardMemory: 20 min Sleep, 4 Stream)
#   w-b{half}u3t.js  the same carry on the starting threshold: a new video's believed normal starts
#                    no higher than the long-term speech level minus the preset's headroom, so it
#                    engages on Stream too (Stream starts at -23, NatGeo's long-term level is -23.3)
# Both start fresh after a preset change or 10 minutes without sound.
# Run: python3 variants/make-carry-variants.py variants
import sys
d = sys.argv[1]

def upward(s):
    def rep(old, new):
        nonlocal s
        assert s.count(old) == 1, old[:80]
        s = s.replace(old, new)
    rep("""const BELIEF_HALF_S = """, """// A new video in the same page starts from how loud the one before was believed to be, unless
// the preset changed since or nothing has played for this long (ms, wall clock: an idle page
// suspends its audio)
const CARRY_IDLE_MS = 10 * 60 * 1000;
const BELIEF_HALF_S = """)
    rep("""  resetAnalysis() {
""", """  resetAnalysis() {
    if (this.normalLocked) {
      this.carry = this.believed;
      this.carryKey = this.startKey;
    } else if (this.carry === undefined) {
      this.carry = null;
      this.carryKey = null;
      this.lastSoundAt = 0;
    }
""")
    rep("""    if (this.speechLike) this.speechHeard += SUB_BLOCK_S;
    const startUnder = p.guardMemory >= 300 ? 3 : 0;
    const start = p.levelTarget - startUnder - p.guardHeadroom;""", """    if (this.speechLike) this.speechHeard += SUB_BLOCK_S;
    const startUnder = p.guardMemory >= 300 ? 3 : 0;
    this.startKey = `${p.levelTarget}|${p.guardHeadroom}|${startUnder}`;
    if (momentary > SILENCE_GATE_DB) {
      const now = Date.now();
      if (this.lastSoundAt && now - this.lastSoundAt > CARRY_IDLE_MS) this.carry = null;
      this.lastSoundAt = now;
    }
    if (this.carry !== null && this.carryKey !== this.startKey) this.carry = null;
    const start = Math.max(p.levelTarget - startUnder - p.guardHeadroom, this.carry === null ? -Infinity : this.carry);""")
    return s

def downward(s):
    def rep(old, new):
        nonlocal s
        assert s.count(old) == 1, old[:80]
        s = s.replace(old, new)
    rep("""const BELIEF_HALF_S = """, """// A new video starts no higher than the level listened to lately: the speech of the last
// 4 x guardMemory (20 min in Sleep, 4 in Stream), across videos, unless the preset changed or
// nothing has played for this long (ms, wall clock: an idle page suspends its audio)
const CARRY_IDLE_MS = 10 * 60 * 1000;
const BELIEF_HALF_S = """)
    rep("""  resetAnalysis() {
""", """  resetAnalysis() {
    if (this.longSpeech === undefined) {
      this.longSpeech = new Float64Array(MAX_BLOCKS);
      this.longSpeechPos = 0;
      this.longSpeechCount = 0;
      this.longSpeechKey = null;
      this.lastSoundAt = 0;
      this.carryLow = null;
    } else {
      this.carryLow = this.longSpeechLevel();
    }
""")
    rep("""  // Where the first n `values` usually sit""", """  // The level of the speech listened to lately, across videos (gated as BS.1770-4, its upper
  // quartile), or null with under 10 s of it
  longSpeechLevel() {
    const n = Math.min(this.longSpeechCount, this.longBlocks);
    if (n < SPEECH_LONG_BLOCKS) return null;
    let sum = 0;
    for (let i = 1; i <= n; i++) sum += Math.pow(10, (this.longSpeech[(this.longSpeechPos - i + MAX_BLOCKS) % MAX_BLOCKS] + 0.691) / 10);
    const gate = msToLufs(sum / n) - RELATIVE_GATE_DB;
    let m = 0;
    for (let i = 1; i <= n; i++) {
      const v = this.longSpeech[(this.longSpeechPos - i + MAX_BLOCKS) % MAX_BLOCKS];
      if (v > gate) this.scratch[m++] = v;
    }
    return m ? this.usualLevel(this.scratch, m) : null;
  }

  // Where the first n `values` usually sit""")
    rep("""    if (centerSlot >= 0) this.speechHistory[centerSlot] = centerFlag && speechBlocks >= SPEECH_NEED_BLOCKS ? 1 : 0;""",
        """    if (centerSlot >= 0) {
      this.speechHistory[centerSlot] = centerFlag && speechBlocks >= SPEECH_NEED_BLOCKS ? 1 : 0;
      if (this.speechHistory[centerSlot]) {
        this.longSpeech[this.longSpeechPos] = this.momentaryHistory[centerSlot];
        this.longSpeechPos = (this.longSpeechPos + 1) % MAX_BLOCKS;
        if (this.longSpeechCount < MAX_BLOCKS) this.longSpeechCount++;
      }
    }""")
    rep("""    if (this.speechLike) this.speechHeard += SUB_BLOCK_S;
    const startUnder = p.guardMemory >= 300 ? 3 : 0;
    const start = p.levelTarget - startUnder - p.guardHeadroom;""", """    if (this.speechLike) this.speechHeard += SUB_BLOCK_S;
    const startUnder = p.guardMemory >= 300 ? 3 : 0;
    // Fresh again after a preset change or 10 minutes of nothing playing
    const startKey = `${p.levelTarget}|${p.guardHeadroom}|${startUnder}|${p.guardMemory}`;
    let fresh = false;
    if (momentary > SILENCE_GATE_DB) {
      const now = Date.now();
      if (this.lastSoundAt && now - this.lastSoundAt > CARRY_IDLE_MS) fresh = true;
      this.lastSoundAt = now;
    }
    if (this.longSpeechKey !== startKey) {
      fresh = fresh || this.longSpeechKey !== null;
      this.longSpeechKey = startKey;
      this.longSpeechCount = 0;
    }
    if (fresh) {
      this.carryLow = null;
      this.longSpeechCount = 0;
    }
    const start = Math.min(p.levelTarget - startUnder - p.guardHeadroom, this.carryLow === null ? Infinity : this.carryLow);
    this.startLevel = start;""")
    rep("""      believedDb: this.believed,""", """      believedDb: this.believed,
      startDb: this.startLevel,""")
    return s

def threshold(s):
    def rep(old, new):
        nonlocal s
        assert s.count(old) == 1, old[:80]
        s = s.replace(old, new)
    rep("""// A new video starts no higher than the level listened to lately: the speech of the last
// 4 x guardMemory""", """// A new video's threshold starts no higher than the level listened to lately: the speech of the last
// 4 x guardMemory""")
    rep("""    const start = Math.min(p.levelTarget - startUnder - p.guardHeadroom, this.carryLow === null ? Infinity : this.carryLow);""",
        """    const start = Math.min(p.levelTarget - startUnder - p.guardHeadroom, this.carryLow === null ? Infinity : this.carryLow - p.guardHeadroom);""")
    return s

for half in (10, 5):
    base = open(f"{d}/w-b{half}u3.js").read()
    open(f"{d}/w-b{half}u3c.js", "w").write(upward(base))
    open(f"{d}/w-b{half}u3d.js", "w").write(downward(base))
    open(f"{d}/w-b{half}u3t.js", "w").write(threshold(downward(base)))
