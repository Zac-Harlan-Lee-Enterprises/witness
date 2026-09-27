"""Who a portrait is: age and sex, the skin's history (sun, marks), hair and
head covering, how they sit, and a quiet resting mood.

Everything is derived from a person's appearance data and seeded from their
portrait id, so every person is distinct and every render of them is the
same. The casting table below adds what the story says and the appearance
data can't: ages, sexes where the data would guess wrong, how much of a
life is spent outdoors, and a mood that fits the person's part.

The face itself (skull, jaw, nose, eyes, lips, ears...) is MakeHuman's
anatomical model moved by weights drawn from the same seed: see
portrait_face.py.

Without a casting entry, age and sex are inferred as the world figures do
(tools/art/lib/people.py):

- `build` gives the age band: child, adult (18-50), elder (64-76);
- a beard marks a man; an adult without a beard whose head is covered with
  a veil or scarf is a woman; an adult man without a beard is young;
- the player's looks are children drawn to be neither boy nor girl.
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
    masc: float  # 0 feminine … 1 masculine
    child: float  # 0 adult … 1 a small child
    age_t: float  # 0 young … 1 elderly (wrinkles, grey)
    player: bool = False
    chapter: str = ""
    body_weight: float = 0.5  # set by portrait_face.identity
    # ── Brows ──────────────────────────────────────────────────────────────
    brow_thickness: float = 0.5
    brow_join: float = 0.0  # hairs between the brows
    # ── Resting expression (all small; 0 is a rested face) ─────────────────
    mood: str = "neutral"
    smile: float = 0.0  # the corners of the mouth up and back, cheeks raised
    eyes_smile: float = 0.0  # the lower lids up
    smile_asym: float = 0.0  # + the person's left side smiles more
    brow_inner: float = 0.0  # + inner brows raised (worry, pain), - drawn down (frown)
    brow_outer: float = 0.0  # + raised (interest, surprise)
    brow_asym: float = 0.0  # + the person's left brow higher
    lid_droop: float = 0.0  # heavy upper lids (weariness)
    squint: float = 0.0  # lower lids raised (sun, suspicion)
    mouth_down: float = 0.0
    press: float = 0.0  # lips pressed together
    gaze: tuple = (0.0, 0.0)  # degrees away from the camera: (+ person's left, + up)
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
    # A man's haircut: "curly", "crop" (close), "wavy" (longer, loose,
    # swept aside) or "straight" (longer, falling forward).
    hair_cut: str = "curly"
    recede: float = 0.0  # a receding hairline (degrees at the temples)
    # How a veil, scarf or hood sits: cm further back on the head, degrees
    # wider round the face, cm fuller as it falls.
    veil_back: float = 0.0
    veil_open: float = 0.0
    veil_full: float = 0.0
    # How each person sits for the portrait: degrees further round, cm higher
    # or lower, degrees of head tilt.
    pose_turn: float = 0.0
    pose_elev: float = 0.0
    pose_roll: float = 0.0
    grey: float = 0.0
    beard_length: float = 0.0
    fuzz: float = 0.0  # a teenager's first moustache


# ── Casting ─────────────────────────────────────────────────────────────────
# What each person's part in the story implies: age, sex (where the
# appearance data would guess wrong), how much of their life is spent in
# the sun, and a quiet expression that fits them. Moods are defined below.
# Faces are cast by type too (face, nose, eyes, lips: portrait_face.FACE_TYPES
# and the rest), so no two people read as the same face, and family members
# (Rivka and Yair; Shifra and Oded; Tamar, Asa and Amram) share a nose.
# Portrait ids are character ids; a later chapter's character who shares an
# id with an earlier one is `<id>.<chapter id>` (src/content/portrait-cast.ts).
CASTING = {
    # ── Chapter 1: The Road to Jericho ─────────────────────────────────────
    # Aunt Miriam: "my knees can't manage that road anymore". A healer.
    "miriam": dict(age=54, sex="f", mood="kind", sun=0.45, face="long", nose="aquiline", eyes="hooded", lips="medium"),
    # Malik: a jovial Nabataean caravan trader ("Ha! A careful one.").
    "malik": dict(age=44, sex="m", mood="jovial", sun=0.9, face="long", nose="aquiline", eyes="deep", lips="full"),
    "shimon": dict(age=72, sex="m", mood="calm-squint", sun=1.0, face="long", nose="convex", eyes="hooded", lips="thin"),
    # Tobiah the carter: sure of everything, right about nothing.
    "tobiah": dict(age=32, sex="m", mood="cocky", sun=0.75, hair="wavy", face="square", nose="straight", eyes="almond", lips="medium"),
    # Hadassah: a warm market weaver ("Oh — hello, dear.").
    "hadassah": dict(age=41, sex="f", mood="warm", sun=0.35, face="round", nose="broad", eyes="almond", lips="full"),
    # Ezer the baker: shouting about short measure.
    "ezer": dict(age=46, sex="m", mood="stern", sun=0.25, face="square", nose="bulbous", eyes="deep", lips="thin"),
    # Menashe: robbed and hurt on the road; most of his lines are spoken injured.
    "menashe": dict(age=36, sex="m", mood="pained", sun=0.55, scars=[((-2.1, 5.6), (-1.2, 4.6), 0.1)], face="oval", nose="straight", eyes="down", lips="medium"),
    # Hanan: a young Levite, still a student.
    # (Third pass: the bare-headed young men get their own faces and haircuts.)
    "hanan": dict(age=19, sex="m", mood="thoughtful", sun=0.15, hair="wavy", face="long", nose="bridge", eyes="almond", lips="thin"),
    "salome": dict(age=43, sex="f", mood="shrewd", sun=0.35, face="square", nose="bridge", eyes="deep", lips="thin"),
    # Rivka: her young son has a fever.
    "rivka": dict(age=37, sex="f", mood="worried", sun=0.3, face="heart", nose="straight", eyes="round", lips="full"),
    "natan": dict(age=7, sex="m", mood="curious", sun=0.1, curl=0.95, face="round", nose="snub", eyes="round", lips="full"),
    # Yair: a fig grower who tells the story of the road.
    "yair": dict(age=41, sex="m", mood="wistful", sun=0.85, face="diamond", nose="straight", eyes="round", lips="medium"),
    # ── Chapter 2: A Storm on Galilee ──────────────────────────────────────
    "shelomit": dict(age=71, sex="f", mood="kind", sun=0.65, face="oval", nose="aquiline", eyes="down", lips="thin"),
    # Uncle Elazar: master of the family boat, a fisherman since boyhood.
    "elazar": dict(age=45, sex="m", mood="hearty", sun=1.0, face="square", nose="broad", eyes="hooded", lips="full"),
    # Tamar: the player's cousin, a rower who teaches them the boat.
    "tamar": dict(age=17, sex="f", mood="bright", sun=0.75, face="heart", nose="straight", eyes="almond", lips="full"),
    "yoezer": dict(age=39, sex="m", mood="dour", sun=1.0, scars=[((2.6, -6.2), (3.4, -7.0), 0.09)], hair="crop", face="long", nose="convex", eyes="deep", lips="thin"),
    # Old Hanina: has read the lake for sixty years.
    "hanina": dict(age=76, sex="m", mood="shrewd-old", sun=1.0, face="diamond", nose="aquiline", eyes="hooded", lips="thin"),
    "nikanor": dict(age=48, sex="m", mood="salesman", sun=0.4, face="round", nose="bulbous", eyes="almond", lips="full"),
    # Shifra: a mother, frightened for her small son on the lake.
    "shifra": dict(age=31, sex="f", mood="anxious", sun=0.45, face="long", nose="straight", eyes="round", lips="medium"),
    # Ami: "Ami is so little."
    "ami": dict(age=6, sex="m", mood="wide-eyed", sun=0.15, curl=0.08, face="round", nose="snub", eyes="round", lips="medium"),
    "oded": dict(age=28, sex="m", mood="wry", sun=0.5, face="long", nose="straight", eyes="round", lips="medium"),
    "dinah": dict(age=52, sex="f", mood="thoughtful", sun=0.85, face="square", nose="broad", eyes="hooded", lips="medium"),
    # ── Chapter 3: A Journey to Bethlehem ──────────────────────────────────
    "tamar.journey-to-bethlehem": dict(age=36, sex="f", mood="warm", sun=0.4, face="diamond", nose="aquiline", eyes="almond", lips="full"),
    "amram": dict(age=74, sex="m", mood="kind", sun=0.6, face="oval", nose="aquiline", eyes="hooded", lips="thin"),
    # Uncle Asa, a stonemason, has stood in the registration line since midday.
    "asa": dict(age=40, sex="m", mood="wry-tired", sun=0.8, scars=[((-3.6, 4.4), (-3.2, 3.5), 0.08)], hair="straight", face="square", nose="aquiline", eyes="almond", lips="medium"),
    "peninah": dict(age=33, sex="f", mood="gentle", sun=0.3, face="round", nose="straight", eyes="down", lips="medium"),
    # Kallias the clerk: "by tonight my hand will fall off".
    "kallias": dict(age=27, sex="m", mood="harried", sun=0.1, hair="crop", recede=4.0, face="oval", nose="bridge", eyes="almond", lips="thin"),
    # Hagit: "I've lived in Bethlehem seventy years."
    "hagit": dict(age=77, sex="f", mood="wonder", sun=0.7, face="long", nose="bulbous", eyes="deep", lips="thin"),
    # Cousin Yonatan: a young shepherd (his scarf would make the data guess a woman).
    "yonatan": dict(age=16, sex="m", mood="open", sun=0.9, face="oval", nose="straight", eyes="almond", lips="full"),
    "yoram": dict(age=75, sex="m", mood="kind", sun=1.0, face="long", nose="broad", eyes="deep", lips="medium"),
    # Zerah: a basket-maker with a lame leg, turned away from every door.
    "zerah": dict(age=66, sex="m", mood="weary-kind", sun=0.7, face="diamond", nose="convex", eyes="down", lips="thin"),
    # ── Chapter 4: A Letter from Paul ──────────────────────────────────────
    # Ammia: proud, hurt, slow to forgive her apprentice.
    "ammia": dict(age=69, sex="f", mood="stern", sun=0.3, face="long", nose="bridge", eyes="deep", lips="thin"),
    # Kallias the apprentice: ashamed, hungry, working off a debt.
    "kallias.letter-from-paul": dict(age=22, sex="m", mood="ashamed", sun=0.45, face="heart", nose="straight", eyes="down", lips="medium"),
    # Zenon: a scribe, freed at thirty, dry-humoured.
    "zenon": dict(age=48, sex="m", mood="dry", sun=0.1, hair="straight", recede=7.0, face="long", nose="bridge", eyes="hooded", lips="thin"),
    # Attalos: "Twenty years on this road."
    "attalos": dict(age=43, sex="m", mood="squint-smile", sun=1.0, face="square", nose="broad", eyes="deep", lips="medium"),
    "tatia": dict(age=35, sex="f", mood="cheerful", sun=0.4, face="heart", nose="snub", eyes="round", lips="full"),
    "menandros": dict(age=51, sex="m", mood="salesman", sun=0.6, hair="crop", recede=6.0, face="round", nose="bulbous", eyes="almond", lips="full"),
    "nikon": dict(age=46, sex="m", mood="firm", sun=0.5, hair="crop", recede=3.0, face="square", nose="aquiline", eyes="deep", lips="thin"),
    # Chrysis: enslaved at the dye works; guarded, dignified.
    "chrysis": dict(age=29, sex="f", mood="guarded", sun=0.6, face="oval", nose="broad", eyes="almond", lips="full"),
    # ── The player's looks (children of about ten, neither boy nor girl) ────
    "player-look-1": dict(face="oval", nose="straight", eyes="almond", lips="medium"),
    "player-look-2": dict(face="round", nose="snub", eyes="round", lips="full"),
    "player-look-3": dict(face="heart", nose="straight", eyes="almond", lips="medium"),
    "player-look-4": dict(face="long", nose="broad", eyes="round", lips="full"),
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


def params_for(pid, appearance, player=False, chapter=""):
    a = appearance
    seed = seed_of(pid)
    r = random.Random(seed)

    def j(spread):
        return r.uniform(-1.0, 1.0) * spread

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
    p = Params(id=pid, appearance=a, seed=seed, age=age, sex=sex, masc=masc, child=child, age_t=age_t, player=player, chapter=chapter)
    mb = masc * max(0.0, min(1.0, (age - 13.0) / 7.0))  # adult masculine features

    # ── Brows ──────────────────────────────────────────────────────────────
    p.brow_thickness = max(0.1, 0.45 + j(0.3) + 0.3 * mb - 0.1 * child)
    p.brow_join = max(0.0, j(1.2) - 0.4) * mb

    # ── Skin and its history ───────────────────────────────────────────────
    build = a["build"]
    default_sun = 0.35 if build == "elder" else (0.1 if build == "child" else 0.4)
    p.sun = float(cast.get("sun", default_sun))
    p.oil = (0.35 + r.random() * 0.4 + 0.1 * mb - 0.2 * age_t) * (1 - 0.6 * child)
    p.redness = 0.25 + r.random() * 0.3 + 0.2 * p.sun
    # Freckles, and for those who work outdoors the spots of a life in the sun.
    p.freckles = max(0.0, r.random() * 1.2 - 0.6) * (0.4 + p.sun) + (0.25 + 0.6 * age_t) * max(0.0, p.sun - 0.4)
    n_moles = r.choices((0, 1, 2, 3), (3, 3, 2, 1))[0]
    moles = []
    for _ in range(n_moles):
        # Somewhere on the face, away from the eyes and lips (x, z in cm).
        side = 1 if r.random() < 0.5 else -1
        x, z = r.choice([(4.2, -1.5), (3.6, -4.8), (1.8, -7.0), (4.8, 3.5), (2.5, 7.5), (5.2, -3.2), (1.4, -3.0)])
        moles.append((side * (x + j(0.5)), z + j(0.5), 0.08 + r.random() * 0.1, 0.5 + r.random() * 0.4))
    p.moles = moles
    p.scars = list(cast.get("scars", []))
    if not a["beard"] and sex == "m" and age >= 18:
        p.stubble = 0.55 + r.random() * 0.4
    if sex == "m" and 14 <= age < 18:
        p.fuzz = 0.6

    # ── Resting mood ───────────────────────────────────────────────────────
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
    p.hair_curl = float(cast.get("curl", 0.35 + r.random() * 0.55))
    p.hair_cut = cast.get("hair", "curly")
    p.recede = float(cast.get("recede", 0.0))
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
    # How the covering sits and how the person sits: separate random streams.
    vr = random.Random(seed_of(pid + ":veil"))
    p.veil_back = vr.uniform(-0.4, 0.6)
    p.veil_open = vr.uniform(-4.0, 4.0)
    p.veil_full = vr.uniform(0.0, 0.5)  # (never tighter: an ear would show through)
    pr = random.Random(seed_of(pid + ":pose"))
    p.pose_turn = pr.uniform(-4.0, 4.0)
    p.pose_elev = pr.uniform(-1.8, 1.8)
    p.pose_roll = pr.uniform(-2.5, 2.5)
    return p


def describe(p):
    return f"{p.id}: {p.sex} {p.age:.0f}, child {p.child:.2f}, masc {p.masc:.2f}, mood {p.mood}, sun {p.sun:.2f}, iris {p.iris_kind}, hair {p.hair_style}/{p.hair_cut}, cover {p.head_style}, beard {p.beard_length:.1f}"
