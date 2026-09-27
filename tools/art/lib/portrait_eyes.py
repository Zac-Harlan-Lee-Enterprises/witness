"""Eyes: an eyeball with a recessed iris under a clear, refracting cornea,
and a wet tear line along the lower lid. The eyeball fills the socket of
MakeHuman's head (its helper sphere); the lids and the pink inner corner are
the head's own skin (portrait_mhhead.py, portrait_mhskin.py). Both eyes turn
to look at one point (the camera, or a little away from it), so they
converge.

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


def _eyeball_mesh(name, R, IRIS_R, col, material):
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


def _cornea_mesh(name, R, IRIS_R, CORNEA_R, col, material):
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
        self.pupils = {}  # side -> (centre m, pupil direction), for the gaze check
        # The eyeball fills MakeHuman's eye socket (its helper sphere), a
        # little inside it so the lids rest on the wet surface; the iris is
        # sized to the opening between the lids, as a person's is.
        R = head.eye_r - 0.03
        iris_r = max(0.52, min(0.64, (0.25 + 0.03 * params.child) * head.fissure_width()))
        self.iris_r = iris_r
        cornea_r = iris_r * 1.28
        iris_mat = PM.eye_inner(params.iris, params.seed, params.iris_kind, params.age_t, iris_r=iris_r)
        wet = PM.cornea()
        # Both eyes look at the same point (the camera, or a point a few
        # degrees from it), so they converge. The eyeball is fitted to the
        # lid margins (portrait_mhhead), so looking straight at the camera
        # already puts each pupil in its opening. One shared tilt, up or
        # down, then sets how the lids frame the irises: the pupils a
        # little above the middle of the openings, the upper lids just over
        # the tops of the irises, as in a relaxed gaze.
        centres = {sx: Vector(head.eye_centre(sx).tolist()) * CM for sx in (-1, 1)}
        target = Vector(look_at)
        pitch = 0.0
        for sx in (-1, 1):
            c = centres[sx]
            d = (target - c).normalized()
            rest = (Vector(self._opening(sx).tolist()) * CM - c).normalized()
            pitch += (math.asin(max(-1.0, min(1.0, rest.z))) - math.asin(max(-1.0, min(1.0, d.z)))) / 2
        # (At most a few degrees: the camera is at the eyes' height.)
        pitch = max(-math.radians(6), min(math.radians(6), pitch))
        target = target + Vector((0, 0, math.tan(pitch) * (target - (centres[-1] + centres[1]) / 2).length))
        for sx in (-1, 1):
            c = centres[sx]
            ball = _eyeball_mesh(f"eye{sx}", R, iris_r, col, iris_mat)
            cornea = _cornea_mesh(f"cornea{sx}", R, iris_r, cornea_r, col, wet)
            # Shadows pass through the clear cornea, so the iris is lit.
            cornea.visible_shadow = False
            d = (target - c).normalized()
            q = (-d).to_track_quat("Y", "Z")
            self.pupils[sx] = (c.copy(), d.normalized(), R * CM)
            for o in (ball, cornea):
                o.matrix_world = Matrix.Translation(c) @ q.to_matrix().to_4x4()
                self.objects.append(o)
        self._tear_lines()

    def _opening(self, sx):
        """Where the pupil is when the eye looks straight ahead: the middle of
        the opening between the lids, a little high, and a little toward
        the nose."""
        head = self.head
        u = -0.06
        up = head.lid_point(sx, u, upper=True, rest=True)
        lo = head.lid_point(sx, u, upper=False, rest=True)
        return lo + (up - lo) * 0.56

    def _tear_lines(self):
        """A thin wet meniscus where each lid meets the eye."""
        head = self.head
        mat = PM.tear()
        for sx in (-1, 1):
            for upper, rad in ((False, 0.02),):
                pts = [Vector(head.lid_point(sx, u, upper=upper, out=0.01).tolist()) * CM for u in np.linspace(-0.97, 0.97, 40)]
                self.objects.append(_tube(f"tear{sx}{upper}", pts, rad * CM, self.col, mat))


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
