"""Daylight and later-day lighting: one sun and a physically based sky.

The sun is where it would be in Jerusalem: in the market's morning it
stands in the east-south-east, so the stone fronts facing the viewer catch
warm, raking light from the right and shadows reach up and to the left.
Later in the day it has crossed to the west-south-west and dropped low:
fronts lit from the left, longer, warmer shadows reaching right.
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
    # The sun has gone down behind the western hills: no direct light, only
    # the sky, glowing orange and rose low in the west and deepening to
    # blue overhead and in the east. Shadows are soft contact shadows.
    "dusk": {
        "azimuth": math.radians(180.0),  # due west (below the horizon)
        "elevation": math.radians(-3.0),
        "strength": 0.0,
        "color": "#ff9a5a",
        "angle": math.radians(2.4),
        "sky_strength": 1.0,
        "exposure": 2.8,
        "glow": "#ff8f52",
        "glow_strength": 4.0,
    },
    # Night: moonlight from the south-east (so the fronts the camera sees
    # are lit), a deep blue sky, and whatever lamps and fires a place has.
    "night": {
        "azimuth": math.radians(-48.0),  # south-east
        "elevation": math.radians(38.0),
        "strength": 0.34,
        "color": "#a9bddf",
        "angle": math.radians(0.6),
        "sky_strength": 0.05,
        "exposure": 3.5,
        "zenith": "#0c1834",
        "horizon": "#233553",
    },
}


def exposure(name):
    """Exposure (EV) a light adds to the base, as an eye or camera adapts to dusk and night."""
    return LIGHTS.get(name, {}).get("exposure", 0.0)


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


def setup(scene, name):
    if name == "indoor":
        return setup_indoor(scene)
    for obj in [o for o in scene.objects if o.type == "LIGHT" and o.name.startswith("Indoor")]:
        bpy.data.objects.remove(obj, do_unlink=True)
    s = LIGHTS[name]
    # Only the sun is replaced: lights a place brings (a lamp, embers) stay.
    for obj in [o for o in scene.objects if o.type == "LIGHT" and o.name.startswith("Sun")]:
        bpy.data.objects.remove(obj, do_unlink=True)
    to_sun = sun_vector(name)
    sun = None
    if s["strength"] > 0:
        data = bpy.data.lights.new("Sun", "SUN")
        data.energy = s["strength"]
        data.color = hex_rgb(s["color"])[:3]
        data.angle = s["angle"]
        sun = bpy.data.objects.new("Sun", data)
        scene.collection.objects.link(sun)
        sun.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()
    if name == "dusk":
        _dusk_world(scene, s, to_sun)
        return sun
    if name == "night":
        _night_world(scene, s)
        return sun

    world = bpy.data.worlds.get("Sky") or bpy.data.worlds.new("Sky")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
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


def _world(scene, name):
    world = bpy.data.worlds.get(name) or bpy.data.worlds.new(name)
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    return nt


def _dusk_world(scene, s, to_sun):
    """The sky just after sunset: the physical sky with the sun a little below
    the horizon (blue overhead), plus the afterglow: a warm band low in the
    west, fading up the sky and round toward the north and south."""
    nt = _world(scene, "Dusk")
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_disc = False
    sky.sun_elevation = s["elevation"]
    sky.sun_rotation = math.atan2(to_sun.x, to_sun.y)
    sky.altitude = 700.0
    sky.air_density = 1.0
    sky.aerosol_density = 2.2
    tc = nt.nodes.new("ShaderNodeTexCoord")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    west = Vector((to_sun.x, to_sun.y, 0.0)).normalized()
    nt.links.new(tc.outputs["Generated"], dot.inputs[0])
    dot.inputs[1].default_value = (west.x, west.y, 0.0)
    toward = nt.nodes.new("ShaderNodeMath")
    toward.operation = "MAXIMUM"
    nt.links.new(dot.outputs["Value"], toward.inputs[0])
    toward.inputs[1].default_value = 0.0
    lobe = nt.nodes.new("ShaderNodeMath")
    lobe.operation = "POWER"
    nt.links.new(toward.outputs["Value"], lobe.inputs[0])
    lobe.inputs[1].default_value = 2.2
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    up = nt.nodes.new("ShaderNodeMath")
    up.operation = "MAXIMUM"
    nt.links.new(sep.outputs["Z"], up.inputs[0])
    up.inputs[1].default_value = 0.0
    fall = nt.nodes.new("ShaderNodeMath")
    fall.operation = "MULTIPLY"
    nt.links.new(up.outputs["Value"], fall.inputs[0])
    fall.inputs[1].default_value = -5.0
    low = nt.nodes.new("ShaderNodeMath")
    low.operation = "EXPONENT"
    nt.links.new(fall.outputs["Value"], low.inputs[0])
    band = nt.nodes.new("ShaderNodeMath")
    band.operation = "MULTIPLY"
    nt.links.new(lobe.outputs["Value"], band.inputs[0])
    nt.links.new(low.outputs["Value"], band.inputs[1])
    # A soft rose wash over the whole western half, under the orange band.
    wash = nt.nodes.new("ShaderNodeMath")
    wash.operation = "MULTIPLY_ADD"
    nt.links.new(toward.outputs["Value"], wash.inputs[0])
    wash.inputs[1].default_value = 0.18
    nt.links.new(band.outputs["Value"], wash.inputs[2])
    glow = nt.nodes.new("ShaderNodeMix")
    glow.data_type = "RGBA"
    glow.blend_type = "MIX"
    nt.links.new(band.outputs["Value"], glow.inputs[0])
    glow.inputs[6].default_value = hex_rgb("#e0906e")
    glow.inputs[7].default_value = hex_rgb(s["glow"])
    scale = nt.nodes.new("ShaderNodeVectorMath")
    scale.operation = "SCALE"
    nt.links.new(glow.outputs[2], scale.inputs[0])
    gs = nt.nodes.new("ShaderNodeMath")
    gs.operation = "MULTIPLY"
    nt.links.new(wash.outputs["Value"], gs.inputs[0])
    gs.inputs[1].default_value = s["glow_strength"]
    nt.links.new(gs.outputs["Value"], scale.inputs["Scale"])
    add = nt.nodes.new("ShaderNodeVectorMath")
    add.operation = "ADD"
    nt.links.new(sky.outputs["Color"], add.inputs[0])
    nt.links.new(scale.outputs["Vector"], add.inputs[1])
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = s["sky_strength"]
    nt.links.new(add.outputs["Vector"], bg.inputs["Color"])
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def _night_world(scene, s):
    """A clear night sky: deep blue overhead, a little paler toward the horizon."""
    nt = _world(scene, "Night")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    up = nt.nodes.new("ShaderNodeMath")
    up.operation = "MAXIMUM"
    nt.links.new(sep.outputs["Z"], up.inputs[0])
    up.inputs[1].default_value = 0.0
    root = nt.nodes.new("ShaderNodeMath")
    root.operation = "SQRT"
    nt.links.new(up.outputs["Value"], root.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    nt.links.new(root.outputs["Value"], mix.inputs[0])
    mix.inputs[6].default_value = hex_rgb(s["horizon"])
    mix.inputs[7].default_value = hex_rgb(s["zenith"])
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = s["sky_strength"] * 20.0
    nt.links.new(mix.outputs[2], bg.inputs["Color"])
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
