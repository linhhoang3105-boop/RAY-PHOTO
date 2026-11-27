# Background scene composition — 2026-11-16

Scope: the main person in **Thay nền** can move, resize uniformly (5–400%), rotate and flip independently of the replacement background. The existing background pan, AI mask and source-space repair brushes remain editable.

## Rendering and controls

- Preserve continuous mask confidence at hair edges. A bounded, color-guided alpha refinement softens the edge without blurring the subject's interior.
- Optional edge decontamination uses nearby opaque foreground colors; `source-atop` retains existing PNG transparency.
- Subject placement uses a normalized affine transform. Its inverse maps repair brushes back into the original mask. Crop/quarter-turn/flip conjugate this transform.
- Foreground objects are selected in the *replacement background*, by the existing on-device interactive model or a manual paint/erase brush. Their masks stay in background-image coordinates when the background is panned or zoomed. Front mode bypasses occlusion; behind mode removes only the selected part of the person and shadow.
- Optional contact and directional cast shadows use the actual cutout alpha and foot bounds. Shadow blur is baked into alpha and does not require Canvas `filter`. Transparent PNG output excludes the shadow.
- Exposure, warmth and restrained scene-light matching affect the cutout only. Prepared cutouts and shadow alpha are cached independently of placement.
- The composition recipe includes all new fields, including typed occlusion mask bytes. Render signatures use mask IDs rather than serializing the bytes. Undo/redo and structured drafts preserve the fields.
- A failed segmentation Worker makes one main-document canvas retry; explicit cancellation does not start another model. Neither the hair module nor the shared beauty runtime was changed.

## Verification performed

- 79 passing tests across background scene/worker fallback, compose, pipeline, people layers, photo geometry, hair, sessions, preset export safety, creative saving and drag input.
- Production Worker build passed using the existing project build command.
- Browser: opened a transparent PNG portrait fixture, selected a different image backdrop, resized to 85%, dragged the subject, enabled contact/cast shadows and painted a tabletop region in front of the subject.
- Applied and exported the browser scene: JPEG, RGB, 600 × 800, 38,654 bytes. Exported pixels retained placement, tabletop occlusion and shadow. No rendering errors were reported for this interaction sequence.
- Confirmed unchanged inline film renderer/recipes, preset assets, hair modules, removal/inpainting modules and hosting audience/configuration.

## Verification limits

- The cloud browser's MediaPipe tasks report missing `kGpuService`, including on the document-canvas retry. Actual automatic hair/person segmentation and interactive object selection could not be visually verified here. The manual occlusion and transparent-PNG composition paths were verified. Do not describe AI recognition as visually accepted on iPhone.
- No physical Safari/iPhone test was performed. Fine hair on complex backgrounds, narrow railings and reflective/transparent objects require real-photo review; the repair brush remains available.
- Shadows and lighting matching are adjustable compositing aids, not inferred three-dimensional scene geometry.

## Manual acceptance on a phone

1. Open a real full-body portrait, run background removal and select a new image backdrop.
2. Inspect hair/shoulder edges, then move, resize, rotate and flip the subject. Repair a small mask region after moving the person.
3. Choose a railing/table/plant in the new background. Check front/behind switching, paint and erase at the object's border, then pan the background and verify the selected object stays aligned.
4. Enable shadows, change direction/length/softness and adjust subject light matching. Confirm no square halo appears and source pixels remain recoverable.
5. Undo/redo, save/reopen a draft and export at the chosen resolution. Transparent PNG must exclude background and cast shadow; JPEG must preserve the complete scene.
