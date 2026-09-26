"""Render any place's layers for the game.

    blender -b --factory-startup -P tools/art/build_place.py -- \
        --scene jericho-road --out public/art/jericho-road \
        [--ppu 3] [--samples 96] [--variants day late]

    # A beauty render of a region (everything visible), for review:
    blender -b --factory-startup -P tools/art/build_place.py -- \
        --scene jericho-road --probe 10 8 30 20 --out /tmp/probe.png [--ppu 1.5] [--variants late]

    # Re-render part of a place already built: the ground and shade only, or
    # only the things shown while a story condition holds:
    ... -- --scene jericho --out public/art/jericho --only ground|conditional

Writes, per lighting variant:
  ground-<v>.webp       the ground (terrain, paving, earth, grass, floors...)
                        with every standing thing's shadow and occlusion baked
                        in, except things shown only while a story condition
                        holds (they carry their own shadow); cut into tiles
                        ground-<v>-x<i>y<j>.webp when bigger than 2048 px
  ground-<v>-low.webp   the same at half resolution (phones, reduced effects)
  shade-<v>.webp        sun visibility on the ground (white = sunlit), coarse,
                        so the game can dim people standing in shade
  sprites-<v>-<n>.webp  atlas pages of every standing thing, each rendered
                        on its own with the rest of the place still casting
                        shadows and bouncing light onto it (-low: half size)
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
    p.add_argument(
        "--only",
        choices=["ground", "conditional", "sprites"],
        default=None,
        help="re-render the ground and shade only (keeping the sprites), only the things shown while "
        "a story condition holds, or only the sprites named by --sprites (repacking the rest from the "
        "pages already rendered)",
    )
    p.add_argument("--sprites", nargs="+", default=[], help="with --only sprites: ids or id prefixes (palm-)")
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


def light_plan(p):
    """Each variant the manifest will have and the light it is rendered in.
    Interiors are seen only in the morning, outdoor places in both lights,
    unless the place asks for its own (a road under rain cloud, a house at
    lamp-lighting: `Place.light_plan`, e.g. {"day": "overcast"})."""
    own = getattr(p, "light_plan", None)
    if own:
        return dict(own)
    return {"day": "day"} if p.style == "home" else {"day": "day", "late": "late"}


def people_light(p):
    """How people are lit there (the manifest's peopleLight): by the room's
    own light indoors, or as the place asks (overcast, lamp); else by the
    sun of each variant (None)."""
    return getattr(p, "people_light", None) or ("indoor" if p.style == "home" else None)


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
    # Small bright lights (lamps, embers) reflected in glossy things make
    # fireflies that the denoiser smears into blotches: clamp the indirect light.
    scene.cycles.sample_clamp_indirect = 10.0
    scene.cycles.filter_glossy = 0.5
    p = place.Place(scene_data).build()
    scene.view_settings.exposure = -1.4 + p.exposure
    plan = light_plan(p)
    variants = a.variants or list(plan)
    sprite_objs = [o for sp in p.sprites for o in sp.objects]
    for o in sprite_objs:
        if not o.users_collection:
            scene.collection.objects.link(o)
    occluders = set(p.occluders)
    volumes = set(p.volumes)
    conditional = {o for sp in p.sprites if sp.conditional for o in sp.objects}
    # Things lying flat (prints, drag marks, a mat) cast no shadow worth the
    # name, only a black patch under themselves: the ground is rendered
    # without them, so they can change without it.
    flats = {o for sp in p.sprites if sp.flat for o in sp.objects}
    # Grit and pebbles scattered over the ground: hidden while a flat thing
    # renders, or they would punch black holes in it (they lie on top of it).
    scattered = {o for o in p.ground_objects if any(m.type == "NODES" for m in o.modifiers)}
    W, H = p.map.w * TILE, p.map.h * TILE

    def show(camera, hidden=(), holdout=()):
        """Set camera visibility: `camera` objects are seen; occluders never
        are; `hidden` objects are left out of the render entirely; `holdout`
        objects are seen as holes (transparent), cutting away whatever they
        hide, while still casting shadows and bouncing light."""
        for o in scene.objects:
            if o.type not in ("MESH", "CURVES"):
                continue
            o.hide_render = o in hidden
            o.is_holdout = o in holdout
            seen = o in camera or o in holdout
            o.visible_camera = seen and (o not in occluders or bool(os.environ.get("SHOW_OCCLUDERS")))

    def light_up(variant):
        """Set the light a variant is rendered in, and its exposure."""
        light = plan.get(variant, variant)
        lighting.setup(scene, light)
        scene.view_settings.exposure = -1.4 + p.exposure + lighting.ev(light)
        return light

    if a.probe:
        x0, y0, x1, y1 = a.probe
        light_up(variants[0])
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
    if people_light(p):
        manifest["peopleLight"] = people_light(p)
    previous = None
    if a.only:
        previous = json.load(open(os.path.join(a.out, "manifest.json")))
        variants = [v for v in variants if v in previous["variants"]]
        if any(isinstance(v["ground"], str) for v in previous["variants"].values()):
            raise SystemExit(f"{a.out} predates tiled grounds: run tools/art/upgrade_place.py on it first")
    prev_pages = {}
    grounds = {}

    def ground_files(variant):
        """Every ground file of a variant in the previous manifest (to clear stale tiles)."""
        v = (previous or {}).get("variants", {}).get(variant) or {}
        return {t["file"] for key in ("ground", "groundLow") for t in v.get(key, [])}

    def previous_crops(variant, sid):
        """A sprite's crops and entries from the pages already rendered."""
        out = []
        for entry in previous["variants"][variant]["sprites"]:
            if entry["id"] != sid and not entry["id"].startswith(sid + "#"):
                continue
            key = (variant, entry["page"])
            if key not in prev_pages:
                prev_pages[key] = imageio.load(os.path.join(a.out, previous["variants"][variant]["pages"][entry["page"]]))
            img = prev_pages[key]
            out.append((img[entry["v"] : entry["v"] + entry["h"], entry["u"] : entry["u"] + entry["w"]].copy(), dict(entry)))
        return out

    white = M.plain("#ffffff", 1.0, 0.0, "shade-probe")
    meshes = {o for o in scene.objects if o.type in ("MESH", "CURVES")}

    def ground_and_shade(variant):
        world_strength = scene.world.node_tree.nodes["Background"].inputs["Strength"]
        base_strength = world_strength.default_value
        # 1. Ground: standing things cast shadows but are not seen; conditional
        #    things are left out (they may not be there).
        show(set(scene.objects) - set(sprite_objs), hidden=conditional | flats)
        scene.render.use_border = False
        ground = render_to(scene, os.path.join(tmp, f"ground-{variant}.png"))
        before = ground_files(variant)
        grounds[variant] = {
            "ground": imageio.save_tiles(ground, a.out, f"ground-{variant}", 86),
            "groundLow": imageio.save_tiles(imageio.downsample(ground, 2), a.out, f"ground-{variant}-low", 84),
        }
        now = {t["file"] for tiles in grounds[variant].values() for t in tiles}
        for f in before - now:
            if os.path.exists(os.path.join(a.out, f)):
                os.remove(os.path.join(a.out, f))
        # 2. Light on the ground (white diffuse, no dust): by default the sun
        #    alone; under cloud, the sky; at lamp-lighting, the lamps.
        spec = lighting.LIGHTS.get(plan.get(variant, variant), {})
        source = spec.get("shade", "sun")
        suns = [o for o in scene.objects if o.type == "LIGHT" and o.name.startswith("Sun")]
        layer = scene.view_layers[0]
        layer.material_override = white
        if source != "sky":
            world_strength.default_value = 0.0
        for light in p.lights:
            light.hide_render = source != "lamps"
        for sun in suns:
            sun.hide_render = source != "sun"
        show(set(scene.objects) - set(sprite_objs), hidden=conditional | flats | volumes)
        scene.render.resolution_percentage = 25
        probe = render_to(scene, os.path.join(tmp, f"shade-{variant}.png"))
        scene.render.resolution_percentage = 100
        layer.material_override = None
        world_strength.default_value = base_strength
        for light in p.lights:
            light.hide_render = False
        for sun in suns:
            sun.hide_render = False
        lum = probe[:, :, :3].mean(axis=2)
        lit = np.percentile(lum, 97)
        vis = np.clip(lum / max(1e-4, lit), 0, 1)
        floor = spec.get("shade_floor", 0.85 if p.style == "home" else None)
        if floor is not None:
            # Indoors people are lit for the room (only the sunbeam, or a
            # lamp's pool, brightens them); under cloud the shade is soft.
            vis = floor + (1 - floor) * vis
        shade = np.dstack([vis, vis, vis, np.ones_like(vis)])
        imageio.save(shade, os.path.join(a.out, f"shade-{variant}.webp"), "WEBP", 90)

    def render_sprite(sp, variant):
        """One standing thing, cropped: (crop, screen left, top) or None."""
        mine = set(sp.objects)
        extra = {catcher_for(p, sp)} if sp.conditional else set()
        others_conditional = conditional - mine
        x0, y0, x1, y1 = screen_rect(sp.objects)
        for cat in extra:
            cx0, cy0, cx1, cy1 = screen_rect([cat], 0.0)
            x0, y0, x1, y1 = min(x0, cx0), min(y0, cy0), max(x1, cx1), max(y1, cy1)
        x0, y0 = max(0.0, x0), max(0.0, y0)
        x1, y1 = min(W, x1), min(H, y1)
        try:
            if x1 - x0 < 1 or y1 - y0 < 1:
                return None
            r = scene.render
            r.use_border = True
            r.use_crop_to_border = True
            r.border_min_x = x0 / W
            r.border_max_x = x1 / W
            r.border_min_y = 1 - y1 / H
            r.border_max_y = 1 - y0 / H
            stem = os.path.join(tmp, f"{sp.id.replace(':', '_')}-{variant}")
            # The thing itself, lit and shadowed by everything around it.
            # The ground in front of it is a holdout: parts sunk into the
            # terrain, a floor or the dust (a boulder's buried side, a jar's
            # foot) are cut away, rather than showing black where no light
            # reaches. Things lying flat are on top of the ground already.
            if sp.flat:
                show(mine, hidden=others_conditional | volumes | extra | scattered)
            else:
                show(mine, hidden=others_conditional | volumes | extra, holdout=set(p.ground_objects) - mine)
            img = render_to(scene, stem + ".png")
            if sp.conditional:
                # Its own shadow alone, on a catcher with nothing else in the
                # scene: anything else would darken the catcher too (its own
                # shadow, and the light it keeps from bouncing).
                show(extra, hidden=meshes - mine - extra)
                shadow = render_to(scene, stem + "-shadow.png")
                # Drop the faint noise over the rest of the catcher (it would
                # make the crop as big as the catcher).
                shadow[:, :, 3] = np.where(shadow[:, :, 3] < 0.035, 0.0, shadow[:, :, 3])
                # A shadow only darkens (the catcher also records some bounce).
                shadow[:, :, :3] = 0.0
                img = imageio.over(img, shadow)
        finally:
            for o in extra:
                bpy.data.objects.remove(o, do_unlink=True)
        box = imageio.alpha_bbox(img)
        if box is None:
            return None
        bx0, by0, bx1, by1 = box
        return img[by0:by1, bx0:bx1], int(round(x0 * a.ppu)) + bx0, int(round(y0 * a.ppu)) + by0

    for variant in variants:
        light_up(variant)
        if a.only not in ("conditional", "sprites"):
            ground_and_shade(variant)
        if a.only == "ground":
            manifest["variants"][variant] = {**previous["variants"][variant], **grounds[variant]}
            print("VARIANT DONE", variant, "ground only")
            continue
        # 3. Each standing thing on its own (or, with --only conditional, just
        #    the conditional ones; the rest are taken from the pages as they are).
        entries = []
        crops = []
        def redo(sp):
            if a.only == "conditional":
                return sp.conditional
            if a.only == "sprites":
                return any(sp.id == s or (s.endswith("-") and sp.id.startswith(s)) for s in a.sprites)
            return True

        for sp in p.sprites:
            if not redo(sp):
                for crop, entry in previous_crops(variant, sp.id):
                    crops.append(crop)
                    entries.append(entry)
                continue
            made = render_sprite(sp, variant)
            if made is None:
                continue
            crop, left, top = made
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
        for stale in (previous or {}).get("variants", {}).get(variant, {}).get("pages", [])[len(page_files) :]:
            for f in (stale, stale.replace(".webp", "-low.webp")):
                if os.path.exists(os.path.join(a.out, f)):
                    os.remove(os.path.join(a.out, f))
        kept = previous["variants"][variant] if previous else {}
        manifest["variants"][variant] = {
            "ground": grounds[variant]["ground"] if variant in grounds else kept["ground"],
            "groundLow": grounds[variant]["groundLow"] if variant in grounds else kept["groundLow"],
            "shade": f"shade-{variant}.webp",
            "pages": page_files,
            "pagesLow": low_files,
            "sprites": entries,
        }
        print("VARIANT DONE", variant, len(entries))
    json.dump(manifest, open(os.path.join(a.out, "manifest.json"), "w"), indent=1)
    print("PLACE DONE", a.scene)


main()
