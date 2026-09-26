"""Regional skin maps, written per vertex and read by the skin material
(portrait_materials.skin).

Real skin is not one colour or one finish:

- cheeks, nose, ears and chin are warmer (blood close to the surface); the
  hollows under the eyes are darker and a little violet; the lids pinker;
- the lips are darker and redder, smoother and wetter;
- a man's jaw carries a grey-blue shadow, under a beard or as stubble;
- the forehead and nose are oilier (shinier), the cheeks drier;
- a life in the sun darkens and reddens the planes that face it, and brings
  freckles and age spots; wrinkles and pores deepen;
- people carry marks: moles, a scar or two.

Maps (all per vertex):
  albedo  colour                        rough   roughness
  oil     sheen of the oily T-zone      pores   depth of pores and skin grain
  lines   fine lines (age, sun)         freckle where freckles and age spots may be
  stubble a shaved beard's dots         lip     the red of the lips
  scar    raised or sunken scar tissue
"""
import numpy as np

import portrait_sdf as S
from common import hex_rgb

F = np.float32


def _lin3(h):
    return np.array(hex_rgb(h)[:3], F)


def _g(p, c, r):
    return S.gaussian(p, c, r).astype(F)


def _luminance(hexcol):
    return float((_lin3(hexcol) * np.array([0.2126, 0.7152, 0.0722], F)).sum())


def darkness(hexcol):
    """0 for light-brown skin (luminance 0.2 and up) to 1 for very dark skin."""
    return float(np.clip(1 - _luminance(hexcol) / 0.2, 0, 1))


def subsurface_weight(hexcol):
    """Melanin absorbs light near the surface, so darker skin shows less of the
    red glow of scattering (and scattering over-saturates a dark albedo)."""
    return round(1.0 - 0.45 * darkness(hexcol), 2)


def beard_mask(head, p):
    """Where a beard grows (0-1): cheeks below a line from the sideburn to the
    mouth corner, the jaw, chin and upper lip, down onto the neck."""
    s = head.s
    st = head.stomion
    sn = head.subnasale
    mw = head.mouth_half
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    ax = np.abs(x)
    # The cheek line: from the sideburn in front of the ear (level with the
    # cheekbone) diagonally down to just above the corner of the mouth.
    top_x, top_z = 6.6 * s, -0.2 * s
    low_x, low_z = mw + 0.7, st[2] + 0.6
    slope = (top_z - low_z) / (top_x - low_x)
    line = top_z - (top_x - ax) * slope
    cheek = np.clip((line - z) / 0.8 + 0.5, 0, 1)
    # Not on the front of the upper lip beside the nose (the moustache handles that).
    front_cheek = np.clip((ax - (mw + 0.2)) / 0.6, 0, 1) + np.clip((st[2] - 0.4 - z) / 0.5, 0, 1)
    m = cheek * np.clip(front_cheek, 0, 1)
    # Moustache: the upper lip, below the nose.
    mo = np.clip((sn[2] - 0.15 - z) / 0.25, 0, 1) * np.clip((z - (st[2] + head.up_h * 0.6)) / 0.15, 0, 1) * np.clip((mw + 0.45 - ax) / 0.4, 0, 1)
    m = np.maximum(m, mo)
    # Not on the lips, not behind the ears, and fading down the neck.
    m *= 1 - head.lip_mask(p, soft=0.12)
    m *= np.clip((0.8 - y) / 1.2, 0, 1)
    m *= np.clip((z + 14.5 * s) / 2.0, 0, 1)
    return m.astype(F)


def lash_line(head, V):
    """How close each point is to the lid margins (1 on the margin): the
    dense roots of the lashes darken it, which is what defines an eye."""
    out = np.zeros(len(V), F)
    for sx in (-1, 1):
        for upper, strength, width in ((True, 0.9, 0.1), (False, 0.35, 0.06)):
            pts = np.array([head.lid_point(sx, u, upper=upper, out=0.2) for u in np.linspace(-0.95, 0.95, 48)], F)
            near = np.all(np.abs(V - head.eye_centre(sx)) < 2.4, axis=1)
            if not near.any():
                continue
            d = np.min(np.linalg.norm(V[near][:, None, :] - pts[None, :, :], axis=2), axis=1)
            out[near] = np.maximum(out[near], strength * np.exp(-((d / width) ** 2)))
    return out


def lid_margins(head, V):
    """1 on the inner walls of the lid openings (the wet rims), 0 elsewhere."""
    out = np.zeros(len(V), F)
    R = head.eye_r
    for sx in (-1, 1):
        E = head.eye_centre(sx)
        q = V - E
        r = np.sqrt((q * q).sum(1))
        near = r < R + 0.32
        if not near.any():
            continue
        # Between the eyeball and the outer lid skin, and close to the opening.
        a_med, a_lat, upper, lower = head.fissure(sx)
        qn = q[near]
        a = np.arctan2(sx * qn[:, 0], -qn[:, 1])
        b = np.arctan2(qn[:, 2], np.hypot(qn[:, 0], qn[:, 1]))
        u = np.clip((2 * a - (a_med + a_lat)) / (a_lat - a_med), -1, 1)
        dv = np.minimum(np.abs(b - upper(u)), np.abs(b - lower(u))) * (R + 0.2)
        wall = np.clip(1 - dv / 0.12, 0, 1) * np.clip((R + 0.3 - r[near]) / 0.12, 0, 1)
        out[near] = np.maximum(out[near], wall)
    return out


def _spots(V, spots, front_y=-3.0):
    """Soft round marks (x, z, radius, strength) projected onto the front of the face."""
    out = np.zeros(len(V), F)
    front = V[:, 1] < front_y
    for x, z, r, k in spots:
        d = np.hypot(V[:, 0] - x, V[:, 2] - z)
        out = np.maximum(out, k * np.clip(1.2 - d / r, 0, 1) ** 1.5 * front)
    return out


def _segments(V, segs, front_y=-3.0):
    """Thin lines ((x0, z0), (x1, z1), width) on the front of the face (scars)."""
    out = np.zeros(len(V), F)
    front = V[:, 1] < front_y
    x, z = V[:, 0], V[:, 2]
    for (x0, z0), (x1, z1), w in segs:
        dx, dz = x1 - x0, z1 - z0
        L = dx * dx + dz * dz
        t = np.clip(((x - x0) * dx + (z - z0) * dz) / L, 0, 1)
        d = np.hypot(x - (x0 + t * dx), z - (z0 + t * dz))
        taper = np.clip(np.minimum(t, 1 - t) / 0.15, 0.3, 1)
        out = np.maximum(out, np.clip(1 - d / (w * taper), 0, 1) * front)
    return out


def maps(head, V, skin_hex, beard=False):
    """Per-vertex maps for vertices V (cm): a dict of name -> array."""
    P = head.P
    s = head.s
    E = head.eye_half
    ez = head.eye_z
    ey = head.eye_y
    c = P.child
    sun = P.sun
    age = P.age_t
    dk = darkness(skin_hex)
    base = _lin3(skin_hex)
    n = len(V)
    alb = np.tile(base, (n, 1)).astype(F)
    # Regional tints, relative to the person's own colour.
    red = base * np.array([1.22, 0.84, 0.8], F)
    under_c = base * np.array([0.76, 0.7, 0.78], F)
    lid_c = base * np.array([1.05, 0.84, 0.84], F)
    lipc = base * np.array([0.86, 0.6, 0.82], F) * (1 - 0.15 * dk)
    lipc = lipc * (1 - 0.45 * c) + base * np.array([1.0, 0.72, 0.76], F) * 0.45 * c  # a child's lips: pinker, closer to the skin
    shade = base * np.array([0.74, 0.78, 0.84], F)
    tan = base * np.array([0.88, 0.78, 0.7], F)
    yellow = base * np.array([1.03, 1.0, 0.9], F)

    def mix(a, b, t):
        t = np.clip(t, 0, 1)[:, None]
        return a * (1 - t) + b * t

    cheeks = sum(_g(V, (sx * 4.3 * s, -7.2 * s, -0.9 * s), (2.0, 3.0, 1.9)) for sx in (-1, 1))
    nose = _g(V, head.tip, (1.1, 1.6, 1.3)) + sum(_g(V, (sx * head.alar_half * 0.9, head.subnasale[1] + 0.8, head.subnasale[2] + 0.5), (0.7, 1.0, 0.7)) for sx in (-1, 1))
    bridge = _g(V, (0, head.nasion[1] - 0.8, (head.nasion[2] + head.tip[2]) / 2), (0.9, 1.5, 2.2))
    ears = sum(_g(V, (sx * 7.3 * s, 1.4 * s, 0.4 * s), (1.3, 2.4, 3.4)) for sx in (-1, 1))
    ear_tops = sum(_g(V, (sx * 7.6 * s, 2.0 * s, 2.6 * s), (1.0, 2.0, 1.2)) for sx in (-1, 1))
    chin = _g(V, head.pogonion, (1.6, 1.4, 1.2))
    forehead = _g(V, (0, -9.0 * s, 7.0 * s), (4.0, 3.0, 2.4))
    under = sum(_g(V, (sx * E, ey - 0.6, ez + head.asym(sx, "eye_z") - 1.3), (1.3, 1.4, 0.5)) for sx in (-1, 1))
    lids = sum(_g(V, (sx * E, ey - 1.1, ez + head.asym(sx, "eye_z") + 0.7), (1.2, 1.2, 0.5)) for sx in (-1, 1))
    inner = sum(_g(V, (sx * (E - 1.5), ey - 1.3, ez), (0.45, 0.8, 0.6)) for sx in (-1, 1))
    lips = head.lip_mask(V, soft=0.07)
    front = np.clip((-3.0 - V[:, 1]) / 2.0, 0, 1)

    # Colour: warmth where blood is near the surface, darker hollows.
    warm = (0.22 + 0.25 * P.redness) * cheeks + (0.3 + 0.3 * P.redness) * nose + 0.45 * ears + 0.16 * chin + 0.12 * lids + 0.3 * inner
    warm = warm * (1 + 0.5 * c * cheeks)
    alb = mix(alb, yellow, 0.35 * forehead)
    alb = mix(alb, red, warm)
    alb = mix(alb, under_c, (0.12 + 0.2 * age + 0.08 * P.bags) * (1 - 0.6 * c) * under)
    alb = mix(alb, lid_c, 0.3 * lids)
    alb = mix(alb, lipc, lips)
    # The lips: darker at the border and the corners, lighter and pinker in
    # the middle of the lower lip, where it is fullest.
    zl, top, bot = head.lip_borders(V[:, 0])
    z = V[:, 2]
    inside = np.minimum(top - z, z - bot)
    edge = np.clip(1 - inside / 0.22, 0, 1) * lips
    corner = np.clip((np.abs(V[:, 0]) / head.mouth_half - 0.55) / 0.4, 0, 1) * lips
    lower_mid = lips * (z < zl) * np.exp(-((V[:, 0] / 1.1) ** 2)) * np.exp(-(((z - (zl - head.lo_h * 0.45)) / 0.3) ** 2))
    alb = mix(alb, lipc * 0.8, (0.45 * edge + 0.35 * corner) * (1 - 0.75 * c))
    alb = mix(alb, lipc * np.array([1.15, 1.08, 1.1], F), 0.45 * lower_mid)
    # The wet margins of the lids: pink-grey, not skin.
    margin = lid_margins(head, V)
    alb = mix(alb, base * np.array([0.82, 0.62, 0.62], F), 0.6 * margin)
    alb = mix(alb, base * np.array([0.3, 0.24, 0.22], F), 0.7 * (1 - 0.45 * c) * lash_line(head, V))
    # A man's beard shadow: under a beard, or as a clean-shaven man's stubble.
    bm = beard_mask(head, V) if (beard or P.stubble > 0 or P.fuzz > 0) else np.zeros(n, F)
    if P.fuzz > 0 and not beard:
        st = head.stomion
        bm = bm * np.clip((V[:, 2] - st[2]) / 0.3, 0, 1) * np.clip((head.mouth_half + 0.3 - np.abs(V[:, 0])) / 0.5, 0, 1)
    shadow = 0.55 if beard else 0.62 * P.stubble + 0.3 * P.fuzz
    alb = mix(alb, shade, shadow * bm)
    # The sun: darker, redder planes that face it.
    sunlit = np.clip(forehead + 0.7 * cheeks + nose + bridge + 0.8 * ear_tops, 0, 1)
    alb = mix(alb, tan, sun * (0.25 + 0.35 * sunlit) * (1 - 0.7 * c))
    alb = mix(alb, red, 0.12 * sun * sunlit)
    # Moles, and scars (paler than the skin around them, a little pink on lighter skin).
    moles = _spots(V, P.moles)
    alb = mix(alb, base * np.array([0.42, 0.3, 0.24], F), moles)
    scar = _segments(V, P.scars)
    alb = mix(alb, base * np.array([1.12, 0.98, 0.98], F) * (1 + 0.25 * dk), 0.55 * scar)
    # Subsurface scattering saturates colour; start a little greyer so the
    # rendered skin lands on the appearance's colour.
    lum = (alb * np.array([0.2126, 0.7152, 0.0722], F)).sum(1, keepdims=True)
    grey = 0.28 + 0.14 * dk
    alb = alb * (1 - grey) + lum * grey

    # Finish: oily T-zone, drier cheeks; moist lips.
    tzone = np.clip(forehead + nose + 0.8 * bridge + 0.5 * chin, 0, 1)
    rough = np.full(n, 0.5 - 0.04 * c, F)
    rough += -0.12 * tzone * (0.5 + P.oil) + 0.05 * cheeks + 0.06 * ears - 0.2 * lips - 0.1 * lower_mid - 0.06 * under - 0.25 * margin
    rough += 0.06 * sun + 0.05 * age
    oil = np.clip((0.15 + 0.85 * tzone) * (0.3 + P.oil) * (1 - 0.3 * age), 0, 1) * front + 0.6 * lips + 0.5 * lower_mid + 0.8 * margin
    pores = 0.35 + 0.55 * np.clip(nose + 0.6 * bridge, 0, 1) + 0.35 * np.clip(cheeks, 0, 1) + 0.25 * forehead + 0.2 * chin - 0.4 * lips - 0.3 * lids
    pores = np.clip(pores * (1 - 0.7 * c) * (1 + 0.5 * sun + 0.3 * age), 0, 1.6)
    lines = np.clip((0.2 + 0.8 * age + 0.4 * sun) * (1 - 0.85 * c) * (1 - 0.8 * lips), 0, 1.4).astype(F) * np.ones(n, F)
    freckle = np.clip(P.freckles * sunlit * front * (1 - lips), 0, 1)
    stubble = (P.stubble * bm if not beard else 0.8 * bm) if P.stubble > 0 or beard else 0.3 * P.fuzz * bm
    return {
        "albedo": alb.astype(F),
        "rough": np.clip(rough, 0.15, 0.85).astype(F),
        "oil": oil.astype(F),
        "pores": pores.astype(F),
        "lines": lines.astype(F),
        "freckle": freckle.astype(F),
        "stubble": np.asarray(stubble, F),
        "lip": lips.astype(F),
        "scar": scar.astype(F),
    }
