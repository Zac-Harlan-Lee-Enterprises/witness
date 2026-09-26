"""Materials for portraits: skin, eyes, hair and cloth, as procedural Cycles
node trees (no image textures). Colours come from the person's appearance
data (sRGB hex) and are converted to linear.

Skin reads the per-vertex maps written by portrait_skin.py (albedo, rough,
oil, pores, lines, freckle, stubble, lip, scar) and adds what is too fine
for vertices: mottling, freckles and age spots, the dots of a shaved
beard, pores and the fine criss-cross grain of skin, lines on the lips.
"""
import math
import random

from common import hex_rgb
from materials import Nodes, cached

M = 1.0  # scene units are metres


def _lin(h):
    return hex_rgb(h)


def _luma(h):
    r, g, b, _ = _lin(h)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _principled(n, method, **inputs):
    """A Principled BSDF with its subsurface method chosen before its inputs
    are set (some inputs only exist for some methods)."""
    b = n.nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.subsurface_method = method
    for k, v in inputs.items():
        sock = next(s for s in b.inputs if s.name == k)
        if isinstance(v, tuple) and len(v) == 2 and hasattr(v[0], "outputs"):
            n.nt.links.new(v[0].outputs[v[1]], sock)
        else:
            sock.default_value = v
    n.link(b, "BSDF", n.out, "Surface")
    return b


def _range(n, value, a, b, c, d, clamp=True):
    m = n.new("ShaderNodeMapRange", Value=value, **{"From Min": a, "From Max": b, "To Min": c, "To Max": d})
    m.clamp = clamp
    return (m, "Result")


def _attr(n, name):
    return n.new("ShaderNodeAttribute", _attribute_name=name, _attribute_type="GEOMETRY")


def _scale(n, vec, fac):
    return (n.new("ShaderNodeVectorMath", _operation="SCALE", Vector=vec, Scale=fac), "Vector")


# ── Skin ───────────────────────────────────────────────────────────────────
def skin(key, child=0.0, sss=1.0, detail=1.0, dark=0.0):
    """Skin for one person. `detail` scales the fine relief (1 adult)."""

    def build():
        n = Nodes(f"skin-{key}")
        obj = n.coords("Object")
        alb = _attr(n, "albedo")
        rough = _attr(n, "rough")
        oil = _attr(n, "oil")
        pores = _attr(n, "pores")
        lines = _attr(n, "lines")
        freckle = _attr(n, "freckle")
        stubble = _attr(n, "stubble")
        lip = _attr(n, "lip")
        scar = _attr(n, "scar")

        # ── Colour: the regional map, mottled at three scales ──────────────
        blotch = n.noise(26.0, 4.0, 0.6, obj)
        mottle = n.noise(110.0, 3.0, 0.6, obj)
        grain = n.noise(420.0, 3.0, 0.6, obj)
        col = _scale(n, (alb, "Color"), _range(n, (blotch, "Fac"), 0.3, 0.7, 0.93, 1.06))
        col = _scale(n, col, _range(n, (mottle, "Fac"), 0.3, 0.7, 0.955, 1.035))
        col = _scale(n, col, _range(n, (grain, "Fac"), 0.3, 0.7, 0.97, 1.03))
        # Hue, not only brightness: patches a little redder, others a little
        # more olive, at a centimetre or two.
        rb = n.noise(48.0, 3.0, 0.55, obj)
        redder = _range(n, (rb, "Fac"), 0.4, 0.7, 0.0, 0.4)
        cred = n.mix(redder, col, (0.95, 0.66, 0.62, 1.0), "MULTIPLY")
        ob = n.noise(17.0, 2.0, 0.5, obj)
        olive = _range(n, (ob, "Fac"), 0.45, 0.7, 0.0, 0.3)
        col = (n.mix(olive, (cred, 2), (0.9, 0.93, 0.8, 1.0), "MULTIPLY"), 2)
        # Freckles and age spots: round marks of different sizes and depths,
        # only where the freckle map allows.
        fv = n.new("ShaderNodeTexVoronoi", Scale=330.0 * M, Vector=obj, _feature="F1", Randomness=1.0)
        fr = n.new("ShaderNodeSeparateColor", Color=(fv, "Color"))
        dens = n.math("MULTIPLY", (freckle, "Fac"), 0.55)
        has = n.math("LESS_THAN", (fr, "Red"), (dens, "Value"))
        size = _range(n, (fr, "Green"), 0.0, 1.0, 0.22, 0.42)
        dot = n.new("ShaderNodeMapRange", Value=(fv, "Distance"), **{"From Min": 0.12, "To Min": 1.0, "To Max": 0.0})
        n.link(size[0], size[1], dot, "From Max")
        spot = n.math("MULTIPLY", (has, "Value"), (dot, "Result"))
        spot = n.math("MULTIPLY", (spot, "Value"), _range(n, (fr, "Blue"), 0.0, 1.0, 0.18, 0.4))
        fcol = n.mix((spot, "Value"), (col[0], col[1]), (0.3, 0.19, 0.12, 1.0), "MULTIPLY")
        col = (fcol, 2)
        # A shaved beard: dense dark dots (the cut hairs under the skin).
        sv = n.new("ShaderNodeTexVoronoi", Scale=2300.0 * M, Vector=obj, _feature="F1", Randomness=0.9)
        sdot = n.new("ShaderNodeMapRange", Value=(sv, "Distance"), **{"From Min": 0.18, "From Max": 0.42, "To Min": 1.0, "To Max": 0.0})
        sd = n.math("MULTIPLY", (sdot, "Result"), (stubble, "Fac"))
        sd2 = n.math("MULTIPLY", (sd, "Value"), 0.7)
        scol = n.mix((sd2, "Value"), col, (0.02, 0.018, 0.018, 1.0))
        col = (scol, 2)

        # ── Relief: pores, skin grain, fine lines, lip lines, stubble ──────
        vor = n.new("ShaderNodeTexVoronoi", Scale=1500.0 * M, Vector=obj, _feature="F1")
        pit = _range(n, (vor, "Distance"), 0.0, 0.55, -1.0, 0.0)
        vor2 = n.new("ShaderNodeTexVoronoi", Scale=3300.0 * M, Vector=obj, _feature="F1")
        pit2 = _range(n, (vor2, "Distance"), 0.0, 0.5, -0.5, 0.0)
        p12 = n.math("ADD", pit, pit2)
        h_pores = n.math("MULTIPLY", (p12, "Value"), (pores, "Fac"))
        # The criss-cross grain of skin: a network of fine grooves.
        net = n.new("ShaderNodeTexVoronoi", Scale=700.0 * M, Vector=obj, _feature="DISTANCE_TO_EDGE", Randomness=0.85)
        groove = _range(n, (net, "Distance"), 0.0, 0.07, -1.0, 0.0)
        h_net = n.math("MULTIPLY", groove, (lines, "Fac"))
        h_net = n.math("MULTIPLY", (h_net, "Value"), 0.7)
        wav = n.new("ShaderNodeTexWave", Scale=380.0, Distortion=16.0, Detail=4.0, Vector=obj, _wave_type="BANDS", _bands_direction="DIAGONAL")
        h_wav = n.math("MULTIPLY", (wav, "Fac"), (lines, "Fac"))
        h_wav = n.math("MULTIPLY", (h_wav, "Value"), 0.35)
        # Lips: fine vertical lines.
        lw = n.new("ShaderNodeTexWave", Scale=900.0, Distortion=3.0, Detail=2.0, Vector=obj, _wave_type="BANDS", _bands_direction="X")
        h_lip = n.math("MULTIPLY", (lw, "Fac"), (lip, "Fac"))
        h_lip = n.math("MULTIPLY", (h_lip, "Value"), 1.5)
        uneven = n.noise(240.0, 4.0, 0.6, obj)
        h_un = n.math("MULTIPLY", (uneven, "Fac"), 1.2)
        h_st = n.math("MULTIPLY", (sd, "Value"), 0.6)
        h_sc = n.math("MULTIPLY", (scar, "Fac"), 1.5)
        h = h_pores
        for part in (h_net, h_wav, h_lip, h_un, h_st, h_sc):
            h = n.math("ADD", (h, "Value"), (part, "Value"))
        bump = n.bump((h, "Value"), strength=(0.44 - 0.18 * child) * detail, distance=0.00025)
        # Broader unevenness of the surface (millimetre bumps), for the coat.
        cn = n.noise(90.0, 3.0, 0.5, obj)
        cbump = n.bump((cn, "Fac"), strength=0.12 * detail, distance=0.0004, normal=(bump, "Normal"))

        # ── Finish: regional roughness broken up; oily sheen; moist lips ───
        rn = n.noise(55.0, 3.0, 0.5, obj)
        rv = _range(n, (rn, "Fac"), 0.3, 0.7, -0.13, 0.13)
        rr = n.math("ADD", (rough, "Fac"), rv)
        rn2 = n.noise(190.0, 3.0, 0.6, obj)
        rv2 = _range(n, (rn2, "Fac"), 0.3, 0.7, -0.06, 0.06)
        rr = n.math("ADD", (rr, "Value"), rv2)
        rp = n.math("MULTIPLY", (pit[0], pit[1]), -0.1)
        rr = n.math("ADD", (rr, "Value"), (rp, "Value"))
        on = n.noise(35.0, 3.0, 0.6, obj)
        ov = _range(n, (on, "Fac"), 0.35, 0.65, 0.55, 1.15)
        coat = n.math("MULTIPLY", (oil, "Fac"), (ov[0], ov[1]))
        coat = n.math("MULTIPLY", (coat, "Value"), 0.34)
        coat_r = _range(n, (lip, "Fac"), 0.0, 1.0, 0.3, 0.12)
        _principled(
            n,
            "RANDOM_WALK_SKIN",
            **{
                "Base Color": col,
                "Roughness": (rr, "Value"),
                "Subsurface Weight": sss,
                "Subsurface Radius": (1.0, 0.45, 0.25),
                "Subsurface Scale": 0.0022 * (1 - 0.35 * dark),
                "Subsurface IOR": 1.4,
                "Subsurface Anisotropy": 0.8,
                "Specular IOR Level": 0.5,
                "IOR": 1.4,
                "Coat Weight": (coat, "Value"),
                "Coat Roughness": coat_r,
                "Coat IOR": 1.45,
                "Sheen Weight": 0.22 + 0.06 * child,
                "Sheen Roughness": 0.35,
                "Sheen Tint": (1.0, 0.94, 0.88, 1.0),
                "Normal": (bump, "Normal"),
                "Coat Normal": (cbump, "Normal"),
            },
        )
        return n.mat

    return cached(("pskin", key, round(child, 2), sss, detail, round(dark, 2)), build)


def clay():
    """Grey clay: to judge shape without colour."""

    def build():
        n = Nodes("clay")
        n.bsdf(**{"Base Color": (0.36, 0.34, 0.32, 1.0), "Roughness": 0.6, "Specular IOR Level": 0.3})
        return n.mat

    return cached(("clay",), build)


# ── Eyes ───────────────────────────────────────────────────────────────────
def eye_inner(iris_hex, seed, kind="brown", age=0.0):
    """Sclera (warm, not white: a little yellow, pinker and greyer toward the
    corners, with faint vessels) and iris (radial fibres and crypts, a ring
    round the pupil, a dark ring at the edge). Hazel eyes are greener at the
    edge and golden inside; amber ones lighter and warmer."""

    def build():
        r = random.Random(seed)
        n = Nodes(f"eye-{iris_hex}-{seed}")
        obj = n.coords("Object")
        sep = n.new("ShaderNodeSeparateXYZ", Vector=obj)
        # Polar coordinates around the pupil axis (-Y), in cm.
        x = n.math("MULTIPLY", (sep, "X"), 100.0)
        z = n.math("MULTIPLY", (sep, "Z"), 100.0)
        y = n.math("MULTIPLY", (sep, "Y"), -100.0)
        rho = n.new("ShaderNodeVectorMath", _operation="LENGTH")
        cmb = n.new("ShaderNodeCombineXYZ", X=(x, "Value"), Y=(z, "Value"))
        n.link(cmb, "Vector", rho, "Vector")
        ang = n.math("ARCTAN2", (z, "Value"), (x, "Value"))
        front = n.new("ShaderNodeMapRange", Value=(y, "Value"), **{"From Min": 0.95, "From Max": 1.0, "To Min": 0.0, "To Max": 1.0})
        iris_r = 0.6
        rn = n.math("DIVIDE", (rho, "Value"), iris_r)
        # Fibres: noise stretched along the radius; crypts: darker pits.
        pol = n.new("ShaderNodeCombineXYZ", X=(ang, "Value"), Y=(rn, "Value"))
        stretch = n.new("ShaderNodeVectorMath", _operation="MULTIPLY", Vector=(pol, "Vector"))
        stretch.inputs[1].default_value = (9.0, 1.2, 1.0)
        fib = n.new("ShaderNodeTexNoise", Scale=4.0, Detail=8.0, Roughness=0.65, Vector=(stretch, "Vector"))
        fib2 = n.new("ShaderNodeTexNoise", Scale=14.0, Detail=4.0, Roughness=0.5, Vector=(stretch, "Vector"))
        crypt = n.new("ShaderNodeTexVoronoi", Scale=5.0, Vector=(stretch, "Vector"), _feature="F1")
        base = _lin(iris_hex)
        dark = tuple(c * 0.45 for c in base[:3]) + (1.0,)
        light = tuple(min(1.0, c * 1.35 + 0.002) for c in base[:3]) + (1.0,)
        c1 = n.mix((fib, "Fac"), dark, light)
        c2 = n.mix((fib2, "Fac"), (c1, 2), dark, "MULTIPLY")
        c2.inputs[0].default_value = 0.3
        cr = _range(n, (crypt, "Distance"), 0.0, 0.35, 0.45, 0.0)
        c2b = n.mix(cr, (c2, 2), tuple(c * 0.35 for c in base[:3]) + (1.0,))
        # The ring round the pupil (collarette): warmer, and golden in hazel and amber eyes.
        if kind == "hazel":
            ring_col = (0.16, 0.085, 0.025, 1.0)
            edge_col = (0.06, 0.07, 0.035, 1.0)
        elif kind == "amber":
            ring_col = (0.2, 0.1, 0.03, 1.0)
            edge_col = (0.07, 0.04, 0.018, 1.0)
        else:
            ring_col = tuple(min(1.0, c * 1.5 + 0.006) for c in base[:3]) + (1.0,)
            edge_col = tuple(c * 0.8 for c in base[:3]) + (1.0,)
        coll = n.new("ShaderNodeMapRange", Value=(rn, "Value"), **{"From Min": 0.28, "From Max": 0.52, "To Min": 0.4 + 0.2 * r.random(), "To Max": 0.0})
        c3 = n.mix((coll, "Result"), (c2b, 2), ring_col)
        outer = n.new("ShaderNodeMapRange", Value=(rn, "Value"), **{"From Min": 0.55, "From Max": 0.9, "To Min": 0.0, "To Max": 0.5})
        c3b = n.mix((outer, "Result"), (c3, 2), edge_col)
        # The dark limbal ring at the edge.
        limb = n.new("ShaderNodeMapRange", Value=(rn, "Value"), **{"From Min": 0.82, "From Max": 1.0, "To Min": 0.0, "To Max": 0.8})
        c4 = n.mix((limb, "Result"), (c3b, 2), (0.008, 0.005, 0.004, 1.0))
        # Pupil.
        pupil_r = 0.23 + 0.05 * r.random()
        pup = n.new("ShaderNodeMapRange", Value=(rn, "Value"), **{"From Min": pupil_r - 0.02, "From Max": pupil_r + 0.02, "To Min": 1.0, "To Max": 0.0})
        iris_col = n.mix((pup, "Result"), (c4, 2), (0.002, 0.0015, 0.0015, 1.0))
        # Sclera: warm off-white, faint vessels, pinker and greyer away from the iris.
        veins = n.new("ShaderNodeTexNoise", Scale=22.0, Detail=10.0, Roughness=0.7, Vector=obj, _noise_type="RIDGED_MULTIFRACTAL")
        vmask = n.new("ShaderNodeMapRange", Value=(veins, "Fac"), **{"From Min": 0.72, "From Max": 1.0, "To Min": 0.0, "To Max": 0.5})
        edge = n.new("ShaderNodeMapRange", Value=(y, "Value"), **{"From Min": 0.2, "From Max": 1.0, "To Min": 1.0, "To Max": 0.0})
        vm = n.math("MULTIPLY", (vmask, "Result"), (edge, "Result"))
        white_hex = "#b1a08c" if age < 0.4 else "#a99476"
        white = n.mix((edge, "Result"), _lin(white_hex), _lin("#8c7063"))
        scl = n.mix((vm, "Value"), (white, 2), _lin("#9c4038"))
        # Iris region: inside the limbus, on the front.
        inside = n.new("ShaderNodeMapRange", Value=(rn, "Value"), **{"From Min": 0.97, "From Max": 1.03, "To Min": 1.0, "To Max": 0.0})
        mask = n.math("MULTIPLY", (inside, "Result"), (front, "Result"))
        col = n.mix((mask, "Value"), (scl, 2), (iris_col, 2))
        bump = n.bump((fib, "Fac"), strength=0.3, distance=0.0002)
        n.bsdf(
            **{
                "Base Color": (col, 2),
                "Roughness": 0.4,
                "Subsurface Weight": 0.25,
                "Subsurface Radius": (1.0, 0.5, 0.35),
                "Subsurface Scale": 0.001,
                "Specular IOR Level": 0.3,
                "Normal": (bump, "Normal"),
            }
        )
        return n.mat

    return cached(("eye", iris_hex, seed, kind, round(age, 1)), build)


def cornea():
    """The clear, wet outer layer of the eye. A trace of roughness keeps the
    catchlight soft."""

    def build():
        n = Nodes("cornea")
        glass = n.new("ShaderNodeBsdfGlass", IOR=1.376, Roughness=0.1)
        glass.inputs["Color"].default_value = (1, 1, 1, 1)
        n.link(glass, "BSDF", n.out, "Surface")
        return n.mat

    return cached(("cornea",), build)


def tear():
    def build():
        n = Nodes("tear")
        n.bsdf(**{"Base Color": (0.8, 0.6, 0.55, 1), "Roughness": 0.05, "Transmission Weight": 0.85, "IOR": 1.33, "Specular IOR Level": 0.6})
        return n.mat

    return cached(("tear",), build)


def caruncle(skin_hex):
    def build():
        n = Nodes(f"caruncle-{skin_hex}")
        base = _lin(skin_hex)
        pink = (min(1.0, base[0] * 1.5 + 0.1), base[1] * 0.75 + 0.02, base[2] * 0.75 + 0.02, 1.0)
        n.bsdf(**{"Base Color": pink, "Roughness": 0.12, "Subsurface Weight": 0.6, "Subsurface Radius": (1.0, 0.3, 0.2), "Subsurface Scale": 0.002, "Coat Weight": 0.6, "Coat Roughness": 0.05})
        return n.mat

    return cached(("caruncle", skin_hex), build)


# ── Hair ───────────────────────────────────────────────────────────────────
_MELANIN = [(-5.3, 0.99), (-4.8, 0.97), (-4.4, 0.94), (-3.7, 0.86), (-3.1, 0.78), (-2.0, 0.55), (-0.5, 0.12)]


def melanin_of(hexcol):
    L = max(_luma(hexcol), 1e-4)
    x = math.log(L)
    pts = _MELANIN
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def redness_of(hexcol):
    r, g, b, _ = _lin(hexcol)
    s = r + g + b + 1e-5
    return max(0.1, min(0.6, (r - b) / s * 0.8))


def hair(hexcol, grey=0.0, name="hair"):
    """Principled hair (Chiang): colour from melanin, strand-to-strand variation,
    and for grey hair a mix of white and pigmented strands."""

    def build():
        n = Nodes(f"{name}-{hexcol}-{grey:.2f}")
        info = n.new("ShaderNodeHairInfo")
        mel = melanin_of(hexcol)
        red = redness_of(hexcol)
        # Each strand is either pigmented or white, in proportion to `grey`.
        white = n.math("LESS_THAN", (info, "Random"), grey)
        m = n.new("ShaderNodeMapRange", Value=(white, "Value"), **{"From Min": 0.0, "From Max": 1.0, "To Min": mel, "To Max": 0.06})
        h = n.new("ShaderNodeBsdfHairPrincipled", _model="CHIANG", _parametrization="MELANIN")
        h.inputs["Melanin"].default_value = mel
        n.link(m, "Result", h, "Melanin")
        h.inputs["Melanin Redness"].default_value = red
        h.inputs["Roughness"].default_value = 0.34
        h.inputs["Radial Roughness"].default_value = 0.42
        h.inputs["Coat"].default_value = 0.08
        h.inputs["Random Color"].default_value = 0.22 if name == "beard" else 0.14
        h.inputs["Random Roughness"].default_value = 0.2
        h.inputs["IOR"].default_value = 1.55
        n.link(h, "BSDF", n.out, "Surface")
        return n.mat

    return cached(("phair", hexcol, round(grey, 2), name), build)


# ── Cloth ──────────────────────────────────────────────────────────────────
def _toward(a, b, t):
    ha, hb = a.lstrip("#"), b.lstrip("#")
    ca = [int(ha[i : i + 2], 16) for i in (0, 2, 4)]
    cb = [int(hb[i : i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{int(round(x + (y - x) * t)):02x}" for x, y in zip(ca, cb))


def _shade(hexcol, amount):
    h = hexcol.lstrip("#")
    rgb = [int(h[i : i + 2], 16) for i in (0, 2, 4)]
    if amount >= 0:
        rgb = [c + (255 - c) * amount for c in rgb]
    else:
        rgb = [c * (1 + amount) for c in rgb]
    return _lin("#" + "".join(f"{max(0, min(255, int(round(c)))):02x}" for c in rgb))


def cloth(color, kind="wool", stripe=None, stripe_at=0.0, stripe_w=0.0, name="cloth", uv=None):
    """Hand-woven wool or linen dyed with natural dyes. The sheen takes the dye's
    own colour: an untinted sheen reflects the light's colour and greys the dye.
    Optional woven stripes (clavi) along the object's X at +/- stripe_at (m).
    `uv` names a per-vertex (along, across) attribute in cm: the weave then
    follows the cloth (the turns of a wrap) instead of the object's axes."""

    def build():
        n = Nodes(f"{name}-{kind}-{color}-{stripe}-{uv}")
        obj = n.coords("Object")
        weave_at = obj
        if uv:
            a = n.new("ShaderNodeAttribute", _attribute_name=uv, _attribute_type="GEOMETRY")
            sep_uv = n.new("ShaderNodeSeparateXYZ", Vector=(a, "Vector"))
            ax = n.math("MULTIPLY", (sep_uv, "X"), 0.01)
            az = n.math("MULTIPLY", (sep_uv, "Y"), 0.01)
            comb = n.new("ShaderNodeCombineXYZ", X=(ax, "Value"), Y=0.0, Z=(az, "Value"))
            weave_at = (comb, "Vector")
        dyed = _toward(color, "#8c8070", 0.1 if kind == "wool" else 0.05)
        blotch = n.noise(9.0, 3.0, 0.55, obj)
        slub = n.new("ShaderNodeTexWave", Scale=70.0, Distortion=4.0, Detail=2.0, Vector=obj, _bands_direction="X")
        base = n.mix((blotch, "Fac"), _shade(dyed, -0.1), _shade(dyed, 0.06))
        base2 = n.mix((slub, "Fac"), (base, 2), _shade(dyed, -0.14))
        base2.inputs[0].default_value = 0.0
        sl = n.math("MULTIPLY", (slub, "Fac"), 0.18)
        base3 = n.mix((sl, "Value"), (base, 2), _shade(dyed, -0.16))
        col_out = (base3, 2)
        if stripe:
            sep = n.new("ShaderNodeSeparateXYZ", Vector=obj)
            d = n.math("ABSOLUTE", (sep, "X"))
            d = n.math("SUBTRACT", (d, "Value"), stripe_at)
            d = n.math("ABSOLUTE", (d, "Value"))
            band = n.new("ShaderNodeMapRange", Value=(d, "Value"), **{"From Min": stripe_w * 0.85, "From Max": stripe_w * 1.15, "To Min": 0.85, "To Max": 0.0})
            col = n.mix((band, "Result"), col_out, _lin(_toward(stripe, color, 0.2)))
            col_out = (col, 2)
        # Weave: warp and weft threads about a millimetre apart.
        w1 = n.new("ShaderNodeTexWave", Scale=520.0, Distortion=1.5, Detail=1.0, Vector=weave_at, _bands_direction="X")
        w2 = n.new("ShaderNodeTexWave", Scale=520.0, Distortion=1.5, Detail=1.0, Vector=weave_at, _bands_direction="Z")
        ws = n.math("ADD", (w1, "Fac"), (w2, "Fac"))
        fz = n.noise(350.0, 4.0, 0.7, obj)
        hh = n.math("ADD", (ws, "Value"), (fz, "Fac"))
        bump = n.bump((hh, "Value"), strength=0.18 if kind == "wool" else 0.1, distance=0.0006)
        n.bsdf(
            **{
                "Base Color": col_out,
                "Roughness": 0.9 if kind == "wool" else 0.8,
                "Sheen Weight": 0.35 if kind == "wool" else 0.15,
                "Sheen Roughness": 0.5,
                "Sheen Tint": col_out,
                "Specular IOR Level": 0.2,
                "Normal": (bump, "Normal"),
            }
        )
        return n.mat

    return cached(("pcloth", color, kind, stripe, stripe_at, stripe_w, name, uv), build)


# ── The backdrop ───────────────────────────────────────────────────────────
def backdrop():
    """A limestone wall in warm shade, far enough behind to fall out of focus."""

    def build():
        n = Nodes("backdrop")
        obj = n.coords("Object")
        blocks = n.new("ShaderNodeTexBrick", Vector=obj, Scale=2.2, Bias=0.0, _offset=0.5, **{"Mortar Size": 0.012, "Brick Width": 0.62, "Row Height": 0.3})
        blocks.inputs["Color1"].default_value = _lin("#c9b48f")
        blocks.inputs["Color2"].default_value = _lin("#b89f7c")
        blocks.inputs["Mortar"].default_value = _lin("#8f7a60")
        big = n.noise(1.2, 4.0, 0.6, obj)
        col = n.mix((big, "Fac"), (blocks, "Color"), _lin("#9d8566"), "MULTIPLY")
        col.inputs[0].default_value = 0.35
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.95, "Specular IOR Level": 0.2})
        return n.mat

    return cached(("backdrop",), build)
