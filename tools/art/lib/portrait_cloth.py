"""Clothing at the neck and shoulders, and head coverings, as cloth shells.

Every garment is a thin shell (about 3 mm of wool or linen) laid over the
body, head or hair with a signed distance field, draped with folds, and
cut open where it should be open (the tunic's neckline, the mantle's front,
the face under a veil). The edges are real edges, so hems catch the light.

- tunic: every person; the robe colour with woven stripes (clavi) in the
  accent colour, as the world figures wear.
- mantle: elders, over both shoulders and open at the front (undyed wool,
  as in the world).
- veil, scarf, hood: over the head and hair, resting on the crown, framing
  the face and falling to the shoulders in deep folds, with a thick, rolled
  hem round the face.
- wrap: a long cloth wound round the head in overlapping bands: each turn
  lies on the turns before it, crossing them, with pleats along it and a
  rolled edge; the end of the cloth hangs behind one ear. The weave follows
  each band (per-vertex coordinates for the material).
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


def _smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


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
        self.bands = None
        self.head = head
        self.P = params
        self.a = params.appearance
        self.hair_lift = hair_lift
        # The head as a field (in practice a sampled grid: the head is costly to evaluate).
        self.head_shape = head_shape or head.shape
        self.parts = {}  # name -> (shape, material key, box lo, box hi, voxel)
        self.under_cloth = []  # what is worn, for the wrap's tail to lie on
        # Where hair may not go (positive inside cloth), or None.
        self.obstacle = None
        self._tunic()
        if self.a["build"] == "elder":
            self._mantle()
        kind = params.head_style
        if kind in ("veil", "scarf", "hood"):
            self._covering(kind)
        elif kind == "headcloth":
            self._covering("scarf")
            self._cord()
        elif kind == "wrap":
            self._wrap()
        elif kind == "band":
            self._band()

    def attributes(self, name, V):
        """Extra per-vertex maps for a garment's mesh (name -> values), or None.
        The wrap's weave runs along each band: `cloth_uv` is (along, across)
        in centimetres on the band a point belongs to."""
        if name == "headwear" and self.bands:
            return {"cloth_uv": self._band_uv(V)}
        return None

    # ── Body garments ──────────────────────────────────────────────────────
    def _neck_hole(self, extra, front_z, back_z):
        """The opening round the neck: a cylinder above a tilted neckline."""
        head = self.head
        nr = head._neck_radius()
        axis = np.array([0.0, head.neck_axis_y], F)
        slope = (back_z - front_z) / 12.0

        def f(p):
            # (Third pass: reaching further forward, so the opening takes in
            # the whole throat: cloth laid over the body's neck, which begins
            # under the chin, poked through the front of it as a thin slit.)
            q = np.hypot(p[:, 0] - axis[0], (p[:, 1] - axis[1]) * 0.85) - (nr + extra)
            line = front_z + (p[:, 1] + 6.0) * slope
            return np.maximum(q, line - p[:, 2])

        return S.Fn(f, ((-12, -12, front_z - 3), (12, 12, 20)))

    def _tunic(self):
        """The tunic: folds from the shoulders, a hemmed neckline (turned
        over, so it stands a little proud), and for most men and children a
        short slit at the front, where the notch between the collarbones shows."""
        head = self.head
        s = head.s
        P = self.P
        body = head.body()
        folds = drape_folds(P.seed + 1, amp=0.5, count=8, top=-14.0)
        creases = drape_folds(P.seed + 11, amp=0.14, count=6, spread=(1.0, 2.5), top=-16.0, sway=0.15)
        # The neckline just above the notch between the collarbones.
        notch = head.notch_z
        front_z = notch + 0.7 - 0.8 * (1 - P.masc)
        hole = self._neck_hole(0.9, front_z, notch + 4.5 * s)
        slit_len = 0.0 if P.sex == "f" else (4.5 + 2.0 * ((P.seed >> 3) % 7) / 6.0) * s
        slit_w = 0.8 * s

        def opening(p):
            d = hole(p)
            if slit_len > 0:
                # A narrow slit down from the front of the neckline.
                depth = np.clip((front_z + 0.5 - p[:, 2]) / slit_len, 0, 1)
                half = slit_w * (1 - depth) + 0.05
                slit = np.maximum(np.abs(p[:, 0]) - half, np.maximum(p[:, 2] - front_z - 1.0, front_z - slit_len - p[:, 2]))
                slit = np.maximum(slit, p[:, 1] + 2.0)
                d = np.minimum(d, slit)
            return d

        def outer_f(p):
            hem = np.exp(-((opening(p) / 0.55) ** 2))
            return body(p) - 0.45 - folds(p) - creases(p) - 0.12 * hem

        # Nothing of the tunic above the shoulders, and in front of the neck
        # nothing above the neckline (it would wrap the underside of the jaw).
        top = notch + 6.0 * s
        front_y = head.neck_axis_y - head._neck_radius() * 1.1

        def cloth_f(p):
            d = outer_f(p)
            hem = np.exp(-((opening(p) / 0.55) ** 2))
            cap = np.where(p[:, 1] < front_y, p[:, 2] - (notch + 3.0 * s), p[:, 2] - top)
            return np.maximum(np.maximum(d, -d - (0.34 + 0.26 * hem)), cap)

        cloth = S.Fn(cloth_f, ((-30, -16, -45), (30, 18, -5)))
        cut = S.Subtract(cloth, S.Fn(opening, ((-12, -12, front_z - slit_len - 3), (12, 12, 20))), 0.22)
        self.parts["tunic"] = (cut, "tunic", (-24, -14, -27), (24, 16, -8), 0.13)
        # The tunic as cut, for the tail to lie on. (Laid on its uncut outer
        # surface, which spans the neck opening, the tail floated over a dark
        # gap there.)
        self.under_cloth.append(cut)

    def _mantle(self):
        head = self.head
        body = head.body()
        folds = drape_folds(self.P.seed + 2, amp=0.8, count=6, spread=(3.0, 8.0), top=-16.0)

        def outer_f(p):
            return body(p) - 1.35 - folds(p)

        outer = S.Fn(outer_f, ((-31, -17, -45), (31, 19, -5)))
        cloth = shell(outer, 0.46)
        hole = self._neck_hole(1.6, head.notch_z + 2.2 * head.s, head.notch_z + 6.2 * head.s)

        def front_f(p):
            # Open down the front, widening toward the chest.
            half = 5.5 + np.clip(-16.0 - p[:, 2], 0, None) * 0.35
            return np.maximum(np.abs(p[:, 0]) - half, p[:, 1] + 1.0)

        opening = S.Fn(front_f, ((-20, -20, -45), (20, 0, -5)))
        mantle = S.Subtract(S.Subtract(cloth, hole, 0.3), opening, 0.6)
        self.parts["mantle"] = (mantle, "mantle", (-25, -15, -27), (25, 17, -8), 0.15)
        self.under_cloth.append(mantle)

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
        P = self.P
        env = self._hair_volume(0.55, 1.9 if P.hair_style == "long" else 0.9)
        # A bun of hair gathered at the back, for women.
        if P.hair_style == "long":
            env = S.Union([env, S.Ellipsoid((0, 7.8 * s, 4.5 * s), (4.2, 3.2, 3.6))], 2.0)
        # The cloth rests on the crown and falls from there to the shoulders:
        # loosely for a veil or hood, closer for a scarf (a smaller head cloth).
        body = head.body()
        drape = S.Offset(body, 1.4 if kind != "scarf" else 1.2)
        low = -40.0
        if kind == "scarf":
            curtain = S.RoundCone((0, 2.0 * s, 8.0 * s), (0, 2.3 * s, -20.0 * s), 6.4 * s + 0.8 * P.veil_full, 10.0 * s + P.veil_full)
        else:
            curtain = S.RoundCone((0, 2.2 * s, 8.0 * s), (0, 2.6 * s, -20.0 * s), 6.8 * s + P.veil_full, 10.8 * s + 1.2 * P.veil_full)
        cover = S.Union([env, curtain], 3.5)
        cover = S.Union([cover, S.Clip(drape, (-40, -40, low), (40, 40, 0))], 2.5)
        # Folds: long, deep ones falling from the head, finer creases between.
        # Folds: a few broad, deep ones falling from the head and opening
        # out toward the shoulders (MakeHuman pass: many even folds read as
        # a pleated lampshade), a few finer creases, and cloth bunched
        # irregularly where it rests on the head.
        folds = drape_folds(P.seed + 3, amp=1.0, count=5, spread=(5.0, 14.0), top=3.0, sway=0.1)
        creases = drape_folds(P.seed + 4, amp=0.12, count=4, spread=(2.0, 4.5), top=5.0, sway=0.2)
        bunch = undulation(P.seed + 6, amp=0.28, count=7, spread=(4.0, 9.0))

        def fine(p):
            return creases(p) + bunch(p)

        # The opening for the face, as an angle round the head, so the hem
        # follows the cloth: an arch over the brow, edges hanging in front of
        # the ears, and open down the front onto the chest.
        # (Third pass: each person's sits a little differently.)
        top_z = (9.1 + P.veil_back) * s if kind != "hood" else (8.6 + 0.5 * P.veil_back) * s
        face = (60.0 if kind != "scarf" else 57.0) + P.veil_open
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

        def outer_f(p):
            hem = np.exp(-((open_f(p) / 0.7) ** 2))
            # The hem round the face is folded over: thicker, standing a little proud.
            return cover(p) - folds(p) - fine(p) - 0.08 * hem

        def cloth_f(p):
            d = outer_f(p)
            hem = np.exp(-((open_f(p) / 0.7) ** 2))
            return np.maximum(d, -d - (0.46 + 0.3 * hem))

        outer = S.Fn(outer_f, ((-40, -40, -45), (40, 40, 20)))
        self.cloth_outer = outer
        cloth = S.Fn(cloth_f, ((-40, -40, -45), (40, 40, 20)))
        opening = S.Fn(open_f, ((-15, -25, -45), (15, 0, 20)))
        cut = S.Subtract(cloth, opening, 0.3)
        self.parts["headwear"] = (cut, "headwear", (-26, -17, -27), (26, 19, 21), 0.11)

        # Hair must stay under the cloth, except where the face shows.
        def obstacle(p):
            return np.minimum(outer(p) + 0.65, open_f(p))

        self.obstacle = S.Fn(obstacle, ((-30, -17, low - 2), (30, 19, 21)))

    # ── The wrap: a long cloth wound round the head ────────────────────────
    def _wrap(self):
        head = self.head
        s = head.s
        P = self.P
        rng = np.random.default_rng(P.seed + 5)
        env = self._hair_volume(0.7 * self.hair_lift, 0.35)
        # The lower edge of the whole wrap: across the forehead a few
        # centimetres above the brows, over the tops of the ears, and low over
        # the back of the head.
        tilt = math.radians(14 + rng.uniform(-4, 4))
        en = np.array([rng.uniform(-0.05, 0.05), math.sin(tilt), math.cos(tilt)], F)
        en /= np.linalg.norm(en)
        ec = np.array([0, 0.0, (4.4 + rng.uniform(-0.3, 0.3)) * s], F)

        def rotated(n, about_y, about_x):
            ay, ax = math.radians(about_y), math.radians(about_x)
            Ry = np.array([[math.cos(ay), 0, math.sin(ay)], [0, 1, 0], [-math.sin(ay), 0, math.cos(ay)]], F)
            Rx = np.array([[1, 0, 0], [0, math.cos(ax), -math.sin(ax)], [0, math.sin(ax), math.cos(ax)]], F)
            v = Rx @ (Ry @ n)
            return v / np.linalg.norm(v)

        # The turns, first to last: (tilt sideways, tilt forward, how far up
        # the head, width). Turns cross each other over the forehead.
        side = 1 if rng.random() < 0.5 else -1
        specs = [
            (0, 0, 0.0, 4.4),
            (side * 17, 5, 1.3, 4.8),
            (-side * 19, 3, 2.3, 4.6),
            (side * 9, -9, 3.4, 4.5),
            (-side * 25, 7, 4.4, 4.2),
            (side * 6, -5, 5.5, 4.0),
            (-side * 12, 0, 6.6, 3.6),
        ]
        bands = []
        for ay, ax, lift, w in specs:
            n = rotated(en, ay + rng.uniform(-4, 4), ax + rng.uniform(-3, 3))
            w = w * (1 + rng.uniform(-0.08, 0.08))
            c = ec + en * (w / 2 + lift + rng.uniform(-0.2, 0.2))
            bands.append(
                {
                    "n": n,
                    "c": c.astype(F),
                    "w": w,
                    "t": 0.46 + rng.uniform(-0.05, 0.08),
                    "ph": rng.uniform(0, 2 * math.pi, 6).astype(F),
                    "pleats": rng.uniform(1.2, 2.2),
                }
            )
        self.bands = bands

        def above_edge(p):
            return (p - ec) @ en

        def stack(p):
            """Height of the wound cloth above the envelope at p: a thin cap
            under everything, then each turn lying on what is already there."""
            H = 0.28 * _smoothstep(above_edge(p) / 1.2 - 0.2)
            for b in bands:
                q, az = self._band_coords(b, p)
                w2 = b["w"] / 2 * (1 + 0.08 * np.sin(2 * az + b["ph"][0]) + 0.04 * np.sin(5 * az + b["ph"][1]))
                inside = np.abs(q) * b["w"] / 2 / np.maximum(w2, 0.5)  # 0 in the middle of the turn, 1 at its edge
                rim = np.clip((1 - inside) * w2 / 0.3, 0, 1)
                profile = 0.62 + 0.38 * np.sqrt(np.clip(1 - inside * inside, 0, 1))
                # Pleats along the turn, drifting, and crumples across it.
                pleat = 0.09 * np.cos(2 * math.pi * b["pleats"] * q + b["ph"][2] + 0.6 * np.sin(az * 2 + b["ph"][3]))
                crumple = 0.06 * np.sin(az * 9.0 + b["ph"][4] + 3.0 * q) * np.sin(az * 3.0 + b["ph"][5])
                t = b["t"] * profile + pleat + crumple
                H = np.where(inside < 1, H + np.maximum(t, 0.08) * np.sqrt(_smoothstep(rim)), H)
            return H

        def wrap_f(p):
            d = env(p) - stack(p)
            # Nothing below the lower edge (the first turn makes the edge).
            return np.maximum(d, -(above_edge(p) + 0.9))

        wrap = S.Fn(wrap_f, ((-13, -14, -2), (13, 14, 20)))
        tail = self._tail(rng)
        shape = S.Union([wrap, tail], 0.35)
        self.parts["headwear"] = (shape, "headwear", (-13, -14, -22), (13, 14, 19), 0.11)
        self.obstacle = S.Fn(lambda p: 0.1 - shape(p), ((-14, -15, -24), (14, 15, 20)))

    def _band_coords(self, b, p):
        """(across: -1..1 over the turn's width, around: angle round the head) for a turn."""
        n = b["n"]
        d = p - b["c"]
        q = (d @ n) / (b["w"] / 2)
        # An angle round the turn's own axis.
        ref = np.cross(n, np.array([0, 0, 1], F))
        if np.linalg.norm(ref) < 1e-3:
            ref = np.array([1, 0, 0], F)
        ref = (ref / np.linalg.norm(ref)).astype(F)
        ref2 = np.cross(n, ref).astype(F)
        az = np.arctan2(d @ ref2, d @ ref)
        return q.astype(F), az.astype(F)

    def _band_uv(self, V):
        """Per vertex: (along, across) in cm on the top-most turn under it,
        or along the tail."""
        uv = np.zeros((len(V), 3), F)
        for b in self.bands:
            q, az = self._band_coords(b, V)
            inside = np.abs(q) < 1.02
            uv[inside, 0] = az[inside] * 9.0
            uv[inside, 1] = q[inside] * b["w"] / 2
        if getattr(self, "_tail_geo", None) is not None:
            on, along, across = self._tail_uv(V)
            uv[on, 0] = along[on] + 50.0
            uv[on, 1] = across[on]
        return uv

    def _tail(self, rng):
        """The end of the cloth, falling from behind one ear down the neck to
        the shoulder. (Third pass: it was a flat strap glued to the neck.)
        It leaves the turns gathered into a few pleats, then fans out as it
        falls, the pleats spreading with it; it hangs a little free of the
        neck, its hemmed edges roll and lift, and the weave runs along it."""
        head = self.head
        s = head.s
        z = head.body_z
        sx = -1.0  # on the side the camera sees (the person's right)
        pts = np.array(
            [
                # Out from under the turns behind the ear, down the side of
                # the neck, and forward over the collarbone, where it is seen
                # face-on (on the back of the neck it read as a strap, edge-on).
                (sx * 5.4 * s, 6.2 * s, 5.0 * s),
                (sx * 6.4 * s, 4.6 * s, -0.5 * s),
                (sx * 6.2 * s, 2.2 * s, -6.5 * s * z),
                (sx * 7.2 * s, -0.6 * s, -12.5 * s * z),
                (sx * 10.5 * s, -2.6 * s, -18.5 * s * z),
            ],
            F,
        )
        seg = np.diff(pts, axis=0)
        L = np.linalg.norm(seg, axis=1)
        cum = np.concatenate([[0], np.cumsum(L)])
        self._tail_geo = {
            "pts": pts,
            "seg": seg,
            "L": L,
            "cum": cum,
            "total": float(cum[-1]),
            "ph": rng.uniform(0, 2 * math.pi, 4),
            "lying_on": S.Union([self.head_shape, head.body()] + self.under_cloth, 0.8),
        }
        total = self._tail_geo["total"]

        def f(p):
            t_at, across, e = self._tail_coords(p)
            w, lift, half = self._tail_profile(t_at, across)
            dx = np.abs(e - lift) - half
            dy = np.abs(across) - w
            end = (t_at - 0.999) * total
            box = np.minimum(np.maximum(dx, dy), 0) + np.hypot(np.maximum(dx, 0), np.maximum(dy, 0)) - 0.05
            return np.maximum(box, end)

        return S.Fn(f, (pts.min(0) - 4.5, pts.max(0) + 4.5))

    def _tail_coords(self, p):
        """(how far along the tail 0-1, signed distance across it in cm,
        height above the body in cm) for points p."""
        g = self._tail_geo
        pts, seg, L, cum = g["pts"], g["seg"], g["L"], g["cum"]
        best = np.full(len(p), 1e3, F)
        t_at = np.zeros(len(p), F)
        sign = np.ones(len(p), F)
        # Outward from the neck, roughly: to tell one side of the tail from the other.
        out = np.stack([p[:, 0], p[:, 1] - 1.2, np.zeros(len(p), F)], 1)
        out /= np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-6)
        for i in range(len(seg)):
            d = p - pts[i]
            t = np.clip((d @ seg[i]) / (L[i] ** 2), 0, 1)
            c = pts[i] + t[:, None] * seg[i]
            r = p - c
            dist = np.linalg.norm(r, axis=1)
            m = dist < best
            best[m] = dist[m]
            t_at[m] = (cum[i] + t[m] * L[i]) / g["total"]
            side = np.cross(np.broadcast_to(seg[i] / L[i], out.shape), out)
            sign[m] = np.where((r[m] * side[m]).sum(1) >= 0, 1.0, -1.0)
        e = g["lying_on"](p)
        across = np.sqrt(np.maximum(best * best - e * e, 0)) * sign
        return t_at, across.astype(F), e

    def _tail_profile(self, t_at, across):
        """(half-width, height of the middle of the cloth above the body,
        half its thickness) along and across the tail."""
        s = self.head.s
        ph = self._tail_geo["ph"]
        spread = _smoothstep(t_at / 0.4)
        w = (0.75 + 2.25 * spread) * s
        # How far from the middle of the tail, 0 .. 1. (Only the distance: the
        # side a point is on flips where the nearest part of the path changes,
        # and folds that depended on it tore the cloth along that line.)
        q = np.abs(across) / np.maximum(w, 0.3)
        # Pleats: the same few folds across the width, so they are bunched
        # where the cloth is gathered and spread where it fans out.
        pleat = (0.14 + 0.3 * _smoothstep(t_at / 0.55)) * np.sin(q * math.pi * 1.75 + ph[0] + 1.6 * t_at)
        pleat += 0.06 * np.sin(q * math.pi * 3.6 + ph[1] + 3.0 * t_at)
        lift = 0.35 + 0.3 * t_at + pleat + 0.3 * q * q + 0.1 * np.sin(ph[2] + 6.0 * t_at) * q
        # A hem along each edge, rolled over: thicker, standing a little proud.
        hem = np.exp(-(((w - np.abs(across)) / 0.28) ** 2))
        half = 0.16 + 0.12 * hem
        return w, lift + 0.06 * hem, half

    def _tail_uv(self, V):
        """Which vertices are on the tail, and their (along, across) in cm."""
        t_at, across, e = self._tail_coords(V)
        w, lift, half = self._tail_profile(t_at, across)
        on = (np.abs(e - lift) < half + 0.25) & (np.abs(across) < w + 0.3) & (t_at > 0.0)
        return on, t_at * self._tail_geo["total"], across

    def _cord(self):
        """Two twisted wool cords round a man's head cloth, holding it on."""
        head = self.head
        s = head.s
        outer = self.cloth_outer
        tilt = math.radians(12)
        n = np.array([0, math.sin(tilt), math.cos(tilt)], F)
        c = np.array([0, 0.0, 6.0 * s], F)
        r = 0.32

        def cord(p):
            d_env = outer(p) - r * 0.9
            best = np.full(len(p), 1e3, F)
            for off in (-0.33, 0.33):
                d_pl = (p - c) @ n - off
                # A twist: the cord's radius swells and narrows along it.
                az = np.arctan2(p[:, 0], -(p[:, 1] - 1.5))
                tw = 0.05 * np.sin(az * 26.0 + (off > 0) * 1.5)
                best = np.minimum(best, np.hypot(d_env, d_pl) - r - tw)
            return best

        shape = S.Fn(cord, ((-12, -14, 0), (12, 14, 16)))
        self.parts["cord"] = (shape, "cord", (-12, -14, 1), (12, 14, 15), 0.09)

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
