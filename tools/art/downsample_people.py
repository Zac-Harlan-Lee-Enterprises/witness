"""Smaller people sheets for phones and low-memory devices, made from the
packed sheets without rendering again.

    blender -b --factory-startup -P tools/art/downsample_people.py -- public/art/people [--ppu 1.5] [--force]

For every sheet in people.json (colour sheets, overlays and cast-shadow
sheets, in every light) it writes `<sheet>-low.webp`: each trimmed frame is
put back in its full frame, resized (`resample`), trimmed again and packed
into a new atlas (lib/pack.py) of the width that wastes least. Frame sizes and
origins are whole pixels at both sizes (frames are whole game units, and
origins are too), so a smaller frame lies exactly where the full one does:
overlays still line up with their sheet.

people.json records them per person, beside the full sheets:

    "low": {"ppu": 1.5, "frameWidth": 66, "frameHeight": 102, "originX": 33, "originY": 93,
            "sheets": {"<light>": "<id>-<light>-low.webp"},
            "shadows": {"<light>": {"sheet": ..., "frameWidth": ..., "ppu": 0.5, ...}}}

and each new file's frame table in `atlas`, as for the full sheets.
Colour sheets go from 3 to --ppu pixels per game unit (1.5 by default: a
quarter of the pixels); shadow sheets, soft already, from 1 to
--shadow-ppu (0.5). Idempotent: a person whose low sheets are recorded at
these sizes, with their files present, is skipped (--force redoes them).
"""
import argparse
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import numpy as np  # noqa: E402

import imageio  # noqa: E402
import pack  # noqa: E402

COLOUR_QUALITY = 90
SHADOW_QUALITY = 62
# No texture is bigger than this (MAX_ART_TEXTURE in src/game/prerendered/manifest.ts).
MAX_TEXTURE = 2048


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("folder")
    p.add_argument("--ppu", type=float, default=1.5, help="pixels per game unit of the low colour sheets")
    p.add_argument("--shadow-ppu", type=float, default=0.5, help="pixels per game unit of the low shadow sheets")
    p.add_argument("--force", action="store_true", help="redo every person's low sheets")
    return p.parse_args(argv)


def low_name(file):
    return file[: -len(".webp")] + "-low.webp"


def area_weights(n, m):
    """(m, n): output pixel i is the mean of input pixels [i n/m, (i+1) n/m),
    each weighted by how much of it that span covers."""
    step = n / m
    w = np.zeros((m, n), dtype=np.float32)
    for i in range(m):
        a, b = i * step, (i + 1) * step
        for j in range(int(math.floor(a)), min(n, int(math.ceil(b - 1e-9)))):
            w[i, j] = (min(b, j + 1) - max(a, j)) / step
    return w


def lanczos_weights(n, m, lobes=3):
    """(m, n): a Lanczos filter widened to the output's pixel size (sharper
    than an area average, which softens faces and stripes); edges clamp."""
    step = n / m
    w = np.zeros((m, n), dtype=np.float64)
    for i in range(m):
        c = (i + 0.5) * step - 0.5
        for j in range(int(math.floor(c - lobes * step)), int(math.ceil(c + lobes * step)) + 1):
            x = (j - c) / step
            if abs(x) < lobes:
                w[i, min(max(j, 0), n - 1)] += np.sinc(x) * np.sinc(x / lobes)
        w[i] /= w[i].sum()
    return w.astype(np.float32)


def resample(img, out_w, out_h, colour):
    """Resize an image to out_w x out_h. Colour sheets: Lanczos, in
    premultiplied space (edges don't darken), clamped so the lobes can't
    ring outside what alpha allows. Shadow sheets (soft already): an area
    average, which keeps how much shadow each one casts."""
    h, w = img.shape[:2]
    weights = lanczos_weights if colour else area_weights
    a = img.astype(np.float32).copy()
    if colour:
        a[:, :, :3] *= a[:, :, 3:4]
    out = np.einsum("ij,jkc->ikc", weights(h, out_h), a)
    out = np.einsum("kj,ijc->ikc", weights(w, out_w), out)
    out = np.clip(out, 0, 1)
    if colour:
        alpha = out[:, :, 3:4]
        rgb = np.minimum(out[:, :, :3], alpha)
        out[:, :, :3] = np.where(alpha > 1e-5, rgb / np.maximum(alpha, 1e-5), 0)
    return out


def whole(scale, value, what):
    v = value * scale
    if abs(v - round(v)) > 1e-6:
        raise ValueError(f"{what} {value} is not a whole number of pixels at scale {scale}")
    return int(round(v))


def full_frames(atlas_img, table, fw, fh, is_shadow):
    """Each trimmed frame back in its full frame (empty around it)."""
    out = []
    for name, (x, y, w, h, ox, oy) in table.items():
        frame = np.zeros((fh, fw, 4), dtype=np.float32)
        if is_shadow:
            frame[:, :, :] = 1.0  # an opaque tint on white: white is no shadow
        else:
            frame[:, :, 3] = 0.0
        frame[oy : oy + h, ox : ox + w] = atlas_img[y : y + h, x : x + w]
        out.append((name, frame))
    return out


def best_width(frames, is_shadow):
    """The atlas width whose packing wastes least, with neither side over
    MAX_TEXTURE: pack.pack_frames fills shelves 2048 wide, which for small
    frames leaves a half-empty last shelf as wide as the page."""
    sizes = []
    for _, img in frames:
        x0, y0, x1, y1 = pack.visible_box(img, is_shadow)
        sizes.append((x1 - x0, y1 - y0))
    sizes.sort(key=lambda s: -s[1])
    widest = max(w for w, _ in sizes)
    best = None
    for width in list(range(widest, MAX_TEXTURE, 8)) + [MAX_TEXTURE]:
        x = y = shelf = used = 0
        for w, h in sizes:
            if x + w > width:
                x, y, shelf = 0, y + shelf + pack.PAD, 0
            used = max(used, x + w)
            x += w + pack.PAD
            shelf = max(shelf, h)
        height = y + shelf
        cols = min(width, used + pack.PAD)
        if height > MAX_TEXTURE:
            continue
        key = (cols * height, max(cols, height))
        if best is None or key < best[0]:
            best = (key, width)
    if best is None:
        raise ValueError("frames do not fit one atlas page")
    return best[1]


def downsample_sheet(folder, file, table, fw, fh, scale, is_shadow):
    """Write <file>-low.webp; returns (its name, its frame table)."""
    img = imageio.load(os.path.join(folder, file))
    lw, lh = whole(scale, fw, "frame width"), whole(scale, fh, "frame height")
    frames = [(name, resample(f, lw, lh, not is_shadow)) for name, f in full_frames(img, table, fw, fh, is_shadow)]
    atlas, low_table = pack.pack_frames(frames, is_shadow, width=best_width(frames, is_shadow))
    name = low_name(file)
    imageio.save(atlas, os.path.join(folder, name), "WEBP", SHADOW_QUALITY if is_shadow else COLOUR_QUALITY)
    return name, low_table


def up_to_date(folder, e, ppu, shadow_ppu):
    low = e.get("low")
    if not low or low.get("ppu") != ppu:
        return False
    if set(low.get("sheets", {})) != set(e["sheets"]) or set(low.get("shadows", {})) != set(e.get("shadows", {})):
        return False
    if any(s.get("ppu") != shadow_ppu for s in low["shadows"].values()):
        return False
    files = list(low["sheets"].values()) + [s["sheet"] for s in low["shadows"].values()]
    return all(f in e.get("atlas", {}) and os.path.exists(os.path.join(folder, f)) for f in files)


def downsample(folder, ppu=1.5, shadow_ppu=0.5, force=False):
    path = os.path.join(folder, "people.json")
    manifest = json.load(open(path))
    changed = False
    for pid, e in sorted(manifest.items()):
        if not force and up_to_date(folder, e, ppu, shadow_ppu):
            continue
        atlas = e.setdefault("atlas", {})
        scale = ppu / e["ppu"]
        fw, fh = e["frameWidth"], e["frameHeight"]
        low = {
            "ppu": ppu,
            "frameWidth": whole(scale, fw, "frame width"),
            "frameHeight": whole(scale, fh, "frame height"),
            "originX": whole(scale, e["originX"], "origin"),
            "originY": whole(scale, e["originY"], "origin"),
            "sheets": {},
            "shadows": {},
        }
        for light, file in sorted(e["sheets"].items()):
            name, table = downsample_sheet(folder, file, atlas[file], fw, fh, scale, False)
            atlas[name] = table
            low["sheets"][light] = name
        for light, s in sorted(e.get("shadows", {}).items()):
            k = shadow_ppu / s["ppu"]
            name, table = downsample_sheet(folder, s["sheet"], atlas[s["sheet"]], s["frameWidth"], s["frameHeight"], k, True)
            atlas[name] = table
            low["shadows"][light] = {
                "sheet": name,
                "frameWidth": whole(k, s["frameWidth"], "shadow frame width"),
                "frameHeight": whole(k, s["frameHeight"], "shadow frame height"),
                "originX": whole(k, s["originX"], "shadow origin"),
                "originY": whole(k, s["originY"], "shadow origin"),
                "ppu": shadow_ppu,
            }
        e["low"] = low
        changed = True
        print("LOW", pid, flush=True)
    if changed:
        json.dump(manifest, open(path, "w"), indent=1, sort_keys=True)
    print("LOW PEOPLE DONE")


if __name__ == "__main__":
    a = args()
    downsample(a.folder, a.ppu, a.shadow_ppu, a.force)
