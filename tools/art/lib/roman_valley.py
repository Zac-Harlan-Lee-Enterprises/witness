"""The Lycus valley for the Roman kit (kit_roman.py): rubble-and-stucco farm
buildings under tiled roofs (the dye works, the waystation), the paved
highway between its kerbstones, a stone bridge over the river, the white
travertine of Hierapolis, wet meadows and hillsides, and the valley's
dressing after rain."""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import common
import materials as M
import roman_materials as R
import scatter
from roman_geom import B, Q, voronoi

PITCH = math.tan(math.radians(24.0))


class RomanValley:
    # ── farm buildings ──────────────────────────────────────────────────────
    def oasis_structures(self):
        """Buildings in the valley: blocks of tile-roof tiles with a row of
        wall tiles along their south side are rubble-and-stucco buildings
        under a gabled tile roof, their fronts on the wall row. Other
        places: the shared mudbrick houses."""
        if not self.roman:
            return super().oasis_structures()
        m = self.map
        for reg in self.regions(kinds=("wall", "door", "tile-roof")):
            cells = set(reg)
            roof = [c for c in reg if m.kind(*c) == "tile-roof"]
            if not roof:
                continue
            xs = [c[0] for c in reg]
            ys = [c[1] for c in reg]
            x0, x1, n, s = min(xs), max(xs) + 1, min(ys), max(ys)
            name = f"house-{x0}-{n}"
            self._farm_building(name, x0, x1, n, s, cells)

    def _farm_building(self, name, x0, x1, n, s, cells):
        m = self.map
        rng = self.rng
        y_face = s + 0.92
        wide = x1 - x0 >= 8
        h = 2.75 if wide else 2.45
        mat = self._mat("stucco-farm")
        doors = [x for x in range(x0, x1) if m.kind(x, s) == "door"]
        openings = [(dx + 0.14, dx + 0.86, 0.0, 1.95) for dx in doors]
        windows = []
        wx = x0 + 1.1
        while wx < x1 - 1.0:
            if all(abs(wx - dx) > 1.3 for dx in doors):
                windows.append((wx, wx + 0.42, 1.55, 1.98))
            wx += 2.6
        objs = self._front(name, x0, x1, y_face, h, mat, openings + windows, back=n, cornice=False)
        for a, b, c, d in windows:
            objs += self._window(f"{name}-win{a:.1f}", a, b, y_face, c, d, "grille" if wide else "shutters")
        for dx in doors:
            objs += self._door(f"{name}-door{dx}", dx + 0.14, dx + 0.86, y_face, 1.95, open_=0.8)
        # Quoins of dressed stone at the corners.
        qb, ql = self._rbm()
        z = 0.0
        k = 0
        while z < h - 0.05:
            ch = 0.3
            for cx in (x0, x1):
                ln = 0.45 if k % 2 else 0.3
                a = cx if cx == x0 else cx - ln
                self._cbox(qb, ql, a, y_face - 0.02, a + ln, y_face + 0.03, z + 0.01, min(h, z + ch) - 0.01, chamfer=0.015, point=B)
            z += ch
            k += 1
        objs.append(self._obj(f"{name}-quoins", qb, self._mat("ashlar")))
        # A gabled roof, both slopes, the ridge running east-west.
        y_back = n - 0.05
        y_ridge = (y_back + y_face) / 2
        over = 0.3
        z_eave = h + 0.03
        z_ridge = z_eave + (y_face + over - y_ridge) * PITCH
        objs += self._tile_roof(f"{name}-roof", x0 - 0.18, x1 + 0.18, y_face + over, z_eave, y_ridge, z_ridge)
        objs += self._tile_roof(f"{name}-roofback", x0 - 0.18, x1 + 0.18, y_back - over, z_eave, y_ridge, z_ridge, antefix=False, ridge=False)
        # Gable ends: stucco triangles under the roof's ends.
        gb = bmesh.new()
        for gx in (x0, x1):
            pts = [(y_back, h), (y_face, h), (y_ridge, z_ridge - 0.04)]
            gb.faces.new([gb.verts.new(B(gx, yy, zz)) for yy, zz in pts])
        objs.append(self._obj(f"{name}-gables", gb, mat))
        if wide:
            # A waystation: a sign board over the door, a bench, amphorae.
            for dx in doors:
                board = common.box(f"{name}-signboard", (0.9, 0.04, 0.34), B(dx + 0.5, y_face + 0.03, 2.25), M.wood("#7a5a3a", 8.0), None, bevel=0.01)
                objs.append(board)
                objs.append(self._lathe(f"{name}-sign-cup", [(0.0, 0.0), (0.06, 0.0), (0.08, 0.08), (0.07, 0.1)], B(dx + 0.35, y_face + 0.06, 2.15), M.plain("#8a2a1c", 0.7), 12))
                objs.append(self._lathe(f"{name}-sign-jug", [(0.03, 0.0), (0.06, 0.06), (0.05, 0.14), (0.02, 0.18)], B(dx + 0.65, y_face + 0.06, 2.13), M.plain("#c49a3a", 0.7), 12))
                bench, bl = self._rbm()
                self._cbox(bench, bl, dx + 1.1, y_face, dx + 2.6, y_face + 0.34, 0.0, 0.42, chamfer=0.03, point=B)
                objs.append(self._obj(f"{name}-bench", bench, self._mat("ashlar")))
                objs.append(self._branch(f"{name}-lampbracket", B(dx - 0.1, y_face - 0.02, 2.0), B(dx - 0.1, y_face + 0.25, 2.0), 0.012, 0.012, self._mat("iron"), 6, bow=0.0))
                objs.append(self._ellipsoid(f"{name}-lamp", B(dx - 0.1, y_face + 0.25, 1.9), (0.05, 0.04, 0.025), M.terracotta("#b2714a", 0.1), 12, 6))
            for k in range(2):
                objs += self.amphora(f"{name}-amph{k}", self.P(x0 + 0.5 + k * 0.32, y_face + 0.25), 0.95, "#b87a54", (-0.22, 0.05 * k), rng.random() * math.tau)
        self.sprite(name, y_face + 0.02, objs, sorted(cells))

    # ── the highway ─────────────────────────────────────────────────────────
    def tile_roman_road(self):
        """A Roman highway: fitted polygonal slabs of hard grey limestone,
        cambered, worn into two wheel ruts, between lines of kerbstones;
        after rain, dark and shining with water standing in the ruts."""
        m = self.map
        cells = set(m.tiles("roman-road"))
        if not cells:
            return
        rng = random.Random(4242)
        rows = sorted({y for _x, y in cells})
        bands = []
        for y in rows:
            if bands and y == bands[-1][1]:
                bands[-1][1] = y + 1
            else:
                bands.append([y, y + 1])
        wet = self.light_plan.get("day") == "overcast"
        mat = self._mat("paver-wet" if wet else "paver")
        for bi, (y0, y1) in enumerate(bands):
            xs = [x for x, y in cells if y0 <= y < y1]
            x0, x1 = min(xs), max(xs) + 1
            kerb = 0.26
            top, bot = y0 + kerb, y1 - kerb
            mid = (top + bot) / 2
            half = (bot - top) / 2
            ruts = (mid - 0.62, mid + 0.62)

            def zt(px, py, mid=mid, half=half, ruts=ruts):
                camber = 0.045 * (1 - ((py - mid) / half) ** 2)
                rut = sum(0.028 * max(0.0, 1 - abs(py - r) / 0.16) for r in ruts)
                return 0.05 + camber - rut

            spacing = 0.52
            pts = []
            yy = top + spacing * 0.5
            row = 0
            while yy < bot:
                xx = x0 - 0.5 + (spacing * 0.5 if row % 2 else 0.0)
                while xx < x1 + 0.5:
                    pts.append((xx + (rng.random() - 0.5) * spacing * 0.7, yy + (rng.random() - 0.5) * spacing * 0.6))
                    xx += spacing
                yy += spacing * 0.86
                row += 1
            cells_v = voronoi(pts, (x0 - 0.02, top, x1 + 0.02, bot), spacing * 1.2)
            bm, layer = self._rbm()
            for poly in cells_v:
                if len(poly) < 3:
                    continue
                cx = sum(p[0] for p in poly) / len(poly)
                if cx < x0 - 0.3 or cx > x1 + 0.3:
                    continue
                self._prism(bm, layer, poly, zt, 0.1, 0.022, rng.random(), dome=0.008)
            self.to_ground(common.mesh_object(f"highway-{bi}", bm, mat, None, smooth=True))
            # Kerbstones along both edges.
            kb, kl = self._rbm()
            for ky0, ky1 in ((y0 + 0.02, y0 + kerb), (y1 - kerb, y1 - 0.02)):
                x = x0 - 0.2
                while x < x1 + 0.2:
                    ln = 0.5 + rng.random() * 0.35
                    zt_ = 0.14 + rng.random() * 0.04
                    self._cbox(kb, kl, x + 0.01, ky0, x + ln - 0.01, ky1, -0.06, zt_, chamfer=0.035, r=rng.random())
                    x += ln
            self.to_ground(self._obj(f"kerbs-{bi}", kb, self._mat("kerb-wet" if wet else "paver")))
            if wet:
                # Water standing in the ruts and in low places.
                pb = bmesh.new()
                for r in ruts:
                    x = x0 + rng.random() * 1.5
                    while x < x1:
                        ln = 0.3 + rng.random() * 0.9
                        n = 10
                        ring = []
                        for k in range(n):
                            a = math.tau * k / n
                            ring.append(pb.verts.new(self.P(x + ln / 2 + math.cos(a) * ln / 2, r + math.sin(a) * (0.09 + rng.random() * 0.03), 0.03)))
                        pb.faces.new(ring)
                        x += ln + 0.6 + rng.random() * 2.2
                self.to_ground(common.mesh_object(f"highway-water-{bi}", pb, self._mat("water"), None, smooth=True))

    # ── the bridge ──────────────────────────────────────────────────────────
    def tile_bridge(self):
        """A stone bridge: a paved deck a little above the banks, ramping
        down at each end, low parapets with coping stones and end posts,
        and masonry wing walls where it meets the bank."""
        m = self.map
        cells = m.tiles("bridge")
        if not cells:
            return
        xs = [c[0] for c in cells]
        ys = [c[1] for c in cells]
        x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
        rng = self.rng
        wet = self.light_plan.get("day") == "overcast"
        deck_h = 0.16
        ramp = 0.6

        def h_at(py):
            if py < y0:
                return deck_h * max(0.0, 1 - (y0 - py) / ramp)
            if py > y1:
                return deck_h * max(0.0, 1 - (py - y1) / ramp)
            return deck_h

        pb, pl = self._rbm()
        yy = y0 - ramp
        while yy < y1 + ramp - 0.05:
            ch = 0.42 + rng.random() * 0.12
            xx = x0 + 0.3
            while xx < x1 - 0.3:
                ln = min(x1 - 0.3 - xx, 0.5 + rng.random() * 0.4)
                a, b = yy + 0.008, min(y1 + ramp, yy + ch) - 0.008
                self._cbox(pb, pl, xx + 0.008, a, xx + ln - 0.008, b, -0.2, h_at((a + b) / 2) + 0.03, chamfer=0.02, point=lambda px, py, z: Q(px, py, z))
                xx += ln
            yy += ch
        self.to_ground(self._obj("bridge-deck", pb, self._mat("paver-wet" if wet else "paver")))
        # Parapets and end posts (a sprite: people cross between them).
        objs = []
        sb, sl = self._rbm()
        for px0, px1 in ((x0 + 0.02, x0 + 0.3), (x1 - 0.3, x1 - 0.02)):
            v = y0 - 0.35
            while v < y1 + 0.35:
                ln = min(y1 + 0.35 - v, 0.45 + rng.random() * 0.2)
                hh = h_at(v + ln / 2)
                self._cbox(sb, sl, px0, v + 0.005, px1, v + ln - 0.005, -0.3, hh + 0.62, chamfer=0.02, point=lambda px, py, z: Q(px, py, 0.0) + Vector((0, 0, z)))
                self._cbox(sb, sl, px0 - 0.03, v + 0.005, px1 + 0.03, v + ln - 0.005, hh + 0.62, hh + 0.72, chamfer=0.025, point=lambda px, py, z: Q(px, py, 0.0) + Vector((0, 0, z)))
                v += ln
            for py in (y0 - 0.55, y1 + 0.25):
                self._cbox(sb, sl, px0 - 0.05, py, px1 + 0.05, py + 0.32, -0.1, 0.95, chamfer=0.03, point=lambda px, py_, z: Q(px, py_, 0.0) + Vector((0, 0, z)))
                self._cbox(sb, sl, px0 - 0.08, py - 0.03, px1 + 0.08, py + 0.35, 0.95, 1.05, chamfer=0.03, point=lambda px, py_, z: Q(px, py_, 0.0) + Vector((0, 0, z)))
        objs.append(self._obj("bridge-parapets", sb, self._mat("ashlar")))
        self.sprite("bridge", y1 + 0.6, objs, sorted(cells))
        # Wing walls on the north bank, facing the river.
        wb, wl = self._rbm()
        x = x0 - 1.4
        while x < x1 + 1.4:
            ln = 0.5 + rng.random() * 0.3
            z = -0.62
            while z < 0.05:
                self._cbox(wb, wl, x + 0.01, y0 - 0.32, x + ln - 0.01, y0 - 0.02, z, z + 0.22, chamfer=0.02, point=B)
                z += 0.22
            x += ln
        self.to_ground(self._obj("bridge-wings", wb, self._mat("ashlar")))

    # ── the white terraces ──────────────────────────────────────────────────
    def tile_travertine(self):
        """The travertine terraces of Hierapolis across the valley: the
        terrain rises there (terrain.RISE), and over it a skin of white
        calcite is stepped into terraces: level pools of pale turquoise
        water held behind scalloped rims, each rim falling in a short white
        curtain to the pool below. The rims wander (lobed noise), as the
        real ones do."""
        m = self.map
        cells = set(m.tiles("travertine"))
        if not cells:
            return
        from place import value_noise

        K = 12
        W, Hh = m.w * K + 1, m.h * K + 1
        lobe = value_noise(W + 2, Hh + 2, 16, 505) - 0.5
        lobe2 = value_noise(W + 2, Hh + 2, 5, 506) - 0.5
        fringe = value_noise(W + 2, Hh + 2, 10, 507)
        step = 0.3

        def shape(i, j):
            x, y = i / K, j / K
            t = (self.H(x, y) + 0.2 * lobe[j, i] + 0.09 * lobe2[j, i]) / step
            k = math.floor(t)
            f = t - k
            rise = 0.0 if f < 0.8 else (1 - math.cos(math.pi * min(1.0, (f - 0.8) / 0.17))) / 2
            rim = 0.022 * math.exp(-((f - 0.03) / 0.045) ** 2)
            wet = min(1.0, max(0.0, (f - 0.08) / 0.06)) * min(1.0, max(0.0, (0.78 - f) / 0.05))
            depth = wet * min(1.0, max(0.0, (f - 0.08) / 0.5))
            # Quantized upward, so the skin always lies over the terrain.
            return (k + 1 + rise) * step + rim, wet, depth

        def covered(i, j):
            x, y = (i + 0.5) / K, (j + 0.5) / K
            tx, ty = int(x), int(y)
            if (tx, ty) in cells:
                # A ragged foot where the terraces meet the meadow below.
                if m.walkable(tx, ty + 1) and (y - ty) > 0.35 + 0.6 * fringe[j, i]:
                    return False
                return True
            if m.walkable(tx, ty):
                return False
            near = any((tx + dx, ty + dy) in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1))
            return near and fringe[j, i] > 0.55

        bm = bmesh.new()
        wet_l = bm.verts.layers.float.new("wet")
        dep_l = bm.verts.layers.float.new("depth")
        grid = {}

        def vert(i, j):
            if (i, j) not in grid:
                h, wet, depth = shape(i, j)
                v = bm.verts.new(Vector((i / K, -(j / K + h), h + 0.006)))
                v[wet_l] = wet
                v[dep_l] = depth
                grid[(i, j)] = v
            return grid[(i, j)]

        for j in range(m.h * K):
            for i in range(m.w * K):
                if covered(i, j):
                    bm.faces.new((vert(i, j), vert(i, j + 1), vert(i + 1, j + 1), vert(i + 1, j)))
        bm.normal_update()
        skin = common.mesh_object("travertine", bm, R.travertine(), None, smooth=True)
        self.to_ground(skin)

    # ── water ───────────────────────────────────────────────────────────────
    def tile_water(self):
        """A river after rain: silty grey-green water, streaked by the
        current, over the basin the terrain gives it. Other places: the
        shared spring pool."""
        if not self.roman:
            return super().tile_water()
        cells = self.map.tiles("water")
        if not cells:
            return
        import terrain

        w = terrain.water_surface(self, cells, -0.2, R.river_water(), self.col_ground)
        w.visible_shadow = False
        self.ground_objects.append(w)
        # Foam where the current meets the bridge's footings.
        rng = self.rng
        foam = M.plain("#d8d6cc", 0.6, 0.2)
        for x, y in self.map.tiles("bridge"):
            for k in range(8):
                c = Q(x + 1.05 + rng.random() * 0.5, y + rng.random(), -0.19)
                self.to_ground(self._ellipsoid(f"foam-{x}-{y}-{k}", c, (0.08 + rng.random() * 0.12, 0.03, 0.004), foam, 10, 4))

    # ── meadows, hills and trees ────────────────────────────────────────────
    def _roman_lib(self):
        """Scatter sources for green country: lush grass tufts, wildflowers
        (poppies, daisies, yellow crowfoot) and field stones."""
        lib = self._library()
        if "wildflowers" in lib:
            return lib
        rng = self.rng
        root = bpy.data.collections["library"]

        def tufts(name, count, mat, length, blades):
            col = bpy.data.collections.new(name)
            root.children.link(col)
            for t in range(count):
                bm = bmesh.new()
                nb = blades[0] + int(rng.random() * (blades[1] - blades[0]))
                for b in range(nb):
                    ang = rng.random() * math.tau
                    lean = 0.15 + rng.random() * 0.5
                    ln = length[0] + rng.random() * (length[1] - length[0])
                    w = 0.006 + rng.random() * 0.004
                    d = Vector((math.cos(ang) * lean, math.sin(ang) * lean, 1.0)).normalized()
                    side = Vector((-math.sin(ang), math.cos(ang), 0)) * w
                    pts = [Vector((math.cos(ang) * 0.02, math.sin(ang) * 0.02, 0)) + d * ln * k / 3 + Vector((0, 0, -0.02 * (k / 3) ** 2 * lean)) for k in range(4)]
                    vs = [(bm.verts.new(p - side * (1 - k / 3.3)), bm.verts.new(p + side * (1 - k / 3.3))) for k, p in enumerate(pts)]
                    for a, b2 in zip(vs, vs[1:]):
                        bm.faces.new((a[0], a[1], b2[1], b2[0]))
                obj = common.mesh_object(f"{name}{t}", bm, mat, None)
                for c in obj.users_collection:
                    c.objects.unlink(obj)
                col.objects.link(obj)
            return col

        if "green" not in lib:
            lib["green"] = tufts("green", 6, M.grass_blades_green(), (0.1, 0.26), (10, 20))
        lib["lush"] = tufts("lush", 5, M.grass_blades_green(), (0.16, 0.34), (14, 26))
        col = bpy.data.collections.new("wildflowers")
        root.children.link(col)
        for t, (color, petals, size) in enumerate((("#c8281c", 4, 0.03), ("#f0ece0", 12, 0.022), ("#e8c83a", 5, 0.018), ("#8a6ab0", 5, 0.016))):
            bm = bmesh.new()
            h = 0.18 + t * 0.03
            stem = [bm.verts.new((-0.003, 0, 0)), bm.verts.new((0.003, 0, 0)), bm.verts.new((0.002, 0, h)), bm.verts.new((-0.002, 0, h))]
            bm.faces.new(stem)
            centre = Vector((0, 0, h))
            for p in range(petals):
                a = math.tau * p / petals
                tip = centre + Vector((math.cos(a) * size, math.sin(a) * size, 0.004))
                sd = Vector((-math.sin(a), math.cos(a), 0)) * size * 0.35
                vs = [bm.verts.new(centre), bm.verts.new(centre + (tip - centre) * 0.5 + sd), bm.verts.new(tip), bm.verts.new(centre + (tip - centre) * 0.5 - sd)]
                bm.faces.new(vs)
            obj = common.mesh_object(f"flower{t}", bm, M.plain("#4a6a2c", 0.7), None)
            obj.data.materials.append(M.plain(color, 0.55, 0.3))
            for f in obj.data.polygons[1:]:
                f.material_index = 1
            for c in obj.users_collection:
                c.objects.unlink(obj)
            col.objects.link(obj)
        lib["wildflowers"] = col
        if "stones" not in lib:
            import rocks

            sc = bpy.data.collections.new("field-stones")
            root.children.link(sc)
            for t in range(6):
                bm = bmesh.new()
                layer = bm.faces.layers.float.new("rand")
                rocks.stone_mesh(bm, 2000 + t * 7, (1.0, 0.8 + rng.random() * 0.3, 0.7), flat=0.42, blocky=0.7, n=16, sink=0.3)
                r = rng.random()
                for f in bm.faces:
                    f[layer] = r
                obj = common.mesh_object(f"fstone{t}", bm, M.rock("#b0a690", "field-stone", lichen=0.3), None, smooth=False)
                for c in obj.users_collection:
                    c.objects.unlink(obj)
                sc.objects.link(obj)
            lib["stones"] = sc
        return lib

    def _meadow(self, cells, density=80.0, flowers=4.0, seed=0, lush=True):
        """Grass as it grows where water is plenty: dense green tufts, some
        taller, with wildflowers scattered through."""
        from place import value_noise

        m = self.map
        lib = self._roman_lib()
        sub = 3
        field = value_noise(m.w * sub + 4, m.h * sub + 4, 5, seed + 7)
        # Thick where the ground is wettest, thin and short elsewhere, so
        # the ground shows through in patches.
        em = self.emitter(f"meadow-{seed}", cells, sub, lambda x0, y0: field[int(y0 * sub), int(x0 * sub)] > 0.38, z=0.012)
        scatter.scatter(em, lib["green"], density, (0.55, 1.15), seed=seed + 1, rotate_z_only=True, pick=True)
        em1 = self.emitter(f"meadow-thin-{seed}", cells, sub, lambda x0, y0: field[int(y0 * sub), int(x0 * sub)] <= 0.38, z=0.012)
        scatter.scatter(em1, lib["green"], density * 0.35, (0.4, 0.8), seed=seed + 4, rotate_z_only=True, pick=True)
        if lush:
            em2 = self.emitter(f"meadow-lush-{seed}", cells, sub, lambda x0, y0: field[int(y0 * sub), int(x0 * sub)] > 0.66, z=0.012)
            scatter.scatter(em2, lib["lush"], density * 0.3, (0.7, 1.1), seed=seed + 2, rotate_z_only=True, pick=True)
        if flowers > 0:
            em3 = self.emitter(f"meadow-flowers-{seed}", cells, sub, lambda x0, y0: field[int(y0 * sub), int(x0 * sub)] < 0.45, z=0.012)
            scatter.scatter(em3, lib["wildflowers"], flowers, (0.8, 1.3), seed=seed + 3, rotate_z_only=True, pick=True)

    def tile_crops(self):
        """Young grain in rows, spring green (the Lycus valley after rain);
        elsewhere the shared crops."""
        if not self.roman:
            return super().tile_crops()
        rng = self.rng
        blades = M.leaf("#7e9a44", "#a8b878")
        ears = M.plain("#c8c07a", 0.7)
        for x0, x1, y in self.map.runs("crops"):
            name = f"crops-{x0}-{y}"
            bm = bmesh.new()
            ebm = bmesh.new()
            for row in range(5):
                ry = y + 0.1 + row * 0.2
                x = x0 + 0.04
                while x < x1 - 0.04:
                    p0 = self.P(x, ry + (rng.random() - 0.5) * 0.05, 0.0)
                    for b in range(6):
                        a = rng.random() * math.tau
                        h = 0.3 + rng.random() * 0.2
                        tip = p0 + Vector((math.cos(a) * 0.07, math.sin(a) * 0.05, h))
                        sd = Vector((-math.sin(a), math.cos(a), 0)) * 0.009
                        v = [bm.verts.new(p0 - sd), bm.verts.new(p0 + sd), bm.verts.new(tip + sd * 0.2), bm.verts.new(tip - sd * 0.2)]
                        bm.faces.new(v)
                        if b == 0 and rng.random() < 0.3:
                            sph = bmesh.ops.create_icosphere(ebm, subdivisions=1, radius=1.0)
                            for vv in sph["verts"]:
                                vv.co = Vector((vv.co.x * 0.011, vv.co.y * 0.011, vv.co.z * 0.04)) + tip
                    x += 0.045 + rng.random() * 0.03
            objs = [common.mesh_object(f"{name}-blades", bm, blades, None)]
            objs.append(common.mesh_object(f"{name}-ears", ebm, ears, None))
            self.sprite(name, y + 0.85, objs, [(x, y) for x in range(x0, x1)])

    def tile_grass(self):
        """Green grass: in the Lycus valley a wet meadow, thick and long,
        with poppies, daisies and crowfoot; elsewhere the shared grass."""
        if not self.roman:
            return super().tile_grass()
        cells = self.map.tiles("grass")
        if cells:
            self._meadow(cells, density=85.0, flowers=5.0, seed=401)

    def tile_hill(self):
        """Hills: shaped in the terrain (terrain.RISE). In the Lycus valley
        and under Mount Cadmus, grassy slopes with field stones, rounded
        evergreen shrubs, and dark cypresses and oaks where nobody can walk
        behind them. Other places: the shared hills."""
        if not self.roman:
            return super().tile_hill()
        m = self.map
        cells = m.tiles("hill")
        if not cells:
            return
        rng = self.rng
        lib = self._roman_lib()
        self._meadow(cells, density=50.0, flowers=1.5, seed=501, lush=False)
        scatter.scatter(self.emitter("hill-stones", cells), lib["stones"], 1.6, (0.04, 0.14), seed=81, rotate_z_only=True, pick=True)
        self._terrace_walls(set(cells))
        trees = 0
        cypresses = 0
        for x, y in cells:
            if any(m.walkable(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-2, -1, 0)):
                continue
            r = rng.random()
            south = y >= m.h - 3
            if r < 0.14:
                name = f"hshrub-{x}-{y}"
                c = (x + 0.2 + rng.random() * 0.6, y + 0.2 + rng.random() * 0.6)
                self.sprite(name, c[1] + 0.3, self.shrub(name, c[0], c[1], 0.7 + rng.random() * 0.6, dark=rng.random() < 0.6), [(x, y)])
            elif r < 0.2 and south and trees < 5 and x % 3 == 1:
                # An olive, the hillsides' tree.
                name = f"olive-{x}-{y}"
                objs = self._olive(name, x, y)
                crown = [o for o in objs if o.name.endswith("-crown")]
                self.sprite(name, y + 0.62, [o for o in objs if o not in crown], [(x, y)])
                self.sprite(f"{name}-crown", y + 0.62, crown, [(x, y)], fade=True)
                trees += 1
            elif r < 0.225 and south and cypresses < 3:
                name = f"cypress-{x}-{y}"
                trunk, crown = self._cypress(name, x + 0.5, y + 0.6, 3.2 + rng.random() * 1.2)
                self.sprite(name, y + 0.7, trunk, [(x, y)])
                self.sprite(f"{name}-crown", y + 0.7, crown, [(x, y)], fade=True)
                cypresses += 1

    def _terrace_walls(self, cells):
        """Dry-stone terrace walls following the slope, a row or two into the
        hill, broken where they have fallen (the ground layer: nobody walks
        behind them)."""
        m = self.map
        rng = self.rng
        bm, layer = self._rbm()
        by_x = {}
        for x, y in cells:
            by_x.setdefault(x, []).append(y)
        for x in sorted(by_x):
            ys = sorted(by_x[x])
            # The hill's edge nearest walkable ground in this column.
            edge = None
            for y in ys:
                if m.walkable(x, y - 1) or m.walkable(x, y + 1):
                    edge = y
                    break
            if edge is None:
                continue
            into = 1.6 if m.walkable(x, edge - 1) else -0.6
            wy = edge + into + 0.25 * math.sin(x * 0.7)
            if (x, int(wy)) not in cells or rng.random() < 0.18:
                continue
            import rocks

            u = x
            while u < x + 1:
                ln = min(x + 1 - u, 0.16 + rng.random() * 0.14)
                cy = wy + 0.12 * math.sin(u * 1.3)
                for course, z in ((0, 0.0), (1, 0.16), (2, 0.3)):
                    if course == 2 and rng.random() < 0.5:
                        continue
                    s = (ln * 0.55, 0.1 + rng.random() * 0.04, 0.08 + rng.random() * 0.03)
                    rocks.stone_mesh(bm, int(rng.random() * 1e6), s, flat=0.6, blocky=0.75, n=14, at=self.P(u + ln / 2, cy + (rng.random() - 0.5) * 0.04, z + 0.02), sink=0.1)
                u += ln
        if bm.verts:
            for f in bm.faces:
                f[layer] = rng.random()
            self.to_ground(self._obj("terrace-walls", bm, M.rock("#9a9180", "terrace-stone", lichen=0.4)))
        else:
            bm.free()

    def _cypress(self, name, x, y, height):
        """A Mediterranean cypress: a tall dark-green flame on a short trunk."""
        base = self.P(x, y)
        trunk = self._branch(f"{name}-trunk", base + Vector((0, 0, -0.05)), base + Vector((0, 0, 0.5)), 0.08, 0.06, M.bark("#5a4a3a"), 8, bow=0.0)
        prof = []
        for k in range(18):
            t = k / 17
            r = 0.42 * math.sin(math.pi * min(1.0, t * 1.08)) ** 0.7 * (1 - 0.35 * t)
            prof.append((max(0.01, r), 0.3 + t * height))
        crown = common.lathe(f"{name}-crown", prof, 24, self._mat("leaf-dark"), None)
        crown.data.transform(Matrix.Translation(base))
        tex = bpy.data.textures.new(f"{name}-tex", "CLOUDS")
        tex.noise_scale = 0.12
        common.add_modifier(crown, "SUBSURF", levels=1, render_levels=1)
        common.add_modifier(crown, "DISPLACE", texture=tex, strength=0.14, mid_level=0.5)
        common.bake_modifiers(crown)
        scatter.scatter(crown, self._small_leaves(), 600.0, (0.8, 1.3), seed=int(self.rng.random() * 999), sink=0.04, pick=True, keep=True)
        return [trunk], [crown]

    def _puddle(self, name, cx, cy, rx, ry, mat, z=0.012):
        """Rain water standing in a hollow: an irregular outline."""
        rng = self.rng
        bm = bmesh.new()
        n = 18
        ph = rng.random() * math.tau
        ring = []
        for k in range(n):
            a = math.tau * k / n
            r = 1.0 + 0.22 * math.sin(a * 3 + ph) + 0.12 * math.sin(a * 5 + ph * 2) + (rng.random() - 0.5) * 0.12
            ring.append(bm.verts.new(self.P(cx + math.cos(a) * rx * r, cy + math.sin(a) * ry * r, z)))
        bm.faces.new(ring[::-1])
        return self.to_ground(common.mesh_object(name, bm, mat, None))

    # ── the valley after rain ───────────────────────────────────────────────
    def dress_oasis(self):
        """The valley after rain: puddles along the lane, mud trodden round
        the vats and the waystation's trough, reddish run-off in a channel
        from the dye works to the river, straw and dung in the waystation
        yard. Other places: the shared oasis dressing."""
        if not self.roman:
            return super().dress_oasis()
        m = self.map
        rng = self.rng
        water = self._mat("water")
        for x, y in m.tiles("road"):
            if rng.random() < 0.4:
                self._puddle(f"puddle-{x}-{y}", x + 0.2 + rng.random() * 0.6, y + 0.2 + rng.random() * 0.6, 0.14 + rng.random() * 0.2, 0.08 + rng.random() * 0.1, water)
        mud = M.mud()
        for kind in ("vat", "trough"):
            for x, y in m.tiles(kind):
                self.to_ground(self._ellipsoid(f"mud-{x}-{y}", self.P(x + 0.5, y + 1.05, 0.006), (0.6, 0.35, 0.004), mud, 20, 4))
        # The dye works' run-off: a stone-lined channel of reddish water.
        vessel = next((e for e in m.entities if e.get("sprite") == "vessels"), None)
        if vessel:
            vx = vessel["x"] + 0.85
            y_end = vessel["y"] - 0.2
            y_river = y_end
            while y_river > 0 and m.kind(int(vx), int(y_river)) != "water":
                y_river -= 0.5
            cb, cl = self._rbm()
            y = y_river + 0.3
            while y < y_end:
                ln = min(y_end - y, 0.4 + rng.random() * 0.2)
                for side in (-1, 1):
                    self._cbox(cb, cl, vx + side * 0.13 - 0.05, y, vx + side * 0.13 + 0.05, y + ln - 0.01, -0.04, 0.06, chamfer=0.015)
                y += ln
            self.to_ground(self._obj("runoff-stones", cb, self._mat("ashlar")))
            self.to_ground(common.box("runoff-water", (0.16, y_end - y_river - 0.3, 0.01), self.P(vx, (y_river + 0.3 + y_end) / 2, 0.01), R.dye("#5a2a22"), None))
        straw = M.plain("#c2a86a", 0.8, 0.2)
        bm = bmesh.new()
        for x, y in m.tiles("trough"):
            for _ in range(80):
                cx, cy = x - 1.5 + rng.random() * 4, y - 0.5 + rng.random() * 2
                if m.kind(int(cx), int(cy)) not in ("grass", "road"):
                    continue
                a = rng.random() * math.tau
                ln = 0.03 + rng.random() * 0.05
                dx, dy = math.cos(a) * ln / 2, math.sin(a) * ln / 2
                vs = [bm.verts.new(self.P(cx - dx, cy - dy - 0.003, 0.03)), bm.verts.new(self.P(cx + dx, cy + dy - 0.003, 0.03)), bm.verts.new(self.P(cx + dx, cy + dy + 0.003, 0.03)), bm.verts.new(self.P(cx - dx, cy - dy + 0.003, 0.03))]
                bm.faces.new(vs)
        self.ground_objects.append(common.mesh_object("yard-straw", bm, straw, self.col_ground, smooth=False))
