"""Regional skin colour, roughness and pore maps, written per vertex.

Real skin is not one colour: cheeks, nose, ears and chin are warmer (blood
close to the surface), the eyelids and the hollows under the eyes darker
and cooler, the lips darker and redder, and a man's shaved or bearded
jaw carries a grey shadow. The forehead and nose are oilier (shinier); the
lips are moist. People who work outdoors are darker and more weathered on
the sun-facing planes.
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
        for upper, strength, width in ((True, 1.0, 0.14), (False, 0.5, 0.08)):
            pts = np.array([head.lid_point(sx, u, upper=upper, out=0.2) for u in np.linspace(-0.95, 0.95, 48)], F)
            near = np.all(np.abs(V - head.eye_centre(sx)) < 2.4, axis=1)
            if not near.any():
                continue
            d = np.min(np.linalg.norm(V[near][:, None, :] - pts[None, :, :], axis=2), axis=1)
            out[near] = np.maximum(out[near], strength * np.exp(-((d / width) ** 2)))
    return out


def maps(head, V, skin_hex, beard=False, weathered=0.0):
    """(albedo RGB, roughness, pores) for vertices V (cm)."""
    P = head.P
    s = head.s
    E = head.eye_half
    ez = head.eye_z
    ey = head.eye_y
    base = _lin3(skin_hex)
    n = len(V)
    alb = np.tile(base, (n, 1)).astype(F)
    red = base * np.array([1.2, 0.84, 0.82], F)
    dark = base * np.array([0.8, 0.76, 0.84], F)
    lipc = base * np.array([0.88, 0.56, 0.57], F)
    shade = base * np.array([0.78, 0.8, 0.86], F)
    tan = base * np.array([0.9, 0.82, 0.76], F)

    def mix(a, b, t):
        t = np.clip(t, 0, 1)[:, None]
        return a * (1 - t) + b * t

    cheeks = sum(_g(V, (sx * 4.3 * s, -7.2 * s, -0.9 * s), (2.0, 3.0, 1.9)) for sx in (-1, 1))
    nose = _g(V, head.tip, (1.1, 1.6, 1.3)) + sum(_g(V, (sx * 1.3 * head.nose_w, head.subnasale[1] + 0.9, head.subnasale[2] + 0.5), (0.7, 1.0, 0.7)) for sx in (-1, 1))
    ears = sum(_g(V, (sx * 7.3 * s, 1.4 * s, 0.4 * s), (1.3, 2.4, 3.4)) for sx in (-1, 1))
    chin = _g(V, head.pogonion, (1.6, 1.4, 1.2))
    forehead = _g(V, (0, -9.0 * s, 7.0 * s), (4.0, 3.0, 2.4))
    under = sum(_g(V, (sx * E, ey - 0.6, ez - 1.25), (1.35, 1.4, 0.55)) for sx in (-1, 1))
    lids = sum(_g(V, (sx * E, ey - 1.1, ez + 0.75), (1.25, 1.2, 0.55)) for sx in (-1, 1))
    lips = head.lip_mask(V, soft=0.1)
    alb = mix(alb, red, 0.32 * cheeks + 0.45 * nose + 0.5 * ears + 0.18 * chin + 0.1 * forehead + 0.15 * lids)
    alb = mix(alb, dark, 0.38 * under + 0.3 * lids)
    alb = mix(alb, lipc, lips)
    alb = mix(alb, base * np.array([0.22, 0.17, 0.15], F), 0.85 * lash_line(head, V))
    if beard:
        alb = mix(alb, shade, 0.55 * beard_mask(head, V))
    if weathered > 0:
        sun = np.clip(forehead + 0.6 * cheeks + nose, 0, 1)
        alb = mix(alb, tan, weathered * (0.4 + 0.4 * sun))
    # Subsurface scattering saturates colour; start a little greyer so the
    # rendered skin lands on the appearance's colour.
    lum = (alb * np.array([0.2126, 0.7152, 0.0722], F)).sum(1, keepdims=True)
    grey = 0.28 + 0.14 * darkness(skin_hex)
    alb = alb * (1 - grey) + lum * grey
    rough = np.full(n, 0.42 - 0.03 * P.child, F)
    rough += -0.1 * np.clip(forehead + nose, 0, 1) + 0.06 * ears - 0.2 * lips - 0.04 * under
    rough += 0.06 * weathered
    pores = np.full(n, 0.45, F) + 0.5 * np.clip(nose, 0, 1) + 0.3 * np.clip(cheeks, 0, 1) + 0.25 * forehead - 0.4 * lips - 0.3 * lids
    pores = np.clip(pores * (1 - 0.6 * P.child) * (1 + 0.4 * weathered), 0, 1.4)
    return alb.astype(F), np.clip(rough, 0.2, 0.8).astype(F), pores.astype(F)
