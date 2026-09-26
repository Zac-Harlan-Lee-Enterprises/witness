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
}


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
    data = bpy.data.lights.new("Sun", "SUN")
    data.energy = s["strength"]
    data.color = hex_rgb(s["color"])[:3]
    data.angle = s["angle"]
    sun = bpy.data.objects.new("Sun", data)
    scene.collection.objects.link(sun)
    to_sun = sun_vector(name)
    sun.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()

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
