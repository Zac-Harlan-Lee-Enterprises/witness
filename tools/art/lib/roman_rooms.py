"""Rooms for the Roman kit (kit_roman.py): Ammia's dye workshop by day and
Philemon's peristyle house at lamp-lighting, both in cutaway like every
room (see kit_interior.py): floors of opus signinum, a mosaic, a painted
wall, a garden ringed by columns, and the rooms' own light."""
import math

import bmesh
import numpy as np
from mathutils import Matrix, Vector

import common
import materials as M
import roman_materials as R
import scatter
from roman_geom import B

ROOM_H = 2.7


class RomanRooms:
    def _workshop(self):
        """A dyer's workshop (a room with vats)."""
        return bool(self.map.tiles("vat"))

    def _lamplit(self):
        return self.light_plan.get("day") == "dusk"

    # ── the shell ───────────────────────────────────────────────────────────
    def room_shell(self):
        """A room in cutaway, as for any house (kit_interior.py), with a
        Roman room's walls: plain lime plaster in the workshop, a painted
        wall in Philemon's house, whose roof is open over its garden."""
        if not self.roman:
            return super().room_shell()
        if self._workshop():
            self.plaster = M.lime_plaster("#d6c9ad", "workshop-plaster", soot=0.5, grime=0.65)
        else:
            self.plaster = M.lime_plaster("#e0d4ba", "house-plaster", soot=0.3, grime=0.5)
        super().room_shell()
        if self._lamplit():
            self._open_to_the_sky()
            # A room lit by its lamps (the camera adapts, as to daylight rooms).
            self.exposure = 3.0

    def _open_to_the_sky(self):
        """Cut the invisible roof open over the peristyle garden: the
        evening sky lights the garden from above."""
        cols = self.map.tiles("column")
        if not cols:
            return
        xs = [c[0] for c in cols]
        ys = [c[1] for c in cols]
        x0, x1 = min(xs) + 0.5, max(xs) + 0.5
        y0, y1 = min(ys) + 0.5, max(ys) + 0.5
        roof = next((o for o in self.occluders if o.name == "roof"), None)
        if roof is None:
            return
        hole = common.box("sky-hole", (x1 - x0 - 0.3, y1 - y0 - 0.3, 2.0), B((x0 + x1) / 2, (y0 + y1) / 2, ROOM_H), None, None)
        mod = roof.modifiers.new("sky", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = hole
        common.bake_modifiers(roof)
        import bpy

        bpy.data.objects.remove(hole)

    def _back_wall_life(self, back, rng):
        """What hangs on and stands against the back wall: in the workshop a
        shelf of dye pots, bundles of dye plants drying on pegs and a lamp
        in a niche; in Philemon's house a painted wall and lamps burning in
        two niches."""
        if not self.roman:
            return super()._back_wall_life(back, rng)
        if self._workshop():
            self._workshop_wall(back, rng)
        else:
            self._painted_wall(back, rng)

    def _workshop_wall(self, back, rng):
        m = self.map
        y = back + 0.02
        clay = M.terracotta("#b27a52", 0.15)
        wood = M.wood("#5e4430", 5.0)
        # A shelf on brackets with small dye pots, some stained.
        sx0, sx1 = 8.4, 10.8
        self.to_ground(common.box("shelf", (sx1 - sx0, 0.22, 0.045), B((sx0 + sx1) / 2, y + 0.11, 1.6), wood, None))
        for bx in (sx0 + 0.15, sx1 - 0.15):
            self.to_ground(common.box(f"shelf-bracket{bx:.1f}", (0.05, 0.2, 0.16), B(bx, y + 0.1, 1.5), wood, None))
        stains = ["#6e1812", "#1c2c56", "#3c1636", "#6e1812", "#c49a3a", "#1c2c56"]
        for k in range(6):
            px = sx0 + 0.2 + k * (sx1 - sx0 - 0.4) / 5
            prof = [(0.04, 0.0), (0.07, 0.04), (0.075, 0.1), (0.05, 0.15), (0.055, 0.17)] if k % 2 else [(0.05, 0.0), (0.09, 0.05), (0.09, 0.09), (0.085, 0.1)]
            self.to_ground(self._lathe(f"shelf-pot{k}", prof, B(px, y + 0.11, 1.623), M.terracotta(M._toward("#b27a52", stains[k], 0.35), 0.1), 20))
        # Bundles of dye plants on pegs: weld (yellow-green) and woad leaves.
        cols = ["#8a8a3a", "#a09a4a", "#4a5a34", "#8a8a3a", "#56663a"]
        for k in range(5):
            hx = 2.2 + k * 0.4
            peg = self._branch(f"peg{k}", B(hx, y, 2.05), B(hx, y + 0.12, 2.03), 0.015, 0.012, self.wood, 5, bow=0.0)
            self.to_ground(peg)
            self._herb_bundle(f"dyeplant{k}", B(hx, y + 0.1, 2.0), cols[k], rng)
        # A lamp in a niche.
        nx = 15.2
        self.to_ground(common.box("niche", (0.5, 0.06, 0.4), B(nx, y - 0.01, 1.4), M.plain("#2a2018", 0.9, 0.1), None))
        self.to_ground(common.box("niche-sill", (0.58, 0.12, 0.04), B(nx, y + 0.04, 1.19), M.lime_plaster("#cbbd9f", "sill"), None))
        self._oil_lamp("niche-lamp", B(nx, y + 0.02, 1.21))
        # Pegs with finished skeins waiting to be sold.
        for k in range(4):
            hx = 5.6 + k * 0.28
            self.to_ground(self._branch(f"skein-peg{k}", B(hx, y, 1.85), B(hx, y + 0.14, 1.83), 0.014, 0.012, self.wood, 5, bow=0.0))
            self.to_ground(self.skein(f"wall-skein{k}", B(hx, y + 0.11, 1.84), ["#8a2418", "#9a2a1c", "#2c3e6a", "#8a2418"][k], 0.42, twist=0.2))
        _ = m, clay

    def _painted_wall(self, back, rng):
        m = self.map
        y = back + 0.012
        px = 64
        h = ROOM_H + 0.6
        arr = R.wall_design(m.w * px, int(h * px), px, np.random.default_rng(31))
        img = R.pattern_image(f"wall-{m.id}", arr)
        mat = R.painted_plaster(img, f"painted-{m.id}", soot=0.35)
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        v = [bm.verts.new(B(x, y, z)) for x, z in ((0.0, 0.0), (m.w, 0.0), (m.w, h), (0.0, h))]
        f = bm.faces.new(v)
        for loop, (u, vv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = (u, vv)
        self.to_ground(common.mesh_object("painted-wall", bm, mat, None))
        # A plinth of dark stone where the floor meets the wall.
        self.to_ground(common.box("wall-plinth", (m.w - 2, 0.05, 0.12), B(m.w / 2, y + 0.02, 0.06), R.marble("#3a3634", "dark-stone", veins="#5a5650"), None))
        for k, nx in enumerate((4.0, 22.0)):
            self.to_ground(common.box(f"niche{k}", (0.46, 0.06, 0.38), B(nx, y - 0.01, 1.45), M.plain("#241a14", 0.9, 0.1), None))
            self.to_ground(common.box(f"niche-sill{k}", (0.54, 0.12, 0.04), B(nx, y + 0.04, 1.25), self._mat("marble"), None))
            self._oil_lamp(f"niche-lamp{k}", B(nx, y + 0.02, 1.27))

    def _room_lights(self, back):
        """By day, daylight bounced in at the door (kit_interior.py); at
        lamp-lighting, the last blue of the evening at the door and the
        lamps' light bounced warm off the floor and walls."""
        if not (self.roman and self._lamplit()):
            return super()._room_lights(back)
        m = self.map
        doors = m.tiles("door")
        if doors:
            xs = [d[0] for d in doors]
            cx = (min(xs) + max(xs) + 1) / 2
            light = self.add_light("door-dusk", "AREA", B(cx, m.h - 1.15, 0.9), 14.0, "#8898c8")
            light.data.shape = "RECTANGLE"
            light.data.size = 1.8
            light.data.size_y = 1.6
            light.rotation_euler = (math.radians(75), 0, 0)
        fill = self.add_light("lamp-bounce", "AREA", B(m.w / 2, (back + m.h - 1) / 2, ROOM_H - 0.3), 70.0, "#ffb070")
        fill.data.shape = "RECTANGLE"
        fill.data.size = m.w - 2.5
        fill.data.size_y = max(1.0, m.h - 2 - back)
        card = self.add_light("front-bounce", "AREA", B(m.w / 2, m.h - 1.06, 1.2), 14.0, "#ffc890")
        card.data.shape = "RECTANGLE"
        card.data.size = m.w - 2.5
        card.data.size_y = 1.4
        card.rotation_euler = (math.radians(88), 0, 0)

    def _shafts(self, back):
        """Dust in the sunbeams (kit_interior.py); none after sunset."""
        if self.roman and self._lamplit():
            return None
        return super()._shafts(back)

    # ── floors ──────────────────────────────────────────────────────────────
    def tile_floor(self):
        """An interior floor: beaten earth laid with the room shell; in a
        Roman house, opus signinum (lime and crushed tile, trowelled smooth):
        red and stained with dye in the workshop, set with a lattice of white
        tesserae in Philemon's house."""
        if not self.roman:
            return super().tile_floor()
        m = self.map
        cells = m.tiles("floor")
        if not cells:
            return
        x0, x1 = 1.0, m.w - 1.0
        ys = [c[1] for c in m.tiles("floor") + m.tiles("door")]
        y0, y1 = min(ys), max(ys) + 1.0
        if self._workshop():
            mat = R.signinum("#94725f", "workshop-signinum", stains=0.45, stain="#5e1812")
        else:
            mat = R.signinum("#b07a62", "house-signinum", dots=0.3, stains=0.0)
        slab = common.box("signinum", (x1 - x0, y1 - y0, 0.012), B((x0 + x1) / 2, (y0 + y1) / 2, 0.006), mat, None)
        self.to_ground(slab)
        if self._workshop():
            self._wet_floor()

    def _wet_floor(self):
        """Where the dyeing is done: limestone flags laid round the vats, and
        a stone-lined drain from them to the door that carries spilt liquor
        and rinse water out to the street."""
        m = self.map
        rng = self.rng
        vats = m.tiles("vat")
        xs = [v[0] for v in vats]
        ys = [v[1] for v in vats]
        fx0, fx1, fy0, fy1 = min(xs) - 0.6, max(xs) + 1.6, min(ys) - 0.45, max(ys) + 1.55
        bm, layer = self._rbm()
        y = fy0
        while y < fy1 - 0.05:
            rh = min(fy1 - y, 0.5 + rng.random() * 0.25)
            x = fx0 - rng.random() * 0.4
            while x < fx1 - 0.05:
                ln = 0.6 + rng.random() * 0.5
                a, b = max(x, fx0), min(x + ln, fx1)
                if b - a > 0.12:
                    z0 = 0.02 + (rng.random() - 0.5) * 0.006
                    self._prism(bm, layer, [(a + 0.008, y + 0.008), (b - 0.008, y + 0.008), (b - 0.008, y + rh - 0.008), (a + 0.008, y + rh - 0.008)], lambda px, py, z0=z0: z0, 0.03, 0.012, rng.random(), dome=0.003)
                x += ln
            y += rh
        self.to_ground(self._obj("vat-flags", bm, R.paver("#a49a86", "workshop-flags", wet=0.45)))
        doors = m.tiles("door")
        if not doors:
            return
        dx = (min(d[0] for d in doors) + max(d[0] for d in doors) + 1) / 2
        db, dl = self._rbm()
        y = fy1 - 0.1
        end = m.h - 1.0
        while y < end:
            ln = min(end - y, 0.4 + rng.random() * 0.2)
            for side in (-1, 1):
                self._cbox(db, dl, dx + side * 0.11 - 0.05, y, dx + side * 0.11 + 0.05, y + ln - 0.01, -0.02, 0.035, chamfer=0.012)
            y += ln
        self.to_ground(self._obj("drain-kerbs", db, R.paver("#9e9482", "drain-stone", wet=0.6)))
        self.to_ground(common.box("drain-water", (0.13, end - fy1 + 0.1, 0.01), B(dx, (fy1 - 0.1 + end) / 2, 0.012), R.dye("#4a1e1a"), None))

    def tile_mosaic(self):
        """A mosaic floor of stone tesserae, one panel per block of mosaic
        tiles: a black and white frame, a braided guilloche (or a meander)
        border, a field of intersecting circles (or lozenges), a rosette in
        the middle; laid a little above the mortar floor around it."""
        rng = np.random.default_rng(7)
        for k, reg in enumerate(self.regions(kinds=("mosaic",))):
            xs = [p[0] for p in reg]
            ys = [p[1] for p in reg]
            x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
            per = 64
            w, h = (x1 - x0) * per, (y1 - y0) * per
            kind = "field" if (x1 - x0) >= 8 else "lozenge"
            img = R.pattern_image(f"mosaic-{self.map.id}-{k}", R.mosaic_design(w, h, rng, kind))
            mat = R.mosaic(img, w, h, f"mosaic-{self.map.id}-{k}")
            bm = bmesh.new()
            uv = bm.loops.layers.uv.new("UVMap")
            nx, ny = (x1 - x0) * 4, (y1 - y0) * 4
            grid = []
            for j in range(ny + 1):
                row = []
                for i in range(nx + 1):
                    x = x0 + 0.04 + (x1 - x0 - 0.08) * i / nx
                    y = y0 + 0.04 + (y1 - y0 - 0.08) * j / ny
                    # Laid on its own bed, clear of the mortar floor round it.
                    sag = 0.003 * math.sin(i * 0.7) * math.sin(j * 0.9)
                    row.append(bm.verts.new(self.P(x, y, 0.02 + sag)))
                grid.append(row)
            for j in range(ny):
                for i in range(nx):
                    f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])[::-1])
                    for loop, (ii, jj) in zip(f.loops, ((i, j + 1), (i + 1, j + 1), (i + 1, j), (i, j))):
                        loop[uv].uv = (ii / nx, 1.0 - jj / ny)
            self.to_ground(common.mesh_object(f"mosaic-{k}", bm, mat, None))

    # ── the peristyle garden ────────────────────────────────────────────────
    def tile_garden(self):
        """A garden bed in the peristyle: a stone kerb, dark soil, a low
        clipped hedge along its edges and, inside, shrubs in flower
        (oleander, roses), lilies and a young pomegranate. One sprite per
        row, so people walking round it sort against it."""
        m = self.map
        cells = set(m.tiles("garden"))
        if not cells:
            return
        rng = self.rng
        xs = [c[0] for c in cells]
        ys = [c[1] for c in cells]
        x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
        kb, kl = self._rbm()
        t = 0.12
        for a, b, c, d in ((x0, y0, x1, y0 + t), (x0, y1 - t, x1, y1), (x0, y0, x0 + t, y1), (x1 - t, y0, x1, y1)):
            self._cbox(kb, kl, a, b, c, d, 0.0, 0.14, chamfer=0.02)
        self.to_ground(self._obj("garden-kerb", kb, self._mat("marble-grey")))
        soil = common.box("garden-soil", (x1 - x0 - 2 * t, y1 - y0 - 2 * t, 0.02), self.P((x0 + x1) / 2, (y0 + y1) / 2, 0.1), M.plain("#3e3024", 0.95, 0.1), None)
        self.to_ground(soil)
        rows = {}
        # The hedge: small box plants in a line inside the kerb.
        hedge_pts = []
        step = 0.28
        u = x0 + t + 0.14
        while u < x1 - t - 0.1:
            hedge_pts += [(u, y0 + t + 0.14), (u, y1 - t - 0.14)]
            u += step
        v = y0 + t + 0.42
        while v < y1 - t - 0.3:
            hedge_pts += [(x0 + t + 0.14, v), (x1 - t - 0.14, v)]
            v += step
        fountain = set(m.tiles("fountain"))
        for hx, hy in hedge_pts:
            rows.setdefault(int(hy), []).append(("hedge", hx, hy))
        # Shrubs and flowers inside, clear of the fountain.
        plants = ["oleander", "rose", "lily", "rose", "oleander", "lily", "pomegranate", "lily"]
        k = 0
        for gy in range(y0, y1):
            for gx in range(x0, x1, 2):
                if (gx, gy) in fountain or (gx + 1, gy) in fountain or (gx - 1, gy) in fountain:
                    continue
                px = gx + 0.5 + (rng.random() - 0.5) * 0.4
                py = gy + 0.5 + (rng.random() - 0.5) * 0.3
                if not (x0 + 0.5 < px < x1 - 0.5 and y0 + 0.5 < py < y1 - 0.5):
                    continue
                rows.setdefault(gy, []).append((plants[k % len(plants)], px, py))
                k += 1
        for gy in sorted(rows):
            objs = []
            for i, (kind, px, py) in enumerate(rows[gy]):
                objs += self._garden_plant(f"garden-{gy}-{i}", kind, px, py)
            if objs:
                self.sprite(f"garden-{gy}", gy + 0.95, objs, [(x, gy) for x in range(x0, x1) if (x, gy) in cells])

    def _garden_plant(self, name, kind, x, y):
        rng = self.rng
        base = self.P(x, y, 0.1)
        if kind == "hedge":
            bm = bmesh.new()
            sph = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.17)
            for v in sph["verts"]:
                v.co = Vector((v.co.x, v.co.y, v.co.z * 0.9)) + base + Vector((0, 0, 0.16))
            crown = common.mesh_object(f"{name}-box", bm, self._mat("leaf-dark"), None)
            scatter.scatter(crown, self._small_leaves(), 1500.0, (0.5, 0.8), seed=int(rng.random() * 999), sink=0.03, pick=True, keep=True)
            return [crown]
        if kind == "lily":
            objs = []
            stem = bmesh.new()
            heads = bmesh.new()
            for k in range(5):
                a = rng.random() * math.tau
                top = base + Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, 0.5 + rng.random() * 0.2))
                self._tube(stem, [base + Vector((math.cos(a) * 0.02, math.sin(a) * 0.02, 0.0)), top], 0.007, seg=5)
                for p in range(6):
                    pa = math.tau * p / 6
                    tip = top + Vector((math.cos(pa) * 0.06, math.sin(pa) * 0.06, 0.03))
                    side = Vector((-math.sin(pa), math.cos(pa), 0)) * 0.015
                    vs = [heads.verts.new(top), heads.verts.new(top + (tip - top) * 0.5 + side), heads.verts.new(tip), heads.verts.new(top + (tip - top) * 0.5 - side)]
                    heads.faces.new(vs)
            leaves = bmesh.new()
            for k in range(10):
                a = rng.random() * math.tau
                p1 = base + Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.25))
                s = Vector((-math.sin(a), math.cos(a), 0)) * 0.018
                vs = [leaves.verts.new(base - s), leaves.verts.new(base + s), leaves.verts.new(p1 + s * 0.2), leaves.verts.new(p1 - s * 0.2)]
                leaves.faces.new(vs)
            objs.append(common.mesh_object(f"{name}-stems", stem, M.leaf("#4a6a34", "#8aa06a"), None))
            objs.append(common.mesh_object(f"{name}-leaves", leaves, M.leaf("#3e5a2c", "#8a9a6a"), None))
            objs.append(common.mesh_object(f"{name}-flowers", heads, M.plain("#f2eee4", 0.6, 0.3), None))
            return objs
        size = 0.75 if kind == "rose" else (1.1 if kind == "oleander" else 1.0)
        objs = self.shrub(name, x, y, size, dark=kind != "oleander")
        # Lift onto the bed.
        for o in objs:
            o.data.transform(Matrix.Translation(Vector((0, 0, 0.1))))
        if kind in ("rose", "oleander"):
            color = "#c83a4a" if kind == "rose" else "#e8a0b0"
            fl = bmesh.new()
            for k in range(26 if kind == "oleander" else 16):
                a = rng.random() * math.tau
                r = rng.random() ** 0.5 * 0.3 * size
                c = base + Vector((math.cos(a) * r, math.sin(a) * r * 0.8, (0.35 + rng.random() * 0.4) * size))
                s = bmesh.ops.create_icosphere(fl, subdivisions=1, radius=0.028)
                bmesh.ops.translate(fl, vec=c, verts=s["verts"])
            objs.append(common.mesh_object(f"{name}-flowers", fl, M.plain(color, 0.6, 0.3), None))
        if kind == "pomegranate":
            fr = bmesh.new()
            for k in range(6):
                a = rng.random() * math.tau
                c = base + Vector((math.cos(a) * 0.25, math.sin(a) * 0.2, 0.55 + rng.random() * 0.3))
                s = bmesh.ops.create_uvsphere(fr, u_segments=10, v_segments=6, radius=0.04)
                bmesh.ops.translate(fr, vec=c, verts=s["verts"])
            objs.append(common.mesh_object(f"{name}-fruit", fr, M.plain("#a8341e", 0.45, 0.4), None))
        return objs

    def tile_rug(self):
        """Woven rugs on the floor, one per block of rug tiles (in a Roman
        house, a rug of red, madder and indigo bands with a border)."""
        if not self.roman:
            return super().tile_rug()
        for k, reg in enumerate(self.regions(kinds=("rug",))):
            xs = [p[0] for p in reg]
            ys = [p[1] for p in reg]
            x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
            cols = [["#7a2a22", "#c9a45a", "#2c3e6a", "#c9a45a", "#7a2a22"], ["#3a4a6a", "#d8c89a", "#8a2418", "#d8c89a"]][k % 2]
            mat = M.textile(cols, f"rug-{k}", band=0.08, border="#2a1e1a")
            bm = bmesh.new()
            uv = bm.loops.layers.uv.new("UVMap")
            nx, ny = (x1 - x0) * 8, (y1 - y0) * 8
            grid = []
            for j in range(ny + 1):
                row = []
                for i in range(nx + 1):
                    x = x0 + 0.08 + (x1 - x0 - 0.16) * i / nx
                    y = y0 + 0.1 + (y1 - y0 - 0.2) * j / ny
                    row.append(bm.verts.new(self.P(x, y, 0.02 + 0.005 * math.sin(i * 0.9) * math.sin(j * 0.7))))
                grid.append(row)
            for j in range(ny):
                for i in range(nx):
                    f = bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
                    for loop, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                        loop[uv].uv = (ii / nx, jj / ny)
            rug = common.mesh_object(f"rug-{k}", bm, mat, None)
            common.add_modifier(rug, "SOLIDIFY", thickness=0.01)
            self.to_ground(rug)

    def _decal(self, name, cx, cy, w, h, angle, mat, z=0.012):
        """A soft stain lying on the ground or floor: an irregular ellipse
        (UVs for soft_decal: the centre at 0.5, its rim where the stain has
        faded out). Not a rectangle: the denoiser's albedo guide sees a
        decal's whole outline, so it must be a natural one."""
        rng = self.rng
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        ca, sa = math.cos(angle), math.sin(angle)
        n = 36
        ph = rng.random() * math.tau
        centre = bm.verts.new(self.P(cx, cy, z))
        ring = []
        uvs = []
        for k in range(n):
            a = math.tau * k / n
            r = 1.0 + 0.16 * math.sin(a * 3 + ph) + 0.08 * math.sin(a * 5 + ph * 1.7)
            u, v = math.cos(a) * w / 2 * r, math.sin(a) * h / 2 * r
            ring.append(bm.verts.new(self.P(cx + u * ca - v * sa, cy + u * sa + v * ca, z)))
            # The rim sits where soft_decal has faded to nothing, whatever its ragged edge.
            uvs.append((0.5 + math.cos(a) * 0.5, 0.5 + math.sin(a) * 0.5))
        for k in range(n):
            kk = (k + 1) % n
            f = bm.faces.new((centre, ring[kk], ring[k]))
            for loop, t in zip(f.loops, ((0.5, 0.5), uvs[kk], uvs[k])):
                loop[uv].uv = t
        return self.to_ground(self._flat_decal(common.mesh_object(name, bm, mat, None)))

    @staticmethod
    def _flat_decal(obj):
        """A decal is seen by the camera only: rays bouncing, shadow rays and
        the floor's own occlusion (grime) pass it by, so its see-through
        margin leaves no trace. Tagged "decal", so sprites render without it."""
        for flag in ("visible_diffuse", "visible_glossy", "visible_transmission", "visible_shadow", "visible_volume_scatter"):
            setattr(obj, flag, False)
        obj["decal"] = True
        return obj

    # ── dressing ────────────────────────────────────────────────────────────
    def dress_home(self):
        """In the workshop, splashes of dye and wet patches on the floor
        round the vats, chips of madder root; in Philemon's house, a few
        fallen petals by the garden and sandals left at the door."""
        if not self.roman:
            return super().dress_home()
        m = self.map
        rng = self.rng
        if self._workshop():
            for x, y in m.tiles("vat"):
                for k in range(2):
                    a = rng.random() * math.tau
                    col = ["#5a1410", "#3a1a2a"][k % 2]
                    self._decal(f"splash-{x}-{y}-{k}", x + 0.5 + math.cos(a) * 0.55, y + 0.55 + math.sin(a) * 0.45, 0.35 + rng.random() * 0.3, 0.25 + rng.random() * 0.2, rng.random() * math.pi, R.soft_decal(col, 0.75), 0.014)
                self._decal(f"wet-{x}-{y}", x + 0.5, y + 1.0, 1.1, 0.6, 0.0, R.soft_decal("#4e3428", 0.55, "wet-floor"), 0.013)
            root = M.plain("#8a3a24", 0.8)
            for k in range(30):
                x = 1.5 + rng.random() * 3
                y = 3 + rng.random() * 2
                self.to_ground(self._ellipsoid(f"chip{k}", self.P(x, y, 0.016), (0.025, 0.01, 0.008), root, 6, 4))
        else:
            leaf = M.leaf("#4a6a34", "#8aa06a")
            petal = M.plain("#c83a4a", 0.6, 0.3)
            garden = m.tiles("garden")
            for k in range(40):
                if not garden:
                    break
                gx, gy = garden[int(rng.random() * len(garden))]
                x = gx + rng.random() * 1.6 - 0.3
                y = gy + rng.random() * 1.6 - 0.3
                if m.kind(int(x), int(y)) not in ("floor", "mosaic"):
                    continue
                mat = petal if k % 3 == 0 else leaf
                self.to_ground(self._ellipsoid(f"fallen{k}", self.P(x, y, 0.018), (0.02, 0.012, 0.002), mat, 6, 3))
            doors = m.tiles("door")
            if doors:
                dx = min(d[0] for d in doors)
                leather = M.leather("#5a3a22")
                for k in range(3):
                    c = self.P(dx - 0.8 + k * 0.28, m.h - 1.3 + (k % 2) * 0.1, 0.02)
                    self.to_ground(self._ellipsoid(f"sandal{k}a", c, (0.05, 0.11, 0.01), leather, 12, 4))
                    self.to_ground(self._ellipsoid(f"sandal{k}b", c + Vector((0.1, 0.02, 0)), (0.05, 0.11, 0.01), leather, 12, 4))
