"""Clothing at the neck and shoulders, and head coverings, as cloth shells.

Every garment is a thin shell (about 3 mm of wool or linen) laid over the
body, head or hair with a signed distance field, draped with folds, and
cut open where it should be open (the tunic's neckline, the mantle's front,
the face under a veil). The edges are real edges, so hems catch the light.

- tunic: every person; the robe colour with woven stripes (clavi) in the
  accent colour, as the world figures wear.
- mantle: elders, over both shoulders and open at the front (undyed wool,
  as in the world).
- veil, scarf, hood: over the head and hair, framing the face and falling
  to the shoulders (veil and hood longer, scarf closed under the chin).
- wrap: a cloth wound round the head in bands, over short hair.
- band: a woven fillet round the head, over the hair.

Units are centimetres, like the head.
"""
import math

import numpy as np

import portrait_sdf as S

F = np.float32


def shell(outer, thickness):
    """A cloth layer: the skin of `outer`, `thickness` deep."""

    def f(p):
        d = outer(p)
        return np.maximum(d, -d - thickness)

    return S.Fn(f, outer.bbox)


def undulation(seed, amp=0.2, count=6, spread=(3.0, 6.0)):
    """Soft, irregular swelling in all directions (cloth bunched on itself)."""
    rng = np.random.default_rng(seed)
    dirs = rng.normal(size=(count, 3)).astype(F)
    dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    ks = (2 * math.pi / rng.uniform(spread[0], spread[1], count)).astype(F)
    phs = rng.uniform(0, 2 * math.pi, count).astype(F)
    a = amp / math.sqrt(count)

    def f(p):
        out = np.zeros(len(p), F)
        for d, k, ph in zip(dirs, ks, phs):
            out += a * np.sin(k * (p @ d) + ph)
        return out

    return f


def drape_folds(seed, axis_y=1.5, amp=0.3, count=7, spread=(2.5, 6.0), sway=0.06, top=None):
    """Vertical folds hanging round a vertical axis: sinusoids across the
    cloth with drifting phase, strongest lower down."""
    rng = np.random.default_rng(seed)
    ks = rng.uniform(2 * math.pi / spread[1], 2 * math.pi / spread[0], count).astype(F)
    phs = rng.uniform(0, 2 * math.pi, count).astype(F)
    amps = (amp * rng.uniform(0.5, 1.0, count) / math.sqrt(count)).astype(F)
    drift = rng.uniform(-sway, sway, count).astype(F)

    def f(p):
        x, y, z = p[:, 0], p[:, 1] - axis_y, p[:, 2]
        arc = np.arctan2(x, -y) * 11.0  # distance round the body (cm, roughly)
        out = np.zeros(len(p), F)
        for k, ph, a, dr in zip(ks, phs, amps, drift):
            out += a * np.sin(k * arc + ph + dr * z * k)
        if top is not None:
            out *= np.clip((top - z) / 6.0, 0.15, 1.0)
        return out

    return f


class Clothes:
    def __init__(self, head, params, hair_lift=1.0, head_shape=None):
        self.head = head
        self.P = params
        self.a = params.appearance
        self.hair_lift = hair_lift
        # The head as a field (in practice a sampled grid: the head is costly to evaluate).
        self.head_shape = head_shape or head.shape
        self.parts = {}  # name -> (shape, material key, box lo, box hi, voxel)
        # Where hair may not go (positive inside cloth), or None.
        self.obstacle = None
        self._tunic()
        if self.a["build"] == "elder":
            self._mantle()
        kind = self.a["headwear"]
        if kind in ("veil", "scarf", "hood"):
            self._covering(kind)
        elif kind == "wrap":
            self._wrap()
        elif kind == "band":
            self._band()

    # ── Body garments ──────────────────────────────────────────────────────
    def _neck_hole(self, extra, front_z, back_z):
        """The opening round the neck: a cylinder above a tilted neckline."""
        head = self.head
        nr = head._neck_radius()
        axis = np.array([0.0, 1.2 * head.s], F)
        slope = (back_z - front_z) / 12.0

        def f(p):
            q = np.hypot(p[:, 0] - axis[0], (p[:, 1] - axis[1]) * 1.05) - (nr + extra)
            line = front_z + (p[:, 1] + 6.0) * slope
            return np.maximum(q, line - p[:, 2])

        return S.Fn(f, ((-12, -12, front_z - 3), (12, 12, 20)))

    def _tunic(self):
        head = self.head
        body = head.body()
        folds = drape_folds(self.P.seed + 1, amp=0.45, count=8, top=-14.0)

        def outer_f(p):
            return body(p) - 0.45 - folds(p)

        outer = S.Fn(outer_f, ((-30, -16, -45), (30, 18, -5)))
        cloth = shell(outer, 0.36)
        hole = self._neck_hole(0.9, -17.5 * head.s * head.body_z, -13.5 * head.s * head.body_z)
        self.parts["tunic"] = (S.Subtract(cloth, hole, 0.25), "tunic", (-24, -14, -27), (24, 16, -8), 0.14)

    def _mantle(self):
        head = self.head
        body = head.body()
        folds = drape_folds(self.P.seed + 2, amp=0.8, count=6, spread=(3.0, 8.0), top=-16.0)

        def outer_f(p):
            return body(p) - 1.35 - folds(p)

        outer = S.Fn(outer_f, ((-31, -17, -45), (31, 19, -5)))
        cloth = shell(outer, 0.46)
        hole = self._neck_hole(1.6, -16.0 * head.s * head.body_z, -11.5 * head.s * head.body_z)

        def front_f(p):
            # Open down the front, widening toward the chest.
            half = 5.5 + np.clip(-16.0 - p[:, 2], 0, None) * 0.35
            return np.maximum(np.abs(p[:, 0]) - half, p[:, 1] + 1.0)

        opening = S.Fn(front_f, ((-20, -20, -45), (20, 0, -5)))
        self.parts["mantle"] = (S.Subtract(S.Subtract(cloth, hole, 0.3), opening, 0.6), "mantle", (-25, -15, -27), (25, 17, -8), 0.15)

    # ── Head coverings ─────────────────────────────────────────────────────
    def _hair_volume(self, base, top_extra):
        """The head with the hair under a covering: thin at the brow, fuller at the crown and back."""
        head = self.head
        s = head.s

        def lift(p):
            z = p[:, 2]
            y = p[:, 1]
            up = np.clip((z - 3.0 * s) / 8.0, 0, 1)
            back = np.clip((y + 2.0) / 8.0, 0, 1)
            return base + top_extra * (0.55 * up + 0.45 * back * np.clip((z + 4.0) / 8.0, 0, 1))

        return S.Offset(self.head_shape, S.Fn(lift, ((-15, -15, -25), (15, 15, 20))))

    def _covering(self, kind):
        head = self.head
        s = head.s
        env = self._hair_volume(0.55, 1.9 if self.P.hair_style == "long" else 0.9)
        # A bun of hair gathered at the back, for women.
        if self.P.hair_style == "long":
            env = S.Union([env, S.Ellipsoid((0, 7.8 * s, 4.5 * s), (4.2, 3.2, 3.6))], 2.0)
        # The cloth falls from the sides of the head to the shoulders: loosely
        # for a veil or hood, closer for a scarf (a smaller head cloth).
        body = head.body()
        drape = S.Offset(body, 1.4 if kind != "scarf" else 1.2)
        low = -40.0
        if kind == "scarf":
            curtain = S.RoundCone((0, 1.6 * s, 3.0 * s), (0, 2.1 * s, -20.0 * s), 8.4 * s, 10.0 * s)
        else:
            curtain = S.RoundCone((0, 1.9 * s, 3.0 * s), (0, 2.4 * s, -20.0 * s), 8.9 * s, 10.8 * s)
        cover = S.Union([env, curtain], 3.0)
        cover = S.Union([cover, S.Clip(drape, (-40, -40, low), (40, 40, 0))], 2.5)
        folds = drape_folds(self.P.seed + 3, amp=0.4, count=7, spread=(3.0, 8.0), top=4.0)
        outer = S.Offset(cover, S.Fn(folds, ((-40, -40, -45), (40, 40, 20))))
        cloth = shell(outer, 0.4)
        # The opening for the face, as an angle round the head, so the hem
        # follows the cloth: an arch over the brow, edges hanging in front of
        # the ears, and open down the front onto the chest.
        top_z = 8.9 * s if kind != "hood" else 8.0 * s
        face = 50.0 if kind != "scarf" else 47.0
        zc = 1.0 * s

        def open_f(p):
            x, y, z = p[:, 0], p[:, 1], p[:, 2]
            az = np.degrees(np.arctan2(np.abs(x), -(y - 1.5)))
            t = np.clip((z - zc) / (top_z - zc), 0, 1)
            theta = np.where(
                z > zc,
                # (closing a little past the top, so no seam runs up the middle)
                (face + 5.0) * np.sqrt(np.clip(1 - t * t, 0, 1)) - 5.0,
                np.interp(z, [-40.0, -20.0, -12.0 * s, zc], [34.0, 38.0, face - 4.0, face]),
            )
            return (az - theta) * (math.pi / 180.0) * 9.0

        opening = S.Fn(open_f, ((-15, -25, -45), (15, 0, 20)))
        cut = S.Subtract(cloth, opening, 0.35)
        self.parts["headwear"] = (cut, "headwear", (-26, -17, -27), (26, 19, 21), 0.15)

        # Hair must stay under the cloth, except where the face shows.
        def obstacle(p):
            return np.minimum(outer(p) + 0.45, open_f(p))

        self.obstacle = S.Fn(obstacle, ((-30, -17, low - 2), (30, 19, 21)))

    def _wrap(self):
        head = self.head
        s = head.s
        env = self._hair_volume(0.8 * self.hair_lift, 0.3)
        rng = np.random.default_rng(self.P.seed + 5)
        spacing = 2.1 + rng.uniform(-0.2, 0.2)
        tilt = (0.35 + rng.uniform(-0.08, 0.08)) * (1 if rng.random() < 0.5 else -1)
        phase = rng.uniform(0, 1)
        nA = np.array([tilt, 0.15, 1.0], F)
        nA /= np.linalg.norm(nA)
        wr = undulation(self.P.seed + 6, amp=0.35, count=7, spread=(3.0, 7.0))
        # The lower edge: across the upper forehead, above the ears, over the occiput.
        edge_tilt = math.radians(10)
        en = np.array([0, math.sin(edge_tilt), math.cos(edge_tilt)], F)
        ec = np.array([0, 0.0, 6.3 * s], F)

        def above_edge(p):
            return (p - ec) @ en

        def layers(p):
            """Wound cloth: each turn rises gently round the head and ends in a
            soft edge over the turn below."""
            t = (p @ nA) / spacing + phase
            f = t - np.floor(t)
            edge = np.clip((f - 0.55) / 0.45, 0, 1)
            return 0.42 * np.sin(np.pi * f * 0.5) * (1 - edge * edge * (3 - 2 * edge))

        def thick(p):
            # Thin where it meets the forehead, fuller above; turns and creases on top.
            up = np.clip(above_edge(p) / 3.0, 0, 1)
            return 0.45 + 1.25 * up + (layers(p) + wr(p)) * np.clip(above_edge(p) / 1.2, 0, 1)

        mass = S.Offset(env, S.Fn(thick, ((-16, -16, 0), (16, 16, 22))))
        body = S.Intersect(mass, S.Fn(lambda p: -above_edge(p), ((-16, -16, -5), (16, 16, 22))), 0.3)

        # A rolled hem round the lower edge, lying on the forehead and hair.
        def roll(p):
            return np.hypot(env(p) - 0.55, above_edge(p) - 0.45) - 0.5

        wrap = S.Union([body, S.Fn(roll, ((-14, -15, 0), (14, 15, 14)))], 0.35)
        self.parts["headwear"] = (wrap, "headwear", (-12, -14, 2), (12, 14, 19), 0.12)
        self.obstacle = S.Fn(lambda p: 0.1 - wrap(p), wrap.bbox)

    def _band(self):
        head = self.head
        s = head.s
        env = self._hair_volume(0.6 * self.hair_lift, 0.3)
        tilt = math.radians(11)
        n = np.array([0, math.sin(tilt), math.cos(tilt)], F)
        c = np.array([0, 0.0, 6.4 * s], F)

        def band(p):
            d_env = env(p) - 0.25
            d_pl = (p - c) @ n
            q1 = np.abs(d_env) - 0.3
            q2 = np.abs(d_pl) - 0.85
            return np.minimum(np.maximum(q1, q2), 0) + np.hypot(np.maximum(q1, 0), np.maximum(q2, 0)) - 0.08

        knot = S.Ellipsoid((0, 9.9 * s, 4.9 * s), (1.2, 0.8, 1.0))
        shape = S.Union([S.Fn(band, ((-12, -14, 2), (12, 14, 13))), knot], 0.4)
        self.parts["headwear"] = (shape, "headwear", (-11, -13, 2), (11, 13, 13), 0.12)
        self.obstacle = S.Fn(lambda p: 0.05 - shape(p), shape.bbox)
