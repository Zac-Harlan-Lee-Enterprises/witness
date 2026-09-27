"""MakeHuman's human model, as data: the hm08 base mesh and its morph
targets (CC0 1.0; see docs/adr/0016-makehuman-base-for-portraits.md).

The files come from MakeHuman's repository at a pinned commit and are
downloaded, with their SHA-256 checked, into a local cache by
`npm run art:fetch-makehuman` (scripts/fetch-makehuman.mjs, reading the
pinned list tools/art/data/makehuman-files.json). They are never committed.

Only MakeHuman's *data* is used. No MakeHuman or MPFB code is used or copied
(their code is AGPL/GPL): the formats are simple and read here directly.

- The base mesh is a Wavefront OBJ: vertices, UVs, and quads in named groups
  (`body`, and helper geometry such as `helper-l-eye` or
  `helper-upper-teeth`, and one-vertex `joint-*` markers).
- A target is lines of `vertex dx dy dz`: a displacement of some vertices.
  Targets add: a person is the base mesh plus the weighted sum of targets.
- The "macro" targets are key shapes named by sex, age band, muscle, weight
  and ancestry (e.g. `universal-male-old-averagemuscle-minweight`,
  `african-female-young`). A value between two key shapes weights the two
  by linear interpolation; the weights for a person are products of these
  (`macro_weights`, written here from the names and the age each band
  stands for).

MakeHuman's units are decimetres, with Y up and the face toward +Z.
`to_portrait` turns them into the portrait frame: centimetres, X to the
person's left, the face toward -Y, Z up.
"""
import hashlib
import json
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
PINNED = os.path.join(ROOT, "tools", "art", "data", "makehuman-files.json")
F = np.float32


class MissingData(RuntimeError):
    pass


def cache_dir():
    """Where scripts/fetch-makehuman.mjs puts the files (MAKEHUMAN_CACHE overrides)."""
    return os.environ.get("MAKEHUMAN_CACHE") or os.path.join(ROOT, "tools", "art", ".cache", "makehuman")


def pinned():
    with open(PINNED) as f:
        return json.load(f)


def path(rel):
    """The cached file for a path under MakeHuman's `makehuman/data/`."""
    p = os.path.join(cache_dir(), "makehuman", "data", rel)
    if not os.path.exists(p):
        raise MissingData(f"MakeHuman data missing: {rel}. Run `npm run art:fetch-makehuman` (downloads the pinned CC0 files into {cache_dir()}).")
    return p


def verify():
    """Check every pinned file is present with its recorded SHA-256."""
    bad = []
    for f in pinned()["files"]:
        p = os.path.join(cache_dir(), f["path"])
        if not os.path.exists(p):
            bad.append(f["path"] + " (missing)")
            continue
        with open(p, "rb") as fh:
            if hashlib.sha256(fh.read()).hexdigest() != f["sha256"]:
                bad.append(f["path"] + " (checksum)")
    if bad:
        raise MissingData(f"{len(bad)} MakeHuman files missing or changed, e.g. {bad[:3]}. Run `npm run art:fetch-makehuman`.")


# ── Base mesh ───────────────────────────────────────────────────────────────
class Base:
    """The hm08 base mesh: co (N, 3), quads (F, 4), uv (T, 2), face_uv (F, 4),
    and each face's group."""

    _one = None

    def __init__(self, obj_path):
        co, uv, quads, fuv, fgroup, names = [], [], [], [], [], []
        group = -1
        with open(obj_path) as f:
            for line in f:
                if line.startswith("v "):
                    co.append(line.split()[1:4])
                elif line.startswith("vt "):
                    uv.append(line.split()[1:3])
                elif line.startswith("f "):
                    parts = [p.split("/") for p in line.split()[1:]]
                    quads.append([int(p[0]) - 1 for p in parts])
                    fuv.append([int(p[1]) - 1 if len(p) > 1 and p[1] else 0 for p in parts])
                    fgroup.append(group)
                elif line.startswith("g "):
                    names.append(line.split(None, 1)[1].strip())
                    group = len(names) - 1
        self.co = np.array(co, F)
        self.uv = np.array(uv, F)
        self.quads = np.array(quads, np.int64)
        self.face_uv = np.array(fuv, np.int64)
        self.face_group = np.array(fgroup, np.int64)
        self.groups = names

    @classmethod
    def get(cls):
        if cls._one is None:
            cls._one = Base(path("3dobjs/base.obj"))
        return cls._one

    def faces_of(self, *names):
        ids = [i for i, n in enumerate(self.groups) if n in names]
        return np.nonzero(np.isin(self.face_group, ids))[0]

    def verts_of(self, *names):
        return np.unique(self.quads[self.faces_of(*names)].ravel())

    def joint(self, name, co=None):
        """A `joint-<name>` marker: the centre of its vertices."""
        co = self.co if co is None else co
        return co[self.verts_of("joint-" + name)].mean(0)


_targets = {}


def target(rel):
    """(vertex indices, displacements) of a target under `targets/`."""
    if rel not in _targets:
        idx, d = [], []
        with open(path("targets/" + rel + ".target")) as f:
            for line in f:
                if not line.strip() or line.startswith("#"):
                    continue
                v = line.split()
                idx.append(int(v[0]))
                d.append((float(v[1]), float(v[2]), float(v[3])))
        _targets[rel] = (np.array(idx, np.int64), np.array(d, F).reshape(-1, 3))
    return _targets[rel]


def exists(rel):
    return os.path.exists(os.path.join(cache_dir(), "makehuman", "data", "targets", rel + ".target"))


# ── Macro weights ──────────────────────────────────────────────────────────
# The age each age band's key shape stands for (years).
AGE_BANDS = (("baby", 1.0), ("child", 10.0), ("young", 25.0), ("old", 90.0))
ANCESTRIES = ("african", "asian", "caucasian")


def _between(keys, x):
    """Linear-interpolation weights of x between named keys [(name, at), ...]."""
    names = [k for k, _ in keys]
    ats = [a for _, a in keys]
    x = min(max(x, ats[0]), ats[-1])
    out = {n: 0.0 for n in names}
    for i in range(len(ats) - 1):
        if ats[i] <= x <= ats[i + 1]:
            t = (x - ats[i]) / (ats[i + 1] - ats[i])
            out[names[i]] += 1.0 - t
            out[names[i + 1]] += t
            break
    return {n: w for n, w in out.items() if w > 1e-6}


def macro_weights(male, age_years, muscle=0.5, weight=0.5, ancestry=None):
    """Weights of the macro key shapes for a person.

    `male` 0 (female) … 1 (male); `muscle` and `weight` 0 … 0.5 (average) … 1;
    `ancestry` {african, asian, caucasian: share} (normalised).
    """
    sexes = {k: v for k, v in (("female", 1.0 - male), ("male", male)) if v > 1e-6}
    ages = _between(AGE_BANDS, age_years)
    mus = _between((("minmuscle", 0.0), ("averagemuscle", 0.5), ("maxmuscle", 1.0)), muscle)
    wts = _between((("minweight", 0.0), ("averageweight", 0.5), ("maxweight", 1.0)), weight)
    anc = ancestry or {"caucasian": 1.0}
    total = sum(anc.values())
    out = {}
    for s, ws in sexes.items():
        for a, wa in ages.items():
            for r, wr in anc.items():
                if wr > 0:
                    out[f"macrodetails/{r}-{s}-{a}"] = out.get(f"macrodetails/{r}-{s}-{a}", 0.0) + ws * wa * wr / total
            for m, wm in mus.items():
                for w, ww in wts.items():
                    out[f"macrodetails/universal-{s}-{a}-{m}-{w}"] = ws * wa * wm * ww
    return out


# Opposite ends of a two-sided modifier, as MakeHuman names its targets.
PAIRS = (
    ("decr", "incr"),
    ("down", "up"),
    ("backward", "forward"),
    ("in", "out"),
    ("concave", "convex"),
    ("compress", "uncompress"),
    ("pointed", "triangle"),
    ("square", "round"),
)


def pair(name, value):
    """{target: weight} for a two-sided modifier, e.g. pair("nose/nose-hump", 0.4):
    a negative value weights the first end (decr, down, …), a positive the second."""
    if abs(value) < 1e-6:
        return {}
    for neg, pos in PAIRS:
        if exists(f"{name}-{neg}") and exists(f"{name}-{pos}"):
            return {f"{name}-{pos}" if value > 0 else f"{name}-{neg}": abs(value)}
    raise KeyError(f"no two-sided MakeHuman modifier {name}")


def pair_ends(name, ends, value):
    """Like `pair`, with the two ends named (for a region with more than one
    pair, e.g. eyes/l-eye-trans: in/out and down/up)."""
    if abs(value) < 1e-6:
        return {}
    neg, pos = ends
    rel = f"{name}-{pos}" if value > 0 else f"{name}-{neg}"
    if not exists(rel):
        raise KeyError(f"no MakeHuman target {rel}")
    return {rel: abs(value)}


class Model:
    """A person: the base mesh plus weighted targets."""

    def __init__(self):
        self.base = Base.get()
        self.weights = {}

    def add(self, weights, scale=1.0):
        for k, v in weights.items():
            if abs(v * scale) > 1e-6:
                self.weights[k] = self.weights.get(k, 0.0) + v * scale
        return self

    def coords(self, extra=None):
        co = self.base.co.copy()
        for k, w in list(self.weights.items()) + list((extra or {}).items()):
            idx, d = target(k)
            np.add.at(co, idx, d * F(w))
        return co


# ── The portrait frame ─────────────────────────────────────────────────────
# MakeHuman (dm; Y up; face +Z) → portrait (cm; Z up; face -Y). A proper
# rotation, so faces keep their winding.
_R = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], F)


def to_portrait(co, origin):
    """MakeHuman coordinates to the portrait frame, `origin` (MakeHuman units) at 0."""
    return ((co - origin) @ _R.T) * F(10.0)
