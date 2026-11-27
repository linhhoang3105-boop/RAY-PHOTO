"""Restore pinned, self-hosted MediaPipe assets; verify the tracked SHA-256 manifest."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / "dist/vendor/mediapipe"
MANIFEST = json.loads((ROOT / "assets.json").read_text())


def restore(item):
    name, entry = item
    path = ROOT / name
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == entry["sha256"]:
        return f"Verified {name}"
    with urllib.request.urlopen(entry["url"], timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != entry["sha256"]:
        raise ValueError(f"SHA-256 mismatch: {name}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return f"Restored {name}"


if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for message in pool.map(restore, MANIFEST.items()):
            print(message)
