"""Beauty render of a region of the market (everything visible), for review.

    blender -b --factory-startup -P tools/art/probe_market.py -- out.png x0 y0 x1 y1 [ppu] [day|late]
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import bpy  # noqa: E402

import common  # noqa: E402
import lighting  # noqa: E402
import market  # noqa: E402
import view  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :]
out = argv[0]
x0, y0, x1, y1 = (float(v) for v in argv[1:5])
ppu = float(argv[5]) if len(argv) > 5 else 2.0
light = argv[6] if len(argv) > 6 else "day"
data = json.load(open(os.path.join(HERE, "data", "chapter.json")))
scene = common.reset(96)
lighting.setup(scene, light)
m = market.Market(data["scenes"][0]).build()
print("SPRITES", len(m.sprites))
for sp in m.sprites:
    for o in sp.objects:
        if not o.users_collection:
            scene.collection.objects.link(o)
w = (x1 - x0) * 32
h = (y1 - y0) * 32
view.setup_camera(scene, (x0 + x1) / 2 * 32, (y0 + y1) / 2 * 32, int(w * ppu), int(h * ppu), ppu)
scene.render.film_transparent = False
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("PROBE", out)
