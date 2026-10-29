# Sleep's tone with a softer high shelf, or none, for task 4: settings copies the eval takes with
# --settings=FILE (the 60 Hz cut stays). Run: python3 variants/make-tone-settings.py lib/settings.js variants
import sys
src, out_dir = sys.argv[1], sys.argv[2]
base = open(src).read()
old = "lowCut: 60, eq5Type: 'highshelf', eq5Freq: 6000, eq5Gain: -4, eq5Q: 0.7"
assert base.count(old) == 1, old
for name, gain in (("shelf1.5", "-1.5"), ("shelf0", "0")):
    open(f"{out_dir}/settings-{name}.js", "w").write(base.replace(old, old.replace("eq5Gain: -4", f"eq5Gain: {gain}")))
