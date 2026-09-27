"""Render character portraits: realistic, lit heads and shoulders for the
dialogue box, the profile picker and chapter select, in every expression
their lines use.

    blender -b --factory-startup -P tools/art/build_portraits.py -- \\
        --out public/art/portraits [--who miriam player:look-1 ...] \\
        [--expression neutral|all|angry,glad] [--size 512] [--samples 160] [--review DIR]

Needs MakeHuman's model data in the local cache: `npm run art:fetch-makehuman`.

Everyone in tools/art/data/portrait-people.json is rendered by default:
every character who speaks in any chapter, and every player look (as
`player:look-N`). Re-run `npm run art:portrait-data` first when characters
or their lines change; new chapters are picked up automatically.

For each person and expression this writes `<id>-512.webp` (the master),
`<id>-256.webp` and `<id>-128.webp`: in the output folder for the neutral
portrait, and in `<expression>/` under it for the others. It records the
person's appearance key and the expressions rendered in the manifest
(`--manifest`; the game bundles src/features/portraits/portrait-manifest.json),
so the game only shows a portrait while the appearance it was rendered from
is unchanged. Ids are portrait ids (see src/content/portrait-cast.ts) and
`player-look-N`.

`--expression` is `neutral` (the default), a comma-separated list, or `all`:
neutral and every expression the person's lines use (the `expressions` the
portrait data lists for them).

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
import makehuman  # noqa: E402
import portrait_finish  # noqa: E402
import portrait_person  # noqa: E402

SIZES = (512, 256, 128)
# High enough that pores and skin grain survive compression (86 smoothed them away).
QUALITY = {512: 92, 256: 91, 128: 90}
DATA = os.path.join(HERE, "data", "portrait-people.json")
# What each render measured (skin colour against the person's, where the
# pupils sit): written here, checked by tests/content/portraits.test.ts.
CHECKS = os.path.join(HERE, "data", "portrait-checks.json")


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--data", default=DATA)
    p.add_argument("--who", nargs="*", default=None)
    p.add_argument("--expression", default="neutral", help="neutral, all, or a comma-separated list")
    p.add_argument("--size", type=int, default=512)
    p.add_argument("--supersample", type=int, default=2, help="render at size x this, then reduce")
    p.add_argument("--samples", type=int, default=160)
    p.add_argument("--hair-quality", type=float, default=1.0)
    p.add_argument("--review", default=None, help="also keep PNGs, a contact sheet and close-ups here")
    p.add_argument("--clay", action="store_true")
    p.add_argument("--device", choices=["gpu", "cpu"], default="gpu", help="render on the CPU when the GPU is busy")
    p.add_argument("--threads", type=int, default=0, help="CPU render threads (0: all)")
    p.add_argument("--frame", type=float, default=None)
    p.add_argument("--turn", type=float, default=None, help="review: degrees round the person (0 = from the front)")
    p.add_argument("--aim", type=float, nargs=3, default=None, help="review: point the camera at X Y Z (cm; e.g. the nose)")
    p.add_argument("--elev", type=float, default=None, help="review: camera height above the aim point (cm)")
    p.add_argument("--manifest", default=None, help="manifest path (default: <out>/portraits.json)")
    p.add_argument("--no-manifest", action="store_true", help="review: leave the manifest alone")
    p.add_argument("--checks", default=None, help="checks file (default: tools/art/data/portrait-checks.json; with --review, in the review folder)")
    p.add_argument("--reencode", default=None, help="write the WebP sizes again from the 512 px PNGs in this review folder (no rendering)")
    return p.parse_args(argv)


def write_manifest(path, entries):
    """Sorted, two-space JSON: stable under Prettier."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    text = json.dumps(entries, indent=2, sort_keys=True)
    with open(path, "w") as f:
        f.write(text + "\n")


def update_json(path, change):
    """Read, change and write a JSON file under a lock (several Blenders may
    be rendering people at once)."""
    import fcntl

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path + ".lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = json.load(open(path)) if os.path.exists(path) else {}
        change(data)
        write_manifest(path, data)
        fcntl.flock(lock, fcntl.LOCK_UN)
    return data


def folder(out, expression):
    return out if expression == "neutral" else os.path.join(out, expression)


def write_sizes(img, out, pid, expression="neutral"):
    """The shipped WebP files, from the 512 px master."""
    d = folder(out, expression)
    os.makedirs(d, exist_ok=True)
    for s in SIZES:
        small = portrait_finish.resize(img, s)
        imageio.save(small, os.path.join(d, f"{pid}-{s}.webp"), "WEBP", QUALITY[s])


def everyone(data):
    who = [c["id"] for c in data["characters"]]
    who += [f"player:{p['id']}" for p in data["players"]]
    return who


def lookup(data, who):
    """(portrait id, kind, appearance key, appearance, is player, chapter, expressions)."""
    if who.startswith("player:"):
        look = who.split(":", 1)[1]
        p = next(p for p in data["players"] if p["id"] == look)
        return f"player-{look}", "player", p["key"], p["appearance"], True, "", []
    c = next(c for c in data["characters"] if c["id"] == who)
    return c["id"], "character", c["key"], c["appearance"], False, c["chapter"], c.get("expressions", [])


def crop(img, centre, half):
    """A square crop (clamped to the image) around a pixel centre."""
    h, w = img.shape[:2]
    cx, cy = int(round(centre[0])), int(round(centre[1]))
    x0 = max(0, min(w - 2 * half, cx - half))
    y0 = max(0, min(h - 2 * half, cy - half))
    return img[y0 : y0 + 2 * half, x0 : x0 + 2 * half]


def expressions_for(spec, used):
    if spec == "all":
        return ["neutral"] + [e for e in used if e != "neutral"]
    return [e.strip() for e in spec.split(",") if e.strip()]


def review_name(pid, expression):
    return pid if expression == "neutral" else f"{pid}~{expression}"


def record(manifest, pid, kind, key, expression):
    """Add a render to the manifest (a new appearance starts the list again)."""
    entry = manifest.get(pid)
    if entry is None or entry.get("appearance") != key:
        entry = {"kind": kind, "appearance": key, "expressions": []}
    exprs = set(entry.get("expressions", []))
    if expression != "neutral":
        exprs.add(expression)
    entry["expressions"] = sorted(exprs)
    entry["kind"] = kind
    manifest[pid] = entry


def main():
    a = args()
    data = json.load(open(a.data))
    os.makedirs(a.out, exist_ok=True)
    manifest_path = a.manifest or os.path.join(a.out, "portraits.json")
    tmp = tempfile.mkdtemp(prefix="witness-portraits-")
    rendered = []
    if a.reencode:
        for who in a.who or everyone(data):
            pid, kind, key, _, _, _, used = lookup(data, who)
            for expression in expressions_for(a.expression, used):
                img = imageio.load(os.path.join(a.reencode, f"{review_name(pid, expression)}.png"))
                img[:, :, 3] = 1.0
                write_sizes(img, a.out, pid, expression)
                portrait_person.log("REENCODED", pid, expression)
        print("PORTRAITS DONE", flush=True)
        return
    makehuman.verify()
    checks_path = a.checks or (os.path.join(a.review, "portrait-checks.json") if a.review and a.no_manifest else CHECKS)
    for who in a.who or everyone(data):
        pid, kind, key, app, player, chapter, used = lookup(data, who)
        for expression in expressions_for(a.expression, used):
            size = a.size * a.supersample
            scene, P, marks = portrait_person.build(
                pid,
                app,
                player=player,
                chapter=chapter,
                expression=expression,
                samples=a.samples,
                size=size,
                hair_quality=a.hair_quality,
                clay=a.clay,
                frame_cm=a.frame,
                device=a.device,
                threads=a.threads,
                aim=a.aim,
                elev=a.elev,
                **({"turn": a.turn} if a.turn is not None else {}),
            )
            name = review_name(pid, expression)
            # The skin's colour matched to the person's in the game (every
            # expression takes the neutral portrait's correction).
            known = json.load(open(checks_path)) if os.path.exists(checks_path) else {}
            gain = known.get(pid, {}).get("skin", {}).get("gain") if expression != "neutral" else None
            gain, _, mask = portrait_person.calibrate_skin(scene, marks, app["skin"], tmp, size, gain=gain)
            png = portrait_person.render(scene, os.path.join(tmp, f"{name}.png"))
            big = imageio.load(png)
            if float(big[:, :, :3].mean()) < 0.02:
                # A GPU that failed mid-render can leave a black picture: render again on the CPU.
                portrait_person.log("black render; rendering again on the CPU")
                scene.cycles.device = "CPU"
                png = portrait_person.render(scene, os.path.join(tmp, f"{name}.png"))
                big = imageio.load(png)
            big[:, :, 3] = 1.0
            img = portrait_finish.resize(big, a.size, sharpen=0.0)
            face = portrait_person.face_colour(big, marks, mask, size)
            check = {
                "skin": {
                    "target": app["skin"],
                    "measured": portrait_person.rgb01_hex(face) if face else None,
                    "deltaE": round(portrait_person.delta_e(face, portrait_person.hex_rgb01(app["skin"])), 2) if face else None,
                    "gain": gain,
                },
                "gaze": marks["gaze"],
            }
            portrait_person.log("CHECK", name, json.dumps(check))
            update_json(checks_path, lambda d, key=(pid if expression == "neutral" else name), v=check: d.__setitem__(key, v))
            if not a.review or not a.no_manifest:
                write_sizes(img, a.out, pid, expression)
            if not a.no_manifest:
                update_json(manifest_path, lambda m, e=expression: record(m, pid, kind, key, e))
            if a.review:
                os.makedirs(a.review, exist_ok=True)
                out = os.path.join(a.review, f"{name}.png")
                imageio.save(img, out, "PNG")
                rendered.append(out)
                # Close-ups from the full render: both eyes, and the mouth.
                half = size // 5
                eyes = crop(big, marks["eyes"], half)
                mouth = crop(big, marks["mouth"], half)
                imageio.save(np.concatenate([eyes, mouth], axis=1), os.path.join(a.review, f"{name}-closeup.png"), "PNG")
            portrait_person.log("DONE", pid, expression)
    if a.review and len(rendered) > 1:
        imgs = [imageio.load(p) for p in rendered]
        cols = min(4, len(imgs))
        imageio.save(portrait_finish.contact_sheet(imgs, cols=cols, size=256), os.path.join(a.review, "contact-sheet.png"), "PNG")
    print("PORTRAITS DONE", flush=True)


if __name__ == "__main__":
    main()
