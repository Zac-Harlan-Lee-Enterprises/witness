"""Deterministic 2D noise on numpy arrays, for the teaser's landscapes.

Gradient (Perlin-style) noise with hashed lattice gradients, so it can be
evaluated at any float coordinates, in any array shape, and gives the same
value for the same point whatever grid it is sampled on. That lets one
landscape be sampled coarsely far away and finely near the camera without
seams. Everything is seeded: the same seed always gives the same land.
"""
import numpy as np

_M = np.uint64(0xFFFFFFFF)


def _hash(ix, iy, seed):
    """A well-mixed 32-bit hash of integer lattice coordinates (as uint64)."""
    h = (ix.astype(np.int64) * 374761393 + iy.astype(np.int64) * 668265263 + seed * 1442695041).astype(np.uint64) & _M
    h = ((h ^ (h >> np.uint64(13))) * np.uint64(1274126177)) & _M
    h = h ^ (h >> np.uint64(16))
    return h


def perlin(x, y, seed=0):
    """Gradient noise in about [-0.7, 0.7], smooth (quintic), period-free."""
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    x0 = np.floor(x)
    y0 = np.floor(y)
    fx = x - x0
    fy = y - y0
    ix = x0.astype(np.int64)
    iy = y0.astype(np.int64)

    def grad(dx, dy):
        h = _hash(ix + dx, iy + dy, seed)
        a = (h & np.uint64(0xFFFF)).astype(np.float64) * (2 * np.pi / 65536.0)
        return np.cos(a) * (fx - dx) + np.sin(a) * (fy - dy)

    u = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    v = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    n00 = grad(0, 0)
    n10 = grad(1, 0)
    n01 = grad(0, 1)
    n11 = grad(1, 1)
    a = n00 + (n10 - n00) * u
    b = n01 + (n11 - n01) * u
    return a + (b - a) * v


def fbm(x, y, octaves=5, lacunarity=2.03, gain=0.5, seed=0):
    """Fractal sum of gradient noise, roughly in [-1, 1]."""
    out = np.zeros(np.broadcast(np.asarray(x), np.asarray(y)).shape)
    amp = 1.0
    norm = 0.0
    fx, fy = np.asarray(x, dtype=np.float64), np.asarray(y, dtype=np.float64)
    for i in range(octaves):
        out += perlin(fx, fy, seed + i * 101) * amp
        norm += amp
        amp *= gain
        # Rotate each octave a little so lattice directions never line up.
        fx, fy = (fx * 0.8 - fy * 0.6) * lacunarity + 17.3, (fx * 0.6 + fy * 0.8) * lacunarity - 9.1
    return out / norm * 1.6


def ridged(x, y, octaves=5, lacunarity=2.1, gain=0.5, seed=0):
    """Ridged multifractal: sharp crests, rounded valleys, in [0, 1]."""
    out = np.zeros(np.broadcast(np.asarray(x), np.asarray(y)).shape)
    amp = 1.0
    norm = 0.0
    weight = np.ones_like(out)
    fx, fy = np.asarray(x, dtype=np.float64), np.asarray(y, dtype=np.float64)
    for i in range(octaves):
        n = 1.0 - np.abs(perlin(fx, fy, seed + i * 131) * 1.4)
        n = np.clip(n, 0.0, 1.0) ** 2
        out += n * amp * weight
        weight = np.clip(n * 1.6, 0.0, 1.0)
        norm += amp
        amp *= gain
        fx, fy = (fx * 0.8 - fy * 0.6) * lacunarity + 31.7, (fx * 0.6 + fy * 0.8) * lacunarity + 5.3
    return out / norm


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def blur(a, r):
    """Separable box blur twice (about Gaussian), edge-clamped; r in samples."""
    if r <= 0:
        return a
    out = a.astype(np.float64)
    for _ in range(2):
        for axis in (0, 1):
            pad = [(0, 0), (0, 0)]
            pad[axis] = (r + 1, r)
            p = np.pad(out, pad, mode="edge")
            c = np.cumsum(p, axis=axis)
            if axis == 0:
                out = (c[2 * r + 1 :, :] - c[: -2 * r - 1, :]) / (2 * r + 1)
            else:
                out = (c[:, 2 * r + 1 :] - c[:, : -2 * r - 1]) / (2 * r + 1)
    return out


def bilinear(grid, x0, y0, cell, x, y):
    """Sample a grid (rows = y, cols = x; origin (x0, y0); spacing `cell`) at points."""
    h, w = grid.shape
    fx = np.clip((np.asarray(x) - x0) / cell, 0, w - 1.0001)
    fy = np.clip((np.asarray(y) - y0) / cell, 0, h - 1.0001)
    ix = fx.astype(np.int64)
    iy = fy.astype(np.int64)
    tx = fx - ix
    ty = fy - iy
    a = grid[iy, ix]
    b = grid[iy, ix + 1]
    c = grid[iy + 1, ix]
    d = grid[iy + 1, ix + 1]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty


def cell_random(i, j=0, seed=0):
    """A random value in [0, 1) for each integer cell (i, j): the same cell
    always gives the same value (jointed blocks, notches, per-course colour)."""
    i = np.asarray(i, dtype=np.float64)
    j = np.asarray(j, dtype=np.float64)
    h = _hash(np.floor(i).astype(np.int64), np.floor(j).astype(np.int64), seed)
    return (h & np.uint64(0xFFFFFF)).astype(np.float64) / float(0x1000000)
