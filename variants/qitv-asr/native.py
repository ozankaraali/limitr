import sys, time, glob, os
import numpy as np, soundfile as sf, sherpa_onnx
S = os.path.dirname(os.path.abspath(__file__))
threads = int(sys.argv[1]) if len(sys.argv) > 1 else 1
for m in ('small', 'mid'):
    d = f'{S}/models/{m}'
    rec = sherpa_onnx.OfflineRecognizer.from_moonshine_v2(encoder=f'{d}/encoder_model_quantized.onnx', decoder=f'{d}/decoder_model_merged_quantized.onnx', tokens=f'{d}/tokens.txt', num_threads=threads)
    print(f'== {m}, {threads} thread(s)')
    for wav in sorted(glob.glob(f'{S}/clips/*.wav')):
        audio, rate = sf.read(wav, dtype='float32')
        for w in (4, 8, 15):
            a = audio[: w * 16000]
            a = np.pad(a, (0, -len(a) % 80))
            st = rec.create_stream(); st.accept_waveform(rate, a)
            t = time.perf_counter(); rec.decode_stream(st); ms = (time.perf_counter() - t) * 1000
            print(f'  {os.path.basename(wav)[:22]:22} {w:2} s {ms:6.0f} ms  {st.result.text[:150]}')
