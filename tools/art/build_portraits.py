"""Render character portraits: realistic, lit heads and shoulders for the
dialogue box, the profile picker and chapter select.

    blender -b --factory-startup -P tools/art/build_portraits.py -- \\
        --out public/art/portraits [--who miriam player:look-1 ...] \\
        [--size 512] [--samples 256] [--finish photo|paint] [--review DIR]

Everyone in tools/art/data/chapter.json is rendered by default: every
character, and every player look (as `player:look-N`). Re-run
`npm run art:data` first when characters change; new characters in later
chapters are picked up automatically.

For each person this writes `<id>-512.webp` (the master), `<id>-256.webp`
and `<id>-128.webp`, and records the person's appearance key in the
manifest (`--manifest`; the game bundles src/features/portraits/
portrait-manifest.json), so the game only shows a portrait while the
appearance it was rendered from is unchanged. Ids are character ids and
`player-look-N`.
"""
import argparse
import json
import os
import sys
import tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import imageio  # noqa: E402
import portrait_finish  # noqa: E402
import portrait_person  # noqa: E402

SIZES = (512, 256, 128)
QUALITY = {512: 88, 256: 88, 128: 90}


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--who", nargs="*", default=None)
    p.add_argument("--size", type=int, default=512)
    p.add_argument("--samples", type=int, default=256)
    p.add_argument("--voxel", type=float, default=0.075)
    p.add_argument("--hair-quality", type=float, default=1.0)
    p.add_argument("--finish", choices=["photo", "paint"], default="photo")
    p.add_argument("--review", default=None, help="also keep PNGs and a contact sheet here")
    p.add_argument("--manifest", default=None, help="manifest path (default: <out>/portraits.json)")
    return p.parse_args(argv)


def write_manifest(path, entries):
    """Sorted, two-space JSON with no arrays: stable under Prettier."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w") as f:
        f.write(json.dumps(entries, indent=2, sort_keys=True) + "\n")


def everyone(data):
    who = [c["id"] for c in data["characters"]]
    who += [f"player:{p['id']}" for p in data["players"]]
    return who


def lookup(data, who):
    """(portrait id, kind, appearance key, appearance, is player)."""
    if who.startswith("player:"):
        look = who.split(":", 1)[1]
        p = next(p for p in data["players"] if p["id"] == look)
        return f"player-{look}", "player", p["key"], p["appearance"], True
    c = next(c for c in data["characters"] if c["id"] == who)
    return c["id"], "character", c["key"], c["appearance"], False


def main():
    a = args()
    data = json.load(open(os.path.join(HERE, "data", "chapter.json")))
    os.makedirs(a.out, exist_ok=True)
    manifest_path = a.manifest or os.path.join(a.out, "portraits.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    tmp = tempfile.mkdtemp(prefix="witness-portraits-")
    rendered = []
    for who in a.who or everyone(data):
        pid, kind, key, app, player = lookup(data, who)
        scene, _ = portrait_person.build(pid, app, player=player, voxel=a.voxel, samples=a.samples, size=a.size, hair_quality=a.hair_quality)
        if a.finish == "paint":
            portrait_finish.setup_paint(scene)
        png = portrait_person.render(scene, os.path.join(tmp, f"{pid}.png"))
        img = imageio.load(png)
        img[:, :, 3] = 1.0
        for s in SIZES:
            small = portrait_finish.resize(img, s)
            imageio.save(small, os.path.join(a.out, f"{pid}-{s}.webp"), "WEBP", QUALITY[s])
        manifest[pid] = {"kind": kind, "appearance": key}
        write_manifest(manifest_path, manifest)
        if a.review:
            os.makedirs(a.review, exist_ok=True)
            out = os.path.join(a.review, f"{pid}.png")
            imageio.save(img, out, "PNG")
            rendered.append(out)
        portrait_person.log("DONE", pid)
    if a.review and rendered:
        imgs = [imageio.load(p) for p in rendered]
        sheet = portrait_finish.contact_sheet(imgs, cols=min(4, len(imgs)), size=256)
        imageio.save(sheet, os.path.join(a.review, "contact-sheet.png"), "PNG")
    print("PORTRAITS DONE", flush=True)
    _ = np


if __name__ == "__main__":
    main()
