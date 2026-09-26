"""Materials for portraits: skin, eyes, hair and cloth, as procedural Cycles
node trees (no image textures). Colours come from the person's appearance
data (sRGB hex) and are converted to linear.

Skin reads per-vertex attributes written by portrait_skin.py:
  albedo (colour)  regional colour: warmer cheeks, nose and ears, darker
                   around the eyes, the lips, a shaved beard's shadow
  rough            regional roughness (oilier forehead and nose, moist lips)
  pores            how strongly pores and fine lines show
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


# ── Skin ───────────────────────────────────────────────────────────────────
def skin(key, weathered=0.0, child=0.0, sss=1.0):
    def build():
        n = Nodes(f"skin-{key}")
        obj = n.coords("Object")
        alb = n.new("ShaderNodeAttribute", _attribute_name="albedo", _attribute_type="GEOMETRY")
        rough = n.new("ShaderNodeAttribute", _attribute_name="rough", _attribute_type="GEOMETRY")
        pores = n.new("ShaderNodeAttribute", _attribute_name="pores", _attribute_type="GEOMETRY")
        # Mottling at three scales: broad blotches, freckle-sized marks, and a
        # fine unevenness (stronger with sun and age).
        blotch = n.noise(28.0, 4.0, 0.6, obj)
        speck = n.noise(160.0, 3.0, 0.7, obj)
        grain = n.noise(420.0, 3.0, 0.6, obj)
        b_amt = n.new("ShaderNodeMapRange", Value=(blotch, "Fac"), **{"From Min": 0.3, "From Max": 0.7, "To Min": 0.9 - 0.05 * weathered, "To Max": 1.07})
        col = n.new("ShaderNodeVectorMath", _operation="SCALE", Vector=(alb, "Color"), Scale=(b_amt, "Result"))
        spots = n.new("ShaderNodeMapRange", Value=(speck, "Fac"), **{"From Min": 0.6 - 0.06 * weathered, "From Max": 0.76, "To Min": 1.0, "To Max": 0.84 - 0.1 * weathered})
        col2 = n.new("ShaderNodeVectorMath", _operation="SCALE", Vector=(col, "Vector"), Scale=(spots, "Result"))
        g_amt = n.new("ShaderNodeMapRange", Value=(grain, "Fac"), **{"From Min": 0.3, "From Max": 0.7, "To Min": 0.95, "To Max": 1.04})
        col3 = n.new("ShaderNodeVectorMath", _operation="SCALE", Vector=(col2, "Vector"), Scale=(g_amt, "Result"))
        # Pores at two scales, soft unevenness, and fine criss-cross lines.
        vor = n.new("ShaderNodeTexVoronoi", Scale=1500.0 * M, Vector=obj, _feature="F1")
        pit = n.new("ShaderNodeMapRange", Value=(vor, "Distance"), **{"From Min": 0.0, "From Max": 0.6, "To Min": -1.0, "To Max": 0.0})
        vor2 = n.new("ShaderNodeTexVoronoi", Scale=3200.0 * M, Vector=obj, _feature="F1")
        pit2 = n.new("ShaderNodeMapRange", Value=(vor2, "Distance"), **{"From Min": 0.0, "From Max": 0.5, "To Min": -0.5, "To Max": 0.0})
        lines = n.new("ShaderNodeTexWave", Scale=420.0, Distortion=18.0, Detail=4.0, Vector=obj, _wave_type="BANDS", _bands_direction="DIAGONAL")
        uneven = n.noise(260.0, 4.0, 0.6, obj)
        p12 = n.math("ADD", (pit, "Result"), (pit2, "Result"))
        h1 = n.math("MULTIPLY", (p12, "Value"), (pores, "Fac"))
        h2 = n.math("MULTIPLY", (lines, "Fac"), 0.3 + 0.5 * weathered)
        h3 = n.math("ADD", (h1, "Value"), (h2, "Value"))
        h4 = n.math("MULTIPLY_ADD", (uneven, "Fac"), 1.5)
        h4.inputs[2].default_value = 0.0
        h5 = n.math("ADD", (h3, "Value"), (h4, "Value"))
        bump = n.bump((h5, "Value"), strength=0.3 + 0.12 * weathered - 0.12 * child, distance=0.00025)
        # Roughness: the regional map, broken up, pores a little rougher.
        rn = n.noise(60.0, 3.0, 0.5, obj)
        rv = n.new("ShaderNodeMapRange", Value=(rn, "Fac"), **{"From Min": 0.3, "From Max": 0.7, "To Min": -0.07, "To Max": 0.07})
        rr0 = n.math("ADD", (rough, "Fac"), (rv, "Result"))
        rp = n.math("MULTIPLY", (pit, "Result"), -0.08)
        rr = n.math("ADD", (rr0, "Value"), (rp, "Value"))
        col2 = col3
        _principled(
            n,
            "RANDOM_WALK_SKIN",
            **{
                "Base Color": (col2, "Vector"),
                "Roughness": (rr, "Value"),
                "Subsurface Weight": sss,
                "Subsurface Radius": (1.0, 0.45, 0.25),
                "Subsurface Scale": 0.0022,
                "Subsurface IOR": 1.4,
                "Subsurface Anisotropy": 0.8,
                "Specular IOR Level": 0.5,
                "IOR": 1.4,
                "Coat Weight": 0.12,
                "Coat Roughness": 0.24,
                "Normal": (bump, "Normal"),
                "Coat Normal": (bump, "Normal"),
            },
        )
        return n.mat

    return cached(("pskin", key, weathered, child, sss), build)


# ── Eyes ───────────────────────────────────────────────────────────────────
def eye_inner(iris_hex, seed):
    """Sclera (warm white, faint veins, pinker toward the corners) and iris
    (radial fibres, a lighter ring round the pupil, a dark ring at the edge)."""

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
        # Fibres: noise stretched along the radius.
        pol = n.new("ShaderNodeCombineXYZ", X=(ang, "Value"), Y=(rn, "Value"))
        stretch = n.new("ShaderNodeVectorMath", _operation="MULTIPLY", Vector=(pol, "Vector"))
        stretch.inputs[1].default_value = (9.0, 1.2, 1.0)
        fib = n.new("ShaderNodeTexNoise", Scale=4.0, Detail=8.0, Roughness=0.65, Vector=(stretch, "Vector"))
        fib2 = n.new("ShaderNodeTexNoise", Scale=14.0, Detail=4.0, Roughness=0.5, Vector=(stretch, "Vector"))
        base = _lin(iris_hex)
        dark = tuple(c * 0.35 for c in base[:3]) + (1.0,)
        light = tuple(min(1.0, c * 2.0 + 0.012) for c in base[:3]) + (1.0,)
        amber = (min(1.0, base[0] * 1.8 + 0.02), min(1.0, base[1] * 1.6 + 0.01), base[2] * 1.1, 1.0)
        c1 = n.mix((fib, "Fac"), dark, light)
        c2 = n.mix((fib2, "Fac"), (c1, 2), dark, "MULTIPLY")
        c2.inputs[0].default_value = 0.35
        # A lighter, warmer ring round the pupil (the collarette).
        coll = n.new("ShaderNodeMapRange", Value=(rn, "Value"), **{"From Min": 0.28, "From Max": 0.5, "To Min": 0.55 + 0.2 * r.random(), "To Max": 0.0})
        c3 = n.mix((coll, "Result"), (c2, 2), amber)
        # The dark limbal ring at the edge.
        limb = n.new("ShaderNodeMapRange", Value=(rn, "Value"), **{"From Min": 0.8, "From Max": 1.0, "To Min": 0.0, "To Max": 0.85})
        c4 = n.mix((limb, "Result"), (c3, 2), (0.01, 0.006, 0.004, 1.0))
        # Pupil.
        pupil_r = 0.24 + 0.04 * r.random()
        pup = n.new("ShaderNodeMapRange", Value=(rn, "Value"), **{"From Min": pupil_r - 0.02, "From Max": pupil_r + 0.02, "To Min": 1.0, "To Max": 0.0})
        iris_col = n.mix((pup, "Result"), (c4, 2), (0.003, 0.002, 0.002, 1.0))
        # Sclera: warm off-white, faint veins, pinker and greyer away from the iris.
        veins = n.new("ShaderNodeTexNoise", Scale=22.0, Detail=10.0, Roughness=0.7, Vector=obj, _noise_type="RIDGED_MULTIFRACTAL")
        vmask = n.new("ShaderNodeMapRange", Value=(veins, "Fac"), **{"From Min": 0.72, "From Max": 1.0, "To Min": 0.0, "To Max": 0.55})
        edge = n.new("ShaderNodeMapRange", Value=(y, "Value"), **{"From Min": 0.2, "From Max": 1.0, "To Min": 1.0, "To Max": 0.0})
        vm = n.math("MULTIPLY", (vmask, "Result"), (edge, "Result"))
        white = n.mix((edge, "Result"), _lin("#c9bcae"), _lin("#a88c7f"))
        scl = n.mix((vm, "Value"), (white, 2), _lin("#a8453c"))
        # Iris region: inside the limbus, on the front.
        inside = n.new("ShaderNodeMapRange", Value=(rn, "Value"), **{"From Min": 0.97, "From Max": 1.03, "To Min": 1.0, "To Max": 0.0})
        mask = n.math("MULTIPLY", (inside, "Result"), (front, "Result"))
        col = n.mix((mask, "Value"), (scl, 2), (iris_col, 2))
        bump = n.bump((fib, "Fac"), strength=0.3, distance=0.0002)
        n.bsdf(
            **{
                "Base Color": (col, 2),
                "Roughness": 0.35,
                "Subsurface Weight": 0.25,
                "Subsurface Radius": (1.0, 0.5, 0.35),
                "Subsurface Scale": 0.001,
                "Specular IOR Level": 0.3,
                "Normal": (bump, "Normal"),
            }
        )
        return n.mat

    return cached(("eye", iris_hex, seed), build)


def cornea():
    def build():
        n = Nodes("cornea")
        glass = n.new("ShaderNodeBsdfGlass", IOR=1.376, Roughness=0.0)
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
        pink = (min(1.0, base[0] * 1.6 + 0.12), base[1] * 0.9 + 0.03, base[2] * 0.9 + 0.03, 1.0)
        n.bsdf(**{"Base Color": pink, "Roughness": 0.15, "Subsurface Weight": 0.6, "Subsurface Radius": (1.0, 0.3, 0.2), "Subsurface Scale": 0.002})
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


def cloth(color, kind="wool", stripe=None, stripe_at=0.0, stripe_w=0.0, name="cloth"):
    """Hand-woven wool or linen dyed with natural dyes. The sheen takes the dye's
    own colour: an untinted sheen reflects the light's colour and greys the dye.
    Optional woven stripes (clavi) along the object's X at +/- stripe_at (m)."""

    def build():
        n = Nodes(f"{name}-{kind}-{color}-{stripe}")
        obj = n.coords("Object")
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
        w1 = n.new("ShaderNodeTexWave", Scale=520.0, Distortion=1.5, Detail=1.0, Vector=obj, _bands_direction="X")
        w2 = n.new("ShaderNodeTexWave", Scale=520.0, Distortion=1.5, Detail=1.0, Vector=obj, _bands_direction="Z")
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

    return cached(("pcloth", color, kind, stripe, stripe_at, stripe_w, name), build)


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
