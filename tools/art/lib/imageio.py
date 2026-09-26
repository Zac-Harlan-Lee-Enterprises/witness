"""Reading renders into numpy and writing sheets and atlases (PNG/WebP)
with Blender's own image I/O, so the pipeline needs no other tools.

Arrays are (height, width, 4), top row first, values 0-1 in sRGB
encoding with straight (unpremultiplied) alpha, as Blender writes PNGs.
"""
import os

import bpy
import numpy as np


def load(path):
    img = bpy.data.images.load(path, check_existing=False)
    img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[::-1].copy()


def save(arr, path, fmt="WEBP", quality=88):
    """Write an array as-is (no colour transform) to PNG or WebP."""
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), width=w, height=h, alpha=True)
    img.colorspace_settings.name = "Non-Color"
    img.alpha_mode = "STRAIGHT"
    img.pixels.foreach_set(np.ascontiguousarray(np.clip(arr[::-1], 0, 1)).reshape(-1).astype(np.float32))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.filepath_raw = path
    img.file_format = fmt
    img.save(quality=quality)
    bpy.data.images.remove(img)


def alpha_bbox(arr, threshold=0.004):
    ys, xs = np.nonzero(arr[:, :, 3] > threshold)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def over(top, bottom):
    """Alpha-composite `top` over `bottom` (straight alpha, same size)."""
    ta = top[:, :, 3:4]
    ba = bottom[:, :, 3:4]
    a = ta + ba * (1 - ta)
    rgb = (top[:, :, :3] * ta + bottom[:, :, :3] * ba * (1 - ta)) / np.maximum(a, 1e-6)
    return np.concatenate([rgb, a], axis=2)


def downsample(arr, factor):
    """Box-filter by an integer factor, in premultiplied space."""
    h, w = arr.shape[:2]
    h2, w2 = h // factor, w // factor
    a = arr[: h2 * factor, : w2 * factor]
    pm = a.copy()
    pm[:, :, :3] *= pm[:, :, 3:4]
    pm = pm.reshape(h2, factor, w2, factor, 4).mean(axis=(1, 3))
    alpha = pm[:, :, 3:4]
    out = pm.copy()
    out[:, :, :3] = np.where(alpha > 1e-5, pm[:, :, :3] / np.maximum(alpha, 1e-5), 0)
    return out
