"""Bring places rendered by an older build_place.py up to date, without
rendering them again.

    blender -b --factory-startup -P tools/art/upgrade_place.py -- public/art/jerusalem-market [...]

For each variant in a place's manifest.json:
  - half-resolution sprite pages (sprites-<v>-<n>-low.webp, box-filtered by
    2 in premultiplied space), recorded as `pagesLow`, if missing;
  - a ground given as one file is cut into tiles of 2048 px at most
    (imageio.save_tiles), recorded as a list of tiles, and the whole file
    removed.
build_place.py writes both itself. Idempotent.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import imageio  # noqa: E402

for folder in sys.argv[sys.argv.index("--") + 1 :]:
    path = os.path.join(folder, "manifest.json")
    manifest = json.load(open(path))
    for name, v in manifest["variants"].items():
        if "pagesLow" not in v:
            low = []
            for page in v["pages"]:
                out = page.replace(".webp", "-low.webp")
                img = imageio.load(os.path.join(folder, page))
                if img.shape[0] % 2:
                    img = img[:-1]
                imageio.save(imageio.downsample(img, 2), os.path.join(folder, out), "WEBP", 86)
                low.append(out)
            v["pagesLow"] = low
            print("LOW PAGES", folder, name, low)
        for key, quality in (("ground", 90), ("groundLow", 88)):
            if not isinstance(v[key], str):
                continue
            whole = v[key]
            img = imageio.load(os.path.join(folder, whole))
            if len(imageio.tile_grid(img.shape[1], img.shape[0])) == 1:
                # Small enough already: kept as it is (not encoded again).
                v[key] = [{"file": whole, "x": 0, "y": 0}]
            else:
                v[key] = imageio.save_tiles(img, folder, whole[: -len(".webp")], quality)
                os.remove(os.path.join(folder, whole))
            print("GROUND TILES", folder, name, key, [t["file"] for t in v[key]])
    json.dump(manifest, open(path, "w"), indent=1)
