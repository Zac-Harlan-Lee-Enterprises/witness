"""Who a portrait is: age and sex, the shape of the face, its small
asymmetries, the skin's history (sun, marks) and a quiet expression.

Everything is derived from a person's appearance data and seeded from their
portrait id, so every person is distinct and every render of them is the
same. The casting table below adds what the story says and the appearance
data can't: ages, sexes where the data would guess wrong, how much of a
life is spent outdoors, and a mood that fits the person's part.

Without a casting entry, age and sex are inferred as the world figures do
(tools/art/lib/people.py):

- `build` gives the age band: child, adult (18-50), elder (64-76);
- a beard marks a man; an adult without a beard whose head is covered with
  a veil or scarf is a woman; an adult man without a beard is young;
- the player's looks are children drawn to be neither boy nor girl.

Faces are built from a few broad types (a nose, a face shape, an eye) and
then moved continuously, so no two people share a nose, a mouth or a jaw.
"""
import hashlib
import random
from dataclasses import dataclass, field


def seed_of(text):
    return int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:4], "big")


@dataclass
class Params:
    id: str
    appearance: dict
    seed: int
    age: float
    sex: str  # "f", "m", or "x" (a child drawn to be neither)
    masc: float  # 0 feminine … 1 masculine bone structure
    child: float  # 0 adult … 1 a small child
    age_t: float  # 0 young … 1 elderly (wrinkles, grey)
    player: bool = False
    # ── Size and the shape of the face ─────────────────────────────────────
    scale: float = 1.0
    face_width: float = 1.0
    face_length: float = 1.0
    lower_face: float = 1.0  # length of the face below the nose
    jaw_width: float = 1.0
    jaw_angle: float = 0.0  # + a high, sharp angle of the jaw; - soft and low
    chin: float = 0.0  # projection
    chin_width: float = 1.0
    chin_cleft: float = 0.0
    cheekbone: float = 0.5
    fullness: float = 0.3  # soft tissue: cheeks, under the jaw
    forehead: float = 0.0  # + sloping back, - upright
    brow_ridge: float = 1.0
    # ── Nose ───────────────────────────────────────────────────────────────
    nose_type: str = "straight"
    nose_length: float = 1.0
    bridge: float = 0.0  # height of the root of the nose: + high, - low
    bridge_width: float = 1.0
    bridge_round: float = 3.0  # profile of the bridge: 2 rounded … 3.6 flat-topped
    nose_hump: float = 0.0
    nose_scoop: float = 0.0
    nose_projection: float = 0.45
    tip_rotation: float = 0.0  # + upturned, - drooping
    tip_width: float = 1.0
    alar_width: float = 1.0
    alar_flare: float = 1.0
    nose_deviation: float = 0.0  # cm at the tip, to the person's left (+)
    # ── Eyes and brows ─────────────────────────────────────────────────────
    eye_spacing: float = 0.0
    eye_depth: float = 0.0
    eye_open: float = 0.5
    eye_width: float = 0.0  # length of the opening: + long, almond
    canthal_tilt: float = 4.0
    lid_hood: float = 0.3
    crease: float = 1.0  # height of the upper lid crease
    bags: float = 0.0
    brow_thickness: float = 0.5
    brow_height: float = 0.0
    brow_arch: float = 0.5
    brow_join: float = 0.0  # hairs between the brows
    # ── Mouth and ears ─────────────────────────────────────────────────────
    mouth_width: float = 1.0
    lip_upper: float = 0.6
    lip_lower: float = 0.7
    bow: float = 0.5  # definition of the Cupid's bow
    lip_projection: float = 0.0
    philtrum: float = 0.5
    ear_size: float = 1.0
    ear_out: float = 0.0
    # ── Expression (all small; 0 is a rested face) ─────────────────────────
    mood: str = "neutral"
    smile: float = 0.0  # the mouth: corners up and back, cheeks raised
    eyes_smile: float = 0.0  # the eyes: lower lids up, crow's feet
    smile_asym: float = 0.0  # + the person's left side smiles more
    brow_inner: float = 0.0  # + inner brows raised (worry, pain), - drawn down (frown)
    brow_outer: float = 0.0  # + raised (interest, surprise)
    brow_asym: float = 0.0  # + the person's left brow higher
    lid_droop: float = 0.0  # heavy upper lids (weariness)
    squint: float = 0.0  # lower lids raised (sun, suspicion)
    mouth_down: float = 0.0
    press: float = 0.0  # lips pressed together
    gaze: tuple = (0.0, 0.0)  # degrees away from the camera: (+ person's left, + up)
    # ── Asymmetry: per side (-1 right, +1 left), small ─────────────────────
    asym: dict = field(default_factory=dict)
    # ── Skin and its history ───────────────────────────────────────────────
    sun: float = 0.3  # how much of a life is spent in the sun
    oil: float = 0.5
    freckles: float = 0.0
    moles: list = field(default_factory=list)  # (x, z, radius cm, darkness)
    scars: list = field(default_factory=list)  # ((x0, z0), (x1, z1), width cm)
    stubble: float = 0.0  # a clean-shaven man's day of growth
    redness: float = 0.3
    # ── Colouring and hair ─────────────────────────────────────────────────
    iris: str = "#3b2616"
    iris_kind: str = "brown"
    hair_style: str = "short"
    head_style: str = "none"  # how the head covering is worn (see portrait_cloth)
    hair_curl: float = 0.5
    grey: float = 0.0
    beard_length: float = 0.0
    fuzz: float = 0.0  # a teenager's first moustache


# ── Casting ─────────────────────────────────────────────────────────────────
# What each person's part in the story implies: age, sex (where the
# appearance data would guess wrong), how much of their life is spent in
# the sun, and a quiet expression that fits them. Moods are defined below.
# Portrait ids are character ids; a later chapter's character who shares an
# id with an earlier one is `<id>.<chapter id>` (src/content/portrait-cast.ts).
CASTING = {
    # ── Chapter 1: The Road to Jericho ─────────────────────────────────────
    # Aunt Miriam: "my knees can't manage that road anymore". A healer.
    "miriam": dict(age=54, sex="f", mood="kind", sun=0.45),
    # Malik: a jovial Nabataean caravan trader ("Ha! A careful one.").
    "malik": dict(age=44, sex="m", mood="jovial", sun=0.9),
    "shimon": dict(age=72, sex="m", mood="calm-squint", sun=1.0),
    # Tobiah the carter: sure of everything, right about nothing.
    "tobiah": dict(age=32, sex="m", mood="cocky", sun=0.75),
    # Hadassah: a warm market weaver ("Oh — hello, dear.").
    "hadassah": dict(age=41, sex="f", mood="warm", sun=0.35),
    # Ezer the baker: shouting about short measure.
    "ezer": dict(age=46, sex="m", mood="stern", sun=0.25),
    # Menashe: robbed and hurt on the road; most of his lines are spoken injured.
    "menashe": dict(age=36, sex="m", mood="pained", sun=0.55, scars=[((-2.1, 5.6), (-1.2, 4.6), 0.1)]),
    # Hanan: a young Levite, still a student.
    "hanan": dict(age=19, sex="m", mood="thoughtful", sun=0.15),
    "salome": dict(age=43, sex="f", mood="shrewd", sun=0.35),
    # Rivka: her young son has a fever.
    "rivka": dict(age=37, sex="f", mood="worried", sun=0.3),
    "natan": dict(age=7, sex="m", mood="curious", sun=0.1),
    # Yair: a fig grower who tells the story of the road.
    "yair": dict(age=41, sex="m", mood="wistful", sun=0.85),
    # ── Chapter 2: A Storm on Galilee ──────────────────────────────────────
    "shelomit": dict(age=71, sex="f", mood="kind", sun=0.65),
    # Uncle Elazar: master of the family boat, a fisherman since boyhood.
    "elazar": dict(age=45, sex="m", mood="hearty", sun=1.0),
    # Tamar: the player's cousin, a rower who teaches them the boat.
    "tamar": dict(age=17, sex="f", mood="bright", sun=0.75),
    "yoezer": dict(age=39, sex="m", mood="dour", sun=1.0, scars=[((2.6, -6.2), (3.4, -7.0), 0.09)]),
    # Old Hanina: has read the lake for sixty years.
    "hanina": dict(age=76, sex="m", mood="shrewd-old", sun=1.0),
    "nikanor": dict(age=48, sex="m", mood="salesman", sun=0.4),
    # Shifra: a mother, frightened for her small son on the lake.
    "shifra": dict(age=31, sex="f", mood="anxious", sun=0.45),
    # Ami: "Ami is so little."
    "ami": dict(age=6, sex="m", mood="wide-eyed", sun=0.15),
    "oded": dict(age=28, sex="m", mood="wry", sun=0.5),
    "dinah": dict(age=52, sex="f", mood="thoughtful", sun=0.85),
    # ── Chapter 3: A Journey to Bethlehem ──────────────────────────────────
    "tamar.journey-to-bethlehem": dict(age=36, sex="f", mood="warm", sun=0.4),
    "amram": dict(age=74, sex="m", mood="kind", sun=0.6),
    # Uncle Asa, a stonemason, has stood in the registration line since midday.
    "asa": dict(age=40, sex="m", mood="wry-tired", sun=0.8, scars=[((-3.6, 4.4), (-3.2, 3.5), 0.08)]),
    "peninah": dict(age=33, sex="f", mood="gentle", sun=0.3),
    # Kallias the clerk: "by tonight my hand will fall off".
    "kallias": dict(age=27, sex="m", mood="harried", sun=0.1),
    # Hagit: "I've lived in Bethlehem seventy years."
    "hagit": dict(age=77, sex="f", mood="wonder", sun=0.7),
    # Cousin Yonatan: a young shepherd (his scarf would make the data guess a woman).
    "yonatan": dict(age=16, sex="m", mood="open", sun=0.9),
    "yoram": dict(age=75, sex="m", mood="kind", sun=1.0),
    # Zerah: a basket-maker with a lame leg, turned away from every door.
    "zerah": dict(age=66, sex="m", mood="weary-kind", sun=0.7),
    # ── Chapter 4: A Letter from Paul ──────────────────────────────────────
    # Ammia: proud, hurt, slow to forgive her apprentice.
    "ammia": dict(age=69, sex="f", mood="stern", sun=0.3),
    # Kallias the apprentice: ashamed, hungry, working off a debt.
    "kallias.letter-from-paul": dict(age=22, sex="m", mood="ashamed", sun=0.45),
    # Zenon: a scribe, freed at thirty, dry-humoured.
    "zenon": dict(age=48, sex="m", mood="dry", sun=0.1),
    # Attalos: "Twenty years on this road."
    "attalos": dict(age=43, sex="m", mood="squint-smile", sun=1.0),
    "tatia": dict(age=35, sex="f", mood="cheerful", sun=0.4),
    "menandros": dict(age=51, sex="m", mood="salesman", sun=0.6),
    "nikon": dict(age=46, sex="m", mood="firm", sun=0.5),
    # Chrysis: enslaved at the dye works; guarded, dignified.
    "chrysis": dict(age=29, sex="f", mood="guarded", sun=0.6),
}

# A quiet expression for each part. Values are small: a portrait is a
# person at rest, a little of their mood showing.
MOODS = {
    "neutral": {},
    "open": dict(smile=0.22, eyes_smile=0.18, brow_outer=0.08),
    "kind": dict(smile=0.3, eyes_smile=0.4, brow_inner=0.12),
    "warm": dict(smile=0.45, eyes_smile=0.55),
    "gentle": dict(smile=0.28, eyes_smile=0.3, brow_inner=0.15),
    "jovial": dict(smile=0.62, eyes_smile=0.7, brow_outer=0.15, smile_asym=0.15),
    "bright": dict(smile=0.4, eyes_smile=0.35, brow_outer=0.12),
    "cheerful": dict(smile=0.55, eyes_smile=0.55, brow_outer=0.05),
    "hearty": dict(smile=0.4, eyes_smile=0.5, squint=0.2),
    "salesman": dict(smile=0.5, eyes_smile=0.3, brow_outer=0.25, smile_asym=0.25),
    "cocky": dict(smile=0.38, eyes_smile=0.15, smile_asym=0.7, brow_outer=0.15, brow_asym=-0.4),
    "wry": dict(smile=0.26, eyes_smile=0.15, smile_asym=-0.6),
    "wry-tired": dict(smile=0.2, eyes_smile=0.12, smile_asym=0.5, lid_droop=0.25),
    "dry": dict(smile=0.16, smile_asym=0.6, brow_asym=0.6, brow_outer=0.15, lid_droop=0.1),
    "squint-smile": dict(smile=0.32, eyes_smile=0.45, squint=0.4),
    "calm-squint": dict(squint=0.35, smile=0.1, lid_droop=0.15),
    "shrewd": dict(smile=0.14, smile_asym=0.5, squint=0.2, brow_asym=0.5),
    "shrewd-old": dict(squint=0.4, smile=0.12, brow_inner=-0.15),
    "stern": dict(brow_inner=-0.45, press=0.35, mouth_down=0.15),
    "firm": dict(brow_inner=-0.22, press=0.22),
    "dour": dict(mouth_down=0.28, brow_inner=-0.12, lid_droop=0.18),
    "pained": dict(brow_inner=0.6, lid_droop=0.3, mouth_down=0.25, press=0.1, gaze=(0.0, -3.0)),
    "worried": dict(brow_inner=0.45, smile=0.08, lid_droop=0.05),
    "anxious": dict(brow_inner=0.5, press=0.15),
    "ashamed": dict(brow_inner=0.45, lid_droop=0.25, press=0.25, gaze=(0.0, -5.0)),
    "harried": dict(brow_inner=0.25, lid_droop=0.25, press=0.1),
    "guarded": dict(press=0.3, lid_droop=0.15, squint=0.15, brow_inner=-0.1),
    "thoughtful": dict(smile=0.1, brow_inner=0.12, lid_droop=0.1),
    "wistful": dict(smile=0.18, eyes_smile=0.18, brow_inner=0.22),
    "wonder": dict(brow_inner=0.35, brow_outer=0.3, smile=0.1, lid_droop=-0.1, gaze=(6.0, 2.0)),
    "weary-kind": dict(smile=0.2, eyes_smile=0.22, brow_inner=0.35, lid_droop=0.25),
    "curious": dict(brow_outer=0.3, brow_inner=0.2, smile=0.18),
    "wide-eyed": dict(brow_inner=0.3, brow_outer=0.3, lid_droop=-0.2),
}

# Eyes: mostly dark brown, some hazel or amber (sRGB).
IRISES = [
    ("brown", "#2a1a10"),
    ("brown", "#2e1d12"),
    ("brown", "#34200f"),
    ("brown", "#3b2616"),
    ("brown", "#3b2616"),
    ("brown", "#2a1a10"),
    ("brown", "#402a16"),
    ("amber", "#5a3818"),
    ("hazel", "#4d4424"),
]

# Broad nose types, then moved continuously. (weight for men, for women)
NOSES = {
    "straight": (3, 4),
    "aquiline": (3, 1),
    "convex": (3, 2),
    "broad": (3, 3),
    "snub": (0.5, 2),
    "bulbous": (2, 1),
}


def is_female(a):
    return (not a["beard"]) and a["headwear"] in ("veil", "scarf") and a["build"] != "child"


def _sex_and_age(pid, a, player, r):
    """(sex, age) from the casting table, or inferred from the appearance."""
    cast = CASTING.get(pid, {})
    build = a["build"]
    if build == "child":
        sex = "x" if player else "m"
        age = 9.5 + r.random() * 1.5
    elif build == "elder":
        sex = "f" if (not a["beard"] and a["headwear"] in ("veil", "scarf", "hood")) else "m"
        age = 64 + r.random() * 12
    elif is_female(a):
        sex = "f"
        age = 24 + r.random() * 22
    elif not a["beard"]:
        sex = "m"
        age = 18 + r.random() * 4  # a young man, before his beard
    else:
        sex = "m"
        age = 26 + r.random() * 24
    return cast.get("sex", sex), float(cast.get("age", age))


def params_for(pid, appearance, player=False):
    a = appearance
    seed = seed_of(pid)
    r = random.Random(seed)

    def j(spread):
        # Evenly spread within the range: faces differ visibly but stay
        # within ordinary anatomy.
        return r.uniform(-1.0, 1.0) * spread

    def pick(options):
        total = sum(w for _, w in options)
        x = r.random() * total
        for v, w in options:
            x -= w
            if x <= 0:
                return v
        return options[-1][0]

    cast = CASTING.get(pid, {})
    sex, age = _sex_and_age(pid, a, player, r)
    female = sex == "f"
    if sex == "x":
        masc = 0.5
    elif female:
        masc = 0.08 + r.random() * 0.14
    else:
        masc = 0.86 + r.random() * 0.14
    # How much of a child's face: a six-year-old fully, a ten-year-old mostly,
    # a teenager a little.
    child = max(0.0, min(1.0, (17.5 - age) / 10.0)) ** 0.8 if age < 17.5 else 0.0
    if age < 16:
        masc = 0.5 + (masc - 0.5) * 0.35  # before puberty, faces barely differ
    age_t = max(0.0, min(1.0, (age - 30.0) / 42.0))
    young_adult = max(0.0, min(1.0, (age - 13.0) / 7.0))  # 0 child … 1 grown

    p = Params(id=pid, appearance=a, seed=seed, age=age, sex=sex, masc=masc, child=child, age_t=age_t, player=player)
    mb = masc * young_adult  # adult masculine features

    # ── The face ───────────────────────────────────────────────────────────
    shape = pick([("oval", 3), ("round", 2), ("square", 2), ("long", 2), ("heart", 1.5), ("diamond", 1.2)])
    fw, fl, jw, ch, cb = {
        "oval": (0.0, 0.0, 0.0, 0.0, 0.0),
        "round": (0.06, -0.05, 0.04, -0.2, -0.1),
        "square": (0.04, -0.02, 0.1, 0.2, 0.0),
        "long": (-0.05, 0.07, -0.03, 0.2, 0.0),
        "heart": (0.03, 0.0, -0.09, -0.1, 0.25),
        "diamond": (-0.02, 0.03, -0.06, 0.15, 0.35),
    }[shape]
    p.scale = (0.9 + 0.1 * young_adult) * (0.955 + 0.045 * masc) * (1 + j(0.025))
    p.face_width = 1.0 + fw + j(0.06) + 0.04 * child + (0.03 if female else 0.0)
    p.face_length = 0.98 + fl + j(0.05) - (0.05 if female else 0.0)
    p.lower_face = 1.0 + j(0.05) + 0.02 * mb - (0.04 if female else 0.0)
    p.jaw_width = 1.0 + jw * (0.4 if female else 1.0) + j(0.07) + 0.04 * mb - 0.06 * child - (0.04 if female else 0.0)
    p.jaw_angle = j(0.6) + 0.35 * mb + (0.3 if shape == "square" else 0.0) - 0.5 * child
    p.chin = ch + j(0.7) + 0.2 * mb
    p.chin_width = 1.0 + j(0.12) + 0.05 * mb - (0.1 if female else 0.0) + (0.1 if shape == "square" else 0.0)
    p.chin_cleft = max(0.0, j(1.4) - 0.6) * mb
    p.cheekbone = 0.5 + cb + j(0.3)
    p.fullness = 0.3 + j(0.3) + 0.35 * child + 0.28 * (1 - masc) - 0.1 * age_t + (0.12 if shape == "round" else 0.0)
    p.forehead = j(0.6) + 0.3 * mb - 0.5 * child
    p.brow_ridge = 0.8 + j(0.3)

    # ── The nose ───────────────────────────────────────────────────────────
    nt = pick([(k, w[1] if female else w[0]) for k, w in NOSES.items()])
    if child > 0.6:
        nt = "snub" if r.random() < 0.6 else "straight"
    p.nose_type = nt
    base = {
        # length, bridge, width, round, hump, scoop, proj, tip rot, tip w, alar w, flare
        "straight": (1.0, 0.1, 1.0, 3.0, 0.0, 0.0, 0.45, 0.0, 1.0, 1.0, 1.0),
        "aquiline": (1.07, 0.5, 0.95, 2.8, 1.0, 0.0, 0.55, -0.55, 0.95, 1.0, 0.95),
        "convex": (1.04, 0.3, 1.05, 3.0, 0.55, 0.0, 0.5, -0.25, 1.05, 1.08, 1.05),
        "broad": (0.97, -0.2, 1.25, 3.4, 0.1, 0.05, 0.36, 0.05, 1.22, 1.28, 1.2),
        "snub": (0.9, -0.35, 0.95, 2.6, 0.0, 0.55, 0.36, 0.6, 1.05, 0.98, 1.05),
        "bulbous": (1.03, 0.0, 1.1, 3.2, 0.2, 0.0, 0.5, -0.2, 1.35, 1.12, 1.12),
    }[nt]
    p.nose_length = base[0] + j(0.06) + 0.05 * age_t
    p.bridge = base[1] + j(0.25) - 0.6 * child
    p.bridge_width = base[2] + j(0.1) + 0.05 * mb
    p.bridge_round = base[3] + j(0.3)
    p.nose_hump = max(0.0, base[4] + j(0.3)) * (1 - child)
    p.nose_scoop = max(0.0, base[5] + j(0.15)) + 0.4 * child
    p.nose_projection = base[6] + j(0.12) + 0.08 * mb
    p.tip_rotation = base[7] + j(0.25) + 0.25 * child - 0.3 * age_t
    p.tip_width = base[8] + j(0.1) + 0.08 * age_t
    p.alar_width = base[9] + j(0.08) + 0.06 * mb + 0.06 * age_t
    p.alar_flare = base[10] + j(0.1)
    p.nose_deviation = j(0.12) * (1 - 0.85 * child)

    # ── Eyes and brows ─────────────────────────────────────────────────────
    eye = pick([("almond", 3), ("hooded", 2.5), ("deep", 2.0), ("round", 1.2), ("down", 1.2)])
    p.eye_spacing = j(0.6)
    p.eye_depth = j(0.35) + 0.3 * age_t + (0.45 if eye == "deep" else 0.0) + 0.2 * mb - 0.3 * child
    p.eye_open = 0.45 + j(0.25) + 0.25 * child + (0.12 if female else 0.0) + (0.2 if eye == "round" else 0.0) - (0.15 if eye == "hooded" else 0.0) - 0.15 * age_t
    p.eye_width = j(0.5) + (0.5 if eye == "almond" else 0.0) - 0.3 * child
    p.canthal_tilt = 3.0 + j(2.5) + (1.5 if female else 0.0) - (4.0 if eye == "down" else 0.0)
    p.lid_hood = max(0.0, 0.25 + j(0.2) + (0.45 if eye == "hooded" else 0.0) + 0.5 * age_t - 0.2 * child)
    p.crease = 1.0 + j(0.2) - (0.25 if eye == "hooded" else 0.0)
    p.bags = max(0.0, 0.15 + j(0.15) + 0.9 * age_t + 0.3 * max(0.0, (age - 30) / 20) - 0.3 * child)
    p.brow_thickness = max(0.1, 0.45 + j(0.3) + 0.3 * mb - 0.1 * child)
    p.brow_height = j(0.25)
    p.brow_arch = 0.45 + j(0.25) + 0.3 * (1 - masc)
    p.brow_join = max(0.0, j(1.2) - 0.4) * mb

    # ── Mouth and ears ─────────────────────────────────────────────────────
    lips = pick([("thin", 1.0), ("medium", 3.0), ("full", 3.0), ("very full", 1.2)])
    lv = {"thin": 0.2, "medium": 0.6, "full": 0.95, "very full": 1.3}[lips]
    p.mouth_width = 1.0 + j(0.07) - 0.08 * child
    p.lip_upper = min(1.1 + 0.4 * (1 - masc), max(0.05, lv + j(0.15) + 0.15 * (1 - masc) - 0.35 * age_t))
    p.lip_lower = min(1.15 + 0.4 * (1 - masc), max(0.1, lv + 0.12 + j(0.2) + 0.1 * (1 - masc) - 0.3 * age_t))
    p.bow = 0.5 + j(0.35) + 0.2 * child + 0.15 * (1 - masc)
    p.lip_projection = j(0.35)
    p.philtrum = 0.5 + j(0.3) + 0.2 * child
    p.ear_size = 1.0 + j(0.09) + 0.08 * child
    p.ear_out = max(0.0, j(1.0))

    # ── Small asymmetries (cm unless noted) ────────────────────────────────
    # Enough to keep a face from looking mirrored, never enough to read as
    # a deformity; children's faces are more symmetric than adults'.
    sym = 0.5 * (1 - 0.75 * child)
    p.asym = {
        "eye_z": j(0.09) * sym,
        "eye_open": j(0.1) * sym,
        "brow_z": j(0.12) * sym,
        "mouth_z": j(0.06) * sym,
        "cheek": j(0.08) * sym,
        "jaw": j(0.12) * sym,
        "ear_z": j(0.25) * sym,
    }

    # ── Skin and its history ───────────────────────────────────────────────
    build = a["build"]
    default_sun = 0.35 if build == "elder" else (0.1 if build == "child" else 0.4)
    p.sun = float(cast.get("sun", default_sun))
    p.oil = (0.35 + r.random() * 0.4 + 0.1 * mb - 0.2 * age_t) * (1 - 0.6 * child)
    p.redness = 0.25 + r.random() * 0.3 + 0.2 * p.sun
    p.freckles = max(0.0, r.random() * 1.2 - 0.6) * (0.4 + p.sun) + 0.4 * age_t * p.sun
    n_moles = pick([(0, 3), (1, 3), (2, 2), (3, 1)])
    moles = []
    for _ in range(n_moles):
        # Somewhere on the face, away from the eyes and lips.
        side = 1 if r.random() < 0.5 else -1
        x, z = r.choice([(4.2, -1.5), (3.6, -4.8), (1.8, -7.0), (4.8, 3.5), (2.5, 7.5), (5.2, -3.2), (1.4, -3.0)])
        moles.append((side * (x + j(0.5)), z + j(0.5), 0.08 + r.random() * 0.1, 0.5 + r.random() * 0.4))
    p.moles = moles
    p.scars = list(cast.get("scars", []))
    if not a["beard"] and sex == "m" and age >= 18:
        p.stubble = 0.55 + r.random() * 0.4
    if sex == "m" and 14 <= age < 18:
        p.fuzz = 0.6

    # ── Expression ─────────────────────────────────────────────────────────
    mood = cast.get("mood", "open" if player else "neutral")
    p.mood = mood
    ex = dict(MOODS[mood])
    if player:
        # The player's looks: open, friendly, and a little different each.
        ex = dict(smile=0.18 + r.random() * 0.1, eyes_smile=0.15, brow_outer=0.08 + r.random() * 0.1)
    for k, v in ex.items():
        setattr(p, k, v)

    # ── Colouring and hair ─────────────────────────────────────────────────
    kind, iris = r.choice(IRISES)
    p.iris, p.iris_kind = iris, kind
    p.hair_curl = 0.35 + r.random() * 0.55
    if child > 0.5:
        p.hair_style = "child"
    elif female:
        p.hair_style = "long"
    else:
        p.hair_style = "short"
    # How the covering is worn: a man's scarf is a head cloth held on by a
    # cord; a woman's or a child's falls from the crown to the shoulders.
    hw = a["headwear"]
    if hw == "scarf" and sex == "m" and child < 0.5:
        p.head_style = "headcloth"
    else:
        p.head_style = hw
    p.grey = 0.0 if age < 38 else min(1.0, (age - 38) / 30.0)
    if a["beard"]:
        if build == "elder":
            p.beard_length = 8.0 + r.random() * 5.0
        elif r.random() < 0.35:
            p.beard_length = 1.3 + r.random() * 0.8  # kept short
        else:
            p.beard_length = 2.6 + r.random() * 2.4
    return p


def describe(p):
    return (
        f"{p.id}: {p.sex} {p.age:.0f}, child {p.child:.2f}, masc {p.masc:.2f}, mood {p.mood}, nose {p.nose_type} "
        f"(len {p.nose_length:.2f}, bridge {p.bridge:.2f}, hump {p.nose_hump:.2f}, alar {p.alar_width:.2f}), "
        f"lips {p.lip_upper:.2f}/{p.lip_lower:.2f}, sun {p.sun:.2f}, iris {p.iris_kind}"
    )
