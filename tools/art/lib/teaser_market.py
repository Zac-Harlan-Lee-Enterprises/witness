"""The lower market inside the east gate, for the teaser: stalls under
striped awnings with their goods (baskets of pomegranates, figs and dates,
lentils and grain in sacks, stacks of bowls, jars of oil), a well, olive
trees and palms, pigeons on the paving, and the market's people.

Materials are the game's own (materials.py: terracotta, straw, leather,
wood, textile), so the film's market matches the game's.
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils import noise as mnoise

import common
import materials as M
import teaser_city as C
from teaser_nodes import Graph


def _obj(name, bm, mat, col=None, smooth=True):
    return common.mesh_object(name, bm, mat, col, smooth)


def lathe(name, profile, at, mat, segments=24):
    obj = common.lathe(name, profile, segments, mat, None)
    obj.location = at
    return obj


def blob(name, centre, radii, mat, seed=0, rough=0.08, sub=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    o = Vector((seed * 3.1, seed * 1.7, seed * 0.3))
    for v in bm.verts:
        d = 1.0 + rough * mnoise.noise(v.co * 2.0 + o)
        v.co = Vector((v.co.x * radii[0] * d, v.co.y * radii[1] * d, v.co.z * radii[2] * d)) + Vector(centre)
    return _obj(name, bm, mat)


def box(name, size, at, mat, bevel=0.01):
    obj = common.box(name, size, at, mat, None, bevel=bevel)
    return obj


def produce_material(kind):
    colors = {
        "pomegranate": ("#8e2a22", "#b8543c"),
        "fig": ("#4a2c3c", "#6d4658"),
        "date": ("#5a2e18", "#7a4424"),
        "lentil": ("#8a5a32", "#a8744a"),
        "grain": ("#c4a468", "#d8bf86"),
        "olive": ("#3e4228", "#5a5a34"),
        "onion": ("#b58a5a", "#d2b08a"),
        "spice": ("#b0602a", "#c98a3a"),
    }
    a, b = colors[kind]

    def build():
        g = Graph(f"produce-{kind}")
        pos = g.coords("Object")
        col = g.mix(g.map(g.noise(pos, 25.0, 3.0), 0.3, 0.7), a, b)
        col = g.mix(g.mul(g.object_random(), 0.4), col, a)
        g.principled(col, 0.45 if kind in ("pomegranate", "fig", "olive", "date") else 0.85, 0.4)
        return g.mat

    return C._cached(f"produce-{kind}", build)


class Market:
    def __init__(self, city, seed=21, preview=False):
        self.city = city
        self.rng = random.Random(seed)
        self.preview = preview
        self.objects = []
        self.stalls = []

    def build(self):
        city = self.city
        gx, gy = city.gx, city.gy
        x0, x1 = city.market
        rng = self.rng
        awnings = [("#d9cdb1", "#8b4f3a"), ("#d8ccb0", "#3f5a74"), ("#cfc2a2", "#6e5a3a"), ("#dcd2bb", "#7a3b30")]
        for side in (-1, 1):
            x = x1 - 3.0
            while x > x0:
                w = 2.4 + rng.random() * 1.4
                if rng.random() < 0.85:
                    self._stall(x - w / 2, gy + side * 3.25, w, side, awnings[rng.randrange(len(awnings))])
                x -= w + 0.6 + rng.random() * 2.2
        self._well(x0 + 40.0, gy + 0.2)
        for k in range(7):
            side = -1 if k % 2 else 1
            tx = x0 + 10 + k * 19 + rng.random() * 6
            self.olive(tx, gy + side * (7.4 + rng.random() * 1.5), 2.4 + rng.random())
        for k in range(4):
            self.palm(x0 + 25 + k * 30 + rng.random() * 8, gy + (1 if k % 2 else -1) * (9 + rng.random() * 6), 7 + rng.random() * 3)
        return self

    # ── stalls ───────────────────────────────────────────────────────────────
    def _stall(self, cx, cy, w, side, colors):
        """A stall facing the street: a table on trestles, a striped awning on
        four poles sagging between them, goods on the table and the ground."""
        rng = self.rng
        city = self.city
        z = city.z(cx, cy)
        d = 1.2
        front = cy - side * d / 2
        back = cy + side * d / 2
        wood = M.wood("#6d5236", 5.0)
        objs = []
        for px in (cx - w / 2, cx + w / 2):
            for py, h in ((front, 2.25), (back, 2.05)):
                objs.append(box("pole", (0.07, 0.07, h), (px, py, z + h / 2), wood, 0.005))
        table_z = z + 0.78
        objs.append(box("table", (w - 0.2, d * 0.75, 0.06), (cx, cy, table_z), wood, 0.01))
        for px in (cx - w / 2 + 0.3, cx + w / 2 - 0.3):
            objs.append(box("trestle", (0.06, d * 0.6, 0.75), (px, cy, z + 0.375), wood, 0.005))
        objs.append(self._awning(cx, front - side * 0.25, back + side * 0.1, w + 0.3, z + 2.28, z + 2.08, colors, side))
        self._goods(cx, cy, w - 0.4, d * 0.6, table_z + 0.03, side, objs)
        for k in range(rng.randrange(1, 4)):
            sx = cx - w / 2 + rng.random() * w
            sy = front - side * (0.4 + rng.random() * 0.3)
            self._sack(sx, sy, z, objs)
        self.objects += objs
        self.stalls.append((cx, cy, w, side))

    def _awning(self, cx, yf, yb, w, zf, zb, colors, side):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        nu, nv = 14, 8
        grid = []
        for j in range(nv + 1):
            v = j / nv
            row = []
            for i in range(nu + 1):
                u = i / nu
                x = cx - w / 2 + w * u
                y = yf + (yb - yf) * v
                sag = 0.12 * math.sin(math.pi * u) * math.sin(math.pi * v) + 0.05 * math.sin(math.pi * u)
                z = zf + (zb - zf) * v - sag
                # The front edge hangs down a little in a valance.
                if j == 0:
                    z -= 0.0
                row.append(bm.verts.new((x, y, z)))
            grid.append(row)
        for j in range(nv):
            for i in range(nu):
                f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    loop[uv].uv = (a / nu, b / nv)
        # Valance.
        prev = grid[0]
        drop = [bm.verts.new(v.co + Vector((0, 0, -0.28))) for v in prev]
        for i in range(nu):
            f = bm.faces.new((prev[i], prev[i + 1], drop[i + 1], drop[i]))
            for loop, (a, b) in zip(f.loops, ((i, 0), (i + 1, 0), (i + 1, 0.2), (i, 0.2))):
                loop[uv].uv = (a / nu, b)
        obj = _obj("awning", bm, C.awning(f"awning-{colors[0]}-{colors[1]}", colors[0], colors[1]))
        common.add_modifier(obj, "SOLIDIFY", thickness=0.006)
        return obj

    def _goods(self, cx, cy, w, d, z, side, objs):
        rng = self.rng
        kinds = ["pomegranate", "fig", "date", "lentil", "grain", "olive", "onion", "spice"]
        n = max(2, int(w / 0.55))
        for k in range(n):
            x = cx - w / 2 + (k + 0.5) * w / n
            y = cy + (rng.random() - 0.5) * d * 0.4
            kind = rng.random()
            if kind < 0.55:
                self._basket(x, y, z, rng.choice(kinds), objs)
            elif kind < 0.75:
                self._jar(x, y, z, objs, small=True)
            elif kind < 0.88:
                self._bowls(x, y, z, objs)
            else:
                self._cloth_roll(x, y, z, objs)

    def _basket(self, x, y, z, kind, objs):
        rng = self.rng
        r = 0.16 + rng.random() * 0.07
        h = 0.12 + rng.random() * 0.06
        objs.append(lathe("basket", [(r * 0.75, 0.0), (r, h * 0.6), (r * 1.05, h), (r * 0.98, h * 1.02)], (x, y, z), M.straw("#b89660"), 24))
        mat = produce_material(kind)
        top = z + h * 0.92
        if kind in ("lentil", "grain", "spice"):
            objs.append(blob("heap", (x, y, top), (r * 0.95, r * 0.95, r * 0.45), mat, rng.random() * 9, 0.05))
        else:
            size = {"pomegranate": 0.045, "onion": 0.04, "fig": 0.025, "date": 0.014, "olive": 0.011}.get(kind, 0.03)
            count = int(min(60 if not self.preview else 20, (r / size) ** 2 * 1.4))
            bm = bmesh.new()
            for i in range(count):
                a = rng.random() * math.tau
                rr = r * 0.85 * math.sqrt(rng.random())
                c = Vector((x + math.cos(a) * rr, y + math.sin(a) * rr, top + size * 0.6 + (1 - (rr / r) ** 2) * r * 0.35))
                sub = bmesh.new()
                bmesh.ops.create_icosphere(sub, subdivisions=1 if size < 0.02 else 2, radius=size)
                bmesh.ops.scale(sub, vec=(1.0, 1.0, 0.85 if kind != "date" else 1.6), verts=sub.verts)
                bmesh.ops.translate(sub, vec=c, verts=sub.verts)
                me = bpy.data.meshes.new("t")
                sub.to_mesh(me)
                sub.free()
                bm.from_mesh(me)
                bpy.data.meshes.remove(me)
            objs.append(_obj(f"produce-{kind}", bm, mat))

    def _jar(self, x, y, z, objs, small=False):
        rng = self.rng
        s = (0.55 if small else 1.0) * (0.8 + rng.random() * 0.4)
        prof = [(0.06 * s, 0.0), (0.16 * s, 0.08 * s), (0.2 * s, 0.25 * s), (0.17 * s, 0.42 * s), (0.08 * s, 0.52 * s), (0.065 * s, 0.6 * s), (0.08 * s, 0.63 * s)]
        objs.append(lathe("jar", prof, (x, y, z), M.terracotta(rng.choice(["#b06c46", "#a8663f", "#c08a5e", "#9e6a48"]), 0.3), 24))

    def _bowls(self, x, y, z, objs):
        rng = self.rng
        n = 3 + rng.randrange(4)
        for k in range(n):
            objs.append(lathe("bowl", [(0.04, 0.0), (0.1, 0.03), (0.13, 0.06), (0.125, 0.065), (0.09, 0.035)], (x, y, z + k * 0.028), M.terracotta("#b8764a", 0.1), 20))

    def _cloth_roll(self, x, y, z, objs):
        rng = self.rng
        colors = ["#7a3b30", "#3f5a74", "#6e6a3a", "#c9b996", "#5a4a6a"]
        for k in range(2):
            c = common.lathe("roll", [(0.0, -0.3), (0.06, -0.3), (0.06, 0.3), (0.0, 0.3)], 12, M.cloth(rng.choice(colors), None, "wool"), None)
            c.rotation_euler = (0, math.pi / 2, rng.random() * 0.3)
            c.location = (x, y + (k - 0.5) * 0.13, z + 0.06)
            objs.append(c)

    def _sack(self, x, y, z, objs):
        rng = self.rng
        s = 0.8 + rng.random() * 0.4
        objs.append(blob("sack", (x, y, z + 0.22 * s), (0.2 * s, 0.18 * s, 0.24 * s), M.cloth("#b5a07a", None, "linen"), rng.random() * 9, 0.12))
        objs.append(blob("sack-top", (x, y, z + 0.44 * s), (0.17 * s, 0.15 * s, 0.05 * s), produce_material(rng.choice(["lentil", "grain"])), rng.random() * 9, 0.05))

    def _well(self, x, y):
        z = self.city.z(x, y)
        ring = common.lathe("well", [(1.05, -0.2), (1.08, 0.66), (1.0, 0.74), (0.8, 0.74), (0.74, 0.66), (0.74, -0.1)], 28, M.limestone("#cdbc98", "well-stone", 0.6), None)
        ring.location = (x, y, z)
        self.objects.append(ring)
        self.objects.append(lathe("well-water", [(0.0, 0.0), (0.74, 0.0)], (x, y, z - 0.08), C.plain("well-dark", "#0e0c0a", 0.3), 20))
        wood = M.wood("#5e4630", 4.0)
        for sx in (-0.85, 0.85):
            self.objects.append(box("well-post", (0.1, 0.1, 1.6), (x + sx, y, z + 0.8), wood))
        self.objects.append(box("well-beam", (1.9, 0.1, 0.1), (x, y, z + 1.6), wood))

    # ── trees ────────────────────────────────────────────────────────────────
    def olive(self, x, y, h):
        """An old olive: a thick, twisted, hollowed trunk splitting low, and a
        loose silvery canopy of many small clumps."""
        rng = self.rng
        z = self.city.z(x, y)
        bark = olive_bark()
        leaves = olive_leaves()
        bm = bmesh.new()
        trunks = 2 + rng.randrange(2)
        tips = []
        for k in range(trunks):
            a = rng.random() * math.tau
            base = Vector((x + math.cos(a) * 0.12, y + math.sin(a) * 0.12, z - 0.1))
            tip = Vector((x + math.cos(a) * (0.5 + rng.random() * 0.5), y + math.sin(a) * (0.5 + rng.random() * 0.5), z + h * (0.45 + rng.random() * 0.15)))
            _tube(bm, [base, base.lerp(tip, 0.5) + Vector((rng.random() - 0.5, rng.random() - 0.5, 0)) * 0.3, tip], [0.28, 0.2, 0.12], 10)
            for j in range(3):
                b = rng.random() * math.tau
                end = tip + Vector((math.cos(b) * (0.6 + rng.random() * 0.8), math.sin(b) * (0.6 + rng.random() * 0.8), h * (0.15 + rng.random() * 0.25)))
                _tube(bm, [tip, end], [0.1, 0.04], 6)
                tips.append(end)
        self.objects.append(_obj("olive-trunk", bm, bark))
        cm = bmesh.new()
        for t in tips:
            for k in range(7 if not self.preview else 4):
                c = t + Vector(((rng.random() - 0.5) * 1.3, (rng.random() - 0.5) * 1.3, (rng.random() - 0.3) * 0.9))
                s = 0.45 + rng.random() * 0.35
                sub = bmesh.new()
                bmesh.ops.create_icosphere(sub, subdivisions=2, radius=1.0)
                o = Vector((rng.random() * 40, rng.random() * 40, rng.random() * 40))
                for v in sub.verts:
                    d = 1.0 + 0.35 * mnoise.noise(v.co * 2.4 + o)
                    v.co = c + Vector((v.co.x * s * d, v.co.y * s * d, v.co.z * s * 0.7 * d))
                me = bpy.data.meshes.new("t")
                sub.to_mesh(me)
                sub.free()
                cm.from_mesh(me)
                bpy.data.meshes.remove(me)
        self.objects.append(_obj("olive-canopy", cm, leaves))

    def palm(self, x, y, h):
        rng = self.rng
        z = self.city.z(x, y)
        bm = bmesh.new()
        lean = Vector(((rng.random() - 0.5) * 0.8, (rng.random() - 0.5) * 0.8, 0))
        pts = [Vector((x, y, z - 0.1)), Vector((x, y, z + h * 0.5)) + lean * 0.3, Vector((x, y, z + h)) + lean]
        _tube(bm, pts, [0.22, 0.18, 0.16], 10)
        self.objects.append(_obj("palm-trunk", bm, palm_bark()))
        top = pts[-1]
        fb = bmesh.new()
        for k in range(18):
            a = k / 18 * math.tau + rng.random() * 0.2
            droop = 0.3 + rng.random() * 0.6
            L = 2.4 + rng.random() * 0.8
            prev = None
            for j in range(9):
                t = j / 8
                p = top + Vector((math.cos(a) * L * t, math.sin(a) * L * t, 0.6 * t - droop * t * t * 2.2))
                w = 0.32 * math.sin(math.pi * min(1.0, t * 1.2 + 0.05)) + 0.02
                side = Vector((-math.sin(a), math.cos(a), 0)) * w
                row = (fb.verts.new(p - side), fb.verts.new(p + Vector((0, 0, 0.04)) ), fb.verts.new(p + side))
                if prev:
                    fb.faces.new((prev[0], prev[1], row[1], row[0]))
                    fb.faces.new((prev[1], prev[2], row[2], row[1]))
                prev = row
        self.objects.append(_obj("palm-fronds", fb, palm_leaves()))


def _tube(bm, pts, radii, seg):
    rings = []
    n = len(pts)
    for i, (p, r) in enumerate(zip(pts, radii)):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        side = d.orthogonal().normalized()
        up = d.cross(side).normalized()
        rings.append([bm.verts.new(p + (side * math.cos(math.tau * j / seg) + up * math.sin(math.tau * j / seg)) * r * (1 + 0.15 * mnoise.noise(p * 3 + Vector((j, 0, 0))))) for j in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for j in range(seg):
            k = (j + 1) % seg
            bm.faces.new((a[j], a[k], b[k], b[j]))


def olive_bark():
    def build():
        g = Graph("olive-bark")
        pos = g.coords("Object")
        n = g.noise(g.vmath("MULTIPLY", pos, (3.0, 3.0, 0.8)), 4.0, 6.0, 0.7)
        col = g.mix(g.map(n, 0.3, 0.7), "#4a4036", "#7d7263")
        g.principled(col, 0.85, 0.2, g.bump(n, 0.8, 0.03))
        return g.mat

    return C._cached("olive-bark", build)


def olive_leaves():
    def build():
        g = Graph("olive-leaves")
        pos = g.coords("Object")
        n = g.voronoi(pos, 40.0)
        gaps = g.map(n, 0.0, 0.35)
        col = g.mix(g.map(g.noise(pos, 8.0, 3.0), 0.3, 0.7), "#4d5638", "#7f8a66")
        col = g.mix(g.mul(g.sub(1.0, gaps), 0.4), col, "#2c3322")
        g.principled(col, 0.6, 0.35, g.bump(gaps, 1.0, 0.05), **{"Subsurface Weight": 0.0})
        return g.mat

    return C._cached("olive-leaves", build)


def palm_bark():
    def build():
        g = Graph("palm-bark")
        pos = g.coords("Object")
        _, _, z = g.xyz(pos)
        rings = g.math("FRACT", g.mul(z, 5.0))
        col = g.mix(g.map(rings, 0.0, 0.5), "#5a4a38", "#8a7658")
        g.principled(col, 0.9, 0.2, g.bump(rings, 0.6, 0.02))
        return g.mat

    return C._cached("palm-bark", build)


def palm_leaves():
    def build():
        g = Graph("palm-leaves")
        uvp = g.coords("Object")
        n = g.noise(uvp, 30.0, 2.0)
        col = g.mix(g.map(n, 0.3, 0.7), "#4b5a32", "#6f7a45")
        g.principled(col, 0.55, 0.4, None)
        g.mat.use_backface_culling = False
        return g.mat

    return C._cached("palm-leaves", build)


# ── pigeons ──────────────────────────────────────────────────────────────────
class Pigeon:
    """A rock dove: grey body, darker head, iridescent neck, two dark wing
    bars. Pecks and bobs on the ground, or flies with beating wings."""

    def __init__(self, name, seed=0):
        rng = random.Random(seed)
        self.rng = rng
        grey = pigeon_material("#8c8a86", "#615d58")
        dark = pigeon_material("#5c5b5a", "#403e3c")
        s = 0.9 + rng.random() * 0.2
        self.body = blob(f"{name}-body", (0, 0, 0.11 * s), (0.075 * s, 0.14 * s, 0.07 * s), grey, seed, 0.03, 2)
        self.head = blob(f"{name}-head", (0, 0, 0), (0.028 * s, 0.034 * s, 0.03 * s), dark, seed + 1, 0.02, 2)
        self.tail = blob(f"{name}-tail", (0, 0.16 * s, 0.1 * s), (0.04 * s, 0.07 * s, 0.012 * s), dark, seed + 2, 0.02, 1)
        self.wings = [blob(f"{name}-wing{k}", (0, 0, 0), (0.05 * s, 0.12 * s, 0.012 * s), grey, seed + 3 + k, 0.02, 1) for k in (0, 1)]
        self.legs = blob(f"{name}-legs", (0, 0, 0.03 * s), (0.02 * s, 0.02 * s, 0.03 * s), plain_pink(), seed + 5, 0.0, 1)
        self.s = s
        self.parts = [self.body, self.head, self.tail, *self.wings, self.legs]

    def place(self, at, heading, peck=0.0, fly=None, bank=0.0):
        """Ground: peck 0..1 lowers the head. Flying: fly = wing phase."""
        s = self.s
        W = Matrix.Translation(Vector(at)) @ Matrix.Rotation(heading + math.pi / 2, 4, "Z")
        if fly is not None:
            W = W @ Matrix.Rotation(bank, 4, "Y") @ Matrix.Rotation(-0.15, 4, "X")
        self.body.matrix_world = W
        self.tail.matrix_world = W
        self.legs.matrix_world = W if fly is None else W @ Matrix.Translation((0, 0.05, 0.05)) @ Matrix.Scale(0.01, 4)
        neck = Vector((0, -0.12 * s, 0.2 * s)) if fly is None else Vector((0, -0.14 * s, 0.15 * s))
        if fly is None:
            neck = neck + Vector((0, -0.03 * peck * s, -0.12 * peck * s))
        self.head.matrix_world = W @ Matrix.Translation(neck)
        for k, w in enumerate(self.wings):
            sgn = 1 if k == 0 else -1
            if fly is None:
                M_ = Matrix.Translation((sgn * 0.055 * s, 0.02 * s, 0.13 * s)) @ Matrix.Rotation(sgn * 0.12, 4, "Y")
            else:
                beat = math.sin(fly * math.tau) * 1.1 + 0.2
                M_ = Matrix.Translation((sgn * 0.04 * s, 0.0, 0.13 * s)) @ Matrix.Rotation(sgn * beat, 4, "Y") @ Matrix.Translation((sgn * 0.11 * s, 0, 0)) @ Matrix.Scale(1.5, 4, (1, 0, 0))
            w.matrix_world = W @ M_


def pigeon_material(a, b):
    def build():
        g = Graph(f"pigeon-{a}")
        pos = g.coords("Object")
        col = g.mix(g.map(g.noise(pos, 30.0, 3.0), 0.3, 0.7), b, a)
        g.principled(col, 0.7, 0.4, g.bump(g.noise(pos, 120.0, 2.0), 0.3, 0.003), **{"Sheen Weight": 0.3})
        return g.mat

    return C._cached(f"pigeon-{a}", build)


def plain_pink():
    return C.plain("pigeon-legs", "#b5635a", 0.6)
