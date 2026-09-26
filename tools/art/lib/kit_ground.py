"""Ground: what lies on each walkable kind (grit, grass, gravel, cobbles,
furrows, floors, rugs, mats), the terrain kinds (hills, cliffs, water), and
the scatter library they draw from. The ground's colour comes from the
layered material in place.py; this kit adds the geometry that makes it read
as real ground under a raking sun."""
import math

import bmesh
import bpy
from mathutils import Vector

import common
import materials as M
import rocks
import scatter
import terrain


class GroundKit:
    # ── scatter library ─────────────────────────────────────────────────────
    def _library(self):
        """Hidden source meshes for scattering: dry grass tufts, green tufts,
        pebbles, stones, leaves."""
        if getattr(self, "_lib", None):
            return self._lib
        lib = bpy.data.collections.new("library")
        bpy.context.scene.collection.children.link(lib)
        lib.hide_render = True
        rng = self.rng

        def tufts(name, count, mat, length=(0.08, 0.2), blades=(7, 15)):
            col = bpy.data.collections.new(name)
            lib.children.link(col)
            for t in range(count):
                bm = bmesh.new()
                nb = blades[0] + int(rng.random() * (blades[1] - blades[0]))
                for b in range(nb):
                    ang = rng.random() * math.tau
                    lean = 0.15 + rng.random() * 0.5
                    ln = length[0] + rng.random() * (length[1] - length[0])
                    w = 0.006 + rng.random() * 0.004
                    base = Vector((math.cos(ang) * 0.02, math.sin(ang) * 0.02, 0))
                    d = Vector((math.cos(ang) * lean, math.sin(ang) * lean, 1.0)).normalized()
                    side = Vector((-math.sin(ang), math.cos(ang), 0)) * w
                    pts = [base + d * ln * k / 3 + Vector((0, 0, -0.02 * (k / 3) ** 2 * lean)) for k in range(4)]
                    verts = []
                    for k, p in enumerate(pts):
                        taper = 1 - k / 3.3
                        verts.append((bm.verts.new(p - side * taper), bm.verts.new(p + side * taper)))
                    for a, b2 in zip(verts, verts[1:]):
                        bm.faces.new((a[0], a[1], b2[1], b2[0]))
                obj = common.mesh_object(f"{name}{t}", bm, mat, None)
                for c in obj.users_collection:
                    c.objects.unlink(obj)
                col.objects.link(obj)
            return col

        def stones(name, count, mat, flat=0.5, hull=False):
            col = bpy.data.collections.new(name)
            lib.children.link(col)
            for t in range(count):
                bm = bmesh.new()
                if hull:
                    # Angular chips and flat stones (unit size; scattering scales them).
                    layer = bm.faces.layers.float.new("rand")
                    rocks.stone_mesh(bm, 1000 + t * 7 + len(name), (1.0, 0.8 + rng.random() * 0.3, 0.7), flat=flat, blocky=0.7, n=16, sink=0.3)
                    r = rng.random()
                    for f in bm.faces:
                        f[layer] = r
                    obj = common.mesh_object(f"{name}{t}", bm, mat, None, smooth=False)
                else:
                    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
                    sx, sy, sz = 0.6 + rng.random() * 0.5, 0.5 + rng.random() * 0.4, (0.3 + rng.random() * 0.2) * flat * 2
                    for v in bm.verts:
                        n = math.sin(v.co.x * 4 + t) * 0.12 + math.sin(v.co.y * 5 + 1) * 0.1 + math.sin(v.co.z * 7 + t) * 0.05
                        v.co = Vector((v.co.x * sx * (1 + n), v.co.y * sy * (1 + n), v.co.z * sz * (1 + n) + 0.1))
                    obj = common.mesh_object(f"{name}{t}", bm, mat, None)
                for c in obj.users_collection:
                    c.objects.unlink(obj)
                col.objects.link(obj)
            return col

        out = {
            "tufts": tufts("tufts", 5, M.grass_blades()),
            "pebbles": stones("pebbles", 4, M.pebble()),
        }
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
        out["leaves"] = leaves
        if self.style in ("wilderness", "oasis"):
            out["stones"] = stones("stones", 8, M.rock("#a99d86", "scatter-stone", lichen=0.25), flat=0.42, hull=True)
            out["gravel"] = stones("gravel", 6, M.rock("#a4977f", "gravel-stone"), flat=0.5, hull=True)
        if self.style == "oasis":
            out["green"] = tufts("green", 6, M.grass_blades_green(), (0.1, 0.26), (10, 20))
        if self.style == "wilderness":
            out["shrubs"] = self._shrublets(lib)
        self._lib = out
        return out

    def _shrublets(self, lib):
        """Low desert shrublets (like spiny burnet and wormwood): a dome of
        wiry grey-green twigs."""
        col = bpy.data.collections.new("shrublets")
        lib.children.link(col)
        rng = self.rng
        twig = M.plain("#6a5e4c", 0.85)
        foliage = M.leaf("#838066", "#a39e86")
        for t in range(4):
            bm = bmesh.new()
            n = 18 + int(rng.random() * 10)
            for k in range(n):
                a = rng.random() * math.tau
                el = 0.4 + rng.random() * 0.9
                ln = 0.08 + rng.random() * 0.1
                d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
                p0 = Vector((0, 0, 0))
                p1 = p0 + d * ln
                side = d.orthogonal().normalized() * 0.004
                v = [bm.verts.new(p0 - side), bm.verts.new(p0 + side), bm.verts.new(p1 + side * 0.4), bm.verts.new(p1 - side * 0.4)]
                bm.faces.new(v)
            for k in range(70):
                a = rng.random() * math.tau
                r = rng.random() ** 0.7 * 0.11
                c = Vector((math.cos(a) * r, math.sin(a) * r * 0.9, 0.02 + math.sqrt(max(0.0, 0.11**2 - r * r)) * 0.9 + (rng.random() - 0.5) * 0.02))
                sph = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.01 + rng.random() * 0.01)
                vs = set(sph["verts"])
                for vv in vs:
                    vv.co = vv.co + c
                for f in bm.faces:
                    if f.verts[0] in vs:
                        f.material_index = 1
            obj = common.mesh_object(f"shrub{t}", bm, twig, None)
            obj.data.materials.append(foliage)
            for c in obj.users_collection:
                c.objects.unlink(obj)
            col.objects.link(obj)
        return col

    def emitter(self, name, cells, sub=1, keep=None, z=0.012):
        """A mesh over `cells` (following the terrain) to scatter on, optionally
        only on sub-cells where `keep(x, y)` holds."""
        bm = bmesh.new()
        for x, y in cells:
            for j in range(sub):
                for i in range(sub):
                    x0, y0 = x + i / sub, y + j / sub
                    if keep is not None and not keep(x0, y0):
                        continue
                    v = [bm.verts.new(self.P(x0 + dx / sub, y0 + dy / sub, z)) for dx, dy in ((0, 0), (1, 0), (1, 1), (0, 1))]
                    bm.faces.new(v[::-1])
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        obj = common.mesh_object(name, bm, None, self.col_ground)
        self.ground_objects.append(obj)
        return obj

    # ── walkable kinds ──────────────────────────────────────────────────────
    def tile_sand(self):
        """Bare earth, sand or dust: scattered grit and pebbles (and stones in
        the wilderness)."""
        m = self.map
        lib = self._library()
        cells = m.tiles("sand") + (m.tiles("scrub") if self.style == "city" else [])
        if not cells:
            return
        if "gravel" in lib:
            scatter.scatter(self.emitter("grit", cells), lib["gravel"], 34.0, (0.008, 0.022), seed=9, rotate_z_only=True, pick=True)
            scatter.scatter(self.emitter("sand-stones", cells), lib["stones"], 0.6, (0.03, 0.07), seed=19, rotate_z_only=True, pick=True)
        else:
            scatter.scatter(self.emitter("grit", cells), lib["pebbles"], 7.0, (0.01, 0.032), seed=9, rotate_z_only=True, pick=True)

    def tile_scrub(self):
        """Scrubby ground: patchy dry grass tufts (city, wilderness, with
        shrublets there), or green grass and weeds between the palms (oasis)."""
        from place import value_noise

        m = self.map
        lib = self._library()
        cells = m.tiles("scrub") + (m.tiles("cloth") if self.style == "city" else [])
        if not cells:
            return
        sub = 4
        field = value_noise(m.w * sub + 4, m.h * sub + 4, 5, 21)

        def keep(x0, y0):
            return field[int(y0 * sub), int(x0 * sub)] >= (0.42 if self.style != "oasis" else 0.45)

        em = self.emitter("grass", cells, sub, keep, z=0.015)
        if self.style == "oasis":
            scatter.scatter(em, lib["green"], 38.0, (0.5, 1.3), seed=3, rotate_z_only=True, pick=True)
            scatter.scatter(self.emitter("oasis-dry", cells, sub, lambda x0, y0: not keep(x0, y0), z=0.015), lib["tufts"], 10.0, (0.5, 1.1), seed=5, rotate_z_only=True, pick=True)
        else:
            scatter.scatter(em, lib["tufts"], 34.0 if self.style == "city" else 18.0, (0.6, 1.5), seed=3, rotate_z_only=True, pick=True)
        if "shrubs" in lib:
            scatter.scatter(self.emitter("scrub-shrubs", cells), lib["shrubs"], 0.9, (0.7, 1.6), seed=13, rotate_z_only=True, pick=True)
        if self.style != "city":
            scatter.scatter(self.emitter("scrub-grit", cells), lib["pebbles"], 5.0, (0.01, 0.03), seed=29, rotate_z_only=True, pick=True)

    def tile_grass(self):
        """Green grass (oasis gardens)."""
        cells = self.map.tiles("grass")
        if cells:
            lib = self._library()
            scatter.scatter(self.emitter("green-grass", cells, z=0.015), lib.get("green", lib["tufts"]), 90.0, (0.7, 1.4), seed=41, rotate_z_only=True, pick=True)

    def tile_road(self):
        """A beaten road: packed dust with two worn wheel ruts, loose gravel
        pushed to the verges, stones along the edges."""
        m = self.map
        lib = self._library()
        cells = m.tiles("road")
        if not cells:
            return
        rng = self.rng
        scatter.scatter(self.emitter("road-gravel", cells), lib.get("gravel", lib["pebbles"]), 16.0, (0.012, 0.03), seed=51, rotate_z_only=True, pick=True)
        edge = [(x, y) for x, y in cells if not all(m.kind(x, y + d) == "road" for d in (-1, 1))]
        if edge and "stones" in lib:
            scatter.scatter(self.emitter("road-verge", edge), lib["stones"], 1.2, (0.04, 0.11), seed=53, rotate_z_only=True, pick=True)
        _ = rng

    def tile_paving(self):
        """Paving: worn limestone slabs in courses (city), or the rougher
        field-stone flags of a yard (oasis)."""
        if self.style == "city":
            self.city_paving()
        else:
            self.yard_paving()

    def yard_paving(self):
        """Irregular flags of field stone in a yard, gaps full of earth and
        a few weeds."""
        self.yard_flags(kinds=("paving",))
        lib = self._library()
        if "green" in lib:
            from place import value_noise

            m = self.map
            field = value_noise(m.w * 3 + 4, m.h * 3 + 4, 4, 77)
            cells = m.tiles("paving")
            em = self.emitter("paving-weeds", cells, 3, lambda x0, y0: field[int(y0 * 3), int(x0 * 3)] > 0.72, z=0.03)
            scatter.scatter(em, lib["green"], 10.0, (0.3, 0.6), seed=61, rotate_z_only=True, pick=True)

    def tile_steps(self):
        """Stone steps up to the north."""
        self.city_steps()

    def tile_floor(self):
        """An interior floor of beaten earth: laid in the room shell (home)."""

    def tile_rug(self):
        """A woven rug on the floor (walkable): one rug per block of rug tiles."""
        m = self.map
        cells = set(m.tiles("rug"))
        if not cells:
            return
        xs = [c[0] for c in cells]
        ys = [c[1] for c in cells]
        x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
        mat = M.textile(["#8a3a2c", "#8a3a2c", "#c9b48a", "#3a4a66", "#c9b48a", "#8a3a2c"], "rug", band=0.07, border="#3a2a22")
        bm = bmesh.new()
        nx, ny = (x1 - x0) * 8, (y1 - y0) * 8
        grid = []
        for j in range(ny + 1):
            row = []
            for i in range(nx + 1):
                x = x0 + 0.08 + (x1 - x0 - 0.16) * i / nx
                y = y0 + 0.1 + (y1 - y0 - 0.2) * j / ny
                ripple = 0.006 * math.sin(i * 0.9) * math.sin(j * 0.7)
                row.append(bm.verts.new(self.P(x, y, 0.012 + ripple)))
            grid.append(row)
        uv = bm.loops.layers.uv.new("UVMap")
        for j in range(ny):
            for i in range(nx):
                f = bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
                for loop, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                    loop[uv].uv = (ii / nx, jj / ny)
        rug = common.mesh_object("rug", bm, mat, self.col_ground)
        common.add_modifier(rug, "SOLIDIFY", thickness=0.01)
        self.ground_objects.append(rug)
        # Fringes at both short ends.
        fringe = M.plain("#d8ccb0", 0.9)
        bm = bmesh.new()
        for x in (x0 + 0.06, x1 - 0.06):
            for k in range(int((y1 - y0) * 30)):
                y = y0 + 0.12 + k / 30
                sgn = -1 if x < (x0 + x1) / 2 else 1
                v = [bm.verts.new(self.P(x, y, 0.014)), bm.verts.new(self.P(x + sgn * 0.07, y + 0.004, 0.006)), bm.verts.new(self.P(x + sgn * 0.07, y + 0.012, 0.006)), bm.verts.new(self.P(x, y + 0.008, 0.014))]
                bm.faces.new(v)
        self.ground_objects.append(common.mesh_object("rug-fringe", bm, fringe, self.col_ground))

    def tile_mat(self):
        """A rush mat on the floor (walkable)."""
        for x0, x1, y in self.map.runs("mat"):
            mat = common.box(f"mat-{x0}-{y}", (x1 - x0 - 0.12, 0.8, 0.018), self.P((x0 + x1) / 2, y + 0.5, 0.01), M.straw("#b89c66"), None, bevel=0.006)
            common.bake_modifiers(mat)
            self.to_ground(mat)

    def tile_bedroll(self):
        """Bedding on the floor (walkable): a mat with a rolled blanket."""
        for x0, x1, y in self.map.runs("bedroll"):
            w = x1 - x0
            base = common.box(f"bed-{x0}-{y}", (w - 0.12, 0.82, 0.03), self.P((x0 + x1) / 2, y + 0.5, 0.015), M.straw("#ad9464"), None, bevel=0.008)
            common.bake_modifiers(base)
            self.to_ground(base)
            blanket = common.box(f"bed-blanket-{x0}-{y}", (w * 0.55, 0.78, 0.04), self.P(x0 + w * 0.62, y + 0.5, 0.05), M.textile(["#5a3a4a", "#c9b996", "#7a3a2c", "#c9b996"], "bed-blanket", band=0.09), None, bevel=0.02)
            common.bake_modifiers(blanket)
            self.to_ground(blanket)
            roll = self._branch(f"bed-roll-{x0}-{y}", self.P(x0 + 0.18, y + 0.15, 0.07), self.P(x0 + 0.18, y + 0.85, 0.07), 0.07, 0.07, M.textile(["#3a4a66", "#c9b996"], "bed-roll", band=0.2), 12, bow=0.0)
            self.to_ground(roll)

    def tile_wadi(self):
        """A dry streambed: a pale bed of washed gravel with a meandering low
        channel where the last flood ran, cobbles sorted into bars along it,
        and twigs and dry weed left in the drift lines."""
        m = self.map
        lib = self._library()
        cells = m.tiles("wadi") + m.tiles("mud")
        if not cells:
            return
        rng = self.rng
        scatter.scatter(self.emitter("wadi-gravel", cells), lib.get("gravel", lib["pebbles"]), 40.0, (0.01, 0.03), seed=71, rotate_z_only=True, pick=True)
        path = self._wadi_path(set(cells))
        if len(path) < 2:
            return
        # The channel: a sunken strip of darker, damper gravel along the path.
        pts = []
        for (ax, ay), (bx, by) in zip(path, path[1:]):
            for k in range(6):
                t = k / 6
                pts.append((ax + (bx - ax) * t, ay + (by - ay) * t))
        pts.append(path[-1])
        # Meander: offset sideways by a smooth wave.
        mean = []
        for i, (x, y) in enumerate(pts):
            j = min(i + 1, len(pts) - 1)
            k = max(i - 1, 0)
            dx, dy = pts[j][0] - pts[k][0], pts[j][1] - pts[k][1]
            L = math.hypot(dx, dy) or 1.0
            nx, ny = -dy / L, dx / L
            off = math.sin(i * 0.35) * 0.18 + math.sin(i * 0.13 + 1.3) * 0.12
            mean.append((x + nx * off, y + ny * off))
        bm = bmesh.new()
        chan = M.ground_surface("wadi-channel", [], [{"color": "#b3a386", "grit": 0.8, "scale": "mid", "rough": 0.8, "chips": 0.6}])
        prev = None
        for i, (x, y) in enumerate(mean):
            j = min(i + 1, len(mean) - 1)
            k = max(i - 1, 0)
            dx, dy = mean[j][0] - mean[k][0], mean[j][1] - mean[k][1]
            L = math.hypot(dx, dy) or 1.0
            nx, ny = -dy / L, dx / L
            w = 0.22 + 0.06 * math.sin(i * 0.5)
            row = [bm.verts.new(self.P(x + nx * w * f, y + ny * w * f, 0.003 - 0.028 * max(0.0, 1 - abs(f) / 1.4) ** 1.5)) for f in (-1.4, -0.7, 0.0, 0.7, 1.4)]
            if prev is not None:
                for a in range(4):
                    bm.faces.new((prev[a], prev[a + 1], row[a + 1], row[a]))
            prev = row
        obj = common.mesh_object("wadi-channel", bm, chan, self.col_ground)
        self.ground_objects.append(obj)
        # Cobble bars along the channel and drift lines of twigs.
        bars = [(int(x), int(y)) for x, y in mean[:: 3]]
        bars = [c for c in dict.fromkeys(bars) if c in set(cells)]
        if "stones" in lib and bars:
            em = self.emitter("wadi-cobbles", bars)
            scatter.scatter(em, lib["stones"], 7.0, (0.035, 0.09), seed=73, rotate_z_only=True, pick=True)
        twig = M.wood("#6a5a44", 3.0)
        dbm = bmesh.new()
        for i in range(0, len(mean), 4):
            x, y = mean[i]
            for _ in range(3):
                a = rng.random() * math.pi
                c = self.P(x + (rng.random() - 0.5) * 0.9, y + (rng.random() - 0.5) * 0.9, 0.012)
                d = Vector((math.cos(a), math.sin(a), 0)) * (0.05 + rng.random() * 0.1)
                sd = Vector((-d.y, d.x, 0)).normalized() * 0.006
                v = [dbm.verts.new(c - d - sd), dbm.verts.new(c + d - sd), dbm.verts.new(c + d + sd), dbm.verts.new(c - d + sd)]
                dbm.faces.new(v)
        self.ground_objects.append(common.mesh_object("wadi-drift", dbm, twig, self.col_ground, smooth=False))

    def _wadi_path(self, cells):
        """Tile centres along the wadi, from its first tile (north-west) to
        the farthest one: the way the water ran."""
        start = min(cells, key=lambda c: (c[1] + c[0] * 0.2))
        prev = {start: None}
        queue = [start]
        i = 0
        while i < len(queue):
            c = queue[i]
            i += 1
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb = (c[0] + dx, c[1] + dy)
                if nb in cells and nb not in prev:
                    prev[nb] = c
                    queue.append(nb)
        # The end: the farthest tile, preferring the middle row of a wide bed.
        end = queue[-1]
        path = []
        c = end
        while c is not None:
            path.append((c[0] + 0.5, c[1] + 0.5))
            c = prev[c]
        path.reverse()
        # Keep to the middle of wide beds.
        rows = {}
        for x, y in cells:
            rows.setdefault(x, []).append(y)
        out = []
        for x, y in path:
            ys = rows.get(int(x), [int(y)])
            if max(ys) - min(ys) >= 2 and int(y) in ys:
                y = (min(ys) + max(ys) + 1) / 2 + (y - int(y) - 0.5) * 0.2
            out.append((x, y))
        return out

    def tile_mud(self):
        """Damp mud left by the flood: an irregular dark patch drying into
        curling, cracked plates at its edges."""
        m = self.map
        mat = M.mud()
        rng = self.rng
        for x, y in m.tiles("mud"):
            bm = bmesh.new()
            c = (x + 0.5, y + 0.5)
            ring = []
            n = 28
            center = bm.verts.new(self.P(c[0], c[1], 0.006))
            for k in range(n):
                a = math.tau * k / n
                r = 0.52 + 0.12 * math.sin(a * 3 + x) + 0.08 * math.sin(a * 7 + y) + rng.random() * 0.04
                ring.append(bm.verts.new(self.P(c[0] + math.cos(a) * r * 1.2, c[1] + math.sin(a) * r * 0.8, 0.004)))
            for k in range(n):
                bm.faces.new((center, ring[k], ring[(k + 1) % n]))
            obj = common.mesh_object(f"mud-{x}-{y}", bm, mat, self.col_ground)
            common.add_modifier(obj, "SUBSURF", levels=2, render_levels=2)
            self.ground_objects.append(obj)

    def tile_soil(self):
        """Tilled, irrigated soil: furrows and a water channel."""
        m = self.map
        mat = M.plain("#5e4630", 0.9, 0.15)
        for x0, x1, y in m.runs("soil"):
            bm = bmesh.new()
            for k in range(3):
                yy = y + 0.2 + k * 0.3
                x = x0 + 0.05
                while x < x1 - 0.05:
                    nx = min(x1 - 0.05, x + 0.25)
                    ridge = [self.P(x, yy - 0.06, 0.0), self.P(nx, yy - 0.06, 0.0), self.P(nx, yy, 0.045), self.P(x, yy, 0.045)]
                    v = [bm.verts.new(p) for p in ridge]
                    bm.faces.new(v[::-1])
                    ridge2 = [self.P(x, yy, 0.045), self.P(nx, yy, 0.045), self.P(nx, yy + 0.07, 0.0), self.P(x, yy + 0.07, 0.0)]
                    v = [bm.verts.new(p) for p in ridge2]
                    bm.faces.new(v[::-1])
                    x = nx
            self.ground_objects.append(common.mesh_object(f"furrows-{x0}-{y}", bm, mat, self.col_ground, smooth=True))
        # Water standing in the channels between plots.
        chan = [(x, y) for x, y in m.tiles("soil") if m.kind(x, y - 1) == "crops" or m.kind(x, y + 1) == "crops"]
        wet = M.water()
        for x, y in chan[:: max(1, len(chan) // 12)]:
            o = self._ellipsoid(f"channel-{x}-{y}", self.P(x + 0.5, y + 0.92, 0.01), (0.5, 0.05, 0.003), wet, 16, 4)
            self.to_ground(o)

    def tile_water(self):
        """Open water (a spring pool): a basin in the terrain, a clear green
        water surface, wet dark banks."""
        cells = self.map.tiles("water")
        if not cells:
            return
        w = terrain.water_surface(self, cells, -0.14, M.pool_water(), self.col_ground)
        self.ground_objects.append(w)

    def tile_hill(self):
        """Hills: shaped in the terrain (terrain.RISE). Dressed with scattered
        stones, shrublets and boulders on the slopes."""
        m = self.map
        lib = self._library()
        cells = m.tiles("hill")
        if not cells or "stones" not in lib:
            return
        scatter.scatter(self.emitter("hill-stones", cells), lib["stones"], 2.2, (0.03, 0.1), seed=81, rotate_z_only=True, pick=True)
        scatter.scatter(self.emitter("hill-gravel", cells), lib["gravel"], 46.0, (0.008, 0.025), seed=83, rotate_z_only=True, pick=True)
        if "shrubs" in lib:
            from place import value_noise

            field = value_noise(m.w * 2 + 4, m.h * 2 + 4, 3, 85)
            em = self.emitter("hill-shrubs", cells, 2, lambda x0, y0: field[int(y0 * 2), int(x0 * 2)] > 0.55)
            scatter.scatter(em, lib["shrubs"], 1.6, (0.8, 1.7), seed=87, rotate_z_only=True, pick=True)

    def tile_cliff(self):
        """Cliffs: shaped in the terrain (tall, near-sheer faces); scree and
        fallen blocks gather where they meet the ground."""
        m = self.map
        lib = self._library()
        cells = m.tiles("cliff")
        if not cells or "stones" not in lib:
            return
        scatter.scatter(self.emitter("cliff-stones", cells), lib["stones"], 1.4, (0.05, 0.16), seed=91, rotate_z_only=True, pick=True)
        foot = [(x, y) for x, y in cells if m.walkable(x, y + 1)]
        scree = [(x, y + 1) for x, y in foot]
        if scree:
            em = self.emitter("scree", scree, 4, lambda x0, y0: (y0 - int(y0)) < 0.3)
            scatter.scatter(em, lib["gravel"], 40.0, (0.015, 0.045), seed=93, rotate_z_only=True, pick=True)
            scatter.scatter(em, lib["stones"], 3.0, (0.03, 0.08), seed=95, rotate_z_only=True, pick=True)

    # ── the market's dressing ───────────────────────────────────────────────
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
                v = [
                    bm.verts.new(self.P(cx - dx - dy * w / length, cy - dy + dx * w / length, 0.042)),
                    bm.verts.new(self.P(cx + dx - dy * w / length, cy + dy + dx * w / length, 0.042)),
                    bm.verts.new(self.P(cx + dx + dy * w / length, cy + dy - dx * w / length, 0.042)),
                    bm.verts.new(self.P(cx - dx + dy * w / length, cy - dy - dx * w / length, 0.042)),
                ]
                bm.faces.new(v)
        self.ground_objects.append(common.mesh_object("straw", bm, straw_mat, self.col_ground, smooth=False))
        dung = M.plain("#4a3a28", 0.7, 0.2)
        for e in m.entities:
            if e["sprite"] == "donkey" and not e.get("conditional"):
                for k in range(3):
                    c = self.P(e["x"] + 0.2 + rng.random() * 0.6, e["y"] + 0.9 + rng.random() * 0.3, 0.03)
                    self.to_ground(self._ellipsoid(f"dung-{e['id']}-{k}", c, (0.035, 0.03, 0.02), dung, 8, 5))
        wet = M.plain("#5c4c3a", 0.35, 0.45)
        for kind in ("well", "trough"):
            for x, y in m.tiles(kind):
                self.to_ground(self._ellipsoid(f"wet-{x}-{y}", self.P(x + 0.5, y + 1.05, 0.038), (0.55, 0.3, 0.002), wet, 20, 4))
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        for y in range(m.h):
            for x in range(m.w):
                if m.kind(x, y) in ("sand", "scrub") and m.kind(x, y - 1) in ("wall", "roof") and rng.random() < 0.5:
                    for _ in range(2 + int(rng.random() * 3)):
                        size = 0.03 + rng.random() * 0.05
                        sph = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
                        c = self.P(x + rng.random(), y + 0.05 + rng.random() * 0.2, 0.02)
                        rr = rng.random()
                        for v in sph["verts"]:
                            v.co = Vector((v.co.x * size, v.co.y * size * 0.8, v.co.z * size * 0.6)) + c
                        for f in bm.faces:
                            if f.verts[0] in sph["verts"]:
                                f[layer] = rr
        self.ground_objects.append(common.mesh_object("rubble", bm, self.limestone, self.col_ground))

    # ── the wilderness ──────────────────────────────────────────────────────
    def dress_wilderness(self):
        """Loose boulders on the hills, sorted by nothing (part of the ground:
        they never stand between the camera and anyone who could walk behind
        them, because they lie on solid tiles)."""
        m = self.map
        rng = self.rng
        mat = M.rock("#c8b898", "hill-boulder", lichen=0.3)
        redmat = M.rock("#c3a88c", "hill-boulder-red", lichen=0.15, red=0.55)
        for y in range(m.h):
            for x in range(m.w):
                if m.kind(x, y) not in ("hill", "cliff"):
                    continue
                # Boulders only on tiles whose whole neighbourhood is solid, so
                # nobody ever stands where one would hide them.
                if any(m.walkable(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-2, -1, 0, 1)):
                    continue
                if rng.random() < 0.16:
                    s = 0.14 + rng.random() * 0.22
                    red = m.near(x, y, ("cliff",), 1)
                    o = self.boulder(f"hb-{x}-{y}", self.P(x + rng.random(), y + rng.random()), (s, s * 0.8, s * 0.6), redmat if red else mat, rng.random() * 9)
                    self.to_ground(o)
