"""Roman building parts for the Roman kit (kit_roman.py): terracotta tile
roofs, the Ionic order (column and entablature), house fronts, doors and
windows."""
import math

import bmesh
from mathutils import Matrix, Vector

import common
import materials as M
import roman_materials as R
from roman_geom import B, wall_pieces


class RomanArchitecture:
    # ── terracotta roofs ────────────────────────────────────────────────────
    def _tile_roof(self, name, x0, x1, y_eave, z_eave, y_ridge, z_ridge, antefix=True, ridge=True):
        """A pitched roof of fired tiles from the eave line (map row y_eave,
        height z_eave) up to the ridge (y_ridge, z_ridge): flat tegulae in
        overlapping courses, each joint covered by a row of half-round
        imbrices, an antefix standing at the eave end of every imbrex row,
        ridge tiles along the top, and a timber deck beneath (no gaps)."""
        rng = self.rng
        objs = []
        d = Vector((0.0, y_eave - y_ridge, z_ridge - z_eave))
        length = d.length
        d.normalize()
        X = Vector((1.0, 0.0, 0.0))
        nrm = X.cross(d)
        origin = Vector((0.0, -y_eave, z_eave))
        width = x1 - x0
        cols = max(1, int(round(width / 0.44)))
        pitch = width / cols
        L, lap = 0.5, 0.11
        step = L - lap
        courses = int(length / step) + 1
        teg, tl = self._rbm()
        imb, il = self._rbm()

        def at(u, v, w):
            return origin + X * u + d * v + nrm * w

        t = 0.022
        for c in range(courses):
            v0 = c * step - 0.04
            v1 = min(length + 0.02, v0 + L)
            if v1 <= v0 + 0.05:
                continue
            for k in range(cols):
                u0 = x0 + k * pitch + 0.012
                u1 = x0 + (k + 1) * pitch - 0.012
                jit = (rng.random() - 0.5) * 0.012
                lift = t * 1.1 + (rng.random() - 0.5) * 0.006
                # Lower end resting on the course below, upper end on the deck.
                corners = [(u0, v0, lift), (u1, v0, lift + jit), (u1, v1, 0.0), (u0, v1, 0.0)]
                top = [teg.verts.new(at(u, v, w + t)) for u, v, w in corners]
                bot = [teg.verts.new(at(u, v, w)) for u, v, w in corners]
                r = rng.random()
                fs = [teg.faces.new(top), teg.faces.new(bot[::-1])]
                for i in range(4):
                    j = (i + 1) % 4
                    fs.append(teg.faces.new((bot[i], bot[j], top[j], top[i])))
                for f in fs:
                    f[tl] = r
            # Imbrices over every joint (and the two verges).
            for k in range(cols + 1):
                u = x0 + k * pitch
                r = rng.random()
                seg = 7
                ra, rb = 0.075, 0.062
                va, vb = v0 + 0.01, min(length + 0.06, v0 + L + 0.02)
                h = t + 0.03 + (rng.random() - 0.5) * 0.008
                wob = (rng.random() - 0.5) * 0.02
                outer, inner = [], []
                for vv, rr in ((va, ra), (vb, rb)):
                    outer.append([imb.verts.new(at(u + wob + math.cos(math.pi * s / seg) * rr, vv, h + math.sin(math.pi * s / seg) * rr * 0.9)) for s in range(seg + 1)])
                    inner.append([imb.verts.new(at(u + wob + math.cos(math.pi * s / seg) * (rr - 0.014), vv, h + math.sin(math.pi * s / seg) * (rr - 0.014) * 0.9)) for s in range(seg + 1)])
                fs = []
                for s in range(seg):
                    fs.append(imb.faces.new((outer[0][s + 1], outer[0][s], outer[1][s], outer[1][s + 1])))
                    # The open lower end shows the tile's thickness.
                    fs.append(imb.faces.new((inner[0][s], inner[0][s + 1], outer[0][s + 1], outer[0][s])))
                for f in fs:
                    f[il] = r
                if antefix and c == 0:
                    self._antefix(imb, il, at(u + wob, va - 0.005, h + ra * 0.4), rng)
        objs.append(self._obj(f"{name}-tegulae", teg, self._mat("roof")))
        objs.append(self._obj(f"{name}-imbrices", imb, self._mat("roof"), smooth=True))
        deck = bmesh.new()
        v = [deck.verts.new(at(u, vv, -0.01)) for u, vv in ((x0 - 0.03, -0.05), (x1 + 0.03, -0.05), (x1 + 0.03, length + 0.05), (x0 - 0.03, length + 0.05))]
        deck.faces.new(v)
        objs.append(self._obj(f"{name}-deck", deck, self._mat("timber")))
        if ridge:
            rbm, rl = self._rbm()
            top = origin + d * length
            n = int(width / 0.42) + 1
            for k in range(n):
                u0 = x0 + k * width / n
                u1 = u0 + width / n + 0.05
                ring_a, ring_b = [], []
                for s in range(9):
                    ang = math.pi * s / 8
                    off = Vector((0.0, math.cos(ang) * 0.1, math.sin(ang) * 0.09 + 0.03))
                    ring_a.append(rbm.verts.new(top + X * u0 + off))
                    ring_b.append(rbm.verts.new(top + X * u1 + off * 0.9))
                r = rng.random()
                for s in range(8):
                    f = rbm.faces.new((ring_a[s], ring_a[s + 1], ring_b[s + 1], ring_b[s]))
                    f[rl] = r
            objs.append(self._obj(f"{name}-ridge", rbm, self._mat("roof"), smooth=True))
        return objs

    def _antefix(self, bm, layer, base, rng):
        """A terracotta antefix: a palmette plaque standing at a tile row's end."""
        pts = []
        for k in range(15):
            a = math.pi * k / 14
            r = 0.058 + 0.018 * abs(math.cos(a * 3.5))
            pts.append((math.cos(a) * r, 0.04 + math.sin(a) * r))
        outline = [(-0.04, 0.0), (0.04, 0.0)] + pts
        front = [bm.verts.new(base + Vector((x, -0.012, z))) for x, z in outline]
        backv = [bm.verts.new(base + Vector((x, 0.006, z))) for x, z in outline]
        r = rng.random()
        fs = [bm.faces.new(front), bm.faces.new(backv[::-1])]
        n = len(outline)
        for i in range(n):
            j = (i + 1) % n
            fs.append(bm.faces.new((front[j], front[i], backv[i], backv[j])))
        for f in fs:
            f[layer] = r

    # ── the Ionic order ─────────────────────────────────────────────────────
    def _cylinder(self, bm, a, b, r, seg=16):
        """A capped cylinder from point a to point b (Blender)."""
        d = b - a
        side = d.orthogonal().normalized()
        up = d.normalized().cross(side).normalized()
        ra = [bm.verts.new(a + (side * math.cos(math.tau * k / seg) + up * math.sin(math.tau * k / seg)) * r) for k in range(seg)]
        rb = [bm.verts.new(b + (side * math.cos(math.tau * k / seg) + up * math.sin(math.tau * k / seg)) * r) for k in range(seg)]
        for k in range(seg):
            kk = (k + 1) % seg
            bm.faces.new((ra[k], ra[kk], rb[kk], rb[k]))
        bm.faces.new(ra[::-1])
        bm.faces.new(rb)

    def _ionic_column(self, name, cx, cy, shaft_h, r=0.17, painted=None, z0=0.0, cut_top=False):
        """An Ionic column standing at map point (cx, cy), its foot z0 above
        the ground: a square plinth, an Attic base (torus, scotia, torus), a
        fluted shaft with a gentle entasis and a flare at each end, and a
        capital: an echinus carved with eggs, a volute rolled up at each end
        of a bolster on the front and the back, a thin abacus. `painted` =
        (colour, height): the lower shaft left unfluted and painted, as in
        houses of the period. `cut_top`: the column stands in a room seen in
        cutaway, under its invisible roof: the top of the abacus is a cut
        section and glows faintly, as the cut tops of the walls do (no light
        reaches it). Returns (objects, height of its top)."""
        mat = self._mat("marble")
        objs = []
        base = self.P(cx, cy, z0)
        bm, layer = self._rbm()
        self._cbox(bm, layer, cx - r * 1.35, cy - r * 1.35, cx + r * 1.35, cy + r * 1.35, z0, z0 + r * 0.42, chamfer=0.01)
        objs.append(self._obj(f"{name}-plinth", bm, mat))
        zb = r * 0.42
        prof = [(r * 1.26, 0.0), (r * 1.3, r * 0.08), (r * 1.24, r * 0.16), (r * 1.1, r * 0.2), (r * 1.02, r * 0.26), (r * 1.08, r * 0.32), (r * 1.14, r * 0.36), (r * 1.1, r * 0.43), (r * 1.02, r * 0.47)]
        objs.append(self._lathe(f"{name}-base", [(a, b + zb) for a, b in prof], base, mat, 40))
        z_shaft = zb + r * 0.47
        flutes, per = 20, 6
        seg = flutes * per
        rings_n = 26
        sb = bmesh.new()
        rings = []
        plain_h = painted[1] if painted else 0.0
        for i in range(rings_n + 1):
            f = i / rings_n
            z = z_shaft + shaft_h * f
            rr0 = r * (1.0 + 0.018 * math.sin(math.pi * min(1.0, f * 1.4)) - 0.13 * f)
            rr0 *= 1 + 0.1 * max(0.0, 1 - f / 0.035) + 0.07 * max(0.0, (f - 0.975) / 0.025)
            fluted = z > plain_h + 0.02 and 0.035 < f < 0.97
            ring = []
            for s in range(seg):
                th = math.tau * s / seg
                tt = (s % per) / per
                depth = 0.0
                if fluted and 0.15 < tt < 0.85:
                    depth = 0.07 * math.sqrt(max(0.0, 1 - ((tt - 0.5) / 0.35) ** 2))
                rr = rr0 * (1 - depth)
                ring.append(sb.verts.new(base + Vector((math.cos(th) * rr, math.sin(th) * rr, z))))
            rings.append(ring)
        for a, b in zip(rings, rings[1:]):
            for s in range(seg):
                ss = (s + 1) % seg
                sb.faces.new((a[s], a[ss], b[ss], b[s]))
        shaft = self._obj(f"{name}-shaft", sb, mat, smooth=True)
        if painted:
            # The unfluted lower shaft painted (a second material below).
            low = R.stucco(painted[0], f"column-paint-{painted[0]}", flaked=0.05, streaks=0.05, grime=0.4)
            shaft.data.materials.append(low)
            for p in shaft.data.polygons:
                zc = sum(shaft.data.vertices[v].co.z for v in p.vertices) / len(p.vertices)
                if zc - base.z < plain_h + 0.01:
                    p.material_index = 1
        objs.append(shaft)
        top = z_shaft + shaft_h
        rt = r * 0.87
        objs.append(self._lathe(f"{name}-astragal", [(rt * 1.04, top), (rt * 1.1, top + 0.012), (rt * 1.04, top + 0.024)], base, mat, 40))
        objs.append(self._lathe(f"{name}-echinus", [(rt * 1.02, top + 0.024), (rt * 1.22, top + 0.05), (rt * 1.3, top + 0.08), (rt * 1.26, top + 0.1)], base, mat, 40))
        eggs = bmesh.new()
        for k in range(12):
            a = math.tau * k / 12
            c = base + Vector((math.cos(a) * rt * 1.24, math.sin(a) * rt * 1.24, top + 0.064))
            sph = bmesh.ops.create_uvsphere(eggs, u_segments=8, v_segments=6, radius=1.0)
            for v in sph["verts"]:
                v.co = Vector((v.co.x * 0.03, v.co.y * 0.03, v.co.z * 0.034)) + c
        objs.append(self._obj(f"{name}-eggs", eggs, mat, smooth=True))
        # Volutes: a bolster on each side running front to back, its ends
        # rolled into spirals facing front and back, joined by the canalis.
        vol = rt * 0.52
        cz = top + 0.1 - vol * 0.95
        vb = bmesh.new()
        depth = rt * 1.02
        for side in (-1, 1):
            vx = side * rt * 1.2
            self._cylinder(vb, base + Vector((vx, -depth, cz)), base + Vector((vx, depth, cz)), vol, 20)
            for fy in (-1, 1):
                pts = []
                turns, n = 2.3, 72
                for k in range(n + 1):
                    t_ = k / n
                    ph = math.pi / 2 - side * t_ * turns * math.tau
                    rr = vol * (0.98 - 0.8 * t_)
                    pts.append(base + Vector((vx + math.cos(ph) * rr, fy * (depth + 0.006), cz + math.sin(ph) * rr)))
                self._tube(vb, pts, [0.016 * (1 - 0.55 * k / n) + 0.004 for k in range(n + 1)], seg=6)
                eye = bmesh.ops.create_uvsphere(vb, u_segments=8, v_segments=6, radius=1.0)
                for v in eye["verts"]:
                    v.co = Vector((v.co.x * 0.02, v.co.y * 0.012, v.co.z * 0.02)) + base + Vector((vx, fy * (depth + 0.008), cz))
            _ = side
        for fy in (-1, 1):
            self._tube(vb, [base + Vector((-rt * 1.2, fy * (depth + 0.004), cz + vol - 0.012)), base + Vector((rt * 1.2, fy * (depth + 0.004), cz + vol - 0.012))], 0.018, seg=6)
        objs.append(self._obj(f"{name}-volutes", vb, mat, smooth=True))
        ab = bmesh.new()
        self._cbox(ab, None, cx - rt * 1.4, cy - rt * 1.12, cx + rt * 1.4, cy + rt * 1.12, z0 + top + 0.1, z0 + top + 0.15, chamfer=0.012)
        objs.append(self._obj(f"{name}-abacus", ab, M.limestone("#cfc6b2", "abacus-cut", worn=0.3, glow=0.05) if cut_top else mat))
        return objs, top + 0.15

    def _entablature(self, name, a, b, fixed, axis, z0, depth=0.34, frieze=None, mat=None):
        """Architrave (three fasciae), frieze and a cornice with dentils,
        carried from a to b along `axis` ("x": along a row at map y `fixed`;
        "y": along a column at map x `fixed`), starting at height z0.
        Returns (objects, height of its top)."""
        mat = mat or self._mat("marble")
        fmat = frieze or mat
        bm, layer = self._rbm()
        fb, fl = self._rbm()

        def box(target, lay, lo, hi, z_lo, z_hi, half, ch=0.006):
            if axis == "x":
                self._cbox(target, lay, lo, fixed - half, hi, fixed + half, z_lo, z_hi, chamfer=ch, r=0.5)
            else:
                self._cbox(target, lay, fixed - half, lo, fixed + half, hi, z_lo, z_hi, chamfer=ch, r=0.5)

        z = z0
        h = depth / 2
        for k, hh in enumerate((0.075, 0.08, 0.09)):
            box(bm, layer, a, b, z, z + hh, h * (0.86 + 0.07 * k))
            z += hh
        box(bm, layer, a, b, z, z + 0.035, h * 1.12)
        z += 0.035
        box(fb, fl, a, b, z, z + 0.17, h * 0.95)
        z += 0.17
        n = max(1, int((b - a) / 0.075))
        for k in range(n):
            u = a + (k + 0.25) * (b - a) / n
            box(bm, layer, u, u + (b - a) / n * 0.55, z, z + 0.055, h * 1.2, ch=0.003)
        box(bm, layer, a, b, z, z + 0.055, h * 1.05)
        z += 0.055
        box(bm, layer, a - 0.05, b + 0.05, z, z + 0.06, h * 1.55)
        z += 0.06
        box(bm, layer, a - 0.06, b + 0.06, z, z + 0.045, h * 1.45, ch=0.015)
        z += 0.045
        return [self._obj(f"{name}-beam", bm, mat), self._obj(f"{name}-frieze", fb, fmat)], z

    # ── house fronts ────────────────────────────────────────────────────────
    def _front(self, name, x0, x1, y_face, height, mat, openings, depth=0.45, back=-1.5, cornice=True):
        """A town house's street wall on the line y_face (map), x0 to x1,
        `height` tall, holes for `openings` [(x0, x1, z0, z1)], the
        building's mass behind it, and a moulded stucco cornice under the
        eaves. Returns objects."""
        objs = []
        bm, layer = self._rbm()
        for a, b, c, d in wall_pieces(x0, x1, 0.0, height, openings):
            self._cbox(bm, layer, a, y_face - depth, b, y_face, c, d, chamfer=0.004, r=0.5, point=B)
        objs.append(self._obj(f"{name}-front", bm, mat))
        objs.append(common.box(f"{name}-mass", (x1 - x0, y_face - depth - back, height), B((x0 + x1) / 2, (back + y_face - depth) / 2, height / 2), mat, None))
        for ox0, ox1, oz0, oz1 in openings:
            # Darkness inside every opening.
            objs.append(common.box(f"{name}-in{ox0:.2f}", (ox1 - ox0, 0.1, oz1 - oz0), B((ox0 + ox1) / 2, y_face - depth + 0.05, (oz0 + oz1) / 2), self._mat("dark"), None))
        if cornice:
            cb, cl = self._rbm()
            z = height - 0.15
            for hh, out in ((0.05, 0.04), (0.045, 0.08), (0.055, 0.12)):
                self._cbox(cb, cl, x0 - 0.02, y_face - 0.02, x1 + 0.02, y_face + out, z, z + hh, chamfer=0.01, r=0.4, point=B)
                z += hh
            objs.append(self._obj(f"{name}-cornice", cb, self._mat("cornice")))
        return objs

    def _door(self, name, x0, x1, y_face, h, depth=0.45, leaves=1, open_=0.0):
        """A doorway in a wall face: a stone threshold and a timber lintel;
        plank door leaves with iron nails and a ring handle, closed or
        standing open inward by `open_` (0-1)."""
        objs = []
        wood = self._mat("door")
        bm, layer = self._rbm()
        self._cbox(bm, layer, x0 - 0.06, y_face - depth, x1 + 0.06, y_face + 0.1, 0.0, 0.06, chamfer=0.01, point=B)
        objs.append(self._obj(f"{name}-sill", bm, self._mat("ashlar")))
        objs.append(common.box(f"{name}-lintel", (x1 - x0 + 0.24, 0.14, 0.16), B((x0 + x1) / 2, y_face - 0.02, h + 0.08), self._mat("timber"), None))
        w = (x1 - x0) / leaves
        mid_y = -(y_face - depth * 0.5)
        for k in range(leaves):
            lx0 = x0 + k * w
            hinge_left = k == 0
            leaf = bmesh.new()
            planks = max(2, int(w / 0.14))
            for p in range(planks):
                u0 = p * w / planks + 0.004
                u1 = (p + 1) * w / planks - 0.004
                corners = [(u0, 0.07), (u1, 0.07), (u1, h - 0.01), (u0, h - 0.01)]
                front = [leaf.verts.new(Vector((u, -0.02, z))) for u, z in corners]
                rear = [leaf.verts.new(Vector((u, 0.03, z))) for u, z in corners]
                leaf.faces.new(front[::-1])
                leaf.faces.new(rear)
                for i in range(4):
                    j = (i + 1) % 4
                    leaf.faces.new((front[i], front[j], rear[j], rear[i]))
            for zz in (0.35, h - 0.35):
                vs = [leaf.verts.new(Vector((u, -0.028, z))) for u, z in ((0.02, zz), (w - 0.02, zz), (w - 0.02, zz + 0.09), (0.02, zz + 0.09))]
                leaf.faces.new(vs[::-1])
            ang = open_ * 1.3 * (1 if hinge_left else -1)
            pivot = Vector((lx0 if hinge_left else lx0 + w, mid_y, 0.0))
            m = Matrix.Translation(pivot) @ Matrix.Rotation(ang, 4, "Z") @ Matrix.Translation(Vector((0.0 if hinge_left else -w, 0.0, 0.0)))
            bmesh.ops.transform(leaf, matrix=m, verts=leaf.verts)
            objs.append(self._obj(f"{name}-leaf{k}", leaf, wood))
            if open_ < 0.2:
                nails = bmesh.new()
                for zz in (0.395, h - 0.305):
                    for q in range(3):
                        c = Vector((lx0 + w * (q + 0.5) / 3, mid_y - 0.034, zz))
                        s = bmesh.ops.create_uvsphere(nails, u_segments=6, v_segments=4, radius=0.012)
                        bmesh.ops.translate(nails, vec=c, verts=s["verts"])
                ring_c = Vector((lx0 + (w - 0.12 if hinge_left else 0.12), mid_y - 0.04, h * 0.52))
                ring = bmesh.ops.create_circle(nails, cap_ends=False, segments=12, radius=0.045)
                for v in ring["verts"]:
                    v.co = Vector((v.co.x, 0.0, v.co.y)) + ring_c
                pts = [ring_c + Vector((math.cos(math.tau * k2 / 12) * 0.045, 0.0, math.sin(math.tau * k2 / 12) * 0.045)) for k2 in range(13)]
                self._tube(nails, pts, 0.007, seg=5)
                objs.append(self._obj(f"{name}-iron{k}", nails, self._mat("iron"), smooth=True))
        return objs

    def _roman_window(self, name, x0, x1, y_face, z0, z1, kind="grille"):
        """A small window: a stone sill and a wooden grille (or a pair of
        shutters standing half open)."""
        objs = []
        bm, layer = self._rbm()
        self._cbox(bm, layer, x0 - 0.05, y_face - 0.1, x1 + 0.05, y_face + 0.06, z0 - 0.05, z0, chamfer=0.01, point=B)
        objs.append(self._obj(f"{name}-sill", bm, self._mat("ashlar")))
        wood = self._mat("timber")
        if kind == "grille":
            n = max(2, int((x1 - x0) / 0.1))
            for k in range(1, n):
                objs.append(common.box(f"{name}-bar{k}", (0.025, 0.03, z1 - z0), B(x0 + (x1 - x0) * k / n, y_face - 0.08, (z0 + z1) / 2), wood, None))
            objs.append(common.box(f"{name}-rail", (x1 - x0, 0.03, 0.025), B((x0 + x1) / 2, y_face - 0.08, (z0 + z1) / 2), wood, None))
        else:
            for side in (-1, 1):
                sh = common.box(f"{name}-shutter{side}", ((x1 - x0) / 2, 0.025, z1 - z0), Vector((0, 0, 0)), wood, None)
                hinge = x0 if side < 0 else x1
                sh.location = B(hinge + side * (x1 - x0) * 0.17, y_face + 0.12, (z0 + z1) / 2)
                sh.rotation_euler = (0, 0, -side * 1.05)
                objs.append(sh)
        return objs
