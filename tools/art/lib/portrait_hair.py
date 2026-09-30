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

Where hair grows is decided on the person's rest shape (no expression), and
roots are then placed on the posed skin at the same spots, so a person's
hairline, brows and beard are the same in every expression and move with
the skin (portrait_mhhead.py).

Units are centimetres; curves are written in metres.
"""
import math

import bpy
import numpy as np

import portrait_mhskin

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


def hairline(masc, child, recede=0.0):
    """Lowest elevation of the hair at each azimuth; `recede` (degrees)
    takes a man's hairline further back, most at the temples."""
    rec = 4.0 * masc * (1 - child) + recede  # men's temples recede a little
    return [
        (0, 23.0 - 1.5 * masc * (1 - child) + 0.35 * recede),
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


def covered(kind, back=0.0):
    """Elevation above which a head covering hides the scalp (None = nothing
    hidden); `back` (cm) is how much further back a veil sits (about 4.5
    degrees a centimetre at the front)."""
    if kind == "wrap":
        return [(0, 27.0), (45, 24.0), (80, 16.0), (110, 12.0), (180, 0.0)]
    if kind in ("veil", "scarf", "hood", "headcloth"):
        b = 4.5 * back * (0.5 if kind == "hood" else 1.0)
        return [(0, 31.0 + b), (30, 29.0 + b), (55, 20.0 + 0.5 * b), (70, -60.0), (180, -80.0)]
    return None


def scalp_mask(head, V, headwear):
    P = head.P
    s = head.s
    az, el = angles(V, s)
    line = _periodic(az, hairline(P.masc, P.child, P.recede))
    m = np.clip((el - line) / 2.5 + 0.5, 0, 1)
    # Not on the ears.
    for sx in (-1, 1):
        q = (V - head.rest["ear"][sx]) / np.array([1.6, 1.9, 3.3], F)
        m *= np.clip(np.sqrt((q * q).sum(1)) - 0.6, 0, 1)
    cov = covered(headwear, P.veil_back)
    if cov is not None:
        top = _periodic(az, cov)
        m *= np.clip((top - el) / 2.0 + 0.2, 0, 1)
    return m.astype(F)


def brow_mask(head, V):
    """The eyebrows: an arched band over each eye, thick at the inner end,
    thinning and sparser at the tail, with ragged edges (portrait_mhhead.brow_z
    gives the line, with the expression). Some men's brows nearly meet."""
    P = head.P
    s = head.s
    E = head.eye_half
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    m = np.zeros(len(V), F)
    # (Third pass: women's brows finer still; heavy brows made them read as men.)
    # Full, natural brows (not plucked into a line): a little finer on women.
    thick = (0.36 + 0.36 * P.brow_thickness) * (0.74 + 0.26 * P.masc) * (1 - 0.15 * P.child)
    # Women's brows taper more.
    taper = 0.45 + 0.12 * (1 - P.masc)
    rng = np.random.default_rng(P.seed + 41)
    ph = rng.uniform(0, 6.28, 4)
    for sx in (-1, 1):
        u = sx * x
        near = (u > 0) & (u < E + 4.0 * s) & (np.abs(z - head.eye_z) < 5.0 * s)
        centre = np.full(len(V), 1e3, F)
        t = np.full(len(V), -1.0, F)
        if near.any():
            centre[near], t[near] = head.brow_line(sx, u[near])
        half = thick * (1.0 - taper * np.clip(t, 0, 1)) * s
        ragged = 1.0 + 0.18 * np.sin(u * 7.0 + ph[0] + sx) * np.sin(u * 3.1 + ph[1])
        band = np.clip(1 - np.abs(z - centre) / (half * ragged), 0, 1) ** 0.6
        start = -0.05 - 0.9 * P.brow_join  # joined brows begin nearer the middle
        along = np.clip((t - start) / 0.1, 0, 1) * np.clip((1 - t) / 0.14, 0, 1)
        # Sparser toward the tail.
        along *= 1.0 - 0.45 * np.clip((t - 0.55) / 0.45, 0, 1)
        front = (y < head.eye_y + 1.5).astype(F)
        m = np.maximum(m, band * along * front)
    if P.brow_join > 0.05:
        mid = np.clip(1 - np.abs(x) / 1.1, 0, 1) * np.clip(1 - np.abs(z - head.brow_line(1, np.array([0.9], F))[0][0] + 0.15) / 0.3, 0, 1)
        m = np.maximum(m, 0.35 * P.brow_join * mid * (y < -5.5))
    # Not across a scar.
    if P.scars:
        m *= 1 - portrait_mhskin.segments(V, [(a, b, w * 1.6) for a, b, w in P.scars])
    return m


def weighted_area(V, Q, weight):
    """Area (cm²) of a quad mesh, each quad counted by its mean weight."""
    a, b, c, d = V[Q[:, 0]], V[Q[:, 1]], V[Q[:, 2]], V[Q[:, 3]]
    area = 0.5 * np.linalg.norm(np.cross(c - a, d - b), axis=1)
    return float((np.clip(weight[Q].mean(1), 0, None) * area).sum())


def sample_surface(V, Q, N, weight, count, rng, V_rest=None):
    """Random points on a quad mesh, density proportional to area x weight
    (the area of `V_rest` when given: the same spots whatever the pose)."""
    Va = V if V_rest is None else V_rest
    a, b, c, d = Va[Q[:, 0]], Va[Q[:, 1]], Va[Q[:, 2]], Va[Q[:, 3]]
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


def shaped_hair(P):
    """Whose hair is cut to a shape (fifth pass): children's, and young men's
    uncovered hair that is longer than a close crop."""
    if P.hair_style == "child":
        return True
    return P.hair_style == "short" and P.age < 25 and P.hair_cut != "crop" and P.head_style in ("none", "band")


def shaped_groom(P, style, length, curl, lift, clump, az, el):
    """A child's or young man's haircut: (length, curl, lift, clump, shape),
    where shape holds each root's length and volume factors.

    - Length: full on the crown and at the front, about half over the ears
      and at the nape, easing between (a cut, not a shell of even depth).
    - Volume: most on the crown, close at the sides and nape.
    - Locks: soft (little drawn together at the tips), each its own volume;
      tightly clumped tips read as wet spikes. The strands are also finer
      and more of them (Hair._scalp, _groom)."""
    a = np.abs(az)
    top = np.clip((el - 12.0) / 36.0, 0.0, 1.0)
    top = top * top * (3 - 2 * top)
    side = np.clip((a - 55.0) / 30.0, 0.0, 1.0)
    nape = np.clip((a - 120.0) / 40.0, 0.0, 1.0) * np.clip((20.0 - el) / 30.0, 0.0, 1.0)
    L = 1.0 - side * (1.0 - top) * 0.42 - nape * 0.25
    V = 1.0 - side * (1.0 - top) * 0.45 - nape * 0.3
    if style == "child":
        curl = (curl[0] * 0.9, curl[1])
        clump = 0.32
        lift = (lift[0], lift[1] * 0.85)
    else:
        # A young man's longer hair lies in soft waves, not frizz.
        clump = 0.3
        curl = (curl[0] * 0.55, curl[1] * 1.25)
        lift = (lift[0], lift[1] * 0.7)
    return length, curl, lift, clump, {"length": L.astype(F), "lift": V.astype(F)}


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
    # One clumping for every lock, or each lock its own (some tight, some loose).
    c = (np.asarray(clump, F)[near][:, None, None] if np.ndim(clump) else clump) * sp**1.3
    P = Gs + offset * (1 - c)
    P += rng.normal(0, jitter, P.shape).astype(F) * sp
    P[:, 0] = roots + normals * 0.02
    P = field.push_out(P.reshape(-1, 3), 0.03).reshape(P.shape)
    return P


def to_curves(name, strands, radius_root, radius_tip, material, collection):
    """Hair curves; the radii (cm) are one for all strands or one per strand."""
    n, K, _ = strands.shape
    curves = bpy.data.hair_curves.new(name)
    curves.add_curves([K] * n)
    curves.position_data.foreach_set("vector", (strands.reshape(-1, 3) * CM).ravel())
    s = np.linspace(0, 1, K, dtype=F)[None, :]
    rr = np.broadcast_to(np.asarray(radius_root, F).reshape(-1, 1), (n, 1))
    rt = np.broadcast_to(np.asarray(radius_tip, F).reshape(-1, 1), (n, 1))
    r = ((rr + (rt - rr) * s**1.5) * CM).ravel()
    attr = curves.attributes.get("radius") or curves.attributes.new("radius", "FLOAT", "POINT")
    attr.data.foreach_set("value", r.astype(F))
    curves.materials.append(material)
    obj = bpy.data.objects.new(name, curves)
    collection.objects.link(obj)
    return obj


class Hair:
    """All the hair on one person."""

    def __init__(self, head, params, V, Q, N, field, collection, materials, quality=1.0, obstacle=None, V_rest=None, base_idx=None):
        self.head = head
        self.P = params
        self.V, self.Q, self.N = V, Q, N
        # The rest shape (masks and sampling) and each vertex's index in
        # MakeHuman's base mesh.
        self.Vr = V if V_rest is None else V_rest
        self.base_idx = base_idx
        self.field = field
        self.col = collection
        self.mats = materials
        self.q = quality
        # A field that is positive where hair may not go (inside a head covering).
        self.obstacle = obstacle
        self.rng = np.random.default_rng(params.seed + 101)
        self.objects = []
        a = params.appearance
        self._scalp(params.head_style)
        if a["beard"]:
            self._beard()
        self._brows()
        self._lashes()

    def _face_guard(self, pts):
        """Positive in front of the face below the brows: hair never falls over the eyes."""
        head = self.head
        x, y, z = pts[:, 0], pts[:, 1], pts[:, 2]
        # Long hair under a covering stays at the hairline, off the forehead.
        top = head.eye_z + (6.0 if self.P.hair_style == "long" else 1.7) * head.s
        return np.minimum(np.minimum(top - z, 6.3 * head.s - np.abs(x)), -4.5 - y)

    def _clip(self, strands, guard=False, keep=False):
        """End each strand where it would pass into cloth (or, for scalp hair,
        over the face); drop strands that start there. With `keep`, also
        return which strands were kept."""
        if len(strands) == 0 or (self.obstacle is None and not guard):
            return (strands, np.ones(len(strands), bool)) if keep else strands
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
        return (clipped[first > 2], first > 2) if keep else clipped[first > 2]

    # ── Scalp ──────────────────────────────────────────────────────────────
    def _scalp(self, headwear):
        P = self.P
        head = self.head
        s = head.s
        w = scalp_mask(head, self.Vr, headwear)
        style = P.hair_style
        # Strands per square centimetre of scalp that shows.
        density = {"long": 190.0, "child": 140.0}.get(style, 135.0)
        count = int(density * weighted_area(self.Vr, self.Q, w) * self.q)
        if shaped_hair(P):
            # Finer and denser (fifth pass): fewer, thicker strands with gaps
            # between them read as straggling.
            count = int(count * 1.7)
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
        elif P.hair_cut == "crop":
            # Cut close: short, tight, lying on the head.
            length = (1.5 + 0.5 * P.hair_curl, 0.3)
            curl = (0.09 + 0.08 * P.hair_curl, 0.8 + 0.4 * (1 - P.hair_curl))
            lift = (0.06, 0.25)
            gravity = 0.3
            clump = 0.22
        elif P.hair_cut == "wavy":
            # Longer, in loose waves, swept to one side.
            length = (4.6 + 0.8 * P.hair_curl, 0.8)
            curl = (0.34 + 0.12 * P.hair_curl, 3.0)
            lift = (0.18, 1.1)
            gravity = 0.7
            clump = 0.3
        elif P.hair_cut == "straight":
            # Longer and nearly straight, falling forward and down.
            length = (4.6, 0.7)
            curl = (0.06, 5.0)
            lift = (0.1, 0.55)
            gravity = 1.0
            clump = 0.45
        else:
            length = (3.0 + 0.8 * P.hair_curl, 0.6)
            curl = (0.16 + 0.14 * P.hair_curl, 1.5 + 0.6 * (1 - P.hair_curl))
            lift = (0.1, 0.5)
            gravity = 0.5
            clump = 0.3
        roots, nrm, _ = sample_surface(self.V, self.Q, self.N, w, count, self.rng, self.Vr)
        if len(roots) == 0:
            return
        # Direction: away from the crown, and down.
        crown = np.array([0.0, 3.0 * s, 12.8 * s], F)
        away = _norm(roots - crown)
        down = np.array([0, 0, -1], F)
        dirs = away + down * (0.8 if style != "short" else 0.4)
        az, el = angles(roots, s)
        front = (np.abs(az) < 55)[:, None]
        if style == "long":
            # Parted in the middle, swept back toward the ears; at the front
            # it lies along the temples, so a little shows under the cloth.
            side = np.sign(roots[:, 0] + 0.01)[:, None] * np.array([1, 0, 0], F)
            dirs = np.where(front, side * 1.0 + np.array([0, 0.75, 0.2], F), side * 0.55 + np.array([0, 1.0, 0.3], F))
        # At the hairline over the face, hair is swept back and to the side
        # (it ends naturally rather than being cut off above the eyes).
        if style in ("child", "short"):
            # At the front, hair falls a little forward and to the side over
            # the top of the forehead (not swept straight back, which reads as
            # a helmet with a hard edge).
            side = np.tanh((roots[:, 0] + 0.8) / 2.5) * 0.8
            if style == "short" and P.hair_cut in ("wavy", "straight"):
                # Parted a little off the middle, and swept away from the parting.
                part = 1.6 if P.seed % 2 else -1.6
                side = np.tanh((roots[:, 0] - part) / 1.2) * 1.1
            forward = np.clip((el - 22.0) / 25.0, 0, 1)  # the hairline edge falls forward, the crown sweeps back
            if headwear in ("veil", "scarf", "hood", "headcloth"):
                forward = np.ones_like(forward)  # under a covering, swept back
            swept = np.stack([side, 0.8 - 1.3 * (1 - forward), 0.3 - 0.9 * (1 - forward)], 1).astype(F)
            dirs = np.where(front, swept, dirs)
        shape = None
        if shaped_hair(P):
            # (Fifth pass.) A child's or a young man's hair is cut to a shape,
            # not a shell of even depth: fuller on the crown and at the front,
            # shorter and closer over the ears and at the nape; it falls in
            # locks that each stand a little proud or lie a little flatter,
            # and holds together in them (the hair had read as a helmet with
            # straggling ends).
            length, curl, lift, clump, shape = shaped_groom(P, style, length, curl, lift, clump, az, el)
        self._groom("scalp", roots, nrm, dirs, length, curl, lift, gravity, clump, self.mats["hair"], (0.0065, 0.003) if shape is None else (0.0048, 0.0022), flat=0.25 if style == "long" else 0.0, guard=True, shape=shape)
        if P.child > 0.3:
            self._baby_hair(w)

    def _baby_hair(self, w):
        """A child's fine, short, wispy hairs along the hairline."""
        P = self.P
        head = self.head
        s = head.s
        edge = np.clip(w * (1 - w) * 4.0, 0, 1) * (w > 0.05)
        count = int(900 * P.child * self.q)
        roots, nrm, _ = sample_surface(self.V, self.Q, self.N, edge, count, self.rng, self.Vr)
        if len(roots) == 0:
            return
        crown = np.array([0.0, 3.0 * s, 12.8 * s], F)
        dirs = _norm(roots - crown) + np.array([0, 0, -0.5], F)
        n = len(roots)
        L = (0.45 + 0.8 * self.rng.random(n)).astype(F)
        curl_r = np.full(n, 0.07, F)
        curl_p = np.full(n, 0.55, F) * self.rng.uniform(0.8, 1.3, n).astype(F)
        phase = self.rng.uniform(0, 2 * math.pi, n).astype(F)
        strands = grow(self.field, roots, nrm, _norm(dirs + self.rng.normal(0, 0.35, dirs.shape).astype(F)), L, (0.03, 0.15), 0.3, 7, curl_r, curl_p, phase)
        self.objects.append(to_curves("baby-hair", self._clip(strands, guard=True), 0.0035, 0.0012, self.mats["hair"], self.col))

    def _groom(self, name, roots, nrm, dirs, length, curl, lift, gravity, clump, mat, radius, flat=0.0, guides_every=28, guard=False, shape=None):
        rng = self.rng
        n = len(roots)
        L = np.clip(rng.normal(length[0], length[1], n), length[0] * 0.3, length[0] * 1.8).astype(F)
        g_idx = rng.choice(n, max(8, n // guides_every), replace=False)
        if shape is not None:
            # Cut to shape: each strand's length scaled by where it grows.
            L = (L * shape["length"]).astype(F)
        g_roots = roots[g_idx]
        gL = np.maximum(L[g_idx], length[0] * (shape["length"][g_idx] if shape is not None else 1.0))
        curl_r = np.full(len(g_idx), curl[0], F) * rng.uniform(0.7, 1.3, len(g_idx)).astype(F)
        curl_p = np.full(len(g_idx), curl[1], F) * rng.uniform(0.8, 1.25, len(g_idx)).astype(F)
        phase = rng.uniform(0, 2 * math.pi, len(g_idx)).astype(F)
        # A little randomness in each lock's direction (less in a shaped cut,
        # where every lock stirred at random read as a wind-blown mop).
        gd = _norm(dirs[g_idx] + rng.normal(0, 0.25, (len(g_idx), 3)).astype(F) * (1.0 if shape is None else 0.55))
        g_lift = lift
        g_clump = clump
        if shape is not None:
            # Each lock its own volume (from a separate random stream, so
            # everything else about the groom is as before) and closer at
            # the sides and nape; each lock holds together.
            sr = np.random.default_rng(self.P.seed + 409)
            g_lift = (lift[0], (lift[1] * shape["lift"][g_idx] * sr.uniform(0.55, 1.45, len(g_idx))).astype(F))
            g_clump = np.clip(clump + sr.normal(0.0, 0.07, len(g_idx)), 0.18, 0.6).astype(F)
        guides = grow(self.field, g_roots, nrm[g_idx], gd, gL, g_lift, gravity, 16, curl_r, curl_p, phase, flat)
        strands = children(self.field, guides, g_roots, roots, nrm, L, gL, g_clump, rng, jitter=0.02 if shape is None else 0.012)
        # Third pass: hairs of different thickness (a separate random stream,
        # so the second pass's groom is unchanged), and on uncovered hair a
        # few flyaways that leave their lock.
        vr = np.random.default_rng(self.P.seed + 307)
        thick = np.clip(vr.lognormal(0.0, 0.22, n), 0.55, 1.7).astype(F)
        kept, ok = self._clip(strands, guard, keep=True)
        self.objects.append(to_curves(name, kept, radius[0] * thick[ok], radius[1] * thick[ok], mat, self.col))
        if name == "scalp" and self.P.head_style in ("none", "band"):
            ns = int((0.012 if shape is None else 0.004) * n)
            if ns > 0:
                idx = vr.choice(n, ns, replace=False)
                sd = _norm(dirs[idx] + vr.normal(0, 0.8, (ns, 3)).astype(F))
                sL = (L[idx] * vr.uniform(0.9, 1.4, ns)).astype(F)
                cr = np.full(ns, curl[0], F) * vr.uniform(0.3, 1.2, ns).astype(F)
                cp = np.full(ns, curl[1], F) * vr.uniform(0.8, 1.8, ns).astype(F)
                stray = grow(self.field, roots[idx], nrm[idx], sd, sL, (lift[0], lift[1] * 1.6), gravity * 0.5, 10, cr, cp, vr.uniform(0, 2 * math.pi, ns).astype(F))
                kept, ok = self._clip(stray, guard, keep=True)
                self.objects.append(to_curves(name + "-strays", kept, radius[0] * 0.8, radius[1] * 0.6, mat, self.col))
        return strands

    # ── Beard ──────────────────────────────────────────────────────────────
    def _beard(self):
        P = self.P
        head = self.head
        w = portrait_mhskin.beard_mask(head, self.Vr, self.base_idx)
        long = P.beard_length > 6
        count = int((125.0 if not long else 150.0) * weighted_area(self.Vr, self.Q, w) * self.q)
        roots, nrm, wt = sample_surface(self.V, self.Q, self.N, w, count, self.rng, self.Vr)
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
        # Third pass: no two hairs alike. (A separate random stream, so the
        # second pass's draws, and so the brows and lashes, are unchanged.)
        vr = np.random.default_rng(self.P.seed + 211)
        # Lengths spread wider, with some short new hairs among the long.
        regrowth = vr.random(n) < 0.12
        L = np.where(regrowth, L * vr.uniform(0.25, 0.55, n), L * vr.uniform(0.85, 1.15, n)).astype(F)
        L[mo] = np.minimum(L[mo], 1.4 + 0.3 * vr.random(mo.sum()))
        guides = grow(self.field, g_roots, nrm[g_idx], gd, gL, lift, gravity, 14, curl_r, curl_p, phase)
        # Each lock its own clumping: some tight and pointed, some loose.
        clump_g = np.clip(clump + vr.normal(0, 0.17, len(g_idx)), 0.08, 0.75).astype(F)
        strands = children(self.field, guides, g_roots, roots, nrm, L, gL, clump_g, rng, jitter=0.03)
        # Thickness: most hairs coarse, some fine, a few thick and wiry.
        thick = np.clip(vr.lognormal(0.0, 0.3, n), 0.45, 1.9).astype(F)
        kept, ok = self._clip(strands, keep=True)
        self.objects.append(to_curves(name, kept, radius[0] * thick[ok], radius[1] * thick[ok], mat, self.col))
        # Strays: a few hairs that go their own way, longer and wirier, off
        # the outline of the beard (never across the mouth).
        pool = np.nonzero(~mo)[0]
        ns = int(0.035 * len(pool) * (0.5 if self.P.beard_length > 6 else 1.0))
        if ns > 0:
            idx = vr.choice(pool, ns, replace=False)
            sd = _norm(dirs[idx] + vr.normal(0, 0.6, (ns, 3)).astype(F))
            # A little longer than the hairs round them (at most a couple of
            # centimetres more: long strays off a long beard read as cobweb).
            sL = (np.maximum(L[idx], 0.6) + np.minimum(L[idx] * vr.uniform(0.0, 0.4, ns), 2.0)).astype(F)
            cr = (curl[0] * vr.uniform(0.3, 1.6, ns)).astype(F)
            cp = (curl[1] * vr.uniform(0.6, 1.6, ns)).astype(F)
            stray = grow(self.field, roots[idx], nrm[idx], sd, sL, (lift[0], lift[1] * 1.8), gravity * 0.5, 10, cr, cp, vr.uniform(0, 2 * math.pi, ns).astype(F))
            kept, ok = self._clip(stray, keep=True)
            st = np.clip(vr.lognormal(0.15, 0.3, ns), 0.6, 2.0).astype(F)
            self.objects.append(to_curves(name + "-strays", kept, radius[0] * st[ok], radius[1] * 0.6 * st[ok], mat, self.col))
        return strands

    # ── Eyebrows ───────────────────────────────────────────────────────────
    def _brows(self):
        P = self.P
        head = self.head
        w = brow_mask(head, self.Vr)
        count = int((320 + 160 * P.masc + 1000 * P.brow_thickness * (0.6 + 0.4 * P.masc)) * (1 + 0.3 * P.age_t) * (1 - 0.3 * P.child) * self.q)
        roots, nrm, _ = sample_surface(self.V, self.Q, self.N, w, count, self.rng, self.Vr)
        if len(roots) == 0:
            return
        rng = self.rng
        E = head.eye_half
        s = head.s
        sx = np.sign(roots[:, 0])
        t = np.zeros(len(roots), F)
        for side in (-1, 1):
            k = sx == side
            if k.any():
                t[k] = np.clip(head.brow_line(side, np.abs(roots[k, 0]))[1], 0, 1)
        # Inner hairs point up, the body outward, the tail outward and down;
        # each hair a little off, and an old man's brows unruly.
        up = np.clip(1 - t / 0.25, 0, 1)
        dirs = np.stack([sx * (0.3 + 0.9 * (1 - up)), np.zeros_like(t), up * 1.2 + 0.25 - 0.5 * np.clip(t - 0.65, 0, 1)], 1).astype(F)
        dirs += rng.normal(0, 0.18 + 0.1 * P.masc + 0.25 * P.age_t, dirs.shape).astype(F)  # ungroomed, not wild
        L = (0.62 + 0.35 * rng.random(len(roots)) - 0.25 * t) * (1 + 0.5 * P.age_t * rng.random(len(roots)) ** 3)
        # Lying on the skin (hairs that stood off it read as fuzz).
        L = L * (0.85 + 0.15 * P.masc)
        strands = grow(self.field, roots, nrm, dirs, L.astype(F), (0.008, 0.025 + 0.05 * P.age_t), 0.0, 6, np.zeros(len(roots), F), np.ones(len(roots), F), np.zeros(len(roots), F), flat=0.015)
        self.objects.append(to_curves("brows", strands, 0.0065, 0.0018, self.mats["brow"], self.col))

    # ── Eyelashes ──────────────────────────────────────────────────────────
    def _lashes(self):
        head = self.head
        rng = self.rng
        lashes = []
        for sx in (-1, 1):
            E = head.eye_centre(sx)
            c = self.P.child
            for upper, count, length, curl in ((True, int(170 - 50 * c), 0.82, 0.8), (False, int(60 - 20 * c), 0.42, 0.35)):
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
        self.objects.append(to_curves("lashes", strands, 0.0095 * (1 - 0.3 * self.P.child), 0.0018, self.mats["lash"], self.col))
