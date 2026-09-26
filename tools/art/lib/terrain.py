"""Terrain for places that are not flat: hills, cliffs, a wadi, a spring's
basin, built as one mesh whose height field is SHEARED to the game's view.

The game draws every tile where the map says, whatever stands on it, and a
point `z` tiles up shows `z` tiles higher on screen. So a terrain point we
want to show at map point (x, s) with height h is placed at game ground
position (x, s + h): it lands on screen at (x, s + h - h) = (x, s). Every
point of the terrain registers with its own tile at any height, so hills
and cliffs can be as tall as they like and still match the collision grid,
and the terrain never needs to be sorted against people: it all lies in the
ground layer.

The one rule that keeps this honest: going south on the map, the height may
drop by at most one tile per tile (h(s + d) >= h(s) - d). Anything steeper
would be an overhang, and a person standing on low ground just south of a
height would be hidden by terrain that is really behind them. `heights`
enforces it with a sweep from south to north; the `lean` of each kind sets
how steep a south-facing side is: 1 is a sheer cliff face, 0.5 about 45°.

Heights are in tiles (1 tile = 1 m). Walkable kinds keep the heights in
WALK (people stand on them); hills and cliffs rise by how far they are from
anywhere walkable; solid props take the ground around them.
"""
import math

import bmesh
import bpy
import numpy as np

import common

K = 8  # height samples per tile

WALK = {"wadi": -0.34, "mud": -0.16, "soil": -0.03, "water": -0.55, "reeds": -0.2}
RISE = {
    # kind: (cap: height far from walkable ground, reach: tiles to rise most of
    # the way, noise amplitude, lean of south-facing sides, terrace step,
    # terrace strength)
    "hill": (2.6, 2.6, 0.45, 0.62, 0.3, 0.14),
    "cliff": (5.0, 1.2, 0.5, 0.97, 0.7, 0.3),
}


def _blur(a, r):
    """Box blur (separable, edge-clamped), radius r samples, twice (≈ Gaussian)."""
    if r <= 0:
        return a
    out = a
    for _ in range(2):
        pad = np.pad(out, ((0, 0), (r, r)), mode="edge")
        c = np.cumsum(pad, axis=1)
        c = np.concatenate([np.zeros((c.shape[0], 1)), c], axis=1)
        out = (c[:, 2 * r + 1 :] - c[:, : -2 * r - 1]) / (2 * r + 1)
        pad = np.pad(out, ((r, r), (0, 0)), mode="edge")
        c = np.cumsum(pad, axis=0)
        c = np.concatenate([np.zeros((1, c.shape[1])), c], axis=0)
        out = (c[2 * r + 1 :, :] - c[: -2 * r - 1, :]) / (2 * r + 1)
    return out


def _fbm(w, h, seed, cells=(24, 9, 3.5)):
    from place import value_noise

    out = np.zeros((h, w))
    amp = 1.0
    tot = 0.0
    for i, c in enumerate(cells):
        out += (value_noise(w, h, c, seed + i * 17) - 0.5) * amp
        tot += amp
        amp *= 0.5
    return out / tot * 2.0


def _distance_to_walkable(m):
    """Tiles from each tile to the nearest walkable one (8-neighbour BFS)."""
    INF = 10**6
    d = np.full((m.h, m.w), INF, dtype=np.int64)
    queue = []
    for y in range(m.h):
        for x in range(m.w):
            if m.walkable(x, y):
                d[y, x] = 0
                queue.append((x, y))
    i = 0
    while i < len(queue):
        x, y = queue[i]
        i += 1
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < m.w and 0 <= ny < m.h and d[ny, nx] > d[y, x] + 1:
                    d[ny, nx] = d[y, x] + 1
                    queue.append((nx, ny))
    d[d == INF] = 8
    return d


def heights(place):
    """The height field on a (h*K+1, w*K+1) grid of map points, or None for flat places.

    Hills rise as rounded domes by their distance from walkable ground,
    creased by gullies and stepped by soft terracettes (the sheep paths that
    contour every Judean hillside); cliffs rise fast into tall faces with
    ledges. Walkable ground keeps its own height (WALK) with soft banks."""
    m = place.map
    kinds = m.kinds()
    if not any(k in RISE or k in WALK for k in kinds):
        return None
    dist = _distance_to_walkable(m).astype(float)
    W, Hh = m.w * K + 1, m.h * K + 1
    xs = np.clip((np.arange(W) / K).astype(int), 0, m.w - 1)
    ys = np.clip((np.arange(Hh) / K).astype(int), 0, m.h - 1)
    near = lambda a: a[ys][:, xs]  # noqa: E731
    params = np.zeros((m.h, m.w, 6))
    free = np.zeros((m.h, m.w))
    walk = np.zeros((m.h, m.w))
    for y in range(m.h):
        for x in range(m.w):
            k = m.kind(x, y)
            if k in RISE:
                params[y, x] = RISE[k]
                free[y, x] = 1.0
            elif k in WALK:
                walk[y, x] = WALK[k]
            elif not m.walkable(x, y):
                ns = [m.kind(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy)]
                high = [kk for kk in ns if kk in RISE]
                if len(high) >= 4:
                    params[y, x] = RISE[max(set(high), key=high.count)]
                    free[y, x] = 1.0
    seed = sum(ord(c) for c in m.id)
    # Smooth fields on the sample grid.
    D = _blur(near(dist), K // 2) - 0.35
    P = np.stack([_blur(near(params[..., i]), K // 2) for i in range(6)], axis=-1)
    cap, reach, amp, lean, step, tstr = (P[..., i] for i in range(6))
    F = near(free)
    Fb = _blur(F, int(K * 0.35))
    with np.errstate(divide="ignore", invalid="ignore"):
        dome = np.where(reach > 0.05, cap * (1 - np.exp(-np.maximum(D, 0) / np.maximum(reach, 0.05))), 0.0)
    # Broad undulation, then gullies: creases where a ridged noise is low.
    # Broad undulation: spurs and hollows on the flanks, knolls on the tops.
    hf = dome * (1 + _fbm(W, Hh, seed, (48, 20)) * 0.32) + _fbm(W, Hh, seed + 3, (16, 7, 3)) * amp * 0.5
    # Soft terraces: treads nearly level, risers steeper; ledges on cliffs.
    with np.errstate(divide="ignore", invalid="ignore"):
        st = np.maximum(step, 0.05)
        t = hf / st
        f = t - np.floor(t)
        soft = f - np.sin(f * math.tau) / math.tau * 0.85
        terr = (np.floor(t) + soft) * st
    hf = np.where(step > 0.05, hf * (1 - tstr) + terr * tstr, hf)
    # Walkable ground: its own heights, with soft banks that wander (the
    # heights are sampled through a smooth warp, like the ground's layers).
    wx = _fbm(W, Hh, seed + 21, (24, 9)) * K * 0.45
    wy = _fbm(W, Hh, seed + 22, (24, 9)) * K * 0.45
    gx = np.clip(np.arange(W)[None, :] + wx, 0, W - 1).astype(int)
    gy = np.clip(np.arange(Hh)[:, None] + wy, 0, Hh - 1).astype(int)
    Tw = _blur(near(walk)[gy, gx], int(K * 0.3))
    lock = np.clip((1.0 - Fb - 0.1) / 0.8, 0.0, 1.0)
    lock = lock * lock * (3 - 2 * lock)
    H = lock * Tw + (1 - lock) * np.maximum(hf * F + Tw * (1 - F), Tw)
    # No overhangs: going north, rise at most `lean` per tile. Steep kinds are
    # stepped by strata: hard bands stand sheer, soft bands between them
    # slope back into ledges, so a cliff reads as tiers of rock.
    Lb = np.where(lean > 0.05, lean, 0.6)
    Lb = np.clip(Lb + _fbm(W, Hh, seed + 5, (6, 2)) * 0.05, 0.3, 0.99)
    tiers = step > 0.5
    soft_at = _strata(seed)
    tilt = _fbm(W, 1, seed + 13, (60, 24)).reshape(W) * 0.35
    ds = 1.0 / K
    for j in range(Hh - 2, -1, -1):
        below = H[j + 1]
        lj = Lb[j]
        soft = tiers[j] & soft_at(below + tilt)
        lj = np.where(soft, 0.3, lj)
        H[j] = np.minimum(H[j], below + ds * lj)
    return H


def _strata(seed):
    """Which heights fall in soft beds (marl that weathers back into a slope)
    between hard limestone bands: beds of irregular thickness, as a lookup."""
    import random

    rng = random.Random(seed)
    edges = [0.0]
    soft = []
    z = 0.0
    while z < 12:
        hard = 0.35 + rng.random() * 0.8
        weak = 0.12 + rng.random() * 0.3
        soft.append((z + hard, z + hard + weak))
        z += hard + weak
        edges.append(z)
    lo = np.array([a for a, _ in soft])
    hi = np.array([b for _, b in soft])

    def at(h):
        i = np.searchsorted(lo, h, side="right") - 1
        i = np.clip(i, 0, len(lo) - 1)
        return (h >= lo[i]) & (h < hi[i])

    return at


def _relief(H, m):
    """Buttresses and recesses on steep south faces: pushing a face vertex a
    little north or south (ground y) moves it on screen by the same small
    amount, so faces get real relief while staying on their tiles."""
    Hh, W = H.shape
    slope = np.zeros_like(H)
    slope[:-1] = (H[1:] - H[:-1]) * K
    steep = np.clip((-slope - 0.3) / 0.4, 0.0, 1.0)
    steep = _blur(steep, 1)
    seed = sum(ord(c) for c in m.id) + 101
    # Buttresses: relief varying mostly along the face (x), a little with height.
    cols = _fbm(W, 1, seed, (12, 5, 2)).reshape(1, W)
    n = cols * 0.8 + _fbm(W, Hh, seed + 1, (8, 3)) * 0.35
    return n * 0.24 * steep


def sample(H, x, y):
    """Bilinear height at map point (x, y)."""
    Hh, W = H.shape
    fx = min(max(x * K, 0.0), W - 1.001)
    fy = min(max(y * K, 0.0), Hh - 1.001)
    ix, iy = int(fx), int(fy)
    tx, ty = fx - ix, fy - iy
    a = H[iy, ix]
    b = H[iy, ix + 1]
    c = H[iy + 1, ix]
    d = H[iy + 1, ix + 1]
    return float(a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty)


def mesh(place, material, col):
    """The ground mesh: flat for flat places, else the sheared height field.
    Its UVs are map coordinates (u = x / w, v = 1 - y / h), which the ground
    material uses for its layer masks."""
    m = place.map
    H = place.heights
    step = K if H is not None else 4
    W, Hh = m.w * step + 1, m.h * step + 1
    relief = _relief(H, m) if H is not None else None
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    verts = []
    for j in range(Hh):
        row = []
        s = j / step
        for i in range(W):
            x = i / step
            h = float(H[j, i]) if H is not None else 0.0
            d = float(relief[j, i]) if relief is not None else 0.0
            row.append(bm.verts.new((x, -(s + h + d), h)))
        verts.append(row)
    for j in range(Hh - 1):
        for i in range(W - 1):
            f = bm.faces.new((verts[j][i], verts[j + 1][i], verts[j + 1][i + 1], verts[j][i + 1]))
            for loop, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                loop[uv].uv = (ii / (W - 1), 1.0 - jj / (Hh - 1))
    bm.normal_update()
    obj = common.mesh_object(f"ground-{m.id}", bm, material, col)
    if H is None:
        tex = bpy.data.textures.new("ground-disp", "CLOUDS")
        tex.noise_scale = 0.8
        common.add_modifier(obj, "DISPLACE", texture=tex, strength=0.025, mid_level=0.5)
    return obj


def water_surface(place, cells, z, material, col, margin=0.35):
    """A flat water surface at height z over `cells`, placed on the sheared
    view (so it shows over its tiles); it dips under the banks by itself."""
    xs = [c[0] for c in cells]
    ys = [c[1] for c in cells]
    x0, x1 = min(xs) - margin, max(xs) + 1 + margin
    y0, y1 = min(ys) - margin, max(ys) + 1 + margin
    bm = bmesh.new()
    nx = max(2, int((x1 - x0) * 2))
    ny = max(2, int((y1 - y0) * 2))
    grid = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            s = y0 + (y1 - y0) * j / ny
            row.append(bm.verts.new((x, -(s + z), z)))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
    # A thin water body below, so absorption tints what is seen through the surface.
    obj = common.mesh_object("water", bm, material, col, smooth=True)
    common.add_modifier(obj, "SOLIDIFY", thickness=0.6, offset=-1.0)
    return obj


_ = math
