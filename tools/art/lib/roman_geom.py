"""Geometry helpers and shared materials for the Roman kit (kit_roman.py)."""
import math

import bmesh
from mathutils import Vector

import common
import materials as M
import roman_materials as R


def B(x, y, z=0.0):
    """Game tile coordinates to Blender, on flat ground."""
    return Vector((x, -y, z))


def Q(x, y, h):
    """A point at height h that should show over its own tile (x, y), as
    the terrain does (sheared: see terrain.py)."""
    return Vector((x, -(y + h), h))


def clip_half(poly, nx, ny, mx, my):
    """Sutherland-Hodgman: keep the part of a polygon where
    (p - m) . n <= 0."""
    out = []
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        da = (ax - mx) * nx + (ay - my) * ny
        db = (bx - mx) * nx + (by - my) * ny
        if da <= 0:
            out.append((ax, ay))
        if (da < 0 < db) or (db < 0 < da):
            t = da / (da - db)
            out.append((ax + (bx - ax) * t, ay + (by - ay) * t))
    return out


def voronoi(points, bbox, reach):
    """Voronoi cells of 2D points, clipped to bbox (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = bbox
    grid = {}
    for i, (px, py) in enumerate(points):
        grid.setdefault((int(px // reach), int(py // reach)), []).append(i)
    cells = []
    for i, (px, py) in enumerate(points):
        poly = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        gx, gy = int(px // reach), int(py // reach)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for j in grid.get((gx + dx, gy + dy), []):
                    if j == i or len(poly) < 3:
                        continue
                    qx, qy = points[j]
                    poly = clip_half(poly, qx - px, qy - py, (px + qx) / 2, (py + qy) / 2)
        cells.append(poly)
    return cells


def inset(poly, d):
    """Shrink a convex polygon by about d (toward its centroid)."""
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    out = []
    for x, y in poly:
        vx, vy = cx - x, cy - y
        L = math.hypot(vx, vy) or 1.0
        k = min(0.45, d * 1.25 / L)
        out.append((x + vx * k, y + vy * k))
    return out, (cx, cy)


def wall_pieces(x0, x1, z0, z1, openings):
    """Rectangles covering the wall [x0, x1] x [z0, z1] around `openings`
    [(ox0, ox1, oz0, oz1)]."""
    xs = sorted({x0, x1} | {min(max(o[0], x0), x1) for o in openings} | {min(max(o[1], x0), x1) for o in openings})
    out = []
    for a, b in zip(xs, xs[1:]):
        if b - a < 1e-4:
            continue
        cuts = sorted((o[2], o[3]) for o in openings if o[0] < b - 1e-6 and o[1] > a + 1e-6)
        z = z0
        for c0, c1 in cuts:
            if c0 > z + 1e-4:
                out.append((a, b, z, c0))
            z = max(z, c1)
        if z < z1 - 1e-4:
            out.append((a, b, z, z1))
    return out


class RomanGeometry:
    def _mat(self, key):
        """The kit's shared materials, made once per place."""
        cache = self.__dict__.setdefault("_roman_mats", {})
        if key in cache:
            return cache[key]
        make = {
            "stucco": lambda: R.stucco("#e0d4ba", "stucco-cream"),
            "stucco-ochre": lambda: R.stucco("#d8b684", "stucco-ochre", dado="#8a3424"),
            "stucco-white": lambda: R.stucco("#e6e0d0", "stucco-white", dado="#3a3632", dado_h=1.0),
            "stucco-rose": lambda: R.stucco("#dcbaa4", "stucco-rose", dado="#6a2a22"),
            "stucco-grey": lambda: R.stucco("#d6d0c2", "stucco-grey", flaked=0.4),
            "stucco-farm": lambda: R.stucco("#cfc2a4", "stucco-farm", flaked=0.55, streaks=0.5),
            "cornice": lambda: R.stucco("#ece6d8", "stucco-cornice", flaked=0.1, streaks=0.5),
            "ashlar": lambda: R.ashlar("#cdc1a2", "ashlar-lycus"),
            "rubble": lambda: M.rock("#a39a86", "rubble-stone", lichen=0.35),
            "roof": lambda: R.roof_tile("#a8573a"),
            "marble": lambda: R.marble("#d8d1c2", "marble-white"),
            "marble-grey": lambda: R.marble("#b9b4a9", "marble-grey", veins="#8e8a80"),
            "bronze": lambda: R.bronze(),
            "timber": lambda: M.wood("#5a4130", 5.0),
            "door": lambda: M.wood("#6a4a30", 9.0),
            "dark": lambda: M.plain("#1a1410", 0.9, 0.1),
            "iron": lambda: M.plain("#2e2a26", 0.5, 0.5),
            "clay": lambda: M.terracotta("#b06a44", 0.3),
            "paver": lambda: R.paver("#b3aa97", "street-paver"),
            "paver-wet": lambda: R.paver("#98948a", "road-paver-wet", wet=1.0),
            "kerb-wet": lambda: R.paver("#a8a294", "kerb-wet", wet=0.8),
            "water": lambda: R.puddle(),
            "rope": lambda: M.plain("#8a7550", 0.9),
            "leaf": lambda: M.leaf("#3f5a2c", "#8a9a6a"),
            "leaf-dark": lambda: M.leaf("#2e4424", "#6a7a58"),
            "soil": lambda: M.plain("#4a3a2a", 0.95, 0.1),
        }[key]
        cache[key] = make()
        return cache[key]

    def _cbox(self, bm, layer, x0, y0, x1, y1, z0, z1, chamfer=0.015, r=None, point=None):
        """A box with its top edges chamfered, into `bm`: ground rectangle
        (x0, y0)-(x1, y1) in map tiles, from height z0 to z1. `point` maps
        (x, y, z) to Blender (default: on the terrain, self.P)."""
        pt = point or self.P
        c = max(0.0, min(chamfer, (x1 - x0) * 0.3, (y1 - y0) * 0.3, (z1 - z0) * 0.45))
        bot = [bm.verts.new(pt(x, y, z0)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
        mid = [bm.verts.new(pt(x, y, z1 - c)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
        top = [bm.verts.new(pt(x, y, z1)) for x, y in ((x0 + c, y0 + c), (x1 - c, y0 + c), (x1 - c, y1 - c), (x0 + c, y1 - c))]
        faces = [bm.faces.new(top[::-1]), bm.faces.new(bot)]
        for i in range(4):
            j = (i + 1) % 4
            faces.append(bm.faces.new((bot[i], mid[i], mid[j], bot[j])))
            faces.append(bm.faces.new((mid[i], top[i], top[j], mid[j])))
        if layer is not None:
            rv = self.rng.random() if r is None else r
            for f in faces:
                f[layer] = rv
        return faces

    def _prism(self, bm, layer, poly, ztop, depth, chamfer, r, dome=0.0, point=None):
        """A stone whose top is the convex polygon `poly` (map x, y): a
        chamfered, slightly domed prism reaching `depth` below its top.
        `ztop(x, y)` gives the height of the top at a point."""
        pt = point or self.P
        ins, (cx, cy) = inset(poly, chamfer)
        edge = [bm.verts.new(pt(x, y, ztop(x, y) - chamfer * 0.7)) for x, y in poly]
        top = [bm.verts.new(pt(x, y, ztop(x, y))) for x, y in ins]
        mid = [(cx + (x - cx) * 0.55, cy + (y - cy) * 0.55) for x, y in ins]
        inner = [bm.verts.new(pt(x, y, ztop(x, y) + dome * 0.7)) for x, y in mid]
        centre = bm.verts.new(pt(cx, cy, ztop(cx, cy) + dome))
        low = [bm.verts.new(pt(x, y, ztop(x, y) - depth)) for x, y in poly]
        n = len(poly)
        # Orientation: map y runs south (Blender -y), so a polygon with a
        # positive signed area in map coordinates runs clockwise seen from
        # above in Blender; the faces below are wound for that, else flipped.
        area = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))
        flip = area < 0
        faces = []

        def face(vs):
            f = bm.faces.new(vs[::-1] if flip else vs)
            faces.append(f)

        for i in range(n):
            j = (i + 1) % n
            face((centre, inner[j], inner[i]))
            face((inner[i], inner[j], top[j], top[i]))
            face((top[i], top[j], edge[j], edge[i]))
            face((edge[i], edge[j], low[j], low[i]))
        for f in faces:
            if layer is not None:
                f[layer] = r
            f.smooth = True
        return faces

    def _tube(self, bm, pts, radius, seg=8):
        """A tube through points (Blender), radius per point (or constant)."""
        rings = []
        for i, p in enumerate(pts):
            a = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
            if a.length < 1e-9:
                a = Vector((0, 0, 1))
            a = a.normalized()
            side = a.orthogonal().normalized()
            up = a.cross(side).normalized()
            r = radius[i] if isinstance(radius, (list, tuple)) else radius
            rings.append([bm.verts.new(p + (side * math.cos(math.tau * k / seg) + up * math.sin(math.tau * k / seg)) * r) for k in range(seg)])
        for a, b in zip(rings, rings[1:]):
            for k in range(seg):
                kk = (k + 1) % seg
                bm.faces.new((a[k], a[kk], b[kk], b[k]))
        return rings

    def _obj(self, name, bm, mat, smooth=False):
        return common.mesh_object(name, bm, mat, None, smooth=smooth)

    def _rbm(self):
        bm = bmesh.new()
        return bm, bm.faces.layers.float.new("rand")
