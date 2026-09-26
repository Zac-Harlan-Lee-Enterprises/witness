"""Shared set-up for the offline art build: an empty scene, Cycles on the
GPU, filmic colour, deterministic randomness, and small mesh helpers.

Everything here is authoring-time only. Players never run Blender; they
download the rendered images this pipeline writes into public/art/.
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Vector


def reset(samples=64):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        # WITNESS_CYCLES_DEVICE=CPU renders on the CPU (when the GPU is busy
        # or short of memory).
        if os.environ.get("WITNESS_CYCLES_DEVICE", "").upper() == "CPU":
            raise RuntimeError("CPU asked for")
        prefs.compute_device_type = "METAL"
        prefs.refresh_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    except Exception:  # noqa: BLE001 - fall back to the CPU
        scene.cycles.device = "CPU"
    c = scene.cycles
    # WITNESS_CYCLES_TILE=512 renders in smaller tiles: much less GPU memory
    # for a big image (when other renders share the GPU), a little slower.
    tile = os.environ.get("WITNESS_CYCLES_TILE")
    if tile:
        c.use_auto_tile = True
        c.tile_size = int(tile)
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = True
    c.max_bounces = 6
    c.diffuse_bounces = 4
    c.glossy_bounces = 2
    c.transparent_max_bounces = 8
    c.seed = 7
    scene.render.film_transparent = True
    scene.render.use_persistent_data = True
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        scene.view_settings.view_transform = "Filmic"
    scene.view_settings.exposure = -1.4
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    return scene


def rng(seed):
    return random.Random(seed)


def link(obj, collection=None):
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def mesh_object(name, bm, material=None, col=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    if material is not None:
        me.materials.append(material)
    link(obj, col)
    return obj


def add_modifier(obj, kind, **props):
    mod = obj.modifiers.new(kind.lower(), kind)
    for k, v in props.items():
        setattr(mod, k, v)
    return mod


def bake_modifiers(obj):
    """Replace an object's mesh with its evaluated (modified) mesh."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    bpy.data.meshes.remove(old)
    return obj


def lathe(name, profile, segments=32, material=None, col=None):
    """A surface of revolution around Z from (radius, z) points, bottom to top."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((a[i], a[j], b[j], b[i]))
    # Close the bottom.
    bottom = bm.verts.new((0, 0, profile[0][1]))
    for i in range(segments):
        j = (i + 1) % segments
        bm.faces.new((rings[0][j], rings[0][i], bottom))
    bm.normal_update()
    return mesh_object(name, bm, material, col)


def box(name, size, location=(0, 0, 0), material=None, col=None, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    obj = mesh_object(name, bm, material, col, smooth=False)
    obj.location = location
    if bevel > 0:
        add_modifier(obj, "BEVEL", width=bevel, segments=2, limit_method="ANGLE")
    return obj


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def hex_rgb(h):
    """sRGB hex to linear RGB (Blender colour inputs are linear)."""
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)
