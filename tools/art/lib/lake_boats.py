"""Boats of the Sea of Galilee, after the first-century boat found at
Ginosar in 1986 (about 8.2 x 2.3 m): a round-bilged hull of planks joined
edge to edge with pegged mortise-and-tenon joints, oak frames inside, a
keel with rocker, upswept stem and sternpost, a raised stern deck where the
helmsman stood, a mast stepped about a third of the way from the bow with
a square sail on a yard, four oars and a steering oar on the quarter.

Neighbouring `boat` tiles form ONE boat shaped to its footprint (long axis
= length). Afloat, it may run a little past its tiles into the water (never
over ground anyone walks on); drawn up on the beach it fits its tiles, with
its mast lowered along it and the sail rolled on the yard. The boat you are
aboard (`hull` around walkable `deck`, a `mast`) is drawn larger than life
so its crew and cargo fit: its bulwarks are cut into one sprite per map row
so people on deck sort correctly against them, and its deck is the terrain
inside them (kit_lake.lake_heights).

Everything below the waterline of a floating boat goes into the ground layer
(seen dimly through the water); the rest is its sprite.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import lake_materials as LM
import materials as M

WET = {"lake", "shallows"}


def _loft(bm, rows, uv=None, closed=False):
    """Faces between consecutive rows of vertices (lists of BMVerts)."""
    faces = []
    for a, b in zip(rows, rows[1:]):
        n = len(a)
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            faces.append(bm.faces.new((a[i], a[j], b[j], b[i])))
    return faces


class BoatsMixin:
    # ── footprints ──────────────────────────────────────────────────────────
    def boat_footprints(self):
        """Every boat on the map: its tiles, box, whether it floats, which way
        it lies and points, and the length and beam it is built to."""
        if getattr(self, "_boats", None) is not None:
            return self._boats
        m = self.map
        seen = set()
        out = []
        for y in range(m.h):
            for x in range(m.w):
                if (x, y) in seen or m.kind(x, y) != "boat":
                    continue
                stack = [(x, y)]
                seen.add((x, y))
                tiles = []
                wet = dry = 0
                while stack:
                    cx, cy = stack.pop()
                    tiles.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if (nx, ny) in seen:
                            continue
                        k = m.kind(nx, ny)
                        if k == "boat":
                            seen.add((nx, ny))
                            stack.append((nx, ny))
                        elif k in WET:
                            wet += 1
                        elif k != "void":
                            dry += 1
                xs = [t[0] for t in tiles]
                ys = [t[1] for t in tiles]
                x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
                horizontal = (x1 - x0) >= (y1 - y0)
                afloat = wet > dry
                n_len = (x1 - x0) if horizontal else (y1 - y0)
                n_wid = (y1 - y0) if horizontal else (x1 - x0)
                # Room to run past the tiles: water (not walkable) at each end.
                def room(sign):
                    r = 0
                    for k in range(1, 3):
                        if horizontal:
                            cells = [(x1 - 1 + k, yy) if sign > 0 else (x0 - k, yy) for yy in range(y0, y1)]
                        else:
                            cells = [(xx, y1 - 1 + k) if sign > 0 else (xx, y0 - k) for xx in range(x0, x1)]
                        if all(m.kind(*c) in WET for c in cells):
                            r = k
                        else:
                            break
                    return r

                ahead, behind = room(1), room(-1)
                # Afloat, point the bow at open water; the jetty or shore at the stern.
                bow = 1 if ahead >= behind else -1
                length = float(n_len) - 0.1
                beam = min(2.3, n_wid * 0.92 + (0.25 if n_wid >= 2 else 0.0))
                extra = 0.0
                if afloat:
                    # Grow toward the Ginosar boat's proportions where there is water to grow into.
                    want = min(8.2, max(length, beam * 3.6))
                    extra = min(want - length, (ahead if bow > 0 else behind) * 1.0 + 0.0)
                    extra = max(0.0, extra)
                    length += extra
                    beam = min(2.3, beam + (0.2 if n_wid >= 2 else 0.1))
                cx = (x0 + x1) / 2
                cy = (y0 + y1) / 2
                # Grow toward the bow only.
                if horizontal:
                    cx += bow * extra / 2
                else:
                    cy += bow * extra / 2
                heading = (0.0 if bow > 0 else math.pi) if horizontal else (-math.pi / 2 if bow > 0 else math.pi / 2)
                out.append(
                    {
                        "tiles": sorted(tiles),
                        "box": (x0, x1, y0, y1),
                        "afloat": afloat,
                        "horizontal": horizontal,
                        "bow": bow,
                        "length": length,
                        "beam": beam,
                        "centre": (cx, cy),
                        "heading": heading,
                    }
                )
        self._boats = out
        return out

    # ── the hull ────────────────────────────────────────────────────────────
    @staticmethod
    def hull_shape(u, L, B):
        """Half-breadth at the sheer, heights of the sheer and the keel, at
        fraction u of the length (0 stern, 1 bow), for a boat L long and B
        wide: fullest a little aft of the middle, finer at the bow, both
        ends rising (sheer and rocker)."""
        uu = min(1.0, max(0.0, u))
        s = uu ** 0.9
        # Full amidships, fine at the bow, a little fuller at the stern.
        f = math.sin(math.pi * s) ** 0.72
        e = abs(2 * uu - 1)
        hb = B / 2 * f
        sheer = 0.12 * L / 8.2 + 0.46 + 0.32 * e ** 2.6
        keel = -0.58 * min(1.0, B / 2.3) + 0.95 * e ** 3.2
        return hb, sheer, keel

    def _hull_mesh(self, name, L, B, xf, mat, inner_mat, section=26, stations=48, freeboard=0.55):
        """The shell of a hull in boat space (x along, stern at -L/2; y to
        port; z up from the waterline), transformed by `xf`: outer planking
        with strakes (UV: metres along, girth), thickened inward."""
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        rows = []
        uvs = []
        for i in range(stations + 1):
            u = i / stations
            hb, sheer, keel = self.hull_shape(u, L, B)
            sheer *= freeboard / 0.55
            row = []
            uvr = []
            girth = 0.0
            prev = None
            for j in range(section + 1):
                # -1 (port sheer) .. 0 (keel) .. +1 (starboard sheer)
                t = -1 + 2 * j / section
                th = abs(t) * math.pi / 2
                y = -math.copysign(1.0, t) * hb * math.sin(th) ** 0.72 if t != 0 else 0.0
                z = keel + (sheer - keel) * (1 - math.cos(th) ** 1.35)
                p = Vector((-L / 2 + u * L, y, z))
                if prev is not None:
                    girth += (p - prev).length
                prev = p
                row.append(bm.verts.new(xf @ p))
                uvr.append((u * L, girth))
            rows.append(row)
            uvs.append(uvr)
        for i in range(stations):
            for j in range(section):
                f = bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
                for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    loop[uvl].uv = uvs[a][b]
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        obj = common.mesh_object(name, bm, mat, None)
        obj.data.materials.append(inner_mat)
        common.add_modifier(obj, "SOLIDIFY", thickness=0.045, offset=-1.0, material_offset=1, use_even_offset=True)
        common.bake_modifiers(obj)
        return obj

    def _boat_xf(self, cx, cy, base, z, heading):
        """Boat space to Blender: the boat's origin (its waterline, centre)
        at map (cx, cy) and height z, standing on a surface at height `base`
        (the water it floats on, or the beach under its keel: sheared by that,
        so the boat shows over its own tiles), its bow along `heading`
        (radians, east = 0, north = pi/2)."""
        return Matrix.Translation(Vector((cx, -(cy + base), z))) @ Matrix.Rotation(heading, 4, "Z")

    def _at0(self, x, y, z):
        """A point of the boat you are aboard (its deck is the ground, at 0)."""
        return Vector((x, -y, z))

    def _rail(self, name, L, B, xf, mat, side, freeboard=0.55, r=0.045, u0=0.02, u1=0.98):
        """The gunwale: a rounded wale along the sheer on one side (+1 port, -1 starboard)."""
        pts = []
        for i in range(41):
            u = u0 + (u1 - u0) * i / 40
            hb, sheer, _ = self.hull_shape(u, L, B)
            sheer *= freeboard / 0.55
            pts.append(xf @ Vector((-L / 2 + u * L, side * (hb + 0.01), sheer + 0.01)))
        return self._lake_tube(name, pts, r, mat)

    def _lake_tube(self, name, pts, r, mat, seg=8, taper=None):
        bm = bmesh.new()
        rings = []
        for i, p in enumerate(pts):
            a = pts[max(0, i - 1)]
            b = pts[min(len(pts) - 1, i + 1)]
            d = (b - a)
            if d.length < 1e-6:
                d = Vector((1, 0, 0))
            d.normalize()
            side = d.cross(Vector((0, 0, 1)))
            if side.length < 1e-4:
                side = d.cross(Vector((0, 1, 0)))
            side.normalize()
            up = side.cross(d).normalized()
            rr = r * (taper(i / max(1, len(pts) - 1)) if taper else 1.0)
            rings.append([bm.verts.new(p + (side * math.cos(math.tau * k / seg) + up * math.sin(math.tau * k / seg)) * rr) for k in range(seg)])
        _loft(bm, rings, closed=True)
        return common.mesh_object(name, bm, mat, None)

    def _boat_parts(self, name, L, B, xf, afloat, rig, rng, gear=True, lamp=False, teacher=False, yard=True):
        """Every part of one boat, as (above, below): the objects above the
        waterline (its sprite) and those below it (ground, afloat only).
        `yard`: False when the story shows its yard and sail (_yard)."""
        L_HULL = LM.hull_paint("#5c4634", name="hull-outside")
        inner = LM.planks("#806850", "hull-inside", along="X", width=0.16, length=2.2, worn=0.2)
        hull = self._hull_mesh(f"{name}-hull", L, B, xf, L_HULL, inner)
        above = [hull]
        below = []
        if afloat:
            under = self._below_waterline(hull, xf)
            if under is not None:
                below.append(under)
        timber = M.wood("#5a4330", 4.0)
        pale = M.wood("#7a6048", 5.0)
        for side in (1, -1):
            above.append(self._rail(f"{name}-rail{side}", L, B, xf, timber, side))
        # Stem and sternpost: rising curved timbers at the ends.
        for end, rise in ((1, 0.32), (0, 0.26)):
            _, sheer, keel = self.hull_shape(end, L, B)
            pts = []
            for k in range(9):
                t = k / 8
                x = (-L / 2 if end == 0 else L / 2) + (-1 if end == 0 else 1) * 0.12 * math.sin(t * math.pi / 2)
                pts.append(xf @ Vector((x, 0.0, keel + (sheer + rise - keel) * t)))
            above.append(self._lake_tube(f"{name}-post{end}", pts, 0.05, timber))
        # Frames (ribs) inside, thwarts across, the floorboards, the stern deck.
        fl = bmesh.new()
        for k in range(1, int(L / 0.42)):
            u = k * 0.42 / L
            if u > 0.97:
                break
            hb, sheer, keel = self.hull_shape(u, L, B)
            pts = []
            for j in range(13):
                t = -1 + 2 * j / 12
                th = abs(t) * math.pi / 2
                y = -math.copysign(1.0, t) * (hb - 0.05) * math.sin(th) ** 0.72 if t else 0.0
                z = keel + 0.05 + (sheer - 0.03 - keel - 0.05) * (1 - math.cos(th) ** 1.35)
                pts.append(xf @ Vector((-L / 2 + u * L, y, z)))
            above.append(self._lake_tube(f"{name}-frame{k}", pts, 0.028, pale, seg=5))
        _ = fl
        floor = bmesh.new()
        fu = floor.loops.layers.uv.new("UVMap")
        _, _, keel_mid = self.hull_shape(0.5, L, B)
        fz = keel_mid + 0.22
        rows = []
        for i in range(21):
            u = 0.14 + 0.72 * i / 20
            hb, sheer, keel = self.hull_shape(u, L, B)
            # Where the floor meets the hull's curve.
            th = math.acos(max(0.0, min(1.0, (1 - (fz - keel) / max(0.05, sheer - keel)))) ** (1 / 1.35))
            w = max(0.1, (hb - 0.06) * math.sin(th) ** 0.72)
            rows.append([floor.verts.new(xf @ Vector((-L / 2 + u * L, s * w, fz))) for s in (1, -1)])
        for i, (a, b) in enumerate(zip(rows, rows[1:])):
            f = floor.faces.new((a[0], b[0], b[1], a[1]))
            for loop, (uu, vv) in zip(f.loops, ((i, 0), (i + 1, 0), (i + 1, 1), (i, 1))):
                loop[fu].uv = (uu * 0.36 * L / 8, vv * 2)
        above.append(common.mesh_object(f"{name}-floor", floor, inner, None, smooth=False))
        # Stern deck: the helmsman's platform, a little below the sheer.
        u0, u1 = 0.0, 0.16
        hb1, sheer1, _ = self.hull_shape(u1, L, B)
        sd = bmesh.new()
        pts = []
        for i in range(9):
            u = u0 + (u1 - u0) * i / 8
            hb, sheer, _ = self.hull_shape(max(0.02, u), L, B)
            pts.append((-L / 2 + max(0.02, u) * L, hb - 0.05, sheer - 0.14))
        vs_top = [sd.verts.new(xf @ Vector((x, y, z))) for x, y, z in pts] + [sd.verts.new(xf @ Vector((x, -y, z))) for x, y, z in reversed(pts)]
        sd.faces.new(vs_top)
        sdo = common.mesh_object(f"{name}-sterndeck", sd, inner, None, smooth=False)
        common.add_modifier(sdo, "SOLIDIFY", thickness=0.05)
        above.append(sdo)
        # Thwarts: benches across for the rowers.
        for u in (0.36, 0.5, 0.72):
            hb, sheer, _ = self.hull_shape(u, L, B)
            bench = common.box(f"{name}-thwart{u}", (0.2, 2 * hb - 0.06, 0.045), (0, 0, 0), pale, None, bevel=0.01)
            bench.matrix_world = xf @ Matrix.Translation((-L / 2 + u * L, 0.0, sheer - 0.2))
            common.bake_modifiers(bench)
            bench.data.transform(bench.matrix_world)
            bench.matrix_world = Matrix.Identity(4)
            above.append(bench)
        if rig and L >= 4.0:
            above += self._rig(name, L, B, xf, rig, rng, teacher=teacher, yard=yard)
        if gear:
            above += self._boat_gear(name, L, B, xf, afloat, rng, rig == "lowered")
        if afloat and not teacher and rig != "lowered":
            above += self._oars_shipped(name, L, B, xf, rng)
        if lamp:
            above += self._stern_lamp(name, L, B, xf)
        if teacher:
            above += self._awning(name, L, B, xf)
        return above, below

    def _below_waterline(self, hull, xf):
        """The part of a floating hull under the water: a copy cut at the
        waterline (boat space z = 0), for the ground layer."""
        under = hull.copy()
        under.data = hull.data.copy()
        under.name = hull.name + "-under"
        bpy.context.scene.collection.objects.link(under)
        bm = bmesh.new()
        bm.from_mesh(under.data)
        # Only the outside of the planking (the inner face and the edge are
        # the solidified material 1 and its rim): seen through the water from
        # outside, and never in front of the hull's inside seen from above.
        inner = [f for f in bm.faces if f.material_index != 0]
        bmesh.ops.delete(bm, geom=inner, context="FACES")
        o = xf @ Vector((0, 0, 0))
        n = (xf.to_3x3() @ Vector((0, 0, 1))).normalized()
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=o, plane_no=n, clear_outer=True)
        if not bm.faces:
            bm.free()
            bpy.data.objects.remove(under, do_unlink=True)
            return None
        # A hair outside the hull itself, so the two never fight.
        bm.normal_update()
        for v in bm.verts:
            v.co += v.normal * 0.015
        bm.to_mesh(under.data)
        bm.free()
        under.data.materials.clear()
        under.data.materials.append(LM.hull_paint("#3a2c20", "#0e0b08", name="hull-under"))
        return under

    def _oars_shipped(self, name, L, B, xf, rng):
        """Oars lying along the thwarts, blades toward the bow."""
        out = []
        oar = M.wood("#8a6c4c", 3.0)
        for k, side in enumerate((1, -1)):
            hb, sheer, _ = self.hull_shape(0.5, L, B)
            y = side * (hb - 0.28 - 0.08 * k)
            a = xf @ Vector((-L * 0.18, y, sheer - 0.15))
            b = xf @ Vector((L * 0.32, y * 0.92, sheer - 0.16))
            out.append(self._oar(f"{name}-oar{k}", a, b, oar, blade=min(0.6, L * 0.12)))
        return out

    def _oar(self, name, handle, tip, mat, blade=0.55, r=0.024):
        """An oar from its handle to the tip of its blade: a round loom, a
        flat blade."""
        d = tip - handle
        n = d.normalized()
        shaft_end = tip - n * blade
        objs = [self._branch(f"{name}-loom", handle, shaft_end, r, r * 0.85, mat, 7, bow=0.0)]
        side = n.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        bm = bmesh.new()
        prof = [(0.0, 0.02), (0.15, 0.055), (0.9, 0.07), (1.0, 0.055)]
        rows = []
        for t, w in prof:
            c = shaft_end + n * blade * t
            rows.append([bm.verts.new(c - side * w), bm.verts.new(c + side * w)])
        for a, b in zip(rows, rows[1:]):
            bm.faces.new((a[0], a[1], b[1], b[0]))
        bl = common.mesh_object(f"{name}-blade", bm, mat, None)
        common.add_modifier(bl, "SOLIDIFY", thickness=0.018)
        objs.append(bl)
        # Joined for the caller: return the loom (the blade rides along).
        return self._join(name, objs)

    def _join(self, name, objs):
        """Join objects into one (keeps materials)."""
        for o in objs:
            common.bake_modifiers(o) if o.modifiers else None
        ctx = bpy.context
        base = objs[0]
        if len(objs) > 1:
            with ctx.temp_override(active_object=base, selected_editable_objects=objs, selected_objects=objs):
                bpy.ops.object.join()
        base.name = name
        return base

    def _rig(self, name, L, B, xf, rig, rng, teacher=False, yard=True):
        """Mast, yard and sail: stepped and standing with the sail furled on
        the yard (moored), or set (sailing), or lowered along the boat (drawn
        up). With `yard` False, only the mast and its standing rigging: the
        story shows the yard and sail (`_yard`, set or taken in)."""
        out = []
        spar = M.wood("#6a5238", 3.5)
        # Linen greyed and browned by years of sun and lake water.
        sail = LM.linen("#a89c82", "sail-linen-worn")
        rope = LM.rope("#9c8660", "rig-rope")
        u_mast = 0.64
        hb, sheer, keel = self.hull_shape(u_mast, L, B)
        mast_h = min(7.2, 0.82 * L + 0.4)
        base = Vector((-L / 2 + u_mast * L, 0.0, keel + 0.2))
        if rig == "lowered":
            # Mast lying along the thwarts, yard beside it with the sail rolled on it.
            a = xf @ Vector((-L * 0.42, 0.12, sheer - 0.05))
            b = xf @ Vector((L * 0.44, 0.08, sheer - 0.02))
            out.append(self._branch(f"{name}-mast", a, b, 0.055, 0.04, spar, 8, bow=0.0))
            a2 = xf @ Vector((-L * 0.4, -0.2, sheer - 0.02))
            b2 = xf @ Vector((L * 0.38, -0.16, sheer + 0.0))
            out.append(self._branch(f"{name}-yard", a2, b2, 0.035, 0.03, spar, 8, bow=0.0))
            out.append(self._furled(f"{name}-roll", a2 + Vector((0, 0, 0.06)), b2 + Vector((0, 0, 0.06)), sail, rng, r=0.09))
            return out
        top = base + Vector((0, 0, mast_h))
        out.append(self._branch(f"{name}-mast", xf @ base, xf @ top, 0.075 * min(1.0, L / 8), 0.05 * min(1.0, L / 8), spar, 10, bow=0.0))
        if yard:
            out += self._yard(name, L, B, xf, "furled" if rig == "moored" else "set", rng)
        # Standing rigging: shrouds to both rails, a forestay, the halyard.
        mh = xf @ (base + Vector((0, 0, mast_h - 0.1)))
        for side in (1, -1):
            hb2, sheer2, _ = self.hull_shape(u_mast - 0.05, L, B)
            out.append(self._branch(f"{name}-shroud{side}", mh, xf @ Vector((-L / 2 + (u_mast - 0.05) * L, side * hb2, sheer2)), 0.008, 0.008, rope, 4, bow=0.0))
        _, sheer_b, _ = self.hull_shape(0.99, L, B)
        out.append(self._branch(f"{name}-stay", mh, xf @ Vector((L / 2 - 0.05, 0.0, sheer_b + 0.2)), 0.008, 0.008, rope, 4, bow=0.0))
        _, sheer_s, _ = self.hull_shape(0.04, L, B)
        out.append(self._branch(f"{name}-halyard", mh, xf @ Vector((-L / 2 + 0.5, 0.0, sheer_s)), 0.007, 0.007, rope, 4, bow=0.0))
        _ = teacher
        return out

    def _yard(self, name, L, B, xf, state, rng):
        """A boat's yard and sail. `set`: under way, the yard up and braced
        round to the wind, the sail half brailed up beneath it. `furled`: at
        rest, or with the sail taken in against a squall: the yard lowered
        and lashed along the thwarts, the sail furled on it, the mast bare."""
        spar = M.wood("#6a5238", 3.5)
        sail = LM.linen("#a89c82", "sail-linen-worn")
        u_mast = 0.64
        _hb, sheer, keel = self.hull_shape(u_mast, L, B)
        mast_h = min(7.2, 0.82 * L + 0.4)
        length = min(7.5, 0.86 * L)
        base = Vector((-L / 2 + u_mast * L, 0.0, keel + 0.2))
        if state == "furled":
            a2 = xf @ Vector((-L * 0.36, -0.12, sheer + 0.02))
            b2 = xf @ Vector((L * 0.4, -0.08, sheer + 0.05))
            return [
                self._branch(f"{name}-yard", a2, b2, 0.045, 0.04, spar, 8, bow=0.0),
                self._furled(f"{name}-furl", a2 + Vector((0, 0, 0.1)), b2 + Vector((0, 0, 0.1)), sail, rng, r=0.13),
            ]
        yz = mast_h - 0.35
        brace = math.radians(38.0)
        d = Vector((math.sin(brace), math.cos(brace), 0.0))
        c = base + Vector((0.08, 0.0, yz))
        ya = xf @ (c + d * length / 2)
        yb = xf @ (c - d * length / 2)
        fwd = (xf.to_3x3() @ Vector((1.0, 0.0, 0.0))).normalized()
        return [
            self._branch(f"{name}-yard", ya, yb, 0.045, 0.04, spar, 8, bow=-0.06),
            self.square_sail(f"{name}-sail", (ya + yb) / 2 + Vector((0, 0, -0.06)), (ya - yb).normalized(), length - 0.3, min(2.6, 0.4 * L), fwd, sail),
        ]

    def _story_sails(self, fp):
        """The story's sail entities on a boat (sprites `sail-set` and
        `sail-furled`, shown as the story goes): its yard and sail are theirs."""
        tiles = set(map(tuple, fp["tiles"]))
        return [e for e in self.map.entities if e.get("sprite") in ("sail-set", "sail-furled") and (e["x"], e["y"]) in tiles]

    def entity_sail_set(self, name, x, y, e=None):
        """The yard and sail of the boat under (x, y), set: shown until the squall."""
        return self._story_yard(name, x, y, "set")

    def entity_sail_furled(self, name, x, y, e=None):
        """The yard and sail of the boat under (x, y), taken in: shown from the squall on."""
        return self._story_yard(name, x, y, "furled")

    def _story_yard(self, name, x, y, state):
        rig = next((r for r in getattr(self, "_story_rigs", []) if (x, y) in r["tiles"]), None)
        if rig is None:
            return None
        objs = self._yard(name, rig["L"], rig["B"], rig["xf"], state, common.rng(int(x * 131 + y * 17)))
        for o in objs:
            o["wl_z"] = rig["zb"]
        # Sorted with its boat; no shadow of its own (it would fall on open
        # water, whose terrain is the lake bed); faded like the boat's rig.
        return objs, rig["south"] * 32.0, False, {"shadow": False, "fade": True}

    def _furled(self, name, a, b, mat, rng, r=0.14):
        """A sail gathered up on its yard: a long lumpy roll with the brails
        biting into it, drooping a little between them."""
        bm = bmesh.new()
        d = b - a
        n = d.normalized()
        side = n.cross(Vector((0, 0, 1))).normalized()
        up = side.cross(n).normalized()
        steps = max(12, int(d.length / 0.06))
        rings = []
        for i in range(steps + 1):
            t = i / steps
            c = a + d * t
            lump = 1.0 + 0.18 * math.sin(t * d.length * 5.1) + 0.1 * math.sin(t * d.length * 13.0 + 1) - 0.25 * max(0.0, math.cos(t * d.length * 2 * math.pi / 0.8)) ** 16
            taper = min(1.0, t * 8, (1 - t) * 8) ** 0.5
            sag = -0.05 * math.sin(t * math.pi) - 0.03 * abs(math.sin(t * d.length * math.pi / 0.8))
            rr = r * lump * max(0.25, taper)
            ring = []
            for k in range(12):
                ang = math.tau * k / 12
                q = c + side * math.cos(ang) * rr + up * (math.sin(ang) * rr * 0.8 + sag - rr * 0.4)
                ring.append(bm.verts.new(q))
            rings.append(ring)
        _loft(bm, rings, closed=True)
        return common.mesh_object(name, bm, mat, None)

    def _boat_gear(self, name, L, B, xf, afloat, rng, lowered):
        """What a working boat has in it: a heap of net amidships with its
        floats, a basket, a stone anchor with a hole for its rope, a coil of
        rope, a water jar, the bailer."""
        out = []
        hb, sheer, keel = self.hull_shape(0.42, L, B)
        fz = self.hull_shape(0.5, L, B)[2] + 0.24
        if L >= 3.5:
            out.append(self._net_heap(f"{name}-netheap", xf @ Vector((-L * 0.06, 0.05 * (1 if rng.random() < 0.5 else -1), fz)), min(0.9, B * 0.42), min(1.4, L * 0.18), rng))
        # Stone anchor.
        anchor = LM.basalt("#4c4843", "anchor-stone", dust=0.1, lichen=0.1)
        st = common.box(f"{name}-anchor", (0.3, 0.22, 0.09), (0, 0, 0), anchor, None, bevel=0.04)
        st.matrix_world = xf @ Matrix.Translation((L * 0.3, -0.18, fz + 0.05)) @ Matrix.Rotation(0.4, 4, "Z")
        common.bake_modifiers(st)
        st.data.transform(st.matrix_world)
        st.matrix_world = Matrix.Identity(4)
        out.append(st)
        # A coil of rope by the anchor.
        out.append(self._coil(f"{name}-coil", xf @ Vector((L * 0.3, 0.2, fz + 0.02)), 0.16, LM.rope("#9c8660", "boat-rope"), rng))
        # A water jar lashed by the stern deck.
        jar = self._lathe(f"{name}-jar", [(0.05, 0), (0.12, 0.06), (0.14, 0.2), (0.1, 0.32), (0.05, 0.36), (0.06, 0.39)], xf @ Vector((-L * 0.3, 0.25, fz)), M.terracotta("#a86e4c", 0.2), 20)
        out.append(jar)
        if rng.random() < 0.7:
            out.append(self._lathe(f"{name}-basket", [(0.12, 0), (0.18, 0.08), (0.2, 0.18), (0.21, 0.2)], xf @ Vector((L * 0.12, -0.3, fz)), M.straw("#a88c5c"), 20))
        _ = (hb, sheer, keel, afloat, lowered)
        return out

    def _coil(self, name, at, r, mat, rng, turns=5):
        pts = []
        for i in range(turns * 24 + 1):
            a = i / 24 * math.tau
            rr = r * (0.55 + 0.45 * (i / (turns * 24)))
            pts.append(at + Vector((math.cos(a) * rr, math.sin(a) * rr, 0.015 + 0.012 * math.sin(a * 0.5 + i * 0.01))))
        return self._lake_tube(name, pts, 0.014, mat, seg=5)

    def _net_heap(self, name, at, w, ln, rng):
        """A heap of wet net: a lumpy mound of folds, darker than dry net,
        with its floats and a sinker or two showing."""
        bm = bmesh.new()
        nx, ny = 18, 12
        grid = []
        for j in range(ny + 1):
            row = []
            for i in range(nx + 1):
                u, v = i / nx - 0.5, j / ny - 0.5
                r = math.hypot(u * 2, v * 2)
                hgt = max(0.0, 1 - r) ** 0.8 * 0.22
                hgt += 0.03 * math.sin(u * 23 + v * 7) + 0.025 * math.sin(v * 31 - u * 11)
                row.append(bm.verts.new(at + Vector((u * ln, v * w, max(0.0, hgt)))))
            grid.append(row)
        for j in range(ny):
            for i in range(nx):
                bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        heap = common.mesh_object(name, bm, M.cloth("#6e6a5a", None, "linen"), None)
        out = [heap]
        floats = M.plain("#8a6a44", 0.85)
        for k in range(6):
            a = rng.random() * math.tau
            rr = 0.3 + rng.random() * 0.5
            p = at + Vector((math.cos(a) * rr * ln / 2, math.sin(a) * rr * w / 2, 0.0))
            p.z += max(0.0, 1 - rr) ** 0.8 * 0.22 + 0.01
            out.append(self._ellipsoid(f"{name}-float{k}", p, (0.035, 0.03, 0.02), floats, 10, 6))
        return self._join(name, out)

    def _stern_lamp(self, name, L, B, xf):
        """A clay lamp in a niche of pottery at the stern, burning."""
        _, sheer, _ = self.hull_shape(0.05, L, B)
        at = xf @ Vector((-L / 2 + 0.5, 0.0, sheer + 0.05))
        body = self._ellipsoid(f"{name}-lamp", at, (0.07, 0.05, 0.03), M.terracotta("#b2714a", 0.1), 14, 8)
        return [body] + self.lamp_flame(name, at + Vector((0.06, 0, 0.05)), (0.014, 0.034), 5.0, at + Vector((0.06, -0.05, 0.12)), radius=24.0)

    def _awning(self, name, L, B, xf):
        """A shade of cloth rigged on poles over the middle of the boat, so no
        one under it can be seen."""
        out = []
        # Goat-hair cloth, dark and coarse, as tents were made.
        cloth = M.fabric_stripes(["#3a312a", "#4a3f35", "#3a312a", "#5a4d3e"], 0.09, f"awning-{name}")
        pole = M.wood("#6a5238", 3.5)
        hb, sheer, _ = self.hull_shape(0.4, L, B)
        u0, u1 = 0.16, 0.7
        z = sheer + 0.95
        bm = bmesh.new()
        rows = []
        for i in range(9):
            u = u0 + (u1 - u0) * i / 8
            hb, sheer, _ = self.hull_shape(u, L, B)
            row = []
            for j in range(7):
                t = -1 + 2 * j / 6
                sag = 0.07 * (1 - t * t) + 0.04 * math.sin(i * 1.3)
                row.append(bm.verts.new(xf @ Vector((-L / 2 + u * L, t * (hb + 0.05), z - sag - 0.1 * abs(t)))))
            rows.append(row)
        _loft(bm, rows)
        aw = common.mesh_object(f"{name}-awning", bm, cloth, None)
        common.add_modifier(aw, "SOLIDIFY", thickness=0.012)
        out.append(aw)
        for u in (u0, u1):
            hb, sheer, _ = self.hull_shape(u, L, B)
            for s in (1, -1):
                out.append(self._branch(f"{name}-apole{u}{s}", xf @ Vector((-L / 2 + u * L, s * (hb - 0.05), sheer - 0.1)), xf @ Vector((-L / 2 + u * L, s * (hb + 0.02), z - 0.1)), 0.02, 0.018, pole, 5, bow=0.0))
        return out

    # ── tile builders ───────────────────────────────────────────────────────
    def tile_boat(self):
        """Boats: each group of neighbouring `boat` tiles is one boat shaped to
        its footprint. Afloat: floating at the waterline, mast up and sail
        furled on the yard if it is long enough, oars shipped, gear inside
        (a boat offshore with a crowd facing it has a shade rigged over it,
        so no one aboard can be seen). Drawn up on the shingle: resting on
        its keel, mast lowered along it and the sail rolled on the yard."""
        rng = self.rng
        zw = self.z_water()
        teacher = self._teacher_boat()
        for fp in self.boat_footprints():
            x0, x1, y0, y1 = fp["box"]
            name = f"boat-{x0}-{y0}"
            cx, cy = fp["centre"]
            L, B = fp["length"], fp["beam"]
            if fp["afloat"]:
                base = zb = zw
                # Out on the lake boats are under way; by the shore they lie at rest.
                rig = ("sailing" if self.map.tiles("deck") else "moored") if L >= 4.0 else None
            else:
                # Resting on the beach: the keel on the pebbles.
                base = self.H(cx, cy)
                zb = base + 0.5 * min(1.0, B / 2.3)
                rig = "lowered" if L >= 3.5 else None
            xf = self._boat_xf(cx, cy, base, zb, fp["heading"])
            if not fp["afloat"]:
                # Heeled a little onto its bilge.
                xf = xf @ Matrix.Rotation(0.06 * (1 if rng.random() < 0.5 else -1), 4, "X")
            is_teacher = teacher is not None and fp is teacher
            # A boat whose sail the story sets and takes in (entity_sail_set,
            # entity_sail_furled) is built without its yard and sail.
            story = rig == "sailing" and bool(self._story_sails(fp))
            above, below = self._boat_parts(name, L, B, xf, fp["afloat"], rig, rng, gear=not is_teacher, lamp=fp["afloat"] and not is_teacher and bool(self.map.tiles("deck")), teacher=is_teacher, yard=not story)
            for o in below:
                self.to_ground(o)
            if fp["afloat"]:
                ring = self._wake_ring(name, L, B, xf)
                if ring is not None:
                    self.to_ground(ring)
            for o in above:
                o["wl_z"] = zb
            for o in below:
                o["wl_z"] = zb
            # The ground line: the south edge of the hull at the waterline.
            south = cy + (B / 2 if fp["horizontal"] else L / 2)
            self.sprite(name, south, above, fp["tiles"], fade=rig in ("sailing", "moored"))
            if story:
                self._story_rigs = getattr(self, "_story_rigs", []) + [{"tiles": set(map(tuple, fp["tiles"])), "L": L, "B": B, "xf": xf, "zb": zb, "south": south}]

    def _teacher_boat(self):
        """The boat the crowd listens to (people sitting on the beach facing
        it), or, on the open lake, the one ahead to the east of yours. Its
        people are never shown: a shade is rigged over it."""
        m = self.map
        boats = [fp for fp in self.boat_footprints() if fp["afloat"]]
        if not boats:
            return None
        sitters = [e for e in m.entities if e.get("characterId") and e.get("pose") == "sit" and e.get("facing") == "down" and e.get("conditional")]
        # The crowd: sitters with others close by (not someone sitting alone),
        # on dry land (not people sitting in a boat).
        sitters = [e for e in sitters if m.kind(e["x"], e["y"]) not in ("boat", "lake", "shallows", "deck")]
        sitters = [e for e in sitters if sum(1 for o in sitters if o is not e and abs(o["x"] - e["x"]) + abs(o["y"] - e["y"]) <= 4) >= 2]
        if sitters and not m.tiles("deck"):
            sx = sum(e["x"] for e in sitters) / len(sitters)
            sy = sum(e["y"] for e in sitters) / len(sitters)
            south = [fp for fp in boats if fp["centre"][1] > sy]
            if south:
                return min(south, key=lambda fp: abs(fp["centre"][0] - sx) + 0.3 * (fp["centre"][1] - sy))
        deck = m.tiles("deck")
        if deck:
            dx = max(x for x, _ in deck)
            dy = sum(y for _, y in deck) / len(deck)
            ahead = [fp for fp in boats if fp["centre"][0] > dx]
            if ahead:
                return min(ahead, key=lambda fp: abs(fp["centre"][1] - dy) + 0.2 * (fp["centre"][0] - dx))
        return None

    def _wake_ring(self, name, L, B, xf):
        """A faint ring of disturbed water where a floating hull meets the lake."""
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        rows = []
        n = 40
        for s, w in ((0, 0.0), (1, 0.12)):
            row = []
            for i in range(n):
                a = math.tau * i / n
                u = 0.5 + 0.5 * math.cos(a)
                hb, _, _ = self.hull_shape(u, L, B)
                side = 1 if math.sin(a) >= 0 else -1
                p = Vector((-L / 2 + u * L + math.cos(a) * w, side * (hb * 0.97 + w), 0.004))
                row.append(bm.verts.new(xf @ p))
            rows.append(row)
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new((rows[0][i], rows[0][j], rows[1][j], rows[1][i]))
            for loop, (u, v) in zip(f.loops, ((i, 0), (i + 1, 0), (i + 1, 1), (i, 1))):
                loop[uv].uv = (u * 0.3, 0.5 + v * 0.5)
        o = common.mesh_object(f"{name}-wake", bm, LM.foam(), None)
        o.visible_shadow = False
        return o

    # ── the boat you are aboard ─────────────────────────────────────────────
    def family_outline(self):
        """The boat you are aboard as a smooth outline from its tiles: for
        each x (tiles), the north and south edge of its planking."""
        if getattr(self, "_outline", None) is not None:
            return self._outline
        m = self.map
        cells = [(x, y) for k in ("hull", "deck", "mast") for x, y in m.tiles(k)]
        if not cells:
            self._outline = None
            return None
        xs = sorted({c[0] for c in cells})
        cols = {}
        for x, y in cells:
            lo, hi = cols.get(x, (y, y + 1))
            cols[x] = (min(lo, y), max(hi, y + 1))
        xa, xb = min(xs), max(xs) + 1
        cy = sum((cols[x][0] + cols[x][1]) / 2 for x in xs) / len(xs)
        full = max((hi - lo) / 2 for lo, hi in cols.values()) - 0.15
        # The mast is forward of the middle: that end is the bow.
        mast = m.tiles("mast")
        bow_east = not mast or sum(x for x, _ in mast) / len(mast) + 0.5 >= (xa + xb) / 2
        samples = np.linspace(xa + 0.05, xb - 0.05, 200)
        t = (samples - xa) / (xb - xa)
        u = t if bow_east else 1 - t
        # A clean planform fitted to the tiles: a round, blunt stern, full
        # through the middle, drawn out to a fine bow.
        stern = np.sqrt(np.clip(1 - (1 - u / 0.2) ** 2, 0, 1))
        bow = np.clip(1 - ((u - 0.62) / 0.38) ** 2, 0, 1) ** 0.8
        g = np.where(u < 0.2, stern, np.where(u > 0.62, bow, 1.0))
        half = np.maximum(full * g, 0.12)
        self._outline = {"x": samples, "half": half, "cy": cy, "xa": xa, "xb": xb, "bow_east": bow_east}
        return self._outline

    def _deck_mask(self, W, Hh, K):
        """Samples of the height grid inside the bulwarks of the boat you are aboard."""
        o = self.family_outline()
        mask = np.zeros((Hh, W), dtype=bool)
        if o is None:
            return mask
        xs = np.arange(W) / K
        ys = np.arange(Hh) / K
        half = np.interp(xs, o["x"], o["half"], left=0.0, right=0.0) - 0.16
        inside = np.abs(ys[:, None] - o["cy"]) < half[None, :]
        return inside

    def tile_hull(self):
        """The bulwarks of the boat you are aboard, drawn larger than life
        around its deck: planked outside with pitch below the waterline,
        frames and planking inside, a rounded gunwale on top, thole pins and
        oars out on both sides, the stem and sternpost rising at the ends,
        the helmsman's raised deck at the stern and the steering oar on the
        starboard quarter. Two sprites per map row (stern and bow halves), so people on deck sort
        against the side in front of them and the side behind them."""
        o = self.family_outline()
        if o is None:
            return
        rng = self.rng
        zw = self.z_water()
        rail_z = 0.78
        cy = o["cy"]
        outside = LM.hull_paint("#5e4836", name="bulwark-outside")
        inside = LM.planks("#7c6650", "bulwark-inside", along="X", width=0.16, length=2.4, worn=0.25)
        timber = M.wood("#56402c", 4.0)
        pale = M.wood("#7a6048", 5.0)
        rows = {}

        def put(row, obj):
            rows.setdefault(row, []).append(obj)

        # The outline as points along each side, stern to bow.
        pts_n = [(x, cy - h) for x, h in zip(o["x"], o["half"])]
        pts_s = [(x, cy + h) for x, h in zip(o["x"], o["half"])]
        step = 3
        for side, pts in ((-1, pts_n), (1, pts_s)):
            for i in range(0, len(pts) - step, step):
                seg = pts[i : i + step + 1]
                objs = self._bulwark(f"hull{side}-{i}", seg, side, rail_z, zw, outside, inside, timber)
                row = int(min(max(p[1] for p in seg) - 0.02, self.map.h - 1))
                for ob in objs:
                    put(row, ob)
        # Frames inside the bulwark every half metre.
        for side, pts in ((-1, pts_n), (1, pts_s)):
            for i in range(2, len(pts) - 2, 5):
                x, y = pts[i]
                if o["half"][i] < 0.4:
                    continue
                inward = -side
                top = self._at0(x, y + inward * 0.12, rail_z - 0.04)
                bot = self._at0(x, y + inward * 0.1, 0.02)
                put(int(min(y, self.map.h - 1)), self._branch(f"frame{side}-{i}", bot, top, 0.035, 0.03, pale, 5, bow=0.0))
        # Stem (bow) and sternpost.
        for name, x, rise, lean in (("stem", o["xb"] - 0.05, 1.25, 0.35), ("sternpost", o["xa"] + 0.05, 1.05, -0.3)):
            pts = []
            for k in range(10):
                t = k / 9
                pts.append(self._at0(x + lean * math.sin(t * math.pi / 2) ** 2, cy, zw - 0.3 + (rail_z + rise - zw + 0.3) * t))
            put(int(cy), self._lake_tube(name, pts, 0.09, timber, seg=8, taper=lambda t: 1.0 - 0.35 * t))
        # A lamp hung from the sternpost, lit after dark.
        lx, ly = o["xa"] + 0.35, cy + 0.25
        lamp = self._ellipsoid("stern-lamp", self._at0(lx, ly, 1.45), (0.08, 0.06, 0.035), M.terracotta("#b2714a", 0.1), 14, 8)
        flame = self.lamp_flame("stern-lamp", self._at0(lx + 0.07, ly, 1.5), (0.015, 0.038), 30.0, self._at0(lx + 0.07, ly - 0.08, 1.58), radius=60.0)
        cord = self._branch("stern-lamp-cord", self._at0(lx, ly, 1.48), self._at0(o["xa"] + 0.1, cy, rail_z + 1.0), 0.006, 0.006, LM.rope("#7a6a50", "lamp-cord"), 4, bow=0.0)
        for ob in [lamp, *flame, cord]:
            put(int(cy), ob)
        # The helmsman's deck at the stern: a raised platform of planks.
        self._stern_platform(o, rail_z, put)
        # Oars out, two a side, and the steering oar.
        self._oars_out(o, rail_z, zw, put, rng)
        # Each row in two sprites, the stern half and the bow half: between
        # the ends of most rows there is only deck (in the ground), and one
        # sprite spanning the boat would be mostly transparent texture.
        mid = (o["xa"] + o["xb"]) / 2
        bpy.context.view_layer.update()

        def centre_x(ob):
            return sum((ob.matrix_world @ Vector(c)).x for c in ob.bound_box) / 8

        for row, objs in sorted(rows.items()):
            base = row + 0.98
            for half, part in (("", [ob for ob in objs if centre_x(ob) < mid]), ("-bow", [ob for ob in objs if centre_x(ob) >= mid])):
                if not part:
                    continue
                span = range(int(o["xa"]), int(mid)) if not half else range(int(mid), int(o["xb"]))
                tiles = [(x, row) for x in span if self.map.kind(x, row) == "hull"] or [(int(o["xa"] if not half else mid), row)]
                self.sprite(f"hull-r{row}{half}", base, part, tiles)

    def _bulwark(self, name, seg, side, rail_z, zw, outside, inside, timber):
        """One stretch of the boat's side along `seg` (map points on the
        outline): the planked side from below the waterline to the rail,
        and the rounded gunwale on top."""
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        t_in = 0.1
        rows = []
        girth = []
        for x, y in seg:
            inward = -side
            outer_top = self._at0(x, y, rail_z)
            outer_bot = self._at0(x, y + side * 0.18, zw - 0.55)
            inner_top = self._at0(x, y + inward * t_in, rail_z)
            inner_bot = self._at0(x, y + inward * t_in, 0.0)
            rows.append([outer_bot, outer_top, inner_top, inner_bot])
            girth.append(x)
        verts = [[bm.verts.new(p) for p in r] for r in rows]
        # UV v in metres up the side, over the top and down the inside.
        vs = [0.0, rail_z - (zw - 0.55), rail_z - (zw - 0.55) + t_in, rail_z - (zw - 0.55) + t_in + rail_z]
        for i in range(len(verts) - 1):
            a, b = verts[i], verts[i + 1]
            for k in range(3):
                f = bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
                f.material_index = 0 if k == 0 else 1
                for loop, (u, v) in zip(f.loops, ((girth[i], vs[k]), (girth[i + 1], vs[k]), (girth[i + 1], vs[k + 1]), (girth[i], vs[k + 1]))):
                    loop[uvl].uv = (u, v)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        obj = common.mesh_object(name, bm, outside, None, smooth=True)
        obj.data.materials.append(inside)
        obj["wl_z"] = zw
        pts = [self._at0(x, y - side * t_in / 2, rail_z + 0.02) for x, y in seg]
        rail = self._lake_tube(f"{name}-rail", pts, 0.07, timber, seg=8)
        return [obj, rail]

    def _stern_platform(self, o, rail_z, put):
        """The helmsman's deck: planks laid across over the stern, a step up
        from the main deck, with a low coaming at its front edge."""
        xa = o["xa"]
        span = o["xb"] - o["xa"]
        x1 = xa + span * 0.14
        cy = o["cy"]
        planks = LM.planks("#86705a", "stern-planks", along="Y", width=0.16, length=3.0, worn=0.5)
        bm = bmesh.new()
        n = 12
        rows = []
        for i in range(n + 1):
            x = xa + 0.25 + (x1 - xa - 0.25) * i / n
            h = float(np.interp(x, o["x"], o["half"])) - 0.2
            # A surface people stand on: sheared by its own height.
            rows.append([bm.verts.new(self._at(x, cy - h, 0.28)), bm.verts.new(self._at(x, cy + h, 0.28))])
        for a, b in zip(rows, rows[1:]):
            bm.faces.new((a[0], b[0], b[1], a[1]))
        deck = common.mesh_object("stern-deck", bm, planks, None, smooth=False)
        common.add_modifier(deck, "SOLIDIFY", thickness=0.06)
        # It is part of what people stand on: the ground layer.
        self.to_ground(deck)
        h = float(np.interp(x1, o["x"], o["half"])) - 0.2
        front = common.box("stern-coaming", (0.08, 2 * h, 0.3), self._at0(x1, cy, 0.14), M.wood("#5a4330", 4.0), None, bevel=0.01)
        common.bake_modifiers(front)
        self.to_ground(front)
        _ = (rail_z, put)

    def _oars_out(self, o, rail_z, zw, put, rng):
        """Four oars through thole pins on the rail, blades in the water, and
        the long steering oar on the starboard quarter, its loom up by the
        helmsman's hand."""
        oar = M.wood("#8a6c4c", 3.0)
        span = o["xb"] - o["xa"]
        cy = o["cy"]
        for side in (-1, 1):
            for f in (0.3, 0.5):
                x = o["xa"] + span * f
                h = float(np.interp(x, o["x"], o["half"]))
                y = cy + side * h
                pin = self._at0(x, y, rail_z + 0.05)
                handle = self._at0(x - 0.15, y - side * 0.35, rail_z + 0.12)
                blade = self._at0(x + 0.9, y + side * 2.2, zw + 0.02)
                row = int(min(y, self.map.h - 1))
                put(row, self._oar(f"oar{side}{f}", handle, blade, oar, blade=0.8, r=0.03))
                put(row, self._branch(f"thole{side}{f}", pin + Vector((0, 0, -0.05)), pin + Vector((0, 0, 0.12)), 0.018, 0.016, M.wood("#4a3626", 3.0), 5, bow=0.0))
        # Steering oar on the starboard (south) quarter.
        x = o["xa"] + span * 0.08
        h = float(np.interp(x, o["x"], o["half"]))
        y = cy + h
        top = self._at0(x + 0.9, y - 1.1, 1.1)
        blade = self._at0(x - 1.2, y + 1.3, zw - 0.25)
        put(int(min(y, self.map.h - 1)), self._oar("steering-oar", top, blade, oar, blade=1.3, r=0.045))

    def tile_mast(self):
        """The mast of the boat you are aboard, stepped just forward of the
        middle: a stout pole, the yard across it and the square sail half
        brailed up (the lower edge gathered in scallops by the brails),
        shrouds to both rails, a forestay to the bow. A canopy: it fades
        while you walk behind it."""
        rng = self.rng
        cells = self.map.tiles("mast")
        o = self.family_outline()
        if not cells or o is None:
            return
        mx = sum(c[0] for c in cells) / len(cells) + 0.5
        my = sum(c[1] for c in cells) / len(cells) + 0.5
        spar = M.wood("#6a5238", 3.5)
        sail = LM.linen("#bdb196", "sail-linen")
        rope = LM.rope("#9c8660", "rig-rope")
        mast_h = 7.4
        objs = [self._branch("mast", self._at0(mx, my, -0.05), self._at0(mx, my, mast_h), 0.13, 0.08, spar, 12, bow=0.0)]
        # The partner: a heavy block where the mast passes the deck.
        part = common.box("mast-partner", (0.5, 0.5, 0.16), self._at0(mx, my, 0.08), M.wood("#5a4330", 4.0), None, bevel=0.03)
        common.bake_modifiers(part)
        objs.append(part)
        yard = 7.0
        yz = mast_h - 0.45
        brace = math.radians(34.0)
        along = Vector((math.sin(brace), math.cos(brace), 0.0))
        yc = self._at0(mx + 0.12, my, yz)
        ya = yc + along * yard / 2
        yb = yc - along * yard / 2
        aloft = [self._branch("yard", ya, yb, 0.075, 0.06, spar, 10, bow=-0.12)]
        aloft.append(self._sail(mx + 0.25, my, yz - 0.08, yard - 0.4, 2.3, sail, rng))
        aloft.append(self._branch("halyard", self._at0(mx, my, mast_h - 0.1), self._at0(mx - 0.1, my, 1.0), 0.01, 0.01, rope, 4, bow=0.0))
        # The yard and sail are the story's sail, if it has one by the mast (a
        # feature shown until the sail is taken in): they go when it does.
        sail_entity = next(
            (e for e in self.map.entities if e.get("conditional") and e.get("sprite") in (None, "none") and not e.get("characterId") and any(abs(e["x"] - cx) <= 1 and abs(e["y"] - cy) <= 1 for cx, cy in cells)),
            None,
        )
        if sail_entity is not None:
            from place import Sprite

            self.sprites.append(Sprite(f"entity:{sail_entity['id']}", (my + 0.3) * 32.0, aloft, [(sail_entity["x"], sail_entity["y"])], conditional=True, fade=True))
        else:
            objs += aloft
        mh = self._at0(mx, my, mast_h - 0.15)
        for side in (-1, 1):
            x = mx - 1.0
            h = float(np.interp(x, o["x"], o["half"]))
            objs.append(self._branch(f"shroud{side}", mh, self._at0(x, o["cy"] + side * h, 0.8), 0.012, 0.012, rope, 4, bow=0.0))
            x2 = mx - 2.2
            h2 = float(np.interp(x2, o["x"], o["half"]))
            objs.append(self._branch(f"shroud2{side}", mh, self._at0(x2, o["cy"] + side * h2, 0.8), 0.012, 0.012, rope, 4, bow=0.0))
        objs.append(self._branch("forestay", mh, self._at0(o["xb"] - 0.4, o["cy"], 1.6), 0.012, 0.012, rope, 4, bow=0.0))
        self.sprite("mast", my + 0.3, objs, cells, fade=True)

    def square_sail(self, name, centre, along, width, drop, belly_dir, mat, brails=6, belly=0.4):
        """A square sail hanging from its yard, half brailed up: the cloth
        gathered toward the yard along the brail lines, so its lower edge
        hangs in festoons, bellied toward `belly_dir` by the air. `centre` is
        the middle of the yard (Blender), `along` the yard's direction."""
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        nu, nv = 40, 14
        grid = []
        out = Vector((belly_dir.x, belly_dir.y, 0.0))
        out = out - along * out.dot(along)
        out = out.normalized() if out.length > 1e-4 else Vector((1, 0, 0))
        for j in range(nv + 1):
            v = j / nv
            row = []
            for i in range(nu + 1):
                u = i / nu
                ph = (u * brails) % 1.0
                fest = 0.35 * math.sin(math.pi * ph) ** 1.5
                d = drop * v * (0.62 + fest)
                b = belly * math.sin(math.pi * u) * math.sin(math.pi * min(1.0, v * 1.1)) ** 0.8
                fold = 0.05 * math.sin(u * 60 + v * 3) * v
                p = centre + along * (width * (u - 0.5)) + out * (b + fold) + Vector((0, 0, -d))
                row.append(bm.verts.new(p))
            grid.append(row)
        for j in range(nv):
            for i in range(nu):
                f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                for loop, (a, bb) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    loop[uv].uv = (a / nu, 1 - bb / nv)
        s = common.mesh_object(name, bm, mat, None)
        common.add_modifier(s, "SOLIDIFY", thickness=0.01)
        return s

    def _sail(self, x, cy, top, width, drop, mat, rng):
        """The big boat's sail, half brailed up, the yard braced round so it
        catches the evening air over the quarter (and shows its face)."""
        brace = math.radians(34.0)
        along = Vector((math.sin(brace), math.cos(brace), 0.0))
        return self.square_sail("sail", self._at0(x, cy, top), along, width, drop, Vector((1, 0, 0)), mat, belly=0.5)
