"""Hair as real strands (Blender hair curves, rendered with the Principled
Hair BSDF): the scalp, beard and moustache, eyebrows and eyelashes.

Strands grow from roots scattered on the head mesh, following a direction
field (away from the crown and down; down the face for beards; outward
along the brow), with gravity, and are kept off the skin by the head's
distance field so they lie on it with a little volume. Hair grows in locks:
a few thousand guide strands carry the waves or curls, and every other
strand follows its nearest guide, drawn toward it at the tip (clumping).

Where hair grows is described in angles round the skull: the hairline
(forehead, temples, sideburns, above the ears, the nape), less whatever a
head covering hides (portrait_cloth.py uses the same edges).

Units are centimetres; curves are written in metres.
"""
import math

import bpy
import numpy as np

import portrait_skin

F = np.float32
CM = 0.01
HEAD_C = np.array([0.0, 1.3, 3.5], F)  # centre for the hairline angles


def _norm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-8)


def angles(P, s=1.0):
    """Azimuth (degrees, 0 = front, positive toward the person's left) and
    elevation (degrees) of points around the skull centre."""
    q = P - HEAD_C * np.array([1, s, s], F)
    az = np.degrees(np.arctan2(q[:, 0], -q[:, 1]))
    el = np.degrees(np.arctan2(q[:, 2], np.hypot(q[:, 0], q[:, 1])))
    return az, el


def _periodic(az, table):
    """Interpolate a table of (|azimuth|, value) pairs."""
    a = np.abs(az)
    xs = [t[0] for t in table]
    ys = [t[1] for t in table]
    return np.interp(a, xs, ys)


def hairline(masc, child):
    """Lowest elevation of the hair at each azimuth."""
    rec = 4.0 * masc * (1 - child)  # men's temples recede a little
    return [
        (0, 25.0),
        (25, 26.0 + rec),
        (42, 25.0 + rec * 0.5),
        (58, 14.0),
        (66, -18.0),
        (78, -24.0),
        (88, 2.0),
        (100, 9.0),
        (118, 4.0),
        (140, -30.0),
        (180, -58.0),
    ]


def covered(kind):
    """Elevation above which a head covering hides the scalp (None = nothing hidden)."""
    if kind == "wrap":
        return [(0, 27.0), (45, 24.0), (80, 16.0), (110, 12.0), (180, 0.0)]
    if kind in ("veil", "scarf", "hood"):
        return [(0, 31.0), (30, 29.0), (55, 20.0), (70, -60.0), (180, -80.0)]
    return None


def scalp_mask(head, V, headwear):
    P = head.P
    s = head.s
    az, el = angles(V, s)
    line = _periodic(az, hairline(P.masc, P.child))
    m = np.clip((el - line) / 2.5 + 0.5, 0, 1)
    # Not on the ears.
    for sx in (-1, 1):
        q = (V - np.array([sx * 7.2 * s, 1.3 * s, 0.4 * s], F)) / np.array([1.6, 1.9, 3.3], F)
        m *= np.clip(np.sqrt((q * q).sum(1)) - 0.6, 0, 1)
    cov = covered(headwear)
    if cov is not None:
        top = _periodic(az, cov)
        m *= np.clip((top - el) / 2.0 + 0.2, 0, 1)
    return m.astype(F)


def brow_mask(head, V):
    """The eyebrows: an arched band over each eye, thick at the inner end."""
    s = head.s
    E = head.eye_half
    ez = head.eye_z
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    m = np.zeros(len(V), F)
    thick = (0.3 + 0.35 * head.P.brow_thickness) * (0.7 + 0.3 * head.P.masc)
    # Women's brows arch higher and taper more.
    arch = 0.55 + 0.3 * (1 - head.P.masc)
    taper = 0.6 + 0.2 * (1 - head.P.masc)
    for sx in (-1, 1):
        t = (sx * x - 0.85 * s) / (E + 2.3 * s - 0.85 * s)  # 0 at the inner end, 1 at the tail
        centre = ez + (1.45 + arch * np.sin(np.clip(t, 0, 1) * math.pi * 0.8) - 0.25 * np.clip(t - 0.7, 0, 1) * 3) * s
        half = thick * (1.0 - taper * np.clip(t, 0, 1)) * s
        band = np.clip(1 - np.abs(z - centre) / half, 0, 1) ** 0.6
        along = np.clip(t / 0.08, 0, 1) * np.clip((1 - t) / 0.12, 0, 1)
        front = (y < -5.5).astype(F)
        m = np.maximum(m, band * along * front)
    return m


def weighted_area(V, Q, weight):
    """Area (cm²) of a quad mesh, each quad counted by its mean weight."""
    a, b, c, d = V[Q[:, 0]], V[Q[:, 1]], V[Q[:, 2]], V[Q[:, 3]]
    area = 0.5 * np.linalg.norm(np.cross(c - a, d - b), axis=1)
    return float((np.clip(weight[Q].mean(1), 0, None) * area).sum())


def sample_surface(V, Q, N, weight, count, rng):
    """Random points on a quad mesh, density proportional to area x weight."""
    a, b, c, d = V[Q[:, 0]], V[Q[:, 1]], V[Q[:, 2]], V[Q[:, 3]]
    area = 0.5 * np.linalg.norm(np.cross(c - a, d - b), axis=1)
    wq = np.clip(weight[Q].mean(1), 0, None) * area
    tot = wq.sum()
    if tot <= 0 or count <= 0:
        return np.zeros((0, 3), F), np.zeros((0, 3), F), np.zeros(0, F)
    idx = rng.choice(len(Q), count, p=wq / tot)
    u = rng.random(count).astype(F)[:, None]
    v = rng.random(count).astype(F)[:, None]

    def bil(A):
        qa, qb, qc, qd = (A[Q[idx, k]] for k in range(4))
        return (qa * (1 - u) + qb * u) * (1 - v) + (qd * (1 - u) + qc * u) * v

    P = bil(V)
    Nn = _norm(bil(N))
    W = bil(weight[:, None])[:, 0]
    return P.astype(F), Nn.astype(F), W.astype(F)


def _tangent(d, n):
    return _norm(d - (d * n).sum(1, keepdims=True) * n)


class Groom:
    """One kind of hair: roots, a direction field, length, curl and volume."""

    def __init__(self, name, roots, normals, weights, dirs, length, curl_r, curl_period, lift, gravity, clump, radius, flat=0.0, steps=14):
        self.name = name
        self.roots = roots
        self.normals = normals
        self.weights = weights
        self.dirs = dirs
        self.length = length
        self.curl_r = curl_r
        self.curl_period = curl_period
        self.lift = lift
        self.gravity = gravity
        self.clump = clump
        self.radius = radius
        self.flat = flat
        self.steps = steps


def grow(field, roots, normals, dirs, length, lift, gravity, steps, curl_r, curl_period, phase, flat=0.0):
    """Grow strands step by step, bending under gravity, kept off the skin,
    then curled round their own path."""
    n = len(roots)
    K = steps
    P = np.zeros((n, K, 3), F)
    P[:, 0] = roots + normals * 0.02
    d = _tangent(dirs, normals)
    seg = (length / (K - 1)).astype(F)[:, None]
    g = np.array([0, 0, -1], F)
    for k in range(1, K):
        s = k / (K - 1)
        d = _norm(d + g * gravity * seg * 0.35)
        p = P[:, k - 1] + d * seg
        off = lift[0] + lift[1] * s
        p = field.push_out(p, off)
        if flat > 0:
            # Lie close: pull back toward the surface if the strand floats away.
            dist = field.dist(p)
            over = dist - (off + flat)
            m = over > 0
            if m.any():
                p[m] -= field.grad(p[m]) * over[m][:, None]
        d = _norm(p - P[:, k - 1])
        P[:, k] = p
    if np.any(curl_r > 0):
        # Curl round the smoothed path: a helix in the plane across the strand.
        t = np.gradient(P, axis=1)
        t = _norm(t)
        nrm = field.grad(P.reshape(-1, 3)).reshape(n, K, 3)
        nrm = _norm(nrm - (nrm * t).sum(2, keepdims=True) * t)
        b = np.cross(t, nrm)
        s = np.linspace(0, 1, K, dtype=F)[None, :]
        L = length[:, None]
        ang = 2 * math.pi * s * L / curl_period[:, None] + phase[:, None]
        amp = curl_r[:, None] * np.clip(s * L / 1.2, 0, 1)
        P = P + amp[..., None] * (np.cos(ang)[..., None] * nrm * 0.6 + np.sin(ang)[..., None] * b)
        flat_P = field.push_out(P.reshape(-1, 3), lift[0] * 0.5)
        P = flat_P.reshape(n, K, 3)
    return P


def children(field, guides, g_roots, roots, normals, lengths, g_lengths, clump, rng, jitter=0.02):
    """Strands that follow their nearest guide, drawn together at the tips."""
    n = len(roots)
    K = guides.shape[1]
    # Nearest guide by root position.
    near = np.empty(n, int)
    for i in range(0, n, 4000):
        d2 = ((roots[i : i + 4000, None, :] - g_roots[None, :, :]) ** 2).sum(2)
        near[i : i + 4000] = d2.argmin(1)
    G = guides[near]
    # Shorter strands follow the first part of their guide.
    frac = np.clip(lengths / np.maximum(g_lengths[near], 1e-3), 0.2, 1.0)
    s = np.linspace(0, 1, K, dtype=F)[None, :] * frac[:, None]
    idx = s * (K - 1)
    i0 = np.clip(np.floor(idx).astype(int), 0, K - 2)
    t = (idx - i0)[..., None]
    rows = np.arange(n)[:, None]
    Gs = G[rows, i0] * (1 - t) + G[rows, i0 + 1] * t
    offset = (roots - g_roots[near])[:, None, :]
    sp = np.linspace(0, 1, K, dtype=F)[None, :, None]
    c = clump * sp**1.3
    P = Gs + offset * (1 - c)
    P += rng.normal(0, jitter, P.shape).astype(F) * sp
    P[:, 0] = roots + normals * 0.02
    P = field.push_out(P.reshape(-1, 3), 0.03).reshape(P.shape)
    return P


def to_curves(name, strands, radius_root, radius_tip, material, collection):
    n, K, _ = strands.shape
    curves = bpy.data.hair_curves.new(name)
    curves.add_curves([K] * n)
    curves.position_data.foreach_set("vector", (strands.reshape(-1, 3) * CM).ravel())
    s = np.tile(np.linspace(0, 1, K, dtype=F), n)
    r = (radius_root + (radius_tip - radius_root) * s**1.5) * CM
    attr = curves.attributes.get("radius") or curves.attributes.new("radius", "FLOAT", "POINT")
    attr.data.foreach_set("value", r.astype(F))
    curves.materials.append(material)
    obj = bpy.data.objects.new(name, curves)
    collection.objects.link(obj)
    return obj


class Hair:
    """All the hair on one person."""

    def __init__(self, head, params, V, Q, N, field, collection, materials, quality=1.0, obstacle=None):
        self.head = head
        self.P = params
        self.V, self.Q, self.N = V, Q, N
        self.field = field
        self.col = collection
        self.mats = materials
        self.q = quality
        # A field that is positive where hair may not go (inside a head covering).
        self.obstacle = obstacle
        self.rng = np.random.default_rng(params.seed + 101)
        self.objects = []
        a = params.appearance
        self._scalp(a["headwear"])
        if a["beard"]:
            self._beard()
        self._brows()
        self._lashes()

    def _face_guard(self, pts):
        """Positive in front of the face below the brows: hair never falls over the eyes."""
        head = self.head
        x, y, z = pts[:, 0], pts[:, 1], pts[:, 2]
        top = head.eye_z + 1.7 * head.s
        return np.minimum(np.minimum(top - z, 6.3 * head.s - np.abs(x)), -4.5 - y)

    def _clip(self, strands, guard=False):
        """End each strand where it would pass into cloth (or, for scalp hair,
        over the face); drop strands that start there."""
        if len(strands) == 0 or (self.obstacle is None and not guard):
            return strands
        n, K, _ = strands.shape
        pts = strands.reshape(-1, 3)
        bad = np.full(len(pts), -1.0, F)
        if self.obstacle is not None:
            bad = np.maximum(bad, self.obstacle.dist(pts))
        if guard:
            bad = np.maximum(bad, self._face_guard(pts))
        hit = bad.reshape(n, K) > 0
        first = np.where(hit.any(1), hit.argmax(1), K)
        last = np.maximum(first - 1, 0)
        idx = np.minimum(np.arange(K)[None, :], last[:, None])
        clipped = strands[np.arange(n)[:, None], idx]
        return clipped[first > 2]

    # ── Scalp ──────────────────────────────────────────────────────────────
    def _scalp(self, headwear):
        P = self.P
        head = self.head
        s = head.s
        w = scalp_mask(head, self.V, headwear)
        style = P.hair_style
        # Strands per square centimetre of scalp that shows.
        density = {"long": 190.0, "child": 140.0}.get(style, 135.0)
        count = int(density * weighted_area(self.V, self.Q, w) * self.q)
        if style == "long":
            # Under a veil or scarf only the hair at the front shows, swept to the sides.
            length = (7.0, 1.0)
            curl = (0.12 * P.hair_curl, 3.2)
            lift = (0.05, 0.3)
            gravity = 0.05
            clump = 0.5
        elif style == "child":
            # Loose curls, a little longer than a man's crop, lying close.
            length = (4.3 + 1.0 * P.hair_curl, 0.9)
            curl = (0.17 + 0.15 * P.hair_curl, 1.7 + 0.8 * (1 - P.hair_curl))
            lift = (0.1, 0.65)
            gravity = 0.6
            clump = 0.4
        else:
            length = (3.0 + 0.8 * P.hair_curl, 0.6)
            curl = (0.16 + 0.14 * P.hair_curl, 1.5 + 0.6 * (1 - P.hair_curl))
            lift = (0.1, 0.5)
            gravity = 0.5
            clump = 0.3
        roots, nrm, _ = sample_surface(self.V, self.Q, self.N, w, count, self.rng)
        if len(roots) == 0:
            return
        # Direction: away from the crown, and down.
        crown = np.array([0.0, 3.0 * s, 12.8 * s], F)
        away = _norm(roots - crown)
        down = np.array([0, 0, -1], F)
        dirs = away + down * (0.8 if style != "short" else 0.4)
        if style == "long":
            # Parted in the middle, swept back toward the ears.
            side = np.sign(roots[:, 0])[:, None] * np.array([1, 0, 0], F)
            dirs = side * 0.55 + np.array([0, 1.0, 0.3], F)
        # At the hairline over the face, hair is swept back and to the side
        # (it ends naturally rather than being cut off above the eyes).
        az, el = angles(roots, s)
        front = (np.abs(az) < 55)[:, None]
        if style in ("child", "short"):
            swept = np.stack([np.sign(roots[:, 0] + 0.3) * 0.8, np.full(len(roots), 0.6, F), np.full(len(roots), 0.35, F)], 1)
            dirs = np.where(front, swept, dirs)
        self._groom("scalp", roots, nrm, dirs, length, curl, lift, gravity, clump, self.mats["hair"], (0.0065, 0.003), flat=0.25 if style == "long" else 0.0, guard=True)

    def _groom(self, name, roots, nrm, dirs, length, curl, lift, gravity, clump, mat, radius, flat=0.0, guides_every=28, guard=False):
        rng = self.rng
        n = len(roots)
        L = np.clip(rng.normal(length[0], length[1], n), length[0] * 0.3, length[0] * 1.8).astype(F)
        g_idx = rng.choice(n, max(8, n // guides_every), replace=False)
        g_roots = roots[g_idx]
        gL = np.maximum(L[g_idx], length[0])
        curl_r = np.full(len(g_idx), curl[0], F) * rng.uniform(0.7, 1.3, len(g_idx)).astype(F)
        curl_p = np.full(len(g_idx), curl[1], F) * rng.uniform(0.8, 1.25, len(g_idx)).astype(F)
        phase = rng.uniform(0, 2 * math.pi, len(g_idx)).astype(F)
        # A little randomness in each lock's direction.
        gd = _norm(dirs[g_idx] + rng.normal(0, 0.25, (len(g_idx), 3)).astype(F))
        guides = grow(self.field, g_roots, nrm[g_idx], gd, gL, lift, gravity, 16, curl_r, curl_p, phase, flat)
        strands = children(self.field, guides, g_roots, roots, nrm, L, gL, clump, rng)
        self.objects.append(to_curves(name, self._clip(strands, guard), radius[0], radius[1], mat, self.col))
        return strands

    # ── Beard ──────────────────────────────────────────────────────────────
    def _beard(self):
        P = self.P
        head = self.head
        w = portrait_skin.beard_mask(head, self.V)
        long = P.beard_length > 6
        count = int((125.0 if not long else 150.0) * weighted_area(self.V, self.Q, w) * self.q)
        roots, nrm, wt = sample_surface(self.V, self.Q, self.N, w, count, self.rng)
        if len(roots) == 0:
            return
        st = head.stomion
        # Down the face; the moustache down and outward from the middle.
        dirs = np.tile(np.array([0, -0.15, -1.0], F), (len(roots), 1))
        mo = (roots[:, 2] > st[2]) & (np.abs(roots[:, 0]) < head.mouth_half + 0.5)
        dirs[mo] = _norm(np.stack([np.sign(roots[mo, 0]) * 0.55, np.full(mo.sum(), -0.3, F), np.full(mo.sum(), -1.0, F)], 1))
        # Under the jaw the beard grows forward and down.
        under = roots[:, 2] < head.menton[2] + 0.5
        dirs[under] = np.array([0, -0.8, -0.6], F)
        # Short at the edges of the beard, full on the chin.
        L0 = P.beard_length
        length = (L0, L0 * 0.25)
        curl = (0.12 + 0.12 * P.hair_curl, 1.2 + 0.5 * (1 - P.hair_curl))
        lift = (0.05, 0.14 * min(L0, 4.0))
        grav = 0.6 if not long else 1.2
        # Longest at the point of the chin, shorter up the cheeks and at the sides,
        # so the beard has a natural outline rather than a straight hem.
        chin = np.exp(-((roots[:, 0] / 3.2) ** 2))
        high = np.clip((roots[:, 2] - (st[2] - 1.0)) / 4.0, 0, 1)
        shape = (0.6 + 0.5 * chin) * (1 - 0.45 * high)
        strands = self._groom_scaled("beard", roots, nrm, dirs, length, curl, lift, grav, 0.4, self.mats["beard"], (0.006, 0.003), wt * shape, mo)
        return strands

    def _groom_scaled(self, name, roots, nrm, dirs, length, curl, lift, gravity, clump, mat, radius, wt, mo):
        """A groom whose length follows the density weight (short at the edges);
        the moustache is kept short so the mouth shows."""
        rng = self.rng
        n = len(roots)
        L = np.clip(rng.normal(length[0], length[1], n), length[0] * 0.3, length[0] * 1.6).astype(F)
        L *= np.clip(wt, 0.2, 1.1) ** 0.8
        L[mo] = np.minimum(L[mo], 1.4 + 0.3 * rng.random(mo.sum()))
        g_idx = rng.choice(n, max(8, n // 26), replace=False)
        g_roots = roots[g_idx]
        gL = L[g_idx]
        curl_r = np.full(len(g_idx), curl[0], F) * rng.uniform(0.7, 1.3, len(g_idx)).astype(F)
        curl_p = np.full(len(g_idx), curl[1], F) * rng.uniform(0.8, 1.25, len(g_idx)).astype(F)
        phase = rng.uniform(0, 2 * math.pi, len(g_idx)).astype(F)
        gd = _norm(dirs[g_idx] + rng.normal(0, 0.2, (len(g_idx), 3)).astype(F))
        guides = grow(self.field, g_roots, nrm[g_idx], gd, gL, lift, gravity, 14, curl_r, curl_p, phase)
        strands = children(self.field, guides, g_roots, roots, nrm, L, gL, clump, rng, jitter=0.03)
        self.objects.append(to_curves(name, self._clip(strands), radius[0], radius[1], mat, self.col))
        return strands

    # ── Eyebrows ───────────────────────────────────────────────────────────
    def _brows(self):
        P = self.P
        head = self.head
        w = brow_mask(head, self.V)
        count = int((500 + 1800 * P.brow_thickness * (0.35 + 0.65 * P.masc)) * self.q)
        roots, nrm, _ = sample_surface(self.V, self.Q, self.N, w, count, self.rng)
        if len(roots) == 0:
            return
        E = head.eye_half
        s = head.s
        t = np.clip((np.abs(roots[:, 0]) - 0.85 * s) / (E + 2.3 * s - 0.85 * s), 0, 1)
        sx = np.sign(roots[:, 0])
        # Inner hairs point up, the body outward, the tail outward and down.
        up = np.clip(1 - t / 0.25, 0, 1)
        dirs = np.stack([sx * (0.3 + 0.9 * (1 - up)), np.zeros_like(t), up * 1.2 + 0.25 - 0.5 * np.clip(t - 0.65, 0, 1)], 1).astype(F)
        L = (0.75 + 0.3 * self.rng.random(len(roots)) - 0.3 * t).astype(F)
        strands = grow(self.field, roots, nrm, dirs, L, (0.015, 0.06), 0.0, 6, np.zeros(len(roots), F), np.ones(len(roots), F), np.zeros(len(roots), F), flat=0.03)
        self.objects.append(to_curves("brows", strands, 0.0065, 0.002, self.mats["brow"], self.col))

    # ── Eyelashes ──────────────────────────────────────────────────────────
    def _lashes(self):
        head = self.head
        rng = self.rng
        lashes = []
        for sx in (-1, 1):
            E = head.eye_centre(sx)
            for upper, count, length, curl in ((True, 120, 0.8, 0.8), (False, 45, 0.42, 0.35)):
                u = np.sort(rng.uniform(-0.86, 0.94, count))
                for ui in u:
                    vert = np.array([0, 0, 1 if upper else -1], F)
                    # On the front edge of the lid margin.
                    root = head.lid_point(sx, float(ui), upper=upper, out=0.2) + vert * 0.02
                    out = _norm((root - E + vert * (-0.45 if upper else 0.1))[None])[0]
                    # Longest in the middle and toward the outer corner.
                    L = length * (0.55 + 0.45 * math.sin(math.pi * (ui + 1) / 2 * 0.9 + 0.15)) * rng.uniform(0.8, 1.1)
                    ts = np.linspace(0, 1, 7, dtype=F)[:, None]
                    side = np.array([sx * 0.3 * max(0.0, ui), 0, 0], F)
                    pts = root + (out * 0.85 + side) * L * ts + vert * (curl * L * 0.45) * ts**2
                    lashes.append(pts)
        strands = np.stack(lashes).astype(F)
        self.objects.append(to_curves("lashes", strands, 0.008, 0.0015, self.mats["lash"], self.col))
