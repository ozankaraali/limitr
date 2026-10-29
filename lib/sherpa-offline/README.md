# sherpa-onnx (WebAssembly, offline speech recognition)

From k2-fsa's official demo space
[k2-fsa/web-assembly-vad-asr-sherpa-onnx-zh-zipformer-ctc](https://huggingface.co/spaces/k2-fsa/web-assembly-vad-asr-sherpa-onnx-zh-zipformer-ctc)
at commit `9d5fc71d88ab1222ed1af2274fb194592af48455` ([sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx),
Apache-2.0):

- `sherpa-onnx-wasm-main-vad-asr.wasm` and `sherpa-onnx-asr.js` as published there.
- `sherpa-onnx-wasm-main-vad-asr.js` as published, minus the block that downloaded the space's own
  model (`sherpa-onnx-wasm-main-vad-asr.data`, 368 MB): Limitr writes the model it uses into the
  module's file system itself (`lib/stt-offline-worker.js`).
