"""Add half-resolution sprite pages to places rendered before they existed.

    blender -b --factory-startup -P tools/art/lowres_pages.py -- public/art/jerusalem-market [...]

For each variant in a place's manifest.json, writes sprites-<v>-<n>-low.webp
(box-filtered by 2, in premultiplied space) and records them as
`pagesLow`. build_place.py writes them itself; this only upgrades older
renders without rendering again. Idempotent.
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
    json.dump(manifest, open(path, "w"), indent=1)
