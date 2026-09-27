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
        # A real smile reaches the eyes: corners up and back, the lips
        # parting over the upper teeth, the cheeks lifting the lower lids.
        "mouth-corner-puller": 1.0,
        "mouth-upward-retraction": 0.35,
        "mouth-open": 0.06,
        "eye-{s}-slit": 0.5,
        "eyebrows-{s}-extern-up": 0.15,
    },
    "worried": {
        # Inner brows up and drawn together, lips pressed, corners down.
        "eyebrows-{s}-inner-up": 1.0,
        "eyebrows-{s}-down": 0.35,
        "mouth-compression": 0.4,
        "mouth-depression": 0.3,
        "eye-{s}-opened-up": 0.2,
    },
    "sad": {
        # Inner brows up, lids heavy, the mouth's corners pulled down, the
        # chin raised a little against the lower lip; looking down.
        "eyebrows-{s}-inner-up": 1.0,
        "mouth-depression": 0.9,
        "mouth-compression": 0.25,
        "eye-{s}-closure": 0.3,
        "neck-platysma": 0.15,
    },
    "angry": {
        # Brows hard down and drawn together, lids narrowed with the lower
        # lids tense, nostrils flared, the upper lip raised off the teeth,
        # the mouth open to shout, the neck tight.
        "eyebrows-{s}-down": 1.0,
        "eye-{s}-slit": 0.5,
        "nose-{s}-dilatation": 0.8,
        "nose-{s}-elevation": 0.6,
        "mouth-elevation": 0.5,
        "mouth-depression-retraction": 0.45,
        "mouth-open": 0.24,
        "neck-platysma": 0.55,
    },
    "surprised": {
        "eyebrows-{s}-up": 1.0,
        "eyebrows-{s}-inner-up": 0.25,
        "eye-{s}-opened-up": 0.8,
        "mouth-open": 0.5,
    },
    "afraid": {
        # Brows up and together, eyes wide, the lips stretched back, the
        # neck taut.
        "eyebrows-{s}-inner-up": 1.0,
        "eyebrows-{s}-up": 0.6,
        "eye-{s}-opened-up": 1.0,
        "mouth-retraction": 0.7,
        "mouth-open": 0.35,
        "neck-platysma": 0.7,
    },
}

# Where the eyes look for an expression: degrees away from the camera (+ the
# person's left, + up). Sadness looks down.
EXPRESSION_GAZE = {"sad": (0.0, -8.0), "worried": (0.0, -1.5)}


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

    # Neutral is a relaxed face, not a smile: the mood only tints it (a warm
    # person's mouth corners a shade up and eyes a little soft, a stern
    # person's brows a little down, a tired person's lids a little heavy).
    sa = max(-0.9, min(0.9, P.smile_asym))
    add("mouth-corner-puller", min(0.1, 0.25 * P.smile), asym=0.35 * sa)
    add("eye-{s}-slit", 0.35 * P.squint)
    # Only the moods that are the person's nature move the brows at rest
    # (a worried mother, a stern baker): worry or sternness in a line is
    # that line's expression.
    if P.brow_inner >= 0.3:
        add("eyebrows-{s}-inner-up", 0.45 * P.brow_inner)
    elif P.brow_inner < -0.2:
        add("eyebrows-{s}-down", -0.8 * P.brow_inner)
    add("eyebrows-{s}-extern-up", 0.5 * P.brow_outer, asym=max(-0.9, min(0.9, P.brow_asym)))
    if P.lid_droop >= 0:
        add("eye-{s}-closure", 0.4 * P.lid_droop)
    else:
        add("eye-{s}-opened-up", -0.8 * P.lid_droop)
    add("mouth-depression", 0.7 * P.mouth_down)
    add("mouth-compression", 0.6 * P.press)
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
# Broad types for each region (cast per person in portrait_params.CASTING,
# drawn from the seed otherwise), then continuous variation within the type.
# Values are MakeHuman modifier values (-1 … 1), before the person's own jitter.
FACE_TYPES = {
    # head shape targets, face length, jaw/chin width, cheekbones, chin projection
    "oval": dict(shapes={"head-oval": 0.7}, length=0.0, jaw=0.0, bones=0.0, chin=0.0),
    "long": dict(shapes={"head-rectangular": 0.45, "head-oval": 0.35}, length=0.35, jaw=-0.1, bones=-0.1, chin=0.2),
    "square": dict(shapes={"head-square": 0.65}, length=-0.05, jaw=0.4, bones=0.1, chin=0.15),
    "heart": dict(shapes={"head-invertedtriangular": 0.6}, length=0.05, jaw=-0.35, bones=0.25, chin=-0.1),
    "round": dict(shapes={"head-round": 0.6}, length=-0.25, jaw=0.1, bones=-0.15, chin=-0.2),
    "diamond": dict(shapes={"head-diamond": 0.6}, length=0.1, jaw=-0.2, bones=0.45, chin=0.15),
}
NOSE_TYPES = {
    # length, width, projection, hump, curve (+ convex), tip up, tip width, nostril width, flare, bridge (greek - / +)
    "straight": (0.05, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25),
    "aquiline": (0.3, 0.05, 0.35, 0.75, 0.45, -0.35, 0.05, 0.05, 0.0, 0.0),
    "convex": (0.2, 0.15, 0.25, 0.4, 0.6, -0.15, 0.15, 0.1, 0.1, 0.0),
    "broad": (0.0, 0.5, -0.05, 0.1, 0.05, 0.05, 0.35, 0.45, 0.4, -0.1),
    "bridge": (0.2, -0.1, 0.45, 0.25, 0.2, -0.05, -0.1, -0.1, -0.1, 0.5),
    "snub": (-0.35, 0.05, -0.2, -0.2, -0.3, 0.45, 0.1, 0.05, 0.1, -0.2),
    "bulbous": (0.1, 0.25, 0.2, 0.15, 0.15, -0.2, 0.55, 0.2, 0.25, -0.1),
}
EYE_TYPES = {
    # opening height, outer corner (+ up), depth (+ deep), hooding (+ more), spacing, size
    "almond": (-0.1, 0.35, 0.05, 0.0, 0.0, 0.0),
    "round": (0.4, 0.0, -0.15, -0.2, 0.0, 0.15),
    "hooded": (-0.2, 0.05, 0.1, 0.55, 0.0, -0.05),
    "deep": (-0.05, 0.0, 0.55, 0.25, -0.1, -0.05),
    "down": (0.05, -0.45, 0.05, 0.15, 0.1, 0.0),
}
LIP_TYPES = {"thin": -0.35, "medium": 0.1, "full": 0.45, "very full": 0.7}


def _types(P, r):
    """(face, nose, eyes, lips) types: cast, or drawn from the seed."""
    from portrait_params import CASTING

    cast = CASTING.get(P.id, {})
    female = P.sex == "f"
    face = cast.get("face") or r.choices(list(FACE_TYPES), (3, 2, 2 if not female else 1, 1.5, 1.5, 1.2))[0]
    nose = cast.get("nose") or r.choices(list(NOSE_TYPES), (3, 2 if not female else 1, 2, 2, 2, 0.4, 1))[0]
    eyes = cast.get("eyes") or r.choices(list(EYE_TYPES), (3, 1.2, 2.5, 2, 1.2))[0]
    lips = cast.get("lips") or r.choices(list(LIP_TYPES), (1, 3, 3, 1))[0]
    return face, nose, eyes, lips


def identity(P):
    """MakeHuman target weights that make this person's face and body."""
    import makehuman as mh

    r = random.Random(seed_of(P.id + ":face"))

    def j(spread):
        return r.uniform(-1.0, 1.0) * spread

    child = P.child
    age_t = P.age_t
    female = P.sex == "f"
    adult = max(0.0, min(1.0, (P.age - 18.0) / 10.0))  # 0 child/teen … 1 grown (28+)
    m = 1.0 - 0.5 * child  # children's features vary less
    out = {}
    face_t, nose_t, eye_t, lip_t = _types(P, r)
    P.types = (face_t, nose_t, eye_t, lip_t)

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
        male = 0.35 * P.masc
    else:
        male = P.masc
    muscle = 0.5 + 0.18 * P.sun * (0 if female else 1) + j(0.12) - 0.1 * child
    weight = 0.5 + j(0.18) + (0.06 if age_t > 0.3 else 0.0) - (0.06 if female and age_t < 0.3 else 0.0)
    P.body_weight = weight
    # MakeHuman's key shapes age gently; people who have worked in the sun
    # all their lives look their years sooner.
    looks = P.age + max(0.0, P.age - 26.0) * ((0.15 if female else 0.3) + 0.2 * P.sun)
    add(mh.macro_weights(male, looks, muscle, weight, ancestry(P)))

    # ── Skull and face shape ───────────────────────────────────────────────
    ft = FACE_TYPES[face_t]
    # (A woman's face keeps its type more softly: a long or square face
    # at full strength read as a man's.)
    soft = 0.7 if female else 1.0
    for shape, w in ft["shapes"].items():
        add({f"head/{shape}": (w + j(0.15)) * m * soft})
    pair("head/head-scale-horiz", j(0.18) - 0.3 * ft["length"] * m * soft)
    pair("head/head-scale-vert", j(0.15) + ft["length"] * m * (0.45 if female else 1.0) + (0.06 if not female else -0.06))
    pair("head/head-scale-depth", j(0.2))
    pair("head/head-back-scale-depth", j(0.3))
    # Adults have lost a child's round fullness; heavier people keep more.
    # (Women keep more of the soft tissue of the face than men do.)
    pair("head/head-fat", (weight - 0.5) * 1.1 + j(0.12) - (0.06 if female else 0.22) * adult * (1 - child))
    if age_t > 0:
        pair("head/head-age", 0.2 * adult + 0.7 * age_t**1.1)
    elif P.age >= 13:
        pair("head/head-age", -0.25 * (1 - adult))

    # ── Forehead and brow ──────────────────────────────────────────────────
    pair("forehead/forehead-scale-vert", j(0.35))
    pair("forehead/forehead-trans", j(0.35) - 0.15 * (P.masc - 0.5))  # + forward (upright)
    pair("forehead/forehead-temple", j(0.25) - 0.35 * age_t * (1 - weight) - (0.0 if female else 0.1) * adult)
    pair("forehead/forehead-nubian", j(0.3))
    ends("eyebrows/eyebrows-trans", ("backward", "forward"), (0.18 * (P.masc - 0.4) + j(0.2)) * m * (0.4 if female else 1.0))
    ends("eyebrows/eyebrows-trans", ("down", "up"), (j(0.22) - (0.0 if female else 0.08)) * m)
    # (The brows' resting angle stays level or a little up at the tail: the
    # "down" end draws the inner brows down into a scowl.)
    pair("eyebrows/eyebrows-angle", max(-0.08, min(0.1, j(0.1))) * m)

    # ── Eyes and lids ──────────────────────────────────────────────────────
    eo, ec, ed, eh, es, ez = EYE_TYPES[eye_t]
    both("eyes/{s}-eye-scale", (ez + j(0.18)) * m + 0.1 * child)
    both("eyes/{s}-eye-trans", (es + j(0.3)) * m, which=("in", "out"))
    both("eyes/{s}-eye-trans", j(0.15) * m, which=("down", "up"))
    both("eyes/{s}-eye-height1", j(0.25) * m)
    both("eyes/{s}-eye-height2", (eo + j(0.25)) * m + (0.05 if female else 0.0) - 0.2 * age_t)
    both("eyes/{s}-eye-height3", j(0.25) * m)
    both("eyes/{s}-eye-corner1", j(0.2) * m)
    both("eyes/{s}-eye-corner2", (ec + j(0.25)) * m - 0.15 * age_t)
    both("eyes/{s}-eye-push1", (ed + j(0.25)) * m + 0.15 * age_t, which=("in", "out"))
    both("eyes/{s}-eye-push2", j(0.25) * m, which=("in", "out"))
    both("eyes/{s}-eye-eyefold", (-eh + j(0.25)) * m - 0.35 * age_t, which=("down", "up"))
    both("eyes/{s}-eye-eyefold", j(0.3) * m, which=("concave", "convex"))
    both("eyes/{s}-eye-eyefold-angle", j(0.3) * m)
    both("eyes/{s}-eye-epicanthus", j(0.1) * m, which=("in", "out"))
    # Under the eyes: a little hollow in grown-ups, bags with age.
    both("eyes/{s}-eye-bag", 0.8 * age_t + 0.12 * adult + j(0.2) * m - 0.3 * child, which=("decr", "incr"))
    both("eyes/{s}-eye-bag-height", j(0.25) * m + 0.25 * age_t)
    both("eyes/{s}-eye-bag", (0.15 if female else 0.3) * adult + j(0.12), which=("out", "in"))

    # ── Nose ───────────────────────────────────────────────────────────────
    nl, nw, npj, nh, ncv, ntip, ntw, nnw, nfl, nbr = NOSE_TYPES[nose_t]
    nm = m * (0.55 if child > 0.5 else 1.0)
    pair("nose/nose-scale-vert", (nl + j(0.2)) * nm + 0.25 * age_t + (0.05 if not female else -0.08) - 0.2 * child)
    pair("nose/nose-scale-horiz", (nw + j(0.2)) * nm + 0.12 * age_t - (0.08 if female else 0.0))
    pair("nose/nose-scale-depth", (npj + j(0.2)) * nm - 0.2 * child)
    pair("nose/nose-hump", max(0.0, nh + j(0.2)) * (1 - child) * (0.75 if female else 1.0))
    pair("nose/nose-greek", (nbr + j(0.2)) * nm)
    pair("nose/nose-curve", (ncv + j(0.2)) * nm)
    pair("nose/nose-point-width", (ntw + j(0.2)) * nm + 0.15 * age_t)
    pair("nose/nose-point", (ntip + j(0.2)) * nm - 0.25 * age_t + 0.2 * child)
    pair("nose/nose-nostrils-width", (nnw + j(0.2)) * nm)
    pair("nose/nose-flaring", (nfl + j(0.2)) * nm)
    pair("nose/nose-volume", (0.3 * nw + j(0.2)) * nm)
    pair("nose/nose-septumangle", j(0.25) * nm)
    pair("nose/nose-base", j(0.25) * nm)
    pair("nose/nose-compression", j(0.15) * nm)
    pair("nose/nose-width1", (0.5 * nbr + j(0.2)) * nm)
    pair("nose/nose-width2", j(0.25) * nm)
    pair("nose/nose-width3", (0.5 * nw + j(0.2)) * nm)
    ends("nose/nose-trans", ("in", "out"), j(0.06) * nm)  # a nose that leans a little

    # ── Mouth and lips ─────────────────────────────────────────────────────
    lips = LIP_TYPES[lip_t] + (0.1 if female else 0.0) - 0.35 * age_t
    pair("mouth/mouth-scale-horiz", j(0.2) * m + 0.08 * adult)
    pair("mouth/mouth-upperlip-volume", lips + j(0.15))
    pair("mouth/mouth-lowerlip-volume", lips + 0.05 + j(0.2))
    pair("mouth/mouth-cupidsbow", j(0.35) * m + (0.12 if female else 0.0))
    pair("mouth/mouth-cupidsbow-width", j(0.3) * m)
    pair("mouth/mouth-upperlip-height", j(0.3) * m)
    pair("mouth/mouth-lowerlip-height", j(0.3) * m)
    pair("mouth/mouth-lowerlip-ext", j(0.25) * m)
    pair("mouth/mouth-upperlip-ext", j(0.25) * m)
    pair("mouth/mouth-lowerlip-middle", j(0.2) * m)
    pair("mouth/mouth-upperlip-middle", j(0.2) * m)
    pair("mouth/mouth-philtrum-volume", j(0.3) * m)
    # The corners of a grown-up's mouth sit level or a little down at rest.
    pair("mouth/mouth-angles", j(0.1) * m - (0.0 if female else 0.08) * adult - 0.3 * age_t)
    ends("mouth/mouth-trans", ("backward", "forward"), j(0.25) * m)
    # The folds from nose to mouth: a crease in every grown-up, deeper with age.
    ends("mouth/mouth-laugh-lines", ("out", "in"), (0.14 if female else 0.25) * adult + 0.5 * age_t + j(0.1))

    # ── Cheeks ─────────────────────────────────────────────────────────────
    both("cheek/{s}-cheek-bones", (ft["bones"] + j(0.3)) * m + 0.08 * (P.masc - 0.5))
    both("cheek/{s}-cheek-volume", j(0.25) * m + (weight - 0.5) * 0.6 + 0.3 * child - (-0.08 if female else 0.18) * adult - 0.35 * age_t * (1 - weight))
    both("cheek/{s}-cheek-inner", j(0.25) * m - (0.0 if female else 0.12) * adult)
    both("cheek/{s}-cheek-trans", j(0.25) * m)

    # ── Jaw and chin ───────────────────────────────────────────────────────
    pair("chin/chin-prominent", (ft["chin"] + j(0.3)) * m + 0.1 * (P.masc - 0.5))
    pair("chin/chin-width", (ft["jaw"] * 0.7 * soft + j(0.25)) * m + 0.2 * (P.masc - 0.5))
    pair("chin/chin-height", (ft["length"] * 0.6 * soft + j(0.3)) * m)
    pair("chin/chin-bones", (ft["jaw"] * soft + j(0.25)) * m + 0.25 * (P.masc - 0.5) - 0.2 * child)
    pair("chin/chin-prognathism", j(0.25) * m)
    pair("chin/chin-jaw-drop", j(0.2) * m)
    if not female and child < 0.5 and r.random() < 0.3:
        pair("chin/chin-cleft", r.uniform(0.2, 0.6))
    if female and face_t in ("heart", "oval", "diamond"):
        add({"chin/chin-triangle": r.uniform(0.1, 0.35)})

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
    pair("neck/neck-scale-vert", j(0.12) - 0.05)
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
