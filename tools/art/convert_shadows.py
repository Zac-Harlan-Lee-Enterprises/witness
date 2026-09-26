"""One-off: convert alpha shadow sheets to opaque greyscale (multiply) sheets.

    blender -b --factory-startup -P tools/art/convert_shadows.py -- public/art/people
"""
import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import numpy as np  # noqa: E402

import imageio  # noqa: E402

# Full shade multiplies the ground by this (cool, like the baked shadows).
SHADE = np.array([0.42, 0.45, 0.56])


def shadow_colour(a):
    rgb = 1.0 - a[:, :, None] * (1.0 - SHADE)[None, None, :]
    return np.dstack([rgb, np.ones_like(a)])

folder = sys.argv[sys.argv.index("--") + 1]
for path in sorted(glob.glob(os.path.join(folder, "*-shadow-*.webp"))):
    img = imageio.load(path)
    if img[:, :, 3].min() > 0.99:
        a = 1.0 - img[:, :, 0]  # already opaque: recover the density from grey
        if abs(float((img[:, :, 2] - img[:, :, 0]).mean())) > 0.002:
            continue  # already coloured
    else:
        a = np.clip(img[:, :, 3], 0, 1)
    imageio.save(shadow_colour(a), path, "WEBP", 62)
    print("converted", os.path.basename(path))
