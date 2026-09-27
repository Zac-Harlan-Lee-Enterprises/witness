"""Finishing a portrait: high-quality resizing for the sizes the game
shows, a gentle lens vignette, and review contact sheets.

(A painterly pass, Blender's Kuwahara filter, was tried on the earlier
heads and rejected; see docs/art/portraits.md §12.3.)
"""
import math

import numpy as np


def _lanczos(n_in, n_out, a=3):
    """A (n_out, n_in) resampling matrix (Lanczos-a, widened for downsampling)."""
    scale = n_in / n_out
    support = a * max(1.0, scale)
    M = np.zeros((n_out, n_in), np.float64)
    for i in range(n_out):
        c = (i + 0.5) * scale - 0.5
        lo = int(math.floor(c - support))
        hi = int(math.ceil(c + support))
        js = np.arange(lo, hi + 1)
        x = (js - c) / max(1.0, scale)
        w = np.sinc(x) * np.sinc(x / a)
        w[np.abs(x) >= a] = 0
        w /= w.sum()
        js = np.clip(js, 0, n_in - 1)
        np.add.at(M[i], js, w)
    return M


def resize(img, size, sharpen=None):
    """Resize an (h, w, 4) image to size x size, with a light unsharp mask
    on the smallest sizes so eyes and lashes stay crisp."""
    h, w = img.shape[:2]
    if (h, w) == (size, size):
        return img.copy()
    Ry = _lanczos(h, size)
    Rx = _lanczos(w, size)
    out = np.einsum("ij,jkc->ikc", Ry, img)
    out = np.einsum("ij,kjc->kic", Rx, out)
    if sharpen is None:
        sharpen = 0.35 if size <= 128 else (0.2 if size <= 256 else 0.0)
    if sharpen > 0:
        blur = out.copy()
        k = np.array([0.25, 0.5, 0.25])
        for axis in (0, 1):
            blur = sum(kv * np.roll(blur, s, axis=axis) for kv, s in zip(k, (-1, 0, 1)))
        out[:, :, :3] = out[:, :, :3] + sharpen * (out[:, :, :3] - blur[:, :, :3])
    out = np.clip(out, 0, 1).astype(np.float32)
    out[:, :, 3] = 1.0
    return out


def vignette(img, strength=0.18, start=0.42):
    """Darken toward the corners, as a portrait lens does, so the face is the
    brightest thing in the picture after the headwear (in sRGB, gently:
    nothing within `start` of the centre, `strength` darker at the corners)."""
    h, w = img.shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((x + 0.5) / w - 0.5, (y + 0.5) / h - 0.5) / math.sqrt(0.5)
    t = np.clip((r - start) / (1.0 - start), 0, 1)
    k = 1.0 - strength * t * t * (3 - 2 * t)
    out = img.copy()
    out[:, :, :3] *= k[:, :, None]
    return out


def contact_sheet(imgs, cols=4, size=256, gap=8, bg=(0.94, 0.89, 0.78)):
    rows = (len(imgs) + cols - 1) // cols
    H = rows * size + (rows + 1) * gap
    W = cols * size + (cols + 1) * gap
    sheet = np.ones((H, W, 4), np.float32)
    sheet[:, :, :3] = bg
    for i, im in enumerate(imgs):
        r, c = divmod(i, cols)
        y = gap + r * (size + gap)
        x = gap + c * (size + gap)
        sheet[y : y + size, x : x + size] = resize(im, size, sharpen=0.0)
    return sheet
