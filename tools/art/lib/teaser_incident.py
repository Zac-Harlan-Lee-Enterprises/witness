"""Below the bend: the scene the player comes on in the road down to
Jericho, for the teaser's shots 6 and 7.

Laid out from the game's own map of the road (jericho-road, tools/art/data/
chapter.json), whose tiles are metres: a broken oil jar lies in the road
(40, 14), a single line of sandal prints comes down the road (36, 13), many
prints lead off north up the gully (42, 11), a cut purse lies in the road
(41, 13), a strip of cloth is caught on a thornbush (43, 12), drag marks
lead off the road to the south (43, 16), and there, in the shade of the
rocks (45-46, 16-17), a man lies very still (44, 17). The set keeps those
places relative to the jar: `a` metres along the road (east, downhill), `b`
metres to its left (north).

The oil soaked into the dust long ago ("the spilled oil dried long ago"):
the stain is dark and dull, not wet.
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils import noise as mnoise

import common
import rocks
import materials as M
import teaser_city as C
import teaser_noise as N
import teaser_props as PR
from teaser_nodes import Graph

# Game map (x east, y south) -> set (a along the road, b to its left):
# the jar's tile is (40, 14); the road's centre line is between rows 13 and 14.
GAME_JAR = (40.0, 14.0)


def from_game(x, y):
    return (x - GAME_JAR[0], -(y - 13.5))


# ── materials ────────────────────────────────────────────────────────────────
def clay_outer():
    def build():
        g = Graph("jar-outer")
        pos = g.coords("Object")
        col = g.mix(g.map(g.noise(pos, 14.0, 5.0), 0.3, 0.7), "#9d6440", "#bd8458")
        # Slip wiped thin in places; dust settled.
        col = g.mix(g.mul(g.smooth(g.noise(pos, 5.0, 3.0), 0.55, 0.7), 0.35), col, "#c9a37a")
        col = g.mix(g.mul(g.smooth(g.noise(pos, 22.0, 3.0), 0.5, 0.7), 0.3), col, "#cdb894")
        rings = g.wave(pos, 90.0, 1.5, 2.0, "BANDS", "Z")
        g.principled(col, 0.78, 0.3, g.bump(g.add(g.noise(pos, 60.0, 4.0), g.mul(rings, 0.2)), 0.2, 0.001))
        return g.mat

    return C._cached("jar-outer", build)


def clay_inner():
    def build():
        g = Graph("jar-inner")
        pos = g.coords("Object")
        col = g.mix(g.map(g.noise(pos, 12.0, 4.0), 0.3, 0.7), "#5a3a24", "#7a5234")
        g.principled(col, 0.5, 0.4, g.bump(g.noise(pos, 50.0, 3.0), 0.2, 0.001))
        return g.mat

    return C._cached("jar-inner", build)


def clay_break():
    def build():
        g = Graph("jar-break")
        pos = g.coords("Object")
        col = g.mix(g.map(g.noise(pos, 80.0, 4.0), 0.3, 0.7), "#b8764a", "#d09268")
        g.principled(col, 0.92, 0.2, g.bump(g.noise(pos, 300.0, 3.0), 0.6, 0.0005))
        return g.mat

    return C._cached("jar-break", build)


def pebble_material(kind):
    colours = {"flint": ("#6a5c4c", "#8a7864"), "lime": ("#c2b393", "#ddd0b2"), "brown": ("#9a7e5c", "#b89c76")}
    a, b = colours[kind]

    def build():
        g = Graph(f"pebble-{kind}")
        pos = g.coords("Object")
        col = g.mix(g.map(g.noise(pos, 40.0, 4.0), 0.3, 0.7), a, b)
        col = g.mix(g.mul(g.object_random(), 0.5), col, a)
        g.principled(col, 0.7 if kind == "flint" else 0.9, 0.3, g.bump(g.noise(pos, 8.0, 4.0), 0.6, 0.05))
        return g.mat

    return C._cached(f"pebble-{kind}", build)


def grass_material():
    def build():
        g = Graph("dry-grass")
        pos = g.coords("Object")
        col = g.mix(g.map(g.noise(pos, 20.0, 3.0), 0.3, 0.7), "#a89468", "#cfbf92")
        g.principled(col, 0.7, 0.3, None)
        g.mat.use_backface_culling = False
        return g.mat

    return C._cached("dry-grass", build)


# ── the jar and its shards ───────────────────────────────────────────────────
JAR_H = 0.46


def jar_radius(h):
    """Outer radius of the oil jar at height h (a round body, a narrow neck)."""
    pts = [(0.0, 0.06), (0.03, 0.11), (0.1, 0.16), (0.2, 0.172), (0.28, 0.15), (0.33, 0.1), (0.36, 0.055), (0.42, 0.048), (0.44, 0.06), JAR_H and (JAR_H, 0.058)]
    hs = [p[0] for p in pts]
    rs = [p[1] for p in pts]
    return float(np.interp(h, hs, rs))


def shard_mesh(name, a0, a1, h0, h1, rng, thick=0.009, na=10, nh=8, full=False, jag=(0.07, 0.014)):
    """A piece of the jar's wall between angles a0..a1 and heights h0..h1,
    its outline broken irregularly, with thickness and raw broken edges.
    Materials: 0 outside, 1 inside, 2 the fresh break."""
    bm = bmesh.new()
    grid = []
    for j in range(nh + 1):
        row = []
        for i in range(na + 1):
            a = a0 + (a1 - a0) * i / na
            h = h0 + (h1 - h0) * j / nh
            # Jag the outline: boundary points pushed in at random.
            if not full and i in (0, na) and 0 < j < nh:
                a += (1 if i == 0 else -1) * rng.random() * jag[0]
            if j in (0, nh) and not (h0 <= 0.0 and j == 0) and not (h1 >= JAR_H and j == nh):
                h += (1 if j == 0 else -1) * rng.random() * jag[1] * (1.6 if 0 < i < na else 0.6)
            row.append((a, h))
        grid.append(row)

    def point(a, h, inset):
        r = jar_radius(h)
        dr = (jar_radius(h + 0.003) - jar_radius(h - 0.003)) / 0.006
        n = Vector((math.cos(a), math.sin(a), -dr)).normalized()
        p = Vector((r * math.cos(a), r * math.sin(a), h))
        return p - n * inset

    outer = [[bm.verts.new(point(a, h, 0.0)) for a, h in row] for row in grid]
    inner = [[bm.verts.new(point(a, h, thick)) for a, h in row] for row in grid]
    cols = na if not full else na
    for j in range(nh):
        for i in range(cols):
            f = bm.faces.new((outer[j][i], outer[j][i + 1], outer[j + 1][i + 1], outer[j + 1][i]))
            f.material_index = 0
            f = bm.faces.new((inner[j][i], inner[j + 1][i], inner[j + 1][i + 1], inner[j][i + 1]))
            f.material_index = 1
    # Broken edges round the outline.
    loops = [[(0, i) for i in range(na + 1)], [(nh, i) for i in range(na + 1)]]
    if not full:
        loops += [[(j, 0) for j in range(nh + 1)], [(j, na) for j in range(nh + 1)]]
    for loop in loops:
        for (j0, i0), (j1, i1) in zip(loop, loop[1:]):
            f = bm.faces.new((outer[j0][i0], inner[j0][i0], inner[j1][i1], outer[j1][i1]))
            f.material_index = 2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for mat in (clay_outer(), clay_inner(), clay_break()):
        me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def handle(name, a, rng):
    """A loop handle from the shoulder to the neck."""
    bm = bmesh.new()
    pts = []
    for k in range(9):
        t = k / 8
        h = 0.3 + 0.1 * t
        r = jar_radius(h) + 0.045 * math.sin(math.pi * t) + 0.004
        pts.append(Vector((r * math.cos(a), r * math.sin(a), h + 0.02 * math.sin(math.pi * t))))
    _tube(bm, pts, [0.011] * len(pts), 10)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(clay_outer())
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    for p in me.polygons:
        p.use_smooth = True
    return obj


def _tube(bm, pts, radii, seg):
    rings = []
    n = len(pts)
    for i, (p, r) in enumerate(zip(pts, radii)):
        d = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        d.normalize()
        side = d.orthogonal().normalized()
        up = d.cross(side).normalized()
        rings.append([bm.verts.new(p + (side * math.cos(math.tau * j / seg) + up * math.sin(math.tau * j / seg)) * r) for j in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for j in range(seg):
            k = (j + 1) % seg
            bm.faces.new((a[j], a[k], b[k], b[j]))


class Incident:
    """The set below the bend, placed on the land's road at arc length s."""

    def __init__(self, land, s=2600.0, seed=12, preview=False):
        self.land = land
        self.rng = random.Random(seed)
        self.preview = preview
        road = land.road
        p = road.point(s)
        q = road.point(s + 5.0)
        u = (q - p) / np.linalg.norm(q - p)
        self.O = p
        self.u = u
        self.v = np.array([-u[1], u[0]])
        self.heading = math.atan2(u[1], u[0])
        self.objects = []
        self.prints = []
        self.drags = []

    def w(self, a, b):
        """Set coordinates (a along the road, b to its left) to world x, y."""
        return self.O + self.u * a + self.v * b

    def local(self, x, y):
        d0 = np.asarray(x) - self.O[0]
        d1 = np.asarray(y) - self.O[1]
        return d0 * self.u[0] + d1 * self.u[1], d0 * self.v[0] + d1 * self.v[1]

    def z(self, a, b):
        x, y = self.w(a, b)
        return float(self.land.height(np.array([x]), np.array([y]))[0])

    def P(self, a, b, up=0.0):
        x, y = self.w(a, b)
        return Vector((x, y, self.z(a, b) + up))

    # ── marks in the dust ────────────────────────────────────────────────────
    def plan_marks(self):
        rng = self.rng
        # One walker coming down the road (game 36, 13): left, right, left...
        a0, b0 = from_game(36.0, 13.2)
        for k in range(9):
            self.prints.append((a0 - 2.0 + k * 0.62, b0 + (0.09 if k % 2 else -0.09) + rng.uniform(-0.02, 0.02), rng.uniform(-0.08, 0.08), 0.26, 0.012))
        # Many feet going north up the gully (game 42, 11): prints over prints.
        a1, b1 = from_game(42.0, 11.5)
        for k in range(26):
            self.prints.append((a1 + rng.uniform(-1.2, 1.4), b1 + rng.uniform(-1.8, 2.2), math.pi / 2 + rng.uniform(-0.5, 0.5), rng.uniform(0.25, 0.29), rng.uniform(0.01, 0.018)))
        # Scuffs round the jar where they stood.
        for k in range(10):
            self.prints.append((rng.uniform(-0.6, 2.4), rng.uniform(-1.4, 1.2), rng.uniform(0, math.tau), rng.uniform(0.24, 0.28), rng.uniform(0.008, 0.014)))
        # Drag marks off the road to the south (game 43, 16) toward the rocks.
        s0 = from_game(43.0, 15.0)
        s1 = from_game(44.0, 16.9)
        self.drags.append((s0, s1))
        self.land.marks.append(self._stamp)

    def _stamp(self, x, y, h):
        shape = np.shape(h)
        hf = np.asarray(h, dtype=np.float64).ravel().copy()
        a, b = self.local(np.ravel(x), np.ravel(y))
        for pa, pb, ang, L, depth in self.prints:
            m = (np.abs(a - pa) < 0.3) & (np.abs(b - pb) < 0.3)
            if not m.any():
                continue
            da, db = a[m] - pa, b[m] - pb
            ca, sa = math.cos(ang), math.sin(ang)
            along = da * ca + db * sa
            across = -da * sa + db * ca
            t = along / L + 0.5  # 0 heel .. 1 toe
            width = np.interp(t, [0.0, 0.1, 0.35, 0.55, 0.78, 0.95, 1.0], [0.03, 0.075, 0.062, 0.07, 0.1, 0.075, 0.02]) / 2
            inside_len = np.clip(1.0 - np.abs(t - 0.5) * 2.0, 0.0, 1.0)
            r = np.abs(across) / np.maximum(width, 1e-3)
            core = (1.0 - N.smoothstep(0.75, 1.05, r)) * N.smoothstep(0.0, 0.08, inside_len)
            heel = 0.75 + 0.35 * N.smoothstep(0.7, 0.1, t)
            rim = np.exp(-((r - 1.2) / 0.25) ** 2) * N.smoothstep(0.0, 0.1, inside_len) * 0.35
            hf[m] = hf[m] - depth * core * heel + depth * rim
        for (sa0, sb0), (sa1, sb1) in self.drags:
            da = sa1 - sa0
            db = sb1 - sb0
            L2 = da * da + db * db
            t = np.clip(((a - sa0) * da + (b - sb0) * db) / L2, 0.0, 1.0)
            pa = sa0 + t * da
            pb = sb0 + t * db
            dist_along_perp = (-(a - pa) * db + (b - pb) * da) / math.sqrt(L2)
            near = (np.abs(dist_along_perp) < 0.4) & (t > 0.0) & (t < 1.0)
            for off in (-0.13, 0.13):
                d = np.abs(dist_along_perp - off - 0.03 * np.sin(t * 9.0))
                furrow = np.exp(-(d / 0.045) ** 2) * (1.0 - 0.4 * t)
                bank = np.exp(-((d - 0.075) / 0.03) ** 2) * 0.35
                hf[near] = hf[near] - 0.022 * furrow[near] + 0.022 * bank[near]
        return hf.reshape(shape)

    def oil(self, x, y):
        """The oil stain: dark where it soaked in, spreading downhill."""
        a, b = self.local(x, y)
        ca, cb = 0.15, -0.55
        da = (a - ca) / 0.75
        db = (b - cb) / 0.42
        warp = 0.35 * N.fbm(a * 3.0, b * 3.0, 3, seed=61)
        r = np.sqrt(da * da + db * db) + warp
        stain = 1.0 - N.smoothstep(0.75, 1.0, r)
        # Splashes round it.
        sp = N.perlin(a * 18.0, b * 18.0, 62)
        splash = (sp > 0.28) & (r < 1.6)
        return np.clip(stain + splash * 0.6, 0.0, 1.0)

    # ── things ──────────────────────────────────────────────────────────────
    def build(self, with_man=True):
        self.jar()
        self.purse()
        self.cloth_bush()
        self.rocks()
        self.pebbles()
        self.grass()
        if with_man:
            self.man_place = (from_game(44.0, 17.3), -0.25)
        return self

    def place(self, obj, a, b, yaw=0.0, up=0.0, tilt=None):
        M_ = Matrix.Translation(self.P(a, b, up)) @ Matrix.Rotation(self.heading + yaw, 4, "Z")
        if tilt is not None:
            M_ = M_ @ tilt
        obj.matrix_world = M_
        self.objects.append(obj)

    def jar(self):
        """The oil jar, broken where it fell: its base still upright in the
        stain, the neck with its handles on its side, shards all round."""
        rng = self.rng
        ca, cb = 0.1, -0.6
        base = shard_mesh("jar-base", 0.0, math.tau, 0.0, 0.085, rng, full=True, na=48, nh=4)
        disc = common.lathe("jar-bottom", [(0.0, 0.0), (0.06, 0.0), (0.06, 0.009), (0.0, 0.009)], 32, clay_outer(), None)
        disc.parent = base
        self.place(base, ca, cb, rng.random(), -0.012, Matrix.Rotation(0.06, 4, "X"))
        self.objects.append(disc)
        neck = shard_mesh("jar-neck", 0.0, math.tau, 0.315, JAR_H, rng, full=True, na=48, nh=8)
        for k, a in enumerate((0.0, math.pi)):
            hnd = handle(f"jar-handle{k}", a, rng)
            hnd.parent = neck
        # On its side: the jar's axis laid along the ground.
        self.place(neck, ca + 0.62, cb - 0.12, 0.9, 0.055, Matrix.Rotation(math.pi / 2, 4, "Y") @ Matrix.Translation((0, 0, -0.38)))
        for o in neck.children:
            self.objects.append(o)
        pieces = []
        a = 0.0
        while a < math.tau - 0.3:
            w = rng.uniform(0.45, 1.1)
            split = rng.uniform(0.15, 0.24)
            pieces.append((a, min(math.tau, a + w), 0.085, split))
            pieces.append((a + rng.uniform(-0.1, 0.1), min(math.tau, a + w + rng.uniform(-0.1, 0.1)), split, 0.315))
            a += w
        for k, (a0, a1, h0, h1) in enumerate(pieces):
            sh = shard_mesh(f"shard{k}", a0, a1, h0, h1, rng)
            mid_a = (a0 + a1) / 2
            n = Vector((math.cos(mid_a), math.sin(mid_a), 0.0))
            face_down = rng.random() < 0.55
            # Turn the shard so its outer face looks down (or up), then lay it down.
            q = n.rotation_difference(Vector((0, 0, -1 if face_down else 1)))
            centre = Vector((jar_radius((h0 + h1) / 2) * math.cos(mid_a), jar_radius((h0 + h1) / 2) * math.sin(mid_a), (h0 + h1) / 2))
            rot = q.to_matrix().to_4x4() @ Matrix.Translation(-centre)
            ang = rng.uniform(0, math.tau)
            dist = rng.uniform(0.18, 0.95) * (1.3 if math.cos(ang) > 0 else 0.8)
            lift = 0.012 if face_down else 0.035
            self.place(sh, ca + math.cos(ang) * dist, cb + math.sin(ang) * dist * 0.8, rng.uniform(0, math.tau), lift, rot)
        # Crumbs of clay.
        bm = bmesh.new()
        for k in range(40):
            c = Vector((rng.uniform(-0.7, 0.9), rng.uniform(-0.6, 0.6), 0.0))
            s = rng.uniform(0.004, 0.012)
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=s, matrix=Matrix.Translation(c))
        crumbs = common.mesh_object("jar-crumbs", bm, clay_break(), None, smooth=False)
        self.place(crumbs, ca, cb, 0.0, 0.002)

    def purse(self):
        """The cut purse: an empty leather pouch, its strings cut (game 41, 13)."""
        a, b = from_game(41.0, 13.3)
        leather = M.leather("#6a4a2c")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=1.0)
        for v in bm.verts:
            x, y, z = v.co
            sag = 1.0 - 0.35 * max(0.0, z)
            v.co = Vector((x * 0.075 * sag, y * 0.06, z * 0.02 + 0.02 + 0.006 * mnoise.noise(v.co * 3)))
        pouch = common.mesh_object("purse", bm, leather, None)
        self.place(pouch, a, b, 0.4, 0.0)
        bm = bmesh.new()
        for k in range(2):
            p0 = Vector((0.06, 0.0, 0.03))
            p1 = p0 + Vector((0.06 + k * 0.03, -0.03 + k * 0.05, -0.02))
            _tube(bm, [p0, p0.lerp(p1, 0.5) + Vector((0, 0, 0.004)), p1], [0.0025, 0.0025, 0.002], 6)
        strings = common.mesh_object("purse-strings", bm, M.leather("#4a3220"), None)
        self.place(strings, a, b, 0.4, 0.0)

    def cloth_bush(self):
        """A thornbush at the roadside with a torn strip of cloth caught on it
        (game 43, 12): a blue stripe on brown wool."""
        a, b = from_game(43.0, 12.2)
        bush = PR.shrub("thornbush", 0.55, 0.5, seed=31)
        self.place(bush, a, b, 0.0, -0.02)
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        grid = []
        for j in range(8):
            t = j / 7
            row = []
            for i in range(3):
                s = i / 2
                row.append(bm.verts.new((-0.18 + t * 0.34, -0.1 - s * 0.06 + 0.02 * math.sin(t * 6), 0.46 - t * 0.28 + 0.03 * math.sin(t * 9 + s))))
            grid.append(row)
        for j in range(7):
            for i in range(2):
                f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                for loop, (uu, vv) in zip(f.loops, ((i / 2, j / 7), ((i + 1) / 2, j / 7), ((i + 1) / 2, (j + 1) / 7), (i / 2, (j + 1) / 7))):
                    loop[uvl].uv = (uu, vv)
        rag = common.mesh_object("torn-cloth", bm, M.cloth("#6f5a3a", "#3f6f8f", "wool", 0.0, 0.2), None)
        common.add_modifier(rag, "SOLIDIFY", thickness=0.004)
        self.place(rag, a, b, 0.0, 0.0)

    def rocks(self):
        """The rocks the man lies in the shade of (game 45-46, 16-17), and
        stones along the road's edges."""
        red = M.rock("#c2a584", "teaser-red-rock", lichen=0.35, red=0.6)
        pale = M.rock("#c9b996", "teaser-road-rock", lichen=0.2, red=0.15)
        for k, (gx, gy, s) in enumerate(((45.6, 16.2, (1.3, 1.1, 1.3)), (45.9, 17.6, (1.5, 1.2, 1.5)), (47.0, 16.8, (1.2, 1.0, 1.1)))):
            a, b = from_game(gx, gy)
            r = rocks.stone(f"rock{k}", Vector((0, 0, 0)), s, red, 400 + k, flat=0.6, blocky=0.6, n=60, sink=0.3)
            craggy(r, 0.22, 2.6, 400 + k)
            self.place(r, a, b, self.rng.uniform(0, math.tau), -0.1)
        for k in range(18):
            side = 1 if k % 2 else -1
            a = self.rng.uniform(-9.0, 8.0)
            b = side * self.rng.uniform(1.9, 3.4)
            s = self.rng.uniform(0.1, 0.3)
            r = rocks.stone(f"edge-stone{k}", Vector((0, 0, 0)), (s, s * 0.8, s * 0.55), pale, 460 + k, flat=0.55, blocky=0.7, sink=0.35)
            craggy(r, 0.025, 6.0, 460 + k)
            self.place(r, a, b, self.rng.uniform(0, math.tau), 0.0)

    def pebbles(self):
        """The road's gravel: small flints and limestone pieces, half sunk."""
        rng = np.random.default_rng(71)
        protos = []
        kinds = ("lime", "lime", "brown", "lime", "flint", "brown", "lime", "lime")
        for k, kind in enumerate(kinds):
            protos.append(rocks.stone(f"pebble{k}", Vector((0, 0, 0)), (1.0, 0.8, 0.65), pebble_material(kind), 800 + k, flat=0.75, blocky=0.6, n=22, sink=0.0, smooth=0))
        n_near = 6000 if self.preview else 36000
        n_far = 3000 if self.preview else 16000
        r = np.concatenate([np.sqrt(rng.random(n_near)) * 5.0, 5.0 + rng.random(n_far) * 20.0])
        th = rng.random(len(r)) * math.tau
        a = 1.5 + r * np.cos(th)
        b = r * np.sin(th) * 0.9
        # Fewer on the trodden road, none in the oil.
        x = self.O[0] + self.u[0] * a + self.v[0] * b
        y = self.O[1] + self.u[1] * a + self.v[1] * b
        on_road = np.abs(b) < 1.4
        # Gravel lies in drifts: thick in patches, bare between.
        drift = np.clip(N.fbm(a / 1.8, b / 1.8, 3, seed=73) * 1.4 + 0.3, 0.05, 1.0)
        keep = rng.random(len(r)) < np.where(on_road, 0.3, 0.9) * drift
        keep &= self.oil(x, y) < 0.5
        x, y = x[keep], y[keep]
        z = self.land.height(x, y)
        m = len(x)
        size = np.exp(rng.normal(np.log(0.011), 0.6, m)).clip(0.004, 0.06)
        pts = np.stack([x, y, z - size * 0.3], axis=1)
        rot = np.stack([rng.uniform(-0.5, 0.5, m), rng.uniform(-0.5, 0.5, m), rng.uniform(0, math.tau, m)], axis=1)
        idx = rng.integers(0, len(protos), m)
        self.objects.append(PR.instancer("pebbles", pts, protos, idx, rot, size))

    def grass(self):
        """A few tufts of last year's grass, dry and pale, off the road."""
        rng = self.rng
        mat = grass_material()
        for k in range(26 if not self.preview else 10):
            a = rng.uniform(-8.0, 9.0)
            b = rng.choice([-1, 1]) * rng.uniform(2.2, 6.0)
            bm = bmesh.new()
            for j in range(18):
                ang = rng.uniform(0, math.tau)
                h = rng.uniform(0.08, 0.2)
                lean = rng.uniform(0.2, 0.7)
                p0 = Vector((math.cos(ang) * 0.02, math.sin(ang) * 0.02, 0.0))
                p1 = p0 + Vector((math.cos(ang) * lean * h, math.sin(ang) * lean * h, h))
                side = Vector((-math.sin(ang), math.cos(ang), 0.0)) * 0.002
                bm.faces.new((bm.verts.new(p0 - side), bm.verts.new(p0 + side), bm.verts.new(p1)))
            tuft = common.mesh_object(f"tuft{k}", bm, mat, None)
            self.place(tuft, a, b, 0.0, -0.005)

    def attributes(self, X, Y, Z):
        return {"oil": self.oil(X, Y)}


def craggy(obj, strength, scale, seed):
    """Weather a stone's flat facets: subdivide and push the surface in and
    out by cellular noise (pits, ledges, spalled edges)."""
    import common as _c

    _c.add_modifier(obj, "SUBSURF", levels=3, render_levels=3, subdivision_type="SIMPLE")
    tex = bpy.data.textures.new(f"crag-{seed}", "VORONOI")
    tex.noise_scale = 1.0 / scale
    tex.distance_metric = "DISTANCE"
    mod = _c.add_modifier(obj, "DISPLACE", texture=tex, strength=strength, mid_level=0.6)
    mod.texture_coords = "LOCAL"
    tex2 = bpy.data.textures.new(f"crag2-{seed}", "CLOUDS")
    tex2.noise_scale = 0.35 / scale
    mod2 = _c.add_modifier(obj, "DISPLACE", texture=tex2, strength=strength * 0.5, mid_level=0.5)
    mod2.texture_coords = "LOCAL"
    return obj
