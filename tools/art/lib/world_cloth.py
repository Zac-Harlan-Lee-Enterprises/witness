"""A world figure's clothes: cut to the person's MakeHuman body and draped by
Blender's cloth simulation, so linen and wool hang, fold, swing and settle
as cloth does.

What is worn (from the appearance data, as tools/art/lib/people.py read it):

- the **tunic**: its body and sleeves are the body's own surface let out
  (looser at the sides, bloused over the belt, the sleeves widening to the
  cuff), and follow the body; its **skirt** is a tube cut around the legs
  and flaring to the hem (mid-calf to ankle; a child's to the knee),
  pinned under the belt and simulated: it swings as the legs stride,
  catches on the knee, and pools on the ground when sitting;
- a woven **belt** (sash) with a knot and hanging ends;
- **sandals**: a sole under each foot and straps;
- on the head: a **veil**, **scarf** or **hood** (a curtain of cloth pinned
  to the head, falling over the shoulders and down the back; a man's head
  cloth is held by a cord); a **wrap** (turban) or a **band** are sewn
  stiff and follow the head;
- elders' **mantle**, and the spare **cloak** a story mark wraps round
  someone: open at the front, pinned at the shoulders, simulated.

Woven stripes (clavi) run over the shoulders and down the tunic, front and
back, from the rest position of the cloth, so they follow its folds.

Simulation: for each kind of frame a sheet shows (standing, walking,
sitting, lying) the figure is animated from its rest pose into the pose,
held until the cloth settles (or walked through three strides), and the
cloth's shape is recorded for each frame. The recorded shapes are then set
on display copies of the garments frame by frame, so every frame is
exactly repeatable and turning the figure (the sheets' directions) never
re-simulates. Garments that belong to a story mark (the cloak) collide
with the others, but never the reverse, so a person's own clothes are the
same with or without the mark and overlays line up with the sheet under
them.
"""
import math
import os

import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

import common
import makehuman as mh
import materials as M

F = np.float32
SEG = 48
FPS = 24


# ── Geometry ──────────────────────────────────────────────────────────────
def _hull2(pts):
    """Convex hull (counter-clockwise) of 2-D points."""
    p = sorted(set(map(tuple, np.round(pts, 5))))
    if len(p) < 3:
        return np.array(p)

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lo, hi = [], []
    for q in p:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0:
            lo.pop()
        lo.append(q)
    for q in reversed(p):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], q) <= 0:
            hi.pop()
        hi.append(q)
    return np.array(lo[:-1] + hi[:-1])


def _radii(hull, centre, angles):
    """Distance from `centre` to the hull's boundary along each angle
    (angle 0 = toward -Y, the front; increasing toward +X, the person's left)."""
    out = np.zeros(len(angles))
    c = np.asarray(centre, float)
    n = len(hull)
    for k, a in enumerate(angles):
        d = np.array([math.sin(a), -math.cos(a)])
        best = 0.0
        for i in range(n):
            p, q = hull[i] - c, hull[(i + 1) % n] - c
            e = q - p
            den = d[0] * (-e[1]) - d[1] * (-e[0])
            if abs(den) < 1e-12:
                continue
            t = (p[0] * (-e[1]) - p[1] * (-e[0])) / den
            u = (d[0] * p[1] - d[1] * p[0]) / den
            if t > 0 and -1e-9 <= u <= 1 + 1e-9:
                best = max(best, t)
        out[k] = best
    return out


def section(points, z, band=0.012):
    """The convex outline (2-D hull) of the points within `band` of height z."""
    sel = points[np.abs(points[:, 2] - z) < band]
    if len(sel) < 3:
        return None
    return _hull2(sel[:, :2])


def ring_grid(rings):
    """Quads joining rings (list of (SEG, 3) arrays, top first), open or closed round."""
    n = len(rings)
    V = np.concatenate(rings)
    seg = len(rings[0])
    Q = []
    for i in range(n - 1):
        for j in range(seg):
            k = (j + 1) % seg
            Q.append((i * seg + j, i * seg + k, (i + 1) * seg + k, (i + 1) * seg + j))
    return V.astype(F), np.array(Q, np.int64)


def bridge(V, Q, N, iterations=40, rate=0.6, soften=0):
    """Smooth a surface only outward: each vertex moves toward its
    neighbours' average but never below where it started along its normal,
    so the surface spans concave hollows and keeps its convex shape.
    `soften` plain smoothing passes first take off small bumps (cloth over
    a body does not show every feature of it)."""
    V0 = np.asarray(V, np.float64)
    V = V0.copy()
    e = np.concatenate([Q[:, [0, 1]], Q[:, [1, 2]], Q[:, [2, 3]], Q[:, [3, 0]]])
    # The open edges (neckline, cuffs, the lower edge) stay where they are.
    key = np.sort(e, 1)
    uniq, count = np.unique(key, axis=0, return_counts=True)
    edge_v = np.unique(uniq[count == 1])
    free = np.ones(len(V), bool)
    free[edge_v] = False
    e = np.concatenate([e, e[:, ::-1]])
    deg = np.bincount(e[:, 0], minlength=len(V)).astype(np.float64)
    for _ in range(soften):
        acc = np.zeros_like(V)
        np.add.at(acc, e[:, 0], V[e[:, 1]])
        V = V + rate * (acc / np.maximum(deg, 1)[:, None] - V) * free[:, None]
    V0 = V.copy()
    for _ in range(iterations):
        acc = np.zeros_like(V)
        np.add.at(acc, e[:, 0], V[e[:, 1]])
        avg = acc / np.maximum(deg, 1)[:, None]
        V = V + rate * (avg - V) * free[:, None]
        dn = ((V - V0) * N).sum(1)
        V = V - np.minimum(dn, 0.0)[:, None] * N
    return V.astype(F)


def angles(seg=SEG):
    return np.linspace(0, 2 * math.pi, seg, endpoint=False)


# ── Materials ─────────────────────────────────────────────────────────────
def cloth_material(color, kind="wool", stripe=None, stripe_at=0.06, stripe_w=0.012, name="cloth"):
    """Dyed wool or linen: the weave and its fuzz, slow dye variation, and
    woven stripes at ±`stripe_at` (m) from the middle, front and back, from
    the cloth's rest position (so they follow its folds)."""

    def build():
        n = M.Nodes(f"wcloth-{name}-{kind}-{color}-{stripe}")
        rest = n.new("ShaderNodeAttribute", _attribute_name="rest")
        rv = (rest, "Vector")
        blotch = n.noise(9.0, 3.0, 0.5, rv)
        dyed = M._toward(color, "#8c8070", 0.1 if kind == "wool" else 0.05)
        base = n.mix((blotch, "Fac"), M.shade(dyed, -0.08), M.shade(dyed, 0.05))
        out = (base, 2)
        if stripe:
            sep = n.new("ShaderNodeSeparateXYZ", Vector=rv)
            d = n.math("ABSOLUTE", (sep, "X"))
            d = n.math("SUBTRACT", (d, "Value"), stripe_at)
            d = n.math("ABSOLUTE", (d, "Value"))
            band = n.new("ShaderNodeMapRange", Value=(d, "Value"), **{"From Min": stripe_w * 0.8, "From Max": stripe_w * 1.2, "To Min": 0.75, "To Max": 0.0})
            col = n.mix((band, "Result"), out, M._toward(stripe, color, 0.45))
            out = (col, 2)
        weave = n.new("ShaderNodeTexWave", Scale=900.0 if kind == "linen" else 520.0, Distortion=1.5, Detail=1.0, Vector=rv)
        weave2 = n.new("ShaderNodeTexWave", Scale=900.0 if kind == "linen" else 520.0, Distortion=1.5, Detail=1.0, Vector=rv, _bands_direction="Y")
        wsum = n.math("ADD", (weave, "Fac"), (weave2, "Fac"))
        slub = n.noise(140.0, 2.0, 0.5, rv)
        h = n.math("ADD", (wsum, "Value"), (n.math("MULTIPLY", (slub, "Fac"), 0.8), "Value"))
        bump = n.bump((h, "Value"), strength=0.08 if kind == "linen" else 0.14, distance=0.002)
        n.bsdf(
            **{
                "Base Color": out,
                "Roughness": 0.9 if kind == "wool" else 0.74,
                "Sheen Weight": 0.3 if kind == "wool" else 0.12,
                "Sheen Roughness": 0.5,
                "Sheen Tint": out,
                "Specular IOR Level": 0.22,
                "Subsurface Weight": 0.0 if kind == "wool" else 0.06,
                "Normal": (bump, "Normal"),
            }
        )
        return n.mat

    return M.cached(("wcloth", name, color, kind, stripe, stripe_at), build)


# Cloth physics (Blender's cloth solver, SI units: a Blender unit is about a metre).
FABRIC = {
    # Fine linen: light, soft, many small folds.
    "linen": dict(mass=0.12, tension=12.0, compression=12.0, shear=4.0, bending=0.08, air=1.2),
    # Everyday wool tunic: heavier, broader folds.
    "wool": dict(mass=0.25, tension=18.0, compression=18.0, shear=6.0, bending=0.6, air=1.0),
    # A mantle or cloak of thick wool: heavy, stiff, few deep folds.
    "heavy": dict(mass=0.42, tension=25.0, compression=25.0, shear=10.0, bending=0.9, air=1.0),
}


class Garment:
    """One piece of clothing: `sim` (simulated) or skinned (follows the body)."""

    def __init__(self, name, V, Q, material, mark=None, sim=False, fabric="wool", pin=None, weights=None, thickness=0.003, subsurf=1, colliders=("body",), collide_as=None):
        self.name = name
        self.V = np.asarray(V, F)
        self.Q = np.asarray(Q, np.int64)
        self.material = material
        self.mark = mark
        self.sim = sim
        self.fabric = fabric
        self.pin = pin
        self.weights = weights
        self.thickness = thickness
        self.subsurf = subsurf
        self.colliders = colliders
        self.collide_as = collide_as
        self.extra = ()
        self.obj = None
        self.shapes = {}


class Wardrobe:
    """Everything a figure wears (see the module docstring)."""

    def __init__(self, person):
        self.p = person
        self.body = person.bodyd
        self.a = person.a
        self.P = person.look.ident.P
        self.co = self.body.co
        base = mh.Base.get()
        self.body_idx = base.verts_of("body")
        self.W = self.body.sk.W
        self.names = self.body.sk.names
        self.idx = self.body.sk.index
        self.garments = []
        self._tree = None
        self._make()
        for g in self.garments:
            self._realise(g)

    # ── helpers ───────────────────────────────────────────────────────────
    def tree(self):
        if self._tree is None:
            pts = self.co[self.body_idx]
            t = KDTree(len(pts))
            for i, p in enumerate(pts):
                t.insert(Vector(p.tolist()), i)
            t.balance()
            self._tree = t
        return self._tree

    def nearest_weights(self, V, k=4):
        """Skin weights for garment vertices: an inverse-distance blend of the
        nearest body vertices' weights."""
        t = self.tree()
        out = np.zeros((len(V), self.W.shape[1]), F)
        for i, v in enumerate(V):
            hits = t.find_n(Vector(v.tolist()), k)
            ws = np.array([1.0 / max(h[2], 1e-4) ** 2 for h in hits])
            ws /= ws.sum()
            for (co, j, d), w in zip(hits, ws):
                out[i] += w * self.W[self.body_idx[j]]
        out /= np.maximum(out.sum(1, keepdims=True), 1e-9)
        return out

    def bone_weight(self, *names):
        cols = [self.idx[n] for n in names if n in self.idx]
        return self.W[:, cols].sum(1)

    def pts(self, *bones, min_w=0.3):
        """Body vertices mostly moved by these bones."""
        w = self.bone_weight(*bones)
        sel = self.body_idx[w[self.body_idx] > min_w]
        return self.co[sel]

    # ── the cut ───────────────────────────────────────────────────────────
    def _make(self):
        a = self.a
        J = self.body.J
        H = self.body.height
        child = a["build"] == "child"
        self.belt_z = float(J["waist"][2] + (J["pelvis"][2] - J["waist"][2]) * 0.15)
        hem = {"adult": 0.085, "child": 0.25, "elder": 0.05}[a["build"]] * 54.0 / 32.0
        # (People.py's hems were fractions of a 54-unit height; the same heights above the ground.)
        self.hem_z = hem * (H / 1.69)
        stripe = a.get("accent")
        tunic_mat = cloth_material(a["robe"], "wool", stripe, stripe_at=0.055 * H / 1.69, stripe_w=0.0065 * H / 1.69, name="tunic")
        self._bodice(tunic_mat, child)
        self._skirt(tunic_mat)
        self._belt()
        self._sandals()
        hw = a["headwear"]
        if hw != "none":
            self._headwear(hw)
        if a["build"] == "elder":
            mat = cloth_material("#6e6452", "wool", "#4c4436", stripe_at=0.14, stripe_w=0.02, name="mantle")
            self._curtain("mantle", mat, top=J["neck"][2] + 0.01, bottom=J["knee_L"][2] + 0.06, front_open=0.3, fabric="heavy", pad=0.012)

    def build_marks(self):
        """Garments and wraps the story marks put on (after the carried things)."""
        J = self.body.J
        marks = self.p.marks
        made = []
        if "wrapped-in-cloak" in marks:
            col = M._toward("#7a4a34", "#8a6a50", 0.2)
            mat = cloth_material(col, "wool", "#5a3a26", stripe_at=0.16, stripe_w=0.03, name="cloak")
            made.append(self._curtain("cloak", mat, top=J["neck"][2] + 0.015, bottom=J["pelvis"][2] - 0.12, front_open=0.34, fabric="heavy", pad=0.04, mark="wrapped-in-cloak"))
        for m in ("bandaged", "rag-bandaged"):
            if m in marks:
                col = "#e6ddc9" if m == "bandaged" else self.p.rag
                mat = cloth_material(col, "linen" if m == "bandaged" else "wool", name=f"bandage-{col}")
                made += self._bandages(mat, m)
        for g in made:
            self._realise(g)

    def _bodice(self, mat, child):
        """The tunic above the belt and its sleeves: the body's surface let out."""
        base = mh.Base.get()
        J = self.body.J
        co = self.co
        W = self.W
        neck = self.bone_weight("neck01", "neck02", "neck03", "head")
        legs = self.bone_weight("upperleg01.L", "upperleg01.R", "upperleg02.L", "upperleg02.R", "pelvis.L", "pelvis.R")
        fore = self.bone_weight("lowerarm01.L", "lowerarm01.R", "lowerarm02.L", "lowerarm02.R", "wrist.L", "wrist.R")
        hand = self.bone_weight(*[n for n in self.names if n.startswith(("wrist", "finger", "metacarpal"))])
        sleeve_to = 0.35 if child else 0.62  # how far down the forearm (weight)
        keep = np.zeros(len(co), bool)
        b = self.body_idx
        keep[b] = (co[b, 2] > self.belt_z - 0.03) & (neck[b] < 0.35) & (legs[b] < 0.5) & (fore[b] < sleeve_to) & (hand[b] < 0.05)
        # The neckline: a little below where the neck meets the chest in front.
        nz = float(J["neck"][2])
        front = co[:, 1] < float(J["neck"][1])
        keep &= ~(front & (co[:, 2] > nz - 0.025) & (np.abs(co[:, 0]) < 0.07))
        faces = base.faces_of("body")
        Q = base.quads[faces]
        Q = Q[keep[Q].all(1)]
        used = np.unique(Q)
        remap = -np.ones(len(co), np.int64)
        remap[used] = np.arange(len(used))
        V = co[used].astype(np.float64)
        N = self.p.look.normals[used]
        z = V[:, 2]
        armw = self.bone_weight("upperarm01.L", "upperarm01.R", "upperarm02.L", "upperarm02.R", "shoulder01.L", "shoulder01.R")[used]
        forew = fore[used]
        # Let out: a finger's width everywhere; looser at the sides of the
        # body, bloused over the belt (the tunic's extra length hangs over it
        # in soft folds), the sleeves widening to the cuff.
        blouse = np.exp(-(((z - (self.belt_z + 0.045)) / 0.04) ** 2))
        ang = np.arctan2(V[:, 0], -(V[:, 1] - float(J["waist"][1])))
        folds = 0.35 + 0.65 * (0.5 + 0.5 * np.sin(ang * 7.0 + 0.6) * np.sin(ang * 3.0 + 1.9))
        d = 0.009 + 0.028 * blouse * folds * (1 - armw) + 0.018 * armw + 0.04 * forew / max(sleeve_to, 1e-3)
        side = np.clip(np.abs(V[:, 0]) / 0.18, 0, 1) * (1 - armw) * np.clip((float(J["chest"][2]) + 0.05 - z) / 0.2, 0, 1)
        d = d + 0.012 * side
        # Under the arm the cloth bridges the gap rather than dipping into it.
        V = V + N * d[:, None]
        # A loose tunic hangs from the shoulders and the chest: below the
        # chest it falls straight (over the ribs, the stomach, the small of
        # the back) until the belt draws it in, rather than following the
        # body into every hollow.
        limbs = self.bone_weight(*[n for n in self.names if n.startswith(("upperarm", "lowerarm", "wrist", "finger", "metacarpal", "shoulder"))])
        torso_pts = co[b][(limbs[b] < 0.2) & (neck[b] < 0.4) & (legs[b] < 0.3)]
        cyw = float(J["chest"][1])
        thb = angles(64)
        zb = np.arange(float(J["neck"][2]), self.belt_z - 0.05, -0.01)
        table = []
        acc = None
        for zz in zb:
            h = section(torso_pts, zz, band=0.008)
            if h is None:
                table.append(acc)
                continue
            r = _radii(h, (0.0, cyw), thb)
            acc = r if acc is None else np.maximum(acc, r)
            table.append(acc.copy())
        if acc is not None:
            table = [t if t is not None else acc for t in table]
            tab = np.array(table)
            lim = limbs[used]
            hang = np.clip((V[:, 2] - (self.belt_z + 0.03)) / 0.09, 0, 1) * np.clip(1 - lim / 0.2, 0, 1)
            av = np.arctan2(V[:, 0], -(V[:, 1] - cyw)) % (2 * math.pi)
            ai = np.round(av / (2 * math.pi) * 64).astype(int) % 64
            zi = np.clip(np.round((float(J["neck"][2]) - V[:, 2]) / 0.01).astype(int), 0, len(tab) - 1)
            target = tab[zi, ai] + 0.02
            rv = np.hypot(V[:, 0], V[:, 1] - cyw)
            grow = np.maximum(0.0, target - rv) * hang
            dirs = np.stack([V[:, 0], V[:, 1] - cyw], 1) / np.maximum(rv, 1e-6)[:, None]
            V[:, :2] += dirs * grow[:, None]
        # (Below the belt it tucks in under it.)
        tuck = np.clip((self.belt_z + 0.01 - z) / 0.03, 0, 1)
        V = V - N * (tuck * 0.006)[:, None]
        # Cloth spans hollows rather than following them into every dip
        # (between and under the breasts, the small of the back, the navel):
        # smoothed, but never pulled in under where it was let out to.
        V = bridge(V, remap[Q], N, iterations=60, soften=10)
        self.garments.append(Garment("bodice", V, remap[Q], mat, weights=W[used], thickness=0.003, subsurf=1))
        self.bodice_used = used
        self.bodice_V = V

    def _skirt(self, mat):
        """The tunic below the belt: a tube around the legs, flaring to the hem."""
        J = self.body.J
        arms = self.bone_weight(*[n for n in self.names if n.startswith(("upperarm", "lowerarm", "wrist", "finger", "metacarpal"))])
        lower = self.co[self.body_idx[arms[self.body_idx] < 0.3]]
        lower = lower[lower[:, 2] < self.belt_z + 0.02]
        top = self.belt_z + 0.012
        zs = []
        z = top
        step = 0.02
        while z > self.hem_z:
            zs.append(z)
            z -= step
        zs.append(self.hem_z)
        cx = 0.0
        cy = float(J["pelvis"][1]) + 0.01
        th = angles()
        rings = []
        prev = None
        span = top - self.hem_z
        for z in zs:
            near = top - z < 0.05
            hull = section(lower, z if near else min(z, self.belt_z), band=0.008 if near else 0.02) if z > float(J["knee_L"][2]) - 0.1 else None
            if hull is None and prev is not None:
                r = prev
            elif hull is None:
                r = np.full(SEG, 0.16)
            else:
                r = _radii(hull, (cx, cy), th)
            t = (top - z) / span
            # Ease: snug under the belt, fuller at the hips, flaring to the hem.
            ease = 0.012 + 0.03 * min(1.0, t * 3.0) + 0.05 * t * t
            r = np.maximum(r, prev * 0.98 if prev is not None else r)
            rr = r + ease
            # The hem must let a stride through.
            rr = np.maximum(rr, (0.16 + 0.06 * t) * self.body.height / 1.69 * common.smoothstep(0.2, 0.55, t))
            prev = r
            rings.append(np.stack([cx + np.sin(th) * rr, cy - np.cos(th) * rr, np.full(SEG, z)], 1))
        if "torn-hem" in self.p.marks:
            # A strip torn from the left of the hem for bandages: shorter
            # there, with a ragged edge.
            cut = self.hem_z + 0.075 * self.body.height
            for ring in rings:
                x = ring[:, 0]
                k = np.clip((x - 0.004) / (0.05 * self.body.height), 0, 1)
                rag = 0.012 * self.body.height * (np.sin(x * 900) * 0.6 + np.sin(ring[:, 1] * 700 + 1) * 0.4)
                ring[:, 2] = np.where((x > 0.004) & (ring[:, 2] < cut), np.maximum(ring[:, 2], self.hem_z + (0.075 * self.body.height + rag) * k), ring[:, 2])
        V, Q = ring_grid(rings)
        pin = np.zeros(len(V), F)
        pin[:SEG] = 1.0
        pin[SEG : 2 * SEG] = 0.6
        self.skirt_top = (rings[0], cy)
        self.garments.append(Garment("skirt", V, Q, mat, sim=True, fabric="wool", pin=pin, colliders=("legs",), collide_as="skirt"))

    def _belt(self):
        J = self.body.J
        a = self.a
        mat = cloth_material(a["accent"], "wool", name="belt")
        # Tied over the top of the tunic's skirt (and hiding where it meets the body).
        top, cy = self.skirt_top
        th = angles(SEG)
        rt = np.hypot(top[:, 0], top[:, 1] - cy)
        rings = []
        hgt = 0.018 * self.body.height / 1.69
        for dz, extra in ((hgt, 0.004), (0.0, 0.007), (-hgt, 0.005)):
            r = rt + extra
            rings.append(np.stack([np.sin(th) * r, cy - np.cos(th) * r, np.full(len(th), self.belt_z + 0.008 + dz)], 1))
        # The belt draws the tunic in: under it the cloth is pulled tight,
        # and above it the extra length blouses out again.
        bod = next(g for g in self.garments if g.name == "bodice")
        V = bod.V.astype(np.float64)
        ang = np.arctan2(V[:, 0], -(V[:, 1] - cy)) % (2 * math.pi)
        rb = np.interp(ang, np.append(th, 2 * math.pi), np.append(rt, rt[0])) - 0.001
        belt_top = self.belt_z + 0.008 + hgt
        allow = rb + np.clip(V[:, 2] - belt_top, 0, None) * 1.2
        rv = np.hypot(V[:, 0], V[:, 1] - cy)
        pull = np.clip(1 - (rv - allow) / np.maximum(rv, 1e-6), 0, 1)
        near = V[:, 2] < belt_top + 0.08
        k = np.where(near & (rv > allow), allow / np.maximum(rv, 1e-6), 1.0)
        V[:, 0] *= k
        V[:, 1] = cy + (V[:, 1] - cy) * k
        _ = pull
        bod.V = V.astype(F)
        self.bodice_V = bod.V
        V, Q = ring_grid(rings)
        # The knot at the front left and its two hanging ends.
        r0 = rings[1]
        k = int(len(th) * 0.95)
        knot = r0[k] + np.array([0.0, -0.012, 0.0])
        ends = []
        for i, (dx, ln) in enumerate(((-0.012, 0.16), (0.012, 0.12))):
            e = []
            for t in np.linspace(0, 1, 7):
                c = knot + np.array([dx + 0.01 * t, -0.006 * (1 - t), -ln * t])
                e.append([c + np.array([-0.012, 0, 0]), c + np.array([0.012, 0, 0])])
            ends.append(np.array(e).reshape(-1, 3))
        allV = [V]
        allQ = [Q]
        off = len(V)
        for e in ends:
            q = [(off + 2 * i, off + 2 * i + 1, off + 2 * i + 3, off + 2 * i + 2) for i in range(len(e) // 2 - 1)]
            allV.append(e)
            allQ.append(np.array(q))
            off += len(e)
        V = np.concatenate(allV)
        Q = np.concatenate(allQ)
        self.garments.append(Garment("belt", V, Q, mat, weights=self.nearest_weights(V), thickness=0.004, subsurf=1))
        # The knot itself.
        bm_v, bm_q = _blob(knot, (0.018, 0.012, 0.014))
        self.garments.append(Garment("belt-knot", bm_v, bm_q, mat, weights=self.nearest_weights(bm_v), thickness=0.0, subsurf=1))

    def _sandals(self):
        leather = M.leather("#4e3220")
        for s in ("L", "R"):
            foot = self.pts(f"foot.{s}", *[f"toe{t}-{k}.{s}" for t in range(1, 6) for k in range(1, 4)], min_w=0.3)
            sole = foot[foot[:, 2] < 0.025]
            hull = _hull2(sole[:, :2])
            c = hull.mean(0)
            th = angles(28)
            r = _radii(hull, c, th) + 0.006
            ring = np.stack([c[0] + np.sin(th) * r, c[1] - np.cos(th) * r], 1)
            top = np.column_stack([ring, np.full(len(th), 0.007)])
            bot = np.column_stack([ring, np.full(len(th), -0.001)])
            V, Q = ring_grid([top, bot])
            cap_t = len(V)
            V = np.concatenate([V, [[c[0], c[1], 0.007], [c[0], c[1], -0.001]]])
            tris = [(cap_t, j, (j + 1) % len(th), (j + 1) % len(th)) for j in range(len(th))]
            tris += [(cap_t + 1, len(th) + (j + 1) % len(th), len(th) + j, len(th) + j) for j in range(len(th))]
            Q = np.concatenate([Q, np.array(tris)])
            self.garments.append(Garment(f"sole-{s}", V, Q, leather, weights=self.nearest_weights(V), thickness=0.0, subsurf=0))
            # Straps: across the forefoot and round the ankle.
            for zc, frac, w in ((0.03, 0.72, 0.012), (0.075, 0.1, 0.01)):
                y0 = hull[:, 1].min()
                y1 = hull[:, 1].max()
                yc = y0 + (y1 - y0) * frac
                band = foot[np.abs(foot[:, 1] - yc) < 0.025]
                band = band[band[:, 2] < zc + 0.03]
                if len(band) < 3:
                    continue
                pts2 = band[:, [0, 2]]
                h2 = _hull2(pts2)
                cc = h2.mean(0)
                r2 = _radii(np.column_stack([h2[:, 0], -h2[:, 1]]), (cc[0], -cc[1]), angles(24)) + 0.003
                t2 = angles(24)
                ringa = np.stack([cc[0] + np.sin(t2) * r2, np.full(24, yc - w / 2), cc[1] + np.cos(t2) * r2], 1)
                ringb = ringa + np.array([0, w, 0])
                ringa[:, 2] = np.maximum(ringa[:, 2], 0.004)
                ringb[:, 2] = np.maximum(ringb[:, 2], 0.004)
                V2, Q2 = ring_grid([ringa, ringb])
                self.garments.append(Garment(f"strap-{s}-{frac}", V2, Q2, leather, weights=self.nearest_weights(V2), thickness=0.002, subsurf=0))

    def _headwear(self, kind):
        a = self.a
        P = self.P
        J = self.body.J
        style = P.head_style
        linen = kind in ("veil", "scarf")
        mat = cloth_material(a["headwearColor"], "linen" if linen else "wool", name=f"head-{kind}")
        if kind in ("wrap", "band"):
            self._wrap(kind, mat)
            return
        # A curtain from the crown: a veil to the chest, a scarf or hood to
        # the shoulders; a man's head cloth, with its cord.
        bottom = {"veil": float(J["chest"][2]) - 0.02, "scarf": float(J["neck"][2]) - 0.1, "hood": float(J["neck"][2]) - 0.12}[kind]
        if style == "headcloth":
            bottom = float(J["neck"][2]) - 0.08
        self._curtain(
            "headwear",
            mat,
            top=self.body.height + 0.03,
            bottom=bottom,
            front_open=None,
            fabric="linen" if linen else "wool",
            pad=0.012 + 0.008 * P.veil_full,
            face=True,
        )
        if style == "headcloth":
            self._wrap("cord", cloth_material("#2c2621", "wool", name="cord"))

    def _head_rings(self, zs, pad):
        """Rings round the head (over the hair) at heights zs."""
        pts = self.co[self.body_idx]
        hair = [o.obj for o in self.p.parts if o.obj.name.endswith("-hair")]
        extra = []
        for h in hair:
            v = np.empty(len(h.data.vertices) * 3, F)
            h.data.vertices.foreach_get("co", v)
            extra.append(v.reshape(-1, 3))
        allp = np.concatenate([pts] + extra) if extra else pts
        cy = float(self.body.J["head"][1]) + 0.01
        out = []
        for z in zs:
            hull = section(allp, z, band=0.01)
            r = _radii(hull, (0.0, cy), angles(40)) + pad
            out.append(np.stack([np.sin(angles(40)) * r, cy - np.cos(angles(40)) * r, np.full(40, z)], 1))
        return out

    def _wrap(self, kind, mat):
        """A turban of wound cloth, a headband or a man's cord: stiff, on the head."""
        J = self.body.J
        top = self.body.height
        head_z = float(J["head"][2])
        brow = head_z + (top - head_z) * 0.52
        if kind == "wrap":
            # A long strip wound round and round: a full, rounded bulk from
            # the brow over the crown, each turn lying over the one below it
            # on a slant.
            th = angles(40)
            cyh = float(J["head"][1]) + 0.012
            widest = self._head_rings([brow + 0.02], 0.0)[0]
            R = np.hypot(widest[:, 0], widest[:, 1] - cyh)
            lo = brow - 0.02
            crown = float(self.dressed_points()[:, 2].max())
            hi = crown + 0.04 * self.body.height / 1.7
            rings = []
            n = 16
            for i in range(n):
                u = i / n
                z = lo + (hi - lo) * u
                if u < 0.72:
                    prof = 1.0 + 0.1 * math.sin(math.pi * u / 0.72 * 0.9)
                else:
                    prof = (1.0 + 0.1 * math.sin(math.pi * 0.9)) * math.sqrt(max(0.0, 1 - ((u - 0.72) / 0.28) ** 2))
                turns = (u * 4.2 + th / (2 * math.pi) * 0.9) % 1.0
                ridge = 0.006 * (1 - turns) * (u < 0.8)
                rr = (R + 0.016) * prof + ridge
                rings.append(np.stack([np.sin(th) * rr, cyh - np.cos(th) * rr, np.full(40, z)], 1))
            rings.reverse()
            V, Q = ring_grid(rings)
        else:
            z = brow + (0.005 if kind == "band" else 0.02)
            w = 0.014 if kind == "band" else 0.008
            rings = self._head_rings([z + w, z - w], 0.004 if kind == "band" else 0.012)
            V, Q = ring_grid(rings)
        W = np.zeros((len(V), self.W.shape[1]), F)
        W[:, self.idx["head"]] = 1.0
        g = Garment(kind, V, Q, mat, weights=W, thickness=0.004, subsurf=1)
        if kind == "wrap":
            g.extra = [list(range(40))[::-1]]
        self.garments.append(g)

    def _curtain(self, name, mat, top, bottom, front_open, fabric, pad, face=False, mark=None):
        """Cloth hanging from the head or shoulders: at each height, the outline
        of everything above it (cloth falls straight from what holds it up),
        let out; open at the front for the face or down the chest."""
        J = self.body.J
        P = self.P
        # What it hangs over: the body in its tunic, and the hair.
        allp = self.dressed_points()
        if not face:
            # Hung from the shoulders: the head and neck stand clear of it.
            headw = self.bone_weight("neck01", "neck02", "neck03", "head")[self.body_idx]
            allp = allp[headw < 0.4]
            # And over the tunic's skirt and the belt.
            worn = [g.V for g in self.garments if g.name in ("skirt", "belt")]
            if worn:
                allp = np.concatenate([allp] + worn)
        cy = float(J["neck"][1]) + 0.02
        th = angles()
        top = min(top, float(allp[:, 2].max()) + pad)
        zs = list(np.arange(top, top - 0.06, -0.008)) + list(np.arange(top - 0.07, bottom, -0.02)) + [bottom]
        rings = []
        acc = None
        chin = float(J["head"][2]) - 0.03
        for z in zs:
            above = allp[allp[:, 2] >= z - pad]
            if len(above) < 3:
                continue
            hull = _hull2(above[:, :2])
            r = _radii(hull, (0.0, cy), th)
            acc = r if acc is None else np.maximum(acc * 0.995, r)
            below_chin = z < chin
            ease = pad + (0.012 + 0.014 * min(1.0, (chin - z) / 0.25) if below_chin else 0.0)
            rr = acc + ease
            rings.append(np.stack([np.sin(th) * rr, cy - np.cos(th) * rr, np.full(SEG, z)], 1))
        if face:
            # Over the crown the cloth is a round dome, not the head's point.
            zr = np.array([r[0, 2] for r in rings])
            k = int(np.argmin(np.abs(zr - (zr[0] - 0.05))))
            rb = np.hypot(rings[k][:, 0], rings[k][:, 1] - cy)
            for i in range(k):
                t = (zr[i] - zr[k]) / max(zr[0] - zr[k] + 0.012, 1e-6)
                f = math.sqrt(max(0.0, 1.0 - t * t))
                ri = np.maximum(np.hypot(rings[i][:, 0], rings[i][:, 1] - cy), f * rb)
                rings[i] = np.column_stack([np.sin(th) * ri, cy - np.cos(th) * ri, np.full(SEG, zr[i])])
            first = rings[0]
            c = first.mean(0)
            cap = []
            for f, dz in ((0.08, 0.012), (0.45, 0.01), (0.8, 0.005)):
                rg = first.copy()
                rg[:, :2] = c[:2] + (first[:, :2] - c[:2]) * f
                rg[:, 2] = first[:, 2] + dz
                cap.append(rg)
            rings = cap + rings
        V, Q = ring_grid(rings)
        n_r = len(rings)
        drop = np.array([0.0] * len(Q))
        keep = np.ones(len(Q), bool)
        heights = np.array([r[0, 2] for r in rings])
        for qi, q in enumerate(Q):
            i = q[0] // SEG
            j = q[0] % SEG
            a = (j + 0.5) / SEG * 2 * math.pi
            fwd = math.cos(a)
            z = heights[i]
            if face:
                # The face: open from the brow down; the edges fall to the chest.
                brow = float(J["head"][2]) + (self.body.height - float(J["head"][2])) * (0.62 - 0.05 * P.veil_back)
                opening = 0.7 - 0.08 * P.veil_open / 4.0
                if z < brow and fwd > opening:
                    keep[qi] = False
            elif front_open is not None and fwd > 1 - front_open:
                keep[qi] = False
        Q = Q[keep]
        _ = drop
        used = np.unique(Q)
        remap = -np.ones(len(V), np.int64)
        remap[used] = np.arange(len(used))
        V = V[used]
        Q = remap[Q]
        # Pinned where it is held: the top of the head (a head covering), or
        # round the neck and on the shoulders (a mantle).
        z = V[:, 2]
        if face:
            hold = chin - 0.01
            pin = np.clip((z - hold) / 0.05, 0, 1) * (0.35 + 0.65 * np.clip((z - hold - 0.06) / 0.04, 0, 1))
        else:
            sh = float(J["shoulder_L"][2])
            pin = np.clip((z - (sh - 0.02)) / 0.04, 0, 1) * np.clip(1 - np.abs(V[:, 0]) / 0.2, 0.3, 1)
        g = Garment(name, V, Q, mat, sim=True, fabric=fabric, pin=pin.astype(F), mark=mark, colliders=("dressed", "skirt", "headwear", "mantle") if mark else ("dressed", "skirt", "headwear") if name == "mantle" else ("dressed",), collide_as=name)
        if face:
            # The crown closed.
            g.extra = [[int(i) for i in remap[np.arange(SEG)][::-1]]]
        _ = n_r
        if mark:
            return g
        self.garments.append(g)
        return g

    def _bandages(self, mat, mark):
        J = self.body.J
        out = []
        head_z = float(J["head"][2])
        z = head_z + (self.body.height - head_z) * 0.55
        rings = self._head_rings([z + 0.02, z - 0.02], 0.006)
        V, Q = ring_grid(rings)
        W = np.zeros((len(V), self.W.shape[1]), F)
        W[:, self.idx["head"]] = 1.0
        out.append(Garment(f"bandage-head", V, Q, mat, mark=mark, weights=W, thickness=0.004))
        # The left ankle, wrapped.
        leg = self.pts("lowerleg02.L", "lowerleg01.L", "foot.L", min_w=0.4)
        rings = []
        ank = float(J["ankle_L"][2])
        cxy = np.asarray(J["ankle_L"][:2], float)
        for zz in (ank + 0.07, ank + 0.035, ank, ank - 0.025):
            h = section(leg, zz, band=0.01)
            if h is None:
                continue
            r = _radii(h, cxy, angles(24)) + 0.006
            rings.append(np.stack([cxy[0] + np.sin(angles(24)) * r, cxy[1] - np.cos(angles(24)) * r, np.full(24, zz)], 1))
        if len(rings) >= 2:
            V, Q = ring_grid(rings)
            out.append(Garment("bandage-ankle", V, Q, mat, mark=mark, weights=self.nearest_weights(V), thickness=0.004))
        return out

    # ── Blender objects ───────────────────────────────────────────────────
    def _realise(self, g):
        from world_person import Piece, _mesh, set_attr

        obj = _mesh(f"{self.p.name}-{g.name}", g.V, g.Q, self.p.col, g.material, extra=g.extra)
        set_attr(obj, "rest", g.V)
        g.obj = obj
        if g.sim:
            obj.parent = self.p.rig.root
        else:
            self.p.rig.bind(obj, g.weights)
        if g.thickness > 0:
            common.add_modifier(obj, "SOLIDIFY", thickness=g.thickness, offset=1.0)
        if g.subsurf:
            common.add_modifier(obj, "SUBSURF", levels=g.subsurf, render_levels=g.subsurf)
        self.p.parts.append(Piece(obj, g.mark))

    # ── simulation ────────────────────────────────────────────────────────
    def _clip_of(self, spec):
        rest = spec.get("rest")
        if rest:
            return rest
        if spec.get("walk") is not None:
            return "walk"
        return "stand"

    def _state_of(self, spec):
        if spec.get("walk") is not None:
            return ("walk", round(float(spec["walk"]), 4))
        talk = spec.get("talk", 0)
        if talk:
            return ("talk", int(talk))
        if spec.get("breath"):
            return ("breath", 1)
        return ("idle", 0)

    def simulate(self, specs):
        sims = [g for g in self.garments if g.sim]
        if not sims:
            return
        clips = {}
        for s in specs:
            clips.setdefault(self._clip_of(s), set()).add(self._state_of(s))
        for clip, states in clips.items():
            if all((clip, st) in sims[0].shapes for st in states):
                continue
            self._run(clip, states, sims)

    def _timeline(self, clip, states):
        """[(frame, pose spec, record-as or None)] for a clip."""
        out = []
        f = 1
        rest = clip if clip in ("sit", "lie") else None
        if clip == "walk":
            # Into the stride, then three strides; the last is recorded.
            cycle = 24
            lead = 16
            for k in range(lead):
                out.append((f, dict(walk=None, blend=k / lead, target=dict(walk=0.0)), None))
                f += 1
            phases = sorted(p for _, p in states)
            total = cycle * 3
            for k in range(total + 1):
                ph = (k / cycle) % 1.0
                rec = None
                if k >= cycle * 2:
                    for p in phases:
                        if abs(((k - cycle * 2) / cycle) - p) < 1e-6:
                            rec = ("walk", round(p, 4))
                out.append((f, dict(walk=ph), rec))
                f += 1
            return out
        # Standing (or at rest): into the pose, settle, then each state in turn.
        into = 1 if rest else 16
        settle = 44 if rest else 34
        for k in range(into):
            out.append((f, dict(rest=rest, blend=(k + 1) / into, target=dict(rest=rest)), None))
            f += 1
        for k in range(settle):
            out.append((f, dict(rest=rest), ("idle", 0) if k == settle - 1 else None))
            f += 1
        seq = []
        if ("breath", 1) in states:
            seq.append((dict(rest=rest, breath=1), ("breath", 1), 6, 14))
            seq.append((dict(rest=rest), None, 6, 10))
        if ("talk", 1) in states or ("talk", 2) in states:
            seq.append((dict(rest=rest, talk=1), ("talk", 1), 8, 20))
            seq.append((dict(rest=rest, talk=2), ("talk", 2), 4, 12))
        prev = dict(rest=rest)
        for spec, rec, ramp, hold in seq:
            for k in range(ramp):
                out.append((f, dict(rest=rest, blend=(k + 1) / ramp, source=prev, target=spec), None))
                f += 1
            for k in range(hold):
                out.append((f, spec, rec if k == hold - 1 else None))
                f += 1
            prev = spec
        return out

    def _posed(self, spec):
        """(rotations, root) for a timeline entry (blending where asked)."""
        p = self.p
        if "blend" in spec:
            src = spec.get("source") or dict()
            a = p.rotations(**_args(src)) if src else (dict(), np.eye(4))
            b = p.rotations(**_args(spec["target"]))
            t = _ease(spec["blend"])
            R, root = _blend(a, b, t)
            rest = spec["target"].get("rest")
            if rest and not src:
                # Sitting or lying down, the body is carried clear of the
                # ground on the way (limbs would pass through it) and set down.
                root = root.copy()
                root[2, 3] += (0.7 if rest == "lie" else 0.35) * math.sin(math.pi * t)
            return R, root
        return p.rotations(**_args(spec))

    def _run(self, clip, states, sims):
        from world_person import _mesh

        scene = bpy.context.scene
        p = self.p
        timeline = self._timeline(clip, states)
        n = timeline[-1][0]
        scene.frame_start = 1
        scene.frame_end = n
        scene.render.fps = FPS
        # Colliders: the body (and hair, and skinned clothes), and a ground.
        body = p.body_obj
        cols = {}

        def collider(obj, outer=0.004):
            m = obj.modifiers.get("collision") or obj.modifiers.new("collision", "COLLISION")
            obj.collision.thickness_outer = outer
            obj.collision.cloth_friction = 2.0
            obj.collision.damping = 0.4
            return m

        collider(body, 0.005)
        cols["body"] = [body]
        cols["dressed"] = [self._dressed()]
        cols["legs"] = [self._dressed(legs=True)]
        bpy.ops.mesh.primitive_plane_add(size=6.0, location=(0, 0, 0))
        ground = bpy.context.object
        ground.name = f"{p.name}-sim-ground"
        ground.hide_render = True
        collider(ground, 0.004)
        for v in cols.values():
            v.append(ground)
        # The simulated garments: working copies with the cloth modifier.
        work = {}
        for g in sims:
            o = _mesh(f"{p.name}-{g.name}-sim", g.V, g.Q, p.col, extra=g.extra)
            o.hide_render = True
            o.parent = p.rig.root
            vg = o.vertex_groups.new(name="pin")
            for w in np.unique(np.round(g.pin, 2)):
                if w <= 0:
                    continue
                vg.add(np.nonzero(np.round(g.pin, 2) == w)[0].tolist(), float(w), "REPLACE")
            p.rig.bind(o, self.nearest_weights(g.V))
            cm = o.modifiers.new("cloth", "CLOTH")
            s = cm.settings
            fab = FABRIC[g.fabric]
            s.quality = 10
            s.mass = fab["mass"]
            s.air_damping = fab["air"]
            s.tension_stiffness = fab["tension"]
            s.compression_stiffness = fab["compression"]
            s.shear_stiffness = fab["shear"]
            s.bending_stiffness = fab["bending"]
            s.tension_damping = 5.0
            s.compression_damping = 5.0
            s.shear_damping = 5.0
            s.bending_damping = 0.5
            s.vertex_group_mass = "pin"
            s.pin_stiffness = 1.0
            c = cm.collision_settings
            c.use_collision = True
            c.collision_quality = 6 if clip in ("sit", "lie") else 4
            c.distance_min = 0.003
            c.use_self_collision = False
            coll = bpy.data.collections.new(f"{p.name}-{g.name}-colliders")
            scene.collection.children.link(coll)
            for key in g.colliders:
                for ob in cols.get(key, []):
                    if coll.objects.get(ob.name) is None:
                        coll.objects.link(ob)
            # One-way: a garment feels only the colliders it names.
            c.collection = coll
            cm.point_cache.frame_start = 1
            cm.point_cache.frame_end = n
            work[g.name] = (g, o)
            # Later garments collide with this one.
            if g.collide_as:
                collider(o, 0.003)
                cols.setdefault(g.collide_as, []).append(o)
        # Animate the figure through the clip.
        arm = p.rig.arm
        arm.animation_data_clear()
        prev_q = {}
        for f, spec, _ in timeline:
            R, root = self._posed(spec)
            p.rig.set_pose(R, root)
            for pb in arm.pose.bones:
                q = pb.rotation_quaternion.copy()
                if pb.name in prev_q and q.dot(prev_q[pb.name]) < 0:
                    q.negate()
                    pb.rotation_quaternion = q
                prev_q[pb.name] = q
            p.rig.key(f)
        for f, spec, rec in timeline:
            scene.frame_set(f)
            if rec is None:
                continue
            dg = bpy.context.evaluated_depsgraph_get()
            for name, (g, o) in work.items():
                ev = o.evaluated_get(dg)
                me = ev.to_mesh()
                v = np.empty(len(me.vertices) * 3, F)
                me.vertices.foreach_get("co", v)
                ev.to_mesh_clear()
                g.shapes[(clip, rec)] = v.reshape(-1, 3).copy()
                sh = g.shapes[(clip, rec)]
                print("CLOTH", g.name, clip, rec, "moved", round(float(np.abs(sh - g.V).max()), 3), "z", round(float(sh[:, 2].min()), 3), round(float(sh[:, 2].max()), 3), flush=True)
        # Tidy: the working copies, the ground and the animation go.
        for g, o in work.values():
            bpy.data.objects.remove(o)
        if body.modifiers.get("collision"):
            body.modifiers.remove(body.modifiers["collision"])
        bpy.data.objects.remove(cols["dressed"][0])
        bpy.data.objects.remove(cols["legs"][0])
        bpy.data.objects.remove(ground)
        arm.animation_data_clear()
        scene.frame_set(1)

    def dressed_points(self):
        """The body's vertices with the tunic's body and the hair in place."""
        co = self.co.copy()
        for used, V in self.p.shells.values():
            co[used] = V
        if hasattr(self, "bodice_used"):
            co[self.bodice_used] = self.bodice_V
        return co[self.body_idx]

    def _dressed(self, legs=False):
        """A collider for what hangs over the figure: the body with the
        tunic's body and the hair where they are (one surface, so cloth
        never has to find its way between nested colliders). With `legs`,
        only the body below the chest without its arms: what the tunic's
        skirt swings against (a hand resting on the thigh lies on the cloth,
        rather than being caught up inside it)."""
        from world_person import _mesh

        base = mh.Base.get()
        co = self.co.copy()
        faces = base.quads[base.faces_of("body")]
        if legs:
            arms = self.bone_weight(*[n for n in self.names if n.startswith(("upperarm", "lowerarm", "wrist", "finger", "metacarpal", "shoulder", "clavicle"))])
            ok = (arms < 0.3) & (co[:, 2] < self.belt_z + 0.15)
            faces = faces[ok[faces].all(1)]
        else:
            for used, V in self.p.shells.values():
                co[used] = V
            if hasattr(self, "bodice_used"):
                co[self.bodice_used] = self.bodice_V
        used = np.unique(faces)
        remap = -np.ones(len(co), np.int64)
        remap[used] = np.arange(len(used))
        o = _mesh(f"{self.p.name}-{'legs' if legs else 'dressed'}", co[used], remap[faces], self.p.col)
        o.hide_render = True
        self.p.rig.bind(o, self.W[used])
        o.modifiers.new("collision", "COLLISION")
        o.collision.thickness_outer = 0.008 if legs else 0.006
        o.collision.cloth_friction = 1.5 if legs else 3.0
        o.collision.damping = 0.4
        return o

    def show(self, spec):
        clip = self._clip_of(spec)
        st = self._state_of(spec)
        for g in self.garments:
            if not g.sim:
                continue
            v = g.shapes.get((clip, st))
            if v is None:
                v = g.shapes.get((clip, ("idle", 0)))
            if v is None:
                continue
            g.obj.data.vertices.foreach_set("co", v.ravel())
            g.obj.data.update()


def _args(spec):
    return {k: spec[k] for k in ("walk", "breath", "talk", "rest") if k in spec}


def _ease(t):
    return t * t * (3 - 2 * t)


def _blend(a, b, t):
    """Blend two (rotations, root) poses."""
    from mathutils import Matrix, Quaternion

    Ra, ra = a
    Rb, rb = b
    out = {}
    for k in set(Ra) | set(Rb):
        qa = Matrix(Ra.get(k, np.eye(3)).tolist()).to_quaternion()
        qb = Matrix(Rb.get(k, np.eye(3)).tolist()).to_quaternion()
        if qa.dot(qb) < 0:
            qb.negate()
        out[k] = np.array(qa.slerp(qb, t).to_matrix())
    ma = Matrix(ra.tolist())
    mb = Matrix(rb.tolist())
    la, qa, _ = ma.decompose()
    lb, qb, _ = mb.decompose()
    if qa.dot(qb) < 0:
        qb.negate()
    m = Matrix.Translation(la.lerp(lb, t)) @ qa.slerp(qb, t).to_matrix().to_4x4()
    _ = Quaternion
    return out, np.array(m)


def _blob(c, r):
    """A small closed ellipsoid of quads (a knot)."""
    V = []
    Q = []
    nu, nv = 10, 6
    for i in range(nv + 1):
        ph = math.pi * i / nv
        for j in range(nu):
            a = 2 * math.pi * j / nu
            V.append((c[0] + r[0] * math.sin(ph) * math.cos(a), c[1] + r[1] * math.sin(ph) * math.sin(a), c[2] + r[2] * math.cos(ph)))
    for i in range(nv):
        for j in range(nu):
            k = (j + 1) % nu
            Q.append((i * nu + j, i * nu + k, (i + 1) * nu + k, (i + 1) * nu + j))
    return np.array(V, F), np.array(Q, np.int64)
