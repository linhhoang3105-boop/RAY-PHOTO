# RAY PHOTO v95 — consecutive removal on a reported real-photo failure

## Findings and changes

The v94 automatic-guard fix did not cover every replacement path:

- Clearing/replacing a correction selection could leave `editingPatchId`
  active. Replacing that patch with a small residual-only mask exposed original
  pixels throughout the omitted part of the old deletion.
- Retry always chose `lastSelection`, ignoring newly painted residuals.
- Automatic person detection could mistake an already generated repair for
  kept clothing, making that repair impossible to clean up locally.
- Pose-only person detection returned **zero instances** on the supplied
  low-angle portrait despite two visible faces. The pinned face model found
  both. The pinned interactive model can use their noses as independent seeds.
- Protected people were absent from the final deletion mask but still visible
  to the neural model as background context. This encouraged dark hair/clothing
  fragments in the replacement background.

Clearing a selection now exits correction replacement and hides its overlay.
Retry uses pending edits when present. A replacement unions the rendered old
patch alpha into its reconstruction mask, independent of saved editable strokes.
This covers legacy, tiled and geometry-transformed patches. Prior patches are
left intact until inference/materialization succeeds.

Automatic protection is ignored only within existing repair pixels; explicit
user protection still wins there. A fresh cleanup changes only its actual
selection, rather than automatically selecting every earlier repair. The same
rule is used by the selection overlay. Closed confidence holes in automatic
guards are filled; user unprotect strokes can still reopen them.

FaceLandmarker checks for faces not covered by Pose masks, then obtains an
interactive instance for each. Tasks close between stages. Existing packaged
weights are reused, with no new model/dependency in the deployed application.
Face failures remain visible and do not silently disable explicit protection.

The inference-only context mask excludes protected people and high-confidence
foreground. Its alpha is **not** exported: output remains restricted to the
selected deletion, with protected pixels unchanged. Less than 2% available model
context is rejected before loading inference weights. Source pixels are retained.

## Verification

- 100 automated checks passed across removal/correction/retry/protection,
  neural input/output and worker routing, history/drafts, transformed/tiled
  repair coverage, source geometry, preview scheduling and quality.
- New tests execute the actual editor `prepare` and `run` functions. They cover
  residual-only replacement, clearing then painting then retrying, pending edits,
  false automatic guards on old repairs, explicit protection, transformed/tiled
  alpha support, empty-Pose face fallback, task cleanup and excluded context.
- Production Worker and portable HTML builds passed. All 184 static assets
  matched the build output, 73 portable inline scripts parsed, and no deployed
  static asset exceeded 25 MiB.
- Private local test on the supplied original: native 1280 × 959, analysis
  960 × 719, two faces, zero original Pose instances. Face-seeded masks and the
  actual selection/protection/editor pipeline were used. The shipped LaMa INT8
  model ran through the shipped ONNX Runtime WASM backend, one thread.
- First removal took about 24.4 seconds; subsequent cleanup about 23.6 seconds
  on this machine. The second action followed correction → clear selection →
  select residual region → retry. It retained the first repair and added a
  second. In each pass, **zero pixels outside the new repair alpha and zero
  protected pixels changed**. The original source remained byte-identical.
- Visual inspection confirmed that cleanup did not restore the removed person.
  Dark person-shaped context artifacts were reduced. Background texture,
  narrow hair boundaries and the reconstructed cable/chain remain imperfect;
  this is not evidence of iPhone/Xingtu-equivalent reconstruction.

The user original, derived masks, repair data and output images remain in
private workspace scratch files; none are committed or included in deployment.
The segmentation check used MediaPipe Python CPU with the same packaged models;
Web API callbacks were verified with tests. No callable browser QA tool or
physical Safari/iPhone verification was available. This is not a replay of the
user's exact saved draft or proof of which button they originally pressed.
