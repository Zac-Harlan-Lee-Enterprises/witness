"""Eyes: an eyeball with a recessed iris under a clear, refracting cornea,
a wet tear line along the lower lid, and the pink caruncle in the inner
corner. The eyes turn to look at the camera; the lids (portrait_head.py)
stay where they are.

Built in the eye's own frame (the pupil looks along -Y), in metres.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import portrait_materials as PM

CM = 0.01
IRIS_R = 0.6  # cm
CORNEA_R = 0.74


def _eyeball_mesh(name, R, col, material):
    """A sphere whose front is pressed in to a flat iris, slightly behind the cornea."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=64, radius=R * CM)
    cos_l = math.sqrt(1 - (IRIS_R / R) ** 2)
    plane = R * cos_l * CM - 0.02 * CM
    for v in bm.verts:
        # The sphere's pole axis is Z; turn it to look along -Y.
        x, y, z = v.co
        v.co = Vector((x, -z, y))
    for v in bm.verts:
        d = -v.co.y
        if d > plane:
            # Inside the limbus: a nearly flat, very slightly domed iris.
            r = math.hypot(v.co.x, v.co.z) / (IRIS_R * CM)
            v.co.y = -(plane + 0.015 * CM * (1 - min(1.0, r) ** 2))
    obj = common.mesh_object(name, bm, material, col)
    return obj


def _cornea_mesh(name, R, col, material):
    """The clear outer layer: the sclera's wet surface plus the corneal bulge."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=64, radius=1.0)
    cos_l = math.sqrt(1 - (IRIS_R / R) ** 2)
    base = R * cos_l
    dc = base - math.sqrt(CORNEA_R**2 - IRIS_R**2)  # centre of the corneal sphere
    for v in bm.verts:
        x, y, z = v.co
        d = Vector((x, -z, y)).normalized()
        # Along direction d: the larger of the sclera sphere and the cornea.
        along = -d.y
        # Distance to the cornea sphere along d from the eye centre.
        b = dc * along
        disc = b * b - (dc * dc - CORNEA_R**2)
        rc = b + math.sqrt(max(0.0, disc))
        r = max(R + 0.006, rc if along > 0 else 0.0)
        # Soften the join at the limbus.
        v.co = d * r * CM
    obj = common.mesh_object(name, bm, material, col)
    return obj


class Eyes:
    def __init__(self, head, params, col, look_at):
        self.head = head
        self.P = params
        self.col = col
        self.objects = []
        R = head.eye_r
        iris_mat = PM.eye_inner(params.iris, params.seed, params.iris_kind, params.age_t)
        wet = PM.cornea()
        for sx in (-1, 1):
            c = Vector(head.eye_centre(sx).tolist()) * CM
            ball = _eyeball_mesh(f"eye{sx}", R, col, iris_mat)
            cornea = _cornea_mesh(f"cornea{sx}", R, col, wet)
            # Shadows pass through the clear cornea, so the iris is lit.
            cornea.visible_shadow = False
            # Aim the pupil at the camera (the eyes converge on it).
            d = (Vector(look_at) - c).normalized()
            q = (-d).to_track_quat("Y", "Z")
            for o in (ball, cornea):
                o.matrix_world = Matrix.Translation(c) @ q.to_matrix().to_4x4()
                self.objects.append(o)
        self._tear_lines()
        self._caruncles()

    def _tear_lines(self):
        """A thin wet meniscus where each lid meets the eye."""
        head = self.head
        mat = PM.tear()
        for sx in (-1, 1):
            for upper, rad in ((False, 0.028),):
                pts = [Vector(head.lid_point(sx, u, upper=upper, out=0.01).tolist()) * CM for u in np.linspace(-0.97, 0.97, 40)]
                self.objects.append(_tube(f"tear{sx}{upper}", pts, rad * CM, self.col, mat))

    def _caruncles(self):
        head = self.head
        mat = PM.caruncle(self.P.appearance["skin"])
        for sx in (-1, 1):
            p = Vector(head.lid_point(sx, -0.97, upper=False, out=0.0).tolist())
            q = Vector(head.lid_point(sx, -0.97, upper=True, out=0.0).tolist())
            c = (p + q) / 2 + Vector((sx * 0.06, -0.02, 0))
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)
            bmesh.ops.scale(bm, vec=Vector((0.12, 0.1, 0.16)) * CM, verts=bm.verts)
            o = common.mesh_object(f"caruncle{sx}", bm, mat, self.col)
            o.location = c * CM
            self.objects.append(o)


def _tube(name, pts, r, col, material, segments=8):
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = t.orthogonal().normalized()
        b = t.cross(a)
        taper = math.sin(math.pi * (i + 0.5) / len(pts)) ** 0.4
        ring = [bm.verts.new(p + (a * math.cos(2 * math.pi * k / segments) + b * math.sin(2 * math.pi * k / segments)) * r * taper) for k in range(segments)]
        rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        for k in range(segments):
            k2 = (k + 1) % segments
            bm.faces.new((ra[k], ra[k2], rb[k2], rb[k]))
    return common.mesh_object(name, bm, material, col)
