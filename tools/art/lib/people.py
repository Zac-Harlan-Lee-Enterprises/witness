"""Procedural people for the offline render.

A person is built from a joint skeleton: a smooth body grown along the
skeleton (Blender's Skin modifier, subdivided), lofted garments with
folds (a belted tunic with woven stripes, a mantle for elders, head
coverings), a head with face features, hair and beard, sandals, and the
things they carry. Posing is our own forward kinematics and linear-blend
skinning (numpy), so every frame of the walk, breathing, talking and
turning is exact and repeatable.

Character space: facing -Y (south, toward the camera), +X is the
person's LEFT, +Z up. Lengths are authored in game units (32 per tile)
and converted to Blender units (tiles) with GU.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import materials as M

GU = 1.0 / 32.0

# ── Builds ─────────────────────────────────────────────────────────────────
BUILDS = {
    "adult": {"height": 54.0, "head": 7.6, "shoulder": 0.125, "hip": 0.052, "hem": 0.085},
    "child": {"height": 44.0, "head": 7.3, "shoulder": 0.118, "hip": 0.05, "hem": 0.25},
    "elder": {"height": 52.0, "head": 7.5, "shoulder": 0.122, "hip": 0.052, "hem": 0.05},
}


def is_female(a):
    return (not a["beard"]) and a["headwear"] in ("veil", "scarf") and a["build"] != "child"


def skeleton(a):
    """Rest joints (Blender units) for an appearance."""
    b = BUILDS[a["build"]]
    H = b["height"]
    fem = is_female(a)
    sh = b["shoulder"] * H * (0.92 if fem else 1.0)
    hip = b["hip"] * H * (1.06 if fem else 1.0)
    head = b["head"]
    stoop = 1.2 if a["build"] == "elder" else 0.0
    J = {
        "pelvis": (0, 0, 0.515 * H),
        "waist": (0, 0.2, 0.6 * H),
        "chest": (0, 0.4 + stoop * 0.3, 0.715 * H),
        "neck": (0, 0.5 - stoop, 0.83 * H),
        "head": (0, 0.2 - stoop * 1.6, H - head * 0.98),
        "crown": (0, 0.1 - stoop * 1.8, H),
        "shoulder_L": (sh, 0.5, 0.81 * H),
        "elbow_L": (sh + 0.004 * H, 0.8, 0.628 * H),
        "wrist_L": (sh + 0.006 * H, -0.2, 0.462 * H),
        "hand_L": (sh + 0.006 * H, -0.5, 0.418 * H),
        "hip_L": (hip, 0.0, 0.485 * H),
        "knee_L": (hip * 0.92, -0.35, 0.27 * H),
        "ankle_L": (hip * 0.85, 0.35, 0.042 * H),
        "toe_L": (hip * 0.95, -0.075 * H, 0.012 * H),
    }
    for k in list(J):
        if k.endswith("_L"):
            x, y, z = J[k]
            J[k[:-2] + "_R"] = (-x, y, z)
    return {k: Vector(v) * GU for k, v in J.items()}


BONES = [
    ("pelvis", "pelvis", "waist", None),
    ("spine", "waist", "chest", "pelvis"),
    ("chest", "chest", "neck", "spine"),
    ("neck", "neck", "head", "chest"),
    ("head", "head", "crown", "neck"),
]
for side in ("L", "R"):
    BONES += [
        (f"upper_arm_{side}", f"shoulder_{side}", f"elbow_{side}", "chest"),
        (f"forearm_{side}", f"elbow_{side}", f"wrist_{side}", f"upper_arm_{side}"),
        (f"hand_{side}", f"wrist_{side}", f"hand_{side}", f"forearm_{side}"),
        (f"thigh_{side}", f"hip_{side}", f"knee_{side}", "pelvis"),
        (f"shin_{side}", f"knee_{side}", f"ankle_{side}", f"thigh_{side}"),
        (f"foot_{side}", f"ankle_{side}", f"toe_{side}", f"shin_{side}"),
    ]
BONE_NAMES = [b[0] for b in BONES]
BONE_INDEX = {n: i for i, n in enumerate(BONE_NAMES)}


# ── Mesh helpers ───────────────────────────────────────────────────────────
def loft(name, rings, material, col, close_top=False, close_bottom=False, segments=28, skip=None):
    """A surface through rings of (cx, cy, z, rx, ry) from top to bottom.
    `skip(i_ring, j_segment)` can open holes (e.g. a face opening)."""
    bm = bmesh.new()
    verts = []
    for cx, cy, z, rx, ry, *extra in rings:
        wobble = extra[0] if extra else None
        ring = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            r_scale = 1.0 + (wobble(a) if wobble else 0.0)
            ring.append(bm.verts.new((cx + math.sin(a) * rx * r_scale, cy - math.cos(a) * ry * r_scale, z)))
        verts.append(ring)
    for i in range(len(verts) - 1):
        for j in range(segments):
            if skip and skip(i, j):
                continue
            k = (j + 1) % segments
            bm.faces.new((verts[i][j], verts[i][k], verts[i + 1][k], verts[i + 1][j]))
    if close_top:
        c = bm.verts.new((rings[0][0], rings[0][1], rings[0][2]))
        for j in range(segments):
            bm.faces.new((verts[0][(j + 1) % segments], verts[0][j], c))
    if close_bottom:
        c = bm.verts.new((rings[-1][0], rings[-1][1], rings[-1][2]))
        for j in range(segments):
            bm.faces.new((verts[-1][j], verts[-1][(j + 1) % segments], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return common.mesh_object(name, bm, material, col)


def ellipsoid(name, centre, radii, material, col, segments=20, rings=12):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=Vector(radii), verts=bm.verts)
    obj = common.mesh_object(name, bm, material, col)
    obj.location = centre
    return obj


def capsule(name, a, b, r, material, col, segments=12):
    a = Vector(a)
    b = Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segments, radius1=r, radius2=r * 0.85, depth=d.length
    )
    obj = common.mesh_object(name, bm, material, col)
    obj.location = (a + b) / 2
    obj.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return obj


def apply_transform(obj):
    # matrix_basis is always current (matrix_world waits for a depsgraph update).
    obj.data.transform(obj.matrix_basis.copy())
    obj.matrix_basis = Matrix.Identity(4)


# ── The person ─────────────────────────────────────────────────────────────
class Part:
    """A piece of the person: skinned (per-vertex bone weights) or rigid (one bone)."""

    def __init__(self, obj, weights=None, bone=None, skirt=None, upright=None, mark=None):
        self.obj = obj
        # The story mark this part shows (a bandage, the spare cloak...), if any:
        # rendered as its own overlay sheet (see build_people.py).
        self.mark = mark
        apply_transform(obj)
        n = len(obj.data.vertices)
        co = np.empty(n * 3, dtype=np.float64)
        obj.data.vertices.foreach_get("co", co)
        self.rest = co.reshape(n, 3)
        self.weights = weights(self.rest) if weights else None
        self.bone = bone
        # Skirt: (centre y, top z) — vertices below `top` are tented around the posed legs.
        self.skirt = skirt
        # Upright: a grip point; the part follows it but doesn't rotate (a planted staff).
        self.upright = upright


def nearest_bone_weights(J, names, falloff=4.0, sharp=None):
    """Weights by distance to bone segments (restricted to `names`)."""
    segs = []
    for n in names:
        _, h, t, _ = BONES[BONE_INDEX[n]]
        segs.append((BONE_INDEX[n], np.array(J[h]), np.array(J[t])))

    def fn(pts):
        W = np.zeros((len(pts), len(BONE_NAMES)))
        ds = []
        for idx, h, t in segs:
            ht = t - h
            L = max(1e-9, float(ht @ ht))
            s = np.clip(((pts - h) @ ht) / L, 0.0, 1.0)
            proj = h + s[:, None] * ht
            ds.append(np.linalg.norm(pts - proj, axis=1))
        D = np.stack(ds, axis=1) + 1e-4
        inv = 1.0 / D**falloff
        # Keep the two nearest bones only, for clean joints.
        order = np.argsort(D, axis=1)
        mask = np.zeros_like(inv)
        rows = np.arange(len(pts))
        for k in range(2):
            mask[rows, order[:, k]] = 1.0
        inv *= mask
        inv /= inv.sum(axis=1, keepdims=True)
        for k, (idx, _, _) in enumerate(segs):
            W[:, idx] = inv[:, k]
        return W

    return fn


def _speckled_wool():
    """A speckled lamb's short, curly fleece: cream, flecked and spotted with
    dark brown."""

    def build():
        n = M.Nodes("speckled-wool")
        obj = n.coords()
        curls = n.new("ShaderNodeTexVoronoi", Scale=90.0, Vector=obj, _feature="SMOOTH_F1", Smoothness=0.7)
        spots = n.new("ShaderNodeTexVoronoi", Scale=26.0, Vector=obj, Randomness=1.0)
        sm = n.new("ShaderNodeMapRange", Value=(spots, "Distance"), **{"From Min": 0.14, "From Max": 0.22, "To Min": 1.0, "To Max": 0.0})
        big = n.noise(4.0, 3.0, 0.5, obj)
        bm_ = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.6, "From Max": 0.66, "To Min": 0.0, "To Max": 1.0})
        sp = n.math("MAXIMUM", (sm, "Result"), (bm_, "Result"))
        col = n.mix((sp, "Value"), "#e6dcc6", "#4a3828")
        crev = n.new("ShaderNodeMapRange", Value=(curls, "Distance"), **{"From Min": 0.3, "From Max": 0.6, "To Min": 0.0, "To Max": 0.35})
        col2 = n.mix((crev, "Result"), (col, 2), "#6a5a48", "MULTIPLY")
        bump = n.bump((curls, "Distance"), strength=0.6, distance=0.006)
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": 0.95, "Sheen Weight": 0.3, "Sheen Tint": (col, 2), "Normal": (bump, "Normal")})
        return n.mat

    return M.cached(("speckled-wool",), build)


class Person:
    def __init__(self, appearance, marks=(), rag="#3e6b73", name="person"):
        self.a = appearance
        self.marks = set(marks)
        self.rag = rag
        self.name = name
        self.col = common.collection(name)
        self.J = skeleton(appearance)
        self.parts = []
        self.eyes = []
        self.mouth = None
        b = BUILDS[appearance["build"]]
        self.H = b["height"] * GU
        self.head_h = b["head"] * GU
        self._build()

    # ── construction ───────────────────────────────────────────────────────
    def _build(self):
        a = self.a
        J = self.J
        H = self.H
        skin = M.skin(a["skin"])
        self._body(skin)
        self._head(skin)
        self._tunic()
        self._sandals()
        if a["headwear"] != "none":
            self._headwear()
        if a["build"] == "elder":
            self._mantle()
        self._carry()
        self._marks()
        _ = (J, H)

    def _body(self, skin):
        a = self.a
        J = self.J
        H = self.H / GU
        fem = is_female(a)
        bm = bmesh.new()
        layer = bm.verts.layers.skin.verify()
        names = [
            "pelvis", "waist", "chest", "neck", "head",
            "shoulder_L", "elbow_L", "wrist_L", "hand_L",
            "shoulder_R", "elbow_R", "wrist_R", "hand_R",
            "hip_L", "knee_L", "ankle_L", "toe_L",
            "hip_R", "knee_R", "ankle_R", "toe_R",
        ]
        radius = {
            "pelvis": (0.095 * H * (1.08 if fem else 1), 0.068 * H),
            "waist": (0.078 * H, 0.055 * H),
            "chest": (0.098 * H * (0.94 if fem else 1), 0.066 * H * (1.08 if fem else 1)),
            "neck": (0.03 * H, 0.03 * H),
            "head": (0.028 * H, 0.028 * H),
            "shoulder": (0.036 * H, 0.036 * H),
            "elbow": (0.026 * H, 0.026 * H),
            "wrist": (0.02 * H, 0.018 * H),
            "hand": (0.02 * H, 0.011 * H),
            "hip": (0.055 * H, 0.055 * H),
            "knee": (0.034 * H, 0.034 * H),
            "ankle": (0.021 * H, 0.021 * H),
            "toe": (0.019 * H, 0.011 * H),
        }
        vs = {}
        for n in names:
            v = bm.verts.new(J[n])
            key = n.split("_")[0]
            rx, ry = radius[key]
            v[layer].radius = (rx * GU, ry * GU)
            v[layer].use_root = n == "pelvis"
            vs[n] = v
        edges = [("pelvis", "waist"), ("waist", "chest"), ("chest", "neck"), ("neck", "head")]
        for s in ("L", "R"):
            edges += [
                ("chest", f"shoulder_{s}"), (f"shoulder_{s}", f"elbow_{s}"),
                (f"elbow_{s}", f"wrist_{s}"), (f"wrist_{s}", f"hand_{s}"),
                ("pelvis", f"hip_{s}"), (f"hip_{s}", f"knee_{s}"),
                (f"knee_{s}", f"ankle_{s}"), (f"ankle_{s}", f"toe_{s}"),
            ]
        for e in edges:
            bm.edges.new((vs[e[0]], vs[e[1]]))
        obj = common.mesh_object(f"{self.name}-body", bm, skin, self.col)
        common.add_modifier(obj, "SKIN", branch_smoothing=0.6, use_smooth_shade=True)
        common.add_modifier(obj, "SUBSURF", levels=2, render_levels=2)
        common.bake_modifiers(obj)
        for p in obj.data.polygons:
            p.use_smooth = True
        self.parts.append(Part(obj, nearest_bone_weights(J, BONE_NAMES, 4.0)))

    def _head(self, skin):
        a = self.a
        J = self.J
        h = self.head_h
        c = (J["head"] + J["crown"]) / 2 + Vector((0, -0.04 * h, -0.02 * h))
        rx, ry, rz = 0.36 * h, 0.44 * h, 0.52 * h

        def jaw(z):
            return 1 - 0.22 * max(0.0, -z / rz) ** 1.5

        def push(z):
            return (1 + 0.08 * max(0.0, -z / rz)) * (1.04 if -0.2 < z / rz < 0.35 else 1.0)

        def front_y(x, z):
            """The face surface (y, negative = forward) at (x, z) relative to the head centre."""
            k = 1 - (x / (rx * jaw(z))) ** 2 - (z / rz) ** 2
            return -ry * math.sqrt(max(0.0, k)) * push(z)

        def F(x, z, out=0.0):
            return c + Vector((x, front_y(x, z) - out, z))

        head = ellipsoid(f"{self.name}-head", c, (rx, ry, rz), skin, self.col, 32, 20)
        for v in head.data.vertices:
            z = v.co.z
            v.co.x *= jaw(z)
            if v.co.y < 0:
                v.co.y *= push(z)
        parts = [head]
        dark = M.plain("#1c120c", 0.3, 0.5)
        white = M.plain("#a89a88", 0.45, 0.3)
        hair_col = a["hair"] if a["build"] != "elder" else "#cfc8bb"
        # Nose: a ridge from between the brows to a tip that stands off the face.
        nose = capsule(f"{self.name}-nose", F(0, 0.06 * h, -0.01 * h), F(0, -0.14 * h, 0.07 * h), 0.052 * h, skin, self.col)
        parts.append(nose)
        for s in (-1, 1):
            ex, ez = s * 0.15 * h, 0.03 * h
            sclera = ellipsoid(f"{self.name}-white{s}", F(ex, ez, -0.014 * h), (0.055 * h, 0.028 * h, 0.028 * h), white, self.col, 10, 6)
            eye = ellipsoid(f"{self.name}-eye{s}", F(ex, ez, 0.0), (0.034 * h, 0.028 * h, 0.032 * h), dark, self.col, 10, 6)
            self.eyes += [eye, sclera]
            brow = capsule(f"{self.name}-brow{s}", F(s * 0.07 * h, 0.14 * h, 0.01 * h), F(s * 0.24 * h, 0.12 * h, 0.0), 0.024 * h, M.hair(hair_col), self.col)
            ear = ellipsoid(f"{self.name}-ear{s}", c + Vector((s * 0.35 * h, 0.03 * h, 0.0)), (0.05 * h, 0.08 * h, 0.12 * h), skin, self.col, 10, 6)
            parts += [sclera, eye, brow, ear]
        self.mouth = ellipsoid(f"{self.name}-mouth", F(0, -0.28 * h, 0.0), (0.1 * h, 0.03 * h, 0.018 * h), M.plain("#4a1d16", 0.5, 0.3), self.col, 12, 6)
        parts.append(self.mouth)
        hair = M.hair(hair_col)
        if a["headwear"] in ("none", "band", "wrap"):
            cap = ellipsoid(f"{self.name}-hair", c + Vector((0, 0.03 * h, 0.03 * h)), (0.39 * h, 0.47 * h, 0.55 * h), hair, self.col, 28, 18)
            me = cap.data
            bm = bmesh.new()
            bm.from_mesh(me)
            doomed = [
                v
                for v in bm.verts
                if (v.co.z < 0.16 * h and v.co.y < -0.08 * h) or v.co.z < -0.32 * h or (v.co.z < -0.05 * h and abs(v.co.x) > 0.28 * h and v.co.y < 0.12 * h)
            ]
            bmesh.ops.delete(bm, geom=doomed, context="VERTS")
            bm.to_mesh(me)
            bm.free()
            common.add_modifier(cap, "SOLIDIFY", thickness=0.04 * h, offset=1.0)
            parts.append(cap)
        if a["beard"]:
            beard_col = "#d8d2c6" if a["build"] == "elder" else a["hair"]
            beard = ellipsoid(f"{self.name}-beard", c + Vector((0, -0.1 * h, -0.34 * h)), (0.34 * h, 0.36 * h, 0.3 * h), M.hair(beard_col), self.col, 22, 12)
            for v in beard.data.vertices:
                if v.co.z > 0.04 * h:
                    v.co.z = 0.04 * h + (v.co.z - 0.04 * h) * 0.3
                if v.co.y > 0.1 * h:
                    v.co.y *= 0.55
            mous = capsule(f"{self.name}-moustache", F(-0.13 * h, -0.2 * h, 0.015 * h), F(0.13 * h, -0.2 * h, 0.015 * h), 0.038 * h, M.hair(beard_col), self.col)
            parts += [beard, mous]
        for p in parts:
            for poly in p.data.polygons:
                poly.use_smooth = True
            self.parts.append(Part(p, bone="head"))

    def _tunic(self):
        a = self.a
        J = self.J
        H = self.H
        b = BUILDS[a["build"]]
        fem = is_female(a)
        hem_z = b["hem"] * H
        sh = J["shoulder_L"].x
        hip = J["hip_L"].x
        cy = 0.35 * GU
        fold = lambda amp, k, ph: (lambda ang: amp * math.sin(k * ang + ph) + amp * 0.5 * math.sin(k * 2.3 * ang + ph * 1.7))  # noqa: E731
        rings = [
            (0, cy, J["neck"].z - 0.004, 0.045 * H, 0.035 * H),
            (0, cy, J["shoulder_L"].z + 0.012, sh * 0.85, 0.06 * H),
            (0, cy, J["shoulder_L"].z - 0.025 * H, sh * 1.1, 0.072 * H),
            (0, cy, J["chest"].z, sh * 0.9 * (0.97 if fem else 1), 0.072 * H * (1.1 if fem else 1)),
            (0, cy, J["waist"].z + 0.03 * H, sh * 0.78, 0.066 * H, fold(0.03, 5, 0.3)),
            (0, cy, J["waist"].z - 0.01 * H, sh * 0.72, 0.062 * H),
            (0, cy, J["pelvis"].z - 0.02 * H, hip * 2.0, 0.074 * H, fold(0.035, 6, 1.1)),
            (0, cy, J["pelvis"].z - 0.12 * H, hip * 2.15, 0.08 * H, fold(0.06, 7, 1.6)),
            (0, cy, (J["pelvis"].z + hem_z) / 2, hip * 2.3, 0.087 * H, fold(0.1, 7, 2.0)),
            (0, cy, hem_z + 0.03 * H, hip * 2.42, 0.093 * H, fold(0.12, 7, 2.4)),
            (0, cy, hem_z, hip * 2.45, 0.095 * H, fold(0.13, 7, 2.6)),
        ]
        stripe = a["accent"]
        mat = M.cloth(a["robe"], stripe, "wool", 0.1, 0.018)
        tunic = loft(f"{self.name}-tunic", rings, mat, self.col, segments=40)
        common.add_modifier(tunic, "SOLIDIFY", thickness=0.012, offset=1.0)
        common.add_modifier(tunic, "SUBSURF", levels=1, render_levels=1)
        common.bake_modifiers(tunic)
        if "torn-hem" in self.marks:
            # A strip torn from the left of the hem for bandages: shorter there,
            # with a ragged edge (the cloth is folded up to the tear line).
            cut = hem_z + 0.075 * H
            for v in tunic.data.vertices:
                x, y, z = v.co
                if x > 0.004 and z < cut:
                    k = min(1.0, (x - 0.004) / (0.05 * H))
                    rag = 0.012 * H * (math.sin(x * 900) * 0.6 + math.sin(y * 700 + 1) * 0.4)
                    v.co.z = max(z, hem_z + (0.075 * H + rag) * k)
        waist_z = J["waist"].z
        pel = J["pelvis"].z
        torso_w = nearest_bone_weights(J, ["pelvis", "spine", "chest", "upper_arm_L", "upper_arm_R"], 4.0)

        def weights(pts):
            W = torso_w(pts)
            blend = np.clip((pel + 0.02 * H - pts[:, 2]) / (0.05 * H), 0, 1)[:, None]
            Wsk = np.zeros_like(W)
            Wsk[:, BONE_INDEX["pelvis"]] = 1.0
            return W * (1 - blend) + Wsk * blend

        self.parts.append(Part(tunic, weights, skirt=(cy, pel)))
        # Sleeves to just below the elbow.
        for s in ("L", "R"):
            sgn = 1 if s == "L" else -1
            shp = J[f"shoulder_{s}"]
            elb = J[f"elbow_{s}"]
            srings = []
            wr = J[f"wrist_{s}"]
            inner = shp + Vector((-sgn * 0.035 * H, 0, 0.004 * H))
            for k in range(9):
                t = k / 8
                p = inner.lerp(shp, t / 0.12) if t <= 0.12 else (shp.lerp(elb, (t - 0.12) / 0.6) if t <= 0.72 else elb.lerp(wr, (t - 0.72) / 0.28 * 0.45))
                r = (0.04 - 0.012 * t) * H
                srings.append((p.x + sgn * 0.002, p.y, p.z, r, r * 0.95))
            sleeve = loft(f"{self.name}-sleeve{s}", srings, mat, self.col, segments=18, close_top=True)
            common.add_modifier(sleeve, "SOLIDIFY", thickness=0.01, offset=1.0)
            common.bake_modifiers(sleeve)
            self.parts.append(Part(sleeve, nearest_bone_weights(J, ["chest", f"upper_arm_{s}", f"forearm_{s}"], 5.0)))
        # Belt: a woven sash with a knot.
        belt_mat = M.cloth(a["accent"], None, "wool")
        bz = waist_z - 0.005 * H
        belt = loft(
            f"{self.name}-belt",
            [(0, cy, bz + 0.012 * H, sh * 0.8, 0.068 * H), (0, cy, bz - 0.012 * H, sh * 0.76, 0.066 * H)],
            belt_mat,
            self.col,
            segments=32,
        )
        common.add_modifier(belt, "SOLIDIFY", thickness=0.01, offset=1.0)
        common.bake_modifiers(belt)
        self.parts.append(Part(belt, bone="spine"))
        knot = ellipsoid(f"{self.name}-knot", (-0.03 * H, cy - 0.068 * H, bz), (0.02 * H, 0.012 * H, 0.016 * H), belt_mat, self.col, 10, 6)
        self.parts.append(Part(knot, bone="spine"))
        tail = capsule(f"{self.name}-tail", (-0.035 * H, cy - 0.07 * H, bz - 0.01 * H), (-0.045 * H, cy - 0.072 * H, bz - 0.1 * H), 0.009 * H, belt_mat, self.col)
        self.parts.append(Part(tail, bone="pelvis"))

    def _sandals(self):
        J = self.J
        H = self.H
        leather = M.leather("#4e3220")
        skin = M.skin(self.a["skin"])
        for s in ("L", "R"):
            ank = J[f"ankle_{s}"]
            toe = J[f"toe_{s}"]
            mid = Vector(((ank.x + toe.x) / 2, (ank.y + toe.y) / 2 - 0.004 * H, 0.004 * H))
            sole = ellipsoid(f"{self.name}-sole{s}", mid, (0.028 * H, 0.068 * H, 0.006 * H), leather, self.col, 14, 6)
            self.parts.append(Part(sole, bone=f"foot_{s}"))
            foot = ellipsoid(f"{self.name}-foot{s}", mid + Vector((0, 0.004 * H, 0.012 * H)), (0.024 * H, 0.06 * H, 0.014 * H), skin, self.col, 14, 8)
            self.parts.append(Part(foot, bone=f"foot_{s}"))
            strap = capsule(f"{self.name}-strap{s}", mid + Vector((-0.026 * H, -0.01 * H, 0.02 * H)), mid + Vector((0.026 * H, -0.01 * H, 0.02 * H)), 0.005 * H, leather, self.col)
            self.parts.append(Part(strap, bone=f"foot_{s}"))
            if s == "L" and ({"bandaged", "rag-bandaged"} & self.marks):
                wrap = ellipsoid(f"{self.name}-ankle-wrap", ank + Vector((0, 0, 0.01 * H)), (0.03 * H, 0.03 * H, 0.03 * H), self._bandage_mat(), self.col, 12, 8)
                self.parts.append(Part(wrap, bone=f"shin_{s}", mark=self._bandage_mark()))

    def _bandage_mat(self):
        return M.cloth("#e6ddc9", None, "linen") if "bandaged" in self.marks else M.cloth(self.rag, None, "wool")

    def _bandage_mark(self):
        return "bandaged" if "bandaged" in self.marks else "rag-bandaged"

    def _headwear(self):
        a = self.a
        J = self.J
        h = self.head_h
        H = self.H
        c = (J["head"] + J["crown"]) / 2 + Vector((0, -0.04 * h, -0.02 * h))
        mat = M.cloth(a["headwearColor"], None, "linen")
        kind = a["headwear"]
        if kind == "wrap":
            parts = []
            for i in range(4):
                z = (0.24 + i * 0.09) * h
                r = (0.44 - i * 0.045) * h
                ring = loft(
                    f"{self.name}-wrap{i}",
                    [(0, 0.03 * h, z + 0.065 * h, r * 0.96, r * 1.12), (0, 0.03 * h, z - 0.065 * h, r, r * 1.17)],
                    mat,
                    self.col,
                    segments=28,
                )
                common.add_modifier(ring, "SOLIDIFY", thickness=0.03 * h, offset=1.0)
                common.bake_modifiers(ring)
                ring.rotation_euler = (math.radians(-6 - i * 3), math.radians((i - 1.5) * 5), 0)
                ring.location = c
                parts.append(ring)
            top = ellipsoid(f"{self.name}-wraptop", c + Vector((0, 0.05 * h, 0.5 * h)), (0.34 * h, 0.41 * h, 0.2 * h), mat, self.col, 20, 10)
            parts.append(top)
            for p in parts:
                self.parts.append(Part(p, bone="head"))
        elif kind == "band":
            band = loft(
                f"{self.name}-band",
                [(0, c.y + 0.02 * h, c.z + 0.26 * h, 0.39 * h, 0.47 * h), (0, c.y + 0.02 * h, c.z + 0.18 * h, 0.39 * h, 0.47 * h)],
                mat,
                self.col,
                segments=24,
            )
            common.add_modifier(band, "SOLIDIFY", thickness=0.02 * h, offset=1.0)
            common.bake_modifiers(band)
            self.parts.append(Part(band, bone="head"))
        else:
            # Scarf, veil or hood: over the head, framing the face, draped on the shoulders.
            long = kind != "scarf"
            sh = J["shoulder_L"].x
            seg = 32
            neck_z = J["neck"].z
            rings = [
                (0, c.y + 0.04 * h, c.z + 0.58 * h, 0.24 * h, 0.3 * h),
                (0, c.y + 0.04 * h, c.z + 0.5 * h, 0.4 * h, 0.48 * h),
                (0, c.y + 0.05 * h, c.z + 0.3 * h, 0.46 * h, 0.54 * h),
                (0, c.y + 0.06 * h, c.z - 0.05 * h, 0.48 * h, 0.55 * h),
                (0, c.y + 0.1 * h, c.z - 0.42 * h, 0.5 * h, 0.54 * h),
                (0, c.y + 0.16 * h, neck_z - 0.01, sh * 0.95, 0.11 * H),
                (0, c.y + 0.2 * h, neck_z - 0.07 * H, sh * 1.1, 0.12 * H),
            ]
            if long:
                rings.append((0, c.y + 0.28 * h, J["chest"].z - 0.07 * H, sh * 1.1, 0.12 * H))
                rings.append((0, c.y + 0.3 * h, J["waist"].z - 0.04 * H, sh * 1.02, 0.11 * H))

            def skip(i, j):
                ang = 2 * math.pi * j / seg
                front = math.cos(ang) > 0.74  # toward -Y
                if 2 <= i <= 4 and front:
                    return True  # the face
                if long and i >= 5 and math.cos(ang) > 0.8:
                    return True  # open at the chest
                return False

            veil = loft(f"{self.name}-veil", rings, mat, self.col, segments=seg, skip=skip, close_top=True)
            common.add_modifier(veil, "SOLIDIFY", thickness=0.014, offset=1.0)
            common.add_modifier(veil, "SUBSURF", levels=1, render_levels=1)
            common.bake_modifiers(veil)

            def weights(pts):
                W = np.zeros((len(pts), len(BONE_NAMES)))
                t = np.clip((pts[:, 2] - (neck_z - 0.02 * H)) / (0.06 * H), 0, 1)
                W[:, BONE_INDEX["head"]] = t
                W[:, BONE_INDEX["chest"]] = 1 - t
                return W

            self.parts.append(Part(veil, weights))
        if {"bandaged", "rag-bandaged"} & self.marks:
            band = loft(
                f"{self.name}-bandage",
                [(0, c.y, c.z + 0.2 * h, 0.39 * h, 0.47 * h), (0, c.y, c.z + 0.1 * h, 0.39 * h, 0.47 * h)],
                self._bandage_mat(),
                self.col,
                segments=24,
            )
            common.add_modifier(band, "SOLIDIFY", thickness=0.02 * h, offset=1.0)
            common.bake_modifiers(band)
            self.parts.append(Part(band, bone="head", mark=self._bandage_mark()))

    def _mantle(self):
        a = self.a
        J = self.J
        H = self.H
        sh = J["shoulder_L"].x
        cy = 0.6 * GU
        color = "#6e6452"
        mat = M.cloth(color, "#4c4436", "wool", 0.22, 0.05)
        seg = 36
        rings = [
            (0, cy, J["neck"].z + 0.005, 0.07 * H, 0.06 * H),
            (0, cy, J["shoulder_L"].z - 0.01 * H, sh * 1.18, 0.085 * H),
            (0, cy, J["chest"].z - 0.02 * H, sh * 1.16, 0.09 * H),
            (0, cy, J["waist"].z - 0.02 * H, sh * 1.12, 0.1 * H),
            (0, cy, J["knee_L"].z + 0.05 * H, sh * 1.1, 0.11 * H),
        ]

        def skip(i, j):
            return math.cos(2 * math.pi * j / seg) > 0.9 and i >= 0

        mantle = loft(f"{self.name}-mantle", rings, mat, self.col, segments=seg, skip=skip)
        common.add_modifier(mantle, "SOLIDIFY", thickness=0.016, offset=1.0)
        common.add_modifier(mantle, "SUBSURF", levels=1, render_levels=1)
        common.bake_modifiers(mantle)
        self.parts.append(Part(mantle, nearest_bone_weights(J, ["pelvis", "spine", "chest", "upper_arm_L", "upper_arm_R"], 3.0)))
        _ = a

    def _carry(self):
        a = self.a
        J = self.J
        H = self.H
        kind = a.get("carry", "none")
        if kind == "satchel":
            bag = common.box(f"{self.name}-satchel", (0.1 * H, 0.04 * H, 0.085 * H), material=M.leather("#6a4628"), col=self.col, bevel=0.01)
            bag.location = (J["hip_L"].x + 0.07 * H, J["hip_L"].y - 0.02 * H, J["pelvis"].z - 0.03 * H)
            common.bake_modifiers(bag)
            self.parts.append(Part(bag, bone="pelvis"))
            strap_pts = [J["shoulder_R"] + Vector((0.01, -0.01, 0.012)), J["chest"] + Vector((0, -0.075 * H, 0)), J["hip_L"] + Vector((0.06 * H, -0.05 * H, 0.05 * H))]
            for i in range(2):
                st = capsule(f"{self.name}-satstrap{i}", strap_pts[i], strap_pts[i + 1], 0.009 * H, M.leather("#5a3a20"), self.col)
                self.parts.append(Part(st, bone="chest" if i == 0 else "spine"))
        elif kind == "staff":
            hand = J["hand_R"]
            staff = capsule(f"{self.name}-staff", (hand.x - 0.01 * H, hand.y - 0.05 * H, 0.0), (hand.x - 0.02 * H, hand.y - 0.05 * H, 1.02 * H), 0.012 * H, M.wood("#6e4e30", 3.0), self.col)
            self.parts.append(Part(staff, bone="hand_R", upright=tuple(hand)))
        elif kind == "spindle":
            hand = J["hand_R"]
            rod = capsule(f"{self.name}-spindle", hand + Vector((0, -0.01, -0.02 * H)), hand + Vector((0, -0.01, -0.13 * H)), 0.004 * H, M.wood("#7a5634"), self.col)
            whorl = ellipsoid(f"{self.name}-whorl", hand + Vector((0, -0.01, -0.11 * H)), (0.018 * H, 0.018 * H, 0.006 * H), M.terracotta("#9c6a48", 0.0), self.col, 12, 6)
            wool = ellipsoid(f"{self.name}-wool", J["hand_L"] + Vector((0, -0.02 * H, 0.03 * H)), (0.03 * H, 0.03 * H, 0.04 * H), M.cloth("#e2d8c2", None, "wool"), self.col, 12, 8)
            self.parts += [Part(rod, bone="hand_R"), Part(whorl, bone="hand_R"), Part(wool, bone="hand_L")]
        elif kind == "basket":
            hand = J["hand_L"]
            basket = M.straw()
            b = common.lathe(f"{self.name}-basket", [(0.04 * H, 0), (0.07 * H, 0.05 * H), (0.075 * H, 0.07 * H)], 24, basket, self.col)
            b.location = hand + Vector((0.02 * H, -0.03 * H, -0.02 * H))
            self.parts.append(Part(b, bone="hand_L"))
        elif kind == "jar":
            hand = J["hand_L"]
            prof = [(0.02 * H, 0), (0.06 * H, 0.05 * H), (0.065 * H, 0.11 * H), (0.035 * H, 0.17 * H), (0.022 * H, 0.2 * H), (0.028 * H, 0.21 * H)]
            jar = common.lathe(f"{self.name}-jar", prof, 24, M.terracotta(), self.col)
            jar.location = hand + Vector((0.04 * H, -0.02 * H, -0.03 * H))
            self.parts.append(Part(jar, bone="hand_L"))
        elif kind == "bread":
            hand = J["hand_R"]
            tray = common.lathe(f"{self.name}-tray", [(0.0, 0), (0.1 * H, 0.0), (0.11 * H, 0.015 * H)], 24, M.straw(), self.col)
            tray.location = hand + Vector((-0.04 * H, -0.06 * H, 0.02 * H))
            self.parts.append(Part(tray, bone="hand_R"))
            for i in range(4):
                ang = i * math.pi / 2 + 0.4
                loaf = ellipsoid(f"{self.name}-loaf{i}", tray.location + Vector((math.cos(ang) * 0.05 * H, math.sin(ang) * 0.05 * H, 0.02 * H)), (0.04 * H, 0.04 * H, 0.018 * H), M.plain("#a8733e", 0.7), self.col, 12, 6)
                self.parts.append(Part(loaf, bone="hand_R"))
        elif kind == "bundle":
            back = J["chest"] + Vector((0, 0.1 * H, -0.02 * H))
            sack = ellipsoid(f"{self.name}-bundle", back, (0.1 * H, 0.07 * H, 0.12 * H), M.cloth("#8a7a5c", None, "wool"), self.col, 16, 10)
            self.parts.append(Part(sack, bone="chest"))
        elif kind == "lamb":
            # A newborn lamb held against the chest in both arms (in the lap, sitting).
            c = J["pelvis"] + Vector((0, -0.12 * H, 0.08 * H))
            for o in self._lamb(c, 0.8, speckled=False):
                self.parts.append(Part(o, bone="pelvis"))
        elif kind == "lamp":
            # A small clay lamp held up in the right hand, burning.
            hand = J["hand_R"]
            at = hand + Vector((0.0, -0.02 * H, 0.012 * H))
            body = ellipsoid(f"{self.name}-lamp", at, (0.03 * H, 0.022 * H, 0.012 * H), M.terracotta("#b2714a", 0.1), self.col, 14, 8)
            nozzle = ellipsoid(f"{self.name}-lamp-nozzle", at + Vector((0.0, -0.028 * H, 0.002 * H)), (0.012 * H, 0.016 * H, 0.008 * H), M.terracotta("#a8683f", 0.1), self.col, 8, 5)
            flame = ellipsoid(f"{self.name}-lamp-flame", at + Vector((0.0, -0.036 * H, 0.02 * H)), (0.005 * H, 0.005 * H, 0.014 * H), M.emissive("#ffc070", 40.0), self.col, 8, 6)
            flame.visible_shadow = False
            for o in (body, nozzle, flame):
                self.parts.append(Part(o, bone="hand_R"))
            data = bpy.data.lights.new(f"{self.name}-lamp-light", "POINT")
            data.energy = 3.0
            data.color = common.hex_rgb("#ffae5a")[:3]
            data.shadow_soft_size = 0.02
            light = bpy.data.objects.new(f"{self.name}-lamp-light", data)
            self.col.objects.link(light)
            self.lamp_light = (light, at + Vector((0.0, -0.05 * H, 0.03 * H)))
        elif kind == "tablet":
            # A wax writing tablet held against the left forearm, a stylus in the right hand.
            hand = J["hand_L"]
            tab = common.box(f"{self.name}-tablet", (0.1 * H, 0.012 * H, 0.075 * H), material=M.wood("#8a6444", 9.0), col=self.col, bevel=0.002)
            tab.location = hand + Vector((0.0, -0.035 * H, 0.03 * H))
            tab.rotation_euler = (0.5, 0.0, 0.25)
            common.bake_modifiers(tab)
            face = common.box(f"{self.name}-tablet-wax", (0.085 * H, 0.004 * H, 0.06 * H), material=M.plain("#3a2c1c", 0.4, 0.45), col=self.col)
            face.location = hand + Vector((0.004 * H, -0.042 * H, 0.032 * H))
            face.rotation_euler = (0.5, 0.0, 0.25)
            self.parts += [Part(tab, bone="hand_L"), Part(face, bone="hand_L")]
            rh = J["hand_R"]
            stylus = capsule(f"{self.name}-stylus", rh + Vector((0, -0.01, 0)), rh + Vector((0.01 * H, -0.02 * H, 0.08 * H)), 0.0035 * H, M.plain("#8a6a3e", 0.35, 0.6), self.col)
            self.parts.append(Part(stylus, bone="hand_R"))

        elif kind == "tablets":
            # A scribe's pair of hinged wooden tablets held against the chest
            # in the left arm (the arm is bent to hold them: see pose), the
            # stylus tucked in beside them.
            wood = M.wood("#8a6440", 9.0)
            c = J["chest"] + Vector((0.035 * H, -0.085 * H, -0.05 * H))
            for k in range(2):
                board = common.box(f"{self.name}-tablet{k}", (0.1 * H, 0.012 * H, 0.13 * H), material=wood, col=self.col, bevel=0.002)
                board.location = c + Vector((0, -0.013 * H * k, 0))
                board.rotation_euler = (math.radians(-12), 0, math.radians(-6))
                common.bake_modifiers(board)
                self.parts.append(Part(board, bone="chest"))
            cord = capsule(f"{self.name}-tablet-cord", c + Vector((-0.05 * H, -0.008 * H, 0.03 * H)), c + Vector((-0.05 * H, -0.008 * H, -0.03 * H)), 0.004 * H, M.plain("#6a4a2e", 0.8), self.col)
            self.parts.append(Part(cord, bone="chest"))
            stylus = capsule(f"{self.name}-stylus", c + Vector((0.055 * H, -0.02 * H, 0.08 * H)), c + Vector((0.058 * H, -0.02 * H, -0.02 * H)), 0.003 * H, M.plain("#9a7a44", 0.35, 0.6), self.col)
            self.parts.append(Part(stylus, bone="chest"))
        elif kind == "scroll-case":
            # A letter carrier's cylindrical leather case at the right hip,
            # capped at both ends, on a strap over the left shoulder.
            leather = M.leather("#8a5230")
            top = Vector((J["hip_R"].x - 0.07 * H, 0.35 * GU + 0.01 * H, J["pelvis"].z + 0.07 * H))
            bot = Vector((J["hip_R"].x - 0.085 * H, 0.35 * GU - 0.035 * H, J["pelvis"].z - 0.16 * H))
            case = capsule(f"{self.name}-scrollcase", bot, top, 0.033 * H, leather, self.col, 14)
            self.parts.append(Part(case, bone="pelvis"))
            for end, r in ((top, 0.037 * H), (bot, 0.037 * H)):
                cap = ellipsoid(f"{self.name}-scrollcap{end.z:.3f}", end, (r, r, 0.012 * H), M.leather("#4a2e1a"), self.col, 12, 6)
                self.parts.append(Part(cap, bone="pelvis"))
            pts = [J["shoulder_L"] + Vector((-0.01, -0.012, 0.012)), J["chest"] + Vector((0, -0.076 * H, -0.01 * H)), top + Vector((0.01 * H, -0.02 * H, 0.0))]
            for i in range(2):
                st = capsule(f"{self.name}-scrollstrap{i}", pts[i], pts[i + 1], 0.007 * H, M.leather("#4a3020"), self.col)
                self.parts.append(Part(st, bone="chest" if i == 0 else "spine"))

    def _lamb(self, c, size, speckled=False, mark=None):
        """A small lamb for carrying (in arms, or across the shoulders): a
        woolly body, a pale head with dark eyes and drooping ears, folded
        legs; `c` its middle. Returns its objects (placed by the caller's bone)."""
        s = size
        wool = _speckled_wool() if speckled else M.cloth("#e8dfcb", None, "wool")
        head_mat = M.cloth("#d8cab2", None, "wool")
        dark = M.plain("#1a1410", 0.3, 0.5)
        objs = []
        body = ellipsoid(f"{self.name}-lamb-body", c, (0.2 * s, 0.11 * s, 0.1 * s), wool, self.col, 18, 10)
        objs.append(body)
        head = ellipsoid(f"{self.name}-lamb-head", c + Vector((0.2 * s, -0.04 * s, 0.05 * s)), (0.075 * s, 0.05 * s, 0.055 * s), head_mat, self.col, 12, 8)
        objs.append(head)
        for side in (-1, 1):
            objs.append(ellipsoid(f"{self.name}-lamb-ear{side}", c + Vector((0.17 * s, -0.04 * s + side * 0.045 * s, 0.04 * s)), (0.02 * s, 0.012 * s, 0.04 * s), head_mat, self.col, 8, 6))
            objs.append(ellipsoid(f"{self.name}-lamb-eye{side}", c + Vector((0.24 * s, -0.07 * s, 0.065 * s)), (0.008 * s, 0.006 * s, 0.008 * s), dark, self.col, 6, 4))
            for fx in (0.1, -0.1):
                objs.append(capsule(f"{self.name}-lamb-leg{side}{fx}", c + Vector((fx * s, side * 0.05 * s, -0.06 * s)), c + Vector((fx * s + 0.02 * s, side * 0.05 * s, -0.19 * s)), 0.018 * s, head_mat, self.col, 8))
        return objs

    def _marks(self):
        """Visible story marks: the player's water skin, lamp and rolled cloak,
        and the spare cloak wrapped around someone. (Bandages are added with
        the head and sandals; a torn hem with the tunic.)"""
        J = self.J
        H = self.H
        cy = 0.35 * GU
        leather = M.leather("#5b3b24")
        cloak_col = M._toward("#7a4a34", "#8a6a50", 0.2)
        if "water-skin" in self.marks:
            # A goatskin bag at the right hip, its strap over the left shoulder.
            c = J["hip_R"] + Vector((-0.07 * H, -0.015 * H, -0.035 * H))
            bag = ellipsoid(f"{self.name}-waterskin", c, (0.036 * H, 0.03 * H, 0.052 * H), leather, self.col, 16, 10)
            neck = capsule(f"{self.name}-waterskin-neck", c + Vector((0, 0, 0.045 * H)), c + Vector((0.01 * H, -0.004 * H, 0.075 * H)), 0.011 * H, leather, self.col)
            tie = ellipsoid(f"{self.name}-waterskin-tie", c + Vector((0.01 * H, -0.004 * H, 0.077 * H)), (0.012 * H, 0.012 * H, 0.008 * H), M.plain("#3a2616", 0.8), self.col, 8, 5)
            for o in (bag, neck, tie):
                self.parts.append(Part(o, bone="pelvis", mark="water-skin"))
            pts = [J["shoulder_L"] + Vector((-0.01, -0.012, 0.01)), J["chest"] + Vector((0, -0.074 * H, -0.02 * H)), c + Vector((0.006 * H, -0.02 * H, 0.06 * H))]
            for i in range(2):
                st = capsule(f"{self.name}-waterskin-strap{i}", pts[i], pts[i + 1], 0.006 * H, M.leather("#4a3020"), self.col)
                self.parts.append(Part(st, bone="chest" if i == 0 else "spine", mark="water-skin"))
        if "letter-case" in self.marks:
            # A flat leather letter case at the right hip, its flap buckled
            # down, on a strap over the left shoulder.
            c = J["hip_R"] + Vector((-0.064 * H, -0.03 * H, -0.03 * H))
            case = common.box(f"{self.name}-lettercase", (0.028 * H, 0.115 * H, 0.15 * H), material=M.leather("#5e2c1e"), col=self.col, bevel=0.004)
            case.location = c
            case.rotation_euler = (0, math.radians(-8), 0)
            common.bake_modifiers(case)
            flap = common.box(f"{self.name}-lettercase-flap", (0.031 * H, 0.115 * H, 0.055 * H), material=M.leather("#4a2218"), col=self.col, bevel=0.003)
            flap.location = c + Vector((-0.002 * H, 0, 0.045 * H))
            flap.rotation_euler = (0, math.radians(-8), 0)
            common.bake_modifiers(flap)
            buckle = ellipsoid(f"{self.name}-lettercase-buckle", c + Vector((-0.016 * H, -0.0, 0.02 * H)), (0.006 * H, 0.012 * H, 0.008 * H), M.plain("#b89a5a", 0.35, 0.6), self.col, 8, 6)
            for o in (case, flap, buckle):
                self.parts.append(Part(o, bone="pelvis", mark="letter-case"))
            pts = [J["shoulder_L"] + Vector((-0.012, -0.014, 0.012)), J["chest"] + Vector((-0.01 * H, -0.077 * H, -0.03 * H)), c + Vector((0.004 * H, -0.02 * H, 0.06 * H))]
            for i in range(2):
                st = capsule(f"{self.name}-lettercase-strap{i}", pts[i], pts[i + 1], 0.0065 * H, M.leather("#4a3020"), self.col)
                self.parts.append(Part(st, bone="chest" if i == 0 else "spine", mark="letter-case"))
        if "lamp" in self.marks:
            # A small clay lamp hanging from the belt, front left; after dark
            # (the night and lamp lights: build_people.DARK) it burns.
            bz = J["waist"].z - 0.03 * H
            c = Vector((J["shoulder_L"].x * 0.55, cy - 0.075 * H, bz - 0.045 * H))
            body = ellipsoid(f"{self.name}-lamp", c, (0.028 * H, 0.02 * H, 0.012 * H), M.terracotta("#b2714a", 0.1), self.col, 14, 8)
            nozzle = ellipsoid(f"{self.name}-lamp-nozzle", c + Vector((-0.025 * H, -0.004 * H, 0.002 * H)), (0.014 * H, 0.01 * H, 0.008 * H), M.terracotta("#a8683f", 0.1), self.col, 8, 5)
            cord = capsule(f"{self.name}-lamp-cord", c + Vector((0, 0, 0.012 * H)), Vector((c.x, c.y + 0.004 * H, bz)), 0.0025 * H, M.plain("#4a3322", 0.8), self.col)
            flame = ellipsoid(f"{self.name}-lamp-flame", c + Vector((-0.036 * H, -0.004 * H, 0.016 * H)), (0.005 * H, 0.005 * H, 0.013 * H), M.emissive("#ffc070", 40.0), self.col, 8, 6)
            flame.visible_shadow = False
            flame["night_only"] = True
            for o in (body, nozzle, cord, flame):
                self.parts.append(Part(o, bone="pelvis", mark="lamp"))
        if "carrying-lamb" in self.marks:
            # The lost lamb carried home across the shoulders: its body across
            # the back of the neck, its head hanging by one shoulder, its legs
            # gathered in front of the chest (where the hands would hold them).
            wool = _speckled_wool()
            pale = M.cloth("#d8cab2", None, "wool")
            dark = M.plain("#1a1410", 0.3, 0.5)
            sz = J["shoulder_L"].z + 0.02 * H
            sh = J["shoulder_L"].x
            back = J["neck"].y + 0.06 * H
            ln = sh * 1.35
            parts = [
                ellipsoid(f"{self.name}-carried-body", (0.0, back, sz + 0.035 * H), (ln, 0.07 * H, 0.068 * H), wool, self.col, 20, 12),
                ellipsoid(f"{self.name}-carried-rump", (sh * 0.95, back, sz + 0.03 * H), (0.07 * H, 0.068 * H, 0.066 * H), wool, self.col, 14, 10),
                ellipsoid(f"{self.name}-carried-head", (-ln * 1.05, back - 0.05 * H, sz + 0.01 * H), (0.05 * H, 0.04 * H, 0.045 * H), pale, self.col, 14, 10),
            ]
            for side in (-1, 1):
                parts.append(ellipsoid(f"{self.name}-carried-ear{side}", (-ln * 1.02, back - 0.05 * H + side * 0.035 * H, sz - 0.015 * H), (0.012 * H, 0.01 * H, 0.03 * H), pale, self.col, 8, 6))
            parts.append(ellipsoid(f"{self.name}-carried-eye", (-ln * 1.12, back - 0.085 * H, sz + 0.02 * H), (0.008 * H, 0.006 * H, 0.008 * H), dark, self.col, 6, 4))
            chest_z = J["chest"].z - 0.02 * H
            for k, (x0, x1) in enumerate(((-ln * 0.65, -sh * 0.55), (-ln * 0.5, -sh * 0.4), (ln * 0.6, sh * 0.55), (ln * 0.48, sh * 0.4))):
                a = Vector((x0, back - 0.02 * H, sz + 0.01 * H))
                b = Vector((x1, cy - 0.085 * H, chest_z + (0.02 * H if k % 2 else 0.0)))
                parts.append(capsule(f"{self.name}-carried-leg{k}", a, b, 0.014 * H, pale, self.col, 8))
                parts.append(ellipsoid(f"{self.name}-carried-hoof{k}", tuple(b + Vector((0, -0.005 * H, -0.01 * H))), (0.012 * H, 0.012 * H, 0.014 * H), dark, self.col, 6, 4))
            for o in parts:
                self.parts.append(Part(o, bone="chest", mark="carrying-lamb"))
        if "cloak-roll" in self.marks:
            # The spare cloak rolled and strapped across the upper back.
            z = J["chest"].z + 0.02 * H
            roll = capsule(f"{self.name}-cloakroll", (-0.1 * H, cy + 0.085 * H, z), (0.1 * H, cy + 0.085 * H, z), 0.03 * H, M.cloth(cloak_col, None, "wool"), self.col, 16)
            self.parts.append(Part(roll, bone="chest", mark="cloak-roll"))
            for sx in (-0.06, 0.06):
                tie = loft(f"{self.name}-cloakroll-tie{sx}", [(sx * H, cy + 0.085 * H, z + 0.004 * H, 0.004 * H, 0.034 * H), (sx * H, cy + 0.085 * H, z - 0.004 * H, 0.004 * H, 0.034 * H)], M.plain("#4a3322", 0.8), self.col, segments=12)
                self.parts.append(Part(tie, bone="chest", mark="cloak-roll"))
        if "wrapped-in-cloak" in self.marks:
            # The player's spare cloak around the shoulders, open at the front.
            sh = J["shoulder_L"].x
            ccy = 0.55 * GU
            seg = 36
            rings = [
                (0, ccy, J["neck"].z + 0.01 * H, 0.075 * H, 0.065 * H),
                (0, ccy, J["shoulder_L"].z - 0.005 * H, sh * 1.22, 0.09 * H),
                (0, ccy, J["chest"].z - 0.02 * H, sh * 1.2, 0.095 * H),
                (0, ccy, J["waist"].z - 0.03 * H, sh * 1.16, 0.105 * H),
                (0, ccy, J["pelvis"].z - 0.1 * H, sh * 1.14, 0.11 * H),
            ]

            def skip(i, j):
                return math.cos(2 * math.pi * j / seg) > 0.86

            mantle = loft(f"{self.name}-cloak", rings, M.cloth(cloak_col, "#5a3a26", "wool", 0.3, 0.04), self.col, segments=seg, skip=skip)
            common.add_modifier(mantle, "SOLIDIFY", thickness=0.016, offset=1.0)
            common.add_modifier(mantle, "SUBSURF", levels=1, render_levels=1)
            common.bake_modifiers(mantle)
            self.parts.append(Part(mantle, nearest_bone_weights(J, ["pelvis", "spine", "chest", "upper_arm_L", "upper_arm_R"], 3.0), mark="wrapped-in-cloak"))

    # ── posing ─────────────────────────────────────────────────────────────
    def pose(self, walk=None, breath=0.0, blink=False, talk=0, yaw=0.0, rest=None):
        """Place every part for one frame. `walk` is the cycle phase (0–1) or
        None; `rest` is None (standing), "sit" (cross-legged on the ground) or
        "lie" (on the back, head toward the facing given by `yaw`)."""
        # Gesture with the free hand: the right hand may be holding a staff, spindle, tray or lamp.
        carry = self.a.get("carry", "none")
        busy = carry in ("staff", "spindle", "bread", "lamp", "tablet", "lamb")
        R = pose_rotations(walk, breath, talk, hand="L" if busy else "R", rest=rest)
        if rest is None and carry == "lamp":
            # The lamp held up before him, lighting the way.
            R["upper_arm_R"] = rot(x=-36.0, y=-14.0)
            R["forearm_R"] = rot(x=-82.0, z=6.0)
        elif rest is None and carry == "lamb":
            # Both arms cradling the lamb against the chest.
            for side, sgn in (("L", 1), ("R", -1)):
                R[f"upper_arm_{side}"] = rot(x=-22.0, y=sgn * 6.0)
                R[f"forearm_{side}"] = rot(x=-78.0, z=-sgn * 24.0)
        if self.a.get("carry") == "tablets" and rest is None:
            # The left arm holds the tablets against the chest.
            R["upper_arm_L"] = rot(x=-14.0 + (2.0 if breath else 0.0), y=6.0)
            R["forearm_L"] = rot(x=-116.0, z=-38.0)
        if rest is not None:
            R["root"] = self._rest_root(rest)
        mats = self._forward(R)
        if rest is None:
            # Keep the lowest sole on the ground.
            soles = []
            for s in ("L", "R"):
                for jn in (f"ankle_{s}", f"toe_{s}"):
                    bone = BONE_INDEX[f"foot_{s}"]
                    p = mats[bone] @ self.J[jn].to_4d()
                    soles.append(p.z - (0.042 * self.H if jn.startswith("ankle") else 0.012 * self.H))
            dz = -min(soles)
        else:
            dz = 0.0
        lift = Matrix.Translation((0, 0, dz))
        turn = Matrix.Rotation(yaw, 4, "Z")
        mats = [turn @ lift @ m for m in mats]
        for part in self.parts:
            if part.bone is not None:
                m = mats[BONE_INDEX[part.bone]]
                if part.upright is not None:
                    grip = Vector(part.upright)
                    moved = m @ grip
                    lean = Matrix.Rotation(yaw, 4, "Z")
                    part.obj.matrix_world = Matrix.Translation(moved) @ lean @ Matrix.Translation(-grip)
                else:
                    part.obj.matrix_world = m
                continue
            W = part.weights
            out = np.zeros_like(part.rest)
            hom = np.hstack([part.rest, np.ones((len(part.rest), 1))])
            for bi in np.nonzero(W.sum(axis=0) > 1e-6)[0]:
                m = np.array(mats[bi])
                out += W[:, bi : bi + 1] * (hom @ m.T)[:, :3]
            if part.skirt is not None and rest != "lie":
                out = self._tent(part, out, mats)
            if rest is not None and (part.skirt is not None or part.mark == "wrapped-in-cloak"):
                out = self._pool(out)
            part.obj.data.vertices.foreach_set("co", out.reshape(-1))
            part.obj.data.update()
        lamp = getattr(self, "lamp_light", None)
        if lamp is not None:
            light, at = lamp
            light.location = mats[BONE_INDEX["hand_R"]] @ at
        for eye in self.eyes:
            eye.scale = (1.0, 1.0, 0.15 if blink else 1.0)
        if self.mouth is not None:
            self.mouth.scale = (0.8 if talk else 1.0, 1.0, 3.2 if talk == 1 else (1.8 if talk == 2 else 1.0))

    def _rest_root(self, rest):
        """The root transform that sets the body down: hips on the ground
        (sitting), or laid on the back with the head to the north (lying)."""
        J = self.J
        H = self.H
        if rest == "sit":
            return Matrix.Translation((0, 0.02 * H, -(J["hip_L"].z - 0.11 * H)))
        pivot = J["pelvis"]
        return (
            Matrix.Translation((0, -0.02 * H, -(pivot.z - 0.085 * H)))
            @ Matrix.Translation(pivot)
            @ Matrix.Rotation(math.radians(-90), 4, "X")
            @ Matrix.Translation(-pivot)
        )

    def _pool(self, out):
        """Nothing below the ground: cloth that would sink spreads out on it."""
        z0 = 0.004
        below = out[:, 2] < z0
        if below.any():
            depth = z0 - out[below, 2]
            r = out[below, :2]
            n = np.linalg.norm(r, axis=1, keepdims=True) + 1e-6
            out[below, :2] = r + r / n * np.minimum(depth, 0.25 * self.H)[:, None] * 0.35
            # Folds as it settles, rather than a flat sheet.
            ang = np.arctan2(r[:, 1], r[:, 0])
            out[below, 2] = z0 + 0.006 * self.H * (1 + np.sin(ang * 7)) * np.clip(depth / (0.05 * self.H), 0, 1)
        return out

    def _tent(self, part, out, mats):
        """Push the skirt out around the posed legs so knees and shins never
        show through the cloth: each vertex's radius grows to cover any leg
        in its direction, falling off smoothly to the sides."""
        cy, top = part.skirt
        rest = part.rest
        below = rest[:, 2] < top
        if not below.any():
            return out
        pel = np.array(mats[BONE_INDEX["pelvis"]])
        H = self.H
        samples = []
        for s in ("L", "R"):
            thigh = np.array(mats[BONE_INDEX[f"thigh_{s}"]])
            shin = np.array(mats[BONE_INDEX[f"shin_{s}"]])
            hip = thigh @ np.array([*self.J[f"hip_{s}"], 1.0])
            knee = thigh @ np.array([*self.J[f"knee_{s}"], 1.0])
            ankle = shin @ np.array([*self.J[f"ankle_{s}"], 1.0])
            for t in np.linspace(0, 1, 7):
                samples.append((hip[:3] + (knee[:3] - hip[:3]) * t, (0.058 - 0.022 * t) * H))
            for t in np.linspace(0, 1, 7)[1:]:
                samples.append((knee[:3] + (ankle[:3] - knee[:3]) * t, (0.036 - 0.014 * t) * H))
        P = np.array([p for p, _ in samples])
        Rr = np.array([r for _, r in samples])
        v = out[below]
        centre = (np.hstack([np.zeros((len(v), 1)), np.full((len(v), 1), cy), rest[below, 2:3], np.ones((len(v), 1))]) @ pel.T)[:, :3]
        rel = v - centre
        horiz = rel[:, :2]
        r = np.linalg.norm(horiz, axis=1) + 1e-9
        d = horiz / r[:, None]
        need = r.copy()
        pad = 0.018 * H
        spread = 0.1 * H
        for (p, rad) in zip(P, Rr):
            q = p[None, :2] - centre[:, :2]
            along = (q * d).sum(axis=1)
            lateral = np.abs(q[:, 0] * d[:, 1] - q[:, 1] * d[:, 0])
            dz = np.abs(p[2] - v[:, 2])
            reach = along + rad + pad - lateral**2 / (2 * spread) - np.maximum(0, dz - 0.03 * H) * 1.5
            need = np.maximum(need, reach)
        v[:, :2] = centre[:, :2] + d * need[:, None]
        out[below] = v
        return out

    def _forward(self, R):
        mats = [None] * len(BONES)
        for i, (name, head, _tail, parent) in enumerate(BONES):
            h = self.J[head]
            local = Matrix.Translation(h) @ R.get(name, Matrix.Identity(4)) @ Matrix.Translation(-h)
            if name == "pelvis" and "root" in R:
                local = R["root"] @ local
            mats[i] = local if parent is None else mats[BONE_INDEX[parent]] @ local
        return mats


def _g(q, centre, width):
    """A periodic bump (0–1) centred on `centre` in the cycle."""
    d = (q - centre + 0.5) % 1.0 - 0.5
    return math.exp(-(d * d) / (2 * width * width))


def rot(x=0.0, y=0.0, z=0.0):
    return (
        Matrix.Rotation(math.radians(z), 4, "Z")
        @ Matrix.Rotation(math.radians(y), 4, "Y")
        @ Matrix.Rotation(math.radians(x), 4, "X")
    )


def pose_rotations(walk, breath, talk, hand="R", rest=None):
    """Joint rotations (degrees about the character's axes) for one frame.
    Forward swing of a limb is a negative X rotation; knee bend positive."""
    R = {}
    if rest == "sit":
        # Cross-legged: thighs forward and out, shins folded in, hands on the knees.
        rise = 1.0 if breath else 0.0
        for side, sgn in (("L", 1), ("R", -1)):
            R[f"thigh_{side}"] = rot(x=-84.0, z=sgn * 42.0)
            R[f"shin_{side}"] = rot(x=138.0, z=-sgn * 38.0)
            R[f"foot_{side}"] = rot(x=28.0)
            R[f"upper_arm_{side}"] = rot(x=-30.0, y=sgn * 10.0)
            R[f"forearm_{side}"] = rot(x=-48.0, z=-sgn * 12.0)
        R["spine"] = rot(x=-5.0 - 0.8 * rise)
        R["chest"] = rot(x=-2.0 - 1.2 * rise)
        R["head"] = rot(x=4.0)
        if talk:
            k = 1.0 if talk == 1 else 0.75
            s = -1.0 if hand == "R" else 1.0
            R[f"upper_arm_{hand}"] = rot(x=-40.0 * k, y=10.0 * s)
            R[f"forearm_{hand}"] = rot(x=-70.0 * k, z=10.0 * k * s)
        return R
    if rest == "lie":
        # On the back: legs straight but one knee a little raised, arms by the sides.
        rise = 1.0 if breath else 0.0
        R["thigh_L"] = rot(x=-14.0)
        R["shin_L"] = rot(x=26.0)
        R["foot_L"] = rot(x=-10.0)
        R["foot_R"] = rot(x=-25.0)
        R["upper_arm_L"] = rot(y=14.0)
        R["upper_arm_R"] = rot(y=-10.0, x=-8.0)
        R["forearm_L"] = rot(x=-12.0)
        R["forearm_R"] = rot(x=-40.0)
        R["chest"] = rot(x=-1.5 * rise)
        R["head"] = rot(z=12.0, x=-6.0 + (3.0 if talk else 0.0))
        return R
    if walk is not None:
        p = walk
        for side, q in (("L", p), ("R", (p + 0.5) % 1.0)):
            thigh = -(17.0 * math.cos(2 * math.pi * q) + 2.0)
            knee = 5.0 + 12.0 * _g(q, 0.12, 0.07) + 50.0 * _g(q, 0.7, 0.11)
            ankle = 6.0 * _g(q, 0.06, 0.05) - 16.0 * _g(q, 0.56, 0.07) - 8.0 * _g(q, 0.78, 0.1)
            R[f"thigh_{side}"] = rot(x=thigh)
            R[f"shin_{side}"] = rot(x=knee)
            R[f"foot_{side}"] = rot(x=ankle)
            same = math.cos(2 * math.pi * q)
            R[f"upper_arm_{side}"] = rot(x=15.0 * same, y=(3 if side == "L" else -3))
            R[f"forearm_{side}"] = rot(x=-(10.0 + 14.0 * max(0.0, -same)))
        yaw = -5.0 * math.cos(2 * math.pi * p)
        sway = 0.012 * math.sin(2 * math.pi * p) * 54 * GU
        R["root"] = Matrix.Translation((sway, 0, 0))
        R["pelvis"] = rot(z=yaw, y=2.0 * math.sin(2 * math.pi * p))
        R["spine"] = rot(x=-3.0, z=-yaw * 1.6)
        R["head"] = rot(z=yaw * 0.5)
    else:
        rise = 1.0 if breath else 0.0
        R["spine"] = rot(x=-0.8 * rise)
        R["chest"] = rot(x=-1.2 * rise)
        R["upper_arm_L"] = rot(y=2.0 + rise * 0.6)
        R["upper_arm_R"] = rot(y=-2.0 - rise * 0.6)
        R["forearm_L"] = rot(x=-8.0)
        R["forearm_R"] = rot(x=-8.0)
        if breath:
            R["root"] = Matrix.Translation((0.003, 0, 0))
    if talk:
        k = 1.0 if talk == 1 else 0.75
        s = -1.0 if hand == "R" else 1.0
        R[f"upper_arm_{hand}"] = rot(x=-28.0 * k, y=10.0 * s)
        R[f"forearm_{hand}"] = rot(x=-62.0 * k, z=10.0 * k * s)
        R["head"] = rot(x=2.0 * k)
    return R
