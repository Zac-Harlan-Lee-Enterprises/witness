"""Things scattered over the teaser's land: shrubs, stones and boulders,
and the instancer that puts thousands of them down cheaply.

`instancer(...)` takes points worked out in numpy (where, which prototype,
turned and scaled how) and lets geometry nodes instance the prototypes on
them, so a hillside of shrubs costs a few meshes.
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils import noise as mnoise

import common
import teaser_noise as N
from teaser_nodes import Graph


# ── instancing ───────────────────────────────────────────────────────────────
def instancer(name, points, protos, index, rot=None, scale=None, collection=None):
    """Instance `protos` (objects) on `points` (N, 3): prototype `index` (N,),
    Euler `rot` (N, 3) and `scale` (N,) or (N, 3)."""
    n = len(points)
    col = bpy.data.collections.new(f"{name}-protos")
    for p in protos:
        for c in list(p.users_collection):
            c.objects.unlink(p)
        col.objects.link(p)
        p.location = (0, 0, 0)
    me = bpy.data.meshes.new(name)
    me.vertices.add(n)
    me.vertices.foreach_set("co", np.asarray(points, dtype=np.float32).ravel())
    a = me.attributes.new("proto", "INT", "POINT")
    a.data.foreach_set("value", np.asarray(index, dtype=np.int32).ravel())
    rot = np.zeros((n, 3)) if rot is None else np.asarray(rot)
    a = me.attributes.new("rot", "FLOAT_VECTOR", "POINT")
    a.data.foreach_set("vector", rot.astype(np.float32).ravel())
    if scale is None:
        scale = np.ones((n, 3))
    scale = np.asarray(scale, dtype=np.float64)
    if scale.ndim == 1:
        scale = np.repeat(scale[:, None], 3, axis=1)
    a = me.attributes.new("scale", "FLOAT_VECTOR", "POINT")
    a.data.foreach_set("vector", scale.astype(np.float32).ravel())
    obj = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(obj)
    ng = bpy.data.node_groups.new(f"{name}-scatter", "GeometryNodeTree")
    ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nodes, links = ng.nodes, ng.links
    gi = nodes.new("NodeGroupInput")
    go = nodes.new("NodeGroupOutput")
    ci = nodes.new("GeometryNodeCollectionInfo")
    ci.transform_space = "ORIGINAL"
    ci.inputs["Collection"].default_value = col
    ci.inputs["Separate Children"].default_value = True
    ci.inputs["Reset Children"].default_value = True
    iop = nodes.new("GeometryNodeInstanceOnPoints")
    iop.inputs["Pick Instance"].default_value = True

    def named(attr, kind):
        nd = nodes.new("GeometryNodeInputNamedAttribute")
        nd.data_type = kind
        nd.inputs["Name"].default_value = attr
        return nd.outputs["Attribute"]

    e2r = nodes.new("FunctionNodeEulerToRotation")
    links.new(gi.outputs[0], iop.inputs["Points"])
    links.new(ci.outputs["Instances"], iop.inputs["Instance"])
    links.new(named("proto", "INT"), iop.inputs["Instance Index"])
    links.new(named("rot", "FLOAT_VECTOR"), e2r.inputs["Euler"])
    links.new(e2r.outputs["Rotation"], iop.inputs["Rotation"])
    links.new(named("scale", "FLOAT_VECTOR"), iop.inputs["Scale"])
    links.new(iop.outputs["Instances"], go.inputs[0])
    mod = obj.modifiers.new("scatter", "NODES")
    mod.node_group = ng
    return obj


# ── materials ────────────────────────────────────────────────────────────────
def rock_material(name="teaser-rock", base="#bdb3a2", dark="#7d7163", red=0.0, lichen=0.25):
    """Weathered limestone: pale where fresh, a grey-brown crust, dark
    pitting, orange and grey lichen, reddish staining where asked."""

    def build():
        g = Graph(name)
        pos = g.coords("Object")
        rnd = g.object_random()
        big = g.noise(pos, 1.2, 4.0, 0.6)
        pits = g.voronoi(pos, 40.0)
        pit = g.mul(g.map(pits, 0.0, 0.12, 1.0, 0.0), 0.5)
        col = g.mix(g.smooth(big, 0.35, 0.7), dark, base)
        col = g.mix(g.mul(rnd, 0.35), col, "#a89c8a")
        if red > 0:
            col = g.mix(g.mul(g.smooth(g.noise(pos, 0.7, 3.0), 0.4, 0.7), red), col, "#a8694a")
        lich = g.smooth(g.noise(pos, 6.0, 5.0, 0.65), 0.62, 0.72)
        col = g.mix(g.mul(lich, lichen), col, "#b58a4e")
        lich2 = g.smooth(g.noise(g.vmath("ADD", pos, (3.1, 1.7, 0.3)), 9.0, 5.0, 0.65), 0.66, 0.74)
        col = g.mix(g.mul(lich2, lichen * 0.8), col, "#8f9384")
        col = g.mix(g.mul(pit, 0.5), col, "#4a4038")
        fine = g.noise(pos, 30.0, 6.0, 0.7)
        h = g.add(g.mul(big, 1.0), g.add(g.mul(fine, 0.35), g.mul(pit, -0.6)))
        g.principled(col, g.map(fine, 0.3, 0.7, 0.75, 0.95), 0.3, g.bump(h, 0.5, 0.03))
        return g.mat

    return _cached(name, build)


def shrub_material(name="teaser-shrub", color="#7d7c62", dry="#a39a7c"):
    def build():
        g = Graph(name)
        pos = g.coords("Object")
        rnd = g.object_random()
        n = g.noise(pos, 18.0, 4.0, 0.6)
        col = g.mix(g.smooth(n, 0.45, 0.65), color, dry)
        col = g.mix(g.mul(rnd, 0.5), col, "#6d6552")
        # Dead twigs show through the sparse leaves.
        col = g.mix(g.smooth(g.noise(pos, 7.0, 3.0), 0.55, 0.7, 0.0, 0.5), col, "#7a6e5c")
        g.principled(col, 0.85, 0.3, g.bump(g.noise(pos, 60.0, 3.0), 0.6, 0.01), **{"Subsurface Weight": 0.0})
        return g.mat

    return _cached(name, build)


_mats = {}


def _cached(name, build):
    m = _mats.get(name)
    try:
        if m is not None and m.name:
            return m
    except ReferenceError:
        pass
    _mats[name] = build()
    return _mats[name]


# ── shapes ───────────────────────────────────────────────────────────────────
def boulder(name, size=(1.0, 0.8, 0.6), seed=1, material=None, detail=3, flat=0.35, crack=0.25):
    """A limestone boulder: a subdivided blob pushed by cellular noise into
    flat facets and ledges (bedding), its base sunk below the ground."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1.0)
    rng = random.Random(seed)
    off = Vector((rng.random() * 90, rng.random() * 90, rng.random() * 90))
    sx, sy, sz = size
    for v in bm.verts:
        p = v.co.copy()
        q = p * 1.3 + off
        # Facets: snap the radius by cells, then rough it.
        cell = mnoise.cell(q * 0.9)
        r = 1.0 + 0.22 * mnoise.noise(q) + 0.1 * mnoise.noise(q * 2.3) + 0.05 * mnoise.noise(q * 5.1)
        r *= 1.0 - crack * 0.25 * abs(mnoise.noise(q * 3.0))
        r += 0.08 * (cell - 0.5)
        p = p * r
        # Bedding: flatten the top and terrace the sides a little.
        z = p.z
        if z > flat:
            z = flat + (z - flat) * 0.35
        band = math.floor(z * 3.0) / 3.0
        z = z + (band - z) * 0.25
        v.co = Vector((p.x * sx, p.y * sy, (z + 0.35) * sz))
    bm.normal_update()
    obj = common.mesh_object(name, bm, material or rock_material(), None, smooth=True)
    return obj


def shrub(name, radius=0.4, height=0.35, seed=1, material=None, twigs=True):
    """A cushion of a dwarf shrub (thorny burnet, bean-caper): a dense lumpy
    mound of small leafy clumps over a tangle of grey twigs."""
    rng = random.Random(seed)
    bm = bmesh.new()
    n = int(26 + radius * 40)
    for k in range(n):
        a = rng.random() * math.tau
        r = radius * math.sqrt(rng.random()) * 0.85
        h = height * (0.35 + 0.65 * (1 - (r / radius) ** 2)) * (0.8 + rng.random() * 0.3)
        c = Vector((math.cos(a) * r, math.sin(a) * r, h * 0.6))
        s = radius * (0.22 + rng.random() * 0.14)
        sub = bmesh.new()
        bmesh.ops.create_icosphere(sub, subdivisions=2, radius=1.0)
        o = Vector((rng.random() * 50, rng.random() * 50, rng.random() * 50))
        for v in sub.verts:
            d = 1.0 + 0.55 * mnoise.noise(v.co * 3.2 + o)
            v.co = c + Vector((v.co.x * s * d, v.co.y * s * d, v.co.z * s * 0.75 * d))
        me = bpy.data.meshes.new("tmp")
        sub.to_mesh(me)
        sub.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    obj = common.mesh_object(name, bm, material or shrub_material(), None)
    if twigs:
        tw = bmesh.new()
        for k in range(14):
            a = rng.random() * math.tau
            r = radius * (0.7 + rng.random() * 0.45)
            base = Vector((math.cos(a) * r * 0.25, math.sin(a) * r * 0.25, 0.0))
            tip = Vector((math.cos(a) * r, math.sin(a) * r, height * (0.3 + rng.random() * 0.6)))
            bmesh.ops.create_cone(tw, cap_ends=False, segments=4, radius1=0.008, radius2=0.002, depth=(tip - base).length, matrix=_between(base, tip))
        me = bpy.data.meshes.new(f"{name}-twigs")
        tw.to_mesh(me)
        tw.free()
        me.materials.append(twig_material())
        bm2 = bmesh.new()
        bm2.from_mesh(obj.data)
        bm2.from_mesh(me)
        obj.data.materials.append(twig_material())
        start = len(obj.data.polygons)
        bm2.to_mesh(obj.data)
        bm2.free()
        for p in obj.data.polygons[start:]:
            p.material_index = 1
        bpy.data.meshes.remove(me)
    return obj


def twig_material():
    def build():
        g = Graph("teaser-twig")
        g.principled("#6e655a", 0.8, 0.3)
        return g.mat

    return _cached("teaser-twig", build)


def _between(a, b):
    from mathutils import Matrix

    d = b - a
    q = d.to_track_quat("Z", "Y")
    return Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4()


# ── scattering over the land ─────────────────────────────────────────────────
def scatter(land, name, centre, heading, fov, r_near, r_far, density, protos, seed=1, where=None, size=(0.7, 1.4), sink=0.0, tilt=0.15, max_count=60000):
    """Points over the land in a view sector (per square metre `density`
    near, thinning with distance so each covers about the same screen
    area), kept where `where(x, y, z, slope, wet)` says (a 0..1 weight)."""
    rng = np.random.default_rng(seed)
    # Sample radius so that density falls off as 1/r beyond r_near.
    area_near = 0.5 * fov * r_near * r_near
    n_near = int(area_near * density)
    n_far = int(density * r_near * fov * (r_far - r_near))
    n = min(max_count * 3, n_near + n_far)
    u = rng.random(n)
    # Mixture: uniform disc near, 1/r (uniform in r) far.
    near_share = n_near / max(1, n_near + n_far)
    far = u > near_share
    r = np.where(far, r_near + rng.random(n) * (r_far - r_near), r_near * np.sqrt(rng.random(n)))
    th = heading - fov / 2 + rng.random(n) * fov
    x = centre[0] + r * np.cos(th)
    y = centre[1] + r * np.sin(th)
    z = land.height(x, y)
    sl = land.slope(x, y)
    wet = np.clip((land.wetness(x, y) - 3.0) / 6.0, 0, 1)
    w = np.ones(n) if where is None else where(x, y, z, sl, wet)
    keep = rng.random(n) < w
    x, y, z = x[keep], y[keep], z[keep]
    if len(x) > max_count:
        x, y, z = x[:max_count], y[:max_count], z[:max_count]
    m = len(x)
    scale = size[0] + rng.random(m) * (size[1] - size[0])
    rot = np.stack([(rng.random(m) - 0.5) * tilt, (rng.random(m) - 0.5) * tilt, rng.random(m) * math.tau], axis=1)
    idx = rng.integers(0, len(protos), m)
    pts = np.stack([x, y, z - sink * scale], axis=1)
    return instancer(name, pts, protos, idx, rot, scale)
