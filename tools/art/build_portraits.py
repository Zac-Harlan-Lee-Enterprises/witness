"""Render character portraits: realistic, lit heads and shoulders for the
dialogue box, the profile picker and chapter select.

    blender -b --factory-startup -P tools/art/build_portraits.py -- \\
        --out public/art/portraits [--who miriam player:look-1 ...] \\
        [--size 512] [--samples 160] [--finish photo|paint] [--review DIR]

Everyone in tools/art/data/portrait-people.json is rendered by default:
every character who speaks in any chapter, and every player look (as
`player:look-N`). Re-run `npm run art:portrait-data` first when characters
change; new chapters are picked up automatically.

For each person this writes `<id>-512.webp` (the master), `<id>-256.webp`
and `<id>-128.webp`, and records the person's appearance key in the
manifest (`--manifest`; the game bundles src/features/portraits/
portrait-manifest.json), so the game only shows a portrait while the
appearance it was rendered from is unchanged. Ids are portrait ids (see
src/content/portrait-cast.ts) and `player-look-N`.

Review options (nothing here changes what ships unless --out is the game's):
  --review DIR   also keep full-size PNGs, a contact sheet at the game's
                 sizes, and close-ups of the eyes and mouth
  --clay         render grey clay (shape only)
  --frame CM     frame this many centimetres (default: head and shoulders)
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
QUALITY = {512: 86, 256: 88, 128: 90}
DATA = os.path.join(HERE, "data", "portrait-people.json")


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--data", default=DATA)
    p.add_argument("--who", nargs="*", default=None)
    p.add_argument("--size", type=int, default=512)
    p.add_argument("--supersample", type=int, default=2, help="render at size x this, then reduce")
    p.add_argument("--samples", type=int, default=160)
    p.add_argument("--voxel", type=float, default=0.075)
    p.add_argument("--hair-quality", type=float, default=1.0)
    p.add_argument("--finish", choices=["photo", "paint"], default="photo")
    p.add_argument("--review", default=None, help="also keep PNGs, a contact sheet and close-ups here")
    p.add_argument("--clay", action="store_true")
    p.add_argument("--device", choices=["gpu", "cpu"], default="gpu", help="render on the CPU when the GPU is busy")
    p.add_argument("--threads", type=int, default=0, help="CPU render threads (0: all)")
    p.add_argument("--frame", type=float, default=None)
    p.add_argument("--turn", type=float, default=None, help="review: degrees round the person (0 = from the front)")
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


def crop(img, centre, half):
    """A square crop (clamped to the image) around a pixel centre."""
    h, w = img.shape[:2]
    cx, cy = int(round(centre[0])), int(round(centre[1]))
    x0 = max(0, min(w - 2 * half, cx - half))
    y0 = max(0, min(h - 2 * half, cy - half))
    return img[y0 : y0 + 2 * half, x0 : x0 + 2 * half]


def main():
    a = args()
    data = json.load(open(a.data))
    os.makedirs(a.out, exist_ok=True)
    manifest_path = a.manifest or os.path.join(a.out, "portraits.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    tmp = tempfile.mkdtemp(prefix="witness-portraits-")
    rendered = []
    for who in a.who or everyone(data):
        pid, kind, key, app, player = lookup(data, who)
        size = a.size * a.supersample
        scene, P, marks = portrait_person.build(
            pid, app, player=player, voxel=a.voxel, samples=a.samples, size=size, hair_quality=a.hair_quality, clay=a.clay, frame_cm=a.frame, device=a.device, threads=a.threads, **({"turn": a.turn} if a.turn is not None else {})
        )
        if a.finish == "paint":
            portrait_finish.setup_paint(scene)
        png = portrait_person.render(scene, os.path.join(tmp, f"{pid}.png"))
        big = imageio.load(png)
        if float(big[:, :, :3].mean()) < 0.02:
            # A GPU that failed mid-render can leave a black picture: render again on the CPU.
            portrait_person.log("black render; rendering again on the CPU")
            scene.cycles.device = "CPU"
            png = portrait_person.render(scene, os.path.join(tmp, f"{pid}.png"))
            big = imageio.load(png)
        big[:, :, 3] = 1.0
        img = portrait_finish.resize(big, a.size, sharpen=0.0)
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
            # Close-ups from the full render: both eyes, and the mouth.
            half = size // 5
            eyes = crop(big, marks["eyes"], half)
            mouth = crop(big, marks["mouth"], half)
            imageio.save(np.concatenate([eyes, mouth], axis=1), os.path.join(a.review, f"{pid}-closeup.png"), "PNG")
        portrait_person.log("DONE", pid)
    if a.review and rendered:
        imgs = [imageio.load(p) for p in rendered]
        cols = min(4, len(imgs))
        imageio.save(portrait_finish.contact_sheet(imgs, cols=cols, size=256), os.path.join(a.review, "contact-sheet.png"), "PNG")
        # At the sizes the game shows them (and the 128 px file, sharpened as shipped).
        small = [portrait_finish.resize(portrait_finish.resize(im, 128), 104, sharpen=0.0) for im in imgs]
        imageio.save(portrait_finish.contact_sheet(small, cols=len(small), size=104, gap=6), os.path.join(a.review, "contact-sheet-104.png"), "PNG")
    print("PORTRAITS DONE", flush=True)


if __name__ == "__main__":
    main()
