# Turkish videos with hand-made subtitles, as a test (see README.md, "Real subtitled Turkish").
# For each source in <dir>/sources.txt ("name id from to", seconds): its subtitles cut to the section
# and shifted to start at 0 (<name>.section.vtt), the items list qitv-asr's eval/build_subtitle_test.py
# reads (<dir>/items.jsonl), and the section's whole subtitle text, cleaned as that builder cleans a
# cue (<name>.ref.txt), for scoring a live caption run end to end.
# usage: python subs-prep.py <dir> <qitv-asr-code dir>
import json
import sys
from collections import Counter
from pathlib import Path

root, code = Path(sys.argv[1]), Path(sys.argv[2])
sys.path.insert(0, str(code / 'eval'))
from build_subtitle_test import clean, raw_cues  # noqa: E402


def stamp(t):
    h, rest = divmod(t, 3600)
    m, s = divmod(rest, 60)
    return f'{int(h):02d}:{int(m):02d}:{s:06.3f}'


items = []
for line in (root / 'sources.txt').read_text().splitlines():
    if not line.strip():
        continue
    name, vid, a, b = line.split()
    a, b = float(a), float(b)
    vtt = sorted(root.glob(f'{name}.tr*.vtt'))[0]
    cues = [(s - a, e - a, text) for s, e, text in raw_cues(vtt) if s >= a and e <= b]
    out = ['WEBVTT', '']
    for s, e, text in cues:
        out += [f'{stamp(s)} --> {stamp(e)}', *text, '']
    (root / f'{name}.section.vtt').write_text('\n'.join(out), encoding='utf-8')
    notes = Counter()
    ref = ' '.join(t for t in (clean(text, notes) for _, _, text in cues) if t and not any(c in t for c in '♪♫'))
    (root / f'{name}.ref.txt').write_text(ref + '\n', encoding='utf-8')
    items.append({'id': name, 'audio': str(root / f'{name}.wav'), 'subtitles': str(root / f'{name}.section.vtt'),
                  'group': name, 'url': f'https://www.youtube.com/watch?v={vid}'})
    print(f'{name}: {len(cues)} cues, {len(ref.split())} words in {b - a:.0f} s')
(root / 'items.jsonl').write_text(''.join(json.dumps(i, ensure_ascii=False) + '\n' for i in items), encoding='utf-8')
