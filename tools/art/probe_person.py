"""Close-up render of a few poses of one person, for checking the model.

    blender -b --factory-startup -P tools/art/probe_person.py -- out.png hadassah [ppu]
"""
import json
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import common  # noqa: E402
import imageio  # noqa: E402
import lighting  # noqa: E402
import materials as M  # noqa: E402
import people  # noqa: E402
import view  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :]
out, who = argv[0], argv[1]
ppu = float(argv[2]) if len(argv) > 2 else 7.0
light = argv[3] if len(argv) > 3 else "day"
data = json.load(open(os.path.join(HERE, "data", "chapter.json")))
if who.startswith("player:"):
    app = next(p["appearance"] for p in data["players"] if p["id"] == who.split(":")[1])
else:
    app = next(c["appearance"] for c in data["characters"] if c["id"] == who)
scene = common.reset(48)
lighting.setup(scene, light)
person = people.Person(app, name=who.replace(":", "-"))
bpy.ops.mesh.primitive_plane_add(size=30.0, location=(0, 0, 0))
ground = bpy.context.object
ground.data.materials.append(M.plain("#c2ad86", 0.9, 0.2))
poses = [
    ("down", 0, {}),
    ("down", 0, {"walk": 0.125}),
    ("right", 90, {}),
    ("right", 90, {"walk": 0.0}),
    ("right", 90, {"walk": 0.25}),
    ("right", 90, {"walk": 0.625}),
    ("up", 180, {}),
    ("down", 0, {"talk": 1}),
]
import numpy as np

head_only = len(argv) > 4 and argv[4] == "head"
w, h = (18, 18) if head_only else (60, 72)
fw, fh = int(w * ppu), int(h * ppu)
row = np.zeros((fh, fw * len(poses), 4), dtype=np.float32)
top = person.H / people.GU
view.setup_figure_camera(scene, (top - 7) if head_only else (h / 2 - 8), fw, fh, ppu)
scene.render.film_transparent = False
for i, (_, yaw, spec) in enumerate(poses):
    person.pose(yaw=math.radians(yaw), **spec)
    path = f"/tmp/probe-{i}.png"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    row[:, i * fw : (i + 1) * fw] = imageio.load(path)
imageio.save(row, out, "PNG")
print("PROBE", out)
