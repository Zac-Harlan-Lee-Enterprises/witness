"""What each piece of key art shows (key_art.py builds and renders them).

Each picture is a moment at the heart of its chapter, made from the game's
own places, people and light, that makes a player want to play it without
giving its ending away.

| id | Shows |
|----|-------|
| journey-to-bethlehem | Tamar's house at night, every corner full of guests and their bundles; a late stranger with a lamp at the door |
| letter-from-paul | Philemon's house at lamp-lighting: the household gathered round a sealed letter, Zenon ready to read it, Tychicus who carried it beside him |
"""
import math

import bmesh
from mathutils import Vector

import common
import materials as M
import key_art as K
from key_art import Cast, FilmShot, PlaceShot

CH3 = "journey-to-bethlehem"
CH4 = "letter-from-paul"

SHOTS = {}


def shot(s):
    SHOTS[s.id] = s
    return s


def link(scene, objs):
    for o in objs:
        if not o.users_collection:
            scene.collection.objects.link(o)
    return objs


def sealed_letter(name, at, along, length=0.26, r=0.028):
    """A letter on papyrus, rolled, tied round with a cord and sealed with a
    blob of clay: the roll's centre at `at`, lying along the angle `along`."""
    d = Vector((math.cos(along), math.sin(along), 0.0))
    a = at - d * (length / 2) + Vector((0, 0, r))
    b = at + d * (length / 2) + Vector((0, 0, r))
    pap = M.plain("#dcc89e", 0.85, 0.2, "key-papyrus")
    import people

    objs = [people.capsule(f"{name}-roll", a, b, r, pap, None, 20)]
    # The roll's ends show its turns: a slightly darker spiral face.
    for end in (a, b):
        objs.append(people.ellipsoid(f"{name}-end{len(objs)}", end, (r * 0.98, r * 0.98, r * 0.98), M.plain("#c9b386", 0.9), None, 16, 8))
    cord = M.plain("#6a4a2e", 0.8, 0.2, "key-cord")
    for k, t in enumerate((-0.18, 0.18)):
        c = at + d * (length * t) + Vector((0, 0, r))
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=False, radius=r * 1.06, segments=20)
        ring = common.mesh_object(f"{name}-cord{k}", bm, cord, None)
        ring.modifiers.new("t", "SKIN")
        ring.rotation_euler = (0.0, math.pi / 2, along)
        ring.location = c
        ring.scale = (1.0, 1.0, 1.0)
        objs.append(ring)
        for v in ring.data.skin_vertices[0].data:
            v.radius = (0.0035, 0.0035)
    seal = people.ellipsoid(f"{name}-seal", at + Vector((0, 0, 2 * r + 0.004)), (0.02, 0.02, 0.008), M.plain("#7a2a1c", 0.45, 0.3, "key-seal"), None, 14, 6)
    objs.append(seal)
    return objs


# ── Chapter 2: A Storm on Galilee ───────────────────────────────────────────
def squall(scene, p):
    """The open lake as the squall comes: the game's lake beyond its map,
    the far shore, the storm sky and the last of the sun (key_art_storm)."""
    import key_art_storm as S

    water = getattr(p, "water_obj", None)
    if water is not None:
        water.data.materials.clear()
        water.data.materials.append(S.storm_water())
        zs = [(water.matrix_world @ v.co).z for v in water.data.vertices]
        z = max(zs)
        xs = [(water.matrix_world @ v.co).x for v in water.data.vertices]
        ys = [(water.matrix_world @ v.co).y for v in water.data.vertices]
        S.far_water(scene, z - 0.004, min(xs) + 0.5, min(ys) + 0.5, max(xs) - 0.5, max(ys) - 0.5)
    else:
        z = p.z_water()
    centre = (p.map.w / 2, -p.map.h / 2)
    S.hills(scene, centre, z)
    S.rain_curtain(scene, centre, z, heading=math.radians(8.0), dist=2000.0)
    S.storm_sky(scene)
    scene.view_settings.exposure = -1.4 + p.exposure + 1.9


CH2 = "storm-on-galilee"
shot(
    PlaceShot(
        "storm-on-galilee",
        "open-lake",
        "night",
        chapter=CH2,
        show={"teacher-boat-sail-furled", "fishing-boat-sail", "cargo-jars", "cargo-jars-more", "net-cargo", "rope-coil", "bailer-deck"},
        cast=[
            Cast("elazar", (18.4, 10.7), 95.0),
            Cast("yoezer", (20.6, 12.6), 120.0),
            Cast("tamar", (16.4, 12.8), 70.0, chapter=CH2),
            Cast("player:look-1", (12.8, 11.4), 85.0, marks=("cloak-roll",)),
            Cast("ami", (14.8, 13.6), 60.0, pose="sit", marks=("wrapped-in-cloak",)),
        ],
        sky=squall,
        eye=(5.2, 15.8, 5.0),
        target=(36.0, 8.6, 3.0),
        lens=26.0,
        samples=192,
        grade={"exposure": 0.2, "contrast": 1.12, "balance": (1.02, 1.0, 1.0), "saturation": 0.92, "vignette": 0.3, "bloom": 0.12},
    )
)


# ── Chapter 3: A Journey to Bethlehem ───────────────────────────────────────
shot(
    PlaceShot(
        "journey-to-bethlehem",
        "tamar-house",
        "night",
        chapter=CH3,
        show={"stable-loom", "stable-tools", "straw-bed", "bedding", "guest-grain", "guest-tools", "spare-mat", "your-mat", "bread"},
        cast=[
            # The household and its guests, filling the family's end of the room.
            Cast("amram", (10.2, 4.0), 40.0, pose="sit"),
            Cast("asa", (11.6, 3.5), 20.0, pose="sit"),
            Cast("crowd:crowd-0", (12.9, 3.8), 10.0, pose="sit"),
            Cast("peninah", (14.6, 4.0), 30.0, pose="sit"),
            Cast("dodi", (15.5, 3.4), -90.0, pose="lie"),
            Cast("crowd:crowd-2", (12.6, 6.2), -60.0, pose="sit"),
            Cast("crowd:crowd-1", (9.6, 6.6), -120.0, pose="sit"),
            Cast("crowd:crowd-3", (10.6, 7.9), -120.0, pose="sit"),
            # Turning to the door, where a late stranger stands with his lamp.
            Cast("tamar", (11.4, 6.1), -100.0),
            Cast("hagit", (8.3, 8.7), -95.0),
            Cast("player:look-2", (11.0, 8.9), -95.0),
            Cast("zerah", (6.0, 9.0), 85.0),
        ],
        # From inside, at the guests' end, looking down the room to the door.
        closed=True,
        eye=(13.8, 8.2, 1.7),
        target=(5.5, 8.6, 1.0),
        lens=22.0,
        exposure=0.4,
        grade={"contrast": 1.08, "balance": (0.99, 1.0, 1.03), "saturation": 0.92, "vignette": 0.3, "bloom": 0.2, "bloom_threshold": 0.7},
    )
)


# ── Chapter 4: A Letter from Paul ───────────────────────────────────────────
def letter_table(scene, p):
    """The letter waiting to be read: a round table (the house's own, as the
    Roman kit builds it) with a sealed roll of papyrus and a clay lamp; two
    more lampstands lit for the gathering."""
    x, y = 13.9, 7.35
    link(scene, p._round_table("key-table", x, y))
    top = p.P(x, y, 0.70)
    link(scene, sealed_letter("key-letter", top + Vector((0.05, -0.05, 0.0)), math.radians(12), length=0.34, r=0.032))
    p.clay_lamp("key-lamp", top + Vector((-0.2, 0.12, 0.0)), lit=True, power=6.0)
    for k, (lx, ly) in enumerate(((10, 4), (17, 4))):
        link(scene, p._lampstand(f"key-lampstand{k}", lx, ly))
    for o in p.lights:
        if o.name.startswith(("key-", "key")) and not o.users_collection:
            scene.collection.objects.link(o)


shot(
    PlaceShot(
        "letter-from-paul",
        "philemon-house",
        "dusk",
        chapter=CH4,
        cast=[
            Cast("zenon", (13.9, 5.2), 0.0),
            Cast("tychicus", (15.0, 5.7), -35.0),
            Cast("philemon", (12.8, 5.7), 35.0),
            Cast("onesimus", (16.2, 6.2), -70.0),
            Cast("ammia", (11.6, 6.2), 70.0),
            Cast("hermon", (13.0, 4.0), 10.0),
            Cast("tatia", (14.9, 3.9), -10.0),
            Cast("melitta", (11.3, 4.9), 40.0),
        ],
        hide=("garden-8", "garden-9"),
        extra=letter_table,
        eye=(13.9, 9.0, 1.35),
        target=(13.9, 5.6, 0.87),
        lens=22.0,
        focus=(13.9, 7.35, 0.75),
        fstop=8.0,
        exposure=0.5,
        grade={"contrast": 1.06, "balance": (1.03, 1.0, 0.97), "vignette": 0.25, "bloom": 0.18, "bloom_threshold": 0.7},
    )
)


# ── The title screen, and Chapter 1: on the teaser's sets ───────────────────
def title_dawn(ctx, scene):
    """Dawn over Jerusalem: high over the flat roofs of the lower city,
    looking east past the gate to where the road leaves it and winds down
    into the wilderness, the sun just up over the hills."""
    import teaser_look as LK
    import teaser_render as R
    import teaser_shots as TS

    land, city, mk = TS.city_set(ctx, scene, heading=math.radians(20.0), fov=math.radians(140), shrubs=True)
    gx, gy, gz = city.gx, city.gy, city.gz
    LK.eevee(scene, preview=ctx.preview, volume_end=6000.0)
    LK.sky(scene, 14.0, 3.0, sun_strength=4.0, sky_strength=0.45, color="#ffab62", aerosol=3.0, angle=0.7, bounce=0.36, bounce_color="#e8b88c", horizon_amount=0.35, horizon_color="#f0c99e", clouds=dict(kind="alto", cover=0.5, color="#ffc890", shade="#9f93a3", brightness=1.9, scale=1.2, wind=30.0, seed=1.0))
    LK.haze(scene, 0.00016, "#ead2b8", ground=gz - 120.0, scale_height=450.0, centre=(gx, gy), anisotropy=0.72)
    scene.view_settings.exposure = -1.3
    cam = R.camera(scene, lens=28.0)
    R.aim(cam, (gx - 330.0, gy - 40.0, gz + 95.0), (gx + 1500.0, gy + 560.0, gz - 140.0), 28.0)


def jericho_walker(ctx, scene):
    """The traveller alone on the path along the gorge's rim, going down
    toward Jericho: seen from behind and above, small against the land, the
    gorge falling away on the right and the path bending on ahead."""
    import teaser_look as LK
    import teaser_render as R
    import teaser_shots as TS

    land = ctx.land()
    path = land.paths[0]
    s0 = 520.0
    z = TS.ground_at(land)
    at = path.point(s0)
    ahead = path.point(s0 + 30.0)
    head = math.atan2(ahead[1] - at[1], ahead[0] - at[0])
    d = Vector((math.cos(head), math.sin(head), 0.0))
    left = Vector((-d.y, d.x, 0.0))
    eye = Vector((at[0], at[1], z(at[0], at[1]))) - d * 7.0 + left * 2.2 + Vector((0, 0, 3.2))
    # The player as the game draws them: the MakeHuman figure of the
    # people sheets (world_person), mid-stride, facing down the path.
    import world_person

    pid, app, player, _ = K.identity(K.chapter_data(), "player:look-1")
    person = world_person.Person(app, marks={"water-skin"}, name="walker", pid=pid, player=player, chapter="road-to-jericho")
    spec = dict(walk=0.3, yaw=head + math.pi / 2)
    person.prepare([spec])
    person.pose(**spec)
    w = Vector((at[0], at[1], z(at[0], at[1])))
    person.rig.root.location = w
    # The land after the figure: its clothes are simulated on a timeline,
    # which is slow with a whole landscape in the scene.
    TS.land_set(ctx, scene, (eye.x, eye.y), head, fov=math.radians(170), far=700.0, r0=0.05, n_theta=1400)
    LK.eevee(scene, preview=ctx.preview)
    LK.sky(scene, math.degrees(head) + 50.0, 16.0, sun_strength=5.0, sky_strength=0.22, color="#ffd09a", aerosol=1.8, clouds=dict(kind="cirrus", cover=0.45, color="#fff1de", shade="#c2c3ca", brightness=2.0, scale=1.0, wind=-10.0, seed=4.0))
    LK.haze(scene, 0.00007, "#dcd2c4", ground=w.z - 250.0, scale_height=900.0, centre=(w.x, w.y))
    scene.view_settings.exposure = -1.55
    cam = R.camera(scene, lens=35.0)
    far = path.point(s0 + 160.0)
    target = Vector((far[0], far[1], z(far[0], far[1]) - 14.0)) - left * 45.0
    look = (target - eye).normalized() * 0.55 + (w + Vector((0, 0, 0.9)) - eye).normalized() * 0.45
    R.aim(cam, eye, eye + look * 50.0, 35.0)
    R.focus(cam, (w - eye).length, 11.0)


shot(FilmShot("title", title_dawn, res=(1920, 960), grade={"contrast": 1.1, "balance": (1.08, 1.0, 0.9), "saturation": 1.02, "vignette": 0.24, "bloom": 0.12, "shadows": (0.012, 0.004, -0.008)}))
shot(FilmShot("road-to-jericho", jericho_walker, grade={"contrast": 1.12, "saturation": 0.98, "balance": (1.05, 1.0, 0.94), "vignette": 0.24}))
