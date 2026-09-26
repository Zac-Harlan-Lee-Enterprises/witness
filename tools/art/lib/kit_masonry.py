"""Dressed stone: the Jerusalem market's houses, the city wall, paving,
steps, gates and dry-stone walls (first built for the market; see place.py
for how kits are combined)."""
import math

import bmesh
from mathutils import Vector

import common
import materials as M


def B(x, y, z=0.0):
    return Vector((x, -y, z))


class MasonryKit:
    # ── paving and steps ────────────────────────────────────────────────────
    def city_paving(self, kinds=("paving", "gate"), edge_ok=("paving", "gate", "well", "stall", "basket", "jars", "sacks"), name="paving"):
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
                edge = any(m.kind(int(cx) + dx, int(cy) + dy) not in edge_ok for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if here in kinds and rng.random() > (0.2 if edge else 0.02):
                    self._slab(bm, rnd_layer, x + 0.014, y + 0.014, length - 0.028, row_h - 0.028, rng)
                x += length
            y += row_h
        obj = common.mesh_object(name, bm, self.paving, self.col_ground, smooth=False)
        self.ground_objects.append(obj)
        return obj

    def _slab(self, bm, layer, x, y, w, h, rng, top=0.035):
        """A worn stone slab: rounded edges, a slightly domed top, some sunk or
        cracked. Built as a small grid so the wear catches the light."""
        sunk = rng.random() < 0.06
        z0 = top + (rng.random() - 0.5) * 0.014 - (0.018 if sunk else 0.0)
        tx = (rng.random() - 0.5) * 0.02
        ty = (rng.random() - 0.5) * 0.02
        r = rng.random()
        if rng.random() < 0.08 and w > 0.5:
            cut = w * (0.35 + rng.random() * 0.3)
            self._slab_piece(bm, layer, x, y, cut - 0.008, h, z0, tx, ty, r)
            self._slab_piece(bm, layer, x + cut + 0.008, y, w - cut - 0.008, h, z0 - 0.004, tx, ty, r)
            return
        self._slab_piece(bm, layer, x, y, w, h, z0, tx, ty, r)

    def _slab_piece(self, bm, layer, x, y, w, h, z0, tx, ty, r, n=4):
        edge = 0.035
        grid = []
        at = []
        for j in range(n + 1):
            row = []
            arow = []
            for i in range(n + 1):
                u, v = i / n, j / n
                px = x + edge * 0.6 + (w - edge * 1.2) * u
                py = y + edge * 0.6 + (h - edge * 1.2) * v
                dome = 0.008 * math.sin(math.pi * u) * math.sin(math.pi * v)
                pz = z0 + dome + tx * (u - 0.5) + ty * (v - 0.5)
                row.append(bm.verts.new(self.P(px, py, pz)))
                arow.append((px, py))
            grid.append(row)
            at.append(arow)
        faces = []
        for j in range(n):
            for i in range(n):
                faces.append(bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1])))
        order = [(0, i) for i in range(n + 1)] + [(j, n) for j in range(1, n + 1)] + [(n, i) for i in range(n - 1, -1, -1)] + [(j, 0) for j in range(n - 1, 0, -1)]
        ring = [grid[j][i] for j, i in order]
        low = []
        for j, i in order:
            vx, vy = at[j][i]
            cx = min(max(vx, x), x + w)
            cy = min(max(vy, y), y + h)
            ox = (cx - (x + w / 2)) / max(1e-6, w / 2)
            oy = (cy - (y + h / 2)) / max(1e-6, h / 2)
            low.append(bm.verts.new(self.P(x + w / 2 + ox * w / 2, y + h / 2 + oy * h / 2, -0.02)))
        for k in range(len(ring)):
            kk = (k + 1) % len(ring)
            faces.append(bm.faces.new((ring[k], low[k], low[kk], ring[kk])))
        for f in faces:
            f[layer] = r
            f.smooth = True

    def yard_flags(self, kinds=("paving",), name="yard-flags", spacing=0.36):
        """Field-stone flags laid irregularly: a jittered grid of cells, each a
        worn four- or five-sided stone with earth in the gaps; now and then
        two cells make one long stone, and a few are missing or sunk."""
        m = self.map
        rng = self.rng
        nx = int(m.w / spacing) + 2
        ny = int(m.h / spacing) + 2
        grid = [[(i * spacing + (rng.random() - 0.5) * spacing * 0.55, j * spacing + (rng.random() - 0.5) * spacing * 0.55) for i in range(nx + 1)] for j in range(ny + 1)]
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        used = set()
        for j in range(ny):
            for i in range(nx):
                if (i, j) in used:
                    continue
                cx = (grid[j][i][0] + grid[j + 1][i + 1][0]) / 2
                cy = (grid[j][i][1] + grid[j + 1][i + 1][1]) / 2
                if m.kind(int(cx), int(cy)) not in kinds:
                    continue
                corners = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
                if rng.random() < 0.22 and i + 1 < nx and (i + 1, j) not in used:
                    ccx = (grid[j][i + 1][0] + grid[j + 1][i + 2][0]) / 2
                    ccy = (grid[j][i + 1][1] + grid[j + 1][i + 2][1]) / 2
                    if m.kind(int(ccx), int(ccy)) in kinds:
                        corners = [grid[j][i], grid[j][i + 2], grid[j + 1][i + 2], grid[j + 1][i]]
                        used.add((i + 1, j))
                used.add((i, j))
                edge = m.near(int(cx), int(cy), set(k for k in ("sand", "scrub", "grass", "void")), 1)
                if rng.random() < (0.12 if edge else 0.03):
                    continue
                self._flag(bm, layer, corners, rng)
        obj = common.mesh_object(name, bm, self.paving, self.col_ground, smooth=True)
        self.ground_objects.append(obj)
        return obj

    def _flag(self, bm, layer, corners, rng, gap=0.017):
        cx = sum(c[0] for c in corners) / len(corners)
        cy = sum(c[1] for c in corners) / len(corners)
        pts = []
        for x, y in corners:
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy) or 1.0
            k = max(0.0, 1 - gap / d)
            pts.append((cx + dx * k, cy + dy * k))
        z0 = 0.028 + (rng.random() - 0.5) * 0.014 - (0.015 if rng.random() < 0.08 else 0.0)
        tilt = ((rng.random() - 0.5) * 0.02, (rng.random() - 0.5) * 0.02)
        r = rng.random()
        n = 3
        # Top: bilinear patch over the quad (or fan for 5), slightly domed.
        if len(pts) == 4:
            grid = []
            for j in range(n + 1):
                row = []
                for i in range(n + 1):
                    u, v = i / n, j / n
                    ax = pts[0][0] + (pts[1][0] - pts[0][0]) * u
                    ay = pts[0][1] + (pts[1][1] - pts[0][1]) * u
                    bx = pts[3][0] + (pts[2][0] - pts[3][0]) * u
                    by = pts[3][1] + (pts[2][1] - pts[3][1]) * u
                    px, py = ax + (bx - ax) * v, ay + (by - ay) * v
                    dome = 0.012 * math.sin(math.pi * u) * math.sin(math.pi * v)
                    pz = z0 + dome + tilt[0] * (u - 0.5) + tilt[1] * (v - 0.5)
                    row.append(bm.verts.new(self.P(px, py, pz)))
                grid.append(row)
            faces = []
            for j in range(n):
                for i in range(n):
                    faces.append(bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1])))
            order = [(0, i) for i in range(n + 1)] + [(j, n) for j in range(1, n + 1)] + [(n, i) for i in range(n - 1, -1, -1)] + [(j, 0) for j in range(n - 1, 0, -1)]
            ring = [grid[j][i] for j, i in order]
            low = [bm.verts.new(v.co + Vector((0.0, 0.0, -(z0 + 0.03)))) for v in ring]
            for k in range(len(ring)):
                kk = (k + 1) % len(ring)
                faces.append(bm.faces.new((ring[k], low[k], low[kk], ring[kk])))
            for f in faces:
                f[layer] = r

    def city_steps(self):
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

    # ── the market's buildings ──────────────────────────────────────────────
    def _buildings(self):
        m = self.map
        perimeter = [(x, y) for y in range(m.h) for x in range(m.w) if (x in (0, m.w - 1) or y in (0, m.h - 1)) and m.kind(x, y) == "wall"]
        self._city_wall(perimeter)
        for reg in self.regions(exclude=set(perimeter)):
            self._house(f"house-{min(p[0] for p in reg)}-{min(p[1] for p in reg)}", reg)

    def _city_wall(self, reg):
        """The perimeter: a tall wall to the north (seen from the market), low
        walls elsewhere (seen only from above)."""
        m = self.map
        cells = set(reg)
        rng = self.rng
        north = [(x, 0) for x in range(m.w) if (x, 0) in cells]
        if north:
            face = self._ashlar_face("wall-north", 0, m.w, 1.0, 3.2, rng, openings=[])
            self.to_ground(face)
        bm = bmesh.new()
        for x, y in reg:
            if y == 0:
                continue
            z = 0.9
            v = [bm.verts.new(B(x + dx, y + dy + z, z)) for dx, dy in ((0, 0), (1, 0), (1, 1), (0, 1))]
            bm.faces.new(v[::-1])
        if bm.verts:
            tops = common.mesh_object("wall-tops", bm, self.limestone, self.col_ground, smooth=False)
            self._rand_attr(tops)
            self.ground_objects.append(tops)
        else:
            bm.free()

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
        core = bmesh.ops.create_cube(bm, size=1.0)
        verts = core["verts"]
        for v in verts:
            v.co.x = x0 + (x1 - x0) * (v.co.x + 0.5)
            v.co.y = -(ground_y - 0.02 - depth * (v.co.y + 0.5))
            v.co.z = height * (v.co.z + 0.5)
        for f in bm.faces:
            if f.verts[0] in verts:
                f[layer] = 0.5
        return common.mesh_object(name, bm, self.limestone, None, smooth=False)

    def _block(self, bm, layer, x0, x1, z0, z1, ground_y, rng):
        """A dressed block: a flat drafted margin and a slightly raised boss."""
        out = 0.012 + rng.random() * 0.01
        m = 0.035
        yb = -(ground_y) - 0.0
        fr = [bm.verts.new((x, yb + out * 0.4, z)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
        bk = [bm.verts.new((x, yb + 0.05, z)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
        boss = [bm.verts.new((x, yb - out, z)) for x, z in ((x0 + m, z0 + m), (x1 - m, z0 + m), (x1 - m, z1 - m), (x0 + m, z1 - m))]
        r = rng.random()
        faces = [bm.faces.new(boss)]
        for i in range(4):
            j = (i + 1) % 4
            faces.append(bm.faces.new((fr[i], fr[j], boss[j], boss[i])))
            faces.append(bm.faces.new((bk[i], bk[j], fr[j], fr[i])))
        for f in faces:
            f[layer] = r
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
            openings = [(dx + 0.1, dx + 0.9, 0.0, 1.85) for dx in doors]
            windows = []
            for wx in range(x0 + 1, x1 - 1, 3):
                if all(abs(wx - d) > 1 for d in doors):
                    windows.append((wx + 0.3, wx + 0.7, 1.35, 1.8))
            face = self._ashlar_face(f"{name}-front", x0, x1, ground_y, height, rng, openings + windows)
            objs.append(face)
            top = n + height
            objs += self._roof(name, x0, x1, top, ground_y - 0.02, height, rng)
            for dx in doors:
                objs += self._doorway(f"{name}-door{dx}", dx, ground_y, 1.85)
            for wx0, wx1, z0, z1 in windows:
                objs += self._window(f"{name}-win{int(wx0)}", wx0, wx1, ground_y, z0, z1)
            self.sprite(name, ground_y, objs, sorted(cells))
        else:
            height = 1.9
            ground_top = n + height
            objs += self._roof(name, x0, x1, ground_top, s + 1.0 + height, height, rng, south_open=True)
            self.sprite(name, s + 1.0, objs, sorted(cells))

    def _roof(self, name, x0, x1, north_y, south_y, height, rng, south_open=False, mat=None, parapet_mat=None):
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
        objs.append(common.mesh_object(f"{name}-roof", bm, mat or self.roof, None, smooth=False))
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
        objs.append(common.mesh_object(f"{name}-parapet", par, parapet_mat or self.limestone, None, smooth=False))
        w = x1 - x0
        d = south_y - north_y
        spots = [(x0 + 0.6 + rng.random() * (w - 1.8), north_y + 0.35 + rng.random() * max(0.1, d - 0.9)) for _ in range(max(1, int(w // 3)))]
        for i, (sx, sy) in enumerate(spots):
            kind = i % 3
            if kind == 0:
                objs.append(common.box(f"{name}-mat{i}", (0.8, 0.5, 0.01), B(sx + 0.4, sy + 0.25, z + 0.006), M.straw("#b59d6a"), None))
                for k in range(14):
                    objs.append(self._ellipsoid(f"{name}-fig{i}-{k}", B(sx + 0.1 + rng.random() * 0.6, sy + 0.08 + rng.random() * 0.34, z + 0.02), (0.03, 0.03, 0.018), M.plain("#5a3a32", 0.6)))
            elif kind == 1:
                objs += self._jar_group(f"{name}-roofjars{i}", sx, sy, z, rng, count=2)
        return objs

    def _doorway(self, name, dx, ground_y, height, frame=None):
        """A dark doorway with a timber lintel and a door leaf standing open."""
        inner = common.box(f"{name}-dark", (0.8, 0.3, height), B(dx + 0.5, ground_y - 0.16, height / 2), self.dark, None)
        lintel = common.box(f"{name}-lintel", (1.0, 0.12, 0.14), B(dx + 0.5, ground_y + 0.02, height + 0.07), self.wood, None, bevel=0.01)
        sill = common.box(f"{name}-sill", (0.9, 0.2, 0.04), B(dx + 0.5, ground_y - 0.02, 0.02), frame or self.paving, None, bevel=0.01)
        leaf = common.box(f"{name}-leaf", (0.07, 0.62, height - 0.08), B(dx + 0.15, ground_y - 0.32, (height - 0.08) / 2), self.wood, None, bevel=0.006)
        for o in (lintel, leaf):
            common.bake_modifiers(o)
        self._rand_attr(sill, 0.5)
        return [inner, lintel, sill, leaf]

    def _window(self, name, x0, x1, ground_y, z0, z1, sill_mat=None):
        w = x1 - x0
        objs = [common.box(f"{name}-dark", (w, 0.2, z1 - z0), B((x0 + x1) / 2, ground_y - 0.08, (z0 + z1) / 2), self.dark, None)]
        for k in range(3):
            objs.append(common.box(f"{name}-bar{k}", (0.025, 0.03, z1 - z0), B(x0 + w * (k + 1) / 4, ground_y + 0.01, (z0 + z1) / 2), self.wood, None))
        sill = common.box(f"{name}-sill", (w + 0.12, 0.08, 0.05), B((x0 + x1) / 2, ground_y + 0.03, z0 - 0.02), sill_mat or self.limestone, None)
        self._rand_attr(sill, 0.4)
        objs.append(sill)
        return objs

    # ── gates and dry-stone walls ───────────────────────────────────────────
    def tile_gate(self):
        """A gateway: the city gate's piers and leaf (city), or a timber gate
        in a courtyard wall (oasis)."""
        gates = self.map.tiles("gate")
        if not gates:
            return
        if self.style == "oasis":
            for x, y in gates:
                self.courtyard_gate(x, y)
            return
        self.sprite("gate", max(g[1] for g in gates) + 2, self._gate("gate", gates), gates)

    def _gate(self, name, gates):
        objs = []
        x = gates[0][0]
        ys = sorted(g[1] for g in gates)
        top, bottom = ys[0], ys[-1] + 1
        for py in (top - 0.15, bottom + 0.15):
            objs.append(self._ashlar_face(f"{name}-pier{py:.1f}", x - 0.1, x + 1.0, py + 0.3, 2.2, self.rng, [], depth=0.3))
        leaf = common.box(f"{name}-leaf", (0.08, 0.9, 1.9), B(x + 0.8, top + 0.55, 0.95), self.wood, None, bevel=0.01)
        common.bake_modifiers(leaf)
        objs.append(leaf)
        return objs

    def tile_fence(self):
        """A low field wall: dry stone (city, wilderness) or a wattle fence of
        palm ribs and reeds on posts (oasis). One sprite per horizontal run,
        so it sorts by its own row."""
        for x0, x1, y in self.map.runs("fence"):
            name = f"fence-{x0}-{y}"
            objs = self.wattle(name, x0, x1, y) if self.style == "oasis" else self._drystone(name, x0, x1, y)
            self.sprite(name, y + 0.75, objs, [(x, y) for x in range(x0, x1)])

    def _drystone(self, name, x0, x1, y):
        rng = self.rng
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        for course in range(3):
            x = x0 + (rng.random() * 0.2 if course % 2 else 0.0)
            while x < x1 - 0.05:
                size = 0.18 + rng.random() * 0.14
                sph = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
                r = rng.random()
                cz = 0.1 + course * 0.14
                base = self.P(x + size * 0.5, y + 0.5, cz)
                for v in sph["verts"]:
                    nn = math.sin(v.co.x * 5 + x * 7) * 0.1 + math.sin(v.co.z * 6 + course) * 0.08
                    v.co = Vector((v.co.x * size * 0.6 * (1 + nn), v.co.y * 0.16 * (1 + nn), v.co.z * 0.085 * (1 + nn))) + base
                for f in bm.faces:
                    if f.verts[0] in sph["verts"]:
                        f[layer] = r
                x += size * 1.05
        return [common.mesh_object(name, bm, self.limestone, None)]
