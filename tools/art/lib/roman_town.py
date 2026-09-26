"""A street in a Roman town (Colossae) for the Roman kit (kit_roman.py): the
frontage of houses and shops, the stoa, the town wall and its gate, big
paving slabs, a fuller's yard wall, and what a working street leaves on the
ground."""
import math

import bmesh
from mathutils import Vector

import common
import materials as M
import roman_materials as R
from roman_geom import B

# Houses along a frontage, west to east: stucco, dado, height, and the
# kind of front. A house with a double gate is the grandest (Philemon's).
HOUSE_LOOKS = [
    {"mat": "stucco-ochre", "height": 3.05},
    {"mat": "stucco-white", "height": 4.55},
    {"mat": "stucco-rose", "height": 3.7},
    {"mat": "stucco-grey", "height": 3.3},
]
PITCH = math.tan(math.radians(23.0))


class RomanTown:
    def QT(self, x, y, z):
        """A point z above the terrain at (x, y) that shows over its own
        tile, as the terrain does (a raised floor, a wall's top)."""
        h = self.H(x, y)
        return Vector((x, -(y + h + z), h + z))

    # ── the frontage ────────────────────────────────────────────────────────
    def _buildings(self):
        """A town's buildings: the frontage of houses and shops under tiled
        roofs along the top of the street, and the town wall down its sides."""
        if not self.roman:
            return super()._buildings()
        m = self.map
        roof = m.tiles("tile-roof")
        if not roof:
            return super()._buildings()
        front_row = max(y for _x, y in roof) + 1
        cols = m.tiles("column")
        stoa = None
        near = [c for c in cols if front_row < c[1] <= front_row + 3]
        if near:
            stoa = (min(c[0] for c in near) - 1, max(c[0] for c in near) + 1)
        openings = sorted(x for x in range(m.w) if m.kind(x, front_row) in ("door", "gate"))
        groups = []
        for x in openings:
            if groups and x - groups[-1][-1] == 1 and m.kind(x, front_row) == "gate":
                groups[-1].append(x)
            else:
                groups.append([x])
        cuts = []
        for a, b in zip(groups, groups[1:]):
            c = int(round((a[-1] + b[0] + 1) / 2))
            if stoa and stoa[0] <= c <= stoa[1]:
                continue
            cuts.append(c)
        edges = [0] + cuts + [m.w]
        for i, (x0, x1) in enumerate(zip(edges, edges[1:])):
            look = HOUSE_LOOKS[i % len(HOUSE_LOOKS)]
            in_stoa = bool(stoa and x0 <= stoa[0] + 1 and x1 >= stoa[1] - 1)
            self._town_house(f"house-{x0}-{front_row}", x0, x1, front_row, look, in_stoa)
        self._town_walls(front_row)

    def _town_house(self, name, x0, x1, row, look, behind_stoa):
        m = self.map
        rng = self.rng
        y_face = row + 1.0
        h = look["height"]
        mat = self._mat(look["mat"])
        doors = [x for x in range(x0, x1) if m.kind(x, row) == "door"]
        gates = [x for x in range(x0, x1) if m.kind(x, row) == "gate"]
        objs = []
        openings = []
        for dx in doors:
            if behind_stoa:
                openings.append((dx + 0.06, dx + 0.94, 0.0, 2.2))
            else:
                openings.append((dx + 0.14, dx + 0.86, 0.0, 1.95))
        if gates:
            g0, g1 = min(gates), max(gates) + 1
            openings.append((g0 + 0.12, g1 - 0.12, 0.0, 2.35))
        # Windows: small and high on the ground floor, larger above.
        busy = [(o[0] - 0.7, o[1] + 0.7) for o in openings]
        windows = []
        wx = x0 + 1.2
        while wx < x1 - 1.2:
            if not any(a < wx + 0.5 and b > wx for a, b in busy):
                if h > 4.0:
                    windows.append((wx, wx + 0.55, 3.0, 3.65, "shutters"))
                elif not behind_stoa:
                    windows.append((wx, wx + 0.45, 1.75, 2.25, "grille"))
            wx += 2.3 + rng.random() * 0.8
        if h > 4.0:
            for dx in doors:
                windows.append((dx + 0.2, dx + 0.75, 3.0, 3.65, "shutters"))
            # The ends of the upper floor's joists, in a row along the front.
            jb, jl = self._rbm()
            jx = x0 + 0.3
            while jx < x1 - 0.2:
                self._cbox(jb, jl, jx, y_face - 0.05, jx + 0.13, y_face + 0.12, 2.68, 2.82, chamfer=0.01, point=B)
                jx += 0.55
            objs.append(self._obj(f"{name}-joists", jb, self._mat("timber")))
        openings += [(a, b, c, d) for a, b, c, d, _k in windows]
        objs += self._front(name, x0, x1, y_face, h, mat, openings)
        for a, b, c, d, kind in windows:
            objs += self._window(f"{name}-win{a:.1f}", a, b, y_face, c, d, kind)
        for dx in doors:
            if behind_stoa:
                objs += self._shop_front(f"{name}-shop{dx}", dx, y_face)
            else:
                objs += self._door(f"{name}-door{dx}", dx + 0.14, dx + 0.86, y_face, 1.95, open_=0.75)
                objs += self._dyer_sign(f"{name}-sign{dx}", dx, y_face)
                objs += self._pent_roof(f"{name}-pent{dx}", dx - 0.35, dx + 1.35, y_face)
                bench, bl = self._rbm()
                self._cbox(bench, bl, dx + 1.0, y_face, dx + 2.3, y_face + 0.32, 0.0, 0.42, chamfer=0.03, point=B)
                objs.append(self._obj(f"{name}-bench{dx}", bench, self._mat("ashlar")))
        if gates:
            objs += self._grand_gate(f"{name}-gate", min(gates), max(gates) + 1, y_face)
            # Dressed stone below, stucco above: the grandest house.
            ab, al = self._rbm()
            z = 0.0
            course = 0
            while z < 1.05:
                ch = 0.34 + rng.random() * 0.06
                x = x0 - (0.3 if course % 2 else 0.0)
                while x < x1:
                    ln = 0.7 + rng.random() * 0.5
                    a, b = max(x, x0), min(x + ln, x1)
                    if b - a > 0.08 and not any(o[0] < b and o[1] > a and o[2] < z + ch for o in openings):
                        self._cbox(ab, al, a + 0.008, y_face - 0.02, b - 0.008, y_face + 0.05, z + 0.008, min(1.1, z + ch) - 0.008, chamfer=0.02, point=B)
                    x += ln
                z += ch
                course += 1
            objs.append(self._obj(f"{name}-ashlar", ab, self._mat("ashlar")))
        # The roof: seen only where it rises above the front's cornice.
        y_eave = y_face + 0.32
        z_eave = h + 0.04
        y_ridge = (row + 1) / 2
        z_ridge = z_eave + (y_eave - y_ridge) * PITCH
        if (y_eave - z_eave) > -0.6 and not behind_stoa:
            objs += self._tile_roof(f"{name}-roof", x0 - 0.02, x1 + 0.02, y_eave, z_eave, y_ridge, z_ridge)
        self.sprite(name, y_face, objs, [(x, y) for x in range(x0, x1) for y in range(0, row + 1)])

    def _shop_front(self, name, dx, y_face):
        """A shop opening under the stoa: wooden shutters folded back to
        each side, a counter across the dark room, goods on it."""
        rng = self.rng
        objs = []
        wood = self._mat("door")
        for side in (-1, 1):
            for k in range(3):
                px = dx + 0.5 + side * (0.52 + k * 0.035)
                objs.append(common.box(f"{name}-shutter{side}{k}", (0.03, 0.14, 2.1), B(px, y_face - 0.12 - k * 0.02, 1.07), wood, None))
        cb, cl = self._rbm()
        self._cbox(cb, cl, dx + 0.1, y_face - 0.42, dx + 0.9, y_face - 0.18, 0.0, 0.85, chamfer=0.015, point=B)
        objs.append(self._obj(f"{name}-counter", cb, R.stucco("#cfc0a0", "shop-counter", dado="#6a2a22", dado_h=0.8)))
        goods = [R.wool("#8a2418"), R.wool("#2c3e6a"), M.terracotta("#a8452c", 0.05), R.wool("#e6dcc4")]
        for k in range(3):
            g = goods[int(rng.random() * len(goods))]
            objs.append(common.box(f"{name}-goods{k}", (0.18, 0.18, 0.1), B(dx + 0.25 + k * 0.25, y_face - 0.3, 0.9), g, None, bevel=0.03))
        return objs

    def _pent_roof(self, name, x0, x1, y_face):
        """A little tiled pent roof over a door, on two timber brackets."""
        objs = []
        wood = self._mat("timber")
        for bx in (x0 + 0.08, x1 - 0.08):
            objs.append(self._branch(f"{name}-bracket{bx:.1f}", B(bx, y_face - 0.02, 2.1), B(bx, y_face + 0.55, 2.35), 0.03, 0.028, wood, 6, bow=0.0))
        objs += self._tile_roof(name, x0, x1, y_face + 0.62, 2.36, y_face + 0.02, 2.62, ridge=False)
        return objs

    def _dyer_sign(self, name, dx, y_face):
        """A dyer's sign: a pole out from the wall over the door with skeins
        of her colours hanging from it."""
        objs = []
        wood = M.wood("#6e5436", 4.0)
        a = B(dx - 0.2, y_face - 0.1, 2.25)
        b = B(dx - 0.2, y_face + 0.55, 2.25)
        objs.append(self._branch(f"{name}-pole", a, b, 0.025, 0.02, wood, 8, bow=0.0))
        for k, col in enumerate(("#8a2418", "#2c3e6a", "#4a1e46")):
            objs.append(self.skein(f"{name}-skein{k}", B(dx - 0.2, y_face + 0.18 + k * 0.14, 2.23), col, 0.4, twist=0.3))
        return objs

    def _grand_gate(self, name, g0, g1, y_face):
        """The gate of a large house: dressed stone jambs and pilasters, a
        lintel under a moulded cornice and a low pediment, and a pair of
        heavy doors studded with iron, shut."""
        objs = []
        stone = self._mat("ashlar")
        bm, layer = self._rbm()
        x0, x1 = g0 + 0.12, g1 - 0.12
        for px in (x0 - 0.34, x1 + 0.04):
            self._cbox(bm, layer, px, y_face - 0.05, px + 0.3, y_face + 0.1, 0.0, 2.55, chamfer=0.02, point=B)
            self._cbox(bm, layer, px - 0.04, y_face - 0.05, px + 0.34, y_face + 0.14, 0.0, 0.3, chamfer=0.02, point=B)
            self._cbox(bm, layer, px - 0.03, y_face - 0.05, px + 0.33, y_face + 0.13, 2.45, 2.6, chamfer=0.02, point=B)
        self._cbox(bm, layer, x0 - 0.4, y_face - 0.05, x1 + 0.4, y_face + 0.12, 2.6, 2.85, chamfer=0.015, point=B)
        self._cbox(bm, layer, x0 - 0.48, y_face - 0.05, x1 + 0.48, y_face + 0.2, 2.85, 2.95, chamfer=0.02, point=B)
        objs.append(self._obj(f"{name}-frame", bm, stone))
        # The pediment: a low triangle over the cornice.
        pb = bmesh.new()
        cx = (x0 + x1) / 2
        half = (x1 - x0) / 2 + 0.45
        pts = [(cx - half, 2.95), (cx + half, 2.95), (cx, 3.4)]
        f = [pb.verts.new(B(x, y_face + 0.16, z)) for x, z in pts]
        r = [pb.verts.new(B(x, y_face - 0.05, z)) for x, z in pts]
        pb.faces.new(f)
        pb.faces.new(r[::-1])
        for i in range(3):
            j = (i + 1) % 3
            pb.faces.new((f[j], f[i], r[i], r[j]))
        objs.append(self._obj(f"{name}-pediment", pb, stone))
        objs += self._door(f"{name}-doors", x0, x1, y_face, 2.35, leaves=2, open_=0.0)
        return objs

    def _town_walls(self, front_row):
        """The town wall down the sides of the street: its top, coped with
        flat stones, seen from above (its inner face is edge-on)."""
        m = self.map
        rng = self.rng
        bm, layer = self._rbm()
        for x in (0, m.w - 1):
            y = front_row + 1
            while y < m.h:
                if m.kind(x, y) != "wall":
                    y += 1
                    continue
                y0 = y
                while y < m.h and m.kind(x, y) == "wall":
                    y += 1
                v = float(y0)
                while v < y - 0.05:
                    ln = min(y - v, 0.45 + rng.random() * 0.35)
                    self._cbox(bm, layer, x + 0.04, v + 0.01, x + 0.96, v + ln - 0.01, 0.0, 1.25 + rng.random() * 0.03, chamfer=0.04, point=self.QT)
                    v += ln
        if bm.verts:
            self.to_ground(self._obj("town-wall", bm, self._mat("rubble")))
        else:
            bm.free()

    def tile_gate(self):
        """Gates: a town gate in the wall (piers of dressed stone, an arch,
        timber leaves standing open); a gate in a house front is built with
        its house. Other places: the shared gates."""
        if not self.roman:
            return super().tile_gate()
        m = self.map
        roof = m.tiles("tile-roof")
        front_row = (max(y for _x, y in roof) + 1) if roof else -1
        side = [(x, y) for x, y in m.tiles("gate") if y != front_row]
        if not side:
            return
        by_x = {}
        for x, y in side:
            by_x.setdefault(x, []).append(y)
        for x, ys in by_x.items():
            name = f"gate-{x}-{min(ys)}"
            top, bottom = min(ys), max(ys) + 1
            self.sprite(name, bottom + 0.95, self._town_gate(name, x, top, bottom), [(x, y) for y in ys])

    def _town_gate(self, name, x, top, bottom):
        objs = []
        stone = self._mat("ashlar")
        bm, layer = self._rbm()
        rng = self.rng
        for y0, y1 in ((top - 0.95, top - 0.05), (bottom + 0.05, bottom + 0.95)):
            z = 0.0
            while z < 2.6:
                ch = 0.3 + rng.random() * 0.05
                self._cbox(bm, layer, x + 0.0, y0, x + 1.0, y1, z + 0.005, min(2.7, z + ch) - 0.005, chamfer=0.02, point=B)
                z += ch
        # The arch over the passage, seen from above: voussoirs in a curve.
        n = 9
        for k in range(n):
            a0 = math.pi * k / n
            a1 = math.pi * (k + 1) / n
            ya = top + (bottom - top) / 2 - math.cos(a0) * (bottom - top + 0.1) / 2
            yb = top + (bottom - top) / 2 - math.cos(a1) * (bottom - top + 0.1) / 2
            za = 2.15 + math.sin(a0) * 0.45
            self._cbox(bm, layer, x + 0.02, min(ya, yb), x + 0.98, max(ya, yb), za, za + 0.38, chamfer=0.02, point=B)
        objs.append(self._obj(f"{name}-stone", bm, stone))
        wood = self._mat("door")
        for k, (y0, ang) in enumerate(((top + 0.05, 1.2), (bottom - 0.05, -1.2))):
            leaf = common.box(f"{name}-leaf{k}", (0.07, (bottom - top) / 2 - 0.05, 2.1), B(0, 0, 0), wood, None, bevel=0.01)
            leaf.location = B(x + 0.9 + 0.3 * abs(math.sin(ang)), y0 + (0.45 if k == 0 else -0.45), 1.05)
            leaf.rotation_euler = (0, 0, ang * 0.5)
            objs.append(leaf)
        return objs

    # ── paving ──────────────────────────────────────────────────────────────
    def city_paving(self, kinds=("paving", "gate"), edge_ok=("paving", "gate", "well", "stall", "basket", "jars", "sacks"), name="paving"):
        """A Roman street's paving: big slabs of hard grey limestone in long
        courses, fitted close, worn and polished, some cracked; the stoa's
        columns stand on a stylobate of two steps."""
        if not self.roman:
            return super().city_paving(kinds, edge_ok, name)
        m = self.map
        rng = self.rng
        bm, layer = self._rbm()
        stylobate = self._stylobate_rows()
        # Stalls, jars, tables, the fountain and the potted bays (bushes in
        # the paved street, as tile_bush decides) stand on the paving; a fig
        # grows from a pit of bare earth.
        under = ("stall", "jars", "table", "fountain")

        def potted(tx, ty):
            return sum(m.kind(tx + dx, ty + dy) == "paving" for dx in (-1, 0, 1) for dy in (-1, 0, 1)) >= 4

        def paved(px, py):
            if any(a <= px <= b and s0 <= py <= s1 for a, b, s0, s1 in stylobate):
                return False
            tx, ty = int(math.floor(px)), int(math.floor(py))
            k = m.kind(tx, ty)
            return k in kinds or k in under or (k == "bush" and potted(tx, ty))

        cells = [c for k in kinds for c in m.tiles(k)]
        first_x = min(c[0] for c in cells) if cells else 0
        first_y = min(c[1] for c in cells) if cells else 0

        n = 6

        def row_ok(y, a, b):
            return all(paved(a + (b - a) * (k + 0.5) / n, y) for k in range(n))

        def col_ok(x, c, d):
            return all(paved(x, c + (d - c) * (k + 0.5) / n) for k in range(n))

        def trim(a, b, c, d, across_first):
            """Shrink a slab to the paving: a top or bottom edge that runs
            into anything else moves in to the tile boundary (walls and
            frontages lie on them); a side edge moves in until it clears
            whatever it ran into (the stylobate's ends are not on a tile
            boundary)."""

            def rows(a, b, c, d):
                if not row_ok(c + 0.01, a, b):
                    c = math.floor(c) + 1.0
                if not row_ok(d - 0.01, a, b):
                    d = math.ceil(d) - 1.0
                return a, b, c, d

            def sides(a, b, c, d):
                while a < b and not col_ok(a + 0.01, c, d):
                    a += 0.02
                while b > a and not col_ok(b - 0.01, c, d):
                    b -= 0.02
                return a, b, c, d

            for _ in range(4):
                for step in (sides, rows) if across_first else (rows, sides):
                    a, b, c, d = step(a, b, c, d)
                if b - a < 0.1 or d - c < 0.1:
                    return None
            return a, b, c, d

        def fit(a, b, c, d):
            """The biggest slab left after trimming its top and bottom first
            (a slab reaching into a wall row) or its sides first (one reaching
            into a wall's column or the stylobate)."""
            boxes = [box for box in (trim(a, b, c, d, False), trim(a, b, c, d, True)) if box]
            return max(boxes, key=lambda q: (q[1] - q[0]) * (q[3] - q[2])) if boxes else None

        def ends(y0, y1):
            """Where a course's paving begins and ends: a slab reaching into
            the wall at either end would be dropped whole (its top and bottom
            edges fail first), leaving bare earth, so the end slabs are cut
            to the paving instead."""
            starts, stops = [], []
            for yy in (y0 + 0.05, (y0 + y1) / 2, y1 - 0.05):
                xs = [tx for tx in range(m.w) if paved(tx + 0.5, yy)]
                if xs:
                    starts.append(xs[0])
                    stops.append(xs[-1] + 1)
            return (max(starts), min(stops)) if starts else (first_x, m.w)

        # The courses are laid from the street's first row of paving; a gate
        # set in the wall above it gets a course of its own, one tile deep
        # (a course starting in the wall row would leave a strip of bare
        # earth under the house fronts).
        top = min((c[1] for c in m.tiles(kinds[0])), default=first_y)
        y = float(first_y)
        while y < m.h:
            row_h = top - y if y < top else 0.7 + rng.random() * 0.4
            start, stop = ends(y, y + row_h)
            # Courses start at the paving's edge, staggered by their first slab.
            x = float(start) - rng.random() * 0.9
            while x < m.w:
                ln = 1.0 + rng.random() * 0.9
                cx, cy = x + ln / 2, y + row_h / 2
                box = fit(max(x, start), min(x + ln, stop), y, y + row_h) if min(x + ln, stop) - max(x, start) > 0.1 else None
                if box and not paved((box[0] + box[1]) / 2, (box[2] + box[3]) / 2):
                    box = None
                if box:
                    x0, x1 = box[0] + 0.006, box[1] - 0.006
                    y0, y1 = box[2] + 0.006, box[3] - 0.006
                    z0 = 0.035 + (rng.random() - 0.5) * 0.012
                    tx, ty = (rng.random() - 0.5) * 0.012, (rng.random() - 0.5) * 0.012
                    r = rng.random()
                    if rng.random() < 0.1 and x1 - x0 > 1.0:
                        cut = x0 + (x1 - x0) * (0.35 + rng.random() * 0.3)
                        pieces = [[(x0, y0), (cut - 0.006, y0), (cut + 0.03 - 0.006, y1), (x0, y1)], [(cut + 0.006, y0), (x1, y0), (x1, y1), (cut + 0.03 + 0.006, y1)]]
                    else:
                        pieces = [[(x0, y0), (x1, y0), (x1, y1), (x0, y1)]]
                    for poly in pieces:
                        self._prism(bm, layer, poly, lambda px, py, z0=z0, tx=tx, ty=ty, cx=cx, cy=cy: z0 + tx * (px - cx) + ty * (py - cy), 0.06, 0.02, r, dome=0.006)
                x += ln
            y += row_h
        obj = common.mesh_object(name, bm, self._mat("paver"), self.col_ground, smooth=True)
        self.ground_objects.append(obj)
        self._stylobate(stylobate)
        return obj

    def _stylobate_rows(self):
        """The stoa's stylobate: (x0, x1, y0, y1) under each colonnade that
        stands in a street."""
        if self.style != "city":
            return []
        out = []
        for x0, x1, y in self._colonnade_rows():
            out.append((x0 - 0.3, x1 + 0.3, y + 0.02, y + 0.98))
        return out

    def _stylobate(self, rows):
        bm, layer = self._rbm()
        for x0, x1, y0, y1 in rows:
            x = x0
            while x < x1 - 0.05:
                ln = min(x1 - x, 0.8 + self.rng.random() * 0.5)
                self._cbox(bm, layer, x + 0.006, y0, x + ln - 0.006, y1, -0.05, 0.1, chamfer=0.02, point=self.QT)
                self._cbox(bm, layer, x + 0.006, y0 + 0.14, x + ln - 0.006, y1 - 0.14, 0.1, 0.19, chamfer=0.02, point=self.QT)
                x += ln
        if bm.verts:
            self.to_ground(self._obj("stylobate", bm, self._mat("marble-grey")))
        else:
            bm.free()

    # ── the fuller's yard wall ──────────────────────────────────────────────
    def tile_fence(self):
        """Field walls: in a Roman town a yard wall of mortared rubble,
        whitewashed, capped with a row of roof tiles; elsewhere the shared
        fences (a wattle fence in the valley)."""
        if not (self.roman and self.style == "city"):
            return super().tile_fence()
        m = self.map
        cells = set(m.tiles("fence"))
        in_run = set()
        for x0, x1, y in m.runs("fence"):
            if x1 - x0 < 2:
                continue
            name = f"yardwall-{x0}-{y}"
            self.sprite(name, y + 0.68, self._yard_wall(name, x0, x1, y + 0.35, y + 0.65, "x"), [(x, y) for x in range(x0, x1)])
            in_run |= {(x, y) for x in range(x0, x1)}
        for x, y in sorted(cells - in_run):
            north = (x, y - 1) in cells
            south = (x, y + 1) in cells
            y0 = y - 0.35 if north and (x, y - 1) in in_run else (y if north else y + 0.35)
            y1 = y + 1.0 if south else y + 0.65
            name = f"yardwall-{x}-{y}"
            self.sprite(name, y1, self._yard_wall(name, y0, y1, x + 0.35, x + 0.65, "y"), [(x, y)])

    def _yard_wall(self, name, a, b, c0, c1, axis):
        h = 1.0
        objs = []
        bm, layer = self._rbm()
        if axis == "x":
            self._cbox(bm, layer, a, c0, b, c1, 0.0, h, chamfer=0.02)
        else:
            self._cbox(bm, layer, c0, a, c1, b, 0.0, h, chamfer=0.02)
        objs.append(self._obj(f"{name}-body", bm, R.stucco("#e4e0d4", "yard-whitewash", flaked=0.45, streaks=0.3, grime=0.5)))
        # A coping of imbrices along the top.
        cb, cl = self._rbm()
        length = b - a
        n = max(1, int(length / 0.36))
        mid = (c0 + c1) / 2
        for k in range(n):
            u0 = a + k * length / n
            u1 = u0 + length / n + 0.03
            ring_a, ring_b = [], []
            for s in range(9):
                ang = math.pi * s / 8
                if axis == "x":
                    pa = self.P(u0, mid + math.cos(ang) * 0.17, h + math.sin(ang) * 0.1)
                    pb = self.P(u1, mid + math.cos(ang) * 0.16, h + math.sin(ang) * 0.095)
                else:
                    pa = self.P(mid + math.cos(ang) * 0.17, u0, h + math.sin(ang) * 0.1)
                    pb = self.P(mid + math.cos(ang) * 0.16, u1, h + math.sin(ang) * 0.095)
                ring_a.append(cb.verts.new(pa))
                ring_b.append(cb.verts.new(pb))
            r = self.rng.random()
            for s in range(8):
                f = cb.faces.new((ring_a[s], ring_a[s + 1], ring_b[s + 1], ring_b[s]))
                f[cl] = r
        objs.append(self._obj(f"{name}-coping", cb, self._mat("roof"), smooth=True))
        return objs

    # ── the street's ground ─────────────────────────────────────────────────
    def tile_sand(self):
        """Bare ground: in a fuller's yard, earth white with spilt fuller's
        clay; elsewhere the shared grit and pebbles."""
        if not (self.roman and self.style == "city"):
            return super().tile_sand()
        m = self.map
        rng = self.rng
        clay = R.soft_decal("#e2dccc", 0.5, "fullers-clay", core=0.0)
        for x, y in m.tiles("sand"):
            for k in range(2):
                L, W = 1.1 + rng.random() * 0.9, 0.9 + rng.random() * 0.6
                self._decal(f"clay-{x}-{y}-{k}", x + rng.random(), y + rng.random(), L, W, rng.random() * math.pi, clay, 0.004)
        lib = self._library()
        import scatter

        scatter.scatter(self.emitter("grit", m.tiles("sand")), lib["pebbles"], 6.0, (0.01, 0.03), seed=9, rotate_z_only=True, pick=True)

    def tile_scrub(self):
        """Scrub: green grass and weeds with a few dry tufts along the foot
        of the hill (a Roman street); elsewhere the shared scrub."""
        if not (self.roman and self.style == "city"):
            return super().tile_scrub()
        cells = self.map.tiles("scrub")
        if cells:
            self._meadow(cells, density=60.0, flowers=3.0, seed=301)

    def _litter(self):
        """What a Roman street leaves on the ground: wet stone round the
        fountain, potsherds by the potter, straw where the mule stands,
        leaves under the fig trees in their stone pits."""
        if not self.roman:
            return super()._litter()
        m = self.map
        rng = self.rng
        wet = R.soft_decal("#5e5a52", 0.55, "wet-stone")
        for x, y in m.tiles("fountain"):
            self._decal(f"wet-{x}-{y}", x + 0.5, y + 1.25, 2.2, 1.2, 0.0, wet, 0.045)
            self._decal(f"wet2-{x}-{y}", x + 0.3, y + 1.9, 1.0, 0.8, 0.4, wet, 0.045)
        sherd = M.terracotta("#a8452c", 0.2)
        for x, y in m.tiles("stall") + m.tiles("jars"):
            for k in range(6):
                c = self.P(x + rng.random(), y + 1.0 + rng.random() * 0.6, 0.05)
                s = common.box(f"sherd-{x}-{y}-{k}", (0.05 + rng.random() * 0.04, 0.03 + rng.random() * 0.03, 0.008), c, sherd, None)
                s.rotation_euler = (0, 0, rng.random() * math.tau)
                self.to_ground(s)
        straw = M.plain("#c2a86a", 0.8, 0.2)
        bm = bmesh.new()
        for e in m.entities:
            if e.get("sprite") in ("pack-donkey", "donkey") or e["id"] in ("attalos",):
                for _ in range(60):
                    cx, cy = e["x"] - 0.5 + rng.random() * 2.0, e["y"] + rng.random() * 1.4
                    a = rng.random() * math.tau
                    ln = 0.03 + rng.random() * 0.05
                    dx, dy = math.cos(a) * ln / 2, math.sin(a) * ln / 2
                    vs = [bm.verts.new(self.P(cx - dx, cy - dy - 0.003, 0.046)), bm.verts.new(self.P(cx + dx, cy + dy - 0.003, 0.046)), bm.verts.new(self.P(cx + dx, cy + dy + 0.003, 0.046)), bm.verts.new(self.P(cx - dx, cy - dy + 0.003, 0.046))]
                    bm.faces.new(vs)
        self.ground_objects.append(common.mesh_object("straw", bm, straw, self.col_ground, smooth=False))
        leaf = M.leaf("#5a7434", "#98a86a")
        dry = M.leaf("#8a7a44", "#a89a6a")
        for x, y in m.tiles("fig"):
            if not m.near(x, y, ("paving",), 1):
                continue
            pb, pl = self._rbm()
            for a, b, c, d in ((x + 0.05, y + 0.05, x + 0.95, y + 0.17), (x + 0.05, y + 0.83, x + 0.95, y + 0.95), (x + 0.05, y + 0.05, x + 0.17, y + 0.95), (x + 0.83, y + 0.05, x + 0.95, y + 0.95)):
                self._cbox(pb, pl, a, b, c, d, 0.0, 0.1, chamfer=0.02)
            self.to_ground(self._obj(f"treepit-{x}-{y}", pb, self._mat("marble-grey")))
            self.to_ground(common.box(f"treepit-soil-{x}-{y}", (0.66, 0.66, 0.02), self.P(x + 0.5, y + 0.5, 0.03), self._mat("soil"), None))
            for k in range(14):
                c = self.P(x - 0.6 + rng.random() * 2.2, y - 0.3 + rng.random() * 1.8, 0.05)
                self.to_ground(self._ellipsoid(f"figleaf-{x}-{y}-{k}", c, (0.05, 0.04, 0.003), dry if k % 2 else leaf, 8, 3))
