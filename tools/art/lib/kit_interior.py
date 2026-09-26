"""A room seen in cutaway (the home style).

The camera looks north and down into the room, so:
  - the BACK (north) wall stands full height and shows its plastered face:
    niches with a lamp and bowls, pegs with bundles of drying herbs, a
    shelf, soot above the oven;
  - the SIDE and FRONT walls are cut down to a low stub (their cut tops
    show the wall's thickness); at full height they are invisible to the
    camera but still block light, and so is the roof. The room is lit as
    if closed: by a sunbeam through a window in the east wall, daylight
    through the open door, an oil lamp in a niche and the embers of the
    oven, with a little dust in the air to show the beam;
  - people are lit to match by the indoor variant of their sheets.

Wall tiles on the map's top rows are the back wall; the columns at either
edge are the side walls; the bottom row is the front wall, with the door."""
import math

import bmesh
import bpy
from mathutils import Vector

import common
import materials as M

ROOM_H = 2.7
STUB_H = 0.42
WALL_T = 0.45  # the light-blocking walls (thinner than a tile)


def B(x, y, z=0.0):
    return Vector((x, -y, z))


class InteriorKit:
    def room_shell(self):
        m = self.map
        rng = self.rng
        walls = set(m.tiles("wall"))
        doors = set(m.tiles("door"))
        back_rows = [y for y in range(m.h) if all(m.kind(x, y) == "wall" for x in range(m.w))]
        back = max(back_rows) + 1 if back_rows and back_rows[0] == 0 else 1
        front = m.h - 1
        west, east = 1, m.w - 1
        self.exposure = 3.5
        plaster = self.plaster
        stone = M.limestone("#bba98a", "cut-stone", worn=0.6)
        cut = M.limestone("#a8977a", "wall-cut", worn=0.6)
        # The back wall: plastered face at y = back, rising off the top of the view.
        face = common.box("back-wall", (m.w, 0.5, ROOM_H + 0.6), B(m.w / 2, back - 0.25, (ROOM_H + 0.6) / 2), plaster, None)
        self.to_ground(face)
        # A plinth of dark, scuffed plaster where the floor meets the wall.
        self.to_ground(common.box("back-plinth", (m.w - 2, 0.04, 0.18), B(m.w / 2, back - 0.01, 0.09), M.lime_plaster("#9c8a70", "plinth", grime=0.7), None))
        # Side and front walls: invisible full walls (light), visible cut stubs.
        for x0, x1 in ((0, west), (east, m.w)):
            # The wall that blocks light is thinner than its tile (about 0.45 m,
            # at the room's inner face), so low sun still slants through a window.
            wx0, wx1 = (x1 - WALL_T, x1) if x0 == 0 else (x0, x0 + WALL_T)
            full = common.box(f"side-{x0}", (wx1 - wx0, m.h - back + 1, ROOM_H), B((wx0 + wx1) / 2, (back + m.h) / 2 - 0.5, ROOM_H / 2), plaster, None)
            if x0 == east:
                full = self._window_wall(full, x0, x1, back)
            self.occluder(full)
            stub = common.box(f"side-stub-{x0}", (x1 - x0, m.h - back, STUB_H), B((x0 + x1) / 2, (back + m.h) / 2, STUB_H / 2), stone, None, bevel=0.03)
            common.bake_modifiers(stub)
            self._rand_attr(stub)
            self.to_ground(stub)
            self.to_ground(common.box(f"side-cut-{x0}", (x1 - x0 - 0.06, m.h - back - 0.06, 0.01), B((x0 + x1) / 2, (back + m.h) / 2, STUB_H + 0.005), cut, None))
        door_xs = sorted(x for x, y in doors)
        gaps = [(door_xs[0], door_xs[-1] + 1)] if door_xs else []
        spans = []
        x = 0
        for g0, g1 in gaps:
            spans.append((x, g0))
            x = g1
        spans.append((x, m.w))
        for i, (s0, s1) in enumerate(spans):
            if s1 <= s0:
                continue
            full = common.box(f"front-{i}", (s1 - s0, WALL_T, ROOM_H), B((s0 + s1) / 2, front + WALL_T / 2, ROOM_H / 2), plaster, None)
            self.occluder(full)
            stub = common.box(f"front-stub-{i}", (s1 - s0, 0.9, STUB_H), B((s0 + s1) / 2, front + 0.55, STUB_H / 2), stone, None, bevel=0.03)
            common.bake_modifiers(stub)
            self._rand_attr(stub)
            self.to_ground(stub)
            self.to_ground(common.box(f"front-cut-{i}", (s1 - s0 - 0.06, 0.84, 0.01), B((s0 + s1) / 2, front + 0.55, STUB_H + 0.005), cut, None))
        for g0, g1 in gaps:
            # Over the door: the lintel of the invisible wall, and a worn threshold.
            self.occluder(common.box("door-head", (g1 - g0, WALL_T, ROOM_H - 1.95), B((g0 + g1) / 2, front + WALL_T / 2, (ROOM_H + 1.95) / 2), plaster, None))
            sill = common.box("threshold", (g1 - g0 - 0.1, 0.8, 0.05), B((g0 + g1) / 2, front + 0.5, 0.025), self.paving, None, bevel=0.015)
            common.bake_modifiers(sill)
            self._rand_attr(sill, 0.5)
            self.to_ground(sill)
            # Shade over the outside of the front wall (a neighbour's wall), so
            # only the doorway shows the bright day beyond.
            for s0, s1 in spans:
                if s1 > s0:
                    self.occluder(common.box(f"front-shade-{s0}", (s1 - s0, 0.2, ROOM_H), B((s0 + s1) / 2, front + 1.35, ROOM_H / 2), plaster, None))
            # Outside the door: sunlit ground beyond the threshold.
            self.to_ground(common.box("outside", (g1 - g0 + 2, 3.0, 0.02), B((g0 + g1) / 2, front + 2.4, -0.01), M.plain("#c8ac82", 0.95, 0.1), None))
        # The roof: invisible, keeping the sky out.
        # Only over the room and its walls: an overhang would shade the low
        # sun out of the window and the door.
        # It rests on the light-blocking walls, so the outer halves of the cut
        # wall tops stay out in the daylight.
        rx0, rx1 = west - WALL_T, east + WALL_T
        self.occluder(common.box("roof", (rx1 - rx0, front + WALL_T, 0.2), B((rx0 + rx1) / 2, (front + WALL_T) / 2, ROOM_H + 0.1), plaster, None))
        # Outside the back wall and beyond the room: dark, so nothing leaks.
        self.occluder(common.box("outer-back", (m.w + 2, 1.0, ROOM_H + 1), B(m.w / 2, back - 1.1, (ROOM_H + 1) / 2), plaster, None))
        self._back_wall_life(back, rng)
        self._room_lights(back)
        self._shafts(back)
        _ = walls

    def _window_wall(self, wall, x0, x1, back):
        """Cut a window through the east wall (where the morning sun comes in)."""
        m = self.map
        wy = back + 3.4
        hole = common.box("window-hole", (3.0, 0.75, 0.95), B((x0 + x1) / 2, wy, 1.55), None, None)
        mod = wall.modifiers.new("window", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = hole
        common.bake_modifiers(wall)
        bpy.data.objects.remove(hole)
        # Wooden grille bars in the opening cast striped light.
        for k in range(3):
            bar = common.box(f"window-bar{k}", (0.1, 0.035, 0.95), B(x0 + WALL_T / 2, wy - 0.25 + k * 0.25, 1.55), self.wood, None)
            self.occluder(bar)
        _ = m
        return wall

    def _back_wall_life(self, back, rng):
        """What hangs on and stands against the back wall."""
        m = self.map
        y = back - 0.02
        dark = M.plain("#2a2018", 0.9, 0.1)
        clay = M.terracotta("#b27a52", 0.15)
        # Niches: dark recesses with a lamp or bowls in them.
        for i, nx in enumerate((2.6, 7.6, 11.4)):
            self.to_ground(common.box(f"niche{i}", (0.55, 0.06, 0.42), B(nx, y + 0.02, 1.35), dark, None))
            self.to_ground(common.box(f"niche-sill{i}", (0.62, 0.12, 0.04), B(nx, y + 0.05, 1.13), M.lime_plaster("#cbbd9f", "sill"), None))
            if i == 1:
                self._oil_lamp(f"niche-lamp{i}", B(nx, y - 0.02, 1.17))
            else:
                for k in range(2):
                    b = self._lathe(f"niche-bowl{i}{k}", [(0.0, 0.0), (0.05, 0.0), (0.09, 0.04), (0.1, 0.06)], B(nx - 0.12 + k * 0.24, y - 0.02, 1.15), clay, 18)
                    self.to_ground(b)
        # A shelf on pegs with bowls and a jug.
        sh = common.box("shelf", (1.6, 0.18, 0.04), B(12.9 - 3.2, y - 0.08, 1.72), self.wood, None)
        self.to_ground(sh)
        for k in range(4):
            b = self._lathe(f"shelf-bowl{k}", [(0.0, 0.0), (0.05, 0.0), (0.1, 0.05), (0.11, 0.07)], B(9.2 + k * 0.36, y - 0.1, 1.74), clay, 18)
            self.to_ground(b)
        # Pegs with bundles of drying herbs (Miriam is a healer).
        herb_cols = ["#6f7a44", "#8a8a52", "#7a6a40", "#5e6a3a", "#9a8a5a"]
        for k in range(9):
            hx = 1.4 + k * 0.62 + rng.random() * 0.1
            if 3.6 < hx < 5.2:
                continue
            peg = self._branch(f"peg{k}", B(hx, y, 2.02), B(hx, y - 0.12, 2.0), 0.015, 0.012, self.wood, 5, bow=0.0)
            self.to_ground(peg)
            self._herb_bundle(f"herbs{k}", B(hx, y - 0.1, 1.98), herb_cols[k % len(herb_cols)], rng)
        # A rope strung along the wall with more bundles over the oven's far side.
        _ = m

    def _herb_bundle(self, name, top, color, rng):
        bm = bmesh.new()
        for s in range(18):
            a = rng.random() * math.tau
            ln = 0.28 + rng.random() * 0.14
            p0 = top + Vector((math.cos(a) * 0.01, math.sin(a) * 0.01, 0))
            p1 = p0 + Vector((math.cos(a) * 0.07, math.sin(a) * 0.04 - 0.02, -ln))
            side = Vector((0.006, 0, 0))
            v = [bm.verts.new(p0 - side), bm.verts.new(p0 + side), bm.verts.new(p1 + side * 3), bm.verts.new(p1 - side * 3)]
            bm.faces.new(v)
        herb = common.mesh_object(name, bm, M.leaf(color, M._toward(color, "#c9c0a0", 0.4)), None)
        self.to_ground(herb)
        tie = self._ellipsoid(f"{name}-tie", top + Vector((0, 0, -0.02)), (0.02, 0.02, 0.03), M.plain("#8a6a44", 0.8), 8, 6)
        self.to_ground(tie)

    def _oil_lamp(self, name, at, lit=True):
        """A clay oil lamp; lit, a small warm flame and its light."""
        body = self._ellipsoid(f"{name}-body", at + Vector((0, 0, 0.03)), (0.07, 0.05, 0.03), M.terracotta("#b2714a", 0.1), 16, 8)
        nozzle = self._ellipsoid(f"{name}-nozzle", at + Vector((0.07, 0, 0.035)), (0.035, 0.025, 0.02), M.terracotta("#a8683f", 0.1), 10, 6)
        self.to_ground(body)
        self.to_ground(nozzle)
        if lit:
            flame = self._ellipsoid(f"{name}-flame", at + Vector((0.09, 0, 0.075)), (0.012, 0.012, 0.03), M.emissive("#ffc070", 30.0), 8, 6)
            self.to_ground(flame)
            self.add_light(f"{name}-light", "POINT", at + Vector((0.09, -0.06, 0.1)), 14.0, "#ffb060", radius=0.04)

    def add_light(self, name, kind, at, power, color, radius=0.05):
        data = bpy.data.lights.new(name, kind)
        data.energy = power
        data.color = common.hex_rgb(color)[:3]
        if kind == "POINT":
            data.shadow_soft_size = radius
        obj = bpy.data.objects.new(name, data)
        obj.location = at
        self.col_ground.objects.link(obj)
        self.lights.append(obj)
        return obj

    def _room_lights(self, back):
        """Daylight bounced in through the door: a soft warm fill low in the doorway."""
        m = self.map
        doors = m.tiles("door")
        if doors:
            xs = [d[0] for d in doors]
            cx = (min(xs) + max(xs) + 1) / 2
            # Sunlit ground outside bounces warm light in through the doorway.
            light = self.add_light("door-daylight", "AREA", B(cx, m.h - 1.15, 0.9), 80.0, "#ffe6c2")
            light.data.shape = "RECTANGLE"
            light.data.size = 1.8
            light.data.size_y = 1.6
            light.rotation_euler = (math.radians(75), 0, 0)
        _ = back

    def _shafts(self, back):
        """Dust glowing in the sunlight that slants in through the window and
        the door: prisms along the sun's path from each opening to the floor,
        shaded as a faint additive glow broken up by motes (a volume would be
        truer, but its noise does not settle at a sensible sample count)."""
        import lighting

        m = self.map
        sun = lighting.sun_vector("day")
        d = Vector((-sun.x, -sun.y, -sun.z))  # the light's direction (Blender axes)
        east = m.w - 1
        wy = back + 3.4
        openings = [
            # The window: its inner face on the east wall.
            [B(east, wy - 0.37, 1.1), B(east, wy + 0.37, 1.1), B(east, wy + 0.37, 2.0), B(east, wy - 0.37, 2.0)],
        ]
        doors = m.tiles("door")
        if doors:
            xs = [p[0] for p in doors]
            g0, g1 = min(xs), max(xs) + 1
            openings.append([B(g0, m.h - 1, 0.05), B(g1, m.h - 1, 0.05), B(g1, m.h - 1, 1.9), B(g0, m.h - 1, 1.9)])
        mat = bpy.data.materials.get("dust-shaft") or self._shaft_material()
        for k, quad in enumerate(openings):
            bm = bmesh.new()
            top = [bm.verts.new(p) for p in quad]
            floor = []
            for p in quad:
                t = p.z / max(1e-4, -d.z)
                floor.append(bm.verts.new(p + d * t + Vector((0, 0, 0.01))))
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new((top[i], top[j], floor[j], floor[i]))
            bm.faces.new(top[::-1])
            bm.faces.new(floor)
            obj = common.mesh_object(f"shaft{k}", bm, mat, None)
            self.to_ground(obj)
            # Atmosphere: seen in the ground layer only (not in the shade mask
            # or behind sprites).
            self.volumes.append(obj)

    def _shaft_material(self):
        """Dust in the beam: a thin scattering volume inside the beam only
        (lit straight by the sun, so it settles quickly), with motes."""
        mat = bpy.data.materials.new("dust-shaft")
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        sc = nt.nodes.new("ShaderNodeVolumeScatter")
        sc.inputs["Color"].default_value = (1.0, 0.93, 0.82, 1.0)
        sc.inputs["Anisotropy"].default_value = 0.35
        tc = nt.nodes.new("ShaderNodeTexCoord")
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 6.0
        noise.inputs["Detail"].default_value = 4.0
        nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        dens = nt.nodes.new("ShaderNodeMapRange")
        dens.inputs["From Min"].default_value = 0.3
        dens.inputs["From Max"].default_value = 0.75
        dens.inputs["To Min"].default_value = 0.08
        dens.inputs["To Max"].default_value = 0.3
        nt.links.new(noise.outputs["Fac"], dens.inputs["Value"])
        nt.links.new(dens.outputs["Result"], sc.inputs["Density"])
        nt.links.new(sc.outputs["Volume"], out.inputs["Volume"])
        return mat

    # ── home props ──────────────────────────────────────────────────────────
    def tannur(self, name, x, y):
        """A tannur: a clay cylinder oven against the wall, embers glowing in
        its mouth, a bread paddle, a stack of firewood and a cooking pot."""
        objs = []
        c = self.P(x + 0.5, y + 0.45)
        prof = [(0.34, 0.0), (0.35, 0.1), (0.32, 0.4), (0.26, 0.58), (0.2, 0.62), (0.18, 0.64)]
        objs.append(self._lathe(f"{name}-body", prof, c, M.terracotta("#9c6446", 0.55), 32))
        objs.append(self._ellipsoid(f"{name}-embers", c + Vector((0, 0, 0.6)), (0.15, 0.15, 0.02), M.emissive("#ff6a20", 6.0), 20, 6))
        self.add_light(f"{name}-glow", "POINT", c + Vector((0, 0, 0.8)), 25.0, "#ff8a3a", radius=0.12)
        objs.append(self._ellipsoid(f"{name}-ash", c + Vector((0.1, -0.36, 0.01)), (0.26, 0.14, 0.01), M.plain("#6e675e", 0.95), 16, 6))
        paddle = self._branch(f"{name}-paddle", c + Vector((-0.34, -0.2, 0.02)), c + Vector((-0.28, 0.05, 0.9)), 0.015, 0.012, self.wood, 6, bow=0.0)
        objs.append(paddle)
        wood = M.bark("#6a5a46")
        for k in range(5):
            a = c + Vector((0.3, -0.25 + k * 0.05, 0.04 + (k % 2) * 0.07))
            objs.append(self._branch(f"{name}-log{k}", a, a + Vector((0.3, 0.06, 0.0)), 0.035, 0.03, wood, 8, bow=0.0))
        pot = self._lathe(f"{name}-pot", [(0.08, 0), (0.14, 0.05), (0.16, 0.13), (0.12, 0.2), (0.12, 0.23)], c + Vector((-0.1, -0.42, 0.0)), M.terracotta("#6a4a3a", 0.1), 24)
        objs.append(pot)
        return objs

    def herb_baskets(self, name, x, y):
        """Baskets of seeds, roots and dried leaves, and a bundle of herbs
        laid across them (Miriam's remedies)."""
        rng = self.rng
        objs = []
        fills = ["#7a6a3a", "#8a5a3a", "#a89a5a"]
        for i in range(3):
            px = x + 0.22 + i * 0.28
            py = y + 0.45 + (i % 2) * 0.18
            objs.append(self._lathe(f"{name}-{i}", [(0.08, 0), (0.13, 0.06), (0.14, 0.14), (0.15, 0.16)], self.P(px, py), M.straw("#b0925e"), 24))
            mat = M.plain(fills[i], 0.7, 0.2)
            for q in range(14):
                ang = rng.random() * math.tau
                rad = rng.random() ** 0.5 * 0.11
                objs.append(self._ellipsoid(f"{name}-s{i}-{q}", self.P(px + math.cos(ang) * rad, py + math.sin(ang) * rad, 0.15 + (0.11 - rad) * 0.25), (0.022, 0.022, 0.016), mat, 8, 5))
        bm = bmesh.new()
        for s in range(20):
            a = rng.random() * 0.4 - 0.2
            p0 = self.P(x + 0.2, y + 0.4 + rng.random() * 0.1, 0.2)
            p1 = p0 + Vector((0.55 * math.cos(a), 0.55 * math.sin(a), 0.02))
            side = Vector((0, 0.005, 0))
            v = [bm.verts.new(p0 - side), bm.verts.new(p0 + side), bm.verts.new(p1 + side * 4), bm.verts.new(p1 - side * 4)]
            bm.faces.new(v)
        objs.append(common.mesh_object(f"{name}-bundle", bm, M.leaf("#6f7a44", "#a8a47a"), None))
        return objs

    def dress_home(self):
        """Rushes and crumbs on the floor, a water jar with a dipper by the
        door, a hand mill by the oven."""
        m = self.map
        rng = self.rng
        rush = M.plain("#b8a070", 0.85, 0.15)
        bm = bmesh.new()
        for x, y in m.tiles("floor"):
            if rng.random() < 0.3:
                for _ in range(4 + int(rng.random() * 6)):
                    cx, cy = x + rng.random(), y + rng.random()
                    a = rng.random() * math.tau
                    ln = 0.06 + rng.random() * 0.08
                    dx, dy = math.cos(a) * ln / 2, math.sin(a) * ln / 2
                    v = [bm.verts.new(self.P(cx - dx, cy - dy - 0.003, 0.004)), bm.verts.new(self.P(cx + dx, cy + dy - 0.003, 0.004)), bm.verts.new(self.P(cx + dx, cy + dy + 0.003, 0.004)), bm.verts.new(self.P(cx - dx, cy - dy + 0.003, 0.004))]
                    bm.faces.new(v)
        self.ground_objects.append(common.mesh_object("rushes", bm, rush, self.col_ground, smooth=False))
