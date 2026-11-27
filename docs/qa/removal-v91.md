# RAY PHOTO v91 — neural background reconstruction

The reported v90 result was fragmented along a long diagonal selection. That
version removed the false bounding-box rejection but still used the same local
exemplar synthesis. The new default on the hosted app is actual LaMa inference;
the original engine remains explicitly named **Vá nền nhanh**.

## Validation

- 88 related automated checks passed, plus one real model integration check.
  The integration check loads the exact four shipped model parts, verifies the
  complete SHA-256 and runs the shipped ONNX Runtime Web 1.23.2 WASM binary,
  single-threaded. It does not substitute a mock model or Python inference.
- Synthetic railings with a diagonal occluder: mean absolute channel error in
  the selected region was 3.885 with LaMa versus 12.506 with fast patch fill.
  Pixels outside the expanded selection had zero changed bytes. See
  `removal-v91-structure.png` and `removal-v91-model.json`. This controlled scene
  is not the user's cat photo and does not establish performance on all photos.
- Model creation and inference took about 19.6 seconds on the QA CPU. The test
  process peak RSS was about 758 MiB, including model, WASM, fixtures and the old
  engine comparison. These numbers do not represent iPhone speed or memory.
- Mask padding, green protection, aspect ratio, edge reflection, retry
  mirroring, native-size hard-alpha compositing, sparse patches, old draft
  replacement, cancellation, changed-document rejection, download integrity,
  partial cache recovery and offline model cache reads are covered.
- Old fragmented patches can be replaced from their saved selection using
  **Chỉnh tiếp → Xóa người → AI tái tạo nền → Tái tạo lại**. The analysis source
  omits the patch being replaced, so AI sees the stored original scene.

## Assets and behavior

LaMa export: `g-ronimo/lama`, immutable commit
`386a67cedf9b8bb4fe76798c10c8d77abc0a5cc8`, `lama_512_int8.onnx`, Apache-2.0.
SHA-256 `cab19978adc306622fe37ef60d4a52103b99c98141d499c2a2366a7ed1255dbe`.
The original 62,074,990-byte model is split into four byte ranges below the
hosting per-asset limit. Inference input is masked RGB plus the binary mask,
`[1,4,512,512]`; output is RGB `[1,3,512,512]` in 0..1.

Runtime and model assets total about 75 MB, downloaded lazily. The UI states
the initial download and possible wait. Model caching is best effort; storage
eviction may require downloading again. A dedicated verified cache survives
application service-worker upgrades. There is no photo inference upload,
server API key or paid inference endpoint. Worker termination cancels the job
and releases its model memory. Failures preserve the selection/old patch and
do not silently fall back to fragmented fill.

Generated RGB is resized separately from the hard selection and protection at
the original photo resolution. The generated region is estimated content;
detail in that region is not original native texture. Unselected/protected
source pixels retain their original values. History and drafts store one
logical patch, including when native materialization uses several tiles.

## Limits

No callable Sites browser QA tool is available in this session. Production
build and actual WASM inference passed locally, but browser/Safari/iPhone
inference has not been tested directly. Memory and download requirements can
exceed older devices; errors offer a smaller selection or explicit fast fill.
The single-file HTML keeps the previous fast mode; neural assets are available
in the hosted/bundled application rather than embedded into that HTML.

LaMa can misinterpret complex scenes, produce seams or soften reconstructed
detail. Apple Clean Up is not used and equal quality is not claimed. Exported
flattened photos without an original/draft cannot recover the original hidden
scene. No user-supplied photograph is included in source or QA assets.
