"""Render character sprite sheets and their cast-shadow sheets.

    blender -b --factory-startup -P tools/art/build_people.py -- \
        --out public/art/people --who player:look-1 hadassah crowd:crowd-0 \
        [--ppu 3] [--samples 64] [--variants day late]

Sheet layout (frames FRAME_W x FRAME_H game units, feet at FOOT_Y):
    rows 0-3: down, left, right, up
    columns:  0 idle, 1 breath, 2 blink, 3 talk, 4 talk (mouth half),
              5-12 walk cycle (8 frames, from left-foot contact) — walkers only
    row 4:    turning in-betweens: down-left, down-right, up-left, up-right
One colour sheet and one shadow sheet per lighting variant. People are seen
from a slightly lower camera than the world (faces read) with height still
1:1 on screen; shadows lie on the ground and use the world camera.
"""
import argparse
import json
import math
import os
import sys
import tempfile

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
sys.path.insert(0, HERE)
import common  # noqa: E402
import imageio  # noqa: E402
import lighting  # noqa: E402
import materials as M  # noqa: E402
import people  # noqa: E402
import repack_people  # noqa: E402
import view  # noqa: E402

FRAME_W = 44
FRAME_H = 68
FOOT_Y = 62
SHADOW_BOX = {"day": (-64, -42, 20, 12), "late": (-12, -66, 150, 14)}  # left, top, right, bottom from the feet
SHADOW_PPU = 1.0
DIRECTIONS = [("down", 0.0), ("left", -90.0), ("right", 90.0), ("up", 180.0)]
TURNS = [("down-left", -45.0), ("down-right", 45.0), ("up-left", -135.0), ("up-right", 135.0)]
STILL = [("idle", {}), ("breath", {"breath": 1}), ("blink", {"blink": True}), ("talk", {"talk": 1}), ("talk2", {"talk": 2})]
WALK = [(f"walk{i}", {"walk": i / 8.0}) for i in range(8)]


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--who", nargs="+", required=True)
    p.add_argument("--ppu", type=float, default=3.0)
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--variants", nargs="+", default=["day", "late"])
    return p.parse_args(argv)


def lookup(data, who):
    """(id, key, appearance, walks) for 'player:look-1', 'crowd:crowd-0' or a character id."""
    if who.startswith("player:"):
        p = next(p for p in data["players"] if p["id"] == who.split(":", 1)[1])
        return f"player-{p['id']}", p["key"], p["appearance"], True
    if who.startswith("crowd:"):
        c = next(c for c in data["crowd"] if c["id"] == who.split(":", 1)[1])
        return c["id"], c["key"], c["appearance"], True
    c = next(c for c in data["characters"] if c["id"] == who)
    return c["id"], c["key"], c["appearance"], False


# Full shade multiplies the ground by this (cool, like the baked shadows).
SHADE = np.array([0.42, 0.45, 0.56])


def shadow_grey(alpha):
    """A shadow as an opaque tint on white (drawn with multiply blending)."""
    a = np.clip(alpha, 0, 1)
    rgb = 1.0 - a[:, :, None] * (1.0 - SHADE)[None, None, :]
    return np.dstack([rgb, np.ones_like(a)])


def render_frame(scene, path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return imageio.load(path)


def main():
    a = args()
    data = json.load(open(os.path.join(HERE, "data", "chapter.json")))
    os.makedirs(a.out, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="witness-people-")
    manifest_path = os.path.join(a.out, "people.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    for who in a.who:
        pid, key, app, walks = lookup(data, who)
        cols = STILL + (WALK if walks else [])
        scene = common.reset(a.samples)
        person = people.Person(app, name=pid)
        bpy.ops.mesh.primitive_plane_add(size=24.0, location=(0, 0, 0))
        ground = bpy.context.object
        ground.is_shadow_catcher = True
        ground.data.materials.append(M.shadow_catcher())
        fw, fh = int(FRAME_W * a.ppu), int(FRAME_H * a.ppu)
        n_cols = max(len(cols), len(TURNS))
        entry = {
            "appearance": key,
            "sheets": {},
            "frameWidth": fw,
            "frameHeight": fh,
            "originX": fw / 2,
            "originY": FOOT_Y * a.ppu,
            "ppu": a.ppu,
            "columns": [c[0] for c in cols],
            "rows": [d[0] for d in DIRECTIONS],
            "turns": [t[0] for t in TURNS],
            "shadows": {},
        }
        for variant in a.variants:
            lighting.setup(scene, variant)
            # 1. The person (no ground), from the figure camera.
            ground.hide_render = True
            for part in person.parts:
                part.obj.visible_camera = True
            view.setup_figure_camera(scene, FOOT_Y - FRAME_H / 2, fw, fh, a.ppu)
            sheet = np.zeros((fh * 5, fw * n_cols, 4), dtype=np.float32)
            for r, (dname, yaw) in enumerate(DIRECTIONS):
                for c, (cname, spec) in enumerate(cols):
                    person.pose(yaw=math.radians(yaw), **spec)
                    sheet[r * fh : (r + 1) * fh, c * fw : (c + 1) * fw] = render_frame(scene, os.path.join(tmp, f"{pid}-{variant}-{dname}-{cname}.png"))
            for c, (tname, yaw) in enumerate(TURNS):
                person.pose(yaw=math.radians(yaw))
                sheet[4 * fh : 5 * fh, c * fw : (c + 1) * fw] = render_frame(scene, os.path.join(tmp, f"{pid}-{variant}-{tname}.png"))
            name = f"{pid}-{variant}.webp"
            imageio.save(sheet, os.path.join(a.out, name), "WEBP", 90)
            entry["sheets"][variant] = name
            # 2. Its shadow on the ground, from the world camera.
            ground.hide_render = False
            for part in person.parts:
                part.obj.visible_camera = False
            l, t, rgt, b = SHADOW_BOX[variant]
            sw, sh = int((rgt - l) * SHADOW_PPU), int((b - t) * SHADOW_PPU)
            view.setup_camera(scene, (l + rgt) / 2, (t + b) / 2, sw, sh, SHADOW_PPU)
            ssheet = np.ones((sh * 5, sw * n_cols, 4), dtype=np.float32)

            def put(img, r, c):
                # Opaque greyscale (white = no shadow), drawn with multiply blending:
                # far smaller than an alpha channel, and overlapping shadows combine naturally.
                ssheet[r * sh : (r + 1) * sh, c * sw : (c + 1) * sw] = shadow_grey(img[:, :, 3])

            for r, (dname, yaw) in enumerate(DIRECTIONS):
                for c, (cname, spec) in enumerate(cols):
                    person.pose(yaw=math.radians(yaw), **spec)
                    put(render_frame(scene, os.path.join(tmp, f"{pid}-s-{variant}-{dname}-{cname}.png")), r, c)
            for c, (tname, yaw) in enumerate(TURNS):
                person.pose(yaw=math.radians(yaw))
                put(render_frame(scene, os.path.join(tmp, f"{pid}-s-{variant}-{tname}.png")), 4, c)
            sname = f"{pid}-shadow-{variant}.webp"
            imageio.save(ssheet, os.path.join(a.out, sname), "WEBP", 62)
            entry["shadows"][variant] = {
                "sheet": sname,
                "frameWidth": sw,
                "frameHeight": sh,
                "originX": -l * SHADOW_PPU,
                "originY": -t * SHADOW_PPU,
                "ppu": SHADOW_PPU,
            }
        manifest[pid] = entry
        json.dump(manifest, open(manifest_path, "w"), indent=1, sort_keys=True)
        # Trim every frame to what is visible and pack the sheets into atlases.
        repack_people.repack(a.out)
        manifest = json.load(open(manifest_path))
        print("PERSON DONE", pid)
    print("PEOPLE DONE")


if __name__ == "__main__":
    main()
