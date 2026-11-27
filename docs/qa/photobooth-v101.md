# Photobooth V101: image area matches the film editor

Baseline: version 100, source 816cfc59b36e48ddd06f78128d33ea810bc54e7c.

- Mobile: the preview takes the remaining space rather than a fixed 50% of the screen. A compact 48 px header and home link replace the bottom navigation while working in Photobooth.
- The tool tray starts collapsed. Its grip and tabs open it; keyboard Home/End and arrows adjust it. The visible file button, playback and save controls remain outside the tray.
- Desktop: the controls use 340 px rather than 440 px; the timeline moves into the tool panel to leave more image height.
- At the same 390 × 844 viewport, the Photobooth canvas is 382 × 509.328125 CSS pixels. The film editor displaying a 1200 × 1600 reference is 382 × 509 CSS pixels.
- Browser checks: quick import while the tray is closed, four filled slots, tray open/closed, maximum height 280 px, no horizontal tool overflow (380 px client and scroll widths), switching to Frames, changing to Hello newspaper and generating the ready-to-save PNG dialog.
- Screenshot: photobooth-compare-v101.jpg, left Photobooth and right film editor, both at 390 × 844.

Rendering, export dimensions and source media processing are unchanged. This checks responsive layout in Chrome; it is not a physical iPhone/Safari run.
