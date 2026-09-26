"""Trim and pack people sheets into atlases (and record their frames).

    blender -b --factory-startup -P tools/art/repack_people.py -- public/art/people

Reads each sheet in people.json (a grid of frames: rows down/left/right/up,
then the turn row), trims every frame to what is visible, packs them, and
writes the atlas back under the same name with a frame table in people.json.
Idempotent: sheets that already have a frame table are skipped.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import imageio  # noqa: E402
import pack  # noqa: E402


def frames_of(img, rows, cols, turns, fw, fh):
    out = []
    for r, row in enumerate(rows):
        for c in range(cols):
            out.append((f"{row}-{c}", img[r * fh : (r + 1) * fh, c * fw : (c + 1) * fw]))
    for c, turn in enumerate(turns):
        out.append((f"turn-{turn}", img[len(rows) * fh : (len(rows) + 1) * fh, c * fw : (c + 1) * fw]))
    return out


def repack(folder):
    path = os.path.join(folder, "people.json")
    manifest = json.load(open(path))
    for pid, e in manifest.items():
        atlas = e.setdefault("atlas", {})
        cols = len(e["columns"])
        for variant, file in e["sheets"].items():
            if file in atlas:
                continue
            img = imageio.load(os.path.join(folder, file))
            frames = frames_of(img, e["rows"], cols, e["turns"], e["frameWidth"], e["frameHeight"])
            packed, table = pack.pack_frames(frames, False)
            imageio.save(packed, os.path.join(folder, file), "WEBP", 90)
            atlas[file] = table
        for variant, s in e.get("shadows", {}).items():
            file = s["sheet"]
            if file in atlas:
                continue
            img = imageio.load(os.path.join(folder, file))
            frames = frames_of(img, e["rows"], cols, e["turns"], s["frameWidth"], s["frameHeight"])
            packed, table = pack.pack_frames(frames, True)
            imageio.save(packed, os.path.join(folder, file), "WEBP", 62)
            atlas[file] = table
        print("PACKED", pid)
    json.dump(manifest, open(path, "w"), indent=1, sort_keys=True)


if __name__ == "__main__":
    repack(sys.argv[sys.argv.index("--") + 1])
