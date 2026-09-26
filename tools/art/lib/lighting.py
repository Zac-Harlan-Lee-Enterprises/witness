"""Daylight and later-day lighting: one sun and a physically based sky.

The sun is where it would be in Jerusalem: in the market's morning it
stands in the east-south-east, so the stone fronts facing the viewer catch
warm, raking light from the right and shadows reach up and to the left.
Later in the day it has crossed to the west-south-west and dropped low:
fronts lit from the left, longer, warmer shadows reaching right.

Two more lights for places whose story needs them (listed in PLACE_LIGHTS
below; see build_place.py):
  - `overcast`: a road under rain cloud. The sun is only a faint, very soft
    brightening of the cloud to the south-east; an even grey sky, brighter
    overhead than at the horizon, lights everything from above, so shadows
    are soft pools under things rather than shapes.
  - `dusk`: lamp-lighting. The sun has set; a deep blue sky still glows
    faintly, and the place's own lamps light the room.
  - `night`: a bright moon high in the south-south-east, a cool, dim key
    with soft shadows, under a clear night sky (deep blue, darker at the
    zenith, with stars that show only in water). The place's own fires and
    lamps, lit only at night, are what the eye goes to. Exposed brighter
    (`ev`), as the eye adapts; the game grades it gently on top.
And one more light for people: `lamp` (people at lamp-lighting, lit by
lampstands, with the last blue of the sky above; also people in a house
lit by its lamps at night).
"""
import math

import bpy
from mathutils import Vector

from common import hex_rgb

# Direction TOWARD the sun, in Blender axes (x east, y north, z up).
LIGHTS = {
    "day": {
        "azimuth": math.radians(-32.0),  # from east, counter-clockwise: -32 = east-south-east
        "elevation": math.radians(40.0),
        "strength": 4.6,
        "color": "#ffe4bd",
        "angle": math.radians(2.0),
        "sky_strength": 0.26,
    },
    "late": {
        "azimuth": math.radians(203.0),  # west-south-west
        "elevation": math.radians(21.0),
        "strength": 3.6,
        "color": "#ffc47e",
        "angle": math.radians(2.4),
        "sky_strength": 0.3,
    },
    "overcast": {
        "azimuth": math.radians(-58.0),
        "elevation": math.radians(55.0),
        "strength": 0.5,
        "color": "#e8ecf0",
        # A sun as wide as a patch of bright cloud: shadows melt into soft pools.
        "angle": math.radians(50.0),
        "sky": {"zenith": "#d4d8dc", "horizon": "#a9aeb2", "ground": "#6e6a60"},
        "sky_strength": 1.05,
        # The shade mask records how much of the sky a point sees.
        "shade": "sky",
        "shade_floor": 0.7,
        "ev": 1.3,
    },
    "dusk": {
        "azimuth": math.radians(200.0),
        "elevation": math.radians(-6.0),
        "strength": 0.0,
        "color": "#ffb070",
        "angle": math.radians(2.0),
        "sky": {"zenith": "#22345c", "horizon": "#6a5a78", "ground": "#1a1614"},
        "sky_strength": 1.6,
        # The shade mask records the lamps' light on the floor.
        "shade": "lamps",
        "shade_floor": 0.42,
        "ev": 0.0,
    },
    "night": {
        "azimuth": math.radians(-66.0),  # the moon, south-south-east
        "elevation": math.radians(46.0),
        "strength": 0.6,
        "color": "#98aeea",
        "angle": math.radians(0.6),
        "sky_strength": 0.4,
        # A clear night sky with stars (night_world).
        "stars": True,
        # The shade mask records all the light there is: the moon, the
        # fires and the lamps (in a room, the lamps: its dark corners dim people).
        "shade": "all",
        "room_shade_floor": 0.4,
        "ev": 2.2,
    },
}


def ev(name):
    """Exposure (EV) a light adds to the pipeline's base exposure."""
    return LIGHTS.get(name, {}).get("ev", 0.0)


# ── The story's light, place by place ───────────────────────────────────────
# Most places are lit by the sun of the hour: a room has one set rendered in
# the morning ({"day": "day"}, people lit "indoor"); an outdoor place a
# morning and a later-day set ({"day": "day", "late": "late"}, people lit by
# each set's sun). The game picks the set by the story hour ("late" from
# 15:00, src/game/prerendered/select.ts variantFor).
#
# A place the story shows in other light is listed here: scene id ->
# (plan, people light).
#   plan: each set of its manifest -> the light (a key of LIGHTS) it is
#         rendered in. Sets are keyed "day" and "late", by when in the story
#         they are shown; a place seen in one light only has a "day" set
#         rendered in that light.
#   people light: how people are lit there (the manifest's peopleLight, a
#         PEOPLE_LIGHTS value in src/game/prerendered/manifest.ts): "indoor",
#         "overcast", "lamp" or a light added beside them; None lights them
#         by the sun of each set.
# The people job renders exactly those lights for everyone seen there
# (build_people.py reads each place's manifest: render places first).
PLACE_LIGHTS = {
    # Chapter 4. The Laodicea road is walked from mid-morning as the rain
    # sweeps down the valley (hours 11-14, always the morning set): rain
    # cloud and wet stone. The game draws the rain itself.
    "lycus-road": ({"day": "overcast"}, "overcast"),
    # The gathering at Philemon's house is at lamp-lighting (hour 18), and only then.
    "philemon-house": ({"day": "dusk"}, "lamp"),
    # Chapter 3. Bethlehem is seen from mid-afternoon into the night; a place's
    # "night" set is shown from 18:00 until 05:00 (select.ts isNightHour).
    # Its people light may be given per set: {set: people light}.
    # Tamar's house by day, and at night lit by its lamps and the oven.
    "tamar-house": ({"day": "day", "night": "night"}, {"day": "indoor", "night": "lamp"}),
    # The lanes and the fold: first seen after 15:00 (their "day" set is
    # rendered in the later-day sun), then after dark by the moon, fires and lamps.
    "bethlehem-lanes": ({"day": "late", "night": "night"}, {"day": "late", "night": "night"}),
    "shepherds-fields": ({"day": "late", "night": "night"}, {"day": "late", "night": "night"}),
}


def plan_for(scene_id, room):
    """({set: light}, people light) for a place (see PLACE_LIGHTS). The
    people light is one for the whole place, None (each set's sun), or
    {set: people light}."""
    if scene_id in PLACE_LIGHTS:
        plan, people = PLACE_LIGHTS[scene_id]
        return dict(plan), people
    return ({"day": "day"}, "indoor") if room else ({"day": "day", "late": "late"}, None)


def sun_vector(name):
    s = LIGHTS[name]
    el = s["elevation"]
    az = s["azimuth"]
    return Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))


def ground_shadow_offset(name, height):
    """Where the shadow of a point `height` above the ground lands (game units, screen x/y)."""
    v = sun_vector(name)
    k = height / v.z
    # Shadow travels away from the sun; Blender -y is game +y (south).
    return (-v.x * k, v.y * k)


def setup_indoor(scene):
    """People indoors (the 'indoor' variant of their sheets): a warm key
    from an oil lamp and the oven, high to the front left; cool, soft
    daylight from a window on the right; warm light bounced off the
    plaster from behind; and a dim, warm room instead of the sky."""
    for obj in [o for o in scene.objects if o.type == "LIGHT" and (o.name.startswith("Sun") or o.name.startswith("Indoor"))]:
        bpy.data.objects.remove(obj, do_unlink=True)

    def area(name, loc, target, energy, color, size):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = hex_rgb(color)[:3]
        data.size = size
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        d = Vector(target) - Vector(loc)
        obj.rotation_euler = (-d).to_track_quat("Z", "Y").to_euler()
        return obj

    target = (0.0, 0.0, 0.9)
    area("IndoorKey", (-1.6, -1.9, 2.3), target, 95.0, "#ffb16a", 0.8)
    area("IndoorWindow", (2.4, -0.8, 1.9), target, 55.0, "#dfe6ee", 1.4)
    area("IndoorBounce", (0.2, 2.2, 2.6), target, 30.0, "#ffd2a0", 2.0)
    world = bpy.data.worlds.get("Room") or bpy.data.worlds.new("Room")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = hex_rgb("#6a5440")
    bg.inputs["Strength"].default_value = 0.35
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return None


def night_world(scene, strength):
    """A clear night sky: deep blue, darker overhead and a little paler at
    the horizon, with stars (small bright points of varied brightness) and
    a faint band of the Milky Way. It lights the scene only as a dim cool
    fill; the stars show in water, wet stone and glazed pots."""
    world = bpy.data.worlds.get("Night") or bpy.data.worlds.new("Night")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    # Height of the direction above the horizon: Generated is the view direction.
    grad = nt.nodes.new("ShaderNodeValToRGB")
    grad.color_ramp.elements[0].position = 0.0
    grad.color_ramp.elements[0].color = hex_rgb("#22335a")
    grad.color_ramp.elements[1].position = 0.55
    grad.color_ramp.elements[1].color = hex_rgb("#0a1328")
    zc = nt.nodes.new("ShaderNodeMath")
    zc.operation = "MAXIMUM"
    zc.inputs[1].default_value = 0.0
    nt.links.new(sep.outputs["Z"], zc.inputs[0])
    nt.links.new(zc.outputs[0], grad.inputs["Fac"])
    # Stars: the centres of fine Voronoi cells, only the brightest few.
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 260.0
    nt.links.new(tc.outputs["Generated"], vor.inputs["Vector"])
    star = nt.nodes.new("ShaderNodeMapRange")
    star.inputs["From Min"].default_value = 0.06
    star.inputs["From Max"].default_value = 0.0
    star.inputs["To Min"].default_value = 0.0
    star.inputs["To Max"].default_value = 1.0
    nt.links.new(vor.outputs["Distance"], star.inputs["Value"])
    bright = nt.nodes.new("ShaderNodeMapRange")
    bright.inputs["From Min"].default_value = 0.82
    bright.inputs["From Max"].default_value = 1.0
    bright.inputs["To Min"].default_value = 0.0
    bright.inputs["To Max"].default_value = 40.0
    nt.links.new(vor.outputs["Color"], bright.inputs["Value"])
    stars = nt.nodes.new("ShaderNodeMath")
    stars.operation = "MULTIPLY"
    nt.links.new(star.outputs["Result"], stars.inputs[0])
    nt.links.new(bright.outputs["Result"], stars.inputs[1])
    add = nt.nodes.new("ShaderNodeMix")
    add.data_type = "RGBA"
    add.blend_type = "ADD"
    add.inputs[0].default_value = 1.0
    nt.links.new(grad.outputs["Color"], add.inputs[6])
    comb = nt.nodes.new("ShaderNodeCombineColor")
    for k in ("Red", "Green", "Blue"):
        nt.links.new(stars.outputs[0], comb.inputs[k])
    nt.links.new(comb.outputs[0], add.inputs[7])
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(add.outputs[2], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return world


def setup_lamp(scene):
    """People at lamp-lighting (the 'lamp' variant of their sheets): a warm
    key from a lampstand high to the front left, a second, dimmer lamp
    behind to the right (a warm rim), the last blue of the evening sky from
    above, and a dark room around them."""
    for obj in [o for o in scene.objects if o.type == "LIGHT" and (o.name.startswith("Sun") or o.name.startswith("Indoor"))]:
        bpy.data.objects.remove(obj, do_unlink=True)

    def light(name, kind, loc, energy, color, size, target=(0.0, 0.0, 0.9)):
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.color = hex_rgb(color)[:3]
        if kind == "AREA":
            data.size = size
        else:
            data.shadow_soft_size = size
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        d = Vector(target) - Vector(loc)
        obj.rotation_euler = (-d).to_track_quat("Z", "Y").to_euler()
        return obj

    # Small and warm, but set higher than a lampstand's flame, so shadows on
    # the floor stay short (the lamps of the room itself are baked in it).
    light("IndoorLampKey", "AREA", (-1.3, -1.6, 2.5), 140.0, "#ffb46e", 0.45)
    light("IndoorLampRim", "AREA", (1.5, 1.2, 2.3), 60.0, "#ffc48a", 0.45)
    light("IndoorSky", "AREA", (0.3, 0.2, 4.0), 38.0, "#8a9cc8", 3.0)
    world = bpy.data.worlds.get("Evening") or bpy.data.worlds.new("Evening")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = hex_rgb("#3a2e2a")
    bg.inputs["Strength"].default_value = 0.25
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return None


def _gradient_sky(nt, colors, strength):
    """An even sky (no sun disc): `ground` below the horizon, `horizon`, and
    `zenith` overhead, blended by the height of the direction looked in."""
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    # Generated z runs -1 (down) .. 1 (up): map to 0..1.
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -1.0
    mr.inputs["From Max"].default_value = 1.0
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    els = ramp.color_ramp.elements
    els[0].position = 0.46
    els[0].color = hex_rgb(colors["ground"])
    els[1].position = 1.0
    els[1].color = hex_rgb(colors["zenith"])
    h = els.new(0.515)
    h.color = hex_rgb(colors["horizon"])
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def setup(scene, name):
    if name == "indoor":
        return setup_indoor(scene)
    if name == "lamp":
        return setup_lamp(scene)
    for obj in [o for o in scene.objects if o.type == "LIGHT" and o.name.startswith("Indoor")]:
        bpy.data.objects.remove(obj, do_unlink=True)
    s = LIGHTS[name]
    # Only the sun is replaced: lights a place brings (a lamp, embers) stay.
    for obj in [o for o in scene.objects if o.type == "LIGHT" and o.name.startswith("Sun")]:
        bpy.data.objects.remove(obj, do_unlink=True)
    data = bpy.data.lights.new("Sun", "SUN")
    data.energy = s["strength"]
    data.color = hex_rgb(s["color"])[:3]
    data.angle = s["angle"]
    sun = bpy.data.objects.new("Sun", data)
    scene.collection.objects.link(sun)
    to_sun = sun_vector(name)
    sun.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()
    if s.get("stars"):
        night_world(scene, s["sky_strength"])
        return sun

    world = bpy.data.worlds.get("Sky") or bpy.data.worlds.new("Sky")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    if "sky" in s:
        _gradient_sky(nt, s["sky"], s["sky_strength"])
        return sun
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_disc = False
    sky.sun_elevation = s["elevation"]
    # Sky texture rotation is measured from +Y (north), clockwise toward +X (east).
    sky.sun_rotation = math.atan2(to_sun.x, to_sun.y)
    sky.altitude = 700.0
    sky.air_density = 1.0
    sky.aerosol_density = 1.6
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = s["sky_strength"]
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return sun
