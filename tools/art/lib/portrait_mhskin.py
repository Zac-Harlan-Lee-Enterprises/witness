"""Regional skin maps on the MakeHuman head, written per vertex and read by
the skin material (portrait_materials.skin).

Real skin is not one colour or one finish:

- cheeks, nose, ears and chin are warmer (blood close to the surface); the
  hollows under the eyes are darker and a little violet; the lids pinker;
- the lips are darker and redder, smoother; the inside of the mouth wet;
- a man's jaw carries a grey-blue shadow, under a beard or as stubble;
- the forehead and nose are oilier (shinier), the cheeks drier;
- a life in the sun darkens and reddens the planes that face it, and brings
  freckles and age spots; wrinkles and pores deepen;
- people carry marks: moles, a scar or two.

Every map is computed on the person's rest shape (no expression), so it is
the same in every picture of them and moves with the skin.

Maps (all per vertex):
  albedo  colour                        rough   roughness
  oil     sheen of the oily T-zone      pores   depth of pores and skin grain
  lines   fine lines (age, sun)         freckle where freckles and age spots may be
  stubble a shaved beard's dots         lip     the red of the lips
  scar    scar tissue                   thin    thin tissue light shouldn't glow through
  mouth   the inside of the mouth       rest    the rest position (cm), for the shader's patterns
  wf, wc, wg, wu  wrinkle depth: forehead, crow's feet, between the brows, under the eyes
"""
import numpy as np

from common import hex_rgb

F = np.float32


def _lin3(h):
    return np.array(hex_rgb(h)[:3], F)


def _g(p, c, r):
    q = (p - np.array(c, F)) / np.array(r, F)
    return np.exp(-np.einsum("ij,ij->i", q, q)).astype(F)


def _smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return (t * t * (3 - 2 * t)).astype(F)


def _luminance(hexcol):
    return float((_lin3(hexcol) * np.array([0.2126, 0.7152, 0.0722], F)).sum())


def darkness(hexcol):
    """0 for light-brown skin (luminance 0.2 and up) to 1 for very dark skin."""
    return float(np.clip(1 - _luminance(hexcol) / 0.2, 0, 1))


def subsurface_weight(hexcol):
    """Melanin absorbs light near the surface, so darker skin shows less of the
    red glow of scattering (and scattering over-saturates a dark albedo)."""
    return round(1.0 - 0.4 * darkness(hexcol), 2)


def occlusion(V, Q, rays=24, reach=2.5):
    """How enclosed each vertex is (0 open … 1 inside a cavity): the share of
    rays over the hemisphere around its normal that hit the skin within
    `reach` cm. Finds the nostrils, the inside of the mouth, the ear canals."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree

    tris = []
    for q in Q:
        tris.append((int(q[0]), int(q[1]), int(q[2])))
        tris.append((int(q[0]), int(q[2]), int(q[3])))
    tree = BVHTree.FromPolygons([Vector(v) for v in V.tolist()], tris, all_triangles=True)
    # Vertex normals.
    a, b, c, d = V[Q[:, 0]], V[Q[:, 1]], V[Q[:, 2]], V[Q[:, 3]]
    fn = np.cross(c - a, d - b)
    N = np.zeros_like(V)
    for k in range(4):
        np.add.at(N, Q[:, k], fn)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    rng = np.random.default_rng(7)
    dirs = rng.normal(size=(rays, 3)).astype(F)
    dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    out = np.zeros(len(V), F)
    for i in range(len(V)):
        n = N[i]
        p = Vector((V[i] + n * 0.02).tolist())
        hits = 0
        for dv in dirs:
            if float(dv @ n) < 0:
                dv = -dv
            loc, _, _, dist = tree.ray_cast(p, Vector(dv.tolist()), reach)
            if loc is not None:
                hits += 1
        out[i] = hits / rays
    return out, N


def beard_mask(head, V, base_idx):
    """Where a beard grows (0-1): cheeks below a line from the sideburn to the
    mouth corner, the jaw, chin and upper lip, down onto the neck."""
    L = head.rest
    R = head.R
    s = head.s
    st = L["stomion"]
    sn = L["subnasale"]
    mw = L["mouth_half"]
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    ax = np.abs(x)
    ear = L["ear"][1]
    ex = abs(float(ear[0]))
    # The cheek line: from the foot of the sideburn, in front of the ear
    # lobe, diagonally down to a little above the corner of the mouth.
    top_x, top_z = ex - 1.6 * s, ear[2] - 1.6 * s
    low_x, low_z = mw + 0.6, st[2] + 1.0
    slope = (top_z - low_z) / (top_x - low_x)
    line = top_z - (top_x - ax) * slope
    # A natural edge: the line wanders, and the hair thins out over a
    # centimetre and a half above it rather than stopping (a hard edge read
    # as a patch stuck on the cheek).
    line = line + 0.35 * np.sin(ax * 2.1 + 1.3 * np.sign(x)) + 0.22 * np.sin(ax * 5.3 + z * 1.7)
    cheek = np.clip((line - z) / 1.6 + 0.35, 0, 1) ** 1.6
    # The sideburns: a band in front of each ear up to the scalp.
    side = np.clip((ax - (ex - 2.1 * s)) / 0.7, 0, 1) * np.clip((ex - 0.5 * s - ax) / 0.4, 0, 1) * np.clip((ear[2] + 3.0 * s - z) / 1.0, 0, 1)
    cheek = np.maximum(cheek, side)
    # Not on the ears or behind them.
    cheek *= np.clip((ear[1] - 0.9 * s - y) / 0.8, 0, 1)
    # Not on the front of the upper lip beside the nose (the moustache handles that).
    front_cheek = np.clip((ax - (mw + 0.2)) / 0.6, 0, 1) + np.clip((st[2] - 0.4 - z) / 0.5, 0, 1)
    m = cheek * np.clip(front_cheek, 0, 1)
    # Moustache: the upper lip, below the nose.
    mo = np.clip((sn[2] - 0.2 - z) / 0.3, 0, 1) * np.clip((z - st[2] - 0.15) / 0.2, 0, 1) * np.clip((mw + 0.45 - ax) / 0.4, 0, 1)
    m = np.maximum(m, mo * (y < st[1] + 1.5))
    # Not on the lips, not inside the mouth, fading down the neck.
    m *= 1 - _smooth(R.lips[base_idx], 0.25, 0.5)
    m *= np.clip((L["menton"][2] - 5.5 * s - z) * -1 / 2.0, 0, 1)
    return m.astype(F)


def _spots(V, spots, front_y=-3.0):
    """Soft round marks (x, z, radius, strength) projected onto the front of the face."""
    out = np.zeros(len(V), F)
    front = V[:, 1] < front_y
    for x, z, r, k in spots:
        d = np.hypot(V[:, 0] - x, V[:, 2] - z)
        out = np.maximum(out, k * np.clip(1.2 - d / r, 0, 1) ** 1.5 * front)
    return out


def segments(V, segs, front_y=-3.0):
    """Thin lines ((x0, z0), (x1, z1), width) on the front of the face (scars)."""
    out = np.zeros(len(V), F)
    front = V[:, 1] < front_y
    x, z = V[:, 0], V[:, 2]
    for (x0, z0), (x1, z1), w in segs:
        dx, dz = x1 - x0, z1 - z0
        Ls = dx * dx + dz * dz
        t = np.clip(((x - x0) * dx + (z - z0) * dz) / Ls, 0, 1)
        d = np.hypot(x - (x0 + t * dx), z - (z0 + t * dz))
        taper = np.clip(np.minimum(t, 1 - t) / 0.15, 0.3, 1)
        out = np.maximum(out, np.clip(1 - d / (w * taper), 0, 1) * front)
    return out


def lash_line(head, V):
    """How close each point is to the lid margins (1 on the margin): the
    dense roots of the lashes darken it, which is what defines an eye."""
    out = np.zeros(len(V), F)
    for sx in (-1, 1):
        for upper, strength, width in ((True, 0.9, 0.09), (False, 0.35, 0.06)):
            pts = np.array([head.lid_point(sx, u, upper=upper, out=0.12, rest=True) for u in np.linspace(-0.95, 0.95, 48)], F)
            near = np.all(np.abs(V - head.eye_centre(sx, rest=True)) < 2.6, axis=1)
            if not near.any():
                continue
            d = np.min(np.linalg.norm(V[near][:, None, :] - pts[None, :, :], axis=2), axis=1)
            out[near] = np.maximum(out[near], strength * np.exp(-((d / width) ** 2)))
    return out


def lid_rims(head, V):
    """1 on the inner walls of the lid openings (the wet rims, facing the eyeball)."""
    out = np.zeros(len(V), F)
    for sx in (-1, 1):
        c = head.eye_centre(sx, rest=True)
        r = np.linalg.norm(V - c, axis=1)
        R = head.eye_r
        out = np.maximum(out, np.clip((R + 0.28 - r) / 0.14, 0, 1) * (V[:, 1] < c[1] - 0.3 * R))
    return out


def maps(head, V, base_idx, cav, skin_hex, beard=False):
    """Per-vertex maps for skin vertices V (rest shape, cm); `base_idx` are
    their indices in MakeHuman's base mesh, `cav` their occlusion."""
    P = head.P
    R = head.R
    L = head.rest
    s = head.s
    c = P.child
    sun = P.sun
    age = P.age_t
    dk = darkness(skin_hex)
    base = _lin3(skin_hex)
    n = len(V)
    alb = np.tile(base, (n, 1)).astype(F)
    red = base * np.array([1.22, 0.84, 0.8], F)
    under_c = base * np.array([0.78, 0.7, 0.8], F)
    lid_c = base * np.array([1.05, 0.84, 0.84], F)
    lipc = base * np.array([0.9, 0.6, 0.62], F) * (1 - 0.12 * dk)
    lipc = lipc * (1 - 0.45 * c) + base * np.array([1.0, 0.72, 0.74], F) * 0.45 * c  # a child's lips: pinker, closer to the skin
    shade = base * np.array([0.74, 0.78, 0.84], F)
    tan = base * np.array([0.88, 0.78, 0.7], F)
    yellow = base * np.array([1.03, 1.0, 0.9], F)
    mouthc = np.array([0.36, 0.09, 0.08], F) * (0.8 + 0.3 * float(base.mean() / 0.25))

    def mix(a, b, t):
        t = np.clip(t, 0, 1)[:, None]
        return a * (1 - t) + b * t

    bi = base_idx
    cheeks = np.clip(R.cheek[1][bi] + R.cheek[-1][bi], 0, 1)
    tip = L["tip"]
    nose = _g(V, tip, (1.1, 1.6, 1.3)) + np.clip(R.nose[bi], 0, 1) * 0.4
    bridge = _g(V, (0, L["nasion"][1] - 0.6, (L["nasion"][2] + tip[2]) / 2), (0.9, 1.5, 2.2))
    ears = np.clip(R.ear[1][bi] + R.ear[-1][bi], 0, 1)
    ear_tops = ears * _smooth(V[:, 2], L["ear"][1][2] + 0.5, L["ear"][1][2] + 2.5)
    chin = np.clip(R.chin[bi], 0, 1)
    brow = np.clip(R.brow[bi], 0, 1)
    forehead = np.clip(R.forehead[bi], 0, 1) * _smooth(V[:, 2], head.eye_z + 2.0, head.eye_z + 3.5) * (V[:, 1] < -3)
    under = np.clip(R.bag[1][bi] + R.bag[-1][bi], 0, 1)
    lids = np.clip(R.upper_lid[1][bi] + R.upper_lid[-1][bi], 0, 1)
    inner = sum(_g(V, head.lid_point(sx, -1.0, rest=True) + np.array([sx * -0.3, -0.2, 0], F), (0.45, 0.6, 0.5)) for sx in (-1, 1))
    lips_raw = R.lips[bi]
    lips = _smooth(lips_raw, 0.3, 0.55)
    front = np.clip((-3.0 - V[:, 1]) / 2.0, 0, 1)
    # Inside the mouth: enclosed and behind the lips' meeting line.
    st = L["stomion"]
    mouth = _smooth(cav, 0.45, 0.75) * (V[:, 1] > st[1] + 0.25) * (np.abs(V[:, 0]) < 3.5 * s) * (np.abs(V[:, 2] - st[2]) < 3.0 * s)
    nost = _smooth(cav, 0.4, 0.7) * _g(V, (0, L["subnasale"][1] - 0.6, L["subnasale"][2] + 0.4), (1.6, 1.3, 0.9)) * (1 - mouth)
    ear_in = _smooth(cav, 0.45, 0.8) * ears

    # Colour: warmth where blood is near the surface, darker hollows.
    warm = (0.22 + 0.25 * P.redness) * cheeks + (0.3 + 0.3 * P.redness) * np.clip(nose, 0, 1) + 0.4 * ears + 0.16 * chin + 0.12 * lids + 0.3 * inner
    warm = warm * (1 + 0.5 * c * cheeks)
    alb = mix(alb, yellow, 0.35 * forehead)
    alb = mix(alb, red, warm)
    alb = mix(alb, under_c, (0.12 + 0.22 * age + 0.1 * min(1.0, 0.3 + age)) * (1 - 0.6 * c) * under)
    alb = mix(alb, lid_c, 0.3 * lids)
    alb = mix(alb, lipc, lips)
    # The lips darker at the border, lighter where the lower lip is fullest.
    edge = lips * (1 - _smooth(lips_raw, 0.55, 0.85))
    alb = mix(alb, lipc * 0.82, 0.5 * edge * (1 - 0.75 * c))
    rims = lid_rims(head, V)
    alb = mix(alb, base * np.array([0.7, 0.55, 0.52], F), 0.6 * rims)
    alb = mix(alb, base * np.array([0.3, 0.24, 0.22], F), 0.75 * (1 - 0.45 * c) * lash_line(head, V))
    # A man's beard shadow: under a beard, or as a clean-shaven man's stubble.
    bm = beard_mask(head, V, base_idx) if (beard or P.stubble > 0 or P.fuzz > 0) else np.zeros(n, F)
    if P.fuzz > 0 and not beard:
        bm = bm * np.clip((V[:, 2] - st[2]) / 0.3, 0, 1) * np.clip((L["mouth_half"] + 0.3 - np.abs(V[:, 0])) / 0.5, 0, 1)
    shadow = 0.55 if beard else 0.6 * P.stubble + 0.3 * P.fuzz
    alb = mix(alb, shade, shadow * bm)
    # The sun: darker, redder planes that face it.
    sunlit = np.clip(forehead + 0.7 * cheeks + np.clip(nose, 0, 1) + bridge + 0.8 * ear_tops, 0, 1)
    alb = mix(alb, tan, sun * (0.22 + 0.35 * sunlit) * (1 - 0.7 * c))
    alb = mix(alb, red, 0.12 * sun * sunlit)
    # Cavities: dark (light scattered through the skin would make them glow).
    alb = mix(alb, base * np.array([0.3, 0.19, 0.17], F), 0.9 * nost)
    alb = mix(alb, base * np.array([0.45, 0.3, 0.27], F), 0.7 * ear_in)
    alb = mix(alb, mouthc, mouth)
    # Moles, and scars (paler than the skin around them).
    moles = _spots(V, P.moles)
    alb = mix(alb, base * np.array([0.42, 0.3, 0.24], F), moles)
    scar = segments(V, P.scars)
    alb = mix(alb, base * np.array([1.12, 0.98, 0.98], F) * (1 + 0.25 * dk), 0.55 * scar)
    # Subsurface scattering saturates colour; start a little greyer so the
    # rendered skin lands on the appearance's colour.
    lum = (alb * np.array([0.2126, 0.7152, 0.0722], F)).sum(1, keepdims=True)
    grey = 0.14 + 0.1 * dk
    alb = alb * (1 - grey) + lum * grey

    # Finish: oily T-zone, drier cheeks; lips a little smoother; the inside of the mouth wet.
    tzone = np.clip(forehead + np.clip(nose, 0, 1) + 0.8 * bridge + 0.5 * chin, 0, 1)
    rough = np.full(n, 0.46 - 0.02 * c, F)
    rough += -0.12 * tzone * (0.5 + P.oil) + 0.05 * cheeks + 0.06 * ears - 0.08 * lips - 0.06 * under - 0.25 * rims - 0.3 * mouth
    rough += 0.06 * sun + 0.05 * age
    oil = np.clip((0.15 + 0.85 * tzone) * (0.3 + P.oil) * (1 - 0.3 * age), 0, 1) * front * (1 - lips) + 0.1 * lips * (1 - c) + 0.5 * rims + 0.8 * mouth
    pores = 0.35 + 0.55 * np.clip(nose + 0.6 * bridge, 0, 1) + 0.35 * cheeks + 0.25 * forehead + 0.2 * chin - 0.4 * lips - 0.3 * lids
    pores = np.clip(pores * (1 - 0.7 * c) * (1 + 0.5 * sun + 0.3 * age) * (1 - mouth), 0, 1.6)
    lines = np.clip((0.2 + 0.8 * age + 0.4 * sun) * (1 - 0.85 * c) * (1 - 0.8 * lips) * (1 - mouth), 0, 1.4).astype(F)
    freckle = np.clip(P.freckles * sunlit * front * (1 - lips), 0, 1)
    stubble = (P.stubble * bm if not beard else 0.8 * bm) if P.stubble > 0 or beard else 0.3 * P.fuzz * bm
    # Wrinkles: how deep each family may be at rest (age, sun, a life of
    # squinting); expressions deepen them (portrait_person adds the strain).
    lined = (1 - 0.95 * c) * (1 - lips) * (1 - mouth)
    wf = forehead * (0.04 + 0.9 * age + 0.3 * max(0.0, sun - 0.3)) * lined * (0.7 if P.sex == "f" else 1.0)
    crow = sum(_g(V, head.lid_point(sx, 1.0, rest=True) + np.array([sx * 1.2, 0.6, -0.1], F), (1.1, 1.4, 1.1)) for sx in (-1, 1))
    wc = crow * (0.1 + 1.0 * age + 0.5 * sun) * lined
    gl = _g(V, (0, L["glabella"][1], L["glabella"][2] - 0.3), (0.9, 1.2, 1.0))
    wg = gl * (0.03 + 0.7 * age) * lined * (0.6 if P.sex == "f" else 1.0)
    wu = under * (0.1 + 0.9 * age + 0.2 * sun) * lined
    return {
        "albedo": alb.astype(F),
        "rough": np.clip(rough, 0.12, 0.85).astype(F),
        "oil": oil.astype(F),
        "pores": pores.astype(F),
        "lines": lines.astype(F),
        "freckle": freckle.astype(F),
        "stubble": np.asarray(stubble, F),
        "lip": lips.astype(F),
        "scar": scar.astype(F),
        "thin": np.clip(rims + nost + 0.8 * mouth, 0, 1).astype(F),
        "mouth": mouth.astype(F),
        "rest": V.astype(F),
        "wf": wf.astype(F),
        "wc": wc.astype(F),
        "wg": wg.astype(F),
        "wu": wu.astype(F),
        # Where each family can appear at all (for the expression's strain).
        "_regions": {"wf": (forehead * lined).astype(F), "wc": (crow * lined).astype(F), "wg": (gl * lined).astype(F), "wu": (under * lined).astype(F)},
    }


def strain(V_rest, V_posed, Q):
    """How much the skin around each vertex is compressed by the expression
    (0 none … 1 strongly): where skin bunches, wrinkles deepen."""
    n = len(V_rest)
    num = np.zeros(n, F)
    cnt = np.zeros(n, F)
    for k in range(4):
        a, b = Q[:, k], Q[:, (k + 1) % 4]
        lr = np.linalg.norm(V_rest[a] - V_rest[b], axis=1)
        lp = np.linalg.norm(V_posed[a] - V_posed[b], axis=1)
        ratio = lp / np.maximum(lr, 1e-6)
        for v in (a, b):
            np.add.at(num, v, np.minimum(ratio, 1.0))
            np.add.at(cnt, v, 1)
    mean = num / np.maximum(cnt, 1)
    return np.clip((1.0 - mean) / 0.12, 0, 1).astype(F)

