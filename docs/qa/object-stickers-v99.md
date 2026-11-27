# RAY PHOTO v99 — arbitrary cutouts and reusable local PNG stickers

## Behavior

A dedicated modal opens from Background or Composite/Sticker. Its image is the
original photograph with source repairs, or a separately chosen photo; it does
not infer a person from every file. Interactive MagicTouch identifies the tapped
connected object. Positive/negative taps edit that selection; keep/remove brushes
refine it. A corner polygon supports paintings, frames and angular objects when
semantic segmentation selects the wrong part. Green overlay shows what stays;
a checkerboard result view shows actual transparency. Local undo includes masks,
brush strokes, polygon points and feather edits.

Actions are distinct: apply the mask to the current original, insert a trimmed
PNG as a separate composite layer, save it to a local reusable sticker library,
or download/share PNG. A file chosen separately cannot overwrite the unrelated
original photograph's mask. The applied mask starts without portrait dehalo or
extra edge processing; later explicit edge/light adjustments remain available.
Applying a new subject clears only old subject-erasure edits, within history;
source/background/imported-layer repairs remain intact.

PNG export uses native source pixels and trims alpha margins with two pixels of
transparent padding. It exports no film treatment, replacement background, text
or imported layers. Natural source alpha is multiplied by selection alpha;
fully transparent RGB is zero. Large selected crops are rejected before excessive
allocation rather than silently downscaled. The stored PNG can be inserted into
other photos and retained in their existing structured-clone drafts.

The separate `ray-photo-stickers` IndexedDB database holds up to 40 PNG cutouts.
Reaching the limit or a quota error leaves old stickers intact and offers PNG
saving. No photo/model API upload or new model/dependency is introduced. Person
portrait-auto remains available explicitly alongside arbitrary-object selection.

The input selector also offers the currently selected replacement-background
asset, including its background repairs, as an independent extraction source.
It cannot replace the unrelated original mask.

## Integrity and lifecycle

Repaired-source snapshots are owned copies, avoiding recycled preview caches.
Other images/bitmaps and object URLs are released on close. A modal generation
check prevents late decode, export, storage or AI results from closing a newly
opened workspace or clearing its busy state. PNG encoding checks image/revision;
sticker insertion rechecks source, layer limit, cancellation and competing work
after decoding. AI errors preserve the mask. Combining further taps uses the raw
mask and applies feather once, preventing progressive edge blur.

## Verification

- 211 broad checks passed; 146 related checks passed after final integration.
  All 36 focused cutout checks passed. They cover arbitrary component masks, normalized
  add/subtract, angled artwork polygons, brush holes, feather, natural alpha,
  native crop dimensions, exact applied matte/color, stable repaired snapshots,
  history/layer integrity, local Blob persistence, limits/quotas and modal races.
- Actual pinned MagicTouch CPU confidence from the supplied room's floor fan
  produced a 58x56 transparent PNG from the 362x272 source crop. Its selected
  source bounds were (52,145,54,52), with 2px padding. The actual composite helper
  inserted that PNG as an independent generic layer and retained its Blob.
- A synthetic skewed artwork polygon from an 1800x1200 source exported at
  1268x836 with straight transparent outer edges. This is a manual-polygon check,
  not a claim that semantic AI always recognizes an entire artwork frame.
- Private photographs, masks and QA exports remain outside the repository and
  deployment. Tests use synthetic fixtures; no user image is published.

## Limits

Ambiguous artwork can be interpreted as a depicted object instead of the frame;
use corner selection or brushes. Transparency edges depend on the input and
segmentation resolution. The library stays on this browser/device and is not a
cloud backup. Saving PNG does not install an OS messaging sticker pack.

Managed browser tools are unavailable. Checks use source handlers, native Canvas,
recorded real model output and local storage mocks; no physical Safari/iPhone
validation was performed. Production Worker and portable builds are verified
before publishing. All 187 static source assets match the deployable build,
and all 76 portable inline scripts parse.
