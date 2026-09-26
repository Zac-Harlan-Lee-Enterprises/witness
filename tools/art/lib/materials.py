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
        rnd = n.new("ShaderNodeAttribute", _attribute_name="irand", _attribute_type="GEOMETRY")
        mix = n.mix((geo, "Backfacing"), top, under)
        var = n.mix((rnd, "Fac"), (mix, 2), shade(top, 0.25))
        var.inputs[0].default_value = 0.0
        vr = n.math("MULTIPLY", (rnd, "Fac"), 0.35)
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
        info = n.new("ShaderNodeAttribute", _attribute_name="irand", _attribute_type="GEOMETRY")
        geo = n.new("ShaderNodeNewGeometry")
        sep = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Position"))
        tone = n.ramp((info, "Fac"), [(0.0, "#9a9261"), (0.45, "#bcad78"), (0.8, "#cdbd8a"), (1.0, "#86874f")])
        up = n.new("ShaderNodeMapRange", Value=(sep, "Z"), **{"From Min": 0.0, "From Max": 0.12, "To Min": 0.35, "To Max": 1.0})
        col = n.mix((up, "Result"), shade("#6a6040", 0.0), (tone, "Color"))
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.75, "Subsurface Weight": 0.08})
        return n.mat

    return cached(("grass-blades",), build)


def pebble():
    def build():
        n = Nodes("pebble")
        info = n.new("ShaderNodeAttribute", _attribute_name="irand", _attribute_type="GEOMETRY")
        tone = n.ramp((info, "Fac"), [(0.0, "#7d7262"), (0.4, "#a4957a"), (0.7, "#b5a382"), (1.0, "#8c7058")])
        n.bsdf(**{"Base Color": (tone, "Color"), "Roughness": 0.85})
        return n.mat

    return cached(("pebble",), build)


# ── Places beyond the market: layered ground, terrain, mudbrick, interiors ──
def _mask(n, masks, index):
    """The mask of layer `index` (1-based): channel (index-1) % 3 of image (index-1) // 3."""
    img, ch = masks[(index - 1) // 3], (index - 1) % 3
    key = f"_mask_{img.name}"
    sep = getattr(n, key, None)
    if sep is None:
        t = n.new("ShaderNodeTexImage", Vector=n.coords("UV"), _interpolation="Cubic")
        t.image = img
        sep = n.new("ShaderNodeSeparateColor", Color=(t, "Color"))
        setattr(n, key, sep)
    return (sep, ["Red", "Green", "Blue"][ch])


def _layer_colour(n, L, noises):
    """A ground layer's colour: macro variation, optional ripples, grit and mottling."""
    c = L["color"]
    src = noises["mid" if L.get("scale") == "mid" else "big"]
    out = (n.mix((src, "Fac"), shade(c, -L.get("dark", 0.1)), shade(c, L.get("light", 0.07))), 2)
    if L.get("ripple"):
        rip = n.math("MULTIPLY", (noises["ripple"], "Fac"), L["ripple"])
        out = (n.mix((rip, "Value"), out, shade(c, -0.16)), 2)
    if L.get("grit", 0.3):
        g = n.math("MULTIPLY", (noises["grit"], "Result"), L.get("grit", 0.3))
        out = (n.mix((g, "Value"), out, shade(c, -0.45)), 2)
    if L.get("mottle"):
        mm = n.math("MULTIPLY", (noises["mid"], "Fac"), L["mottle"])
        out = (n.mix((mm, "Value"), out, L.get("mottle_color", shade(c, -0.3))), 2)
    if L.get("streak"):
        # Furrows, ruts or fibres running east-west.
        s = n.math("MULTIPLY", (noises["streak"], "Fac"), L["streak"])
        out = (n.mix((s, "Value"), out, shade(c, -0.3)), 2)
    return out


def ground_surface(name, masks, layers, rock=None, red_mask=None, macro=0.0):
    """The ground of any place, as one material over the whole terrain mesh.

    - `layers[0]` covers everything; each further layer i is blended in by its
      mask (channel (i-1) % 3 of masks[(i-1) // 3], RGB images laid over the
      map). A layer is a dict: color, and optionally dark/light (variation),
      scale ('big' or 'mid' noise), grit, ripple, mottle (+ mottle_color),
      streak, rough.
    - `rock` (a dict: color, strata, dust) turns steep faces into banded
      limestone and marl (bedding by height, cracks, weathering) and settles
      dust on whatever faces up, so hills and cliffs need no other material.
      `red_mask` (an image; its red channel) stains the rock with iron, in
      streaks running down the faces: the red rocks of Adummim.
    """

    def build():
        n = Nodes(name)
        obj = n.coords("Object")
        noises = {
            "big": n.noise(0.35, 4.0, 0.6, obj),
            "mid": n.noise(3.5, 5.0, 0.6, obj),
            "ripple": n.new("ShaderNodeTexWave", Scale=4.5, Distortion=7.0, Detail=2.0, Vector=obj, _bands_direction="DIAGONAL"),
            "streak": n.new("ShaderNodeTexWave", Scale=14.0, Distortion=1.2, Detail=2.0, Vector=obj, _bands_direction="Y"),
        }
        grit = n.new("ShaderNodeTexVoronoi", Scale=70.0, Vector=obj)
        noises["grit"] = n.new("ShaderNodeMapRange", Value=(grit, "Distance"), **{"From Min": 0.0, "From Max": 0.12, "To Min": 1.0, "To Max": 0.0})
        fine = n.noise(40.0, 6.0, 0.7, obj)
        col = _layer_colour(n, layers[0], noises)
        rough = n.new("ShaderNodeValue")
        rough.outputs[0].default_value = layers[0].get("rough", 0.95)
        rough = (rough, 0)
        for i, L in enumerate(layers[1:], start=1):
            fac = _mask(n, masks, i)
            col = (n.mix(fac, col, _layer_colour(n, L, noises)), 2)
            rm = n.new("ShaderNodeMix", _data_type="FLOAT")
            n._in(rm, 0, fac)
            n.nt.links.new(rough[0].outputs[rough[1]], rm.inputs[2])
            rm.inputs[3].default_value = L.get("rough", 0.95)
            rough = (rm, "Result")
        ripb = n.math("MULTIPLY", (noises["ripple"], "Fac"), 0.3)
        height = n.math("ADD", (fine, "Fac"), (ripb, "Value"))
        height = n.math("SUBTRACT", (height, "Value"), (noises["grit"], "Result"))
        if rock:
            geo = n.new("ShaderNodeNewGeometry")
            sepN = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Normal"))
            sepP = n.new("ShaderNodeSeparateXYZ", Vector=obj)
            # Bedding: bands by height, warped so they wander like real strata.
            warp = n.noise(0.45, 3.0, 0.5, obj)
            wz = n.math("MULTIPLY_ADD", (warp, "Fac"), 0.45)
            n._in(wz, 2, (sepP, "Z"))
            comb = n.new("ShaderNodeCombineXYZ")
            n.nt.links.new(wz.outputs["Value"], comb.inputs["Z"])
            band = n.new("ShaderNodeTexWave", Scale=1.1, Distortion=3.0, Detail=2.0, _bands_direction="Z", Vector=(comb, "Vector"))
            # Fine layering: noise squeezed vertically into thin horizontal streaks.
            aniso = n.new("ShaderNodeVectorMath", _operation="MULTIPLY")
            n.link(obj[0], obj[1], aniso, 0)
            aniso.inputs[1].default_value = (0.9, 0.9, 5.0)
            layers_fine = n.noise(1.6, 5.0, 0.6, (aniso, "Vector"))
            # Vertical joints: cells stretched upright.
            vj = n.new("ShaderNodeVectorMath", _operation="MULTIPLY")
            n.link(obj[0], obj[1], vj, 0)
            vj.inputs[1].default_value = (1.0, 1.0, 0.22)
            joints = n.new("ShaderNodeTexVoronoi", Scale=1.8, Vector=(vj, "Vector"), _feature="DISTANCE_TO_EDGE")
            joint = n.new("ShaderNodeMapRange", Value=(joints, "Distance"), **{"From Min": 0.0, "From Max": 0.018, "To Min": 0.8, "To Max": 0.0})
            big = n.noise(0.8, 4.0, 0.6, obj)
            cracks = n.new("ShaderNodeTexVoronoi", Scale=1.6, Vector=obj, _feature="DISTANCE_TO_EDGE")
            crack = n.new("ShaderNodeMapRange", Value=(cracks, "Distance"), **{"From Min": 0.0, "From Max": 0.03, "To Min": 0.14, "To Max": 0.0})
            bandf = n.math("MULTIPLY", (band, "Fac"), 0.55)
            rc = n.mix((bandf, "Value"), shade(rock["color"], 0.04), rock["strata"])
            lf = n.math("MULTIPLY", (layers_fine, "Fac"), 0.4)
            rc = n.mix((lf, "Value"), (rc, 2), shade(rock["strata"], -0.2), "MULTIPLY")
            rw = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.4, "From Max": 0.75, "To Min": 0.0, "To Max": 0.45})
            rc = n.mix((rw, "Result"), (rc, 2), shade(rock["color"], -0.3))
            rocko = (rc, 2)
            if red_mask is not None:
                rt = n.new("ShaderNodeTexImage", Vector=n.coords("UV"), _interpolation="Cubic")
                rt.image = red_mask
                rsep = n.new("ShaderNodeSeparateColor", Color=(rt, "Color"))
                streak = n.new("ShaderNodeTexWave", Scale=3.0, Distortion=10.0, Detail=4.0, _bands_direction="X", Vector=obj)
                sm = n.new("ShaderNodeMapRange", Value=(streak, "Fac"), **{"From Min": 0.2, "From Max": 0.8, "To Min": 0.15, "To Max": 0.75})
                patch = n.noise(1.4, 3.0, 0.6, obj)
                pm = n.new("ShaderNodeMapRange", Value=(patch, "Fac"), **{"From Min": 0.35, "From Max": 0.65, "To Min": 0.3, "To Max": 1.0})
                rs = n.math("MULTIPLY", (rsep, "Red"), (sm, "Result"))
                rs = n.math("MULTIPLY", (rs, "Value"), (pm, "Result"))
                redc = n.mix((band, "Fac"), rock.get("red", "#a0583c"), shade(rock.get("red", "#a0583c"), -0.28))
                rocko = (n.mix((rs, "Value"), rocko, (redc, 2)), 2)
            jb = n.math("MULTIPLY", (joint, "Result"), 0.25)
            cj0 = n.math("MAXIMUM", (crack, "Result"), (jb, "Value"))
            steepc = n.new("ShaderNodeMapRange", Value=(sepN, "Z"), **{"From Min": 0.4, "From Max": 0.62, "To Min": 1.0, "To Max": 0.0})
            cj = n.math("MULTIPLY", (cj0, "Value"), (steepc, "Result"))
            rocko = (n.mix((cj, "Value"), rocko, shade(rock["strata"], -0.62)), 2)
            # Up-facing: the ground layers (dust, gravel, soil); steep: bare rock.
            upn = n.math("MULTIPLY_ADD", (noises["mid"], "Fac"), 0.22)
            upn.inputs[2].default_value = -0.11
            ups = n.math("ADD", (sepN, "Z"), (upn, "Value"))
            up = n.new("ShaderNodeMapRange", Value=(ups, "Value"), **{"From Min": 0.66, "From Max": 0.84, "To Min": 0.0, "To Max": 1.0})
            col = (n.mix((up, "Result"), rocko, col), 2)
            lfs = n.math("MULTIPLY", (layers_fine, "Fac"), 0.6)
            height = n.math("ADD", (height, "Value"), (lfs, "Value"))
            steep = n.new("ShaderNodeMapRange", Value=(sepN, "Z"), **{"From Min": 0.35, "From Max": 0.55, "To Min": 1.0, "To Max": 0.0})
            cr = n.math("MULTIPLY", (cj, "Value"), (steep, "Result"))
            height = n.math("SUBTRACT", (height, "Value"), (cr, "Value"))
        # Desert pavement: lighter stone chips among the grit.
        chips = n.new("ShaderNodeTexVoronoi", Scale=26.0, Vector=obj, Randomness=1.0)
        chip = n.new("ShaderNodeMapRange", Value=(chips, "Distance"), **{"From Min": 0.05, "From Max": 0.16, "To Min": 1.0, "To Max": 0.0})
        chipc = n.math("MULTIPLY", (chip, "Result"), layers[0].get("chips", 0.0))
        col = (n.mix((chipc, "Value"), col, shade(layers[0]["color"], 0.12)), 2)
        height = n.math("ADD", (height, "Value"), (chipc, "Value"))
        if macro:
            big = n.noise(0.07, 3.0, 0.55, obj)
            warm = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.52, "From Max": 0.68, "To Min": 0.0, "To Max": macro})
            grey = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.48, "From Max": 0.32, "To Min": 0.0, "To Max": macro * 0.8})
            col = (n.mix((warm, "Result"), col, "#c29a70", "MULTIPLY"), 2)
            col = (n.mix((grey, "Result"), col, "#b4ada2"), 2)
        c5 = n.mix((fine, "Fac"), col, shade(layers[0]["color"], -0.25), "MULTIPLY")
        c5.inputs[0].default_value = 0.2
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.25, _samples=8, _only_local=False)
        grime = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.45, "To Max": 0.0})
        c6 = n.mix((grime, "Result"), (c5, 2), shade(layers[0]["color"], -0.5))
        bump = n.bump((height, "Value"), strength=0.32, distance=0.008)
        n.bsdf(**{"Base Color": (c6, 2), "Roughness": rough, "Specular IOR Level": 0.2, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("ground-surface", name), build)


def rock(color="#bcae90", name=None, lichen=0.0, red=0.0):
    """Loose limestone and chert: blocky, weathered grey-cream with fresher,
    paler broken edges, a darker brown patina of desert varnish on faces
    turned to the sky, fine pitting, grime in the hollows, and spots of
    grey-green and orange lichen or iron staining if asked."""

    def build():
        n = Nodes(name or f"rock-{color}-{lichen}-{red}")
        obj = n.coords()
        geo = n.new("ShaderNodeNewGeometry")
        sepN = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Normal"))
        rnd = n.new("ShaderNodeObjectInfo")
        attr = _random_attr(n)
        big = n.noise(2.4, 4.0, 0.6, obj)
        mid = n.noise(9.0, 5.0, 0.6, obj)
        fine = n.noise(55.0, 6.0, 0.7, obj)
        pits = n.new("ShaderNodeTexVoronoi", Scale=85.0, Vector=obj)
        irand = n.new("ShaderNodeAttribute", _attribute_name="irand", _attribute_type="GEOMETRY")
        rsum = n.math("ADD", (rnd, "Random"), (attr, "Fac"))
        rsum = n.math("ADD", (rsum, "Value"), (irand, "Fac"))
        rfr = n.math("FRACT", (rsum, "Value"))
        # Limestone greys and creams, with the odd brown or near-black chert.
        tone = n.ramp(
            (rfr, "Value"),
            [(0.0, shade(color, -0.2)), (0.35, color), (0.62, _toward(color, "#b3ada2", 0.5)), (0.8, shade(color, 0.06)), (0.9, "#8a6a4e"), (1.0, "#4a4036")],
        )
        tone.color_ramp.interpolation = "CONSTANT"
        w = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.42, "From Max": 0.72, "To Min": 0.0, "To Max": 0.5})
        out = (n.mix((w, "Result"), (tone, "Color"), shade(color, -0.3)), 2)
        mm = n.math("MULTIPLY", (mid, "Fac"), 0.35)
        out = (n.mix((mm, "Value"), out, shade(color, -0.2), "MULTIPLY"), 2)
        # Desert varnish on what faces up.
        up = n.new("ShaderNodeMapRange", Value=(sepN, "Z"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.0, "To Max": 0.42})
        vn = n.math("MULTIPLY", (up, "Result"), (big, "Fac"))
        vn2 = n.math("MULTIPLY", (vn, "Value"), 1.6, clamp=True)
        out = (n.mix((vn2, "Value"), out, "#8c7658"), 2)
        # Fresh, paler rims on sharp edges.
        edge = n.new("ShaderNodeMapRange", Value=(geo, "Pointiness"), **{"From Min": 0.52, "From Max": 0.62, "To Min": 0.0, "To Max": 0.5})
        out = (n.mix((edge, "Result"), out, _toward(color, "#e8e0cc", 0.5)), 2)
        if red > 0:
            rm = n.new("ShaderNodeMapRange", Value=(mid, "Fac"), **{"From Min": 0.35, "From Max": 0.6, "To Min": 0.0, "To Max": red * 0.8})
            out = (n.mix((rm, "Result"), out, "#98705a"), 2)
        if lichen > 0:
            li = n.noise(14.0, 5.0, 0.7, obj)
            lm = n.new("ShaderNodeMapRange", Value=(li, "Fac"), **{"From Min": 0.63, "From Max": 0.68, "To Min": 0.0, "To Max": lichen})
            lc = n.mix((mid, "Fac"), "#8f8c6a", "#b8903e")
            out = (n.mix((lm, "Result"), out, (lc, 2)), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.08, _samples=8, _only_local=False)
        grime = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.55, "To Max": 0.0})
        out = (n.mix((grime, "Result"), out, shade(color, -0.62)), 2)
        h = n.math("ADD", (fine, "Fac"), (pits, "Distance"))
        h2 = n.math("MULTIPLY_ADD", (mid, "Fac"), 0.4)
        n._in(h2, 2, (h, "Value"))
        bump = n.bump((h2, "Value"), strength=0.55, distance=0.01)
        n.bsdf(**{"Base Color": out, "Roughness": 0.88, "Specular IOR Level": 0.28, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("rock", color, name, lichen, red), build)


def mudbrick(color="#a8845c", plaster="#bf9f76", name=None, plastered=0.55):
    """Sun-dried mudbrick laid in courses with mud mortar, partly rendered
    over with mud plaster that has flaked away in patches, rain-streaked and
    darker and damp toward the ground. Bricks follow the wall in object
    space, so walls facing either axis get courses."""

    def build():
        n = Nodes(name or f"mudbrick-{color}-{plastered}")
        obj = n.coords()
        rnd = n.new("ShaderNodeObjectInfo")
        sepP = n.new("ShaderNodeSeparateXYZ", Vector=obj)
        comb = n.new("ShaderNodeCombineXYZ")
        xy = n.math("ADD", (sepP, "X"), (sepP, "Y"))
        n.nt.links.new(xy.outputs["Value"], comb.inputs["X"])
        n.nt.links.new(sepP.outputs["Z"], comb.inputs["Y"])
        brick = n.new(
            "ShaderNodeTexBrick",
            Vector=(comb, "Vector"),
            Color1=shade(color, 0.06),
            Color2=shade(color, -0.1),
            Mortar=shade(color, -0.3),
            Scale=1.0,
            **{"Mortar Size": 0.012, "Mortar Smooth": 0.4, "Bias": 0.0, "Brick Width": 0.42, "Row Height": 0.12},
        )
        big = n.noise(1.1, 4.0, 0.6, obj)
        mid = n.noise(6.0, 5.0, 0.6, obj)
        fine = n.noise(60.0, 5.0, 0.7, obj)
        lo = 0.72 - plastered * 0.45
        pm = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": lo, "From Max": lo + 0.035, "To Min": 1.0, "To Max": 0.0})
        pl = n.mix((mid, "Fac"), shade(plaster, -0.09), shade(plaster, 0.05))
        col = n.mix((pm, "Result"), (brick, "Color"), (pl, 2))
        streak = n.new("ShaderNodeTexWave", Scale=5.0, Distortion=7.0, Detail=3.0, _bands_direction="X", Vector=obj)
        st = n.math("MULTIPLY", (streak, "Fac"), 0.16)
        col = n.mix((st, "Value"), (col, 2), shade(color, -0.3))
        foot = n.new("ShaderNodeMapRange", Value=(sepP, "Z"), **{"From Min": 0.0, "From Max": 0.3, "To Min": 0.4, "To Max": 0.0})
        col = n.mix((foot, "Result"), (col, 2), shade(color, -0.42))
        tone = n.math("MULTIPLY", (rnd, "Random"), 0.12)
        col = n.mix((tone, "Value"), (col, 2), shade(color, -0.2))
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.08, _samples=8, _only_local=False)
        grime = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.35, "From Max": 0.95, "To Min": 0.5, "To Max": 0.0})
        col = n.mix((grime, "Result"), (col, 2), shade(color, -0.52))
        hb = n.math("MULTIPLY", (brick, "Fac"), (pm, "Result"))
        h = n.math("SUBTRACT", (fine, "Fac"), (hb, "Value"))
        h2 = n.math("ADD", (h, "Value"), (pm, "Result"))
        bump = n.bump((h2, "Value"), strength=0.4, distance=0.012)
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.94, "Specular IOR Level": 0.2, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("mudbrick", color, plaster, name, plastered), build)


def lime_plaster(color="#ddd0b4", name=None, soot=0.0, grime=0.5):
    """Lime plaster smoothed by hand: a little uneven, hairline cracks, worn
    and grubby low down, and sooty toward the top (smoke from the oven and
    the lamp) when `soot` > 0. Heights are object Z in tiles."""

    def build():
        n = Nodes(name or f"lime-{color}-{soot}")
        obj = n.coords()
        sepP = n.new("ShaderNodeSeparateXYZ", Vector=obj)
        big = n.noise(0.8, 5.0, 0.6, obj)
        mid = n.noise(5.0, 5.0, 0.6, obj)
        fine = n.noise(70.0, 4.0, 0.6, obj)
        cracks = n.new("ShaderNodeTexVoronoi", Scale=1.8, Vector=obj, _feature="DISTANCE_TO_EDGE")
        crack = n.new("ShaderNodeMapRange", Value=(cracks, "Distance"), **{"From Min": 0.0, "From Max": 0.004, "To Min": 0.45, "To Max": 0.0})
        base = n.mix((big, "Fac"), shade(color, -0.1), shade(color, 0.04))
        col = n.mix((mid, "Fac"), (base, 2), shade(color, -0.16), "MULTIPLY")
        col.inputs[0].default_value = 0.25
        out = (n.mix((crack, "Result"), (col, 2), shade(color, -0.45)), 2)
        if soot > 0:
            s = n.new("ShaderNodeMapRange", Value=(sepP, "Z"), **{"From Min": 1.0, "From Max": 2.6, "To Min": 0.0, "To Max": soot})
            sn = n.math("MULTIPLY", (s, "Result"), (big, "Fac"))
            sn2 = n.math("MULTIPLY", (sn, "Value"), 1.6, clamp=True)
            out = (n.mix((sn2, "Value"), out, "#3d3228"), 2)
        foot = n.new("ShaderNodeMapRange", Value=(sepP, "Z"), **{"From Min": 0.0, "From Max": 0.45, "To Min": 0.35, "To Max": 0.0})
        out = (n.mix((foot, "Result"), out, shade(color, -0.38)), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.3, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": grime, "To Max": 0.0})
        out = (n.mix((g, "Result"), out, shade(color, -0.5)), 2)
        h = n.math("SUBTRACT", (mid, "Fac"), (crack, "Result"))
        h2 = n.math("ADD", (h, "Value"), (fine, "Fac"))
        bump = n.bump((h2, "Value"), strength=0.18, distance=0.01)
        n.bsdf(**{"Base Color": out, "Roughness": 0.9, "Specular IOR Level": 0.25, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("lime", color, name, soot, grime), build)


def thatch(color="#9c8454", name=None):
    """A roof of palm fronds and reeds laid over beams and packed with mud:
    long straw-coloured streaks, sun-bleached, darker mud between."""

    def build():
        n = Nodes(name or f"thatch-{color}")
        obj = n.coords()
        streak = n.new("ShaderNodeTexWave", Scale=26.0, Distortion=4.0, Detail=5.0, Vector=obj, _bands_direction="Y")
        streak2 = n.new("ShaderNodeTexWave", Scale=11.0, Distortion=9.0, Detail=3.0, Vector=obj, _bands_direction="Y")
        big = n.noise(1.4, 4.0, 0.6, obj)
        mud = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.55, "From Max": 0.7, "To Min": 0.0, "To Max": 0.6})
        col = n.mix((streak, "Fac"), shade(color, -0.3), shade(color, 0.18))
        col2 = n.mix((streak2, "Fac"), (col, 2), shade(color, -0.2), "MULTIPLY")
        col2.inputs[0].default_value = 0.3
        col3 = n.mix((mud, "Result"), (col2, 2), "#8a6c4c")
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.1, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.5, "To Max": 0.0})
        col4 = n.mix((g, "Result"), (col3, 2), shade(color, -0.6))
        h = n.math("ADD", (streak, "Fac"), (streak2, "Fac"))
        bump = n.bump((h, "Value"), strength=0.6, distance=0.01)
        n.bsdf(**{"Base Color": (col4, 2), "Roughness": 0.92, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("thatch", color, name), build)


def frond(color="#5a6a36", dry="#a8955c"):
    """Date palm leaflets: waxy grey-green, yellowing on the oldest fronds
    (per-instance random), paler beneath, a little translucent in the sun."""

    def build():
        n = Nodes(f"frond-{color}")
        info = _random_attr(n)
        geo = n.new("ShaderNodeNewGeometry")
        tone = n.ramp((info, "Fac"), [(0.0, shade(color, -0.14)), (0.55, color), (0.8, shade(color, 0.1)), (0.92, dry), (1.0, shade(dry, -0.25))])
        back = n.mix((geo, "Backfacing"), (tone, "Color"), shade(color, 0.2))
        n.bsdf(
            **{
                "Base Color": (back, 2),
                "Roughness": 0.48,
                "Specular IOR Level": 0.35,
                "Subsurface Weight": 0.12,
                "Subsurface Radius": (0.3, 0.5, 0.1),
            }
        )
        return n.mat

    return cached(("frond", color, dry), build)


def palm_trunk(color="#6e5a44"):
    """A date palm's trunk: the stubs of old leaf bases in rings, fibrous and
    grey-brown."""

    def build():
        n = Nodes(f"palmtrunk-{color}")
        obj = n.coords()
        sepP = n.new("ShaderNodeSeparateXYZ", Vector=obj)
        rings = n.new("ShaderNodeTexWave", Scale=4.0, Distortion=1.5, Detail=2.0, _wave_profile="SAW", _bands_direction="Z", Vector=obj)
        cells = n.new("ShaderNodeTexVoronoi", Scale=16.0, Vector=obj, _feature="DISTANCE_TO_EDGE")
        stub = n.new("ShaderNodeMapRange", Value=(cells, "Distance"), **{"From Min": 0.0, "From Max": 0.07, "To Min": 0.0, "To Max": 1.0})
        fib = n.new("ShaderNodeTexWave", Scale=60.0, Distortion=3.0, Detail=4.0, Vector=obj, _bands_direction="Z")
        h = n.math("MULTIPLY", (rings, "Fac"), (stub, "Result"))
        col = n.mix((h, "Value"), shade(color, -0.5), shade(color, 0.14))
        fm = n.math("MULTIPLY", (fib, "Fac"), 0.22)
        col = n.mix((fm, "Value"), (col, 2), "#a8977a")
        _ = sepP
        h2 = n.math("ADD", (h, "Value"), (fib, "Fac"))
        bump = n.bump((h2, "Value"), strength=0.85, distance=0.02)
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.95, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("palmtrunk", color), build)


def pool_water(tint="#6f8a70", deep="#3f6a5c"):
    """Spring water: clear and a little green, darker with depth (absorption
    in the water body), reflecting the sky, with fine wind ripples."""

    def build():
        n = Nodes("pool-water")
        obj = n.coords()
        r1 = n.noise(16.0, 3.0, 0.5, obj)
        r2 = n.new("ShaderNodeTexWave", Scale=7.0, Distortion=4.0, Detail=3.0, Vector=obj, _bands_direction="DIAGONAL")
        h = n.math("ADD", (r1, "Fac"), (r2, "Fac"))
        bump = n.bump((h, "Value"), strength=0.06, distance=0.01)
        n.bsdf(
            **{
                "Base Color": hex_rgb(tint),
                "Roughness": 0.03,
                "IOR": 1.333,
                "Transmission Weight": 0.95,
                "Specular IOR Level": 0.5,
                "Normal": (bump, "Normal"),
            }
        )
        vol = n.new("ShaderNodeVolumeAbsorption", Color=hex_rgb(deep), Density=0.55)
        n.link(vol, "Volume", n.out, "Volume")
        return n.mat

    return cached(("pool-water", tint, deep), build)


def textile(colors, name, weave=180.0, band=0.1, border=None):
    """A woven textile (a rug, mat, blanket or bedroll): bands of natural dyes
    across the weft, an optional border, the weave as fine bump, and fibre
    sheen tinted by the dye."""

    def build():
        n = Nodes(name)
        gen = n.coords("Generated")
        obj = n.coords("Object")
        sep = n.new("ShaderNodeSeparateXYZ", Vector=gen)
        scaled = n.math("MULTIPLY", (sep, "Y"), 1.0 / band)
        idx = n.math("FLOOR", (scaled, "Value"))
        k = float(len(colors))
        idxm = n.math("MODULO", (idx, "Value"), k)
        idxn = n.math("DIVIDE", (idxm, "Value"), k)
        rmp = n.new("ShaderNodeValToRGB")
        n.link(idxn, "Value", rmp, "Fac")
        rmp.color_ramp.interpolation = "CONSTANT"
        els = rmp.color_ramp.elements
        while len(els) < len(colors):
            els.new(0.5)
        for i, (el, c) in enumerate(zip(els, colors)):
            el.position = i / k
            el.color = hex_rgb(c)
        out = (rmp, "Color")
        if border:
            ex = n.math("SUBTRACT", (sep, "X"), 0.5)
            ex = n.math("ABSOLUTE", (ex, "Value"))
            bx = n.math("GREATER_THAN", (ex, "Value"), 0.42)
            out = (n.mix((bx, "Value"), out, border), 2)
        fade = n.noise(2.5, 3.0, 0.5, obj)
        fm = n.math("MULTIPLY", (fade, "Fac"), 0.2)
        out = (n.mix((fm, "Value"), out, "#c9b996"), 2)
        w1 = n.new("ShaderNodeTexWave", Scale=weave, Distortion=1.0, Vector=obj)
        w2 = n.new("ShaderNodeTexWave", Scale=weave, Distortion=1.0, Vector=obj, _bands_direction="Y")
        s = n.math("MULTIPLY", (w1, "Fac"), (w2, "Fac"))
        sm = n.math("MULTIPLY", (s, "Value"), 0.25)
        out2 = n.mix((sm, "Value"), out, "#2a2018", "MULTIPLY")
        bump = n.bump((s, "Value"), strength=0.3, distance=0.003)
        n.bsdf(**{"Base Color": (out2, 2), "Roughness": 0.92, "Sheen Weight": 0.2, "Sheen Tint": (out2, 2), "Normal": (bump, "Normal")})
        return n.mat

    return cached(("textile", tuple(colors), name, weave, band, border), build)


def mud():
    """Flood mud drying out: dark and glossy where still damp, paler and
    cracked into curling plates toward the edges."""

    def build():
        n = Nodes("mud")
        obj = n.coords()
        cells = n.new("ShaderNodeTexVoronoi", Scale=9.0, Vector=obj, _feature="DISTANCE_TO_EDGE")
        crack = n.new("ShaderNodeMapRange", Value=(cells, "Distance"), **{"From Min": 0.0, "From Max": 0.025, "To Min": 1.0, "To Max": 0.0})
        dry = n.noise(2.5, 4.0, 0.6, obj)
        dm = n.new("ShaderNodeMapRange", Value=(dry, "Fac"), **{"From Min": 0.45, "From Max": 0.6, "To Min": 0.0, "To Max": 1.0})
        col = n.mix((dm, "Result"), "#4a3c2c", "#8c7658")
        cr = n.math("MULTIPLY", (crack, "Result"), (dm, "Result"))
        col2 = n.mix((cr, "Value"), (col, 2), "#2e261e")
        rough = n.new("ShaderNodeMapRange", Value=(dm, "Result"), **{"From Min": 0.0, "From Max": 1.0, "To Min": 0.25, "To Max": 0.85})
        bump = n.bump((cr, "Value"), strength=0.6, distance=0.01)
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": (rough, "Result"), "Specular IOR Level": 0.45, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("mud",), build)


def grass_blades_green():
    """Watered grass and weeds: fresh green to olive, a few going to seed."""

    def build():
        n = Nodes("grass-green")
        info = n.new("ShaderNodeAttribute", _attribute_name="irand", _attribute_type="GEOMETRY")
        geo = n.new("ShaderNodeNewGeometry")
        sep = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Position"))
        tone = n.ramp((info, "Fac"), [(0.0, "#56682e"), (0.45, "#6f7f36"), (0.8, "#8a8c46"), (1.0, "#b0a064")])
        up = n.new("ShaderNodeMapRange", Value=(sep, "Z"), **{"From Min": 0.0, "From Max": 0.14, "To Min": 0.35, "To Max": 1.0})
        col = n.mix((up, "Result"), shade("#3e4a22", 0.0), (tone, "Color"))
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.6, "Subsurface Weight": 0.1, "Subsurface Radius": (0.2, 0.5, 0.1)})
        return n.mat

    return cached(("grass-green",), build)


def glow(color="#ffb060", strength=4.0):
    """A flame or embers: emission only (lamps, the oven's mouth)."""
    return emissive(color, strength)
