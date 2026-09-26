"""Mudbrick: an oasis town's houses, porticos and courtyard walls.

Regions of wall, roof and door tiles are read as:
  - a HOUSE: a block of roof tiles with a row of wall tiles along its south
    side (its front): mudbrick walls, a flat roof of palm-trunk beams, reeds
    and packed mud whose beam ends show under the eaves, a low parapet,
    a timber door and small grilled windows, and life on the roof;
  - a PORTICO: a block of roof tiles with no front wall (open to a
    courtyard): posts and a beam carrying a sloping roof of fronds from
    the wall behind it, deep shade underneath;
  - WALLS: every other wall tile: a courtyard wall of plastered mudbrick
    with a rounded coping. East-west runs are one sprite each; tiles of a
    north-south wall are a sprite each, so people walking beside them sort
    correctly row by row.
"""
import math

import bmesh
from mathutils import Vector

import common
import materials as M

WALL_H = 1.3  # courtyard walls: chest-high, so people behind them still show
WALL_T = 0.36


def B(x, y, z=0.0):
    return Vector((x, -y, z))


class MudbrickKit:
    def oasis_structures(self):
        m = self.map
        used = set()
        for reg in self.regions():
            cells = set(reg)
            roofs = self._roof_blocks(cells)
            for block in roofs:
                xs = [c[0] for c in block]
                ys = [c[1] for c in block]
                x0, x1, n, s = min(xs), max(xs) + 1, min(ys), max(ys)
                front = [(x, s + 1) for x in range(x0, x1) if (x, s + 1) in cells]
                if len(front) >= (x1 - x0) * 0.6:
                    house = set(block) | set(front)
                    self.mud_house(f"house-{x0}-{n}", x0, x1, n, s + 1, house)
                    used |= house
                else:
                    self.portico(f"portico-{x0}-{n}", x0, x1, n, s, cells)
                    used |= set(block)
            walls = [c for c in reg if c not in used and m.kind(*c) in ("wall", "door")]
            if walls:
                self.courtyard_walls(walls, cells)

    def _roof_blocks(self, cells):
        m = self.map
        roof = {c for c in cells if m.kind(*c) == "roof"}
        seen = set()
        out = []
        for c in sorted(roof):
            if c in seen:
                continue
            stack = [c]
            seen.add(c)
            block = []
            while stack:
                cx, cy = stack.pop()
                block.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nb = (cx + dx, cy + dy)
                    if nb in roof and nb not in seen:
                        seen.add(nb)
                        stack.append(nb)
            out.append(block)
        return out

    # ── a house ─────────────────────────────────────────────────────────────
    def mud_house(self, name, x0, x1, n, front_row, cells):
        """A mudbrick house whose roof covers rows n..front_row-1 and whose
        front stands on row `front_row` (see the module notes)."""
        m = self.map
        rng = self.rng
        ground_y = front_row + 0.92
        height = 2.45
        doors = [x for x in range(x0, x1) if m.kind(x, front_row) == "door"]
        objs = []
        # The walls: a box of mudbrick whose front face is the house front.
        depth_top = n + height  # the roof's north edge on the ground (sheared view)
        body = common.box(f"{name}-body", (x1 - x0, ground_y - depth_top, height), B((x0 + x1) / 2, (depth_top + ground_y) / 2, height / 2), self.brick, None)
        objs.append(body)
        # Door openings: dark doorways with a timber frame and a door leaf.
        for dx in doors:
            objs += self._mud_doorway(f"{name}-door{dx}", dx, ground_y, 1.9)
        # Small high windows with wooden grilles.
        for wx in range(x0 + 1, x1 - 1, 3):
            if all(abs(wx - d) > 1 for d in doors):
                objs += self._window(f"{name}-win{wx}", wx + 0.3, wx + 0.72, ground_y + 0.005, 1.45, 1.85, sill_mat=self.mudplaster)
        # Roof: beams across (ends out through the front), reeds, mud, parapet.
        roof_z = height
        slab = common.box(f"{name}-roof", (x1 - x0 + 0.1, ground_y - depth_top + 0.1, 0.12), B((x0 + x1) / 2, (depth_top + ground_y) / 2, roof_z + 0.06), self.roof, None)
        objs.append(slab)
        beam = M.wood("#5e4630", 3.5)
        bx = x0 + 0.25
        while bx < x1 - 0.1:
            end = self._branch(f"{name}-beam{bx:.1f}", B(bx, ground_y - 0.3, roof_z - 0.08), B(bx + (rng.random() - 0.5) * 0.03, ground_y + 0.18, roof_z - 0.09), 0.055, 0.05, beam, 8, bow=0.0)
            objs.append(end)
            bx += 0.42 + rng.random() * 0.08
        par = common.box(f"{name}-parapet-f", (x1 - x0, 0.14, 0.18), B((x0 + x1) / 2, ground_y - 0.07, roof_z + 0.2), self.brick, None, bevel=0.04)
        common.bake_modifiers(par)
        objs.append(par)
        for side_x in (x0 + 0.07, x1 - 0.07):
            p = common.box(f"{name}-parapet{side_x:.1f}", (0.14, ground_y - depth_top, 0.18), B(side_x, (depth_top + ground_y) / 2, roof_z + 0.2), self.brick, None, bevel=0.04)
            common.bake_modifiers(p)
            objs.append(p)
        objs.append(common.box(f"{name}-parapet-b", (x1 - x0, 0.14, 0.18), B((x0 + x1) / 2, depth_top + 0.07, roof_z + 0.2), self.brick, None))
        # Roof life: dates drying on mats, jars, a ladder's top, a reed shade.
        w = x1 - x0
        for i in range(max(1, w // 3)):
            sx = x0 + 0.5 + rng.random() * (w - 1.6)
            sy = depth_top + 0.3 + rng.random() * max(0.1, (ground_y - depth_top) - 0.9)
            if i % 2 == 0:
                objs.append(common.box(f"{name}-mat{i}", (0.9, 0.55, 0.012), B(sx + 0.45, sy + 0.28, roof_z + 0.126), M.straw("#b59d6a"), None))
                for k in range(26):
                    objs.append(self._ellipsoid(f"{name}-date{i}-{k}", B(sx + 0.08 + rng.random() * 0.74, sy + 0.08 + rng.random() * 0.4, roof_z + 0.14), (0.022, 0.014, 0.012), M.plain("#8a3e22", 0.5, 0.4), 8, 5))
            else:
                objs += self._jar_group(f"{name}-roofjars{i}", sx, sy, roof_z + 0.12, rng, count=2, at=B(sx, sy, 0))
        # A bench along the front, and a reed awning over the door.
        for dx in doors:
            aw = M.thatch("#a8905e", "awning-reed")
            a0, a1 = dx - 0.9, dx + 1.9
            bm = bmesh.new()
            v = [bm.verts.new(B(a0, ground_y - 0.02, 2.0)), bm.verts.new(B(a1, ground_y - 0.02, 2.0)), bm.verts.new(B(a1, ground_y + 0.75, 1.72)), bm.verts.new(B(a0, ground_y + 0.75, 1.72))]
            bm.faces.new(v[::-1])
            awning = common.mesh_object(f"{name}-awning{dx}", bm, aw, None)
            common.add_modifier(awning, "SOLIDIFY", thickness=0.03)
            objs.append(awning)
            for px in (a0 + 0.08, a1 - 0.08):
                objs.append(self._branch(f"{name}-apost{px:.1f}", B(px, ground_y + 0.72, 0.0), B(px, ground_y + 0.72, 1.74), 0.035, 0.03, beam, 6, bow=0.0))
            bench = common.box(f"{name}-bench{dx}", (1.3, 0.34, 0.36), B(dx + 1.95, ground_y + 0.17, 0.18), self.brick_bare, None, bevel=0.04)
            common.bake_modifiers(bench)
            objs.append(bench)
        self.sprite(name, ground_y, objs, sorted(cells))

    def _mud_doorway(self, name, dx, ground_y, height):
        objs = [common.box(f"{name}-dark", (0.82, 0.3, height), B(dx + 0.5, ground_y - 0.14, height / 2), self.dark, None)]
        frame = M.wood("#5a4230", 4.0)
        objs.append(common.box(f"{name}-lintel", (1.1, 0.16, 0.16), B(dx + 0.5, ground_y + 0.03, height + 0.08), frame, None, bevel=0.01))
        for side in (-1, 1):
            objs.append(common.box(f"{name}-jamb{side}", (0.09, 0.12, height), B(dx + 0.5 + side * 0.46, ground_y + 0.02, height / 2), frame, None))
        objs.append(common.box(f"{name}-sill", (0.95, 0.24, 0.05), B(dx + 0.5, ground_y + 0.04, 0.025), self.limestone, None, bevel=0.01))
        leaf = common.box(f"{name}-leaf", (0.06, 0.66, height - 0.1), B(dx + 0.12, ground_y - 0.36, (height - 0.1) / 2), M.wood("#6a4c32", 9.0), None, bevel=0.006)
        common.bake_modifiers(leaf)
        objs.append(leaf)
        # A curtain half drawn across the doorway.
        cur = common.box(f"{name}-curtain", (0.38, 0.02, height - 0.25), B(dx + 0.68, ground_y - 0.03, (height - 0.25) / 2 + 0.2), M.cloth("#4a5a6e", "#c9b48a", "wool", 0.1, 0.03), None)
        objs.append(cur)
        return objs

    # ── a portico ───────────────────────────────────────────────────────────
    def portico(self, name, x0, x1, n, s, cells):
        """An open-fronted roofed room in a courtyard: its roof slopes from the
        wall behind (north) down to a beam on posts along row s's south edge."""
        rng = self.rng
        front_y = s + 1.0
        back_y = n
        post_h = 1.85
        back_h = 2.25
        beam = M.wood("#5e4630", 3.5)
        objs = []
        # Deep shade inside: a dark back wall and floor under the roof.
        objs.append(common.box(f"{name}-backwall", (x1 - x0, 0.2, back_h), B((x0 + x1) / 2, back_y + 0.1, back_h / 2), self.brick, None))
        for px in [x0 + 0.1] + [x0 + k for k in range(1, x1 - x0)] + [x1 - 0.1]:
            objs.append(self._branch(f"{name}-post{px:.1f}", B(px, front_y - 0.1, 0.0), B(px, front_y - 0.1, post_h), 0.055, 0.05, beam, 8, bow=0.0))
        objs.append(common.box(f"{name}-beam", (x1 - x0 + 0.1, 0.12, 0.12), B((x0 + x1) / 2, front_y - 0.1, post_h + 0.06), beam, None))
        # Rafters from the wall to the beam, and dry palm fronds laid over them
        # (a matting of reeds under, then fronds, their leaflets hanging).
        for k in range(int((x1 - x0) / 0.5) + 1):
            rx = x0 + 0.1 + k * (x1 - x0 - 0.2) / max(1, int((x1 - x0) / 0.5))
            objs.append(self._branch(f"{name}-rafter{k}", B(rx, back_y + 0.05, back_h - 0.04), B(rx, front_y + 0.12, post_h + 0.02), 0.035, 0.03, beam, 6, bow=-0.02))
        mat_under = common.box(f"{name}-reeds", (x1 - x0 + 0.1, 0.02, 0.02), B((x0 + x1) / 2, back_y + 0.1, back_h), M.thatch("#8e7a50", "portico-reed"), None)
        objs.append(mat_under)
        bm = bmesh.new()
        rnd = bm.faces.layers.float.new("rand")
        slope = math.atan2(back_h - post_h, (front_y + 0.25) - back_y)
        x = x0 + 0.05
        while x < x1:
            # Laid from the wall down over the beam, leaflets spread flat.
            start = B(x + (rng.random() - 0.5) * 0.06, back_y + 0.05, back_h + 0.03)
            az = -math.pi / 2 + (rng.random() - 0.5) * 0.25
            length = (front_y + 0.35 - back_y) / math.cos(slope) + rng.random() * 0.2
            self._frond(bm, rnd, start, az, -slope + 0.06, length, 0.7 + rng.random() * 0.3, rng, droop=0.12, spread=0.75)
            x += 0.15 + rng.random() * 0.06
        fronds = common.mesh_object(f"{name}-fronds", bm, M.frond("#7a6844", "#5e5034"), None)
        objs.append(fronds)
        # Frond ends hanging over the front edge.
        fr = bmesh.new()
        x = x0
        while x < x1:
            p0 = B(x, front_y + 0.18, post_h + 0.06)
            p1 = p0 + Vector((0.02, -0.12, -0.2 - rng.random() * 0.12))
            v = [fr.verts.new(p0), fr.verts.new(p0 + Vector((0.06, 0, 0))), fr.verts.new(p1 + Vector((0.05, 0, 0))), fr.verts.new(p1)]
            fr.faces.new(v)
            x += 0.07
        objs.append(common.mesh_object(f"{name}-fringe", fr, M.thatch("#8e7a50", "portico-fringe"), None))
        # Things in the shade: a water jar on a stand, a folded mat, sacks.
        objs += self.storage_jar(f"{name}-jar", B(x0 + 0.6, back_y + 0.6, 0.0), 1.0, "#a86e4c")
        objs.append(common.box(f"{name}-mats", (0.8, 0.5, 0.12), B(x1 - 0.8, back_y + 0.5, 0.06), M.straw("#ad9464"), None))
        self.sprite(name, front_y, objs, sorted({(x, y) for x in range(x0, x1) for y in range(n, s + 1)}))

    # ── courtyard walls ─────────────────────────────────────────────────────
    def courtyard_walls(self, walls, region):
        """Plastered mudbrick walls with a rounded coping (see the module notes)."""
        m = self.map
        wset = set(walls)
        is_wall = lambda x, y: (x, y) in region and m.kind(x, y) in ("wall", "door")  # noqa: E731
        # East-west runs of two or more tiles.
        runs = []
        in_run = set()
        for y in sorted({c[1] for c in walls}):
            x = min(c[0] for c in walls) - 1
            xs = sorted(c[0] for c in walls if c[1] == y)
            i = 0
            while i < len(xs):
                j = i
                while j + 1 < len(xs) and xs[j + 1] == xs[j] + 1:
                    j += 1
                if j > i:
                    runs.append((xs[i], xs[j] + 1, y))
                    for k in range(xs[i], xs[j] + 1):
                        in_run.add((k, y))
                i = j + 1
            _ = x
        for x0, x1, y in runs:
            name = f"wall-{x0}-{y}"
            # Reach the outer edges where the run ends at a corner or open ground.
            objs = self._wall_segment(name, (x0, y + 0.5 - WALL_T / 2), (x1, y + 0.5 + WALL_T / 2), [(x, y) for x in range(x0, x1) if m.kind(x, y) == "door"])
            self.sprite(name, y + 0.5 + WALL_T / 2, objs, [(x, y) for x in range(x0, x1)])
        # Single tiles of north-south walls.
        for x, y in sorted(c for c in wset if c not in in_run):
            north = is_wall(x, y - 1)
            south = is_wall(x, y + 1)
            y0 = y - 0.5 + WALL_T / 2 if north else y + 0.5 - WALL_T / 2
            y1 = y + 0.5 + WALL_T / 2 if not south else y + 1.0
            if south and (x, y + 1) in in_run:
                y1 = y + 1.5 - WALL_T / 2
            name = f"wall-{x}-{y}"
            objs = self._wall_segment(name, (x + 0.5 - WALL_T / 2, y0), (x + 0.5 + WALL_T / 2, y1), [])
            self.sprite(name, y1, objs, [(x, y)])

    def _wall_segment(self, name, a, b, doors):
        """A wall filling the ground rectangle a..b (map x, y), WALL_H high,
        with a rounded coping, and gaps for doors."""
        (ax, ay), (bx, by) = a, b
        objs = []
        pieces = [(ax, bx)]
        for dx, _dy in doors:
            new = []
            for p0, p1 in pieces:
                if p0 < dx + 0.9 and p1 > dx + 0.1:
                    if dx + 0.1 > p0:
                        new.append((p0, dx + 0.1))
                    if p1 > dx + 0.9:
                        new.append((dx + 0.9, p1))
                else:
                    new.append((p0, p1))
            pieces = new
        rng = self.rng
        for i, (p0, p1) in enumerate(pieces):
            h = WALL_H + (rng.random() - 0.5) * 0.06
            body = common.box(f"{name}-{i}", (p1 - p0, by - ay, h), self.P((p0 + p1) / 2, (ay + by) / 2, h / 2), self.brick, None, bevel=0.03)
            common.bake_modifiers(body)
            objs.append(body)
            cap = self._branch(f"{name}-cap{i}", self.P(p0, (ay + by) / 2, h), self.P(p1, (ay + by) / 2, h), (by - ay) * 0.55, (by - ay) * 0.55, self.mudplaster, 10, bow=0.0)
            cap.scale = (1, 1, 1)
            if (p1 - p0) < (by - ay):
                cap = self._branch(f"{name}-cap{i}", self.P((p0 + p1) / 2, ay, h), self.P((p0 + p1) / 2, by, h), (p1 - p0) * 0.55, (p1 - p0) * 0.55, self.mudplaster, 10, bow=0.0)
            objs.append(cap)
        return objs

    def courtyard_gate(self, x, y):
        """A timber gate in a courtyard wall: stout posts, a lintel beam and a
        plank door standing open inward."""
        name = f"gate-{x}-{y}"
        frame = M.wood("#5a4230", 4.0)
        objs = []
        c0 = y + 0.5
        for side in (-1, 1):
            objs.append(common.box(f"{name}-pier{side}", (0.2, WALL_T + 0.1, WALL_H + 0.35), self.P(x + 0.5 + side * 0.5, c0, (WALL_H + 0.35) / 2), self.brick, None, bevel=0.03))
        objs.append(common.box(f"{name}-lintel", (1.3, 0.2, 0.16), self.P(x + 0.5, c0, WALL_H + 0.43), frame, None, bevel=0.01))
        leaf = common.box(f"{name}-leaf", (0.06, 0.78, WALL_H + 0.2), self.P(x + 0.14, c0 + 0.42, (WALL_H + 0.2) / 2), M.wood("#6a4c32", 9.0), None, bevel=0.006)
        common.bake_modifiers(leaf)
        objs.append(leaf)
        objs.append(common.box(f"{name}-sill", (0.9, 0.36, 0.04), self.P(x + 0.5, c0, 0.02), self.limestone, None, bevel=0.01))
        self.sprite(name, c0 + WALL_T / 2, objs, [(x, y)])

    def wattle(self, name, x0, x1, y):
        """A fence of palm ribs and reeds woven between posts, knee to hip high."""
        m = self.map
        vertical = (x1 - x0 == 1) and (m.kind(x0, y - 1) == "fence" or m.kind(x0, y + 1) == "fence")
        rng = self.rng
        post = M.wood("#6a5238", 3.0)
        rod = M.plain("#9c8456", 0.8)
        objs = []
        h = 0.78
        if vertical:
            a = (x0 + 0.5, y - (0.5 if m.kind(x0, y - 1) == "fence" else 0.0) + 0.05)
            b = (x0 + 0.5, y + 1.0 + (0.0 if m.kind(x0, y + 1) == "fence" else -0.05))
        else:
            a = (x0 + 0.05, y + 0.5)
            b = (x1 - 0.05, y + 0.5)
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(2, int(L / 0.5) + 1)
        for k in range(n):
            t = k / (n - 1)
            px, py = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            objs.append(self._branch(f"{name}-post{k}", self.P(px, py, -0.05), self.P(px + (rng.random() - 0.5) * 0.03, py, h + 0.08), 0.035, 0.03, post, 6, bow=0.0))
        bm = bmesh.new()
        for r in range(7):
            z = 0.1 + r * 0.1
            pts = []
            steps = int(L / 0.08) + 2
            for k in range(steps + 1):
                t = k / steps
                px, py = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                weave = 0.03 * math.sin(t * L / 0.5 * math.pi + r * math.pi)
                if vertical:
                    px += weave
                else:
                    py += weave
                pts.append(self.P(px, py, z + (rng.random() - 0.5) * 0.01))
            for p, q in zip(pts, pts[1:]):
                d = q - p
                side = Vector((0, 0, 0.012))
                v = [bm.verts.new(p - side), bm.verts.new(q - side), bm.verts.new(q + side), bm.verts.new(p + side)]
                bm.faces.new(v)
        objs.append(common.mesh_object(f"{name}-rods", bm, rod, None))
        return objs

    # ── dressing ────────────────────────────────────────────────────────────
    def dress_oasis(self):
        """Fallen fronds and dates under the palms, leaf litter under the figs,
        wet earth around the well and the trough, straw in the inn yard."""
        m = self.map
        rng = self.rng
        dry = M.thatch("#9a8254", "fallen-frond")
        for x, y in m.tiles("palm"):
            for k in range(1 + int(rng.random() * 2)):
                a = rng.random() * math.tau
                c = self.P(x + 0.5 + math.cos(a) * 0.9, y + 0.5 + math.sin(a) * 0.6, 0.012)
                if not m.walkable(int(c.x), int(-c.y)) and m.kind(int(c.x), int(-c.y)) != "palm":
                    continue
                bm = bmesh.new()
                d = Vector((math.cos(a + 1.2), math.sin(a + 1.2), 0))
                side = Vector((-d.y, d.x, 0))
                for s in range(8):
                    p = c + d * (s * 0.12)
                    for sgn in (-1, 1):
                        q = p + side * sgn * 0.16 + d * 0.06
                        v = [bm.verts.new(p), bm.verts.new(p + d * 0.02), bm.verts.new(q + d * 0.02), bm.verts.new(q)]
                        bm.faces.new(v)
                self.ground_objects.append(common.mesh_object(f"frond-{x}-{y}-{k}", bm, dry, self.col_ground))
        wet = M.plain("#5c4c3a", 0.35, 0.45)
        for kind in ("well", "trough"):
            for x, y in m.tiles(kind):
                self.to_ground(self._ellipsoid(f"wet-{x}-{y}", self.P(x + 0.5, y + 1.05, 0.04), (0.55, 0.3, 0.002), wet, 20, 4))
        straw = M.plain("#c2a86a", 0.8, 0.2)
        bm = bmesh.new()
        for x, y in m.tiles("paving"):
            if rng.random() < 0.35:
                for _ in range(6):
                    cx, cy = x + rng.random(), y + rng.random()
                    a = rng.random() * math.tau
                    ln = 0.03 + rng.random() * 0.05
                    dx, dy = math.cos(a) * ln / 2, math.sin(a) * ln / 2
                    v = [bm.verts.new(self.P(cx - dx, cy - dy - 0.003, 0.045)), bm.verts.new(self.P(cx + dx, cy + dy - 0.003, 0.045)), bm.verts.new(self.P(cx + dx, cy + dy + 0.003, 0.045)), bm.verts.new(self.P(cx - dx, cy - dy + 0.003, 0.045))]
                    bm.faces.new(v)
        self.ground_objects.append(common.mesh_object("yard-straw", bm, straw, self.col_ground, smooth=False))
