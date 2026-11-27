# MediaPipe Tasks Vision

Version 0.10.21, Copyright Google LLC. Distributed under Apache License 2.0; see LICENSE.txt.

The runtime and model files are self-hosted here. Sources, sizes and SHA-256 hashes are recorded in assets.json.

- Face Landmarker model: float16, version 1.
- Hair Segmenter model: float32, version 1.
- [Official MediaPipe repository](https://github.com/google-ai-edge/mediapipe)
- [Face Landmarker documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- [Image Segmenter documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter/web_js)

Photo data is passed to the local runtime, never to a remote inference endpoint.

Bundled additions: pose_landmarker_lite.task and selfie_multiclass_256x256.tflite, official Google MediaPipe model assets. Provenance and SHA-256 values are recorded in assets.json.

MagicTouch interactive object segmenter: official float32 version 1, Apache 2.0. Model provenance and SHA-256 are pinned in assets.json. Used only on the device for tap-selected object/person masks.
