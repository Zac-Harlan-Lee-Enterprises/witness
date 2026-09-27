"""Teeth, gums and tongue, seen when a person's lips part (a smile, a shout,
surprise).

MakeHuman's base mesh carries helper geometry for them: a block along each
dental arch and a tongue, shaped with the rest of the face by every target
(and the lower block moved with the jaw by the expressions that open the
mouth). The teeth themselves are built here: each one a crown with its own
shape (chisel-edged incisors, pointed canines, cusped premolars and molars),
set along the arch the helper block traces, leaning outward a little, with
the gum over their necks. The tongue is MakeHuman's helper tongue.

Each arch is built on the rest shape and moved rigidly (the best-fitting
rotation and translation of its helper block) to the posed shape, so the
lower teeth follow an opening jaw.

The expressions move the lips and cheeks, not the upper teeth: a mouth
stretched back (fear) or a wide smile can bring the corners of the mouth
in past the back teeth and gums, which then poke through the skin. So
every point of the teeth, gums and tongue that ends up outside the face
(in the open, not in the mouth: see `Inside`) is drawn back under the
skin, where it can't be seen.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import portrait_mesh

F = np.float32
CM = 0.01

# Per side, from the middle: (name, width, crown height, thickness) in cm.
UPPER = [("i1", 0.86, 1.02, 0.7), ("i2", 0.66, 0.88, 0.62), ("c", 0.76, 0.98, 0.8), ("p1", 0.7, 0.8, 0.9), ("p2", 0.66, 0.76, 0.9), ("m1", 1.0, 0.68, 1.05), ("m2", 0.9, 0.64, 1.0)]
LOWER = [("i1", 0.52, 0.88, 0.58), ("i2", 0.57, 0.9, 0.6), ("c", 0.68, 0.98, 0.75), ("p1", 0.7, 0.8, 0.8), ("p2", 0.71, 0.78, 0.85), ("m1", 1.1, 0.7, 1.05), ("m2", 1.04, 0.66, 1.0)]


def _kabsch(A, B):
    """Rotation R and translation t with R @ a + t ≈ b (least squares)."""
    ca, cb = A.mean(0), B.mean(0)
    H = (A - ca).T @ (B - cb)
    U, _, Vt = np.linalg.svd(H.astype(np.float64))
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    D = np.diag([1.0, 1.0, d])
    Rm = Vt.T @ D @ U.T
    return Rm.astype(F), (cb - Rm @ ca).astype(F)


def _arch(V):
    """The dental arch a helper block traces: a curve through the middle of
    the block, from the back on the right to the back on the left, as
    (points, the block's top and bottom at each point)."""
    c = np.array([0.0, V[:, 1].max(), 0.0], F)  # behind the arch
    ang = np.degrees(np.arctan2(V[:, 0] - c[0], -(V[:, 1] - c[1])))
    bins = np.linspace(ang.min(), ang.max(), 15)
    pts, tops, bots = [], [], []
    for a0, a1 in zip(bins[:-1], bins[1:]):
        m = (ang >= a0) & (ang <= a1)
        if m.sum() < 2:
            continue
        q = V[m]
        pts.append([q[:, 0].mean(), q[:, 1].mean(), (q[:, 2].max() + q[:, 2].min()) / 2])
        tops.append(q[:, 2].max())
        bots.append(q[:, 2].min())
    return np.array(pts, F), np.array(tops, F), np.array(bots, F)


def _resample(pts, n=200):
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    t = np.concatenate([[0], np.cumsum(seg)])
    s = np.linspace(0, t[-1], n)
    return np.stack([np.interp(s, t, pts[:, k]) for k in range(3)], 1).astype(F), s, t[-1]


def _crown(kind, w, h, th, segs=20, rings=12):
    """A tooth crown as (vertices, quads) in its own frame: X along the arch,
    Y outward (labial), Z from the gum (0) to the biting edge (h)."""
    verts = []
    for i in range(rings + 1):
        v = i / rings
        # Width: narrow at the neck, widest near the biting third; rounded corners.
        a = w / 2 * (0.72 + 0.28 * math.sin(math.pi / 2 * min(1.0, v * 1.6)))
        b = th / 2 * (0.85 + 0.15 * math.sin(math.pi * v))
        if kind.startswith("i"):
            b *= 1.0 - 0.62 * v**1.3  # a chisel edge
            if v > 0.86:
                a *= math.sqrt(max(0.0, 1 - ((v - 0.86) / 0.16) ** 2)) * 0.25 + 0.75
        elif kind == "c":
            a *= 1.0 - 0.75 * max(0.0, v - 0.55) / 0.45  # a point
            b *= 1.0 - 0.35 * v
        else:
            if v > 0.88:
                k = math.sqrt(max(0.0, 1 - ((v - 0.88) / 0.14) ** 2))
                a *= 0.55 + 0.45 * k
                b *= 0.55 + 0.45 * k
        for j in range(segs):
            u = 2 * math.pi * j / segs
            cu, su = math.cos(u), math.sin(u)
            e = 0.55  # squarish (superellipse)
            x = a * math.copysign(abs(cu) ** e, cu)
            y = b * math.copysign(abs(su) ** e, su)
            z = v * h
            if kind.startswith(("p", "m")) and v > 0.8:
                # Cusps: the biting surface rises at its corners.
                z += 0.06 * h * (abs(cu) * abs(su)) ** 0.5
            verts.append((x, y, z))
    # A cap at the biting end.
    tip = (0.0, 0.0, h * (1.0 if not kind.startswith(("p", "m")) else 0.96))
    verts.append(tip)
    quads = []
    for i in range(rings):
        for j in range(segs):
            a0 = i * segs + j
            a1 = i * segs + (j + 1) % segs
            quads.append((a0, a1, a1 + segs, a0 + segs))
    last = rings * segs
    top = len(verts) - 1
    for j in range(segs):
        quads.append((last + j, last + (j + 1) % segs, top, top))
    return np.array(verts, F), quads


class Inside:
    """Where the mouth's contents may be seen: in the mouth (behind the
    lips, in front of the mouth's own lining) but never outside the face.
    A point is outside the face when it is out of the flesh (the skin's
    distance field is positive) and the skin nearest to it is the face's
    outer skin, not the lining of the mouth: a gum that pokes through the
    corner of a stretched mouth, not a front tooth seen between parted lips."""

    def __init__(self, V, Q, field, lining):
        from mathutils.bvhtree import BVHTree

        tris, owner = [], []
        for i, q in enumerate(Q):
            tris.append((int(q[0]), int(q[1]), int(q[2])))
            tris.append((int(q[0]), int(q[2]), int(q[3])))
            owner += [i, i]
        self.tree = BVHTree.FromPolygons([Vector(v) for v in V.tolist()], tris, all_triangles=True)
        self.owner = owner
        self.Q = Q
        self.field = field
        # The mouth's lining (0 outer skin … 1 inside the mouth), per skin vertex.
        self.lining = np.asarray(lining, F)

    def exposed(self, P):
        """True for points (cm) outside the face."""
        dist = self.field.dist(np.asarray(P, F))
        out = np.zeros(len(P), bool)
        for i in np.nonzero(dist > 0.02)[0]:
            loc, _, idx, _ = self.tree.find_nearest(Vector(P[i].tolist()))
            if idx is None:
                continue
            quad = self.Q[self.owner[idx]]
            out[i] = float(self.lining[quad].mean()) < 0.5
        return out

    def tuck(self, P, depth=0.12):
        """Points outside the face drawn back under the skin (along the
        field's gradient, to `depth` cm inside); the rest unchanged.
        Returns (points, how many were moved)."""
        P = np.asarray(P, F).copy()
        bad = self.exposed(P)
        if bad.any():
            for _ in range(4):
                d = self.field.dist(P[bad])
                P[bad] -= self.field.grad(P[bad]) * (d + depth)[:, None]
        return P, int(bad.sum())


def _tuck_bmesh(bm, inside):
    if inside is None:
        return 0
    P = np.array([tuple(v.co) for v in bm.verts], F)
    P, n = inside.tuck(P)
    for v, p in zip(bm.verts, P):
        v.co = Vector(p.tolist())
    return n


def build(head, P, col, mats, inside=None):
    """Teeth, gums and tongue for a head (portrait_mhhead.MHHead); `inside`
    (an Inside) keeps them out of sight where they would poke through."""
    objs = []
    tucked = 0
    rng = np.random.default_rng(P.seed + 71)
    child = P.child
    # Children's teeth are smaller (a ten-year-old has most adult front teeth, a six-year-old few).
    scale = 1.0 - 0.18 * child
    for jaw, group, table, down in (("upper", "helper-upper-teeth", UPPER, True), ("lower", "helper-lower-teeth", LOWER, False)):
        Vr, _, used = head.helper_mesh(group, rest=True)
        Vp = head.V[used]
        Rm, t = _kabsch(Vr, Vp)
        pts, tops, bots = _arch(Vr)
        curve, s_at, total = _resample(pts)
        mid = total / 2
        half = sum(w for _, w, _, _ in table) * scale
        fit = min(1.0, (total / 2) * 0.98 / half)
        # MakeHuman's dental block sits well behind the lips (4-5 mm of air
        # between the front teeth and the inside of the lips, which read as
        # dentures deep in a dark mouth). A person's front teeth rest against
        # the inside of the lips: the arch is brought forward until they
        # do, fully at the front and less toward the back.
        j0 = int(np.argmin(np.abs(curve[:, 0])))
        front = curve[j0].copy()
        jz = int(np.clip(round(j0 / len(curve) * (len(tops) - 1)), 0, len(tops) - 1))
        _, h0, th0 = table[0][1], table[0][2] * scale, table[0][3] * scale
        front[2] = (bots[jz] + 0.05 + 0.4 * h0) if down else (tops[jz] - 0.05 - 0.4 * h0)
        forward = _gap_to_lips(head, front + np.array([0.0, -(th0 / 2 + 0.05), 0.0], F))
        bm = bmesh.new()
        gum_pts = []
        for side in (-1, 1):
            pos = 0.0
            for k, (kind, w, h, th) in enumerate(table):
                # No two teeth quite alike: a little wider or narrower, longer or shorter.
                w, h, th = w * scale * fit * rng.uniform(0.94, 1.06), h * scale * rng.uniform(0.93, 1.05), th * scale
                centre_s = mid + side * (pos + w / 2)
                pos += w + 0.02
                if centre_s < 0 or centre_s > total:
                    continue
                i = int(np.clip(np.searchsorted(s_at, centre_s), 1, len(curve) - 1))
                p = curve[i]
                tangent = curve[min(i + 1, len(curve) - 1)] - curve[i - 1]
                tangent /= max(np.linalg.norm(tangent), 1e-6)
                # Outward: across the arch, away from its inside (toward the lips and cheeks).
                outward = np.cross(tangent, np.array([0, 0, 1], F))
                arch_in = np.array([0.0, curve[:, 1].min() + 0.6 * (curve[:, 1].max() - curve[:, 1].min()), p[2]], F)
                if np.dot(outward, p - arch_in) < 0:
                    outward = -outward
                outward[2] = 0
                outward /= max(np.linalg.norm(outward), 1e-6)
                # Heights: the biting edge at the block's edge toward the other jaw.
                j = int(np.clip(round(i / len(curve) * (len(tops) - 1)), 0, len(tops) - 1))
                edge_z = bots[j] + 0.05 if down else tops[j] - 0.05
                front = k <= 2
                tilt = math.radians((12 if front else 4) + rng.uniform(-3, 3))
                verts, quads = _crown(kind, w, h, th)
                # Frame: X along the arch, Y outward, Z toward the biting edge.
                zdir = np.array([0, 0, -1 if down else 1], F)
                # Lean the crown outward at the top (upper) / bottom (lower).
                zdir = zdir * math.cos(tilt) - outward * math.sin(tilt) * 0.6
                zdir /= np.linalg.norm(zdir)
                x_ax = tangent
                y_ax = np.cross(zdir, x_ax)
                if np.dot(y_ax, outward) < 0:
                    y_ax = -y_ax
                M = np.stack([x_ax, y_ax, zdir], 1)
                base_pt = np.array([p[0], p[1], edge_z], F) - zdir * (h + rng.uniform(-0.05, 0.04)) + outward * (0.05 + rng.uniform(-0.03, 0.03))
                # Brought forward (see above): fully at the incisors, half at the molars.
                base_pt = base_pt + np.array([0.0, -forward * (1.0 - 0.5 * k / (len(table) - 1)), 0.0], F)
                # A little irregularity: each tooth turned and set a fraction differently.
                rot = Matrix.Rotation(rng.uniform(-0.1, 0.1), 3, "Z") @ Matrix.Rotation(rng.uniform(-0.05, 0.05), 3, "X")
                Vt = (np.array([rot @ Vector(v) for v in verts.tolist()], F) @ M.T) + base_pt
                bv = [bm.verts.new(v.tolist()) for v in Vt]
                for q in quads:
                    try:
                        if q[2] == q[3]:
                            bm.faces.new((bv[q[0]], bv[q[1]], bv[q[2]]))
                        else:
                            bm.faces.new([bv[x] for x in q])
                    except ValueError:
                        pass
                gum_pts.append((centre_s, base_pt + zdir * 0.12, outward, zdir, w, th))
        # Move the whole arch with its block (the lower teeth with the jaw).
        for v in bm.verts:
            v.co = Vector((Rm @ np.array(v.co, F) + t).tolist())
        tucked += _tuck_bmesh(bm, inside)
        for v in bm.verts:
            v.co *= CM
        teeth = common.mesh_object(f"teeth-{jaw}", bm, mats["teeth"], col)
        objs.append(teeth)
        # The gum: a soft ridge along the arch over the teeth's necks.
        gum_pts.sort(key=lambda g: g[0])
        if gum_pts:
            gum, n = _gum(f"gum-{jaw}", gum_pts, Rm, t, col, mats["gum"], down, inside)
            objs.append(gum)
            tucked += n
    # The tongue.
    Vt, Qt, used = head.helper_mesh("helper-tongue")
    if inside is not None:
        Vt, n = inside.tuck(Vt)
        tucked += n
    tongue = portrait_mesh.from_arrays("tongue", Vt, Qt, None, mats["tongue"], col)
    for p in tongue.data.polygons:
        p.use_smooth = True
    sub = tongue.modifiers.new("sub", "SUBSURF")
    sub.levels = 0
    sub.render_levels = 2
    objs.append(tongue)
    build.tucked = tucked
    return objs


def _gap_to_lips(head, p, leave=0.06, reach=1.2, step=0.02):
    """How far (cm) the point `p` (the front of the front teeth, on the rest
    shape) can move forward before it is within `leave` of the inside of
    the lips."""
    field = head.sdf_grid("rest")
    moved = 0.0
    q = np.array(p, F).reshape(1, 3)
    while moved < reach and float(field.dist(q)[0]) > leave:
        q[0, 1] -= step
        moved += step
    return max(0.0, moved - step)


def _gum(name, gum_pts, Rm, t, col, mat, down, inside=None):
    """A rounded ridge through the gum points (a tube, flattened)."""
    bm = bmesh.new()
    rings = []
    seg = 10
    for _, p, outward, zdir, w, th in gum_pts:
        for off in (-0.35, 0.0, 0.35):
            q = p + np.cross(zdir, outward) * off * w
            ring = []
            for k in range(seg):
                a = 2 * math.pi * k / seg
                d = outward * math.cos(a) * th * 0.62 + zdir * math.sin(a) * 0.3
                ring.append(bm.verts.new((Rm @ (q - zdir * 0.18 + d) + t).tolist()))
            rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((ra[k], ra[k2], rb[k2], rb[k]))
    n = _tuck_bmesh(bm, inside)
    for v in bm.verts:
        v.co *= CM
    obj = common.mesh_object(name, bm, mat, col)
    sub = obj.modifiers.new("sub", "SUBSURF")
    sub.levels = 0
    sub.render_levels = 1
    return obj, n
