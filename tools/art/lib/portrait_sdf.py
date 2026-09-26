"""Signed distance fields for sculpting heads in code, and turning them into
meshes.

A head is built the way a sculptor blocks one in: a skull, then the brow,
cheekbones, jaw, nose, lips and ears as soft masses that blend into each
other (smooth union), with sockets, nostrils and creases carved out (smooth
subtraction). Every shape is a function from points to signed distance
(negative inside), evaluated with numpy on whole arrays of points.

The field is sampled on a fine grid only near the surface (a coarse pass
finds where the surface is), meshed with OpenVDB, and each vertex is then
moved onto the exact surface and given the field's exact normal. So the
mesh is as smooth as the maths, not as coarse as the grid.

Units are centimetres while sculpting; `mesh()` converts to metres.
"""
import math
import os
from concurrent.futures import ThreadPoolExecutor

import numpy as np

F = np.float32


def _len(v):
    return np.sqrt(np.einsum("...i,...i->...", v, v))


def rot(yaw=0.0, pitch=0.0, roll=0.0):
    """A rotation matrix (degrees): yaw about Z, then pitch about X, then roll about Y.
    Rows are the local axes, so local = (p - c) @ R.T."""
    y, p, r = (math.radians(a) for a in (yaw, pitch, roll))
    Rz = np.array([[math.cos(y), -math.sin(y), 0], [math.sin(y), math.cos(y), 0], [0, 0, 1]])
    Rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
    Ry = np.array([[math.cos(r), 0, math.sin(r)], [0, 1, 0], [-math.sin(r), 0, math.cos(r)]])
    return (Rz @ Rx @ Ry).T.astype(F)


INF = F(1e3)


class Shape:
    """A field: call it with (N, 3) points to get (N,) distances.

    `bbox` is (lo, hi) outside which the shape is certainly more than
    MARGIN away, or None when unknown. Unions skip shapes whose box a point
    is not near, which is what keeps sculpting with hundreds of shapes fast.
    """

    bbox = None

    def __call__(self, p):
        raise NotImplementedError

    # Composition sugar.
    def __or__(self, other):
        return Union([self, other], 0.0)

    def blend(self, other, k):
        return Union([self, other], k)

    def carve(self, other, k):
        return Subtract(self, other, k)


class Fn(Shape):
    def __init__(self, fn, bbox=None):
        self.fn = fn
        if bbox is not None:
            self.bbox = (np.array(bbox[0], F), np.array(bbox[1], F))

    def __call__(self, p):
        return self.fn(p)


class Ellipsoid(Shape):
    def __init__(self, c, r, R=None):
        self.c = np.array(c, F)
        self.r = np.array(r, F)
        self.R = R
        m = float(self.r.max())
        self.bbox = (self.c - m, self.c + m)

    def __call__(self, p):
        q = p - self.c
        if self.R is not None:
            q = q @ self.R.T
        q0 = q / self.r
        k0 = _len(q0)
        k1 = _len(q0 / self.r)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)


class Sphere(Shape):
    def __init__(self, c, r):
        self.c = np.array(c, F)
        self.r = float(r)
        self.bbox = (self.c - self.r, self.c + self.r)

    def __call__(self, p):
        return _len(p - self.c) - self.r


class RoundCone(Shape):
    """A capsule whose radius tapers from r1 at a to r2 at b."""

    def __init__(self, a, b, r1, r2=None):
        self.a = np.array(a, F)
        self.b = np.array(b, F)
        self.r1 = float(r1)
        self.r2 = float(r1 if r2 is None else r2)
        m = max(self.r1, self.r2)
        self.bbox = (np.minimum(self.a, self.b) - m, np.maximum(self.a, self.b) + m)

    def __call__(self, p):
        a, b, r1, r2 = self.a, self.b, self.r1, self.r2
        ba = b - a
        l2 = float(ba @ ba)
        rr = r1 - r2
        a2 = l2 - rr * rr
        il2 = 1.0 / l2
        pa = p - a
        y = pa @ ba
        z = y - l2
        w = pa * l2 - y[:, None] * ba
        x2 = np.einsum("ij,ij->i", w, w)
        y2 = y * y * l2
        z2 = z * z * l2
        k = math.copysign(1.0, rr) * rr * rr * x2 if rr != 0 else np.zeros_like(x2)
        d_mid = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1
        d_b = np.sqrt(x2 + z2) * il2 - r2
        d_a = np.sqrt(x2 + y2) * il2 - r1
        out = np.where(np.sign(y) * a2 * y2 < k, d_a, d_mid)
        out = np.where(np.sign(z) * a2 * z2 > k, d_b, out)
        return out.astype(F)


class Chain(Shape):
    """Round cones through a list of (point, radius): a tube along a path."""

    def __init__(self, pts, k=0.0):
        self.u = Union([RoundCone(a, b, ra, rb) for (a, ra), (b, rb) in zip(pts, pts[1:])], k)
        self.bbox = self.u.bbox

    def __call__(self, p):
        return self.u(p)


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


# Points further than this from a shape's box are left to the other shapes.
MARGIN = 2.5


def _near(p, box, pad):
    lo, hi = box
    return np.all((p >= lo - pad) & (p <= hi + pad), axis=1)


def _merge(boxes):
    if any(b is None for b in boxes):
        return None
    return (np.min([b[0] for b in boxes], 0), np.max([b[1] for b in boxes], 0))


def _eval_near(s, p, pad, fill):
    """s(p) where p is near s's box; `fill` elsewhere."""
    if s.bbox is None:
        return s(p)
    m = _near(p, s.bbox, pad)
    out = np.full(len(p), fill, F)
    if m.any():
        out[m] = s(p[m])
    return out


class Union(Shape):
    def __init__(self, shapes, k=0.0):
        self.shapes = list(shapes)
        self.k = k
        self.bbox = _merge([s.bbox for s in self.shapes])

    def __call__(self, p):
        d = _eval_near(self.shapes[0], p, MARGIN + self.k, INF)
        for s in self.shapes[1:]:
            if s.bbox is None:
                d = smin(d, s(p), self.k)
                continue
            m = _near(p, s.bbox, MARGIN + self.k)
            if m.any():
                d[m] = smin(d[m], s(p[m]), self.k)
        return d


class Subtract(Shape):
    def __init__(self, a, b, k=0.0):
        self.a, self.b, self.k = a, b, k
        self.bbox = a.bbox

    def __call__(self, p):
        d = self.a(p)
        if self.b.bbox is None:
            return smax(d, -self.b(p), self.k)
        m = _near(p, self.b.bbox, MARGIN + self.k)
        if m.any():
            d[m] = smax(d[m], -self.b(p[m]), self.k)
        return d


class Intersect(Shape):
    def __init__(self, a, b, k=0.0):
        self.a, self.b, self.k = a, b, k
        self.bbox = a.bbox

    def __call__(self, p):
        return smax(self.a(p), self.b(p), self.k)


class Offset(Shape):
    """Grow (+) or shrink (−) a shape, by a constant or a field of the point."""

    def __init__(self, s, amount):
        self.s, self.amount = s, amount
        if s.bbox is not None:
            g = abs(amount) if not callable(amount) else 1.0
            self.bbox = (s.bbox[0] - g, s.bbox[1] + g)

    def __call__(self, p):
        a = self.amount(p) if callable(self.amount) else self.amount
        return self.s(p) - a


class Clip(Shape):
    """A shape cut off by an axis-aligned box (a hard-edged intersection)."""

    def __init__(self, s, lo, hi):
        self.s = s
        self.lo = np.array(lo, F)
        self.hi = np.array(hi, F)
        self.bbox = (self.lo, self.hi)

    def __call__(self, p):
        q = np.maximum(self.lo - p, p - self.hi)
        return np.maximum(self.s(p), q.max(axis=1))


def gaussian(p, c, r):
    """A soft bump in [0, 1]: 1 at c, falling off over radii r (per axis)."""
    q = (p - np.array(c, F)) / np.array(r, F)
    return np.exp(-np.einsum("ij,ij->i", q, q))


class FieldGrid:
    """A field sampled once on a regular grid, then read back (with its
    gradient) by trilinear interpolation: cheap enough to keep tens of
    thousands of hair strands off the skin at every step."""

    def __init__(self, shape, lo, hi, voxel, chunk=600_000):
        self.lo = np.array(lo, F)
        self.v = float(voxel)
        n = np.ceil((np.array(hi, F) - self.lo) / voxel).astype(int) + 1
        self.n = n
        ax = [self.lo[i] + np.arange(n[i], dtype=F) * voxel for i in range(3)]
        G = np.stack(np.meshgrid(*ax, indexing="ij"), -1).reshape(-1, 3)
        self.d = _eval(shape, G).reshape(n)
        self.g = np.stack(np.gradient(self.d, voxel), -1).astype(F)

    def _interp(self, arr, P):
        f = (P - self.lo) / self.v
        f = np.clip(f, 0, self.n - 1.001)
        i = np.floor(f).astype(int)
        t = (f - i).astype(F)
        out = 0
        for dx in (0, 1):
            wx = t[:, 0] if dx else 1 - t[:, 0]
            for dy in (0, 1):
                wy = t[:, 1] if dy else 1 - t[:, 1]
                for dz in (0, 1):
                    wz = t[:, 2] if dz else 1 - t[:, 2]
                    w = wx * wy * wz
                    v = arr[i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz]
                    out = out + (w[:, None] * v if v.ndim == 2 else w * v)
        return out

    def dist(self, P):
        return self._interp(self.d, P)

    def grad(self, P):
        g = self._interp(self.g, P)
        return g / np.maximum(_len(g), 1e-6)[:, None]

    def push_out(self, P, offset):
        """Move points that are closer than `offset` to the surface out to it."""
        d = self.dist(P)
        short = offset - d
        m = short > 0
        if m.any():
            P = P.copy()
            P[m] += self.grad(P[m]) * short[m][:, None]
        return P


class GridShape(Shape):
    """A sampled field used as a shape: an expensive field (the head) is
    evaluated once and then read cheaply by everything built on it (clothes,
    hair). Outside the grid, the distance to the grid's box is added."""

    def __init__(self, grid):
        self.grid = grid
        hi = grid.lo + (grid.n - 1) * grid.v
        self.bbox = (grid.lo, hi.astype(F))

    def __call__(self, p):
        lo, hi = self.bbox
        q = np.clip(p, lo, hi)
        out = np.sqrt(((p - q) ** 2).sum(1))
        return (self.grid.dist(q) + out).astype(F)


# ── Meshing ────────────────────────────────────────────────────────────────
def sample(shape, lo, hi, voxel, coarse=None, chunk=600_000):
    """Evaluate `shape` on a grid from lo to hi (cm) with the given voxel size.
    Only voxels near the surface are evaluated exactly; the rest take the
    sign of a coarse pass. Returns (grid, origin)."""
    lo = np.array(lo, F)
    hi = np.array(hi, F)
    coarse = coarse or voxel * 4
    f = int(round(coarse / voxel))
    coarse = voxel * f
    cn = np.ceil((hi - lo) / coarse).astype(int) + 1
    ax = [lo[i] + np.arange(cn[i], dtype=F) * coarse for i in range(3)]
    C = np.stack(np.meshgrid(*ax, indexing="ij"), -1).reshape(-1, 3)
    cd = _eval(shape, C).reshape(cn)
    # Fine grid: coarse values repeated, exact values in the band around the surface.
    n = (cn - 1) * f + 1
    fine = np.repeat(np.repeat(np.repeat(cd, f, 0), f, 1), f, 2)[: n[0], : n[1], : n[2]].astype(F)
    band = np.abs(cd) < coarse * 3.0
    bandf = np.repeat(np.repeat(np.repeat(band, f, 0), f, 1), f, 2)[: n[0], : n[1], : n[2]]
    # Offset by half a coarse cell so each coarse sample covers the fine cells around it.
    idx = np.nonzero(bandf)
    P = np.stack([lo[i] + (idx[i].astype(F) - f // 2) * voxel for i in range(3)], -1)
    fine[idx] = _eval(shape, P)
    # The unrepeated shift: fine index i is at lo + (i - f//2) * voxel.
    origin = lo - (f // 2) * voxel
    return fine, origin


THREADS = max(1, min(8, (os.cpu_count() or 2) - 2))


def _eval(shape, P, chunk=150_000):
    """shape(P) in chunks, on several threads (numpy releases the GIL for
    the array arithmetic that fields are made of)."""
    out = np.empty(len(P), F)
    starts = list(range(0, len(P), chunk))

    def one(i):
        out[i : i + chunk] = shape(P[i : i + chunk].astype(F))

    if len(starts) <= 1 or THREADS == 1:
        for i in starts:
            one(i)
    else:
        with ThreadPoolExecutor(THREADS) as pool:
            list(pool.map(one, starts))
    return out


def gradient(shape, P, h=0.01):
    """Central-difference gradient of the field at points P."""
    g = np.empty_like(P)
    for i in range(3):
        e = np.zeros(3, F)
        e[i] = h
        g[:, i] = (_eval(shape, P + e) - _eval(shape, P - e)) / (2 * h)
    return g


def polygonize(shape, lo, hi, voxel, project_steps=3):
    """Mesh the zero surface: (vertices (cm), quads, normals)."""
    import openvdb as vdb

    grid, origin = sample(shape, lo, hi, voxel)
    g = vdb.FloatGrid(background=float(voxel * 3))
    g.copyFromArray(grid)
    g.transform = vdb.createLinearTransform(voxelSize=float(voxel))
    pts, quads = g.convertToQuads(isovalue=0.0)
    V = (pts.astype(F) + origin).astype(F)
    # Move every vertex onto the exact surface (Newton steps along the
    # gradient), never more than a voxel and a half per step, and not where
    # the field has no usable gradient (at the edge of the sampled box).
    for _ in range(project_steps):
        d = _eval(shape, V)
        gr = gradient(shape, V, voxel * 0.25)
        gl2 = np.einsum("ij,ij->i", gr, gr)
        ok = (gl2 > 0.05) & (np.abs(d) < voxel * 3)
        delta = (d / np.maximum(gl2, 1e-8))[:, None] * gr
        dl = _len(delta)
        delta *= np.minimum(1.0, voxel * 1.5 / np.maximum(dl, 1e-9))[:, None]
        V = V - delta * ok[:, None]
    N = gradient(shape, V, voxel * 0.25)
    N /= np.maximum(_len(N), 1e-8)[:, None]
    return V, quads.astype(np.int64), N
