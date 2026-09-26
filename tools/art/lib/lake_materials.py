"""Materials of the lake shore at Capernaum and its boats (Chapter 2).

Everything is procedural (Cycles node trees built from noise, cells and
waves): the black vesicular basalt of Galilee, lake water with depth colour
and sky reflection, foam where the water laps the shingle, weathered boat
planking, linen nets and sails, rope, salted fish. Colours are sRGB hex.
"""
from common import hex_rgb
from materials import Nodes, _random_attr, _toward, cached, shade


def basalt(color="#3c3a37", name=None, dust=0.35, lichen=0.25, rind="#6e6457", wet_below=None):
    """Galilee basalt: dark grey to near black, pocked with small gas holes
    (vesicles), weathering to a brownish rind; each stone its own tone (the
    builder's `rand` face attribute, or the instance's `irand`); dust settles
    on whatever faces up, grey-green and orange lichen spots old surfaces,
    grime darkens the joints. `wet_below` (a height in Blender Z) darkens
    and glosses everything lower, as stones are at the water's edge."""

    def build():
        n = Nodes(name or f"basalt-{color}-{dust}-{lichen}")
        obj = n.coords()
        geo = n.new("ShaderNodeNewGeometry")
        sepN = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Normal"))
        info = n.new("ShaderNodeObjectInfo")
        attr = _random_attr(n)
        irand = n.new("ShaderNodeAttribute", _attribute_name="irand", _attribute_type="GEOMETRY")
        rsum = n.math("ADD", (info, "Random"), (attr, "Fac"))
        rsum = n.math("ADD", (rsum, "Value"), (irand, "Fac"))
        rfr = n.math("FRACT", (rsum, "Value"))
        tone = n.ramp(
            (rfr, "Value"),
            [(0.0, shade(color, -0.22)), (0.3, color), (0.55, _toward(color, "#55504a", 0.5)), (0.8, shade(color, 0.1)), (0.93, _toward(color, rind, 0.55)), (1.0, shade(color, -0.35))],
        )
        big = n.noise(2.2, 4.0, 0.6, obj)
        mid = n.noise(8.0, 5.0, 0.62, obj)
        fine = n.noise(60.0, 6.0, 0.7, obj)
        # Weathered rind in patches.
        w = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.45, "From Max": 0.75, "To Min": 0.0, "To Max": 0.55})
        out = (n.mix((w, "Result"), (tone, "Color"), rind), 2)
        mm = n.math("MULTIPLY", (mid, "Fac"), 0.3)
        out = (n.mix((mm, "Value"), out, shade(color, -0.3), "MULTIPLY"), 2)
        # Vesicles: small round holes, dark inside.
        ves = n.new("ShaderNodeTexVoronoi", Scale=70.0, Vector=obj)
        vm = n.new("ShaderNodeMapRange", Value=(ves, "Distance"), **{"From Min": 0.0, "From Max": 0.16, "To Min": 1.0, "To Max": 0.0})
        vmask = n.math("MULTIPLY", (vm, "Result"), 0.8)
        out = (n.mix((vmask, "Value"), out, shade(color, -0.6)), 2)
        # Dust on what faces up (the lane's pale earth blows over everything).
        if dust > 0:
            up = n.new("ShaderNodeMapRange", Value=(sepN, "Z"), **{"From Min": 0.35, "From Max": 0.95, "To Min": 0.0, "To Max": dust})
            dn = n.math("MULTIPLY", (up, "Result"), (mid, "Fac"))
            dn = n.math("MULTIPLY", (dn, "Value"), 1.7, clamp=True)
            out = (n.mix((dn, "Value"), out, "#8a7c68"), 2)
        if lichen > 0:
            li = n.noise(11.0, 5.0, 0.7, obj)
            lm = n.new("ShaderNodeMapRange", Value=(li, "Fac"), **{"From Min": 0.64, "From Max": 0.69, "To Min": 0.0, "To Max": lichen})
            lc = n.mix((mid, "Fac"), "#8d8f7c", "#a8743e")
            out = (n.mix((lm, "Result"), out, (lc, 2)), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.1, _samples=8, _only_local=False)
        grime = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.6, "To Max": 0.0})
        out = (n.mix((grime, "Result"), out, shade(color, -0.7)), 2)
        rough = n.new("ShaderNodeValue")
        rough.outputs[0].default_value = 0.82
        rough = (rough, 0)
        if wet_below is not None:
            pos = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Position"))
            wet = n.new("ShaderNodeMapRange", Value=(pos, "Z"), **{"From Min": wet_below - 0.03, "From Max": wet_below + 0.05, "To Min": 1.0, "To Max": 0.0})
            wk = n.math("MULTIPLY", (wet, "Result"), 0.55)
            out = (n.mix((wk, "Value"), out, "#000000", "MULTIPLY"), 2)
            slime = n.new("ShaderNodeMapRange", Value=(pos, "Z"), **{"From Min": wet_below - 0.06, "From Max": wet_below + 0.0, "To Min": 0.5, "To Max": 0.0})
            sm = n.math("MULTIPLY", (slime, "Result"), (mid, "Fac"))
            out = (n.mix((sm, "Value"), out, "#2c3522"), 2)
            rm = n.new("ShaderNodeMapRange", Value=(wet, "Result"), **{"From Min": 0.0, "From Max": 1.0, "To Min": 0.82, "To Max": 0.3})
            rough = (rm, "Result")
        h = n.math("SUBTRACT", (fine, "Fac"), (vmask, "Value"))
        h2 = n.math("MULTIPLY_ADD", (mid, "Fac"), 0.5)
        n._in(h2, 2, (h, "Value"))
        bump = n.bump((h2, "Value"), strength=0.6, distance=0.012)
        n.bsdf(**{"Base Color": out, "Roughness": rough, "Specular IOR Level": 0.38, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("basalt", color, name, dust, lichen, rind, wet_below), build)


def mud_mortar(color="#7a6a57", name="mud-mortar"):
    """Clay and earth packed between the stones of a dry wall."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        big = n.noise(3.0, 4.0, 0.6, obj)
        fine = n.noise(40.0, 5.0, 0.7, obj)
        col = n.mix((big, "Fac"), shade(color, -0.2), shade(color, 0.12))
        col2 = n.mix((fine, "Fac"), (col, 2), shade(color, -0.35), "MULTIPLY")
        col2.inputs[0].default_value = 0.3
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.12, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.65, "To Max": 0.0})
        col3 = n.mix((g, "Result"), (col2, 2), shade(color, -0.7))
        bump = n.bump((fine, "Fac"), strength=0.4, distance=0.008)
        n.bsdf(**{"Base Color": (col3, 2), "Roughness": 0.95, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("mortar", color, name), build)


def lake_water(tint="#e6f3f0", absorb="#a6d2ca", scatter="#6cbcbc", density=0.55, name="lake-water"):
    """Lake water: clear but green-tinted, darker and bluer with depth (the
    water body absorbs red first and scatters a little blue-green light
    back), reflecting the sky, with short wind ripples. The live surface the
    game draws on top adds the moving waves and glints."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        # Short wind ripples running north-south (a westerly), and finer
        # cat's-paws across them.
        stretch = n.new("ShaderNodeVectorMath", _operation="MULTIPLY")
        n.link(obj[0], obj[1], stretch, 0)
        stretch.inputs[1].default_value = (1.0, 2.2, 1.0)
        w1 = n.new("ShaderNodeTexWave", Scale=2.6, Distortion=7.0, Detail=3.0, **{"Detail Scale": 1.5}, Vector=(stretch, "Vector"), _bands_direction="X")
        r1 = n.noise(9.0, 3.0, 0.55, obj)
        r2 = n.noise(26.0, 2.0, 0.5, obj)
        h = n.math("MULTIPLY_ADD", (r1, "Fac"), 0.6)
        n._in(h, 2, (w1, "Fac"))
        h2 = n.math("MULTIPLY_ADD", (r2, "Fac"), 0.25)
        n._in(h2, 2, (h, "Value"))
        bump = n.bump((h2, "Value"), strength=0.12, distance=0.02)
        n.bsdf(
            **{
                "Base Color": hex_rgb(tint),
                "Roughness": 0.035,
                "IOR": 1.333,
                "Transmission Weight": 1.0,
                "Specular IOR Level": 0.5,
                "Normal": (bump, "Normal"),
            }
        )
        # One principled volume: scattering (the water's own blue-green glow)
        # and absorption (red first) in the same closure; the deep bed below
        # adds the colour of the depths.
        vol = n.new(
            "ShaderNodeVolumePrincipled",
            Color=hex_rgb(scatter),
            Density=density,
            Anisotropy=0.3,
            **{"Absorption Color": hex_rgb(absorb)},
        )
        n.link(vol, "Volume", n.out, "Volume")
        return n.mat

    return cached(("lake-water", tint, absorb, scatter, density, name), build)


def foam():
    """White water where small waves break on the shingle: lacy, broken by
    noise, fading at both edges of its band (UV v across the band)."""

    def build():
        n = Nodes("shore-foam")
        obj = n.coords()
        uv = n.coords("UV")
        sep = n.new("ShaderNodeSeparateXYZ", Vector=uv)
        across = n.math("SUBTRACT", 1.0, (n.math("ABSOLUTE", (n.math("SUBTRACT", (n.math("MULTIPLY", (sep, "Y"), 2.0), "Value"), 1.0), "Value")), "Value"))
        edge = n.new("ShaderNodeMapRange", Value=(across, "Value"), **{"From Min": 0.0, "From Max": 0.8, "To Min": 0.0, "To Max": 1.0})
        lace = n.new("ShaderNodeTexVoronoi", Scale=38.0, Vector=obj, _feature="DISTANCE_TO_EDGE")
        lm = n.new("ShaderNodeMapRange", Value=(lace, "Distance"), **{"From Min": 0.0, "From Max": 0.05, "To Min": 1.0, "To Max": 0.15})
        blot = n.noise(5.0, 4.0, 0.6, obj)
        bm = n.new("ShaderNodeMapRange", Value=(blot, "Fac"), **{"From Min": 0.38, "From Max": 0.62, "To Min": 0.0, "To Max": 1.0})
        a = n.math("MULTIPLY", (edge, "Result"), (lm, "Result"))
        a = n.math("MULTIPLY", (a, "Value"), (bm, "Result"))
        a = n.math("MULTIPLY", (a, "Value"), 0.85)
        n.bsdf(**{"Base Color": hex_rgb("#eef2ee"), "Roughness": 0.6, "Alpha": (a, "Value"), "Subsurface Weight": 0.1})
        return n.mat

    return cached(("foam",), build)


def wet_band(color="#1a1a18"):
    """A darkening that lies over the shingle just above the waterline:
    wet pebbles, darker and glossier, fading up the beach (UV v)."""

    def build():
        n = Nodes("wet-shingle")
        uv = n.coords("UV")
        obj = n.coords()
        sep = n.new("ShaderNodeSeparateXYZ", Vector=uv)
        blot = n.noise(3.0, 3.0, 0.6, obj)
        f = n.new("ShaderNodeMapRange", Value=(sep, "Y"), **{"From Min": 0.0, "From Max": 1.0, "To Min": 0.62, "To Max": 0.0})
        a = n.math("MULTIPLY", (f, "Result"), (n.new("ShaderNodeMapRange", Value=(blot, "Fac"), **{"From Min": 0.3, "From Max": 0.7, "To Min": 0.55, "To Max": 1.0}), "Result"))
        n.bsdf(**{"Base Color": hex_rgb(color), "Roughness": 0.25, "Specular IOR Level": 0.5, "Alpha": (a, "Value")})
        return n.mat

    return cached(("wet-band", color), build)


def planks(color="#7c6650", name="deck-planks", along="X", width=0.15, length=1.9, worn=0.35, wet=0.0):
    """Boat planking: planks laid fore and aft with staggered butt joints and
    dark caulked seams, each plank its own tone of weathered cedar, grain
    along it, pegs (treenails) at the ends, worn paler down the middle where
    feet go. `along` is the object axis the planks run on."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        sep = n.new("ShaderNodeSeparateXYZ", Vector=obj)
        a = "X" if along == "X" else "Y"
        b = "Y" if along == "X" else "X"
        comb = n.new("ShaderNodeCombineXYZ")
        n.link(sep, a, comb, "X")
        n.link(sep, b, comb, "Y")
        brick = n.new(
            "ShaderNodeTexBrick",
            Vector=(comb, "Vector"),
            Color1=(1.0, 1.0, 1.0, 1.0),
            Color2=(0.0, 0.0, 0.0, 1.0),
            Mortar=(0.0, 0.0, 0.0, 1.0),
            Scale=1.0,
            **{"Mortar Size": 0.006, "Mortar Smooth": 0.3, "Bias": 0.0, "Brick Width": length, "Row Height": width},
            _offset=0.37,
            _offset_frequency=1,
            _squash_frequency=1,
        )
        # A random value per plank: the brick colour between Color1 and Color2.
        sepc = n.new("ShaderNodeSeparateColor", Color=(brick, "Color"))
        tone = n.ramp((sepc, "Red"), [(0.0, shade(color, -0.2)), (0.35, color), (0.6, _toward(color, "#8a7a68", 0.4)), (0.85, shade(color, 0.12)), (1.0, _toward(color, "#6a4a32", 0.4))])
        grain_v = n.new("ShaderNodeVectorMath", _operation="MULTIPLY")
        n.link(comb, "Vector", grain_v, 0)
        grain_v.inputs[1].default_value = (0.4, 9.0, 1.0)
        grain = n.new("ShaderNodeTexWave", Scale=3.0, Distortion=9.0, Detail=4.0, Vector=(grain_v, "Vector"), _bands_direction="Y")
        g = n.math("MULTIPLY", (grain, "Fac"), 0.28)
        col = (n.mix((g, "Value"), (tone, "Color"), shade(color, -0.35), "MULTIPLY"), 2)
        big = n.noise(1.2, 4.0, 0.6, obj)
        wear = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.4, "From Max": 0.7, "To Min": 0.0, "To Max": worn})
        col = (n.mix((wear, "Result"), col, _toward(color, "#b9ad98", 0.6)), 2)
        # Seams: pitch-dark caulking.
        seam = n.math("SUBTRACT", 1.0, (brick, "Fac"))
        sm = n.math("MULTIPLY", (seam, "Value"), 0.7)
        col = (n.mix((sm, "Value"), col, "#2e2218"), 2)
        # Treenails: small dark round pegs in rows.
        pegs_v = n.new("ShaderNodeVectorMath", _operation="MULTIPLY")
        n.link(comb, "Vector", pegs_v, 0)
        pegs_v.inputs[1].default_value = (1.0 / 0.42, 1.0 / width, 1.0)
        peg = n.new("ShaderNodeTexVoronoi", Scale=1.0, Vector=(pegs_v, "Vector"), Randomness=0.0)
        pm = n.new("ShaderNodeMapRange", Value=(peg, "Distance"), **{"From Min": 0.05, "From Max": 0.09, "To Min": 0.75, "To Max": 0.0})
        col = (n.mix((pm, "Result"), col, "#2a1e14"), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.2, _samples=8, _only_local=False)
        gr = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.55, "To Max": 0.0})
        col = (n.mix((gr, "Result"), col, shade(color, -0.6)), 2)
        rough = 0.7 - 0.45 * wet
        if wet:
            col = (n.mix(wet, col, "#000000", "MULTIPLY"), 2)
            col[0].inputs[0].default_value = wet * 0.45
        h = n.math("SUBTRACT", (grain, "Fac"), (seam, "Value"))
        h = n.math("SUBTRACT", (h, "Value"), (pm, "Result"))
        bump = n.bump((h, "Value"), strength=0.35, distance=0.006)
        n.bsdf(**{"Base Color": col, "Roughness": rough, "Specular IOR Level": 0.32, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("planks", color, name, along, width, length, worn, wet), build)


def hull_paint(color="#5a4432", pitch="#16110d", name="hull"):
    """A hull's outside: weathered planks (strakes) running along the boat,
    edge-joined, each a slightly different tone; blackened with pitch toward
    the waterline and below it, with a pale line of dried lake scum at the
    waterline itself. Needs UVs in metres (u along the boat, v up the
    girth) and the object property `wl_z` (the waterline's height)."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        uv = n.coords("UV")
        geo = n.new("ShaderNodeNewGeometry")
        pos = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Position"))
        sep = n.new("ShaderNodeSeparateXYZ", Vector=uv)
        # Strakes about 0.17 m wide up the girth.
        sv = n.math("MULTIPLY", (sep, "Y"), 1.0 / 0.17)
        idx = n.math("FLOOR", (sv, "Value"))
        frac = n.math("FRACT", (sv, "Value"))
        edge = n.new("ShaderNodeMapRange", Value=(frac, "Value"), **{"From Min": 0.0, "From Max": 0.08, "To Min": 1.0, "To Max": 0.0})
        # A tone per strake (hash of its index).
        h1 = n.math("SINE", (n.math("MULTIPLY", (idx, "Value"), 12.9898), "Value"))
        h2 = n.math("FRACT", (n.math("MULTIPLY", (h1, "Value"), 43758.5453), "Value"))
        tone = n.ramp((h2, "Value"), [(0.0, shade(color, -0.18)), (0.4, color), (0.75, _toward(color, "#7a6a5a", 0.35)), (1.0, shade(color, 0.12))])
        gv = n.new("ShaderNodeCombineXYZ")
        n.link(sep, "X", gv, "X")
        gy = n.math("MULTIPLY", (sep, "Y"), 14.0)
        n.link(gy, "Value", gv, "Y")
        grain = n.new("ShaderNodeTexWave", Scale=2.5, Distortion=8.0, Detail=4.0, _bands_direction="Y", Vector=(gv, "Vector"))
        big = n.noise(1.5, 4.0, 0.6, obj)
        col = (n.mix((big, "Fac"), (tone, "Color"), shade(color, -0.2)), 2)
        col[0].inputs[0].default_value = 0.0
        g = n.math("MULTIPLY", (grain, "Fac"), 0.3)
        col = (n.mix((g, "Value"), (tone, "Color"), shade(color, -0.35), "MULTIPLY"), 2)
        col = (n.mix((edge, "Result"), col, shade(color, -0.6)), 2)
        # Pitch toward the waterline and below, streaked up the planks.
        wl = n.new("ShaderNodeAttribute", _attribute_name="wl_z", _attribute_type="OBJECT")
        rel = n.math("SUBTRACT", (pos, "Z"), (wl, "Fac"))
        streak = n.noise(6.0, 4.0, 0.6, obj)
        pz = n.math("MULTIPLY_ADD", (streak, "Fac"), 0.14)
        n._in(pz, 2, (rel, "Value"))
        pm = n.new("ShaderNodeMapRange", Value=(pz, "Value"), **{"From Min": 0.12, "From Max": 0.34, "To Min": 1.0, "To Max": 0.0})
        col = (n.mix((pm, "Result"), col, pitch), 2)
        scum = n.new("ShaderNodeMapRange", Value=(rel, "Value"), **{"From Min": 0.0, "From Max": 0.04, "To Min": 0.0, "To Max": 1.0})
        scum2 = n.new("ShaderNodeMapRange", Value=(rel, "Value"), **{"From Min": 0.04, "From Max": 0.09, "To Min": 1.0, "To Max": 0.0})
        sc = n.math("MULTIPLY", (scum, "Result"), (scum2, "Result"))
        sc = n.math("MULTIPLY", (sc, "Value"), 0.45)
        col = (n.mix((sc, "Value"), col, "#8c8674"), 2)
        rough = n.new("ShaderNodeMapRange", Value=(pm, "Result"), **{"From Min": 0.0, "From Max": 1.0, "To Min": 0.72, "To Max": 0.38})
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.15, _samples=8, _only_local=False)
        gr = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.5, "To Max": 0.0})
        col = (n.mix((gr, "Result"), col, shade(color, -0.65)), 2)
        hgt = n.math("SUBTRACT", (grain, "Fac"), (edge, "Result"))
        bump = n.bump((hgt, "Value"), strength=0.45, distance=0.006)
        n.bsdf(**{"Base Color": col, "Roughness": (rough, "Result"), "Specular IOR Level": 0.35, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("hull-paint", color, pitch, name), build)


def net(color="#b7ab92", mesh=0.07, thread=0.09, veil=0.22, name="net"):
    """Linen netting: a diamond mesh of knotted thread (`mesh` is the cell
    size, `thread` the fraction of it the thread covers) over a faint veil
    of the fine inner net, darker where it is still damp. Transparent
    between the threads. Needs UVs in metres (u along, v down)."""

    def build():
        n = Nodes(name)
        uv = n.coords("UV")
        obj = n.coords()
        sep = n.new("ShaderNodeSeparateXYZ", Vector=uv)
        s = 1.0 / mesh
        d1 = n.math("MULTIPLY", (n.math("ADD", (sep, "X"), (sep, "Y")), "Value"), s)
        d2 = n.math("MULTIPLY", (n.math("SUBTRACT", (sep, "X"), (sep, "Y")), "Value"), s)

        def line(d):
            f = n.math("FRACT", (d, "Value"))
            c = n.math("ABSOLUTE", (n.math("SUBTRACT", (f, "Value"), 0.5), "Value"))
            return n.new("ShaderNodeMapRange", Value=(c, "Value"), **{"From Min": 0.5 - thread, "From Max": 0.5 - thread * 0.4, "To Min": 0.0, "To Max": 1.0})

        l1 = line(d1)
        l2 = line(d2)
        a = n.math("MAXIMUM", (l1, "Result"), (l2, "Result"))
        blot = n.noise(3.0, 3.0, 0.6, obj)
        v = n.math("MULTIPLY_ADD", (blot, "Fac"), veil)
        v.inputs[2].default_value = veil * 0.3
        alpha = n.math("MAXIMUM", (a, "Value"), (v, "Value"))
        damp = n.new("ShaderNodeMapRange", Value=(blot, "Fac"), **{"From Min": 0.45, "From Max": 0.7, "To Min": 0.0, "To Max": 0.45})
        col = n.mix((damp, "Result"), color, shade(color, -0.45))
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.9, "Sheen Weight": 0.3, "Sheen Tint": (col, 2), "Alpha": (alpha, "Value")})
        return n.mat

    return cached(("net", color, mesh, thread, veil, name), build)


def linen(color="#ddd2b8", name="sail-linen", patches=True):
    """Sailcloth of linen: off-white, weave, stains, sun-faded, with patches
    of newer and older cloth sewn over the worn places (every family's sail
    is known by its patches). Slightly translucent against the light."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        gen = n.coords("Generated")
        big = n.noise(2.0, 4.0, 0.6, obj)
        col = (n.mix((big, "Fac"), shade(color, -0.12), shade(color, 0.04)), 2)
        if patches:
            cells = n.new("ShaderNodeTexVoronoi", Scale=3.2, Vector=gen, _distance="CHEBYCHEV")
            pick = n.new("ShaderNodeMapRange", Value=(cells, "Color"), **{"From Min": 0.8, "From Max": 0.81, "To Min": 0.0, "To Max": 1.0})
            sepc = n.new("ShaderNodeSeparateColor", Color=(cells, "Color"))
            pk = n.new("ShaderNodeMapRange", Value=(sepc, "Red"), **{"From Min": 0.8, "From Max": 0.805, "To Min": 0.0, "To Max": 1.0})
            inset = n.new("ShaderNodeMapRange", Value=(cells, "Distance"), **{"From Min": 0.34, "From Max": 0.32, "To Min": 0.0, "To Max": 1.0})
            pm = n.math("MULTIPLY", (pk, "Result"), (inset, "Result"))
            col = (n.mix((pm, "Value"), col, _toward(color, "#b8a888", 0.6)), 2)
            _ = pick
        stain = n.noise(5.0, 5.0, 0.65, obj)
        sm = n.new("ShaderNodeMapRange", Value=(stain, "Fac"), **{"From Min": 0.6, "From Max": 0.75, "To Min": 0.0, "To Max": 0.3})
        col = (n.mix((sm, "Result"), col, "#8a7a5c"), 2)
        w1 = n.new("ShaderNodeTexWave", Scale=240.0, Distortion=1.0, Vector=obj)
        w2 = n.new("ShaderNodeTexWave", Scale=240.0, Distortion=1.0, Vector=obj, _bands_direction="Y")
        wsum = n.math("ADD", (w1, "Fac"), (w2, "Fac"))
        bump = n.bump((wsum, "Value"), strength=0.12, distance=0.002)
        n.bsdf(**{"Base Color": col, "Roughness": 0.85, "Sheen Weight": 0.25, "Sheen Tint": col, "Transmission Weight": 0.0, "Subsurface Weight": 0.15, "Subsurface Radius": (0.4, 0.35, 0.25), "Normal": (bump, "Normal")})
        return n.mat

    return cached(("linen", color, name, patches), build)


def rush_mat(color="#a88c5c", binding="#6e5a3c", name="rush-mat"):
    """A plaited rush mat (UV: 0..1 across it, `size` in metres as the
    object's 'mat_w'/'mat_h'): strips a finger wide plaited over-and-under
    in a checker of both directions, each strip its own tone, a darker bound
    border, and wear where people sit (paler, flattened) and at its edges."""

    def build():
        n = Nodes(name)
        uv = n.new("ShaderNodeUVMap")
        sep = n.new("ShaderNodeSeparateXYZ", Vector=(uv, "UV"))
        mw = n.new("ShaderNodeAttribute", _attribute_name="mat_w", _attribute_type="OBJECT")
        mh = n.new("ShaderNodeAttribute", _attribute_name="mat_h", _attribute_type="OBJECT")
        # Metres across and along the mat.
        u = n.math("MULTIPLY", (sep, "X"), (mw, "Fac"))
        v = n.math("MULTIPLY", (sep, "Y"), (mh, "Fac"))
        strip = 0.022
        su = n.math("DIVIDE", (u, "Value"), strip)
        sv = n.math("DIVIDE", (v, "Value"), strip)
        # Plaited in blocks of three strips: which direction lies on top.
        bu = n.math("FLOOR", (n.math("DIVIDE", (su, "Value"), 3.0), "Value"))
        bv = n.math("FLOOR", (n.math("DIVIDE", (sv, "Value"), 3.0), "Value"))
        par = n.math("FLOORED_MODULO", (n.math("ADD", (bu, "Value"), (bv, "Value")), "Value"), 2.0)
        # Within a strip: rounded across its width, a seam between strips.
        fu = n.math("FRACT", (su, "Value"))
        fv = n.math("FRACT", (sv, "Value"))
        ru = n.math("SINE", (n.math("MULTIPLY", (fu, "Value"), 3.14159), "Value"))
        rv = n.math("SINE", (n.math("MULTIPLY", (fv, "Value"), 3.14159), "Value"))
        height = n.new("ShaderNodeMix", _data_type="FLOAT", Factor=(par, "Value"))
        n.link(ru, "Value", height, 2)
        n.link(rv, "Value", height, 3)
        # Each strip its own tone (a random per strip index).
        idu = n.math("FLOOR", (su, "Value"))
        idv = n.math("FLOOR", (sv, "Value"))
        idx = n.new("ShaderNodeMix", _data_type="FLOAT", Factor=(par, "Value"))
        n.link(idv, "Value", idx, 2)
        n.link(idu, "Value", idx, 3)
        hsh = n.new("ShaderNodeTexWhiteNoise", _noise_dimensions="1D", W=(idx, 0))
        tone = n.ramp((hsh, "Value"), [(0.0, shade(color, -0.22)), (0.5, color), (1.0, _toward(color, "#c8b07a", 0.5))])
        # Fibre along each strip.
        along = n.new("ShaderNodeMix", _data_type="FLOAT", Factor=(par, "Value"))
        n.link(sv, "Value", along, 2)
        n.link(su, "Value", along, 3)
        fib = n.new("ShaderNodeTexNoise", Scale=1.0, Detail=3.0, Roughness=0.6, _noise_dimensions="2D")
        fvec = n.new("ShaderNodeCombineXYZ", X=(along, 0), Y=(idx, 0))
        fsc = n.new("ShaderNodeVectorMath", _operation="MULTIPLY", Vector=(fvec, "Vector"))
        fsc.inputs[1].default_value = (0.9, 40.0, 1.0)
        n.link(fsc, "Vector", fib, "Vector")
        col = (n.mix((fib, "Fac"), (tone, "Color"), shade(color, -0.35), "MULTIPLY"), 2)
        col[0].inputs[0].default_value = 0.35
        # Seams between strips are dark.
        seam = n.new("ShaderNodeMapRange", Value=(height, 0), **{"From Min": 0.0, "From Max": 0.35, "To Min": 0.55, "To Max": 0.0})
        col = (n.mix((seam, "Result"), col, "#2a2014"), 2)
        # The bound border: 4 cm of darker twisted binding.
        du = n.math("MINIMUM", (u, "Value"), (n.math("SUBTRACT", (mw, "Fac"), (u, "Value")), "Value"))
        dv = n.math("MINIMUM", (v, "Value"), (n.math("SUBTRACT", (mh, "Fac"), (v, "Value")), "Value"))
        edge = n.math("MINIMUM", (du, "Value"), (dv, "Value"))
        border = n.new("ShaderNodeMapRange", Value=(edge, "Value"), **{"From Min": 0.045, "From Max": 0.035, "To Min": 0.0, "To Max": 1.0})
        col = (n.mix((border, "Result"), col, binding), 2)
        # Worn where people sit and at the edges: paler, flattened, dusty.
        obj = n.coords()
        wear = n.noise(1.6, 3.0, 0.5, obj)
        wr = n.new("ShaderNodeMapRange", Value=(wear, "Fac"), **{"From Min": 0.5, "From Max": 0.68, "To Min": 0.0, "To Max": 0.35})
        col = (n.mix((wr, "Result"), col, "#b8a47e"), 2)
        dirt = n.noise(7.0, 4.0, 0.6, obj)
        dr = n.new("ShaderNodeMapRange", Value=(dirt, "Fac"), **{"From Min": 0.55, "From Max": 0.75, "To Min": 0.0, "To Max": 0.3})
        col = (n.mix((dr, "Result"), col, "#3a2e22", "MULTIPLY"), 2)
        hb = n.math("MULTIPLY", (height, 0), (n.math("SUBTRACT", 1.0, (wr, "Result")), "Value"))
        bump = n.bump((hb, "Value"), strength=0.55, distance=0.004)
        n.bsdf(**{"Base Color": col, "Roughness": 0.78, "Sheen Weight": 0.2, "Sheen Tint": col, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("rush_mat", color, binding, name), build)


def rope(color="#a88f68", name="rope", wet=0.0):
    """Twisted rope of palm fibre or flax: strands spiralling along it
    (object X), fuzzy, darker where wet."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        tw = n.new("ShaderNodeTexWave", Scale=30.0, Distortion=0.5, Detail=1.0, _bands_direction="DIAGONAL", Vector=obj)
        fz = n.noise(80.0, 4.0, 0.7, obj)
        col = (n.mix((tw, "Fac"), shade(color, -0.35), shade(color, 0.08)), 2)
        col = (n.mix((fz, "Fac"), col, shade(color, -0.2), "MULTIPLY"), 2)
        col[0].inputs[0].default_value = 0.3
        if wet:
            col = (n.mix(wet * 0.5, col, "#000000", "MULTIPLY"), 2)
        bump = n.bump((tw, "Fac"), strength=0.6, distance=0.004)
        n.bsdf(**{"Base Color": col, "Roughness": 0.9 - 0.3 * wet, "Sheen Weight": 0.3, "Sheen Tint": col, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("rope", color, name, wet), build)


def fish(skin="#8e9296", back="#4a5058", flesh="#d8b894", dried=0.0, name=None, whole=False):
    """A fish of the lake (musht, a barbel): silver sides and a darker back,
    fine scales catching the light. Split and salted (not `whole`), the pale
    flesh side, turning amber and matte as it dries, is the side that faces
    the viewer (up or south); the skin is behind."""

    def build():
        n = Nodes(name or f"fish-{skin}-{dried}-{whole}")
        obj = n.coords()
        geo = n.new("ShaderNodeNewGeometry")
        # Whole fish: dark along the back (world up after lying down: the
        # side away from the belly), silver below; a spine-dark stripe.
        big = n.noise(8.0, 4.0, 0.6, obj)
        col = (n.mix((big, "Fac"), shade(skin, -0.12), shade(skin, 0.12)), 2)
        stripe = n.noise(3.0, 2.0, 0.5, obj)
        sm = n.new("ShaderNodeMapRange", Value=(stripe, "Fac"), **{"From Min": 0.45, "From Max": 0.6, "To Min": 0.0, "To Max": 0.7})
        col = (n.mix((sm, "Result"), col, back), 2)
        scales = n.new("ShaderNodeTexVoronoi", Scale=260.0, Vector=obj)
        sc = n.new("ShaderNodeMapRange", Value=(scales, "Distance"), **{"From Min": 0.0, "From Max": 0.4, "To Min": 0.0, "To Max": 1.0})
        rough = 0.3 + dried * 0.3
        spec = 0.6 - dried * 0.25
        if not whole:
            # Salted and dried, the flesh goes a pale grey-tan, not orange.
            dry = _toward(flesh, "#a8906e", dried)
            view = n.new("ShaderNodeVectorMath", _operation="DOT_PRODUCT")
            n.link(geo, "Normal", view, 0)
            view.inputs[1].default_value = (0.0, -0.7071, 0.7071)
            fl = n.new("ShaderNodeMapRange", Value=(view, "Value"), **{"From Min": 0.05, "From Max": 0.3, "To Min": 0.0, "To Max": 1.0})
            fc = n.mix((big, "Fac"), shade(dry, -0.12), shade(dry, 0.08))
            col = (n.mix((fl, "Result"), col, (fc, 2)), 2)
            rr = n.new("ShaderNodeMapRange", Value=(fl, "Result"), **{"From Min": 0.0, "From Max": 1.0, "To Min": rough, "To Max": 0.75})
            rough = (rr, "Result")
        bump = n.bump((sc, "Result"), strength=0.2, distance=0.002)
        n.bsdf(**{"Base Color": col, "Roughness": rough, "Specular IOR Level": spec, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("fish", skin, back, flesh, dried, name, whole), build)


def salt(name="salt"):
    """Coarse grey-white sea salt (brought up from the Dead Sea or the coast)."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        v = n.new("ShaderNodeTexVoronoi", Scale=160.0, Vector=obj)
        col = n.mix((v, "Distance"), "#f0ece2", "#b8b2a6")
        bump = n.bump((v, "Distance"), strength=0.5, distance=0.004)
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.55, "Subsurface Weight": 0.2, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("salt", name), build)


def brine(name="brine"):
    """Brine in a tub: murky, a little oily, fish showing under it."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        r = n.noise(20.0, 3.0, 0.5, obj)
        bump = n.bump((r, "Fac"), strength=0.05, distance=0.01)
        n.bsdf(**{"Base Color": hex_rgb("#5a5238"), "Roughness": 0.05, "Specular IOR Level": 0.5, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("brine", name), build)


def pebbles():
    """Shingle: rounded pebbles, mostly black and grey basalt with pale
    limestone and the odd brown chert (per instance), darker, glossier and
    greened by slime below the waterline (world height)."""

    def build():
        n = Nodes("shingle-pebbles")
        info = n.new("ShaderNodeAttribute", _attribute_name="irand", _attribute_type="GEOMETRY")
        obj = n.coords()
        geo = n.new("ShaderNodeNewGeometry")
        pos = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Position"))
        tone = n.ramp(
            (info, "Fac"),
            [(0.0, "#3a3835"), (0.18, "#4e4b46"), (0.36, "#625e57"), (0.52, "#77716a"), (0.64, "#9a917f"), (0.74, "#cdc3ac"), (0.86, "#ddd4bf"), (0.95, "#9a7a5c"), (1.0, "#57493e")],
        )
        tone.color_ramp.interpolation = "CONSTANT"
        fine = n.noise(90.0, 4.0, 0.7, obj)
        col = (n.mix((fine, "Fac"), (tone, "Color"), "#1a1816", "MULTIPLY"), 2)
        col[0].inputs[0].default_value = 0.2
        ves = n.new("ShaderNodeTexVoronoi", Scale=220.0, Vector=obj)
        vm = n.new("ShaderNodeMapRange", Value=(ves, "Distance"), **{"From Min": 0.0, "From Max": 0.12, "To Min": 0.5, "To Max": 0.0})
        col = (n.mix((vm, "Result"), col, "#121110"), 2)
        # The lake's edge: wet below the waterline mark (set by the builder
        # as a custom property on the object: 'wet_z').
        wz = n.new("ShaderNodeAttribute", _attribute_name="wet_z", _attribute_type="OBJECT")
        rel = n.math("SUBTRACT", (pos, "Z"), (wz, "Fac"))
        wet = n.new("ShaderNodeMapRange", Value=(rel, "Value"), **{"From Min": 0.035, "From Max": -0.01, "To Min": 0.0, "To Max": 1.0})
        wk = n.math("MULTIPLY", (wet, "Result"), 0.5)
        col = (n.mix((wk, "Value"), col, "#000000", "MULTIPLY"), 2)
        under = n.new("ShaderNodeMapRange", Value=(rel, "Value"), **{"From Min": -0.02, "From Max": -0.08, "To Min": 0.0, "To Max": 0.55})
        col = (n.mix((under, "Result"), col, "#3a4630"), 2)
        rough = n.new("ShaderNodeMapRange", Value=(wet, "Result"), **{"From Min": 0.0, "From Max": 1.0, "To Min": 0.75, "To Max": 0.18})
        bump = n.bump((fine, "Fac"), strength=0.3, distance=0.002)
        n.bsdf(**{"Base Color": col, "Roughness": (rough, "Result"), "Specular IOR Level": 0.42, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("shingle-pebbles",), build)


def shell():
    """Small conical snail shells washed up on the beach: chalky white-grey."""
    def build():
        n = Nodes("shell")
        obj = n.coords()
        w = n.new("ShaderNodeTexWave", Scale=40.0, Distortion=1.0, _bands_direction="Z", Vector=obj)
        col = n.mix((w, "Fac"), "#cfc6b4", "#8e8676")
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.6, "Specular IOR Level": 0.4})
        return n.mat

    return cached(("shell",), build)
