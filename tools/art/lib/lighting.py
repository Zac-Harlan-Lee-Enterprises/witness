"""Daylight, later-day and night lighting: one sun (or the moon) and a sky.

The sun is where it would be in Jerusalem: in the market's morning it
stands in the east-south-east, so the stone fronts facing the viewer catch
warm, raking light from the right and shadows reach up and to the left.
Later in the day it has crossed to the west-south-west and dropped low:
fronts lit from the left, longer, warmer shadows reaching right.

At night a bright moon stands high in the south-south-east: a cool, dim
key with soft shadows, under a clear night sky (deep blue, darker at the
zenith, with stars that show only in water and polished things). The
place's own fires and lamps, lit only at night, are what the eye goes to.
A night render is exposed brighter (`exposure`, in EV), as the eye adapts;
the game grades it gently on top.
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
    "night": {
        "azimuth": math.radians(-66.0),  # the moon, south-south-east
        "elevation": math.radians(46.0),
        "strength": 0.6,
        "color": "#98aeea",
        "angle": math.radians(0.6),
        "sky_strength": 0.4,
        "exposure": 2.2,
        "night": True,
    },
}


def exposure(name):
    """Extra exposure (EV) a lighting variant renders at (night: the eye adapts)."""
    return LIGHTS.get(name, {}).get("exposure", 0.0)


def is_night(name):
    return bool(LIGHTS.get(name, {}).get("night"))


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


def _area(scene, name, loc, target, energy, color, size):
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


def _clear_people_lights(scene):
    for obj in [o for o in scene.objects if o.type == "LIGHT" and (o.name.startswith("Sun") or o.name.startswith("Indoor"))]:
        bpy.data.objects.remove(obj, do_unlink=True)


def setup_lamplight(scene):
    """People indoors at night (the 'lamplight' variant of their sheets): a
    warm oil lamp high to the front left, the hearth's glow low on the other
    side, a little warm light off the plaster behind, and only a trace of
    cool moonlight from the window. Darker than the day's room."""
    _clear_people_lights(scene)
    target = (0.0, 0.0, 0.9)
    _area(scene, "IndoorKey", (-1.5, -1.8, 2.0), target, 62.0, "#ff9e52", 0.5)
    _area(scene, "IndoorHearth", (1.7, -1.2, 0.5), target, 20.0, "#ff7a3a", 0.8)
    _area(scene, "IndoorMoon", (2.4, 0.6, 2.2), target, 6.0, "#9fb2dc", 1.2)
    _area(scene, "IndoorBounce", (0.2, 2.2, 2.4), target, 10.0, "#ffb070", 2.0)
    world = bpy.data.worlds.get("RoomNight") or bpy.data.worlds.new("RoomNight")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = hex_rgb("#3a2a20")
    bg.inputs["Strength"].default_value = 0.12
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return None


def setup(scene, name):
    if name == "indoor":
        return setup_indoor(scene)
    if name == "lamplight":
        return setup_lamplight(scene)
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
    if s.get("night"):
        night_world(scene, s["sky_strength"])
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
