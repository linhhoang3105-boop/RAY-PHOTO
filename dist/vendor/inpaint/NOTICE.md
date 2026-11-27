# On-device background inpainting

The erase tool uses LaMa (Large Mask Inpainting), Suvorov et al., WACV 2022,
by Samsung AI Center / [advimman/lama](https://github.com/advimman/lama).
The model and weights are licensed under Apache-2.0; see LAMA-LICENSE.txt.

The fixed 512 × 512, weight-only INT8 ONNX export is from
[g-ronimo/lama](https://huggingface.co/g-ronimo/lama), immutable commit
`386a67cedf9b8bb4fe76798c10c8d77abc0a5cc8`, file `lama_512_int8.onnx`.
SHA-256: `cab19978adc306622fe37ef60d4a52103b99c98141d499c2a2366a7ed1255dbe`.
It uses masked RGB (0..1) plus a binary erase mask as one `[1,4,512,512]`
input; output is RGB (0..1), `[1,3,512,512]`.

The model is split into four byte ranges to respect hosting asset limits.
Concatenation reproduces the original, unmodified ONNX file. `model.json`
records each range's size and SHA-256. The loader verifies the ranges and
the complete model before inference. Model files are downloaded on first use
and cached when browser storage is available. No photograph is uploaded.

ONNX Runtime Web 1.23.2 is from Microsoft, MIT licence; see
ONNXRUNTIME-LICENSE.txt. Runtime files are copied from the exact npm package
in package-lock.json by scripts/prepare-inpaint-assets.mjs.

LaMa estimates missing content; it cannot recover the actual hidden scene.
The independent fast patch mode remains available. Apple Clean Up is not
used, and this implementation is not affiliated with Apple.
