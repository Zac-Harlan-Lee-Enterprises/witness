"""Key art for the menus: the title screen's hero image and one image per
chapter for chapter select, rendered from the game's own places, people and
light (build_key_art.py renders them; key_art_shots.py says what each shows).

A *place shot* builds one of the game's places exactly as build_place.py
does (place.Place), stands the game's people in it (world_person.Person,
the MakeHuman figures the sheets are rendered from), lights it with the
light the story shows it in (lighting.py; the place's own lamps and fires
in the lights they burn in) and looks at it through a perspective film
camera instead of the game's orthographic one. Rooms keep their cutaway:
their near walls and roof are occluders, unseen but still shading.

A *film shot* reuses the teaser's film-scale sets (teaser_shots.py): the
Judean wilderness, Jerusalem and its market.

Each still is graded like a film frame (teaser_render.grade) and written as
WebP at full size and at half size (phones): public/art/key-art/<id>.webp
and <id>-<half width>.webp.

Everything is procedural and original: no downloaded images, textures or
models (MakeHuman's CC0 geometry only, as the game's people), and no
generative models.
"""
import json
import math
import os

import bpy
import numpy as np
from mathutils import Vector

import common
import imageio
import lighting
import teaser_render as R

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data", "chapter.json")
# Lights in which a lamp carried at the belt burns (build_people.DARK).
DARK = {"night", "lamp", "dusk", "lamplight"}


def B(x, y, z=0.0):
    """Map tiles (x east, y south, z up) to Blender."""
    return Vector((x, -y, z))


class Cast:
    """Someone in a place shot.

    who: a character id ('ammia'), 'player:look-1' or 'crowd:crowd-0'
    at: map position in tiles (x, y; fractions allowed)
    face: degrees, 0 facing the game camera (south), 90 east, -90 west, 180 north
    pose: 'stand', 'sit' or 'lie'
    marks: the story's marks they carry ('wrapped-in-cloak', 'letter-case'...)
    carry: overrides what their appearance carries
    talk: 0, 1 or 2 (mouth open); walk: a walk-cycle phase 0..1, or None
    """

    def __init__(self, who, at, face=0.0, pose="stand", marks=(), carry=None, talk=0, walk=None, breath=0.5, chapter=None):
        self.who = who
        self.at = at
        self.face = face
        self.pose = pose
        self.marks = tuple(marks)
        self.carry = carry
        self.talk = talk
        self.walk = walk
        self.breath = breath
        self.chapter = chapter


class PlaceShot:
    """A still of one of the game's places (see the module docstring).

    scene: the place's scene id; light: a light of lighting.LIGHTS (what
    exists and burns in it follows the place's own tags); show: ids of
    story entities to show (everything shown only while a story condition
    holds is hidden otherwise); hide: sprite ids or id prefixes to leave
    out; eye and target: map tiles (x, y, height); sky(scene, place) and
    extra(scene, place) customise the light and the set after the build."""

    kind = "place"

    def __init__(self, id, scene, light, cast, eye, target, lens=35.0, show=(), hide=(), samples=256, exposure=0.0, grade=None, sky=None, extra=None, focus=None, fstop=None, res=(1600, 600), chapter=None, roll=0.0, closed=False):
        self.id = id
        self.scene = scene
        self.light = light
        self.cast = cast
        self.eye = eye
        self.target = target
        self.lens = lens
        self.show = set(show)
        self.hide = tuple(hide)
        self.samples = samples
        self.exposure = exposure
        self.grade = grade or {}
        self.sky = sky
        self.extra = extra
        self.focus = focus
        self.fstop = fstop
        self.res = res
        self.chapter = chapter
        self.roll = roll
        # A room seen from inside: its near walls and roof (the cutaway's
        # occluders) are seen too.
        self.closed = closed


class FilmShot:
    """A still made on the teaser's sets: build(ctx, scene) builds the set,
    light and camera (as a teaser shot does) and returns nothing."""

    kind = "film"

    def __init__(self, id, build, grade=None, res=(1600, 600), samples=128):
        self.id = id
        self.build = build
        self.grade = grade or {}
        self.res = res
        self.samples = samples


def chapter_data():
    with open(DATA) as fh:
        return json.load(fh)


def identity(data, who, chapter=None):
    """(sheet id, appearance, is the player, chapter) for someone, as
    build_people.py names them (a name two chapters share: id.chapter)."""
    if who.startswith("player:"):
        p = next(p for p in data["players"] if p["id"] == who.split(":", 1)[1])
        return f"player-{p['id']}", dict(p["appearance"]), True, chapter or ""
    if who.startswith("crowd:"):
        c = next(c for c in data["crowd"] if c["id"] == who.split(":", 1)[1])
        return c["id"], dict(c["appearance"]), False, chapter or ""
    matches = [c for c in data["characters"] if c["id"] == who]
    c = next((c for c in matches if c["chapter"] == chapter), matches[0])
    keys = {m["key"] for m in matches}
    pid = c["id"] if len(keys) == 1 else f"{c['id']}.{c['chapter']}"
    return pid, dict(c["appearance"]), False, c["chapter"]


def build_cast(shot, data):
    """Everyone in a shot, built and posed at the origin (their clothes
    simulated for the pose), before the place exists: [(Cast, Person)]."""
    import world_person

    out = []
    for k, c in enumerate(shot.cast):
        pid, app, player, chapter = identity(data, c.who, c.chapter or shot.chapter)
        rest = None if c.pose == "stand" else c.pose
        if c.carry is not None:
            app["carry"] = c.carry
        elif rest and app.get("carry") != "lamb":
            app["carry"] = "none"
        person = world_person.Person(app, marks=set(c.marks), name=f"cast{k}-{pid}", pid=pid, player=player, chapter=chapter, rest=rest)
        spec = dict(yaw=math.radians(c.face), rest=rest, breath=c.breath, talk=c.talk, walk=c.walk)
        person.prepare([spec])
        person.pose(**spec)
        out.append((c, person, spec))
    return out


def only_in(o, light):
    tag = o.get("variants") if hasattr(o, "get") else None
    return not tag or light in str(tag).split(",")


def render_place(shot, quality, raw_path):
    """Build, light and render a place shot to a 16-bit PNG."""
    import place as PL

    preview = quality == "preview"
    data = chapter_data()
    scene_data = next(s for s in data["scenes"] if s["id"] == shot.scene)
    scene = common.reset(max(16, shot.samples // 8) if preview else shot.samples)
    scene.cycles.sample_clamp_indirect = 10.0
    scene.cycles.blur_glossy = 0.5
    cast = build_cast(shot, data)
    p = PL.Place(scene_data).build()
    for sp in p.sprites:
        for o in sp.objects:
            if not o.users_collection:
                scene.collection.objects.link(o)
    light = shot.light
    lighting.setup(scene, light)
    scene.view_settings.exposure = -1.4 + p.exposure + lighting.ev(light) + p.variant_exposure.get(light, 0.0) + shot.exposure
    for lamp in p.lights:
        lamp.hide_render = not only_in(lamp, light)
    hidden = set()
    for sp in p.sprites:
        entity = sp.id.split(":", 1)[1] if sp.id.startswith("entity:") else None
        if sp.conditional and entity not in shot.show:
            hidden.update(sp.objects)
        if any(sp.id == h or (h.endswith("-") and sp.id.startswith(h)) for h in shot.hide):
            hidden.update(sp.objects)
    occluders = set(p.occluders)
    for o in scene.objects:
        if o.type not in ("MESH", "CURVES"):
            continue
        o.hide_render = o in hidden or not only_in(o, light)
        if o in occluders and not shot.closed:
            o.visible_camera = False
    # Everyone where they stand; a lamp at the belt burns only after dark.
    for c, person, spec in cast:
        x, y = c.at
        person.rig.root.location = p.P(x, y)
        person.pose(**spec)
        for part in person.parts:
            if part.obj.get("night_only") and light not in DARK:
                part.obj.hide_render = True
    scene.render.film_transparent = False
    if shot.sky:
        shot.sky(scene, p)
    if shot.extra:
        shot.extra(scene, p)
    w, h = shot.res
    if preview:
        w, h = w // 2, h // 2
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1.0
    cam = R.camera(scene, lens=shot.lens, clip=(0.05, 4000.0))
    R.aim(cam, B(*shot.eye), B(*shot.target), shot.lens, roll=shot.roll)
    if shot.focus:
        R.focus(cam, (B(*shot.focus) - B(*shot.eye)).length, shot.fstop or 4.0)
    R.render_still(scene, raw_path)


def render_film(shot, quality, raw_path, cache):
    import teaser_shots

    preview = quality == "preview"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    w, h = shot.res
    if preview:
        w, h = w // 2, h // 2
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    ctx = teaser_shots.Context(preview=preview, cache=cache)
    shot.build(ctx, scene)
    scene.eevee.taa_render_samples = 16 if preview else shot.samples
    R.render_still(scene, raw_path)


def finish(shot, raw_path, out_dir):
    """Grade the render and write it: <id>.webp and <id>-<half width>.webp."""
    img = imageio.load(raw_path)
    rgb = R.grade(img[:, :, :3], shot.grade)
    full = np.concatenate([rgb, np.ones_like(rgb[:, :, :1])], axis=2)
    os.makedirs(out_dir, exist_ok=True)
    w = full.shape[1]
    paths = [os.path.join(out_dir, f"{shot.id}.webp"), os.path.join(out_dir, f"{shot.id}-{w // 2}.webp")]
    imageio.save(full, paths[0], "WEBP", 82)
    imageio.save(imageio.downsample_sharp(full, 0.25), paths[1], "WEBP", 84)
    imageio.save(full, os.path.splitext(raw_path)[0] + "-graded.png", "PNG")
    return paths
