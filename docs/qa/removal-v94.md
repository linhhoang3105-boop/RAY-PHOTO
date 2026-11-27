# RAY PHOTO v94 — selection continuity and retained scene visibility

## Removal corrections

The current operation's automatic person guards previously cut holes out of
**every saved repair layer** in `remove-editor.prepare`. Detecting an earlier
deleted person as a non-target on a later operation could therefore restore
that person's original pixels. Automatic guards now affect only the current
repair's materialized alpha. Explicit user protection remains global, with a
regression test proving that it can still restore original source pixels.

Tap anchors identify target Pose instances. Every other detected instance is
protected, even when an interactive mask covers most of it. If no instance
owns a tap, detected people remain protected. Manual brush-only removal keeps
its existing overlap-based target decision. Disconnected interactive candidates
are added only inside the tapped person's Pose mask, outside other instances.
AI correction unions old and new selections instead of dropping the old area.
Candidate planes and anchors now follow crop/rotation/flip.

A real-photo trial exposed a separate issue: the interactive mask omitted
flyaway hair and clothing edges, leaving recognizable remnants as context for
LaMa. New AI selections include a **visible**, bounded cleanup rim: 6% of the
selected bounding extent, clamped to 2–24 analysis pixels. It is applied to each
new pick once, before union with earlier correction regions. Person guards and
later manual erase strokes take precedence. Saved selections/patches are not
silently expanded or regenerated.

## Scene visibility and scrolling

Replacement-background object selections retain individual masks and enabled
states. Tapping an existing region toggles its occlusion without discarding it.
A portrait tap hides it; a second tap, the guide button, or front/back controls
restores it. A drag moves the portrait rather than toggling it. Hidden portraits
cast no shadow. Guides use alpha contours only and are never exported.

Legacy single occlusion masks migrate into a retained region without changing
their bytes. Undo/drafts keep the region choices. Background-image pan/zoom
continues to map occlusion masks in the background's own coordinate system.

Panel scrolling no longer cancels queued screen refinement. Layout changes
retain a sufficiently sharp buffer, respecting the refinement pixel budget,
and refresh compose/background/people/removal overlay geometry. These operations
do not rewrite source pixels, normalized strokes, masks or history. Actual
slider drags still pause heavy refinement.

## Validation

- 148 focused automated checks across removal/protection/correction, inference
  plumbing, scene pixels, actual gesture callbacks, undo/drafts, geometry,
  export, preview scheduling, drag input and composition.
- One additional **real-photo** neural integration test uses the existing app
  `golden-hour.webp` and its saved real MagicTouch CPU mask. The new cleanup rim
  is 19 analysis pixels. The shipped LaMa model runs on the shipped WASM
  runtime, one thread, at 960 × 640. Inference took 18.8 seconds on this machine.
  It changed 53,073 selected pixels and **zero pixels outside the final padded
  selection**. The input photo remained unchanged. This is not the user's photo.
- Visual inspection of this fixture found the recognizable hair/clothing
  remnants from the initial tight-mask trial removed. The new tree/flower
  texture is still softer than surrounding real detail; the trial is not proof
  of iPhone/Xingtu quality or exact background recovery.
- [Real-photo comparison](removal-v94-photo.png) and
  [recorded runtime metrics](removal-v94-photo.json).
- Production Worker build passed. All 184 static source assets matched the
  build output; none exceeded the 25 MiB hosting asset limit. Portable HTML
  packaging passed with 73 inline scripts parsed, including both scene modules.

No user original for the reported failure was available during this revision.
No browser QA tool was callable in this environment, and no physical
Safari/iPhone test was performed. The model and weights are unchanged; complex
occlusions, missed Pose instances, railings and large erased areas still need
real-photo review. Automatic protection can only preserve people it detects;
manual green protection remains available.
