"""Cameras, moves and the finishing grade for the teaser film.

- `Move`: a camera move through key positions (eye and target), eased in
  and out and interpolated with a centripetal Catmull-Rom spline, so cranes
  and dollies start and stop like a real rig; optional handheld drift.
- `camera(...)`: a perspective camera with depth of field.
- `grade(...)`: the finishing pass on each rendered frame (numpy): white
  balance, contrast, lift/gain, saturation, split toning, a little bloom
  and a vignette, per shot. Frames are rendered 16-bit and graded once, so
  a grade can be changed without rendering again.
"""
import math
import os

import bpy
import numpy as np
from mathutils import Vector

import imageio
import teaser_noise as N


def smootherstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (t * 6 - 15) + 10)


def ease(t, ease_in=1.0, ease_out=1.0):
    """Eased progress 0..1: ease_in/ease_out 0 (linear) .. 1 (full smootherstep)."""
    t = min(1.0, max(0.0, t))
    s = smootherstep(t)
    lin = t
    if t < 0.5:
        k = ease_in
    else:
        k = ease_out
    return lin + (s - lin) * k


def _catmull(p0, p1, p2, p3, t):
    """Centripetal Catmull-Rom between p1 and p2."""
    def tj(ti, a, b):
        return ti + max(1e-6, (b - a).length) ** 0.5

    t0 = 0.0
    t1 = tj(t0, p0, p1)
    t2 = tj(t1, p1, p2)
    t3 = tj(t2, p2, p3)
    u = t1 + (t2 - t1) * t
    a1 = p0 * ((t1 - u) / (t1 - t0)) + p1 * ((u - t0) / (t1 - t0))
    a2 = p1 * ((t2 - u) / (t2 - t1)) + p2 * ((u - t1) / (t2 - t1))
    a3 = p2 * ((t3 - u) / (t3 - t2)) + p3 * ((u - t2) / (t3 - t2))
    b1 = a1 * ((t2 - u) / (t2 - t0)) + a2 * ((u - t0) / (t2 - t0))
    b2 = a2 * ((t3 - u) / (t3 - t1)) + a3 * ((u - t1) / (t3 - t1))
    return b1 * ((t2 - u) / (t2 - t1)) + b2 * ((u - t1) / (t2 - t1))


def spline(points, u):
    """A point at u (0..1, by arc length of the key polygon) along a spline
    through `points` (Vectors)."""
    pts = [Vector(p) for p in points]
    if len(pts) == 1:
        return pts[0].copy()
    lens = [(b - a).length for a, b in zip(pts, pts[1:])]
    total = sum(lens) or 1.0
    d = u * total
    i = 0
    while i < len(lens) - 1 and d > lens[i]:
        d -= lens[i]
        i += 1
    t = d / (lens[i] or 1.0)
    p0 = pts[i - 1] if i > 0 else pts[0] * 2 - pts[1]
    p3 = pts[i + 2] if i + 2 < len(pts) else pts[-1] * 2 - pts[-2]
    return _catmull(p0, pts[i], pts[i + 1], p3, t)


class Move:
    """A camera move: eyes and targets (lists of points), lens (one value or
    a list), progress eased; `shake` metres of slow handheld drift."""

    def __init__(self, eyes, targets, lens=35.0, ease_in=1.0, ease_out=1.0, shake=0.0, roll=0.0, seed=3):
        self.eyes = eyes
        self.targets = targets
        self.lens = lens if isinstance(lens, (list, tuple)) else [lens]
        self.ease_in = ease_in
        self.ease_out = ease_out
        self.shake = shake
        self.roll = roll
        self.seed = seed

    def at(self, t, seconds=0.0):
        u = ease(t, self.ease_in, self.ease_out)
        eye = spline(self.eyes, u)
        tgt = spline(self.targets, u)
        lens = self.lens[0] if len(self.lens) == 1 else float(np.interp(u, np.linspace(0, 1, len(self.lens)), self.lens))
        if self.shake:
            k = seconds * 0.55
            off = Vector([float(N.fbm(np.array([k]), np.array([i * 7.1]), 3, seed=self.seed + i)[0]) for i in range(3)])
            eye = eye + off * self.shake
            tgt = tgt + off * self.shake * 0.4
        return eye, tgt, lens


def camera(scene, name="TeaserCam", lens=35.0, sensor=36.0, clip=(0.05, 60000.0)):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_width = sensor
    data.sensor_fit = "HORIZONTAL"
    data.clip_start, data.clip_end = clip
    cam = bpy.data.objects.new(name, data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def aim(cam, eye, target, lens=None, roll=0.0):
    eye = Vector(eye)
    target = Vector(target)
    cam.location = eye
    q = (target - eye).to_track_quat("-Z", "Y")
    if roll:
        from mathutils import Quaternion

        q = q @ Quaternion((0, 0, 1), math.radians(roll))
    cam.rotation_euler = q.to_euler()
    if lens is not None:
        cam.data.lens = lens


def focus(cam, distance=None, fstop=None):
    d = cam.data.dof
    if distance is None:
        d.use_dof = False
        return
    d.use_dof = True
    d.focus_distance = distance
    d.aperture_fstop = fstop or 5.6
    d.aperture_blades = 7
    d.aperture_rotation = math.radians(12)


# ── the grade ────────────────────────────────────────────────────────────────
DEFAULT_GRADE = {
    "exposure": 0.0,        # stops, applied in linear light
    "balance": (1.0, 1.0, 1.0),  # white balance gains (linear)
    "contrast": 1.0,        # around a mid-grey pivot
    "pivot": 0.42,
    "lift": (0.0, 0.0, 0.0),
    "gain": (1.0, 1.0, 1.0),
    "gamma": (1.0, 1.0, 1.0),
    "saturation": 1.0,
    "shadows": (0.0, 0.0, 0.0),     # tint added to the shadows
    "highlights": (0.0, 0.0, 0.0),  # tint added to the highlights
    "bloom": 0.0,
    "bloom_threshold": 0.78,
    "vignette": 0.18,
    "grain": 0.0,
}


def _to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _to_srgb(c):
    c = np.clip(c, 0.0, None)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def _blur_small(img, r):
    return np.stack([N.blur(img[..., k], r) for k in range(img.shape[-1])], axis=-1)


def grade(rgb, g, frame=0):
    """Grade a display-referred image (h, w, 3), values 0..1."""
    p = dict(DEFAULT_GRADE)
    p.update(g or {})
    x = rgb.astype(np.float32)
    lin = _to_linear(x) * (2.0 ** p["exposure"]) * np.array(p["balance"], dtype=np.float32)
    x = _to_srgb(lin)
    # Contrast round a pivot (a gentle S by a power curve either side).
    c = p["contrast"]
    if c != 1.0:
        pv = p["pivot"]
        lo = x < pv
        x = np.where(lo, pv * (np.clip(x, 0, None) / pv) ** c, 1 - (1 - pv) * (np.clip(1 - x, 0, None) / (1 - pv)) ** c)
    lift = np.array(p["lift"], dtype=np.float32)
    gain = np.array(p["gain"], dtype=np.float32)
    gamma = np.array(p["gamma"], dtype=np.float32)
    x = np.clip(x * gain + lift * (1 - x), 0, 1) ** (1.0 / gamma)
    luma = (x * np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)).sum(axis=-1, keepdims=True)
    x = luma + (x - luma) * p["saturation"]
    sh = np.clip(1 - luma * 2.2, 0, 1)
    hi = np.clip(luma * 2.0 - 1.0, 0, 1)
    x = x + sh * np.array(p["shadows"], dtype=np.float32) + hi * np.array(p["highlights"], dtype=np.float32)
    if p["bloom"] > 0:
        h, w = x.shape[:2]
        k = 4
        small = x[: h - h % k, : w - w % k].reshape(h // k, k, w // k, k, 3).mean(axis=(1, 3))
        bright = np.clip(small - p["bloom_threshold"], 0, None)
        glow = _blur_small(bright, 6) + _blur_small(bright, 18) * 0.6
        up = np.repeat(np.repeat(glow, k, axis=0), k, axis=1)
        pad = np.zeros_like(x)
        pad[: up.shape[0], : up.shape[1]] = up
        x = x + pad * p["bloom"]
    if p["vignette"] > 0:
        h, w = x.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        dx = (xx - w / 2) / (w / 2)
        dy = (yy - h / 2) / (h / 2) * (h / w) * 1.2
        r2 = dx * dx + dy * dy
        x = x * (1 - p["vignette"] * np.clip(r2 - 0.25, 0, None) ** 1.2)[..., None]
    if p["grain"] > 0:
        rng = np.random.default_rng(frame * 7919 + 13)
        n = rng.standard_normal(x.shape[:2]).astype(np.float32)
        x = x + (n * p["grain"])[..., None] * (0.4 + 0.6 * np.sqrt(np.clip(luma, 0, 1)))
    # A whisper of dither against banding in skies.
    rng = np.random.default_rng(frame * 31 + 5)
    x = x + (rng.random(x.shape, dtype=np.float32) - rng.random(x.shape, dtype=np.float32)) / 255.0
    return np.clip(x, 0, 1)


def finish(raw_path, out_path, g, frame=0):
    """Grade a rendered frame (16-bit PNG) into the film's frame (8-bit PNG)."""
    img = imageio.load(raw_path)
    rgb = grade(img[:, :, :3], g, frame)
    out = np.concatenate([rgb, np.ones_like(rgb[:, :, :1])], axis=2)
    imageio.save(out, out_path, "PNG")


def render_still(scene, path, tries=4):
    """Render the current frame to a 16-bit PNG (retried if the GPU is busy)."""
    import time

    r = scene.render
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "16"
    r.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for attempt in range(tries):
        try:
            bpy.ops.render.render(write_still=True)
            return
        except RuntimeError as error:
            if attempt == tries - 1:
                raise
            print("RENDER RETRY", attempt + 1, os.path.basename(path), error, flush=True)
            time.sleep(15 * (attempt + 1))
