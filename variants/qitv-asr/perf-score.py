# The small-perf runs' whole texts as score.py rows: each section's subtitles (<n>.ref.txt)
# against each way of reading's captions (<out>/<variant>/<n>.turkish.txt)
# usage: python -I perf-score.py <yt dir> <out dir> <rows dir> variant ...   (then eval/score.py)
import json
import sys
from pathlib import Path

yt, out, rows = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
variants = sys.argv[4:]
rows.mkdir(parents=True, exist_ok=True)
names = ['talk', 'drama', 'film', 'tedx', 'narr']
with open(rows / 'live.jsonl', 'w', encoding='utf-8') as f:
    for n in names:
        f.write(json.dumps({'audio_filepath': str(yt / f'{n}.wav'), 'text': (yt / f'{n}.ref.txt').read_text().strip(), 'item': n}, ensure_ascii=False) + '\n')
for v in variants:
    with open(rows / f'{v}.jsonl', 'w', encoding='utf-8') as f:
        for n in names:
            p = out / v / f'{n}.turkish.txt'
            hyp = p.read_text().strip() if p.exists() else ''
            if not p.exists():
                print(f'missing: {p}')
            f.write(json.dumps({'audio_filepath': str(yt / f'{n}.wav'), 'hyp': hyp}, ensure_ascii=False) + '\n')
