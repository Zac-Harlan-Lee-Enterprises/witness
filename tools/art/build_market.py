"""Render the market's layers for the game.

    blender -b --factory-startup -P tools/art/build_market.py -- \
        --out public/art/jerusalem-market [--ppu 3] [--samples 96] [--variants day late]

Writes, per lighting variant:
  ground-<v>.webp       the ground (paving, earth, grass, grit) with every
                        standing thing's shadow and occlusion baked in
  ground-<v>-low.webp   the same at half resolution (phones, reduced effects)
  shade-<v>.webp        sun visibility on the ground (white = sunlit), coarse,
                        so the game can dim people standing in shade
  sprites-<v>-<n>.webp  atlas pages of every standing thing, each rendered
                        on its own with the rest of the market still casting
                        shadows and bouncing light onto it
and manifest.json describing where everything goes and how it sorts.
"""
import argparse
import json
import os
import sys
import tempfile

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import common  # noqa: E402
import imageio  # noqa: E402
import lighting  # noqa: E402
import market  # noqa: E402
import materials as M  # noqa: E402
import view  # noqa: E402

TILE = 32.0
PAGE = 2048


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--ppu", type=float, default=3.0)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--variants", nargs="+", default=["day", "late"])
    return p.parse_args(argv)


def screen_rect(objects, margin=0.25):
    """Screen-space bounds (game units) of objects: x = X, y = -Y - Z (tiles * 32)."""
    xs, ys = [], []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objects:
        ev = o.evaluated_get(dg)
        for corner in ev.bound_box:
            w = ev.matrix_world @ __import__("mathutils").Vector(corner)
            xs.append(w.x)
            ys.append(-w.y - w.z)
    return (min(xs) - margin) * TILE, (min(ys) - margin) * TILE, (max(xs) + margin) * TILE, (max(ys) + margin) * TILE


def render_to(scene, path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return imageio.load(path)


def pack(items):
    """Shelf-pack (w, h) boxes into PAGE-sized pages; returns [(page, x, y)]."""
    order = sorted(range(len(items)), key=lambda i: -items[i][1])
    places = [None] * len(items)
    page, x, y, shelf = 0, 0, 0, 0
    for i in order:
        w, h = items[i]
        if x + w > PAGE:
            x, y, shelf = 0, y + shelf + 2, 0
        if y + h > PAGE:
            page, x, y, shelf = page + 1, 0, 0, 0
        places[i] = (page, x, y)
        x += w + 2
        shelf = max(shelf, h)
    return places


def main():
    a = args()
    data = json.load(open(os.path.join(HERE, "data", "chapter.json")))
    scene_data = data["scenes"][0]
    os.makedirs(a.out, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="witness-market-")
    scene = common.reset(a.samples)
    m = market.Market(scene_data).build()
    W, H = m.map.w * TILE, m.map.h * TILE
    wpx, hpx = int(W * a.ppu), int(H * a.ppu)
    view.setup_camera(scene, W / 2, H / 2, wpx, hpx, a.ppu)
    sprite_objs = [o for sp in m.sprites for o in sp.objects]
    manifest = {
        "version": 1,
        "scene": m.map.id,
        "tiles": {"w": m.map.w, "h": m.map.h},
        "ppu": a.ppu,
        "variants": {},
    }
    white = M.plain("#ffffff", 1.0, 0.0, "shade-probe")
    for variant in a.variants:
        lighting.setup(scene, variant)
        world_strength = scene.world.node_tree.nodes["Background"].inputs["Strength"]
        base_strength = world_strength.default_value
        # 1. Ground: standing things cast shadows but are not seen.
        standing = set(sprite_objs)
        for o in scene.objects:
            if o.type in ("MESH", "CURVES"):
                o.visible_camera = o not in standing
        scene.render.use_border = False
        ground = render_to(scene, os.path.join(tmp, f"ground-{variant}.png"))
        imageio.save(ground, os.path.join(a.out, f"ground-{variant}.webp"), "WEBP", 86)
        imageio.save(imageio.downsample(ground, 2), os.path.join(a.out, f"ground-{variant}-low.webp"), "WEBP", 84)
        # 2. Sun visibility on the ground (white diffuse, no sky).
        layer = scene.view_layers[0]
        layer.material_override = white
        world_strength.default_value = 0.0
        scene.render.resolution_percentage = 25
        probe = render_to(scene, os.path.join(tmp, f"shade-{variant}.png"))
        scene.render.resolution_percentage = 100
        layer.material_override = None
        world_strength.default_value = base_strength
        lum = probe[:, :, :3].mean(axis=2)
        lit = np.percentile(lum, 97)
        vis = np.clip(lum / max(1e-4, lit), 0, 1)
        shade = np.dstack([vis, vis, vis, np.ones_like(vis)])
        imageio.save(shade, os.path.join(a.out, f"shade-{variant}.webp"), "WEBP", 90)
        # 3. Each standing thing on its own.
        entries = []
        crops = []
        for sp in m.sprites:
            mine = set(sp.objects)
            for o in scene.objects:
                if o.type in ("MESH", "CURVES"):
                    o.visible_camera = o in mine
            x0, y0, x1, y1 = screen_rect(sp.objects)
            x0, y0 = max(0.0, x0), max(0.0, y0)
            x1, y1 = min(W, x1), min(H, y1)
            if x1 - x0 < 1 or y1 - y0 < 1:
                continue
            r = scene.render
            r.use_border = True
            r.use_crop_to_border = True
            r.border_min_x = x0 / W
            r.border_max_x = x1 / W
            r.border_min_y = 1 - y1 / H
            r.border_max_y = 1 - y0 / H
            img = render_to(scene, os.path.join(tmp, f"{sp.id.replace(':', '_')}-{variant}.png"))
            box = imageio.alpha_bbox(img)
            if box is None:
                continue
            bx0, by0, bx1, by1 = box
            crop = img[by0:by1, bx0:bx1]
            # Where the crop sits on screen, in game units.
            left = int(round(x0 * a.ppu)) + bx0
            top = int(round(y0 * a.ppu)) + by0
            # Anything wider than an atlas page is cut into slices that sort together.
            for k, sx in enumerate(range(0, crop.shape[1], PAGE)):
                piece = crop[:, sx : sx + PAGE]
                crops.append(piece)
                entries.append(
                    {
                        "id": sp.id if sx == 0 else f"{sp.id}#{k}",
                        "x": (left + sx) / a.ppu,
                        "y": top / a.ppu,
                        "w": piece.shape[1],
                        "h": piece.shape[0],
                        "base": sp.base,
                        "tiles": [list(t) for t in sp.tiles],
                    }
                )
        scene.render.use_border = False
        places = pack([(c.shape[1], c.shape[0]) for c in crops])
        pages = {}
        for crop, entry, (page, px, py) in zip(crops, entries, places):
            if page not in pages:
                pages[page] = np.zeros((PAGE, PAGE, 4), dtype=np.float32)
            pages[page][py : py + crop.shape[0], px : px + crop.shape[1]] = crop
            entry["page"] = page
            entry["u"] = px
            entry["v"] = py
        page_files = []
        for page, arr in sorted(pages.items()):
            used = imageio.alpha_bbox(arr) or (0, 0, 1, 1)
            h = min(PAGE, used[3] + 2)
            name = f"sprites-{variant}-{page}.webp"
            imageio.save(arr[:h], os.path.join(a.out, name), "WEBP", 88)
            page_files.append(name)
        manifest["variants"][variant] = {
            "ground": f"ground-{variant}.webp",
            "groundLow": f"ground-{variant}-low.webp",
            "shade": f"shade-{variant}.webp",
            "pages": page_files,
            "sprites": entries,
        }
        print("VARIANT DONE", variant, len(entries))
    json.dump(manifest, open(os.path.join(a.out, "manifest.json"), "w"), indent=1)
    print("MARKET DONE")


main()
