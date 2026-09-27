"""Who a portrait's face is, and what it is doing: MakeHuman target weights.

`identity(P)` turns a person (portrait_params.Params: age, sex, how much of
their life is spent in the sun, the appearance data and a seed from the
portrait id) into weights of MakeHuman's morph targets (tools/art/lib/
makehuman.py): the "macro" key shapes for sex, age, muscle, weight and
ancestry, and then every region of the face: the skull and face shape, the
forehead and brow, the eyes and their lids, the nose, the lips, the cheeks,
the jaw and chin, the ears and the neck, each moved continuously, with small
per-side asymmetries. Everything is drawn from the person's own seed, so the
same person always has the same face and no two people share one.

Ancestry. The people are first-century Judeans and Galileans, a Nabataean
trader, and Greeks and Phrygians in Colossae: Eastern Mediterranean people.
MakeHuman's three ancestry key shapes are broad (African, East Asian and
European averages); Eastern Mediterranean faces are drawn here as a blend,
mostly the West Eurasian ("caucasian") shape with a share of the other two
that varies from person to person and with the depth of their skin colour,
and then moved by the person's own features (a longer or broader nose, a
higher bridge, fuller lips, deeper-set eyes, heavier brows, and so on) drawn
from ranges that stay within ordinary anatomy. No feature is exaggerated
toward a type, and no face is left at a default.

`expression(name, P)` gives the weights of MakeHuman's expression units
(muscle actions: the corners of the mouth pulled up, the inner brows raised,
the lids narrowed...) for each expression a line can carry. The mixes are
authored here; they are the same for everyone, with small per-person
asymmetry, and are blended by the person's ancestry as the units are.
"""
import random

from portrait_params import seed_of

# Expressions a dialogue line can carry (keep in step with EXPRESSIONS in
# src/domain/dialogue.ts). `neutral` is the person at rest: their resting
# mood (portrait_params.MOODS) shows a little.
EXPRESSIONS = ("neutral", "glad", "worried", "sad", "angry", "surprised", "afraid")

# Unit weights for each expression: (unit, weight) with `{s}` for a unit
# that has a left and a right version. Authored by eye on the renders.
EXPRESSION_UNITS = {
    "glad": {
        "mouth-corner-puller": 0.78,
        "mouth-upward-retraction": 0.12,
        "eye-{s}-slit": 0.32,
        "eyebrows-{s}-extern-up": 0.12,
    },
    "worried": {
        "eyebrows-{s}-inner-up": 0.85,
        "eyebrows-{s}-down": 0.22,
        "mouth-compression": 0.28,
        "mouth-depression": 0.18,
        "eye-{s}-opened-up": 0.12,
    },
    "sad": {
        "eyebrows-{s}-inner-up": 0.75,
        "mouth-depression": 0.62,
        "mouth-compression": 0.12,
        "eye-{s}-closure": 0.2,
        "neck-platysma": 0.1,
    },
    "angry": {
        "eyebrows-{s}-down": 1.0,
        "nose-{s}-elevation": 0.45,
        "mouth-depression-retraction": 0.45,
        "mouth-open": 0.3,
        "mouth-elevation": 0.25,
        "eye-{s}-slit": 0.25,
        "neck-platysma": 0.35,
    },
    "surprised": {
        "eyebrows-{s}-up": 1.0,
        "eyebrows-{s}-inner-up": 0.2,
        "eye-{s}-opened-up": 0.75,
        "mouth-open": 0.42,
    },
    "afraid": {
        "eyebrows-{s}-inner-up": 0.85,
        "eyebrows-{s}-up": 0.45,
        "eye-{s}-opened-up": 0.8,
        "mouth-retraction": 0.45,
        "mouth-open": 0.22,
        "neck-platysma": 0.45,
    },
}

# Where the eyes look for an expression: degrees away from the camera (+ the
# person's left, + up). Sadness looks down.
EXPRESSION_GAZE = {"sad": (0.0, -6.0), "worried": (0.0, -1.5)}


def _luma(hexcol):
    """Relative luminance of an sRGB hex colour (linear)."""
    h = hexcol.lstrip("#")

    def lin(c):
        c = int(h[c : c + 2], 16) / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4)


def ancestry(P):
    """Shares of MakeHuman's three ancestry key shapes for a person."""
    r = random.Random(seed_of(P.id + ":ancestry"))
    dark = min(1.0, max(0.0, (0.2 - _luma(P.appearance["skin"])) / 0.14))
    african = 0.12 + 0.16 * dark + r.uniform(-0.05, 0.08)
    asian = 0.1 + r.uniform(-0.05, 0.06)
    if P.chapter == "letter-from-paul":
        # Greeks and Phrygians of the Lycus valley.
        african -= 0.04
        asian += 0.02
    african = max(0.04, african)
    asian = max(0.03, asian)
    return {"african": african, "asian": asian, "caucasian": max(0.4, 1.0 - african - asian)}


def _sided(unit, value, asym=0.0):
    """A unit's weight; `{s}` units on both sides, the person's left scaled by (1 + asym)."""
    if "{s}" not in unit:
        return {unit: value}
    return {unit.format(s="left"): value * (1 + asym), unit.format(s="right"): value * (1 - asym)}


def unit_weights(units, anc):
    """{unit: weight} to target weights, blended by ancestry."""
    out = {}
    total = sum(anc.values())
    for u, w in units.items():
        for race, share in anc.items():
            out[f"expression/units/{race}/{u}"] = out.get(f"expression/units/{race}/{u}", 0.0) + w * share / total
    return out


def mood_units(P):
    """The resting expression of the neutral portrait, from the casting
    table's mood (portrait_params.MOODS), as expression units."""
    units = {}

    def add(unit, v, asym=0.0):
        if abs(v) < 1e-4:
            return
        for k, x in _sided(unit, v, asym).items():
            units[k] = units.get(k, 0.0) + x

    sa = max(-0.9, min(0.9, P.smile_asym))
    add("mouth-corner-puller", 0.9 * P.smile)
    if abs(sa) > 1e-3 and P.smile > 0:
        # A lopsided smile: one corner lifts further (a nose-side lift on that side).
        add("nose-{s}-elevation", 0.18 * P.smile * abs(sa), asym=1.0 if sa > 0 else -1.0)
    add("eye-{s}-slit", 0.45 * P.eyes_smile + 0.55 * P.squint)
    if P.brow_inner >= 0:
        add("eyebrows-{s}-inner-up", 1.1 * P.brow_inner)
    else:
        add("eyebrows-{s}-down", -1.4 * P.brow_inner)
    add("eyebrows-{s}-extern-up", 1.0 * P.brow_outer, asym=max(-0.9, min(0.9, P.brow_asym)))
    if P.lid_droop >= 0:
        add("eye-{s}-closure", 0.55 * P.lid_droop)
    else:
        add("eye-{s}-opened-up", -1.2 * P.lid_droop)
    add("mouth-depression", 1.1 * P.mouth_down)
    add("mouth-compression", 1.0 * P.press)
    return units


def expression(name, P):
    """Target weights for an expression (the resting mood for `neutral`)."""
    if name not in EXPRESSIONS:
        raise KeyError(f"unknown expression {name}")
    anc = ancestry(P)
    if name == "neutral":
        return unit_weights(mood_units(P), anc)
    r = random.Random(seed_of(P.id + ":" + name))
    asym = r.uniform(-0.12, 0.12) * (1 - 0.6 * P.child)
    units = {}
    for u, w in EXPRESSION_UNITS[name].items():
        for k, x in _sided(u, w, asym).items():
            units[k] = units.get(k, 0.0) + x
    if P.child > 0.5 and name == "angry":
        # A child's cross face: brows and pout, no bared teeth.
        units = {k: v * (0.4 if k.startswith("mouth") else 1.0) for k, v in units.items()}
    return unit_weights(units, anc)


def gaze(name, P):
    """Where the eyes look for an expression (degrees: + left, + up)."""
    if name == "neutral":
        return P.gaze
    return EXPRESSION_GAZE.get(name, (0.0, 0.0))


# ── Identity ───────────────────────────────────────────────────────────────
def identity(P):
    """MakeHuman target weights that make this person's face and body."""
    import makehuman as mh

    r = random.Random(seed_of(P.id + ":face"))

    def j(spread):
        return r.uniform(-1.0, 1.0) * spread

    child = P.child
    age_t = P.age_t
    female = P.sex == "f"
    m = 1.0 - 0.45 * child  # children's features vary less
    out = {}

    def add(weights, scale=1.0):
        for k, v in weights.items():
            out[k] = out.get(k, 0.0) + v * scale

    def pair(name, v):
        add(mh.pair(name, max(-1.0, min(1.0, v))))

    def ends(name, which, v):
        add(mh.pair_ends(name, which, max(-1.0, min(1.0, v))))

    def both(name, v, asym=0.06, which=None):
        """A left/right modifier on both sides, with a little difference."""
        d = j(asym) * (1 - 0.7 * child)
        for s, x in (("l", v + d), ("r", v - d)):
            if which:
                ends(name.format(s=s), which, x)
            else:
                pair(name.format(s=s), x)

    # ── Sex, age, build, ancestry ──────────────────────────────────────────
    if P.sex == "x":
        male = 0.5
    elif female:
        male = 0.5 * P.masc
    else:
        male = P.masc
    muscle = 0.5 + 0.18 * P.sun * (0 if female else 1) + j(0.12) - 0.1 * child
    weight = 0.5 + j(0.2) + (0.05 if age_t > 0.3 else 0.0)
    P.body_weight = weight
    # MakeHuman's key shapes age gently; people who have worked in the sun
    # all their lives look their years sooner.
    looks = P.age + max(0.0, P.age - 28.0) * (0.25 + 0.15 * P.sun)
    add(mh.macro_weights(male, looks, muscle, weight, ancestry(P)))

    # ── Skull and face shape ───────────────────────────────────────────────
    shapes = ["head-oval", "head-round", "head-square", "head-rectangular", "head-triangular", "head-invertedtriangular", "head-diamond"]
    wts = [3.0, 1.6, 1.6 if not female else 0.6, 1.8, 0.8, 1.2 if female else 0.8, 1.2]
    pick = r.choices(shapes, wts)[0]
    add({f"head/{pick}": r.uniform(0.35, 0.8) * m})
    second = r.choices(shapes, wts)[0]
    if second != pick:
        add({f"head/{second}": r.uniform(0.1, 0.35) * m})
    pair("head/head-scale-horiz", j(0.22))
    pair("head/head-scale-vert", j(0.2) + (0.08 if not female else -0.04))
    pair("head/head-scale-depth", j(0.2))
    pair("head/head-back-scale-depth", j(0.3))
    pair("head/head-fat", (weight - 0.5) * 1.1 + j(0.15) - 0.15 * age_t)
    if age_t > 0:
        pair("head/head-age", 0.65 * age_t ** 1.2)
    elif P.age >= 13:
        pair("head/head-age", -0.2 * (1 - (P.age - 13) / 17))

    # ── Forehead and brow ──────────────────────────────────────────────────
    pair("forehead/forehead-scale-vert", j(0.35))
    pair("forehead/forehead-trans", j(0.35) - 0.15 * (P.masc - 0.5))  # + forward (upright)
    pair("forehead/forehead-temple", j(0.3) - 0.3 * age_t * (1 - weight))
    pair("forehead/forehead-nubian", j(0.3))
    ends("eyebrows/eyebrows-trans", ("backward", "forward"), (0.25 * (P.masc - 0.4) + j(0.35)) * m)
    ends("eyebrows/eyebrows-trans", ("down", "up"), j(0.3) * m)
    pair("eyebrows/eyebrows-angle", j(0.4) * m + (0.12 if female else 0.0))

    # ── Eyes and lids ──────────────────────────────────────────────────────
    both("eyes/{s}-eye-scale", j(0.22) * m + 0.1 * child)
    both("eyes/{s}-eye-trans", j(0.35) * m, which=("in", "out"))
    both("eyes/{s}-eye-trans", j(0.18) * m, which=("down", "up"))
    both("eyes/{s}-eye-height1", j(0.3) * m)
    both("eyes/{s}-eye-height2", j(0.35) * m + (0.08 if female else 0.0) - 0.15 * age_t)
    both("eyes/{s}-eye-height3", j(0.3) * m)
    both("eyes/{s}-eye-corner1", j(0.25) * m)
    both("eyes/{s}-eye-corner2", j(0.35) * m + (0.1 if female else 0.0) - 0.12 * age_t)
    both("eyes/{s}-eye-push1", j(0.35) * m + 0.12 * age_t, which=("in", "out"))
    both("eyes/{s}-eye-push2", j(0.3) * m, which=("in", "out"))
    both("eyes/{s}-eye-eyefold", j(0.35) * m - 0.3 * age_t, which=("down", "up"))
    both("eyes/{s}-eye-eyefold", j(0.3) * m, which=("concave", "convex"))
    both("eyes/{s}-eye-eyefold-angle", j(0.3) * m)
    both("eyes/{s}-eye-epicanthus", j(0.12) * m, which=("in", "out"))
    both("eyes/{s}-eye-bag", 0.75 * age_t + j(0.25) * m - 0.3 * child, which=("decr", "incr"))
    both("eyes/{s}-eye-bag-height", j(0.3) * m + 0.2 * age_t)
    both("eyes/{s}-eye-bag", j(0.2) * m, which=("in", "out"))

    # ── Nose ───────────────────────────────────────────────────────────────
    nm = m * (0.6 if child > 0.5 else 1.0)
    pair("nose/nose-scale-vert", j(0.35) * nm + 0.25 * age_t + (0.08 if not female else -0.1) - 0.2 * child)
    pair("nose/nose-scale-horiz", j(0.35) * nm + 0.12 * age_t - (0.1 if female else 0.0))
    pair("nose/nose-scale-depth", j(0.3) * nm + 0.08 * (1 - child) - 0.2 * child)
    hump = max(0.0, r.uniform(-0.35, 0.85)) * (1 - child) * (0.6 if female else 1.0)
    pair("nose/nose-hump", hump)
    pair("nose/nose-greek", j(0.3) * nm)
    pair("nose/nose-curve", j(0.35) * nm + 0.25 * hump)
    pair("nose/nose-point-width", j(0.35) * nm + 0.15 * age_t)
    pair("nose/nose-point", j(0.3) * nm - 0.25 * age_t + 0.2 * child)  # + upturned tip
    pair("nose/nose-nostrils-width", j(0.35) * nm)
    pair("nose/nose-flaring", j(0.35) * nm)
    pair("nose/nose-volume", j(0.3) * nm)
    pair("nose/nose-septumangle", j(0.3) * nm)
    pair("nose/nose-base", j(0.3) * nm)
    pair("nose/nose-compression", j(0.2) * nm)
    pair("nose/nose-width1", j(0.3) * nm)
    pair("nose/nose-width2", j(0.3) * nm)
    pair("nose/nose-width3", j(0.3) * nm)
    ends("nose/nose-trans", ("in", "out"), j(0.08) * nm)  # a nose that leans a little

    # ── Mouth and lips ─────────────────────────────────────────────────────
    lips = r.choice((-0.15, 0.1, 0.25, 0.4)) + (0.12 if female else 0.0) - 0.3 * age_t
    pair("mouth/mouth-scale-horiz", j(0.22) * m)
    pair("mouth/mouth-upperlip-volume", lips + j(0.2))
    pair("mouth/mouth-lowerlip-volume", lips + j(0.25))
    pair("mouth/mouth-cupidsbow", j(0.4) * m + (0.15 if female else 0.0))
    pair("mouth/mouth-cupidsbow-width", j(0.3) * m)
    pair("mouth/mouth-upperlip-height", j(0.3) * m)
    pair("mouth/mouth-lowerlip-height", j(0.3) * m)
    pair("mouth/mouth-lowerlip-ext", j(0.25) * m)
    pair("mouth/mouth-upperlip-ext", j(0.25) * m)
    pair("mouth/mouth-lowerlip-middle", j(0.2) * m)
    pair("mouth/mouth-upperlip-middle", j(0.2) * m)
    pair("mouth/mouth-philtrum-volume", j(0.3) * m)
    pair("mouth/mouth-angles", j(0.2) * m - 0.25 * age_t)
    ends("mouth/mouth-trans", ("backward", "forward"), j(0.25) * m)
    ends("mouth/mouth-laugh-lines", ("in", "out"), 0.6 * age_t + j(0.15))

    # ── Cheeks ─────────────────────────────────────────────────────────────
    both("cheek/{s}-cheek-bones", j(0.4) * m + 0.1 * (P.masc - 0.5))
    both("cheek/{s}-cheek-volume", j(0.3) * m + (weight - 0.5) * 0.6 + 0.3 * child - 0.3 * age_t * (1 - weight))
    both("cheek/{s}-cheek-inner", j(0.3) * m)
    both("cheek/{s}-cheek-trans", j(0.3) * m)

    # ── Jaw and chin ───────────────────────────────────────────────────────
    pair("chin/chin-prominent", j(0.4) * m + 0.12 * (P.masc - 0.5))
    pair("chin/chin-width", j(0.35) * m + 0.2 * (P.masc - 0.5))
    pair("chin/chin-height", j(0.35) * m)
    pair("chin/chin-bones", j(0.35) * m + 0.25 * (P.masc - 0.5) - 0.2 * child)
    pair("chin/chin-prognathism", j(0.25) * m)
    pair("chin/chin-jaw-drop", j(0.2) * m)
    if not female and child < 0.5 and r.random() < 0.3:
        pair("chin/chin-cleft", r.uniform(0.2, 0.6))
    if female and r.random() < 0.5:
        add({"chin/chin-triangle": r.uniform(0.1, 0.4)})

    # ── Ears ───────────────────────────────────────────────────────────────
    both("ears/{s}-ear-scale", j(0.22) * m + 0.3 * age_t, asym=0.05)
    both("ears/{s}-ear-flap", j(0.4) * m, asym=0.1)
    both("ears/{s}-ear-lobe", j(0.4) * m + 0.3 * age_t)
    both("ears/{s}-ear-rot", j(0.25) * m, which=("backward", "forward"))
    both("ears/{s}-ear-shape", j(0.3) * m, which=("pointed", "triangle"))
    both("ears/{s}-ear-shape", j(0.3) * m, which=("square", "round"))
    both("ears/{s}-ear-wing", j(0.3) * m, asym=0.08)
    both("ears/{s}-ear-scale-vert", j(0.2) * m)

    # ── Neck ───────────────────────────────────────────────────────────────
    pair("neck/neck-scale-horiz", j(0.2) + 0.15 * (P.masc - 0.5) + (weight - 0.5) * 0.5)
    pair("neck/neck-scale-vert", j(0.15) + (0.1 if female else -0.05))
    if age_t > 0.3 and weight > 0.45:
        pair("neck/neck-double", 0.4 * age_t)

    # ── Asymmetry: small, one side or the other ────────────────────────────
    sym = (1 - 0.7 * child) * 0.5
    for region, count in (("brown", 2), ("cheek", 2), ("ear", 4), ("eye", 8), ("jaw", 3), ("mouth", 2), ("nose", 4), ("temple", 2), ("top", 2)):
        for k in range(1, count + 1):
            v = r.uniform(0.0, 0.45) * sym
            side = r.choice(("l", "r"))
            add({f"asym/asym-{region}-{k}-{side}": v})
    return {k: v for k, v in out.items() if abs(v) > 1e-4}
