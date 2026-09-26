"""Who a portrait is: face shape, age and colouring, derived from a person's
appearance data and seeded from their id, so every person is distinct and
every render of them is the same.

The game's appearance data has no age or sex. They are inferred the same
way the world figures infer them (tools/art/lib/people.py):

- `build` gives the age band: child (about 11), adult (18-50), elder (62-76);
- a beard marks a man; an adult without a beard whose head is covered with
  a veil or scarf is a woman; an adult man without a beard is young;
- children are drawn with soft, neutral features. The player's looks are
  deliberately neither boy nor girl.
"""
import hashlib
import random
from dataclasses import dataclass


def seed_of(text):
    return int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:4], "big")


@dataclass
class Params:
    id: str
    appearance: dict
    seed: int
    age: float
    masc: float  # 0 feminine … 1 masculine bone structure
    child: float  # 0 adult … 1 about eleven
    age_t: float  # 0 young … 1 elderly (wrinkles, grey)
    scale: float = 1.0
    face_width: float = 1.0
    face_length: float = 1.0
    jaw_width: float = 1.0
    chin: float = 0.0
    nose_length: float = 1.0
    nose_width: float = 1.0
    nose_projection: float = 0.0
    nose_hump: float = 0.0
    eye_spacing: float = 0.0
    eye_depth: float = 0.0
    eye_open: float = 0.5
    canthal_tilt: float = 4.0
    mouth_width: float = 1.0
    lip_fullness: float = 0.5
    lip_projection: float = 0.0
    ear_size: float = 1.0
    fullness: float = 0.3
    brow_thickness: float = 0.5
    iris: str = "#3b2616"
    hair_style: str = "short"
    hair_curl: float = 0.5
    grey: float = 0.0
    beard_length: float = 0.0
    player: bool = False


# Casting notes: ages the story implies that the appearance data can't say.
# Optional; anyone not listed (including characters in later chapters) is
# cast from their appearance and id alone.
CASTING = {
    # Chapter 1. Aunt Miriam: "my knees can't manage that road anymore".
    "miriam": {"age": 54},
    # Rivka has a young son (Natan); Yair is her brother.
    "rivka": {"age": 37},
    "yair": {"age": 41},
    "salome": {"age": 43},
}


def is_female(a):
    return (not a["beard"]) and a["headwear"] in ("veil", "scarf") and a["build"] != "child"


def params_for(pid, appearance, player=False):
    a = appearance
    seed = seed_of(pid)
    r = random.Random(seed)

    def jitter(spread):
        # Evenly spread within the range, so faces differ visibly but stay
        # within ordinary anatomy.
        return r.uniform(-1.0, 1.0) * spread

    build = a["build"]
    female = is_female(a)
    if build == "child":
        age = 10.5 + r.random() * 2.0
        masc = 0.5 if player else 0.62
        child = 1.0
    elif build == "elder":
        age = 64 + r.random() * 12
        masc = 0.15 if female else 1.0
        child = 0.0
    else:
        if female:
            age = 24 + r.random() * 22
            masc = 0.1 + r.random() * 0.12
        elif not a["beard"]:
            age = 18 + r.random() * 4  # a young man, before his beard
            masc = 0.75
        else:
            age = 26 + r.random() * 24
            masc = 0.9 + r.random() * 0.1
        child = 0.0
    age = CASTING.get(pid, {}).get("age", age)
    age_t = max(0.0, min(1.0, (age - 30.0) / 42.0))

    p = Params(id=pid, appearance=a, seed=seed, age=age, masc=masc, child=child, age_t=age_t, player=player)
    p.scale = (0.93 if child else 1.0) * (0.955 + 0.045 * masc) * (1 + jitter(0.025))
    p.face_width = 1.0 + jitter(0.08) + (0.03 if child else 0.0)
    p.face_length = 1.0 + jitter(0.07) - (0.04 if female else 0.0)
    p.jaw_width = 1.0 + jitter(0.1) + 0.03 * masc - (0.06 if child else 0.0)
    p.chin = jitter(0.8) + 0.2 * masc * (1 - child)
    p.nose_length = 1.0 + jitter(0.1) + 0.05 * age_t
    p.nose_width = 1.0 + jitter(0.14) + 0.06 * masc * (1 - child) + 0.06 * age_t
    p.nose_projection = 0.45 + jitter(0.5) + 0.15 * masc * (1 - child)
    p.nose_hump = max(0.0, jitter(1.5)) * (1 - child) * (0.3 + 0.7 * masc)
    p.eye_spacing = jitter(0.8)
    p.eye_depth = jitter(0.5) + 0.35 * age_t
    p.eye_open = 0.5 + jitter(0.5) + (0.15 if child else 0.0) + (0.1 if female else 0.0) - 0.2 * age_t
    p.canthal_tilt = 3.0 + jitter(3.0) + (2.0 if female else 0.0)
    p.mouth_width = 1.0 + jitter(0.07)
    p.lip_fullness = 0.5 + jitter(0.5) + (0.3 if female else 0.0) + (0.1 if child else 0.0)
    p.lip_projection = jitter(0.4)
    p.ear_size = 1.0 + jitter(0.08)
    p.fullness = 0.3 + jitter(0.35) + 0.25 * child + 0.2 * (1 - masc) - 0.1 * age_t
    p.brow_thickness = 0.45 + jitter(0.3) + 0.35 * masc * (1 - child)
    # Eyes: mostly dark brown, some hazel or amber.
    p.iris = r.choice(["#2e1d12", "#3b2616", "#3b2616", "#4a2f1a", "#4f3a22", "#5a4526", "#34261a"])
    # Hair: wavy to curly; men's cropped, women's long (under their covering).
    p.hair_curl = 0.35 + r.random() * 0.55
    if child:
        p.hair_style = "child"
    elif female:
        p.hair_style = "long"
    else:
        p.hair_style = "short"
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
        f"{p.id}: age {p.age:.0f}, masc {p.masc:.2f}, width {p.face_width:.2f}, length {p.face_length:.2f}, "
        f"nose {p.nose_length:.2f}/{p.nose_width:.2f}/{p.nose_projection:.2f}, curl {p.hair_curl:.2f}, grey {p.grey:.2f}"
    )
