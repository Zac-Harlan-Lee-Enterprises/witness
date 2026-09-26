"""The lower market of Jerusalem, built in 3D from the game's tile map.

Every visible thing is placed from the map, so the art always matches the
collision grid:
  - ground: a splat-blended earth plane, worn limestone paving slabs laid
    in courses, steps, dry grass on the scrub, scattered grit and leaves;
  - buildings: dressed limestone fronts (drafted-margin ashlar) rising from
    the front-wall row, flat plaster roofs with parapets and roof life,
    doorways and small grilled windows;
  - props from tiles and entities: stalls with striped awnings and produce,
    storage jars, sacks, baskets, crates, a well, an oven, cloth racks, a
    goat-hair tent, a trough, a low stone wall, boulders, olive trees,
    donkeys, signs, vessels and a cart.

Each standing thing is a *sprite object*: it gets its own render, and the
game sorts it by `base` (the ground line in game units) against people.

Coordinates: game tiles (x east, y south) -> Blender (x, -y); heights in
tiles. Screen position of a point = (x, y - z) in tiles.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import materials as M
import scatter

T = 1.0  # one tile, in Blender units


def B(x, y, z=0.0):
    """Game tile coordinates to Blender."""
    return Vector((x, -y, z))


# ── map reading ─────────────────────────────────────────────────────────────
class Map:
    def __init__(self, scene):
        self.id = scene["id"]
        self.rows = scene["layout"]
        self.legend = scene["legend"]
        self.h = len(self.rows)
        self.w = len(self.rows[0])
        self.entities = scene["entities"]

    def kind(self, x, y):
        if x < 0 or y < 0 or x >= self.w or y >= self.h:
            return "void"
        return self.legend[self.rows[y][x]]

    def runs(self, kind):
        """Horizontal runs of a tile kind: (x0, x1_exclusive, y)."""
        out = []
        for y in range(self.h):
            x = 0
            while x < self.w:
                if self.kind(x, y) == kind:
                    x0 = x
                    while x < self.w and self.kind(x, y) == kind:
                        x += 1
                    out.append((x0, x, y))
                else:
                    x += 1
        return out

    def tiles(self, kind):
        return [(x, y) for y in range(self.h) for x in range(self.w) if self.kind(x, y) == kind]


class Sprite:
    """A standing thing rendered on its own and depth-sorted by the game."""

    def __init__(self, sid, base, objects, tiles=None):
        self.id = sid
        self.base = base  # ground line, game units (y)
        self.objects = objects
        self.tiles = tiles or []


# ── noise for maps ──────────────────────────────────────────────────────────
def value_noise(w, h, cell, seed):
    rng = np.random.default_rng(seed)
    gw, gh = int(w / cell) + 3, int(h / cell) + 3
    g = rng.random((gh, gw))
    ys, xs = np.mgrid[0:h, 0:w] / cell
    x0 = xs.astype(int)
    y0 = ys.astype(int)
    tx = xs - x0
    ty = ys - y0
    tx = tx * tx * (3 - 2 * tx)
    ty = ty * ty * (3 - 2 * ty)
    a = g[y0, x0]
    b = g[y0, x0 + 1]
    c = g[y0 + 1, x0]
    d = g[y0 + 1, x0 + 1]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty


# ── the builder ─────────────────────────────────────────────────────────────
class Market:
    def __init__(self, scene_data, seed=11):
        self.map = Map(scene_data)
        self.rng = common.rng(seed)
        self.sprites = []
        self.ground_objects = []
        self.col_ground = common.collection("ground")
        self.limestone = M.limestone("#d8c39b", "ashlar")
        self.paving = M.limestone("#cfb993", "paving", worn=0.35)
        self.roof = M.plaster("#d4c19c", "roof-plaster")
        self.wood = M.wood("#6f5134", 5.0)
        self.dark = M.plain("#1f1812", 0.9, 0.1)

    def build(self):
        self._ground()
        self._paving()
        self._steps()
        self._grass()
        self._buildings()
        self._props()
        self._litter()
        return self

    # ── ground ──────────────────────────────────────────────────────────────
    def _ground(self):
        m = self.map
        px = 16  # splat pixels per tile
        W, H = m.w * px, m.h * px
        warp = (value_noise(W, H, 10, 3) - 0.5) * 7 + (value_noise(W, H, 3, 4) - 0.5) * 2.5
        warp2 = (value_noise(W, H, 10, 5) - 0.5) * 7 + (value_noise(W, H, 3, 6) - 0.5) * 2.5
        ys, xs = np.mgrid[0:H, 0:W]
        tx = np.clip(((xs + warp) / px).astype(int), 0, m.w - 1)
        ty = np.clip(((ys + warp2) / px).astype(int), 0, m.h - 1)
        kinds = np.array([[m.kind(x, y) for x in range(m.w)] for y in range(m.h)])
        k = kinds[ty, tx]
        bed = np.isin(k, ["paving", "steps", "gate", "well"]).astype(np.float32)
        scrub = np.isin(k, ["scrub", "cloth"]).astype(np.float32)
        # Worn paths: sand beside paving, doors and the gate is trodden lighter.
        near = np.zeros((m.h, m.w), dtype=np.float32)
        for y in range(m.h):
            for x in range(m.w):
                if m.kind(x, y) in ("sand",) and any(
                    m.kind(x + dx, y + dy) in ("paving", "door", "gate", "steps") for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                ):
                    near[y, x] = 1.0
        path = near[ty, tx] * np.clip(value_noise(W, H, 12, 8) * 1.6 - 0.2, 0, 1)
        img = np.zeros((H, W, 4), dtype=np.float32)
        img[..., 0] = bed
        img[..., 1] = scrub * np.clip(value_noise(W, H, 6, 9) * 1.4, 0, 1)
        img[..., 2] = path
        img[..., 3] = 1.0
        splat = bpy.data.images.new("splat", W, H, alpha=True, float_buffer=True)
        splat.colorspace_settings.name = "Non-Color"
        splat.pixels.foreach_set(img[::-1].reshape(-1))
        splat.pack()
        colors = {"sand": "#c8ac82", "scrub": "#a8956a", "bed": "#8a7658", "path": "#d0b98f"}
        mat = M.ground(splat, colors)
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=m.w * 4, y_subdivisions=m.h * 4, size=1.0)
        g = bpy.context.object
        g.name = "ground"
        g.scale = (m.w, m.h, 1)
        g.location = (m.w / 2, -m.h / 2, 0)
        g.data.materials.append(mat)
        for c in g.users_collection:
            c.objects.unlink(g)
        self.col_ground.objects.link(g)
        # Gentle undulation of the earth.
        tex = bpy.data.textures.new("ground-disp", "CLOUDS")
        tex.noise_scale = 0.8
        common.add_modifier(g, "DISPLACE", texture=tex, strength=0.025, mid_level=0.5)
        self.ground_objects.append(g)

    def _paving(self):
        """Limestone slabs in courses, only where the map is paved."""
        m = self.map
        bm = bmesh.new()
        rnd_layer = bm.faces.layers.float.new("rand")
        rng = self.rng
        y = 0.0
        while y < m.h:
            row_h = 0.38 + rng.random() * 0.2
            x = -rng.random() * 0.8
            while x < m.w:
                length = 0.5 + rng.random() * 0.6
                cx, cy = x + length / 2, y + row_h / 2
                here = m.kind(int(cx), int(cy))
                edge = any(m.kind(int(cx) + dx, int(cy) + dy) not in ("paving", "gate", "well", "stall", "basket", "jars", "sacks") for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if here in ("paving", "gate") and rng.random() > (0.2 if edge else 0.02):
                    self._slab(bm, rnd_layer, x + 0.014, y + 0.014, length - 0.028, row_h - 0.028, rng)
                x += length
            y += row_h
        obj = common.mesh_object("paving", bm, self.paving, self.col_ground, smooth=False)
        self.ground_objects.append(obj)

    def _slab(self, bm, layer, x, y, w, h, rng, top=0.035):
        """A worn stone slab: rounded edges, a slightly domed top, some sunk or
        cracked. Built as a small grid so the wear catches the light."""
        sunk = rng.random() < 0.06
        z0 = top + (rng.random() - 0.5) * 0.014 - (0.018 if sunk else 0.0)
        tx = (rng.random() - 0.5) * 0.02
        ty = (rng.random() - 0.5) * 0.02
        r = rng.random()
        if rng.random() < 0.08 and w > 0.5:
            # A cracked slab: two pieces with a hairline gap.
            cut = w * (0.35 + rng.random() * 0.3)
            self._slab_piece(bm, layer, x, y, cut - 0.008, h, z0, tx, ty, r)
            self._slab_piece(bm, layer, x + cut + 0.008, y, w - cut - 0.008, h, z0 - 0.004, tx, ty, r)
            return
        self._slab_piece(bm, layer, x, y, w, h, z0, tx, ty, r)

    def _slab_piece(self, bm, layer, x, y, w, h, z0, tx, ty, r, n=4):
        edge = 0.035
        grid = []
        for j in range(n + 1):
            row = []
            for i in range(n + 1):
                u, v = i / n, j / n
                px = x + edge * 0.6 + (w - edge * 1.2) * u
                py = y + edge * 0.6 + (h - edge * 1.2) * v
                dome = 0.008 * math.sin(math.pi * u) * math.sin(math.pi * v)
                pz = z0 + dome + tx * (u - 0.5) + ty * (v - 0.5)
                row.append(bm.verts.new(B(px, py, pz)))
            grid.append(row)
        faces = []
        for j in range(n):
            for i in range(n):
                faces.append(bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1])))
        # Rounded sides down into the bed.
        ring = [grid[0][i] for i in range(n + 1)] + [grid[j][n] for j in range(1, n + 1)] + [grid[n][i] for i in range(n - 1, -1, -1)] + [grid[j][0] for j in range(n - 1, 0, -1)]
        low = []
        for v in ring:
            cx = min(max(v.co.x, x), x + w)
            cy = min(max(-v.co.y, y), y + h)
            ox = (cx - (x + w / 2)) / max(1e-6, w / 2)
            oy = (cy - (y + h / 2)) / max(1e-6, h / 2)
            low.append(bm.verts.new(B(x + w / 2 + ox * w / 2, y + h / 2 + oy * h / 2, -0.02)))
        for k in range(len(ring)):
            kk = (k + 1) % len(ring)
            faces.append(bm.faces.new((ring[k], low[k], low[kk], ring[kk])))
        for f in faces:
            f[layer] = r
            f.smooth = True

    def _steps(self):
        m = self.map
        for x0, x1, y in m.runs("steps"):
            bm = bmesh.new()
            layer = bm.faces.layers.float.new("rand")
            rng = self.rng
            for i in range(3):
                depth = 1.0 / 3
                y0 = y + 1 - (i + 1) * depth
                z = 0.11 * (i + 1)
                x = x0
                while x < x1:
                    length = min(x1 - x, 0.6 + rng.random() * 0.5)
                    cube = bmesh.ops.create_cube(bm, size=1.0)
                    for v in cube["verts"]:
                        v.co.x = x + 0.01 + (length - 0.02) * (v.co.x + 0.5)
                        v.co.y = -(y0 + depth * (0.5 - v.co.y) * 1.0 + 0.0)
                        v.co.z = z * (v.co.z + 0.5)
                    r = rng.random()
                    for f in bm.faces:
                        if f.verts[0] in cube["verts"]:
                            f[layer] = r
                    x += length
            obj = common.mesh_object(f"steps-{x0}-{y}", bm, self.paving, self.col_ground, smooth=False)
            self.ground_objects.append(obj)

    def _library(self):
        """Hidden source meshes for scattering (grass tufts, pebbles, leaves)."""
        if getattr(self, "_lib", None):
            return self._lib
        lib = bpy.data.collections.new("library")
        bpy.context.scene.collection.children.link(lib)
        lib.hide_render = True
        rng = self.rng
        tufts = bpy.data.collections.new("tufts")
        lib.children.link(tufts)
        grass = M.grass_blades()
        for t in range(5):
            bm = bmesh.new()
            blades = 7 + int(rng.random() * 8)
            for b in range(blades):
                ang = rng.random() * math.tau
                lean = 0.15 + rng.random() * 0.5
                length = 0.08 + rng.random() * 0.12
                w = 0.006 + rng.random() * 0.004
                base = Vector((math.cos(ang) * 0.02, math.sin(ang) * 0.02, 0))
                d = Vector((math.cos(ang) * lean, math.sin(ang) * lean, 1.0)).normalized()
                side = Vector((-math.sin(ang), math.cos(ang), 0)) * w
                pts = [base + d * length * k / 3 + Vector((0, 0, -0.02 * (k / 3) ** 2 * lean)) for k in range(4)]
                verts = []
                for k, p in enumerate(pts):
                    taper = 1 - k / 3.3
                    verts.append((bm.verts.new(p - side * taper), bm.verts.new(p + side * taper)))
                for a, b2 in zip(verts, verts[1:]):
                    bm.faces.new((a[0], a[1], b2[1], b2[0]))
            obj = common.mesh_object(f"tuft{t}", bm, grass, None)
            for c in obj.users_collection:
                c.objects.unlink(obj)
            tufts.objects.link(obj)
        pebbles = bpy.data.collections.new("pebbles")
        lib.children.link(pebbles)
        for t in range(4):
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
            sx, sy, sz = 0.6 + rng.random() * 0.5, 0.5 + rng.random() * 0.4, 0.3 + rng.random() * 0.2
            for v in bm.verts:
                n = math.sin(v.co.x * 4 + t) * 0.12 + math.sin(v.co.y * 5 + 1) * 0.1
                v.co = Vector((v.co.x * sx * (1 + n), v.co.y * sy * (1 + n), v.co.z * sz * (1 + n) + 0.1))
            obj = common.mesh_object(f"pebble{t}", bm, M.pebble(), None)
            for c in obj.users_collection:
                c.objects.unlink(obj)
            pebbles.objects.link(obj)
        leaves = bpy.data.collections.new("leaves")
        lib.children.link(leaves)
        leafmat = M.leaf("#56663c", "#8f9678")
        for t in range(3):
            bm = bmesh.new()
            L = 0.07 + t * 0.012
            W = 0.011 + t * 0.002
            pts = [(0, 0), (W, L * 0.3), (W * 0.8, L * 0.75), (0, L), (-W * 0.8, L * 0.75), (-W, L * 0.3)]
            vs = [bm.verts.new((x, y, (y / L) ** 2 * 0.01)) for x, y in pts]
            bm.faces.new(vs)
            obj = common.mesh_object(f"leaf{t}", bm, leafmat, None)
            for c in obj.users_collection:
                c.objects.unlink(obj)
            leaves.objects.link(obj)
        self._lib = {"tufts": tufts, "pebbles": pebbles, "leaves": leaves}
        return self._lib

    def _grass(self):
        """Dry grass tufts on the scrub, and grit and pebbles on bare ground."""
        m = self.map
        lib = self._library()
        cells = m.tiles("scrub") + m.tiles("cloth")
        if cells:
            # Patchy: keep sub-cells where a noise field says grass grows.
            sub = 4
            field = value_noise(m.w * sub + 4, m.h * sub + 4, 5, 21)
            bm = bmesh.new()
            for x, y in cells:
                for j in range(sub):
                    for i in range(sub):
                        if field[y * sub + j, x * sub + i] < 0.42:
                            continue
                        x0, y0 = x + i / sub, y + j / sub
                        v = [bm.verts.new(B(x0 + dx / sub, y0 + dy / sub, 0.015)) for dx, dy in ((0, 0), (1, 0), (1, 1), (0, 1))]
                        bm.faces.new(v[::-1])
            emitter = common.mesh_object("grass", bm, None, self.col_ground)
            scatter.scatter(emitter, lib["tufts"], 34.0, (0.6, 1.5), seed=3, rotate_z_only=True, pick=True)
            self.ground_objects.append(emitter)
        bare = m.tiles("sand") + m.tiles("scrub")
        bm = bmesh.new()
        for x, y in bare:
            v = [bm.verts.new(B(x + dx, y + dy, 0.01)) for dx, dy in ((0, 0), (1, 0), (1, 1), (0, 1))]
            bm.faces.new(v[::-1])
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        grit = common.mesh_object("grit", bm, None, self.col_ground)
        scatter.scatter(grit, lib["pebbles"], 7.0, (0.01, 0.032), seed=9, rotate_z_only=True, pick=True)
        self.ground_objects.append(grit)

    def _litter(self):
        """What a working market leaves on the ground: straw and chaff by the
        stalls and animals, a little dung by the donkeys, wet stone and earth
        at the well and trough, and rubble along the walls."""
        m = self.map
        rng = self.rng
        straw_mat = M.plain("#c2a86a", 0.8, 0.2)
        bm = bmesh.new()
        near = set()
        for kind in ("stall", "basket", "sacks", "trough", "tent"):
            for x, y in m.tiles(kind):
                for dx in (-1, 0, 1):
                    for dy in (0, 1):
                        near.add((x + dx, y + dy))
        for e in m.entities:
            if e["sprite"] in ("donkey", "basket") or e["id"] == "cart":
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        near.add((e["x"] + dx, e["y"] + dy))
        for x, y in sorted(near):
            if m.kind(x, y) not in ("sand", "paving", "scrub"):
                continue
            for _ in range(10 + int(rng.random() * 14)):
                cx, cy = x + rng.random(), y + rng.random()
                a = rng.random() * math.tau
                length = 0.03 + rng.random() * 0.05
                dx, dy = math.cos(a) * length / 2, math.sin(a) * length / 2
                w = 0.004
                v = [bm.verts.new(B(cx - dx - dy * w / length, cy - dy + dx * w / length, 0.042)), bm.verts.new(B(cx + dx - dy * w / length, cy + dy + dx * w / length, 0.042)), bm.verts.new(B(cx + dx + dy * w / length, cy + dy - dx * w / length, 0.042)), bm.verts.new(B(cx - dx + dy * w / length, cy - dy - dx * w / length, 0.042))]
                bm.faces.new(v)
        straw = common.mesh_object("straw", bm, straw_mat, self.col_ground, smooth=False)
        self.ground_objects.append(straw)
        dung = M.plain("#4a3a28", 0.7, 0.2)
        for e in m.entities:
            if e["sprite"] == "donkey":
                for k in range(3):
                    c = B(e["x"] + 0.2 + rng.random() * 0.6, e["y"] + 0.9 + rng.random() * 0.3, 0.03)
                    o = self._ellipsoid(f"dung-{e['id']}-{k}", c, (0.035, 0.03, 0.02), dung, 8, 5)
                    for col in o.users_collection:
                        col.objects.unlink(o)
                    self.col_ground.objects.link(o)
                    self.ground_objects.append(o)
        wet = M.plain("#5c4c3a", 0.35, 0.45)
        for kind in ("well", "trough"):
            for x, y in m.tiles(kind):
                o = self._ellipsoid(f"wet-{x}-{y}", B(x + 0.5, y + 1.05, 0.038), (0.55, 0.3, 0.002), wet, 20, 4)
                for col in o.users_collection:
                    col.objects.unlink(o)
                self.col_ground.objects.link(o)
                self.ground_objects.append(o)
        # Rubble along the foot of walls.
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        for y in range(m.h):
            for x in range(m.w):
                if m.kind(x, y) in ("sand", "scrub") and m.kind(x, y - 1) in ("wall", "roof") and rng.random() < 0.5:
                    for _ in range(2 + int(rng.random() * 3)):
                        size = 0.03 + rng.random() * 0.05
                        sph = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
                        c = B(x + rng.random(), y + 0.05 + rng.random() * 0.2, 0.02)
                        rr = rng.random()
                        for v in sph["verts"]:
                            v.co = Vector((v.co.x * size, v.co.y * size * 0.8, v.co.z * size * 0.6)) + c
                        for f in bm.faces:
                            if f.verts[0] in sph["verts"]:
                                f[layer] = rr
        rubble = common.mesh_object("rubble", bm, self.limestone, self.col_ground)
        self.ground_objects.append(rubble)

    # ── buildings ───────────────────────────────────────────────────────────
    def _buildings(self):
        m = self.map
        perimeter = [(x, y) for y in range(m.h) for x in range(m.w) if (x in (0, m.w - 1) or y in (0, m.h - 1)) and m.kind(x, y) == "wall"]
        self._city_wall(perimeter)
        edge = set(perimeter)
        seen = set(edge)
        for y in range(m.h):
            for x in range(m.w):
                if (x, y) in seen or m.kind(x, y) not in ("wall", "roof", "door"):
                    continue
                stack = [(x, y)]
                reg = []
                seen.add((x, y))
                while stack:
                    cx, cy = stack.pop()
                    reg.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if (nx, ny) not in seen and m.kind(nx, ny) in ("wall", "roof", "door"):
                            seen.add((nx, ny))
                            stack.append((nx, ny))
                self._house(f"house-{min(p[0] for p in reg)}-{min(p[1] for p in reg)}", reg)

    def _city_wall(self, reg):
        """The perimeter: a tall wall to the north (seen from the market), low
        walls elsewhere (seen only from above)."""
        m = self.map
        cells = set(reg)
        objs = []
        rng = self.rng
        # North wall: its face stands on the line y=1, rising 3.2 tiles (cut by the map edge).
        north = [(x, 0) for x in range(m.w) if (x, 0) in cells]
        if north:
            # Nothing ever stands behind it: part of the ground layer.
            face = self._ashlar_face("wall-north", 0, m.w, 1.0, 3.2, rng, openings=[])
            for c in face.users_collection:
                c.objects.unlink(face)
            self.col_ground.objects.link(face)
            self.ground_objects.append(face)
        # The other sides: low wall tops seen from above.
        bm = bmesh.new()
        for x, y in reg:
            if y == 0:
                continue
            z = 0.9
            v = [bm.verts.new(B(x + dx, y + dy + z, z)) for dx, dy in ((0, 0), (1, 0), (1, 1), (0, 1))]
            bm.faces.new(v[::-1])
        tops = common.mesh_object("wall-tops", bm, self.limestone, self.col_ground, smooth=False)
        self._rand_attr(tops)
        # Seen only from above and never beside anyone: part of the ground layer.
        self.ground_objects.append(tops)

    def _rand_attr(self, obj, value=None):
        me = obj.data
        attr = me.attributes.get("rand") or me.attributes.new("rand", "FLOAT", "FACE")
        rng = self.rng
        for i in range(len(me.polygons)):
            attr.data[i].value = rng.random() if value is None else value

    def _ashlar_face(self, name, x0, x1, ground_y, height, rng, openings, depth=0.25):
        """A dressed limestone front on the line `ground_y`, from x0 to x1, with
        drafted-margin blocks in courses and holes for `openings`
        [(x0, x1, z0, z1)]."""
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        course = 0.3
        z = 0.0
        row = 0
        while z < height - 1e-6:
            ch = min(course * (0.85 + rng.random() * 0.3), height - z)
            x = x0 - (rng.random() * 0.6 if row % 2 else 0.0)
            while x < x1 - 1e-6:
                length = 0.45 + rng.random() * 0.55
                a, b = max(x, x0), min(x + length, x1)
                if b - a > 0.05 and not any(ox0 < b and ox1 > a and oz0 < z + ch and oz1 > z for ox0, ox1, oz0, oz1 in openings):
                    self._block(bm, layer, a + 0.008, b - 0.008, z + 0.008, z + ch - 0.008, ground_y, rng)
                x += length
            z += ch
            row += 1
        # The body of the wall behind the blocks (casts shadow, fills joints).
        core = bmesh.ops.create_cube(bm, size=1.0)
        verts = core["verts"]
        for v in verts:
            v.co.x = x0 + (x1 - x0) * (v.co.x + 0.5)
            v.co.y = -(ground_y - 0.02 - depth * (v.co.y + 0.5))
            v.co.z = height * (v.co.z + 0.5)
        for f in bm.faces:
            if f.verts[0] in verts:
                f[layer] = 0.5
        obj = common.mesh_object(name, bm, self.limestone, None, smooth=False)
        return obj

    def _block(self, bm, layer, x0, x1, z0, z1, ground_y, rng):
        """A dressed block: a flat drafted margin and a slightly raised boss."""
        out = 0.012 + rng.random() * 0.01
        m = 0.035
        yb = -(ground_y) - 0.0
        fr = [bm.verts.new((x, yb + out * 0.4, z)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
        bk = [bm.verts.new((x, yb + 0.05, z)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
        boss = [bm.verts.new((x, yb - out, z)) for x, z in ((x0 + m, z0 + m), (x1 - m, z0 + m), (x1 - m, z1 - m), (x0 + m, z1 - m))]
        r = rng.random()
        faces = []
        faces.append(bm.faces.new(boss))
        for i in range(4):
            j = (i + 1) % 4
            faces.append(bm.faces.new((fr[i], fr[j], boss[j], boss[i])))
            faces.append(bm.faces.new((bk[i], bk[j], fr[j], fr[i])))
        for f in faces:
            f[layer] = r
        for f in faces:
            f.normal_update()

    def _house(self, name, reg):
        m = self.map
        cells = set(reg)
        xs = [p[0] for p in reg]
        ys = [p[1] for p in reg]
        x0, x1 = min(xs), max(xs) + 1
        n, s = min(ys), max(ys)
        rng = self.rng
        front_cells = [(x, s) for x in range(x0, x1) if m.kind(x, s) in ("wall", "door") and m.kind(x, s + 1) not in ("wall", "roof", "void")]
        has_front = len(front_cells) >= (x1 - x0) // 2
        objs = []
        if has_front:
            height = 2.35 if any(m.kind(x, s) == "door" for x in range(x0, x1)) else 2.15
            ground_y = s + 1.0
            doors = [x for x in range(x0, x1) if m.kind(x, s) == "door"]
            openings = []
            for dx in doors:
                openings.append((dx + 0.1, dx + 0.9, 0.0, 1.85))
            windows = []
            for wx in range(x0 + 1, x1 - 1, 3):
                if all(abs(wx - d) > 1 for d in doors):
                    windows.append((wx + 0.3, wx + 0.7, 1.35, 1.8))
            face = self._ashlar_face(f"{name}-front", x0, x1, ground_y, height, rng, openings + windows)
            objs.append(face)
            top = n + height  # the roof's north edge sits `height` further north on the ground
            depth = ground_y - top
            objs += self._roof(name, x0, x1, top, ground_y - 0.02, height, rng)
            for dx in doors:
                objs += self._doorway(f"{name}-door{dx}", dx, ground_y, 1.85)
            for wx0, wx1, z0, z1 in windows:
                objs += self._window(f"{name}-win{int(wx0)}", wx0, wx1, ground_y, z0, z1)
            _ = depth
            self.sprites.append(Sprite(name, ground_y * 32.0, objs, sorted(cells)))
        else:
            # Seen only from above (its front faces away): a flat roof.
            height = 1.9
            ground_top = n + height
            objs += self._roof(name, x0, x1, ground_top, s + 1.0 + height, height, rng, south_open=True)
            self.sprites.append(Sprite(name, (s + 1.0) * 32.0, objs, sorted(cells)))

    def _roof(self, name, x0, x1, north_y, south_y, height, rng, south_open=False):
        """A flat plaster roof at `height` over ground y north_y..south_y, with a
        parapet and a little roof life."""
        objs = []
        bm = bmesh.new()
        z = height
        v = [bm.verts.new(B(x, y, z)) for x, y in ((x0, north_y), (x1, north_y), (x1, south_y), (x0, south_y))]
        bm.faces.new(v[::-1])
        body = bmesh.ops.create_cube(bm, size=1.0)
        for vv in body["verts"]:
            vv.co.x = x0 + (x1 - x0) * (vv.co.x + 0.5)
            vv.co.y = -(north_y + (south_y - north_y) * (vv.co.y + 0.5))
            vv.co.z = (height - 0.01) * (vv.co.z + 0.5)
        roof = common.mesh_object(f"{name}-roof", bm, self.roof, None, smooth=False)
        objs.append(roof)
        # Parapet: a low wall on the north, west and east edges (and the front).
        par = bmesh.new()
        layer = par.faces.layers.float.new("rand")
        t, ph = 0.12, 0.16
        edges = [(x0, north_y, x1, north_y + t), (x0, north_y, x0 + t, south_y), (x1 - t, north_y, x1, south_y), (x0, south_y - t, x1, south_y)]
        for ex0, ey0, ex1, ey1 in edges:
            cube = bmesh.ops.create_cube(par, size=1.0)
            for vv in cube["verts"]:
                vv.co.x = ex0 + (ex1 - ex0) * (vv.co.x + 0.5)
                vv.co.y = -(ey0 + (ey1 - ey0) * (vv.co.y + 0.5))
                vv.co.z = z + ph * (vv.co.z + 0.5)
            for f in par.faces:
                if f.verts[0] in cube["verts"]:
                    f[layer] = rng.random()
        objs.append(common.mesh_object(f"{name}-parapet", par, self.limestone, None, smooth=False))
        # Roof life: a drying mat with figs, storage jars, a ladder, washing.
        w = x1 - x0
        d = south_y - north_y
        spots = [(x0 + 0.6 + rng.random() * (w - 1.8), north_y + 0.35 + rng.random() * max(0.1, d - 0.9)) for _ in range(max(1, int(w // 3)))]
        for i, (sx, sy) in enumerate(spots):
            kind = i % 3
            if kind == 0:
                mat = common.box(f"{name}-mat{i}", (0.8, 0.5, 0.01), B(sx + 0.4, sy + 0.25, z + 0.006), M.straw("#b59d6a"), None)
                objs.append(mat)
                for k in range(14):
                    fig = self._ellipsoid(f"{name}-fig{i}-{k}", B(sx + 0.1 + rng.random() * 0.6, sy + 0.08 + rng.random() * 0.34, z + 0.02), (0.03, 0.03, 0.018), M.plain("#5a3a32", 0.6))
                    objs.append(fig)
            elif kind == 1:
                objs += self._jar_group(f"{name}-roofjars{i}", sx, sy, z, rng, count=2)
        return objs

    def _doorway(self, name, dx, ground_y, height):
        """A dark doorway with a timber lintel and a door leaf standing open."""
        objs = []
        inner = common.box(f"{name}-dark", (0.8, 0.3, height), B(dx + 0.5, ground_y - 0.16, height / 2), self.dark, None)
        lintel = common.box(f"{name}-lintel", (1.0, 0.12, 0.14), B(dx + 0.5, ground_y + 0.02, height + 0.07), self.wood, None, bevel=0.01)
        sill = common.box(f"{name}-sill", (0.9, 0.2, 0.04), B(dx + 0.5, ground_y - 0.02, 0.02), self.paving, None, bevel=0.01)
        leaf = common.box(f"{name}-leaf", (0.07, 0.62, height - 0.08), B(dx + 0.15, ground_y - 0.32, (height - 0.08) / 2), self.wood, None, bevel=0.006)
        for o in (lintel, leaf):
            common.bake_modifiers(o)
        self._rand_attr(sill, 0.5)
        objs += [inner, lintel, sill, leaf]
        return objs

    def _window(self, name, x0, x1, ground_y, z0, z1):
        objs = []
        w = x1 - x0
        dark = common.box(f"{name}-dark", (w, 0.2, z1 - z0), B((x0 + x1) / 2, ground_y - 0.08, (z0 + z1) / 2), self.dark, None)
        objs.append(dark)
        for k in range(3):
            bar = common.box(f"{name}-bar{k}", (0.025, 0.03, z1 - z0), B(x0 + w * (k + 1) / 4, ground_y + 0.01, (z0 + z1) / 2), self.wood, None)
            objs.append(bar)
        sill = common.box(f"{name}-sill", (w + 0.12, 0.08, 0.05), B((x0 + x1) / 2, ground_y + 0.03, z0 - 0.02), self.limestone, None)
        self._rand_attr(sill, 0.4)
        objs.append(sill)
        return objs

    # ── props ───────────────────────────────────────────────────────────────
    def _ellipsoid(self, name, centre, radii, mat, segments=14, rings=8):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
        bmesh.ops.scale(bm, vec=Vector(radii), verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(centre), verts=bm.verts)
        return common.mesh_object(name, bm, mat, None)

    def _lathe(self, name, profile, at, mat, segments=28, tilt=0.0, spin=0.0):
        obj = common.lathe(name, profile, segments, mat, None)
        obj.data.transform(Matrix.Translation(at) @ Matrix.Rotation(spin, 4, "Z") @ Matrix.Rotation(tilt, 4, "X"))
        return obj

    def _jar_group(self, name, x, y, z, rng, count=3):
        objs = []
        clays = ["#b06a44", "#a8765a", "#c08a60", "#9a5e3e"]
        for i in range(count):
            size = 0.55 + rng.random() * 0.5
            px = x + 0.18 + i * 0.26 + (rng.random() - 0.5) * 0.08
            py = y + 0.35 + (rng.random() - 0.5) * 0.2
            kind = rng.random()
            if kind < 0.45:  # storage jar
                prof = [(0.05, 0), (0.12, 0.05), (0.15, 0.2), (0.14, 0.32), (0.08, 0.4), (0.055, 0.44), (0.065, 0.46)]
            elif kind < 0.8:  # amphora-like
                prof = [(0.01, 0), (0.05, 0.04), (0.12, 0.16), (0.13, 0.28), (0.09, 0.38), (0.045, 0.46), (0.045, 0.52), (0.06, 0.54)]
            else:  # cooking pot
                prof = [(0.06, 0), (0.13, 0.05), (0.16, 0.13), (0.12, 0.2), (0.12, 0.23)]
            prof = [(r * size, h * size) for r, h in prof]
            mat = M.terracotta(clays[int(rng.random() * len(clays))], 0.5)
            objs.append(self._lathe(f"{name}-{i}", prof, B(px, py, z), mat, 28, tilt=(rng.random() - 0.5) * 0.08))
        return objs

    def _props(self):
        m = self.map
        rng = self.rng
        for x0, x1, y in m.runs("stall"):
            self._stall(f"stall-{x0}-{y}", x0, x1, y)
        for x, y in m.tiles("jars"):
            self.sprites.append(Sprite(f"jars-{x}-{y}", (y + 0.9) * 32, self._jar_group(f"jars-{x}-{y}", x, y, 0.0, rng), [(x, y)]))
        for x, y in m.tiles("sacks"):
            self.sprites.append(Sprite(f"sacks-{x}-{y}", (y + 0.9) * 32, self._sacks(f"sacks-{x}-{y}", x, y), [(x, y)]))
        for x, y in m.tiles("basket"):
            self.sprites.append(Sprite(f"basket-{x}-{y}", (y + 0.85) * 32, self._baskets(f"basket-{x}-{y}", x, y), [(x, y)]))
        for x, y in m.tiles("crate"):
            self.sprites.append(Sprite(f"crate-{x}-{y}", (y + 0.9) * 32, self._crates(f"crate-{x}-{y}", x, y), [(x, y)]))
        for x, y in m.tiles("olive"):
            self.sprites.append(Sprite(f"olive-{x}-{y}", (y + 0.62) * 32, self._olive(f"olive-{x}-{y}", x, y), [(x, y)]))
        for x, y in m.tiles("rock"):
            self.sprites.append(Sprite(f"rock-{x}-{y}", (y + 0.8) * 32, self._rocks(f"rock-{x}-{y}", x, y), [(x, y)]))
        for x, y in m.tiles("well"):
            self.sprites.append(Sprite(f"well-{x}-{y}", (y + 0.85) * 32, self._well(f"well-{x}-{y}", x, y), [(x, y)]))
        for x, y in m.tiles("oven"):
            self.sprites.append(Sprite(f"oven-{x}-{y}", (y + 0.85) * 32, self._oven(f"oven-{x}-{y}", x, y), [(x, y)]))
        for x0, x1, y in m.runs("tent"):
            self.sprites.append(Sprite(f"tent-{x0}-{y}", (y + 0.95) * 32, self._tent(f"tent-{x0}-{y}", x0, x1, y), [(x, y) for x in range(x0, x1)]))
        for x, y in m.tiles("trough"):
            self.sprites.append(Sprite(f"trough-{x}-{y}", (y + 0.8) * 32, self._trough(f"trough-{x}-{y}", x, y), [(x, y)]))
        for x0, x1, y in m.runs("cloth"):
            self.sprites.append(Sprite(f"cloth-{x0}-{y}", (y + 0.7) * 32, self._cloth_rack(f"cloth-{x0}-{y}", x0, x1, y), [(x, y) for x in range(x0, x1)]))
        for x0, x1, y in m.runs("fence"):
            self.sprites.append(Sprite(f"fence-{x0}-{y}", (y + 0.75) * 32, self._drystone(f"fence-{x0}-{y}", x0, x1, y), [(x, y) for x in range(x0, x1)]))
        gates = m.tiles("gate")
        if gates:
            self.sprites.append(Sprite("gate", (max(g[1] for g in gates) + 2) * 32, self._gate("gate", gates), gates))
        for e in m.entities:
            maker = {"vessels": self._vessels, "sign": self._sign, "donkey": self._donkey, "basket": self._bales}.get(e["sprite"] or "")
            if e["id"] == "cart":
                maker = self._cart
            if maker is None:
                continue
            sid = f"entity:{e['id']}"
            self.sprites.append(Sprite(sid, (e["y"] + 0.85) * 32, maker(sid, e["x"], e["y"]), [(e["x"], e["y"])]))

    # ── more props ─────────────────────────────────────────────────────────
    def _well(self, name, x, y):
        rng = self.rng
        objs = []
        c = B(x + 0.5, y + 0.55, 0)
        ring = bmesh.new()
        layer = ring.faces.layers.float.new("rand")
        n = 12
        for k in range(n):
            a0 = math.tau * k / n
            a1 = math.tau * (k + 1) / n - 0.03
            ri, ro, h = 0.24, 0.4, 0.44 + rng.random() * 0.03
            vs = []
            for a in (a0, a1):
                for r in (ri, ro):
                    for z in (0.0, h):
                        vs.append(ring.verts.new(c + Vector((math.cos(a) * r, math.sin(a) * r, z))))
            # vs: [a0 ri 0, a0 ri h, a0 ro 0, a0 ro h, a1 ri 0, a1 ri h, a1 ro 0, a1 ro h]
            quads = [(0, 2, 3, 1), (4, 5, 7, 6), (1, 3, 7, 5), (0, 1, 5, 4), (2, 6, 7, 3)]
            r = rng.random()
            for q in quads:
                f = ring.faces.new([vs[i] for i in q])
                f[layer] = r
        objs.append(common.mesh_object(f"{name}-ring", ring, self.limestone, None, smooth=False))
        objs.append(self._ellipsoid(f"{name}-water", c + Vector((0, 0, 0.12)), (0.24, 0.24, 0.005), M.water(), 24, 6))
        for side in (-1, 1):
            objs.append(common.box(f"{name}-post{side}", (0.07, 0.07, 1.05), c + Vector((side * 0.46, 0.0, 0.52)), self.wood, None))
        objs.append(common.box(f"{name}-beam", (1.02, 0.07, 0.07), c + Vector((0, 0, 1.05)), self.wood, None))
        objs.append(common.box(f"{name}-rope", (0.012, 0.012, 0.7), c + Vector((0.05, 0, 0.7)), M.plain("#8a7550", 0.9), None))
        bucket = self._lathe(f"{name}-bucket", [(0.06, 0), (0.08, 0.12), (0.085, 0.13)], c + Vector((0.3, -0.28, 0.44)), M.leather("#5a3c24"), 16)
        objs.append(bucket)
        return objs

    def _oven(self, name, x, y):
        objs = []
        c = B(x + 0.5, y + 0.5, 0)
        dome = self._lathe(f"{name}-dome", [(0.36, 0), (0.37, 0.12), (0.32, 0.28), (0.2, 0.38), (0.1, 0.42), (0.08, 0.43)], c, M.terracotta("#a0684a", 0.6), 28)
        objs.append(dome)
        objs.append(self._ellipsoid(f"{name}-mouth", c + Vector((0, -0.3, 0.14)), (0.12, 0.08, 0.1), M.emissive("#ff7a30", 3.0), 16, 8))
        objs.append(self._ellipsoid(f"{name}-ash", c + Vector((0.05, -0.42, 0.01)), (0.22, 0.12, 0.01), M.plain("#6e675e", 0.95), 16, 6))
        board = common.box(f"{name}-board", (0.42, 0.24, 0.03), c + Vector((0.32, -0.36, 0.2)), self.wood, None)
        objs.append(board)
        for k in range(4):
            objs.append(self._ellipsoid(f"{name}-bread{k}", c + Vector((0.2 + k * 0.08, -0.36 + (k % 2) * 0.05, 0.225)), (0.07, 0.07, 0.012), M.plain("#b98a52", 0.7), 14, 6))
        return objs

    def _tent(self, name, x0, x1, y):
        objs = []
        w = x1 - x0
        hair = M.fabric_stripes(["#2b2420", "#3a312a", "#2b2420", "#5a4d3e"], 0.07, f"goathair-{name}")
        bm = bmesh.new()
        segs = w * 8
        rows = []
        for j, (yy, zz) in enumerate(((y + 0.05, 0.35), (y + 0.35, 1.25), (y + 0.9, 0.85))):
            row = []
            for i in range(segs + 1):
                u = i / segs
                sag = 0.07 * math.sin(math.pi * ((u * w) % 1.0)) if j == 1 else 0.02
                row.append(bm.verts.new(B(x0 - 0.05 + (w + 0.1) * u, yy, zz - sag)))
            rows.append(row)
        for a, b in zip(rows, rows[1:]):
            for i in range(segs):
                bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
        roof = common.mesh_object(f"{name}-roof", bm, hair, None)
        common.add_modifier(roof, "SOLIDIFY", thickness=0.015)
        objs.append(roof)
        objs.append(common.box(f"{name}-inside", (w - 0.2, 0.5, 0.8), B(x0 + w / 2, y + 0.45, 0.4), self.dark, None))
        for k in range(w + 1):
            px = x0 + k * w / w if k else x0 + 0.05
            objs.append(common.box(f"{name}-pole{k}", (0.05, 0.05, 1.28), B(min(px, x1 - 0.05), y + 0.35, 0.64), self.wood, None))
        for k in range(w + 1):
            px = x0 + k
            objs.append(self._branch(f"{name}-rope{k}", B(px, y + 0.9, 0.84), B(px + 0.1, y + 1.25, 0.0), 0.006, 0.006, M.plain("#8a7550", 0.9), 5))
        rug = common.box(f"{name}-rug", (0.9, 0.5, 0.01), B(x0 + w / 2, y + 0.7, 0.01), M.fabric_stripes(["#7a3a2c", "#c9b996", "#3c4c5e"], 0.05, "tent-rug"), None)
        objs.append(rug)
        return objs

    def _trough(self, name, x, y):
        objs = []
        c = B(x + 0.5, y + 0.5, 0)
        t = common.box(f"{name}-stone", (0.86, 0.36, 0.3), c + Vector((0, 0, 0.15)), self.limestone, None, bevel=0.02)
        common.bake_modifiers(t)
        self._rand_attr(t, 0.3)
        objs.append(t)
        objs.append(common.box(f"{name}-water", (0.74, 0.24, 0.01), c + Vector((0, 0, 0.27)), M.water(), None))
        return objs

    def _cloth_rack(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        w = x1 - x0
        for px in (x0 + 0.12, x1 - 0.12):
            objs.append(common.box(f"{name}-post{px:.1f}", (0.06, 0.06, 1.3), B(px, y + 0.5, 0.65), self.wood, None))
        objs.append(common.box(f"{name}-pole", (w - 0.1, 0.05, 0.05), B(x0 + w / 2, y + 0.5, 1.28), self.wood, None))
        dyes = ["#7e3b2c", "#3d4d66", "#b08a3e", "#d9ceb5", "#5b6438", "#6a4a5a"]
        k = 0
        x = x0 + 0.2
        while x < x1 - 0.3:
            cw = 0.32 + rng.random() * 0.14
            color = dyes[int(rng.random() * len(dyes))]
            bm = bmesh.new()
            cols = 8
            rows = 10
            length = 0.7 + rng.random() * 0.35
            grid = []
            for j in range(rows + 1):
                t = j / rows
                row = []
                for i in range(cols + 1):
                    u = i / cols
                    fold = 0.03 * math.sin(u * math.tau * 2 + k) * (0.3 + t)
                    row.append(bm.verts.new(B(x + cw * u, y + 0.5 + fold, 1.26 - length * t)))
                grid.append(row)
            for j in range(rows):
                for i in range(cols):
                    bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            cloth = common.mesh_object(f"{name}-c{k}", bm, M.cloth(color, None, "wool"), None)
            common.add_modifier(cloth, "SOLIDIFY", thickness=0.008)
            objs.append(cloth)
            x += cw + 0.04
            k += 1
        return objs

    def _drystone(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        for course in range(3):
            x = x0 + (rng.random() * 0.2 if course % 2 else 0.0)
            while x < x1 - 0.05:
                size = 0.18 + rng.random() * 0.14
                sph = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
                r = rng.random()
                cz = 0.1 + course * 0.14
                for v in sph["verts"]:
                    nn = math.sin(v.co.x * 5 + x * 7) * 0.1 + math.sin(v.co.z * 6 + course) * 0.08
                    v.co = Vector((v.co.x * size * 0.6 * (1 + nn), v.co.y * 0.16 * (1 + nn), v.co.z * 0.085 * (1 + nn))) + B(x + size * 0.5, y + 0.5, cz)
                for f in bm.faces:
                    if f.verts[0] in sph["verts"]:
                        f[layer] = r
                x += size * 1.05
        wall = common.mesh_object(name, bm, self.limestone, None)
        objs.append(wall)
        return objs

    def _gate(self, name, gates):
        objs = []
        x = gates[0][0]
        ys = sorted(g[1] for g in gates)
        top, bottom = ys[0], ys[-1] + 1
        for py in (top - 0.15, bottom + 0.15):
            pier = self._ashlar_face(f"{name}-pier{py:.1f}", x - 0.1, x + 1.0, py + 0.3, 2.2, self.rng, [], depth=0.3)
            objs.append(pier)
        leaf = common.box(f"{name}-leaf", (0.08, 0.9, 1.9), B(x + 0.8, top + 0.55, 0.95), self.wood, None, bevel=0.01)
        common.bake_modifiers(leaf)
        objs.append(leaf)
        return objs

    def _vessels(self, name, x, y):
        objs = []
        c = B(x + 0.4, y + 0.55, 0)
        prof = [(0.1, 0), (0.22, 0.06), (0.26, 0.2), (0.24, 0.34), (0.15, 0.42), (0.13, 0.46), (0.15, 0.48)]
        objs.append(self._lathe(f"{name}-crock", prof, c, M.terracotta("#a86a48", 0.4), 32))
        prof2 = [(0.05, 0), (0.09, 0.05), (0.1, 0.14), (0.06, 0.22), (0.05, 0.27), (0.065, 0.29)]
        pitcher = self._lathe(f"{name}-pitcher", prof2, c + Vector((0.42, -0.08, 0)), M.terracotta("#b87c56", 0.3), 24)
        objs.append(pitcher)
        objs.append(self._branch(f"{name}-handle", c + Vector((0.5, -0.08, 0.24)), c + Vector((0.53, -0.08, 0.1)), 0.015, 0.015, M.terracotta("#b87c56", 0.0), 6))
        return objs

    def _sign(self, name, x, y):
        objs = []
        c = B(x + 0.5, y + 0.6, 0)
        objs.append(common.box(f"{name}-post", (0.07, 0.07, 1.05), c + Vector((0, 0, 0.52)), self.wood, None))
        board = common.box(f"{name}-board", (0.6, 0.04, 0.3), c + Vector((0, -0.05, 0.9)), M.wood("#8a6a48", 9.0), None, bevel=0.01)
        common.bake_modifiers(board)
        objs.append(board)
        for k in range(3):
            objs.append(common.box(f"{name}-cut{k}", (0.4 - k * 0.08, 0.005, 0.018), c + Vector((0, -0.075, 0.97 - k * 0.07)), M.plain("#3a2a1c", 0.9), None))
        return objs

    def _donkey(self, name, x, y):
        """A pack donkey in profile (facing west), grey-brown with a pale muzzle,
        carrying panniers on a wooden pack saddle."""
        rng = self.rng
        objs = []
        c = B(x + 0.5, y + 0.55, 0)
        fur = M.cloth("#7b6f60", None, "wool")
        pale = M.cloth("#c8bca8", None, "wool")
        hoof = M.plain("#2e2622", 0.6)
        objs.append(self._ellipsoid(f"{name}-body", c + Vector((0.05, 0, 0.66)), (0.4, 0.19, 0.2), fur, 24, 12))
        objs.append(self._ellipsoid(f"{name}-belly", c + Vector((0.05, 0, 0.56)), (0.3, 0.16, 0.1), pale, 18, 8))
        neck = self._branch(f"{name}-neck", c + Vector((-0.28, 0, 0.72)), c + Vector((-0.46, 0, 0.98)), 0.1, 0.07, fur, 10)
        objs.append(neck)
        head = self._ellipsoid(f"{name}-head", c + Vector((-0.58, 0, 0.96)), (0.17, 0.07, 0.075), fur, 18, 10)
        head.data.transform(Matrix.Translation(c + Vector((-0.58, 0, 0.96))) @ Matrix.Rotation(0.5, 4, "Y") @ Matrix.Translation(-(c + Vector((-0.58, 0, 0.96)))))
        objs.append(head)
        objs.append(self._ellipsoid(f"{name}-muzzle", c + Vector((-0.71, 0, 0.88)), (0.07, 0.06, 0.06), pale, 12, 8))
        for side in (-1, 1):
            ear = self._ellipsoid(f"{name}-ear{side}", c + Vector((-0.5, side * 0.04, 1.12)), (0.025, 0.02, 0.11), fur, 10, 6)
            ear.data.transform(Matrix.Translation(c + Vector((-0.5, side * 0.04, 1.12))) @ Matrix.Rotation(-0.35, 4, "Y") @ Matrix.Translation(-(c + Vector((-0.5, side * 0.04, 1.12)))))
            objs.append(ear)
        for lx in (-0.27, 0.3):
            for ly in (-0.1, 0.1):
                objs.append(self._branch(f"{name}-leg{lx}{ly}", c + Vector((lx, ly, 0.58)), c + Vector((lx + 0.01, ly, 0.06)), 0.055, 0.03, fur, 8))
                objs.append(self._lathe(f"{name}-hoof{lx}{ly}", [(0.035, 0), (0.03, 0.06)], c + Vector((lx + 0.01, ly, 0)), hoof, 10))
        objs.append(self._branch(f"{name}-tail", c + Vector((0.44, 0, 0.7)), c + Vector((0.5, 0, 0.35)), 0.02, 0.012, fur, 6))
        # Pack saddle with panniers and a bundle.
        objs.append(common.box(f"{name}-saddle", (0.34, 0.42, 0.06), c + Vector((0.05, 0, 0.86)), self.wood, None))
        for side in (-1, 1):
            pann = self._lathe(f"{name}-pannier{side}", [(0.1, 0), (0.14, 0.1), (0.15, 0.24)], c + Vector((0.05, side * 0.24, 0.52)), M.straw(), 18)
            objs.append(pann)
        objs.append(self._ellipsoid(f"{name}-bundle", c + Vector((0.05, 0, 0.98)), (0.18, 0.16, 0.1), M.burlap("#9c8660"), 16, 8))
        _ = rng
        return objs

    def _bales(self, name, x, y):
        objs = []
        for k, (dx, dy, dz) in enumerate(((0.3, 0.45, 0.0), (0.7, 0.55, 0.0), (0.5, 0.5, 0.26))):
            bale = common.box(f"{name}-{k}", (0.4, 0.3, 0.26), B(x + dx, y + dy, dz + 0.13), M.burlap(["#9c8660", "#a8916a", "#8e7a58"][k]), None, bevel=0.05)
            common.bake_modifiers(bale)
            objs.append(bale)
            objs.append(common.box(f"{name}-cord{k}", (0.02, 0.32, 0.27), B(x + dx, y + dy, dz + 0.13), M.plain("#6e5a3e", 0.9), None))
        return objs

    def _cart(self, name, x, y):
        objs = []
        c = B(x + 0.5, y + 0.55, 0)
        bed = common.box(f"{name}-bed", (0.95, 0.6, 0.06), c + Vector((0, 0, 0.42)), self.wood, None)
        objs.append(bed)
        for side in (-1, 1):
            objs.append(common.box(f"{name}-rail{side}", (0.95, 0.04, 0.18), c + Vector((0, side * 0.3, 0.52)), self.wood, None))
            wheel = bmesh.new()
            rings = []
            for i in range(24):
                a = math.tau * i / 24
                centre = Vector((math.cos(a) * 0.28, 0, math.sin(a) * 0.28))
                out = Vector((math.cos(a), 0, math.sin(a)))
                rings.append([wheel.verts.new(centre + (out * math.cos(math.tau * j / 6) + Vector((0, 1, 0)) * math.sin(math.tau * j / 6)) * 0.03) for j in range(6)])
            for i in range(24):
                p_, q_ = rings[i], rings[(i + 1) % 24]
                for j in range(6):
                    jj = (j + 1) % 6
                    wheel.faces.new((p_[j], p_[jj], q_[jj], q_[j]))
            bmesh.ops.translate(wheel, vec=c + Vector((0.05, side * 0.36, 0.3)), verts=wheel.verts)
            wobj = common.mesh_object(f"{name}-wheel{side}", wheel, self.wood, None)
            objs.append(wobj)
            for k in range(6):
                a = k * math.pi / 3
                spoke = self._branch(f"{name}-spoke{side}{k}", c + Vector((0.05, side * 0.36, 0.3)), c + Vector((0.05 + math.cos(a) * 0.28, side * 0.36, 0.3 + math.sin(a) * 0.28)), 0.012, 0.012, self.wood, 5)
                objs.append(spoke)
        for side in (-1, 1):
            objs.append(self._branch(f"{name}-shaft{side}", c + Vector((-0.45, side * 0.2, 0.44)), c + Vector((-1.1, side * 0.25, 0.3)), 0.025, 0.02, self.wood, 6))
        for k in range(3):
            objs.append(self._ellipsoid(f"{name}-load{k}", c + Vector((-0.2 + k * 0.22, 0, 0.58)), (0.12, 0.2, 0.12), M.burlap("#a48c64"), 14, 8))
        return objs

    def _stall(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        front = y + 0.92
        back = y + 0.12
        w = x1 - x0
        post = M.wood("#5e4430", 4.0)
        # Posts: taller at the back so the awning slopes toward the buyer.
        for px in [x0 + 0.08] + [x0 + k for k in range(1, w)] + [x1 - 0.08]:
            for py, hgt in ((front, 1.28), (back, 1.55)):
                objs.append(common.box(f"{name}-post{px:.2f}-{py:.2f}", (0.06, 0.06, hgt), B(px, py, hgt / 2), post, None))
        # Counter: planks on trestles.
        counter = common.box(f"{name}-counter", (w - 0.1, 0.62, 0.05), B((x0 + x1) / 2, y + 0.55, 0.52), self.wood, None, bevel=0.01)
        objs.append(counter)
        objs.append(common.box(f"{name}-front", (w - 0.14, 0.03, 0.45), B((x0 + x1) / 2, y + 0.86, 0.26), post, None))
        # Awning: a sagging striped cloth from the back beam to the front beam.
        colors = [["#8e4a3a", "#d6c7a8", "#3f5068", "#d6c7a8"], ["#6e5a3a", "#cdbd9c", "#8a3f33"], ["#3c4c5e", "#c9b996", "#9b7a3e", "#c9b996"]][int(rng.random() * 3)]
        cloth = M.fabric_stripes(colors, 0.09, f"awning-{name}")
        segs_x, segs_y = max(8, w * 10), 8
        bm = bmesh.new()
        grid = []
        for j in range(segs_y + 1):
            t = j / segs_y
            row = []
            for i in range(segs_x + 1):
                u = i / segs_x
                ax = x0 - 0.05 + (w + 0.1) * u
                ay = back - 0.1 + (front - back + 0.3) * t
                az = 1.58 + (1.28 - 1.58) * t
                # Sag between posts and along the slope.
                seg = (u * w) % 1.0
                sag = 0.05 * math.sin(math.pi * seg) + 0.035 * math.sin(math.pi * t)
                row.append(bm.verts.new(B(ax, ay, az - sag)))
            grid.append(row)
        for j in range(segs_y):
            for i in range(segs_x):
                bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        # A valance hanging at the front edge.
        last = grid[-1]
        drop = [bm.verts.new(v.co + Vector((0, -0.01, -0.13 - 0.02 * math.sin(k)))) for k, v in enumerate(last)]
        for i in range(segs_x):
            bm.faces.new((last[i], last[i + 1], drop[i + 1], drop[i]))
        awning = common.mesh_object(f"{name}-awning", bm, cloth, None)
        common.add_modifier(awning, "SOLIDIFY", thickness=0.012)
        objs.append(awning)
        # Goods on the counter: heaps of produce and pottery.
        produce = [("#8a2f2a", 0.045), ("#4a2a36", 0.035), ("#6a4a2a", 0.03), ("#5a5a2e", 0.028), ("#b98a4a", 0.04), ("#c9b27a", 0.03)]
        for k in range(w * 2):
            cx = x0 + 0.3 + k * (w - 0.5) / max(1, w * 2 - 1)
            color, r = produce[int(rng.random() * len(produce))]
            tray = self._lathe(f"{name}-tray{k}", [(0.0, 0.0), (0.16, 0.0), (0.2, 0.05)], B(cx, y + 0.5, 0.545), M.straw("#a88a58"), 20)
            objs.append(tray)
            mat = M.plain(color, 0.55, 0.35)
            for q in range(18):
                ang = rng.random() * math.tau
                rad = rng.random() ** 0.5 * 0.15
                hz = 0.56 + r + (0.15 - rad) * 0.5
                objs.append(self._ellipsoid(f"{name}-p{k}-{q}", B(cx + math.cos(ang) * rad, y + 0.5 + math.sin(ang) * rad * 0.8, hz), (r, r, r * 0.9), mat, 10, 6))
        base_y = (y + 0.95) * 32
        self.sprites.append(Sprite(name, base_y, objs, [(x, y) for x in range(x0, x1)]))

    def _sacks(self, name, x, y):
        rng = self.rng
        objs = []
        for i in range(3):
            px = x + 0.22 + i * 0.28
            py = y + 0.4 + (i % 2) * 0.22
            h = 0.36 + rng.random() * 0.12
            prof = [(0.1, 0.0), (0.17, 0.05), (0.18, h * 0.6), (0.14, h * 0.9), (0.08, h), (0.1, h + 0.02)]
            sack = self._lathe(f"{name}-{i}", prof, B(px, py, 0), M.burlap(["#a48c64", "#9a845c", "#b29a70"][i % 3]), 20, tilt=(rng.random() - 0.5) * 0.15)
            objs.append(sack)
            if i == 1:
                grain = self._ellipsoid(f"{name}-grain", B(px, py, h + 0.015), (0.09, 0.09, 0.03), M.plain("#b8903e", 0.8))
                objs.append(grain)
        return objs

    def _baskets(self, name, x, y):
        rng = self.rng
        objs = []
        for i in range(2):
            px = x + 0.3 + i * 0.38
            py = y + 0.45 + (i % 2) * 0.15
            b = self._lathe(f"{name}-{i}", [(0.1, 0), (0.17, 0.08), (0.18, 0.18), (0.19, 0.2)], B(px, py, 0), M.straw(), 24)
            objs.append(b)
            fill = ["#4a2a36", "#8a2f2a", "#5a5a2e"][int(rng.random() * 3)]
            mat = M.plain(fill, 0.55, 0.35)
            for q in range(12):
                ang = rng.random() * math.tau
                rad = rng.random() ** 0.5 * 0.13
                objs.append(self._ellipsoid(f"{name}-f{i}-{q}", B(px + math.cos(ang) * rad, py + math.sin(ang) * rad, 0.2 + (0.13 - rad) * 0.3), (0.035, 0.035, 0.03), mat, 8, 6))
        return objs

    def _crates(self, name, x, y):
        objs = []
        for i, (dx, dy, dz) in enumerate(((0.3, 0.5, 0.0), (0.68, 0.55, 0.0), (0.48, 0.52, 0.3))):
            c = common.box(f"{name}-{i}", (0.34, 0.3, 0.3), B(x + dx, y + dy, dz + 0.15), M.wood("#7a5c3c", 8.0), None, bevel=0.012)
            common.bake_modifiers(c)
            objs.append(c)
        return objs

    def _rocks(self, name, x, y):
        rng = self.rng
        objs = []
        for i in range(2):
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
            s = (0.26 + rng.random() * 0.12, 0.22 + rng.random() * 0.1, 0.16 + rng.random() * 0.08)
            for v in bm.verts:
                n = math.sin(v.co.x * 5 + i) * 0.08 + math.sin(v.co.y * 7) * 0.06 + math.sin(v.co.z * 6 + 2) * 0.05
                v.co = Vector((v.co.x * s[0] * (1 + n), v.co.y * s[1] * (1 + n), max(-0.02, v.co.z * s[2] * (1 + n))))
            bmesh.ops.translate(bm, vec=B(x + 0.35 + i * 0.3, y + 0.5 + i * 0.1, 0.06), verts=bm.verts)
            rock = common.mesh_object(f"{name}-{i}", bm, self.limestone, None)
            self._rand_attr(rock)
            objs.append(rock)
        return objs

    def _olive(self, name, x, y):
        """An old olive tree: a gnarled, split trunk with a flared base, a few
        crooked limbs, and a loose crown of silver-green leaves."""
        rng = self.rng
        objs = []
        base = B(x + 0.5, y + 0.58, 0)
        bark = M.bark("#6f604e")
        lib = self._library()
        stems = 2 + int(rng.random() * 2)
        tips = []
        for sidx in range(stems):
            ang = sidx * math.tau / stems + rng.random() * 0.8
            lean = Vector((math.cos(ang) * 0.45, math.sin(ang) * 0.3, 1.0)).normalized()
            height = 0.95 + rng.random() * 0.4
            pts = []
            for k in range(9):
                t = k / 8
                wob = Vector((math.sin(t * 6 + sidx * 2) * 0.06, math.cos(t * 5 + sidx) * 0.05, 0))
                pts.append(base + Vector((math.cos(ang) * 0.06, math.sin(ang) * 0.05, 0)) + lean * (t * height) + wob * t)
            bm = bmesh.new()
            seg = 12
            rings = []
            for k, c in enumerate(pts):
                t = k / 8
                r = 0.16 * (1 - t) ** 1.3 + 0.035 + (0.08 if k == 0 else 0)
                ring = []
                for j in range(seg):
                    a = math.tau * j / seg
                    ridge = 1 + 0.22 * math.sin(a * 3 + k * 0.7 + sidx) + 0.1 * math.sin(a * 7 + k)
                    ring.append(bm.verts.new(c + Vector((math.cos(a) * r * ridge, math.sin(a) * r * ridge * 0.9, 0))))
                rings.append(ring)
            for a_, b_ in zip(rings, rings[1:]):
                for j in range(seg):
                    jj = (j + 1) % seg
                    bm.faces.new((a_[j], a_[jj], b_[jj], b_[j]))
            trunk = common.mesh_object(f"{name}-stem{sidx}", bm, bark, None)
            common.add_modifier(trunk, "SUBSURF", levels=1, render_levels=1)
            objs.append(trunk)
            tips.append(pts[-1])
            # Crooked limbs from the top of each stem.
            for l in range(2):
                la = ang + (l - 0.5) * 1.4 + (rng.random() - 0.5) * 0.6
                end = pts[-1] + Vector((math.cos(la) * 0.45, math.sin(la) * 0.35, 0.25 + rng.random() * 0.2))
                limb = self._branch(f"{name}-limb{sidx}{l}", pts[-2], end, 0.045, 0.015, bark)
                objs.append(limb)
                tips.append(end)
        # Crown: leaf clusters around the limb ends.
        bm = bmesh.new()
        for tip in tips:
            for _ in range(2):
                c = tip + Vector(((rng.random() - 0.5) * 0.35, (rng.random() - 0.5) * 0.3, 0.05 + rng.random() * 0.2))
                r = 0.28 + rng.random() * 0.14
                sph = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
                for v in sph["verts"]:
                    v.co = Vector((v.co.x * 1.25, v.co.y * 1.1, v.co.z * 0.8)) + c
        crown = common.mesh_object(f"{name}-crown", bm, None, None)
        scatter.scatter(crown, lib["leaves"], 420.0, (0.7, 1.15), seed=int(rng.random() * 999), sink=0.14, pick=True)
        objs.append(crown)
        return objs

    def _branch(self, name, a, b, r0, r1, mat, seg=8):
        bm = bmesh.new()
        d = b - a
        n = 5
        rings = []
        side = d.orthogonal().normalized()
        up = d.cross(side).normalized()
        for k in range(n + 1):
            t = k / n
            c = a + d * t + up * math.sin(t * math.pi) * 0.05
            r = r0 + (r1 - r0) * t
            rings.append([bm.verts.new(c + (side * math.cos(math.tau * j / seg) + up * math.sin(math.tau * j / seg)) * r) for j in range(seg)])
        for p, q in zip(rings, rings[1:]):
            for j in range(seg):
                jj = (j + 1) % seg
                bm.faces.new((p[j], p[jj], q[jj], q[j]))
        return common.mesh_object(name, bm, mat, None)

    def _leaf_mesh(self):
        existing = bpy.data.objects.get("olive-leaf")
        if existing:
            return existing
        bm = bmesh.new()
        pts = [(0, 0), (0.012, 0.03), (0.01, 0.07), (0, 0.09), (-0.01, 0.07), (-0.012, 0.03)]
        vs = [bm.verts.new((x, y, 0)) for x, y in pts]
        bm.faces.new(vs)
        leaf = common.mesh_object("olive-leaf", bm, M.leaf(), None)
        leaf.hide_render = True
        leaf.location = (0, 0, -50)
        return leaf
