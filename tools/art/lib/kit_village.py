"""A Judean hill village (Chapter 3, Bethlehem): its houses, lanes, threshing
floor, terraces, sheepfold and flock, and the inside of a village house.

A place is built as a village when its map has any of the village's own
tile kinds (the animals' end of a house, a threshing floor, a terrace wall,
a sheepfold, sheep, a shepherds' fire). Then this kit gives it:

  - its own ground: packed earth lanes, a paved square, a threshing floor
    of hard pale ground drifted with chaff (the lanes); dry pasture on red
    terra rossa soil among grey limestone, trampled earth in the fold, ash
    round the fire (the fields); a floor of beaten earth and lime plaster
    with the animals' end a step down, deep in straw (the house);
  - its own heights: the animals' end sunk below the family floor; fields
    stepped down the hillside, each held up by a dry-stone terrace wall
    (a vertical face, exactly as steep as the terrain allows); the gully
    falling away to the old cistern;
  - its own buildings: houses of rough limestone rubble with flat earthen
    roofs, parapets, outside stairs and a lean-to of reed matting; the
    village wall and its east gate; an old stone watch hut in the fields;
    the inside of a house seen in cutaway, with a sunbeam through the roof
    hatch the ladder leads up to, and lamps and the oven lit at night;
  - builders for its tile kinds and story props.

Everything else is handed on to the kits after this one (VillageKit comes
first in Place), so other places are built exactly as before.

Some things exist only in some lights (build_place.py): lamps lit and
doors shut at night (`obj["variants"] = "night"`), the day's light
bounced in at a door (`"day,late"`). Fires and lamps also go in
`self.flicker`, so the game can make them flicker.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import materials as M
import rocks
import scatter
import terrain

# The village's own tile kinds: a place with any of them is built as a village.
VILLAGE_KINDS = {"straw", "platform", "threshing", "manger", "sheepfold", "terrace", "sheep", "campfire"}

# How far the animals' end of a house lies below the family floor (tiles = m).
STABLE_DROP = 0.45
# How far each terrace wall holds its field above the next one down.
TERRACE_RISE = 0.9
# How far the gully falls from its head to the cistern at its foot.
GULLY_FALL = 1.1

ROOM_H = 2.7
STUB_H = 0.42
WALL_T = 0.45

NIGHT = "night"
DAYLIT = "day,late"

# ── ground palettes ─────────────────────────────────────────────────────────
VILLAGE_GROUND = {
    # The lanes: packed earth, dry weeds at the verges, the paved square, a
    # threshing floor, a goat yard, trodden ground before the doors.
    "lanes": {
        "layers": ["lane", "verge", "bed", "threshing", "yard", "dooryard"],
        "kinds": {"sand": "lane", "scrub": "verge", "paving": "bed", "gate": "bed", "well": "bed", "threshing": "threshing",
                  "bush": "verge", "olive": "verge", "terrace": "verge", "door": "dooryard", "wall": "lane", "roof": "lane"},
    },
    # The fields: dry pasture on red earth, ploughed terra rossa under the
    # olives, a footpath, the gully's gravel, damp mud by the trough, stony
    # ground on the hills, the trampled fold, ash round the fire.
    "pasture": {
        "layers": ["pasture", "terra", "footpath", "gully", "mire", "stony", "fold", "ash"],
        "kinds": {"scrub": "pasture", "sand": "footpath", "soil": "terra", "crops": "terra", "wadi": "gully", "mud": "mire",
                  "hill": "stony", "rock": "stony", "well": "gully", "gate": "fold", "sheep": "fold", "sheepfold": "fold",
                  "campfire": "ash", "bush": "pasture", "fence": "pasture", "trough": "mire", "door": "footpath",
                  "wall": "stony", "roof": "stony"},
    },
    # The house: the family floor of beaten earth and lime plaster; the
    # animals' end, dark earth under straw; the hearth; trodden ways.
    "house": {
        "layers": ["plastered", "byre", "hearth", "trodden"],
        "kinds": {"platform": "plastered", "straw": "byre", "hay": "byre", "manger": "plastered", "steps": "byre",
                  "rug": "plastered", "mat": "plastered", "bedroll": "plastered", "door": "byre"},
    },
}

VILLAGE_LOOKS = {
    "lane": {"color": "#b8a07a", "grit": 0.6, "dark": 0.16, "light": 0.1, "mottle": 0.4, "mottle_color": "#98805e", "chips": 0.4, "ripple": 0.08},
    "verge": {"color": "#9e8e66", "scale": "mid", "dark": 0.14, "light": 0.08, "mottle": 0.35, "mottle_color": "#857a52"},
    "bed": {"color": "#96825f", "scale": "mid", "grit": 0.35, "mottle": 0.3, "mottle_color": "#7e6c4e"},
    "threshing": {"color": "#cdb98f", "grit": 0.2, "dark": 0.06, "light": 0.08, "mottle": 0.3, "mottle_color": "#d9c48e", "streak": 0.12},
    "yard": {"color": "#85704f", "scale": "mid", "grit": 0.3, "mottle": 0.45, "mottle_color": "#6a5a40", "rough": 0.9},
    "dooryard": {"color": "#a58c68", "dark": 0.08, "light": 0.05, "grit": 0.25},
    "pasture": {"color": "#b39d68", "scale": "mid", "dark": 0.18, "light": 0.12, "mottle": 0.42, "mottle_color": "#8e7048", "chips": 0.25, "grit": 0.4},
    "terra": {"color": "#8c5a3a", "streak": 0.4, "grit": 0.25, "rough": 0.9, "mottle": 0.35, "mottle_color": "#734630", "dark": 0.12},
    "footpath": {"color": "#b39b76", "grit": 0.5, "dark": 0.08, "light": 0.06, "mottle": 0.2, "mottle_color": "#9c7f5c"},
    "gully": {"color": "#b8aa8c", "grit": 0.7, "scale": "mid", "mottle": 0.4, "mottle_color": "#968870", "chips": 0.5},
    "mire": {"color": "#5e4a34", "scale": "mid", "rough": 0.55, "mottle": 0.4, "mottle_color": "#46372a"},
    "stony": {"color": "#a4957a", "grit": 0.7, "scale": "mid", "mottle": 0.45, "mottle_color": "#86684c", "chips": 0.5},
    "fold": {"color": "#7c6a4c", "scale": "mid", "grit": 0.35, "mottle": 0.5, "mottle_color": "#5e503a", "rough": 0.9},
    "ash": {"color": "#6c655c", "grit": 0.2, "scale": "mid", "mottle": 0.5, "mottle_color": "#3c3530"},
    "plastered": {"color": "#bba27a", "grit": 0.3, "scale": "mid", "dark": 0.17, "light": 0.08, "chips": 0.14, "mottle": 0.48, "mottle_color": "#9c8260", "cracks": 0.34, "crack_scale": 1.6},
    "byre": {"color": "#6a5840", "scale": "mid", "grit": 0.3, "mottle": 0.5, "mottle_color": "#4e4030", "rough": 0.95},
    "hearth": {"color": "#6a5848", "grit": 0.25, "scale": "mid", "mottle": 0.45, "mottle_color": "#40352c"},
    "trodden": {"color": "#c2a984", "dark": 0.06, "light": 0.05, "grit": 0.12},
}


def B(x, y, z=0.0):
    return Vector((x, -y, z))


def tag(obj, variants):
    """This thing exists only in these lighting variants ('night', 'day,late')."""
    obj["variants"] = variants
    return obj


# ── materials ───────────────────────────────────────────────────────────────
def fleece(color="#d8cbb0", name=None, dirt="#8a7656", speckle=None, ground_z=0.0):
    """A sheep's fleece: dense crimped locks (lumpy, in clumps, with deep
    crevices between them), creamy on top, greyer and dirtier underneath
    and toward the ground (`ground_z`, Blender z of the ground under the
    animal), a little translucent at the tips; with `speckle` (a colour),
    dark flecks and spots all over (a speckled lamb)."""

    def build():
        n = M.Nodes(name or f"fleece-{color}-{speckle}-{ground_z:.2f}")
        obj = n.coords()
        locks = n.new("ShaderNodeTexVoronoi", Scale=64.0, Vector=obj, _feature="SMOOTH_F1", Smoothness=0.7)
        clumps = n.noise(9.0, 5.0, 0.62, obj)
        fine = n.noise(140.0, 3.0, 0.6, obj)
        sepP = n.new("ShaderNodeSeparateXYZ", Vector=obj)
        tone = n.mix((clumps, "Fac"), M.shade(color, -0.16), M.shade(color, 0.06))
        low = n.new("ShaderNodeMapRange", Value=(sepP, "Z"), **{"From Min": ground_z, "From Max": ground_z + 0.18, "To Min": 0.55, "To Max": 0.0})
        col = n.mix((low, "Result"), (tone, 2), dirt)
        if speckle:
            spots = n.new("ShaderNodeTexVoronoi", Scale=22.0, Vector=obj, Randomness=1.0)
            sm = n.new("ShaderNodeMapRange", Value=(spots, "Distance"), **{"From Min": 0.12, "From Max": 0.2, "To Min": 1.0, "To Max": 0.0})
            big = n.noise(3.0, 3.0, 0.5, obj)
            bm_ = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.58, "From Max": 0.64, "To Min": 0.0, "To Max": 1.0})
            sp = n.math("MAXIMUM", (sm, "Result"), (bm_, "Result"))
            col = n.mix((sp, "Value"), (col, 2), speckle)
        crev = n.new("ShaderNodeMapRange", Value=(locks, "Distance"), **{"From Min": 0.3, "From Max": 0.62, "To Min": 0.0, "To Max": 0.22})
        col2 = n.mix((crev, "Result"), (col, 2), M.shade(color, -0.45))
        h = n.math("SUBTRACT", (clumps, "Fac"), (locks, "Distance"))
        h2 = n.math("MULTIPLY_ADD", (fine, "Fac"), 0.3)
        n._in(h2, 2, (h, "Value"))
        bump = n.bump((h2, "Value"), strength=0.55, distance=0.015)
        n.bsdf(
            **{
                "Base Color": (col2, 2),
                "Roughness": 0.95,
                "Sheen Weight": 0.35,
                "Sheen Roughness": 0.45,
                "Sheen Tint": (col, 2),
                "Subsurface Weight": 0.12,
                "Subsurface Radius": (0.4, 0.3, 0.2),
                "Subsurface Scale": 0.02,
                "Specular IOR Level": 0.2,
                "Normal": (bump, "Normal"),
            }
        )
        return n.mat

    return M.cached(("fleece", color, name, dirt, speckle, round(ground_z, 2)), build)


def coat(color="#2a221c", name=None, sheen="#6a5a4a"):
    """Short hair on an animal's head and legs (or a goat's long black coat):
    streaked along the body, with a soft sheen."""

    def build():
        n = M.Nodes(name or f"coat-{color}")
        obj = n.coords()
        streak = n.new("ShaderNodeTexWave", Scale=60.0, Distortion=5.0, Detail=3.0, Vector=obj, _bands_direction="X")
        v = n.noise(8.0, 4.0, 0.6, obj)
        col = n.mix((v, "Fac"), M.shade(color, -0.12), M.shade(color, 0.1))
        col2 = n.mix((streak, "Fac"), (col, 2), M.shade(color, -0.25), "MULTIPLY")
        col2.inputs[0].default_value = 0.3
        bump = n.bump((streak, "Fac"), strength=0.3, distance=0.004)
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": 0.72, "Sheen Weight": 0.3, "Sheen Tint": common.hex_rgb(sheen), "Specular IOR Level": 0.3, "Normal": (bump, "Normal")})
        return n.mat

    return M.cached(("coat", color, name, sheen), build)


def young_barley():
    """Young barley after the first rains: fresh yellow-green to green, a few
    blades paler (per plant, from the builder's rand)."""

    def build():
        n = M.Nodes("young-barley")
        rnd = n.new("ShaderNodeAttribute", _attribute_name="rand", _attribute_type="GEOMETRY")
        geo = n.new("ShaderNodeNewGeometry")
        tone = n.ramp((rnd, "Fac"), [(0.0, "#6c8a3a"), (0.5, "#86a044"), (0.85, "#a0ac5a"), (1.0, "#b8b070")])
        n.bsdf(**{"Base Color": (tone, "Color"), "Roughness": 0.55, "Subsurface Weight": 0.15, "Subsurface Radius": (0.2, 0.5, 0.1)})
        _ = geo
        return n.mat

    return M.cached(("young-barley",), build)


def donkey_coat():
    """A donkey's coat (object space: z up from its hooves, x forward): mouse
    grey-brown, paler under the belly and inside the legs, a dark stripe
    down the spine and across the shoulders."""

    def build():
        n = M.Nodes("donkey-coat")
        obj = n.coords()
        sep = n.new("ShaderNodeSeparateXYZ", Vector=obj)
        v = n.noise(10.0, 4.0, 0.6, obj)
        streak = n.new("ShaderNodeTexWave", Scale=70.0, Distortion=4.0, Detail=3.0, Vector=obj, _bands_direction="Z")
        base = n.mix((v, "Fac"), "#6e6356", "#8c8070")
        belly = n.new("ShaderNodeMapRange", Value=(sep, "Z"), **{"From Min": 0.66, "From Max": 0.52, "To Min": 0.0, "To Max": 1.0})
        col = n.mix((belly, "Result"), (base, 2), "#cfc4b0")
        ay = n.math("ABSOLUTE", (sep, "Y"))
        spine = n.new("ShaderNodeMapRange", Value=(ay, "Value"), **{"From Min": 0.04, "From Max": 0.02, "To Min": 0.0, "To Max": 1.0})
        high = n.new("ShaderNodeMapRange", Value=(sep, "Z"), **{"From Min": 0.8, "From Max": 0.88, "To Min": 0.0, "To Max": 1.0})
        sp = n.math("MULTIPLY", (spine, "Result"), (high, "Result"))
        dx = n.math("ABSOLUTE", (n.math("SUBTRACT", (sep, "X"), 0.26), "Value"))
        cross = n.new("ShaderNodeMapRange", Value=(dx, "Value"), **{"From Min": 0.035, "From Max": 0.015, "To Min": 0.0, "To Max": 1.0})
        chigh = n.new("ShaderNodeMapRange", Value=(sep, "Z"), **{"From Min": 0.72, "From Max": 0.8, "To Min": 0.0, "To Max": 1.0})
        cr = n.math("MULTIPLY", (cross, "Result"), (chigh, "Result"))
        stripe = n.math("MAXIMUM", (sp, "Value"), (cr, "Value"))
        col = n.mix((stripe, "Value"), (col, 2), "#3e352c")
        col = n.mix((streak, "Fac"), (col, 2), "#5a5046", "MULTIPLY")
        col.inputs[0].default_value = 0.2
        bump = n.bump((streak, "Fac"), strength=0.25, distance=0.004)
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.8, "Sheen Weight": 0.35, "Sheen Tint": common.hex_rgb("#b0a490"), "Specular IOR Level": 0.25, "Normal": (bump, "Normal")})
        return n.mat

    return M.cached(("donkey-coat",), build)


def stalks():
    """Straw and chaff: pale gold to grey-gold, a few greener or darker
    (per piece, from the scatter's instance random)."""

    def build():
        n = M.Nodes("straw-stalks")
        info = n.new("ShaderNodeAttribute", _attribute_name="irand", _attribute_type="GEOMETRY")
        rnd = n.new("ShaderNodeAttribute", _attribute_name="rand", _attribute_type="GEOMETRY")
        s = n.math("ADD", (info, "Fac"), (rnd, "Fac"))
        f = n.math("FRACT", (s, "Value"))
        tone = n.ramp((f, "Value"), [(0.0, "#a8894c"), (0.3, "#c9aa62"), (0.6, "#dcc184"), (0.85, "#e8d49c"), (1.0, "#8f7a4a")])
        n.bsdf(**{"Base Color": (tone, "Color"), "Roughness": 0.62, "Specular IOR Level": 0.35, "Subsurface Weight": 0.1, "Subsurface Radius": (0.4, 0.3, 0.1)})
        return n.mat

    return M.cached(("straw-stalks",), build)


def embers(strength=14.0):
    """Glowing embers and coals: bright orange in the cracks between dark,
    ashy crusts."""

    def build():
        n = M.Nodes(f"embers-{strength}")
        obj = n.coords()
        cells = n.new("ShaderNodeTexVoronoi", Scale=26.0, Vector=obj, _feature="DISTANCE_TO_EDGE")
        crack = n.new("ShaderNodeMapRange", Value=(cells, "Distance"), **{"From Min": 0.0, "From Max": 0.08, "To Min": 1.0, "To Max": 0.0})
        hot = n.noise(6.0, 3.0, 0.6, obj)
        hm = n.new("ShaderNodeMapRange", Value=(hot, "Fac"), **{"From Min": 0.35, "From Max": 0.65, "To Min": 0.25, "To Max": 1.0})
        g = n.math("MULTIPLY", (crack, "Result"), (hm, "Result"))
        col = n.ramp((g, "Value"), [(0.0, "#1a1410"), (0.4, "#7a2a0c"), (0.75, "#ff6a1a"), (1.0, "#ffc070")])
        e = n.math("MULTIPLY", (g, "Value"), strength)
        n.bsdf(**{"Base Color": (col, "Color"), "Roughness": 0.9, "Emission Color": (col, "Color"), "Emission Strength": (e, "Value")})
        return n.mat

    return M.cached(("embers", strength), build)


def flame(strength=18.0):
    """A flame: hot yellow-white at its root, orange at its tips, fading out
    (emission and transparency by the flame's own height, UV v)."""

    def build():
        n = M.Nodes(f"flame-{strength}")
        uv = n.coords("UV")
        sep = n.new("ShaderNodeSeparateXYZ", Vector=uv)
        col = n.ramp((sep, "Y"), [(0.0, "#fff2c8"), (0.3, "#ffc050"), (0.7, "#ff7a1c"), (1.0, "#b8300a")])
        edge = n.math("SUBTRACT", 1.0, (n.math("ABSOLUTE", (n.math("SUBTRACT", (n.math("MULTIPLY", (sep, "X"), 2.0), "Value"), 1.0), "Value")), "Value"))
        fade = n.new("ShaderNodeMapRange", Value=(sep, "Y"), **{"From Min": 0.55, "From Max": 1.0, "To Min": 1.0, "To Max": 0.0})
        a = n.math("MULTIPLY", (edge, "Value"), (fade, "Result"))
        a2 = n.math("POWER", (a, "Value"), 0.6)
        em = n.new("ShaderNodeEmission", Color=(col, "Color"), Strength=strength)
        tr = n.new("ShaderNodeBsdfTransparent")
        mix = n.new("ShaderNodeMixShader")
        n.link(a2, "Value", mix, "Fac")
        n.link(tr, "BSDF", mix, 1)
        n.link(em, "Emission", mix, 2)
        n.link(mix, "Shader", n.out, "Surface")
        return n.mat

    return M.cached(("flame", strength), build)


def charred():
    """Burnt wood: black and cracked into squares, grey ash on top."""

    def build():
        n = M.Nodes("charred")
        obj = n.coords()
        cells = n.new("ShaderNodeTexVoronoi", Scale=38.0, Vector=obj, _feature="DISTANCE_TO_EDGE")
        crack = n.new("ShaderNodeMapRange", Value=(cells, "Distance"), **{"From Min": 0.0, "From Max": 0.05, "To Min": 1.0, "To Max": 0.0})
        geo = n.new("ShaderNodeNewGeometry")
        sepN = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Normal"))
        up = n.new("ShaderNodeMapRange", Value=(sepN, "Z"), **{"From Min": 0.2, "From Max": 0.9, "To Min": 0.0, "To Max": 0.6})
        col = n.mix((up, "Result"), "#141110", "#7a746c")
        col2 = n.mix((crack, "Result"), (col, 2), "#050404")
        bump = n.bump((crack, "Result"), strength=0.5, distance=0.004)
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": 0.95, "Normal": (bump, "Normal")})
        return n.mat

    return M.cached(("charred",), build)


def wax(color="#3a2c1c"):
    """The wax of a writing tablet: dark, smooth, a soft sheen, scratched."""

    def build():
        n = M.Nodes(f"wax-{color}")
        obj = n.coords()
        lines = n.new("ShaderNodeTexWave", Scale=70.0, Distortion=0.6, Detail=1.0, Vector=obj, _bands_direction="Y")
        lm = n.new("ShaderNodeMapRange", Value=(lines, "Fac"), **{"From Min": 0.9, "From Max": 1.0, "To Min": 0.0, "To Max": 0.7})
        col = n.mix((lm, "Result"), color, "#9a7a4a")
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.4, "Specular IOR Level": 0.45})
        return n.mat

    return M.cached(("wax", color), build)


def field_rock(color="#a39a88", name="fieldstone", lichen=0.5, dark=0.0):
    """Weathered field limestone, as stones are in the Judean hills: grey to
    buff (each stone its own, from the builders' `rand`), karst-pitted,
    rounded by the weather, a darker grey crust on faces turned to the sky,
    grey-green and orange lichen in spots, grime and deep shadow in the
    joints; only a rare fresh break is pale."""

    def build():
        n = M.Nodes(name)
        obj = n.coords()
        geo = n.new("ShaderNodeNewGeometry")
        sepN = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Normal"))
        attr = n.new("ShaderNodeAttribute", _attribute_name="rand", _attribute_type="GEOMETRY")
        irand = n.new("ShaderNodeAttribute", _attribute_name="irand", _attribute_type="GEOMETRY")
        info = n.new("ShaderNodeObjectInfo")
        r = n.math("ADD", (attr, "Fac"), (irand, "Fac"))
        r = n.math("ADD", (r, "Value"), (info, "Random"))
        rf = n.math("FRACT", (r, "Value"))
        tone = n.ramp(
            (rf, "Value"),
            [(0.0, M.shade(color, -0.22)), (0.3, M.shade(color, -0.06)), (0.55, color), (0.75, M._toward(color, "#b8a888", 0.35)), (0.9, M._toward(color, "#c8c2b4", 0.4)), (1.0, M.shade(color, -0.3))],
        )
        big = n.noise(3.0, 4.0, 0.6, obj)
        mid = n.noise(11.0, 5.0, 0.6, obj)
        fine = n.noise(60.0, 5.0, 0.7, obj)
        pits = n.new("ShaderNodeTexVoronoi", Scale=38.0, Vector=obj)
        pit = n.new("ShaderNodeMapRange", Value=(pits, "Distance"), **{"From Min": 0.0, "From Max": 0.12, "To Min": 1.0, "To Max": 0.0})
        out = (n.mix((mid, "Fac"), (tone, "Color"), M.shade(color, -0.25), "MULTIPLY"), 2)
        up = n.new("ShaderNodeMapRange", Value=(sepN, "Z"), **{"From Min": 0.2, "From Max": 0.9, "To Min": 0.0, "To Max": 0.55})
        crust = n.math("MULTIPLY", (up, "Result"), (big, "Fac"))
        crust = n.math("MULTIPLY", (crust, "Value"), 1.5, clamp=True)
        out = (n.mix((crust, "Value"), out, "#6e6a62"), 2)
        if lichen > 0:
            li = n.noise(9.0, 5.0, 0.7, obj)
            lm = n.new("ShaderNodeMapRange", Value=(li, "Fac"), **{"From Min": 0.6, "From Max": 0.66, "To Min": 0.0, "To Max": lichen})
            li2 = n.noise(23.0, 4.0, 0.6, obj)
            lc = n.ramp((li2, "Fac"), [(0.0, "#8c9278"), (0.55, "#a4a88c"), (0.7, "#c09a48"), (1.0, "#d8b050")])
            out = (n.mix((lm, "Result"), out, (lc, "Color")), 2)
        pm = n.math("MULTIPLY", (pit, "Result"), 0.45)
        out = (n.mix((pm, "Value"), out, M.shade(color, -0.55)), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.12, _samples=8, _only_local=False)
        grime = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.25, "From Max": 0.95, "To Min": 0.75, "To Max": 0.0})
        out = (n.mix((grime, "Result"), out, "#2e2a24"), 2)
        if dark:
            out = (n.mix(dark, out, "#3a342c", "MULTIPLY"), 2)
        h = n.math("ADD", (fine, "Fac"), (n.math("MULTIPLY", (pit, "Result"), -0.6), "Value"))
        h2 = n.math("MULTIPLY_ADD", (mid, "Fac"), 0.5)
        n._in(h2, 2, (h, "Value"))
        bump = n.bump((h2, "Value"), strength=0.6, distance=0.012)
        n.bsdf(**{"Base Color": out, "Roughness": 0.92, "Specular IOR Level": 0.25, "Normal": (bump, "Normal")})
        return n.mat

    return M.cached(("field-rock", color, name, lichen, dark), build)


class VillageKit:
    # ── is this place a village? ────────────────────────────────────────────
    @property
    def village(self):
        v = getattr(self, "_is_village", None)
        if v is None:
            v = bool(VILLAGE_KINDS & set(self.map.kinds()))
            self._is_village = v
        return v

    @property
    def ground_name(self):
        """Which village ground this place has: 'house', 'pasture' or 'lanes'."""
        if self.style == "home":
            return "house"
        if self.style == "wilderness":
            return "pasture"
        return "lanes"

    # ── ground hooks (Place calls these; other places keep their style's) ──
    def ground_spec(self):
        from place import GROUND

        if self.village:
            return VILLAGE_GROUND[self.ground_name]
        return GROUND[self.style]

    def layer_look(self, name):
        from place import LAYER_LOOKS

        if self.village and name in VILLAGE_LOOKS:
            return VILLAGE_LOOKS[name]
        return LAYER_LOOKS[name]

    def ground_rock(self):
        """The rock that shows on steep ground: banded limestone in the
        wilderness (stained red by the cliffs); here the grey-white
        limestone of the Bethlehem hills, with terra rossa in its joints."""
        if self.village and self.style == "wilderness":
            rock = {"color": "#ada594", "strata": "#8c8576", "dust": "#b09c78", "red": "#9a6448"}
            return rock, None, 0.18
        if self.style == "wilderness":
            rock = {"color": "#cbbfa6", "strata": "#a99b82", "dust": "#d6c6a2", "red": "#ad7a60"}
            return rock, self._red_mask(), 0.22
        return None, None, 0.2 if self.village and self.style == "city" else 0.1

    def shape_mask(self, name, mask, W, Hh, px):
        """Village layers that follow more than their tiles: the fold's
        trampled ground fills the fold and spills out of the gate; ash
        spreads round the fire; mud round the trough; dry weeds break up at
        the verges; trodden ground lies before the doors and along the ways
        in the house."""
        if not self.village:
            return None
        from place import value_noise

        if name in ("verge", "pasture"):
            return mask * np.clip(value_noise(W, Hh, 7, 91) * 1.5 - 0.05, 0, 1)
        if name == "fold":
            inside = self._fold_inside_mask(W, Hh, px)
            return np.clip(np.maximum(mask, inside), 0, 1) * np.clip(value_noise(W, Hh, 5, 93) * 1.4 + 0.2, 0, 1)
        if name == "ash":
            return self._near(("campfire",), 1.1, W, Hh, px, 95)
        if name == "dooryard":
            return self._near(("door",), 1.6, W, Hh, px, 97) * 0.8
        if name == "yard":
            return self._pen_mask(W, Hh, px)
        if name == "footpath":
            return mask * np.clip(value_noise(W, Hh, 10, 99) * 1.6, 0, 1)
        if name == "mire":
            # Trampled wet ground round the trough and the cistern: a ragged
            # patch where the flock stands to drink, not the mud's row of tiles.
            return self._near(("mud", "trough"), 1.3, W, Hh, px, 17)
        if name == "trodden":
            from_door = self._near(("door",), 3.0, W, Hh, px, 12)
            by_steps = self._near(("steps",), 2.2, W, Hh, px, 13)
            return np.maximum(from_door, by_steps)
        if name == "hearth":
            return self._near(("oven",), 1.7, W, Hh, px, 14)
        return None

    def _fold_inside_mask(self, W, Hh, px):
        """Inside the sheepfold's walls (and a trampled apron before its gate)."""
        m = self.map
        walls = m.tiles("sheepfold")
        out = np.zeros((Hh, W), dtype=np.float32)
        if not walls:
            return out
        x0, x1 = min(x for x, _ in walls), max(x for x, _ in walls) + 1
        y0, y1 = min(y for _, y in walls), max(y for _, y in walls) + 1
        out[int(y0 * px) : int(y1 * px), int(x0 * px) : int(x1 * px)] = 1.0
        for gx, gy in m.tiles("gate"):
            if m.near(gx, gy, ("sheepfold",), 1):
                ys, xs = np.mgrid[0:Hh, 0:W] / px
                d = np.hypot((xs - (gx + 0.5)) / 1.6, (ys - (gy + 1.2)) / 1.1)
                out = np.maximum(out, np.clip(1.2 - d, 0, 1))
        return terrain._blur(out.astype(np.float64), max(1, px // 4)).astype(np.float32)

    def _pen_mask(self, W, Hh, px):
        """Inside a pen of field walls (a goat yard)."""
        m = self.map
        fence = m.tiles("fence")
        out = np.zeros((Hh, W), dtype=np.float32)
        if len(fence) < 4:
            return out
        x0, x1 = min(x for x, _ in fence), max(x for x, _ in fence) + 1
        y0, y1 = min(y for _, y in fence), max(y for _, y in fence) + 1
        out[int(y0 * px) : int(y1 * px), int(x0 * px) : int(x1 * px)] = 1.0
        return terrain._blur(out.astype(np.float64), max(1, px // 4)).astype(np.float32)

    # ── heights ─────────────────────────────────────────────────────────────
    def shape_heights(self, H):
        """The village's heights over the terrain's: the animals' end of a
        house sunk below the family floor; fields stepped down the hill by
        terrace walls; the gully falling to its cistern; a lane's gentle
        unevenness. Then no overhangs (a terrace wall is exactly vertical)."""
        if not self.village:
            return H
        m = self.map
        K = terrain.K
        W, Hh = m.w * K + 1, m.h * K + 1
        if H is None:
            H = np.zeros((Hh, W))
        H = H.copy()
        if m.tiles("straw"):
            H += self._stable_offsets(W, Hh, K)
        if m.tiles("terrace"):
            H += self._terrace_offsets(W, Hh, K)
        if m.tiles("wadi"):
            H += self._gully_offsets(W, Hh, K)
        if self.style != "home":
            H += terrain._fbm(W, Hh, sum(ord(c) for c in m.id) + 7, (20, 7)) * 0.03
        ds = 1.0 / K
        for j in range(Hh - 2, -1, -1):
            H[j] = np.minimum(H[j], H[j + 1] + ds * 1.0)
        return H

    def _tile_grid(self, W, Hh, K):
        xs = np.clip((np.arange(W) / K).astype(int), 0, self.map.w - 1)
        ys = np.clip((np.arange(Hh) / K).astype(int), 0, self.map.h - 1)
        return xs, ys

    def _stable_offsets(self, W, Hh, K):
        """The animals' end: every tile west of the mangers and steps (and
        the walls round it) lies STABLE_DROP below the family floor; across
        the steps the floor rises evenly."""
        m = self.map
        edge = [x for x, y in m.tiles("manger") + m.tiles("steps")]
        if not edge:
            return np.zeros((Hh, W))
        ex = min(edge)
        steps = set(m.tiles("steps"))
        mangers = set(m.tiles("manger"))
        off = np.zeros((Hh, W))
        for j in range(Hh):
            s = j / K
            ty = min(m.h - 1, int(s))
            for i in range(W):
                x = i / K
                if x < ex:
                    off[j, i] = -STABLE_DROP
                elif x < ex + 1 and (ex, ty) in mangers:
                    # The mangers stand on the animals' floor, against the family floor's edge.
                    off[j, i] = -STABLE_DROP
                elif x < ex + 1 and (ex, ty) in steps:
                    off[j, i] = -STABLE_DROP * (1 - (x - ex))
        return off

    def terrace_rows(self):
        """Each terrace wall row: (y, x0, x1) spans, with the gaps in it (a
        path through, the closed gap) filled in: the level still changes there."""
        m = self.map
        rows = {}
        for x, y in m.tiles("terrace"):
            rows.setdefault(y, []).append(x)
        out = []
        for y, xs in sorted(rows.items()):
            x0, x1 = min(xs), max(xs) + 1
            # Extend over walkable tiles to the ends (a path round the wall's end).
            while x0 > 0 and m.walkable(x0 - 1, y):
                x0 -= 1
            while x1 < m.w and m.walkable(x1, y):
                x1 += 1
            out.append((y, x0, x1, set(xs)))
        return out

    def _terrace_offsets(self, W, Hh, K):
        """Fields stepped down the hill: in each column, every terrace row
        crossed going south drops the ground TERRACE_RISE. At a wall the drop
        is a vertical face within the wall's tile; where the row is open (a
        path round the wall's end, a gap) it is a ramp over a few tiles.
        Hills take the level of the nearest field (softened, so the step
        between two fields' hills is lost in the slope). The field with the
        most walkable ground stays at level 0."""
        m = self.map
        rows = self.terrace_rows()
        if not rows:
            return np.zeros((Hh, W))
        cells = {}
        for y, x0, x1, walls in rows:
            for x in range(x0, x1):
                cells[(x, y)] = x in walls
        level = np.zeros((m.h, m.w))
        for x in range(m.w):
            run = 0.0
            for y in range(m.h):
                level[y, x] = run
                if (x, y) in cells:
                    run -= TERRACE_RISE
        # Hills: the level of the nearest walkable tile (breadth-first).
        hill = np.zeros((m.h, m.w), dtype=bool)
        queue = []
        seen = set()
        for y in range(m.h):
            for x in range(m.w):
                if m.kind(x, y) in terrain.RISE:
                    hill[y, x] = True
                elif m.walkable(x, y):
                    queue.append((x, y))
                    seen.add((x, y))
        i = 0
        while i < len(queue):
            x, y = queue[i]
            i += 1
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < m.w and 0 <= ny < m.h and (nx, ny) not in seen and hill[ny, nx]:
                    seen.add((nx, ny))
                    level[ny, nx] = level[y, x]
                    queue.append((nx, ny))
        off = np.zeros((Hh, W))
        s = np.arange(Hh) / K
        ty = np.clip(s.astype(int), 0, m.h - 1)
        for i in range(W):
            x = min(m.w - 1, int(i / K))
            prof = level[ty, x].copy()
            for (cx, cy), wall in cells.items():
                if cx != x:
                    continue
                north = level[cy, x]
                if wall:
                    t = np.clip((s - (cy + 0.05)) / TERRACE_RISE, 0, 1)
                    band = (s >= cy) & (s < cy + 1)
                else:
                    t = np.clip((s - (cy - 1.6)) / 4.2, 0, 1)
                    t = t * t * (3 - 2 * t)
                    band = (s >= cy - 1.6) & (s < cy + 2.6)
                prof = np.where(band, north - TERRACE_RISE * t, prof)
            off[:, i] = prof
        xi, yi = self._tile_grid(W, Hh, K)
        hm = terrain._blur(hill[yi][:, xi].astype(np.float64), K // 2)
        off = off * (1 - hm) + terrain._blur(off, K) * hm
        levels = {}
        for y in range(m.h):
            for x in range(m.w):
                if m.walkable(x, y):
                    lv = round(float(level[y, x]), 2)
                    levels[lv] = levels.get(lv, 0) + 1
        base = max(levels, key=levels.get) if levels else 0.0
        return off - base

    def _gully_offsets(self, W, Hh, K):
        """The gully falls from its head to the cistern at its foot, and the
        hills either side fall with it."""
        m = self.map
        cells = m.tiles("wadi") + m.tiles("well")
        if len(cells) < 3:
            return np.zeros((Hh, W))
        head = min(cells, key=lambda c: c[0] + c[1])
        foot = max(cells, key=lambda c: c[0] + c[1])
        hx, hy = head[0] + 0.5, head[1] + 0.5
        fx, fy = foot[0] + 0.5, foot[1] + 0.5
        L2 = (fx - hx) ** 2 + (fy - hy) ** 2
        ys, xs = np.mgrid[0:Hh, 0:W] / K
        t = np.clip(((xs - hx) * (fx - hx) + (ys - hy) * (fy - hy)) / L2, 0, 1)
        near = np.zeros((m.h, m.w))
        for x, y in cells:
            near[y, x] = 1.0
        xi, yi = self._tile_grid(W, Hh, K)
        n = terrain._blur(near[yi][:, xi], K * 3)
        n = np.clip(n * 3.0, 0, 1)
        return -GULLY_FALL * t * n

    # ── walls of dry stone ──────────────────────────────────────────────────
    def dry_stones(self, bm, layer, pts, rng, size=(0.16, 0.12), seed=0, flat=0.62, depth=0.13, detail=0):
        """Dry-stone courses: one stone at each (x, y, z, w, h) of `pts`
        (Blender coordinates of the stone's front centre; w, h half-sizes),
        facing south: hull stones, their long axis along the wall."""
        for k, (c, w, h) in enumerate(pts):
            before = len(bm.faces)
            rocks.stone_mesh(bm, seed * 7919 + k * 31, (w, depth * (0.8 + rng.random() * 0.5), h), flat=1.0, blocky=0.82,
                             n=18, at=c, sink=1.0, rot=(rng.random() - 0.5) * 0.25, detail=detail)
            r = rng.random()
            bm.faces.ensure_lookup_table()
            for i in range(before, len(bm.faces)):
                bm.faces[i][layer] = r

    def course_stones(self, x0, x1, z0, z1, rng, big=0.2, small=0.12):
        """Stones for a dry-stone face from x0 to x1 and z0 to z1: courses of
        big stones low down, smaller ones above, joints staggered, with
        chinking stones in some gaps. Returns [(x, z, w, h)] (half-sizes)."""
        out = []
        z = z0
        course = 0
        while z < z1 - 0.02:
            t = (z - z0) / max(0.1, z1 - z0)
            size = big + (small - big) * t
            ch = min(z1 - z, size * (0.75 + rng.random() * 0.35))
            x = x0 - rng.random() * size * 0.8
            while x < x1:
                w = size * (0.9 + rng.random() * 1.1)
                cx = x + w / 2
                if x0 - 0.05 < cx < x1 + 0.05:
                    out.append((cx, z + ch / 2 + (rng.random() - 0.5) * 0.02, w * 0.52, ch * 0.55))
                    if rng.random() < 0.3:
                        out.append((x + w + 0.01, z + ch * (0.3 + rng.random() * 0.4), w * 0.16, ch * 0.2))
                x += w + 0.012
            z += ch
            course += 1
        return out

    # ── small helpers ───────────────────────────────────────────────────────
    def Q(self, x, y, z):
        """The Blender point at absolute height z that shows on screen at map
        point (x, y): for things built level on a raised or sunk floor."""
        return Vector((x, -(y + z), z))

    def _stalk_library(self):
        """Straw stalks and chaff for scattering: thin, bent strips of
        several lengths, and flakes of chaff."""
        lib = getattr(self, "_stalk_lib", None)
        if lib is not None:
            return lib
        col = bpy.data.collections.new("stalks")
        bpy.context.scene.collection.children.link(col)
        col.hide_render = True
        rng = self.rng
        mat = stalks()
        for t in range(10):
            bm = bmesh.new()
            layer = bm.faces.layers.float.new("rand")
            ln = 0.07 + rng.random() * 0.16
            w = 0.0035 + rng.random() * 0.0025
            bend = (rng.random() - 0.5) * 0.3
            seg = 4
            prev = None
            for k in range(seg + 1):
                u = k / seg
                x = (u - 0.5) * ln
                y = math.sin(u * math.pi) * bend * ln * 0.3
                z = 0.004 + math.sin(u * math.pi) * 0.006
                row = (bm.verts.new((x, y - w, z)), bm.verts.new((x, y + w, z + 0.002)))
                if prev:
                    f = bm.faces.new((prev[0], row[0], row[1], prev[1]))
                    f[layer] = rng.random()
                prev = row
            obj = common.mesh_object(f"stalk{t}", bm, mat, None, smooth=False)
            for c in obj.users_collection:
                c.objects.unlink(obj)
            col.objects.link(obj)
        for t in range(4):
            bm = bmesh.new()
            layer = bm.faces.layers.float.new("rand")
            r = 0.006 + rng.random() * 0.006
            vs = [bm.verts.new((math.cos(a) * r * (0.7 + rng.random() * 0.6), math.sin(a) * r * 0.6, 0.003)) for a in np.linspace(0, math.tau, 6, endpoint=False)]
            f = bm.faces.new(vs)
            f[layer] = rng.random()
            obj = common.mesh_object(f"chaff{t}", bm, mat, None, smooth=False)
            for c in obj.users_collection:
                c.objects.unlink(obj)
            col.objects.link(obj)
        self._stalk_lib = col
        return col

    def straw_cover(self, name, cells, density=520.0, z=0.004, keep=None, sub=2, scale=(0.8, 1.25), seed=5):
        """Loose straw strewn over tiles (in the ground layer)."""
        em = self.emitter(name, cells, sub, keep, z=z)
        scatter.scatter(em, self._stalk_library(), density, scale, seed=seed, rotate_z_only=True, pick=True)
        return em

    def heap(self, name, cx, cy, rx, ry, h, base_z=0.0, seed=1, stalk_density=900.0):
        """A loose heap of straw and chaff standing `base_z` above the ground
        at (cx, cy): a lumpy mound with stalks lying all over it. Returns its
        objects (the mound carries the stalks)."""
        rng = self.rng
        bm = bmesh.new()
        n_r, n_a = 7, 28
        verts = []
        off = rng.random() * 10
        top = bm.verts.new(self.P(cx, cy, base_z + h))
        for i in range(1, n_r + 1):
            t = i / n_r
            ring = []
            for j in range(n_a):
                a = math.tau * j / n_a
                wob = 1 + 0.12 * math.sin(a * 3 + off) + 0.08 * math.sin(a * 5 + seed) + 0.05 * math.sin(a * 9 + off * 2)
                r = t * wob
                zz = h * (1 - t ** 2.2) * (1 + 0.1 * math.sin(a * 4 + seed + t * 3))
                ring.append(bm.verts.new(self.P(cx + math.cos(a) * rx * r, cy + math.sin(a) * ry * r, base_z + zz)))
            verts.append(ring)
        for j in range(n_a):
            bm.faces.new((top, verts[0][(j + 1) % n_a], verts[0][j]))
        for i in range(n_r - 1):
            for j in range(n_a):
                jj = (j + 1) % n_a
                bm.faces.new((verts[i][j], verts[i][jj], verts[i + 1][jj], verts[i + 1][j]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        mound = common.mesh_object(f"{name}-mound", bm, M.plain("#9a8250", 0.9, 0.1), None)
        scatter.scatter(mound, self._stalk_library(), stalk_density, (0.9, 1.6), seed=seed + 3, rotate_z_only=False, pick=True, keep=True)
        return [mound]

    # ── the house ───────────────────────────────────────────────────────────
    def room_shell(self):
        if not self.village:
            return super().room_shell()
        self.village_house()

    def village_house(self):
        """A village house in cutaway: stone walls cut down to their stubs
        (full height, invisible, they still keep the light out), the back
        wall plastered, sooty over the oven, bare rubble behind the animals;
        a partition with a doorway to the guest room; a window in the east
        wall; a hatch in the roof where the ladder goes up (a shaft of sun by
        day, of moonlight at night); the door to the lane at the animals' end."""
        m = self.map
        rng = self.rng
        back_rows = [y for y in range(m.h) if all(m.kind(x, y) == "wall" for x in range(m.w))]
        back = max(back_rows) + 1 if back_rows and back_rows[0] == 0 else 1
        front = m.h - 1
        west, east = 1, m.w - 1
        self._back = back
        self.exposure = 3.1
        self.variant_exposure["night"] = -0.6
        stable_x = min([x for x, _ in m.tiles("manger") + m.tiles("steps")] or [0])
        self._stable_x = stable_x
        plaster = M.lime_plaster("#d6c6a4", "house-plaster", soot=0.6, grime=0.55)
        stone = M.limestone("#a8946f", "house-rubble", worn=0.75)
        cut = M.limestone("#a8977a", "wall-cut", worn=0.6, glow=0.025)
        low = -STABLE_DROP - 0.05
        # The back wall's plastered face, from below the sunk floor to above the view.
        face = common.box("back-wall", (m.w, 0.5, ROOM_H + 0.6 - low), B(m.w / 2, back - 0.25, (ROOM_H + 0.6 + low) / 2), plaster, None)
        self.to_ground(face)
        # Behind the animals the plaster is gone: rubble stones to about a metre.
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        pts = [(Vector((x, -(back - 0.02), z)), w, h) for x, z, w, h in self.course_stones(west + 0.02, stable_x - 0.05, low, 1.05, rng, 0.34, 0.22)]
        self.dry_stones(bm, layer, pts, rng, depth=0.06, seed=41, detail=1)
        self.to_ground(common.mesh_object("back-rubble", bm, stone, None, smooth=False))
        # Mud mortar packed between the stones.
        self.to_ground(common.box("back-mortar", (stable_x - west, 0.02, 1.1 - low), B((west + stable_x) / 2, back + 0.005, (1.1 + low) / 2), M.plain("#5e4c38", 0.95, 0.1), None))
        # A plinth of scuffed plaster along the family floor.
        self.to_ground(common.box("back-plinth", (m.w - stable_x - 1.2, 0.04, 0.2), B((stable_x + east) / 2 + 0.3, back - 0.01, 0.1), M.lime_plaster("#9c8a70", "plinth", grime=0.7), None))
        # Side walls: invisible full walls (light), visible cut stubs.
        for x0, x1 in ((0, west), (east, m.w)):
            wx0, wx1 = (x1 - WALL_T, x1) if x0 == 0 else (x0, x0 + WALL_T)
            full = common.box(f"side-{x0}", (wx1 - wx0, m.h - back + 1, ROOM_H - low), B((wx0 + wx1) / 2, (back + m.h) / 2 - 0.5, (ROOM_H + low) / 2), plaster, None)
            if x0 == east:
                full = self._east_window(full, x0, back)
            self.occluder(full)
            self._stub(f"side-{x0}", x0, x1, back, m.h, low, stone, cut)
        self._partition(back, front, low, plaster, stone, cut)
        door_xs = sorted(x for x, y in m.tiles("door"))
        gaps = [(door_xs[0], door_xs[-1] + 1)] if door_xs else []
        spans = []
        x = 0
        for g0, g1 in gaps:
            spans.append((x, g0))
            x = g1
        spans.append((x, m.w))
        for i, (s0, s1) in enumerate(spans):
            if s1 <= s0:
                continue
            full = common.box(f"front-{i}", (s1 - s0, WALL_T, ROOM_H - low), B((s0 + s1) / 2, front + WALL_T / 2, (ROOM_H + low) / 2), plaster, None)
            self.occluder(full)
            self._stub(f"front-{i}", s0, s1, front, front + 1, low, stone, cut, front=True)
        for g0, g1 in gaps:
            self.occluder(common.box("door-head", (g1 - g0, WALL_T, ROOM_H - 1.85), B((g0 + g1) / 2, front + WALL_T / 2, (ROOM_H + 1.85) / 2), plaster, None))
            dz = -STABLE_DROP if g1 <= stable_x + 1 else 0.0
            sill = common.box("threshold", (g1 - g0 - 0.1, 0.8, 0.06), self.Q((g0 + g1) / 2, front + 0.5, dz + 0.02), M.limestone("#c2ad88", "threshold", worn=0.6), None, bevel=0.015)
            common.bake_modifiers(sill)
            self._rand_attr(sill, 0.5)
            self.to_ground(sill)
            for s0, s1 in spans:
                if s1 > s0:
                    self.occluder(common.box(f"front-shade-{s0}", (s1 - s0, 0.2, ROOM_H + 1), B((s0 + s1) / 2, front + 1.35, ROOM_H / 2), plaster, None))
            # Outside the door: the lane, lit by the day.
            self.to_ground(tag(common.box("outside", (g1 - g0 + 2, 3.0, 0.02), B((g0 + g1) / 2, front + 2.4, dz - 0.01), M.plain("#b8a07c", 0.95, 0.1), None), DAYLIT))
            # At night the door is shut: its planks cut down like the walls,
            # the whole door still keeping the moonlight out.
            leaf = common.box("door-leaf", (g1 - g0 - 0.04, 0.09, STUB_H - dz + 0.02), self.Q((g0 + g1) / 2, front + 0.35, dz) + Vector((0, 0, (STUB_H - dz) / 2)), M.wood("#5e4430", 9.0), None, bevel=0.01)
            common.bake_modifiers(leaf)
            self.to_ground(tag(leaf, NIGHT))
            self.occluder(tag(common.box("door-shut", (g1 - g0, WALL_T, 1.9 - dz), B((g0 + g1) / 2, front + WALL_T / 2, (1.9 + dz) / 2), plaster, None), NIGHT))
        self._roof_with_hatch(back, front, west, east)
        self._house_back_wall(back, rng)
        self._house_lights(back, front)
        self._house_shafts(back)

    def _stub(self, name, x0, x1, y0, y1, low, stone, cut, front=False):
        """A wall cut down to a low stub: rubble, with its cut top showing."""
        depth = (y1 - y0) if not front else 0.9
        cy = (y0 + y1) / 2 if not front else y0 + 0.55
        stub = common.box(f"{name}-stub", (x1 - x0, depth, STUB_H - low), B((x0 + x1) / 2, cy, (STUB_H + low) / 2), stone, None, bevel=0.03)
        common.bake_modifiers(stub)
        self._rand_attr(stub)
        self.to_ground(stub)
        # The cut tops glow faintly (no light reaches them under the invisible
        # wall); at night, exposed for the lamps, less so.
        top = common.box(f"{name}-cut", (x1 - x0 - 0.06, depth - 0.06, 0.01), B((x0 + x1) / 2, cy, STUB_H + 0.005), cut, None)
        self.to_ground(tag(top, DAYLIT))
        top_n = common.box(f"{name}-cut-night", (x1 - x0 - 0.06, depth - 0.06, 0.01), B((x0 + x1) / 2, cy, STUB_H + 0.005), M.limestone("#8a7a62", "wall-cut-night", worn=0.6, glow=0.004), None)
        self.to_ground(tag(top_n, NIGHT))

    def _east_window(self, wall, x0, back):
        """A small window high in the east wall (the morning sun comes in),
        with wooden bars that stripe its light."""
        m = self.map
        rooms = [y for y in range(back, m.h - 1) if m.kind(x0 - 1, y) != "wall"]
        wy = (min(rooms) + max(rooms) + 1) / 2 - 0.5 if rooms else back + 3.4
        hole = common.box("window-hole", (3.0, 0.7, 0.8), B(x0 + 0.5, wy, 1.6), None, None)
        mod = wall.modifiers.new("window", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = hole
        common.bake_modifiers(wall)
        bpy.data.objects.remove(hole)
        for k in range(3):
            bar = common.box(f"window-bar{k}", (0.1, 0.035, 0.8), B(x0 + WALL_T / 2, wy - 0.22 + k * 0.22, 1.6), self.wood, None)
            self.occluder(bar)
        self._window_y = wy
        return wall

    def _partition(self, back, front, low, plaster, stone, cut):
        """The wall between the family room and the guest room: cut down to a
        stub either side of its doorway; the full wall (and the lintel over
        the doorway) keeps each room's light its own."""
        m = self.map
        cols = {}
        for x, y in m.tiles("wall"):
            if back <= y < front and 0 < x < m.w - 1:
                cols.setdefault(x, []).append(y)
        for x, ys in cols.items():
            runs = []
            for y in sorted(ys):
                if runs and y == runs[-1][1]:
                    runs[-1][1] = y + 1
                else:
                    runs.append([y, y + 1])
            door_rows = [y for y in range(back, front) if m.kind(x, y) != "wall"]
            for y0, y1 in runs:
                yy0 = back - 0.5 if y0 == back else y0
                full = common.box(f"part-{x}-{y0}", (WALL_T, y1 - yy0, ROOM_H - low), B(x + 0.5, (yy0 + y1) / 2, (ROOM_H + low) / 2), plaster, None)
                self.occluder(full)
                self._stub(f"part-{x}-{y0}", x + 0.2, x + 0.8, y0, y1, low, stone, M.limestone("#b8a68a", "partition-cut", worn=0.5, glow=0.07))
            for y in door_rows:
                self.occluder(common.box(f"part-head-{x}-{y}", (WALL_T, 1.0, ROOM_H - 1.9), B(x + 0.5, y + 0.5, (ROOM_H + 1.9) / 2), plaster, None))
                # Jambs of dressed stone either side of the doorway.
                for yy in (y + 0.04, y + 0.96):
                    j = common.box(f"jamb-{x}-{yy:.2f}", (0.62, 0.1, STUB_H + 0.06), B(x + 0.5, yy, (STUB_H + 0.06) / 2), M.limestone("#cbb894", "jamb", worn=0.5), None, bevel=0.02)
                    common.bake_modifiers(j)
                    self._rand_attr(j, 0.6)
                    self.to_ground(j)

    def _roof_with_hatch(self, back, front, west, east):
        """The roof keeps the sky out, except through the hatch the ladder
        goes up to (beside the back wall)."""
        m = self.map
        rx0, rx1 = west - WALL_T, east + WALL_T
        ry0, ry1 = 0.0, front + WALL_T
        z = ROOM_H + 0.1
        mat = M.plaster("#d4c19c")
        self.occluder(common.box("outer-back", (m.w + 2, 1.0, ROOM_H + 1), B(m.w / 2, back - 1.1, (ROOM_H + 1) / 2), mat, None))
        lad = next((e for e in m.entities if e.get("sprite") == "ladder"), None)
        if lad is None:
            self.occluder(common.box("roof", (rx1 - rx0, ry1 - ry0, 0.2), B((rx0 + rx1) / 2, (ry0 + ry1) / 2, z), mat, None))
            self._hatch = None
            return
        hx0, hx1 = lad["x"] + 0.05, lad["x"] + 1.05
        hy0, hy1 = back - 0.05, back + 0.8
        self._hatch = (hx0, hx1, hy0, hy1)
        for name, (a0, a1, b0, b1) in {
            "roof-w": (rx0, hx0, ry0, ry1),
            "roof-e": (hx1, rx1, ry0, ry1),
            "roof-n": (hx0, hx1, ry0, hy0),
            "roof-s": (hx0, hx1, hy1, ry1),
        }.items():
            if a1 - a0 > 1e-3 and b1 - b0 > 1e-3:
                self.occluder(common.box(name, (a1 - a0, b1 - b0, 0.2), B((a0 + a1) / 2, (b0 + b1) / 2, z), mat, None))

    def _house_back_wall(self, back, rng):
        """What is on the back wall: niches with lamps, a shelf of pots, pegs
        with a sickle, a coil of rope, strings of onions and garlic, a bundle
        of herbs; over the animals, a pack saddle and halters."""
        m = self.map
        y = back - 0.02
        dark = M.plain("#2a2018", 0.9, 0.1)
        clay = M.terracotta("#b27a52", 0.15)
        sx = self._stable_x
        oven = [x for x, _ in m.tiles("oven")]
        lad = [e["x"] for e in m.entities if e.get("sprite") == "ladder"]
        part = sorted({x for x, yy in m.tiles("wall") if back <= yy < m.h - 1 and 0 < x < m.w - 1})
        busy = [p + 0.5 for p in part] + [o + 0.5 for o in oven] + [lx + 0.5 for lx in lad]

        def clear(x, gap):
            while any(abs(x - b) < gap for b in busy):
                x += 0.4
            return x

        self._niche_lamps = []
        for i, nx in enumerate((sx + 3.4, sx + 8.6, m.w - 2.6)):
            nx = clear(nx, 0.9)
            self.to_ground(common.box(f"niche{i}", (0.5, 0.06, 0.4), B(nx, y + 0.02, 1.4), dark, None))
            self.to_ground(common.box(f"niche-sill{i}", (0.58, 0.12, 0.04), B(nx, y + 0.05, 1.19), M.lime_plaster("#cbbd9f", "sill"), None))
            self._niche_lamps.append(B(nx, y - 0.02, 1.21))
        # A shelf of bowls and a jug.
        shx = clear(sx + 5.8, 1.1)
        self.to_ground(common.box("shelf", (1.5, 0.18, 0.04), B(shx, y - 0.08, 1.78), self.wood, None))
        for k in range(4):
            prof = [(0.0, 0.0), (0.05, 0.0), (0.1, 0.05), (0.11, 0.07)] if k % 2 == 0 else [(0.03, 0.0), (0.06, 0.02), (0.07, 0.12), (0.04, 0.18), (0.045, 0.2)]
            self.to_ground(self._lathe(f"shelf-pot{k}", prof, B(shx - 0.55 + k * 0.36, y - 0.1, 1.8), clay, 18))
        # Pegs: a sickle, a coil of rope, strings of onions and garlic, herbs.
        for k, px in enumerate((sx + 2.2, sx + 7.2, sx + 10.6, sx + 11.4)):
            px = clear(px, 0.5)
            self.to_ground(self._branch(f"peg{k}", B(px, y, 2.02), B(px, y - 0.12, 2.0), 0.015, 0.012, self.wood, 5, bow=0.0))
            top = B(px, y - 0.1, 1.98)
            kind = k % 4
            if kind == 0:
                self._onion_string(f"onions{k}", top, rng, "#b98a52")
            elif kind == 1:
                self._rope_coil(f"rope{k}", top)
            elif kind == 2:
                self._onion_string(f"garlic{k}", top, rng, "#e4d8c0")
            else:
                self._sickle(f"sickle{k}", top)
        # Over the animals: a pack saddle and halters on pegs.
        for k, px in enumerate(p for p in (1.8, 3.6) if p < sx - 0.6):
            self.to_ground(self._branch(f"stable-peg{k}", B(px, y, 1.62), B(px, y - 0.12, 1.6), 0.015, 0.012, self.wood, 5, bow=0.0))
            if k == 0:
                sad = common.box("pack-saddle", (0.5, 0.14, 0.34), B(px, y - 0.1, 1.4), self.wood, None, bevel=0.03)
                common.bake_modifiers(sad)
                self.to_ground(sad)
                self.to_ground(common.box("saddle-pad", (0.56, 0.06, 0.42), B(px, y - 0.18, 1.36), M.textile(["#6a3a2a", "#b9a47c"], "saddle-pad", band=0.08), None))
            else:
                self._rope_coil(f"halter{k}", B(px, y - 0.1, 1.58), leather=True)

    def _onion_string(self, name, top, rng, color):
        mat = M.plain(color, 0.55, 0.35)
        for k in range(9):
            c = top + Vector(((rng.random() - 0.5) * 0.06, -0.02 - rng.random() * 0.04, -0.05 - k * 0.045))
            self.to_ground(self._ellipsoid(f"{name}-{k}", c, (0.032, 0.03, 0.03), mat, 10, 6))

    def _rope_coil(self, name, top, leather=False):
        bm = bmesh.new()
        for k in range(3):
            r = 0.12 - k * 0.012
            ring = [top + Vector((math.cos(math.tau * j / 20) * r * 0.7, -0.03 - k * 0.012, -r + math.sin(math.tau * j / 20) * r)) for j in range(20)]
            for j in range(20):
                a, b = ring[j], ring[(j + 1) % 20]
                v = [bm.verts.new(a + Vector((0, 0, 0.008))), bm.verts.new(b + Vector((0, 0, 0.008))), bm.verts.new(b - Vector((0, 0, 0.008))), bm.verts.new(a - Vector((0, 0, 0.008)))]
                bm.faces.new(v)
        mat = M.leather("#5a3a22") if leather else M.plain("#9a8458", 0.85)
        self.to_ground(common.mesh_object(name, bm, mat, None))

    def _sickle(self, name, top):
        blade = []
        for k in range(12):
            a = math.pi * 0.2 + k / 11 * math.pi * 1.1
            blade.append(top + Vector((0.1 + math.cos(a) * 0.14, -0.02, -0.18 + math.sin(a) * 0.14)))
        for k in range(len(blade) - 1):
            self.to_ground(self._branch(f"{name}-b{k}", blade[k], blade[k + 1], 0.008 * (1 - k / 12) + 0.004, 0.007 * (1 - k / 12) + 0.003, M.plain("#6a6660", 0.35, 0.6), 5, bow=0.0))
        self.to_ground(self._branch(f"{name}-h", top + Vector((0, -0.02, 0)), blade[0], 0.018, 0.016, M.wood("#6a4a2c"), 6, bow=0.0))

    def _house_lights(self, back, front):
        """By day: the sun through the window, the door and the roof hatch, the
        daylight they bounce round the room, one lamp in a niche, the oven's
        embers. At night: every lamp lit (the niches, the table, the guest
        room's stand), the oven glowing, a little warm light off the walls."""
        m = self.map
        sx = self._stable_x
        doors = m.tiles("door")
        if doors:
            xs = [d[0] for d in doors]
            cx = (min(xs) + max(xs) + 1) / 2
            dz = -STABLE_DROP if max(xs) < sx else 0.0
            light = self.add_light("door-daylight", "AREA", self.Q(cx, m.h - 1.15, 0.9 + dz), 120.0, "#ffe6c2")
            light.data.shape = "RECTANGLE"
            light.data.size = 1.8
            light.data.size_y = 1.6
            light.rotation_euler = (math.radians(75), 0, 0)
            tag(light, DAYLIT)
        part = [x for x, yy in m.tiles("wall") if back <= yy < m.h - 1 and 0 < x < m.w - 1]
        gx = min(part) if part else m.w - 1
        for name, (a, b) in {"room-fill": (sx, gx), "guest-fill": (gx + 1, m.w - 1)}.items():
            if b - a < 1:
                continue
            for suffix, power, color, when in (("", 42.0, "#ffd9a8", DAYLIT), ("-night", 4.0, "#ffae68", NIGHT)):
                fill = self.add_light(name + suffix, "AREA", B((a + b) / 2, (back + m.h - 1) / 2, ROOM_H - 0.25), power * (b - a) / 11, color)
                fill.data.shape = "RECTANGLE"
                fill.data.size = b - a - 0.5
                fill.data.size_y = max(1.0, m.h - 2 - back)
                tag(fill, when)
        card = self.add_light("front-bounce", "AREA", B(m.w / 2, m.h - 1.06, 1.2), 50.0, "#ffdcb0")
        card.data.shape = "RECTANGLE"
        card.data.size = m.w - 2.5
        card.data.size_y = 1.4
        card.rotation_euler = (math.radians(88), 0, 0)
        tag(card, DAYLIT)
        if sx > 2:
            for suffix, power, color, when in (("", 16.0, "#ffd9a8", DAYLIT), ("-night", 2.4, "#ffae68", NIGHT)):
                st = self.add_light("stable-fill" + suffix, "AREA", B(sx / 2, (back + m.h - 1) / 2, ROOM_H - 0.4), power, color)
                st.data.shape = "RECTANGLE"
                st.data.size = sx - 1
                st.data.size_y = m.h - 2 - back
                tag(st, when)
            # A lamp in a niche over the animals, lit at night.
            nx = sx * 0.55
            self.to_ground(common.box("stable-niche", (0.44, 0.08, 0.36), B(nx, back + 0.02, 1.42), M.plain("#2a2018", 0.9, 0.1), None))
            self.to_ground(common.box("stable-niche-sill", (0.52, 0.12, 0.04), B(nx, back + 0.05, 1.23), M.limestone("#a08a68", "stable-sill", worn=0.6), None))
            self.clay_lamp("stable-lamp", B(nx, back - 0.02, 1.25), lit=NIGHT, power=9.0)
        # Lamps in the niches: one burns by day, all of them at night.
        for i, at in enumerate(self._niche_lamps):
            self.clay_lamp(f"niche-lamp{i}", at, lit=True if i == 1 else NIGHT, power=10.0)
        # A lamp on the table, and one on a stand in the guest room, at night.
        for x0, x1, y in m.runs("table"):
            self.clay_lamp(f"table-lamp-{x0}", self.P(x0 + 0.62, y + 0.45, 0.47), lit=NIGHT, power=4.5)
        if gx < m.w - 2:
            ys = [y for y in range(back, m.h - 1) if m.walkable(m.w - 2, y) and m.kind(m.w - 2, y) not in ("bedroll", "mat")]
            if ys:
                self.lampstand("guest-lampstand", m.w - 2, ys[0])

    def clay_lamp(self, name, at, lit=True, power=12.0, into=None):
        """A clay oil lamp: a round body, a filling hole, a nozzle with its
        wick; lit (always, or only in the variants named), a small flame and
        its light, which the game makes flicker."""
        objs = []
        body = self._lathe(f"{name}-body", [(0.0, 0.0), (0.04, 0.0), (0.07, 0.018), (0.068, 0.03), (0.03, 0.04), (0.012, 0.038)], at, M.terracotta("#b2714a", 0.1), 20)
        nozzle = self._ellipsoid(f"{name}-nozzle", at + Vector((0.075, 0, 0.022)), (0.035, 0.022, 0.014), M.terracotta("#a8683f", 0.1), 10, 6)
        objs += [body, nozzle]
        if lit:
            fl = self._flame(f"{name}-flame", at + Vector((0.1, 0, 0.03)), 0.045, 0.012)
            light = self.add_light(f"{name}-light", "POINT", at + Vector((0.1, -0.05, 0.09)), power, "#ffae5a", radius=0.03)
            if isinstance(lit, str):
                tag(fl, lit)
                tag(light, lit)
            objs.append(fl)
            variants = lit.split(",") if isinstance(lit, str) else ["day", "late", "night"]
            self.flicker.append(("lamp", at.x * 32, (-at.y - at.z) * 32, 30.0, variants))
        if into is None:
            for o in objs:
                self.to_ground(o)
        else:
            into += objs
        return objs

    def _flame(self, name, base, h, r):
        """A small flame: two crossed tapering blades, hot at the root."""
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        for rot in (0.0, math.pi / 2):
            ca, sa = math.cos(rot), math.sin(rot)
            prev = None
            for k in range(6):
                t = k / 5
                w = r * math.sin(min(1.0, t * 1.4 + 0.15) * math.pi) * (1 - t * 0.6) + 0.0005
                c = base + Vector((0.004 * math.sin(t * 5), 0, h * t))
                a = bm.verts.new(c + Vector((-ca * w, -sa * w, 0)))
                b = bm.verts.new(c + Vector((ca * w, sa * w, 0)))
                if prev:
                    f = bm.faces.new((prev[0], prev[1], b, a))
                    t0 = (k - 1) / 5
                    for loop, (u, v) in zip(f.loops, ((0, t0), (1, t0), (1, t), (0, t))):
                        loop[uv].uv = (u, v)
                prev = (a, b)
        obj = common.mesh_object(name, bm, flame(22.0), None, smooth=True)
        obj.visible_shadow = False
        return obj

    def lampstand(self, name, x, y):
        """A lamp on a low stand of stone (a pillar with a dished top) in the
        guest room: lit at night."""
        c = self.P(x + 0.5, y + 0.5)
        post = self._lathe(f"{name}-post", [(0.09, 0.0), (0.08, 0.05), (0.05, 0.08), (0.045, 0.5), (0.08, 0.54), (0.09, 0.58)], c, M.limestone("#cdbb96", "stand", worn=0.4), 18)
        self._rand_attr(post, 0.4)
        self.to_ground(post)
        self.clay_lamp(f"{name}-lamp", c + Vector((-0.05, 0.0, 0.58)), lit=NIGHT, power=16.0)

    def _house_shafts(self, back):
        """Dust in the sunbeams by day: through the east window and down from
        the roof hatch (prisms along the sun's path)."""
        import lighting

        m = self.map
        sun = lighting.sun_vector("day")
        d = Vector((-sun.x, -sun.y, -sun.z))
        east = m.w - 1
        wy = getattr(self, "_window_y", back + 3.4)
        openings = [[B(east, wy - 0.32, 1.25), B(east, wy + 0.32, 1.25), B(east, wy + 0.32, 1.95), B(east, wy - 0.32, 1.95)]]
        if getattr(self, "_hatch", None):
            hx0, hx1, hy0, hy1 = self._hatch
            openings.append([B(hx0, hy0, ROOM_H), B(hx1, hy0, ROOM_H), B(hx1, hy1, ROOM_H), B(hx0, hy1, ROOM_H)])
        mat = bpy.data.materials.get("dust-shaft") or self._shaft_material()
        for k, quad in enumerate(openings):
            bm = bmesh.new()
            top = [bm.verts.new(p) for p in quad]
            floor = []
            for p in quad:
                t = (p.z + 0.3) / max(1e-4, -d.z)
                floor.append(bm.verts.new(p + d * t))
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new((top[i], top[j], floor[j], floor[i]))
            bm.faces.new(top[::-1])
            bm.faces.new(floor)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            obj = common.mesh_object(f"village-shaft{k}", bm, mat, None)
            tag(obj, "day")
            self.to_ground(obj)
            self.volumes.append(obj)

    # ── the house's tile kinds ──────────────────────────────────────────────
    def tile_straw(self):
        """The animals' end of a village house: a floor of trodden earth deep
        in loose straw and chaff, heaped against the walls and under the
        mangers, with droppings here and there."""
        m = self.map
        cells = m.tiles("straw")
        if not cells:
            return
        from place import value_noise

        field = value_noise(m.w * 4 + 8, m.h * 4 + 8, 6, 131)
        self.straw_cover("straw-floor", cells, 900.0, seed=5, sub=4)
        # Thicker drifts where the noise says (and along the walls).
        self.straw_cover("straw-drifts", cells, 2200.0, sub=4, keep=lambda x0, y0: field[int(y0 * 4), int(x0 * 4)] > 0.58 or x0 < 1.6, seed=7, z=0.02)
        rng = self.rng
        dung = M.plain("#3e3326", 0.75, 0.2)
        for x, y in cells:
            if rng.random() < 0.25:
                for k in range(2 + int(rng.random() * 3)):
                    c = self.P(x + 0.2 + rng.random() * 0.6, y + 0.2 + rng.random() * 0.6, 0.02)
                    self.to_ground(self._ellipsoid(f"dung-{x}-{y}-{k}", c, (0.03, 0.026, 0.018), dung, 8, 5))

    def tile_platform(self):
        """The raised family floor: beaten earth finished with lime plaster
        (its colour is the ground layer's); crumbs, a few rushes and straw
        carried up from the animals' end near the steps."""
        m = self.map
        cells = m.tiles("platform")
        if not cells:
            return
        near_steps = [(x, y) for x, y in cells if m.near(x, y, ("steps", "manger"), 1)]
        if near_steps:
            self.straw_cover("platform-straw", near_steps, 90.0, seed=11, sub=2)
        rng = self.rng
        rush = M.plain("#b8a070", 0.85, 0.15)
        bm = bmesh.new()
        for x, y in cells:
            if rng.random() < 0.3:
                for _ in range(3 + int(rng.random() * 5)):
                    cx, cy = x + rng.random(), y + rng.random()
                    a = rng.random() * math.tau
                    ln = 0.05 + rng.random() * 0.07
                    dx, dy = math.cos(a) * ln / 2, math.sin(a) * ln / 2
                    v = [bm.verts.new(self.P(cx - dx, cy - dy - 0.003, 0.004)), bm.verts.new(self.P(cx + dx, cy + dy - 0.003, 0.004)), bm.verts.new(self.P(cx + dx, cy + dy + 0.003, 0.004)), bm.verts.new(self.P(cx - dx, cy - dy + 0.003, 0.004))]
                    bm.faces.new(v)
        self.ground_objects.append(common.mesh_object("platform-rushes", bm, rush, self.col_ground, smooth=False))

    def tile_manger(self):
        """Mangers: troughs cut from single blocks of limestone, standing on
        the animals' floor against the edge of the family floor (their rims
        level with it), hollowed out and full of chopped straw and fodder.
        The chisel marks are worn smooth where muzzles rub. One per tile."""
        rng = self.rng
        stone = M.limestone("#a8916e", "manger-stone", worn=0.75)
        fodder_mat = M.plain("#a88d52", 0.9, 0.1)
        for x, y in self.map.tiles("manger"):
            name = f"manger-{x}-{y}"
            objs = []
            h = STABLE_DROP + 0.1
            x0, x1 = x + 0.1, x + 0.93
            y0, y1 = y + 0.06, y + 0.94
            # The block: a hewn slab of stone, its edges worn round.
            block = self.rounded_block(f"{name}-block", x0, x1, y0, y1, -0.05, h, stone, rng, roundness=0.28)
            # The hollow: an oval basin cut out of the top.
            hole = self._ellipsoid(f"{name}-hole", self.P((x0 + x1) / 2, (y0 + y1) / 2, h + 0.02), ((x1 - x0) * 0.36, (y1 - y0) * 0.4, 0.14), None, 24, 12)
            mod = block.modifiers.new("hollow", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.object = hole
            common.bake_modifiers(block)
            bpy.data.objects.remove(hole)
            objs.append(block)
            # Fodder heaped in the hollow, a little spilling over the rim.
            f = self.heap(f"{name}-fodder", (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) * 0.38, (y1 - y0) * 0.42, 0.08, base_z=h - 0.08, seed=x * 7 + y, stalk_density=1400.0)
            f[0].data.materials[0] = fodder_mat
            objs += f
            self.sprite(name, y + 0.94, objs, [(x, y)])

    def tile_steps(self):
        """Stone steps: up to the north (a town), or (in a village house) up
        from the animals' end to the family floor, three treads rising east."""
        if not (self.village and self.style == "home"):
            return super().tile_steps()
        rng = self.rng
        stone = M.limestone("#a38c6a", "step-stone", worn=0.7)
        cols = {}
        for x, y in self.map.tiles("steps"):
            cols.setdefault(x, []).append(y)
        for x, ys in cols.items():
            ya, yb = min(ys), max(ys) + 1
            bm = bmesh.new()
            layer = bm.faces.layers.float.new("rand")
            for k in range(3):
                top = -STABLE_DROP + STABLE_DROP * (k + 1) / 3
                xa, xb = x + k / 3, x + (k + 1) / 3 + (0.08 if k < 2 else 0.0)
                yy = ya + 0.02
                while yy < yb - 0.05:
                    ln = min(yb - 0.02 - yy, 0.45 + rng.random() * 0.5)
                    cube = bmesh.ops.create_cube(bm, size=1.0)
                    for v in cube["verts"]:
                        u, w, z = v.co.x + 0.5, v.co.y + 0.5, v.co.z + 0.5
                        zz = -STABLE_DROP - 0.02 + (top + STABLE_DROP + 0.02) * z + (rng.random() - 0.5) * 0.008 * z
                        v.co = self.Q(xa + 0.01 + (xb - xa - 0.02) * u, yy + 0.008 + (ln - 0.016) * (1 - w), zz)
                    r = rng.random()
                    for f in bm.faces:
                        if f.verts[0] in cube["verts"]:
                            f[layer] = r
                    yy += ln
            obj = common.mesh_object(f"steps-{x}-{ya}", bm, stone, self.col_ground, smooth=False)
            common.add_modifier(obj, "BEVEL", width=0.012, segments=2)
            self.ground_objects.append(obj)

    def tile_hay(self):
        """Heaps of straw and chaff: bedding and fodder, piled against a wall
        or by a threshing floor. One sprite per heap."""
        rng = self.rng
        for x, y in self.map.tiles("hay"):
            name = f"hay-{x}-{y}"
            big = 1.0 if self.style == "home" else 0.9
            objs = self.heap(name, x + 0.5 + (rng.random() - 0.5) * 0.1, y + 0.52, 0.52 * big, 0.46 * big, 0.62 * big, seed=x * 13 + y)
            self.sprite(name, y + 0.92, objs, [(x, y)])
            # A little loose straw round its foot.
            self.straw_cover(f"{name}-spill", [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (0, 1) if self.map.walkable(x + dx, y + dy)], 260.0, seed=x + y * 3)

    # ── animals ─────────────────────────────────────────────────────────────
    def _barrel(self, name, L, W, D, zc, mat, square=2.5, taper=0.12, rings=40, around=36):
        """An animal's body as one smooth closed surface along x (forward):
        length L, width W, depth D, centred at height zc. Its plan and
        section are superellipses (`square` > 2 is squarer), the front
        narrower than the back by `taper`, the back a little higher over
        the rump and the belly rounder than the back."""
        bm = bmesh.new()

        def se(c, e):
            return math.copysign(abs(c) ** (2.0 / e), c)

        verts = []
        for i in range(1, rings):
            th = math.pi * i / rings
            t = -math.cos(th)  # -1 (rump) .. 1 (chest)
            prof = se(math.sin(th), square)
            w = W / 2 * prof * (1.0 - taper * (t + 1) / 2)
            d = D / 2 * prof
            x = L / 2 * t
            ring = []
            for j in range(around):
                ph = math.tau * j / around
                cy, cz = se(math.cos(ph), square), se(math.sin(ph), square)
                # The back broad and flat-ish, the belly rounder.
                if cz < 0:
                    cy *= 1.0 - 0.12 * (-cz)
                ring.append(bm.verts.new((x, w * cy, zc + d * cz + D * 0.03 * (1 - t) / 2)))
            verts.append(ring)
        back = bm.verts.new((-L / 2, 0, zc + D * 0.03))
        front = bm.verts.new((L / 2, 0, zc))
        for a, b in zip(verts, verts[1:]):
            for j in range(around):
                k = (j + 1) % around
                bm.faces.new((a[j], a[k], b[k], b[j]))
        for j in range(around):
            k = (j + 1) % around
            bm.faces.new((back, verts[0][k], verts[0][j]))
            bm.faces.new((front, verts[-1][j], verts[-1][k]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return common.mesh_object(name, bm, mat, None)

    def quadruped(self, name, at, yaw, kind="sheep", pose="stand", seed=0, speckled=False, head_up=0.0, calling=False, scale=1.0):
        """A sheep, lamb or goat, built in its own space (x forward, y left, z
        up; the ground at z = 0) and placed at Blender point `at`, turned by
        `yaw` (0 faces east). Sheep are the fat-tailed breed of the hills:
        a heavy cream fleece, a long brown or black head with a Roman nose
        and drooping ears, a broad tail. Goats are black and long-haired,
        with drooping ears, a beard and horns sweeping back. `pose` is
        'stand' or 'lie' (legs folded under); `head_up` lifts the head
        (radians); `calling`, mouth open."""
        rng = self.rng
        sheep = kind in ("sheep", "lamb")
        s = scale * (0.62 if kind == "lamb" else 1.0)
        L, W, D = 0.8 * s, 0.5 * s, 0.4 * s
        if kind == "goat":
            L, W, D = 0.74 * s, 0.26 * s, 0.3 * s
        lying = pose == "lie"
        leg = (0.34 if sheep else 0.4) * s * (1.25 if kind == "lamb" else 1.0)
        hb = D * 0.48 if lying else leg + D * 0.5
        head_cols = ["#5a3a26", "#2e2620", "#a8805a", "#6e4a30"]
        head_col = head_cols[seed % len(head_cols)] if sheep else "#1e1a18"
        if kind == "lamb" and speckled:
            head_col = "#4a3a2c"
        body_mat = fleece("#dccfb2" if kind != "lamb" else "#e6dcc6", speckle="#4a3a2c" if speckled else None) if sheep else coat("#2c2522", "goat-coat", sheen="#8a8a94")
        head_mat = coat(head_col, None, sheen="#7a6a58") if sheep else coat("#2a2320", "goat-head", sheen="#8a8a94")
        hoof = M.plain("#2a2420", 0.5, 0.3)
        eye = M.plain("#0c0a08", 0.15, 0.6)
        objs = []

        def ell(nm, c, r, mat, seg=18, rings=10):
            o = self._ellipsoid(f"{name}-{nm}", Vector(c), r, mat, seg, rings)
            objs.append(o)
            return o

        def limb(nm, a, b, r0, r1, mat):
            o = self._branch(f"{name}-{nm}", Vector(a), Vector(b), r0, r1, mat, 10, bow=0.0)
            objs.append(o)
            return o

        # Body: one smooth barrel (no seams between chest and rump), broad
        # over the rump and narrower at the shoulders; a sheep's squarer in
        # section, like a bolster of fleece, a goat's rounder and leaner.
        body = self._barrel(f"{name}-body", L, W, D, hb, body_mat, square=2.5 if sheep else 2.1, taper=0.14 if sheep else 0.08)
        objs.append(body)
        if sheep:
            for o in objs:
                tex = bpy.data.textures.get("fleece-lumps") or bpy.data.textures.new("fleece-lumps", "CLOUDS")
                tex.noise_scale = 0.05 * s
                tex.noise_depth = 2
                common.add_modifier(o, "DISPLACE", texture=tex, strength=0.04 * s, mid_level=0.35)
            # The broad fat tail hanging behind.
            ell("tail", (-L * 0.49, 0, hb - D * 0.1), (0.1 * s, W * 0.34, D * 0.4), body_mat, 16, 10)
        else:
            # Long black hair hanging from the flanks and belly.
            bm = bmesh.new()
            for k in range(160):
                a = rng.random() * math.tau
                u = rng.random() * 2 - 1
                if abs(math.sin(a)) < 0.35:
                    continue
                px = u * L * 0.42
                py = math.sin(a) * W * 0.5 * math.sqrt(max(0.0, 1 - u * u * 0.6))
                pz = hb - D * 0.1 + math.cos(a) * D * 0.3
                ln = 0.06 + rng.random() * 0.1
                p0 = Vector((px, py, pz))
                p1 = p0 + Vector(((rng.random() - 0.5) * 0.03, math.copysign(0.02, py), -ln))
                sd = Vector((0.006, 0, 0))
                v = [bm.verts.new(p0 - sd), bm.verts.new(p0 + sd), bm.verts.new(p1 + sd * 0.3), bm.verts.new(p1 - sd * 0.3)]
                bm.faces.new(v)
            objs.append(common.mesh_object(f"{name}-hair", bm, body_mat, None))
            # A short tail flicked up.
            limb("tail", (-L * 0.48, 0, hb + D * 0.3), (-L * 0.56, 0, hb + D * 0.55), 0.018 * s, 0.01 * s, body_mat)
        # Neck and head.
        rise = 0.35 + head_up
        if lying:
            rise = 0.55 + head_up
        n0 = Vector((L * 0.4, 0, hb + D * 0.18))
        neck_len = (0.24 if sheep else 0.26) * s
        n1 = n0 + Vector((math.cos(rise), 0, math.sin(rise))) * neck_len
        # The neck, a fleece-covered column tapering from the body to the
        # head, its end rounded off (no cut end showing).
        neck_mat = body_mat if sheep else head_mat
        neck = [limb("neck", n0, n1, W * 0.32, W * 0.17, neck_mat), ell("neck-end", n1, (W * 0.17, W * 0.17, W * 0.17), neck_mat, 14, 8)]
        if sheep:
            for o in neck:
                common.add_modifier(o, "SUBSURF", levels=2, render_levels=2)
                common.add_modifier(o, "DISPLACE", texture=bpy.data.textures["fleece-lumps"], strength=0.025 * s, mid_level=0.35)
        tilt = -0.9 + head_up * 0.6
        hl = (0.25 if sheep else 0.2) * s
        hd = Vector((math.cos(tilt), 0, math.sin(tilt)))
        hc = n1 + hd * hl * 0.45
        head = self._ellipsoid(f"{name}-head", Vector((0, 0, 0)), (hl * 0.55, (0.068 if sheep else 0.058) * s, (0.078 if sheep else 0.066) * s), head_mat, 18, 10)
        head.data.transform(Matrix.Translation(hc) @ Matrix.Rotation(-tilt, 4, "Y"))
        objs.append(head)
        muzzle = self._ellipsoid(f"{name}-muzzle", Vector((0, 0, 0)), (0.05 * s, 0.045 * s, 0.05 * s), head_mat, 12, 8)
        muzzle.data.transform(Matrix.Translation(hc + hd * hl * 0.45 + Vector((0, 0, -0.012 * s))) @ Matrix.Rotation(-tilt, 4, "Y"))
        objs.append(muzzle)
        if calling:
            mouth = self._ellipsoid(f"{name}-mouth", Vector((0, 0, 0)), (0.03 * s, 0.028 * s, 0.012 * s), M.plain("#3a1c16", 0.5), 10, 6)
            mouth.data.transform(Matrix.Translation(hc + hd * hl * 0.62 + Vector((0, 0, -0.04 * s))) @ Matrix.Rotation(-tilt - 0.4, 4, "Y"))
            objs.append(mouth)
        for side in (-1, 1):
            e = self._ellipsoid(f"{name}-eye{side}", hc + hd * hl * 0.02 + Vector((0, side * 0.05 * s, 0.03 * s)), (0.012 * s, 0.01 * s, 0.011 * s), eye, 8, 6)
            objs.append(e)
            # Long ears hanging down beside the head.
            ear_top = hc - hd * hl * 0.25 + Vector((0, side * 0.055 * s, 0.035 * s))
            ear = self._ellipsoid(f"{name}-ear{side}", Vector((0, 0, 0)), (0.03 * s, 0.012 * s, (0.075 if sheep else 0.1) * s), head_mat, 10, 8)
            ear.data.transform(Matrix.Translation(ear_top + Vector((0.01 * s, side * 0.025 * s, -0.06 * s))) @ Matrix.Rotation(side * 0.35, 4, "X") @ Matrix.Rotation(0.3, 4, "Y"))
            objs.append(ear)
            if kind == "goat":
                # Horns sweeping back and out.
                p = hc - hd * hl * 0.15 + Vector((0, side * 0.03 * s, 0.06 * s))
                prev = p
                for k in range(6):
                    t = (k + 1) / 6
                    q = p + Vector((-0.12 * s * t, side * 0.05 * s * t, 0.1 * s * math.sin(t * 2.2)))
                    limb(f"horn{side}{k}", prev, q, 0.02 * s * (1 - t * 0.7), 0.02 * s * (1 - (t + 0.16) * 0.7), M.plain("#4a4034", 0.6, 0.3))
                    prev = q
        if kind == "goat":
            chin = hc + hd * hl * 0.3 + Vector((0, 0, -0.07 * s))
            limb("beard", chin, chin + Vector((-0.02 * s, 0, -0.08 * s)), 0.018 * s, 0.006 * s, head_mat)
        # Legs.
        leg_mat = head_mat
        if lying:
            for side in (-1, 1):
                a = Vector((L * 0.26, side * W * 0.24, 0.05 * s))
                limb(f"fore{side}", a, a + Vector((0.12 * s, -side * 0.03 * s, -0.01 * s)), 0.03 * s, 0.022 * s, leg_mat)
                objs.append(self._ellipsoid(f"{name}-hoof{side}", a + Vector((0.13 * s, -side * 0.03 * s, -0.012 * s)), (0.022 * s, 0.018 * s, 0.018 * s), hoof, 8, 6))
            hk = Vector((-L * 0.22, W * 0.46, 0.06 * s))
            limb("hind", hk, hk + Vector((0.16 * s, 0.03 * s, -0.03 * s)), 0.035 * s, 0.022 * s, leg_mat)
        else:
            for fx in (L * 0.3, -L * 0.3):
                for side in (-1, 1):
                    top = Vector((fx, side * W * 0.26, hb - D * 0.3))
                    knee = Vector((fx + (0.01 if fx > 0 else -0.02) * s, side * W * 0.24, leg * 0.5))
                    foot = Vector((fx + (0.0 if fx > 0 else -0.01) * s, side * W * 0.24, 0.04 * s))
                    limb(f"leg{fx:.2f}{side}a", top, knee, (0.05 if sheep else 0.04) * s, 0.026 * s, body_mat if sheep else leg_mat)
                    limb(f"leg{fx:.2f}{side}b", knee, foot, 0.022 * s, 0.018 * s, leg_mat)
                    objs.append(self._lathe(f"{name}-hoof{fx:.2f}{side}", [(0.02 * s, 0.0), (0.017 * s, 0.045 * s)], foot + Vector((0, 0, -0.04 * s)), hoof, 10))
        T = Matrix.Translation(at) @ Matrix.Rotation(yaw, 4, "Z")
        for o in objs:
            o.matrix_world = T
        return objs

    def donkey(self, name, at, yaw, load="none", head_down=0.25, seed=0):
        """A small grey-brown village donkey, built in its own space and placed
        at `at` turned by `yaw` (0 faces east): a barrel of a body on slender
        legs, pale belly and muzzle, the dark stripe down the back and across
        the shoulders, long upright ears, a short mane, a thin tail with a
        dark tuft. `load`: 'none' (a halter and a folded blanket), 'pack' (a
        wooden pack saddle with panniers and a bundle)."""
        objs = []
        coat_mat = donkey_coat()
        dark = coat("#3a3029", "donkey-dark", sheen="#6a5a4a")
        pale = coat("#d4cab8", "donkey-pale", sheen="#e0d8c8")
        hoof = M.plain("#2a2420", 0.5, 0.3)
        eye = M.plain("#0c0a08", 0.15, 0.6)

        def ell(nm, c, r, mat, seg=20, rings=12):
            o = self._ellipsoid(f"{name}-{nm}", Vector(c), r, mat, seg, rings)
            objs.append(o)
            return o

        def limb(nm, a, b, r0, r1, mat, seg=10):
            o = self._branch(f"{name}-{nm}", Vector(a), Vector(b), r0, r1, mat, seg, bow=0.0)
            objs.append(o)
            return o

        ell("body", (0.0, 0, 0.7), (0.48, 0.19, 0.21), coat_mat, 32, 18)
        ell("chest", (0.3, 0, 0.72), (0.2, 0.17, 0.2), coat_mat)
        ell("rump", (-0.33, 0, 0.74), (0.21, 0.19, 0.2), coat_mat)
        ell("withers", (0.24, 0, 0.84), (0.14, 0.1, 0.08), coat_mat)
        # Neck up and forward; the head hangs a little (resting).
        n0 = Vector((0.36, 0, 0.8))
        n1 = Vector((0.6, 0, 1.06 - head_down * 0.3))
        limb("neck", n0, n1, 0.13, 0.085, coat_mat, 14)
        limb("mane", n0 + Vector((-0.02, 0, 0.11)), n1 + Vector((-0.04, 0, 0.07)), 0.022, 0.02, dark, 6)
        tilt = -1.05 - head_down * 0.5
        hd = Vector((math.cos(tilt), 0, math.sin(tilt)))
        hc = n1 + hd * 0.17 + Vector((0.02, 0, 0.0))
        head = self._ellipsoid(f"{name}-head", Vector((0, 0, 0)), (0.2, 0.075, 0.09), coat_mat, 20, 12)
        head.data.transform(Matrix.Translation(hc) @ Matrix.Rotation(-tilt, 4, "Y"))
        objs.append(head)
        muzzle = self._ellipsoid(f"{name}-muzzle", Vector((0, 0, 0)), (0.075, 0.068, 0.07), pale, 14, 8)
        muzzle.data.transform(Matrix.Translation(hc + hd * 0.17) @ Matrix.Rotation(-tilt, 4, "Y"))
        objs.append(muzzle)
        for side in (-1, 1):
            ell(f"nostril{side}", hc + hd * 0.23 + Vector((0, side * 0.03, 0.01)), (0.012, 0.01, 0.012), M.plain("#1a1410", 0.6))
            ell(f"eye{side}", hc - hd * 0.02 + Vector((0, side * 0.07, 0.035)), (0.018, 0.012, 0.016), eye, 8, 6)
            ell(f"eyering{side}", hc - hd * 0.02 + Vector((0, side * 0.066, 0.035)), (0.028, 0.012, 0.026), pale, 8, 6)
            base = hc - hd * 0.12 + Vector((0, side * 0.045, 0.06))
            ear = self._ellipsoid(f"{name}-ear{side}", Vector((0, 0, 0)), (0.04, 0.018, 0.13), coat_mat, 12, 8)
            ear.data.transform(Matrix.Translation(base + Vector((-0.03, side * 0.03, 0.11))) @ Matrix.Rotation(side * 0.28, 4, "X") @ Matrix.Rotation(-0.35, 4, "Y"))
            objs.append(ear)
            tip = self._ellipsoid(f"{name}-eartip{side}", Vector((0, 0, 0)), (0.03, 0.02, 0.035), dark, 8, 6)
            tip.data.transform(Matrix.Translation(base + Vector((-0.075, side * 0.06, 0.22))) @ Matrix.Rotation(side * 0.28, 4, "X") @ Matrix.Rotation(-0.35, 4, "Y"))
            objs.append(tip)
        # Legs: slender, pale below, small hooves.
        for fx, lean in ((0.3, 0.0), (-0.34, -0.03)):
            for side in (-1, 1):
                top = Vector((fx, side * 0.1, 0.6))
                knee = Vector((fx + lean, side * 0.095, 0.32))
                foot = Vector((fx + lean * 0.5, side * 0.095, 0.05))
                limb(f"leg{fx}{side}a", top, knee, 0.065 if fx > 0 else 0.075, 0.035, coat_mat)
                limb(f"leg{fx}{side}b", knee, foot, 0.032, 0.026, pale)
                objs.append(self._lathe(f"{name}-hoof{fx}{side}", [(0.03, 0.0), (0.026, 0.055)], foot + Vector((0, 0, -0.05)), hoof, 10))
        limb("tail", (-0.52, 0, 0.8), (-0.56, 0, 0.42), 0.02, 0.012, coat_mat, 6)
        ell("tuft", (-0.565, 0, 0.36), (0.03, 0.025, 0.07), dark, 10, 6)
        wood = M.wood("#6a4a2c", 4.0)
        rope = M.plain("#8a7550", 0.9)
        # A halter of rope round the muzzle and behind the ears.
        limb("halter", hc + hd * 0.1 + Vector((0, 0, 0.07)), hc - hd * 0.1 + Vector((0, 0, 0.1)), 0.01, 0.01, rope, 6)
        if load == "pack":
            ell("pad", (0.02, 0, 0.9), (0.26, 0.23, 0.05), M.textile(["#7a3a2c", "#c9b996", "#3c4c5e"], "pack-pad", band=0.07), 20, 8)
            for side in (-1, 1):
                limb(f"saddle{side}", (-0.2, side * 0.12, 0.96), (0.24, side * 0.12, 0.96), 0.03, 0.03, wood, 6)
                pan = self._lathe(f"{name}-pannier{side}", [(0.1, 0.0), (0.15, 0.08), (0.16, 0.26), (0.17, 0.28)], Vector((0.02, side * 0.27, 0.52)), M.straw("#a88a58"), 20)
                objs.append(pan)
                ell(f"pannier-fill{side}", (0.02, side * 0.27, 0.8), (0.14, 0.14, 0.05), M.burlap("#9c8660"), 14, 8)
            ell("bundle", (0.0, 0, 1.06), (0.2, 0.17, 0.11), M.burlap("#8e7a58"), 16, 8)
            limb("girth", (0.12, -0.2, 0.9), (0.12, 0.2, 0.9), 0.012, 0.012, rope, 6)
        else:
            ell("blanket", (0.04, 0, 0.9), (0.24, 0.21, 0.04), M.textile(["#6a3a2a", "#c9b996", "#6a3a2a"], "donkey-blanket", band=0.06), 18, 8)
        T = Matrix.Translation(at) @ Matrix.Rotation(yaw, 4, "Z")
        for o in objs:
            o.matrix_world = T
        return objs

    def entity_donkey(self, name, x, y, e=None, packed=False):
        if not self.village:
            return super().entity_donkey(name, x, y, e, packed=True)
        yaw = 0.0 if self.style == "home" else math.radians(200 if (x + y) % 2 else -20)
        return self.donkey(name, self.P(x + 0.5, y + 0.62), yaw, "pack" if packed else "none", seed=x + y)

    def entity_pack_donkey(self, name, x, y, e=None):
        if not self.village:
            return super().entity_pack_donkey(name, x, y, e)
        return self.entity_donkey(name, x, y, e, packed=True)

    def flock(self, x, y, n=None, seed=0):
        """Two or three sheep lying close together in a tile (a few facing
        each other, heads up or resting), a little over its edges."""
        rng = self.rng
        n = n or (2 + (1 if rng.random() < 0.55 else 0))
        objs = []
        spots = [(0.3, 0.35), (0.72, 0.6), (0.4, 0.82)]
        for k in range(n):
            dx, dy = spots[k]
            yaw = rng.random() * math.tau
            up = rng.random() * 0.5 - (0.35 if rng.random() < 0.3 else 0.0)
            objs += self.quadruped(f"sheep-{x}-{y}-{k}", self.P(x + dx + (rng.random() - 0.5) * 0.1, y + dy + (rng.random() - 0.5) * 0.1), yaw, "sheep", "lie", seed=seed + k, head_up=up, scale=0.9 + rng.random() * 0.15)
        return objs

    def tile_sheep(self):
        """Sheep lying together, two or three to a tile: the village flock
        settling in the fold for the night."""
        for i, (x, y) in enumerate(self.map.tiles("sheep")):
            self.sprite(f"sheep-{x}-{y}", y + 0.95, self.flock(x, y, seed=i), [(x, y)])

    def entity_ewe(self, name, x, y, e=None):
        """The lamb's mother: a ewe standing at the fold wall, head up,
        calling toward the gully (or, her lamb back, quietly standing)."""
        calling = e is not None and e.get("kind") == "clue"
        return self.quadruped(name, self.P(x + 0.5, y + 0.6), math.radians(-25), "sheep", "stand", seed=3, head_up=0.45 if calling else 0.05, calling=calling)

    def entity_lamb(self, name, x, y, e=None):
        """The speckled lamb: standing by its mother, or caught by its fleece
        in a thornbush by the old cistern, legs folded, thorns about it."""
        if self.map.kind(x, y) == "bush":
            objs = self.quadruped(name, self.P(x + 0.45, y + 0.7), math.radians(150), "lamb", "lie", seed=5, speckled=True, head_up=0.3)
            twig = M.bark("#5e5244")
            rng = self.rng
            c = self.P(x + 0.45, y + 0.7)
            for k in range(9):
                a = rng.random() * math.tau
                p0 = c + Vector((math.cos(a) * 0.25, math.sin(a) * 0.2, 0.02 + rng.random() * 0.1))
                p1 = p0 + Vector((-math.cos(a) * 0.25, -math.sin(a) * 0.15, 0.12 + rng.random() * 0.12))
                objs.append(self._branch(f"{name}-thorn{k}", p0, p1, 0.008, 0.003, twig, 5, bow=0.02))
            return objs
        return self.quadruped(name, self.P(x + 0.45, y + 0.55), math.radians(-160), "lamb", "stand", seed=5, speckled=True, head_up=0.2)

    def entity_goat(self, name, x, y, e=None):
        """A black goat, long-haired, standing (browsing, or looking about)."""
        yaw = math.radians(180 if (x + y) % 2 else 20)
        return self.quadruped(name, self.P(x + 0.5, y + 0.6), yaw, "goat", "stand", seed=x + y, head_up=0.1 if (x + y) % 3 else -0.5)

    # ── story props ─────────────────────────────────────────────────────────
    def entity_ladder(self, name, x, y, e=None):
        """A ladder of two rough poles and lashed rungs, leaning on the back
        wall and up through the hatch to the roof."""
        wood = M.wood("#7a5a38", 4.0)
        back = getattr(self, "_back", y)
        objs = []
        foot_y = back + 0.62
        top_z = ROOM_H + 0.9
        ends = []
        for side in (-0.21, 0.21):
            a = self.P(x + 0.5 + side, foot_y, 0.0)
            b = B(x + 0.5 + side * 0.92, back - 0.06, top_z)
            ends.append((a, b))
            objs.append(self._branch(f"{name}-pole{side}", a, b, 0.032, 0.026, wood, 8, bow=0.01))
        (aL, bL), (aR, bR) = ends
        k = 0
        z = 0.28
        while z < top_z - 0.15:
            t = z / top_z
            objs.append(self._branch(f"{name}-rung{k}", aL.lerp(bL, t), aR.lerp(bR, t), 0.016, 0.015, wood, 6, bow=0.0))
            z += 0.34
            k += 1
        return objs, (back + 0.8) * 32, False

    def entity_kneading_trough(self, name, x, y, e=None):
        """The kneading trough on the floor with a mound of dough under a
        cloth; beside it the tall flour jar and the old grain basket."""
        c = self.P(x + 0.45, y + 0.55)
        objs = []
        trough = self._lathe(f"{name}-trough", [(0.0, 0.0), (0.18, 0.0), (0.24, 0.05), (0.26, 0.1), (0.24, 0.1), (0.2, 0.05), (0.0, 0.04)], c, M.wood("#8a6444", 7.0), 28)
        trough.data.transform(Matrix.Translation(c) @ Matrix.Scale(1.45, 4, Vector((1, 0, 0))) @ Matrix.Translation(-c))
        objs.append(trough)
        dough = self._ellipsoid(f"{name}-dough", c + Vector((0, 0, 0.06)), (0.2, 0.12, 0.05), M.plain("#e6d8b8", 0.7, 0.2), 20, 10)
        objs.append(dough)
        flour = self._ellipsoid(f"{name}-flour", c + Vector((0.18, 0.02, 0.045)), (0.1, 0.07, 0.02), M.plain("#f2ead8", 0.95, 0.1), 16, 8)
        objs.append(flour)
        jar = self.storage_jar(f"{name}-jar", c + Vector((0.52, 0.12, 0.0)), 0.82, "#b88a60")
        objs += jar
        basket = self._lathe(f"{name}-basket", [(0.1, 0), (0.17, 0.08), (0.18, 0.18), (0.19, 0.2)], c + Vector((-0.5, 0.1, 0.0)), M.straw("#a88a58"), 24)
        objs.append(basket)
        objs.append(self._ellipsoid(f"{name}-grain", c + Vector((-0.5, 0.1, 0.17)), (0.15, 0.15, 0.03), M.plain("#c9a560", 0.8), 16, 8))
        return objs

    def entity_tool_bag(self, name, x, y, e=None):
        """A stonemason's tools: a worn leather bag with the handles of
        mallets and chisels standing out of it, a dressing hammer and a
        square lying beside."""
        c = self.P(x + 0.5, y + 0.55, self.floor_z(x, y))
        leather = M.leather("#5a3a22")
        iron = M.plain("#4a4642", 0.4, 0.55)
        wood = M.wood("#8a6a44", 8.0)
        objs = [self._ellipsoid(f"{name}-bag", c + Vector((0, 0, 0.12)), (0.2, 0.12, 0.13), leather, 20, 10)]
        objs.append(self._ellipsoid(f"{name}-mouth", c + Vector((0.0, 0.0, 0.235)), (0.13, 0.08, 0.02), M.plain("#2a1c12", 0.8), 16, 6))
        for k, (dx, dy, tilt) in enumerate(((-0.06, 0.02, 0.2), (0.02, -0.02, -0.15), (0.08, 0.03, 0.35))):
            a = c + Vector((dx, dy, 0.2))
            b = a + Vector((math.sin(tilt) * 0.2, 0.0, 0.24))
            objs.append(self._branch(f"{name}-handle{k}", a, b, 0.014, 0.012, wood, 6, bow=0.0))
            if k == 1:
                objs.append(self._branch(f"{name}-chisel{k}", b, b + Vector((0.0, 0.0, 0.06)), 0.009, 0.006, iron, 6, bow=0.0))
        head = common.box(f"{name}-hammer", (0.16, 0.05, 0.05), c + Vector((0.34, -0.14, 0.03)), iron, None, bevel=0.01)
        common.bake_modifiers(head)
        objs.append(head)
        objs.append(self._branch(f"{name}-hammer-h", c + Vector((0.34, -0.14, 0.03)), c + Vector((0.3, -0.42, 0.02)), 0.013, 0.012, wood, 6, bow=0.0))
        for k, (a, b) in enumerate(((Vector((-0.34, -0.2, 0.01)), Vector((-0.04, -0.24, 0.01))), (Vector((-0.34, -0.2, 0.01)), Vector((-0.36, 0.06, 0.01))))):
            objs.append(common.box(f"{name}-square{k}", ((b - a).length, 0.03, 0.01), c + (a + b) / 2, wood, None))
            objs[-1].rotation_euler = (0, 0, math.atan2(b.y - a.y, b.x - a.x))
        return objs

    def entity_straw_bed(self, name, x, y, e=None):
        """A bed of fresh straw heaped on the floor with a striped blanket
        thrown over half of it (low: people step over and lie on it)."""
        c = (x + 0.5, y + 0.5)
        objs = self.heap(name, c[0], c[1], 0.52, 0.36, 0.1, seed=x * 3 + y, stalk_density=1500.0)
        blanket = common.box(f"{name}-blanket", (0.5, 0.62, 0.03), self.P(c[0] + 0.14, c[1], 0.1), M.textile(["#6a3a2c", "#c9b996", "#3c4c5e", "#c9b996"], "straw-blanket", band=0.1), None, bevel=0.02)
        common.bake_modifiers(blanket)
        objs.append(blanket)
        return objs, y * 32.0, True

    def entity_grain_jars(self, name, x, y, e=None):
        """Jars of barley: three tall storage jars stopped with clay lids and
        a bowl of grain at their foot."""
        objs = []
        for k, (dx, dy, sz, col) in enumerate(((0.28, 0.45, 1.1, "#a86e4c"), (0.66, 0.4, 1.0, "#b98258"), (0.48, 0.72, 0.8, "#a0694a"))):
            objs += self.storage_jar(f"{name}-{k}", self.P(x + dx, y + dy), sz, col, lid=True)
        objs.append(self._lathe(f"{name}-bowl", [(0.0, 0.0), (0.06, 0.0), (0.12, 0.05), (0.13, 0.07)], self.P(x + 0.8, y + 0.8), M.terracotta("#b27a52", 0.2), 20))
        objs.append(self._ellipsoid(f"{name}-barley", self.P(x + 0.8, y + 0.8, 0.055), (0.1, 0.1, 0.02), M.plain("#c9a560", 0.8), 14, 6))
        return objs

    def entity_loom(self, name, x, y, e=None):
        """Tamar's upright loom: two posts leaning on a wall, a beam, the warp
        weighted with clay loom weights, a length of striped cloth begun."""
        objs = []
        c = self.P(x + 0.5, y + 0.4)
        timber = M.wood("#6e5034", 4.0)
        for side in (-1, 1):
            post = common.box(f"{name}-post{side}", (0.07, 0.07, 1.75), c + Vector((side * 0.42, 0.05, 0.86)), timber, None)
            post.rotation_euler = (-0.12, 0, 0)
            objs.append(post)
        objs.append(common.box(f"{name}-beam", (0.98, 0.08, 0.08), c + Vector((0, 0.13, 1.68)), timber, None))
        objs.append(common.box(f"{name}-shed", (0.9, 0.04, 0.04), c + Vector((0, 0.02, 0.9)), timber, None))
        cloth = common.box(f"{name}-cloth", (0.8, 0.012, 0.55), c + Vector((0, 0.1, 1.36)), M.fabric_stripes(["#8e4a3a", "#d6c7a8", "#3f5068", "#d6c7a8"], 0.11, f"loom-cloth-{name}"), None)
        cloth.rotation_euler = (-0.12, 0, 0)
        objs.append(cloth)
        warp = M.plain("#d8cdb4", 0.8)
        for k in range(20):
            wx = -0.38 + k * 0.04
            objs.append(self._branch(f"{name}-warp{k}", c + Vector((wx, 0.07, 1.08)), c + Vector((wx, -0.02, 0.36)), 0.004, 0.004, warp, 4, bow=0.0))
        clay = M.terracotta("#9a6444", 0.2)
        for k in range(10):
            objs.append(self._ellipsoid(f"{name}-weight{k}", c + Vector((-0.36 + k * 0.08, -0.03, 0.3 - (k % 2) * 0.03)), (0.035, 0.02, 0.05), clay, 10, 6))
        return objs, (y + 0.75) * 32, False

    def entity_tablet(self, name, x, y, e=None):
        """A wax writing tablet on the clerk's table: a wooden frame with dark
        wax, scratched with lines of writing (the finished one) or smooth
        (the blank one), and a bronze stylus."""
        blank = e is not None and "blank" in e.get("id", "")
        top = 0.42
        c = self.P(x + 0.5, y + 0.5, top + 0.02)
        objs = [common.box(f"{name}-frame", (0.26, 0.2, 0.02), c, M.wood("#8a6444", 9.0), None, bevel=0.004)]
        objs.append(common.box(f"{name}-wax", (0.22, 0.16, 0.006), c + Vector((0, 0, 0.011)), wax("#2c2218" if blank else "#3a2c1c"), None))
        if not blank:
            ink = M.plain("#8a6a3a", 0.6)
            rng = self.rng
            for k in range(6):
                ln = 0.08 + rng.random() * 0.09
                objs.append(common.box(f"{name}-line{k}", (ln, 0.006, 0.002), c + Vector((-0.09 + ln / 2, 0.06 - k * 0.024, 0.0145)), ink, None))
        objs.append(self._branch(f"{name}-stylus", c + Vector((0.16, -0.08, 0.012)), c + Vector((0.3, 0.02, 0.012)), 0.006, 0.004, M.plain("#8a6a3e", 0.35, 0.6), 6, bow=0.0))
        return objs, (y + 0.9) * 32, False

    def entity_hoofprints(self, name, x, y, e=None):
        """Small, sharp hoofprints in the damp earth by the trough: pairs of
        cloven slots, leading away from the flock toward the gully."""
        rng = self.rng
        mat = M.scuff("#4e3e2c", 0.85)
        objs = []
        for k in range(7):
            t = k / 6
            cx = x + 0.2 + t * 0.7 + (0.05 if k % 2 else -0.05)
            cy = y + 0.8 - t * 0.25
            a = -0.3 + (rng.random() - 0.5) * 0.3
            for side in (-1, 1):
                ox, oy = -math.sin(a) * side * 0.012, math.cos(a) * side * 0.012
                objs.append(self._footprint(f"{name}-{k}-{side}", cx + ox, cy + oy, a, mat, 0.045))
        return objs, y * 32.0, True

    def entity_snagged_wool(self, name, x, y, e=None):
        """A thornbush at the top of the gully with a tuft of speckled wool
        caught on its thorns."""
        objs = self.desert_bush(name, x, y, size=0.85)
        c = self.P(x + 0.5, y + 0.5)
        wool = fleece("#e6dcc6", speckle="#4a3a2c")
        for k, (dx, dz) in enumerate(((0.14, 0.3), (0.2, 0.36), (0.1, 0.26))):
            t = self._ellipsoid(f"{name}-tuft{k}", c + Vector((dx, -0.18, dz)), (0.04, 0.03, 0.025), wool, 10, 6)
            objs.append(t)
        return objs

    def entity_thorn_branch(self, name, x, y, e=None):
        """A cut thorn branch pulled tight across the gap in the terrace wall:
        a tangle of grey thorny twigs lashed to a stake either side."""
        rng = self.rng
        twig = M.bark("#6a5e4e")
        c = self.P(x + 0.5, y + 0.5)
        objs = []
        for side in (-1, 1):
            objs.append(self._branch(f"{name}-stake{side}", c + Vector((side * 0.46, 0, -0.05)), c + Vector((side * 0.44, 0.02, 0.62)), 0.03, 0.025, M.wood("#6a5034", 3.0), 6, bow=0.0))
        bm = bmesh.new()

        def twigs(p0, d, ln, r, depth):
            p1 = p0 + d * ln
            dd = p1 - p0
            side = dd.orthogonal().normalized() * r
            up = dd.cross(side).normalized() * r
            ring0 = [bm.verts.new(p0 + side * math.cos(k * 2.094) + up * math.sin(k * 2.094)) for k in range(3)]
            ring1 = [bm.verts.new(p1 + (side * math.cos(k * 2.094) + up * math.sin(k * 2.094)) * 0.5) for k in range(3)]
            for k in range(3):
                bm.faces.new((ring0[k], ring0[(k + 1) % 3], ring1[(k + 1) % 3], ring1[k]))
            if depth > 0:
                for _ in range(2):
                    nd = (d + Vector(((rng.random() - 0.5) * 1.2, (rng.random() - 0.5) * 0.6, (rng.random() - 0.3) * 0.9))).normalized()
                    twigs(p1, nd, ln * 0.6, r * 0.6, depth - 1)

        for k in range(7):
            p0 = c + Vector((-0.45 + rng.random() * 0.2, (rng.random() - 0.5) * 0.1, 0.1 + rng.random() * 0.4))
            twigs(p0, Vector((1.0, 0.0, (rng.random() - 0.5) * 0.4)).normalized(), 0.35 + rng.random() * 0.2, 0.014, 3)
        objs.append(common.mesh_object(f"{name}-thorns", bm, twig, None))
        return objs

    # ── dry-stone walls: the fold, field walls, terraces ─────────────────────
    def brushwood(self, name, pts, rng, height=0.34, density=10):
        """Dead thorny brushwood piled along a wall top: tangles of grey,
        forking, spiny twigs (`pts`: Blender points along the top)."""
        bm = bmesh.new()

        def twig(p0, d, ln, r, depth):
            p1 = p0 + d * ln
            dd = p1 - p0
            side = dd.orthogonal().normalized() * r
            up = dd.cross(side).normalized() * r
            ring0 = [bm.verts.new(p0 + side * math.cos(k * 2.094) + up * math.sin(k * 2.094)) for k in range(3)]
            ring1 = [bm.verts.new(p1 + (side * math.cos(k * 2.094) + up * math.sin(k * 2.094)) * 0.55) for k in range(3)]
            for k in range(3):
                bm.faces.new((ring0[k], ring0[(k + 1) % 3], ring1[(k + 1) % 3], ring1[k]))
            if depth > 0 and ln > 0.04:
                for _ in range(2 + (rng.random() < 0.35)):
                    nd = (d + Vector(((rng.random() - 0.5) * 1.3, (rng.random() - 0.5) * 1.3, (rng.random() - 0.35) * 0.9))).normalized()
                    twig(p1, nd, ln * (0.5 + rng.random() * 0.2), r * 0.62, depth - 1)
            elif rng.random() < 0.7:
                # A spine or two at the tip.
                for _ in range(2):
                    sd = Vector(((rng.random() - 0.5), (rng.random() - 0.5), (rng.random() - 0.2))).normalized() * 0.025
                    v = [bm.verts.new(p1), bm.verts.new(p1 + sd), bm.verts.new(p1 + sd * 0.5 + Vector((0.002, 0, 0)))]
                    bm.faces.new(v)

        for p in pts:
            for _ in range(density):
                base = p + Vector(((rng.random() - 0.5) * 0.3, (rng.random() - 0.5) * 0.28, rng.random() * 0.05))
                d = Vector(((rng.random() - 0.5) * 1.6, (rng.random() - 0.5) * 1.0, 0.35 + rng.random() * 0.8)).normalized()
                twig(base, d, height * (0.45 + rng.random() * 0.4), 0.016, 3)
        return common.mesh_object(name, bm, M.bark("#5a5046"), None)

    def dry_wall(self, name, x0, x1, y, height, thick=0.5, brush=0.0, axis="x", seed=0, mat=None):
        """A free-standing dry-stone wall along a run of tiles (axis 'x': an
        east-west run at row y from x0 to x1; 'y': a north-south run at
        column y... from x0 to x1 rows): two faces of fieldstones in rough
        courses, big stones low down, chinking in the gaps, a line of flat
        capstones, and brushwood on top if `brush`. Returns its objects."""
        rng = self.rng
        mat = mat or field_rock("#9e9585", "fieldstone", lichen=0.55)
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        objs = []
        tops = []
        if axis == "x":
            a0, a1 = x0 + 0.02, x1 - 0.02
            cy = y + 0.5
            for face, sgn in ((cy + thick / 2, 1), (cy - thick / 2, -1)):
                for px, z, w, h in self.course_stones(a0, a1, 0.0, height, rng, 0.2, 0.14):
                    batter = (z / height) * 0.06
                    at = self.P(px, face - sgn * batter, z)
                    self._stone_at(bm, layer, at, w, h, 0.12, rng, seed)
            k = a0
            while k < a1:
                w = 0.18 + rng.random() * 0.16
                at = self.P(min(a1, k + w / 2), cy + (rng.random() - 0.5) * 0.08, height + 0.03)
                rocks.stone_mesh(bm, seed * 131 + int(k * 97), (w * 0.52, thick * 0.42, 0.05), flat=1.0, blocky=0.9, n=16, at=at, sink=1.0, rot=(rng.random() - 0.5) * 0.3)
                self._tag_last(bm, layer, rng)
                tops.append(self.P(min(a1, k + w / 2), cy, height + 0.07))
                k += w + 0.01
        else:
            a0, a1 = x0 + 0.02, x1 - 0.02
            cx = y + 0.5
            # Seen from above: the capstones and the rough tops of the faces.
            k = a0
            while k < a1:
                w = 0.16 + rng.random() * 0.14
                for side in (-1, 1):
                    at = self.P(cx + side * thick * 0.3, k + w / 2, height - 0.08)
                    rocks.stone_mesh(bm, seed * 173 + int(k * 89) + side, (thick * 0.22, w * 0.5, 0.1), flat=1.0, blocky=0.85, n=16, at=at, sink=1.0, rot=(rng.random() - 0.5) * 0.3)
                    self._tag_last(bm, layer, rng)
                at = self.P(cx + (rng.random() - 0.5) * 0.06, k + w / 2, height + 0.03)
                rocks.stone_mesh(bm, seed * 131 + int(k * 97), (thick * 0.42, w * 0.52, 0.05), flat=1.0, blocky=0.9, n=16, at=at, sink=1.0, rot=math.pi / 2 + (rng.random() - 0.5) * 0.3)
                self._tag_last(bm, layer, rng)
                tops.append(self.P(cx, k + w / 2, height + 0.07))
                k += w + 0.01
            # The faces, for their shading and the south end.
            for face, sgn in ((cx - thick / 2, 1), (cx + thick / 2, -1)):
                for py, z, w, h in self.course_stones(a0, a1, 0.0, height - 0.1, rng, 0.2, 0.14):
                    at = self.P(face + sgn * (z / height) * 0.06, py, z)
                    rocks.stone_mesh(bm, seed * 7 + int(py * 131 + z * 17), (0.1, w, h), flat=1.0, blocky=0.82, n=16, at=at, sink=1.0, rot=(rng.random() - 0.5) * 0.2)
                    self._tag_last(bm, layer, rng)
        # A core of rubble filling the wall.
        if axis == "x":
            core = common.box(f"{name}-core", (x1 - x0 - 0.1, thick - 0.1, height), self.P((x0 + x1) / 2, y + 0.5, height / 2), mat, None)
        else:
            core = common.box(f"{name}-core", (thick - 0.1, x1 - x0 - 0.1, height), self.P(y + 0.5, (x0 + x1) / 2, height / 2), mat, None)
        self._rand_attr(core, 0.3)
        objs.append(core)
        wall = common.mesh_object(f"{name}-stones", bm, mat, None, smooth=False)
        common.add_modifier(wall, "BEVEL", width=0.012, segments=1, limit_method="ANGLE")
        objs.append(wall)
        if brush:
            objs.append(self.brushwood(f"{name}-brush", tops, rng, brush, density=6))
        return objs

    def _stone_at(self, bm, layer, at, w, h, depth, rng, seed):
        rocks.stone_mesh(bm, seed * 7919 + int(at.x * 1013 + at.z * 577 + at.y * 331), (w, depth * (0.8 + rng.random() * 0.5), h), flat=1.0, blocky=0.6, n=16, at=at, sink=1.0, rot=(rng.random() - 0.5) * 0.25, detail=1)
        self._tag_last(bm, layer, rng)

    def _tag_last(self, bm, layer, rng):
        """Give the faces just added to `bm` (the last stone) one random value."""
        r = rng.random()
        bm.faces.ensure_lookup_table()
        n = len(bm.faces)
        k = n - 1
        seen = 0
        while k >= 0 and seen < 64:
            f = bm.faces[k]
            if f[layer] != 0.0:
                break
            f[layer] = r
            k -= 1
            seen += 1

    def tile_sheepfold(self):
        """The fold: a waist-high dry-stone wall of fieldstones, thick at the
        foot, with dead thorny brushwood piled along its top to keep out
        wolves and jackals. One sprite per east-west run; north-south runs a
        sprite per tile (so everyone either side sorts with them)."""
        m = self.map
        done = set()
        for x0, x1, y in m.runs("sheepfold"):
            if x1 - x0 >= 2:
                objs = self.dry_wall(f"fold-{x0}-{y}", x0, x1, y, 0.95, 0.56, brush=0.36, axis="x", seed=y * 41 + x0)
                self.sprite(f"fold-{x0}-{y}", y + 0.8, objs, [(x, y) for x in range(x0, x1)])
                done.update((x, y) for x in range(x0, x1))
        for x, y in m.tiles("sheepfold"):
            if (x, y) in done:
                continue
            objs = self.dry_wall(f"fold-{x}-{y}", y, y + 1, x, 0.95, 0.56, brush=0.36, axis="y", seed=x * 43 + y)
            self.sprite(f"fold-{x}-{y}", y + 0.95, objs, [(x, y)])

    def tile_fence(self):
        """A field wall (village): low dry stone, gapped here and there, with
        a little brushwood; elsewhere as before (dry stone or wattle)."""
        if not self.village:
            return super().tile_fence()
        m = self.map
        done = set()
        pen = self.style != "wilderness"
        for x0, x1, y in m.runs("fence"):
            if x1 - x0 >= 2:
                objs = self.dry_wall(f"field-wall-{x0}-{y}", x0, x1, y, 0.8 if pen else 0.62, 0.46, brush=0.3 if pen else 0.0, axis="x", seed=y * 29 + x0)
                self.sprite(f"fence-{x0}-{y}", y + 0.78, objs, [(x, y) for x in range(x0, x1)])
                done.update((x, y) for x in range(x0, x1))
        for x, y in m.tiles("fence"):
            if (x, y) in done:
                continue
            objs = self.dry_wall(f"field-wall-{x}-{y}", y, y + 1, x, 0.8 if pen else 0.62, 0.46, brush=0.3 if pen else 0.0, axis="y", seed=x * 31 + y)
            self.sprite(f"fence-{x}-{y}", y + 0.95, objs, [(x, y)])

    def tile_gate(self):
        """A gate: in a village's wall, a stone gateway; in a sheepfold, a gap
        in the wall between two tall upright gate stones, a hurdle of
        brushwood dragged aside; elsewhere, as before."""
        if not self.village:
            return super().tile_gate()
        m = self.map
        rng = self.rng
        fold = [(x, y) for x, y in m.tiles("gate") if m.near(x, y, ("sheepfold",), 1)]
        for x, y in fold:
            mat = field_rock("#a49c8c", "gate-stone", lichen=0.6)
            objs = []
            for side, sx in ((-1, x + 0.06), (1, x + 0.94)):
                objs.append(self.boulder(f"gatestone-{x}-{y}{side}", self.P(sx, y + 0.5), (0.13, 0.2, 0.62), mat, x * 3.1 + side, flat=0.95, blocky=0.85, sink=0.1))
            # The hurdle of thorn brush, pulled aside for the night's counting.
            hurdle = self.brushwood(f"hurdle-{x}-{y}", [self.P(x + 1.25, y + 1.05, 0.05), self.P(x + 1.55, y + 1.1, 0.05)], rng, 0.4, density=9)
            objs.append(hurdle)
            self.sprite(f"gate-{x}-{y}", y + 0.95, objs, [(x, y)])
        rest = [g for g in m.tiles("gate") if g not in fold]
        if rest:
            self.village_gate(rest)

    def tile_terrace(self):
        """Terrace walls: dry-stone retaining walls holding each field above
        the next, their faces the height of the step, big stones in the
        lowest courses; flat stones along the top, grass and a caper bush
        growing from the joints. In the ground layer: a terrace is part of
        the hillside, and nobody walks behind it."""
        m = self.map
        rng = self.rng
        mat = field_rock("#a0978a", "terrace-stone", lichen=0.5)
        for y, x0, x1, walls in self.terrace_rows():
            xs = sorted(walls)
            runs = []
            for x in xs:
                if runs and x == runs[-1][1]:
                    runs[-1][1] = x + 1
                else:
                    runs.append([x, x + 1])
            for a, b in runs:
                bm = bmesh.new()
                layer = bm.faces.layers.float.new("rand")
                x = a + 0.03
                # Walk along the wall in short sections, following the heights.
                while x < b - 0.03:
                    seg = min(b - 0.03 - x, 1.0)
                    up = self.H(x + seg / 2, y + 0.02)
                    low = self.H(x + seg / 2, y + 0.99)
                    face_y = -(y + 0.05 + up)
                    for px, z, w, h in self.course_stones(x, x + seg, low - 0.06, up + 0.02, rng, 0.26, 0.17):
                        at = Vector((px, face_y + 0.035, z))
                        rocks.stone_mesh(bm, int(px * 997 + z * 131 + y * 17), (w, 0.1 * (0.8 + rng.random() * 0.5), h), flat=1.0, blocky=0.6, n=16, at=at, sink=1.0, rot=(rng.random() - 0.5) * 0.2, detail=1)
                        self._tag_last(bm, layer, rng)
                    # Flat stones along the top.
                    k = x
                    while k < x + seg:
                        w = 0.2 + rng.random() * 0.18
                        at = Vector((k + w / 2, face_y - 0.08, up + 0.035))
                        rocks.stone_mesh(bm, int(k * 733 + y * 11), (w * 0.52, 0.12, 0.045), flat=1.0, blocky=0.9, n=14, at=at, sink=1.0, rot=(rng.random() - 0.5) * 0.3)
                        self._tag_last(bm, layer, rng)
                        k += w + 0.015
                    x += seg
                wall = common.mesh_object(f"terrace-{a}-{y}", bm, mat, None, smooth=False)
                common.add_modifier(wall, "BEVEL", width=0.012, segments=1, limit_method="ANGLE")
                self.to_ground(wall)
                # Weeds at the foot and on the top.
                lib = self._library()
                foot = self.emitter(f"terrace-foot-{a}-{y}", [(xx, y) for xx in range(a, b)], 4, lambda x0_, y0_: y0_ - int(y0_) > 0.75, z=0.01)
                scatter.scatter(foot, lib["tufts"], 30.0, (0.6, 1.3), seed=y * 5 + a, rotate_z_only=True, pick=True)

    def tile_campfire(self):
        """The shepherds' fire: a ring of stones blackened on the inside, a bed
        of ash and glowing coals, sticks of thorn and olive prunings burning
        in a heap with flames licking up; a pile of firewood beside, and a
        blackened pot. It burns from dusk (and is the brightest thing in the
        fields at night): lit in every light, and it flickers."""
        rng = self.rng
        for x, y in self.map.tiles("campfire"):
            name = f"campfire-{x}-{y}"
            c = self.P(x + 0.5, y + 0.5)
            objs = []
            stone = field_rock("#8a8272", "fire-stone", lichen=0.0, dark=0.35)
            for k in range(10):
                a = math.tau * k / 10 + rng.random() * 0.2
                s = 0.08 + rng.random() * 0.05
                objs.append(self.boulder(f"{name}-ring{k}", c + Vector((math.cos(a) * 0.33, math.sin(a) * 0.27, 0.0)), (s, s * 0.85, s * 0.7), stone, k * 2.7 + x, flat=0.6, sink=0.3))
            objs.append(self._ellipsoid(f"{name}-ash", c + Vector((0, 0, 0.005)), (0.3, 0.24, 0.02), M.plain("#7a746c", 0.95), 20, 6))
            objs.append(self._ellipsoid(f"{name}-coals", c + Vector((0, 0, 0.02)), (0.18, 0.14, 0.04), embers(16.0), 20, 8))
            char = charred()
            for k in range(6):
                a = math.tau * k / 6 + rng.random() * 0.3
                p0 = c + Vector((math.cos(a) * 0.3, math.sin(a) * 0.24, 0.02))
                p1 = c + Vector((math.cos(a) * 0.03, math.sin(a) * 0.03, 0.14 + rng.random() * 0.06))
                objs.append(self._branch(f"{name}-stick{k}", p0, p1, 0.026, 0.018, char, 8, bow=0.01))
                # The burning ends glow.
                objs.append(self._ellipsoid(f"{name}-glow{k}", p0.lerp(p1, 0.85), (0.03, 0.03, 0.03), embers(24.0), 8, 6))
            for k, (dx, dy, h, r) in enumerate(((0.0, 0.0, 0.34, 0.07), (0.07, 0.03, 0.24, 0.05), (-0.06, -0.02, 0.27, 0.05), (0.03, -0.06, 0.2, 0.04), (-0.04, 0.05, 0.18, 0.04))):
                f = self._flame(f"{name}-flame{k}", c + Vector((dx, dy, 0.06)), h, r)
                f.data.transform(Matrix.Translation(c + Vector((dx, dy, 0.06))) @ Matrix.Rotation(k * 0.7, 4, "Z") @ Matrix.Translation(-(c + Vector((dx, dy, 0.06)))))
                objs.append(f)
            # Firewood stacked beside, and a pot on its stones.
            wood = M.bark("#6a5a46")
            for k in range(5):
                a = c + Vector((0.46, 0.22 - k * 0.05, 0.03 + (k % 2) * 0.05))
                objs.append(self._branch(f"{name}-log{k}", a, a + Vector((0.34, 0.05 * (rng.random() - 0.5), 0.0)), 0.03, 0.025, wood, 8, bow=0.0))
            pot = self._lathe(f"{name}-pot", [(0.06, 0), (0.12, 0.05), (0.14, 0.12), (0.1, 0.19), (0.1, 0.21)], c + Vector((-0.44, 0.28, 0.0)), M.terracotta("#3e3028", 0.05), 20)
            objs.append(pot)
            self.sprite(name, y + 0.85, objs, [(x, y)])
            main = self.add_light(f"{name}-light", "POINT", c + Vector((0, 0, 0.32)), 150.0, "#ff9040", radius=0.12)
            low = self.add_light(f"{name}-coal-light", "POINT", c + Vector((0, -0.05, 0.1)), 40.0, "#ff6a28", radius=0.2)
            _ = (main, low)
            self.flicker.append(("hearth", (x + 0.5) * 32, (y + 0.3) * 32, 110.0, ["day", "late", "night"]))

    def rounded_block(self, name, x0, x1, y0, y1, z0, z1, mat, rng, roundness=0.3):
        """A hewn block of stone with rounded edges and corners (a
        superellipsoid), a little irregular, standing on the terrain."""
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=16, radius=1.0)
        e = roundness
        cx, cy, cz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
        hx, hy, hz = (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2
        for v in bm.verts:
            u = [math.copysign(abs(c) ** e, c) for c in v.co]
            wob = 1 + (rng.random() - 0.5) * 0.03
            v.co = self.P(cx + u[0] * hx * wob, cy - u[1] * hy * wob, cz + u[2] * hz)
        r = rng.random()
        for f in bm.faces:
            f[layer] = r
        return common.mesh_object(name, bm, mat, None, smooth=True)

    def tile_trough(self):
        """A watering trough (village): a long block of limestone hewn hollow,
        its rim worn round, water standing in it; the ground about it
        trodden to mud (tile_mud)."""
        if not self.village:
            return super().tile_trough()
        rng = self.rng
        stone = field_rock("#aea38e", "trough-stone", lichen=0.3)
        for x, y in self.map.tiles("trough"):
            name = f"trough-{x}-{y}"
            block = self.rounded_block(f"{name}-block", x + 0.03, x + 0.97, y + 0.26, y + 0.74, -0.05, 0.34, stone, rng)
            hole = self._ellipsoid(f"{name}-hole", self.P(x + 0.5, y + 0.5, 0.36), (0.38, 0.15, 0.2), None, 28, 14)
            mod = block.modifiers.new("hollow", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.object = hole
            common.bake_modifiers(block)
            bpy.data.objects.remove(hole)
            water = self._ellipsoid(f"{name}-water", self.P(x + 0.5, y + 0.5, 0.26), (0.36, 0.13, 0.004), M.water(), 24, 4)
            self.sprite(name, y + 0.8, [block, water], [(x, y)])

    def tile_soil(self):
        """Dry-farmed terra rossa (village): ploughed in shallow furrows along
        the contour, stones picked out and heaped at the field's edge; no
        water. Elsewhere, irrigated furrows as before."""
        if not self.village:
            return super().tile_soil()
        m = self.map
        rng = self.rng
        mat = M.plain("#6e4630", 0.95, 0.1)
        for x0, x1, y in m.runs("soil"):
            bm = bmesh.new()
            for k in range(4):
                yy = y + 0.14 + k * 0.24 + (rng.random() - 0.5) * 0.03
                x = x0 + 0.02
                while x < x1 - 0.02:
                    nx = min(x1 - 0.02, x + 0.2)
                    wob = math.sin(x * 1.7 + y) * 0.03
                    ridge = [self.P(x, yy - 0.07 + wob, 0.0), self.P(nx, yy - 0.07 + wob, 0.0), self.P(nx, yy + wob, 0.035), self.P(x, yy + wob, 0.035)]
                    v = [bm.verts.new(p) for p in ridge]
                    bm.faces.new(v[::-1])
                    ridge2 = [self.P(x, yy + wob, 0.035), self.P(nx, yy + wob, 0.035), self.P(nx, yy + 0.08 + wob, 0.0), self.P(x, yy + 0.08 + wob, 0.0)]
                    v = [bm.verts.new(p) for p in ridge2]
                    bm.faces.new(v[::-1])
                    x = nx
            self.ground_objects.append(common.mesh_object(f"furrows-{x0}-{y}", bm, mat, self.col_ground, smooth=True))
        lib = self._library()
        cells = m.tiles("soil")
        if cells and "stones" in lib:
            scatter.scatter(self.emitter("soil-stones", cells), lib["stones"], 3.0, (0.02, 0.06), seed=141, rotate_z_only=True, pick=True)

    def tile_crops(self):
        """Young barley on a terrace (village): thin shoots in drill rows after
        the first rains, the red soil showing between them, dry-farmed;
        elsewhere as before."""
        if not self.village:
            return super().tile_crops()
        rng = self.rng
        blades = young_barley()
        for x0, x1, y in self.map.runs("crops"):
            name = f"crops-{x0}-{y}"
            bm = bmesh.new()
            layer = bm.faces.layers.float.new("rand")
            for row in range(5):
                ry = y + 0.1 + row * 0.2
                x = x0 + 0.03
                while x < x1 - 0.03:
                    if rng.random() < 0.12:
                        x += 0.08
                        continue
                    p0 = self.P(x, ry + (rng.random() - 0.5) * 0.04, 0.0)
                    tone = rng.random()
                    for b in range(3):
                        a = rng.random() * math.tau
                        h = 0.09 + rng.random() * 0.12
                        tip = p0 + Vector((math.cos(a) * 0.04, math.sin(a) * 0.03, h))
                        sd = Vector((-math.sin(a), math.cos(a), 0)) * 0.006
                        f = bm.faces.new((bm.verts.new(p0 - sd), bm.verts.new(p0 + sd), bm.verts.new(tip + sd * 0.2), bm.verts.new(tip - sd * 0.2)))
                        f[layer] = tone
                    x += 0.045 + rng.random() * 0.035
            self.sprite(name, y + 0.85, [common.mesh_object(f"{name}-blades", bm, blades, None, smooth=False)], [(x, y) for x in range(x0, x1)])

    def tile_hill(self):
        """Hills (village): stones, gravel and scrub as before, and the dry
        grass and small thorny shrubs of the Judean hill pastures."""
        super().tile_hill()
        if not self.village:
            return
        m = self.map
        rng = self.rng
        cells = m.tiles("hill")
        if not cells:
            return
        lib = self._library()
        scatter.scatter(self.emitter("hill-grass", cells, 2), lib["tufts"], 14.0, (0.5, 1.2), seed=201, rotate_z_only=True, pick=True)
        for x, y in cells:
            if any(m.walkable(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-2, -1, 0, 1)):
                continue
            if rng.random() < 0.22:
                for o in self.thorn_shrub(f"hill-shrub-{x}-{y}", x + rng.random(), y + rng.random(), 0.45 + rng.random() * 0.35):
                    self.to_ground(o)

    def tile_table(self):
        """A table in the lanes (village): the registration clerk's trestle
        table, a plank top with a stack of closed wax tablets bound with
        cord, a leather pen case, a cloth and a stool behind; else as before
        (a low table with a bowl and bread)."""
        if not (self.village and self.style == "city"):
            return super().tile_table()
        rng = self.rng
        wood = M.wood("#7a5a3c", 7.0)
        for x0, x1, y in self.map.runs("table"):
            name = f"table-{x0}-{y}"
            w = x1 - x0
            objs = []
            top_z = 0.42
            top = common.box(f"{name}-top", (w - 0.12, 0.66, 0.05), self.P((x0 + x1) / 2, y + 0.52, top_z), wood, None, bevel=0.01)
            common.bake_modifiers(top)
            objs.append(top)
            for tx in (x0 + 0.2, x1 - 0.2):
                for side in (-1, 1):
                    objs.append(self._branch(f"{name}-leg{tx:.1f}{side}", self.P(tx, y + 0.52 + side * 0.24, 0.0), self.P(tx, y + 0.52 + side * 0.1, top_z - 0.02), 0.025, 0.022, wood, 6, bow=0.0))
            # A stack of closed tablets bound with cord, at the east end.
            sx = x1 - 0.32
            for k in range(4):
                t = common.box(f"{name}-stack{k}", (0.24, 0.18, 0.022), self.P(sx + (rng.random() - 0.5) * 0.02, y + 0.35, top_z + 0.04 + k * 0.024), M.wood("#8a6444", 9.0), None, bevel=0.003)
                common.bake_modifiers(t)
                objs.append(t)
            objs.append(common.box(f"{name}-cord", (0.02, 0.19, 0.1), self.P(sx, y + 0.35, top_z + 0.08), M.plain("#8a7550", 0.9), None))
            # A leather pen case and a cloth.
            objs.append(self._branch(f"{name}-case", self.P(x0 + 0.25, y + 0.3, top_z + 0.045), self.P(x0 + 0.55, y + 0.26, top_z + 0.045), 0.022, 0.022, M.leather("#5a3a22"), 8, bow=0.0))
            cloth = common.box(f"{name}-cloth", (0.34, 0.26, 0.006), self.P(x0 + 0.3, y + 0.62, top_z + 0.028), M.cloth("#d8cdb0", "#3f5f8f", "linen", 0.3, 0.04), None)
            objs.append(cloth)
            # The clerk's stool behind the table.
            stool = self._lathe(f"{name}-stool", [(0.0, 0.0), (0.12, 0.0), (0.1, 0.02), (0.08, 0.34), (0.15, 0.36), (0.15, 0.4), (0.0, 0.4)], self.P(x0 + 1.1, y + 0.05), wood, 16)
            objs.append(stool)
            self.sprite(name, y + 0.9, objs, [(x, y) for x in range(x0, x1)])

    def tile_rug(self):
        """A rug (village): an old flat-woven rug in faded madder red, undyed
        wool and indigo, worn thin, its edges curling a little and its
        surface rucked where feet have pushed it; else as before."""
        if not self.village:
            return super().tile_rug()
        m = self.map
        cells = set(m.tiles("rug"))
        if not cells:
            return
        xs = [c[0] for c in cells]
        ys = [c[1] for c in cells]
        x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
        mat = M.textile(["#7c4434", "#7c4434", "#b7a37e", "#454a58", "#b7a37e", "#8a5a3a"], "village-rug", band=0.06, border="#3e3028")
        bm = bmesh.new()
        nx, ny = (x1 - x0) * 10, (y1 - y0) * 10
        uv = bm.loops.layers.uv.new("UVMap")
        grid = []
        for j in range(ny + 1):
            row = []
            for i in range(nx + 1):
                u, v = i / nx, j / ny
                x = x0 + 0.1 + (x1 - x0 - 0.2) * u
                y = y0 + 0.12 + (y1 - y0 - 0.24) * v
                ruck = 0.02 * max(0.0, math.sin(u * 7.0 + 1.2)) * math.exp(-((v - 0.35) ** 2) / 0.02) + 0.004 * math.sin(u * 23 + v * 17)
                curl = 0.012 * (max(0.0, 1 - u / 0.04) + max(0.0, 1 - (1 - v) / 0.05))
                row.append(bm.verts.new(self.P(x, y, 0.01 + ruck + curl)))
            grid.append(row)
        for j in range(ny):
            for i in range(nx):
                f = bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
                for loop, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                    loop[uv].uv = (ii / nx, jj / ny)
        rug = common.mesh_object("rug", bm, mat, self.col_ground)
        common.add_modifier(rug, "SOLIDIFY", thickness=0.008)
        self.ground_objects.append(rug)

    def tile_bedroll(self):
        """Bedding (village): a thin straw-stuffed mattress on a rush mat, a
        heavy woollen blanket thrown over it in folds, a cloak rolled up for a
        pillow; elsewhere as before."""
        if not self.village:
            return super().tile_bedroll()
        rng = self.rng
        blankets = [["#6a3a2c", "#c9b996", "#6a3a2c", "#3c4c5e"], ["#5a4a3a", "#b9a47c", "#5a4a3a"], ["#3c4c5e", "#c9b996", "#7a3a2c", "#c9b996"]]
        for i, (x0, x1, y) in enumerate(self.map.runs("bedroll")):
            w = x1 - x0
            mat = common.box(f"bedmat-{x0}-{y}", (w - 0.1, 0.84, 0.014), self.P((x0 + x1) / 2, y + 0.5, 0.008), M.straw("#a88c5c"), None)
            self.to_ground(mat)
            # The mattress: a low lumpy pad.
            pad = self.rounded_block(f"bedpad-{x0}-{y}", x0 + 0.1, x1 - 0.1, y + 0.14, y + 0.86, 0.0, 0.07, M.cloth("#b8a888", None, "linen"), rng, roundness=0.4)
            self.to_ground(pad)
            # The blanket: a sheet draped over most of it, in folds.
            bm = bmesh.new()
            nx, ny = int(w * 12), 10
            bx0, bx1 = x0 + 0.25 + rng.random() * 0.1, x1 - 0.04
            grid = []
            for j in range(ny + 1):
                row = []
                for k in range(nx + 1):
                    u, v = k / nx, j / ny
                    px = bx0 + (bx1 - bx0) * u
                    py = y + 0.08 + 0.84 * v
                    edge = min(v, 1 - v)
                    fold = 0.018 * math.sin(u * 17 + i) * math.sin(v * 5 + u * 3) + 0.012 * math.sin(u * 41 + v * 7)
                    z = 0.08 * min(1.0, edge * 5) + fold + 0.012
                    row.append(bm.verts.new(self.P(px, py, z)))
                grid.append(row)
            uv = bm.loops.layers.uv.new("UVMap")
            for j in range(ny):
                for k in range(nx):
                    f = bm.faces.new((grid[j][k], grid[j + 1][k], grid[j + 1][k + 1], grid[j][k + 1]))
                    for loop, (a, b) in zip(f.loops, ((k, j), (k, j + 1), (k + 1, j + 1), (k + 1, j))):
                        loop[uv].uv = (a / nx, b / ny)
            blanket = common.mesh_object(f"blanket-{x0}-{y}", bm, M.textile(blankets[i % len(blankets)], f"blanket-{i}", band=0.08), None)
            common.add_modifier(blanket, "SOLIDIFY", thickness=0.012)
            self.to_ground(blanket)
            roll = self._branch(f"pillow-{x0}-{y}", self.P(x0 + 0.2, y + 0.2, 0.09), self.P(x0 + 0.2, y + 0.8, 0.09), 0.075, 0.07, M.cloth(["#7a5a3c", "#5e6a4a", "#8a4a3a"][i % 3], None, "wool"), 12, bow=0.0)
            self.to_ground(roll)

    def tile_rock(self):
        """Rocks (village): outcrops and boulders of the hills' grey limestone,
        rounded and pitted by the weather, lichened; else as before."""
        if not self.village:
            return super().tile_rock()
        rng = self.rng
        mat = field_rock("#a0988a", "boulder", lichen=0.6)
        for x, y in self.map.tiles("rock"):
            name = f"rock-{x}-{y}"
            big = 0.3 + rng.random() * 0.16
            objs = [self.boulder(f"{name}-0", self.P(x + 0.5, y + 0.58), (big, big * 0.82, big * 0.62), mat, rng.random() * 10, flat=0.62, blocky=0.45, sink=0.3)]
            for i in range(1 + int(rng.random() * 3)):
                s = 0.08 + rng.random() * 0.12
                a = rng.random() * math.tau
                objs.append(self.boulder(f"{name}-{i + 1}", self.P(x + 0.5 + math.cos(a) * 0.4, y + 0.62 + math.sin(a) * 0.26), (s, s * 0.85, s * 0.55), mat, rng.random() * 10, flat=0.6, blocky=0.5, sink=0.3))
            self.sprite(name, y + 0.8, objs, [(x, y)])

    def thorn_shrub(self, name, x, y, size=1.0):
        """A thorny shrub of the Judean hills (thorny burnet and its like): a
        dense rounded cushion of grey-brown, finely forking spiny twigs,
        tipped with small dark grey-green leaves, dead grey twigs showing
        through where it has been browsed."""
        rng = self.rng
        base = self.P(x, y)
        bm = bmesh.new()
        leaves = bmesh.new()
        tips = []

        def stem(p0, d, length, r0, depth):
            p1 = p0 + d * length
            dd = p1 - p0
            side = dd.orthogonal().normalized() * r0
            up = dd.cross(side).normalized() * r0
            ring0 = [bm.verts.new(p0 + side * math.cos(k * 2.094) + up * math.sin(k * 2.094)) for k in range(3)]
            ring1 = [bm.verts.new(p1 + (side * math.cos(k * 2.094) + up * math.sin(k * 2.094)) * 0.6) for k in range(3)]
            for k in range(3):
                bm.faces.new((ring0[k], ring0[(k + 1) % 3], ring1[(k + 1) % 3], ring1[k]))
            if depth == 0 or length < 0.05:
                tips.append(p1)
                return
            for _ in range(2 + (rng.random() < 0.5)):
                nd = (d + Vector(((rng.random() - 0.5) * 1.1, (rng.random() - 0.5) * 1.1, rng.random() * 0.5))).normalized()
                stem(p1, nd, length * (0.58 + rng.random() * 0.15), r0 * 0.62, depth - 1)

        for k in range(14):
            a = rng.random() * math.tau
            el = 0.45 + rng.random() * 0.85
            d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el) * 0.9, math.sin(el)))
            stem(base + Vector((math.cos(a) * 0.04, math.sin(a) * 0.04, 0.0)) * size, d, (0.2 + rng.random() * 0.12) * size, 0.014 * size, 3)
        for tip in tips:
            if rng.random() < 0.18:
                continue
            for _ in range(5):
                c = tip + Vector(((rng.random() - 0.5) * 0.07, (rng.random() - 0.5) * 0.07, (rng.random() - 0.4) * 0.05)) * size
                a = rng.random() * math.tau
                ln = (0.018 + rng.random() * 0.016) * size
                dv = Vector((math.cos(a), math.sin(a), 0.3 + rng.random())).normalized() * ln
                sd = Vector((-math.sin(a), math.cos(a), 0)) * 0.007 * size
                v = [leaves.verts.new(c - sd), leaves.verts.new(c + sd), leaves.verts.new(c + dv + sd * 0.3), leaves.verts.new(c + dv - sd * 0.3)]
                leaves.faces.new(v)
        return [common.mesh_object(f"{name}-stems", bm, M.bark("#5e5448"), None), common.mesh_object(f"{name}-leaves", leaves, M.leaf("#5a6248", "#8e9478"), None)]

    def tile_bush(self):
        """Thorny shrubs (village): dense grey-green cushions, a little bigger
        where they grow together into a thicket; else desert thornbushes."""
        if not self.village:
            return super().tile_bush()
        m = self.map
        rng = self.rng
        for x, y in m.tiles("bush"):
            crowd = sum(1 for dx in (-1, 0, 1) for dy in (-1, 0, 1) if m.kind(x + dx, y + dy) == "bush")
            size = 0.72 + 0.045 * crowd + rng.random() * 0.3
            objs = self.thorn_shrub(f"bush-{x}-{y}", x + 0.5 + (rng.random() - 0.5) * 0.3, y + 0.55 + (rng.random() - 0.5) * 0.2, size)
            if crowd >= 5 and rng.random() < 0.5:
                objs += self.thorn_shrub(f"bush-{x}-{y}-b", x + 0.15 + rng.random() * 0.7, y + 0.25, size * 0.55)
            self.sprite(f"bush-{x}-{y}", y + 0.75, objs, [(x, y)])

    def tile_mud(self):
        """Damp ground (village): earth trodden to mud where the flock drinks,
        pocked with hoofprints, a puddle or two; else flood mud as before."""
        if not self.village:
            return super().tile_mud()
        m = self.map
        rng = self.rng
        prints = M.scuff("#3e3024", 0.8)
        wet = M.plain("#3a3026", 0.2, 0.5)
        for x, y in m.tiles("mud"):
            for k in range(26):
                cx, cy = x + rng.random(), y + rng.random()
                a = rng.random() * math.tau
                for side in (-1, 1):
                    self.to_ground(self._footprint(f"mud-print-{x}-{y}-{k}-{side}", cx - math.sin(a) * side * 0.01, cy + math.cos(a) * side * 0.01, a, prints, 0.04))
            if rng.random() < 0.6:
                c = self.P(x + 0.3 + rng.random() * 0.4, y + 0.3 + rng.random() * 0.4, 0.004)
                self.to_ground(self._ellipsoid(f"puddle-{x}-{y}", c, (0.16 + rng.random() * 0.1, 0.09, 0.002), wet, 18, 4))

    def _village_stones(self):
        """Loose stones and grit of the hills' limestone, for scattering."""
        lib = getattr(self, "_vstones", None)
        if lib is not None:
            return lib
        out = {}
        for name, count, flat in (("vgrit", 6, 0.55), ("vstones", 8, 0.5)):
            col = bpy.data.collections.new(name)
            bpy.context.scene.collection.children.link(col)
            col.hide_render = True
            mat = field_rock("#a89e8a", f"{name}-rock", lichen=0.3 if name == "vstones" else 0.0)
            for t in range(count):
                bm = bmesh.new()
                layer = bm.faces.layers.float.new("rand")
                rocks.stone_mesh(bm, 7000 + t * 13 + len(name), (1.0, 0.75 + self.rng.random() * 0.3, 0.65), flat=flat, blocky=0.6, n=16, sink=0.3, detail=1)
                r = self.rng.random()
                for f in bm.faces:
                    f[layer] = r
                obj = common.mesh_object(f"{name}{t}", bm, mat, None, smooth=False)
                for c in obj.users_collection:
                    c.objects.unlink(obj)
                col.objects.link(obj)
            out[name] = col
        self._vstones = out
        return out

    def tile_sand(self):
        """Bare ground (village): the lanes' trodden earth, gritty, with loose
        stones kicked to the sides; elsewhere as before."""
        if not (self.village and self.style == "city"):
            return super().tile_sand()
        m = self.map
        lib = self._village_stones()
        cells = m.tiles("sand")
        if not cells:
            return
        scatter.scatter(self.emitter("lane-grit", cells), lib["vgrit"], 60.0, (0.008, 0.02), seed=9, rotate_z_only=True, pick=True)
        edge = [(x, y) for x, y in cells if m.near(x, y, ("wall", "fence", "scrub", "roof"), 1)]
        scatter.scatter(self.emitter("lane-stones", edge), lib["vstones"], 3.5, (0.025, 0.07), seed=19, rotate_z_only=True, pick=True)
        scatter.scatter(self.emitter("lane-stones-mid", cells), lib["vstones"], 0.5, (0.02, 0.05), seed=29, rotate_z_only=True, pick=True)

    def tile_paving(self):
        """Paving (village): the square by the gate laid with rough flags of
        field stone, worn and gapped, earth and weeds between; else as before."""
        if not self.village:
            return super().tile_paving()
        paving = self.paving
        self.paving = M.limestone("#a08a68", "village-flags", worn=0.9)
        try:
            self.yard_flags(kinds=("paving", "gate", "well"), name="square-flags", spacing=0.42)
        finally:
            self.paving = paving

    def tile_wadi(self):
        """The gully (village): as a dry streambed, but the damp ground by a
        trough away from it is its own (tile_mud), not part of the bed."""
        if not self.village:
            return super().tile_wadi()
        m = self.map
        bed = set(m.tiles("wadi"))
        mud = [c for c in m.tiles("mud") if any((c[0] + dx, c[1] + dy) in bed for dx in (-1, 0, 1) for dy in (-1, 0, 1))]
        tiles = m.tiles
        m.tiles = lambda kind: mud if kind == "mud" else tiles(kind)
        try:
            super().tile_wadi()
        finally:
            del m.tiles

    def tile_threshing(self):
        """The threshing floor at the windy edge of the village: a wide round
        floor of beaten earth and bare bedrock, ringed with set edging stones,
        chaff and broken straw blown into drifts against the east rim (the
        wind comes from the west); a threshing sledge (a board studded with
        stones underneath) lying on it, a wooden winnowing fork and a sieve."""
        m = self.map
        cells = m.tiles("threshing")
        if not cells:
            return
        rng = self.rng
        xs = [x for x, _ in cells]
        ys = [y for _, y in cells]
        cx, cy = (min(xs) + max(xs) + 1) / 2, (min(ys) + max(ys) + 1) / 2
        rx, ry = (max(xs) + 1 - min(xs)) / 2 - 0.15, (max(ys) + 1 - min(ys)) / 2 - 0.1
        self._threshing = (cx, cy, rx, ry)
        # Bedrock showing through the beaten floor.
        rock = field_rock("#b8ae98", "threshing-rock", lichen=0.1)
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        for k in range(9):
            a = rng.random() * math.tau
            r = rng.random() ** 0.6
            px, py = cx + math.cos(a) * rx * r * 0.8, cy + math.sin(a) * ry * r * 0.8
            n = 18
            c = bm.verts.new(self.P(px, py, 0.012))
            ring = []
            size = 0.3 + rng.random() * 0.5
            for j in range(n):
                t = math.tau * j / n
                rr = size * (0.7 + 0.3 * math.sin(t * 3 + k) + 0.1 * rng.random())
                ring.append(bm.verts.new(self.P(px + math.cos(t) * rr, py + math.sin(t) * rr * 0.7, 0.004)))
            for j in range(n):
                f = bm.faces.new((c, ring[j], ring[(j + 1) % n]))
                f[layer] = rng.random()
        self.ground_objects.append(common.mesh_object("threshing-bedrock", bm, rock, self.col_ground))
        # The ring of edging stones.
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        n = int(math.tau * (rx + ry) / 2 / 0.3)
        for j in range(n):
            t = math.tau * j / n
            px, py = cx + math.cos(t) * (rx + 0.08), cy + math.sin(t) * (ry + 0.06)
            s = 0.1 + rng.random() * 0.06
            rocks.stone_mesh(bm, 5000 + j, (s * 1.3, s, 0.07), flat=1.0, blocky=0.7, n=14, at=self.P(px, py, 0.03), sink=1.0, rot=t + math.pi / 2, detail=1)
            self._tag_last(bm, layer, rng)
        kerb = common.mesh_object("threshing-kerb", bm, field_rock("#a89f8e", "kerb-stone", lichen=0.4), self.col_ground, smooth=False)
        self.ground_objects.append(kerb)
        # Chaff all over, drifted deep against the east rim.
        inside = lambda x0, y0: ((x0 - cx) / rx) ** 2 + ((y0 - cy) / ry) ** 2 < 1.0  # noqa: E731
        drift = lambda x0, y0: inside(x0, y0) and (x0 - cx) / rx > 0.35 + 0.25 * math.sin(y0 * 2.1)  # noqa: E731
        self.straw_cover("threshing-chaff", cells, 180.0, keep=inside, sub=4, seed=21)
        self.straw_cover("threshing-drift", cells, 1600.0, keep=drift, sub=4, seed=23, z=0.02)
        # The sledge, the fork and a sieve.
        wood = M.wood("#8a6a48", 6.0)
        sx, sy = cx - rx * 0.35, cy + ry * 0.25
        sled = common.box("sledge", (1.4, 0.55, 0.06), self.P(sx, sy, 0.06), wood, None, bevel=0.01)
        common.bake_modifiers(sled)
        sled.data.transform(Matrix.Translation(self.P(sx, sy, 0.06)) @ Matrix.Rotation(0.35, 4, "Z") @ Matrix.Translation(-self.P(sx, sy, 0.06)))
        self.to_ground(sled)
        for k in range(3):
            self.to_ground(common.box(f"sledge-plank{k}", (1.38, 0.008, 0.004), self.P(sx, sy - 0.18 + k * 0.18, 0.093), M.plain("#4a3a2a", 0.9), None))
        fork = [self.P(cx + rx * 0.1, cy - ry * 0.45, 0.02), self.P(cx + rx * 0.1 + 1.3, cy - ry * 0.45 + 0.25, 0.02)]
        self.to_ground(self._branch("fork-shaft", fork[0], fork[1], 0.018, 0.016, wood, 6, bow=0.0))
        for k in range(5):
            a = fork[1] + Vector((0.0, (k - 2) * 0.05, 0.0))
            self.to_ground(self._branch(f"fork-tine{k}", a, a + Vector((0.28, (k - 2) * 0.03, 0.02)), 0.01, 0.007, wood, 5, bow=0.0))
        sieve = self._lathe("sieve", [(0.0, 0.0), (0.26, 0.0), (0.27, 0.06), (0.25, 0.06)], self.P(cx - rx * 0.6, cy - ry * 0.3), M.straw("#9c8254"), 28)
        self.to_ground(sieve)

    def _litter(self):
        """The village's lanes: as the market's (straw by the animals, dung,
        wet ground at the well, rubble along the walls), and the travellers
        camped out because every house is full: bundles and a water skin by
        each bedroll, and at night a small lamp burning beside some."""
        super()._litter()
        if not self.village:
            return
        m = self.map
        for i, (x0, x1, y) in enumerate(m.runs("bedroll") + m.runs("mat")):
            kx = x1 + 0.15 if m.walkable(x1, y) else x0 - 0.6
            bundle = self._ellipsoid(f"camp-bundle-{i}", self.P(kx + 0.25, y + 0.35, 0.1), (0.2, 0.15, 0.11), M.burlap(["#8e7a58", "#9c8660", "#7a6a4c"][i % 3]), 16, 8)
            self.to_ground(bundle)
            if i % 2 == 0:
                skin = self._ellipsoid(f"camp-skin-{i}", self.P(kx + 0.3, y + 0.75, 0.06), (0.16, 0.1, 0.06), M.leather("#5b3b24"), 16, 8)
                self.to_ground(skin)
            if i % 2 == 0 or i == 1:
                self.clay_lamp(f"camp-lamp-{i}", self.P(kx + 0.05, y + 0.8, 0.0), lit=NIGHT, power=8.0)
        # The oven by Hagit's door glows at night.
        for x, y in m.tiles("oven"):
            glow = self.add_light(f"oven-glow-{x}-{y}", "POINT", self.P(x + 0.5, y + 0.3, 0.2), 18.0, "#ff7a30", radius=0.1)
            tag(glow, NIGHT)
            self.flicker.append(("hearth", (x + 0.5) * 32, (y + 0.2) * 32, 44.0, ["night"]))

    def dress_wilderness(self):
        """The fields (village): boulders on the hills as before; sheep
        droppings about the fold and the trough."""
        super().dress_wilderness()
        if not self.village:
            return
        m = self.map
        rng = self.rng
        dung = M.plain("#3a3024", 0.8, 0.15)
        bm = bmesh.new()
        fold = m.tiles("sheepfold") + m.tiles("sheep") + m.tiles("gate") + m.tiles("trough") + m.tiles("mud")
        spots = {(x + dx, y + dy) for x, y in fold for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        for x, y in sorted(spots):
            if not m.walkable(x, y):
                continue
            for _ in range(int(rng.random() * 9)):
                sph = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.012)
                c = self.P(x + rng.random(), y + rng.random(), 0.008)
                for v in sph["verts"]:
                    v.co = v.co + c
        self.ground_objects.append(common.mesh_object("droppings", bm, dung, self.col_ground))

    # ── buildings ───────────────────────────────────────────────────────────
    def _buildings(self):
        if not self.village:
            return super()._buildings()
        m = self.map
        perimeter = [(x, y) for y in range(m.h) for x in range(m.w) if (x in (0, m.w - 1) or y in (0, m.h - 1)) and m.kind(x, y) == "wall"]
        if perimeter:
            self.village_wall(perimeter)
        for reg in self.regions(exclude=set(perimeter)):
            name = f"house-{min(p[0] for p in reg)}-{min(p[1] for p in reg)}"
            if self.style == "wilderness":
                self.field_hut(name, reg)
            else:
                self.village_house_block(name, reg)

    def field_hut(self, name, reg):
        """An old watchman's hut in the fields, where someone sat up at night
        to guard the olive harvest: a small square hut of dry-stone rubble,
        a low doorway under a long lintel stone, a flat roof of poles and
        brushwood packed with earth, one corner of it fallen in."""
        m = self.map
        rng = self.rng
        xs = [p[0] for p in reg]
        ys = [p[1] for p in reg]
        x0, x1 = min(xs), max(xs) + 1
        n, s = min(ys), max(ys)
        gy = s + 1.0
        height = 1.85
        # It fills its own tiles on screen (see village_house_block).
        n = min(n + height, gy - 1.0)
        mat = field_rock("#9a917f", "hut-stone", lichen=0.6)
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        doors = [x for x in range(x0, x1) if m.kind(x, s) == "door"]
        openings = [(d + 0.18, d + 0.82, 0.0, 1.35) for d in doors]
        base_h = self.H((x0 + x1) / 2, gy - 0.1)
        for px, z, w, h in self.course_stones(x0 + 0.02, x1 - 0.02, 0.0, height, rng, 0.24, 0.16):
            if any(ox0 - w * 0.6 < px < ox1 + w * 0.6 and z < oz1 + 0.05 for ox0, ox1, _, oz1 in openings):
                continue
            at = Vector((px, -(gy - 0.02 + base_h), base_h + z))
            rocks.stone_mesh(bm, int(px * 997 + z * 131), (w, 0.12, h), flat=1.0, blocky=0.85, n=16, at=at, sink=1.0, rot=(rng.random() - 0.5) * 0.2)
            self._tag_last(bm, layer, rng)
        objs = []
        for ox0, ox1, _, oz1 in openings:
            lint = self.boulder(f"{name}-lintel", Vector(((ox0 + ox1) / 2, -(gy + base_h), base_h + oz1 + 0.1)), (0.62, 0.14, 0.1), mat, 7.7, flat=0.9, blocky=0.95, sink=0.5)
            objs.append(lint)
            objs.append(common.box(f"{name}-dark", (ox1 - ox0, 0.4, oz1), Vector(((ox0 + ox1) / 2, -(gy - 0.22 + base_h), base_h + oz1 / 2)), M.plain("#15110d", 0.95, 0.05), None))
        wall = common.mesh_object(f"{name}-front", bm, mat, None, smooth=False)
        common.add_modifier(wall, "BEVEL", width=0.012, segments=1, limit_method="ANGLE")
        objs.append(wall)
        body = common.box(f"{name}-body", (x1 - x0 - 0.1, gy - n - 0.25, height), Vector(((x0 + x1) / 2, -((n + gy) / 2 + base_h), base_h + height / 2)), mat, None)
        self._rand_attr(body, 0.4)
        objs.append(body)
        # The roof: poles, brushwood and earth; the north-east corner fallen in.
        top = base_h + height
        roof_bm = bmesh.new()
        segs = 14
        rx0, rx1, ry0, ry1 = x0 - 0.04, x1 + 0.04, n - 0.04, gy + 0.08
        grid = []
        for j in range(segs + 1):
            row = []
            for i in range(segs + 1):
                u, v = i / segs, j / segs
                px, py = rx0 + (rx1 - rx0) * u, ry0 + (ry1 - ry0) * v
                sag = 0.05 * math.sin(math.pi * u) * math.sin(math.pi * v)
                hole = u > 0.62 and v < 0.42
                z = top + 0.1 - sag - (0.55 if hole else 0.0) + (rng.random() - 0.5) * 0.02
                row.append(roof_bm.verts.new(Vector((px, -(py + base_h), z))))
            grid.append(row)
        for j in range(segs):
            for i in range(segs):
                roof_bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        roof = common.mesh_object(f"{name}-roof", roof_bm, M.plain("#8a7456", 0.95, 0.05), None)
        objs.append(roof)
        wood = M.bark("#5a4c3c")
        for k in range(7):
            px = rx0 + 0.15 + k * (rx1 - rx0 - 0.3) / 6
            if px > rx0 + (rx1 - rx0) * 0.62:
                # Broken poles sagging into the hut.
                objs.append(self._branch(f"{name}-pole{k}", Vector((px, -(gy + base_h), top + 0.12)), Vector((px + 0.1, -(n + 0.6 + base_h), top - 0.4)), 0.035, 0.03, wood, 6, bow=0.05))
            else:
                objs.append(self._branch(f"{name}-pole{k}", Vector((px, -(gy + 0.1 + base_h), top + 0.12)), Vector((px, -(n - 0.1 + base_h), top + 0.12)), 0.035, 0.03, wood, 6, bow=0.0))
        brush_pts = [Vector((rx0 + 0.2 + (rx1 - rx0 - 0.4) * rng.random() * 0.6, -(ry0 + 0.2 + (ry1 - ry0 - 0.4) * rng.random() + base_h), top + 0.12)) for _ in range(8)]
        objs.append(self.brushwood(f"{name}-roofbrush", brush_pts, rng, 0.3, density=5))
        self.sprite(name, gy, objs, sorted(reg))

    def rubble_face(self, bm, layer, x0, x1, gy, base_h, height, rng, openings=(), big=0.26, small=0.18, depth=0.12, seed=0):
        """The front of a village house: roughly squared limestone blocks in
        uneven courses (bigger low down), set in mud mortar, some of them
        plastered over; holes left for `openings` [(x0, x1, z0, z1)]."""
        z = 0.0
        row = 0
        while z < height - 0.02:
            ch = min(height - z, (big if z < 0.9 else small) * (0.92 + rng.random() * 0.16))
            x = x0 - (rng.random() * 0.3 if row % 2 else 0.0)
            while x < x1 - 0.02:
                w = ch * (1.3 + rng.random() * 1.3)
                a, b = max(x, x0 + 0.01), min(x + w, x1 - 0.01)
                px, pz = (a + b) / 2, z + ch / 2
                hw, hh = (b - a) / 2 - 0.012, ch / 2 - 0.012
                if hw > 0.03 and not any(ox0 - 0.02 < px + hw and px - hw < ox1 + 0.02 and oz0 - 0.02 < pz + hh and pz - hh < oz1 + 0.02 for ox0, ox1, oz0, oz1 in openings):
                    at = Vector((px, -(gy - 0.03 + base_h), base_h + pz))
                    rocks.stone_mesh(bm, seed * 3301 + int(px * 997 + pz * 131), (hw, depth * (0.6 + rng.random() * 0.5), hh), flat=1.0, blocky=0.97, n=20, at=at, sink=1.0, rot=(rng.random() - 0.5) * 0.04, detail=1)
                    self._tag_last(bm, layer, rng)
                x += w
            z += ch
            row += 1

    def village_house_block(self, name, reg):
        """A Bethlehem house seen from the lane: a front of rough limestone
        blocks in mud mortar, part plastered and whitewashed, a timber door
        (open by day, shut at night with lamplight at its cracks), small
        high windows with wooden bars, a flat earthen roof on beams with a
        low parapet and a rolled edge; on the roof a lean-to of reed matting,
        jars, a stone roller for the clay, figs drying."""
        m = self.map
        rng = self.rng
        cells = set(reg)
        xs = [p[0] for p in reg]
        ys = [p[1] for p in reg]
        x0, x1 = min(xs), max(xs) + 1
        n, s = min(ys), max(ys)
        gy = s + 1.0
        base_h = self.H((x0 + x1) / 2, gy + 0.3)
        doors = [x for x in range(x0, x1) if m.kind(x, s) == "door"]
        height = 2.35 + rng.random() * 0.25
        # Like the market's houses, a house fills exactly its own tiles on
        # screen: its roof rows show its roof. So its real north wall stands
        # its height south of the first roof row (it is shallower than its
        # tiles), and nobody in the lane behind is hidden by it.
        n = min(n + height, gy - 1.0)
        stone = field_rock("#bca985", "village-stone", lichen=0.18)
        mortar = M.plain("#6e604c", 0.95, 0.05)
        wood = M.wood("#5e4430", 8.0)
        objs = []
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        door_open = [(d + 0.12, d + 0.88, 0.0, 1.75) for d in doors]
        windows = []
        for wx in range(x0 + 1, x1 - 1, 3):
            if all(abs(wx + 0.5 - (d + 0.5)) > 1.4 for d in doors):
                windows.append((wx + 0.28, wx + 0.66, 1.55, 1.95))
        self.rubble_face(bm, layer, x0, x1, gy, base_h, height, rng, door_open + windows, big=0.3, small=0.24, seed=x0 * 7 + s)
        face = common.mesh_object(f"{name}-stones", bm, stone, None, smooth=False)
        common.add_modifier(face, "BEVEL", width=0.018, segments=2, limit_method="ANGLE")
        objs.append(face)
        # Mortar behind the stones (the wall's body), and a patch of whitewashed plaster.
        body = common.box(f"{name}-body", (x1 - x0, gy - n - 0.05, height), Vector(((x0 + x1) / 2, -((n + gy) / 2 + base_h) + 0.02, base_h + height / 2)), mortar, None)
        objs.append(body)
        # Doors: timber leaves on pivots, a dark room behind; by day one leaf
        # stands open, at night both are shut, lamplight at the cracks.
        for d in doors:
            lit = self._door_lit(d, s)
            objs += self._house_door(f"{name}-door{d}", d, gy, base_h, wood, lit)
        for k, (wx0, wx1, wz0, wz1) in enumerate(windows):
            objs.append(common.box(f"{name}-win{k}", (wx1 - wx0, 0.2, wz1 - wz0), Vector(((wx0 + wx1) / 2, -(gy + base_h) + 0.08, base_h + (wz0 + wz1) / 2)), M.plain("#15110d", 0.95, 0.05), None))
            for b in range(2):
                objs.append(common.box(f"{name}-win{k}-bar{b}", (0.03, 0.04, wz1 - wz0), Vector((wx0 + (wx1 - wx0) * (b + 1) / 3, -(gy + base_h) - 0.02, base_h + (wz0 + wz1) / 2)), wood, None))
            glow = common.box(f"{name}-win{k}-glow", (wx1 - wx0 - 0.02, 0.02, wz1 - wz0 - 0.02), Vector(((wx0 + wx1) / 2, -(gy + base_h) + 0.1, base_h + (wz0 + wz1) / 2)), M.emissive("#ffa24a", 2.2), None)
            objs.append(tag(glow, NIGHT))
        # The roof: an earthen roof on beams; beam ends showing under the rolled edge.
        top = base_h + height
        roof = common.box(f"{name}-roof", (x1 - x0 + 0.08, gy - n + 0.05, 0.2), Vector(((x0 + x1) / 2, -((n + gy) / 2 + base_h), top + 0.08)), M.plaster("#c2a986", f"roof-clay-{name}"), None, bevel=0.06)
        common.bake_modifiers(roof)
        objs.append(roof)
        for k in range(int((x1 - x0) / 0.6)):
            bx = x0 + 0.3 + k * 0.6
            objs.append(self._branch(f"{name}-beam{k}", Vector((bx, -(gy + base_h) + 0.1, top - 0.05)), Vector((bx, -(gy + base_h) - 0.12, top - 0.06)), 0.055, 0.05, M.bark("#5e4c3a"), 7, bow=0.0))
        par = common.box(f"{name}-parapet", (x1 - x0, 0.22, 0.28), Vector(((x0 + x1) / 2, -(gy + base_h) + 0.12, top + 0.3)), M.lime_plaster("#d2c3a2", f"parapet-{name}", grime=0.5), None, bevel=0.05)
        common.bake_modifiers(par)
        objs.append(par)
        objs += self._roof_life(name, x0, x1, n, gy, top + 0.18, base_h, rng)
        self.sprite(name, gy, objs, sorted(cells))

    def _door_lit(self, dx, dy):
        """Is there a lamp burning behind this door at night? The doors people
        come and go by (an exit, or someone standing near)."""
        m = self.map
        if any(abs(e["x"] - dx) <= 1 and 0 <= e["y"] - dy <= 1 for e in m.exits):
            return True
        return any(e.get("characterId") and abs(e["x"] - dx) <= 2 and 0 <= e["y"] - dy <= 2 for e in m.entities)

    def _house_door(self, name, d, gy, base_h, wood, lit):
        objs = []
        h = 1.75
        cx = d + 0.5
        fy = -(gy + base_h)
        objs.append(common.box(f"{name}-dark", (0.76, 0.34, h), Vector((cx, fy + 0.2, base_h + h / 2)), M.plain("#15110d", 0.95, 0.05), None))
        lint = common.box(f"{name}-lintel", (1.04, 0.16, 0.16), Vector((cx, fy - 0.01, base_h + h + 0.08)), M.limestone("#c8b590", "lintel", worn=0.5), None, bevel=0.02)
        common.bake_modifiers(lint)
        self._rand_attr(lint, 0.6)
        objs.append(lint)
        sill = common.box(f"{name}-sill", (0.92, 0.26, 0.05), Vector((cx, fy - 0.04, base_h + 0.02)), M.limestone("#bfac88", "sill-stone", worn=0.7), None, bevel=0.015)
        common.bake_modifiers(sill)
        self._rand_attr(sill, 0.5)
        objs.append(sill)
        # By day: the leaf open against the inside of the jamb.
        leaf = common.box(f"{name}-leaf", (0.06, 0.62, h - 0.06), Vector((cx - 0.34, fy + 0.34, base_h + h / 2)), wood, None, bevel=0.006)
        common.bake_modifiers(leaf)
        objs.append(tag(leaf, DAYLIT))
        # At night: shut, planks on battens; lamplight at the cracks if someone is in.
        shut = common.box(f"{name}-shut", (0.78, 0.07, h - 0.04), Vector((cx, fy + 0.03, base_h + h / 2)), wood, None, bevel=0.006)
        common.bake_modifiers(shut)
        objs.append(tag(shut, NIGHT))
        for k in range(3):
            objs.append(tag(common.box(f"{name}-batten{k}", (0.74, 0.03, 0.06), Vector((cx, fy - 0.01, base_h + 0.3 + k * 0.55)), wood, None), NIGHT))
        if lit:
            # Light at the gap between door and jamb, and spilling from under it.
            gap = common.box(f"{name}-crack", (0.02, 0.03, h - 0.1), Vector((cx + 0.38, fy + 0.02, base_h + h / 2)), M.emissive("#ffb060", 5.0), None)
            under = common.box(f"{name}-under", (0.7, 0.03, 0.02), Vector((cx, fy + 0.02, base_h + 0.03)), M.emissive("#ffb060", 5.0), None)
            objs += [tag(gap, NIGHT), tag(under, NIGHT)]
            spill = self.add_light(f"{name}-spill", "AREA", Vector((cx, fy - 0.3, base_h + 0.25)), 7.0, "#ffae60")
            spill.data.size = 0.6
            spill.rotation_euler = (math.radians(70), 0, 0)
            tag(spill, NIGHT)
            self.flicker.append(("lamp", cx * 32, (gy + 0.25) * 32, 34.0, ["night"]))
        return objs

    def _roof_life(self, name, x0, x1, n, gy, z, base_h, rng):
        """On a flat roof: a lean-to of reed matting on poles, a stone roller
        for the clay, jars, a mat of figs or grain drying, rolled bedding."""
        objs = []
        w = x1 - x0
        d = gy - n
        yb = lambda yy: -(yy + base_h)  # noqa: E731
        # The lean-to over one end.
        lx = x0 + 0.4 if (x0 * 7 + int(gy)) % 2 else x1 - 2.2
        wood = M.wood("#6e5236", 4.0)
        for px in (lx, lx + 1.8):
            for py, ph in ((n + 0.35, 1.3), (n + 1.6, 0.9)):
                objs.append(self._branch(f"{name}-lt-post{px:.1f}{py:.1f}", Vector((px, yb(py), z)), Vector((px, yb(py), z + ph)), 0.03, 0.028, wood, 6, bow=0.0))
        mat_ = M.straw("#b39868")
        bm = bmesh.new()
        grid = []
        for j in range(7):
            row = []
            for i in range(10):
                u, v = i / 9, j / 6
                row.append(bm.verts.new(Vector((lx - 0.05 + 1.9 * u, yb(n + 0.3 + 1.4 * v), z + 1.3 - 0.4 * v - 0.04 * math.sin(math.pi * u)))))
            grid.append(row)
        for j in range(6):
            for i in range(9):
                bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        mat_obj = common.mesh_object(f"{name}-matting", bm, mat_, None)
        common.add_modifier(mat_obj, "SOLIDIFY", thickness=0.015)
        objs.append(mat_obj)
        # A stone roller for rolling the clay roof after rain.
        rx = x0 + w * (0.55 if lx < x0 + w / 2 else 0.25)
        roller = self._branch(f"{name}-roller", Vector((rx, yb(n + d * 0.55), z + 0.12)), Vector((rx + 0.55, yb(n + d * 0.55), z + 0.12)), 0.12, 0.12, M.limestone("#b8a582", "roller", worn=0.5), 14, bow=0.0)
        self._rand_attr(roller, 0.5)
        objs.append(roller)
        objs += self._jar_group(f"{name}-roofjars", rx + 1.0, n + d * 0.35 - 0.3, 0.0, rng, count=2, at=Vector((rx + 1.0, yb(n + d * 0.35), z)))
        # A mat of figs (or grain) drying.
        fx = x0 + w * 0.5 + (rng.random() - 0.5) * w * 0.3
        mat2 = common.box(f"{name}-figmat", (0.9, 0.6, 0.012), Vector((fx, yb(n + d * 0.7), z + 0.01)), M.straw("#b59d6a"), None)
        objs.append(mat2)
        dried = M.plain("#6a4a36", 0.6)
        for k in range(18):
            objs.append(self._ellipsoid(f"{name}-fig{k}", Vector((fx - 0.38 + rng.random() * 0.76, yb(n + d * 0.7 - 0.25 + rng.random() * 0.5), z + 0.035)), (0.03, 0.03, 0.02), dried, 8, 5))
        return objs

    def village_wall(self, cells):
        """The village's edge: a rough wall of fieldstones and the backs of
        houses (seen from above, beyond the lane), stepped with the ground."""
        m = self.map
        rng = self.rng
        by_col = {}
        for x, y in cells:
            by_col.setdefault(x, []).append(y)
        mat = field_rock("#a89e8a", "village-wall", lichen=0.4)
        for x, ys in by_col.items():
            ys = sorted(ys)
            runs = []
            for y in ys:
                if runs and y == runs[-1][1]:
                    runs[-1][1] = y + 1
                else:
                    runs.append([y, y + 1])
            for y0, y1 in runs:
                objs = self.dry_wall(f"vwall-{x}-{y0}", y0, y1, x, 1.5, 0.8, brush=0.0, axis="y", seed=x * 13 + y0, mat=mat)
                self.sprite(f"wall-{x}-{y0}", y1 - 0.05, objs, [(x, y) for y in range(y0, y1)])
        _ = (m, rng)

    def village_gate(self, gates):
        """The village gate: a gap in the wall between two stout piers of
        squared stone, a heavy timber leaf standing open against one of them."""
        rng = self.rng
        x = gates[0][0]
        ys = sorted(g[1] for g in gates)
        top, bottom = ys[0], ys[-1] + 1
        mat = M.limestone("#c6b490", "gate-pier", worn=0.6)
        objs = []
        for py in (top - 0.05, bottom + 0.05):
            bm = bmesh.new()
            layer = bm.faces.layers.float.new("rand")
            z = 0.0
            while z < 2.1:
                h = 0.26 + rng.random() * 0.08
                cube = bmesh.ops.create_cube(bm, size=1.0)
                for v in cube["verts"]:
                    v.co = self.P(x + 0.5 + v.co.x * 0.86, py + v.co.y * 0.5, z + (v.co.z + 0.5) * (h - 0.015))
                r = rng.random()
                for f in bm.faces:
                    if f.verts[0] in cube["verts"]:
                        f[layer] = r
                z += h
            pier = common.mesh_object(f"gate-pier-{py:.1f}", bm, mat, None, smooth=False)
            common.add_modifier(pier, "BEVEL", width=0.02, segments=2)
            objs.append(pier)
        leaf = common.box("gate-leaf", (0.1, 0.9, 1.9), self.P(x + 0.18, top + 0.55, 0.95), M.wood("#5a4230", 8.0), None, bevel=0.01)
        common.bake_modifiers(leaf)
        objs.append(leaf)
        self.sprite("gate", bottom + 0.45, objs, [(x, y) for y in ys])

    # ── dressing ────────────────────────────────────────────────────────────
    def dress_home(self):
        if not self.village:
            return super().dress_home()
        # The oven's embers flicker; at night they glow brighter.
        for x, y in self.map.tiles("oven"):
            c = self.P(x + 0.5, y + 0.45)
            glow = self.add_light(f"oven-night-{x}-{y}", "POINT", c + Vector((0, -0.2, 0.75)), 30.0, "#ff7a30", radius=0.15)
            tag(glow, NIGHT)
            self.flicker.append(("hearth", (x + 0.5) * 32, (y + 0.45 - 0.62) * 32, 70.0, ["day", "late", "night"]))
