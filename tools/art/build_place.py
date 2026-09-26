"""Render any place's layers for the game.

    blender -b --factory-startup -P tools/art/build_place.py -- \
        --scene jericho-road --out public/art/jericho-road \
        [--ppu 3] [--samples 96] [--variants day late]

    # A beauty render of a region (everything visible), for review:
    blender -b --factory-startup -P tools/art/build_place.py -- \
        --scene jericho-road --probe 10 8 30 20 --out /tmp/probe.png [--ppu 1.5] [--variants late]

Writes, per lighting variant:
  ground-<v>.webp       the ground (terrain, paving, earth, grass, floors...)
                        with every standing thing's shadow and occlusion baked
                        in, except things shown only while a story condition
                        holds (they carry their own shadow)
  ground-<v>-low.webp   the same at half resolution (phones, reduced effects)
  shade-<v>.webp        sun visibility on the ground (white = sunlit), coarse,
                        so the game can dim people standing in shade
  sprites-<v>-<n>.webp  atlas pages of every standing thing, each rendered
                        on its own with the rest of the place still casting
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
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import common  # noqa: E402
import imageio  # noqa: E402
import lighting  # noqa: E402
import materials as M  # noqa: E402
import place  # noqa: E402
import view  # noqa: E402

TILE = 32.0
PAGE = 2048


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--scene", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--ppu", type=float, default=3.0)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--variants", nargs="+", default=None)
    p.add_argument("--probe", nargs=4, type=float, default=None)
    return p.parse_args(argv)


def screen_rect(objects, margin=0.25):
    """Screen-space bounds (game units) of objects: x = X, y = -Y - Z (tiles * 32)."""
    xs, ys = [], []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objects:
        ev = o.evaluated_get(dg)
        for corner in ev.bound_box:
            w = ev.matrix_world @ Vector(corner)
            xs.append(w.x)
            ys.append(-w.y - w.z)
    return (min(xs) - margin) * TILE, (min(ys) - margin) * TILE, (max(xs) + margin) * TILE, (max(ys) + margin) * TILE


def render_to(scene, path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return imageio.load(path)


def even(n):
    return n + (n & 1)


def pack(items):
    """Shelf-pack (w, h) boxes into PAGE-sized pages; returns [(page, x, y)].
    Positions are even, so the half-resolution pages keep whole pixels."""
    order = sorted(range(len(items)), key=lambda i: -items[i][1])
    places = [None] * len(items)
    page, x, y, shelf = 0, 0, 0, 0
    for i in order:
        w, h = items[i]
        if x + w > PAGE:
            x, y, shelf = 0, even(y + shelf + 2), 0
        if y + h > PAGE:
            page, x, y, shelf = page + 1, 0, 0, 0
        places[i] = (page, x, y)
        x = even(x + w + 2)
        shelf = max(shelf, h)
    return places


def default_variants(p):
    """Interiors are seen only in the morning; outdoor places in both lights."""
    return ["day"] if p.style == "home" else ["day", "late"]


def catcher_for(p, sp):
    """A shadow-catching patch of ground under a sprite that carries its own shadow."""
    xs = [t[0] for t in sp.tiles] or [0]
    ys = [t[1] for t in sp.tiles] or [0]
    x0, x1 = min(xs) - 1.6, max(xs) + 2.6
    y0, y1 = min(ys) - 1.6, max(ys) + 2.2
    import bmesh

    bm = bmesh.new()
    nx, ny = int((x1 - x0) * 4), int((y1 - y0) * 4)
    grid = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            row.append(bm.verts.new(p.P(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny, 0.002)))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
    obj = common.mesh_object(f"catcher-{sp.id}", bm, M.shadow_catcher(), None)
    obj.is_shadow_catcher = True
    return obj


def main():
    a = args()
    data = json.load(open(os.path.join(HERE, "data", "chapter.json")))
    scene_data = next((s for s in data["scenes"] if s["id"] == a.scene), None)
    if scene_data is None:
        raise SystemExit(f"No scene {a.scene} in tools/art/data/chapter.json (run npm run art:data)")
    tmp = tempfile.mkdtemp(prefix=f"witness-{a.scene}-")
    scene = common.reset(a.samples)
    p = place.Place(scene_data).build()
    scene.view_settings.exposure = -1.4 + p.exposure
    variants = a.variants or default_variants(p)
    sprite_objs = [o for sp in p.sprites for o in sp.objects]
    for o in sprite_objs:
        if not o.users_collection:
            scene.collection.objects.link(o)
    occluders = set(p.occluders)
    volumes = set(p.volumes)
    conditional = {o for sp in p.sprites if sp.conditional for o in sp.objects}
    W, H = p.map.w * TILE, p.map.h * TILE

    def show(camera, hidden=()):
        """Set camera visibility: `camera` objects are seen; occluders never
        are; `hidden` objects are left out of the render entirely."""
        for o in scene.objects:
            if o.type not in ("MESH", "CURVES"):
                continue
            o.hide_render = o in hidden
            o.visible_camera = (o in camera) and (o not in occluders or bool(os.environ.get("SHOW_OCCLUDERS")))

    if a.probe:
        x0, y0, x1, y1 = a.probe
        lighting.setup(scene, variants[0])
        w = (x1 - x0) * TILE
        h = (y1 - y0) * TILE
        view.setup_camera(scene, (x0 + x1) / 2 * TILE, (y0 + y1) / 2 * TILE, int(w * a.ppu), int(h * a.ppu), a.ppu)
        show(set(scene.objects), hidden=conditional if "--all" not in sys.argv else ())
        scene.render.film_transparent = False
        scene.render.filepath = a.out
        bpy.ops.render.render(write_still=True)
        print("PROBE", a.out)
        return

    os.makedirs(a.out, exist_ok=True)
    wpx, hpx = int(W * a.ppu), int(H * a.ppu)
    view.setup_camera(scene, W / 2, H / 2, wpx, hpx, a.ppu)
    manifest = {"version": 1, "scene": p.map.id, "tiles": {"w": p.map.w, "h": p.map.h}, "ppu": a.ppu, "variants": {}}
    if p.style == "home":
        manifest["peopleLight"] = "indoor"
    white = M.plain("#ffffff", 1.0, 0.0, "shade-probe")
    ground_set = set(p.ground_objects) | volumes
    for variant in variants:
        lighting.setup(scene, variant)
        world_strength = scene.world.node_tree.nodes["Background"].inputs["Strength"]
        base_strength = world_strength.default_value
        # 1. Ground: standing things cast shadows but are not seen; conditional
        #    things are left out (they may not be there).
        show(set(scene.objects) - set(sprite_objs), hidden=conditional)
        scene.render.use_border = False
        ground = render_to(scene, os.path.join(tmp, f"ground-{variant}.png"))
        imageio.save(ground, os.path.join(a.out, f"ground-{variant}.webp"), "WEBP", 86)
        imageio.save(imageio.downsample(ground, 2), os.path.join(a.out, f"ground-{variant}-low.webp"), "WEBP", 84)
        # 2. Sun visibility on the ground (white diffuse, sun only, no dust, no lamps).
        layer = scene.view_layers[0]
        layer.material_override = white
        world_strength.default_value = 0.0
        for light in p.lights:
            light.hide_render = True
        show(set(scene.objects) - set(sprite_objs), hidden=conditional | volumes)
        scene.render.resolution_percentage = 25
        probe = render_to(scene, os.path.join(tmp, f"shade-{variant}.png"))
        scene.render.resolution_percentage = 100
        layer.material_override = None
        world_strength.default_value = base_strength
        for light in p.lights:
            light.hide_render = False
        lum = probe[:, :, :3].mean(axis=2)
        lit = np.percentile(lum, 97)
        vis = np.clip(lum / max(1e-4, lit), 0, 1)
        if p.style == "home":
            # Indoors people are lit for the room; only the sunbeam brightens them.
            vis = 0.85 + 0.15 * vis
        shade = np.dstack([vis, vis, vis, np.ones_like(vis)])
        imageio.save(shade, os.path.join(a.out, f"shade-{variant}.webp"), "WEBP", 90)
        # 3. Each standing thing on its own.
        entries = []
        crops = []
        for sp in p.sprites:
            mine = set(sp.objects)
            extra = set()
            if sp.conditional:
                cat = catcher_for(p, sp)
                extra.add(cat)
            others_conditional = conditional - mine
            show(mine | extra, hidden=others_conditional | volumes)
            x0, y0, x1, y1 = screen_rect(sp.objects)
            if sp.conditional:
                cx0, cy0, cx1, cy1 = screen_rect([cat], 0.0)
                x0, y0, x1, y1 = min(x0, cx0), min(y0, cy0), max(x1, cx1), max(y1, cy1)
            x0, y0 = max(0.0, x0), max(0.0, y0)
            x1, y1 = min(W, x1), min(H, y1)
            if x1 - x0 < 1 or y1 - y0 < 1:
                for o in extra:
                    bpy.data.objects.remove(o, do_unlink=True)
                continue
            r = scene.render
            r.use_border = True
            r.use_crop_to_border = True
            r.border_min_x = x0 / W
            r.border_max_x = x1 / W
            r.border_min_y = 1 - y1 / H
            r.border_max_y = 1 - y0 / H
            stem = os.path.join(tmp, f"{sp.id.replace(':', '_')}-{variant}")
            if sp.conditional:
                # The thing itself, lit and shadowed by everything around it...
                show(mine, hidden=others_conditional | volumes)
                img = render_to(scene, stem + ".png")
                # ...and its own shadow alone, on a catcher only it shades.
                cast = {}
                for o in scene.objects:
                    if o.type in ("MESH", "CURVES") and o not in mine and o not in extra:
                        cast[o] = o.visible_shadow
                        o.visible_shadow = False
                show(extra, hidden=others_conditional | volumes)
                shadow = render_to(scene, stem + "-shadow.png")
                for o, v in cast.items():
                    o.visible_shadow = v
                img = imageio.over(img, shadow)
            else:
                img = render_to(scene, stem + ".png")
            for o in extra:
                bpy.data.objects.remove(o, do_unlink=True)
            box = imageio.alpha_bbox(img)
            if box is None:
                continue
            bx0, by0, bx1, by1 = box
            crop = img[by0:by1, bx0:bx1]
            left = int(round(x0 * a.ppu)) + bx0
            top = int(round(y0 * a.ppu)) + by0
            for k, sx in enumerate(range(0, crop.shape[1], PAGE)):
                piece = crop[:, sx : sx + PAGE]
                crops.append(piece)
                entry = {
                    "id": sp.id if sx == 0 else f"{sp.id}#{k}",
                    "x": (left + sx) / a.ppu,
                    "y": top / a.ppu,
                    "w": piece.shape[1],
                    "h": piece.shape[0],
                    "base": sp.base,
                    "tiles": [list(t) for t in sp.tiles],
                }
                if sp.fade:
                    entry["fade"] = True
                entries.append(entry)
            print("SPRITE", variant, sp.id)
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
        low_files = []
        for page, arr in sorted(pages.items()):
            used = imageio.alpha_bbox(arr) or (0, 0, 1, 1)
            h = min(PAGE, even(used[3] + 2))
            name = f"sprites-{variant}-{page}.webp"
            imageio.save(arr[:h], os.path.join(a.out, name), "WEBP", 88)
            page_files.append(name)
            # Half resolution, for phones and reduced effects.
            low = f"sprites-{variant}-{page}-low.webp"
            imageio.save(imageio.downsample(arr[:h], 2), os.path.join(a.out, low), "WEBP", 86)
            low_files.append(low)
        manifest["variants"][variant] = {
            "ground": f"ground-{variant}.webp",
            "groundLow": f"ground-{variant}-low.webp",
            "shade": f"shade-{variant}.webp",
            "pages": page_files,
            "pagesLow": low_files,
            "sprites": entries,
        }
        print("VARIANT DONE", variant, len(entries))
    json.dump(manifest, open(os.path.join(a.out, "manifest.json"), "w"), indent=1)
    print("PLACE DONE", a.scene)


main()
