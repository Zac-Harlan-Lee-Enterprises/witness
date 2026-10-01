"""The man lying in the shade of the rocks (teaser shot 7), as a real body
under real cloth rather than the game's small figure.

His body is MakeHuman's CC0 base mesh (the same approved source as the
portraits' heads: docs/adr/0016-makehuman-base-for-portraits.md), shaped
by its macro targets as a lean man in his thirties and posed here, without
MakeHuman's code: laid on his back, arms fallen to the ground, feet rolled
outward, head turned away toward the rock. The pose is a few joint
rotations blended smoothly over the body (`_pose`).

His tunic is cloth, simulated: a tube of wool round his body from the
armpits to below the knees falls under gravity onto him and the ground
(Blender's cloth solver, colliding with his body and the dust), then is
frozen, so its folds are the folds that cloth makes. A shell over his
shoulders and short sleeves (offset from his skin) complete it. Brown wool
with blue clavi, as the game dresses him (appearance `robe`, `accent`);
the strip torn from it is on the thornbush by the road.

Units: MakeHuman's decimetres (x the person's left, y up, z front) are
turned into metres of the set when he is laid down.
"""
import math
import random

import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import makehuman as MH
import teaser_city as C
from teaser_nodes import Graph

F = np.float64


# ── materials ────────────────────────────────────────────────────────────────
def skin(name, color):
    """Sun-darkened skin with the road's dust on it, a little blood-dark
    bruising and scraping on the shins and forearms (never gore)."""

    def build():
        g = Graph(name)
        pos = g.coords("Object")
        base = g.mix(g.map(g.noise(pos, 12.0, 4.0), 0.3, 0.7), g.hsv(color, 0.5, 1.0, 0.9), g.hsv(color, 0.5, 1.05, 1.08))
        mottle = g.smooth(g.noise(pos, 30.0, 3.0), 0.55, 0.7)
        col = g.mix(g.mul(mottle, 0.25), base, g.hsv(color, 0.49, 1.1, 0.8))
        dust = g.smooth(g.noise(g.vmath("ADD", pos, (4.0, 1.0, 2.0)), 8.0, 4.0, 0.6), 0.45, 0.7)
        col = g.mix(g.mul(dust, 0.45), col, "#b39c80")
        bruise = g.smooth(g.noise(g.vmath("ADD", pos, (9.0, 3.0, 5.0)), 5.0, 3.0), 0.66, 0.74)
        col = g.mix(g.mul(bruise, 0.35), col, "#4a2e2a")
        g.principled(col, 0.55, 0.35, g.bump(g.noise(pos, 400.0, 3.0), 0.12, 0.0004), **{"Subsurface Weight": 0.18, "Subsurface Radius": (1.0, 0.45, 0.25), "Subsurface Scale": 0.006})
        return g.mat

    return C._cached(name, build)


def hair(name, color):
    def build():
        g = Graph(name)
        pos = g.coords("Object")
        strands = g.noise(g.vmath("MULTIPLY", pos, (40.0, 40.0, 400.0)), 1.0, 4.0, 0.6)
        col = g.mix(g.map(strands, 0.3, 0.7), g.hsv(color, 0.5, 1.0, 0.7), g.hsv(color, 0.5, 1.0, 1.5))
        col = g.mix(g.mul(g.smooth(g.noise(pos, 20.0, 3.0), 0.5, 0.7), 0.4), col, "#8f7c64")
        g.principled(col, 0.5, 0.45, g.bump(strands, 0.6, 0.002))
        return g.mat

    return C._cached(name, build)


def wool(name, color, accent):
    """Coarse brown wool, worn and dusty, a darker damp stain, and two blue
    clavi down the front and back (point attribute `restx`: the cloth's
    distance across his body, in decimetres, before it fell)."""

    def build():
        g = Graph(name)
        pos = g.coords("Object")
        restx = g.math("ABSOLUTE", g.attr("restx"))
        col = g.mix(g.map(g.noise(pos, 7.0, 4.0), 0.3, 0.7), g.hsv(color, 0.5, 1.0, 0.85), g.hsv(color, 0.5, 0.95, 1.1))
        stripe = g.mul(g.smooth(restx, 0.45, 0.5), g.smooth(restx, 0.85, 0.8))
        # Woad on wool, faded by sun and washing.
        col = g.mix(g.mul(stripe, 0.85), col, g.hsv(accent, 0.5, 0.5, 0.45))
        weave = g.wave(g.vmath("MULTIPLY", pos, (1.0, 1.0, 1.0)), 900.0, 2.0, 1.0, "BANDS", "Z")
        col = g.mix(g.mul(g.map(weave, 0.3, 1.0), 0.12), col, "#2e241a", "MULTIPLY")
        dust = g.smooth(g.noise(g.vmath("ADD", pos, (2.0, 5.0, 1.0)), 5.0, 4.0, 0.6), 0.45, 0.72)
        col = g.mix(g.mul(dust, 0.22), col, "#9c8a6e")
        stain = g.smooth(g.noise(g.vmath("ADD", pos, (7.0, 1.0, 3.0)), 3.0, 3.0), 0.64, 0.7)
        col = g.mix(g.mul(stain, 0.5), col, "#3a2a20")
        fuzz = g.noise(pos, 300.0, 4.0, 0.7)
        g.principled(col, 0.95, 0.25, g.bump(g.add(g.mul(weave, 0.5), fuzz), 0.3, 0.0012), **{"Sheen Weight": 0.15, "Sheen Roughness": 0.6, "Sheen Tint": (0.7, 0.6, 0.5, 1.0)})
        return g.mat

    return C._cached(name, build)


# ── the body ────────────────────────────────────────────────────────────────
def _smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _rot(axis, angle):
    return np.array(Matrix.Rotation(angle, 3, Vector(axis).normalized()), F)


def _turn(co, w, pivot, R):
    """Blend each point toward its rotation about `pivot` by R, by weight w."""
    moved = (co - pivot) @ R.T + pivot
    return co + (moved - co) * w[:, None]


class Pose:
    """Joint rotations blended over the body, from MakeHuman's joint markers."""

    def __init__(self, base, co):
        self.base = base
        self.rest = co
        self.J = {n: base.joint(n, co).astype(F) for n in ("neck", "head", "l-shoulder", "r-shoulder", "l-elbow", "r-elbow", "l-hand", "r-hand", "l-knee", "r-knee", "l-ankle", "r-ankle", "pelvis", "spine-1")}
        for s in ("l", "r"):
            self.J[f"{s}-hip"] = base.joint(f"{s}-upper-leg", co).astype(F)

    def weights(self, co):
        """Per-point weights of each limb (from the rest positions)."""
        J = self.J
        x, y, z = co[:, 0], co[:, 1], co[:, 2]
        w = {}
        for s, sx in (("l", 1.0), ("r", -1.0)):
            sh, el = J[f"{s}-shoulder"], J[f"{s}-elbow"]
            arm_dir = (el - sh) / np.linalg.norm(el - sh)
            along = (co - sh) @ arm_dir
            # The arm: outboard of the armpit, blending across the shoulder.
            side = sx * x
            # Only near the arm itself (within a hand's breadth of the line from
            # shoulder to fingertips): the line runs on past the hand to the legs.
            hand = J[f"{s}-hand"]
            seg = hand - sh
            tt = np.clip((co - sh) @ seg / (seg @ seg), 0.0, 2.0)
            near = np.maximum(_smooth(1.7, 1.1, np.linalg.norm(co - (sh + tt[:, None] * seg), axis=1)), (side > 2.4) * _smooth(0.6, 1.0, y))
            w[f"{s}-arm"] = _smooth(-0.35, 0.25, along) * _smooth(sh[0] * sx - 0.55, sh[0] * sx - 0.1, side) * near
            fa_dir = (J[f"{s}-hand"] - el) / np.linalg.norm(J[f"{s}-hand"] - el)
            w[f"{s}-forearm"] = _smooth(-0.3, 0.3, (co - el) @ fa_dir) * w[f"{s}-arm"]
            hip, kn, an = J[f"{s}-hip"], J[f"{s}-knee"], J[f"{s}-ankle"]
            w[f"{s}-leg"] = _smooth(hip[1] + 0.2, hip[1] - 0.8, y) * _smooth(-0.25, 0.25, side)
            w[f"{s}-foot"] = _smooth(an[1] + 0.35, an[1] - 0.1, y) * (side > 0)
        hd = J["neck"]
        w["head"] = _smooth(hd[1] - 0.15, hd[1] + 0.45, y)
        _ = z
        return w

    def apply(self, co, w, arm_fall=0.9, elbow=0.0, foot_out=0.3, foot_point=0.15, head_turn=1.35, arm_out=0.12, adduct=0.09):
        """The pose of a man fallen on his back, arms fallen to the ground,
        feet rolled out, head turned (toward his left: +x)."""
        J = self.J
        out = co.copy()
        for s, sx in (("l", 1.0), ("r", -1.0)):
            sh, el, hand = J[f"{s}-shoulder"], J[f"{s}-elbow"], J[f"{s}-hand"]
            # The arm falls back to the ground (toward -z, round the body's
            # long axis at the shoulder) and a little out from the side.
            # Not quite symmetrical: his left arm flung wider and bent more.
            spread = arm_out * (1.8 if sx > 0 else 0.5)
            bend = elbow * (2.6 if sx > 0 else 0.6)
            R1 = _rot((0.0, 1.0, 0.0), sx * arm_fall) @ _rot((0.0, 0.0, 1.0), sx * spread)
            out = _turn(out, w[f"{s}-arm"], sh, R1)
            el2 = (el - sh) @ R1.T + sh
            fa = (hand - el) @ R1.T
            axis = np.cross(fa, np.array([0.0, 0.0, 1.0]))
            R2 = _rot(axis, -bend)
            out = _turn(out, w[f"{s}-forearm"], el2, R2)
            # The leg rolls outward on its long axis; the foot falls outward
            # and its toes point away (a limp foot on its heel).
            hip, an = J[f"{s}-hip"], J[f"{s}-ankle"]
            # The legs a little closer together than MakeHuman's stance.
            R0 = _rot((0.0, 0.0, 1.0), -sx * adduct)
            out = _turn(out, w[f"{s}-leg"], hip, R0)
            an = (an - hip) @ R0.T + hip
            leg_axis = an - hip
            R3 = _rot(leg_axis, sx * foot_out)
            out = _turn(out, w[f"{s}-leg"] * 0.6 + w[f"{s}-foot"] * 0.4, hip, R3)
            an2 = (an - hip) @ R3.T + hip
            R4 = _rot((1.0, 0.0, 0.0), foot_point)
            out = _turn(out, w[f"{s}-foot"], an2, R4)
        # The head turned toward his left shoulder, tipped a little back.
        R5 = _rot((0.0, 1.0, 0.0), head_turn) @ _rot((1.0, 0.0, 0.0), -0.15)
        out = _turn(out, w["head"], J["neck"], R5)
        return out


def _mesh(name, co, faces, material, attrs=None, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in co], [], [tuple(f) for f in faces])
    me.update()
    for p in me.polygons:
        p.use_smooth = smooth
    for k, v in (attrs or {}).items():
        a = me.attributes.new(k, "FLOAT", "POINT")
        a.data.foreach_set("value", np.asarray(v, dtype=np.float32))
    if material is not None:
        me.materials.append(material)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _vertex_normals(co, faces):
    n = np.zeros_like(co)
    for f in (faces[:, [0, 1, 2]], faces[:, [0, 2, 3]]):
        a, b, c = co[f[:, 0]], co[f[:, 1]], co[f[:, 2]]
        fn = np.cross(b - a, c - a)
        for k in range(3):
            np.add.at(n, f[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


class LyingMan:
    """A man lying on his back at `at` (a point on the ground), his head
    toward angle `theta` (radians from +x); `ground(x, y)` gives the height
    of the ground under him."""

    def __init__(self, appearance, name="man", seed=11, preview=False):
        self.appearance = appearance
        self.name = name
        self.rng = random.Random(seed)
        self.preview = preview
        self.objects = []

    def build(self, at, theta, ground):
        a = self.appearance
        MH.verify()
        model = MH.Model()
        model.add(MH.macro_weights(1.0, 36.0, muscle=0.55, weight=0.32, ancestry={"caucasian": 0.45, "african": 0.25, "asian": 0.3}))
        base = model.base
        rest = model.coords().astype(F)
        pose = Pose(base, rest)
        body_f = base.quads[base.faces_of("body")]
        eye_f = base.quads[base.faces_of("helper-l-eye", "helper-r-eye")]
        w = pose.weights(rest)
        posed = pose.apply(rest, w)
        # Laid down: MakeHuman's front (z) up, its up (y) toward theta.
        h = np.array([math.cos(theta), math.sin(theta), 0.0])
        up = np.array([0.0, 0.0, 1.0])
        left = np.cross(h, up)
        M3 = np.stack([left, h, up], axis=1) * 0.1
        world = posed @ M3.T
        used = np.unique(body_f.ravel())
        # What he rests on: his back, buttocks and legs (not his fallen arms).
        rx, ry = rest[used, 0], rest[used, 1]
        trunk = used[((np.abs(rx) < pose.J["l-shoulder"][0]) & (ry < pose.J["neck"][1])) | (ry < -0.5)]
        # The ground under him is not level: he lies along its slope (a plane
        # fitted to the ground under him).
        probe = world[trunk][::7]
        gz = ground(probe[:, 0] + at[0], probe[:, 1] + at[1])
        A = np.stack([probe[:, 0], probe[:, 1], np.ones(len(probe))], axis=1)
        (sa, sb, _), *_ = np.linalg.lstsq(A, gz, rcond=None)
        n = np.array([-sa, -sb, 1.0])
        n /= np.linalg.norm(n)
        tilt = np.array(Vector((0.0, 0.0, 1.0)).rotation_difference(Vector(n)).to_matrix(), F)
        M3 = tilt @ M3
        self.M3 = M3
        world = posed @ M3.T
        # He rests on his tunic: the lowest of him a centimetre above the dust.
        probe = world[trunk][::5]
        gz = ground(probe[:, 0] + at[0], probe[:, 1] + at[1])
        lift = float(np.max(gz - probe[:, 2]))
        offset = np.array([at[0], at[1], lift + 0.012])
        world = world + offset
        # His limbs lie on the ground, not in it: an arm or foot that the
        # ground rises under is lifted onto it.
        for part in ("l-arm", "r-arm", "l-foot", "r-foot"):
            wgt = w[part]
            sel = np.nonzero((wgt > 0.3) & np.isin(np.arange(len(world)), used))[0]
            if len(sel) == 0:
                continue
            under = float(np.max(ground(world[sel, 0], world[sel, 1]) + 0.01 - world[sel, 2]))
            if under > 0:
                world[:, 2] += under * wgt
        self.world_of = lambda co: co @ M3.T + offset
        self.posed = posed
        self.rest = rest
        # Only the vertices the body uses, reindexed.
        def sub(faces):
            idx = np.unique(faces.ravel())
            remap = -np.ones(len(world), np.int64)
            remap[idx] = np.arange(len(idx))
            return idx, remap[faces]

        idx, faces = sub(body_f)
        body = _mesh(f"{self.name}-body", world[idx], faces, skin(f"{self.name}-skin", a.get("skin", "#8b6043")))
        self.body = body
        self.objects.append(body)
        # Hair: short and thick over the scalp (crown, back and sides of the
        # head, never the face), a shell a few millimetres off the skin.
        J = pose.J
        r_ = rest[idx]
        brow = J["head"][1] + 0.55
        back = r_[:, 2] < J["head"][2] + 0.25
        scalp = (r_[:, 1] > brow) | ((r_[:, 1] > J["head"][1] - 0.35) & back & (np.abs(r_[:, 0]) < 0.85))
        scalp_f = faces[scalp[faces].all(axis=1)]
        sidx = np.unique(scalp_f.ravel())
        remap = -np.ones(len(idx), np.int64)
        remap[sidx] = np.arange(len(sidx))
        wv = world[idx][sidx]
        hn = _vertex_normals(world[idx], faces)[sidx]
        thick = 0.006 + 0.004 * np.clip((r_[sidx, 1] - J["head"][1]) / 1.0, 0.0, 1.0)
        hair_obj = _mesh(f"{self.name}-hair", wv + hn * thick[:, None], remap[scalp_f], hair(f"{self.name}-hair", a.get("hair", "#1f1510")))
        common.add_modifier(hair_obj, "SUBSURF", levels=1, render_levels=2)
        self.objects.append(hair_obj)
        # His eyes (MakeHuman's eye helpers), so the sockets are never empty.
        eidx, efaces = sub(eye_f)
        self.objects.append(_mesh(f"{self.name}-eyes", world[eidx], efaces, C.plain("man-eyes", "#8f857a", 0.25)))
        # The tunic's shoulders and sleeves: shells over his skin.
        self._shells(world[idx], faces, rest[idx], pose.J)
        # The rest of the tunic: a tube that falls onto him.
        self._skirt(rest[idx], pose.J, ground, at)
        # Subdivided only now: the cloth collided with the plain mesh.
        common.add_modifier(body, "SUBSURF", levels=1, render_levels=1 if self.preview else 2)
        return self

    def _shells(self, world, faces, rest, J):
        a = self.appearance
        x, y = rest[:, 0], rest[:, 1]
        armpit = J["l-shoulder"][1] - 0.9
        keep = np.zeros(len(rest), bool)
        torso = (y > armpit - 0.9) & (y < J["neck"][1] - 0.25) & (np.abs(x) < J["l-shoulder"][0] + 0.2)
        keep |= torso
        for s, sx in (("l", 1.0), ("r", -1.0)):
            sh, el = J[f"{s}-shoulder"], J[f"{s}-elbow"]
            d = (el - sh) / np.linalg.norm(el - sh)
            along = (rest - sh) @ d
            sleeve = (along > -0.2) & (along < np.linalg.norm(el - sh) * 0.62) & (sx * x > sh[0] - 0.4)
            keep |= sleeve
        fmask = keep[faces].all(axis=1)
        sf = faces[fmask]
        vid = np.unique(sf.ravel())
        remap = -np.ones(len(rest), np.int64)
        remap[vid] = np.arange(len(vid))
        wv = world[vid]
        n = _vertex_normals(world, faces)[vid]
        rng = np.random.default_rng(5)
        # Loose over the skin, rumpled.
        wrink = 0.004 * np.sin(rest[vid, 1] * 9.0 + rng.random(len(vid)) * 0.8)
        shell = wv + n * (0.014 + wrink)[:, None]
        obj = _mesh(f"{self.name}-tunic-top", shell, remap[sf], wool(f"{self.name}-wool", a.get("robe", "#736247"), a.get("accent", "#4d788b")), {"restx": rest[vid, 0]})
        common.add_modifier(obj, "SOLIDIFY", thickness=0.004, offset=1.0)
        common.add_modifier(obj, "SUBSURF", levels=1, render_levels=1)
        self.objects.append(obj)

    def _skirt(self, body, J, ground, at):
        """A tube of cloth round him from the armpits to below the knees,
        cut from his standing shape (each ring an ellipse round his body at
        that height, with ease), laid down with him, then dropped."""
        a = self.appearance
        top = J["l-shoulder"][1] - 0.7
        hem = J["l-knee"][1] - 1.4
        rows = 34 if self.preview else 64
        segs = 40 if self.preview else 72
        ys = np.linspace(top, hem, rows)
        rings = []
        for yk in ys:
            band = body[np.abs(body[:, 1] - yk) < 0.25]
            # Not the arms: only what lies inside the shoulders' width.
            band = band[np.abs(band[:, 0]) < J["l-shoulder"][0] + 0.05]
            x0, x1 = band[:, 0].min(), band[:, 0].max()
            z0, z1 = band[:, 2].min(), band[:, 2].max()
            flare = (top - yk) / (top - hem)
            ease = 0.3 + 0.45 * flare
            cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
            rx, rz = (x1 - x0) / 2 + ease, (z1 - z0) / 2 + ease
            rings.append([(cx + rx * math.cos(t), yk, cz + rz * math.sin(t)) for t in np.linspace(0, math.tau, segs, endpoint=False)])
        co = np.array(rings, F).reshape(-1, 3)
        # A ragged hem.
        rng = np.random.default_rng(7)
        last = np.arange((rows - 1) * segs, rows * segs)
        co[last, 1] += rng.uniform(0.0, 0.35, len(last)) * (rng.random(len(last)) < 0.35)
        restx = co[:, 0].copy()
        wco = self.world_of(co)
        # Cloth that would lie under the ground is pressed flat onto it.
        g = ground(wco[:, 0], wco[:, 1])
        wco[:, 2] = np.maximum(wco[:, 2], g + 0.004)
        quads = []
        for r in range(rows - 1):
            for k in range(segs):
                k2 = (k + 1) % segs
                quads.append((r * segs + k, r * segs + k2, (r + 1) * segs + k2, (r + 1) * segs + k))
        skirt = _mesh(f"{self.name}-tunic", wco, np.array(quads), wool(f"{self.name}-wool", a.get("robe", "#736247"), a.get("accent", "#4d788b")), {"restx": restx})
        self._drop(skirt, at, ground)
        common.add_modifier(skirt, "SOLIDIFY", thickness=0.004, offset=1.0)
        common.add_modifier(skirt, "SUBSURF", levels=1, render_levels=1 if self.preview else 2)
        self.objects.append(skirt)

    def _drop(self, cloth, at, ground, frames=None):
        """Simulate the cloth falling onto him and the ground, then freeze it."""
        scene = bpy.context.scene
        frames = frames or (30 if self.preview else 70)
        # The ground under him, for the cloth to lie on.
        n = 90
        xs = np.linspace(at[0] - 1.6, at[0] + 1.6, n)
        ys = np.linspace(at[1] - 1.6, at[1] + 1.6, n)
        X, Y = np.meshgrid(xs, ys)
        Z = ground(X, Y)
        verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1)
        fs = []
        for i in range(n - 1):
            for j in range(n - 1):
                k = i * n + j
                fs.append((k, k + 1, k + n + 1, k + n))
        floor = _mesh(f"{self.name}-floor", verts, np.array(fs), None, smooth=False)
        for obj in (floor, self.body):
            col = obj.modifiers.new("collision", "COLLISION")
            _ = col
            obj.collision.thickness_outer = 0.004
            obj.collision.cloth_friction = 8.0
        mod = cloth.modifiers.new("cloth", "CLOTH")
        st = mod.settings
        st.quality = 6
        st.mass = 0.25
        st.tension_stiffness = 12.0
        st.compression_stiffness = 12.0
        st.shear_stiffness = 6.0
        st.bending_stiffness = 0.6
        st.air_damping = 1.5
        mod.collision_settings.distance_min = 0.004
        mod.collision_settings.collision_quality = 3
        mod.point_cache.frame_start = 1
        mod.point_cache.frame_end = frames
        old = scene.frame_current
        for f in range(1, frames + 1):
            scene.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = cloth.evaluated_get(dg)
        co = np.empty(len(ev.data.vertices) * 3, np.float32)
        ev.data.vertices.foreach_get("co", co)
        cloth.modifiers.remove(mod)
        cloth.data.vertices.foreach_set("co", co)
        cloth.data.update()
        for obj in (floor, self.body):
            obj.modifiers.remove(obj.modifiers["collision"])
        bpy.data.objects.remove(floor, do_unlink=True)
        scene.frame_set(old)



