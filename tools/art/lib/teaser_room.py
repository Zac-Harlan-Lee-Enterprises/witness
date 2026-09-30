"""Aunt Miriam's house for the teaser: early morning, the lamp still burning
on the table, the remedy and the letter set out beside it; drying herbs
everywhere (the chapter opens on "the smell of drying herbs"), a window
letting in the first cool daylight.

On the table: the remedy (a small clay flask, its mouth stopped with a
twist of cloth tied with cord), the letter to Rivka (a papyrus sheet folded
into a packet and tied with thread), a clay oil lamp, a mortar and pestle,
bundles and loose leaves of herbs. Behind, out of focus: the room's
plastered walls, a niche with jars, herbs hanging from a beam, the loom.

Coordinates: metres, the table top's centre at the origin, x east, y north.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils import noise as mnoise

import common
import materials as M
import teaser_city as C
import teaser_clay as TC
from teaser_nodes import Graph

TABLE_Z = 0.42


def plaster():
    def build():
        g = Graph("room-plaster")
        pos = g.position()
        _, _, z = g.xyz(pos)
        col = g.mix(g.map(g.noise(pos, 1.6, 4.0), 0.3, 0.7), "#d9ccb3", "#c7b797")
        soot = g.map(z, 1.6, 2.8)
        col = g.mix(g.mul(soot, 0.55), col, "#5a4a3a", "MULTIPLY")
        stains = g.smooth(g.noise(pos, 0.9, 3.0), 0.55, 0.7, 0.0, 0.25)
        col = g.mix(stains, col, "#9c8a6c")
        patch = g.smooth(g.noise(pos, 0.6, 2.0), 0.62, 0.66, 0.0, 0.5)
        col = g.mix(patch, col, "#e3d7bf")
        cracks = g.voronoi(g.vmath("ADD", pos, g.vmath("MULTIPLY", g.node("ShaderNodeTexNoise", {"Vector": pos, "Scale": 4.0}).outputs["Color"], (0.03, 0.03, 0.03))), 7.0, 1.0, "Distance", "DISTANCE_TO_EDGE")
        crack = g.mul(g.map(cracks, 0.0, 0.003, 1.0, 0.0), g.smooth(g.noise(pos, 1.5, 2.0), 0.58, 0.66))
        col = g.mix(g.mul(crack, 0.35), col, "#6a5a46")
        h = g.add(g.add(g.noise(pos, 3.0, 5.0, 0.6), g.mul(g.noise(pos, 25.0, 3.0), 0.3)), g.add(g.mul(crack, -0.6), g.mul(patch, 0.4)))
        g.principled(col, 0.92, 0.2, g.bump(h, 0.35, 0.02))
        return g.mat

    return C._cached("room-plaster", build)


def earth_floor():
    def build():
        g = Graph("room-floor")
        pos = g.position()
        col = g.mix(g.map(g.noise(pos, 1.2, 4.0), 0.3, 0.7), "#8c7454", "#a58b66")
        col = g.mix(g.mul(g.map(g.voronoi(pos, 30.0), 0.0, 0.2, 1.0, 0.0), 0.3), col, "#5e4c38")
        g.principled(col, 0.9, 0.2, g.bump(g.noise(pos, 20.0, 4.0), 0.4, 0.01))
        return g.mat

    return C._cached("room-floor", build)


def table_wood():
    def build():
        g = Graph("table-wood")
        pos = g.coords("Object")
        grain = g.wave(g.vmath("MULTIPLY", pos, (0.15, 1.0, 1.0)), 9.0, 6.0, 4.0, "BANDS", "Y")
        knots = g.noise(pos, 3.0, 4.0)
        col = g.mix(g.map(grain, 0.2, 0.9), "#5e4430", "#7d5b3d")
        col = g.mix(g.mul(g.map(knots, 0.55, 0.7), 0.4), col, "#3a281a")
        wear = g.noise(pos, 0.8, 3.0)
        col = g.mix(g.mul(g.map(wear, 0.45, 0.65), 0.35), col, "#a88660")
        scratches = g.wave(g.vmath("MULTIPLY", pos, (0.05, 1.0, 1.0)), 60.0, 12.0, 2.0, "BANDS", "Y")
        h = g.add(g.mul(grain, 0.5), g.mul(scratches, 0.15))
        g.principled(col, g.map(wear, 0.3, 0.7, 0.55, 0.75), 0.35, g.bump(h, 0.25, 0.004))
        return g.mat

    return C._cached("table-wood", build)


def papyrus():
    def build():
        g = Graph("papyrus")
        pos = g.coords("Object")
        a = g.wave(g.vmath("MULTIPLY", pos, (1.0, 0.02, 1.0)), 180.0, 3.0, 3.0, "BANDS", "X")
        b = g.wave(g.vmath("MULTIPLY", pos, (0.02, 1.0, 1.0)), 150.0, 3.0, 3.0, "BANDS", "Y")
        fib = g.mul(g.add(a, b), 0.5)
        col = g.mix(g.map(fib, 0.3, 0.8), "#b39a6a", "#d8c69c")
        col = g.mix(g.mul(g.map(g.noise(pos, 6.0, 3.0), 0.5, 0.7), 0.4), col, "#8a7048")
        g.principled(col, 0.8, 0.25, g.bump(fib, 0.35, 0.002), **{"Subsurface Weight": 0.1, "Subsurface Radius": (0.02, 0.015, 0.01), "Subsurface Scale": 0.01})
        return g.mat

    return C._cached("papyrus", build)


def herb_material(color="#5d6644", dry="#8a8458"):
    def build():
        g = Graph(f"herb-{color}")
        pos = g.coords("Object")
        col = g.mix(g.map(g.noise(pos, 30.0, 3.0), 0.3, 0.7), color, dry)
        col = g.mix(g.mul(g.object_random(), 0.5), col, "#6e6a46")
        g.principled(col, 0.7, 0.3, None, **{"Subsurface Weight": 0.08, "Subsurface Radius": (0.01, 0.02, 0.005), "Subsurface Scale": 0.005})
        g.mat.use_backface_culling = False
        return g.mat

    return C._cached(f"herb-{color}", build)


def flame_material():
    def build():
        g = Graph("lamp-flame")
        pos = g.coords("Generated")
        _, _, z = g.xyz(pos)
        core = g.map(z, 0.0, 1.0, 1.0, 0.0)
        col = g.mix(core, "#ff7a1e", "#fff0c8")
        em = g.node("ShaderNodeEmission", {"Color": col, "Strength": g.map(z, 0.0, 1.0, 22.0, 6.0)})
        tr = g.node("ShaderNodeBsdfTransparent")
        mix = g.node("ShaderNodeMixShader", {"Fac": g.map(z, 0.6, 1.0, 1.0, 0.35)})
        g.nt.links.new(tr.outputs[0], mix.inputs[1])
        g.nt.links.new(em.outputs[0], mix.inputs[2])
        g.surface(mix.outputs[0])
        return g.mat

    return C._cached("lamp-flame", build)


class Room:
    def __init__(self, seed=4, preview=False):
        self.rng = random.Random(seed)
        self.preview = preview
        self.objects = []
        self.lamp = None
        self.flame = None

    def build(self):
        self._shell()
        self._table()
        self._remedy(Vector((0.02, 0.02, TABLE_Z)))
        self._letter(Vector((0.2, -0.06, TABLE_Z)))
        self._oil_lamp(Vector((-0.2, 0.14, TABLE_Z)))
        self._mortar(Vector((-0.32, -0.12, TABLE_Z)))
        self._herbs_on_table()
        self._table_things()
        self._background()
        return self

    # ── the room ─────────────────────────────────────────────────────────────
    def _shell(self):
        """Walls of plastered stone, an earth floor, a ceiling of beams and
        reeds; a small window in the east wall, a doorway to the south."""
        pl = plaster()
        b = C.Builder("room-walls")
        x0, x1, y0, y1, h = -2.2, 3.4, -2.6, 1.3, 2.9
        t = 0.5
        b.box(x0 - t, y1, -0.1, x1 + t, y1 + t, h, 0.5)              # north (behind the table)
        b.box(x0 - t, y0 - t, -0.1, x0, y1 + t, h, 0.5)              # west
        # East wall with a window (a gap between two boxes and a lintel/sill).
        wy0, wy1, wz0, wz1 = -0.4, 0.25, 1.35, 1.95
        b.box(x1, y0 - t, -0.1, x1 + t, wy0, h, 0.5)
        b.box(x1, wy1, -0.1, x1 + t, y1 + t, h, 0.5)
        b.box(x1, wy0, -0.1, x1 + t, wy1, wz0, 0.5)
        b.box(x1, wy0, wz1, x1 + t, wy1, h, 0.5)
        # South wall with a doorway.
        b.box(x0 - t, y0 - t, -0.1, 0.9, y0, h, 0.5)
        b.box(1.9, y0 - t, -0.1, x1 + t, y0, h, 0.5)
        b.box(0.9, y0 - t, 2.05, 1.9, y0, h, 0.5)
        # A niche in the north wall (a recess: a dark box inside).
        self.objects.append(b.finish(pl))
        floor = common.box("floor", (x1 - x0 + 1, y1 - y0 + 1, 0.1), ((x0 + x1) / 2, (y0 + y1) / 2, -0.05), earth_floor(), None)
        self.objects.append(floor)
        ceil = common.box("ceiling", (x1 - x0 + 1, y1 - y0 + 1, 0.12), ((x0 + x1) / 2, (y0 + y1) / 2, h + 0.06), M.plain("#4a3a2a", 0.9), None)
        self.objects.append(ceil)
        wood = C.wood("beam-wood", "#5a4430")
        for k in range(6):
            x = x0 + 0.4 + k * (x1 - x0 - 0.8) / 5
            self.objects.append(common.box(f"beam{k}", (0.18, y1 - y0 + 0.4, 0.2), (x, (y0 + y1) / 2, h - 0.1), wood, None, bevel=0.02))
        self.bounds = (x0, y0, x1, y1, h)
        self.window = (x1 + t / 2, (wy0 + wy1) / 2, (wz0 + wz1) / 2)

    def _table(self):
        wood = table_wood()
        top = common.box("table-top", (1.25, 0.72, 0.05), (0.0, 0.0, TABLE_Z - 0.025), wood, None, bevel=0.008)
        self.objects.append(top)
        for sx in (-0.55, 0.55):
            for sy in (-0.28, 0.28):
                self.objects.append(common.box("table-leg", (0.06, 0.06, TABLE_Z - 0.05), (sx, sy, (TABLE_Z - 0.05) / 2), wood, None, bevel=0.005))

    # ── the story's things ───────────────────────────────────────────────────
    def _remedy(self, at):
        """The remedy: a small round-bodied clay flask, its mouth stopped with a
        twist of cloth and tied round the neck with cord."""
        clay = TC.fired_clay("remedy-clay", "#a86a44", reduced="#6a5446", pale="#c09474", dust=0.12, sheen=0.05, ring_pitch=0.005)
        prof = [(0.001, 0.0), (0.024, 0.001), (0.036, 0.004), (0.048, 0.014), (0.056, 0.03), (0.058, 0.045), (0.055, 0.062), (0.047, 0.078), (0.036, 0.09), (0.026, 0.1), (0.019, 0.11), (0.0165, 0.12), (0.016, 0.133), (0.0185, 0.138), (0.0215, 0.141), (0.02, 0.1455), (0.0165, 0.146)]
        flask = common.lathe("remedy-flask", prof, 48, clay, None)
        TC.wobble(flask, 0.0007, 0.02, seed=3)
        flask.location = at
        common.add_modifier(flask, "SUBSURF", levels=1, render_levels=2)
        self.objects.append(flask)
        cloth = M.cloth("#b8a98c", None, "linen")
        plug = self._blob("remedy-plug", at + Vector((0.0, 0.0, 0.152)), (0.022, 0.022, 0.018), cloth, 3, 0.25)
        self.objects.append(plug)
        tail = common.lathe("remedy-cloth", [(0.0, 0.0), (0.024, 0.004), (0.028, 0.02), (0.02, 0.03), (0.0, 0.034)], 16, cloth, None)
        tail.location = at + Vector((0.0, 0.0, 0.128))
        self.objects.append(tail)
        cord = M.plain("#6a4a2e", 0.8)
        for k, z in enumerate((0.126, 0.132)):
            ring = common.lathe("remedy-cord", [(0.0185, -0.002), (0.0205, -0.002), (0.0205, 0.002), (0.0185, 0.002)], 24, cord, None)
            ring.location = at + Vector((0, 0, z))
            self.objects.append(ring)
        # The cord's loose ends.
        bm = bmesh.new()
        for s in (-1, 1):
            p0 = at + Vector((0.02, 0.0, 0.129))
            p1 = p0 + Vector((0.02, s * 0.012, -0.03))
            p2 = p1 + Vector((0.006, s * 0.01, -0.03))
            _tube(bm, [p0, p1, p2], [0.0018, 0.0016, 0.0014], 6)
        self.objects.append(common.mesh_object("remedy-ends", bm, cord, None))

    def _letter(self, at):
        """The letter to Rivka: a papyrus sheet folded into a flat packet,
        tied round with thread."""
        pap = papyrus()
        w, d, h = 0.13, 0.075, 0.012
        bm = bmesh.new()
        # A slightly bowed, soft-cornered packet: a subdivided box, relaxed.
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=6, use_grid_fill=True)
        for v in bm.verts:
            x, y, z = v.co
            bow = 0.25 * (1 - (2 * x) ** 2) * (1 - (2 * y) ** 2)
            v.co = Vector((x * w, y * d, (z + 0.5) * h * (0.8 + bow)))
        obj = common.mesh_object("letter", bm, pap, None)
        obj.matrix_world = Matrix.Translation(at) @ Matrix.Rotation(0.35, 4, "Z")
        self.objects.append(obj)
        thread = M.plain("#8a6a48", 0.8)
        for k, fx in enumerate((-0.025, 0.03)):
            bmr = bmesh.new()
            ring_pts = []
            for a in range(33):
                t = a / 32 * math.tau
                ring_pts.append(Vector((fx, math.cos(t) * (d / 2 + 0.002), (math.sin(t) * 0.5 + 0.5) * (h + 0.004) - 0.001)))
            _tube(bmr, ring_pts, [0.0012] * len(ring_pts), 6)
            tob = common.mesh_object("letter-thread", bmr, thread, None)
            tob.matrix_world = Matrix.Translation(at) @ Matrix.Rotation(0.35, 4, "Z")
            self.objects.append(tob)

    def _oil_lamp(self, at):
        """A clay oil lamp: a round body with a filling hole and a nozzle, its
        wick burning."""
        clay = TC.fired_clay("lamp-clay", "#9a5e3c", reduced="#5a4a40", pale="#b88a66", dust=0.05, sheen=0.04, ring_pitch=0.004)
        body = self._blob("lamp-body", at + Vector((0, 0, 0.022)), (0.045, 0.045, 0.022), clay, 1, 0.02)
        self.objects.append(body)
        nozzle = self._blob("lamp-nozzle", at + Vector((0.05, 0.0, 0.026)), (0.03, 0.018, 0.012), clay, 2, 0.02)
        self.objects.append(nozzle)
        hole = self._blob("lamp-hole", at + Vector((0, 0, 0.043)), (0.012, 0.012, 0.003), M.plain("#1a120c", 0.4), 3, 0.0)
        self.objects.append(hole)
        wick = at + Vector((0.074, 0.0, 0.036))
        self.objects.append(self._blob("lamp-wick", wick, (0.004, 0.004, 0.006), M.plain("#1a1612", 0.9), 4, 0.1))
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)
        for v in bm.verts:
            z = v.co.z
            k = 1.0 - max(0.0, z) * 0.75
            v.co = Vector((v.co.x * 0.006 * k, v.co.y * 0.006 * k, (z + 1.0) * 0.016))
        self.flame = common.mesh_object("lamp-flame", bm, flame_material(), None)
        self.flame.location = wick + Vector((0, 0, 0.004))
        self.flame.visible_shadow = False
        self.objects.append(self.flame)
        data = bpy.data.lights.new("LampLight", "POINT")
        data.energy = 9.0
        data.color = (1.0, 0.62, 0.32)
        data.shadow_soft_size = 0.008
        self.lamp = bpy.data.objects.new("LampLight", data)
        bpy.context.scene.collection.objects.link(self.lamp)
        self.lamp.location = wick + Vector((0, 0, 0.018))

    def _mortar(self, at):
        stone = M.limestone("#b9ab8f", "mortar-stone", 0.4)
        m = common.lathe("mortar", [(0.0, 0.0), (0.06, 0.0), (0.07, 0.05), (0.068, 0.07), (0.055, 0.07), (0.045, 0.03), (0.0, 0.025)], 28, stone, None)
        m.location = at
        self.objects.append(m)
        p = common.lathe("pestle", [(0.0, 0.0), (0.016, 0.004), (0.018, 0.03), (0.013, 0.1), (0.0, 0.104)], 16, stone, None)
        p.matrix_world = Matrix.Translation(at + Vector((0.03, 0.0, 0.04))) @ Matrix.Rotation(1.05, 4, "Y")
        self.objects.append(p)
        crushed = self._blob("mortar-herbs", at + Vector((0, 0, 0.042)), (0.045, 0.045, 0.01), herb_material("#5a6038", "#7a7448"), 5, 0.2)
        self.objects.append(crushed)

    def _herbs_on_table(self):
        rng = self.rng
        leaf = herb_material()
        for k, (x, y, a) in enumerate(((-0.42, 0.2, 0.4), (0.36, 0.18, -0.6), (0.48, -0.2, 1.2))):
            self.objects.append(self._bundle(f"bundle{k}", Vector((x, y, TABLE_Z)), a, leaf, lying=True))
        bm = bmesh.new()
        for k in range(40 if not self.preview else 14):
            c = Vector(((rng.random() - 0.5) * 0.9, (rng.random() - 0.5) * 0.5, TABLE_Z + 0.002))
            if (c - Vector((0.02, 0.02, TABLE_Z))).length < 0.08:
                continue
            _leaf(bm, c, rng.random() * math.tau, 0.012 + rng.random() * 0.01, rng)
        self.objects.append(common.mesh_object("loose-leaves", bm, leaf, None))

    def _table_things(self):
        """A folded linen cloth, a small iron knife with a wooden handle, a
        little bowl of dried leaves, and a scatter of seeds."""
        cloth = M.cloth("#d8cbb0", "#8a4f2f", "linen", 0.3, 0.04)
        c = common.box("table-cloth", (0.26, 0.2, 0.012), (0.36, 0.2, TABLE_Z + 0.006), cloth, None, bevel=0.004)
        c.rotation_euler = (0, 0, -0.25)
        self.objects.append(c)
        c2 = common.box("table-cloth2", (0.25, 0.19, 0.01), (0.365, 0.2, TABLE_Z + 0.017), cloth, None, bevel=0.004)
        c2.rotation_euler = (0, 0, -0.2)
        self.objects.append(c2)
        blade = common.box("knife-blade", (0.11, 0.018, 0.003), (-0.05, -0.2, TABLE_Z + 0.004), M.plain("#5c5650", 0.45, 0.6), None, bevel=0.001)
        handle = common.box("knife-handle", (0.08, 0.02, 0.014), (-0.145, -0.2, TABLE_Z + 0.008), M.wood("#6a4a2e", 8.0), None, bevel=0.004)
        for o in (blade, handle):
            o.rotation_euler = (0, 0, 0.0)
            self.objects.append(o)
        bowl = common.lathe("leaf-bowl", [(0.02, 0.0), (0.05, 0.012), (0.065, 0.03), (0.062, 0.034), (0.045, 0.014)], 24, TC.fired_clay("bowl-clay", "#a96a44", dust=0.15), None)
        bowl.location = (-0.36, 0.1, TABLE_Z)
        self.objects.append(bowl)
        self.objects.append(self._blob("bowl-leaves", Vector((-0.36, 0.1, TABLE_Z + 0.026)), (0.05, 0.05, 0.012), herb_material("#6a6a44", "#8e8656"), 7, 0.3))
        rng = self.rng
        bm = bmesh.new()
        for k in range(30):
            p = Vector((-0.2 + rng.gauss(0, 0.06), -0.05 + rng.gauss(0, 0.05), TABLE_Z + 0.002))
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.0025, matrix=Matrix.Translation(p) @ Matrix.Diagonal((1.4, 1.0, 0.7, 1.0)))
        self.objects.append(common.mesh_object("seeds", bm, M.plain("#5a3e24", 0.5), None))

    def _bundle(self, name, at, angle, mat, lying=False):
        """A bundle of dried herbs tied at the stems: many thin stems with
        small leaves, fanned toward the tops."""
        rng = self.rng
        bm = bmesh.new()
        n = 22 if not self.preview else 10
        for k in range(n):
            spread = (rng.random() - 0.5) * 0.5
            L = 0.16 + rng.random() * 0.06
            p0 = Vector((0.0, 0.0, 0.0))
            p1 = Vector((L * 0.5, spread * 0.05, 0.01))
            p2 = Vector((L, spread * 0.14, 0.012 + rng.random() * 0.01))
            _tube(bm, [p0, p1, p2], [0.0012, 0.001, 0.0008], 4)
            for j in range(5):
                t = 0.4 + 0.6 * j / 4
                q = p0.lerp(p1, t * 2) if t < 0.5 else p1.lerp(p2, (t - 0.5) * 2)
                _leaf(bm, q, rng.random() * math.tau, 0.008 + rng.random() * 0.006, rng)
        obj = common.mesh_object(name, bm, mat, None)
        R = Matrix.Rotation(angle, 4, "Z")
        if not lying:
            R = R @ Matrix.Rotation(-math.pi / 2, 4, "Y")
        obj.matrix_world = Matrix.Translation(at + Vector((0, 0, 0.006))) @ R
        return obj

    def _background(self):
        """Out of focus behind the table: herbs hanging from the beam, a niche
        of jars, a basket, the loom's frame by the wall."""
        rng = self.rng
        x0, y0, x1, y1, h = self.bounds
        leaf = herb_material("#66704a", "#948c5c")
        for k in range(9):
            x = -1.4 + k * 0.38 + rng.random() * 0.1
            self.objects.append(self._bundle(f"hang{k}", Vector((x, y1 - 0.45, h - 0.28)), math.pi / 2 + (rng.random() - 0.5) * 0.3, leaf))
            cord = common.box("hang-cord", (0.003, 0.003, 0.2), (x, y1 - 0.45, h - 0.18), M.plain("#6a4a2e", 0.8), None)
            self.objects.append(cord)
        # A niche with jars, cut into the north wall.
        niche = common.box("niche", (0.9, 0.3, 0.6), (-0.5, y1 + 0.1, 1.25), M.plain("#2a2018", 0.9), None)
        self.objects.append(niche)
        for k in range(3):
            j = common.lathe("niche-jar", [(0.03, 0.0), (0.09, 0.05), (0.1, 0.14), (0.05, 0.24), (0.045, 0.28)], 20, TC.fired_clay("niche-clay", "#a86a44", dust=0.25, scale=1.5), None)
            j.location = (-0.8 + k * 0.28, y1 + 0.05, 0.96)
            self.objects.append(j)
        for k in range(3):
            j = common.lathe("floor-jar", [(0.08, 0.0), (0.2, 0.15), (0.22, 0.4), (0.12, 0.6), (0.1, 0.66)], 24, TC.fired_clay("floor-jar-clay", "#9e6a48", dust=0.4, scale=2.5), None)
            j.location = (1.4 + k * 0.5, y1 - 0.35, 0.0)
            self.objects.append(j)
        basket = common.lathe("basket", [(0.15, 0.0), (0.22, 0.2), (0.23, 0.3)], 28, M.straw("#b39463"), None)
        basket.location = (-1.3, y1 - 0.5, 0.0)
        self.objects.append(basket)
        wood = C.wood("loom-wood", "#5e4630")
        for sx in (2.3, 3.1):
            self.objects.append(common.box("loom-post", (0.07, 0.07, 1.9), (sx, y1 - 0.25, 0.95), wood, None))
        self.objects.append(common.box("loom-beam", (0.95, 0.08, 0.08), (2.7, y1 - 0.25, 1.85), wood, None))
        warp = common.box("loom-cloth", (0.7, 0.01, 0.9), (2.7, y1 - 0.26, 1.3), M.textile(["#7a3b30", "#d6cab0", "#3f5a74", "#d6cab0"], "loom-textile", band=0.08), None)
        self.objects.append(warp)

    def _blob(self, name, centre, radii, mat, seed, rough):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=1.0)
        o = Vector((seed * 3.1, seed * 1.7, seed * 0.3))
        for v in bm.verts:
            d = 1.0 + rough * mnoise.noise(v.co * 3.0 + o)
            v.co = Vector((v.co.x * radii[0] * d, v.co.y * radii[1] * d, v.co.z * radii[2] * d)) + centre
        return common.mesh_object(name, bm, mat, None)

    def flicker(self, t):
        """The lamp's flame breathes and wavers."""
        import teaser_noise as N
        import numpy as np

        n = float(N.fbm(np.array([t * 3.0]), np.array([0.5]), 3, seed=17)[0])
        if self.lamp:
            self.lamp.data.energy = 9.0 * (1.0 + 0.12 * n)
        if self.flame:
            self.flame.scale = (1.0 + 0.05 * n, 1.0 + 0.05 * n, 1.0 + 0.12 * n)
            self.flame.rotation_euler = (0.06 * n, 0.04 * math.sin(t * 5.0), 0.0)


def _tube(bm, pts, radii, seg):
    rings = []
    n = len(pts)
    for i, (p, r) in enumerate(zip(pts, radii)):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        if d.length < 1e-9:
            d = Vector((0, 0, 1))
        d.normalize()
        side = d.orthogonal().normalized()
        up = d.cross(side).normalized()
        rings.append([bm.verts.new(p + (side * math.cos(math.tau * j / seg) + up * math.sin(math.tau * j / seg)) * r) for j in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for j in range(seg):
            k = (j + 1) % seg
            bm.faces.new((a[j], a[k], b[k], b[j]))


def _leaf(bm, c, angle, size, rng):
    """A small lance-shaped leaf, a little curled."""
    ca, sa = math.cos(angle), math.sin(angle)
    pts = []
    for j in range(5):
        t = j / 4
        w = math.sin(math.pi * t) * size * 0.35
        along = Vector((ca, sa, 0)) * (t * size)
        side = Vector((-sa, ca, 0)) * w
        lift = Vector((0, 0, 0.3 * size * t * t + rng.random() * 0.0005))
        pts.append((c + along + side + lift, c + along - side + lift))
    verts = [(bm.verts.new(a), bm.verts.new(b)) for a, b in pts]
    for (a0, b0), (a1, b1) in zip(verts, verts[1:]):
        bm.faces.new((a0, b0, b1, a1))
