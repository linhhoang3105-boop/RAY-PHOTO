# Photobooth V100

Scope: Photobooth UI and import handling only. The print renderer, film presets, hair, makeup, removal and body tools are unchanged. Source baseline: f5dd0dfb13250f7b5974893e4d0a834f2eb638a1 (Site version 99).

## Validation

- 58/58 Photobooth controller, media, frame geometry and design checks pass. After the final gesture/timeline fix, controller/media 43/43 pass again.
- New controller checks cover same-basename JPG/MOV occupying one slot, independent neighbouring content, pinch and pan changing real rendered pixels, moving media between slots without disposing its source, and drop replacement of one slot.
- Browser: mixed still + video + GIF; on-canvas selection; full-frame and enlarged-slot views; timeline playback; output length/size and MP4 export.
- Browser at 390 × 844 CSS pixels through a real nested app iframe: no horizontal overflow in the tools; automatic scrolling to the selected editor; compact always-visible save controls; enlarged cell; expansion toggle. Native mouse drag in the enlarged still changed the resulting crop.
- Actual export: H.264 MP4, 476 × 720 px, 2.072967 s, 79,185 bytes. Mean per-channel changes in interior slot pixels at 0.25 / 0.5 / 1 s, relative to the initial frame: still 0.03 / 0.03 / 0.03; video 0.22 / 0.24 / 7.79; GIF 141.27 / 152.29 / 152.28. The two motion sources move independently.
- The automation browser cannot download blob URLs from embedded frames, so binary export verification used the same Photobooth page as a top-level tab. The embedded app reached its ready-to-save video dialog successfully.

## Practical limits

Live Photo imports are motion files (video export, or a paired original still + MOV); the web picker may supply just a still image. Native Live Photo motion cannot be reconstructed from that still. Safari/iPhone hardware, HEVC/MOV decoding and camera hardware have not been tested here. Two-finger pointer behavior has controller coverage; the browser drag check used a mouse. Keep the existing MP4/WebM feature detection and PNG fallback.

Apple reference: https://support.apple.com/en-nz/105029
