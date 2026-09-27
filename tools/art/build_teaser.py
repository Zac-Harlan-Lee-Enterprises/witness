"""Render the teaser film that plays before Chapter 1 (The Road to Jericho).

    blender -b --factory-startup -P tools/art/build_teaser.py -- \
        [--shots 1 2 3] [--quality preview|final] [--frames 0 24] [--step 1] \
        [--out tools/art/.cache/teaser] [--force]

Eight shots, 24 fps, about 57 s (SHOTS below). Each shot builds its own set
from the game's places, people and palette at film scale (the wilderness
from teaser_land.py, Jerusalem from teaser_city.py, Aunt Miriam's room from
teaser_room.py, the scene below the bend from teaser_incident.py), moves a
perspective camera through it and renders every frame with EEVEE to a
16-bit PNG, then grades it (teaser_render.grade) into
<out>/<quality>/shot<N>/<frame>.png. Frames already rendered are skipped,
so a crash loses nothing; --force renders them again. The film is cut and
encoded from those frames by tools/art/edit_teaser.py.

Everything is procedural and original: no downloaded images, textures,
footage or models, and no generative models.
"""
import argparse
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import teaser_render as R  # noqa: E402
import teaser_shots  # noqa: E402

FPS = 24


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--shots", nargs="+", type=int, default=list(teaser_shots.SHOTS))
    p.add_argument("--quality", choices=["preview", "final"], default="preview")
    p.add_argument("--frames", nargs=2, type=int, default=None, help="first and last frame of each shot (local)")
    p.add_argument("--only", nargs="+", type=int, default=None, help="just these local frames")
    p.add_argument("--step", type=int, default=1)
    p.add_argument("--out", default=os.path.join(HERE, ".cache", "teaser"))
    p.add_argument("--res", nargs=2, type=int, default=None)
    p.add_argument("--samples", type=int, default=None)
    p.add_argument("--force", action="store_true")
    p.add_argument("--regrade", action="store_true", help="grade the rendered frames again, without rendering")
    return p.parse_args(argv)


def main():
    a = args()
    preview = a.quality == "preview"
    ctx = teaser_shots.Context(preview=preview, cache=os.path.join(HERE, ".cache", "teaser-data"))
    res = a.res or ((640, 360) if preview else (1920, 1080))
    for sid in a.shots:
        spec = teaser_shots.SHOTS[sid]
        folder = os.path.join(a.out, a.quality, f"shot{sid}")
        raw_folder = os.path.join(a.out, a.quality, "raw", f"shot{sid}")
        frames = range(spec.frames)
        if a.frames:
            frames = range(max(0, a.frames[0]), min(spec.frames, a.frames[1] + 1))
        frames = [f for f in frames if (f - frames[0]) % a.step == 0] if frames else []
        if a.only:
            frames = [f for f in a.only if f < spec.frames]
        todo = [f for f in frames if a.force or a.regrade or not os.path.exists(os.path.join(folder, f"{f:04d}.png"))]
        if not todo:
            print("SHOT DONE", sid, "(nothing to render)", flush=True)
            continue
        if a.regrade:
            for f in todo:
                raw = os.path.join(raw_folder, f"{f:04d}.png")
                if os.path.exists(raw):
                    R.finish(raw, os.path.join(folder, f"{f:04d}.png"), spec.grade_at(f), f)
            print("SHOT REGRADED", sid, flush=True)
            continue
        t0 = time.time()
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        scene.render.resolution_x, scene.render.resolution_y = res
        scene.render.resolution_percentage = 100
        scene.render.fps = FPS
        shot = spec.build(ctx, scene)
        samples = a.samples or (shot.samples_preview if preview else shot.samples)
        scene.eevee.taa_render_samples = samples
        print("SHOT BUILT", sid, spec.name, round(time.time() - t0, 1), "s", flush=True)
        for f in todo:
            t1 = time.time()
            scene.frame_set(f)
            shot.animate(f, f / FPS)
            raw = os.path.join(raw_folder, f"{f:04d}.png")
            R.render_still(scene, raw)
            R.finish(raw, os.path.join(folder, f"{f:04d}.png"), spec.grade_at(f), f)
            print("FRAME", sid, f, round(time.time() - t1, 2), "s", flush=True)
        print("SHOT DONE", sid, round(time.time() - t0, 1), "s", flush=True)


main()
