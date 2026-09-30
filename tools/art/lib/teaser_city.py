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
import materials as M
import teaser_noise as N
from teaser_nodes import Graph

STOREY = 3.3


# ── materials ────────────────────────────────────────────────────────────────
def masonry(name="city-masonry", ashlar=False):
    """Walls as a builder would lay them in first-century Jerusalem, seen
    close enough to count the stones.

    Most houses are rubble: rough limestone blocks of every size in uneven
    courses (cells of a voronoi squashed flat, so each is a block wider
    than tall), set in grey-white lime mortar, each block its own tone
    (cream, honey, pinkish, grey), chipped and pitted. Some are lime-washed
    and the wash has flaked away in patches. The city wall and gate
    (`ashlar`) are dressed blocks in courses, each with its drafted margin.
    Weather marks them all: dark streaks run down from the roof's edge
    (face attribute `ztop`), rain splash and dust darken the foot of the
    wall (`zbase`). The stone is a warm, faintly pink cream: in shade, lit
    by the blue sky, a yellower stone read grey-green."""

    def build():
        g = Graph(name)
        pos = g.position()
        n = g.normal()
        x, y, z = g.xyz(pos)
        rnd = g.attr("rand")
        ax = g.math("ABSOLUTE", g.xyz(n)[0])
        u = g.mixf(g.map(ax, 0.45, 0.55), x, y)
        if ashlar:
            b = g.node("ShaderNodeTexBrick", {"Vector": g.vec(u, z, 0.0), "Scale": 1.0, "Mortar Size": 0.012, "Mortar Smooth": 0.2, "Bias": 0.0, "Brick Width": 1.6, "Row Height": 0.62, "Color1": (1, 1, 1, 1), "Color2": (0.0, 0.0, 0.0, 1), "Mortar": (0, 0, 0, 1)}, offset=0.5, squash=1.0)
            joint = b.outputs["Fac"]
            tone = g.xyz(b.outputs["Color"])[0]
            # The drafted margin round each face, and its rough boss.
            b2 = g.node("ShaderNodeTexBrick", {"Vector": g.vec(u, z, 0.0), "Scale": 1.0, "Mortar Size": 0.07, "Mortar Smooth": 1.0, "Bias": 0.0, "Brick Width": 1.6, "Row Height": 0.62, "Color1": (1, 1, 1, 1), "Color2": (1, 1, 1, 1), "Mortar": (0, 0, 0, 1)}, offset=0.5, squash=1.0)
            margin = g.sub(b2.outputs["Fac"], joint)
            boss = g.mul(g.sub(1.0, b2.outputs["Fac"]), g.noise(pos, 6.0, 4.0, 0.7))
            relief = g.add(g.mul(joint, -1.0), g.add(g.mul(margin, -0.3), g.mul(boss, 0.6)))
        else:
            cells = g.vec(g.mul(u, 2.2), g.mul(g.add(z, g.mul(g.noise(pos, 0.7, 2.0), 0.2)), 3.8), g.mul(rnd, 37.0))
            vor = g.node("ShaderNodeTexVoronoi", {"Vector": cells, "Scale": 1.0, "Randomness": 0.85}, feature="DISTANCE_TO_EDGE", distance="EUCLIDEAN", voronoi_dimensions="3D")
            vc = g.node("ShaderNodeTexVoronoi", {"Vector": cells, "Scale": 1.0, "Randomness": 0.85}, feature="F1", distance="EUCLIDEAN", voronoi_dimensions="3D")
            edge = vor.outputs["Distance"]
            joint = g.map(edge, 0.0, 0.045, 1.0, 0.0)
            tone = g.xyz(vc.outputs["Color"])[0]
            # Each block bulges a little, rougher toward its edges.
            relief = g.add(g.map(edge, 0.0, 0.2, -1.0, 0.0), g.mul(g.noise(pos, 7.0, 4.0, 0.7), 0.35))
        stone = g.ramp(tone, [(0.0, "#c3a584"), (0.3, "#d2b995"), (0.55, "#d9c3a0"), (0.8, "#cbb08e"), (1.0, "#c9b49a")])
        stone = g.mix(g.mul(g.smooth(g.noise(pos, 4.0, 4.0, 0.6), 0.55, 0.8), 0.5), stone, "#a89a88")
        pits = g.map(g.voronoi(pos, 60.0), 0.0, 0.18, 1.0, 0.0)
        stone = g.mix(g.mul(pits, 0.35), stone, "#8a7a68")
        mortar = g.mix(g.map(g.noise(pos, 3.0, 3.0), 0.3, 0.7), "#b39c7e", "#c9b596")
        col = g.mix(joint, stone, mortar)
        # Most houses are plastered with mud and lime; where it has fallen
        # away (more of it low down) the rubble shows.
        low_z = g.map(g.sub(z, g.attr("zbase")), 0.0, 1.5, 1.0, 0.0)
        washed = 0.0 if ashlar else g.map(rnd, 0.3, 0.32)
        flake = g.smooth(g.add(g.noise(pos, 0.9, 4.0, 0.6), g.mul(low_z, 0.15)), 0.55, 0.59)
        wash = g.mul(washed, g.sub(1.0, flake))
        wash_col = g.mix(g.map(g.noise(pos, 1.5, 3.0), 0.3, 0.7), "#d9c7a6", "#cbb593")
        wash_col = g.mix(g.mul(g.smooth(g.noise(pos, 0.35, 3.0), 0.5, 0.7), 0.5), wash_col, "#b89f7e")
        col = g.mix(wash, col, wash_col)
        base = g.attr("zbase")
        top = g.attr("ztop")
        # Splash and dust at the foot of the wall.
        low = g.map(g.sub(z, base), 0.0, 0.9, 1.0, 0.0)
        low = g.mul(low, g.map(g.noise(pos, 3.0, 3.0), 0.3, 0.7, 0.6, 1.0))
        col = g.mix(g.mul(low, 0.45), col, "#9c8468")
        # Rain streaks from the roof's edge, fading downward.
        streak = g.noise(g.vmath("MULTIPLY", pos, (3.0, 3.0, 0.12)), 1.0, 3.0, 0.6)
        below = g.map(g.sub(top, z), 0.0, 2.6, 1.0, 0.0)
        col = g.mix(g.mul(g.mul(g.smooth(streak, 0.5, 0.72), below), 0.5), col, "#857563", "MULTIPLY")
        # Doors and windows are faces marked rand = -1: deep shade.
        opening = g.math("LESS_THAN", rnd, -0.5)
        col = g.mix(opening, col, "#17110c")
        h = g.add(g.mul(relief, g.sub(1.0, wash)), g.mul(g.noise(pos, 20.0, 4.0), 0.25))
        normal = g.bump(g.mul(pits, -1.0), 0.3, 0.004, normal=g.bump(h, 0.55, 0.035))
        g.principled(col, g.map(joint, 0.0, 1.0, 0.86, 0.95), g.map(opening, 0.0, 1.0, 0.25, 0.0), normal)
        return g.mat

    return _cached(f"{name}-{ashlar}", build)


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
        col = g.mix(g.map(slab, 0.75, 1.0), "#a8967a", "#bcab8c")
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
    """Collects boxes into one mesh, with a random value, base and top height
    per face (for the shader: which stone, where the splash and the streaks
    reach)."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.rand = self.bm.faces.layers.float.new("rand")
        self.zbase = self.bm.faces.layers.float.new("zbase")
        self.ztop = self.bm.faces.layers.float.new("ztop")

    def box(self, x0, y0, z0, x1, y1, z1, r=0.5, zb=None, skip_bottom=True, zt=None, jitter=None, batter=0.0):
        """A box; `jitter` (a random.Random) nudges its corners a few
        centimetres (no wall is laid true), `batter` leans its faces in
        toward the top."""
        bm = self.bm
        corners = [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]
        v = []
        for k, z in enumerate((z0, z1)):
            for cx, cy in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
                dx = dy = 0.0
                if jitter is not None:
                    dx = jitter.uniform(-0.05, 0.05)
                    dy = jitter.uniform(-0.05, 0.05)
                if k == 1 and batter:
                    dx += batter if cx == x0 else -batter
                    dy += batter if cy == y0 else -batter
                v.append(bm.verts.new((cx + dx, cy + dy, z)))
        _ = corners
        faces = [(4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        if not skip_bottom:
            faces.append((0, 2, 3, 1))
        for f in faces:
            face = bm.faces.new([v[i] for i in f])
            face[self.rand] = r
            face[self.zbase] = z0 if zb is None else zb
            face[self.ztop] = z1 if zt is None else zt

    def quad(self, pts, r=0.5, zb=0.0, zt=None):
        face = self.bm.faces.new([self.bm.verts.new(p) for p in pts])
        face[self.rand] = r
        face[self.zbase] = zb
        face[self.ztop] = max(p[2] for p in pts) if zt is None else zt

    def finish(self, material, collection=None, smooth=False, bevel=0.0):
        me = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        obj = bpy.data.objects.new(self.name, me)
        (collection or bpy.context.scene.collection).objects.link(obj)
        me.materials.append(material)
        for p in me.polygons:
            p.use_smooth = smooth
        if bevel:
            # Lime-plastered arrises are rounded, never knife-edged.
            mod = common.add_modifier(obj, "BEVEL", width=bevel, segments=2, limit_method="ANGLE")
            mod.harden_normals = False
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
        self.roofs_at = []
        self.yards = []
        walls = Builder("city-houses")
        tops = Builder("city-roofs")
        self.holes = Builder("city-openings")
        self.timber = Builder("city-timber")
        self.dressed = Builder("city-dressed")
        self.clutter = []
        streets = self._streets()
        lots = self._lots(streets)
        self.lots = lots
        for lot in lots:
            self._house(lot, walls, tops)
        # Rubble walls, some lime-washed; roofs of rolled earth and lime.
        self.objects.append(walls.finish(masonry(), bevel=0.05))
        self.objects.append(tops.finish(M.plaster("#d6c2a2", "teaser-roof-plaster")))
        self.objects.append(self.holes.finish(plain("city-dark", "#1a130d", 0.95)))
        self.objects.append(self.timber.finish(wood("city-wood", "#5e4630"), bevel=0.01))
        self.objects.append(self.dressed.finish(masonry("city-dressed", ashlar=True), bevel=0.012))
        self._roof_clutter()
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
                    # An open yard: a tree may grow here.
                    self.yards.append((x0 + cell / 2, y0 + cell / 2))
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
        """A house on its lot: rubble walls leaning in a little, a parapet
        of uneven height (broken down in places), roof beams showing under
        it, water spouts, sometimes an upper room, outside stairs, a
        lean-to; doors and windows with lintels and wooden leaves."""
        rng = self.rng
        x0, y0, x1, y1 = lot
        inset = 0.15 + rng.random() * 0.25
        x0, y0, x1, y1 = x0 + inset, y0 + inset * rng.random(), x1 - inset * rng.random(), y1 - inset
        if x1 - x0 < 2.5 or y1 - y0 < 2.5:
            return
        zb = min(self.z(x0, y0), self.z(x1, y1), self.z(x0, y1), self.z(x1, y0)) - 0.3
        storeys = 1 if rng.random() < 0.55 else 2
        h = storeys * STOREY + rng.random() * 0.6
        r = rng.random()
        roof_z = zb + h
        walls.box(x0, y0, zb, x1, y1, roof_z, r, zb, zt=roof_z, jitter=rng, batter=0.04 + 0.05 * rng.random())
        # Roof deck, a little below the parapet.
        tops.quad([(x0 + 0.3, y0 + 0.3, roof_z - 0.02), (x1 - 0.3, y0 + 0.3, roof_z - 0.02), (x1 - 0.3, y1 - 0.3, roof_z - 0.02), (x0 + 0.3, y1 - 0.3, roof_z - 0.02)], r, roof_z)
        t = 0.3
        for side, (bx0, by0, bx1, by1) in enumerate(((x0, y0, x1, y0 + t), (x0, y1 - t, x1, y1), (x0, y0, x0 + t, y1), (x1 - t, y0, x1, y1))):
            p = 0.45 + rng.random() * 0.45
            if side < 2 and rng.random() < 0.18:
                # Broken down along part of its length.
                cut = bx0 + (bx1 - bx0) * rng.uniform(0.3, 0.7)
                walls.box(bx0 + 0.04, by0 + 0.04, roof_z - 0.05, cut, by1 - 0.04, roof_z + p, r, zb, jitter=rng)
                walls.box(cut, by0 + 0.04, roof_z - 0.05, bx1 - 0.04, by1 - 0.04, roof_z + p * 0.35, r, zb, jitter=rng)
                continue
            walls.box(bx0 + 0.04, by0 + 0.04, roof_z - 0.05, bx1 - 0.04, by1 - 0.04, roof_z + p, r, zb, jitter=rng)
        # Water spouts through the parapet: a wooden gutter.
        tb = self.timber
        for k in range(rng.randrange(1, 3)):
            if rng.random() < 0.5:
                sx = rng.uniform(x0 + 0.8, x1 - 0.8)
                tb.box(sx - 0.07, y0 - 0.45, roof_z + 0.02, sx + 0.07, y0 + 0.3, roof_z + 0.12, 0.5, zb)
            else:
                sy = rng.uniform(y0 + 0.8, y1 - 0.8)
                tb.box(x1 - 0.3, sy - 0.07, roof_z + 0.02, x1 + 0.45, sy + 0.07, roof_z + 0.12, 0.5, zb)
        # An upper room on some roofs.
        if rng.random() < 0.3 and (x1 - x0) > 5 and (y1 - y0) > 5:
            ux1 = x0 + (x1 - x0) * (0.45 + rng.random() * 0.2)
            uy1 = y0 + (y1 - y0) * (0.45 + rng.random() * 0.2)
            walls.box(x0 + 0.3, y0 + 0.3, roof_z, ux1, uy1, roof_z + 2.6, r, roof_z, jitter=rng, batter=0.04)
            tops.quad([(x0 + 0.34, y0 + 0.34, roof_z + 2.62), (ux1 - 0.04, y0 + 0.34, roof_z + 2.62), (ux1 - 0.04, uy1 - 0.04, roof_z + 2.62), (x0 + 0.34, uy1 - 0.04, roof_z + 2.62)], r, roof_z)
            self._opening(0, (x0 + 0.3 + ux1) / 2, 0.8, roof_z + 0.05, roof_z + 1.85, (x0 + 0.3, y0 + 0.3, ux1, uy1), roof_z, door=True)
        # Roof beams: their ends show in a row just under the parapet.
        for side in (0, 1):
            y = y0 - 0.14 if side == 0 else y1 - 0.02
            x = x0 + 0.5
            while x < x1 - 0.4:
                dz = rng.uniform(-0.03, 0.03)
                tb.box(x - 0.08, y, roof_z - 0.32 + dz, x + 0.08, y + 0.16, roof_z - 0.15 + dz, 0.5, zb)
                x += 0.5 + rng.random() * 0.2
        # Outside stairs up to the roof on some houses.
        if rng.random() < 0.3 and (x1 - x0) > 4.0:
            n = int(h / 0.25)
            for k in range(n):
                sx = x0 + 0.2 + k * 0.28
                if sx + 0.3 > x1:
                    break
                walls.box(sx, y0 - 0.9, zb, sx + 0.3, y0, zb + (k + 1) * 0.25, r, zb, zt=zb + (k + 1) * 0.25, jitter=rng)
        # A lean-to or yard wall against one side.
        if rng.random() < 0.25:
            lh = 1.6 + rng.random() * 0.8
            if rng.random() < 0.5:
                walls.box(x0 + 0.2, y1, zb, min(x1, x0 + 3.5), y1 + 2.2, zb + lh, r, zb, jitter=rng, batter=0.03)
            else:
                walls.box(x0 - 0.35, y0 + 0.5, zb, x0, y1 - 0.5, zb + lh * 0.8, r, zb, jitter=rng)
        # Doors and windows toward the lanes.
        self._openings((x0, y0, x1, y1), zb, storeys, r)
        self.roofs_at.append((x0, y0, x1, y1, roof_z))

    def _openings(self, box, zb, storeys, r):
        rng = self.rng
        x0, y0, x1, y1 = box
        for side in range(4):
            if rng.random() < 0.35:
                continue
            span = (x0, x1) if side in (0, 1) else (y0, y1)
            L = span[1] - span[0]
            if L < 3:
                continue
            c = span[0] + L * (0.3 + rng.random() * 0.4)
            self._opening(side, c, 0.9 + rng.random() * 0.25, zb + 0.35, zb + 0.35 + 1.85 + rng.random() * 0.2, box, zb, door=True)
            for k in range(storeys):
                for j in range(1 + (L > 7)):
                    cw = span[0] + L * (0.15 + 0.7 * rng.random())
                    wz = zb + k * STOREY + 2.1 + rng.random() * 0.3
                    if k == 0 and abs(cw - c) < 1.3:
                        continue
                    self._opening(side, cw, 0.4 + rng.random() * 0.15, wz, wz + 0.55 + rng.random() * 0.15, box, zb, door=False)

    def _opening(self, side, c, w, z0, z1, box, zb, door):
        """A door or window on one face of a house: the dark of the room
        within, a stone lintel or wooden beam over it, dressed jambs and a
        threshold (a door) or a sill (a window), and a wooden leaf, shutter
        or bars."""
        rng = self.rng
        x0, y0, x1, y1 = box
        e = 0.06  # proud of the wall (which leans in a little as it rises)

        def face_box(a0, a1, h0, h1, out0, out1, builder, r=0.5):
            # Along the face a0..a1, heights h0..h1, from out0 to out1 outside it.
            if side == 0:
                builder.box(a0, y0 - out1, h0, a1, y0 - out0, h1, r, zb)
            elif side == 1:
                builder.box(a0, y1 + out0, h0, a1, y1 + out1, h1, r, zb)
            elif side == 2:
                builder.box(x0 - out1, a0, h0, x0 - out0, a1, h1, r, zb)
            else:
                builder.box(x1 + out0, a0, h0, x1 + out1, a1, h1, r, zb)

        face_box(c - w / 2, c + w / 2, z0, z1, e - 0.01, e, self.holes, -1.0)
        stone = rng.random() < 0.6
        lintel = self.dressed if stone else self.timber
        face_box(c - w / 2 - 0.22, c + w / 2 + 0.22, z1, z1 + (0.26 if stone else 0.16), 0.0, e + 0.05, lintel, rng.random())
        if door:
            for sgn in (-1, 1):
                a = c + sgn * (w / 2 + 0.09)
                face_box(a - 0.09, a + 0.09, z0 - 0.05, z1, 0.0, e + 0.03, self.dressed, rng.random())
            face_box(c - w / 2 - 0.1, c + w / 2 + 0.1, z0 - 0.35, z0, 0.0, e + 0.25, self.dressed, rng.random())
            # The door leaf of planks, often ajar (a strip of the dark beside it).
            lw = w * (0.78 if rng.random() < 0.4 else 1.0)
            face_box(c - w / 2, c - w / 2 + lw, z0 + 0.02, z1 - 0.02, e, e + 0.05, self.timber, rng.random())
        else:
            face_box(c - w / 2 - 0.06, c + w / 2 + 0.06, z0 - 0.1, z0, 0.0, e + 0.08, self.dressed, rng.random())
            if rng.random() < 0.5:
                if rng.random() < 0.5:
                    face_box(c - w / 2, c + w / 2, z0, z1, e, e + 0.03, self.timber, rng.random())
                else:
                    for k in range(3):
                        a = c - w / 2 + (k + 0.5) * w / 3
                        face_box(a - 0.02, a + 0.02, z0, z1, e, e + 0.03, self.timber, 0.5)

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
        obj = b.finish(masonry("city-wall", ashlar=True), bevel=0.03)
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


def _roof_props():
    """Prototypes of what stands on a roof: jars, a basket, a rolled mat,
    firewood, a cloth drying over a line, a ladder."""
    import teaser_props as PR

    protos = []
    for k, (col, s_) in enumerate((("#b06c46", 1.0), ("#a8663f", 0.8), ("#c08a5e", 1.2))):
        prof = [(0.06 * s_, 0.0), (0.18 * s_, 0.1 * s_), (0.22 * s_, 0.3 * s_), (0.16 * s_, 0.5 * s_), (0.07 * s_, 0.6 * s_), (0.08 * s_, 0.64 * s_)]
        protos.append(common.lathe(f"roof-jar{k}", prof, 18, M.terracotta(col, 0.35), None))
    protos.append(common.lathe("roof-basket", [(0.2, 0.0), (0.28, 0.25), (0.3, 0.3)], 18, M.straw("#b39463"), None))
    mat = common.lathe("roof-mat", [(0.0, -0.6), (0.12, -0.6), (0.12, 0.6), (0.0, 0.6)], 12, M.straw("#a88a5c"), None)
    mat.data.transform(Matrix.Rotation(math.pi / 2, 4, "Y") @ Matrix.Translation((0, 0, 0)))
    mat.data.transform(Matrix.Translation((0, 0, 0.12)))
    protos.append(mat)
    wood = bmesh.new()
    rng = random.Random(5)
    for k in range(14):
        a = Vector((rng.uniform(-0.5, 0.5), rng.uniform(-0.25, 0.25), 0.05 + 0.08 * (k // 5)))
        b = a + Vector((rng.uniform(0.6, 1.0), rng.uniform(-0.1, 0.1), rng.uniform(-0.03, 0.03)))
        bmesh.ops.create_cone(wood, cap_ends=True, segments=6, radius1=0.035, radius2=0.03, depth=(b - a).length, matrix=Matrix.Translation((a + b) / 2) @ (b - a).to_track_quat("Z", "Y").to_matrix().to_4x4())
    protos.append(common.mesh_object("roof-firewood", wood, M.wood("#6a5038", 3.0), None))
    # A cloth over a line between two posts.
    cl = bmesh.new()
    for x0 in (-1.0, 1.0):
        bmesh.ops.create_cone(cl, cap_ends=True, segments=6, radius1=0.03, radius2=0.03, depth=1.6, matrix=Matrix.Translation((x0, 0, 0.8)))
    g = []
    for j in range(5):
        row = []
        for i in range(9):
            u = i / 8
            row.append(cl.verts.new((-0.6 + 1.2 * u, 0.02 * math.sin(u * 9), 1.55 - j * 0.22 - 0.06 * math.sin(math.pi * u))))
        g.append(row)
    for j in range(4):
        for i in range(8):
            cl.faces.new((g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]))
    protos.append(common.mesh_object("roof-cloth", cl, M.cloth("#b9ad8e", "#7a3b30", "linen"), None))
    lad = bmesh.new()
    for sx in (-0.22, 0.22):
        bmesh.ops.create_cube(lad, size=1.0, matrix=Matrix.Translation((sx, 0, 1.3)) @ Matrix.Diagonal((0.05, 0.05, 2.6, 1)))
    for k in range(7):
        bmesh.ops.create_cube(lad, size=1.0, matrix=Matrix.Translation((0, 0, 0.3 + k * 0.36)) @ Matrix.Diagonal((0.44, 0.04, 0.04, 1)))
    ladder = common.mesh_object("roof-ladder", lad, M.wood("#5e4630", 4.0), None, smooth=False)
    ladder.data.transform(Matrix.Rotation(-0.25, 4, "X"))
    protos.append(ladder)
    return protos, PR


def _roof_clutter_impl(city):
    protos, PR = _roof_props()
    rng = city.rng
    pts, idx, rot, sc = [], [], [], []
    for x0, y0, x1, y1, z in city.roofs_at:
        for k in range(rng.randrange(1, 5)):
            kind = rng.choices(range(len(protos)), weights=[3, 2, 2, 2, 2, 2, 2, 1])[0]
            if kind == 7:
                # A ladder leans against the house from the street.
                side = rng.randrange(4)
                if side == 0:
                    p = (rng.uniform(x0 + 0.8, x1 - 0.8), y0 - 0.7, z - 3.0)
                    r_ = 0.0
                elif side == 1:
                    p = (rng.uniform(x0 + 0.8, x1 - 0.8), y1 + 0.7, z - 3.0)
                    r_ = math.pi
                else:
                    continue
            else:
                p = (rng.uniform(x0 + 0.8, x1 - 0.8), rng.uniform(y0 + 0.8, y1 - 0.8), z)
                r_ = rng.uniform(0, math.tau)
            pts.append(p)
            idx.append(kind)
            rot.append((0.0, 0.0, r_))
            sc.append(rng.uniform(0.85, 1.15))
    city.objects.append(PR.instancer("roof-clutter", np.array(pts), protos, np.array(idx), np.array(rot), np.array(sc)))


City._roof_clutter = _roof_clutter_impl
