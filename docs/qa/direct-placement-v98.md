# RAY PHOTO v98 — direct placement and readable mobile controls

## Changes

The screenshot showed an approximately sideways portrait and controls below the
visible tray. Direct handles now separate rotation from resizing. Rotation and
scale use the cutout's visible center, or a saved seat contact, rather than an
empty original-image center. A contact handle moves the attached subject. Handle
positions remain reachable inside the photo; labels distinguish each action.
Small cutouts separate the contact and resize touch targets. Keyboard edits are
scoped to the focused handle without also moving the portrait.

Two fingers apply one screen similarity outside the existing perspective plane:
translation, rotation and uniform scale follow both fingers. Perspective, flips,
alpha and contact metadata remain editable. A finger-count transition cancels the
old single tap; the remaining finger cannot accidentally hide/move the subject.
Document release observers still run, allowing the sharp idle preview to resume.
Original bindDrag behavior for other tools is unchanged.

Placing a chair/table contact now removes stale roll/perspective/upside-down flip
while keeping the chosen size. Later direct edits preserve that contact. Optional
AI foreground selection below the contact clips out the chair backrest above it;
the source mask stays immutable and the narrow edge is feathered. Ordinary object
selection retains the full mask without a contact. Brushes still refine either
kind. Empty clipped results are rejected instead of creating an ineffective
occlusion region.

A real CPU test found a close-up changing a whole chair into only one leg. A
bounded, confident full-image detection now rejects a close-up under 35% of its
native connected area, retries with more context, then retains the original if
necessary. Empty/overbroad detections may still recover a smaller valid object.

The placement row, explanation and upright/scale/flip controls come before closed
advanced sections. Background setup auto-collapses after a cutout is ready and
remains accessible at the top. A visible Stop AI action and progress/failure text
remain available when setup is closed. The background-only portrait tray defaults
to 260px at 390x844 and 220px at 390x667; remembered manual sizes, compact and
landscape modes remain in force.

## Verification

- 231 broad automated checks passed before final review corrections. After the
  release-observer and chair-shrink fixes, 130 related checks passed, plus the
  collapsed-setup progress/stop regression. Coverage includes actual editor
  callbacks, mouse/touch/pointer input, perspective, alpha, occlusion, background
  routing, clipping, undo/drafts, sessions, geometry and preview scheduling.
- At 390x667 a full 4:3 photograph remains 382x286.5 CSS pixels. The 1200x900 source
  preview buffer remains byte-identical through tray layout; overlays synchronize
  without redrawing the source. Manual 178px and collapsed 88px settings persist.
- Private CPU MagicTouch on the supplied room crop first found a 5,120px chair.
  The 480px close-up leg result was rejected. A larger crop retained a 4,063px
  chair, with the expected full chair extent instead of one leg.
- Real Canvas rendering of the supplied room/cutout at 576x432 tested roll -88°,
  upright 0°, then direct -7°/58% adjustment. Contact stayed at (426.24,276.48).
  Actual CPU chair masks were clipped below that point for foreground occlusion.
  Private inputs and outputs stay outside source/deployment.
- Production Worker and portable HTML builds passed. All 184 static source
  assets matched the deployment output and all 73 portable inline scripts parsed. No new dependency/model or photo upload is added.

## Limits

Placement preserves the photographed body pose. A half-body cutout needs an
appropriate table/chair edge; it cannot produce unseen legs or a new seated pose.
Clipping at contact is horizontal, so sloping tabletop edges may need brush
refinement. Detection remains approximate.

No managed browser tool is available; no browser screenshots or physical Safari/
iPhone validation were performed. The visual checks above use source Canvas
rendering and model inference, not a browser layout screenshot.
