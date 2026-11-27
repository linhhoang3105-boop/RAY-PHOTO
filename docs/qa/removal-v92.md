# RAY PHOTO v92 — explicit AI routing and result attribution

Two source-level problems could obscure which processor was used:

1. The sample-background tap handler set `engine: 'patch'` implicitly. Selecting
   a source sample could therefore turn off the neural route.
2. Mobile CSS hid `#sessionStatus`; progress and the actual result processor
   were not visible in the compact phone toolbar.

The sample handler now preserves the current engine. Sample controls are shown
only in explicit fast mode, and obsolete saved sample mode is normalized when
restoring an AI session. Source references remain available if fast mode is
chosen later; existing image pixels and masks are not changed by this choice.

The result label derives from immutable patch metadata, not the selected mode:
`engine: lama` plus `detail: generated` identifies a completed neural result;
native exemplar patches remain labelled fast. Old unclassified patches are
reported as unverified, and mixed results show counts. Changing the selected
engine cannot relabel an existing fast result as neural.

The result's **Dùng AI** action explicitly selects AI and retries the last
saved deletion. The prior patch stays until reconstruction succeeds. The
original source is analysed with that patch omitted, as in v91. Confirmation
and saving occur only after success and a document identity check. Missing
selection data or single-file mode suppresses this shortcut. Earlier patches
are not silently replaced; a mixed result remains visibly mixed.

Mobile result/status CSS now shows this attribution. During removal the
compact tab strip gives way to live progress and a Stop button. Stopping keeps
the mask/previous result. AI mode rejects an exemplar payload instead of
marking it as a neural success.

Validation: 102 related checks passed, including the actual sample handler,
AI result validation, status data, explicit upgrade routing, delayed success,
failure, cancellation, stale document rejection, masks, history, geometry,
export and preview behavior. CSS parsing, production build, asset comparison
and standalone packaging passed. An additional unrelated Photobooth integration
run stalled during real FFmpeg video encoding and was stopped; it is not
included in the 102 passing checks. No Photobooth source was changed.

The v91 neural model, weights, packing and inference implementation are
unchanged. No claim is made that a screenshot or a short runtime proves which
engine ran on a user's device. This session has no callable Sites browser QA
tool; direct Safari/iPhone verification remains outstanding. No user photo or
draft has been uploaded or included in the repository.
