"""An anatomical head and neck (and the shoulders the clothes rest on),
sculpted as a signed distance field.

Coordinates are centimetres: X to the person's left, -Y forward (the face
looks toward -Y), Z up. The origin is midway between the ear canals.

The head is built in three layers:

1. **A relief.** Around a vertical axis just behind the ears, every height
   has a cross-section: how far forward the face is on the midline, how
   wide the head is, how square the front is, how far back the skull goes.
   These come from tables of anatomical landmarks (adult averages: head
   height about 23 cm, eyes 6.3 cm apart, the cornea about 1 cm behind the
   bridge of the nose), moved by the person's parameters (portrait_params).
   Soft bumps and dents on top of the relief give the brow, eye sockets,
   cheekbones, temples, lips, philtrum, the mouth line, the folds from nose
   to mouth, and the chin. A plane through the chin and the angles of the
   jaw cuts the jawline.
2. **Solid features.** The nose (bridge, tip, wings, nostrils), ears, and the
   neck are blended on as shapes.
3. **The lids.** A shell of skin over each eyeball (portrait_eyes.py draws
   the eyeballs), with the opening between the lids carved out, so lids,
   creases and corners come from the same field.

Finally, age adds wrinkles as a small displacement of the field.
"""
import math

import numpy as np

import portrait_sdf as S

F = np.float32
AXIS_Y = 1.5  # the relief's vertical axis, just behind the ear canals
LID_T = 0.22  # thickness of the eyelids at their margin (cm)


def pchip_table(knots, lo=-16.0, hi=15.0, step=0.02, smooth=0.0):
    """A dense table of a smooth, overshoot-free curve through (z, value) knots."""
    k = sorted(knots)
    x = np.array([a for a, _ in k], np.float64)
    y = np.array([b for _, b in k], np.float64)
    h = np.diff(x)
    d = np.diff(y) / h
    m = np.zeros_like(y)
    for i in range(1, len(y) - 1):
        if d[i - 1] * d[i] > 0:
            w1 = 2 * h[i] + h[i - 1]
            w2 = h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    m[0] = d[0]
    m[-1] = d[-1]
    grid = np.arange(lo, hi + step, step)
    xi = np.clip(grid, x[0], x[-1])
    idx = np.clip(np.searchsorted(x, xi) - 1, 0, len(x) - 2)
    t = (xi - x[idx]) / h[idx]
    h00 = 2 * t**3 - 3 * t**2 + 1
    h10 = t**3 - 2 * t**2 + t
    h01 = -2 * t**3 + 3 * t**2
    h11 = t**3 - t**2
    vals = h00 * y[idx] + h10 * h[idx] * m[idx] + h01 * y[idx + 1] + h11 * h[idx] * m[idx + 1]
    if smooth > 0:
        # Gaussian smoothing makes the curve continuous in curvature, so the
        # skin shows no banding between rows.
        n = int(smooth * 3 / step)
        kern = np.exp(-0.5 * (np.arange(-n, n + 1) * step / smooth) ** 2)
        kern /= kern.sum()
        padded = np.concatenate([np.full(n, vals[0]), vals, np.full(n, vals[-1])])
        vals = np.convolve(padded, kern, mode="valid")
    return grid.astype(F), vals.astype(F)


def _g(v):
    return np.exp(-v * v)


def _lip(v, peak, border, tail):
    """A lip's forward bulge across its height: 0 at the mouth line (v=0),
    rising to 1 at `peak`, `border` of that at the edge of the red (v=1),
    then easing to nothing over `tail` (in lip heights) into the skin."""
    rise = np.sin(np.clip(v / peak, 0, 1) * (np.pi / 2)) ** 1.35
    mid = 1 - (1 - border) * np.clip((v - peak) / (1 - peak), 0, 1) ** 1.5
    t = np.clip(1 - (v - 1) / tail, 0, 1)
    fall = border * t * t * (3 - 2 * t)
    return np.where(v <= 1, rise * mid, fall) * (v > 0)


def _seg_dist(u, z, pts):
    """Distance in the (u, z) plane from points to a polyline."""
    best = np.full(u.shape, 1e3, F)
    for (u0, z0), (u1, z1) in zip(pts, pts[1:]):
        du, dz = u1 - u0, z1 - z0
        L = du * du + dz * dz
        t = np.clip(((u - u0) * du + (z - z0) * dz) / L, 0, 1)
        best = np.minimum(best, np.hypot(u - (u0 + t * du), z - (z0 + t * dz)))
    return best


class Head:
    def __init__(self, P):
        self.P = P
        self._landmarks()
        self.shape = self._build()

    # ── Landmarks ──────────────────────────────────────────────────────────
    def _landmarks(self):
        P = self.P
        m = P.masc  # 0 feminine … 1 masculine bone structure
        c = P.child  # 0 adult … 1 about eleven years old
        fw = P.face_width
        fl = P.face_length
        self.s = s = P.scale
        self.body_z = 1.0 - 0.12 * c  # below the head, children are shorter
        mb = m * (1 - c)  # adult masculine features (brow, jaw, larynx)
        self.mb = mb
        # The lower face grows most between childhood and adulthood.
        lower = fl * (1.0 - 0.14 * c)
        self.lower = lower
        self.eye_half = (3.15 + P.eye_spacing * 0.25) * s * (1.0 - 0.02 * c)
        self.eye_z = 1.6 * s
        self.eye_r = 1.2 * (1.0 - 0.02 * c)
        self.eye_y = -7.15 * s - 0.2 * P.eye_depth + 0.12 * c
        self.brow = 0.2 + 0.8 * mb  # brow-ridge strength
        self.glabella = np.array([0, -9.5 * s - 0.35 * self.brow + 0.25 * c, 4.4 * s], F)
        self.nasion = np.array([0, -9.0 * s - 0.25 * self.brow + 0.45 * c, 3.05 * s], F)
        # Nose.
        # Women's and children's noses are shorter and project less.
        nl = P.nose_length * lower * (1.0 - 0.14 * c) * (0.89 + 0.11 * m)
        self.subnasale_z = self.nasion[2] - 5.45 * nl
        proj = P.nose_projection * (1.0 - 0.35 * c) * (0.7 + 0.3 * m)
        self.tip = np.array([0, -10.35 * s - 1.7 * proj + 0.3 * c, self.subnasale_z + (1.0 + 0.1 * (1 - m)) * nl], F)
        self.subnasale = np.array([0, -10.0 * s - 0.2 * proj + 0.2 * c, self.subnasale_z], F)
        self.nose_w = P.nose_width * (1.0 - 0.12 * c) * (0.87 + 0.15 * m)
        # Mouth.
        mz = self.subnasale_z - 2.05 * lower
        self.stomion = np.array([0, -9.75 * s - 0.2 * P.lip_projection + 0.2 * c, mz], F)
        self.mouth_half = (2.45 + 0.1 * m) * s * P.mouth_width * (1.0 - 0.08 * c)
        # Chin and jaw.
        chin_z = mz - (4.75 * lower) * (0.95 + 0.07 * mb)
        self.menton = np.array([0, -8.4 * s - 0.3 * P.chin + 0.4 * c, chin_z], F)
        self.pogonion = np.array([0, -9.75 * s - 0.45 * P.chin + 0.45 * c, chin_z + 1.45], F)
        # A narrower jaw for women; the angle a little higher.
        jaw = (4.9 * P.jaw_width + 0.35 * mb - 0.3 * c) * (0.9 + 0.1 * m)
        self.gonion = np.array([jaw * s * fw, -0.2 * s, chin_z + 3.6 * lower + 0.3 * c + 0.3 * (1 - m)], F)

    # ── The relief ─────────────────────────────────────────────────────────
    def _rows(self):
        """(z, front y, half-width, squareness, back y) from the crown to under the chin."""
        P = self.P
        s = self.s
        c = P.child
        mb = self.mb
        fw = P.face_width
        g, n = self.glabella, self.nasion
        sn, st, me, po = self.subnasale, self.stomion, self.menton, self.pogonion
        fore = 0.25 * c + 0.2 * (1 - P.masc)  # rounder, more upright foreheads
        # Above the top row the relief continues straight up; the dome of the
        # skull (an ellipsoid, see _build) closes it.
        rows = [
            (11.0 * s, -6.3 - 0.3 * fore, 6.0, 2.05, 8.2),
            (9.5 * s, -8.0 - 0.4 * fore, 7.1, 2.15, 9.6),
            (8.0 * s, -8.85 - 0.3 * fore, 7.35, 2.25, 10.3),
            (6.0 * s, -9.3 - 0.1 * fore, 7.45, 2.35, 10.45),
            (g[2], g[1] + 0.2 * self.brow, 7.3, 2.5, 10.3),
            (n[2] + 0.1, n[1] - 0.05, 7.1, 2.6, 10.0),
            (self.eye_z, -8.45 * s + 0.1 * c, 7.1, 2.75, 9.6),
            (0.2 * s, -8.4 * s + 0.1 * c, 7.2 * fw, 2.6, 9.1),
            (-1.4 * s, -8.75 * s, 7.05 * fw, 2.2, 8.4),
            (sn[2], sn[1] + 0.25, 6.7 * fw, 1.9, 7.4),
            (sn[2] - 0.7, sn[1] - 0.05, 6.45 * fw, 1.88, 7.0),
            (st[2] + 0.62, st[1] - 0.2, 6.3 * fw, 1.9, 6.6),
            (st[2], st[1] + 0.05, 6.2 * fw, 1.95, 6.3),
            (st[2] - 0.7, st[1] + 0.05, 6.1 * fw, 2.0, 6.1),
            (st[2] - 1.6, st[1] + 0.4 - 0.15 * c, (5.95 + 0.1 * mb) * fw, 1.95 + 0.1 * mb, 6.0),
            ((st[2] + po[2]) / 2 - 0.5, po[1] + 0.2, (5.85 + 0.15 * mb) * fw, 2.0 + 0.15 * mb, 5.9),
            (po[2], po[1], (5.7 + 0.2 * mb) * fw, 2.05 + 0.15 * mb, 5.9),
            (me[2] + 0.6, po[1] + 0.45, (5.4 + 0.15 * mb) * fw, 2.05, 5.9),
            (me[2] - 0.4, me[1] + 0.3, 5.2 * fw, 2.0, 5.9),
            (me[2] - 2.0, me[1] + 1.8, 5.2, 2.0, 6.0),
        ]
        return rows

    def _relief(self):
        P = self.P
        s = self.s
        c = P.child
        mb = self.mb
        fat = P.fullness
        age = P.age_t
        rows = self._rows()
        tz, D = pchip_table([(z, AXIS_Y - yf) for z, yf, _, _, _ in rows], smooth=0.35)
        _, W = pchip_table([(z, w) for z, _, w, _, _ in rows], smooth=0.5)
        _, NN = pchip_table([(z, nn) for z, _, _, nn, _ in rows], smooth=0.8)
        _, B = pchip_table([(z, yb - AXIS_Y) for z, _, _, _, yb in rows], smooth=0.5)
        E = self.eye_half
        ez = self.eye_z
        sn, st, po = self.subnasale, self.stomion, self.pogonion
        mw = self.mouth_half
        full = P.lip_fullness * (1.0 - 0.2 * age)
        nose_w = self.nose_w
        # Lip geometry: height of each lip at the centre and a Cupid's bow.
        up_h = (0.8 + 0.22 * full) * s
        lo_h = (0.95 + 0.25 * full) * s
        up_amp = (0.38 + 0.18 * full) * s
        lo_amp = (0.44 + 0.2 * full) * s
        self.up_h, self.lo_h = up_h, lo_h
        crease = 0.12 + 0.45 * age + 0.1 * mb - 0.1 * c
        naso = []
        for sx in (-1, 1):
            naso.append([(sx * 1.85 * nose_w, sn[2] + 0.75), (sx * 2.45 * nose_w, sn[2] - 0.55), (sx * (mw + 0.55), st[2] - 0.2), (sx * (mw + 0.45), st[2] - 1.8)])

        def table(tab, z):
            return np.interp(z, tz, tab).astype(F)

        def features(th, z, Dz):
            u = th * Dz  # lateral distance along the face (cm)
            out = np.zeros_like(z)
            au = np.abs(u)
            # Brow ridge (strong in men), and the frontal eminences.
            out += (0.15 + 0.55 * self.brow) * _g((z - (4.05 * s - 0.018 * u * u)) / 0.85) * _g(au / 5.2) ** 2
            # Eye sockets: deepest up and in, under the brow.
            for sx in (-1, 1):
                out -= (1.05 + 0.2 * P.eye_depth) * _g((u - sx * E * 1.05) / 1.55) * _g((z - ez - 0.1) / 1.3)
                out -= 0.35 * _g((u - sx * (E * 0.8)) / 0.9) * _g((z - ez - 0.9) / 0.8)
                # The soft fold of skin between the lid crease and the brow.
                out += 0.14 * _g((u - sx * E * 1.02) / 1.15) * _g((z - ez - 1.3) / 0.38)
                # Cheekbones, and the hollow beneath them in lean faces.
                out += (0.45 + 0.2 * mb + 0.15 * fat) * _g((u - sx * 4.75 * s) / 1.45) * _g((z + 0.15) / 1.15)
                out -= 0.3 * max(0.0, 0.6 - fat) * (1 - c) * _g((u - sx * 4.6 * s) / 1.4) * _g((z + 3.0) / 1.3)
                # Temples.
                out -= 0.45 * _g((u - sx * 7.0 * s) / 1.3) * _g((z - 3.5 * s) / 1.6)
                # The jaw muscle at the angle of the jaw.
                out += 0.25 * mb * _g((u - sx * 9.0) / 1.8) * _g((z + 5.5) / 1.8)
                # The cheeks beside the mouth: everyone has some; fuller in
                # children, women and round faces; they fall with age.
                cheek = 0.4 + 0.35 * c + 0.45 * max(0.0, fat - 0.2) + 0.15 * (1 - P.masc) - 0.15 * age
                out += cheek * _g((u - sx * 4.1) / 1.7) * _g((z - st[2] - 1.2 + 0.8 * age) / 2.0)
                # Age: hooded upper lids, bags under the eyes, hollow temples and
                # cheeks, and jowls along the jaw.
                if age > 0.05:
                    out += 0.3 * age * _g((u - sx * E * 1.1) / 1.2) * _g((z - ez - 1.05) / 0.45)
                    out += 0.28 * age * _g((u - sx * E * 1.05) / 1.1) * _g((z - ez + 1.15) / 0.4)
                    out -= 0.3 * age * _g((u - sx * 6.8 * s) / 1.4) * _g((z - 3.0 * s) / 1.8)
                    out -= 0.3 * age * _g((u - sx * 4.8 * s) / 1.3) * _g((z + 2.6) / 1.2)
                    out += 0.4 * age * _g((u - sx * 4.4 * s) / 1.4) * _g((z - self.menton[2] - 2.3) / 1.2)
            # Nasolabial folds: a crease, with the cheek slightly fuller outside it.
            for sx, pts in zip((-1, 1), naso):
                d = _seg_dist(u, z, pts)
                # Fade toward the lower end of the fold.
                fade = np.clip((z - pts[3][1]) / 1.4, 0, 1)
                edge = np.interp(z, [pts[3][1], pts[1][1]], [abs(pts[3][0]), abs(pts[1][0])])
                side = 1.0 / (1.0 + np.exp(-((u * sx) - edge) / 0.25))
                out -= crease * 0.22 * _g(d / 0.3) * fade
                out += crease * 0.3 * _g(d / 0.9) * side * fade
            # Lips.
            k = np.clip(1 - (u / mw) ** 2, 0, 1)
            bow = 0.08 * _g((au - 0.25 * mw) / 0.22) - 0.04 * _g(au / 0.18)
            hu = up_h * k**0.55 + bow
            v = (z - st[2]) / np.maximum(hu, 0.05)
            # Upper lip: rolls out from the mouth line, fullest just below the
            # border, and carries on as the skin sloping up to the nose.
            out += up_amp * k**0.7 * _lip(v, 0.55, 0.8, 1.1)
            out += 0.045 * _g((v - 1.0) / 0.09) * k  # the raised border (white roll)
            hl = lo_h * k**0.55
            v2 = (st[2] - z) / np.maximum(hl, 0.05)
            # Lower lip: fullest in the middle, turning under into the groove above the chin.
            out += lo_amp * k**0.8 * _lip(v2, 0.45, 0.62, 0.9)
            # The line between the lips, and the corners of the mouth.
            zl = st[2] - 0.06 * (u / mw) ** 2
            out -= 0.12 * _g((z - zl) / 0.045) * np.clip((1.02 - au / mw) / 0.12, 0, 1)
            for sx in (-1, 1):
                out -= 0.18 * _g((u - sx * mw) / 0.22) * _g((z - st[2]) / 0.22)
            # Philtrum: a groove with a ridge either side.
            top = sn[2] - 0.2
            bot = st[2] + up_h * 0.95
            win = np.clip((top - z) / 0.25, 0, 1) * np.clip((z - bot) / 0.2, 0, 1)
            out -= 0.12 * _g(u / 0.3) * win
            out += 0.07 * _g((au - 0.5) / 0.2) * win
            # Chin: the mental protuberance.
            out += (0.3 + 0.2 * P.chin) * _g(u / (1.4 + 0.5 * mb)) * _g((z - po[2]) / 1.1)
            return out

        def r_of(th, z):
            Dz = table(D, z)
            Wz = table(W, z)
            nz = table(NN, z)
            Bz = table(B, z)
            cth = np.cos(th)
            sth = np.abs(np.sin(th))
            front = cth > 0
            depth = np.where(front, Dz, Bz)
            nn = np.where(front, nz, 2.0)
            r = 1.0 / ((sth / Wz) ** nn + (np.abs(cth) / depth) ** nn) ** (1.0 / nn)
            return r + features(th, z, Dz) * np.clip(cth * 1.6, 0, 1)

        def field(p):
            x, y, z = p[:, 0], p[:, 1] - AXIS_Y, p[:, 2]
            rho = np.sqrt(x * x + y * y)
            th = np.arctan2(x, -y)
            r = r_of(th, z)
            dz = 0.04
            dt = 0.004
            rz = (r_of(th, z + dz) - r_of(th, z - dz)) / (2 * dz)
            rt = (r_of(th + dt, z) - r_of(th - dt, z)) / (2 * dt) / np.maximum(rho, 1.0)
            return (rho - r) / np.sqrt(1 + rz * rz + rt * rt)

        return S.Fn(field, ((-9.5, -13.5, -14.0), (9.5, 12.5, 14.0)))

    def lip_mask(self, p, soft=0.06):
        """How much each point is on the red of the lips (0-1), from the same
        geometry that sculpts them."""
        st = self.stomion
        mw = self.mouth_half
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        k = np.clip(1 - (x / (mw * 1.02)) ** 2, 0, 1)
        au = np.abs(x)
        bow = 0.08 * _g((au - 0.25 * mw) / 0.22) - 0.04 * _g(au / 0.18)
        top = st[2] + self.up_h * k**0.55 + bow
        bot = st[2] - self.lo_h * k**0.55
        inside = np.minimum(top - z, z - bot)
        front = np.clip((-(y - st[1]) + 1.2) / 0.6, 0, 1)
        return np.clip(inside / soft + 0.5, 0, 1) * (k > 0) * front

    # ── The field ──────────────────────────────────────────────────────────
    def _build(self):
        # The dome of the skull closes the relief above the forehead.
        s = self.s
        dome = S.Ellipsoid((0, 0.95 * s, 2.0 * s), (10.0 * s, 11.9 * s, 11.35 * s))
        face = S.Intersect(self._relief(), dome, 1.2)
        # The jawline: cut under a plane through the chin and the angles of the jaw.
        me = self.menton + np.array([0, 0, -0.15], F)
        go = self.gonion
        a = np.array([go[0], go[1], go[2]], F) - me
        b = np.array([-go[0], go[1], go[2]], F) - me
        nrm = np.cross(b, a)
        if nrm[2] > 0:
            nrm = -nrm
        nrm /= np.linalg.norm(nrm)

        def below_jaw(p, me=me, nrm=nrm):
            return (p - me) @ nrm

        face = S.Intersect(face, S.Fn(below_jaw), 0.9 + 0.3 * self.P.fullness)
        # Nose: the bridge and tip blend broadly into the face; the wings keep a crease.
        body, wings = self._nose()
        face = S.Union([face, body], 0.7)
        face = S.Union([face, wings], 0.26)
        face = self._nostrils(face)
        # Eyelids.
        face = self._lids(face)
        neck = self._neck()
        # What cloth drapes over: the head and neck without the ears (a head
        # covering falls over the ears rather than wrapping round them).
        self.without_ears = S.Union([face, neck], 1.3)
        # Ears.
        face = S.Union([face, self._ears()], 0.3)
        # Neck (the shoulders and chest are a separate, coarser mesh).
        face = S.Union([face, neck], 1.3)
        # Age: wrinkles, as a small displacement of the field.
        return self._age_detail(face)

    def _nose(self):
        """(bridge, tip and columella; the wings): the wings join the face with a crease."""
        s = self.s
        n = self.nasion
        t = self.tip
        sn = self.subnasale
        w = self.nose_w
        P = self.P
        parts = []
        # The bridge (dorsum): narrow between the eyes, widening to the tip, a hump for some.
        hump = np.array([0, -0.14 * P.nose_hump, 0], F)
        a = n + np.array([0, 0.55, 0.05], F)
        b = n + (t - n) * 0.5 + np.array([0, 0.5, 0], F) + hump
        c = t + np.array([0, 0.72, 0.5], F)
        parts.append(S.RoundCone(a, b, 0.45 * w, 0.54 * w))
        parts.append(S.RoundCone(b, c, 0.54 * w, 0.62 * w))
        # Side walls, widening down toward the wings.
        third = n + (sn - n) * 0.4
        for sx in (-1, 1):
            parts.append(S.RoundCone((sx * 0.4 * w, third[1] + 1.1, third[2]), (sx * 1.0 * w, sn[1] + 1.1, sn[2] + 0.95), 0.45, 0.62))
        # The tip lobule, with a faint pair of domes.
        tl = 0.82 + 0.18 * P.masc  # a smaller, finer tip for women
        parts.append(S.Ellipsoid(t + np.array([0, 0.76, -0.12], F), (0.95 * w * tl, 0.8 * tl, 0.74 * tl)))
        for sx in (-1, 1):
            parts.append(S.Sphere(t + np.array([sx * 0.3 * w, 0.44, 0.0], F), 0.42 * w))
        # Columella: the strut under the tip, down to the lip.
        parts.append(S.RoundCone(t + np.array([0, 0.62, -0.55], F), sn + np.array([0, -0.06, 0.14], F), 0.3 * w, 0.33 * w))
        body = S.Union(parts, 0.42 * s)
        wings = []
        for sx in (-1, 1):
            # Each wing curves from its base on the face forward to the tip.
            base = np.array([sx * 1.45 * w, sn[1] + 0.95, sn[2] + 0.42], F)
            front = t + np.array([sx * 0.78 * w, 0.8, -0.3], F)
            wings.append(S.RoundCone(base, front, 0.46, 0.4))
            wings.append(S.Ellipsoid((sx * 1.38 * w, sn[1] + 0.55, sn[2] + 0.56), (0.44 * w, 0.62, 0.48)))
        return body, S.Union(wings, 0.25)

    def _nostrils(self, face):
        """Openings on the underside, between the columella and the wings."""
        w = self.nose_w
        t = self.tip
        sn = self.subnasale
        holes = []
        for sx in (-1, 1):
            c = (sx * 0.62 * w, (t[1] + sn[1]) / 2 + 0.62, sn[2] + 0.2)
            holes.append(S.Ellipsoid(c, (0.25 * w, 0.42, 0.22), S.rot(yaw=sx * 20, pitch=-20)))
        return S.Subtract(face, S.Union(holes), 0.1)

    # ── Eyelids ────────────────────────────────────────────────────────────
    def eye_centre(self, sx):
        return np.array([sx * self.eye_half, self.eye_y, self.eye_z], F)

    def fissure(self, sx):
        """The opening between the lids, in the eye's angles (radians):
        (medial, lateral, upper(u), lower(u)) with u from -1 (medial) to 1 (lateral)."""
        P = self.P
        open_ = P.eye_open
        up = math.radians(17 + 4 * open_ + 2 * P.child)
        lo = math.radians(-22 - 3 * open_)
        tilt = math.radians(P.canthal_tilt)

        def upper(u):
            k = u + 0.22 * (1 - u * u)  # the highest point toward the nose
            return up * np.clip(1 - k * k, 0, None) ** 0.62 + tilt * u * 0.5

        def lower(u):
            k = u - 0.18 * (1 - u * u)  # the lowest point toward the temple
            return lo * np.clip(1 - k * k, 0, None) ** 0.8 + tilt * u * 0.5

        return math.radians(-52), math.radians(66), upper, lower

    def _eye_angles(self, p, sx):
        q = p - self.eye_centre(sx)
        # Horizontal angle, positive toward the temple for both eyes.
        a = np.arctan2(sx * q[:, 0], -q[:, 1])
        b = np.arctan2(q[:, 2], np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2))
        r = np.sqrt(np.einsum("ij,ij->i", q, q))
        return a, b, r

    def lid_point(self, sx, u, upper=True, out=0.0):
        """A point on a lid margin (u from -1 medial to 1 lateral), `out` cm off the eyeball."""
        a_med, a_lat, fu, fl = self.fissure(sx)
        a = (a_med + a_lat) / 2 + u * (a_lat - a_med) / 2
        b = float(fu(np.array(u)) if upper else fl(np.array(u)))
        r = self.eye_r + out
        d = np.array([sx * math.sin(a) * math.cos(b), -math.cos(a) * math.cos(b), math.sin(b)], F)
        return self.eye_centre(sx) + d * r

    def _lids(self, face):
        R = self.eye_r
        P = self.P
        t = LID_T
        for sx in (-1, 1):
            E = self.eye_centre(sx)
            a_med, a_lat, upper, lower = self.fissure(sx)
            crease_h = 0.62 + 0.14 * P.eye_open - 0.2 * P.age_t
            # The lids: skin over the eyeball, blended into the socket.
            face = S.Union([face, S.Sphere(E, R + t)], 0.5)
            # The lid crease above the upper lid.
            pts = []
            for u in np.linspace(-0.8, 0.95, 9):
                a = (a_med + a_lat) / 2 + u * (a_lat - a_med) / 2
                b = float(upper(np.array(u))) + crease_h / (R + t) * (1 - 0.3 * u * u)
                d = np.array([math.sin(a) * math.cos(b) * sx, -math.cos(a) * math.cos(b), math.sin(b)], F)
                pts.append((E + d * (R + t + 0.02), 0.075 + 0.03 * P.age_t))
            face = S.Subtract(face, S.Chain(pts, 0.04), 0.12)

            def opening(p, sx=sx, E=E, a_med=a_med, a_lat=a_lat, upper=upper, lower=lower):
                a, b, r = self._eye_angles(p, sx)
                u = (2 * a - (a_med + a_lat)) / (a_lat - a_med)
                uc = np.clip(u, -1, 1)
                rr = R + t
                # Distance-like measure, in cm along the lid surface.
                dv = np.maximum(b - upper(uc), lower(uc) - b) * rr
                dh = (np.abs(u) - 1) * (a_lat - a_med) / 2 * rr
                d2 = np.maximum(dv, dh)
                # Only through the lids: not into the eyeball, not beyond the lid skin.
                return np.maximum(np.maximum(d2, R * 0.55 - r), r - (R + t + 0.45))

            box = (E - np.array([3.0, 3.0, 2.5], F), E + np.array([3.0, 3.0, 2.5], F))
            face = S.Subtract(face, S.Fn(opening, box), 0.08)
        return face

    # ── Ears ───────────────────────────────────────────────────────────────
    def _ears(self):
        s = self.s * self.P.ear_size * (1 + 0.1 * self.P.age_t)
        ears = []
        for sx in (-1, 1):
            base = np.array([sx * 6.75 * self.s, 0.7 * self.s, 0.3 * self.s], F)

            def tf(y, z, out, sx=sx, base=base):
                # Ear plane: y back, z up, tilted back 15 degrees, flaring out behind.
                a = math.radians(15)
                yy = y * math.cos(a) + z * math.sin(a)
                zz = -y * math.sin(a) + z * math.cos(a)
                flare = 0.32 * max(0.0, yy)
                return base + np.array([sx * (out + flare), yy, zz], F)

            disc = S.Ellipsoid(tf(1.3 * s, 0.1 * s, 0.35), (0.42, 1.75 * s, 3.0 * s), S.rot(yaw=sx * 20))
            # Helix: the rolled outer rim, from above the ear canal round to the lobe.
            path = []
            for k in range(12):
                th = math.radians(-95 + k * 22)
                y = 1.25 * s + 1.75 * s * math.sin(th)
                z = 0.4 * s + 2.85 * s * math.cos(th)
                path.append((tf(y, z, 0.55 + 0.1 * math.sin(th)), 0.3 * s if k < 10 else 0.38 * s))
            helix = S.Chain(path, 0.15)
            # Antihelix: the inner ridge.
            path2 = []
            for k in range(6):
                th = math.radians(-40 + k * 30)
                y = 1.35 * s + 1.0 * s * math.sin(th)
                z = 0.3 * s + 1.7 * s * math.cos(th)
                path2.append((tf(y, z, 0.6), 0.22 * s))
            anti = S.Chain(path2, 0.1)
            lobe = S.Ellipsoid(tf(0.9 * s, -2.55 * s, 0.45), (0.42, 0.9 * s, 0.85 * s))
            tragus = S.Ellipsoid(tf(-0.15 * s, -0.5 * s, 0.35), (0.33, 0.33, 0.5))
            ear = S.Union([disc, helix, anti, lobe, tragus], 0.22)
            concha = S.Ellipsoid(tf(0.75 * s, -0.55 * s, 1.0), (0.72, 0.82 * s, 0.98 * s))
            ear = S.Subtract(ear, concha, 0.3)
            ears.append(ear)
        return S.Union(ears)

    # ── Neck and shoulders ─────────────────────────────────────────────────
    def _neck_radius(self):
        return (5.1 + 0.9 * self.mb - 0.5 * self.P.child) * self.s

    def _neck(self):
        s = self.s
        nr = self._neck_radius()
        neck = S.RoundCone((0, 0.6 * s, -3.0 * s), (0, 1.2 * s, -19.0 * s), nr * 0.97, nr * 1.05)
        parts = [neck]
        # Sternocleidomastoids: from behind the ear to the top of the breastbone.
        for sx in (-1, 1):
            parts.append(S.RoundCone((sx * 5.2 * s, 1.8 * s, -3.0 * s), (sx * 1.3 * s, -4.4 * s, -18.5 * s), 1.15 * s, 1.05 * s))
        if self.mb > 0.5:
            parts.append(S.Ellipsoid((0, -4.6 * s, -12.5 * s), (0.7, 0.6, 1.1)))
        return S.Clip(S.Union(parts, 1.4), (-12, -12, -19.0 * s), (12, 12, 2))

    def body(self):
        """Neck base, shoulders and chest: what the clothes rest on."""
        P = self.P
        s = self.s
        z = self.body_z  # children's necks are shorter
        nr = self._neck_radius()
        parts = [S.RoundCone((0, 1.0 * s, -9.0 * s * z), (0, 1.8 * s, -22.0 * s * z), nr * 0.98, nr * 1.08)]
        sh = (17.5 + 2.5 * self.mb - 3.0 * P.child) * s
        self.shoulder = sh
        for sx in (-1, 1):
            parts.append(S.RoundCone((sx * 3.0 * s, 2.8 * s, -14.5 * s * z), (sx * sh, 2.2 * s, -21.5 * s * z), 4.0 * s, 5.0 * s))
            parts.append(S.RoundCone((sx * sh, 2.2 * s, -21.5 * s * z), (sx * (sh + 1.5), 2.6 * s, -40 * s * z), 5.0 * s, 4.6 * s))
        parts.append(S.Ellipsoid((0, 1.0 * s, -31.0 * s * z), ((sh + 0.5), 10.0 * s, 12.0 * s)))
        return S.Union(parts, 2.5)

    # ── Age ────────────────────────────────────────────────────────────────
    def _age_detail(self, face):
        P = self.P
        a = P.age_t
        if a <= 0.05:
            return face
        s = self.s
        E = self.eye_half
        ez = self.eye_z
        rng = np.random.default_rng(P.seed + 17)
        phase = rng.uniform(0, 6.28, 8).astype(F)

        def wrinkles(p):
            x, z = p[:, 0], p[:, 2]
            out = np.zeros(len(p), F)
            # Forehead lines: horizontal, gently curved, fading at the temples.
            fz = z - 0.018 * x * x
            m = S.gaussian(p, (0, -8.5 * s, 7.0 * s), (4.5, 5.0, 2.2))
            out += m * 0.05 * a * np.maximum(0, np.sin(fz * 6.2 + phase[0] + 0.5 * np.sin(x * 0.9 + phase[1]))) ** 3
            for sx in (-1, 1):
                # Crow's feet: fanning from the outer corner of each eye.
                q = p - np.array([sx * (E + 2.1), self.eye_y + 1.5, ez], F)
                ang = np.arctan2(q[:, 2], np.abs(q[:, 0]))
                r = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2)
                mm = S.gaussian(p, (sx * (E + 2.4), self.eye_y + 2.0, ez - 0.1), (1.4, 2.0, 1.4))
                out += mm * 0.035 * a * np.maximum(0, np.sin(ang * 9 + phase[2 + (sx > 0)])) ** 4 * np.clip(r / 0.8, 0, 1)
                # Lines under the lower lid.
                ml = S.gaussian(p, (sx * E, self.eye_y - 0.2, ez - 1.6), (1.4, 1.5, 0.5))
                out += ml * 0.03 * a * np.maximum(0, np.sin((z - ez) * 11 + phase[4])) ** 3
            # Frown lines between the brows.
            mg = S.gaussian(p, (0, -9.0 * s, 3.6 * s), (0.9, 1.5, 0.9))
            out += mg * 0.04 * a * np.maximum(0, np.sin(np.abs(x) * 9.0 + 1.2)) ** 4
            return -out

        return S.Offset(face, S.Fn(wrinkles, ((-9, -13, -8), (9, -3, 12))))
