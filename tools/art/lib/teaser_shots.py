"""The teaser's shots: what each one shows, its light, its camera move and
its grade. build_teaser.py renders them; edit_teaser.py cuts them together.

| # | Frames | Seconds | Shot |
|---|--------|---------|------|
| 1 | 168 | 0-7   | Jerusalem at sunrise: over the rooftops, craning down to the lower market |
| 2 | 168 | 7-14  | Aunt Miriam's house: lamplight on the remedy and the letter; a slow push-in |
| 3 | 192 | 14-22 | The market waking: stalls, people walking, pigeons; a dolly along the stalls |
| 4 | 192 | 22-30 | Out through the east gate: the wilderness opens below; a rising move |
| 5 | 168 | 30-37 | The ridge path above the gorge: the player, small, walking away |
| 6 | 168 | 37-44 | Low on the road below the bend: a broken jar, oil dark in the dust, footprints |
| 7 | 144 | 44-50 | A slow reveal: a man lying in the shade of a rock |
| 8 | 168 | 50-57 | The gorge at golden hour, under the title |
"""
import json
import math
import os

import bpy
import numpy as np
from mathutils import Vector

import materials as M
import rocks
import teaser_city as C
import teaser_land as TL
import teaser_look as LK
import teaser_market as MK
import teaser_noise as N
import teaser_people as TP
import teaser_props as PR
import teaser_render as R

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data", "chapter.json")


class Context:
    """What several shots share: the land (built once), the game's people."""

    def __init__(self, preview, cache):
        self.preview = preview
        self.cache = cache
        self._land = None
        self._data = None

    @property
    def data(self):
        if self._data is None:
            with open(DATA) as fh:
                self._data = json.load(fh)
        return self._data

    def appearance(self, who):
        """A character's appearance by id, 'player:look-1' or 'crowd:crowd-0'."""
        d = self.data
        if who.startswith("player:"):
            return next(p["appearance"] for p in d["players"] if p["id"] == who.split(":", 1)[1])
        if who.startswith("crowd:"):
            return next(c["appearance"] for c in d["crowd"] if c["id"] == who.split(":", 1)[1])
        return next(c["appearance"] for c in d["characters"] if c["id"] == who and c.get("chapter", "road-to-jericho") == "road-to-jericho")

    def land(self):
        if self._land is None:
            land = TL.Land(7, self.cache)
            gz = float(land.coarse(np.array([GATE[0] + 30.0]), np.array([GATE[1]]))[0])
            self.city = C.City(GATE, gz)
            land.pads.append(city_pad(self.city))
            land.road = TL.Track(land, land.route((GATE[0] + 6.0, GATE[1]), ROAD_END), width=3.4, shoulder=6.0)
            ridge = rim_path(land, RIDGE[0], RIDGE[1])
            land.paths.append(TL.Track(land, ridge, width=1.1, shoulder=4.5, spacing=1.0, smooth=24.0, sink=0.03))
            self._land = land
        return self._land


# World anchors (metres; see teaser_land.py): Jerusalem's east gate at the
# west end of the land, where the road starts down; the road's end on the
# valley floor; the stretch of the gorge's north rim the ridge path follows.
GATE = (-6700.0, 1650.0)
ROAD_END = (11500.0, 900.0)
RIDGE = (-1400.0, -200.0)


def city_pad(city):
    """Level the land under the city to its streets, easing out beyond it."""

    def pad(x, y, h):
        x = np.asarray(x)
        y = np.asarray(y)
        dx = np.maximum(np.maximum((city.gx - city.depth - 20.0) - x, x - (city.gx + 2.0)), 0.0)
        dy = np.maximum(np.abs(y - city.gy) - (city.half + 20.0), 0.0)
        d = np.hypot(dx, dy)
        w = 1.0 - N.smoothstep(0.0, 60.0, d)
        level = city.ground(x, y) - 0.25
        # Outside the wall the ground falls away east of the gate.
        east = np.clip((x - city.gx) / 60.0, 0.0, 1.0)
        return h + (level - h) * w * (1.0 - east) + np.minimum(0.0, level - 2.0 - h) * w * east

    return pad


def rim_path(land, x0, x1, margin=16.0, step=6.0):
    """A shepherds' path along the gorge's north rim, just back from the edge."""
    xs = np.arange(x0, x1, step)
    out = []
    d = np.arange(20.0, 460.0, 2.0)
    for x in xs:
        yc = float(land.gorge_y(x))
        y = yc + d
        xx = np.full_like(d, x)
        cut = land.gorge_bed(xx) + land.gorge_wall(d, xx, y)
        free = land.coarse(xx, y) < cut - 1.0
        rim = float(d[np.argmax(free)]) if free.any() else 300.0
        out.append(rim + margin)
    ds = np.array(out)
    k = 9
    ds = np.convolve(np.pad(ds, k, mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), mode="same")[k:-k]
    return np.stack([xs, land.gorge_y(xs) + ds], axis=1)


class Spec:
    def __init__(self, name, frames, build, grade):
        self.name = name
        self.frames = frames
        self.build = build
        self.grade = grade

    def grade_at(self, f):
        return self.grade(f / max(1, self.frames - 1)) if callable(self.grade) else self.grade


class Shot:
    def __init__(self, animate, samples=64, samples_preview=8):
        self.animate = animate
        self.samples = samples
        self.samples_preview = samples_preview


def lerp_grade(a, b, t):
    out = {}
    for k in set(a) | set(b):
        va = a.get(k, R.DEFAULT_GRADE[k])
        vb = b.get(k, R.DEFAULT_GRADE[k])
        if isinstance(va, tuple):
            out[k] = tuple(x + (y - x) * t for x, y in zip(va, vb))
        else:
            out[k] = va + (vb - va) * t
    return out


# ── the land ────────────────────────────────────────────────────────────────
def land_set(ctx, scene, centre, heading, fov=math.radians(120), shrubs=True, near=70.0, far=900.0, density=0.035, r0=0.4, n_theta=None, extra=None):
    land = ctx.land()
    n_theta = n_theta or (520 if ctx.preview else 1400)
    if ctx.preview:
        n_theta = min(n_theta, 520)
    TL.land_mesh(land, "land", centre[0], centre[1], heading, fov, r0=r0, r1=60000.0, n_theta=n_theta, material=LK.ground(), extra=extra)
    if shrubs:
        def off_tracks(x, y, w):
            if land.road is not None:
                w = w * (1 - land.road.mask(x, y))
            for p in land.paths:
                w = w * (1 - p.mask(x, y))
            return np.clip(w, 0, 1)

        # Dwarf shrubs: sparse, dull grey-olive cushions, thicker in the gullies.
        shrubs_ = [PR.shrub(f"shrub{k}", 0.22 + 0.08 * k, 0.16 + 0.05 * k, seed=k) for k in range(4)]
        PR.scatter(land, "shrubs", centre, heading, fov, near, far, density * (2.5 if ctx.preview else 6.0), shrubs_, seed=5,
                   where=lambda x, y, z, sl, wet: off_tracks(x, y, (0.35 + 0.65 * wet) * (1 - np.clip((sl - 0.8) / 0.4, 0, 1))), size=(0.6, 1.5), sink=0.05, max_count=120000)
        # Scree and loose stones: the game's own limestone and chert
        # (rocks.stone, materials.rock), densest where the ground is steep.
        rmat = PR.rock_material("teaser-scree", "#cbb999", "#8e7a62", red=0.15, lichen=0.2)
        stones = [rocks.stone(f"scree{k}", Vector((0, 0, 0)), (0.5 + 0.1 * (k % 3), 0.4 + 0.1 * (k % 2), 0.3 + 0.05 * k), rmat, 900 + k, flat=0.5, blocky=0.7, sink=0.3) for k in range(6)]
        PR.scatter(land, "scree", centre, heading, fov, near * 0.6, far * 0.6, density * (7.0 if not ctx.preview else 2.5), stones, seed=8,
                   where=lambda x, y, z, sl, wet: off_tracks(x, y, 0.08 + 0.9 * np.clip((sl - 0.25) / 0.5, 0, 1)), size=(0.15, 0.9), sink=0.1, tilt=0.5, max_count=150000)
    return land


def ground_at(land):
    def z(x, y):
        return float(land.height(np.array([x]), np.array([y]))[0])

    return z


def shot4(ctx, scene):
    """Out through the east gate: from the dark of the gate's passage into
    the light, the land falling away east with the road winding down it;
    the camera rises to show it all."""
    land = ctx.land()
    city = ctx.city
    city.build()
    road = land.road
    p0 = road.point(40.0)
    p1 = road.point(220.0)
    head = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    land_set(ctx, scene, (city.gx - 10.0, city.gy), head, fov=math.radians(150))
    z = ground_at(land)
    gz = city.gz
    d = Vector((math.cos(head), math.sin(head), 0.0))
    e0 = Vector((city.gx - 7.5, city.gy, gz + 1.7))
    e1 = Vector((city.gx + 22.0, city.gy, gz + 7.0)) + d * 10.0
    e2 = Vector((city.gx + 20.0, city.gy, gz + 70.0)) + d * 160.0
    far = Vector((p0[0], p0[1], 0.0)) + d * 3000.0
    t0 = Vector((far.x, far.y, gz - 40.0))
    t2 = Vector((far.x, far.y, gz - 520.0))
    move = R.Move([e0, e1, e2], [t0, t2], lens=[24.0, 28.0], ease_in=0.35, ease_out=1.0, shake=0.01)
    LK.eevee(scene, preview=ctx.preview)
    LK.sky(scene, -40.0, 30.0, sun_strength=5.0, sky_strength=0.2, aerosol=1.6)
    LK.haze(scene, 0.00006, "#dcd5ca", ground=gz - 300.0, scale_height=1000.0, centre=(p0[0], p0[1]))
    scene.view_settings.exposure = -1.5
    cam = R.camera(scene, lens=24.0)

    def animate(f, t):
        eye, tgt, lens = move.at(f / 191.0, t)
        R.aim(cam, eye, tgt, lens)

    return Shot(animate)


def shot5(ctx, scene):
    """The ridge path above the gorge: the player walking away, small."""
    land = ctx.land()
    path = land.paths[0]
    start = 260.0
    a = path.point(start)
    b = path.point(start + 30.0)
    head = math.atan2(b[1] - a[1], b[0] - a[0])
    centre = a - np.array([math.cos(head), math.sin(head)]) * 12.0
    land_set(ctx, scene, (centre[0], centre[1]), head, fov=math.radians(260))
    z = ground_at(land)
    fig = TP.Figure(ctx.appearance("player:look-1"), "walker", marks=("water-skin", "cloak-roll"))
    walker = TP.Walker(fig, path.poly, z, cadence=0.92, start=start)
    LK.eevee(scene, preview=ctx.preview)
    LK.sky(scene, -55.0, 42.0, sun_strength=5.4, sky_strength=0.2, aerosol=1.5)
    LK.haze(scene, 0.00006, "#dcd5ca", ground=z(a[0], a[1]) - 250.0, scale_height=900.0, centre=(a[0], a[1]))
    scene.view_settings.exposure = -1.6
    cam = R.camera(scene, lens=35.0)

    gorge_side = None

    def animate(f, t):
        nonlocal gorge_side
        at = walker.at(t)
        s_, _ = walker.distance(t)
        head_ = walker.heading(s_)
        fwd = Vector((math.cos(head_), math.sin(head_), 0.0))
        left = Vector((-math.sin(head_), math.cos(head_), 0.0))
        if gorge_side is None:
            # Which side the gorge is on: keep the camera over the land, looking across it.
            probe = at + left * 40.0
            gorge_side = -1.0 if land.gorge_distance(np.array([probe.x]), np.array([probe.y]))[0] < land.gorge_distance(np.array([at.x]), np.array([at.y]))[0] else 1.0
        # High and wide: behind the walker and up, the gorge opening beside them.
        eye = at - fwd * (34.0 - 0.8 * t) + left * gorge_side * 14.0
        eye.z = max(z(eye.x, eye.y) + 4.0, at.z + 22.0 - 0.6 * t)
        tgt = at + fwd * 55.0 - left * gorge_side * 70.0
        tgt.z = at.z - 32.0
        R.aim(cam, eye, tgt, 40.0)
        R.focus(cam, (at - eye).length, 11.0)

    return Shot(animate)


def shot8(ctx, scene):
    """The gorge at golden hour, under the title."""
    land = ctx.land()
    x0 = 1500.0
    y0 = float(land.gorge_y(x0))
    x1 = x0 + 400.0
    head = math.atan2(float(land.gorge_y(x1)) - y0, x1 - x0)
    land_set(ctx, scene, (x0 - 200.0, y0), head, shrubs=True, far=1400.0)
    z = ground_at(land)
    rim = max(z(x0, y0 + 160.0), z(x0, y0 - 160.0))
    e0 = Vector((x0 - 120.0, y0 + 20.0, rim + 45.0))
    e1 = Vector((x0 - 20.0, y0 + 10.0, rim + 38.0))
    t0 = Vector((x0 + 1600.0, float(land.gorge_y(x0 + 1600.0)), rim - 150.0))
    move = R.Move([e0, e1], [t0, t0 + Vector((0, 0, -20.0))], lens=30.0, ease_in=0.3, ease_out=1.0)
    LK.eevee(scene, preview=ctx.preview)
    LK.sky(scene, 205.0, 5.5, sun_strength=4.2, sky_strength=0.35, color="#ffc27a", aerosol=2.4, angle=0.6)
    LK.haze(scene, 0.00009, "#e6c9a8", ground=rim - 300.0, scale_height=700.0, centre=(x0, y0), anisotropy=0.7)
    scene.view_settings.exposure = -1.2
    cam = R.camera(scene, lens=30.0)

    def animate(f, t):
        eye, tgt, lens = move.at(f / 167.0, t)
        R.aim(cam, eye, tgt, lens)

    return Shot(animate)


def city_set(ctx, scene, market=True, heading=0.0, fov=math.radians(150), shrubs=False):
    land = ctx.land()
    city = ctx.city
    city.build()
    mk = MK.Market(city, preview=ctx.preview).build() if market else None
    land_set(ctx, scene, (city.gx - 150.0, city.gy), heading, fov=fov, shrubs=shrubs, far=700.0)
    return land, city, mk


CROWD_LOOKS = [f"crowd:crowd-{k}" for k in range(4)] + ["hadassah", "ezer", "tobiah", "hanan", "salome", "yair", "malik", "shimon", "rivka"]
LOADS = ["basket", "jar", "bundle", "none", "none", "basket", "bread", "jar", "staff", "none"]


def crowd(ctx, city, n, seed, x0, x1, t_total):
    """Market people walking up and down the street, many carrying loads:
    baskets, jars on the shoulder, bundles, bread."""
    rng = np.random.default_rng(seed)
    walkers = []
    for k in range(n):
        who = CROWD_LOOKS[k % len(CROWD_LOOKS)]
        look = dict(ctx.appearance(who))
        look["carry"] = LOADS[(k * 7 + 3) % len(LOADS)]
        fig = TP.Figure(look, f"walker{k}")
        y = city.gy + rng.uniform(-2.0, 2.0)
        east = rng.random() < 0.5
        L = abs(x1 - x0)
        # Paths start before the street's near end, so people walk into view too.
        xa, xb = (x0 - 12.0, x1) if east else (x1, x0 - 12.0)
        path = np.array([[xa, y], [xb, y + rng.uniform(-0.8, 0.8)]])
        start = rng.uniform(0.0, L + 12.0 - 1.1 * t_total)
        w = TP.Walker(fig, path, lambda x, y: city.z(x, y), cadence=rng.uniform(0.8, 0.95), start=max(0.0, start), phase=rng.random())
        walkers.append(w)
    return walkers


def stallholders(ctx, city, mk, x0, x1, n):
    """People standing behind their stalls, facing the street: breathing,
    turning a little, now and then talking."""
    out = []
    looks = ["ezer", "hadassah", "malik", "crowd:crowd-1", "salome", "crowd:crowd-3", "yair", "crowd:crowd-2", "tobiah"]
    k = 0
    for cx, cy, w, side in mk.stalls:
        if not (x0 <= cx <= x1) or k >= n:
            continue
        look = dict(ctx.appearance(looks[k % len(looks)]))
        look["carry"] = "none"
        fig = TP.Figure(look, f"seller{k}")
        at = Vector((cx + (k % 3 - 1) * 0.4, cy + side * 1.05, 0.0))
        at.z = city.z(at.x, at.y)
        out.append((fig, at, -side * math.pi / 2, k * 1.7))
        k += 1
    return out


def shot1(ctx, scene):
    """Jerusalem at sunrise: over the rooftops toward the sun, craning down
    into the lower market inside the east gate."""
    land, city, mk = city_set(ctx, scene)
    gx, gy, gz = city.gx, city.gy, city.gz
    e0 = Vector((gx - 300.0, gy - 70.0, gz + 62.0))
    e1 = Vector((gx - 190.0, gy - 25.0, gz + 30.0))
    e2 = Vector((gx - 118.0, gy - 2.0, gz + 9.0))
    t0 = Vector((gx + 1800.0, gy - 350.0, gz + 40.0))
    t1 = Vector((gx + 400.0, gy - 60.0, gz - 5.0))
    t2 = Vector((gx - 20.0, gy, gz + 1.0))
    move = R.Move([e0, e1, e2], [t0, t1, t2], lens=[30.0, 32.0], ease_in=0.8, ease_out=1.0)
    LK.eevee(scene, preview=ctx.preview, volume_end=6000.0)
    LK.sky(scene, -8.0, 10.0, sun_strength=3.4, sky_strength=0.45, color="#ffb070", aerosol=2.8, angle=0.7, bounce=0.22)
    LK.haze(scene, 0.00016, "#ead2b8", ground=gz - 120.0, scale_height=450.0, centre=(gx, gy), anisotropy=0.72)
    scene.view_settings.exposure = -0.9
    cam = R.camera(scene, lens=30.0)

    def animate(f, t):
        eye, tgt, lens = move.at(f / 167.0, t)
        R.aim(cam, eye, tgt, lens)

    return Shot(animate)


def shot3(ctx, scene):
    """The market waking: a slow dolly along the stalls, people passing,
    pigeons on the paving, the low sun down the street through the dust."""
    land, city, mk = city_set(ctx, scene, fov=math.radians(200))
    gx, gy, gz = city.gx, city.gy, city.gz
    x_a = gx - 112.0
    walkers = crowd(ctx, city, 24 if not ctx.preview else 16, 5, x_a - 4.0, gx - 30.0, 8.0)
    sellers = stallholders(ctx, city, mk, x_a + 4.0, x_a + 60.0, 9)
    doves = []
    rng = np.random.default_rng(9)
    for k in range(7):
        p = MK.Pigeon(f"dove{k}", k)
        at = Vector((x_a + 7.0 + rng.uniform(0, 6.0), gy - 0.6 + rng.uniform(-0.8, 1.2), 0.0))
        at.z = city.z(at.x, at.y)
        doves.append((p, at, rng.uniform(0, math.tau), rng.uniform(0, 10), k >= 5))
    LK.eevee(scene, preview=ctx.preview, volume_end=600.0)
    LK.sky(scene, -4.0, 11.0, sun_strength=4.2, sky_strength=0.35, color="#ffc990", aerosol=2.2, angle=0.6, bounce=0.1)
    LK.haze(scene, 0.00005, "#e6d2bc", ground=gz - 100.0, scale_height=500.0, centre=(gx, gy))
    LK.dust(scene, (gx - 170.0, gy - 8.0, gz - 1.0), (gx - 5.0, gy + 8.0, gz + 12.0), density=0.0015, color="#ecdcc4", anisotropy=0.3)
    scene.view_settings.exposure = -1.1
    cam = R.camera(scene, lens=35.0)
    gzm = city.z(x_a + 10.0, gy)
    e0 = Vector((x_a, gy - 1.3, city.z(x_a, gy) + 1.55))
    e1 = Vector((x_a + 9.0, gy - 1.0, city.z(x_a + 9.0, gy) + 1.6))
    move = R.Move([e0, e1], [Vector((x_a + 26.0, gy + 1.5, gzm + 1.0)), Vector((x_a + 36.0, gy + 0.8, gzm + 1.0))], lens=35.0, ease_in=0.2, ease_out=0.3, shake=0.012)

    def animate(f, t):
        eye, tgt, lens = move.at(f / 191.0, t)
        R.aim(cam, eye, tgt, lens)
        R.focus(cam, 7.5, 4.0)
        for w in walkers:
            w.at(t)
        for fig, at, face, ph in sellers:
            talk = 1 if math.sin(t * 1.3 + ph) > 0.75 else 0
            TP.standing(fig, at, face + 0.25 * math.sin(t * 0.4 + ph), breath=0.5 + 0.5 * math.sin(t * 1.5 + ph), talk=talk)
        for p, at, head, ph, flies in doves:
            if flies and t > 3.2:
                u = t - 3.2
                pos = at + Vector((abs(math.cos(head)) * u * 4.0 + u * 2.0, math.sin(head) * u * 4.0, 1.6 * u + 0.8 * u * u))
                p.place(pos, head, fly=u * 7.0, bank=0.2 * math.sin(u * 2))
            else:
                peck = max(0.0, math.sin((t + ph) * 3.1)) ** 3
                p.place(at, head + 0.3 * math.sin(t * 0.7 + ph), peck=peck)

    return Shot(animate)


def shot2(ctx, scene):
    """Aunt Miriam's house: the lamp still burning on the table beside the
    remedy and the letter; a slow push-in."""
    import teaser_room as RM

    room = RM.Room(preview=ctx.preview).build()
    LK.eevee(scene, preview=ctx.preview, volume_end=14.0, volume_tile="4")
    scene.eevee.volumetric_start = 0.05
    scene.eevee.fast_gi_distance = 2.0
    # The world outside the window: the pale sky of early morning.
    world = bpy.data.worlds.new("RoomWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.55, 0.62, 0.75, 1.0)
    bg.inputs["Strength"].default_value = 0.25
    # Daylight at the window: a soft cool panel just outside it, and the
    # first low sun, warm, slanting in to lie on the far wall.
    wx, wy, wz = room.window
    win = bpy.data.lights.new("Window", "AREA")
    win.energy = 60.0
    win.shape = "RECTANGLE"
    win.size, win.size_y = 0.9, 0.8
    win.color = (0.78, 0.85, 1.0)
    wo = bpy.data.objects.new("Window", win)
    scene.collection.objects.link(wo)
    wo.location = (wx + 0.6, wy, wz)
    wo.rotation_euler = Vector((-1.0, 0.0, -0.25)).to_track_quat("-Z", "Y").to_euler()
    sun = bpy.data.lights.new("RoomSun", "SUN")
    sun.energy = 2.2
    sun.angle = math.radians(1.0)
    sun.color = (1.0, 0.8, 0.58)
    so = bpy.data.objects.new("RoomSun", sun)
    scene.collection.objects.link(so)
    so.rotation_euler = Vector((1.0, 0.25, 0.32)).to_track_quat("Z", "Y").to_euler()
    # A dim warm fill: light bounced round the room from the lamp and the floor.
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 6.0
    fill.size = 2.0
    fill.color = (1.0, 0.78, 0.55)
    fo = bpy.data.objects.new("Fill", fill)
    scene.collection.objects.link(fo)
    fo.location = (-0.6, -1.8, 2.4)
    fo.rotation_euler = Vector((0.3, 0.9, -1.0)).to_track_quat("-Z", "Y").to_euler()
    LK.dust(scene, (-2.2, -2.6, 0.0), (3.4, 1.3, 2.9), density=0.05, color="#f0e2cc", anisotropy=0.55, noise=0.35)
    scene.view_settings.exposure = -0.2
    cam = R.camera(scene, lens=50.0)
    focus_on = Vector((0.03, 0.03, RM.TABLE_Z + 0.07))
    e0 = Vector((-0.12, -1.3, RM.TABLE_Z + 0.45))
    e1 = Vector((-0.02, -0.62, RM.TABLE_Z + 0.22))
    move = R.Move([e0, e1], [focus_on + Vector((0.02, 0.1, 0.0)), focus_on + Vector((0.05, 0.05, -0.01))], lens=[45.0, 50.0], ease_in=0.4, ease_out=1.0, shake=0.002)

    def animate(f, t):
        eye, tgt, lens = move.at(f / 167.0, t)
        R.aim(cam, eye, tgt, lens)
        R.focus(cam, (focus_on - eye).length, 2.2)
        room.flicker(t)

    return Shot(animate, samples=96)


INCIDENT_S = 2600.0


def incident_set(ctx, scene, eye_ab, look_ab, sun_el=46.0, sun_off=15.0):
    import teaser_incident as INC

    land = ctx.land()
    inc = INC.Incident(land, s=INCIDENT_S, preview=ctx.preview)
    inc.plan_marks()
    c = inc.w(*eye_ab)
    t = inc.w(*look_ab)
    head = math.atan2(t[1] - c[1], t[0] - c[0])
    # The mesh's centre sits behind the camera, so its fine rings are what it sees.
    back = c - np.array([math.cos(head), math.sin(head)]) * 0.6
    land_set(ctx, scene, back, head, fov=math.radians(120), shrubs=True, near=40.0, far=900.0, r0=0.05, n_theta=950, extra=inc.attributes)
    inc.build()
    # Late morning: the sun high, a little ahead and to the right of the
    # road going down, so the rocks' shade falls toward the road.
    sun_az = math.degrees(inc.heading) + sun_off
    LK.eevee(scene, preview=ctx.preview, volume_end=3000.0)
    LK.sky(scene, sun_az, sun_el, sun_strength=6.0, sky_strength=0.2, color="#fff4e4", aerosol=1.4, bounce=0.12)
    return land, inc


def shot6(ctx, scene):
    """Low on the road below the bend: a broken jar, oil dark in the dust,
    footprints."""
    land, inc = incident_set(ctx, scene, (-2.5, 0.5), (0.2, -0.5))
    LK.haze(scene, 0.00007, "#ddd6ca", ground=inc.z(0, 0) - 200.0, scale_height=900.0, centre=tuple(inc.O))
    scene.view_settings.exposure = -1.75
    cam = R.camera(scene, lens=32.0)
    e0 = inc.P(-3.4, 0.75, 0.3)
    e1 = inc.P(-1.55, 0.3, 0.22)
    t0 = inc.P(-1.2, 0.15, 0.0)
    t1 = inc.P(0.25, -0.55, 0.05)
    move = R.Move([e0, e1], [t0, t1], lens=[30.0, 34.0], ease_in=0.5, ease_out=1.0, shake=0.003)
    jar = inc.P(0.15, -0.55, 0.06)

    def animate(f, t):
        eye, tgt, lens = move.at(f / 167.0, t)
        R.aim(cam, eye, tgt, lens)
        R.focus(cam, (jar - eye).length, 2.8)

    return Shot(animate)


def shot7(ctx, scene):
    """A slow reveal: following the drag marks off the road to a man lying
    in the shade of the rocks. His face is not seen."""
    land, inc = incident_set(ctx, scene, (2.2, 0.4), (4.2, -3.4), sun_el=33.0, sun_off=5.0)
    LK.haze(scene, 0.00007, "#ddd6ca", ground=inc.z(0, 0) - 200.0, scale_height=900.0, centre=tuple(inc.O))
    scene.view_settings.exposure = -1.75
    (ma, mb), turn = inc.man_place
    # His jar is broken and his cloak gone: nothing in his hands.
    fig = TP.Figure(dict(ctx.appearance("menashe"), carry="none"), "man")
    at = inc.P(ma + 0.5, mb + 0.1, 0.0)
    cam = R.camera(scene, lens=40.0)
    e0 = inc.P(2.3, 0.5, 1.5)
    e1 = inc.P(2.6, -0.6, 0.85)
    t0 = inc.P(3.05, -1.4, 0.0)
    t1 = inc.P(ma + 0.2, mb + 0.1, 0.22)
    move = R.Move([e0, e1], [t0, t1], lens=[38.0, 42.0], ease_in=0.6, ease_out=1.0, shake=0.004)
    # Feet toward the camera, head away (and into the deepest shade).
    away = math.atan2(at.y - e1.y, at.x - e1.x) + turn

    def animate(f, t):
        eye, tgt, lens = move.at(f / 143.0, t)
        R.aim(cam, eye, tgt, lens)
        u = R.ease(f / 143.0)
        # Focus follows the drag marks and stops short of him: he stays soft.
        d = (1 - u) * (t0 - eye).length + u * 0.5 * (at - eye).length
        R.focus(cam, d, 1.6)
        TP.lying(fig, at, away, breath=0.5 + 0.5 * math.sin(t * 1.6))

    return Shot(animate)


def placeholder(label):
    def build(ctx, scene):
        LK.eevee(scene, preview=True)
        LK.sky(scene, -40.0, 20.0)
        bpy.ops.mesh.primitive_plane_add(size=200)
        cam = R.camera(scene)
        R.aim(cam, (0, -10, 2), (0, 10, 1))
        return Shot(lambda f, t: None)

    return build


GRADE_LAND = {"contrast": 1.08, "saturation": 1.05, "vignette": 0.2}

SHOTS = {
    1: Spec("jerusalem-sunrise", 168, shot1, lambda u: lerp_grade({"contrast": 1.05, "balance": (0.92, 0.97, 1.08), "saturation": 0.9, "vignette": 0.25}, {"contrast": 1.08, "balance": (1.05, 1.0, 0.94), "saturation": 1.0, "vignette": 0.22}, u)),
    2: Spec("miriam-room", 168, shot2, {"contrast": 1.06, "balance": (1.02, 1.0, 0.97), "saturation": 1.0, "vignette": 0.3, "bloom": 0.2, "bloom_threshold": 0.7}),
    3: Spec("market", 192, shot3, {"contrast": 1.08, "balance": (1.04, 1.0, 0.95), "saturation": 1.02, "vignette": 0.22, "bloom": 0.12}),
    4: Spec("gate-and-wilderness", 192, shot4, {"contrast": 1.1, "saturation": 1.05, "balance": (1.03, 1.0, 0.96), "vignette": 0.22}),
    5: Spec("ridge-path", 168, shot5, {"contrast": 1.12, "saturation": 0.95, "balance": (1.04, 1.0, 0.95), "vignette": 0.22}),
    6: Spec("below-the-bend", 168, shot6, {"contrast": 1.12, "balance": (1.03, 1.0, 0.95), "saturation": 0.92, "vignette": 0.28}),
    7: Spec("the-man", 144, shot7, {"contrast": 1.15, "balance": (0.98, 1.0, 1.02), "saturation": 0.85, "vignette": 0.32, "lift": (0.0, 0.004, 0.012)}),
    8: Spec("gorge-title", 168, shot8, {"contrast": 1.08, "saturation": 1.1, "balance": (1.06, 1.0, 0.92), "vignette": 0.25, "bloom": 0.15}),
}
