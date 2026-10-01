"""Rock doves for the teaser's market (shot 3), modelled to be seen from a
metre or two: lofted bodies with a full breast and a flat back, a small
round head on a thick neck, a slender dark bill with its white cere, an
orange eye, folded wings crossing over the tail with their two black
bars, a fan of tail feathers with a dark band at the end, pink legs and
toes. Neck feathers shift green to purple with the angle of view.

`Pigeon(name, seed)` builds one; `place(at, heading, peck=, fly=, bank=)`
poses it each frame: on the ground it pecks and bobs, in the air it
beats spread wings (the folded ones are hidden).

A dove faces -Y in its own frame, feet at z = 0, about 32 cm long.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import common
import teaser_city as C
from teaser_nodes import Graph


# ── materials ────────────────────────────────────────────────────────────────
def plumage(name, grey="#8d9098", dark="#5d6068", neck=None, bars=False, band=False):
    """Soft grey plumage: feathers overlapping like scales (a fine bump),
    slightly velvety (sheen). `neck`: iridescent green and purple by the
    angle of view, between heights `neck` (from, to); `bars`: the two black bars across a folded wing (and
    darker primaries at its tip); `band`: the tail's dark terminal band."""

    def build():
        g = Graph(name)
        pos = g.coords("Object")
        _, y, z = g.xyz(pos)
        scale = g.voronoi(g.vmath("MULTIPLY", pos, (1.0, 1.6, 1.0)), 160.0)
        col = g.mix(g.map(g.noise(pos, 25.0, 3.0), 0.3, 0.7), dark, grey)
        col = g.mix(g.mul(g.map(scale, 0.0, 0.5, 0.0, 1.0), 0.25), col, "#b8bac0")
        if neck:
            facing = g.node("ShaderNodeLayerWeight", {"Blend": 0.35}).outputs["Facing"]
            sheen = g.mix(facing, "#3d7a5a", "#7a4a86")
            col = g.mix(g.mul(g.smooth(z, neck[0], neck[1]), 0.8), col, sheen)
        if bars:
            # Local y runs from the shoulder (0) to the tip (about 0.2).
            b1 = g.mul(g.smooth(y, 0.075, 0.085), g.smooth(y, 0.105, 0.095))
            b2 = g.mul(g.smooth(y, 0.115, 0.125), g.smooth(y, 0.145, 0.135))
            col = g.mix(g.math("MAXIMUM", b1, b2), col, "#1d1c1e")
            col = g.mix(g.smooth(y, 0.16, 0.19), col, "#3a3b40")
        if band:
            col = g.mix(g.smooth(y, 0.075, 0.09), col, "#27272b")
        g.principled(col, 0.62, 0.35, g.bump(scale, 0.25, 0.002), **{"Sheen Weight": 0.5, "Sheen Roughness": 0.4})
        return g.mat

    return C._cached(name, build)


def _flat(name, color, rough=0.5):
    return C.plain(name, color, rough)


# ── geometry ─────────────────────────────────────────────────────────────────
def loft(name, sections, material, segments=18, power=2.2):
    """A closed body lofted through cross-sections (centre, half-width,
    half-height above, half-height below), capped at both ends. Sections
    are superellipses (`power`), fuller than ellipses."""
    bm = bmesh.new()
    rings = []
    for c, w, up, down in sections:
        ring = []
        for j in range(segments):
            a = math.tau * j / segments
            ca, sa = math.cos(a), math.sin(a)
            x = math.copysign(abs(ca) ** (2.0 / power), ca) * w
            zz = math.copysign(abs(sa) ** (2.0 / power), sa) * (up if sa > 0 else down)
            ring.append(bm.verts.new(Vector(c) + Vector((x, 0.0, zz))))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for j in range(segments):
            k = (j + 1) % segments
            bm.faces.new((a[j], a[k], b[k], b[j]))
    for ring, tip in ((rings[0], sections[0][0]), (rings[-1], sections[-1][0])):
        centre = bm.verts.new(Vector(tip))
        for j in range(segments):
            k = (j + 1) % segments
            bm.faces.new((ring[j], ring[k], centre))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = common.mesh_object(name, bm, material, None, smooth=True)
    common.add_modifier(obj, "SUBSURF", levels=1, render_levels=2)
    return obj


def feather(bm, root, direction, side, length, width, curl=0.0):
    """One flat feather: a vane tapering to a rounded tip."""
    d = direction.normalized()
    s = side.normalized()
    up = d.cross(s)
    pts = []
    for k in range(6):
        t = k / 5
        w = width * math.sin(math.pi * min(1.0, 0.15 + t * 0.9)) ** 0.6
        c = root + d * (length * t) + up * (curl * t * t)
        pts.append((c - s * w * 0.5, c + s * w * 0.5))
    vs = [(bm.verts.new(a), bm.verts.new(b)) for a, b in pts]
    for (a0, b0), (a1, b1) in zip(vs, vs[1:]):
        bm.faces.new((a0, b0, b1, a1))


class Pigeon:
    """A rock dove: grey body, darker head, iridescent neck, two dark wing
    bars. Pecks and bobs on the ground, or flies with beating wings."""

    def __init__(self, name, seed=0):
        rng = random.Random(seed)
        self.rng = rng
        s = 0.92 + rng.random() * 0.16
        self.s = s
        tone = rng.random()
        grey = "#8c9098" if tone < 0.7 else "#9a9690"
        body_mat = plumage(f"dove-body-{grey}", grey, "#62656d", neck=(0.13, 0.165))
        head_mat = plumage("dove-head", "#6f737c", "#50535a", neck=(0.06, 0.025))
        wing_mat = plumage(f"dove-wing-{grey}", "#a5a8b0" if tone < 0.7 else "#aaa49a", "#80838b", bars=True)
        tail_mat = plumage("dove-tail", "#7b7e86", "#5b5e66", band=True)
        # Torso: full breast, flat back, narrowing to the tail.
        sec = [
            ((0, -0.085, 0.165), 0.018, 0.018, 0.02),
            ((0, -0.07, 0.15), 0.042, 0.03, 0.05),
            ((0, -0.045, 0.13), 0.058, 0.035, 0.065),
            ((0, -0.01, 0.12), 0.064, 0.04, 0.06),
            ((0, 0.03, 0.12), 0.058, 0.036, 0.048),
            ((0, 0.07, 0.128), 0.04, 0.026, 0.03),
            ((0, 0.1, 0.136), 0.024, 0.014, 0.016),
        ]
        self.body = loft(f"{name}-body", [(Vector(c) * s, w * s, u * s, d * s) for c, w, u, d in sec], body_mat)
        # Neck and head, round a pivot at the neck's base (0, -0.07, 0.15).
        self.pivot = Vector((0, -0.07, 0.15)) * s
        hs = [
            ((0, 0.0, 0.0), 0.034, 0.03, 0.03),
            ((0, -0.012, 0.035), 0.03, 0.028, 0.028),
            ((0, -0.022, 0.065), 0.024, 0.024, 0.024),
            ((0, -0.03, 0.085), 0.021, 0.022, 0.019),
            ((0, -0.045, 0.092), 0.017, 0.016, 0.015),
            ((0, -0.056, 0.089), 0.008, 0.009, 0.008),
        ]
        self.head = loft(f"{name}-head", [(Vector(c) * s, w * s, u * s, d * s) for c, w, u, d in hs], head_mat)
        bm = bmesh.new()
        # Bill: slender, dark, a white fleshy cere at its base.
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.0055 * s, radius2=0.0015 * s, depth=0.022 * s, matrix=Matrix.Translation(Vector((0, -0.068, 0.086)) * s) @ Matrix.Rotation(math.radians(95), 4, "X"))
        bill = common.mesh_object(f"{name}-bill", bm, _flat("dove-bill", "#2b2626", 0.4), None)
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.0065 * s, matrix=Matrix.Translation(Vector((0, -0.058, 0.092)) * s) @ Matrix.Diagonal((1.0, 1.3, 0.7, 1.0)))
        cere = common.mesh_object(f"{name}-cere", bm, _flat("dove-cere", "#e9e4dc", 0.8), None)
        eyes = []
        for sx in (-1, 1):
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.0055 * s, matrix=Matrix.Translation(Vector((sx * 0.017, -0.036, 0.095)) * s))
            eyes.append(common.mesh_object(f"{name}-eye{sx}", bm, _flat("dove-eye", "#c8531c", 0.15), None))
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.0028 * s, matrix=Matrix.Translation(Vector((sx * 0.0205, -0.037, 0.0955)) * s))
            eyes.append(common.mesh_object(f"{name}-pupil{sx}", bm, _flat("dove-pupil", "#050505", 0.1), None))
        self.head_parts = [self.head, bill, cere, *eyes]
        # Folded wings over the back, tips crossing over the tail.
        self.wings = []
        for sx in (-1, 1):
            ws = [
                ((sx * 0.045, -0.05, 0.155), 0.012, 0.012, 0.02),
                ((sx * 0.052, -0.02, 0.15), 0.014, 0.02, 0.03),
                ((sx * 0.048, 0.03, 0.148), 0.012, 0.018, 0.028),
                ((sx * 0.034, 0.08, 0.146), 0.01, 0.012, 0.016),
                ((sx * 0.018, 0.14, 0.142), 0.007, 0.006, 0.008),
                ((sx * 0.006, 0.17, 0.14), 0.003, 0.003, 0.003),
            ]
            w = loft(f"{name}-wing{sx}", [(Vector(c) * s, a * s, u * s, d * s) for c, a, u, d in ws], wing_mat, segments=14)
            # The wing's own coordinates run from its shoulder: y 0 .. 0.22.
            w.data.transform(Matrix.Translation((0, 0.05 * s, 0)))
            self.wings.append((w, Matrix.Translation((0, -0.05 * s, 0))))
        # Spread wings, for flight: a feathered planform from the shoulder.
        self.spread = []
        for sx in (-1, 1):
            bm = bmesh.new()
            for k in range(11):
                t = k / 10
                # Secondaries near the body point back; primaries at the
                # hand fan out sideways and back, the outermost longest.
                root = Vector((sx * (0.015 + 0.16 * t), -0.01 * t, 0.0)) * s
                direction = Vector((sx * (0.1 + 1.1 * t * t), 1.0, 0.0))
                side = Vector((1.0, -sx * (0.1 + 1.1 * t * t), 0.0))
                feather(bm, root, direction, side, (0.075 + 0.08 * t) * s, 0.04 * s, curl=0.004 * s)
            wing = common.mesh_object(f"{name}-spread{sx}", bm, wing_mat, None, smooth=True)
            common.add_modifier(wing, "SOLIDIFY", thickness=0.003)
            self.spread.append(wing)
        # Tail: a fan of feathers with a dark band at the end.
        bm = bmesh.new()
        for k in range(8):
            a = (k - 3.5) / 3.5 * 0.35
            feather(bm, Vector((0, 0.08, 0.14)) * s, Vector((math.sin(a), math.cos(a), 0.02)), Vector((math.cos(a), -math.sin(a), 0)), 0.1 * s, 0.03 * s, curl=-0.004)
        self.tail = common.mesh_object(f"{name}-tail", bm, tail_mat, None, smooth=True)
        common.add_modifier(self.tail, "SOLIDIFY", thickness=0.004)
        self.tail.data.transform(Matrix.Translation((0, -0.08 * s, 0)))
        self.tail_pivot = Matrix.Translation((0, 0.08 * s, 0))
        # Legs and toes: short, pink-red.
        bm = bmesh.new()
        legs = _flat("dove-legs", "#b5504a", 0.5)
        for sx in (-1, 1):
            hip = Vector((sx * 0.018, -0.0, 0.085)) * s
            foot = Vector((sx * 0.02, -0.01, 0.006)) * s
            _cyl(bm, hip, foot, 0.0045 * s)
            for a in (-0.5, 0.0, 0.5, math.pi):
                L = 0.028 if a != math.pi else 0.018
                tip = foot + Vector((math.sin(a) * L, -math.cos(a) * L, -0.004)) * s
                _cyl(bm, foot, tip, 0.0022 * s)
        self.legs = common.mesh_object(f"{name}-legs", bm, legs, None, smooth=True)
        self.parts = [self.body, *self.head_parts, *[w for w, _ in self.wings], *self.spread, self.tail, self.legs]

    def place(self, at, heading, peck=0.0, fly=None, bank=0.0, look=0.0):
        """Ground: peck 0..1 dips the head to the ground, look turns it.
        Flying: fly = wing phase (the folded wings hidden, the spread ones
        beating), bank rolls the bird."""
        s = self.s
        W = Matrix.Translation(Vector(at)) @ Matrix.Rotation(heading + math.pi / 2, 4, "Z")
        flying = fly is not None
        if flying:
            W = W @ Matrix.Rotation(bank, 4, "Y") @ Matrix.Rotation(-0.15, 4, "X") @ Matrix.Translation((0, 0, -0.1 * s))
        self.body.matrix_world = W
        # Head: pecking tips it forward and down round the neck's base; the
        # head bobs forward a little as it goes.
        tip = -1.25 * peck if not flying else -0.35
        # (The head's parts are modelled round the pivot.)
        H = W @ Matrix.Translation(self.pivot) @ Matrix.Rotation(look, 4, "Z") @ Matrix.Rotation(tip, 4, "X") @ Matrix.Translation((0, -0.012 * peck * s, 0))
        for p in self.head_parts:
            p.matrix_world = H
        self.tail.matrix_world = W @ self.tail_pivot @ Matrix.Rotation(0.1 * peck, 4, "X")
        for w, off in self.wings:
            w.matrix_world = W @ off
            w.hide_render = flying
        for k, w in enumerate(self.spread):
            sgn = -1 if k == 0 else 1
            w.hide_render = not flying
            if flying:
                beat = math.sin(fly * math.tau) * 1.0 + 0.15
                w.matrix_world = W @ Matrix.Translation((sgn * 0.04 * s, -0.03 * s, 0.15 * s)) @ Matrix.Rotation(-sgn * beat, 4, "Y")
            else:
                w.matrix_world = W
        self.legs.matrix_world = W if not flying else W @ Matrix.Translation((0, 0.03 * s, 0.07 * s)) @ Matrix.Rotation(1.2, 4, "X") @ Matrix.Scale(0.6, 4)


def _cyl(bm, a, b, r):
    d = b - a
    q = d.to_track_quat("Z", "Y")
    bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=r, radius2=r * 0.85, depth=d.length, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4())



