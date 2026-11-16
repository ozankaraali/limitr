import sys, os, time, numpy as np, soundfile as sf, sherpa_onnx
S = os.path.dirname(os.path.abspath(__file__)); d = f'{S}/models/conformer'
for method in ('greedy_search', 'modified_beam_search'):
    rec = sherpa_onnx.OnlineRecognizer.from_transducer(tokens=f'{d}/tokens.txt', encoder=f'{d}/encoder.int8.onnx', decoder=f'{d}/decoder.int8.onnx', joiner=f'{d}/joiner.int8.onnx', num_threads=1, normalize_samples=False, decoding_method=method, max_active_paths=4, blank_penalty=0.5)
    for f in sys.argv[1:]:
        audio, rate = sf.read(f'{S}/clips/{f}', dtype='float32')
        st = rec.create_stream(); st.accept_waveform(rate, np.zeros(int(rate * 0.16), dtype=np.float32))
        t = time.perf_counter()
        for i in range(0, len(audio), 8000):
            st.accept_waveform(rate, audio[i:i + 8000])
            while rec.is_ready(st): rec.decode_stream(st)
        st.accept_waveform(rate, np.zeros(rate * 3, dtype=np.float32)); st.input_finished()
        while rec.is_ready(st): rec.decode_stream(st)
        print(f'{method} {f}: {(time.perf_counter() - t) / (len(audio) / rate) * 100:.1f}% of real time\n  {rec.get_result(st)[:2000]}')
