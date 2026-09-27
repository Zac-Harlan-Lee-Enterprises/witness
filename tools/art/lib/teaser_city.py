"""Jerusalem for the teaser: packed stone houses with flat roofs, the city
wall and its east gate, and the lower market on the street inside the gate.

The game's market (jerusalem-market) is a square of stalls inside the east
gate; the film shows the city around it: streets of one- and two-storey
houses of limestone and lime plaster, flat roofs with parapets, upper rooms,
outside stairs, jars, mats and firewood on the roofs, olive trees, palms
and cypresses in the courtyards. Houses are merged into a few meshes (a
random value per face varies their stone), so a whole quarter costs little.

Coordinates: metres, x east, y north; the gate at `gate` faces east.
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import teaser_noise as N
from teaser_nodes import Graph

STOREY = 3.3


# ── materials ────────────────────────────────────────────────────────────────
def _brick(g, pos, n, scale, mortar, row_h=0.42):
    """Coursed ashlar on vertical faces: brick texture projected along the
    face's own axis (x-facing faces use y, y-facing use x)."""
    x, y, z = g.xyz(pos)
    ax = g.math("ABSOLUTE", g.xyz(n)[0])
    u = g.mixf(g.map(ax, 0.45, 0.55), x, y)
    uv = g.vec(u, z, 0.0)
    b = g.node("ShaderNodeTexBrick", {"Vector": uv, "Scale": 1.0, "Mortar Size": mortar, "Mortar Smooth": 0.3, "Bias": 0.0, "Brick Width": 0.9 * scale, "Row Height": row_h * scale, "Color1": (1, 1, 1, 1), "Color2": (0.7, 0.7, 0.7, 1), "Mortar": (0, 0, 0, 1)}, offset=0.5, squash=1.0)
    return b.outputs["Fac"], b.outputs["Color"]


def stone_walls(name="city-walls", light="#d6c7a6", dark="#b09c7c", plaster="#e3d8c2"):
    """House walls: limestone blocks, some houses lime-washed (face attribute
    'rand' picks), weathered darker toward the ground and streaked."""

    def build():
        g = Graph(name)
        pos = g.position()
        n = g.normal()
        rnd = g.attr("rand")
        mortar, bcol = _brick(g, pos, n, 1.0, 0.03)
        blk = g.mix(g.map(g.noise(pos, 1.3, 2.0), 0.3, 0.7), dark, light)
        blk = g.mix(g.mul(g.sub(1.0, g.xyz(bcol)[0]), 0.9), blk, "#a8987a")
        stone = g.mix(mortar, blk, "#8f8068")
        washed = g.map(rnd, 0.62, 0.64)
        col = g.mix(washed, stone, g.mix(g.map(g.noise(pos, 0.8, 3.0), 0.3, 0.7), plaster, "#d3c6ab"))
        _, _, z = g.xyz(pos)
        base = g.attr("zbase")
        low = g.map(g.sub(z, base), 0.0, 1.2, 1.0, 0.0)
        col = g.mix(g.mul(low, 0.35), col, "#8a7a62")
        streak = g.noise(g.vmath("MULTIPLY", pos, (2.0, 2.0, 0.25)), 1.0, 3.0, 0.6)
        col = g.mix(g.mul(g.smooth(streak, 0.55, 0.75), 0.25), col, "#7e725f", "MULTIPLY")
        col = g.mix(g.mul(g.sub(rnd, 0.5), 0.3), col, "#c9b690")
        # Doors and windows are faces marked rand = -1: deep shade.
        opening = g.math("LESS_THAN", rnd, -0.5)
        col = g.mix(opening, col, "#17110c")
        h = g.add(g.mul(g.sub(1.0, mortar), 0.6), g.mul(g.noise(pos, 9.0, 4.0), 0.3))
        g.principled(col, 0.9, g.map(opening, 0.0, 1.0, 0.2, 0.0), g.bump(h, 0.4, 0.02))
        return g.mat

    return _cached(name, build)


def roofs(name="city-roofs"):
    """Flat roofs of rolled earth and lime plaster: pale, patched, darker
    where water stood."""

    def build():
        g = Graph(name)
        pos = g.position()
        rnd = g.attr("rand")
        big = g.noise(pos, 0.25, 3.0, 0.5)
        col = g.mix(g.map(big, 0.35, 0.65), "#c9b99b", "#ddd0b6")
        col = g.mix(g.mul(g.smooth(g.noise(pos, 0.9, 4.0), 0.6, 0.72), 0.5), col, "#a8977a")
        col = g.mix(g.mul(rnd, 0.3), col, "#bfae8e")
        h = g.add(g.noise(pos, 4.0, 5.0, 0.6), g.mul(g.noise(pos, 30.0, 3.0), 0.3))
        g.principled(col, 0.93, 0.15, g.bump(h, 0.25, 0.02))
        return g.mat

    return _cached(name, build)


def paving(name="city-paving"):
    """The city's ground: packed earth and dust in the lanes, big worn paving
    slabs (joints full of dust) where the point attribute 'paved' says."""

    def build():
        g = Graph(name)
        pos = g.position()
        x, y, _ = g.xyz(pos)
        paved = g.smooth(g.add(g.attr("paved"), g.mul(g.sub(g.noise(pos, 0.5, 2.0), 0.5), 0.6)), 0.45, 0.6)
        b = g.node("ShaderNodeTexBrick", {"Vector": g.vec(x, y, 0.0), "Scale": 1.0, "Mortar Size": 0.035, "Mortar Smooth": 0.6, "Brick Width": 1.3, "Row Height": 0.85, "Color1": (1, 1, 1, 1), "Color2": (0.75, 0.75, 0.75, 1)}, offset=0.37, squash=1.0)
        joint = g.mul(b.outputs["Fac"], paved)
        slab = g.xyz(b.outputs["Color"])[0]
        col = g.mix(g.map(slab, 0.75, 1.0), "#b7a584", "#cdbd9c")
        col = g.mix(g.map(g.noise(pos, 2.0, 4.0), 0.4, 0.7, 0.0, 0.5), col, "#a39170")
        col = g.mix(joint, col, "#8a7a60")
        earth = g.mix(g.map(g.noise(pos, 0.7, 4.0), 0.35, 0.65), "#a8906c", "#bca581")
        stones = g.map(g.voronoi(pos, 22.0), 0.0, 0.25, 1.0, 0.0)
        earth = g.mix(g.mul(stones, 0.4), earth, "#7c6a52")
        col = g.mix(paved, earth, col)
        dust = g.smooth(g.noise(pos, 0.3, 3.0), 0.5, 0.65, 0.0, 0.6)
        col = g.mix(g.mul(dust, paved), col, "#c8b48f")
        wear = g.noise(pos, 12.0, 3.0)
        h = g.add(g.mul(g.sub(1.0, joint), paved), g.add(g.mul(wear, 0.15), g.mul(stones, g.sub(1.0, paved))))
        g.principled(col, g.map(joint, 0.0, 1.0, 0.75, 0.95), 0.2, g.bump(h, 0.5, 0.015))
        return g.mat

    return _cached(name, build)


def plain(name, color, rough=0.8):
    def build():
        g = Graph(name)
        g.principled(color, rough, 0.2)
        return g.mat

    return _cached(name, build)


def wood(name="city-wood", color="#6d5236"):
    def build():
        g = Graph(name)
        pos = g.coords("Object")
        grain = g.wave(g.vmath("MULTIPLY", pos, (1.0, 1.0, 0.1)), 6.0, 4.0, 3.0, "BANDS", "X")
        col = g.mix(g.map(grain, 0.2, 0.8), "#4d3924", color)
        g.principled(col, 0.75, 0.25, g.bump(grain, 0.2, 0.01))
        return g.mat

    return _cached(name, build)


def awning(name, a="#d9cdb1", b="#8b4f3a"):
    """Woven cloth with woven stripes, lit through (a little translucent)."""

    def build():
        g = Graph(name)
        uv = g.uv()
        u, v, _ = g.xyz(uv)
        stripes = g.math("GREATER_THAN", g.math("FRACT", g.mul(u, 6.0)), 0.62)
        col = g.mix(stripes, a, b)
        weave = g.noise(g.coords("Object"), 120.0, 2.0)
        col = g.mix(g.mul(weave, 0.12), col, "#6f604a", "MULTIPLY")
        g.principled(col, 0.9, 0.3, None, **{"Transmission Weight": 0.0, "Subsurface Weight": 0.15, "Subsurface Radius": (0.3, 0.2, 0.1), "Subsurface Scale": 0.02})
        return g.mat

    return _cached(name, build)


_mats = {}


def _cached(name, build):
    m = _mats.get(name)
    try:
        if m is not None and m.name:
            return m
    except ReferenceError:
        pass
    _mats[name] = build()
    return _mats[name]


# ── mesh helpers ─────────────────────────────────────────────────────────────
class Builder:
    """Collects boxes into one mesh, with a random value and base height per face."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.rand = self.bm.faces.layers.float.new("rand")
        self.zbase = self.bm.faces.layers.float.new("zbase")

    def box(self, x0, y0, z0, x1, y1, z1, r=0.5, zb=None, skip_bottom=True):
        bm = self.bm
        v = [bm.verts.new((x, y, z)) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
        faces = [(4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        if not skip_bottom:
            faces.append((0, 2, 3, 1))
        for f in faces:
            face = bm.faces.new([v[i] for i in f])
            face[self.rand] = r
            face[self.zbase] = z0 if zb is None else zb

    def quad(self, pts, r=0.5, zb=0.0):
        face = self.bm.faces.new([self.bm.verts.new(p) for p in pts])
        face[self.rand] = r
        face[self.zbase] = zb

    def finish(self, material, collection=None, smooth=False):
        me = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        # Face layers become attributes; copy them to point-free FACE attributes the shader reads.
        self.bm.free()
        obj = bpy.data.objects.new(self.name, me)
        (collection or bpy.context.scene.collection).objects.link(obj)
        me.materials.append(material)
        for p in me.polygons:
            p.use_smooth = smooth
        return obj


# ── the city ─────────────────────────────────────────────────────────────────
class City:
    """Jerusalem west of its east gate at (gx, gy), standing at ground height gz."""

    def __init__(self, gate, gz, seed=3, depth=420.0, half_width=330.0, detail=True):
        self.gx, self.gy = gate
        self.gz = gz
        self.seed = seed
        self.rng = random.Random(seed)
        self.depth = depth
        self.half = half_width
        self.detail = detail
        self.objects = []
        # The main street runs west from the gate; the market is its first stretch.
        self.street_w = 9.0
        self.market = (self.gx - 150.0, self.gx - 12.0)

    def ground(self, x, y):
        """The city's ground: rising gently to the west (away from the gate)."""
        return self.gz + 0.02 * (self.gx - np.asarray(x)) + 0.4 * N.fbm(np.asarray(x) / 90.0, np.asarray(y) / 90.0, 2, seed=91)

    def z(self, x, y):
        return float(self.ground(np.array([x]), np.array([y]))[0])

    def build(self):
        # The same city every time it is built (each shot builds its own).
        self.rng = random.Random(self.seed)
        self.objects = []
        walls = Builder("city-houses")
        tops = Builder("city-roofs")
        streets = self._streets()
        lots = self._lots(streets)
        self.lots = lots
        for lot in lots:
            self._house(lot, walls, tops)
        self.objects.append(walls.finish(stone_walls()))
        self.objects.append(tops.finish(roofs()))
        self._city_wall()
        self._street_ground(streets)
        return self

    # streets: axis-aligned bands (x0, y0, x1, y1)
    def _streets(self):
        gx, gy, rng = self.gx, self.gy, self.rng
        out = [(gx - self.depth, gy - self.street_w / 2, gx, gy + self.street_w / 2)]
        x = gx - 45.0
        while x > gx - self.depth:
            w = 4.0 if rng.random() < 0.6 else 3.0
            out.append((x - w / 2, gy - self.half, x + w / 2, gy + self.half))
            x -= 38.0 + rng.random() * 30.0
        y = gy + self.street_w / 2 + 30.0
        while y < gy + self.half:
            w = 3.0 + rng.random() * 1.5
            out.append((gx - self.depth, y - w / 2, gx - 6.0, y + w / 2))
            y += 32.0 + rng.random() * 26.0
        y = gy - self.street_w / 2 - 30.0
        while y > gy - self.half:
            w = 3.0 + rng.random() * 1.5
            out.append((gx - self.depth, y - w / 2, gx - 6.0, y + w / 2))
            y -= 32.0 + rng.random() * 26.0
        # Keep clear of the wall's inside face.
        out.append((gx - 8.0, gy - self.half, gx, gy + self.half))
        return out

    def _lots(self, streets):
        """Split the city into lots: a grid of cells, merged and jittered,
        dropped where a street runs."""
        rng = self.rng
        lots = []
        cell = 9.0
        xs = np.arange(self.gx - self.depth, self.gx - 8.0, cell)
        ys = np.arange(self.gy - self.half, self.gy + self.half, cell)
        for x0 in xs:
            for y0 in ys:
                w = cell * (1 if rng.random() < 0.7 else 2)
                d = cell * (1 if rng.random() < 0.75 else 2)
                if rng.random() < 0.35:
                    continue
                x1, y1 = x0 + w, y0 + d
                if any(not (x1 <= a or x0 >= c or y1 <= b or y0 >= e) for a, b, c, e in streets):
                    # Shrink to the side of the street if it just touches.
                    ok = None
                    for sx0, sy0, sx1, sy1 in streets:
                        if x1 <= sx0 or x0 >= sx1 or y1 <= sy0 or y0 >= sy1:
                            continue
                        if sy0 - y0 > 3.0:
                            ok = (x0, y0, x1, min(y1, sy0))
                        elif y1 - sy1 > 3.0:
                            ok = (x0, max(y0, sy1), x1, y1)
                        elif sx0 - x0 > 3.0:
                            ok = (x0, y0, min(x1, sx0), y1)
                        elif x1 - sx1 > 3.0:
                            ok = (max(x0, sx1), y0, x1, y1)
                        else:
                            ok = None
                        break
                    if ok is None:
                        continue
                    x0b, y0b, x1b, y1b = ok
                    if any(not (x1b <= a or x0b >= c or y1b <= b or y0b >= e) for a, b, c, e in streets):
                        continue
                    lots.append((x0b, y0b, x1b, y1b))
                    continue
                lots.append((x0, y0, x1, y1))
        # Fill the gaps between lots too: courtyards stay open.
        return lots

    def _house(self, lot, walls, tops):
        rng = self.rng
        x0, y0, x1, y1 = lot
        inset = 0.15
        x0, y0, x1, y1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
        if x1 - x0 < 2.5 or y1 - y0 < 2.5:
            return
        zb = min(self.z(x0, y0), self.z(x1, y1), self.z(x0, y1), self.z(x1, y0)) - 0.3
        storeys = 1 if rng.random() < 0.55 else 2
        h = storeys * STOREY + rng.random() * 0.6
        r = rng.random()
        walls.box(x0, y0, zb, x1, y1, zb + h, r, zb)
        roof_z = zb + h
        # Roof deck, a little below the parapet.
        tops.quad([(x0 + 0.25, y0 + 0.25, roof_z - 0.02), (x1 - 0.25, y0 + 0.25, roof_z - 0.02), (x1 - 0.25, y1 - 0.25, roof_z - 0.02), (x0 + 0.25, y1 - 0.25, roof_z - 0.02)], r, roof_z)
        p = 0.55 + rng.random() * 0.3
        t = 0.25
        for bx0, by0, bx1, by1 in ((x0, y0, x1, y0 + t), (x0, y1 - t, x1, y1), (x0, y0, x0 + t, y1), (x1 - t, y0, x1, y1)):
            walls.box(bx0, by0, roof_z, bx1, by1, roof_z + p, r, zb)
        # An upper room on some roofs.
        if rng.random() < 0.3 and (x1 - x0) > 5 and (y1 - y0) > 5:
            ux1 = x0 + (x1 - x0) * (0.45 + rng.random() * 0.2)
            uy1 = y0 + (y1 - y0) * (0.45 + rng.random() * 0.2)
            walls.box(x0 + 0.3, y0 + 0.3, roof_z, ux1, uy1, roof_z + 2.6, r, roof_z)
            tops.quad([(x0 + 0.3, y0 + 0.3, roof_z + 2.62), (ux1, y0 + 0.3, roof_z + 2.62), (ux1, uy1, roof_z + 2.62), (x0 + 0.3, uy1, roof_z + 2.62)], r, roof_z)
        # Doors and windows: dark recesses on the faces toward streets.
        self._openings(walls, (x0, y0, x1, y1), zb, storeys, r)

    def _openings(self, b, box, zb, storeys, r):
        rng = self.rng
        x0, y0, x1, y1 = box
        dark = 0.02
        for side in range(4):
            if rng.random() < 0.35:
                continue
            if side in (0, 1):
                y = y0 - dark if side == 0 else y1 + dark
                span = (x0, x1)
            else:
                x = x0 - dark if side == 2 else x1 + dark
                span = (y0, y1)
            L = span[1] - span[0]
            if L < 3:
                continue
            c = span[0] + L * (0.3 + rng.random() * 0.4)
            # Door.
            w, hgt = 1.0, 2.0
            self._recess(b, side, c, w, zb + 0.05, zb + 0.05 + hgt, box, r)
            for k in range(storeys):
                for j in range(1 + (L > 7)):
                    cw = span[0] + L * (0.15 + 0.7 * rng.random())
                    wz = zb + k * STOREY + 2.1 + rng.random() * 0.3
                    if k == 0 and abs(cw - c) < 1.3:
                        continue
                    self._recess(b, side, cw, 0.45, wz, wz + 0.6, box, r)

    def _recess(self, b, side, c, w, z0, z1, box, r):
        x0, y0, x1, y1 = box
        e = 0.03
        if side == 0:
            b.quad([(c - w / 2, y0 - e, z0), (c + w / 2, y0 - e, z0), (c + w / 2, y0 - e, z1), (c - w / 2, y0 - e, z1)], -1.0, z0)
        elif side == 1:
            b.quad([(c + w / 2, y1 + e, z0), (c - w / 2, y1 + e, z0), (c - w / 2, y1 + e, z1), (c + w / 2, y1 + e, z1)], -1.0, z0)
        elif side == 2:
            b.quad([(x0 - e, c + w / 2, z0), (x0 - e, c - w / 2, z0), (x0 - e, c - w / 2, z1), (x0 - e, c + w / 2, z1)], -1.0, z0)
        else:
            b.quad([(x1 + e, c - w / 2, z0), (x1 + e, c + w / 2, z0), (x1 + e, c + w / 2, z1), (x1 + e, c - w / 2, z1)], -1.0, z0)

    def _city_wall(self):
        """The east wall, its towers and the gate: two towers either side of a
        passage through the wall."""
        gx, gy = self.gx, self.gy
        b = Builder("city-wall")
        zb = self.gz - 6.0
        H = 11.5
        th = 4.0
        top = self.gz + H
        # Wall runs north-south, its outer face at x = gx.
        span = self.half + 60.0
        gap = 2.2
        for ys, ye in ((gy - span, gy - gap), (gy + gap, gy + span)):
            b.box(gx - th, ys, zb, gx, ye, top, 0.3, zb)
            # Crenellations.
            y = ys
            while y < ye - 1.2:
                b.box(gx - 0.9, y, top, gx, y + 1.1, top + 1.3, 0.3, top)
                y += 2.1
        # Arch over the passage.
        b.box(gx - th, gy - gap, self.gz + 5.2, gx, gy + gap, top, 0.3, zb)
        # Towers: flanking the gate, and every 70 m.
        towers = [gy - gap - 4.5, gy + gap + 4.5]
        y = gy + 75.0
        while y < gy + span:
            towers.append(y)
            y += 70.0
        y = gy - 75.0
        while y > gy - span:
            towers.append(y)
            y -= 70.0
        for ty in towers:
            b.box(gx - 2.0, ty - 4.5, zb, gx + 5.0, ty + 4.5, top + 4.0, 0.4, zb)
            yy = ty - 4.5
            while yy < ty + 4.4:
                b.box(gx + 4.1, yy, top + 4.0, gx + 5.0, yy + 1.1, top + 5.2, 0.4, top + 4.0)
                yy += 2.0
        obj = b.finish(stone_walls("wall-stone", "#cfbf9d", "#a8946f", "#d5c8ad"))
        self.objects.append(obj)
        self.wall_top = top

    def _street_ground(self, streets):
        """The ground of the city: one plane following `ground`, paved along
        the market street."""
        gx, gy = self.gx, self.gy
        xs = np.linspace(gx - self.depth - 20, gx + 1.0, 260)
        ys = np.linspace(gy - self.half - 20, gy + self.half + 20, 300)
        X, Y = np.meshgrid(xs, ys, indexing="ij")
        Z = self.ground(X, Y)
        import teaser_land as TL

        paved = ((Y > gy - self.street_w / 2 - 0.5) & (Y < gy + self.street_w / 2 + 0.5)).astype(float)
        obj = TL.grid_mesh("city-ground", X, Y, Z, {"paved": paved}, paving())
        self.objects.append(obj)
