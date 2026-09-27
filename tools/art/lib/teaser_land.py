"""The Judean wilderness at landscape scale, for the teaser film.

The game's road down to Jericho is a 48 x 30 m map seen from above; a film
needs the country it runs through: rounded chalk hills cut by dry gullies,
a gorge with stepped limestone walls, and the road winding down along it,
fading into haze toward the Jordan valley.

`Land(seed)` builds a height field over 24 x 18 km at 16 m (numpy): broad
hills descending to the east, drainage carved by flow accumulation (so the
gullies branch like real ones), and a gorge cut along a meandering line.
`Land.height(x, y)` adds detail at any resolution (strata benches on steep
slopes, rock, the road's bed), so each shot builds its own mesh, fine near
the camera and coarse far away (`Land.mesh`), without seams.

Units: metres; x east, y north, z up (Blender axes).
"""
import heapq
import math
import os

import bmesh
import bpy
import numpy as np

import teaser_noise as N

X0, Y0, X1, Y1 = -8000.0, -9000.0, 16000.0, 9000.0
CELL = 16.0
FLOW_CELL = 32.0


class Land:
    def __init__(self, seed=7, cache=None):
        self.seed = seed
        # The cache is keyed by this file's own text: any change rebuilds it.
        import hashlib

        with open(__file__, "rb") as fh:
            key = hashlib.sha1(fh.read()).hexdigest()[:10]
        path = os.path.join(cache, f"land-{seed}-{key}.npz") if cache else None
        if path and os.path.exists(path):
            d = np.load(path)
            self.field, self.flow = d["field"], d["flow"]
        else:
            self.field, self.flow = self._build()
            if path:
                os.makedirs(cache, exist_ok=True)
                np.savez_compressed(path, field=self.field, flow=self.flow)
        gy, gx = np.gradient(self.field, CELL)
        self.slope_grid = np.hypot(gx, gy)
        self.road = None
        self.paths = []
        # Functions (x, y, h) -> h that shape the land for a set: a city's
        # ground levelled under its streets.
        self.pads = []
        # Functions (x, y, h) -> h applied last: marks pressed into the
        # ground of a set (footprints, drag marks).
        self.marks = []

    # ── the gorge ──────────────────────────────────────────────────────────
    def gorge_y(self, x):
        """The gorge's centre line (a function of x: it runs west to east)."""
        x = np.asarray(x, dtype=np.float64)
        wander = 420.0 * N.fbm(x / 2600.0, 0.37, 3, seed=self.seed + 30)
        bends = 110.0 * np.sin(x / 520.0 + 1.0 + 2.0 * N.perlin(x / 1500.0, 0.8, self.seed + 31)) + 45.0 * np.sin(x / 170.0 + 2.0)
        return wander + bends - 0.04 * x

    def gorge_bed(self, x):
        """The gorge floor's height: it falls faster than the land around it."""
        x = np.asarray(x, dtype=np.float64)
        return np.maximum(380.0 - 0.034 * (x + 8000.0) + 6.0 * np.sin(x / 300.0), -252.0)

    def far(self, x, y):
        """The far side of the valley: a long wall of mountains to the east,
        only ever seen through haze on the horizon."""
        x = np.asarray(x, dtype=np.float64)
        y = np.asarray(y, dtype=np.float64)
        rise = N.smoothstep(22000.0, 40000.0, x + 3000.0 * N.fbm(y / 9000.0, 1.7, 2, seed=self.seed + 42))
        if not rise.any():
            return np.zeros_like(x)
        crest = 620.0 + 420.0 * N.ridged(x / 4200.0, y / 4200.0, 5, seed=self.seed + 40) + 160.0 * N.fbm(y / 1800.0, x / 1800.0, 4, seed=self.seed + 41)
        return rise ** 1.6 * (crest + 240.0)

    def gorge_distance(self, x, y):
        x = np.asarray(x, dtype=np.float64)
        yc = self.gorge_y(x)
        dydx = (self.gorge_y(x + 2.0) - self.gorge_y(x - 2.0)) / 4.0
        return np.abs(np.asarray(y) - yc) / np.sqrt(1.0 + dydx * dydx)

    # The gorge's wall, from its floor outward: (run, rise) pairs; steep
    # pairs are cliffs of hard limestone, gentle ones talus and scree
    # between them, then the slope eases out onto the land above.
    WALL = [(3.0, 22.0), (38.0, 26.0), (4.0, 18.0), (34.0, 20.0), (3.5, 14.0), (60.0, 18.0)]

    def gorge_wall(self, d, x, y, fine=False):
        """Height of the gorge's walls above its floor at distance d: cliff
        bands of hard limestone over talus slopes, wandering along the gorge."""
        x = np.asarray(x, dtype=np.float64)
        y = np.asarray(y, dtype=np.float64)
        w0 = 9.0 + 5.0 * N.perlin(x / 400.0, 3.1, self.seed + 5)
        t = np.maximum(np.asarray(d) - w0, 0.0)
        # Each band's edge wanders along the gorge (spurs and bays).
        t = t + 7.0 * N.fbm(x / 160.0, y / 160.0, 3, seed=self.seed + 9)
        t = np.maximum(t, 0.0)
        h = np.zeros_like(t)
        start = 0.0
        for k, (run0, rise0) in enumerate(self.WALL):
            vary = N.fbm(x / 700.0, np.full_like(x, k * 3.7), 2, seed=self.seed + 50 + k)
            run = run0 * (1.0 + 0.45 * vary)
            rise = rise0 * (1.0 + 0.4 * N.fbm(x / 500.0, np.full_like(x, k * 5.1), 2, seed=self.seed + 60 + k))
            u = np.clip((t - start) / run, 0.0, 1.0)
            if run0 < 10.0:
                # A cliff: nearly sheer, rounded a little at its lip.
                u = u ** 0.8
            else:
                # Talus: concave, steepest under the cliff above.
                u = 1.0 - (1.0 - u) ** 1.4
            h = h + rise * u
            start += run
        return h + 0.25 * np.maximum(t - start, 0.0)

    # ── the field ──────────────────────────────────────────────────────────
    def _build(self):
        s = self.seed
        xs = np.arange(X0, X1 + CELL, CELL)
        ys = np.arange(Y0, Y1 + CELL, CELL)
        X, Y = np.meshgrid(xs, ys)
        # Broad descent to the east, and big rounded hills.
        wx = X + 700.0 * N.fbm(X / 3000.0, Y / 3000.0, 3, seed=s + 1)
        wy = Y + 700.0 * N.fbm(X / 3000.0 + 7.0, Y / 3000.0, 3, seed=s + 2)
        base = 470.0 - 0.03 * (X + 8000.0)
        hills = 300.0 * N.ridged(wx / 1400.0, wy / 1400.0, 5, seed=s + 3)
        roll = 80.0 * N.fbm(wx / 900.0, wy / 900.0, 4, seed=s + 4)
        spurs = 12.0 * N.fbm(wx / 520.0, wy / 520.0, 3, seed=s + 5)
        H = base + hills + roll + spurs
        # Flatten the far east into the Jordan valley's plain.
        plain = N.smoothstep(9000.0, 13000.0, X)
        H = H * (1 - plain) + (-240.0 + 6.0 * N.fbm(X / 800.0, Y / 800.0, 3, seed=s + 6)) * plain
        H = N.blur(H, 1)
        # Drainage: valleys where water gathers, branching like real ones;
        # then the finer gullies that feed them.
        H = self._erode(H)
        H, flow = self._carve(H, 1, 0.6, 10.0)
        # (The gorge is cut at sampling time, at full resolution: see height.)
        return H.astype(np.float32), flow.astype(np.float32)

    def _erode(self, H, iterations=90, k=2):
        """Stream-power erosion on a grid k cells coarser: each step every
        cell is cut down toward the cell it drains to, by K * sqrt(area) *
        slope, and hillslopes creep a little (diffusion). Valleys grow
        headward and branch; sharp spurs are left between them."""
        h, w = H.shape
        hh, ww = h - h % k, w - w % k
        C = H[:hh, :ww].reshape(hh // k, k, ww // k, k).mean(axis=(1, 3)).astype(np.float64)
        cell = CELL * k
        base = C.copy()
        for it in range(iterations):
            filled = _priority_flood(C)
            recv, dist = _receivers(filled, cell)
            area = _accumulate(filled) * cell * cell
            hr = filled.ravel()[recv].reshape(C.shape)
            slope = np.maximum(filled - hr, 0.0) / dist
            cut = 1.4e-3 * np.sqrt(area) * slope * cell
            cut = np.minimum(cut, np.maximum(filled - hr, 0.0) * 0.8)
            C = C - cut
            # Hillslope creep.
            C = C * 0.9 + N.blur(C, 1) * 0.1
        up = np.kron(C - base, np.ones((k, k)))
        full = np.zeros_like(H, dtype=np.float64)
        full[:hh, :ww] = up
        full[hh:, :] = full[hh - 1 : hh, :]
        full[:, ww:] = full[:, ww - 1 : ww]
        return H + N.blur(full, 1)

    def _carve(self, H, k, rate, most):
        """Carve gullies by flow accumulation on a grid k cells coarser
        (depth grows with the square root of the area drained)."""
        h, w = H.shape
        C = H[: h - h % k, : w - w % k].reshape(h // k, k, w // k, k).mean(axis=(1, 3))
        filled = _priority_flood(C)
        acc = _accumulate(filled)
        depth = np.minimum(most, rate * np.sqrt(acc) * (k * CELL / FLOW_CELL))
        depth = N.blur(depth, 1)
        up = np.kron(depth, np.ones((k, k)))
        full = np.zeros_like(H)
        full[: up.shape[0], : up.shape[1]] = up
        full[up.shape[0] :, :] = full[up.shape[0] - 1 : up.shape[0], :]
        full[:, up.shape[1] :] = full[:, up.shape[1] - 1 : up.shape[1]]
        full = N.blur(full, 1)
        flow = np.kron(np.log1p(acc), np.ones((k, k)))
        fl = np.zeros_like(H)
        fl[: flow.shape[0], : flow.shape[1]] = flow
        return H - full, N.blur(fl, 1)

    # ── sampling ───────────────────────────────────────────────────────────
    def coarse(self, x, y):
        return N.bilinear(self.field, X0, Y0, CELL, x, y)

    def slope(self, x, y):
        return N.bilinear(self.slope_grid, X0, Y0, CELL, x, y)

    def wetness(self, x, y):
        return N.bilinear(self.flow, X0, Y0, CELL, x, y)

    def height(self, x, y, detail=1.0):
        """Height at any points, with detail below the field's 16 m cells."""
        x = np.asarray(x, dtype=np.float64)
        y = np.asarray(y, dtype=np.float64)
        s = self.seed
        h = self.coarse(x, y)
        sl = self.slope(x, y)
        rock = N.smoothstep(0.35, 0.9, sl)
        hilly = N.smoothstep(0.04, 0.2, sl)
        # Eroded relief: sharp spurs and ridgelines between the gullies
        # (ridged noise), rough ground at every scale below that.
        h = h + detail * (
            16.0 * (N.ridged(x / 420.0, y / 420.0, 4, seed=s + 19) - 0.35) * (0.3 + 0.7 * hilly)
            + 5.0 * N.fbm(x / 140.0, y / 140.0, 3, seed=s + 20)
            + (1.0 + 2.4 * rock) * (N.ridged(x / 45.0, y / 45.0, 3, seed=s + 21) - 0.35)
            + (0.25 + 0.6 * rock) * N.fbm(x / 7.0, y / 7.0, 3, seed=s + 22)
        )
        h = h + self.far(x, y)
        # Beds of harder limestone crop out along the slopes as broken ledges:
        # a short steep riser (a metre or two) above a gentler slope, every
        # 8-14 m of height, only here and there (never a staircase).
        step = 10.0 + 3.5 * N.perlin(x / 1200.0, y / 1200.0, s + 29)
        warp = 1.6 * N.fbm(x / 80.0, y / 80.0, 2, seed=s + 23)
        k = (h + warp) / step
        f = k - np.floor(k)
        riser = 0.16
        g = np.where(f < riser, f / riser * 0.55, 0.55 + (f - riser) / (1 - riser) * 0.45)
        broken = N.smoothstep(0.05, 0.35, N.fbm(x / 55.0, y / 55.0, 3, seed=s + 33))
        ledge = (g - f) * step * broken * N.smoothstep(0.12, 0.4, sl) * (1.0 - 0.6 * N.smoothstep(1.2, 2.0, sl))
        h = h + ledge * 0.75 * detail
        # The gorge again, crisp at this resolution.
        d = self.gorge_distance(x, y)
        near = (d < 1500) & (x < 13000.0)
        if near.any():
            cut = self.gorge_bed(x[near]) + self.gorge_wall(d[near], x[near], y[near])
            h[near] = np.minimum(h[near], cut + detail * 0.6 * N.fbm(x[near] / 8.0, y[near] / 8.0, 3, seed=s + 24))
        for pad in self.pads:
            h = pad(x, y, h)
        if self.road is not None:
            h = self.road.carve(x, y, h)
        for path in self.paths:
            h = path.carve(x, y, h)
        # The dust of the ground itself: lumps, hollows and crust, a few
        # centimetres, seen only close up.
        h = h + detail * (0.035 * N.fbm(x / 0.7, y / 0.7, 3, seed=s + 70) + 0.012 * N.fbm(x / 0.16, y / 0.16, 2, seed=s + 71))
        for mark in self.marks:
            h = mark(x, y, h)
        return h

    # ── routes ─────────────────────────────────────────────────────────────
    def route(self, start, end, cell=48.0, slope_cost=60.0, avoid_gorge=45.0):
        """A least-cost route (Dijkstra on a coarse grid): gentle grades,
        keeping out of the gorge. Returns a smoothed polyline [(x, y)]."""
        xs = np.arange(X0, X1, cell)
        ys = np.arange(Y0, Y1, cell)
        X, Y = np.meshgrid(xs, ys)
        Z = self.coarse(X, Y)
        G = self.gorge_distance(X, Y)
        h, w = Z.shape
        pen = np.where(G < avoid_gorge, 1e5, 0.0)

        def idx(p):
            return int(round((p[1] - Y0) / cell)), int(round((p[0] - X0) / cell))

        si, sj = idx(start)
        ti, tj = idx(end)
        dist = np.full((h, w), np.inf)
        prev = -np.ones((h, w), dtype=np.int64)
        dist[si, sj] = 0.0
        heap = [(0.0, si, sj)]
        steps = [(di, dj) for di in (-1, 0, 1) for dj in (-1, 0, 1) if di or dj]
        Zl = Z.tolist()
        penl = pen.tolist()
        distl = dist.tolist()
        prevl = prev.tolist()
        while heap:
            d0, i, j = heapq.heappop(heap)
            if d0 > distl[i][j]:
                continue
            if i == ti and j == tj:
                break
            zi = Zl[i][j]
            for di, dj in steps:
                ni, nj = i + di, j + dj
                if ni < 0 or nj < 0 or ni >= h or nj >= w:
                    continue
                run = cell * (1.4142 if di and dj else 1.0)
                grade = abs(Zl[ni][nj] - zi) / run
                c = run * (1.0 + slope_cost * grade * grade) + penl[ni][nj]
                nd = d0 + c
                if nd < distl[ni][nj]:
                    distl[ni][nj] = nd
                    prevl[ni][nj] = i * w + j
                    heapq.heappush(heap, (nd, ni, nj))
        pts = []
        k = ti * w + tj
        while k >= 0:
            i, j = divmod(k, w)
            pts.append((float(xs[j]), float(ys[i])))
            k = prevl[i][j]
        pts.reverse()
        return smooth_polyline(pts, 4)


def smooth_polyline(pts, rounds):
    """Chaikin corner cutting, keeping the ends."""
    p = np.array(pts, dtype=np.float64)
    for _ in range(rounds):
        q = 0.75 * p[:-1] + 0.25 * p[1:]
        r = 0.25 * p[:-1] + 0.75 * p[1:]
        mid = np.empty((len(q) * 2, 2))
        mid[0::2] = q
        mid[1::2] = r
        p = np.vstack([p[:1], mid, p[-1:]])
    return p


def resample(poly, spacing):
    seg = np.linalg.norm(np.diff(poly, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    n = max(2, int(s[-1] / spacing) + 1)
    t = np.linspace(0.0, s[-1], n)
    return np.stack([np.interp(t, s, poly[:, 0]), np.interp(t, s, poly[:, 1])], axis=1), t


class Track:
    """A road or path laid into the land: a bed that follows the ground,
    smoothed so it never climbs or drops too sharply, cut and filled to it
    across `width`, easing out over `shoulder`."""

    def __init__(self, land, poly, width=3.2, shoulder=5.0, spacing=2.0, smooth=40.0, sink=0.05):
        self.poly, self.s = resample(np.asarray(poly, dtype=np.float64), spacing)
        z = land.height(self.poly[:, 0], self.poly[:, 1]) if land is not None else np.zeros(len(self.poly))
        r = max(1, int(smooth / spacing))
        self.z = N.blur(z[None, :], r)[0] - sink
        self.width = width
        self.shoulder = shoulder
        self.lo = self.poly.min(axis=0) - (width + shoulder + 5)
        self.hi = self.poly.max(axis=0) + (width + shoulder + 5)

    def nearest(self, x, y):
        """(distance, bed height, arc length) of the nearest point on the track."""
        x = np.asarray(x, dtype=np.float64).ravel()
        y = np.asarray(y, dtype=np.float64).ravel()
        best = np.full(x.shape, np.inf)
        bz = np.zeros(x.shape)
        bs = np.zeros(x.shape)
        inside = (x > self.lo[0]) & (x < self.hi[0]) & (y > self.lo[1]) & (y < self.hi[1])
        if not inside.any():
            return best, bz, bs
        where = np.nonzero(inside)[0]
        xi, yi = x[where], y[where]
        bi = np.full(xi.shape, np.inf)
        zi = np.zeros(xi.shape)
        si = np.zeros(xi.shape)
        P = self.poly
        reach = self.width + self.shoulder + 4
        # Segments in chunks: only points near a chunk's box are measured.
        chunk = 24
        for c0 in range(0, len(P) - 1, chunk):
            c1 = min(len(P) - 1, c0 + chunk)
            box0 = P[c0 : c1 + 1].min(axis=0) - reach
            box1 = P[c0 : c1 + 1].max(axis=0) + reach
            sel = np.nonzero((xi > box0[0]) & (xi < box1[0]) & (yi > box0[1]) & (yi < box1[1]))[0]
            if len(sel) == 0:
                continue
            xs, ys = xi[sel], yi[sel]
            for k in range(c0, c1):
                ax, ay = P[k]
                bx, by = P[k + 1]
                dx, dy = bx - ax, by - ay
                L2 = dx * dx + dy * dy + 1e-9
                t = np.clip(((xs - ax) * dx + (ys - ay) * dy) / L2, 0.0, 1.0)
                d = np.hypot(xs - (ax + t * dx), ys - (ay + t * dy))
                better = d < bi[sel]
                if better.any():
                    idx = sel[better]
                    bi[idx] = d[better]
                    zi[idx] = self.z[k] + (self.z[k + 1] - self.z[k]) * t[better]
                    si[idx] = self.s[k] + (self.s[k + 1] - self.s[k]) * t[better]
        best[where] = bi
        bz[where] = zi
        bs[where] = si
        return best, bz, bs

    def carve(self, x, y, h):
        shape = np.shape(h)
        d, z, _ = self.nearest(x, y)
        hf = np.asarray(h, dtype=np.float64).ravel().copy()
        w = 1.0 - N.smoothstep(self.width * 0.5, self.width * 0.5 + self.shoulder, d)
        hf = hf + (z - hf) * w
        return hf.reshape(shape)

    def mask(self, x, y):
        d, _, _ = self.nearest(x, y)
        return 1.0 - N.smoothstep(self.width * 0.35, self.width * 0.62, d)

    def point(self, s):
        """(x, y) at arc length s."""
        return np.array([np.interp(s, self.s, self.poly[:, 0]), np.interp(s, self.s, self.poly[:, 1])])


def _priority_flood(Z):
    """Fill pits so every cell drains to the edge (priority flood, epsilon)."""
    h, w = Z.shape
    Zl = Z.tolist()
    done = [[False] * w for _ in range(h)]
    heap = []
    for i in range(h):
        for j in (0, w - 1):
            heapq.heappush(heap, (Zl[i][j], i, j))
            done[i][j] = True
    for j in range(1, w - 1):
        for i in (0, h - 1):
            heapq.heappush(heap, (Zl[i][j], i, j))
            done[i][j] = True
    while heap:
        z, i, j = heapq.heappop(heap)
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ni, nj = i + di, j + dj
            if 0 <= ni < h and 0 <= nj < w and not done[ni][nj]:
                done[ni][nj] = True
                if Zl[ni][nj] <= z:
                    Zl[ni][nj] = z + 1e-3
                heapq.heappush(heap, (Zl[ni][nj], ni, nj))
    return np.array(Zl)


def _receivers(Z, cell):
    """Each cell's steepest-descent neighbour (flat index) and the distance to it."""
    h, w = Z.shape
    best = np.zeros((h, w))
    recv = np.arange(h * w).reshape(h, w)
    dist = np.full((h, w), cell)
    ii, jj = np.mgrid[0:h, 0:w]
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            if not (di or dj):
                continue
            ni = np.clip(ii + di, 0, h - 1)
            nj = np.clip(jj + dj, 0, w - 1)
            L = cell * (1.4142 if di and dj else 1.0)
            drop = (Z - Z[ni, nj]) / L
            better = drop > best
            best = np.where(better, drop, best)
            recv = np.where(better, ni * w + nj, recv)
            dist = np.where(better, L, dist)
    return recv.ravel(), dist


def _accumulate(Z):
    """D8 flow accumulation (cells draining through each cell)."""
    h, w = Z.shape
    best = np.zeros((h, w))
    recv = np.arange(h * w).reshape(h, w)
    ii, jj = np.mgrid[0:h, 0:w]
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            if not (di or dj):
                continue
            ni = np.clip(ii + di, 0, h - 1)
            nj = np.clip(jj + dj, 0, w - 1)
            drop = (Z - Z[ni, nj]) / (1.4142 if di and dj else 1.0)
            better = drop > best
            best = np.where(better, drop, best)
            recv = np.where(better, ni * w + nj, recv)
    order = np.argsort(-Z.ravel(), kind="stable").tolist()
    acc = [1.0] * (h * w)
    rv = recv.ravel().tolist()
    for k in order:
        r = rv[k]
        if r != k:
            acc[r] += acc[k]
    return np.array(acc).reshape(h, w)


# ── meshes ──────────────────────────────────────────────────────────────────
def polar_grid(cx, cy, r0, r1, heading, fov, n_theta, back=0.0):
    """Points of a polar grid round (cx, cy): rings from r0 to r1 spaced so
    cells are about square, over the sector `heading` +- fov/2 (radians,
    0 = east, counter-clockwise), plus `back` metres of full circle near the
    centre (for a camera that turns). Returns (X, Y) arrays (rings, spokes)."""
    dtheta = fov / (n_theta - 1)
    # Cells about square near the centre; further out they may stretch
    # radially (seen at a grazing angle, radial spacing shrinks on screen).
    radii = [0.0, r0]
    r = r0
    while r < r1:
        stretch = 1.0 + 1.0 * min(1.0, max(0.0, (r - 150.0) / 400.0))
        r = r * (1.0 + dtheta * stretch)
        radii.append(r)
    radii = np.array(radii)
    theta = heading - fov / 2 + dtheta * np.arange(n_theta)
    R, T = np.meshgrid(radii, theta, indexing="ij")
    return cx + R * np.cos(T), cy + R * np.sin(T)


def grid_mesh(name, X, Y, Z, attrs, material, collection=None):
    """A mesh from a structured grid of points (rows x cols) with float
    attributes per point (for the shader)."""
    rows, cols = X.shape
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1).astype(np.float32)
    i = np.arange(rows - 1)[:, None] * cols + np.arange(cols - 1)[None, :]
    quads = np.stack([i, i + cols, i + cols + 1, i + 1], axis=-1).reshape(-1, 4)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.ravel())
    me.loops.add(len(quads) * 4)
    me.loops.foreach_set("vertex_index", quads.ravel().astype(np.int32))
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", (np.arange(len(quads)) * 4).astype(np.int32))
    me.polygons.foreach_set("loop_total", np.full(len(quads), 4, dtype=np.int32))
    me.update(calc_edges=True)
    me.validate(clean_customdata=False)
    me.polygons.foreach_set("use_smooth", np.ones(len(me.polygons), dtype=bool))
    for key, values in attrs.items():
        a = me.attributes.new(key, "FLOAT", "POINT")
        a.data.foreach_set("value", np.asarray(values, dtype=np.float32).ravel())
    if material is not None:
        me.materials.append(material)
    obj = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def land_mesh(land, name, cx, cy, heading, fov, r0=0.5, r1=24000.0, n_theta=900, material=None, detail=1.0, extra=None):
    """The land seen from round (cx, cy): fine near, coarse far."""
    X, Y = polar_grid(cx, cy, r0, r1, heading, fov, n_theta)
    Z = land.height(X, Y, detail)
    attrs = land_attributes(land, X, Y, Z, grid_slope(X, Y, Z))
    if extra:
        attrs.update(extra(X, Y, Z))
    return grid_mesh(name, X, Y, Z, attrs, material)


def grid_slope(X, Y, Z):
    """Slope (rise over run) of a structured grid of points, from its own heights."""
    def d(axis):
        dz = np.gradient(Z, axis=axis)
        dx = np.gradient(X, axis=axis)
        dy = np.gradient(Y, axis=axis)
        return dz, np.hypot(dx, dy) + 1e-6

    dz0, l0 = d(0)
    dz1, l1 = d(1)
    return np.hypot(dz0 / l0, dz1 / l1)


def land_attributes(land, X, Y, Z, slope=None):
    sl = land.slope(X, Y) if slope is None else slope
    wet = land.wetness(X, Y)
    gd = land.gorge_distance(X, Y)
    road = land.road.mask(X, Y).reshape(X.shape) if land.road is not None else np.zeros_like(X)
    path = np.zeros_like(X)
    for p in land.paths:
        path = np.maximum(path, p.mask(X, Y).reshape(X.shape))
    return {
        "slope": np.clip(sl, 0.0, 3.0),
        "wet": np.clip((wet - 3.0) / 6.0, 0.0, 1.0),
        "gorge": np.clip(1.0 - gd / 60.0, 0.0, 1.0),
        "road": road,
        "path": path,
    }
