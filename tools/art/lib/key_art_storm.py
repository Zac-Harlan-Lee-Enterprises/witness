"""The squall on the Sea of Galilee, for Chapter 2's key art: the open lake
(the game's own place, open-lake) under a storm rolling in from the east.

The place ends a few metres past its map; a film camera on the deck sees to
the horizon, so this adds what lies beyond, procedurally:

  - `storm_water`: the lake whipped up by the wind (wave bumps at three
    scales, whitecaps where they break), on the place's own water surface
    and on a wide sheet of water around it out to the horizon;
  - `hills`: the steep eastern shore (the Golan side) and the hills round
    the north end, dark under the cloud;
  - `storm_sky`: the squall: a low, heavy deck of cloud, darkest over the
    hills ahead, its rolled underside caught by the last sun from the west
    behind the camera, and a curtain of rain falling from it far off;
  - a low, warm sun from the west: the boats and sails lit against the dark.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

import common
import materials as M
from common import hex_rgb


def storm_water():
    def build():
        n = M.Nodes("key-storm-water")
        obj = n.coords()
        # Swell from the east (long), wind waves across it, and chop.
        stretch = n.new("ShaderNodeVectorMath", _operation="MULTIPLY")
        n.link(obj[0], obj[1], stretch, 0)
        stretch.inputs[1].default_value = (0.35, 1.0, 1.0)
        swell = n.noise(0.35, 3.0, 0.55, (stretch, "Vector"))
        waves = n.noise(1.6, 4.0, 0.6, obj)
        chop = n.noise(7.0, 3.0, 0.55, obj)
        h = n.math("MULTIPLY_ADD", (waves, "Fac"), 0.55)
        n._in(h, 2, (swell, "Fac"))
        h2 = n.math("MULTIPLY_ADD", (chop, "Fac"), 0.2)
        n._in(h2, 2, (h, "Value"))
        bump = n.bump((h2, "Value"), strength=0.55, distance=0.25)
        # Whitecaps: the crests of the wind waves breaking, streaked downwind.
        crest = n.new("ShaderNodeMapRange", Value=(h2, "Value"), **{"From Min": 0.92, "From Max": 1.08})
        streak = n.noise(3.0, 6.0, 0.7, (stretch, "Vector"))
        # Darker and rougher toward the storm (east, +x): more of it breaking.
        geo = n.new("ShaderNodeNewGeometry")
        gx = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Position"))
        toward = n.new("ShaderNodeMapRange", Value=(gx, "X"), **{"From Min": 30.0, "From Max": 1500.0})
        more = n.math("MULTIPLY_ADD", (toward, "Result"), 1.6)
        n._in(more, 2, 1.0)
        caps = n.math("MULTIPLY", (crest, "Result"), (streak, "Fac"))
        caps = n.math("MULTIPLY", (caps, "Value"), (more, "Value"), clamp=True)
        water = n.mix((toward, "Result"), "#1b3434", "#0c1617")
        col = n.mix((caps, "Value"), (water, 2), "#d9dedb")
        rough = n.new("ShaderNodeMapRange", Value=(caps, "Value"), **{"To Min": 0.06, "To Max": 0.7})
        n.bsdf(
            **{
                "Base Color": (col, 2),
                "Roughness": (rough, "Result"),
                "IOR": 1.333,
                "Specular IOR Level": 0.6,
                "Normal": (bump, "Normal"),
            }
        )
        return n.mat

    return M.cached(("key-storm-water",), build)


def far_water(scene, z, x0, y0, x1, y1, reach=9000.0):
    """A sheet of water around the place's own (Blender rect x0..x1, y0..y1)
    out to the horizon, a hair below it."""
    bm = bmesh.new()
    r = reach
    quads = [
        ((-r, y1), (r, r)),
        ((-r, -r), (r, y0)),
        ((-r, y0), (x0, y1)),
        ((x1, y0), (r, y1)),
    ]
    for (ax, ay), (bx, by) in quads:
        vs = [bm.verts.new((ax, ay, z)), bm.verts.new((bx, ay, z)), bm.verts.new((bx, by, z)), bm.verts.new((ax, by, z))]
        bm.faces.new(vs)
    obj = common.mesh_object("key-far-water", bm, storm_water(), None, smooth=False)
    obj.visible_shadow = False
    return obj


def hills(scene, centre, z0, seed=3):
    """The shores beyond the lake: a steep wall of hills to the east and
    lower ones round the north, from 2.4 km out. Heights in metres (1 Blender
    unit = 1 m, as the places)."""
    rng = np.random.default_rng(seed)
    cx, cy = centre
    thetas = np.radians(np.linspace(-95.0, 110.0, 420))
    rs = np.concatenate([np.linspace(6000.0, 8500.0, 60), np.linspace(8600.0, 16000.0, 30)])
    ph = rng.uniform(0, math.tau, 8)

    def ridge(t):
        # The skyline: higher to the east (the Golan side), lower to the north.
        east = np.exp(-((t - 0.0) / 0.9) ** 2)
        base = 80.0 + 170.0 * east
        wob = sum(math.sin(k * 3.1 * t + ph[k]) * (70.0 / (k + 1)) for k in range(1, 8))
        return base + wob

    bm = bmesh.new()
    grid = []
    for r in rs:
        row = []
        for t in thetas:
            top = ridge(t)
            u = np.clip((r - 6000.0) / 2200.0, 0.0, 1.0)
            # A steep face rising from the water, then a rolling plateau.
            h = top * (1 - (1 - u) ** 2.2) + 25.0 * math.sin(r / 310.0 + 3 * t) * u
            row.append(bm.verts.new((cx + r * math.cos(t), cy + r * math.sin(t), z0 - 0.5 + max(0.0, h))))
        grid.append(row)
    for i in range(len(rs) - 1):
        for j in range(len(thetas) - 1):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))

    def build():
        n = M.Nodes("key-hills")
        obj = n.coords()
        g = n.noise(0.004, 6.0, 0.6, obj)
        col = n.mix((g, "Fac"), "#1d2124", "#2f332e")
        # Air between: the far hills fade toward the storm's grey.
        cam = n.new("ShaderNodeCameraData")
        far = n.new("ShaderNodeMapRange", Value=(cam, "View Distance"), **{"From Min": 6000.0, "From Max": 14000.0, "To Min": 0.35, "To Max": 0.8})
        col = n.mix((far, "Result"), (col, 2), "#5a606a")
        bump = n.bump((n.noise(0.02, 6.0, 0.6, obj), "Fac"), strength=0.4, distance=20.0)
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.9, "Normal": (bump, "Normal")})
        return n.mat

    obj = common.mesh_object("key-hills", bm, M.cached(("key-hills",), build), None, smooth=True)
    return obj


def storm_sky(scene, sun_az=182.0, sun_el=3.5, strength=1.0):
    """The squall's sky (the world shader) and the last sun under it."""
    for o in [o for o in scene.objects if o.type == "LIGHT" and o.name.startswith("Sun")]:
        bpy.data.objects.remove(o, do_unlink=True)
    sd = bpy.data.lights.new("SunStorm", "SUN")
    sd.energy = 3.2
    sd.color = hex_rgb("#ffb070")[:3]
    sd.angle = math.radians(1.5)
    sun = bpy.data.objects.new("SunStorm", sd)
    scene.collection.objects.link(sun)
    az, el = math.radians(sun_az), math.radians(sun_el)
    to_sun = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
    sun.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()

    world = bpy.data.worlds.new("KeyStorm")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    L = nt.links

    def node(kind, **kw):
        nd = nt.nodes.new(kind)
        for k, v in kw.items():
            if k.startswith("_"):
                setattr(nd, k[1:], v)
            elif isinstance(v, bpy.types.NodeSocket):
                L.new(v, nd.inputs[k])
            else:
                nd.inputs[k].default_value = v
        return nd

    def math_(op, *args, clamp=False):
        m = node("ShaderNodeMath", _operation=op, _use_clamp=clamp)
        for i, v in enumerate(args):
            if isinstance(v, bpy.types.NodeSocket):
                L.new(v, m.inputs[i])
            else:
                m.inputs[i].default_value = v
        return m.outputs[0]

    def mix(fac, a, b):
        m = node("ShaderNodeMix", _data_type="RGBA")
        L.new(fac, m.inputs[0])
        for i, v in ((6, a), (7, b)):
            if isinstance(v, bpy.types.NodeSocket):
                L.new(v, m.inputs[i])
            else:
                m.inputs[i].default_value = hex_rgb(v)
        return m.outputs[2]

    tc = node("ShaderNodeTexCoord")
    D = tc.outputs["Generated"]
    sep = node("ShaderNodeSeparateXYZ", Vector=D)
    x, y, zc = sep.outputs["X"], sep.outputs["Y"], sep.outputs["Z"]

    def smooth(value, a, b):
        return node("ShaderNodeMapRange", _interpolation_type="SMOOTHSTEP", Value=value, **{"From Min": a, "From Max": b}).outputs[0]

    def noise1(value, scale, detail=4.0, rough=0.6, w=0.0):
        vec = node("ShaderNodeCombineXYZ", X=value, Y=w, Z=0.0).outputs[0]
        return node("ShaderNodeTexNoise", Vector=vec, Scale=scale, Detail=detail, Roughness=rough).outputs["Fac"]

    az = math_("ARCTAN2", y, x)
    # How far round toward the squall (east, +x): it fills the sky ahead and
    # breaks up behind, to the west.
    ahead = smooth(x, -0.45, 0.25)
    # The high cloud above the shelf: a dark, rolling overcast seen in
    # perspective, (x, y) / z.
    zz = math_("MAXIMUM", zc, 0.03)
    uv = node("ShaderNodeCombineXYZ", X=math_("DIVIDE", x, zz), Y=math_("DIVIDE", y, zz), Z=0.0).outputs[0]
    big = node("ShaderNodeTexNoise", Vector=uv, Scale=0.35, Detail=6.0, Roughness=0.62, Distortion=0.6).outputs["Fac"]
    rolls = node("ShaderNodeTexNoise", Vector=uv, Scale=1.6, Detail=8.0, Roughness=0.62).outputs["Fac"]
    dens = math_("ADD", math_("MULTIPLY_ADD", math_("SUBTRACT", rolls, 0.5), 0.6, big), math_("MULTIPLY", ahead, 0.5))
    cover = smooth(dens, 0.42, 0.58)
    # The shelf cloud: a towering dark wall over the far hills, its base a
    # little above the horizon, its top billowing.
    base = math_("MULTIPLY_ADD", noise1(az, 7.0, 4.0), 0.045, 0.03)
    top = math_("MULTIPLY_ADD", noise1(az, 2.2, 5.0, 0.65, 3.0), 0.2, 0.14)
    shelf = math_("MULTIPLY", smooth(zc, base, math_("ADD", base, 0.012)), math_("SUBTRACT", 1.0, smooth(zc, math_("SUBTRACT", top, 0.06), top)))
    shelf = math_("MULTIPLY", shelf, ahead, clamp=True)
    # Its face in long rolled bands, and the lip at its foot catching the last
    # warm light from the west.
    bands = noise1(math_("MULTIPLY", zc, 14.0), 3.0, 6.0, 0.6, math_("MULTIPLY", az, 1.5))
    face = mix(smooth(bands, 0.35, 0.65), "#0d0f13", "#4a515e")
    lip = math_("SUBTRACT", 1.0, smooth(zc, math_("ADD", base, 0.008), math_("ADD", base, 0.05)))
    face = mix(math_("MULTIPLY", lip, 0.75), face, "#8a6650")
    # Under the shelf: a band of last light low on the horizon, hidden in
    # places by curtains of rain falling from the cloud.
    band_glow = mix(smooth(zc, 0.0, 0.06), "#ffd29a", "#c99a7a")
    veil = math_("MULTIPLY", smooth(noise1(az, 9.0, 3.0, 0.5, 7.0), 0.5, 0.7), ahead)
    band = mix(math_("MULTIPLY", veil, 0.85), band_glow, "#59606a")
    # Behind (west): pale sky low down, broken dark cloud above.
    hz = smooth(zc, 0.0, 0.35)
    sky = mix(hz, "#d8b48c", "#4a5262")
    dark = mix(rolls, "#0c0e12", "#2a2e37")
    lit = node("ShaderNodeMapRange", Value=x, **{"From Min": 0.1, "From Max": -0.9, "To Min": 0.0, "To Max": 0.8}).outputs[0]
    lit = math_("MULTIPLY", lit, math_("SUBTRACT", 1.0, rolls), clamp=True)
    cloud = mix(lit, dark, "#c98a5c")
    col = mix(cover, sky, cloud)
    # Ahead, below the shelf's base, the band; the shelf over everything.
    under = math_("MULTIPLY", math_("SUBTRACT", 1.0, smooth(zc, base, math_("ADD", base, 0.01))), ahead)
    col = mix(under, col, band)
    col = mix(shelf, col, face)
    # Below the horizon (unseen past the hills, but it lights the scene from
    # the side): the lake's dark grey.
    below = node("ShaderNodeMapRange", Value=zc, **{"From Min": 0.0, "From Max": -0.05}).outputs[0]
    col = mix(below, col, "#22282a")
    bg = node("ShaderNodeBackground", Color=col, Strength=strength)
    out = node("ShaderNodeOutputWorld")
    L.new(bg.outputs[0], out.inputs["Surface"])
    return sun


def rain_curtain(scene, centre, z0, heading=0.0, dist=1800.0, width=5000.0, height=900.0, density=0.004):
    """A curtain of rain under the squall: a slab of grey falling water (a
    volume), streaked and uneven, between the boats and the hills."""
    cx, cy = centre
    me = bpy.data.meshes.new("key-rain")
    d = Vector((math.cos(heading), math.sin(heading), 0.0))
    s = Vector((-d.y, d.x, 0.0))
    c = Vector((cx, cy, z0)) + d * dist
    t = 600.0
    corners = []
    for zz in (0.0, height):
        for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = c + s * (a * width / 2) + d * (b * t / 2) + Vector((0, 0, zz))
            corners.append(tuple(p))
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me.from_pydata(corners, [], faces)
    obj = bpy.data.objects.new("key-rain", me)
    scene.collection.objects.link(obj)
    n = M.Nodes("key-rain")
    pos = n.coords("Object")
    stretch = n.new("ShaderNodeVectorMath", _operation="MULTIPLY")
    n.link(pos[0], pos[1], stretch, 0)
    stretch.inputs[1].default_value = (0.02, 0.02, 0.0015)
    streak = n.noise(1.0, 2.0, 0.5, (stretch, "Vector"))
    dens = n.new("ShaderNodeMapRange", Value=(streak, "Fac"), **{"From Min": 0.35, "From Max": 0.75, "To Min": 0.0, "To Max": density})
    vol = n.new("ShaderNodeVolumePrincipled", Color=hex_rgb("#9aa2a8"), Density=0.0, Anisotropy=0.2)
    n.link(dens, "Result", vol, "Density")
    n.link(vol, "Volume", n.out, "Volume")
    me.materials.append(n.mat)
    obj.visible_shadow = False
    return obj
