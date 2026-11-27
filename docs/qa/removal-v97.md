# RAY PHOTO v97 — removal on the visible composite

## Reported trigger and fix

The user confirmed that failed taps happened on a replacement-background /
imported-person composition. Previously recognition, stroke coordinates and
inpainting still used the original photograph. A tap at the same displayed
position could therefore select an unrelated object in a different image.

Removal now owns independent documents for original pixels, each background
asset, the primary cutout, and each imported person. Visible hit testing follows
composition order and alpha; an explicit layer selector resolves ambiguity.
Background cover/pan/zoom, perspective inverse mapping and imported rotation /
flips are shared by selection, brushes, overlays and rendered output. Fresh AI
Keep/Add and brush modes also hit the visible scene. Refining a pending selection
stays on its layer. Hidden-original edits are not offered for a replaced scene.

Background repairs run on the replacement image before compositing. Cutout/person
erasures change alpha and reveal the actual existing background, without neural
hallucination or a misleading reconstructed-background label. Other documents,
source assets and person layers stay recoverable. Removing a background occluder
also removes its stale clipping footprint. Render cache signatures include the
cutout removal revision. Geometry edits remap original/cutout documents but keep
background/imported assets in their own image coordinates. Drafts and history
capture all documents. Async inference checks context after both detection
stages and before applying; person caches include the layer signature.

## Recognition and fill

One interactive graph first sees the full target image, then a padded close-up
of the tapped component. A result clipped by an artificial crop edge is rejected
and retried with more context; broad/full-image objects keep the original pass.
Nearest confident seeds avoid jumping to a stronger neighboring component.
AI Add unions residual parts; AI Subtract persists exclusions through later
positive taps and person completion. Existing protection and consecutive-removal
rules remain in force.

LaMa reconstruction has an optional bounded low-frequency RGB seam correction.
Only two clean pixels outside a selected boundary estimate the target color;
selected original colors never participate. High-gradient, protected/excluded,
transparent or insufficient context is skipped. A small smooth field is applied
only when measured boundary mismatch improves at least 10%, per coarse connected
component, with correction limited to 32/255 per channel. Alpha, unselected pixels
and generated texture remain intact. This cannot reconstruct unseen scene truth.

## Verification

- 186 related automated checks passed, covering recognition crops, add/subtract persistence,
  layer routing, pan/zoom, projective and rotated cutouts, erasure, occlusion cache,
  context changes during inference, geometry, native output, continued removal,
  protection, history/drafts, sessions and preview quality.
- Real CPU MagicTouch on a private crop of the supplied room screenshot selected
  the floor fan; a 96 x 96 close-up was accepted and mapped back to 362 x 272.
- The actual editor/compose helpers and packaged LaMa WASM model repaired that
  background in a 576 x 432 composition with a 30/-18 degree projected cutout.
  The correct background asset was analyzed. Original assets were unchanged;
  3,119 background pixels changed inside the expanded selection, zero outside.
  Private input, masks and outputs remain outside the repository/deployment.
- Color-finishing tests compare seam error, retain generated fine texture, change
  the erased original RGB to prove no ghost blending, and verify protected,
  excluded and unselected bytes remain identical. Runtime invokes finishing and
  releases its session on both success and failure.

- Production Worker and portable HTML builds passed. All 184 static source
  assets matched the deployable output; all 73 portable inline scripts parsed.
  No static asset exceeded 25 MiB.

## Limits

Small-object close-ups and correct-layer context improve this reported failure;
selection can still miss thin, occluded or ambiguous parts. Inspect the red area
and use Add/Subtract or brushes. Large structural reconstruction can still be
soft or inaccurate. No iPhone/Xingtu quality equivalence is claimed. Person
placement transforms the existing cutout, not its photographed body pose.

No managed browser was available. Verification uses real Canvas source rendering,
CPU segmentation and packaged neural inference; no physical Safari/iPhone check
was performed. The original image is never uploaded by the removal flow.
