"""Angular stones and boulders.

Limestone and chert break into blocky, faceted pieces with flat bedding
planes, not pebbles. A stone here is the convex hull of points scattered on
a squashed, jittered box: flat facets and sharp edges, then a light bevel
(one smoothing step on the hull) so edges catch the sun.
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector
from mathutils import noise as mnoise

import common


def hull_points(rng, n, flat, blocky):
    pts = []
    for _ in range(n):
        # Points on a box (blocky) blended with points on a sphere (rounded).
        if rng.random() < blocky:
            p = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
            k = rng.randrange(3)
            p[k] = 1.0 if rng.random() < 0.5 else -1.0
        else:
            a = rng.random() * math.tau
            z = rng.uniform(-1, 1)
            r = math.sqrt(max(0.0, 1 - z * z))
            p = Vector((math.cos(a) * r, math.sin(a) * r, z))
        p.z *= flat
        pts.append(p)
    return pts


def _component(v0):
    """Every vertex connected to v0."""
    seen = {v0}
    stack = [v0]
    while stack:
        v = stack.pop()
        for e in v.link_edges:
            o = e.other_vert(v)
            if o not in seen:
                seen.add(o)
                stack.append(o)
    return seen


def stone_mesh(bm, seed, size, flat=0.55, blocky=0.6, n=22, at=Vector((0, 0, 0)), sink=0.25, rot=None, detail=0):
    """Add one angular stone to `bm`: `size` = (x, y, z) half-extents.
    Built in a bmesh of its own, then merged in."""
    rng = random.Random(seed)
    sb = bmesh.new()
    pts = hull_points(rng, n, flat, blocky)
    new = [sb.verts.new(p) for p in pts]
    bmesh.ops.convex_hull(sb, input=new)
    loose = [v for v in sb.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(sb, geom=loose, context="VERTS")
    if detail:
        # Break the flat facets: subdivide and push each point in or out by
        # a little noise, so faces are weathered rather than machined.
        bmesh.ops.subdivide_edges(sb, edges=list(sb.edges), cuts=detail, use_grid_fill=True)
        off = Vector((rng.random() * 50, rng.random() * 50, rng.random() * 50))
        for v in sb.verts:
            q = v.co * 2.2 + off
            d = mnoise.noise(q) * 0.06 + mnoise.noise(q * 2.7) * 0.03
            v.co = v.co * (1 + d)
    a = rot if rot is not None else rng.random() * math.tau
    ca, sa = math.cos(a), math.sin(a)
    sx, sy, sz = size
    for v in sb.verts:
        x, y, z = v.co.x * sx, v.co.y * sy, v.co.z * sz
        v.co = Vector((x * ca - y * sa, x * sa + y * ca, z + sz * (flat - sink))) + at
    sb.normal_update()
    me = bpy.data.meshes.new("stone-tmp")
    sb.to_mesh(me)
    sb.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def stone(name, at, size, mat, seed, flat=0.55, blocky=0.6, n=30, sink=0.25, smooth=1):
    """One stone as an object (boulders, cairn stones)."""
    bm = bmesh.new()
    layer = bm.faces.layers.float.new("rand")
    stone_mesh(bm, seed, size, flat, blocky, n, at, sink, detail=2 if max(size) > 0.12 else 0)
    r = random.Random(seed + 1).random()
    for f in bm.faces:
        f[layer] = r
    obj = common.mesh_object(name, bm, mat, None, smooth=False)
    if smooth:
        # A slight rounding of the edges: sharp facets, softened rims.
        mod = common.add_modifier(obj, "BEVEL", width=min(size) * 0.12, segments=2, limit_method="ANGLE")
        mod.angle_limit = math.radians(25)
    return obj
