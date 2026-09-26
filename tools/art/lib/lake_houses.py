"""The houses of Capernaum: walls of the local black basalt, fieldstones
laid dry in rough courses with small stones wedged in the gaps and earth
packed behind them; doorways framed with bigger, roughly squared blocks
under a single long basalt lintel; small windows; flat roofs of wooden
beams (their ends showing under the eaves), then branches and reeds, then
a thick layer of packed mud rolled smooth with a stone roller, with a low
parapet at the edge (Deuteronomy 22:8) and the life of a fisher family on
top: fish drying on mats, a net spread out, jars, the roller itself.

A house is a block of roof tiles with a row of wall tiles along its south
side (its front). The house runs on north past the edge of the map, so it
casts the shadow a real house would.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import common
import lake_materials as LM
import materials as M
import rocks


def B(x, y, z=0.0):
    return Vector((x, -y, z))


class HousesMixin:
    def lake_structures(self):
        """Regions of wall, roof and door tiles on the lakeside: basalt houses,
        and dry-stone basalt walls for any walls left over."""
        m = self.map
        for reg in self.regions():
            cells = set(reg)
            used = set()
            for block in self._roof_blocks(cells):
                xs = [c[0] for c in block]
                ys = [c[1] for c in block]
                x0, x1, n, s = min(xs), max(xs) + 1, min(ys), max(ys)
                front = [(x, s + 1) for x in range(x0, x1) if (x, s + 1) in cells]
                house = set(block) | set(front)
                self.basalt_house(f"house-{x0}-{n}", x0, x1, n, s + 1, house)
                used |= house
            walls = [c for c in reg if c not in used and m.kind(*c) in ("wall", "door")]
            for x0, x1, y in self._runs_of(walls):
                name = f"wall-{x0}-{y}"
                self.sprite(name, y + 0.75, self._drystone(name, x0, x1, y), [(x, y) for x in range(x0, x1)])

    @staticmethod
    def _runs_of(cells):
        out = []
        for y in sorted({c[1] for c in cells}):
            xs = sorted(c[0] for c in cells if c[1] == y)
            i = 0
            while i < len(xs):
                j = i
                while j + 1 < len(xs) and xs[j + 1] == xs[j] + 1:
                    j += 1
                out.append((xs[i], xs[j] + 1, y))
                i = j + 1
        return out

    # ── a house ─────────────────────────────────────────────────────────────
    def basalt_house(self, name, x0, x1, n, front_row, cells):
        m = self.map
        rng = self.rng
        gy = front_row + 0.92
        base = self.H(x0 + (x1 - x0) / 2, gy)
        height = 2.45 + rng.random() * 0.25
        depth = 4.2
        doors = [x for x in range(x0, x1) if m.kind(x, front_row) == "door"]
        objs = []
        # Someone is still awake in the middle house: after dark a lamp burns
        # inside, and you see into the room through its open door.
        lit = doors[0] if doors and x0 <= m.w / 2 <= x1 else None

        def P(x, y, z):
            # Everything of the house stands on the ground at its front.
            return Vector((x, -(y + base), base + z))

        # Openings in the front: doors (tile + 0.05 .. +0.95), one window.
        openings = []
        for dx in doors:
            openings.append((dx + 0.04, dx + 0.96, 0.0, 1.88))
        win = None
        for wx in (x0 + 2.2, x1 - 2.6, x0 + (x1 - x0) * 0.3):
            if all(abs(wx - (d + 0.5)) > 1.4 for d in doors) and x0 + 0.8 < wx < x1 - 1.2:
                win = (wx, wx + 0.46, 1.34, 1.84)
                break
        if win:
            openings.append(win)
        # The fill behind the stones: earth packed into the joints, a few
        # centimetres back from the stones' faces.
        fill = common.box(f"{name}-fill", (x1 - x0, depth - 0.1, height), P((x0 + x1) / 2, gy - depth / 2 - 0.05, height / 2), self.mortar, None)
        for ox0, ox1, oz0, oz1 in openings:
            # The lit door opens into the room: its hole runs deep enough that
            # everything seen through it (at 45°, 1.9 m of floor) is inside.
            deep = lit is not None and ox0 == lit + 0.04
            ln = 2.8 if deep else 1.2
            hole = common.box(f"{name}-hole", (ox1 - ox0, ln, oz1 - oz0), P((ox0 + ox1) / 2, gy + 0.3 - ln / 2, (oz0 + oz1) / 2), None, None)
            mod = fill.modifiers.new("hole", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.object = hole
            common.bake_modifiers(fill)
            import bpy

            bpy.data.objects.remove(hole)
        objs.append(fill)
        # The front: fieldstones in rough courses.
        objs.append(self._fieldstone_face(f"{name}-stones", x0, x1, gy, height, openings, P, rng))
        # Door frames: jambs of bigger blocks, a long lintel, a threshold, a door leaf, dark inside.
        for dx in doors:
            objs += self._basalt_doorway(f"{name}-door{dx}", dx, gy, P, rng)
        if win:
            objs += self._basalt_window(f"{name}-win", win, gy, P)
        # The roof.
        objs += self._mud_roof(name, x0, x1, gy, depth, height, P, rng)
        # Beside the door: a water jar, quern stones, a bench of stone.
        for dx in doors:
            objs += self._doorstep_life(f"{name}-step{dx}", dx, gy, P, rng)
        if lit is not None:
            objs += self._lit_room(f"{name}-door{lit}", lit, gy, base, P, objs)
        self.sprite(name, gy, objs, sorted(cells))

    def _lit_room(self, name, dx, gy, base, P, parts):
        """The room behind the middle house's door after dark, seen through
        it: a beaten-earth floor running back into the house, a mat and a
        jar on it, the door leaf swung in against the wall, and a clay lamp
        burning on a low stone by the east jamb. Its light falls on the floor
        and out through the doorway onto the lane in a widening spill, cut by
        the jambs. By day the doorway stays dark (the `dark` box)."""
        import kit_lake

        objs = []
        cx = dx + 0.5
        dark = next((o for o in parts if o.name == f"{name}-dark"), None)
        if dark is not None:
            kit_lake.only(dark, kit_lake.BY_DAY)
        # The floor: packed earth, a hand's breadth above the lane (the
        # terrain under the house is a holdout in its render).
        rise = max(0.04, max(self.H(cx + ddx, gy - d) for ddx in (-0.5, 0.0, 0.5) for d in (0.2, 1.2, 2.2)) - base + 0.03)
        floor = common.box(f"{name}-floor", (1.3, 2.5, 0.06), P(cx, gy - 1.35, rise - 0.03), M.plaster("#6a5846", "house-floor-earth"), None)
        objs.append(floor)
        # A rush mat along the west wall, a water jar at the back, a basket.
        objs.append(common.box(f"{name}-mat", (0.5, 1.1, 0.012), P(cx - 0.22, gy - 1.35, rise + 0.006), M.straw("#8e7a52"), None))
        objs += self.storage_jar(f"{name}-jar", P(cx - 0.22, gy - 1.95, rise), 0.8, "#94623f", lid=False, dusty=0.3)
        objs.append(self._lathe(f"{name}-basket", [(0.1, 0.0), (0.15, 0.06), (0.17, 0.14), (0.18, 0.16)], P(cx + 0.24, gy - 1.6, rise), M.straw("#9c8456"), 20))
        # The lamp: a clay lamp on a plain wooden stand just inside, by the
        # east jamb, its flame just low enough to be seen under the lintel;
        # set that high, its light falls out through the door in a wedge.
        wood = M.wood("#5a4330", 4.0)
        foot = P(cx + 0.24, gy - 0.72, rise)
        objs.append(self._lathe(f"{name}-stand-foot", [(0.0, 0.0), (0.12, 0.0), (0.12, 0.03), (0.05, 0.06), (0.0, 0.06)], foot, wood, 16))
        objs.append(self._branch(f"{name}-stand-post", foot, foot + Vector((0, 0, 0.9)), 0.022, 0.018, wood, 8, bow=0.0))
        objs.append(self._lathe(f"{name}-stand-top", [(0.0, 0.88), (0.08, 0.88), (0.085, 0.91), (0.0, 0.91)], foot, wood, 16))
        top = foot + Vector((0, 0, 0.91))
        objs.append(self._lathe(f"{name}-lamp", [(0.0, 0.0), (0.035, 0.0), (0.05, 0.015), (0.045, 0.03), (0.012, 0.035), (0.0, 0.036)], top, M.terracotta("#a0663e", 0.1), 16))
        objs += self.lamp_flame(f"{name}-lamp", top + Vector((0.035, 0.0, 0.045)), (0.012, 0.03), 32.0, top + Vector((0.035, 0.0, 0.1)), radius=40.0)
        return objs

    def _fieldstone_face(self, name, x0, x1, gy, height, openings, P, rng):
        """Rounded and broken basalt fieldstones laid in rough courses, the
        biggest at the bottom, small stones wedged between, bulging a little
        out of the wall's face."""
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        z = 0.0
        course = 0
        seed = int(x0 * 131 + gy * 17)

        def blocked(xa, xb, za, zb):
            for ox0, ox1, oz0, oz1 in openings:
                # Frames are built separately: keep clear of the opening and its jambs.
                if xa < ox1 + 0.16 and xb > ox0 - 0.16 and za < oz1 + 0.34 and zb > oz0:
                    return True
            return False

        while z < height - 0.05:
            ch = (0.38 + rng.random() * 0.14) if course == 0 else (0.2 + rng.random() * 0.16)
            ch = min(ch, height - z)
            x = x0 - 0.05 - rng.random() * 0.2
            while x < x1 + 0.05:
                big = rng.random() < 0.12 and course > 0
                w = (0.45 + rng.random() * 0.4) if course == 0 else (0.2 + rng.random() * 0.38) * (1.6 if big else 1.0)
                if blocked(x, x + w, z, z + ch):
                    x += w
                    continue
                cx = x + w / 2
                hh = ch * (1.45 if big else 1.0)
                cz = z + hh / 2 + (rng.random() - 0.5) * 0.05
                depth = 0.16 + rng.random() * 0.08
                size = (w * 0.5, depth, hh * 0.54)
                # The face of each stone stands 1-6 cm proud of the wall's line.
                self._stone(bm, layer, P(cx, gy - depth + 0.01 + rng.random() * 0.05, cz), size, seed, rng, blocky=0.35 + rng.random() * 0.4)
                seed += 1
                # Chips wedged into the joints: at the stone's right edge and its top corners.
                for k in range(1 + int(rng.random() * 2.5)):
                    s = 0.035 + rng.random() * 0.05
                    px = x + w + (rng.random() - 0.5) * 0.04
                    pz = z + rng.random() * hh
                    if not blocked(px - s, px + s, pz - s, pz + s):
                        self._stone(bm, layer, P(px, gy - 0.07, pz), (s, 0.07, s * 0.8), seed, rng, blocky=0.6)
                        seed += 1
                x += w + 0.01
            z += ch
            course += 1
        obj = common.mesh_object(name, bm, self.basalt, None, smooth=True)
        # Weathered edges: a slight bevel, the faces left rough.
        mod = common.add_modifier(obj, "BEVEL", width=0.012, segments=2, limit_method="ANGLE")
        mod.angle_limit = math.radians(35)
        return obj

    def _stone(self, bm, layer, at, size, seed, rng, blocky=0.3):
        """One fieldstone centred at `at` (half-extents `size`): a lumpy,
        more or less rounded block of basalt (`blocky`: flat-faced and
        angular toward 1), its own tone (the `rand` face attribute)."""
        before = len(bm.faces)
        flat = 0.85
        rocks.stone_mesh(bm, seed * 7 + 11, size, flat=flat, blocky=blocky, n=20, at=at - Vector((0, 0, size[2] * flat)), sink=0.0, rot=(rng.random() - 0.5) * 0.3, detail=2)
        bm.faces.ensure_lookup_table()
        r = rng.random()
        for f in bm.faces[before:]:
            f[layer] = r

    def _basalt_doorway(self, name, dx, gy, P, rng):
        objs = []
        stone = self.basalt_dressed
        cx = dx + 0.5
        h = 1.88
        # Jambs: three roughly squared blocks each side.
        z = 0.0
        for k, bh in enumerate((0.62, 0.64, 0.62)):
            for side in (-1, 1):
                w = 0.26 + rng.random() * 0.06
                b = common.box(f"{name}-jamb{side}{k}", (w, 0.34, bh - 0.02), P(cx + side * (0.46 + w / 2), gy - 0.14, z + bh / 2), stone, None, bevel=0.035)
                common.bake_modifiers(b)
                self._rand_attr(b)
                objs.append(b)
            z += bh
        lintel = common.box(f"{name}-lintel", (1.62, 0.38, 0.34), P(cx, gy - 0.16, h + 0.17), stone, None, bevel=0.04)
        common.bake_modifiers(lintel)
        self._rand_attr(lintel)
        objs.append(lintel)
        sill = common.box(f"{name}-sill", (1.1, 0.4, 0.08), P(cx, gy - 0.1, 0.04), stone, None, bevel=0.02)
        common.bake_modifiers(sill)
        self._rand_attr(sill, 0.4)
        objs.append(sill)
        objs.append(common.box(f"{name}-dark", (0.9, 0.3, h), P(cx, gy - 0.3, h / 2), self.dark, None))
        leaf = common.box(f"{name}-leaf", (0.06, 0.72, h - 0.08), P(cx - 0.38, gy - 0.55, (h - 0.08) / 2), M.wood("#5c4430", 9.0), None, bevel=0.006)
        common.bake_modifiers(leaf)
        objs.append(leaf)
        return objs

    def _basalt_window(self, name, win, gy, P):
        x0, x1, z0, z1 = win
        stone = self.basalt_dressed
        cx = (x0 + x1) / 2
        objs = [common.box(f"{name}-dark", (x1 - x0, 0.3, z1 - z0), P(cx, gy - 0.25, (z0 + z1) / 2), self.dark, None)]
        for nm, zz, hh, ww in (("lintel", z1 + 0.11, 0.22, x1 - x0 + 0.5), ("sill", z0 - 0.06, 0.12, x1 - x0 + 0.3)):
            b = common.box(f"{name}-{nm}", (ww, 0.32, hh), P(cx, gy - 0.13, zz), stone, None, bevel=0.03)
            common.bake_modifiers(b)
            self._rand_attr(b)
            objs.append(b)
        for side in (-1, 1):
            b = common.box(f"{name}-jamb{side}", (0.16, 0.3, z1 - z0), P(cx + side * ((x1 - x0) / 2 + 0.08), gy - 0.13, (z0 + z1) / 2), stone, None, bevel=0.03)
            common.bake_modifiers(b)
            objs.append(b)
        # A wooden grille of three bars.
        for k in range(2):
            bx = x0 + (x1 - x0) * (k + 1) / 3
            objs.append(common.box(f"{name}-bar{k}", (0.035, 0.035, z1 - z0), P(bx, gy - 0.08, (z0 + z1) / 2), M.wood("#5a4330", 4.0), None))
        return objs

    def _mud_roof(self, name, x0, x1, gy, depth, height, P, rng):
        """Beams across the walls (their round ends out through the front),
        a layer of branches and reeds, packed mud on top with a rounded,
        cracked edge and grass sprouting from it, a low parapet, and what a
        fisher family keeps on its roof."""
        objs = []
        beam = M.wood("#5a4430", 3.0)
        z = height
        bx = x0 + 0.22
        while bx < x1 - 0.1:
            r = 0.075 + rng.random() * 0.03
            objs.append(self._branch(f"{name}-beam{bx:.1f}", P(bx, gy - depth + 0.2, z + r * 0.6), P(bx + (rng.random() - 0.5) * 0.04, gy + 0.14 + rng.random() * 0.06, z + r * 0.6), r, r * 0.9, beam, 8, bow=0.0))
            bx += 0.46 + rng.random() * 0.1
        # Branches and reeds laid across the beams, their ends ragged over the front.
        reeds = M.thatch("#8a7650", "roof-reeds-lake")
        bm = bmesh.new()
        rnd = bm.faces.layers.float.new("rand")
        for k in range(int((x1 - x0) * 22)):
            x = x0 + rng.random() * (x1 - x0)
            ln = 0.4 + rng.random() * 0.5
            a = P(x, gy + 0.12 + rng.random() * 0.12, z + 0.19 + rng.random() * 0.03)
            b = a + Vector(((rng.random() - 0.5) * 0.1, ln, rng.random() * 0.02))
            s = Vector((0.012, 0, 0))
            v = [bm.verts.new(a - s), bm.verts.new(a + s), bm.verts.new(b + s), bm.verts.new(b - s)]
            f = bm.faces.new(v)
            f[rnd] = rng.random()
        objs.append(common.mesh_object(f"{name}-reeds", bm, reeds, None))
        slab_mat = self.roof
        objs.append(self._roof_slab(f"{name}-reedlayer", x0 - 0.04, x1 + 0.04, gy - depth, z + 0.16, gy + 0.2, z + 0.16, 0.05, reeds, rng, ragged=0.08, seg=30))
        objs.append(self._roof_slab(f"{name}-mud", x0 - 0.02, x1 + 0.02, gy - depth, z + 0.21, gy + 0.1, z + 0.2, 0.2, slab_mat, rng, ragged=0.06, seg=30))
        top = z + 0.41
        # A low parapet along the front edge (the Law required one: Deuteronomy 22:8).
        par = bmesh.new()
        pl = par.faces.layers.float.new("rand")
        x = x0 + 0.02
        while x < x1 - 0.05:
            w = 0.22 + rng.random() * 0.14
            self._roughbox(par, pl, P, x + 0.01, x + w - 0.01, gy - 0.12, gy + 0.08, top, top + 0.26 + rng.random() * 0.04, rng)
            x += w
        objs.append(common.mesh_object(f"{name}-parapet", par, self.basalt, None, smooth=False))
        # Grass and weeds sprouting from the mud along the edge.
        lib = self._library()
        tuft_src = lib.get("green", lib["tufts"])
        tuft_objs = list(tuft_src.objects)
        for k in range(int((x1 - x0) * 1.6)):
            t = tuft_objs[k % len(tuft_objs)].copy()
            t.data = t.data.copy()
            t.matrix_world = Matrix.Translation(P(x0 + 0.2 + rng.random() * (x1 - x0 - 0.4), gy - 0.25 - rng.random() * 0.4, top - 0.02)) @ Matrix.Rotation(rng.random() * 6.28, 4, "Z") @ Matrix.Scale(0.7 + rng.random() * 0.5, 4)
            import bpy

            bpy.context.scene.collection.objects.link(t)
            objs.append(t)
        # Roof life behind the parapet (only its front shows).
        w = x1 - x0
        k = 0
        sx = x0 + 0.5
        while sx < x1 - 1.3:
            kind = k % 3
            sy = gy - 0.5 - rng.random() * 0.3
            if kind == 0:
                objs.append(common.box(f"{name}-mat{k}", (1.0, 0.7, 0.012), P(sx + 0.5, sy - 0.3, top + 0.006), M.straw("#a8905e"), None))
                for q in range(14):
                    objs += self._split_fish(f"{name}-rf{k}-{q}", P(sx + 0.1 + rng.random() * 0.8, sy - 0.05 - rng.random() * 0.5, top + 0.014), 0.14 + rng.random() * 0.05, rng, hang=False, lie_angle=rng.random() * 6.28)
            elif kind == 1:
                objs += self._jar_group(f"{name}-rj{k}", sx, sy, top, rng, count=2, at=P(sx, sy, 0) - Vector((0, 0, 0)))
            else:
                roller = self._branch(f"{name}-roller{k}", P(sx, sy - 0.2, top + 0.12), P(sx + 0.62, sy - 0.22, top + 0.12), 0.12, 0.12, self.basalt_dressed, 14, bow=0.0)
                objs.append(roller)
            sx += 1.6 + rng.random() * 0.8
            k += 1
        _ = w
        return objs

    def _roughbox(self, bm, layer, P, x0, x1, y0, y1, z0, z1, rng):
        """A roughly squared stone between the given bounds."""
        j = lambda: (rng.random() - 0.5) * 0.03  # noqa: E731
        c = [P(x + j(), y + j(), z + j()) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
        v = [bm.verts.new(p) for p in c]
        r = rng.random()
        for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            f = bm.faces.new([v[i] for i in q])
            f[layer] = r

    def _doorstep_life(self, name, dx, gy, P, rng):
        """By a door: a tall water jar with a dipper on it, and a pair of
        basalt quern stones (Capernaum made them for the whole region)."""
        objs = []
        side = 1 if rng.random() < 0.5 else -1
        jx = dx + 0.5 + side * 1.1
        objs += self.storage_jar(f"{name}-jar", P(jx, gy + 0.22, 0.0), 1.05, "#a26c4a", lid=False, dusty=0.5)
        qx = dx + 0.5 - side * 1.25
        quern = self.basalt_dressed
        objs.append(self._lathe(f"{name}-quern-lower", [(0.0, 0.0), (0.24, 0.0), (0.25, 0.09), (0.18, 0.13), (0.0, 0.14)], P(qx, gy + 0.3, 0.0), quern, 24))
        upper = self._lathe(f"{name}-quern-upper", [(0.03, 0.0), (0.23, 0.0), (0.23, 0.08), (0.05, 0.09), (0.03, 0.09)], P(qx + 0.03, gy + 0.3, 0.14), quern, 24)
        objs.append(upper)
        objs.append(self._branch(f"{name}-quern-handle", P(qx + 0.2, gy + 0.3, 0.2), P(qx + 0.2, gy + 0.3, 0.34), 0.018, 0.016, M.wood("#5a4330", 3.0), 5, bow=0.0))
        return objs
