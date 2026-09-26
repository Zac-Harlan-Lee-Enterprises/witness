"""Props: the market's stalls, pottery, sacks, baskets, crates, well, oven,
tent, trough, cloth racks, cart and animals; furniture (tables, a loom);
cairns and rocks; and the story entities placed by the chapters (signs,
vessels, clues on the road, a satchel, a broom, bedrolls, donkeys).

Tile builders (`tile_<kind>`) register one sprite per tile or per run;
entity builders (`entity_<sprite>`) return the objects of one entity
sprite, or (objects, base_row_in_game_units, flat)."""
import math

import bmesh
from mathutils import Matrix, Vector

import common
import materials as M
import rocks


class PropsKit:
    # ── pottery and goods ───────────────────────────────────────────────────
    def _jar_group(self, name, x, y, z, rng, count=3, at=None):
        objs = []
        clays = ["#b06a44", "#a8765a", "#c08a60", "#9a5e3e"]
        for i in range(count):
            size = 0.55 + rng.random() * 0.5
            px = x + 0.18 + i * 0.26 + (rng.random() - 0.5) * 0.08
            py = y + 0.35 + (rng.random() - 0.5) * 0.2
            kind = rng.random()
            if kind < 0.45:
                prof = [(0.05, 0), (0.12, 0.05), (0.15, 0.2), (0.14, 0.32), (0.08, 0.4), (0.055, 0.44), (0.065, 0.46)]
            elif kind < 0.8:
                prof = [(0.01, 0), (0.05, 0.04), (0.12, 0.16), (0.13, 0.28), (0.09, 0.38), (0.045, 0.46), (0.045, 0.52), (0.06, 0.54)]
            else:
                prof = [(0.06, 0), (0.13, 0.05), (0.16, 0.13), (0.12, 0.2), (0.12, 0.23)]
            prof = [(r * size, h * size) for r, h in prof]
            mat = M.terracotta(clays[int(rng.random() * len(clays))], 0.5)
            pos = self.P(px, py, z) if at is None else at + Vector((px - x, -(py - y), z))
            objs.append(self._lathe(f"{name}-{i}", prof, pos, mat, 28, tilt=(rng.random() - 0.5) * 0.08))
        return objs

    def storage_jar(self, name, at, size=1.0, clay="#b07450", lid=False, dusty=0.45):
        """A tall storage jar (pithos) with a rolled rim, for houses and courtyards."""
        prof = [(0.06, 0), (0.12, 0.04), (0.19, 0.18), (0.21, 0.34), (0.19, 0.5), (0.12, 0.6), (0.085, 0.64), (0.1, 0.66), (0.1, 0.68)]
        prof = [(r * size, h * size) for r, h in prof]
        objs = [self._lathe(f"{name}", prof, at, M.terracotta(clay, dusty), 32)]
        if lid:
            objs.append(self._lathe(f"{name}-lid", [(0.0, 0.0), (0.11 * size, 0.0), (0.1 * size, 0.02 * size), (0.0, 0.04 * size)], at + Vector((0, 0, 0.68 * size)), M.terracotta("#9c6a4a", 0.2), 20))
        return objs

    def tile_jars(self):
        """Pottery: groups of storage jars, amphorae and cooking pots (city,
        oasis), or tall storage jars along the walls (home)."""
        rng = self.rng
        for x, y in self.map.tiles("jars"):
            name = f"jars-{x}-{y}"
            if self.style == "home":
                objs = self.storage_jar(f"{name}-a", self.P(x + 0.34, y + 0.5), 1.25, "#a86e4c")
                objs += self.storage_jar(f"{name}-b", self.P(x + 0.7, y + 0.62), 0.9, "#b98258", lid=True)
                objs += self._jar_group(f"{name}-s", x + 0.35, y + 0.55, 0.0, rng, count=1)
            else:
                objs = self._jar_group(name, x, y, 0.0, rng)
            self.sprite(name, y + 0.9, objs, [(x, y)])

    def tile_sacks(self):
        """Grain sacks, one open with grain showing."""
        for x, y in self.map.tiles("sacks"):
            self.sprite(f"sacks-{x}-{y}", y + 0.9, self._sacks(f"sacks-{x}-{y}", x, y), [(x, y)])

    def _sacks(self, name, x, y):
        rng = self.rng
        objs = []
        for i in range(3):
            px = x + 0.22 + i * 0.28
            py = y + 0.4 + (i % 2) * 0.22
            h = 0.36 + rng.random() * 0.12
            prof = [(0.1, 0.0), (0.17, 0.05), (0.18, h * 0.6), (0.14, h * 0.9), (0.08, h), (0.1, h + 0.02)]
            objs.append(self._lathe(f"{name}-{i}", prof, self.P(px, py), M.burlap(["#a48c64", "#9a845c", "#b29a70"][i % 3]), 20, tilt=(rng.random() - 0.5) * 0.15))
            if i == 1:
                objs.append(self._ellipsoid(f"{name}-grain", self.P(px, py, h + 0.015), (0.09, 0.09, 0.03), M.plain("#b8903e", 0.8)))
        return objs

    def tile_basket(self):
        """Baskets of produce (city, oasis) or of seeds and roots (home)."""
        for x, y in self.map.tiles("basket"):
            self.sprite(f"basket-{x}-{y}", y + 0.85, self._baskets(f"basket-{x}-{y}", x, y), [(x, y)])

    def _baskets(self, name, x, y):
        rng = self.rng
        objs = []
        fills = ["#4a2a36", "#8a2f2a", "#5a5a2e"] if self.style != "home" else ["#8a6a3a", "#6a5a3a", "#b0924e"]
        for i in range(2):
            px = x + 0.3 + i * 0.38
            py = y + 0.45 + (i % 2) * 0.15
            objs.append(self._lathe(f"{name}-{i}", [(0.1, 0), (0.17, 0.08), (0.18, 0.18), (0.19, 0.2)], self.P(px, py), M.straw(), 24))
            mat = M.plain(fills[int(rng.random() * 3)], 0.55, 0.35)
            for q in range(12):
                ang = rng.random() * math.tau
                rad = rng.random() ** 0.5 * 0.13
                objs.append(self._ellipsoid(f"{name}-f{i}-{q}", self.P(px + math.cos(ang) * rad, py + math.sin(ang) * rad, 0.2 + (0.13 - rad) * 0.3), (0.035, 0.035, 0.03), mat, 8, 6))
        return objs

    def tile_crate(self):
        """Stacked wooden crates."""
        for x, y in self.map.tiles("crate"):
            objs = []
            for i, (dx, dy, dz) in enumerate(((0.3, 0.5, 0.0), (0.68, 0.55, 0.0), (0.48, 0.52, 0.3))):
                c = common.box(f"crate-{x}-{y}-{i}", (0.34, 0.3, 0.3), self.P(x + dx, y + dy, dz + 0.15), M.wood("#7a5c3c", 8.0), None, bevel=0.012)
                common.bake_modifiers(c)
                objs.append(c)
            self.sprite(f"crate-{x}-{y}", y + 0.9, objs, [(x, y)])

    # ── the market ──────────────────────────────────────────────────────────
    def tile_stall(self):
        """Market stalls: posts, a counter on trestles, a sagging striped
        awning with a valance, and trays of produce. One sprite per run."""
        for x0, x1, y in self.map.runs("stall"):
            self._stall(f"stall-{x0}-{y}", x0, x1, y)

    def _stall(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        front = y + 0.92
        back = y + 0.12
        w = x1 - x0
        post = M.wood("#5e4430", 4.0)
        for px in [x0 + 0.08] + [x0 + k for k in range(1, w)] + [x1 - 0.08]:
            for py, hgt in ((front, 1.28), (back, 1.55)):
                objs.append(common.box(f"{name}-post{px:.2f}-{py:.2f}", (0.06, 0.06, hgt), self.P(px, py, hgt / 2), post, None))
        objs.append(common.box(f"{name}-counter", (w - 0.1, 0.62, 0.05), self.P((x0 + x1) / 2, y + 0.55, 0.52), self.wood, None, bevel=0.01))
        objs.append(common.box(f"{name}-front", (w - 0.14, 0.03, 0.45), self.P((x0 + x1) / 2, y + 0.86, 0.26), post, None))
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
                seg = (u * w) % 1.0
                sag = 0.05 * math.sin(math.pi * seg) + 0.035 * math.sin(math.pi * t)
                row.append(bm.verts.new(self.P(ax, ay, az - sag)))
            grid.append(row)
        for j in range(segs_y):
            for i in range(segs_x):
                bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        last = grid[-1]
        drop = [bm.verts.new(v.co + Vector((0, -0.01, -0.13 - 0.02 * math.sin(k)))) for k, v in enumerate(last)]
        for i in range(segs_x):
            bm.faces.new((last[i], last[i + 1], drop[i + 1], drop[i]))
        awning = common.mesh_object(f"{name}-awning", bm, cloth, None)
        common.add_modifier(awning, "SOLIDIFY", thickness=0.012)
        objs.append(awning)
        produce = [("#8a2f2a", 0.045), ("#4a2a36", 0.035), ("#6a4a2a", 0.03), ("#5a5a2e", 0.028), ("#b98a4a", 0.04), ("#c9b27a", 0.03)]
        for k in range(w * 2):
            cx = x0 + 0.3 + k * (w - 0.5) / max(1, w * 2 - 1)
            color, r = produce[int(rng.random() * len(produce))]
            objs.append(self._lathe(f"{name}-tray{k}", [(0.0, 0.0), (0.16, 0.0), (0.2, 0.05)], self.P(cx, y + 0.5, 0.545), M.straw("#a88a58"), 20))
            mat = M.plain(color, 0.55, 0.35)
            for q in range(18):
                ang = rng.random() * math.tau
                rad = rng.random() ** 0.5 * 0.15
                hz = 0.56 + r + (0.15 - rad) * 0.5
                objs.append(self._ellipsoid(f"{name}-p{k}-{q}", self.P(cx + math.cos(ang) * rad, y + 0.5 + math.sin(ang) * rad * 0.8, hz), (r, r, r * 0.9), mat, 10, 6))
        self.sprite(name, y + 0.95, objs, [(x, y) for x in range(x0, x1)])

    def tile_well(self):
        """A well: a stone ring, water, posts, a beam and a leather bucket
        (city, oasis); a rock-cut cistern mouth with a capstone and a trough
        (wilderness)."""
        for x, y in self.map.tiles("well"):
            if self.style == "wilderness":
                self.sprite(f"well-{x}-{y}", y + 0.85, self.cistern(f"well-{x}-{y}", x, y), [(x, y)])
            else:
                self.sprite(f"well-{x}-{y}", y + 0.85, self._well(f"well-{x}-{y}", x, y), [(x, y)])

    def _well(self, name, x, y):
        rng = self.rng
        objs = []
        c = self.P(x + 0.5, y + 0.55)
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
        objs.append(self._lathe(f"{name}-bucket", [(0.06, 0), (0.08, 0.12), (0.085, 0.13)], c + Vector((0.3, -0.28, 0.44)), M.leather("#5a3c24"), 16))
        return objs

    def cistern(self, name, x, y):
        """A rock-cut cistern on the ridge: a low round kerb of rough stones
        around a dark mouth, a flat capstone pushed aside, and a stone basin."""
        rng = self.rng
        objs = []
        c = self.P(x + 0.5, y + 0.55)
        rockm = M.rock("#c4b596", "cistern-stone", lichen=0.25)
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        for k in range(11):
            a = math.tau * k / 11 + rng.random() * 0.2
            sph = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
            s = (0.11 + rng.random() * 0.04, 0.09 + rng.random() * 0.03, 0.08 + rng.random() * 0.03)
            cc = c + Vector((math.cos(a) * 0.36, math.sin(a) * 0.3, 0.06))
            r = rng.random()
            for v in sph["verts"]:
                nn = math.sin(v.co.x * 5 + k) * 0.1 + math.sin(v.co.y * 6 + k * 2) * 0.08
                v.co = Vector((v.co.x * s[0] * (1 + nn), v.co.y * s[1] * (1 + nn), max(-0.3, v.co.z) * s[2] * (1 + nn))) + cc
            for f in bm.faces:
                if f.verts[0] in sph["verts"]:
                    f[layer] = r
        objs.append(common.mesh_object(f"{name}-kerb", bm, rockm, None))
        objs.append(self._ellipsoid(f"{name}-mouth", c + Vector((0, 0, 0.01)), (0.27, 0.22, 0.01), M.plain("#171210", 0.9, 0.1), 24, 6))
        objs.append(self._ellipsoid(f"{name}-water", c + Vector((0, 0, -0.02)), (0.2, 0.16, 0.004), M.water(), 20, 4))
        cap = common.box(f"{name}-cap", (0.46, 0.4, 0.09), c + Vector((0.42, 0.32, 0.05)), rockm, None, bevel=0.03)
        cap.rotation_euler = (0, 0.06, 0.4)
        common.bake_modifiers(cap)
        objs.append(cap)
        basin = self._lathe(f"{name}-basin", [(0.0, 0.0), (0.16, 0.0), (0.19, 0.08), (0.2, 0.12), (0.15, 0.12), (0.12, 0.05)], c + Vector((-0.4, -0.3, 0.0)), rockm, 18)
        objs.append(basin)
        objs.append(self._ellipsoid(f"{name}-basin-water", c + Vector((-0.4, -0.3, 0.1)), (0.14, 0.14, 0.004), M.water(), 16, 4))
        return objs

    def tile_oven(self):
        """A domed clay bread oven with a glowing mouth, ash and loaves on a
        board (city, oasis); a tannur by the wall (home)."""
        for x, y in self.map.tiles("oven"):
            if self.style == "home":
                self.sprite(f"oven-{x}-{y}", y + 0.85, self.tannur(f"oven-{x}-{y}", x, y), [(x, y)])
            else:
                self.sprite(f"oven-{x}-{y}", y + 0.85, self._oven(f"oven-{x}-{y}", x, y), [(x, y)])

    def _oven(self, name, x, y):
        objs = []
        c = self.P(x + 0.5, y + 0.5)
        objs.append(self._lathe(f"{name}-dome", [(0.36, 0), (0.37, 0.12), (0.32, 0.28), (0.2, 0.38), (0.1, 0.42), (0.08, 0.43)], c, M.terracotta("#a0684a", 0.6), 28))
        objs.append(self._ellipsoid(f"{name}-mouth", c + Vector((0, -0.3, 0.14)), (0.12, 0.08, 0.1), M.emissive("#ff7a30", 3.0), 16, 8))
        objs.append(self._ellipsoid(f"{name}-ash", c + Vector((0.05, -0.42, 0.01)), (0.22, 0.12, 0.01), M.plain("#6e675e", 0.95), 16, 6))
        objs.append(common.box(f"{name}-board", (0.42, 0.24, 0.03), c + Vector((0.32, -0.36, 0.2)), self.wood, None))
        for k in range(4):
            objs.append(self._ellipsoid(f"{name}-bread{k}", c + Vector((0.2 + k * 0.08, -0.36 + (k % 2) * 0.05, 0.225)), (0.07, 0.07, 0.012), M.plain("#b98a52", 0.7), 14, 6))
        return objs

    def tile_tent(self):
        """A goat-hair tent: a black-brown striped roof on poles, guy ropes, a rug."""
        for x0, x1, y in self.map.runs("tent"):
            self.sprite(f"tent-{x0}-{y}", y + 0.95, self._tent(f"tent-{x0}-{y}", x0, x1, y), [(x, y) for x in range(x0, x1)])

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
                row.append(bm.verts.new(self.P(x0 - 0.05 + (w + 0.1) * u, yy, zz - sag)))
            rows.append(row)
        for a, b in zip(rows, rows[1:]):
            for i in range(segs):
                bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
        roof = common.mesh_object(f"{name}-roof", bm, hair, None)
        common.add_modifier(roof, "SOLIDIFY", thickness=0.015)
        objs.append(roof)
        objs.append(common.box(f"{name}-inside", (w - 0.2, 0.5, 0.8), self.P(x0 + w / 2, y + 0.45, 0.4), self.dark, None))
        for k in range(w + 1):
            px = x0 + k * w / w if k else x0 + 0.05
            objs.append(common.box(f"{name}-pole{k}", (0.05, 0.05, 1.28), self.P(min(px, x1 - 0.05), y + 0.35, 0.64), self.wood, None))
        for k in range(w + 1):
            px = x0 + k
            objs.append(self._branch(f"{name}-rope{k}", self.P(px, y + 0.9, 0.84), self.P(px + 0.1, y + 1.25, 0.0), 0.006, 0.006, M.plain("#8a7550", 0.9), 5))
        objs.append(common.box(f"{name}-rug", (0.9, 0.5, 0.01), self.P(x0 + w / 2, y + 0.7, 0.01), M.fabric_stripes(["#7a3a2c", "#c9b996", "#3c4c5e"], 0.05, "tent-rug"), None))
        return objs

    def tile_trough(self):
        """A stone watering trough."""
        for x, y in self.map.tiles("trough"):
            name = f"trough-{x}-{y}"
            c = self.P(x + 0.5, y + 0.5)
            t = common.box(f"{name}-stone", (0.86, 0.36, 0.3), c + Vector((0, 0, 0.15)), self.limestone, None, bevel=0.02)
            common.bake_modifiers(t)
            self._rand_attr(t, 0.3)
            objs = [t, common.box(f"{name}-water", (0.74, 0.24, 0.01), c + Vector((0, 0, 0.27)), M.water(), None)]
            self.sprite(name, y + 0.8, objs, [(x, y)])

    def tile_cloth(self):
        """Racks of dyed cloth drying on poles (the weavers' corner)."""
        for x0, x1, y in self.map.runs("cloth"):
            self.sprite(f"cloth-{x0}-{y}", y + 0.7, self._cloth_rack(f"cloth-{x0}-{y}", x0, x1, y), [(x, y) for x in range(x0, x1)])

    def _cloth_rack(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        w = x1 - x0
        for px in (x0 + 0.12, x1 - 0.12):
            objs.append(common.box(f"{name}-post{px:.1f}", (0.06, 0.06, 1.3), self.P(px, y + 0.5, 0.65), self.wood, None))
        objs.append(common.box(f"{name}-pole", (w - 0.1, 0.05, 0.05), self.P(x0 + w / 2, y + 0.5, 1.28), self.wood, None))
        dyes = ["#7e3b2c", "#3d4d66", "#b08a3e", "#d9ceb5", "#5b6438", "#6a4a5a"]
        k = 0
        x = x0 + 0.2
        while x < x1 - 0.3:
            cw = 0.32 + rng.random() * 0.14
            color = dyes[int(rng.random() * len(dyes))]
            bm = bmesh.new()
            cols, rows = 8, 10
            length = 0.7 + rng.random() * 0.35
            grid = []
            for j in range(rows + 1):
                t = j / rows
                row = []
                for i in range(cols + 1):
                    u = i / cols
                    fold = 0.03 * math.sin(u * math.tau * 2 + k) * (0.3 + t)
                    row.append(bm.verts.new(self.P(x + cw * u, y + 0.5 + fold, 1.26 - length * t)))
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

    def tile_cart(self):
        """A two-wheeled cart with shafts and a load of sacks."""
        for x, y in self.map.tiles("cart"):
            self.sprite(f"cart-{x}-{y}", y + 0.9, self._cart(f"cart-{x}-{y}", x, y), [(x, y)])

    def _cart(self, name, x, y, e=None):
        objs = []
        c = self.P(x + 0.5, y + 0.55)
        objs.append(common.box(f"{name}-bed", (0.95, 0.6, 0.06), c + Vector((0, 0, 0.42)), self.wood, None))
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
            objs.append(common.mesh_object(f"{name}-wheel{side}", wheel, self.wood, None))
            for k in range(6):
                a = k * math.pi / 3
                objs.append(self._branch(f"{name}-spoke{side}{k}", c + Vector((0.05, side * 0.36, 0.3)), c + Vector((0.05 + math.cos(a) * 0.28, side * 0.36, 0.3 + math.sin(a) * 0.28)), 0.012, 0.012, self.wood, 5))
        for side in (-1, 1):
            objs.append(self._branch(f"{name}-shaft{side}", c + Vector((-0.45, side * 0.2, 0.44)), c + Vector((-1.1, side * 0.25, 0.3)), 0.025, 0.02, self.wood, 6))
        for k in range(3):
            objs.append(self._ellipsoid(f"{name}-load{k}", c + Vector((-0.2 + k * 0.22, 0, 0.58)), (0.12, 0.2, 0.12), M.burlap("#a48c64"), 14, 8))
        return objs

    # ── furniture ───────────────────────────────────────────────────────────
    def tile_table(self):
        """A low wooden table (a board on short legs) with a bowl, a cup and
        bread; one sprite per run."""
        rng = self.rng
        for x0, x1, y in self.map.runs("table"):
            name = f"table-{x0}-{y}"
            w = x1 - x0
            objs = []
            top_z = 0.42
            top = common.box(f"{name}-top", (w - 0.16, 0.62, 0.05), self.P((x0 + x1) / 2, y + 0.55, top_z), M.wood("#6a4a30", 7.0), None, bevel=0.012)
            common.bake_modifiers(top)
            objs.append(top)
            for lx in (x0 + 0.14, x1 - 0.14):
                for ly in (y + 0.3, y + 0.8):
                    objs.append(common.box(f"{name}-leg{lx:.1f}{ly:.1f}", (0.06, 0.06, top_z), self.P(lx, ly, top_z / 2), M.wood("#5a3e28", 5.0), None))
            for k in range(w):
                cx = x0 + 0.35 + k * 0.9 + rng.random() * 0.2
                bowl = self._lathe(f"{name}-bowl{k}", [(0.0, 0.0), (0.06, 0.0), (0.12, 0.05), (0.13, 0.07), (0.12, 0.07), (0.06, 0.02)], self.P(cx, y + 0.5, top_z + 0.025), M.terracotta("#b27a52", 0.1), 24)
                objs.append(bowl)
                if k % 2 == 0:
                    for q in range(5):
                        objs.append(self._ellipsoid(f"{name}-olive{k}-{q}", self.P(cx + (rng.random() - 0.5) * 0.12, y + 0.5 + (rng.random() - 0.5) * 0.1, top_z + 0.07), (0.018, 0.014, 0.014), M.plain("#3a3a22", 0.4, 0.4), 8, 6))
                else:
                    objs.append(self._ellipsoid(f"{name}-bread{k}", self.P(cx + 0.02, y + 0.52, top_z + 0.06), (0.09, 0.09, 0.018), M.plain("#b98a52", 0.7), 14, 6))
                cup = self._lathe(f"{name}-cup{k}", [(0.0, 0.0), (0.035, 0.0), (0.045, 0.07), (0.04, 0.075)], self.P(cx + 0.28, y + 0.62, top_z + 0.025), M.terracotta("#a86a48", 0.1), 16)
                objs.append(cup)
            self.sprite(name, y + 0.9, objs, [(x, y) for x in range(x0, x1)])

    def tile_loom(self):
        """An upright warp-weighted loom against the wall: two posts, a beam,
        the warp threads, clay loom weights and a length of striped cloth."""
        for x, y in self.map.tiles("loom"):
            name = f"loom-{x}-{y}"
            objs = []
            c = self.P(x + 0.5, y + 0.4)
            timber = M.wood("#6e5034", 4.0)
            for side in (-1, 1):
                post = common.box(f"{name}-post{side}", (0.07, 0.07, 1.75), c + Vector((side * 0.42, 0.05, 0.86)), timber, None)
                post.rotation_euler = (-0.12, 0, 0)
                objs.append(post)
            objs.append(common.box(f"{name}-beam", (0.98, 0.08, 0.08), c + Vector((0, 0.13, 1.68)), timber, None))
            objs.append(common.box(f"{name}-shed", (0.9, 0.04, 0.04), c + Vector((0, 0.02, 0.9)), timber, None))
            cloth = common.box(f"{name}-cloth", (0.8, 0.012, 0.55), c + Vector((0, 0.1, 1.36)), M.fabric_stripes(["#3f5068", "#d6c7a8", "#8e4a3a", "#d6c7a8"], 0.11, f"loom-cloth-{x}"), None)
            cloth.rotation_euler = (-0.12, 0, 0)
            objs.append(cloth)
            warp = M.plain("#d8cdb4", 0.8)
            for k in range(20):
                wx = -0.38 + k * 0.04
                objs.append(self._branch(f"{name}-warp{k}", c + Vector((wx, 0.07, 1.08)), c + Vector((wx, -0.02, 0.36)), 0.004, 0.004, warp, 4, bow=0.0))
            clay = M.terracotta("#9a6444", 0.2)
            for k in range(10):
                wx = -0.36 + k * 0.08
                objs.append(self._ellipsoid(f"{name}-weight{k}", c + Vector((wx, -0.03, 0.3 - (k % 2) * 0.03)), (0.035, 0.02, 0.05), clay, 10, 6))
            self.sprite(name, y + 0.75, objs, [(x, y)])

    # ── stones ──────────────────────────────────────────────────────────────
    def boulder(self, name, at, size, mat, seed, flat=0.55, blocky=0.65, sink=0.25):
        """An angular limestone boulder standing on the ground point `at`,
        `size` = half-extents (x, y, z), sunk a little into the ground."""
        return rocks.stone(name, at, size, mat, int(seed * 1000) % 100000, flat=flat, blocky=blocky, sink=sink)

    def tile_rock(self):
        """Rocks and boulders: two limestone rocks (city), or a cluster of
        weathered boulders of the ground's own stone (wilderness, oasis)."""
        rng = self.rng
        for x, y in self.map.tiles("rock"):
            name = f"rock-{x}-{y}"
            objs = []
            if self.style == "city":
                for i in range(2):
                    bm = bmesh.new()
                    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
                    s = (0.26 + rng.random() * 0.12, 0.22 + rng.random() * 0.1, 0.16 + rng.random() * 0.08)
                    for v in bm.verts:
                        n = math.sin(v.co.x * 5 + i) * 0.08 + math.sin(v.co.y * 7) * 0.06 + math.sin(v.co.z * 6 + 2) * 0.05
                        v.co = Vector((v.co.x * s[0] * (1 + n), v.co.y * s[1] * (1 + n), max(-0.02, v.co.z * s[2] * (1 + n))))
                    bmesh.ops.translate(bm, vec=self.P(x + 0.35 + i * 0.3, y + 0.5 + i * 0.1, 0.06), verts=bm.verts)
                    rock = common.mesh_object(f"{name}-{i}", bm, self.limestone, None)
                    self._rand_attr(rock)
                    objs.append(rock)
            else:
                red = 0.5 if self.map.near(x, y, ("cliff",), 2) else 0.0
                mat = M.rock("#c9b99a", f"boulder-{int(red * 10)}", lichen=0.3, red=red)
                big = 0.36 + rng.random() * 0.14
                objs.append(self.boulder(f"{name}-0", self.P(x + 0.5, y + 0.55), (big, big * 0.8, big * 0.75), mat, rng.random() * 10))
                for i in range(1 + int(rng.random() * 3)):
                    s = 0.1 + rng.random() * 0.12
                    a = rng.random() * math.tau
                    objs.append(self.boulder(f"{name}-{i + 1}", self.P(x + 0.5 + math.cos(a) * 0.38, y + 0.6 + math.sin(a) * 0.25), (s, s * 0.85, s * 0.6), mat, rng.random() * 10))
            self.sprite(name, y + 0.8, objs, [(x, y)])

    def tile_cairn(self):
        """A cairn: three flat stones carefully stacked beside the path."""
        rng = self.rng
        for x, y in self.map.tiles("cairn"):
            name = f"cairn-{x}-{y}"
            mat = M.rock("#cdbd9d", "cairn-stone", lichen=0.2)
            objs = []
            z = 0.0
            for i, (w, h) in enumerate(((0.26, 0.09), (0.21, 0.08), (0.16, 0.075), (0.1, 0.06))):
                objs.append(self.boulder(f"{name}-{i}", self.P(x + 0.5 + (rng.random() - 0.5) * 0.05, y + 0.55 + (rng.random() - 0.5) * 0.04, z), (w, w * 0.82, h), mat, i * 3.1 + x, flat=0.5, blocky=0.85, sink=0.0))
                z += h * 0.97
            for i in range(6):
                a = rng.random() * math.tau
                s = 0.05 + rng.random() * 0.06
                objs.append(self.boulder(f"{name}-p{i}", self.P(x + 0.5 + math.cos(a) * 0.34, y + 0.6 + math.sin(a) * 0.22), (s, s * 0.9, s * 0.55), mat, i + 7.0))
            self.sprite(name, y + 0.8, objs, [(x, y)])

    # ── story entities ──────────────────────────────────────────────────────
    def entity_vessels(self, name, x, y, e=None):
        """Ezer's crock and pitcher (the measuring puzzle)."""
        objs = []
        c = self.P(x + 0.4, y + 0.55)
        prof = [(0.1, 0), (0.22, 0.06), (0.26, 0.2), (0.24, 0.34), (0.15, 0.42), (0.13, 0.46), (0.15, 0.48)]
        objs.append(self._lathe(f"{name}-crock", prof, c, M.terracotta("#a86a48", 0.4), 32))
        prof2 = [(0.05, 0), (0.09, 0.05), (0.1, 0.14), (0.06, 0.22), (0.05, 0.27), (0.065, 0.29)]
        objs.append(self._lathe(f"{name}-pitcher", prof2, c + Vector((0.42, -0.08, 0)), M.terracotta("#b87c56", 0.3), 24))
        objs.append(self._branch(f"{name}-handle", c + Vector((0.5, -0.08, 0.24)), c + Vector((0.53, -0.08, 0.1)), 0.015, 0.015, M.terracotta("#b87c56", 0.0), 6))
        return objs

    def entity_sign(self, name, x, y, e=None):
        """A wooden sign board on a post."""
        objs = []
        c = self.P(x + 0.5, y + 0.6)
        objs.append(common.box(f"{name}-post", (0.07, 0.07, 1.05), c + Vector((0, 0, 0.52)), self.wood, None))
        board = common.box(f"{name}-board", (0.6, 0.04, 0.3), c + Vector((0, -0.05, 0.9)), M.wood("#8a6a48", 9.0), None, bevel=0.01)
        common.bake_modifiers(board)
        objs.append(board)
        for k in range(3):
            objs.append(common.box(f"{name}-cut{k}", (0.4 - k * 0.08, 0.005, 0.018), c + Vector((0, -0.075, 0.97 - k * 0.07)), M.plain("#3a2a1c", 0.9), None))
        if self.style == "wilderness":
            # A wayside marker: stones heaped around the foot of the post.
            mat = M.rock("#c9b99a", "sign-stone")
            for i in range(5):
                a = i * math.tau / 5
                objs.append(self.boulder(f"{name}-st{i}", c + Vector((math.cos(a) * 0.12, math.sin(a) * 0.1, 0.0)), (0.08, 0.07, 0.06), mat, i * 2.3))
        return objs

    def entity_donkey(self, name, x, y, e=None, packed=True):
        """A pack donkey in profile (facing west), grey-brown with a pale
        muzzle, with panniers on a wooden pack saddle."""
        objs = []
        c = self.P(x + 0.5, y + 0.55)
        fur = M.cloth("#7b6f60", None, "wool")
        pale = M.cloth("#c8bca8", None, "wool")
        hoof = M.plain("#2e2622", 0.6)
        objs.append(self._ellipsoid(f"{name}-body", c + Vector((0.05, 0, 0.66)), (0.4, 0.19, 0.2), fur, 24, 12))
        objs.append(self._ellipsoid(f"{name}-belly", c + Vector((0.05, 0, 0.56)), (0.3, 0.16, 0.1), pale, 18, 8))
        objs.append(self._branch(f"{name}-neck", c + Vector((-0.28, 0, 0.72)), c + Vector((-0.46, 0, 0.98)), 0.1, 0.07, fur, 10))
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
        objs.append(common.box(f"{name}-saddle", (0.34, 0.42, 0.06), c + Vector((0.05, 0, 0.86)), self.wood, None))
        if packed:
            for side in (-1, 1):
                objs.append(self._lathe(f"{name}-pannier{side}", [(0.1, 0), (0.14, 0.1), (0.15, 0.24)], c + Vector((0.05, side * 0.24, 0.52)), M.straw(), 18))
            objs.append(self._ellipsoid(f"{name}-bundle", c + Vector((0.05, 0, 0.98)), (0.18, 0.16, 0.1), M.burlap("#9c8660"), 16, 8))
        else:
            objs.append(common.box(f"{name}-blanket", (0.4, 0.46, 0.02), c + Vector((0.05, 0, 0.9)), M.fabric_stripes(["#7a3a2c", "#c9b996"], 0.06, "donkey-blanket"), None))
        return objs

    def entity_pack_donkey(self, name, x, y, e=None):
        """Malik's pack donkey, loaded for the caravan."""
        objs = self.entity_donkey(name, x, y, e, packed=True)
        c = self.P(x + 0.5, y + 0.55)
        objs.append(self._ellipsoid(f"{name}-bale2", c + Vector((0.12, 0, 1.12)), (0.14, 0.13, 0.08), M.burlap("#8e7a58"), 14, 8))
        return objs

    def entity_basket(self, name, x, y, e=None):
        """By place: trade bales (city), herb baskets with drying bundles
        (home), or a basket of dates."""
        if e is not None and e["id"] == "cart":
            return self._cart(name, x, y)
        if self.style == "city":
            return self._bales(name, x, y)
        if self.style == "home":
            return self.herb_baskets(name, x, y)
        return self._baskets(name, x, y)

    def _bales(self, name, x, y):
        objs = []
        for k, (dx, dy, dz) in enumerate(((0.3, 0.45, 0.0), (0.7, 0.55, 0.0), (0.5, 0.5, 0.26))):
            bale = common.box(f"{name}-{k}", (0.4, 0.3, 0.26), self.P(x + dx, y + dy, dz + 0.13), M.burlap(["#9c8660", "#a8916a", "#8e7a58"][k]), None, bevel=0.05)
            common.bake_modifiers(bale)
            objs.append(bale)
            objs.append(common.box(f"{name}-cord{k}", (0.02, 0.32, 0.27), self.P(x + dx, y + dy, dz + 0.13), M.plain("#6e5a3e", 0.9), None))
        return objs

    def entity_pack(self, name, x, y, e=None):
        """The travel satchel: a leather bag with a flap and a long strap,
        beside a folded cloak and a water skin, ready to be packed."""
        objs = []
        c = self.P(x + 0.5, y + 0.55)
        leather = M.leather("#6a4628")
        bag = common.box(f"{name}-bag", (0.34, 0.16, 0.26), c + Vector((0, 0, 0.13)), leather, None, bevel=0.05)
        common.bake_modifiers(bag)
        objs.append(bag)
        flap = common.box(f"{name}-flap", (0.33, 0.1, 0.02), c + Vector((0, -0.04, 0.265)), M.leather("#5a3a20"), None, bevel=0.008)
        flap.rotation_euler = (0.35, 0, 0)
        objs.append(flap)
        objs.append(self._ellipsoid(f"{name}-buckle", c + Vector((0, -0.085, 0.2)), (0.02, 0.008, 0.02), M.plain("#b89a5a", 0.35, 0.6), 8, 6))
        strap = [c + Vector((-0.17, 0, 0.24)), c + Vector((-0.3, -0.1, 0.02)), c + Vector((0.05, -0.28, 0.01)), c + Vector((0.2, -0.08, 0.02)), c + Vector((0.17, 0, 0.24))]
        for i in range(len(strap) - 1):
            objs.append(self._branch(f"{name}-strap{i}", strap[i], strap[i + 1], 0.012, 0.012, M.leather("#5a3a20"), 5, bow=0.0))
        cloak = common.box(f"{name}-cloak", (0.3, 0.22, 0.07), c + Vector((0.28, 0.12, 0.035)), M.cloth("#7a4a34", None, "wool"), None, bevel=0.03)
        common.bake_modifiers(cloak)
        objs.append(cloak)
        return objs

    # Clues on the road: things lying on the ground. Low, so people can stand
    # on them: flat sprites that sort by their northern edge.
    def entity_prints(self, name, x, y, e=None):
        """Sandal prints pressed into the dust: shallow, darker, smoother
        hollows (heel and forefoot) with a little dust pushed up around
        them; one line of them, or a trampled crowd."""
        rng = self.rng
        many = e is not None and "many" in e["id"]
        mat = M.plain("#9a876a", 0.85, 0.12)
        objs = []
        n = 16 if many else 6
        for k in range(n):
            if many:
                px, py = x + 0.12 + rng.random() * 0.76, y + 0.1 + rng.random() * 0.8
                a = -1.4 + rng.random() * 0.7
            else:
                px, py = x + 0.36 + (k % 2) * 0.2, y + 0.02 + k * 0.17
                a = math.pi / 2 + (rng.random() - 0.5) * 0.2
            for sub, (off, r) in enumerate(((0.0, 0.032), (0.07, 0.026))):
                cx = px + math.cos(a) * off
                cy = py + math.sin(a) * off
                objs.append(self._ellipsoid(f"{name}-{k}-{sub}", self.P(cx, cy, 0.003), (r * 1.1, r * 0.8, 0.0025), mat, 12, 4))
        return objs, y * 32.0, True

    def entity_drag(self, name, x, y, e=None):
        """Scuffed drag marks: two ragged shallow furrows through the dust
        (heels dragged), crossing over the footprints, leading off the road."""
        rng = self.rng
        mat = M.plain("#9c8a70", 0.92, 0.1)
        ridge = M.plain("#c9b894", 0.95, 0.1)
        objs = []
        for side in (-0.09, 0.09):
            bm = bmesh.new()
            rb = bmesh.new()
            prev = prevr = None
            steps = 14
            for i in range(steps + 1):
                t = i / steps
                cx = x + 0.15 + t * 0.7 + side
                cy = y + 0.05 + t * 0.9 + math.sin(t * 5 + side * 20) * 0.04
                w = 0.05 + rng.random() * 0.015
                row = [bm.verts.new(self.P(cx - w, cy + w * 0.3, 0.003)), bm.verts.new(self.P(cx + w, cy - w * 0.3, 0.003))]
                rrow = [rb.verts.new(self.P(cx + w, cy - w * 0.3, 0.005)), rb.verts.new(self.P(cx + w * 1.5, cy - w * 0.45, 0.003))]
                if prev:
                    bm.faces.new((prev[0], prev[1], row[1], row[0]))
                    rb.faces.new((prevr[0], prevr[1], rrow[1], rrow[0]))
                prev, prevr = row, rrow
            objs.append(common.mesh_object(f"{name}-f{side}", bm, mat, None))
            objs.append(common.mesh_object(f"{name}-r{side}", rb, ridge, None))
        return objs, y * 32.0, True

    def entity_broken_jar(self, name, x, y, e=None):
        """A broken oil jar: curved shards of terracotta scattered round its
        neck, and a dark, irregular stain where the oil soaked into the dust."""
        rng = self.rng
        bm = bmesh.new()
        c = (x + 0.5, y + 0.55)
        ring = []
        n = 24
        centre = bm.verts.new(self.P(c[0], c[1], 0.003))
        for k in range(n):
            a = math.tau * k / n
            r = 0.3 + 0.08 * math.sin(a * 3 + 1) + 0.05 * math.sin(a * 5) + rng.random() * 0.03
            ring.append(bm.verts.new(self.P(c[0] + math.cos(a) * r * 1.2, c[1] + math.sin(a) * r * 0.8, 0.002)))
        for k in range(n):
            bm.faces.new((centre, ring[k], ring[(k + 1) % n]))
        objs = [common.mesh_object(f"{name}-stain", bm, M.plain("#8a7456", 0.55, 0.3), None)]
        clay = M.terracotta("#b27850", 0.3)
        inside = M.terracotta("#8a5a3c", 0.1)
        for k in range(7):
            a0 = rng.random() * math.tau
            r = 0.13 + rng.random() * 0.05
            h = 0.1 + rng.random() * 0.06
            sweep = 0.9 + rng.random() * 0.7
            sb = bmesh.new()
            rows = []
            for j in range(4):
                t = j / 3
                row = []
                for i in range(6):
                    u = a0 + sweep * i / 5
                    rr = r * (1 - 0.15 * t)
                    row.append(sb.verts.new((math.cos(u) * rr, math.sin(u) * rr, t * h)))
                rows.append(row)
            for j in range(3):
                for i in range(5):
                    sb.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
            px, py = x + 0.25 + rng.random() * 0.5, y + 0.3 + rng.random() * 0.45
            obj = common.mesh_object(f"{name}-shard{k}", sb, clay, None)
            obj.data.materials.append(inside)
            common.add_modifier(obj, "SOLIDIFY", thickness=0.012)
            # Lying on its side, rocked a little.
            from mathutils import Matrix as _Mx

            obj.data.transform(_Mx.Translation(self.P(px, py, 0.0)) @ _Mx.Rotation(rng.random() * math.tau, 4, "Z") @ _Mx.Rotation(1.3 + rng.random() * 0.3, 4, "X"))
            objs.append(obj)
        objs.append(self._lathe(f"{name}-neck", [(0.055, 0.0), (0.05, 0.07), (0.07, 0.09)], self.P(x + 0.64, y + 0.5, 0.05), clay, 16, tilt=1.45, spin=0.5))
        return objs, y * 32.0, True

    def entity_purse(self, name, x, y, e=None):
        """An empty leather purse with its strings cut, lying open."""
        objs = []
        c = self.P(x + 0.5, y + 0.55)
        bag = self._ellipsoid(f"{name}-bag", c + Vector((0, 0, 0.025)), (0.1, 0.08, 0.03), M.leather("#6a4a2c"), 16, 8)
        objs.append(bag)
        objs.append(self._ellipsoid(f"{name}-mouth", c + Vector((0.02, -0.06, 0.03)), (0.05, 0.02, 0.015), M.plain("#2a1c12", 0.8), 12, 6))
        for k in range(2):
            objs.append(self._branch(f"{name}-string{k}", c + Vector((0.04, -0.07, 0.03)), c + Vector((0.12 + k * 0.05, -0.16 + k * 0.04, 0.005)), 0.004, 0.004, M.leather("#4a3220"), 4, bow=0.0))
        return objs, y * 32.0, True

    def entity_cloth(self, name, x, y, e=None):
        """A thornbush with a torn strip of cloth caught on it (a blue stripe)."""
        objs = self.desert_bush(name, x, y, size=0.8)
        strip = []
        c = self.P(x + 0.5, y + 0.5)
        bm = bmesh.new()
        grid = []
        for j in range(7):
            t = j / 6
            row = []
            for i in range(3):
                u = i / 2
                row.append(bm.verts.new(c + Vector((-0.1 + t * 0.34, -0.1 - u * 0.07, 0.42 - t * 0.3 + math.sin(t * 7) * 0.03))))
            grid.append(row)
        for j in range(6):
            for i in range(2):
                bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        rag = common.mesh_object(f"{name}-rag", bm, M.cloth("#6f5a3a", "#3f6f8f", "wool", 0.0, 0.2), None)
        common.add_modifier(rag, "SOLIDIFY", thickness=0.006)
        strip.append(rag)
        return objs + strip

    def entity_stone(self, name, x, y, e=None):
        """A standing lump of rock: red-stained near the red cliffs."""
        red = 0.6 if self.map.near(x, y, ("cliff",), 2) else 0.0
        mat = M.rock("#c6b494", f"entity-stone-{int(red * 10)}", lichen=0.2, red=red)
        s = 0.3
        return [
            self.boulder(f"{name}-0", self.P(x + 0.5, y + 0.55), (s, s * 0.75, s * 1.2), mat, x * 1.3 + y, flat=0.8),
            self.boulder(f"{name}-1", self.P(x + 0.8, y + 0.72), (0.12, 0.1, 0.08), mat, x + 4.0),
        ]

    def entity_mud_line(self, name, x, y, e=None):
        """A fresh tide line of mud, twigs and pebbles along the wadi's wall."""
        rng = self.rng
        mud = M.plain("#6a553c", 0.55, 0.3)
        twig = M.wood("#5a4630", 3.0)
        objs = []
        for k in range(10):
            t = k / 9
            objs.append(self._ellipsoid(f"{name}-m{k}", self.P(x + 0.05 + t * 0.9, y + 0.3 + math.sin(t * 6) * 0.08, 0.01), (0.09, 0.05, 0.012), mud, 10, 4))
        for k in range(5):
            a = rng.random() * math.pi
            p = self.P(x + 0.1 + rng.random() * 0.8, y + 0.28 + rng.random() * 0.12, 0.02)
            objs.append(self._branch(f"{name}-t{k}", p, p + Vector((math.cos(a) * 0.14, math.sin(a) * 0.05, 0.0)), 0.006, 0.004, twig, 4, bow=0.0))
        return objs, y * 32.0, True

    def entity_waterskin(self, name, x, y, e=None):
        """A goatskin water bag lying on its side, its neck tied."""
        c = self.P(x + 0.5, y + 0.55)
        skin = M.leather("#5b3b24")
        objs = [self._ellipsoid(f"{name}-bag", c + Vector((0, 0, 0.08)), (0.2, 0.13, 0.08), skin, 20, 10)]
        objs.append(self._branch(f"{name}-neck", c + Vector((0.18, 0.02, 0.08)), c + Vector((0.28, 0.04, 0.1)), 0.035, 0.025, skin, 8))
        objs.append(self._ellipsoid(f"{name}-tie", c + Vector((0.28, 0.04, 0.1)), (0.02, 0.03, 0.03), M.plain("#3a2616", 0.8), 8, 6))
        return objs, y * 32.0, True

    def entity_bread_cloth(self, name, x, y, e=None):
        """Bread and dates on an unfolded cloth."""
        rng = self.rng
        c = self.P(x + 0.5, y + 0.5)
        objs = [common.box(f"{name}-cloth", (0.5, 0.36, 0.01), c + Vector((0, 0, 0.006)), M.cloth("#d8cdb0", "#8a4f2f", "linen", 0.3, 0.04), None)]
        for k in range(2):
            objs.append(self._ellipsoid(f"{name}-loaf{k}", c + Vector((-0.1 + k * 0.16, 0.03, 0.03)), (0.08, 0.08, 0.025), M.plain("#b0804a", 0.7), 14, 6))
        for k in range(9):
            objs.append(self._ellipsoid(f"{name}-date{k}", c + Vector((0.08 + rng.random() * 0.12, -0.06 - rng.random() * 0.08, 0.02)), (0.02, 0.012, 0.012), M.plain("#5a2e1c", 0.4, 0.4), 8, 6))
        return objs, y * 32.0, True

    def entity_broom(self, name, x, y, e=None):
        """A broom of bound palm fibre on a stick, leaning where it was left."""
        c = self.P(x + 0.5, y + 0.55)
        objs = [self._branch(f"{name}-stick", c + Vector((-0.3, 0.1, 0.02)), c + Vector((0.2, -0.05, 0.03)), 0.014, 0.012, M.wood("#7a5634", 3.0), 6, bow=0.0)]
        head = self._lathe(f"{name}-head", [(0.02, 0.0), (0.05, 0.08), (0.1, 0.2), (0.11, 0.22)], c + Vector((0.2, -0.05, 0.03)), M.straw("#a88a58"), 16)
        head.data.transform(Matrix.Translation(c + Vector((0.2, -0.05, 0.03))) @ Matrix.Rotation(-1.45, 4, "Y") @ Matrix.Translation(-(c + Vector((0.2, -0.05, 0.03)))))
        objs.append(head)
        return objs, y * 32.0, True

    def entity_bedroll(self, name, x, y, e=None):
        """A sleeping mat: a rush mat with a folded striped blanket."""
        c = self.P(x + 0.5, y + 0.5)
        objs = [common.box(f"{name}-mat", (0.95, 0.62, 0.02), c + Vector((0, 0, 0.012)), M.straw("#b39a68"), None)]
        blanket = common.box(f"{name}-blanket", (0.4, 0.58, 0.05), c + Vector((0.24, 0.0, 0.045)), M.textile(["#7a3a2c", "#c9b996", "#3c4c5e", "#c9b996"], "bedroll-blanket", band=0.12), None, bevel=0.02)
        common.bake_modifiers(blanket)
        objs.append(blanket)
        return objs, y * 32.0, True

    def entity_lamp(self, name, x, y, e=None):
        """A clay oil lamp (unlit) on a flat stone at the roadside."""
        c = self.P(x + 0.5, y + 0.55)
        objs = [self.boulder(f"{name}-stone", c, (0.18, 0.15, 0.07), M.rock("#c6b494", "lamp-stone"), 3.3, flat=0.4, sink=0.1)]
        lamp = self._ellipsoid(f"{name}-lamp", c + Vector((0, 0, 0.14)), (0.07, 0.05, 0.03), M.terracotta("#b2714a", 0.1), 16, 8)
        objs.append(lamp)
        objs.append(self._ellipsoid(f"{name}-nozzle", c + Vector((0.07, 0, 0.14)), (0.035, 0.025, 0.02), M.terracotta("#a8683f", 0.1), 10, 6))
        return objs

    def entity_clouds(self, name, x, y, e=None):
        """A flat-topped boulder to stand by and look back west, where dark
        clouds hang over the hills."""
        mat = M.rock("#c6b494", "lookout", lichen=0.3)
        return [self.boulder(f"{name}-0", self.P(x + 0.5, y + 0.55), (0.42, 0.34, 0.24), mat, 5.5, flat=0.45)]

    def entity_scroll(self, name, x, y, e=None):
        c = self.P(x + 0.5, y + 0.55)
        return [common.box(f"{name}-sheet", (0.3, 0.2, 0.005), c + Vector((0, 0, 0.01)), M.plain("#e6d6b0", 0.8), None)], y * 32.0, True
