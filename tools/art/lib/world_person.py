"""A world figure built on MakeHuman's body (world_body.py), in Blender:
the rigged, skinned body with the person's portrait skin, hair and beard
grown where the portrait's grow, eyes; clothes draped by cloth simulation
(world_cloth.py); and the things they carry and the story's marks
(tools/art/lib/people.py builds those, placed by the same landmarks).

Drop-in for people.Person in build_people.py: `parts` (each with `.obj`
and `.mark`), `pose(walk, breath, blink, talk, yaw, rest)`, and
`prepare(specs)`, which simulates the clothes for every frame a sheet will
show before any is rendered.

The skin's colour is the portrait's: the same regional maps (warmer cheeks,
nose and ears, the lips, a beard's shadow, the sun's marks:
portrait_mhskin.maps) on the same vertices of the same model, scaled by the
gain the portrait build measured for that person (tools/art/data/
portrait-checks.json), so a person in the world has the skin of their
portrait. Someone with no portrait (a passer-by) takes the portraits'
average correction.
"""
import json
import math
import os

import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import makehuman as mh
import materials as M
import people
import portrait_hair
import portrait_mhhead
import portrait_materials
import portrait_mhskin
import world_body as wb
import world_cloth
import world_motion

F = np.float32
HERE = os.path.dirname(os.path.abspath(__file__))
CHECKS = os.path.join(HERE, "..", "data", "portrait-checks.json")
PORTRAIT_PEOPLE = os.path.join(HERE, "..", "data", "portrait-people.json")

# The old skeleton's bones (people.py's props are placed on them) → MakeHuman's.
BONE_MAP = {
    "pelvis": "spine05",
    "spine": "spine03",
    "chest": "spine01",
    "neck": "neck01",
    "head": "head",
    "hand_L": "wrist.L",
    "hand_R": "wrist.R",
    "forearm_L": "lowerarm01.L",
    "forearm_R": "lowerarm01.R",
    "upper_arm_L": "upperarm01.L",
    "upper_arm_R": "upperarm01.R",
    "foot_L": "foot.L",
    "foot_R": "foot.R",
    "shin_L": "lowerleg01.L",
    "shin_R": "lowerleg01.R",
    "thigh_L": "upperleg01.L",
    "thigh_R": "upperleg01.R",
}

_cache = {}


def portrait_id(sheet_pid):
    """The portrait id for a figure (character ids, `player-look-N`; a
    later chapter's namesake is `<id>.<chapter>` in both, except that the
    first chapter to use a name keeps it plain for its portrait)."""
    if sheet_pid.startswith("player-") or "." not in sheet_pid:
        return sheet_pid
    cid, chapter = sheet_pid.split(".", 1)
    try:
        data = json.load(open(PORTRAIT_PEOPLE))
    except OSError:
        return sheet_pid
    for c in data.get("characters", []):
        if c.get("character") == cid and c.get("chapter") == chapter:
            return c["id"]
    return sheet_pid


def skin_gain(pid):
    try:
        checks = json.load(open(CHECKS))
    except OSError:
        checks = {}
    g = checks.get(pid, {}).get("skin", {}).get("gain")
    if g:
        return np.array(g, F)
    gains = [v["skin"]["gain"] for v in checks.values() if isinstance(v, dict) and v.get("skin", {}).get("gain")]
    return np.array(np.median(np.array(gains), 0) if gains else (0.75, 0.8, 0.8), F)


def _smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _vertex_normals(co, quads):
    a, b, c, d = co[quads[:, 0]], co[quads[:, 1]], co[quads[:, 2]], co[quads[:, 3]]
    fn = np.cross(c - a, d - b)
    N = np.zeros_like(co)
    for k in range(4):
        np.add.at(N, quads[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)


class Look:
    """Everything about a person's body that doesn't depend on the sheet
    (cached per person): the body, the skin's maps, where hair and beard grow."""

    def __init__(self, pid, appearance, player, chapter):
        self.ident = wb.Identity(pid, appearance, player=player, chapter=chapter)
        P = self.ident.P
        self.body = wb.Body(self.ident)
        base = mh.Base.get()
        n = len(base.co)
        head = portrait_mhhead.MHHead(P, "neutral")
        _, Vr, Q, _, used = head.skin_mesh()
        cav, _ = portrait_mhskin.occlusion(Vr, Q)
        cav_far, _ = portrait_mhskin.occlusion(Vr, Q, rays=16, reach=40.0)
        maps = portrait_mhskin.maps(head, Vr, used, cav, appearance["skin"], beard=appearance["beard"], cav_far=cav_far, Q=Q)
        hex_ = appearance["skin"]
        dk = portrait_mhskin.darkness(hex_)
        lin = np.array(common.hex_rgb(hex_)[:3], F)
        lum = float((lin * np.array([0.2126, 0.7152, 0.0722], F)).sum())
        grey = 0.14 + 0.1 * dk
        body_alb = lin * (1 - grey) + lum * grey
        alb = np.tile(body_alb, (n, 1)).astype(F)
        # Hands, forearms and feet: the sun's colour on anyone who works outdoors.
        co = self.body.co
        tan = body_alb * np.array([0.9, 0.82, 0.76], F)
        alb = alb * (1 - 0.3 * P.sun) + tan * 0.3 * P.sun
        alb[used] = maps["albedo"]
        # The eyebrows, darkened with the hair's colour.
        hair_hex = appearance["hair"]
        hair_lin = np.array(common.hex_rgb(self.hair_colour(hair_hex, P.grey * 0.7))[:3], F)
        brow = portrait_hair.brow_mask(head, Vr)
        alb[used] = alb[used] * (1 - 0.8 * brow[:, None]) + hair_lin * 0.8 * brow[:, None]
        self.albedo = np.clip(alb * skin_gain(portrait_id(pid))[None, :], 0, 1).astype(F)
        self.dark = dk
        # Where hair grows (0-1), on the whole base mesh.
        self.scalp = np.zeros(n, F)
        self.scalp[used] = portrait_hair.scalp_mask(head, Vr, P.head_style)
        self.beard = np.zeros(n, F)
        self.below_mouth = np.zeros(n, F)
        if appearance["beard"]:
            self.beard[used] = portrait_mhskin.beard_mask(head, Vr, used)
            st = head.rest["stomion"]
            self.below_mouth[used] = _smooth(st[2] - Vr[:, 2], 0.0, 4.0)
        body_q = base.quads[base.faces_of("body")]
        self.normals = _vertex_normals(co, body_q)
        _ = cav


def look_for(pid, appearance, player=False, chapter=""):
    key = (pid, json.dumps(appearance, sort_keys=True), player, chapter)
    if key not in _cache:
        _cache[key] = Look(pid, appearance, player, chapter)
    return _cache[key]


Look.hair_colour = staticmethod(lambda hexcol, grey: M._toward(hexcol, "#c9c4bb", min(1.0, grey)))


class Piece:
    """An object of the figure, as build_people.py sees it."""

    def __init__(self, obj, mark=None):
        self.obj = obj
        self.mark = mark


# ── Materials ─────────────────────────────────────────────────────────────
def skin_material(key, dark):
    def build():
        n = M.Nodes(f"wskin-{key}")
        alb = n.new("ShaderNodeAttribute", _attribute_name="albedo")
        rest = n.new("ShaderNodeAttribute", _attribute_name="rest")
        mott = n.noise(60.0, 3.0, 0.6, (rest, "Vector"))
        mr = n.new("ShaderNodeMapRange", Value=(mott, "Fac"), **{"From Min": 0.3, "From Max": 0.7, "To Min": 0.94, "To Max": 1.05})
        col = n.new("ShaderNodeVectorMath", _operation="SCALE", Vector=(alb, "Vector"), Scale=(mr, "Result"))
        portrait_materials._principled(n, "RANDOM_WALK_SKIN",
            **{
                "Base Color": (col, "Vector"),
                "Roughness": 0.5,
                "Subsurface Weight": 1.0 - 0.4 * dark,
                "Subsurface Radius": (1.0, 0.37, 0.19),
                "Subsurface Scale": 0.003 * (1 - 0.45 * dark),
                "Subsurface IOR": 1.4,
                "Specular IOR Level": 0.5,
                "Sheen Weight": 0.2,
                "Sheen Roughness": 0.35,
                "Sheen Tint": (1.0, 0.94, 0.88, 1.0),
            }
        )
        return n.mat

    return M.cached(("wskin", key), build)


def eye_material():
    def build():
        n = M.Nodes("weye")
        c = n.new("ShaderNodeAttribute", _attribute_name="eye")
        n.bsdf(**{"Base Color": (c, "Color"), "Roughness": 0.12, "Coat Weight": 0.6, "Coat Roughness": 0.02, "Specular IOR Level": 0.6})
        return n.mat

    return M.cached(("weye",), build)


def hair_material(hexcol, grey, name="hair"):
    col = Look.hair_colour(hexcol, grey)

    def build():
        n = M.Nodes(f"whair-{name}-{col}")
        rest = n.new("ShaderNodeAttribute", _attribute_name="rest")
        strands = n.new("ShaderNodeTexWave", Scale=160.0, Distortion=9.0, Detail=4.0, Vector=(rest, "Vector"), _bands_direction="Z")
        clump = n.noise(45.0, 3.0, 0.6, (rest, "Vector"))
        mixf = n.math("MULTIPLY", (strands, "Fac"), (clump, "Fac"))
        c = n.mix((mixf, "Value"), M.shade(col, -0.3), M.shade(col, 0.2))
        bump = n.bump((mixf, "Value"), strength=0.5, distance=0.003)
        n.bsdf(**{"Base Color": (c, 2), "Roughness": 0.55, "Specular IOR Level": 0.4, "Sheen Weight": 0.3, "Sheen Tint": (c, 2), "Normal": (bump, "Normal")})
        return n.mat

    return M.cached(("whair", col, name), build)


def _mesh(name, co, faces, col, material=None, extra=()):
    """A mesh from vertices and quads (an array), plus any `extra` faces of
    other sizes (lists of vertex indices: a cap closing a ring)."""
    me = bpy.data.meshes.new(name)
    faces = [list(map(int, f)) for f in np.asarray(faces, np.int64)] + [list(map(int, f)) for f in extra]
    me.vertices.add(len(co))
    me.vertices.foreach_set("co", np.asarray(co, F).ravel())
    sizes = np.array([len(f) for f in faces], np.int32)
    me.loops.add(int(sizes.sum()))
    me.loops.foreach_set("vertex_index", np.concatenate([np.array(f, np.int32) for f in faces]))
    me.polygons.add(len(faces))
    me.polygons.foreach_set("loop_start", np.concatenate([[0], np.cumsum(sizes)[:-1]]).astype(np.int32))
    me.update(calc_edges=True)
    me.polygons.foreach_set("use_smooth", np.ones(len(faces), bool))
    obj = bpy.data.objects.new(name, me)
    if material is not None:
        me.materials.append(material)
    col.objects.link(obj)
    return obj


def set_attr(obj, name, values):
    values = np.asarray(values, F)
    me = obj.data
    if values.ndim == 1:
        a = me.attributes.get(name) or me.attributes.new(name, "FLOAT", "POINT")
        a.data.foreach_set("value", values)
    elif values.shape[1] == 3 and name == "rest":
        a = me.attributes.get(name) or me.attributes.new(name, "FLOAT_VECTOR", "POINT")
        a.data.foreach_set("vector", values.ravel())
    else:
        if values.shape[1] == 3:
            values = np.concatenate([values, np.ones((len(values), 1), F)], 1)
        a = me.attributes.get(name) or me.attributes.new(name, "FLOAT_COLOR", "POINT")
        a.data.foreach_set("color", values.ravel())


# ── The rig ───────────────────────────────────────────────────────────────
class Rig:
    """The armature (a child of `root`, which turns the whole figure), and
    helpers to bind meshes to it and pose it."""

    def __init__(self, body, col, name):
        self.body = body
        sk = body.sk
        self.sk = sk
        self.root = bpy.data.objects.new(f"{name}-root", None)
        col.objects.link(self.root)
        data = bpy.data.armatures.new(f"{name}-rig")
        arm = bpy.data.objects.new(f"{name}-rig", data)
        col.objects.link(arm)
        arm.parent = self.root
        self.arm = arm
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode="EDIT")
        ebs = []
        for i, n in enumerate(sk.names):
            eb = data.edit_bones.new(n)
            h = body.heads[i]
            t = body.tails[i]
            if np.linalg.norm(t - h) < 1e-4:
                t = h + np.array([0, 0, 0.01])
            eb.head = Vector(h.tolist())
            eb.tail = Vector(t.tolist())
            eb.roll = 0.0
            eb.use_deform = bool(sk.deform[i])
            ebs.append(eb)
        for i, p in enumerate(sk.parent):
            if p >= 0:
                ebs[i].parent = ebs[p]
                ebs[i].use_connect = False
        bpy.ops.object.mode_set(mode="OBJECT")
        self.B = {n: np.array(data.bones[n].matrix_local) for n in sk.names}
        self.Binv = {n: np.linalg.inv(m) for n, m in self.B.items()}

    def bind(self, obj, weights, names=None):
        """Vertex groups from a (vertices × bones) weight matrix, and an
        armature modifier; `obj` is parented to the root."""
        names = names or self.sk.names
        for b in np.nonzero(weights.sum(0) > 1e-6)[0]:
            g = obj.vertex_groups.new(name=names[b])
            idx = np.nonzero(weights[:, b] > 1e-4)[0]
            for w in np.unique(np.round(weights[idx, b], 3)):
                sel = idx[np.round(weights[idx, b], 3) == w]
                g.add(sel.tolist(), float(w), "REPLACE")
        mod = obj.modifiers.new("rig", "ARMATURE")
        mod.object = self.arm
        mod.use_deform_preserve_volume = False
        obj.parent = self.root
        return mod

    def bind_rigid(self, obj, bone):
        g = obj.vertex_groups.new(name=bone)
        g.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
        mod = obj.modifiers.new("rig", "ARMATURE")
        mod.object = self.arm
        obj.parent = self.root

    def set_pose(self, rots, root):
        """Pose bones from world_motion rotations (character axes about each
        rest head, in the parent's frame) and a root transform."""
        heads = self.body.heads
        for i, n in enumerate(self.sk.names):
            pb = self.arm.pose.bones[n]
            L = np.eye(4)
            if n in rots:
                L = wb.local(heads[i], rots[n])
            if self.sk.parent[i] < 0:
                L = root @ L
            pb.matrix_basis = Matrix((self.Binv[n] @ L @ self.B[n]).tolist())

    def key(self, frame):
        for pb in self.arm.pose.bones:
            pb.keyframe_insert("location", frame=frame)
            pb.keyframe_insert("rotation_quaternion", frame=frame)


# ── The person ────────────────────────────────────────────────────────────
class Person(people.Person):
    """A world figure (see the module docstring)."""

    def __init__(self, appearance, marks=(), rag="#3e6b73", name="person", pid=None, player=False, chapter="", rest=None):
        self.a = appearance
        self.marks = set(marks)
        self.rag = rag
        # The pose of the sheet being made (None standing, "sit", "lie"): a
        # borrowed cloak is worn round the shoulders, or laid over someone lying.
        self.rest = rest
        self.name = name
        self.col = common.collection(name)
        pid = pid or name
        self.look = look_for(portrait_id(pid), appearance, player, chapter)
        body = self.look.body
        self.bodyd = body
        self.J = {k: Vector(np.asarray(v, float).tolist()) for k, v in body.J.items()}
        self.H = body.height
        self.head_h = 0.14 * self.H
        self.parts = []
        self.eyes = []
        self.mouth = None
        self.uprights = []
        self._rest_lift = {}
        self.lamp_light = None
        self.rig = Rig(body, self.col, name)
        self._body()
        self._hair()
        self.cloth = world_cloth.Wardrobe(self)
        # The things they carry and the story's marks (people.py), placed by
        # the same landmarks and bound to the matching bones.
        n_before = len(self.parts)
        cloak = "wrapped-in-cloak" in self.marks
        self.marks.discard("wrapped-in-cloak")
        self._carry()
        self._marks()
        if cloak:
            self.marks.add("wrapped-in-cloak")
        for part in self.parts[n_before:]:
            if part.bone == "chest" and any(k in part.obj.name for k in ("-tablet0", "-tablet1", "-tablet-cord", "-stylus")):
                # A scribe's tablets held against the chest: in front of it
                # (people.py placed them for a shallower chest).
                co = self.bodyd.co[mh.Base.get().verts_of("body")]
                ys = [v.co.y for v in part.obj.data.vertices]
                zs = [v.co.z for v in part.obj.data.vertices]
                near = co[(np.abs(co[:, 2] - float(np.mean(zs))) < 0.08) & (np.abs(co[:, 0]) < 0.12)]
                front = float(near[:, 1].min()) - 0.03
                shift = min(0.0, front - max(ys))
                for v in part.obj.data.vertices:
                    v.co.y += shift
                part.rest[:, 1] += shift
            if part.obj.name.endswith("-bundle"):
                # The bundle rests against the back (people.py placed it for a
                # thinner body): its front touches the shoulder blades.
                co = self.bodyd.co[mh.Base.get().verts_of("body")]
                z = float(self.J["chest"].z)
                back = float(co[np.abs(co[:, 2] - z) < 0.06, 1].max())
                ys = [v.co.y for v in part.obj.data.vertices]
                shift = back + 0.01 - min(ys)
                for v in part.obj.data.vertices:
                    v.co.y += shift
                part.rest[:, 1] += shift
            if part.upright is not None and part.obj.name.endswith(("-oar", "-oar-blade", "-staff")):
                # A tall person's oar or staff (sized to their height) would
                # rise out of the top of the frame (raised in the hand, and seen
                # from above, it stands higher still): kept under 1.52 m.
                # (Both pieces of an oar by the same measure: its blade's top.)
                top = (1.13 if "-oar" in part.obj.name else 1.02) * self.H
                limit = 1.52
                if top > limit:
                    k = limit / top
                    for v in part.obj.data.vertices:
                        v.co.z *= k
                    part.rest[:, 2] *= k
            if part.bone == "hand_R" and part.upright is None and any(k in part.obj.name for k in ("-tray", "-loaf", "-lamp")):
                # A tray of bread is carried level, a lamp's flame stands up:
                # they follow the hand but don't tilt with it.
                part.upright = tuple(self.J["hand_R"])
            # A drop spindle hangs straight down from its thread, however the hand turns.
            if part.obj.name.endswith(("-spindle", "-whorl")) and part.upright is None:
                part.upright = tuple(self.J["hand_R"])
        for part in self.parts[n_before:]:
            self._bind_part(part)
        self.cloth.build_marks()
        self._cloth_cache = {}

    # ── construction ──────────────────────────────────────────────────────
    def _body(self):
        base = mh.Base.get()
        body = self.bodyd
        faces = np.concatenate([base.faces_of("body"), base.faces_of("helper-l-eye", "helper-r-eye")])
        Q = base.quads[faces]
        used = np.unique(Q)
        remap = -np.ones(len(base.co), np.int64)
        remap[used] = np.arange(len(used))
        self.body_used = used
        obj = _mesh(f"{self.name}-body", body.co[used], remap[Q], self.col)
        obj.data.materials.append(skin_material(self.name, self.look.dark))
        obj.data.materials.append(eye_material())
        is_eye = np.isin(faces, base.faces_of("helper-l-eye", "helper-r-eye"))
        obj.data.polygons.foreach_set("material_index", is_eye.astype(np.int32))
        set_attr(obj, "albedo", self.look.albedo[used])
        set_attr(obj, "rest", body.co[used])
        # Eyes: the iris and pupil toward the front of each eyeball.
        eye = np.tile(np.array([0.4, 0.37, 0.34], F), (len(used), 1))
        iris = np.array(common.hex_rgb(self.look.ident.P.iris)[:3], F)
        for g in ("helper-l-eye", "helper-r-eye"):
            vi = base.verts_of(g)
            c = body.co[vi].mean(0)
            d = body.co[vi] - c
            d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
            fwd = -d[:, 1]
            col = np.where((fwd > 0.8)[:, None], iris[None, :], eye[remap[vi]])
            col = np.where((fwd > 0.97)[:, None], np.array([0.01, 0.008, 0.006], F)[None, :], col)
            eye[remap[vi]] = col
        set_attr(obj, "eye", eye)
        # Face shapes (blinking, talking) as shape keys.
        obj.shape_key_add(name="Basis")
        for k, off in body.shapes.items():
            sk = obj.shape_key_add(name=k)
            sk.data.foreach_set("co", (body.co[used] + off[used]).ravel())
        self.rig.bind(obj, self.bodyd.sk.W[used])
        self.body_obj = obj
        self.parts.append(Piece(obj))

    def _hair(self):
        """Hair and beard: shells over the scalp and jaw where the portrait's
        grow, as thick as the cut (a close crop, curls, a long beard)."""
        base = mh.Base.get()
        body = self.bodyd
        P = self.look.ident.P
        a = self.a
        co = body.co
        N = self.look.normals
        bq = base.quads[base.faces_of("body")]
        rng = np.random.default_rng(P.seed + 5)
        self.shells = {}
        specs = []
        thick = {"curly": 0.016, "crop": 0.006, "wavy": 0.02, "straight": 0.017}.get(P.hair_cut, 0.015)
        if P.hair_style == "long":
            thick = 0.018
        if P.hair_style == "child":
            thick = 0.012 + 0.008 * P.hair_curl
        specs.append(("hair", self.look.scalp, thick, 0.0, P.grey))
        if a["beard"]:
            L = P.beard_length / 100.0
            specs.append(("beard", self.look.beard, min(L, 0.022) * 0.8 + 0.003, max(0.0, L - 0.02) * 0.8, min(1.0, P.grey * 1.15)))
        for name, mask, t, drop, grey in specs:
            m = mask
            keep = (m[bq] > 0.12).all(1) | ((m[bq] > 0.05).all(1) & (m[bq].mean(1) > 0.3))
            if not keep.any():
                continue
            Q = bq[keep]
            used = np.unique(Q)
            remap = -np.ones(len(co), np.int64)
            remap[used] = np.arange(len(used))
            w = _smooth(m[used], 0.05, 0.6)
            # Curls and clumps: the surface rises and falls a little.
            lump = 1.0 + 0.35 * np.sin(co[used, 0] * 170 + rng.uniform(0, 6)) * np.sin(co[used, 2] * 150 + rng.uniform(0, 6))
            off = N[used] * (0.0015 + t * w * lump)[:, None]
            if drop > 0:
                off[:, 2] -= drop * w * self.look.below_mouth[used]
                off[:, 1] -= 0.3 * drop * w * self.look.below_mouth[used]
            V = co[used] + off
            self.shells[name] = (used, V)
            obj = _mesh(f"{self.name}-{name}", V, remap[Q], self.col, hair_material(a["hair"], grey, name))
            set_attr(obj, "rest", V)
            common.add_modifier(obj, "SOLIDIFY", thickness=0.002, offset=-1.0)
            self.rig.bind(obj, body.sk.W[used])
            # (Solidify after the armature.)
            obj.modifiers.move(obj.modifiers.find("solidify"), len(obj.modifiers) - 1)
            self.parts.append(Piece(obj))

    def _bind_part(self, part):
        """A people.py prop or mark: rigid on its bone (or upright: it follows
        the hand but stays upright, as a planted staff)."""
        obj = part.obj
        if part.upright is not None:
            obj.parent = self.rig.root
            self.uprights.append(part)
        elif part.bone is not None:
            self.rig.bind_rigid(obj, BONE_MAP[part.bone])
        elif part.weights is not None:
            # Skinned by the old skeleton's weights: bind to the nearest bones instead.
            self.rig.bind_rigid(obj, "spine02")

    # ── posing ────────────────────────────────────────────────────────────
    def rotations(self, walk=None, breath=0.0, talk=0, rest=None):
        carry = self.a.get("carry", "none")
        busy = carry in ("staff", "spindle", "bread", "lamp", "tablet", "lamb", "oar")
        hand = "L" if busy else "R"
        R, root = world_motion.pose(walk, breath, talk, hand=hand, rest=rest, carry=carry, J=self.bodyd.J, height=self.H, stride=1.0 if float(self.bodyd.J["hip_L"][2]) <= 0.88 else 0.8)
        R = world_motion.carry_pose(R, carry if rest is None or carry == "lamb" else "none", rest, breath)
        if rest == "sit":
            # Cross-legged: the thighs out and forward, lying low, each shin
            # folded across in front of the body, the right ankle under the
            # left knee (aimed in character space, so any body sits so).
            sk, heads = self.bodyd.sk, self.bodyd.heads
            for side, sgn, drop in (("L", 1.0, 0.0), ("R", -1.0, 0.06)):
                R.pop(f"lowerleg01.{side}", None)
                wb.aim(sk, heads, R, f"upperleg01.{side}", f"lowerleg01.{side}", (sgn * 0.78, -0.6, -0.2 - drop))
                wb.aim(sk, heads, R, f"lowerleg01.{side}", f"foot.{side}", (-sgn * 0.93, 0.28 + drop, -0.12 - drop))
                R[f"foot.{side}"] = wb.rot(x=10.0, y=sgn * 30.0)
        if rest is None:
            D = wb.forward(self.bodyd.sk, self.bodyd.heads, R, root)
            root = world_motion._T(0, 0, -self._lowest(D)) @ root
        else:
            # Sitting or lying: the lowest point of the body just above the
            # ground (the tunic lies under it), found once for the pose.
            if rest not in self._rest_lift:
                D = wb.forward(self.bodyd.sk, self.bodyd.heads, R, root)
                body = mh.Base.get().verts_of("body")[::3]
                pts = wb.skin(self.bodyd.co[body], self.bodyd.sk.W[body], D)
                self._rest_lift[rest] = 0.012 - float(pts[:, 2].min())
            root = world_motion._T(0, 0, self._rest_lift[rest]) @ root
        return R, root

    def _lowest(self, D):
        """The lowest point of either sole in a pose."""
        if not hasattr(self, "_soles"):
            co = self.bodyd.co
            body = mh.Base.get().verts_of("body")
            self._soles = body[co[body, 2] < 0.012]
        idx = self._soles
        pts = wb.skin(self.bodyd.co[idx], self.bodyd.sk.W[idx], D)
        # (The sandal's sole is under the foot.)
        return float(pts[:, 2].min()) - 0.006

    def pose(self, walk=None, breath=0.0, blink=False, talk=0, yaw=0.0, rest=None):
        R, root = self.rotations(walk, breath, talk, rest)
        self.rig.set_pose(R, root)
        keys = self.body_obj.data.shape_keys.key_blocks
        keys["blink"].value = 1.0 if blink else 0.0
        keys["talk"].value = 1.0 if talk == 1 else 0.0
        keys["talk2"].value = 1.0 if talk == 2 else 0.0
        self.rig.root.rotation_euler = (0.0, 0.0, yaw)
        D = wb.forward(self.bodyd.sk, self.bodyd.heads, R, root)
        idx = self.bodyd.sk.index
        for part in self.uprights:
            grip = np.array(part.upright, float)
            m = D[idx[BONE_MAP[part.bone]]]
            moved = (m @ np.append(grip, 1.0))[:3]
            part.obj.matrix_basis = Matrix.Translation(Vector((moved - grip).tolist()))
        lamp = getattr(self, "lamp_light", None)
        if lamp is not None:
            light, at = lamp
            light.parent = self.rig.root
            m = D[idx["wrist.R"]]
            light.location = Vector((m @ np.append(np.asarray(at, float), 1.0))[:3].tolist())
        self.cloth.show(dict(walk=walk, breath=breath, talk=talk, rest=rest))
        bpy.context.view_layer.update()

    def prepare(self, specs):
        """Simulate the clothes for every frame about to be rendered."""
        self.cloth.simulate(specs)
