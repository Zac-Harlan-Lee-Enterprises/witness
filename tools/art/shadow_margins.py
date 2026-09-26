"""Give people's packed cast-shadow sheets a fading margin where their
shadows reach the edge of their box (lib/shadow_edges.py: why), in place,
without rendering again.

    blender -b --factory-startup -P tools/art/shadow_margins.py -- public/art/people

For every shadow sheet in people.json whose frames end while the shadow is
still grey, each trimmed frame is put back in its full frame, given the
margin, trimmed and packed again (lib/pack.py); its frame table, and the
frame size and origin of every entry naming the sheet (the phones' `low`
set shares the full shadow sheets), grow to match. Idempotent: a sheet whose
shadows fade out inside their frames is left alone. New renders get the
margin as they are made (build_people.py).
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import numpy as np  # noqa: E402

import imageio  # noqa: E402
import pack  # noqa: E402
import shadow_edges  # noqa: E402


def entries_naming(manifest, file):
    """Every shadow entry (full or low, in any person) that names a sheet."""
    for e in manifest.values():
        for group in (e.get("shadows", {}), e.get("low", {}).get("shadows", {})):
            for s in group.values():
                if s["sheet"] == file:
                    yield s


def full_frames(img, table, fw, fh):
    out = []
    for name, (x, y, w, h, ox, oy) in table.items():
        full = np.ones((fh, fw, 4), dtype=np.float32)
        full[oy : oy + h, ox : ox + w] = img[y : y + h, x : x + w]
        out.append((name, full))
    return out


def main(folder):
    path = os.path.join(folder, "people.json")
    manifest = json.load(open(path))
    files = sorted({s["sheet"] for e in manifest.values() for s in e.get("shadows", {}).values()})
    changed = 0
    for file in files:
        owners = [e for e in manifest.values() if file in e.get("atlas", {})]
        if not owners:
            print("SKIP (not packed)", file)
            continue
        first = next(entries_naming(manifest, file))
        fw, fh = first["frameWidth"], first["frameHeight"]
        img = imageio.load(os.path.join(folder, file))
        named = full_frames(img, owners[0]["atlas"][file], fw, fh)
        framed, margin = shadow_edges.add_margin([f for _, f in named])
        if not margin:
            continue
        packed, table = pack.pack_frames([(n, f) for (n, _), f in zip(named, framed)], True)
        imageio.save(packed, os.path.join(folder, file), "WEBP", 62)
        for e in owners:
            e["atlas"][file] = table
        for s in entries_naming(manifest, file):
            s["frameWidth"] = fw + 2 * margin
            s["frameHeight"] = fh + 2 * margin
            s["originX"] = s["originX"] + margin
            s["originY"] = s["originY"] + margin
        changed += 1
        print("MARGIN", file, flush=True)
    json.dump(manifest, open(path, "w"), indent=1, sort_keys=True)
    print("DONE", changed, "sheets")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1])
