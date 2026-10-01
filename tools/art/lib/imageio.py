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


# WebP quality of the half-resolution set (phones, devices short of memory),
# ground and sprite pages alike (they were 84 and 86, box-filtered). With
# the sharper filter (downsample_sharp) 88 keeps the grit and a net's mesh;
# 92 was a fifth larger again for little that shows (docs/performance.md §2c).
LOW_GROUND_Q = 88
LOW_PAGE_Q = 88


def _lanczos_half(a, axis):
    """Halve an array along one axis with a Lanczos-3 filter (six taps each
    side of an output pixel's centre, which falls between two inputs)."""
    n = a.shape[axis] // 2 * 2
    a = np.take(a, np.arange(n), axis=axis)
    offs = np.arange(-5, 7) - 0.5  # input centres relative to the output centre, in input pixels
    x = offs / 2.0  # in output pixels
    w = np.sinc(x) * np.sinc(x / 3.0) * (np.abs(x) < 3.0)
    w = w / w.sum()
    pad = [(0, 0)] * a.ndim
    pad[axis] = (6, 6)
    p = np.pad(a, pad, mode="edge")
    out = 0.0
    for k, wk in enumerate(w):
        # Output i sits between inputs 2i and 2i+1; tap k reads input 2i + offs[k] + 0.5.
        start = 6 + int(offs[k] + 0.5)
        idx = start + 2 * np.arange(n // 2)
        out = out + wk * np.take(p, idx, axis=axis)
    return out


def downsample_sharp(arr, amount=0.35):
    """Halve an image for the half-resolution set, keeping it crisp: the
    colour through a Lanczos-3 filter (in premultiplied space) with a light
    unsharp mask, the alpha box-filtered (so no ringing halos at edges), the
    colour then kept within its alpha. A box filter alone (downsample) blurs
    fine texture (the grit of the ground, the mesh of a net) to mush."""
    h, w = arr.shape[:2]
    a = arr[: h // 2 * 2, : w // 2 * 2].astype(np.float32)
    pm = a.copy()
    pm[:, :, :3] *= pm[:, :, 3:4]
    box = downsample(a, 2)
    alpha = box[:, :, 3:4]
    rgb = _lanczos_half(_lanczos_half(pm[:, :, :3], 0), 1)
    if amount > 0:
        # A light unsharp mask at the new size (radius about one pixel).
        q = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode="edge")
        blur = (q[1:-1, 1:-1] + q[:-2, 1:-1] + q[2:, 1:-1] + q[1:-1, :-2] + q[1:-1, 2:]) / 5.0
        rgb = rgb + amount * (rgb - blur)
    rgb = np.clip(rgb, 0.0, alpha)
    out = np.concatenate([np.where(alpha > 1e-5, rgb / np.maximum(alpha, 1e-5), 0.0), alpha], axis=2)
    return out.astype(np.float32)


# Every GPU the game runs on holds a 2048 px texture (WebGL 2's minimum);
# many phones stop at 4096. Big images are cut into tiles this size at most.
TILE = 2048
# Neighbouring tiles overlap by this much, so no hairline opens between them
# when the camera sits between pixels.
OVERLAP = 2


def tile_grid(w, h, tile=TILE, overlap=OVERLAP):
    """Tiles covering a w x h image: [(x0, y0, x1, y1)], left to right, top
    to bottom, each at most `tile` px, equal and even-sized (the last may be
    narrower), overlapping their right and lower neighbours by `overlap`."""

    def cuts(n):
        if n <= tile:
            return [(0, n)]
        k = -(-n // (tile - overlap))
        step = -(-n // k)
        step += step % 2
        return [(i * step, min(n, i * step + step + overlap)) for i in range(k) if i * step < n]

    return [(x0, y0, x1, y1) for y0, y1 in cuts(h) for x0, x1 in cuts(w)]


def save_tiles(arr, folder, stem, quality):
    """Write an image as tiles (see tile_grid): <stem>.webp when one tile
    holds it, else <stem>-x<i>y<j>.webp. Returns the manifest entries,
    [{"file", "x", "y"}], with each tile's top-left in the image's pixels."""
    h, w = arr.shape[:2]
    grid = tile_grid(w, h)
    xs = sorted({g[0] for g in grid})
    ys = sorted({g[1] for g in grid})
    out = []
    for x0, y0, x1, y1 in grid:
        name = f"{stem}.webp" if len(grid) == 1 else f"{stem}-x{xs.index(x0)}y{ys.index(y0)}.webp"
        save(arr[y0:y1, x0:x1], os.path.join(folder, name), "WEBP", quality)
        out.append({"file": name, "x": x0, "y": y0})
    return out
