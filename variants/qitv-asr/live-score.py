# The live run's whole texts (one per engine and section) as score.py rows: each section's whole
# subtitle text (<name>.ref.txt from subs-prep.py) against what each engine's captions said.
# usage: python live-score.py <yt dir> <live dir> <out dir>   (then eval/score.py on what it writes)
import json
import sys
from pathlib import Path

yt, live, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
names = [line.split()[0] for line in (yt / 'sources.txt').read_text().splitlines() if line.strip()]
engines = {'ufak-live': '{n}.ufak-live.txt', 'small': '{n}.turkish.txt', 'conformer': 'sec-{n}.conformer.txt'}
with open(out / 'live.jsonl', 'w', encoding='utf-8') as test:
    for n in names:
        test.write(json.dumps({'audio_filepath': str(yt / f'{n}.wav'), 'text': (yt / f'{n}.ref.txt').read_text().strip(), 'item': n}, ensure_ascii=False) + '\n')
for engine, pattern in engines.items():
    with open(out / f'live-{engine}.jsonl', 'w', encoding='utf-8') as hyps:
        for n in names:
            f = live / pattern.format(n=n)
            hyp = f.read_text().strip() if f.exists() else ''
            hyps.write(json.dumps({'audio_filepath': str(yt / f'{n}.wav'), 'hyp': hyp}, ensure_ascii=False) + '\n')
            if not f.exists():
                print(f'missing: {f.name}')
