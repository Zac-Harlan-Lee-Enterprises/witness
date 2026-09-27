"""A portrait's head and shoulders from MakeHuman's model (makehuman.py):
the person's own shape (portrait_face.identity), an expression, and what the
rest of the portrait needs to know about it.

Coordinates are the portrait frame: centimetres, X to the person's left, -Y
forward (the face looks toward -Y), Z up, the origin midway between the
ears. (The same frame the hair, clothes and studio were built for.)

Two shapes are kept:

- the **rest** shape: the person with no expression at all. Everything that
  must not change from one expression to another is computed on it: the
  skin maps, where hairs grow, the clothes. So a person's freckles, hairline
  and veil are the same in every picture of them.
- the **posed** shape: the rest shape with the expression (for the neutral
  portrait, the person's resting mood). This is what is rendered: the skin
  and everything that follows it (brows, lashes, beard, teeth, eyes).

Regions of the face are found from MakeHuman's own targets: a target moves
exactly the vertices of the part it shapes, so how far a vertex moves under,
say, `mouth/mouth-upperlip-volume-incr` says how much of it is upper lip.
"""
import math

import numpy as np

import makehuman as mh
import portrait_face
import portrait_sdf as S

F = np.float32


def _mask(rel, n):
    """Per-vertex weight (0-1) of how much a target moves each vertex."""
    idx, d = mh.target(rel)
    m = np.zeros(n, F)
    mag = np.linalg.norm(d, axis=1)
    m[idx] = mag / max(float(mag.max()), 1e-9)
    return m


class Regions:
    """Masks and landmark vertices on the base mesh (shared by everyone)."""

    _one = None

    @classmethod
    def get(cls):
        if cls._one is None:
            cls._one = Regions()
        return cls._one

    def __init__(self):
        b = mh.Base.get()
        n = len(b.co)
        self.n = n
        co = b.co * 10.0
        self.upper_lip = _mask("mouth/mouth-upperlip-volume-incr", n)
        self.lower_lip = _mask("mouth/mouth-lowerlip-volume-incr", n)
        # The eyebrows' skin: what the brow muscles move.
        self.brow = np.maximum.reduce(
            [
                _mask(f"expression/units/caucasian/eyebrows-{s}-{a}", n)
                for s in ("left", "right")
                for a in ("down", "extern-up", "inner-up")
            ]
        )
        self.nose = np.maximum(_mask("nose/nose-scale-vert-incr", n), _mask("nose/nose-scale-horiz-incr", n))
        self.chin = _mask("chin/chin-prominent-incr", n)
        self.forehead = _mask("forehead/forehead-scale-vert-incr", n)
        self.ear = {1: _mask("ears/l-ear-scale-incr", n), -1: _mask("ears/r-ear-scale-incr", n)}
        self.cheek = {1: _mask("cheek/l-cheek-volume-incr", n), -1: _mask("cheek/r-cheek-volume-incr", n)}
        self.bag = {1: _mask("eyes/l-eye-bag-incr", n), -1: _mask("eyes/r-eye-bag-incr", n)}
        self.upper_lid = {1: _mask("expression/units/caucasian/eye-left-closure", n), -1: _mask("expression/units/caucasian/eye-right-closure", n)}
        self.lower_lid = {1: _mask("expression/units/caucasian/eye-left-slit", n), -1: _mask("expression/units/caucasian/eye-right-slit", n)}
        # Midline profile of the face (x = 0), front-most at each height.
        body = b.verts_of("body")
        mid = body[(np.abs(co[body, 0]) < 1e-3) & (co[body, 1] > 58) & (co[body, 1] < 82)]
        mid = mid[np.argsort(co[mid, 1])]
        prof = []
        for v in mid:
            # Only the outer surface (the mouth and throat are also on the midline).
            if co[v, 2] > 14.0 or (co[v, 1] > 69 and co[v, 2] > 12.5):
                prof.append(v)
        prof = np.array(prof)
        y = co[prof, 1]
        z = co[prof, 2]

        def pick(lo, hi, how):
            m = (y >= lo) & (y <= hi)
            k = np.nonzero(m)[0]
            return int(prof[k[np.argmax(z[m])]] if how == "max" else prof[k[np.argmin(z[m])]])

        self.pronasale = pick(68.5, 70.5, "max")  # the tip of the nose
        self.nasion = pick(72.0, 74.5, "min")  # the root of the nose
        self.glabella = pick(74.5, 77.0, "max")
        self.lower_lip_front = pick(66.3, 67.2, "max")
        self.pogonion = pick(64.8, 66.0, "max")  # the front of the chin
        self.menton = int(prof[np.argmin(np.abs(y - 63.3))])  # under the chin
        lips = np.maximum(self.upper_lip, self.lower_lip)
        # The mouth line: where the two lips meet, on the midline.
        ul = body[(self.upper_lip[body] > 0.3) & (np.abs(co[body, 0]) < 0.3)]
        ll = body[(self.lower_lip[body] > 0.3) & (np.abs(co[body, 0]) < 0.3)]
        self.upper_lip_low = int(ul[np.argmin(co[ul, 1] - 0.3 * co[ul, 2])])
        self.lower_lip_high = int(ll[np.argmax(co[ll, 1] + 0.3 * co[ll, 2])])
        # The corners of the mouth: the lip vertices furthest to each side.
        lipv = body[lips[body] > 0.25]
        self.corner = {1: int(lipv[np.argmax(co[lipv, 0])]), -1: int(lipv[np.argmin(co[lipv, 0])])}
        # Below the nose, above the lip.
        k = (y > co[self.upper_lip_low, 1]) & (y < co[self.pronasale, 1])
        idx = np.nonzero(k)[0]
        self.subnasale = int(prof[idx[np.argmin(z[k])]])
        # The wings of the nose: nostril-width target, furthest to each side.
        nw = _mask("nose/nose-nostrils-width-incr", n)
        nv = body[nw[body] > 0.5]
        self.alar = {1: int(nv[np.argmax(co[nv, 0])]), -1: int(nv[np.argmin(co[nv, 0])])}
        # The ears' centres (weighted).
        self.lips = lips
        # The lid margins: where the lid skin turns in against the eyeball
        # (its edge touches the eye's sphere and faces across it).
        Qb = b.quads[b.faces_of("body")]
        fa, fb, fc, fd = co[Qb[:, 0]], co[Qb[:, 1]], co[Qb[:, 2]], co[Qb[:, 3]]
        fn = np.cross(fc - fa, fd - fb)
        N = np.zeros_like(co)
        for k in range(4):
            np.add.at(N, Qb[:, k], fn)
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
        self.margin_idx = {}
        for sx, g in ((1, "helper-l-eye"), (-1, "helper-r-eye")):
            c, r = _fit_sphere(co[b.verts_of(g)])
            q = co[body] - c
            dist = np.linalg.norm(q, axis=1)
            dot = (N[body] * q).sum(1) / np.maximum(dist, 1e-9)
            # (MakeHuman faces +Z: "in front of the eye" is +Z here.)
            ok = (dist - r > -0.02) & (dist - r < 0.075) & (dot > -0.45) & (dot < 0.1) & (q[:, 2] > 0.25 * r)
            self.margin_idx[sx] = body[ok]


def _fit_sphere(v):
    A = np.c_[2 * v, np.ones(len(v))]
    f = (v**2).sum(1)
    c = np.linalg.lstsq(A.astype(np.float64), f.astype(np.float64), rcond=None)[0]
    cen = c[:3]
    return cen.astype(F), float(math.sqrt(c[3] + (cen**2).sum()))


class MHHead:
    """One person's head, in one expression."""

    CROP_Z = -36.0  # the skin is kept above this (the chest)

    def __init__(self, P, expression="neutral"):
        self.P = P
        self.expression = expression
        b = mh.Base.get()
        self.base = b
        R = Regions.get()
        self.R = R
        model = mh.Model().add(portrait_face.identity(P))
        self.model = model
        rest = model.coords()
        posed = model.coords(extra=portrait_face.expression(expression, P))
        # The frame: the origin midway between the ears' centres (rest shape).
        ears = [(rest[R.ear[sx] > 0.2] * R.ear[sx][R.ear[sx] > 0.2, None]).sum(0) / R.ear[sx][R.ear[sx] > 0.2].sum() for sx in (1, -1)]
        origin = (ears[0] + ears[1]) / 2
        origin[0] = 0.0
        self.origin = origin
        self.V_rest = mh.to_portrait(rest, origin)
        self.V = mh.to_portrait(posed, origin)
        self._rest_mh = rest
        # The skin: MakeHuman's body, above the chest.
        faces = b.faces_of("body")
        Q = b.quads[faces]
        keep = self.V_rest[Q].mean(1)[:, 2] > self.CROP_Z
        self.skin_faces = faces[keep]
        # Eyes: the helper spheres MakeHuman fits its eyes to.
        self._eyes = {}
        self._eyes_rest = {}
        for sx, g in ((1, "helper-l-eye"), (-1, "helper-r-eye")):
            vi = b.verts_of(g)
            self._eyes[sx] = _fit_sphere(self.V[vi])
            self._eyes_rest[sx] = _fit_sphere(self.V_rest[vi])
        self.eye_r = float(np.mean([self._eyes[1][1], self._eyes[-1][1]]))
        self.eye_half = float(abs(self._eyes[1][0][0] - self._eyes[-1][0][0]) / 2)
        self.eye_z = float((self._eyes[1][0][2] + self._eyes[-1][0][2]) / 2)
        self.eye_y = float((self._eyes[1][0][1] + self._eyes[-1][0][1]) / 2)
        # Scale against the old head's average (pupils 6.3 cm apart).
        self.s = self.eye_half * 2 / 6.3
        self._lids()
        V = self.V
        self.stomion = ((V[R.upper_lip_low] + V[R.lower_lip_high]) / 2).astype(F)
        self.stomion[0] = 0.0
        self.menton = V[R.menton].copy()
        self.pogonion = V[R.pogonion].copy()
        self.subnasale = V[R.subnasale].copy()
        self.nasion = V[R.nasion].copy()
        self.tip = V[R.pronasale].copy()
        self.mouth_half = float(abs(V[R.corner[1], 0] - V[R.corner[-1], 0]) / 2) + 0.25
        self.alar_half = float(abs(V[R.alar[1], 0] - V[R.alar[-1], 0]) / 2)
        # The same on the rest shape, for maps and masks.
        Vr = self.V_rest
        self.rest = {
            "stomion": np.array([0.0, (Vr[R.upper_lip_low, 1] + Vr[R.lower_lip_high, 1]) / 2, (Vr[R.upper_lip_low, 2] + Vr[R.lower_lip_high, 2]) / 2], F),
            "menton": Vr[R.menton].copy(),
            "pogonion": Vr[R.pogonion].copy(),
            "subnasale": Vr[R.subnasale].copy(),
            "nasion": Vr[R.nasion].copy(),
            "tip": Vr[R.pronasale].copy(),
            "glabella": Vr[R.glabella].copy(),
            "mouth_half": float(abs(Vr[R.corner[1], 0] - Vr[R.corner[-1], 0]) / 2) + 0.25,
            "corner": {sx: Vr[R.corner[sx]].copy() for sx in (1, -1)},
            "ear": {sx: ((Vr * R.ear[sx][:, None]).sum(0) / R.ear[sx].sum()).astype(F) for sx in (1, -1)},
        }
        # Below the head (the clothes' shoulders are shorter on a child).
        self.body_z = 1.0 - 0.16 * P.child
        self._grids = {}

    # ── Eyes and lids ──────────────────────────────────────────────────────
    def eye_centre(self, sx, rest=False):
        return (self._eyes_rest if rest else self._eyes)[sx][0].copy()

    def _lids(self):
        """The lid margins, from MakeHuman's lash helpers (a strip along each
        lid, which the expression moves with the lid): the row nearest the
        eyeball is the margin, ordered from the inner corner to the outer."""
        self._margin = self._margins(self.V, self._eyes)
        self._margin_rest = self._margins(self.V_rest, self._eyes_rest)

    def _margins(self, V, eyes):
        """Each lid margin as (t, points), from the inner corner (t = 0) to
        the outer (t = 1) by how far across the eye each point is: the
        vertices where the lid meets the eyeball (Regions.margin_idx), split
        into upper and lower by the line between the corners."""
        margin = {}
        for sx in (1, -1):
            c, r = eyes[sx]
            P = V[self.R.margin_idx[sx]]
            a = sx * P[:, 0]
            inner = P[np.argmin(a)]
            outer = P[np.argmax(a)]
            a0, a1 = sx * inner[0], sx * outer[0]
            t = np.clip((a - a0) / max(a1 - a0, 1e-6), 0, 1)
            line_z = inner[2] + (outer[2] - inner[2]) * t
            for upper in (True, False):
                m = (P[:, 2] > line_z) if upper else (P[:, 2] <= line_z)
                row, tt = P[m], t[m]
                order = np.argsort(tt)
                row, tt = row[order], tt[order]
                # One point per slice across the eye (the one nearest the eyeball).
                keep = []
                edges = np.linspace(0, 1, 13)
                for e0, e1 in zip(edges[:-1], edges[1:]):
                    k = np.nonzero((tt >= e0) & (tt < e1))[0]
                    if len(k):
                        keep.append(k[np.argmin(np.abs(np.linalg.norm(row[k] - c, axis=1) - r))])
                row, tt = row[keep], tt[keep]
                row = np.concatenate([[inner], row, [outer]]).astype(F)
                tt = np.concatenate([[0.0], tt, [1.0]]).astype(F)
                margin[(sx, upper)] = (np.maximum.accumulate(tt), row)
        return margin

    def lid_point(self, sx, u, upper=True, out=0.0, rest=False):
        """A point on the lid margin: u from -1 (inner corner) to 1 (outer),
        `out` cm further from the eyeball's centre."""
        t, row = (self._margin_rest if rest else self._margin)[(sx, upper)]
        s = (float(u) + 1) / 2
        p = np.array([np.interp(s, t, row[:, k]) for k in range(3)], F)
        c, r = (self._eyes_rest if rest else self._eyes)[sx]
        d = p - c
        L = float(np.linalg.norm(d))
        return (c + d / max(L, 1e-6) * (L + out)).astype(F)

    def fissure_width(self, sx=1):
        t, row = self._margin[(sx, True)]
        return float(np.linalg.norm(row[-1] - row[0]))

    # ── Brows (for the hair) ───────────────────────────────────────────────
    def brow_z(self, sx, u, rest=False):
        """Height of the middle of the brow at distance u from the midline."""
        R = self.R
        w = R.brow
        V = self.V_rest if rest else self.V
        m = (w > 0.25) & (np.sign(self.V_rest[:, 0]) == sx)
        x = np.abs(V[m, 0])
        z = V[m, 2]
        ww = w[m]
        u = np.atleast_1d(np.asarray(u, F))
        out = np.empty(len(u), F)
        for i, ui in enumerate(u):
            k = np.exp(-(((x - ui) / 0.6) ** 2)) * ww**3
            out[i] = (k * z).sum() / max(k.sum(), 1e-6) if k.sum() > 1e-4 else self.eye_z + 1.6 * self.s
        return out

    # ── Fields for the clothes and hair ────────────────────────────────────
    def _triangles(self, V, faces):
        Q = self.base.quads[faces]
        return V, Q

    def sdf_grid(self, which="rest", lo=(-26, -17, -44), hi=(26, 19, 21), voxel=0.25, band=40):
        """The skin as a signed distance field, sampled on a grid (OpenVDB's
        mesh to level set), as a portrait_sdf FieldGrid. `which`: "rest",
        "posed", or "drape" (the rest shape with the ears laid flat, for
        cloth that covers them)."""
        key = (which, tuple(lo), tuple(hi), voxel)
        if key in self._grids:
            return self._grids[key]
        import openvdb as vdb

        b = self.base
        if which == "drape":
            flat = {}
            for s in ("l", "r"):
                flat.update({f"ears/{s}-ear-scale-decr": 1.0, f"ears/{s}-ear-flap-decr": 1.0, f"ears/{s}-ear-wing-decr": 1.0, f"ears/{s}-ear-scale-depth-decr": 1.0})
            V = mh.to_portrait(self.model.coords(extra=flat), self.origin)
        else:
            V = self.V_rest if which == "rest" else self.V
        faces = b.faces_of("body")
        Q = b.quads[faces].astype(np.uint32)
        xf = vdb.createLinearTransform(voxelSize=float(voxel))
        grid = vdb.FloatGrid.createLevelSetFromPolygons(V.astype(np.float32), quads=Q, transform=xf, halfWidth=float(band))
        lo = np.array(lo, F)
        n = np.ceil((np.array(hi, F) - lo) / voxel).astype(int) + 1
        arr = np.zeros(tuple(n), np.float32)
        ijk0 = tuple(int(round(v / voxel)) for v in lo)
        grid.copyToArray(arr, ijk=ijk0)
        g = S.FieldGrid.__new__(S.FieldGrid)
        g.lo = (np.array(ijk0, F) * voxel).astype(F)
        g.v = float(voxel)
        g.n = n
        g.d = arr.astype(F)
        g.g = np.stack(np.gradient(g.d, voxel), -1).astype(F)
        self._grids[key] = g
        return g

    @property
    def shape(self):
        return S.GridShape(self.sdf_grid("rest"))

    @property
    def without_ears(self):
        return S.GridShape(self.sdf_grid("drape"))

    def body(self):
        """The neck and shoulders as a field (the head above the jaw left out)."""
        full = self.shape
        me = self.rest["menton"]
        # A plane well under the jaw at the front, rising to the nape at the back.
        z0 = float(me[2]) - 3.0 * self.s
        y0 = float(me[1])
        slope = (-6.0 * self.s - z0) / (6.0 * self.s - y0)

        def f(p):
            cut = p[:, 2] - (z0 + (p[:, 1] - y0) * slope)
            return np.maximum(full(p), cut)

        return S.Fn(f, full.bbox)

    def _neck_band(self):
        V = self.V_rest[self.base.verts_of("body")]
        z = float(self.rest["menton"][2]) - 4.0 * self.s
        band = (np.abs(V[:, 2] - z) < 0.6) & (np.abs(V[:, 0]) < 9)
        return V[band]

    @property
    def notch_z(self):
        """Height of the notch between the collarbones (the jugular notch):
        the deepest point of the front of the neck and chest on the midline."""
        V = self.V_rest[self.base.verts_of("body")]
        me = float(self.rest["menton"][2])
        m = (np.abs(V[:, 0]) < 0.35) & (V[:, 1] < self.neck_axis_y) & (V[:, 2] < me - 4.0 * self.s) & (V[:, 2] > me - 15.0 * self.s)
        q = V[m]
        return float(q[np.argmax(q[:, 1]), 2])

    @property
    def neck_axis_y(self):
        """Where the neck's axis is, front to back (cm)."""
        q = self._neck_band()
        return float((q[:, 1].min() + q[:, 1].max()) / 2)

    def _neck_radius(self):
        """The neck's radius half-way between the chin and the collarbones."""
        q = self._neck_band()
        return float(np.median(np.hypot(q[:, 0], (q[:, 1] - self.neck_axis_y) * 0.85)))

    # ── The skin mesh ──────────────────────────────────────────────────────
    def skin_mesh(self):
        """(posed vertices, rest vertices, quads, uv per corner, base index per
        vertex) of the skin, re-indexed to the vertices it uses."""
        b = self.base
        Q = b.quads[self.skin_faces]
        used = np.unique(Q)
        remap = -np.ones(len(b.co), np.int64)
        remap[used] = np.arange(len(used))
        uv = b.uv[b.face_uv[self.skin_faces]]
        return self.V[used], self.V_rest[used], remap[Q], uv, used

    def helper_mesh(self, group, rest=False):
        b = self.base
        faces = b.faces_of(group)
        Q = b.quads[faces]
        used = np.unique(Q)
        remap = -np.ones(len(b.co), np.int64)
        remap[used] = np.arange(len(used))
        V = self.V_rest if rest else self.V
        return V[used], remap[Q], used
