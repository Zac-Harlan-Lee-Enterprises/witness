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
   On top of the relief, soft bumps and dents give the brow, eye sockets,
   cheekbones, temples, the bridge of the nose, lips, philtrum, the mouth
   line, the folds from nose to mouth, and the chin; the same bumps carry
   the expression (a smile raises the cheeks and the corners of the mouth,
   worry lifts the inner brows). A plane through the chin and the angles of
   the jaw cuts the jawline.
2. **Solid features.** The tip of the nose, the nostrils and the wings, the
   ears, and the neck are blended on as shapes.
3. **The lids.** A shell of skin over each eyeball (portrait_eyes.py draws
   the eyeballs), with the opening between the lids carved out, a crease,
   and a soft fold of skin above it, so lids, creases and corners come from
   the same field.

Finally, age and expression add wrinkles as a small displacement of the field.

Nothing is symmetric: each side has its own small offsets (portrait_params
`asym`), the nose may lean, and a smile may be stronger on one side.
"""
import math

import numpy as np

import portrait_sdf as S

F = np.float32
AXIS_Y = 1.5  # the relief's vertical axis, just behind the ear canals
LID_T = 0.26  # thickness of the eyelids at their margin (cm)


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


def _smooth01(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def _lip(v, peak, border, tail, r0=0.45):
    """A lip's forward bulge across its height: r0 at the mouth line (v=0),
    rising to 1 at `peak`, `border` of that at the edge of the red (v=1),
    then easing to nothing over `tail` (in lip heights) into the skin."""
    # The lips meet already full (they press together, they do not taper to
    # a groove), so only a soft crease runs between them.
    rise = r0 + (1 - r0) * np.sin(np.clip(v / peak, 0, 1) * (np.pi / 2)) ** 1.35
    mid = 1 - (1 - border) * np.clip((v - peak) / (1 - peak), 0, 1) ** 1.5
    t = np.clip(1 - (v - 1) / tail, 0, 1)
    fall = border * t * t * (3 - 2 * t)
    return np.where(v <= 1, rise * mid, fall) * (v >= 0)


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

    # ── Per side ───────────────────────────────────────────────────────────
    def asym(self, sx, key):
        """This side's small offset (sx -1 the person's right, +1 their left)."""
        return float(self.P.asym.get(key, 0.0)) * sx

    def smile_of(self, sx):
        """How much this side of the mouth smiles (a smile can be lopsided)."""
        P = self.P
        return max(0.0, P.smile * (1.0 + P.smile_asym * sx))

    # ── Landmarks ──────────────────────────────────────────────────────────
    def _landmarks(self):
        P = self.P
        m = P.masc  # 0 feminine … 1 masculine bone structure
        c = P.child  # 0 adult … 1 a small child
        fw = P.face_width
        fl = P.face_length
        self.s = s = P.scale
        self.body_z = 1.0 - 0.16 * c  # below the head, children are shorter
        mb = m * (1 - c)  # adult masculine features (brow, jaw, larynx)
        self.mb = mb
        # The mid-face, and still more the lower face, grow most between
        # childhood and adulthood.
        lower = fl * P.lower_face * (1.0 - 0.26 * c) * (1.0 - 0.05 * (1 - m) * (1 - c)) * 0.96
        mid = fl * (1.0 - 0.13 * c)
        self.lower = lower
        self.eye_half = (3.15 + P.eye_spacing * 0.22) * s * (1.0 - 0.05 * c)
        self.eye_z = 1.6 * s
        self.eye_r = 1.2 * (1.0 - 0.03 * c)
        self.eye_y = -7.15 * s - 0.22 * P.eye_depth + 0.1 * c
        self.brow = (0.2 + 0.8 * mb) * P.brow_ridge  # brow-ridge strength
        self.glabella = np.array([0, -9.5 * s - 0.35 * self.brow + 0.3 * c, 4.4 * s], F)
        self.nasion = np.array([0, -9.0 * s - 0.25 * self.brow + 0.5 * c - 0.3 * P.bridge, 3.05 * s + 0.15 * P.bridge - 0.25 * c], F)
        # Nose. Women's and children's noses are shorter and project less.
        nl = P.nose_length * mid * (0.87 + 0.13 * m) * (1.0 - 0.08 * c)
        self.nl = nl
        self.subnasale_z = self.nasion[2] - 5.45 * nl
        proj = P.nose_projection * (1.0 - 0.35 * c) * (0.68 + 0.32 * m)
        self.proj = proj
        rot = P.tip_rotation
        dev = P.nose_deviation
        self.tip = np.array([dev, -10.35 * s - 1.7 * proj + 0.35 * c + 0.12 * max(rot, 0.0), self.subnasale_z + (1.0 + 0.1 * (1 - m)) * nl + 0.26 * rot], F)
        self.subnasale = np.array([0.3 * dev, -10.0 * s - 0.2 * proj + 0.2 * c, self.subnasale_z], F)
        self.nose_w = P.bridge_width * (1.0 - 0.12 * c) * (0.88 + 0.14 * m)
        self.tip_w = P.tip_width * (1.0 - 0.1 * c) * (0.86 + 0.14 * m)
        self.alar_half = 1.75 * P.alar_width * (1.0 - 0.15 * c) * (0.87 + 0.13 * m) * s
        # Mouth.
        mz = self.subnasale_z - 2.05 * lower
        self.stomion = np.array([0, -9.75 * s - 0.2 * P.lip_projection + 0.2 * c, mz], F)
        self.mouth_half = (2.45 + 0.1 * m) * s * P.mouth_width * (1.0 - 0.1 * c) * (1.0 + 0.07 * P.smile)
        # Chin and jaw.
        chin_z = mz - (4.75 * lower) * (0.95 + 0.07 * mb)
        self.menton = np.array([0, -8.4 * s - 0.3 * P.chin + 0.4 * c, chin_z], F)
        self.pogonion = np.array([0, -9.75 * s - 0.45 * P.chin + 0.5 * c, chin_z + 1.45 * (1 - 0.1 * c)], F)
        # A narrower jaw for women; the angle a little higher.
        jaw = (4.9 * P.jaw_width + 0.35 * mb - 0.3 * c) * (0.9 + 0.1 * m)
        self.gonion = np.array([jaw * s * fw, -0.2 * s, chin_z + 3.6 * lower + 0.3 * c + 0.3 * (1 - m) + 0.3 * P.jaw_angle], F)
        self._nose_tables()
        self._lip_sizes()

    def _nose_tables(self):
        """The line of the bridge (y at each z), its width and profile."""
        P = self.P
        n = self.nasion
        t = self.tip
        sn = self.subnasale
        nl = self.nl
        st = np.array([t[1] + 0.42, t[2] + 0.82 * nl], F)  # the supratip: where the bridge meets the tip
        self.supratip = st
        N = np.array([n[1], n[2]], F)

        def along(f):
            return N + (st - N) * f

        rh = along(0.44)
        sc = along(0.3)
        knots = [
            (n[2] + 1.2, n[1] + 0.6),
            (n[2], n[1]),
            (sc[1], sc[0] + 0.2 * P.nose_scoop),
            (rh[1], rh[0] - 0.24 * P.nose_hump),
            (along(0.72)[1], along(0.72)[0] - 0.08 * P.nose_hump + 0.05 * P.nose_scoop),
            (st[1], st[0]),
            (t[2], t[1] + 0.62),
            (sn[2] + 0.1, sn[1] - 0.1),
            (sn[2] - 1.0, sn[1] + 1.0),
        ]
        self.rhinion_z = float(rh[1])
        self.dz, self.dy = pchip_table(knots, lo=float(sn[2] - 1.2), hi=float(n[2] + 1.4), step=0.01, smooth=0.12)
        w = self.nose_w
        wk = [
            (n[2] + 1.2, 1.2 * w),
            (n[2], 1.12 * w),
            (rh[1], 1.22 * w),
            (st[1], 1.38 * w * (0.9 + 0.1 * self.tip_w)),
            (t[2], 1.5 * w * (0.9 + 0.1 * self.tip_w)),
            (sn[2], 0.95 * self.alar_half),
            (sn[2] - 1.0, 0.95 * self.alar_half),
        ]
        _, self.dB = pchip_table(wk, lo=float(sn[2] - 1.2), hi=float(n[2] + 1.4), step=0.01, smooth=0.1)
        pk = [(n[2] + 1.2, 2.2), (n[2], P.bridge_round * 0.85), (rh[1], P.bridge_round), (st[1], 2.5), (sn[2] - 1.0, 2.2)]
        _, self.dP = pchip_table(pk, lo=float(sn[2] - 1.2), hi=float(n[2] + 1.4), step=0.01, smooth=0.1)

    def _lip_sizes(self):
        P = self.P
        s = self.s
        age = P.age_t
        press = P.press
        fu = P.lip_upper
        fo = P.lip_lower
        smile = P.smile
        # Heights of the red of each lip at the middle, and how far each rolls out.
        self.up_h = (0.66 + 0.3 * fu) * s * (1 - 0.3 * press) * (1 - 0.12 * smile)
        self.lo_h = (0.8 + 0.36 * fo) * s * (1 - 0.3 * press) * (1 - 0.08 * smile)
        c = P.child
        self.up_amp = (0.3 + 0.24 * fu) * s * (1 - 0.35 * press) * (1 - 0.25 * smile) * (1 - 0.15 * age) * (1 - 0.35 * c)
        self.lo_amp = (0.38 + 0.3 * fo) * s * (1 - 0.3 * press) * (1 - 0.1 * smile) * (1 - 0.1 * age) * (1 - 0.3 * c)
        self.bow_h = (0.07 + 0.12 * P.bow) * s * (1 - 0.5 * P.child)

    # ── The line of the mouth, and the lips ────────────────────────────────
    def mouth_line(self, u):
        """z of the line between the lips at lateral distance u (signed, cm):
        a little lower at the corners, with the tubercle of the upper lip
        pressing down in the middle, and the corners lifted by a smile."""
        P = self.P
        st = self.stomion
        mw = self.mouth_half
        au = np.abs(u)
        k = np.clip(au / mw, 0, 1.3)
        zl = st[2] - 0.06 * k**2 - 0.05 * _g(u / 0.4)
        left = np.clip(np.sign(u) + 0.0, -1, 1)
        smile = P.smile * (1.0 + P.smile_asym * left)
        smile = np.maximum(smile, 0.0)
        zl = zl + (0.5 * smile - 0.3 * P.mouth_down) * k**2 + 0.22 * smile * k**4
        zl = zl + float(P.asym.get("mouth_z", 0.0)) * left * k**2
        return zl.astype(F)

    def lip_borders(self, u):
        """(line between the lips, upper border, lower border) at lateral u."""
        mw = self.mouth_half
        au = np.abs(u)
        k = np.clip(1 - (u / mw) ** 2, 0, 1)
        zl = self.mouth_line(u)
        # The Cupid's bow: two peaks either side of a dip over the philtrum.
        bow = self.bow_h * (_g((au - 0.27 * mw) / 0.22) - 0.55 * _g(au / 0.17))
        top = zl + self.up_h * k**0.55 + bow * k
        bot = zl - self.lo_h * k**0.55
        return zl, top, bot

    def lip_mask(self, p, soft=0.06):
        """How much each point is on the red of the lips (0-1), from the same
        geometry that sculpts them."""
        st = self.stomion
        mw = self.mouth_half
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        k = np.clip(1 - (x / (mw * 1.02)) ** 2, 0, 1)
        _, top, bot = self.lip_borders(x)
        inside = np.minimum(top - z, z - bot)
        front = np.clip((-(y - st[1]) + 1.2) / 0.6, 0, 1)
        return (np.clip(inside / soft + 0.5, 0, 1) * (k > 0) * front).astype(F)

    # ── Brows ──────────────────────────────────────────────────────────────
    def brow_z(self, sx, u):
        """Height of the middle of the eyebrow at lateral distance u (>= 0)
        on side sx, with the expression: worry lifts the inner ends, a frown
        draws them down, interest lifts the tails."""
        P = self.P
        s = self.s
        E = self.eye_half
        ez = self.eye_z + self.asym(sx, "eye_z")
        inner, outer = 0.85 * s, E + 2.3 * s
        t = (u - inner) / (outer - inner)
        tc = np.clip(t, 0, 1)
        arch = 0.3 + 0.5 * P.brow_arch
        z = ez + (1.45 + 0.25 * P.brow_height + arch * np.sin(tc * math.pi * 0.8) - 0.75 * np.clip(t - 0.7, 0, 1)) * s
        z = z + 0.85 * P.brow_inner * _g((u - 1.0) / 1.5) + 0.55 * P.brow_outer * _g((u - 4.3) / 1.8)
        z = z + (0.14 * P.brow_asym + self.asym(sx, "brow_z")) * sx * (0.5 + 0.5 * tc)
        return z.astype(F)

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
        fore = 0.3 * c + 0.2 * (1 - P.masc) - 0.25 * P.forehead  # rounder, more upright foreheads
        jf = 0.93 + 0.07 * P.masc  # a narrower lower jaw for women and children
        cw = P.chin_width
        # Above the top row the relief continues straight up; the dome of the
        # skull (an ellipsoid, see _build) closes it.
        rows = [
            (11.0 * s, (-6.3 - 0.3 * fore) * s, 6.0 * s, 1.95, 8.2 * s),
            (9.5 * s, (-8.0 - 0.4 * fore) * s, 7.1 * s, 2.0, 9.6 * s),
            (8.0 * s, (-8.85 - 0.3 * fore) * s, 7.35 * s, 2.08, 10.3 * s),
            (6.0 * s, (-9.3 - 0.1 * fore) * s, 7.45 * s, 2.18, 10.45 * s),
            (g[2], g[1] + 0.2 * self.brow, 7.3 * s, 2.3, 10.3 * s),
            (n[2] + 0.1, n[1] - 0.05, 7.1 * s, 2.35, 10.0 * s),
            (self.eye_z, -8.45 * s + 0.1 * c, 7.1 * s, 2.4, 9.6 * s),
            (self.eye_z + 0.33 * (sn[2] - self.eye_z), -8.4 * s + 0.15 * c, 7.2 * fw * s, 2.3, 9.1 * s),
            (self.eye_z + 0.72 * (sn[2] - self.eye_z), -8.75 * s + 0.1 * c, 7.05 * fw * s, 2.1, 8.4 * s),
            (sn[2], sn[1] + 0.25, 6.7 * fw * s, 1.9, 7.4 * s),
            (sn[2] - 0.7, sn[1] - 0.05, 6.45 * fw * s, 1.88, 7.0 * s),
            (st[2] + 0.62, st[1] - 0.2, 6.3 * fw * s, 1.9, 6.6 * s),
            (st[2], st[1] + 0.05, 6.2 * fw * s, 1.95, 6.3 * s),
            (st[2] - 0.7, st[1] + 0.05, 6.1 * fw * s, 2.0, 6.1 * s),
            (st[2] - 1.6, st[1] + 0.4 - 0.15 * c, (5.95 + 0.1 * mb + 0.2 * c) * fw * jf * s, 1.95 + 0.1 * mb, 6.0 * s),
            ((st[2] + po[2]) / 2 - 0.5, po[1] + 0.2, (5.85 + 0.15 * mb + 0.25 * c) * fw * jf * s, 2.0 + 0.15 * mb * cw, 5.9 * s),
            (po[2], po[1], (5.7 + 0.2 * mb + 0.2 * c) * fw * jf * s, (2.05 + 0.15 * mb) * cw, 5.9 * s),
            (me[2] + 0.6, po[1] + 0.45, (5.4 + 0.15 * mb) * fw * jf * s, 2.05 * cw, 5.9 * s),
            (me[2] - 0.4, me[1] + 0.3, 5.2 * fw * s, 2.0, 5.9 * s),
            (me[2] - 2.0, me[1] + 1.8, 5.2 * s, 2.0, 6.0 * s),
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
        n = self.nasion
        sn, st, po = self.subnasale, self.stomion, self.pogonion
        mw = self.mouth_half
        crease = (0.12 + 0.5 * age + 0.1 * mb - 0.1 * c) * (1 + 1.4 * P.smile)
        naso = []
        ah = self.alar_half
        for sx in (-1, 1):
            corner = mw * (1 + 0.05 * self.smile_of(sx))
            naso.append([(sx * (ah + 0.05), sn[2] + 0.6), (sx * (ah + 0.65), sn[2] - 0.55), (sx * (corner + 0.55), st[2] - 0.1), (sx * (corner + 0.45), st[2] - 1.8)])
        nose_lo = float(self.dz[0])
        nose_hi = float(self.dz[-1])
        nose_top = n[2] + 0.35

        def table(tab, z):
            return np.interp(z, tz, tab).astype(F)

        def nose_bridge(u, z, Dz):
            """The bridge of the nose as relief: a ridge with a rounded top and
            sloping sides that ease into the cheeks, from the root of the nose
            down onto the tip."""
            out = np.zeros_like(z)
            m = (z > nose_lo) & (z < nose_hi) & (np.abs(u) < 3.5)
            if not m.any():
                return out
            zz, uu, DD = z[m], u[m], Dz[m]
            yd = np.interp(zz, self.dz, self.dy)
            H = np.clip((AXIS_Y - yd) - DD, 0, None) * _smooth01((nose_top - zz) / 0.7)
            Bz = np.interp(zz, self.dz, self.dB)
            pz = np.interp(zz, self.dz, self.dP)
            # The nose may lean a little, more toward the tip.
            lean = P.nose_deviation * np.clip((n[2] - zz) / max(n[2] - self.tip[2], 1e-3), 0, 1.2) ** 1.5
            t = np.clip(np.abs(uu - lean) / Bz, 0, 1)
            out[m] = H * (1 - t**pz) ** 2
            return out

        def features(th, z, Dz):
            u = th * Dz  # lateral distance along the face (cm)
            out = np.zeros_like(z)
            au = np.abs(u)
            # Brow ridge (strong in men), and a child's rounded forehead.
            out += (0.15 + 0.55 * self.brow) * _g((z - (4.05 * s - 0.018 * u * u)) / 0.85) * _g(au / 5.2) ** 2
            out += 0.22 * c * _g((au - 2.9) / 1.9) * _g((z - 8.0 * s) / 2.2)
            for sx in (-1, 1):
                side = (u * sx) > -0.5
                es = self.asym(sx, "eye_z")
                ezs = ez + es
                sm = self.smile_of(sx)
                # Eye sockets: deepest up and in, under the brow.
                out -= (1.05 + 0.2 * P.eye_depth) * _g((u - sx * E * 1.05) / 1.55) * _g((z - ezs - 0.1) / 1.3)
                out -= (0.3 + 0.15 * P.eye_depth) * _g((u - sx * (E * 0.8)) / 0.9) * _g((z - ezs - 0.9) / 0.8)
                # The soft pad of the eyebrow moves with it.
                bz = self.brow_z(sx, au)
                out += 0.14 * _g((z - bz + 0.1) / 0.55) * _g((u - sx * E) / 2.0) * side
                # Cheekbones, and the hollow beneath them in lean faces.
                cb = (0.3 + 0.3 * P.cheekbone + 0.1 * mb + 0.1 * fat) * (1 - 0.6 * c) + self.asym(sx, "cheek")
                out += cb * _g((u - sx * 4.75 * s) / 1.45) * _g((z + 0.15) / 1.15)
                out -= 0.3 * max(0.0, 0.6 - fat) * (1 - c) * (0.35 + 0.65 * P.masc) * _g((u - sx * 4.6 * s) / 1.4) * _g((z + 3.0) / 1.3)
                # Temples.
                out -= (0.4 + 0.15 * age) * (0.55 + 0.45 * P.masc) * _g((u - sx * 7.0 * s) / 1.3) * _g((z - 3.5 * s) / 1.6)
                # The jaw muscle at the angle of the jaw.
                out += (0.25 * mb + self.asym(sx, "jaw")) * _g((u - sx * 9.0) / 1.8) * _g((z + 5.5) / 1.8)
                # The cheeks beside the mouth: everyone has some; fuller in
                # children, women and round faces; they fall with age.
                cheek = 0.4 + 0.45 * c + 0.45 * max(0.0, fat - 0.2) + 0.15 * (1 - P.masc) - 0.15 * age
                out += cheek * _g((u - sx * (4.1 + 0.3 * c)) / (1.7 + 0.5 * c)) * _g((z - st[2] - 1.2 - 0.6 * c + 0.8 * age) / (2.0 + 0.4 * c))
                # A smile lifts and rounds the cheeks above the fold …
                out += 0.8 * sm * (1 - 0.6 * c) * _g((u - sx * 3.5) / 1.3) * _g((z - st[2] - 2.8) / 1.25)
                # … and a smiling eye pushes the lower lid up into a soft roll.
                out += 0.16 * P.eyes_smile * _g((u - sx * E) / 1.0) * _g((z - ezs + 1.05) / 0.35)
                # Under the eyes: a little fullness, more with age, and the
                # groove below it running down from the inner corner.
                out += 0.16 * P.bags * _g((u - sx * E * 1.02) / 1.05) * _g((z - ezs + 1.2) / 0.42)
                trough = _seg_dist(u, z, [(sx * (E - 1.6), ezs - 0.9), (sx * (E - 0.3), ezs - 1.9), (sx * (E + 1.2), ezs - 2.1)])
                out -= (0.04 + 0.12 * P.bags) * (1 - c) * _g(trough / 0.35)
                # The soft fold of skin above the lid crease, fuller toward the
                # temple (hooding): heavier with age and weariness.
                hood = max(0.0, P.lid_hood + 0.35 * P.lid_droop)
                out += (0.03 + 0.2 * hood) * _g((u - sx * (E * 1.06 + 0.25 * hood)) / 1.25) * _g((z - ezs - 1.12 + 0.12 * hood) / 0.42)
                # Age: hollow temples and cheeks, and jowls.
                if age > 0.05:
                    out -= 0.3 * age * _g((u - sx * 6.8 * s) / 1.4) * _g((z - 3.0 * s) / 1.8)
                    out -= 0.3 * age * _g((u - sx * 4.8 * s) / 1.3) * _g((z + 2.6) / 1.2)
                    out += 0.4 * age * _g((u - sx * 4.4 * s) / 1.4) * _g((z - self.menton[2] - 2.3) / 1.2)
                # The corners of the mouth: a small hollow at the corner and the
                # knot of muscle just outside it.
                corner_z = float(self.mouth_line(np.array([sx * mw], F))[0])
                out -= (0.18 + 0.16 * sm) * _g((u - sx * mw) / (0.22 + 0.08 * sm)) * _g((z - corner_z) / 0.22)
                out += (0.07 + 0.12 * sm) * _g((u - sx * (mw + 0.55)) / 0.45) * _g((z - corner_z - 0.1) / 0.5)
                # Turned-down corners pull a soft bulge below them.
                out += 0.1 * P.mouth_down * _g((u - sx * (mw + 0.2)) / 0.5) * _g((z - corner_z + 0.8) / 0.6)
            # The bridge of the nose.
            out += nose_bridge(u, z, Dz)
            # Nasolabial folds: a crease, with the cheek slightly fuller outside it.
            for sx, pts in zip((-1, 1), naso):
                d = _seg_dist(u, z, pts)
                fade = np.clip((z - pts[3][1]) / 1.4, 0, 1)
                edge = np.interp(z, [pts[3][1], pts[1][1]], [abs(pts[3][0]), abs(pts[1][0])])
                side = 1.0 / (1.0 + np.exp(-((u * sx) - edge) / 0.25))
                out -= crease * 0.22 * _g(d / 0.3) * fade
                out += crease * 0.3 * _g(d / 0.9) * side * fade
            # Lips.
            m = (au < mw * 1.35) & (z > st[2] - 3.2) & (z < sn[2] + 0.5)
            if m.any():
                out[m] += self._lips(u[m], z[m])
            # Chin: the mental protuberance, a cleft for some, and the bulge
            # of pressed lips.
            out += (0.3 + 0.2 * P.chin) * _g(u / ((1.4 + 0.5 * mb) * P.chin_width)) * _g((z - po[2]) / 1.1)
            out -= 0.12 * P.chin_cleft * _g(u / 0.25) * _g((z - po[2]) / 0.8)
            out += 0.12 * P.press * _g(u / 1.2) * _g((z - po[2] - 1.1) / 0.7)
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

    def _lips(self, u, z):
        """The lips' forward bulge (cm) at lateral u and height z."""
        P = self.P
        mw = self.mouth_half
        au = np.abs(u)
        k = np.clip(1 - (u / mw) ** 2, 0, 1)
        zl, top, bot = self.lip_borders(u)
        out = np.zeros_like(z)
        hu = np.maximum(top - zl, 0.05)
        hl = np.maximum(zl - bot, 0.05)
        v = (z - zl) / hu
        cu = self.up_amp * k**1.1
        cl = self.lo_amp * k**1.25
        # Both lips start from the same fullness where they meet, so the
        # surface is continuous across the mouth line.
        c0 = 0.45 * 0.5 * (cu + cl)
        # Upper lip: its most forward point is near its border, so the red
        # faces down and forward; above the border the skin slopes back to
        # the nose.
        out += cu * _lip(v, 0.82, 0.93, 1.5, np.minimum(1.0, c0 / np.maximum(cu, 1e-6)))
        out += (0.03 + 0.02 * P.bow) * (1 - 0.8 * P.child) * _g((v - 1.0) / 0.1) * k  # the raised border (white roll)
        # Lower lip: fullest in its upper half (it catches the light), turning
        # under into the groove above the chin.
        v2 = (zl - z) / hl
        out += cl * _lip(v2, 0.42, 0.62, 0.95, np.minimum(1.0, c0 / np.maximum(cl, 1e-6))) * (v2 > 0)
        # The line between the lips.
        out -= 0.11 * _g((z - zl) / 0.07) * np.clip((1.02 - au / mw) / 0.12, 0, 1)
        # Philtrum: a groove with a ridge either side.
        sn = self.subnasale
        top_ph = sn[2] - 0.2
        bot_ph = self.stomion[2] + self.up_h * 0.95
        win = np.clip((top_ph - z) / 0.25, 0, 1) * np.clip((z - bot_ph) / 0.2, 0, 1)
        out -= (0.06 + 0.1 * P.philtrum) * _g(u / 0.3) * win
        out += (0.04 + 0.05 * P.philtrum) * _g((au - 0.5) / 0.2) * win
        return out

    # ── The field ──────────────────────────────────────────────────────────
    def _build(self):
        # The dome of the skull closes the relief above the forehead.
        s = self.s
        c = self.P.child
        ellipsoid = S.Ellipsoid((0, 0.95 * s, 2.0 * s + 0.4 * c), (10.0 * s * (1 + 0.02 * c), 11.9 * s, (11.35 + 0.5 * c) * s))

        def dome(p):
            # Only above the forehead: lower down it would cut into the face.
            return ellipsoid(p) - np.clip((8.5 * s - p[:, 2]) / 1.5, 0, 1) * 30.0

        face = S.Intersect(self._relief(), S.Fn(dome, ellipsoid.bbox), 1.2)
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

        face = S.Intersect(face, S.Fn(below_jaw), 0.9 + 0.35 * self.P.fullness + 0.4 * c + 0.45 * (1 - self.P.masc) * (1 - c))
        # Nose: the tip blends into the bridge; the wings keep a crease.
        body, wings = self._nose()
        c = self.P.child
        face = S.Union([face, body], 0.42 + 0.25 * c)
        face = S.Union([face, wings], 0.22 + 0.2 * c)
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
        # Age and expression: wrinkles, as a small displacement of the field.
        return self._wrinkles(face)

    def _nose(self):
        """(the tip and columella; the wings): the wings join the face with a crease."""
        s = self.s
        t = self.tip
        sn = self.subnasale
        w = self.tip_w
        P = self.P
        parts = []
        # The tip lobule, with a faint pair of domes, a smaller, finer tip for women.
        tl = (0.82 + 0.18 * P.masc) * (1 - 0.22 * P.child)
        parts.append(S.Ellipsoid(t + np.array([0, 0.74, -0.12], F), (0.9 * w * tl, 0.78 * tl, 0.72 * tl)))
        for sx in (-1, 1):
            parts.append(S.Sphere(t + np.array([sx * 0.3 * w, 0.44, 0.0], F), 0.4 * w * tl))
        # Columella: the strut under the tip, down to the lip.
        parts.append(S.RoundCone(t + np.array([0, 0.6, -0.52], F), sn + np.array([0, -0.06, 0.14], F), 0.28 * w, 0.32 * w))
        body = S.Union(parts, 0.38 * s)
        wings = []
        ah = self.alar_half
        fl = P.alar_flare
        wl = (0.86 + 0.14 * P.masc) * (1 - 0.3 * P.child)
        for sx in (-1, 1):
            # Each wing curves from its base on the face forward to the tip.
            base = np.array([sx * ah + 0.3 * t[0], sn[1] + 1.0, sn[2] + 0.42], F)
            front = t + np.array([sx * 0.74 * w, 0.8, -0.28], F)
            wings.append(S.RoundCone(base, front, 0.44 * wl, 0.38 * wl))
            wings.append(S.Ellipsoid((sx * (ah - 0.14 * fl) + 0.3 * t[0], sn[1] + 0.58, sn[2] + 0.52), (0.44 * wl * fl, 0.62 * wl, 0.48 * wl)))
        return body, S.Union(wings, 0.25)

    def _nostrils(self, face):
        """Openings on the underside, between the columella and the wings."""
        t = self.tip
        sn = self.subnasale
        ah = self.alar_half
        c = self.P.child
        holes = []
        for sx in (-1, 1):
            nf = 1.0 - 0.15 * c  # smaller, rounder, further back on a child's short nose
            cx = sx * (0.28 + 0.2 * ah) + 0.5 * t[0]
            c_ = (cx, max((t[1] + sn[1]) / 2 + 0.62, sn[1] - 0.05) + 0.12 * c, sn[2] + 0.2)
            wide = 0.24 + 0.05 * (ah - 1.6)
            holes.append(S.Ellipsoid(c_, (wide * nf, 0.42 * nf, 0.22 * nf), S.rot(yaw=sx * 20, pitch=-20 - 12 * self.P.tip_rotation)))
        return S.Subtract(face, S.Union(holes), 0.1)

    # ── Eyelids ────────────────────────────────────────────────────────────
    def eye_centre(self, sx):
        return np.array([sx * self.eye_half, self.eye_y, self.eye_z + self.asym(sx, "eye_z")], F)

    def fissure(self, sx):
        """The opening between the lids, in the eye's angles (radians):
        (medial, lateral, upper(u), lower(u)) with u from -1 (medial) to 1 (lateral)."""
        P = self.P
        c = P.child
        open_ = P.eye_open + self.asym(sx, "eye_open")
        # Weary lids hang lower; smiling and squinting eyes narrow from below.
        up = math.radians(16.0 + 4.0 * open_ + 3.0 * c - 10.0 * P.lid_droop - 3.0 * P.squint - 2.0 * P.eyes_smile)
        lo = math.radians(-21.0 - 3.0 * open_ - 2.0 * c + 6.0 * P.squint + 7.0 * P.eyes_smile * (1 - 0.5 * c))
        tilt = math.radians(P.canthal_tilt)
        worry = math.radians(3.0) * max(0.0, P.brow_inner)  # lifted inner brows lift the inner lid

        def upper(u):
            k = u + 0.22 * (1 - u * u)  # the highest point toward the nose
            base = up * np.clip(1 - k * k, 0, None) ** 0.62 + tilt * u * 0.5
            return base + worry * np.clip(-u, 0, 1) * (1 - u * u)

        def lower(u):
            k = u - 0.18 * (1 - u * u)  # the lowest point toward the temple
            return lo * np.clip(1 - k * k, 0, None) ** 0.8 + tilt * u * 0.5

        w = P.eye_width
        return math.radians(-63 - 2.0 * w), math.radians(74 + 3.0 * w - 2 * c), upper, lower

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
            crease_h = (0.58 + 0.16 * P.eye_open - 0.18 * P.age_t) * P.crease + 0.12 * max(0.0, P.brow_inner) + 0.1 * P.brow_outer
            # The lids: skin over the eyeball, blended into the socket.
            face = S.Union([face, S.Sphere(E, R + t)], 0.5)
            # The lid crease above the upper lid: a fine groove.
            pts = []
            for u in np.linspace(-0.8, 0.95, 25):
                a = (a_med + a_lat) / 2 + u * (a_lat - a_med) / 2
                b = float(upper(np.array(u))) + crease_h / (R + t) * (1 - 0.3 * u * u)
                d = np.array([math.sin(a) * math.cos(b) * sx, -math.cos(a) * math.cos(b), math.sin(b)], F)
                pts.append((E + d * (R + t + 0.02), 0.06 + 0.03 * P.age_t))
            face = S.Subtract(face, S.Chain(pts, 0.06), 0.1)
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
                return np.maximum(np.maximum(d2, R * 0.55 - r), r - (R + t + 0.5))

            box = (E - np.array([3.0, 3.0, 2.5], F), E + np.array([3.0, 3.0, 2.5], F))
            face = S.Subtract(face, S.Fn(opening, box), 0.08)
        return face

    # ── Ears ───────────────────────────────────────────────────────────────
    def _ears(self):
        s = self.s * self.P.ear_size * (1 + 0.1 * self.P.age_t)
        ears = []
        for sx in (-1, 1):
            base = np.array([sx * 6.75 * self.s, 0.7 * self.s, 0.3 * self.s + self.asym(sx, "ear_z")], F)
            out_k = 0.32 + 0.12 * self.P.ear_out

            def tf(y, z, out, sx=sx, base=base, out_k=out_k):
                # Ear plane: y back, z up, tilted back 15 degrees, flaring out behind.
                a = math.radians(15)
                yy = y * math.cos(a) + z * math.sin(a)
                zz = -y * math.sin(a) + z * math.cos(a)
                flare = out_k * max(0.0, yy)
                return base + np.array([sx * (out + flare), yy, zz], F)

            disc = S.Ellipsoid(tf(1.3 * s, 0.1 * s, 0.35), (0.42, 1.75 * s, 3.0 * s), S.rot(yaw=sx * (20 + 8 * self.P.ear_out)))
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
        return (5.1 + 0.9 * self.mb - 0.7 * self.P.child) * self.s

    def _neck(self):
        s = self.s
        nr = self._neck_radius()
        z = self.body_z
        neck = S.RoundCone((0, 0.6 * s, -3.0 * s), (0, 1.2 * s, -19.0 * s * z), nr * 0.97, nr * 1.05)
        parts = [neck]
        # Sternocleidomastoids: from behind the ear to the top of the breastbone.
        for sx in (-1, 1):
            parts.append(S.RoundCone((sx * 5.2 * s, 1.8 * s, -3.0 * s), (sx * 1.3 * s, -4.4 * s, -18.5 * s * z), (1.15 - 0.25 * self.P.child) * s, (1.05 - 0.2 * self.P.child) * s))
        if self.mb > 0.5:
            parts.append(S.Ellipsoid((0, -4.6 * s, -12.5 * s), (0.7, 0.6, 1.1)))
        return S.Clip(S.Union(parts, 1.4), (-12, -12, -19.0 * s * z), (12, 12, 2))

    def body(self):
        """Neck base, shoulders and chest: what the clothes rest on. The
        shoulders slope from the neck along the trapezius; the collarbones
        and the notch between them show at the neckline."""
        P = self.P
        s = self.s
        z = self.body_z  # children's necks are shorter
        nr = self._neck_radius()
        parts = [S.RoundCone((0, 1.0 * s, -9.0 * s * z), (0, 1.8 * s, -22.0 * s * z), nr * 0.98, nr * 1.08)]
        sh = (17.5 + 2.5 * self.mb - 3.5 * P.child) * s
        self.shoulder = sh
        for sx in (-1, 1):
            # Trapezius: from the side of the neck down to the point of the shoulder.
            parts.append(S.RoundCone((sx * 3.0 * s, 2.8 * s, -14.0 * s * z), (sx * sh, 2.2 * s, -21.5 * s * z), 4.0 * s, 5.0 * s))
            parts.append(S.RoundCone((sx * sh, 2.2 * s, -21.5 * s * z), (sx * (sh + 1.5), 2.6 * s, -40 * s * z), 5.0 * s, 4.6 * s))
            # Collarbone: from the notch out to the shoulder, just under the skin.
            parts.append(S.RoundCone((sx * 2.2 * s, -4.2 * s, -19.8 * s * z), (sx * (sh - 3.5), -1.8 * s, -21.0 * s * z), 0.75 * s, 0.65 * s))
        parts.append(S.Ellipsoid((0, 1.0 * s, -31.0 * s * z), ((sh + 0.5), 10.0 * s, 12.0 * s)))
        chest = S.Union(parts, 2.2)
        # The notch at the top of the breastbone, between the collarbones.
        notch = S.Ellipsoid((0, -5.6 * s, -19.6 * s * z), (1.2 * s, 1.0 * s, 1.0 * s))
        return S.Subtract(chest, notch, 0.8)

    # ── Wrinkles: age and expression ───────────────────────────────────────
    def _wrinkles(self, face):
        P = self.P
        a = P.age_t
        sun = P.sun
        c = P.child
        # Lines deepen with age and with a life in the sun; expressions make
        # their own lines even in young faces (crow's feet with a smile, a
        # furrowed forehead with lifted brows).
        crow = (0.4 * a + 0.12 * sun * (1 - c) + 0.35 * P.eyes_smile + 0.2 * P.squint) * (1 - 0.8 * c)
        fore = (0.45 * a + 0.1 * sun + 0.5 * max(0.0, P.brow_inner) + 0.35 * max(0.0, P.brow_outer)) * (1 - 0.85 * c)
        frown = (0.3 * a + 0.8 * max(0.0, -P.brow_inner) + 0.15 * sun) * (1 - 0.9 * c)
        under = (0.35 * a + 0.1 * P.eyes_smile) * (1 - c)
        lips = 0.5 * max(0.0, a - 0.35) * (1 - c)
        s = self.s
        E = self.eye_half
        ez = self.eye_z
        rng = np.random.default_rng(P.seed + 17)
        phase = rng.uniform(0, 6.28, 12).astype(F)
        st = self.stomion
        mw = self.mouth_half
        # No face is perfectly smooth: soft irregularities a fraction of a
        # millimetre deep over a few centimetres (less on the lips and lids,
        # none on a child's smooth cheeks).
        dirs = rng.normal(size=(16, 3)).astype(F)
        dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
        waves = (2 * math.pi / rng.uniform(1.1, 3.6, 16)).astype(F)
        phs = rng.uniform(0, 2 * math.pi, 16).astype(F)
        irr = (0.012 + 0.018 * a + 0.01 * sun) * (1 - 0.7 * c) / math.sqrt(16)
        eyes = [self.eye_centre(sx) for sx in (-1, 1)]

        def wrinkles(p):
            x, z = p[:, 0], p[:, 2]
            out = np.zeros(len(p), F)
            bumpy = np.zeros(len(p), F)
            for d, k, ph in zip(dirs, waves, phs):
                bumpy += np.sin(k * (p @ d) + ph)
            quiet = 1 - 0.8 * S.gaussian(p, st, (mw * 1.1, 1.5, 0.9))
            for e in eyes:
                quiet *= 1 - 0.7 * S.gaussian(p, e, (1.5, 1.8, 1.0))
            out += irr * bumpy * quiet
            # Forehead lines: horizontal, gently curved, broken, fading at the
            # temples; worry concentrates them in the middle.
            fz = z - 0.018 * x * x - 0.02 * max(0.0, P.brow_inner) * np.abs(x) ** 1.5
            m = S.gaussian(p, (0, -8.5 * s, 7.0 * s), (4.2 - 1.2 * max(0.0, P.brow_inner), 5.0, 2.2))
            broken = 0.6 + 0.4 * np.sin(x * 1.3 + phase[5]) * np.sin(x * 0.7 + phase[6])
            out += m * 0.06 * fore * broken * np.maximum(0, np.sin(fz * 5.8 + phase[0] + 0.5 * np.sin(x * 0.9 + phase[1]))) ** 3
            for sx in (-1, 1):
                ezs = ez + self.asym(sx, "eye_z")
                # Crow's feet: fanning from the outer corner of each eye.
                q = p - np.array([sx * (E + 2.0), self.eye_y + 1.5, ezs], F)
                ang = np.arctan2(q[:, 2], np.abs(q[:, 0]))
                r = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2)
                mm = S.gaussian(p, (sx * (E + 2.4), self.eye_y + 2.0, ezs - 0.1), (1.5, 2.0, 1.5))
                out += mm * 0.045 * crow * np.maximum(0, np.sin(ang * 9 + phase[2 + (sx > 0)] + 0.3 * r)) ** 4 * np.clip(r / 0.7, 0, 1)
                # Lines under the lower lid.
                ml = S.gaussian(p, (sx * E, self.eye_y - 0.2, ezs - 1.6), (1.4, 1.5, 0.5))
                out += ml * 0.03 * under * np.maximum(0, np.sin((z - ezs) * 11 + phase[4])) ** 3
            # Frown lines between the brows, and a crossing line at the root of the nose.
            mg = S.gaussian(p, (0, -9.0 * s, 3.8 * s), (0.9, 1.5, 1.0))
            out += mg * 0.05 * frown * np.maximum(0, np.sin(np.abs(x) * 9.0 + 1.2)) ** 4
            mn = S.gaussian(p, (0, -9.3 * s, self.nasion[2] + 0.1), (0.8, 1.2, 0.25))
            out += mn * 0.03 * frown
            # Fine vertical lines on the upper lip in old age.
            ml = S.gaussian(p, (0, st[1], st[2] + 1.0), (mw * 0.8, 1.0, 0.55))
            out += ml * 0.02 * lips * np.maximum(0, np.sin(x * 14.0 + phase[7])) ** 6
            return -out

        return S.Offset(face, S.Fn(wrinkles, ((-9, -13, -8), (9, -3, 12))))
