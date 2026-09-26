"""Procedural materials (Cycles node trees). No image textures: every
surface is built from noise, cells and waves, so the pipeline needs no
downloaded art and renders the same way every time.

Colours are authored in sRGB hex and converted to linear.
"""
import bpy

from common import hex_rgb

_cache = {}


class Nodes:
    def __init__(self, name):
        self.mat = bpy.data.materials.new(name)
        self.mat.use_nodes = True
        self.nt = self.mat.node_tree
        self.nt.nodes.clear()
        self.out = self.nt.nodes.new("ShaderNodeOutputMaterial")

    def new(self, kind, **inputs):
        n = self.nt.nodes.new(kind)
        for k, v in inputs.items():
            if k.startswith("_"):
                setattr(n, k[1:], v)
            elif isinstance(v, tuple) and len(v) == 2 and hasattr(v[0], "outputs"):
                self.link(v[0], v[1], n, k)
            else:
                n.inputs[k].default_value = v
        return n

    def link(self, a, a_out, b, b_in):
        self.nt.links.new(a.outputs[a_out], b.inputs[b_in])

    def bsdf(self, **inputs):
        b = self.new("ShaderNodeBsdfPrincipled", **inputs)
        self.link(b, "BSDF", self.out, "Surface")
        return b

    def coords(self, kind="Object"):
        c = self.new("ShaderNodeTexCoord")
        return (c, kind)

    def noise(self, scale, detail=4.0, rough=0.55, coord=None, dims="3D"):
        kw = {"Scale": scale, "Detail": detail, "Roughness": rough, "_noise_dimensions": dims}
        if coord:
            kw["Vector"] = coord
        return self.new("ShaderNodeTexNoise", **kw)

    def ramp(self, fac, stops):
        r = self.new("ShaderNodeValToRGB")
        self.link(fac[0], fac[1], r, "Fac")
        els = r.color_ramp.elements
        while len(els) < len(stops):
            els.new(0.5)
        for el, (pos, col) in zip(els, stops):
            el.position = pos
            el.color = hex_rgb(col) if isinstance(col, str) else col
        return r

    def math(self, op, a, b=None, clamp=False):
        m = self.new("ShaderNodeMath", _operation=op, _use_clamp=clamp)
        self._in(m, 0, a)
        if b is not None:
            self._in(m, 1, b)
        return m

    def mix(self, fac, a, b, blend="MIX"):
        m = self.new("ShaderNodeMix", _data_type="RGBA", _blend_type=blend)
        self._in(m, 0, fac)
        self._in(m, 6, a)
        self._in(m, 7, b)
        return m

    def _in(self, node, idx, v):
        if isinstance(v, tuple) and len(v) == 2 and hasattr(v[0], "outputs"):
            self.nt.links.new(v[0].outputs[v[1]], node.inputs[idx])
        elif isinstance(v, str):
            node.inputs[idx].default_value = hex_rgb(v)
        else:
            node.inputs[idx].default_value = v

    def bump(self, height, strength=0.3, distance=0.02, normal=None):
        b = self.new("ShaderNodeBump", Strength=strength, Distance=distance)
        self.link(height[0], height[1], b, "Height")
        if normal is not None:
            self.link(normal[0], normal[1], b, "Normal")
        return b


def cached(key, build):
    mat = _cache.get(key)
    try:
        alive = mat is not None and mat.name is not None
    except ReferenceError:  # removed when the scene was reset
        alive = False
    if not alive:
        _cache[key] = build()
    return _cache[key]


# ── People ─────────────────────────────────────────────────────────────────
def skin(color):
    def build():
        n = Nodes(f"skin-{color}")
        var = n.noise(18.0, 3.0, 0.5, n.coords())
        col = n.mix((var, "Fac"), shade(color, -0.06), shade(color, 0.05))
        n.bsdf(
            **{
                "Base Color": (col, 2),
                "Roughness": 0.52,
                "Subsurface Weight": 0.18,
                "Subsurface Radius": (1.0, 0.4, 0.25),
                "Subsurface Scale": 0.012,
                "Specular IOR Level": 0.35,
            }
        )
        return n.mat

    return cached(("skin", color), build)


def cloth(color, stripe=None, kind="wool", stripe_at=0.12, stripe_w=0.045):
    """Dyed wool or linen, with fine weave, soft fuzz, and optional woven stripes
    (clavi) at `stripe_at` either side of the garment's centre (generated X)."""

    def build():
        n = Nodes(f"cloth-{kind}-{color}-{stripe}")
        gen = n.coords("Generated")
        obj = n.coords("Object")
        blotch = n.noise(6.0, 3.0, 0.5, obj)
        # Real dyes on wool read a little muted in strong sun: blend slightly toward undyed fibre.
        dyed = _toward(color, "#8c8070", 0.12 if kind == "wool" else 0.06)
        base = n.mix((blotch, "Fac"), shade(dyed, -0.1), shade(dyed, 0.05))
        col_out = (base, 2)
        if stripe:
            sep = n.new("ShaderNodeSeparateXYZ", Vector=gen)
            d = n.math("SUBTRACT", (sep, "X"), 0.5)
            d = n.math("ABSOLUTE", (d, "Value"))
            d = n.math("SUBTRACT", (d, "Value"), stripe_at)
            d = n.math("ABSOLUTE", (d, "Value"))
            band = n.math("LESS_THAN", (d, "Value"), stripe_w)
            soft = n.math("MULTIPLY", (band, "Value"), 0.7)
            col = n.mix((soft, "Value"), col_out, _toward(stripe, color, 0.35))
            col_out = (col, 2)
        weave = n.new("ShaderNodeTexWave", Scale=180.0, Distortion=2.0, Detail=1.0, Vector=obj)
        weave2 = n.new(
            "ShaderNodeTexWave", Scale=180.0, Distortion=2.0, Detail=1.0, Vector=obj, _bands_direction="Y"
        )
        wsum = n.math("ADD", (weave, "Fac"), (weave2, "Fac"))
        bump = n.bump((wsum, "Value"), strength=0.12, distance=0.003)
        n.bsdf(
            **{
                "Base Color": col_out,
                "Roughness": 0.88 if kind == "wool" else 0.78,
                # Fibre sheen takes the dye's colour; a white sheen reflects the
                # blue sky over the whole garment and greys every dye.
                "Sheen Weight": 0.14 if kind == "wool" else 0.08,
                "Sheen Roughness": 0.6,
                "Sheen Tint": col_out,
                "Specular IOR Level": 0.25,
                "Normal": (bump, "Normal"),
            }
        )
        return n.mat

    return cached(("cloth", color, stripe, kind, stripe_at), build)


def hair(color):
    def build():
        n = Nodes(f"hair-{color}")
        obj = n.coords()
        strands = n.new("ShaderNodeTexWave", Scale=90.0, Distortion=6.0, Detail=3.0, Vector=obj, _bands_direction="Z")
        col = n.mix((strands, "Fac"), shade(color, -0.25), shade(color, 0.18))
        bump = n.bump((strands, "Fac"), strength=0.35, distance=0.004)
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.66, "Specular IOR Level": 0.28, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("hair", color), build)


def plain(color, roughness=0.6, specular=0.3, name=None):
    def build():
        n = Nodes(name or f"plain-{color}")
        n.bsdf(**{"Base Color": hex_rgb(color), "Roughness": roughness, "Specular IOR Level": specular})
        return n.mat

    return cached(("plain", color, roughness, specular), build)


def leather(color="#5e3d24"):
    def build():
        n = Nodes(f"leather-{color}")
        v = n.noise(40.0, 6.0, 0.6, n.coords())
        col = n.mix((v, "Fac"), shade(color, -0.12), shade(color, 0.08))
        bump = n.bump((v, "Fac"), strength=0.15, distance=0.003)
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.62, "Specular IOR Level": 0.4, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("leather", color), build)


def wood(color="#7a5634", scale=6.0):
    def build():
        n = Nodes(f"wood-{color}")
        obj = n.coords()
        grain = n.new("ShaderNodeTexWave", Scale=scale, Distortion=8.0, Detail=4.0, Vector=obj, _bands_direction="Z")
        v = n.noise(12.0, 4.0, 0.6, obj)
        col = n.mix((grain, "Fac"), shade(color, -0.22), shade(color, 0.12))
        col2 = n.mix((v, "Fac"), (col, 2), shade(color, -0.3), "MULTIPLY")
        col2.inputs[0].default_value = 0.25
        bump = n.bump((grain, "Fac"), strength=0.25, distance=0.004)
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": 0.75, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("wood", color, scale), build)


def terracotta(color="#b06c46", dusty=0.4):
    def build():
        n = Nodes(f"clay-{color}")
        obj = n.coords()
        v = n.noise(9.0, 5.0, 0.6, obj)
        col = n.mix((v, "Fac"), shade(color, -0.12), shade(color, 0.08))
        # Dust settles on the lower part.
        sep = n.new("ShaderNodeSeparateXYZ", Vector=obj)
        dust = n.new("ShaderNodeMapRange", Value=(sep, "Z"), **{"From Min": 0.0, "From Max": 0.25, "To Min": dusty, "To Max": 0.0})
        col2 = n.mix((dust, "Result"), (col, 2), "#cdbb9c")
        bump = n.bump((v, "Fac"), strength=0.2, distance=0.004)
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": 0.82, "Specular IOR Level": 0.3, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("clay", color, dusty), build)


def straw(color="#b89660"):
    def build():
        n = Nodes(f"straw-{color}")
        obj = n.coords()
        weave = n.new("ShaderNodeTexWave", Scale=60.0, Distortion=1.0, Detail=1.0, Vector=obj, _bands_direction="Z")
        weave2 = n.new("ShaderNodeTexWave", Scale=40.0, Distortion=1.0, Detail=1.0, Vector=obj, _wave_type="RINGS")
        s = n.math("MULTIPLY", (weave, "Fac"), (weave2, "Fac"))
        col = n.mix((s, "Value"), shade(color, -0.3), shade(color, 0.12))
        bump = n.bump((s, "Value"), strength=0.5, distance=0.006)
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.8, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("straw", color), build)


def _toward(a, b, t):
    """Blend sRGB hex `a` toward `b` by t; returns hex."""
    ha, hb = a.lstrip("#"), b.lstrip("#")
    ca = [int(ha[i : i + 2], 16) for i in (0, 2, 4)]
    cb = [int(hb[i : i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{int(round(x + (y - x) * t)):02x}" for x, y in zip(ca, cb))


def shade(hexcol, amount):
    """Lighten (+) or darken (−) an sRGB hex colour; returns a linear RGBA tuple."""
    h = hexcol.lstrip("#")
    rgb = [int(h[i : i + 2], 16) for i in (0, 2, 4)]
    if amount >= 0:
        rgb = [c + (255 - c) * amount for c in rgb]
    else:
        rgb = [c * (1 + amount) for c in rgb]
    return hex_rgb("#" + "".join(f"{max(0, min(255, int(round(c)))):02x}" for c in rgb))


def shadow_catcher():
    def build():
        n = Nodes("shadow-catcher")
        n.bsdf(**{"Base Color": (0.5, 0.5, 0.5, 1.0), "Roughness": 1.0})
        return n.mat

    return cached(("catcher",), build)


# ── Places ─────────────────────────────────────────────────────────────────
def _random_attr(n, name="rand"):
    """Per-piece random value (a mesh attribute written by the builders)."""
    return n.new("ShaderNodeAttribute", _attribute_name=name, _attribute_type="GEOMETRY")


def limestone(color="#d6c8aa", name="limestone", worn=0.5):
    """Jerusalem limestone: warm cream with grey weathering, pitted, with a
    per-block variation from the builder's `rand` attribute."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        rnd = _random_attr(n)
        big = n.noise(1.6, 4.0, 0.55, obj)
        pits = n.new("ShaderNodeTexVoronoi", Scale=90.0, Vector=obj)
        fine = n.noise(55.0, 6.0, 0.7, obj)
        stone = n.ramp(
            (rnd, "Fac"),
            [(0.0, shade(color, -0.16)), (0.3, _toward(color, "#b9b0a0", 0.35)), (0.6, color), (0.85, _toward(color, "#d8b89a", 0.3)), (1.0, shade(color, 0.05))],
        )
        weather = n.mix((big, "Fac"), (stone, "Color"), "#9c9282", "MULTIPLY")
        weather.inputs[0].default_value = 0.0
        w2 = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.45, "From Max": 0.75, "To Min": 0.0, "To Max": worn})
        col = n.mix((w2, "Result"), (stone, "Color"), shade(color, -0.3))
        col2 = n.mix((fine, "Fac"), (col, 2), shade(color, -0.18), "MULTIPLY")
        col2.inputs[0].default_value = 0.25
        # Dust and grime settle where little light and few feet reach (joints, corners).
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.08, _samples=8, _only_local=False)
        grime = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.35, "From Max": 0.95, "To Min": 0.55, "To Max": 0.0})
        col3 = n.mix((grime, "Result"), (col2, 2), shade(color, -0.42))
        h = n.math("ADD", (fine, "Fac"), (pits, "Distance"))
        bump = n.bump((h, "Value"), strength=0.35, distance=0.01)
        n.bsdf(**{"Base Color": (col3, 2), "Roughness": 0.86, "Specular IOR Level": 0.3, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("limestone", color, name, worn), build)


def plaster(color="#cdbd9e", name="plaster"):
    def build():
        n = Nodes(name)
        obj = n.coords()
        big = n.noise(0.9, 5.0, 0.6, obj)
        mid = n.noise(7.0, 5.0, 0.6, obj)
        cracks = n.new("ShaderNodeTexVoronoi", Scale=1.2, Vector=obj, _feature="DISTANCE_TO_EDGE")
        crack = n.new("ShaderNodeMapRange", Value=(cracks, "Distance"), **{"From Min": 0.0, "From Max": 0.006, "To Min": 0.6, "To Max": 0.0})
        base = n.mix((big, "Fac"), shade(color, -0.12), shade(color, 0.05))
        col = n.mix((mid, "Fac"), (base, 2), shade(color, -0.2), "MULTIPLY")
        col.inputs[0].default_value = 0.3
        col2 = n.mix((crack, "Result"), (col, 2), shade(color, -0.45))
        h = n.math("SUBTRACT", (mid, "Fac"), (crack, "Result"))
        bump = n.bump((h, "Value"), strength=0.25, distance=0.01)
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": 0.92, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("plaster", color, name), build)


def ground(splat, colors, name="ground"):
    """The ground: a splat image (R paving bed, G scrub, B worn path, A sand)
    blends earth materials; noise, ripples and grit break up each one."""

    def build():
        n = Nodes(name)
        gen = n.coords("Generated")
        obj = n.coords("Object")
        tex = n.new("ShaderNodeTexImage", Vector=gen, _interpolation="Cubic")
        tex.image = splat
        sep = n.new("ShaderNodeSeparateColor", Color=(tex, "Color"))
        big = n.noise(0.35, 4.0, 0.6, obj)
        mid = n.noise(3.5, 5.0, 0.6, obj)
        fine = n.noise(40.0, 6.0, 0.7, obj)
        ripple = n.new("ShaderNodeTexWave", Scale=9.0, Distortion=6.0, Detail=3.0, Vector=obj, _bands_direction="DIAGONAL")
        grit = n.new("ShaderNodeTexVoronoi", Scale=70.0, Vector=obj)
        sand = n.mix((big, "Fac"), shade(colors["sand"], -0.1), shade(colors["sand"], 0.07))
        sand2 = n.mix((ripple, "Fac"), (sand, 2), shade(colors["sand"], -0.08))
        sand2.inputs[0].default_value = 0.0
        rip = n.math("MULTIPLY", (ripple, "Fac"), 0.18)
        sand3 = n.mix((rip, "Value"), (sand, 2), shade(colors["sand"], -0.15))
        scrub = n.mix((mid, "Fac"), shade(colors["scrub"], -0.14), shade(colors["scrub"], 0.08))
        bed = n.mix((mid, "Fac"), shade(colors["bed"], -0.1), shade(colors["bed"], 0.06))
        path = n.mix((big, "Fac"), shade(colors["path"], -0.05), shade(colors["path"], 0.08))
        c1 = n.mix((sep, "Green"), (sand3, 2), (scrub, 2))
        c2 = n.mix((sep, "Blue"), (c1, 2), (path, 2))
        c3 = n.mix((sep, "Red"), (c2, 2), (bed, 2))
        dark = n.new("ShaderNodeMapRange", Value=(grit, "Distance"), **{"From Min": 0.0, "From Max": 0.12, "To Min": 0.35, "To Max": 0.0})
        c4 = n.mix((dark, "Result"), (c3, 2), shade(colors["sand"], -0.45))
        c5 = n.mix((fine, "Fac"), (c4, 2), shade(colors["sand"], -0.25), "MULTIPLY")
        c5.inputs[0].default_value = 0.22
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.25, _samples=8, _only_local=False)
        grime = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.45, "To Max": 0.0})
        c5b = n.mix((grime, "Result"), (c5, 2), shade(colors["bed"], -0.35))
        h = n.math("ADD", (fine, "Fac"), (ripple, "Fac"))
        h2 = n.math("SUBTRACT", (h, "Value"), (dark, "Result"))
        bump = n.bump((h2, "Value"), strength=0.3, distance=0.006)
        n.bsdf(**{"Base Color": (c5b, 2), "Roughness": 0.95, "Specular IOR Level": 0.2, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("ground", name), build)


def bark(color="#6b5a48"):
    def build():
        n = Nodes(f"bark-{color}")
        obj = n.coords()
        fis = n.new("ShaderNodeTexWave", Scale=14.0, Distortion=14.0, Detail=6.0, Vector=obj, _bands_direction="Z")
        v = n.noise(20.0, 6.0, 0.7, obj)
        col = n.mix((fis, "Fac"), shade(color, -0.4), shade(color, 0.15))
        col2 = n.mix((v, "Fac"), (col, 2), "#8a8478")
        col2.inputs[0].default_value = 0.25
        h = n.math("ADD", (fis, "Fac"), (v, "Fac"))
        bump = n.bump((h, "Value"), strength=0.7, distance=0.02)
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": 0.93, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("bark", color), build)


def leaf(top="#4d5a3a", under="#9aa287"):
    """Olive leaves: dark grey-green above, silvery beneath."""

    def build():
        n = Nodes(f"leaf-{top}")
        geo = n.new("ShaderNodeNewGeometry")
        rnd = n.new("ShaderNodeObjectInfo")
        mix = n.mix((geo, "Backfacing"), top, under)
        var = n.mix((rnd, "Random"), (mix, 2), shade(top, 0.25))
        var.inputs[0].default_value = 0.0
        vr = n.math("MULTIPLY", (rnd, "Random"), 0.35)
        var2 = n.mix((vr, "Value"), (mix, 2), shade(under, 0.1))
        n.bsdf(
            **{
                "Base Color": (var2, 2),
                "Roughness": 0.62,
                "Specular IOR Level": 0.22,
                "Transmission Weight": 0.0,
                "Subsurface Weight": 0.1,
                "Subsurface Radius": (0.2, 0.4, 0.1),
            }
        )
        return n.mat

    return cached(("leaf", top, under), build)


def fabric_stripes(colors, width=0.12, name="awning"):
    """A striped woven cloth (awnings, hangings): bands of faded dyes."""

    def build():
        n = Nodes(name)
        gen = n.coords("Generated")
        sep = n.new("ShaderNodeSeparateXYZ", Vector=gen)
        scaled = n.math("MULTIPLY", (sep, "X"), 1.0 / width)
        band = n.math("FLOOR", (scaled, "Value"))
        idx = n.math("MODULO", (band, "Value"), float(len(colors)))
        rmp = n.new("ShaderNodeValToRGB")
        n.link(idx, "Value", rmp, "Fac")
        rmp.color_ramp.interpolation = "CONSTANT"
        els = rmp.color_ramp.elements
        # Map band index 0..k-1 onto the ramp.
        k = len(colors)
        idxn = n.math("DIVIDE", (idx, "Value"), float(k))
        n.link(idxn, "Value", rmp, "Fac")
        while len(els) < k:
            els.new(0.5)
        for i, (el, c) in enumerate(zip(els, colors)):
            el.position = i / k
            el.color = hex_rgb(c)
        obj = n.coords()
        fade = n.noise(2.0, 3.0, 0.5, obj)
        col = n.mix((fade, "Fac"), (rmp, "Color"), "#d8cbb0")
        col.inputs[0].default_value = 0.0
        faded = n.math("MULTIPLY_ADD", (fade, "Fac"), 0.16)
        faded.inputs[2].default_value = 0.08
        col2 = n.mix((faded, "Value"), (rmp, "Color"), "#cbbc9e")
        weave = n.new("ShaderNodeTexWave", Scale=220.0, Distortion=1.0, Vector=obj)
        bump = n.bump((weave, "Fac"), strength=0.1, distance=0.002)
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": 0.9, "Sheen Weight": 0.3, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("stripes", tuple(colors), width, name), build)


def burlap(color="#a48c64"):
    def build():
        n = Nodes(f"burlap-{color}")
        obj = n.coords()
        w1 = n.new("ShaderNodeTexWave", Scale=120.0, Distortion=1.5, Vector=obj)
        w2 = n.new("ShaderNodeTexWave", Scale=120.0, Distortion=1.5, Vector=obj, _bands_direction="Y")
        s = n.math("MULTIPLY", (w1, "Fac"), (w2, "Fac"))
        v = n.noise(5.0, 4.0, 0.6, obj)
        col = n.mix((v, "Fac"), shade(color, -0.15), shade(color, 0.08))
        col2 = n.mix((s, "Value"), (col, 2), shade(color, -0.3), "MULTIPLY")
        col2.inputs[0].default_value = 0.4
        bump = n.bump((s, "Value"), strength=0.4, distance=0.004)
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": 0.95, "Sheen Weight": 0.3, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("burlap", color), build)


def water():
    def build():
        n = Nodes("water")
        obj = n.coords()
        ripple = n.noise(8.0, 3.0, 0.5, obj)
        bump = n.bump((ripple, "Fac"), strength=0.15, distance=0.01)
        n.bsdf(**{"Base Color": hex_rgb("#2c3a34"), "Roughness": 0.08, "Specular IOR Level": 0.5, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("water",), build)


def emissive(color="#ff8a3a", strength=6.0):
    def build():
        n = Nodes(f"glow-{color}")
        e = n.new("ShaderNodeEmission", Color=hex_rgb(color), Strength=strength)
        n.link(e, "Emission", n.out, "Surface")
        return n.mat

    return cached(("glow", color, strength), build)


def grass_hair(color="#9a9060"):
    def build():
        n = Nodes(f"grass-{color}")
        info = n.new("ShaderNodeHairInfo")
        col = n.mix((info, "Intercept"), shade(color, -0.35), shade(color, 0.18))
        rnd = n.mix((info, "Random"), (col, 2), "#7a8448")
        rnd.inputs[0].default_value = 0.0
        rr = n.math("MULTIPLY", (info, "Random"), 0.45)
        rnd2 = n.mix((rr, "Value"), (col, 2), shade("#6f7a44", 0.0))
        n.bsdf(**{"Base Color": (rnd2, 2), "Roughness": 0.7})
        return n.mat

    return cached(("grasshair", color), build)


def grass_blades():
    """Dry grass: straw to olive, varied per tuft (instance random)."""

    def build():
        n = Nodes("grass-blades")
        info = n.new("ShaderNodeObjectInfo")
        geo = n.new("ShaderNodeNewGeometry")
        sep = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Position"))
        tone = n.ramp((info, "Random"), [(0.0, "#9a9261"), (0.45, "#bcad78"), (0.8, "#cdbd8a"), (1.0, "#86874f")])
        up = n.new("ShaderNodeMapRange", Value=(sep, "Z"), **{"From Min": 0.0, "From Max": 0.12, "To Min": 0.35, "To Max": 1.0})
        col = n.mix((up, "Result"), shade("#6a6040", 0.0), (tone, "Color"))
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.75, "Subsurface Weight": 0.08})
        return n.mat

    return cached(("grass-blades",), build)


def pebble():
    def build():
        n = Nodes("pebble")
        info = n.new("ShaderNodeObjectInfo")
        tone = n.ramp((info, "Random"), [(0.0, "#7d7262"), (0.4, "#a4957a"), (0.7, "#b5a382"), (1.0, "#8c7058")])
        n.bsdf(**{"Base Color": (tone, "Color"), "Roughness": 0.85})
        return n.mat

    return cached(("pebble",), build)
