# MiLMMT through native onnxruntime (CPU), the same greedy loop as mtprobe.js: per-token cost
import os, sys, time, numpy as np, onnxruntime as ort
from tokenizers import Tokenizer
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'mt')
threads = int(sys.argv[1]) if len(sys.argv) > 1 else 4
so = ort.SessionOptions(); so.intra_op_num_threads = threads
s = ort.InferenceSession(os.path.join(D, 'model.onnx'), so, providers=['CPUExecutionProvider'])
tok = Tokenizer.from_file(os.path.join(D, 'tokenizer.json'))
past = [i.name for i in s.get_inputs() if i.name.startswith('past_key_values.')]
text = 'Ya evinde sorun olmayan bizim ev dört dörtlük, her şeyini müteahhitimiz çok iyi düşünmüş.'
ids = tok.encode(f'Translate this from Turkish to English:\nTurkish: {text}\nEnglish:', add_special_tokens=False).ids
feeds = {'input_ids': np.array([ids], dtype=np.int64), **{p: np.zeros((1, 1, 0, 256), np.float32) for p in past}}
total, made, times = len(ids), [], []
for step in range(96):
    feeds['attention_mask'] = np.ones((1, total), np.int64)
    t = time.perf_counter(); r = dict(zip([o.name for o in s.get_outputs()], s.run(None, feeds))); times.append(time.perf_counter() - t)
    nxt = int(r['next_token'].reshape(-1)[0])
    if nxt in (1, 106): break
    made.append(nxt)
    feeds = {'input_ids': np.array([[nxt]], np.int64), **{p: r[p.replace('past_key_values.', 'present.')] for p in past}}
    total += 1
print(f'native onnxruntime {ort.__version__}, {threads} threads: prompt {len(ids)} tokens in {times[0]:.2f} s, then {len(made)} tokens at {1000 * np.mean(times[1:]):.0f} ms each')
print('  ->', tok.decode(made, skip_special_tokens=True).strip())
