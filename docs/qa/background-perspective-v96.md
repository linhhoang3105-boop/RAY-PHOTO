# RAY PHOTO v96 — perspective placement and chair/table contact

## Behavior

Normal portrait taps select/retain the current placement. They do not hide a
visible subject or reset front/behind order. Explicit **Chạm để ẩn / hiện**
and the visibility buttons retain hide/restore. Hiding/restoring keeps scene
object masks. A new source starts in movement mode.

Yaw (±65°), pitch (±55°) and existing in-plane rotation now position the
photographed cutout as a projective plane. This is finite-distance projection
with converging opposite edges, rather than only an affine stretch. Inverse
projection maps selection and repair strokes to the retained source.

**Đặt vào ghế / bàn** attaches the bottom center of the cutout to a tapped
scene point. Scaling, roll, flip and perspective edits preserve that contact.
The first tilt also adopts the cutout base as its pivot, avoiding drift from
rotating around an empty photo margin. Contact shadows and light matching
follow the same point. The projected SVG outline, resize handle and faint
guide use the same geometry; SVG visibility is controlled with attributes.

Occlusion masks remain attached to the background image. A chair's front edge
or table can cover the appropriate part of the person. If AI selects the whole
chair, the reveal brush can remove unwanted occlusion from its backrest.

## Rendering and persistence

Inverse image sampling uses premultiplied alpha. It avoids triangle mesh seams
and retains translucent hair/PNG pixels. Bounds include **all nonzero alpha**,
including faint strands and soft shadow tails outside the stronger handle
outline. A cached projective texture is reused while moving, resizing or
rotating the person; changing the projection replaces it, and reset/clear
releases owned buffers. Neutral perspective uses the original affine path.

Native output dimensions are retained. Pose fields, the 3×3 local homography
and the normalized contact point are part of the existing recipe, history and
draft. Crop/quarter-turn/flip conjugate both the plane and its source anchor;
changing an unchanged slider value after geometry edits does not jump.
Old scene recipes default to neutral perspective without rewriting masks.

## Verification

- 108 related automated checks passed: projection/inverse mapping across
  aspect ratios and extreme angles, persistent contact, crop/rotation/flip,
  native alpha/color edges, faint hair, projected masks, background occlusion,
  contact shadows, texture caching, history/drafts, actual tap/drag/placement
  callbacks, slider helper, SVG visibility/reflow, saving and preview quality.
- Private renderer check used crops of the supplied screenshots and a CPU
  interactive cutout. A chair front-edge mask was set manually. Yaw/pitch
  0°/0°, 30°/−18°, and −30°/18° all retained contact at (414.72, 259.2) in a
  576 × 432 export. These were source-renderer checks, not browser screenshots.
  User screenshots, derived cutouts and outputs stay outside the repository
  and deployment.
- Existing source pixels and masks remain recoverable; no pose-generation
  service, new model or photo upload was introduced.
- Production Worker and portable HTML builds passed. All 184 static source
  assets matched build output, 73 portable inline scripts parsed, and no static
  asset exceeded the hosting limit of 25 MiB.

## Limits

This transforms the photographed plane. It does not reconstruct a 3D body,
invent hidden sides, create legs or convert a standing pose into a seated one.
A half-body image needs a foreground table/chair edge to conceal its crop;
an unobstructed full-body seated result needs an appropriate source pose.
Cutout quality and the accuracy of the selected foreground edge still matter.

No callable managed browser tool was available, so browser preview was skipped
under the Sites workflow. No physical Safari/iPhone test was performed.
