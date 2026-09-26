"""Plants: olive trees, date palms, fig trees, desert thornbushes, reeds at
the water's edge and irrigated crops. Each tree or bush is a sprite sorted
by the foot of its trunk."""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import common
import materials as M
import scatter


class PlantsKit:
    # ── olive ───────────────────────────────────────────────────────────────
    def tile_olive(self):
        """An old olive tree: a gnarled, split trunk with a flared base, a few
        crooked limbs, and a loose crown of silver-green leaves."""
        for x, y in self.map.tiles("olive"):
            self.sprite(f"olive-{x}-{y}", y + 0.62, self._olive(f"olive-{x}-{y}", x, y), [(x, y)])

    def _olive(self, name, x, y):
        rng = self.rng
        objs = []
        base = self.P(x + 0.5, y + 0.58)
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
            for l in range(2):
                la = ang + (l - 0.5) * 1.4 + (rng.random() - 0.5) * 0.6
                end = pts[-1] + Vector((math.cos(la) * 0.45, math.sin(la) * 0.35, 0.25 + rng.random() * 0.2))
                objs.append(self._branch(f"{name}-limb{sidx}{l}", pts[-2], end, 0.045, 0.015, bark))
                tips.append(end)
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

    # ── date palm ───────────────────────────────────────────────────────────
    def tile_palm(self):
        """A date palm: a tall, slightly leaning trunk ringed with old leaf
        bases, a crown of arching feathered fronds (the oldest drooping and
        dry), a skirt of dead fronds and hanging bunches of ripening dates."""
        for x, y in self.map.tiles("palm"):
            trunk, crown = self.date_palm(f"palm-{x}-{y}", x, y)
            self.sprite(f"palm-{x}-{y}", y + 0.6, trunk, [(x, y)])
            self.sprite(f"palm-{x}-{y}-crown", y + 0.6, crown, [(x, y)], fade=True)

    def date_palm(self, name, x, y):
        rng = self.rng
        objs = []
        base = self.P(x + 0.5, y + 0.55)
        height = 2.5 + rng.random() * 1.1
        lean_a = rng.random() * math.tau
        lean = 0.12 + rng.random() * 0.22
        trunk_mat = M.palm_trunk("#6e5a44")
        # The trunk: a tube with a gentle curve, knobbly with leaf-base rings.
        n = 40
        seg = 14
        pts = []
        for k in range(n + 1):
            t = k / n
            off = Vector((math.cos(lean_a), math.sin(lean_a) * 0.6, 0)) * lean * (t**1.6) * height * 0.35
            pts.append(base + off + Vector((0, 0, t * height)))
        bm = bmesh.new()
        rings = []
        for k, c in enumerate(pts):
            t = k / n
            r = 0.2 - 0.05 * t + (0.07 if k == 0 else 0.0) + (0.03 if k == 1 else 0.0)
            knob = 1 + 0.08 * math.sin(k * 2.7) ** 2
            ring = []
            for j in range(seg):
                a = math.tau * j / seg
                wob = 1 + 0.05 * math.sin(a * 3 + k * 1.3)
                ring.append(bm.verts.new(c + Vector((math.cos(a) * r * knob * wob, math.sin(a) * r * knob * wob, 0))))
            rings.append(ring)
        for a_, b_ in zip(rings, rings[1:]):
            for j in range(seg):
                jj = (j + 1) % seg
                bm.faces.new((a_[j], a_[jj], b_[jj], b_[j]))
        trunk_objs = [common.mesh_object(f"{name}-trunk", bm, trunk_mat, None)]
        top = pts[-1]
        # Fronds: rachis + leaflets, green and dry by age.
        frond_mat = M.frond("#5c6c38", "#a38f58")
        rach_mat = M.plain("#8a7a50", 0.7)
        fbm = bmesh.new()
        rnd = fbm.faces.layers.float.new("rand")
        count = 22 + int(rng.random() * 8)
        for f in range(count):
            az = f * 2.39996 + rng.random() * 0.2  # golden angle
            age = rng.random()
            elev = math.radians(60 - age * 105)
            length = 1.05 + rng.random() * 0.45 - (0.2 if age < 0.2 else 0)
            self._frond(fbm, rnd, top + Vector((0, 0, -0.05)), az, elev, length, age, rng)
        crown = common.mesh_object(f"{name}-fronds", fbm, frond_mat, None)
        objs.append(crown)
        # The heart of the crown and the skirt of dead fronds under it.
        objs.append(self._ellipsoid(f"{name}-heart", top + Vector((0, 0, -0.08)), (0.26, 0.26, 0.22), trunk_mat, 14, 8))
        skirt = bmesh.new()
        for k in range(14):
            a = k * math.tau / 14 + rng.random() * 0.2
            p0 = top + Vector((math.cos(a) * 0.18, math.sin(a) * 0.18, -0.12))
            p1 = p0 + Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, -0.9 - rng.random() * 0.3))
            side = Vector((-math.sin(a), math.cos(a), 0)) * 0.05
            v = [skirt.verts.new(p0 - side), skirt.verts.new(p0 + side), skirt.verts.new(p1 + side * 1.6), skirt.verts.new(p1 - side * 1.6)]
            skirt.faces.new(v)
        sk = common.mesh_object(f"{name}-skirt", skirt, M.thatch("#7a6440", "palm-skirt"), None)
        common.add_modifier(sk, "SOLIDIFY", thickness=0.01)
        objs.append(sk)
        # Date bunches: strands of orange-brown fruit hanging below the crown.
        date_mat = M.plain("#b0602a", 0.4, 0.5)
        stalk = M.plain("#c29a4a", 0.7)
        for b in range(2 + int(rng.random() * 3)):
            a = rng.random() * math.tau
            p0 = top + Vector((math.cos(a) * 0.22, math.sin(a) * 0.22, -0.1))
            p1 = p0 + Vector((math.cos(a) * 0.35, math.sin(a) * 0.35, -0.55))
            objs.append(self._branch(f"{name}-stalk{b}", p0, p1, 0.02, 0.015, stalk, 5))
            cl = bmesh.new()
            for d in range(60):
                t = rng.random()
                q = p0.lerp(p1, 0.55 + t * 0.45) + Vector(((rng.random() - 0.5) * 0.14, (rng.random() - 0.5) * 0.14, (rng.random() - 0.5) * 0.2))
                sph = bmesh.ops.create_uvsphere(cl, u_segments=6, v_segments=4, radius=1.0)
                for v in sph["verts"]:
                    v.co = Vector((v.co.x * 0.018, v.co.y * 0.018, v.co.z * 0.028)) + q
            objs.append(common.mesh_object(f"{name}-dates{b}", cl, date_mat, None))
        return trunk_objs, objs

    def _frond(self, bm, rnd, start, az, elev, length, age, rng, droop=None, spread=1.0):
        """One palm frond into `bm`: a curved midrib with V-set leaflets.
        `droop` (radians over the length) defaults by age; `spread` scales
        how far the leaflets reach."""
        steps = 16
        pts = []
        dirs = []
        droop = 0.9 + age * 1.4 if droop is None else droop
        for k in range(steps + 1):
            t = k / steps
            e = elev - droop * t * t
            d = Vector((math.cos(az) * math.cos(e), math.sin(az) * math.cos(e), math.sin(e)))
            if k == 0:
                p = start.copy()
            else:
                p = pts[-1] + dirs[-1] * (length / steps)
            pts.append(p)
            dirs.append(d)
        r = age * 0.7 + rng.random() * 0.3
        side = Vector((-math.sin(az), math.cos(az), 0))
        # Midrib as a thin strip.
        for k in range(steps):
            w = 0.022 * (1 - k / steps) + 0.006
            a, b = pts[k], pts[k + 1]
            v = [bm.verts.new(a - side * w), bm.verts.new(a + side * w), bm.verts.new(b + side * w * 0.8), bm.verts.new(b - side * w * 0.8)]
            f = bm.faces.new(v)
            f[rnd] = min(1.0, r + 0.3)
        # Leaflets along the outer 85%.
        for k in range(2, steps):
            t = k / steps
            p = pts[k]
            d = dirs[k]
            nrm = d.cross(side).normalized()
            for s in (-1, 1):
                for sub in range(3):
                    tt = t + sub / (3 * steps)
                    q = pts[k] + dirs[k] * (sub / 3) * (length / steps)
                    ll = (0.28 + 0.12 * math.sin(math.pi * tt)) * (1.0 - 0.45 * tt) * spread
                    vdir = (side * s * 0.8 + nrm * 0.45 + d * 0.35).normalized()
                    tip = q + vdir * ll + Vector((0, 0, -0.04 * ll * (1 + age)))
                    wv = d * 0.018
                    v = [bm.verts.new(q - wv), bm.verts.new(q + wv), bm.verts.new(tip + wv * 0.2), bm.verts.new(tip - wv * 0.2)]
                    f = bm.faces.new(v)
                    f[rnd] = min(1.0, r + rng.random() * 0.1)
        _ = p

    # ── fig ─────────────────────────────────────────────────────────────────
    def tile_fig(self):
        """A fig tree: smooth pale-grey limbs from a short trunk and a dense,
        spreading crown of large lobed leaves."""
        for x, y in self.map.tiles("fig"):
            objs = self.fig_tree(f"fig-{x}-{y}", x, y)
            crown = [o for o in objs if o.name.endswith("-crown")]
            self.sprite(f"fig-{x}-{y}", y + 0.62, [o for o in objs if o not in crown], [(x, y)])
            self.sprite(f"fig-{x}-{y}-crown", y + 0.62, crown, [(x, y)], fade=True)

    def _fig_leaves(self):
        lib = self._library()
        if "figleaves" in lib:
            return lib["figleaves"]
        col = bpy.data.collections.new("figleaves")
        bpy.data.collections["library"].children.link(col)
        mat = M.leaf("#5a7434", "#98a86a")
        for t in range(3):
            bm = bmesh.new()
            L = 0.16 + t * 0.02
            pts = []
            for k in range(15):
                a = math.pi * k / 14
                lobe = 1 + 0.35 * math.sin(a * 5) ** 2
                pts.append((math.cos(a) * L * 0.5 * lobe, math.sin(a) * L * 0.55 * lobe))
            vs = [bm.verts.new((0, 0, 0))] + [bm.verts.new((x, y, (y / L) ** 2 * 0.03)) for x, y in pts]
            for k in range(1, len(vs) - 1):
                bm.faces.new((vs[0], vs[k], vs[k + 1]))
            obj = common.mesh_object(f"figleaf{t}", bm, mat, None)
            for c in obj.users_collection:
                c.objects.unlink(obj)
            col.objects.link(obj)
        lib["figleaves"] = col
        return col

    def fig_tree(self, name, x, y):
        rng = self.rng
        objs = []
        base = self.P(x + 0.5, y + 0.58)
        bark = M.bark("#8e877a")
        tips = []
        for s in range(3):
            ang = s * math.tau / 3 + rng.random() * 0.6
            end = base + Vector((math.cos(ang) * 0.55, math.sin(ang) * 0.4, 1.05 + rng.random() * 0.35))
            mid = base + Vector((math.cos(ang) * 0.18, math.sin(ang) * 0.14, 0.45))
            objs.append(self._branch(f"{name}-trunk{s}", base + Vector((0, 0, -0.02)), mid, 0.13, 0.09, bark, 10))
            objs.append(self._branch(f"{name}-limb{s}", mid, end, 0.09, 0.04, bark, 10))
            tips.append(end)
            for k in range(2):
                la = ang + (k - 0.5) * 1.3
                e2 = end + Vector((math.cos(la) * 0.45, math.sin(la) * 0.35, 0.2 + rng.random() * 0.2))
                objs.append(self._branch(f"{name}-twig{s}{k}", end, e2, 0.04, 0.015, bark, 8))
                tips.append(e2)
        # Leaves in loose clumps at the twig ends: gaps show the limbs.
        bm = bmesh.new()
        for tip in tips:
            for _ in range(3):
                c = tip + Vector(((rng.random() - 0.5) * 0.55, (rng.random() - 0.5) * 0.45, (rng.random() - 0.3) * 0.25))
                sph = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.2 + rng.random() * 0.12)
                for v in sph["verts"]:
                    v.co = Vector((v.co.x * 1.35, v.co.y * 1.2, v.co.z * 0.7)) + c
        crown = common.mesh_object(f"{name}-crown", bm, None, None)
        scatter.scatter(crown, self._fig_leaves(), 260.0, (0.75, 1.25), seed=int(rng.random() * 999), sink=0.08, pick=True)
        objs.append(crown)
        return objs

    # ── bushes, reeds, crops ────────────────────────────────────────────────
    def tile_bush(self):
        """A desert thornbush: a rounded tangle of grey-brown thorny twigs with
        small grey-green leaves (like the thorny jujube and white broom of
        the Judean desert)."""
        for x, y in self.map.tiles("bush"):
            self.sprite(f"bush-{x}-{y}", y + 0.75, self.desert_bush(f"bush-{x}-{y}", x, y), [(x, y)])

    def desert_bush(self, name, x, y, size=1.0):
        """A desert shrub: a loose mound of wiry, forking grey-brown stems
        rising from a woody base, tipped with sparse grey-green leaves and
        spines, so light shows through it."""
        rng = self.rng
        base = self.P(x + 0.5, y + 0.55)
        twig = M.bark("#716452")
        bm = bmesh.new()
        tips = []

        def stem(p0, d, length, r0, depth):
            p1 = p0 + d * length
            dd = p1 - p0
            side = dd.orthogonal().normalized() * r0
            up = dd.cross(side).normalized() * r0
            ring0 = [bm.verts.new(p0 + side * math.cos(k * 2.094) + up * math.sin(k * 2.094)) for k in range(3)]
            ring1 = [bm.verts.new(p1 + (side * math.cos(k * 2.094) + up * math.sin(k * 2.094)) * 0.55) for k in range(3)]
            for k in range(3):
                kk = (k + 1) % 3
                bm.faces.new((ring0[k], ring0[kk], ring1[kk], ring1[k]))
            if depth == 0 or length < 0.06:
                tips.append(p1)
                return
            for _ in range(2 + (rng.random() < 0.4)):
                nd = (d + Vector(((rng.random() - 0.5) * 0.9, (rng.random() - 0.5) * 0.9, rng.random() * 0.4))).normalized()
                stem(p1, nd, length * (0.55 + rng.random() * 0.2), r0 * 0.6, depth - 1)

        for k in range(9):
            a = rng.random() * math.tau
            el = 0.55 + rng.random() * 0.8
            d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el) * 0.85, math.sin(el)))
            stem(base + Vector((math.cos(a) * 0.03, math.sin(a) * 0.03, 0.0)), d, (0.18 + rng.random() * 0.14) * size, 0.012 * size, 2)
        objs = [common.mesh_object(f"{name}-stems", bm, twig, None)]
        leaves = bmesh.new()
        for tip in tips:
            for _ in range(4):
                c = tip + Vector(((rng.random() - 0.5) * 0.08, (rng.random() - 0.5) * 0.08, (rng.random() - 0.4) * 0.06)) * size
                a = rng.random() * math.tau
                ln = (0.025 + rng.random() * 0.02) * size
                d = Vector((math.cos(a), math.sin(a), 0.4 + rng.random())).normalized() * ln
                sd = Vector((-math.sin(a), math.cos(a), 0)) * 0.008 * size
                v = [leaves.verts.new(c - sd), leaves.verts.new(c + sd), leaves.verts.new(c + d + sd * 0.3), leaves.verts.new(c + d - sd * 0.3)]
                leaves.faces.new(v)
        objs.append(common.mesh_object(f"{name}-leaves", leaves, M.leaf("#7c7e5c", "#a6a288"), None))
        return objs

    def tile_reeds(self):
        """Reeds at the water's edge: a dense clump of tall stems and blades,
        green below and straw-coloured above, with feathery plumes."""
        for x, y in self.map.tiles("reeds"):
            self.sprite(f"reeds-{x}-{y}", y + 0.8, self.reed_clump(f"reeds-{x}-{y}", x, y), [(x, y)])

    def reed_clump(self, name, x, y):
        rng = self.rng
        stem = M.grass_blades_green()
        plume = M.plain("#b8a27a", 0.85)
        bm = bmesh.new()
        tops = []
        for k in range(70):
            px = x + 0.1 + rng.random() * 0.8
            py = y + 0.15 + rng.random() * 0.75
            p0 = self.P(px, py, -0.02)
            h = 1.1 + rng.random() * 1.0
            lean = Vector(((rng.random() - 0.5) * 0.25, (rng.random() - 0.5) * 0.2, 1.0)).normalized()
            p1 = p0 + lean * h
            side = Vector((-lean.y, lean.x, 0)).normalized() * 0.008 if abs(lean.x) + abs(lean.y) > 1e-4 else Vector((0.008, 0, 0))
            v = [bm.verts.new(p0 - side), bm.verts.new(p0 + side), bm.verts.new(p1 + side * 0.3), bm.verts.new(p1 - side * 0.3)]
            bm.faces.new(v)
            # A few arching leaf blades.
            for b in range(2):
                a = rng.random() * math.tau
                q0 = p0.lerp(p1, 0.2 + rng.random() * 0.4)
                q1 = q0 + Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 0.12))
                q2 = q1 + Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, -0.12))
                s2 = Vector((-math.sin(a), math.cos(a), 0)) * 0.012
                v = [bm.verts.new(q0 - s2), bm.verts.new(q0 + s2), bm.verts.new(q1 + s2), bm.verts.new(q1 - s2)]
                bm.faces.new(v)
                v = [bm.verts.new(q1 - s2), bm.verts.new(q1 + s2), bm.verts.new(q2 + s2 * 0.2), bm.verts.new(q2 - s2 * 0.2)]
                bm.faces.new(v)
            if rng.random() < 0.45:
                tops.append(p1)
        objs = [common.mesh_object(f"{name}-stems", bm, stem, None)]
        pl = bmesh.new()
        for t in tops:
            sph = bmesh.ops.create_icosphere(pl, subdivisions=1, radius=1.0)
            for v in sph["verts"]:
                v.co = Vector((v.co.x * 0.035, v.co.y * 0.035, v.co.z * 0.12)) + t + Vector((0.02, 0, 0.08))
        if tops:
            objs.append(common.mesh_object(f"{name}-plumes", pl, plume, None))
        return objs

    def tile_crops(self):
        """Irrigated crops in rows: young grain, green and thick, with the
        first ears. One sprite per run."""
        rng = self.rng
        blades = M.grass_blades_green()
        ears = M.plain("#b8a868", 0.7)
        for x0, x1, y in self.map.runs("crops"):
            name = f"crops-{x0}-{y}"
            bm = bmesh.new()
            ebm = bmesh.new()
            for row in range(4):
                ry = y + 0.14 + row * 0.24
                x = x0 + 0.04
                while x < x1 - 0.04:
                    p0 = self.P(x, ry + (rng.random() - 0.5) * 0.06, 0.0)
                    for b in range(5):
                        a = rng.random() * math.tau
                        h = 0.38 + rng.random() * 0.2
                        tip = p0 + Vector((math.cos(a) * 0.08, math.sin(a) * 0.06, h))
                        s = Vector((-math.sin(a), math.cos(a), 0)) * 0.01
                        v = [bm.verts.new(p0 - s), bm.verts.new(p0 + s), bm.verts.new(tip + s * 0.2), bm.verts.new(tip - s * 0.2)]
                        bm.faces.new(v)
                        if b == 0 and rng.random() < 0.5:
                            sph = bmesh.ops.create_icosphere(ebm, subdivisions=1, radius=1.0)
                            for vv in sph["verts"]:
                                vv.co = Vector((vv.co.x * 0.012, vv.co.y * 0.012, vv.co.z * 0.045)) + tip
                    x += 0.05 + rng.random() * 0.03
            objs = [common.mesh_object(f"{name}-blades", bm, blades, None)]
            if ebm.verts:
                objs.append(common.mesh_object(f"{name}-ears", ebm, ears, None))
            else:
                ebm.free()
            self.sprite(name, y + 0.85, objs, [(x, y) for x in range(x0, x1)])

    _ = Matrix
