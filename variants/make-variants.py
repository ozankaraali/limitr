# The loud-start variants of lib/dsp-worklet.js: normal believed louder than the preset's start
# (comfortable level minus `under` dB on Sleep) only as speech is heard, halfway after `half` s
import sys
src, out_dir = sys.argv[1], sys.argv[2]
base = open(src).read()
def variant(half, under):
    s = base
    def rep(old, new):
        nonlocal s
        assert s.count(old) == 1, old[:80]
        s = s.replace(old, new)
    rep("""const DEFAULT_NORMAL_DB = -23;""", f"""const DEFAULT_NORMAL_DB = -23;
// A stream is believed louder than the preset's starting threshold (its comfortable level; Sleep's
// {under} dB under it) only as it talks: halfway after this much speech
const BELIEF_HALF_S = {half};""")
    rep("""    this.normalMomentary = DEFAULT_NORMAL_DB;
    this.settled = DEFAULT_NORMAL_DB;
    this.normalLocked = false;
    this.provisional = false;""", """    this.normalMomentary = DEFAULT_NORMAL_DB;
    this.settled = DEFAULT_NORMAL_DB;
    this.normalLocked = false;
    this.provisional = false;
    this.speechHeard = 0;
    this.believed = DEFAULT_NORMAL_DB;
    this.beliefExtra = 0;""")
    rep("""    this.levelTargetGain = p.levelEnabled
      ? clamp(p.levelTarget - this.normalMomentary, -p.levelMaxCut, p.levelMaxBoost)
      : 0;""", f"""    // The normal the guard defends: the stream's own, but louder than where the preset starts only
    // as far as the speech heard so far makes it believable
    if (this.speechLike) this.speechHeard += SUB_BLOCK_S;
    const startUnder = p.guardMemory >= 300 ? {under} : 0;
    const start = p.levelTarget - startUnder - p.guardHeadroom;
    if (!this.normalLocked) {{
      this.believed = start;
    }} else {{
      const w = 1 - Math.pow(2, -this.speechHeard / BELIEF_HALF_S);
      this.believed = Math.min(this.normalMomentary, start + w * Math.max(0, this.normalMomentary - start));
    }}
    this.beliefExtra = Math.max(0, this.normalMomentary - this.believed);
    // The evener takes the stream down only as far as the guard lets it be loud
    this.levelTargetGain = p.levelEnabled
      ? clamp(p.levelTarget - Math.min(this.normalMomentary, this.believed + p.guardHeadroom + this.speechRoom), -p.levelMaxCut, p.levelMaxBoost)
      : 0;""")
    rep("""    const threshold = this.normalMomentary + p.guardHeadroom + room;""", """    const threshold = this.believed + p.guardHeadroom + room;""")
    rep("""      const aboveSteady = this.heard - this.steady;
      if (!this.inSpike && this.normalLocked && reductionNow - this.steady > SPIKE_START_DB) {""", """      // What the guard cuts because the stream isn't believed this loud yet is no spike
      const steadyCut = Math.max(this.steady, this.beliefExtra);
      const aboveSteady = this.heard - steadyCut;
      if (!this.inSpike && this.normalLocked && reductionNow - steadyCut > SPIKE_START_DB) {""")
    rep("""        if (reductionNow - this.steady < SPIKE_END_DB) {""", """        if (reductionNow - steadyCut < SPIKE_END_DB) {""")
    rep("""    const thresholdDb = p.guardEnabled ? this.normalMomentary + this.levelGain + p.guardHeadroom + this.speechRoom + postDb : null;""",
        """    const thresholdDb = p.guardEnabled ? this.believed + this.levelGain + p.guardHeadroom + this.speechRoom + postDb : null;""")
    # For the scratch analysis only: the believed normal on the meters
    rep("""      harshDb: -this.shelfCut,""", """      harshDb: -this.shelfCut,
      believedDb: this.believed,""")
    open(f"{out_dir}/w-b{half}u{under}.js", "w").write(s)
for half in (10, 5):
    for under in (3, 0):
        variant(half, under)
