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


def setup(scene, name):
    s = LIGHTS[name]
    for obj in [o for o in scene.objects if o.type == "LIGHT"]:
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
