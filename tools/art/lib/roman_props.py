"""Furniture, vessels and story props for the Roman kit (kit_roman.py):
dye vats and fullers' tubs, amphorae, skeins of wool, milestones, bronze
lampstands, triclinium couches, fountains, tables and hearths, and the
story's props (wool, tablets, letter sheets, a letter bundle, the alum
jars, a mule)."""
import math

import bmesh
from mathutils import Matrix, Vector

import common
import materials as M
import roman_materials as R
import scatter

# Dye in each vat, by position (reds are Ammia's trade).
VAT_DYES = ["madder", "woad", "madder", "purple", "madder", "alum"]


class RomanProps:
    # ── amphorae ────────────────────────────────────────────────────────────
    def amphora(self, name, at, size=1.0, clay="#b87a54", lean=(0.0, 0.0), spin=0.0):
        """A transport amphora (a tall two-handled jar with a spike toe),
        standing with its toe at `at`, leaning by `lean` (radians about x and
        y) and turned by `spin`. Returns objects."""
        s = size
        prof = [(0.004, 0.0), (0.02, 0.01), (0.03, 0.08), (0.06, 0.13), (0.12, 0.24), (0.15, 0.36), (0.155, 0.46), (0.14, 0.55), (0.1, 0.61), (0.052, 0.64), (0.046, 0.74), (0.05, 0.78), (0.062, 0.79), (0.06, 0.81), (0.045, 0.81)]
        prof = [(r * s, z * s) for r, z in prof]
        mat = M.terracotta(clay, 0.55)
        body = common.lathe(f"{name}", prof, 24, mat, None)
        hb = bmesh.new()
        for side in (-1, 1):
            pts = [Vector((side * 0.045 * s, 0, 0.745 * s)), Vector((side * 0.09 * s, 0, 0.775 * s)), Vector((side * 0.125 * s, 0, 0.73 * s)), Vector((side * 0.13 * s, 0, 0.64 * s)), Vector((side * 0.115 * s, 0, 0.575 * s))]
            self._tube(hb, pts, 0.014 * s, seg=6)
        handles = common.mesh_object(f"{name}-handles", hb, mat, None)
        m = Matrix.Translation(at) @ Matrix.Rotation(spin, 4, "Z") @ Matrix.Rotation(lean[0], 4, "X") @ Matrix.Rotation(lean[1], 4, "Y") @ Matrix.Translation(Vector((0, 0, -0.03 * s)))
        for o in (body, handles):
            o.data.transform(m)
        return [body, handles]

    def tile_amphorae(self):
        """Transport amphorae: three or four tall jars leaning together, or
        propped against the wall behind them, toes sunk in the ground."""
        rng = self.rng
        clays = ["#b87a54", "#c08a62", "#a86a48", "#b58a6a", "#9e6444"]
        for x, y in self.map.tiles("amphorae"):
            name = f"amphorae-{x}-{y}"
            wall_behind = self.map.kind(x, y - 1) in ("wall", "tile-roof") or self.map.kind(x, y - 1) == "amphorae"
            objs = []
            n = 3 if rng.random() < 0.6 else 4
            for i in range(n):
                px = x + 0.2 + i * (0.6 / max(1, n - 1)) + (rng.random() - 0.5) * 0.06
                py = y + 0.48 + (rng.random() - 0.5) * 0.14 + (0.12 if i % 2 else 0.0)
                if wall_behind:
                    lean = (-0.2 - rng.random() * 0.08, (rng.random() - 0.5) * 0.1)
                else:
                    lean = ((rng.random() - 0.5) * 0.18, (x + 0.5 - px) * 0.35)
                objs += self.amphora(f"{name}-{i}", self.P(px, py, 0.0), 0.95 + rng.random() * 0.15, clays[int(rng.random() * len(clays))], lean, rng.random() * math.tau)
            self.sprite(name, y + 0.85, objs, [(x, y)])

    # ── skeins of wool ──────────────────────────────────────────────────────
    def skein(self, name, top, color, length=0.5, blotch=0.0, twist=0.0, rng=None):
        """A hank of dyed wool hanging from a pole at `top` (Blender): a
        fat loop of yarn falling double, each leg a bundle of strands
        twisted round each other, the bend at the bottom rounded, the
        whole hank swinging a little. Returns one object."""
        rng = rng or self.rng
        bm = bmesh.new()
        strands = 7
        legs = 0.034
        rb = 0.02
        n = 22
        sway = (rng.random() - 0.5) * 0.04
        path = []
        for i in range(n + 1):
            t = i / n
            if t < 0.42:
                u = t / 0.42
                p = Vector((-legs, 0.0, -length * u))
            elif t < 0.58:
                a = (t - 0.42) / 0.16 * math.pi
                p = Vector((-legs * math.cos(a), -0.012 * math.sin(a), -length - legs * 0.9 * math.sin(a)))
            else:
                u = (t - 0.58) / 0.42
                p = Vector((legs, 0.0, -length * (1 - u)))
            depth = min(1.0, -p.z / length)
            p = p + Vector((sway * depth, 0.0, 0.0))
            path.append(p)
        for k in range(strands):
            ph = math.tau * k / strands
            pts = []
            for i, p in enumerate(path):
                t = i / n
                a = ph + t * (6.0 + twist * 6.0)
                off = Vector((math.cos(a) * rb, math.sin(a) * rb, 0.0))
                pts.append(top + p + off)
            self._tube(bm, pts, 0.011 + rng.random() * 0.003, seg=5)
        return common.mesh_object(name, bm, R.wool(color, blotch=blotch), None, smooth=True)

    # ── vats ────────────────────────────────────────────────────────────────
    def tile_vat(self):
        """Vats: round dye vats in a plastered masonry drum, full of madder
        red, woad blue, purple or the pale alum mordant, with a stirring
        pole, stains running down, and (hot ones) a stoke-hole of embers and
        steam; in a fuller's yard, square tubs of milky fuller's earth with
        cloth soaking."""
        rng = self.rng
        vats = sorted(self.map.tiles("vat"), key=lambda t: (t[1], t[0]))
        fullery = self.style == "city"
        for i, (x, y) in enumerate(vats):
            name = f"vat-{x}-{y}"
            if fullery:
                objs = self._fuller_tub(name, x, y)
            else:
                kind = VAT_DYES[i % len(VAT_DYES)]
                hot = kind != "alum" and (self.style == "home" or i % 2 == 0)
                objs = self._dye_vat(name, x, y, kind, hot)
            self.sprite(name, y + 0.9, objs, [(x, y)])
        _ = rng

    def _dye_vat(self, name, x, y, kind, hot):
        rng = self.rng
        c = self.P(x + 0.5, y + 0.52)
        objs = []
        stain = R.DYES[kind]
        # A square surround of plastered masonry with a round lead-lined vat
        # sunk in it, its rim flush with the top.
        bm, layer = self._rbm()
        self._cbox(bm, layer, x + 0.05, y + 0.1, x + 0.95, y + 0.95, 0.0, 0.58, chamfer=0.045)
        self._cbox(bm, layer, x + 0.02, y + 0.07, x + 0.98, y + 0.98, 0.0, 0.1, chamfer=0.02)
        objs.append(self._obj(f"{name}-surround", bm, R.vat_plaster(stain, base="#86786a")))
        lead = M.plain("#6e6c66", 0.45, 0.4)
        objs.append(self._lathe(f"{name}-rim", [(0.34, 0.575), (0.39, 0.585), (0.4, 0.6), (0.37, 0.61), (0.34, 0.6)], c, lead, 40))
        objs.append(self._ellipsoid(f"{name}-liquor", c + Vector((0, 0, 0.583)), (0.345, 0.345, 0.003), R.dye(kind), 40, 4))
        pole = self._branch(f"{name}-pole", c + Vector((0.1, 0.06, 0.25)), c + Vector((-0.3, -0.46, 1.35)), 0.02, 0.017, M.wood("#6e5436", 3.0), 8, bow=0.0)
        objs.append(pole)
        if kind != "alum":
            # A skein lifted over the rim to drip.
            col = {"madder": "#8a2418", "woad": "#2c3e6a", "purple": "#4a1e46"}.get(kind, stain)
            objs.append(self.skein(f"{name}-skein", c + Vector((0.33, -0.25, 0.64)), col, 0.28, twist=0.4))
        if hot:
            # The stoke-hole at the foot: its dark mouth, a bed of embers on
            # its sill (cracked coals, dim: a room renders about 3 EV brighter
            # than outdoors, and a flat bright slab blew out to white), a low
            # glow from inside that falls warm on the floor in front, and ash
            # raked out onto it.
            from kit_village import embers

            bm, layer = self._rbm()
            self._cbox(bm, layer, x + 0.38, y + 0.955, x + 0.62, y + 0.985, 0.1, 0.3, chamfer=0.01, r=0.5)
            objs.append(self._obj(f"{name}-stoke", bm, self._mat("dark")))
            own = common.rng(int(x * 131 + y * 7))
            for k in range(5):
                ex = x + 0.42 + k * 0.04 + (own.random() - 0.5) * 0.015
                objs.append(self._ellipsoid(f"{name}-ember{k}", self.P(ex, y + 0.975, 0.115 + own.random() * 0.012), (0.024, 0.014, 0.018), embers(1.4), 10, 6))
            glow = self.add_light(f"{name}-fire", "POINT", self.P(x + 0.5, y + 1.02, 0.14), 2.2, "#ff7a30", radius=0.05)
            _ = glow
            self.flicker.append(("hearth", (x + 0.5) * 32, (y + 1.0) * 32, 20.0, list(self.light_plan.values()), 0.35))
            ash = self._ellipsoid(f"{name}-ash", self.P(x + 0.5, y + 1.08, 0.003), (0.13, 0.07, 0.004), M.plain("#6e6862", 0.95), 16, 4)
            self.to_ground(ash)
            steam = common.lathe(f"{name}-steam", [(0.32, 0.0), (0.36, 0.2), (0.33, 0.45), (0.24, 0.72), (0.1, 0.9)], 24, R.steam(), None)
            steam.data.transform(Matrix.Translation(c + Vector((0, 0, 0.6))))
            objs.append(steam)
        _ = rng
        return objs

    def _fuller_tub(self, name, x, y):
        rng = self.rng
        objs = []
        bm, layer = self._rbm()
        x0, y0, x1, y1 = x + 0.08, y + 0.12, x + 0.92, y + 0.88
        t = 0.09
        self._frame(bm, layer, x0, y0, x1, y1, t, 0.0, 0.58, chamfer=0.02)
        self._cbox(bm, layer, x0 + t, y0 + t, x1 - t, y1 - t, 0.0, 0.12, chamfer=0.01)
        objs.append(self._obj(f"{name}-tub", bm, R.vat_plaster("#e8e4d8", base="#aaa290")))
        objs.append(common.box(f"{name}-slurry", (x1 - x0 - 2 * t, y1 - y0 - 2 * t, 0.01), self.P((x0 + x1) / 2, (y0 + y1) / 2, 0.5), R.dye("fullers"), None))
        # A length of cloth soaking, one end hanging over the side.
        cb = bmesh.new()
        grid = []
        for j in range(9):
            tt = j / 8
            row = []
            for i in range(6):
                u = i / 5
                if tt < 0.6:
                    p = self.P(x0 + 0.15 + u * 0.5, y0 + 0.2 + tt * 0.6, 0.51 + math.sin(u * 9 + tt * 5) * 0.012)
                else:
                    k = (tt - 0.6) / 0.4
                    p = self.P(x0 + 0.15 + u * 0.5, y1 - t * 0.5 + k * 0.05, 0.58 - k * 0.42 + math.sin(u * 7) * 0.01)
                row.append(cb.verts.new(p))
            grid.append(row)
        for j in range(8):
            for i in range(5):
                cb.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        cloth = common.mesh_object(f"{name}-cloth", cb, M.cloth("#d9d2bf", None, "wool"), None)
        common.add_modifier(cloth, "SOLIDIFY", thickness=0.01)
        objs.append(cloth)
        _ = rng
        return objs

    # ── milestones ──────────────────────────────────────────────────────────
    def tile_milestone(self):
        """A Roman milestone: a squat, weathered column on a square base,
        lines cut in its face (worn, not a text) and the mile number cut
        larger beneath them."""
        stones = sorted(self.map.tiles("milestone"))
        for i, (x, y) in enumerate(stones):
            # Counting down toward Laodicea (west): the western stone is further from Colossae.
            numeral = "V" if i == 0 and len(stones) > 1 else "IIII"
            self.sprite(f"milestone-{x}-{y}", y + 0.8, self._milestone(f"milestone-{x}-{y}", x, y, numeral), [(x, y)])

    def _milestone(self, name, x, y, numeral):
        rng = self.rng
        c = self.P(x + 0.5, y + 0.55)
        objs = []
        bm, layer = self._rbm()
        self._cbox(bm, layer, x + 0.18, y + 0.24, x + 0.82, y + 0.86, -0.05, 0.3, chamfer=0.03)
        objs.append(self._obj(f"{name}-base", bm, R.ashlar("#c4bba4", "milestone-base", worn=0.7)))
        mask = R.inscription(256, 256, rng, numeral)
        img = R.pattern_image(f"inscription-{name}", mask[:, :, None].repeat(3, axis=2))
        mat = R.inscribed(img, "#b8af98", name=f"milestone-{name}")
        h = 1.55
        seg = 40
        cb = bmesh.new()
        uv = cb.loops.layers.uv.new("UVMap")
        rings = []
        nz = 12
        for j in range(nz + 1):
            z = 0.3 + h * j / nz
            r = 0.25 * (1 - 0.06 * j / nz) * (1 + 0.012 * math.sin(j * 1.7))
            # Starting at the back, so the middle of the UVs (the lines) faces the road.
            rings.append([cb.verts.new(c + Vector((math.cos(math.tau * s / seg + math.pi / 2) * r, math.sin(math.tau * s / seg + math.pi / 2) * r, z))) for s in range(seg + 1)])
        for j in range(nz):
            for s in range(seg):
                f = cb.faces.new((rings[j][s], rings[j][s + 1], rings[j + 1][s + 1], rings[j + 1][s]))
                for loop, (ss, jj) in zip(f.loops, ((s, j), (s + 1, j), (s + 1, j + 1), (s, j + 1))):
                    # u: 0.5 faces south (the road); v: up the column.
                    loop[uv].uv = (ss / seg, jj / nz)
        top = cb.verts.new(c + Vector((0, 0, 0.3 + h + 0.03)))
        for s in range(seg):
            cb.faces.new((rings[-1][s], rings[-1][s + 1], top))
        col = common.mesh_object(f"{name}-column", cb, mat, None, smooth=True)
        objs.append(col)
        # Lichen and a few weeds at the foot.
        for k in range(5):
            a = rng.random() * math.tau
            objs.append(self._ellipsoid(f"{name}-weed{k}", c + Vector((math.cos(a) * 0.36, math.sin(a) * 0.3, 0.02)), (0.07, 0.06, 0.05), M.leaf("#56682e", "#8a9a5a"), 8, 5))
        return objs

    # ── lampstands ──────────────────────────────────────────────────────────
    def tile_lampstand(self):
        """A tall bronze lampstand (candelabrum): three lion's-paw feet, a
        fluted shaft with a knop, a dish on top holding a clay oil lamp
        whose flame lights the room."""
        for x, y in self.map.tiles("lampstand"):
            name = f"lampstand-{x}-{y}"
            self.sprite(name, y + 0.72, self._lampstand(name, x, y), [(x, y)])

    def _lampstand(self, name, x, y, lit=True):
        c = self.P(x + 0.5, y + 0.5)
        brz = self._mat("bronze")
        objs = []
        bm = bmesh.new()
        for k in range(3):
            a = math.tau * k / 3 - math.pi / 2
            foot = c + Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.035))
            pts = [c + Vector((0, 0, 0.2)), c + Vector((math.cos(a) * 0.09, math.sin(a) * 0.09, 0.16)), c + Vector((math.cos(a) * 0.17, math.sin(a) * 0.17, 0.07)), foot]
            self._tube(bm, pts, [0.018, 0.02, 0.018, 0.02], seg=8)
            paw = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=1.0)
            for v in paw["verts"]:
                v.co = Vector((v.co.x * 0.04, v.co.y * 0.04, max(v.co.z, -0.3) * 0.035)) + foot + Vector((math.cos(a) * 0.015, math.sin(a) * 0.015, 0))
        objs.append(common.mesh_object(f"{name}-feet", bm, brz, None, smooth=True))
        prof = [(0.05, 0.18), (0.035, 0.24), (0.022, 0.3), (0.018, 0.75), (0.035, 0.8), (0.04, 0.83), (0.02, 0.87), (0.016, 1.3), (0.03, 1.33), (0.1, 1.36), (0.11, 1.38), (0.085, 1.385)]
        objs.append(self._lathe(f"{name}-shaft", prof, c, brz, 24))
        if lit:
            lamp_at = c + Vector((0, 0, 1.385))
            body = self._ellipsoid(f"{name}-lamp", lamp_at + Vector((0, 0, 0.025)), (0.065, 0.05, 0.028), M.terracotta("#b2714a", 0.05), 16, 8)
            nozzle = self._ellipsoid(f"{name}-nozzle", lamp_at + Vector((0.0, -0.065, 0.03)), (0.026, 0.035, 0.018), M.terracotta("#a8683f", 0.05), 10, 6)
            flame = self._ellipsoid(f"{name}-flame", lamp_at + Vector((0.0, -0.09, 0.07)), (0.012, 0.012, 0.034), M.emissive("#ffc070", 40.0), 8, 6)
            objs += [body, nozzle, flame]
            self.add_light(f"{name}-light", "POINT", lamp_at + Vector((0.0, -0.1, 0.1)), 60.0, "#ffa452", radius=0.03)
        return objs

    # ── couches ─────────────────────────────────────────────────────────────
    def tile_couch(self):
        """Dining couches (lecti) set in a U round the room's middle: turned
        legs with bronze caps, a frame, a thick mattress under a coverlet,
        cushions, and a curved head-rest (fulcrum) at the end."""
        m = self.map
        done = set()
        # Along rows: the long back couch, split into couches about 3 tiles long.
        for x0, x1, y in m.runs("couch"):
            if x1 - x0 < 2:
                continue
            n = max(1, int(round((x1 - x0) / 3.3)))
            for k in range(n):
                a = x0 + (x1 - x0) * k / n
                b = x0 + (x1 - x0) * (k + 1) / n
                name = f"couch-{int(a)}-{y}"
                self.sprite(name, y + 0.92, self._couch(name, a + 0.04, b - 0.04, y + 0.06, y + 0.94, "x", fulcrum=(k == 0, k == n - 1)), [(x, y) for x in range(int(a), int(math.ceil(b)))])
            done |= {(x, y) for x in range(x0, x1)}
        # Down columns: the side couches.
        rest = sorted(set(m.tiles("couch")) - done)
        cols = {}
        for x, y in rest:
            cols.setdefault(x, []).append(y)
        for x, ys in cols.items():
            ys.sort()
            y0, y1 = ys[0], ys[-1] + 1
            name = f"couch-{x}-{y0}"
            self.sprite(name, y1 - 0.05, self._couch(name, x + 0.06, x + 0.94, y0 - 0.02, y1 - 0.06, "y", fulcrum=(True, False)), [(x, y) for y in ys])

    def _couch(self, name, x0, x1, y0, y1, axis, fulcrum=(True, True)):
        rng = self.rng
        objs = []
        wood = M.wood("#4a3222", 7.0)
        brz = self._mat("bronze")
        legs = bmesh.new()
        for lx in (x0 + 0.08, x1 - 0.08):
            for ly in (y0 + 0.08, y1 - 0.08):
                c = self.P(lx, ly)
                for r, z0, z1 in ((0.035, 0.0, 0.08), (0.028, 0.08, 0.2), (0.04, 0.2, 0.26), (0.026, 0.26, 0.38)):
                    ring0 = [legs.verts.new(c + Vector((math.cos(math.tau * k / 10) * r, math.sin(math.tau * k / 10) * r, z0))) for k in range(10)]
                    ring1 = [legs.verts.new(c + Vector((math.cos(math.tau * k / 10) * r, math.sin(math.tau * k / 10) * r, z1))) for k in range(10)]
                    for k in range(10):
                        kk = (k + 1) % 10
                        legs.faces.new((ring0[k], ring0[kk], ring1[kk], ring1[k]))
        objs.append(common.mesh_object(f"{name}-legs", legs, wood, None, smooth=True))
        caps = bmesh.new()
        for lx in (x0 + 0.08, x1 - 0.08):
            for ly in (y0 + 0.08, y1 - 0.08):
                s = bmesh.ops.create_uvsphere(caps, u_segments=10, v_segments=6, radius=0.042)
                bmesh.ops.translate(caps, vec=self.P(lx, ly, 0.23), verts=s["verts"])
        objs.append(common.mesh_object(f"{name}-caps", caps, brz, None, smooth=True))
        fb, fl = self._rbm()
        self._cbox(fb, fl, x0, y0, x1, y1, 0.36, 0.46, chamfer=0.015)
        objs.append(self._obj(f"{name}-frame", fb, wood))
        mb, ml = self._rbm()
        self._cbox(mb, ml, x0 + 0.02, y0 + 0.02, x1 - 0.02, y1 - 0.02, 0.44, 0.6, chamfer=0.06, r=0.5)
        mattress = self._obj(f"{name}-mattress", mb, M.cloth("#d8cdb4", None, "linen"))
        common.add_modifier(mattress, "SUBSURF", levels=2, render_levels=2)
        objs.append(mattress)
        covers = [["#7a2a2a", "#c9a45a", "#7a2a2a", "#3a2a3a"], ["#3a4a6a", "#d8c89a", "#3a4a6a"], ["#6a3a5a", "#c9b48a", "#6a3a5a", "#8a6a3a"]]
        cov = M.textile(covers[int(rng.random() * 3)], f"{name}-coverlet", band=0.14, border="#2a1a18")
        # A coverlet laid over the mattress and hanging down its front.
        cb = bmesh.new()
        uvl = cb.loops.layers.uv.new("UVMap")
        if axis == "x":
            front = y1
            pts_top = [(x0 + 0.05, y0 + 0.2), (x1 - 0.05, y0 + 0.2), (x1 - 0.05, front - 0.05), (x0 + 0.05, front - 0.05)]
        else:
            front = x1
            pts_top = [(x0 + 0.1, y0 + 0.1), (front - 0.06, y0 + 0.1), (front - 0.06, y1 - 0.1), (x0 + 0.1, y1 - 0.1)]
        nu, nv = 12, 6
        grid = []
        for j in range(nv + 1):
            row = []
            for i in range(nu + 1):
                u, v = i / nu, j / nv
                ax = pts_top[0][0] + (pts_top[1][0] - pts_top[0][0]) * u
                ay = pts_top[0][1] + (pts_top[3][1] - pts_top[0][1]) * v
                if axis == "y":
                    ax = pts_top[0][0] + (pts_top[1][0] - pts_top[0][0]) * v
                    ay = pts_top[0][1] + (pts_top[3][1] - pts_top[0][1]) * u
                row.append(cb.verts.new(self.P(ax, ay, 0.61 + math.sin(u * 11 + v * 3) * 0.006)))
            grid.append(row)
        drop = []
        for i in range(nu + 1):
            p = grid[-1][i].co.copy()
            if axis == "x":
                drop.append(cb.verts.new(p + Vector((0, -0.08, -0.3 - math.sin(i * 1.3) * 0.02))))
            else:
                drop.append(cb.verts.new(p + Vector((0.08, 0, -0.3 - math.sin(i * 1.3) * 0.02))))
        for j in range(nv):
            for i in range(nu):
                f = cb.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                for loop, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    loop[uvl].uv = (ii / nu, jj / (nv + 2))
        for i in range(nu):
            f = cb.faces.new((grid[-1][i], grid[-1][i + 1], drop[i + 1], drop[i]))
            for loop, (ii, jj) in zip(f.loops, ((i, nv), (i + 1, nv), (i + 1, nv + 2), (i, nv + 2))):
                loop[uvl].uv = (ii / nu, jj / (nv + 2))
        coverlet = common.mesh_object(f"{name}-coverlet", cb, cov, None, smooth=True)
        common.add_modifier(coverlet, "SOLIDIFY", thickness=0.01)
        objs.append(coverlet)
        cushion_cols = ["#8a2a22", "#c49a44", "#3a4a6a", "#6a3a5a", "#5a6a3a"]
        length = (x1 - x0) if axis == "x" else (y1 - y0)
        n = max(2, int(length / 0.9))
        for k in range(n):
            t = (k + 0.5) / n
            if axis == "x":
                p = self.P(x0 + (x1 - x0) * t, y0 + 0.25, 0.7)
                radii = (0.2, 0.13, 0.1)
            else:
                p = self.P(x0 + 0.22, y0 + (y1 - y0) * t, 0.7)
                radii = (0.13, 0.2, 0.1)
            objs.append(self._ellipsoid(f"{name}-cushion{k}", p, radii, M.cloth(cushion_cols[int(rng.random() * len(cushion_cols))], None, "wool"), 16, 10))
        for end, want in zip((0, 1), fulcrum):
            if not want:
                continue
            if axis == "x":
                ex = x0 + 0.08 if end == 0 else x1 - 0.08
                a = self.P(ex, y0 + 0.2, 0.55)
                pts = [a, a + Vector((0, 0, 0.18)), a + Vector((0.04 if end else -0.04, 0, 0.28)), a + Vector((0.1 if end else -0.1, 0, 0.3))]
                pts2 = [p + Vector((0, -0.55, 0)) for p in pts]
            else:
                a = self.P(x0 + 0.2, y0 + 0.08, 0.55)
                pts = [a, a + Vector((0, 0, 0.18)), a + Vector((0, 0.04, 0.28)), a + Vector((0, 0.1, 0.3))]
                pts2 = [p + Vector((0.55, 0, 0)) for p in pts]
            fb2 = bmesh.new()
            for strip in (pts, pts2):
                self._tube(fb2, strip, 0.025, seg=8)
            self._tube(fb2, [pts[-1], pts2[-1]], 0.02, seg=8)
            objs.append(common.mesh_object(f"{name}-fulcrum{end}", fb2, wood, None, smooth=True))
        return objs

    # ── fountains ───────────────────────────────────────────────────────────
    def tile_fountain(self):
        """A fountain: in a street, a public basin of four stone slabs
        clamped with iron, fed by a spout in a lion's-head mask on a back
        slab, the water running over; in a house's garden, a round marble
        basin with a small bowl on a pedestal in the middle."""
        m = self.map
        groups = self.regions(kinds=("fountain",))
        for reg in groups:
            xs = [p[0] for p in reg]
            ys = [p[1] for p in reg]
            x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
            name = f"fountain-{x0}-{y0}"
            if self.style == "home":
                objs = self._garden_fountain(name, (x0 + x1) / 2, (y0 + y1) / 2)
            else:
                objs = self._street_fountain(name, x0, y0, x1, y1)
            self.sprite(name, y1 - 0.05, objs, sorted(reg))
        _ = m

    def _street_fountain(self, name, x0, y0, x1, y1):
        objs = []
        stone = R.marble("#bdb8aa", "fountain-stone", veins="#9a968a", worn=0.6)
        bm, layer = self._rbm()
        bx0, by0, bx1, by1 = x0 - 0.2, y0 + 0.05, x1 + 0.2, y1 - 0.02
        t = 0.13
        h = 0.62
        self._frame(bm, layer, bx0, by0, bx1, by1, t, 0.0, h, chamfer=0.025)
        self._cbox(bm, layer, bx0 + t, by0 + t, bx1 - t, by1 - t, 0.0, 0.1, chamfer=0.01)
        # The back slab with its spout.
        self._cbox(bm, layer, bx0 + 0.22, by0 - 0.1, bx1 - 0.22, by0 + 0.08, 0.0, 1.4, chamfer=0.03)
        self._cbox(bm, layer, bx0 + 0.16, by0 - 0.13, bx1 - 0.16, by0 + 0.11, 1.4, 1.5, chamfer=0.03)
        objs.append(self._obj(f"{name}-stone", bm, stone))
        iron = self._mat("iron")
        for cx in (bx0 + 0.05, bx1 - 0.05):
            for cy in (by0 + 0.05, by1 - 0.05):
                objs.append(common.box(f"{name}-clamp{cx:.1f}{cy:.1f}", (0.1, 0.03, 0.012), self.P(cx, cy, h + 0.006), iron, None))
        mid = (bx0 + bx1) / 2
        head = self.P(mid, by0 + 0.1, 0.98)
        objs.append(self._ellipsoid(f"{name}-mask", head, (0.12, 0.06, 0.13), stone, 18, 10))
        objs.append(self._ellipsoid(f"{name}-mane", head + Vector((0, 0.02, 0.0)), (0.17, 0.04, 0.17), stone, 20, 8))
        objs.append(self._ellipsoid(f"{name}-muzzle", head + Vector((0, -0.06, -0.04)), (0.06, 0.04, 0.045), stone, 12, 8))
        spout = head + Vector((0, -0.1, -0.05))
        objs.append(self._branch(f"{name}-pipe", head + Vector((0, -0.05, -0.05)), spout, 0.018, 0.016, self._mat("bronze"), 8, bow=0.0))
        # The stream: a rope of water arcing out of the lion's mouth, clear
        # where it leaves the pipe and whitening with air as it falls, a
        # little wavering, thinning as it speeds up; it breaks into a splash
        # of white water and rings where it lands in the basin.
        surface = h - 0.06
        # Its own random stream, so the rest of the street builds as before.
        rng = common.rng(int(x0 * 97 + y0 * 13))
        stream = bmesh.new()
        pts = []
        n_pts = 14
        drop = spout.z - self.P(mid, by0, surface).z
        for k in range(n_pts):
            t_ = k / (n_pts - 1)
            wob = 0.004 * math.sin(t_ * 17.0)
            pts.append(spout + Vector((wob, -0.16 * t_, -drop * (0.1 * t_ + 0.9 * t_ * t_))))
        self._tube(stream, pts, [0.021 - 0.006 * (k / (n_pts - 1)) for k in range(n_pts)], seg=10)
        objs.append(common.mesh_object(f"{name}-stream", stream, R.falling_water(0.3), None, smooth=True))
        land = pts[-1]
        objs.append(common.box(f"{name}-water", (bx1 - bx0 - 2 * t, by1 - by0 - 2 * t, 0.01), self.P(mid, (by0 + by1) / 2, surface), R.basin_water(), None))
        splash = bmesh.new()
        for k in range(9):
            a = math.tau * k / 9 + rng.random() * 0.4
            r0 = 0.03 + rng.random() * 0.02
            base = land + Vector((math.cos(a) * r0, math.sin(a) * r0 * 0.8, 0.0))
            tip = base + Vector((math.cos(a) * (0.015 + rng.random() * 0.02), math.sin(a) * 0.015, 0.015 + rng.random() * 0.025))
            self._tube(splash, [base, base.lerp(tip, 0.6), tip], [0.01, 0.007, 0.003], seg=6)
        objs.append(common.mesh_object(f"{name}-splash", splash, R.falling_water(0.8), None, smooth=True))
        objs.append(self._ellipsoid(f"{name}-foam", land + Vector((0, 0, 0.002)), (0.07, 0.06, 0.006), R.falling_water(0.9, "fountain-foam"), 18, 4))
        # Water spilling over a worn notch in the front lip in a thin sheet
        # down the slab's face, darkening the stone, and a puddle at its foot.
        sheet = bmesh.new()
        rows = []
        path = [(by1 - 0.06, h + 0.004), (by1 + 0.005, h - 0.004), (by1 + 0.02, h - 0.04), (by1 + 0.022, h * 0.5), (by1 + 0.03, 0.03), (by1 + 0.1, 0.004)]
        for yy, zz in path:
            half = 0.05 + 0.02 * (1 - zz / h)
            rows.append([sheet.verts.new(self.P(mid - 0.12 + s * half, yy, zz)) for s in (-1, 1)])
        for a_, b_ in zip(rows, rows[1:]):
            sheet.faces.new((a_[0], a_[1], b_[1], b_[0]))
        objs.append(common.mesh_object(f"{name}-spill", sheet, R.falling_water(0.12, "fountain-sheet"), None, smooth=True))
        # (The wet paving round the basin is a decal in the ground: _litter.)
        objs.append(common.box(f"{name}-wet", (0.2, 0.004, h - 0.06), self.P(mid - 0.12, by1 + 0.012, (h - 0.06) / 2), R.wet_stone("#8e8a80"), None))
        # Water jars waiting their turn at the spout.
        for k, (dx, dy) in enumerate(((bx0 - 0.3, by1 - 0.1), (bx1 + 0.28, by1 - 0.25))):
            objs.append(self._lathe(f"{name}-jar{k}", [(0.05, 0.0), (0.12, 0.05), (0.15, 0.2), (0.13, 0.32), (0.07, 0.4), (0.055, 0.44), (0.065, 0.46)], self.P(dx, dy, 0.03), M.terracotta("#b87a54", 0.4), 24))
        return objs

    def _garden_fountain(self, name, cx, cy):
        objs = []
        stone = self._mat("marble")
        c = self.P(cx, cy)
        prof = [(0.62, 0.0), (0.64, 0.04), (0.6, 0.08), (0.58, 0.36), (0.63, 0.4), (0.62, 0.44), (0.55, 0.44), (0.53, 0.2), (0.0, 0.18)]
        objs.append(self._lathe(f"{name}-basin", prof, c, stone, 48))
        objs.append(self._ellipsoid(f"{name}-water", c + Vector((0, 0, 0.36)), (0.53, 0.53, 0.004), R.basin_water(), 40, 4))
        ped = [(0.1, 0.18), (0.08, 0.3), (0.06, 0.6), (0.09, 0.7), (0.05, 0.75), (0.26, 0.82), (0.28, 0.86), (0.22, 0.87), (0.0, 0.8)]
        objs.append(self._lathe(f"{name}-labrum", ped, c, stone, 40))
        objs.append(self._ellipsoid(f"{name}-bowlwater", c + Vector((0, 0, 0.85)), (0.22, 0.22, 0.004), R.basin_water(), 32, 4))
        # A low jet bubbling up in the bowl (a dome of water with a plume),
        # and the overflow falling from the bowl's lip in thin threads.
        jet = bmesh.new()
        self._tube(jet, [c + Vector((0, 0, 0.845)), c + Vector((0, 0, 0.9)), c + Vector((0, 0, 0.95)), c + Vector((0, 0, 0.97))], [0.03, 0.022, 0.012, 0.002], seg=10)
        objs.append(common.mesh_object(f"{name}-jet", jet, R.falling_water(0.45, "fountain-jet"), None, smooth=True))
        fall = bmesh.new()
        for k in range(8):
            a = math.tau * k / 8 + 0.2
            pts = [c + Vector((math.cos(a) * 0.275, math.sin(a) * 0.275, 0.855)), c + Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 0.72)), c + Vector((math.cos(a) * 0.31, math.sin(a) * 0.31, 0.37))]
            self._tube(fall, pts, [0.009, 0.007, 0.006], seg=6)
        objs.append(common.mesh_object(f"{name}-falls", fall, R.falling_water(0.3, "fountain-falls"), None, smooth=True))
        return objs

    # ── tables and hearths ──────────────────────────────────────────────────
    def tile_table(self):
        """Tables: a scribe's writing table with a stool, pens and ink
        (a street); a dyer's work tables with a mortar, madder root, a
        balance and folded skeins (a workshop); a round three-legged table
        with a jug and a lamp (a house). Other places: the shared low table."""
        if not self.roman:
            return super().tile_table()
        workshop = bool(self.map.tiles("vat"))
        # Single tiles stacked in a column make one long table.
        runs = sorted(self.map.runs("table"), key=lambda r: (r[0], r[2]))
        tables = []
        for x0, x1, y in runs:
            last = tables[-1] if tables else None
            if last and x1 - x0 == 1 and last[1] - last[0] == 1 and last[0] == x0 and last[3] == y:
                last[3] = y + 1
            else:
                tables.append([x0, x1, y, y + 1])
        for x0, x1, y0, y1 in tables:
            name = f"table-{x0}-{y0}"
            if self.style == "city":
                objs = self._scribe_table(name, x0, x1, y0)
            elif workshop:
                objs = self._work_table(name, x0, x1, y0, y1)
            else:
                objs = self._round_table(name, x0 + (x1 - x0) / 2, y0 + 0.5)
            self.sprite(name, y1 - 0.1, objs, [(x, y) for x in range(x0, x1) for y in range(y0, y1)])

    def _turned_legs(self, bm, pts, top, r=0.028):
        for lx, ly in pts:
            c = self.P(lx, ly)
            prof = [(r * 1.2, 0.0), (r, 0.06), (r * 1.4, 0.12), (r * 0.8, 0.2), (r * 0.85, top * 0.6), (r * 1.3, top * 0.65), (r * 0.9, top * 0.72), (r, top)]
            rings = []
            for rr, z in prof:
                rings.append([bm.verts.new(c + Vector((math.cos(math.tau * k / 10) * rr, math.sin(math.tau * k / 10) * rr, z))) for k in range(10)])
            for a, b in zip(rings, rings[1:]):
                for k in range(10):
                    kk = (k + 1) % 10
                    bm.faces.new((a[k], a[kk], b[kk], b[k]))

    def _scribe_table(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        wood = M.wood("#6a4a30", 8.0)
        top_z = 0.72
        tb, tl = self._rbm()
        self._cbox(tb, tl, x0 + 0.1, y + 0.22, x1 - 0.1, y + 0.78, top_z - 0.04, top_z, chamfer=0.01)
        objs.append(self._obj(f"{name}-top", tb, wood))
        legs = bmesh.new()
        self._turned_legs(legs, [(x0 + 0.16, y + 0.28), (x1 - 0.16, y + 0.28), (x0 + 0.16, y + 0.72), (x1 - 0.16, y + 0.72)], top_z - 0.04)
        objs.append(common.mesh_object(f"{name}-legs", legs, wood, None, smooth=True))
        c = self.P(x1 - 0.22, y + 0.35, top_z)
        objs.append(self._lathe(f"{name}-ink", [(0.035, 0.0), (0.038, 0.05), (0.028, 0.06), (0.012, 0.062)], c, self._mat("bronze"), 16))
        for k in range(3):
            objs.append(self._branch(f"{name}-pen{k}", self.P(x1 - 0.35 - k * 0.03, y + 0.3, top_z + 0.006), self.P(x1 - 0.15 - k * 0.03, y + 0.52, top_z + 0.006), 0.004, 0.003, M.plain("#8a7a50", 0.7), 5, bow=0.0))
        # A stool behind the table (the scribe sits facing the street).
        sb, sl = self._rbm()
        self._cbox(sb, sl, x0 + 0.6, y - 0.05, x0 + 0.95, y + 0.2, 0.42, 0.46, chamfer=0.01)
        objs.append(self._obj(f"{name}-stool", sb, wood))
        sl2 = bmesh.new()
        for lx, ly in ((x0 + 0.63, y - 0.02), (x0 + 0.92, y + 0.17)):
            for d in (-1, 1):
                self._tube(sl2, [self.P(lx, ly, 0.0), self.P(lx + d * 0.0, ly + d * 0.2, 0.42)], 0.014, seg=6)
        objs.append(common.mesh_object(f"{name}-stool-legs", sl2, wood, None, smooth=True))
        _ = rng
        return objs

    def _work_table(self, name, x0, x1, y, y_end=None):
        rng = self.rng
        objs = []
        wood = M.wood("#7a5a3c", 6.0)
        top_z = 0.8
        ye = (y_end or y + 1) - 1
        tb, tl = self._rbm()
        self._cbox(tb, tl, x0 + 0.08, y + 0.1, x1 - 0.08, ye + 0.9, top_z - 0.07, top_z, chamfer=0.012)
        objs.append(self._obj(f"{name}-top", tb, wood))
        lb, ll = self._rbm()
        for lx in (x0 + 0.12, x1 - 0.2):
            for ly in (y + 0.14, ye + 0.78):
                self._cbox(lb, ll, lx, ly, lx + 0.08, ly + 0.08, 0.0, top_z - 0.07, chamfer=0.006)
        self._cbox(lb, ll, x0 + 0.14, y + 0.16, x1 - 0.14, ye + 0.84, 0.14, 0.18, chamfer=0.004)
        objs.append(self._obj(f"{name}-frame", lb, wood))
        cx = x0 + (x1 - x0) * 0.5
        # A stone mortar with a pestle, and chopped madder root beside it.
        objs.append(self._lathe(f"{name}-mortar", [(0.1, 0.0), (0.12, 0.05), (0.11, 0.12), (0.08, 0.12), (0.06, 0.05), (0.0, 0.04)], self.P(cx - 0.2, y + 0.4, top_z), R.ashlar("#bcb4a0", "mortar-stone"), 24))
        objs.append(self._branch(f"{name}-pestle", self.P(cx - 0.2, y + 0.4, top_z + 0.08), self.P(cx - 0.12, y + 0.3, top_z + 0.26), 0.022, 0.028, self._mat("marble-grey"), 8, bow=0.0))
        root = M.plain("#8a3a24", 0.8)
        for k in range(22):
            a = rng.random() * math.tau
            r = rng.random() ** 0.5 * 0.13
            objs.append(self._ellipsoid(f"{name}-root{k}", self.P(cx + 0.15 + math.cos(a) * r, y + 0.45 + math.sin(a) * r * 0.8, top_z + 0.02), (0.03, 0.011, 0.011), root, 6, 4))
        # Folded skeins, ready to go into the vats.
        for k in range(3):
            objs.append(self._ellipsoid(f"{name}-hank{k}", self.P(cx + 0.28 + k * 0.1, y + 0.72, top_z + 0.035), (0.05, 0.12, 0.035), R.wool("#e8dfcb" if k else "#8a2418"), 12, 8))
        return objs

    def _round_table(self, name, cx, cy):
        objs = []
        wood = M.wood("#5a3e2a", 9.0)
        c = self.P(cx, cy)
        objs.append(self._lathe(f"{name}-top", [(0.0, 0.66), (0.36, 0.66), (0.37, 0.68), (0.36, 0.7), (0.0, 0.7)], c, self._mat("marble"), 40))
        lb = bmesh.new()
        for k in range(3):
            a = math.tau * k / 3 + 0.3
            pts = [c + Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.66)), c + Vector((math.cos(a) * 0.24, math.sin(a) * 0.24, 0.35)), c + Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 0.04))]
            self._tube(lb, pts, [0.026, 0.02, 0.03], seg=8)
        objs.append(common.mesh_object(f"{name}-legs", lb, self._mat("bronze"), None, smooth=True))
        objs.append(self._lathe(f"{name}-jug", [(0.04, 0.0), (0.075, 0.06), (0.07, 0.14), (0.035, 0.2), (0.03, 0.24), (0.045, 0.26)], c + Vector((-0.1, 0.08, 0.7)), M.terracotta("#b06a44", 0.1), 20))
        for k in range(2):
            objs.append(self._lathe(f"{name}-cup{k}", [(0.0, 0.0), (0.03, 0.0), (0.045, 0.05), (0.042, 0.055)], c + Vector((0.12 + k * 0.1, -0.08, 0.7)), M.terracotta("#9a3a28", 0.05), 16))
        return objs

    def tile_oven(self):
        """In a dyer's workshop, a masonry hearth under a copper cauldron of
        simmering madder; in a house, a raised kitchen hearth with a pot on
        a tripod over the embers. Other places: the shared oven."""
        if not self.roman:
            return super().tile_oven()
        workshop = bool(self.map.tiles("vat"))
        for x, y in self.map.tiles("oven"):
            name = f"oven-{x}-{y}"
            objs = self._dye_hearth(name, x, y) if workshop else self._kitchen_hearth(name, x, y)
            self.sprite(name, y + 0.88, objs, [(x, y)])

    def _dye_hearth(self, name, x, y):
        objs = []
        c = self.P(x + 0.5, y + 0.5)
        bm, layer = self._rbm()
        self._cbox(bm, layer, x + 0.04, y + 0.1, x + 0.96, y + 0.94, 0.0, 0.55, chamfer=0.03)
        objs.append(self._obj(f"{name}-hearth", bm, R.vat_plaster("#3a2a22", base="#b8a88c")))
        objs.append(self._ellipsoid(f"{name}-mouth", c + Vector((0, -0.44, 0.16)), (0.16, 0.05, 0.12), self._mat("dark"), 16, 8))
        objs.append(self._ellipsoid(f"{name}-fire", c + Vector((0, -0.42, 0.08)), (0.12, 0.05, 0.05), M.emissive("#ff6a20", 7.0), 14, 6))
        self.add_light(f"{name}-glow", "POINT", c + Vector((0, -0.6, 0.2)), 18.0, "#ff7a30", radius=0.1)
        copper = M.plain("#8a4a2a", 0.35, 0.6)
        objs.append(self._lathe(f"{name}-cauldron", [(0.2, 0.0), (0.3, 0.06), (0.36, 0.18), (0.37, 0.3), (0.39, 0.33), (0.36, 0.33)], c + Vector((0, 0, 0.5)), copper, 32))
        objs.append(self._ellipsoid(f"{name}-dye", c + Vector((0, 0, 0.78)), (0.35, 0.35, 0.006), R.dye("madder"), 32, 4))
        steam = common.lathe(f"{name}-steam", [(0.3, 0.0), (0.32, 0.25), (0.26, 0.55), (0.12, 0.8)], 24, R.steam(), None)
        steam.data.transform(Matrix.Translation(c + Vector((0, 0, 0.8))))
        objs.append(steam)
        wood = M.bark("#5a4a38")
        for k in range(4):
            a = c + Vector((0.34, -0.5 + k * 0.05, 0.03 + (k % 2) * 0.06))
            objs.append(self._branch(f"{name}-log{k}", a, a + Vector((0.28, 0.1, 0.0)), 0.035, 0.03, wood, 8, bow=0.0))
        return objs

    def _kitchen_hearth(self, name, x, y):
        objs = []
        c = self.P(x + 0.5, y + 0.5)
        bm, layer = self._rbm()
        self._cbox(bm, layer, x + 0.04, y + 0.08, x + 0.96, y + 0.92, 0.0, 0.62, chamfer=0.02)
        objs.append(self._obj(f"{name}-bench", bm, R.vat_plaster("#2a2420", base="#c8baa0")))
        objs.append(self._ellipsoid(f"{name}-embers", c + Vector((0, 0.05, 0.63)), (0.22, 0.18, 0.02), M.emissive("#ff5a18", 5.0), 20, 6))
        self.add_light(f"{name}-glow", "POINT", c + Vector((0, -0.2, 0.9)), 16.0, "#ff7a30", radius=0.12)
        iron = self._mat("iron")
        tb = bmesh.new()
        for k in range(3):
            a = math.tau * k / 3 + 0.5
            self._tube(tb, [c + Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.62)), c + Vector((math.cos(a) * 0.14, math.sin(a) * 0.14, 0.82))], 0.01, seg=5)
        objs.append(common.mesh_object(f"{name}-tripod", tb, iron, None, smooth=True))
        objs.append(self._lathe(f"{name}-pot", [(0.1, 0.0), (0.16, 0.06), (0.17, 0.14), (0.13, 0.2), (0.14, 0.22)], c + Vector((0, 0, 0.8)), M.terracotta("#5a3e30", 0.0), 24))
        for k in range(3):
            objs.append(self._lathe(f"{name}-bowl{k}", [(0.0, 0.0), (0.06, 0.0), (0.1, 0.05), (0.11, 0.06)], c + Vector((-0.28 + k * 0.1, -0.3, 0.62)), M.terracotta("#9a3a28", 0.05), 16))
        return objs

    # ── cloth, skeins and baskets ───────────────────────────────────────────
    def tile_cloth(self):
        """Drying: skeins of dyed wool hanging from a pole (a dyer's
        workshop and dye works), or lengths of fulled cloth, cream and
        white, over a fuller's rack (a town yard)."""
        if not self.roman:
            return super().tile_cloth()
        for x0, x1, y in self.map.runs("cloth"):
            name = f"cloth-{x0}-{y}"
            if self.style == "city":
                objs = self._fuller_rack(name, x0, x1, y)
            else:
                objs = self._skein_pole(name, x0, x1, y)
            self.sprite(name, y + 0.7, objs, [(x, y) for x in range(x0, x1)])

    def _skein_pole(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        wood = M.wood("#6e5436", 4.0)
        indoor = self.style == "home"
        z = 1.85 if indoor else 1.7
        py = y + (0.3 if indoor else 0.5)
        for px in (x0 + 0.08, x1 - 0.08):
            if indoor:
                objs.append(common.box(f"{name}-bracket{px:.1f}", (0.06, 0.3, 0.06), self.P(px, py - 0.15, z), wood, None))
            else:
                objs.append(self._branch(f"{name}-post{px:.1f}", self.P(px, py, -0.05), self.P(px, py, z + 0.08), 0.04, 0.035, wood, 8, bow=0.0))
        objs.append(self._branch(f"{name}-pole", self.P(x0, py, z), self.P(x1, py, z), 0.028, 0.028, wood, 8, bow=-0.02))
        palette = ["#8a2418", "#9a2a1c", "#7a1e16", "#2c3e6a", "#8a2418", "#4a1e46", "#a8341e", "#c49a3a"] if not indoor else ["#8a2418", "#9a2a1c", "#7e2016", "#a0301e", "#8a2418", "#2c3e6a"]
        x = x0 + 0.14
        k = 0
        while x < x1 - 0.1:
            color = palette[int(rng.random() * len(palette))]
            objs.append(self.skein(f"{name}-s{k}", self.P(x, py, z - 0.02), color, 0.42 + rng.random() * 0.2, twist=rng.random() * 0.6))
            x += 0.13 + rng.random() * 0.05
            k += 1
        return objs

    def _fuller_rack(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        wood = M.wood("#7a6040", 4.0)
        for px in (x0 + 0.08, x1 - 0.08):
            objs.append(self._branch(f"{name}-post{px:.1f}", self.P(px, y + 0.5, -0.05), self.P(px, y + 0.5, 1.75), 0.04, 0.035, wood, 8, bow=0.0))
        objs.append(self._branch(f"{name}-rail", self.P(x0, y + 0.5, 1.7), self.P(x1, y + 0.5, 1.7), 0.03, 0.03, wood, 8, bow=0.0))
        colors = ["#e6e0d0", "#ddd4bf", "#efe9dc", "#d6cdb6"]
        x = x0 + 0.12
        k = 0
        while x < x1 - 0.3:
            w = 0.5 + rng.random() * 0.3
            w = min(w, x1 - 0.12 - x)
            bm = bmesh.new()
            nu, nv = 8, 12
            drop = 1.25 + rng.random() * 0.2
            grid = []
            for j in range(nv + 1):
                t = j / nv
                row = []
                for i in range(nu + 1):
                    u = i / nu
                    fold = 0.035 * math.sin(u * math.tau * 2.5 + k) * (0.4 + t)
                    # Hung over the rail: a short fold behind, the long side in front.
                    if t < 0.15:
                        p = self.P(x + w * u, y + 0.5 - 0.05 + t * 0.6, 1.72 - t * 0.2)
                    else:
                        p = self.P(x + w * u, y + 0.56 + fold, 1.7 - drop * (t - 0.15) / 0.85)
                    row.append(bm.verts.new(p))
                grid.append(row)
            for j in range(nv):
                for i in range(nu):
                    bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            cl = common.mesh_object(f"{name}-c{k}", bm, M.cloth(colors[k % len(colors)], None, "wool"), None)
            common.add_modifier(cl, "SOLIDIFY", thickness=0.008)
            objs.append(cl)
            x += w + 0.05
            k += 1
        return objs

    def _sacks(self, name, x, y):
        """Sacks: in a dyer's workshop, of alum and madder, rough and brown."""
        if not (self.roman and self.style == "home" and self.map.tiles("vat")):
            return super()._sacks(name, x, y)
        rng = self.rng
        objs = []
        fills = [M.plain("#e8e6dc", 0.4, 0.5), M.plain("#7a2e1e", 0.85)]
        for i in range(3):
            px = x + 0.22 + i * 0.28
            py = y + 0.4 + (i % 2) * 0.22
            h = 0.4 + rng.random() * 0.12
            prof = [(0.12, 0.0), (0.19, 0.06), (0.2, h * 0.6), (0.17, h * 0.92), (0.15, h), (0.16, h + 0.02)]
            objs.append(self._lathe(f"{name}-{i}", prof, self.P(px, py), M.burlap(["#7e6a4c", "#8a7454", "#76623e"][i % 3]), 20, tilt=(rng.random() - 0.5) * 0.12))
            objs.append(self._ellipsoid(f"{name}-fill{i}", self.P(px, py, h + 0.01), (0.14, 0.14, 0.035), fills[i % 2], 16, 6))
        return objs

    def _baskets(self, name, x, y):
        """Baskets: of chopped madder root in a dyer's workshop."""
        if not (self.roman and self.map.tiles("vat") and self.style == "home"):
            return super()._baskets(name, x, y)
        rng = self.rng
        objs = []
        root = M.plain("#8a3a24", 0.8)
        root2 = M.plain("#6a2a1a", 0.85)
        for i in range(2):
            px = x + 0.3 + i * 0.38
            py = y + 0.45 + (i % 2) * 0.15
            objs.append(self._lathe(f"{name}-{i}", [(0.12, 0), (0.19, 0.1), (0.2, 0.26), (0.21, 0.28)], self.P(px, py), M.straw("#a88a58"), 24))
            for q in range(40):
                ang = rng.random() * math.tau
                rad = rng.random() ** 0.5 * 0.17
                objs.append(self._ellipsoid(f"{name}-r{i}-{q}", self.P(px + math.cos(ang) * rad, py + math.sin(ang) * rad, 0.27 + (0.17 - rad) * 0.25), (0.035, 0.012, 0.012), root if q % 3 else root2, 6, 4))
        return objs

    # ── bushes ──────────────────────────────────────────────────────────────
    def tile_bush(self):
        """Shrubs: a clipped bay tree in a big terracotta planter where the
        street is paved; elsewhere a dense evergreen shrub of the hills
        (like myrtle and mastic), dark and glossy."""
        if not self.roman:
            return super().tile_bush()
        for x, y in self.map.tiles("bush"):
            name = f"bush-{x}-{y}"
            paved = sum(self.map.kind(x + dx, y + dy) == "paving" for dx in (-1, 0, 1) for dy in (-1, 0, 1)) >= 4
            objs = self._potted_bay(name, x, y) if paved else self.shrub(name, x + 0.5, y + 0.55, 0.9)
            self.sprite(name, y + 0.78, objs, [(x, y)])

    def shrub(self, name, cx, cy, size=1.0, dark=False):
        """A rounded evergreen shrub: a mound of small leaves on hidden stems."""
        rng = self.rng
        base = self.P(cx, cy)
        bm = bmesh.new()
        for k in range(7):
            a = rng.random() * math.tau
            r = rng.random() * 0.22 * size
            c = base + Vector((math.cos(a) * r, math.sin(a) * r * 0.8, (0.22 + rng.random() * 0.25) * size))
            sph = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=(0.2 + rng.random() * 0.12) * size)
            for v in sph["verts"]:
                v.co = Vector((v.co.x * 1.15, v.co.y, v.co.z * 0.85)) + c
        crown = common.mesh_object(f"{name}-crown", bm, self._mat("leaf-dark" if dark else "leaf"), None)
        scatter.scatter(crown, self._small_leaves(), 900.0 * size, (0.7, 1.2), seed=int(rng.random() * 999), sink=0.06, pick=True, keep=True)
        stems = bmesh.new()
        for k in range(5):
            a = rng.random() * math.tau
            self._tube(stems, [base + Vector((0, 0, -0.02)), base + Vector((math.cos(a) * 0.12, math.sin(a) * 0.1, 0.25 * size))], 0.018, seg=6)
        return [crown, common.mesh_object(f"{name}-stems", stems, M.bark("#5a4a3a"), None)]

    def _small_leaves(self):
        lib = self._library()
        if "roman-leaves" in lib:
            return lib["roman-leaves"]
        import bpy

        col = bpy.data.collections.new("roman-leaves")
        bpy.data.collections["library"].children.link(col)
        mats = [M.leaf("#34502a", "#7c8e62"), M.leaf("#3e5a2c", "#8a9a6a"), M.leaf("#2c4424", "#6a7a58")]
        for t in range(3):
            bm = bmesh.new()
            L = 0.045 + t * 0.008
            W = 0.016 + t * 0.003
            pts = [(0, 0), (W, L * 0.3), (W * 0.8, L * 0.75), (0, L), (-W * 0.8, L * 0.75), (-W, L * 0.3)]
            vs = [bm.verts.new((x, y, (y / L) ** 2 * 0.006)) for x, y in pts]
            bm.faces.new(vs)
            obj = common.mesh_object(f"rleaf{t}", bm, mats[t], None)
            for c in obj.users_collection:
                c.objects.unlink(obj)
            col.objects.link(obj)
        lib["roman-leaves"] = col
        return col

    def _potted_bay(self, name, x, y):
        objs = []
        c = self.P(x + 0.5, y + 0.55)
        pot = [(0.16, 0.0), (0.2, 0.05), (0.27, 0.3), (0.28, 0.5), (0.3, 0.53), (0.26, 0.54), (0.24, 0.5)]
        objs.append(self._lathe(f"{name}-pot", pot, c, M.terracotta("#b06a44", 0.35), 32))
        objs.append(self._ellipsoid(f"{name}-soil", c + Vector((0, 0, 0.5)), (0.24, 0.24, 0.02), self._mat("soil"), 20, 4))
        objs.append(self._branch(f"{name}-trunk", c + Vector((0, 0, 0.45)), c + Vector((0.02, 0.0, 1.15)), 0.035, 0.025, M.bark("#6a5a48"), 8, bow=0.02))
        rng = self.rng
        bm = bmesh.new()
        for k in range(6):
            a = rng.random() * math.tau
            cc = c + Vector((math.cos(a) * 0.12, math.sin(a) * 0.1, 1.35 + (rng.random() - 0.5) * 0.2))
            sph = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.2 + rng.random() * 0.06)
            for v in sph["verts"]:
                v.co = v.co + cc
        crown = common.mesh_object(f"{name}-crown", bm, self._mat("leaf-dark"), None)
        scatter.scatter(crown, self._small_leaves(), 1400.0, (0.8, 1.3), seed=int(rng.random() * 999), sink=0.05, pick=True, keep=True)
        objs.append(crown)
        return objs

    # ── stalls ──────────────────────────────────────────────────────────────
    def _stall(self, name, x0, x1, y):
        """A potter's trestle table of red-slip bowls, jugs and lamps under a
        linen awning (beside the jars), or a cloth merchant's counter with
        bolts of dyed wool (elsewhere)."""
        if not self.roman:
            return super()._stall(name, x0, x1, y)
        potter = self.map.near(x0, y, ("jars",), 2)
        objs = self._pottery_stall(name, x0, x1, y) if potter else self._cloth_counter(name, x0, x1, y)
        self.sprite(name, y + 0.95, objs, [(x, y) for x in range(x0, x1)])

    def _pottery_stall(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        wood = M.wood("#6e5236", 5.0)
        top_z = 0.68
        tb, tl = self._rbm()
        self._cbox(tb, tl, x0 + 0.04, y + 0.18, x1 - 0.04, y + 0.86, top_z - 0.04, top_z, chamfer=0.01)
        objs.append(self._obj(f"{name}-board", tb, wood))
        for lx in (x0 + 0.12, x1 - 0.12):
            lb = bmesh.new()
            self._tube(lb, [self.P(lx - 0.12, y + 0.5, 0.0), self.P(lx, y + 0.5, top_z - 0.04), self.P(lx + 0.12, y + 0.5, 0.0)], 0.02, seg=6)
            objs.append(common.mesh_object(f"{name}-trestle{lx:.1f}", lb, wood, None, smooth=True))
        slip = [M.terracotta("#a8452c", 0.05), M.terracotta("#b8583a", 0.05), M.terracotta("#9a3e28", 0.1)]
        # Stacks of red-slip bowls and plates, jugs and lamps.
        x = x0 + 0.16
        while x < x1 - 0.12:
            kind = rng.random()
            c = self.P(x, y + 0.35 + rng.random() * 0.35, top_z)
            mat = slip[int(rng.random() * 3)]
            if kind < 0.4:
                for k in range(4):
                    objs.append(self._lathe(f"{name}-bowl{x:.2f}-{k}", [(0.0, 0.0), (0.04, 0.0), (0.08, 0.035), (0.085, 0.045)], c + Vector((0, 0, k * 0.022)), mat, 20))
            elif kind < 0.7:
                objs.append(self._lathe(f"{name}-jug{x:.2f}", [(0.04, 0.0), (0.07, 0.05), (0.075, 0.12), (0.04, 0.18), (0.028, 0.22), (0.04, 0.24)], c, M.terracotta("#c08a60", 0.2), 20))
            else:
                for k in range(3):
                    objs.append(self._ellipsoid(f"{name}-lamp{x:.2f}-{k}", c + Vector((k * 0.07 - 0.07, 0.0, 0.02)), (0.035, 0.027, 0.016), M.terracotta("#b2714a", 0.05), 12, 6))
            x += 0.17 + rng.random() * 0.06
        # A linen awning on two poles.
        for px in (x0 + 0.04, x1 - 0.04):
            objs.append(self._branch(f"{name}-pole{px:.1f}", self.P(px, y + 0.9, 0.0), self.P(px, y + 0.9, 1.6), 0.02, 0.018, wood, 6, bow=0.0))
        aw = bmesh.new()
        nu, nv = 10, 6
        grid = []
        for j in range(nv + 1):
            t = j / nv
            row = []
            for i in range(nu + 1):
                u = i / nu
                sag = 0.05 * math.sin(math.pi * u) * math.sin(math.pi * t) + 0.02
                row.append(aw.verts.new(self.P(x0 - 0.05 + (x1 - x0 + 0.1) * u, y + 0.05 + 0.9 * t, 1.75 - 0.18 * t - sag)))
            grid.append(row)
        for j in range(nv):
            for i in range(nu):
                aw.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        awning = common.mesh_object(f"{name}-awning", aw, M.fabric_stripes(["#c4b08a", "#8a3024", "#c4b08a", "#3a4a64"], 0.09, f"awning-{name}"), None)
        common.add_modifier(awning, "SOLIDIFY", thickness=0.01)
        objs.append(awning)
        return objs

    def _cloth_counter(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        cb, cl = self._rbm()
        self._cbox(cb, cl, x0 + 0.04, y + 0.3, x1 - 0.04, y + 0.9, 0.0, 0.85, chamfer=0.02)
        objs.append(self._obj(f"{name}-counter", cb, R.stucco("#d6c8a8", "counter-stucco", dado="#7a3024", dado_h=0.8)))
        tb, tl = self._rbm()
        self._cbox(tb, tl, x0, y + 0.26, x1, y + 0.94, 0.85, 0.9, chamfer=0.01)
        objs.append(self._obj(f"{name}-top", tb, self._mat("marble")))
        dyes = ["#8a2418", "#2c3e6a", "#4a1e46", "#c49a3a", "#e6dcc4", "#5a6a3a"]
        for k in range(5):
            c = self.P(x0 + 0.18 + k * (x1 - x0 - 0.36) / 4, y + 0.55, 0.9 + 0.05)
            objs.append(common.box(f"{name}-bolt{k}", (0.14, 0.4, 0.09), c, R.wool(dyes[int(rng.random() * len(dyes))]), None, bevel=0.03))
        return objs

    # ── the story's props ───────────────────────────────────────────────────
    def entity_wool(self, name, x, y, e=None):
        """Skeins of wool: the spoiled batch still hanging on a peg-stand
        (dull, blotchy red), or a skein drying on a pole between forked
        posts (a clear, even red)."""
        spoiled = e is not None and "spoil" in e["id"]
        objs = []
        wood = M.wood("#6e5436", 4.0)
        if spoiled:
            c = self.P(x + 0.5, y + 0.6)
            objs.append(self._branch(f"{name}-post", c + Vector((0, 0, -0.02)), c + Vector((0, 0, 1.55)), 0.035, 0.03, wood, 8, bow=0.0))
            objs.append(self._branch(f"{name}-arm", c + Vector((-0.32, 0, 1.45)), c + Vector((0.32, 0, 1.45)), 0.022, 0.022, wood, 8, bow=0.0))
            fb, fl = self._rbm()
            self._cbox(fb, fl, x + 0.3, y + 0.4, x + 0.7, y + 0.8, 0.0, 0.06, chamfer=0.01)
            objs.append(self._obj(f"{name}-foot", fb, wood))
            for k, dx in enumerate((-0.22, -0.08, 0.08, 0.22)):
                objs.append(self.skein(f"{name}-s{k}", c + Vector((dx, 0, 1.43)), "#7a3a2c" if k % 2 else "#6e342a", 0.5, blotch=0.85, twist=0.3))
        else:
            for px in (x + 0.12, x + 0.88):
                objs.append(self._branch(f"{name}-post{px:.1f}", self.P(px, y + 0.5, -0.05), self.P(px, y + 0.5, 1.45), 0.035, 0.03, wood, 8, bow=0.0))
            objs.append(self._branch(f"{name}-pole", self.P(x + 0.06, y + 0.5, 1.42), self.P(x + 0.94, y + 0.5, 1.42), 0.024, 0.024, wood, 8, bow=0.0))
            for k, dx in enumerate((0.34, 0.5, 0.66)):
                objs.append(self.skein(f"{name}-s{k}", self.P(x + dx, y + 0.5, 1.4), "#9a2a1c", 0.55, twist=0.2))
        return objs

    def entity_tablets(self, name, x, y, e=None):
        """A pair of hinged wooden writing tablets lying open on a low
        stool, dark wax written over, a bronze stylus beside them."""
        objs = []
        wood = M.wood("#7a5634", 8.0)
        sb, sl = self._rbm()
        self._cbox(sb, sl, x + 0.22, y + 0.3, x + 0.78, y + 0.72, 0.3, 0.34, chamfer=0.01)
        objs.append(self._obj(f"{name}-stool", sb, wood))
        lb = bmesh.new()
        for lx, ly in ((x + 0.26, y + 0.34), (x + 0.74, y + 0.34), (x + 0.26, y + 0.68), (x + 0.74, y + 0.68)):
            self._tube(lb, [self.P(lx, ly, 0.0), self.P(lx, ly, 0.3)], 0.016, seg=6)
        objs.append(common.mesh_object(f"{name}-legs", lb, wood, None, smooth=True))
        wax = M.plain("#3a2a1c", 0.45, 0.4)
        for k, dx in enumerate((-0.12, 0.12)):
            c = self.P(x + 0.5 + dx, y + 0.5, 0.35)
            objs.append(common.box(f"{name}-leaf{k}", (0.22, 0.28, 0.02), c, wood, None, bevel=0.004))
            objs.append(common.box(f"{name}-wax{k}", (0.18, 0.24, 0.004), c + Vector((0, 0, 0.011)), wax, None))
            for line in range(5):
                objs.append(common.box(f"{name}-line{k}{line}", (0.13 - (line % 2) * 0.03, 0.006, 0.002), c + Vector((-0.01, 0.09 - line * 0.045, 0.014)), M.plain("#8a6a44", 0.6), None))
        objs.append(self._branch(f"{name}-stylus", self.P(x + 0.3, y + 0.68, 0.37), self.P(x + 0.62, y + 0.72, 0.37), 0.006, 0.004, self._mat("bronze"), 6, bow=0.0))
        return objs

    def entity_letter_sheets(self, name, x, y, e=None):
        """Kallias's rain-soaked letter on the scribe's table: five sheets of
        papyrus spread out, curling as they dry, the ink run in places, a
        reed pen across them. Stands on the table (drawn over it)."""
        rng = self.rng
        objs = []
        top_z = 0.725
        pap = R.papyrus()
        for k in range(5):
            cx = x + 0.28 + k * 0.1 + (rng.random() - 0.5) * 0.05
            cy = y + 0.46 + (rng.random() - 0.5) * 0.12
            a = (rng.random() - 0.5) * 0.5
            bm = bmesh.new()
            uvl = bm.loops.layers.uv.new("UVMap")
            nu, nv = 5, 6
            grid = []
            for j in range(nv + 1):
                row = []
                for i in range(nu + 1):
                    u, v = i / nu - 0.5, j / nv - 0.5
                    px, py = u * 0.2, v * 0.26
                    rx, ry = px * math.cos(a) - py * math.sin(a), px * math.sin(a) + py * math.cos(a)
                    curl = 0.02 * (abs(u) * 2) ** 2 + 0.01 * (abs(v) * 2) ** 3
                    row.append(bm.verts.new(self.P(cx + rx, cy + ry, top_z + 0.003 + k * 0.002 + curl)))
                grid.append(row)
            for j in range(nv):
                for i in range(nu):
                    f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                    for loop, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                        loop[uvl].uv = (ii / nu, jj / nv)
            objs.append(common.mesh_object(f"{name}-sheet{k}", bm, pap, None, smooth=True))
        objs.append(self._branch(f"{name}-pen", self.P(x + 0.3, y + 0.62, top_z + 0.03), self.P(x + 0.66, y + 0.4, top_z + 0.03), 0.005, 0.004, M.plain("#8a7a50", 0.7), 5, bow=0.0))
        return objs, (y + 0.95) * 32.0, False

    def entity_letter_bundle(self, name, x, y, e=None):
        """A bundle of letters for carrying: folded papyrus sheets tied with a
        cord and sealed, lying on a folded cloth."""
        objs = []
        c = self.P(x + 0.5, y + 0.5, self.floor_z(x, y))
        objs.append(common.box(f"{name}-cloth", (0.46, 0.34, 0.012), c + Vector((0, 0, 0.006)), M.cloth("#8a6a4a", None, "wool"), None))
        pap = R.papyrus()
        for k in range(4):
            objs.append(common.box(f"{name}-letter{k}", (0.26, 0.12, 0.02), c + Vector(((k - 1.5) * 0.02, (k - 1.5) * 0.015, 0.02 + k * 0.018)), pap, None, bevel=0.006))
        objs.append(common.box(f"{name}-cord", (0.3, 0.012, 0.012), c + Vector((0, 0, 0.1)), self._mat("rope"), None))
        objs.append(self._ellipsoid(f"{name}-seal", c + Vector((0.03, -0.02, 0.105)), (0.018, 0.018, 0.006), M.plain("#7a2a1c", 0.4), 10, 5))
        return objs, (y + 0.2) * 32.0, True

    def entity_vessels(self, name, x, y, e=None):
        """The alum jars by the water channel: a big jar and a small one with
        a dipper (the job not yet done), or the big jar filled to its mark
        with the milky alum bath and the small jar turned up to drain."""
        if not self.roman:
            return super().entity_vessels(name, x, y, e)
        done = e is not None and "bath" in e["id"]
        objs = []
        c = self.P(x + 0.42, y + 0.55)
        big = [(0.1, 0.0), (0.2, 0.06), (0.25, 0.2), (0.24, 0.36), (0.16, 0.46), (0.14, 0.5), (0.16, 0.52), (0.13, 0.52), (0.12, 0.47)]
        objs.append(self._lathe(f"{name}-big", big, c, M.terracotta("#b27850", 0.35), 32))
        level = 0.44 if done else 0.14
        objs.append(self._ellipsoid(f"{name}-bath", c + Vector((0, 0, level)), (0.2 if done else 0.18, 0.2 if done else 0.18, 0.004), R.dye("alum"), 24, 4))
        small = [(0.05, 0.0), (0.09, 0.04), (0.1, 0.14), (0.07, 0.22), (0.05, 0.26), (0.065, 0.28)]
        if done:
            jug = self._lathe(f"{name}-small", small, Vector((0, 0, 0)), M.terracotta("#c08a60", 0.2), 24)
            jug.data.transform(Matrix.Translation(c + Vector((0.45, -0.1, 0.28))) @ Matrix.Rotation(math.pi, 4, "X"))
            objs.append(jug)
        else:
            objs.append(self._lathe(f"{name}-small", small, c + Vector((0.42, -0.08, 0.0)), M.terracotta("#c08a60", 0.2), 24))
            objs.append(self._branch(f"{name}-handle", c + Vector((0.5, -0.08, 0.24)), c + Vector((0.53, -0.08, 0.1)), 0.015, 0.015, M.terracotta("#c08a60", 0.0), 6))
        # The channel's stone lip beside them.
        bm, layer = self._rbm()
        self._cbox(bm, layer, x + 0.72, y + 0.05, x + 0.98, y + 0.95, -0.02, 0.08, chamfer=0.02)
        objs.append(self._obj(f"{name}-lip", bm, self._mat("ashlar")))
        return objs

    def entity_pack_donkey(self, name, x, y, e=None):
        """A mule in profile (facing west): taller than a donkey, dark bay,
        with a donkey's long ears, a cropped mane and a pack saddle loaded
        with bales and a bundle of letters."""
        if not self.roman:
            return super().entity_pack_donkey(name, x, y, e)
        objs = []
        c = self.P(x + 0.5, y + 0.55)
        coat = M.cloth("#4e3626", None, "wool")
        dark = M.cloth("#2e221a", None, "wool")
        pale = M.cloth("#9a8472", None, "wool")
        hoof = M.plain("#2a2420", 0.6)
        objs.append(self._ellipsoid(f"{name}-body", c + Vector((0.05, 0, 0.92)), (0.52, 0.22, 0.25), coat, 26, 14))
        objs.append(self._ellipsoid(f"{name}-rump", c + Vector((0.4, 0, 0.95)), (0.2, 0.21, 0.23), coat, 18, 10))
        objs.append(self._ellipsoid(f"{name}-chest", c + Vector((-0.34, 0, 0.94)), (0.2, 0.2, 0.24), coat, 18, 10))
        objs.append(self._branch(f"{name}-neck", c + Vector((-0.4, 0, 1.02)), c + Vector((-0.64, 0, 1.36)), 0.13, 0.085, coat, 12))
        objs.append(self._branch(f"{name}-mane", c + Vector((-0.38, 0, 1.18)), c + Vector((-0.6, 0, 1.47)), 0.03, 0.025, dark, 8))
        head = c + Vector((-0.78, 0, 1.34))
        hd = self._ellipsoid(f"{name}-head", head, (0.24, 0.085, 0.1), coat, 18, 10)
        hd.data.transform(Matrix.Translation(head) @ Matrix.Rotation(0.75, 4, "Y") @ Matrix.Translation(-head))
        objs.append(hd)
        objs.append(self._ellipsoid(f"{name}-muzzle", c + Vector((-0.9, 0, 1.19)), (0.08, 0.075, 0.075), pale, 12, 8))
        for side in (-1, 1):
            ear = self._ellipsoid(f"{name}-ear{side}", c + Vector((-0.68, side * 0.05, 1.56)), (0.03, 0.022, 0.14), coat, 10, 6)
            ear.data.transform(Matrix.Translation(c + Vector((-0.68, side * 0.05, 1.56))) @ Matrix.Rotation(-0.3, 4, "Y") @ Matrix.Translation(-(c + Vector((-0.68, side * 0.05, 1.56)))))
            objs.append(ear)
        for lx in (-0.38, 0.42):
            for ly in (-0.12, 0.12):
                objs.append(self._branch(f"{name}-leg{lx}{ly}", c + Vector((lx, ly, 0.8)), c + Vector((lx + 0.01, ly, 0.08)), 0.07, 0.035, coat, 8))
                objs.append(self._lathe(f"{name}-hoof{lx}{ly}", [(0.042, 0), (0.036, 0.08)], c + Vector((lx + 0.01, ly, 0)), hoof, 10))
        objs.append(self._branch(f"{name}-tail", c + Vector((0.58, 0, 1.0)), c + Vector((0.66, 0, 0.5)), 0.035, 0.02, dark, 8))
        objs.append(common.box(f"{name}-saddle", (0.46, 0.5, 0.08), c + Vector((0.05, 0, 1.2)), self._mat("timber"), None, bevel=0.02))
        objs.append(common.box(f"{name}-pad", (0.56, 0.54, 0.03), c + Vector((0.05, 0, 1.16)), M.fabric_stripes(["#7a3a2c", "#c9b996", "#3c4c5e"], 0.06, "mule-pad"), None))
        for side in (-1, 1):
            bale = common.box(f"{name}-bale{side}", (0.44, 0.2, 0.34), c + Vector((0.05, side * 0.36, 0.98)), M.burlap("#9c8660"), None, bevel=0.06)
            objs.append(bale)
            objs.append(common.box(f"{name}-cord{side}", (0.02, 0.22, 0.35), c + Vector((0.05, side * 0.36, 0.98)), self._mat("rope"), None))
        objs.append(self._ellipsoid(f"{name}-bundle", c + Vector((0.05, 0, 1.34)), (0.2, 0.15, 0.09), M.leather("#6a4a2c"), 16, 8))
        return objs
