"""A world figure's body: MakeHuman's model (makehuman.py) shaped as the
person's portrait is (portrait_face.identity: the same sex, age, build,
face and resting mood), rigged with MakeHuman's default skeleton and its
skin weights (CC0 data; docs/adr/0017-makehuman-bodies-for-world-figures.md),
and stood up in a natural standing pose.

Character space (as tools/art/lib/people.py): Blender units (1 tile, about
a metre), the person facing -Y (south, toward the camera), +X the person's
LEFT, +Z up, the soles on z = 0.

MakeHuman's base mesh stands in an A-pose (arms out and down, forearms
bent, feet apart). The body is re-posed once, in numpy, into a relaxed
standing pose, and that becomes the rest pose of the Blender armature
built here; every frame is a pose relative to it. Rotations are authored
about the character's own axes at each joint (a limb swung forward is a
negative rotation about X, a knee bent a positive one), and turned into
each pose bone's local rotation (`Rig.set_pose`).
"""
import json
import math

import numpy as np

import makehuman as mh
import portrait_face
import portrait_params

F = np.float32
# MakeHuman (decimetres, Y up, face +Z) to character space (metres, Z up, face -Y).
_R = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], F)


def to_char(co):
    return (np.asarray(co, F) @ _R.T) * F(0.1)


# ── The skeleton and its weights ───────────────────────────────────────────
class Skeleton:
    """MakeHuman's default skeleton: bones parent-first, the joints that
    place each bone's head and tail, and normalised skin weights (a dense
    vertex × bone matrix over the whole base mesh)."""

    _one = None

    @classmethod
    def get(cls):
        if cls._one is None:
            cls._one = Skeleton()
        return cls._one

    def __init__(self):
        s = json.load(open(mh.path("rigs/default.mhskel")))
        w = json.load(open(mh.path("rigs/default_weights.mhw")))["weights"]
        bones = s["bones"]
        order = []
        seen = set()

        def visit(n):
            if n in seen:
                return
            p = bones[n]["parent"]
            if p:
                visit(p)
            seen.add(n)
            order.append(n)

        for n in sorted(bones):
            visit(n)
        self.names = order
        self.index = {n: i for i, n in enumerate(order)}
        self.parent = [self.index[bones[n]["parent"]] if bones[n]["parent"] else -1 for n in order]
        self.joints = {k: np.array(v, np.int64) for k, v in s["joints"].items()}
        self.head_joint = [bones[n]["head"] for n in order]
        self.tail_joint = [bones[n]["tail"] for n in order]
        n_verts = len(mh.Base.get().co)
        W = np.zeros((n_verts, len(order)), F)
        for bone, pairs in w.items():
            if bone not in self.index:
                continue
            a = np.array(pairs, np.float64)
            W[a[:, 0].astype(np.int64), self.index[bone]] += a[:, 1].astype(F)
        W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
        self.W = W
        self.deform = W.sum(0) > 0

    def joint(self, name, co):
        return co[self.joints[name]].mean(0)

    def children(self, i):
        return [k for k, p in enumerate(self.parent) if p == i]


# ── Pose maths (character axes) ────────────────────────────────────────────
def rot(x=0.0, y=0.0, z=0.0):
    """A rotation (3×3), degrees about the character's X, then Y, then Z."""
    ax, ay, az = (math.radians(v) for v in (x, y, z))
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def between(a, b):
    """The shortest rotation (3×3) taking direction a to direction b."""
    a = np.asarray(a, float) / np.linalg.norm(a)
    b = np.asarray(b, float) / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(a @ b)
    if c < -0.9999:
        axis = np.cross(a, [1.0, 0, 0])
        if np.linalg.norm(axis) < 1e-6:
            axis = np.cross(a, [0, 1.0, 0])
        axis /= np.linalg.norm(axis)
        return 2 * np.outer(axis, axis) - np.eye(3)
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + k + k @ k / (1 + c)


def local(head, R):
    """4×4: rotate by R about the point `head`."""
    M = np.eye(4)
    M[:3, :3] = R
    M[:3, 3] = head - R @ head
    return M


def forward(sk, heads, rots, root=None):
    """Deformation matrices (4×4, rest → posed) for every bone, given local
    rotations {bone: 3×3} about each bone's rest head in the parent's frame,
    and an optional root transform applied to everything."""
    D = [None] * len(sk.names)
    for i, n in enumerate(sk.names):
        L = local(heads[i], rots[n]) if n in rots else np.eye(4)
        p = sk.parent[i]
        D[i] = (D[p] if p >= 0 else (root if root is not None else np.eye(4))) @ L
    return D


def skin(co, W, D):
    """Linear-blend skinning of `co` (N×3) by weights W (N×B) and matrices D."""
    out = np.zeros_like(co, dtype=np.float64)
    hom = np.hstack([co, np.ones((len(co), 1))])
    for b in np.nonzero(W.sum(0) > 1e-6)[0]:
        out += W[:, b : b + 1] * (hom @ D[b].T)[:, :3]
    return out.astype(F)


# ── The person ─────────────────────────────────────────────────────────────
class Identity:
    """Who a figure is: the portrait's parameters and MakeHuman weights."""

    def __init__(self, pid, appearance, player=False, chapter=""):
        self.pid = pid
        self.a = appearance
        self.P = portrait_params.params_for(pid, appearance, player=player, chapter=chapter)
        self.weights = portrait_face.identity(self.P)
        self.anc = portrait_face.ancestry(self.P)
        self.mood = portrait_face.expression("neutral", self.P)

    def units(self, units):
        return portrait_face.unit_weights(units, self.anc)


def _sum(*ws):
    out = {}
    for w in ws:
        for k, v in w.items():
            out[k] = out.get(k, 0.0) + v
    return out


# Shapes of the face a sheet shows besides the resting one (expression units).
FACE_SHAPES = {
    "blink": {"eye-left-closure": 1.0, "eye-right-closure": 1.0},
    "talk": {"mouth-open": 0.55, "mouth-parling": 0.2},
    "talk2": {"mouth-open": 0.3},
}


class Body:
    """The body in character space, stood up: vertices of the whole base
    mesh (`co`), the face shapes as offsets (`shapes`), the skeleton's rest
    heads and tails (`heads`, `tails`), and named landmarks (`J`)."""

    def __init__(self, ident):
        self.ident = ident
        sk = Skeleton.get()
        self.sk = sk
        model = mh.Model().add(ident.weights)
        rest_mh = model.coords(extra=ident.mood)
        base = to_char(rest_mh)
        shapes = {}
        for name, units in FACE_SHAPES.items():
            shapes[name] = to_char(model.coords(extra=_sum(ident.mood, ident.units(units)))) - base
        heads = np.array([sk.joint(j, base) for j in sk.head_joint], np.float64)
        tails = np.array([sk.joint(j, base) for j in sk.tail_joint], np.float64)
        # Stand up: legs under the hips, arms hanging, then soles on the ground.
        D = self._stand(sk, heads, tails)
        co = skin(base, sk.W, D)
        self.heads = np.array([(D[i] @ np.append(h, 1))[:3] for i, h in enumerate(heads)])
        self.tails = np.array([(D[i] @ np.append(t, 1))[:3] for i, t in enumerate(tails)])
        # The face shapes follow the head (which only moved rigidly).
        hd = D[sk.index["head"]][:3, :3]
        self.shapes = {k: (v @ hd.T).astype(F) for k, v in shapes.items()}
        body = mh.Base.get().verts_of("body")
        z0 = float(co[body, 2].min())
        co[:, 2] -= z0
        self.heads[:, 2] -= z0
        self.tails[:, 2] -= z0
        self.co = co
        self.height = float(co[body, 2].max())
        self.J = self._landmarks()

    def _stand(self, sk, heads, tails):
        """Deformation from MakeHuman's A-pose to a relaxed standing pose."""
        idx = sk.index
        rots = {}

        def aim(bone, end, target, D):
            i = idx[bone]
            p = sk.parent[i]
            Rp = D[p][:3, :3] if p >= 0 else np.eye(3)
            d = heads[idx[end]] - heads[i]
            rots[bone] = between(d, Rp.T @ np.asarray(target, float))

        for s, sx in (("L", 1.0), ("R", -1.0)):
            hip = heads[idx[f"upperleg01.{s}"]]
            knee = heads[idx[f"lowerleg01.{s}"]]
            ankle = heads[idx[f"foot.{s}"]]
            thigh = np.linalg.norm(knee - hip)
            shin = np.linalg.norm(ankle - knee)
            # Knees a little in, ankles under the hip joints' inside.
            kx = hip[0] * 0.93
            ax = hip[0] * 0.86
            D = forward(sk, heads, rots)
            aim(f"upperleg01.{s}", f"lowerleg01.{s}", (kx - hip[0], 0.0, -math.sqrt(max(1e-6, thigh**2 - (kx - hip[0]) ** 2))), D)
            D = forward(sk, heads, rots)
            aim(f"lowerleg01.{s}", f"foot.{s}", (ax - kx, 0.004, -math.sqrt(max(1e-6, shin**2 - (ax - kx) ** 2))), D)
            # The foot keeps its own direction (flat, toes out a little).
            D = forward(sk, heads, rots)
            i = idx[f"foot.{s}"]
            Rp = D[sk.parent[i]][:3, :3]
            rots[f"foot.{s}"] = Rp.T @ rot(z=sx * 6.0)
            # Arms hanging a little away from the body, elbows soft.
            D = forward(sk, heads, rots)
            sh = heads[idx[f"upperarm01.{s}"]]
            el = heads[idx[f"lowerarm01.{s}"]]
            aim(f"upperarm01.{s}", f"lowerarm01.{s}", (sx * 0.1, 0.035, -1.0), D)
            D = forward(sk, heads, rots)
            aim(f"lowerarm01.{s}", f"wrist.{s}", (sx * 0.03, -0.24, -1.0), D)
            # The hand in line with the forearm, palm toward the thigh.
            i = idx[f"wrist.{s}"]
            rots[f"wrist.{s}"] = between(tails[i] - heads[i], heads[i] - heads[idx[f"lowerarm01.{s}"]])
            _ = (sh, el)
        return forward(sk, heads, rots)

    def _landmarks(self):
        """The joints tools/art/lib/people.py placed things by (hands,
        shoulders, hips...), from the skeleton, in character space."""
        i = self.sk.index
        h = self.heads
        t = self.tails
        body = mh.Base.get().verts_of("body")
        J = {
            "pelvis": h[i["spine05"]],
            "waist": h[i["spine03"]],
            "chest": h[i["spine01"]],
            "neck": h[i["neck01"]],
            "head": h[i["head"]],
            "crown": np.array([0.0, h[i["head"]][1], self.height]),
        }
        for s, side in (("L", "L"), ("R", "R")):
            J[f"shoulder_{side}"] = h[i[f"upperarm01.{s}"]]
            J[f"elbow_{side}"] = h[i[f"lowerarm01.{s}"]]
            J[f"wrist_{side}"] = h[i[f"wrist.{s}"]]
            # The palm's middle: between the wrist and the knuckles.
            J[f"hand_{side}"] = (h[i[f"wrist.{s}"]] + h[i[f"finger3-1.{s}"]]) / 2
            J[f"hip_{side}"] = h[i[f"upperleg01.{s}"]]
            J[f"knee_{side}"] = h[i[f"lowerleg01.{s}"]]
            J[f"ankle_{side}"] = h[i[f"foot.{s}"]]
            J[f"toe_{side}"] = t[i[f"toe3-1.{s}"]]
        _ = body
        return J
