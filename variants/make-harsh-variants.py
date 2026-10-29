# Task 4 variants of lib/dsp-worklet.js (as committed with the calm-speech belief): the harsh-sound
# stage leaves calm speech alone. Two kinds:
#   lasts:TAU:S[:speech|:calm]  w-hl{TAU}s{S}[sp|calm].js: the shelf cuts only while a slower
#                 balance (TAU s instead of 100 ms) is also more than S dB past the allowance: the
#                 brightness lasts, as a harsh voice's or a crowd's does, where a sibilant's doesn't.
#                 With "speech", only speech-like sound has to last (an alert or a crowd is cut at
#                 once, as today); with "calm", only calm talk: speech-like, its last 3 s under 1 dB
#                 over normal (not raised) and its strain under strainedDb. "calmN" also cuts calm
#                 talk at once while its 100 ms balance is N dB or more past the allowance (a crowd
#                 or cymbals: noise without a voice's body that pulses like syllables)
#   strain:L      w-hs{L}.js: the shelf skips speech-like sound whose 3 s strain is under L dB
# variants/harsh-rules.js scores the rules on the dataset first.
# Run: python3 variants/make-harsh-variants.py lib/dsp-worklet.js variants lasts:0.6:1 lasts:1:1
import sys
src, out_dir = sys.argv[1], sys.argv[2]
specs = sys.argv[3:]
base = open(src).read()


def editor():
    state = {"s": base}

    def rep(old, new, count=1):
        assert state["s"].count(old) == count, old[:80]
        state["s"] = state["s"].replace(old, new)
    return state, rep


def lasts(tau, over, only=None):
    state, rep = editor()
    at_once = only[4:] if only and only.startswith("calm") and only != "calm" else None
    if at_once:
        only = "calm"
    gate = {None: "", "speech": "!this.speechLike || ",
            "calm": "!this.speechLike || this.shortOver >= HARSH_CALM_OVER_DB || this.strain >= this.params.strainedDb ||\n        "}[only]
    if at_once:
        gate += "balance - this.usualBalance - HARSH_ALLOW_DB >= HARSH_AT_ONCE_DB ||\n        "
    at_once_line = f"const HARSH_AT_ONCE_DB = {at_once};     // ...but this much past the allowance is cut at once\n" if at_once else ""
    rep("""const HARSH_ON_DB = 0.05;          // a smaller cut is none: the shelf is left out
""", f"""const HARSH_ON_DB = 0.05;          // a smaller cut is none: the shelf is left out
// ...and only brightness that lasts: the balance over this long is this much past the allowance too
// (a sibilant is over in a tenth of a second; a harsh voice, an alert or a crowd stays bright)
const HARSH_LASTS_S = {tau};
const HARSH_LASTS_DB = {over};
{"const HARSH_CALM_OVER_DB = 1;    // calm talk: its last 3 s under this much over normal" + chr(10) if only == "calm" else ""}{at_once_line}""")
    rep("""    this.aHarsh = 1 - Math.exp(-HARSH_EVERY / (HARSH_TAU_S * fs));
""", """    this.aHarsh = 1 - Math.exp(-HARSH_EVERY / (HARSH_TAU_S * fs));
    this.aHarshLasts = 1 - Math.exp(-HARSH_EVERY / (HARSH_LASTS_S * fs));
""")
    rep("""    this.harshBody = 0;
    this.harshEdge = 0;
""", """    this.harshBody = 0;
    this.harshEdge = 0;
    this.lastsBody = 0;
    this.lastsEdge = 0;
""", count=2)  # set up, and emptied when the worklet rests
    rep("""    this.harshEdge += (edge / HARSH_EVERY - this.harshEdge) * this.aHarsh;
""", """    this.harshEdge += (edge / HARSH_EVERY - this.harshEdge) * this.aHarsh;
    this.lastsBody += (body / HARSH_EVERY - this.lastsBody) * this.aHarshLasts;
    this.lastsEdge += (edge / HARSH_EVERY - this.lastsEdge) * this.aHarshLasts;
""")
    rep("""      target = Math.min(maxCut, Math.max(0, (balance - this.usualBalance - HARSH_ALLOW_DB) * HARSH_RATIO));""",
        f"""      const lasting = 10 * Math.log10((this.lastsEdge + 1e-20) / (this.lastsBody + 1e-20));
      if ({gate}lasting - this.usualBalance - HARSH_ALLOW_DB >= HARSH_LASTS_DB) {{
        target = Math.min(maxCut, Math.max(0, (balance - this.usualBalance - HARSH_ALLOW_DB) * HARSH_RATIO));
      }}""")
    return state["s"]


def strain(limit):
    state, rep = editor()
    rep("""const HARSH_ON_DB = 0.05;          // a smaller cut is none: the shelf is left out
""", f"""const HARSH_ON_DB = 0.05;          // a smaller cut is none: the shelf is left out
const HARSH_CALM_STRAIN_DB = {limit};  // speech strained less than this is left alone
""")
    rep("""    this.strain = 0;
    this.fastNow = -Infinity;""", """    this.strain = 0;
    this.calmSpeech = false;
    this.fastNow = -Infinity;""")
    rep("""    this.strain = bodySum > 0 ? 10 * Math.log10((presSum + 1e-20) / bodySum) - this.usualTilt : 0;
""", """    this.strain = bodySum > 0 ? 10 * Math.log10((presSum + 1e-20) / bodySum) - this.usualTilt : 0;
    this.calmSpeech = this.speechLike && this.strain < HARSH_CALM_STRAIN_DB;
""")
    rep("""    if (maxCut > 0 && this.normalLocked && this.slow >= this.harshFloor) {""",
        """    if (maxCut > 0 && this.normalLocked && this.slow >= this.harshFloor && !this.calmSpeech) {""")
    return state["s"]


for spec in specs:
    kind, *args = spec.split(":")
    if kind == "lasts":
        name, text = f"w-hl{args[0]}s{args[1]}{('sp' if args[2] == 'speech' else args[2]) if len(args) > 2 else ''}.js", lasts(*args)
    else:
        name, text = f"w-hs{args[0]}.js", strain(*args)
    open(f"{out_dir}/{name}", "w").write(text)
    print(name)
