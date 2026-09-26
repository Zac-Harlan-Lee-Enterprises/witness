"""Procedural materials for Greco-Roman towns of Asia (Chapter 4, kit_roman.py).

Like materials.py: no image textures from outside, every surface is built
from noise, cells and waves (or from pattern images drawn here with numpy:
a mosaic's design, a painted wall's panels, a milestone's lines), so the
pipeline needs no downloaded art and renders the same way every time.
"""
import math

import bpy
import numpy as np

import materials as M
from common import hex_rgb
from materials import Nodes, _random_attr, _toward, cached, shade


def _world_z(n):
    """Height of the shaded point above the ground (world Z, in tiles)."""
    geo = n.new("ShaderNodeNewGeometry")
    return (n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Position")), "Z")


# ── walls and roofs ────────────────────────────────────────────────────────
def stucco(color="#e2d6bc", name=None, dado=None, dado_h=0.95, flaked=0.25, grime=0.55, streaks=0.35, under="#a48466"):
    """Lime stucco over rubble walls: a little uneven, patchy with age and
    old limewash, hairline cracks, dark rain streaks from the eaves, splashed
    grime at the foot, and patches where the render has fallen away to show
    the rubble and brick beneath (`flaked`). An optional painted dado (a band
    of red ochre or black up to `dado_h`), as Roman streets had."""

    def build():
        n = Nodes(name or f"stucco-{color}-{dado}")
        obj = n.coords()
        z = _world_z(n)
        big = n.noise(0.6, 5.0, 0.6, obj)
        mid = n.noise(4.0, 5.0, 0.6, obj)
        fine = n.noise(60.0, 4.0, 0.6, obj)
        wash = n.noise(1.6, 3.0, 0.5, obj)
        base = n.mix((big, "Fac"), shade(color, -0.09), shade(color, 0.05))
        # Old limewash coats: patches a little whiter or yellower.
        wm = n.new("ShaderNodeMapRange", Value=(wash, "Fac"), **{"From Min": 0.55, "From Max": 0.7, "To Min": 0.0, "To Max": 0.35})
        out = (n.mix((wm, "Result"), (base, 2), _toward(color, "#f2ecdc", 0.5)), 2)
        if dado:
            # A painted dado with a thin dark line on top, a little faded.
            dz = n.new("ShaderNodeMapRange", Value=z, **{"From Min": dado_h + 0.004, "From Max": dado_h - 0.004, "To Min": 0.0, "To Max": 1.0})
            dcol = n.mix((mid, "Fac"), shade(dado, -0.1), shade(dado, 0.08))
            out = (n.mix((dz, "Result"), out, (dcol, 2)), 2)
            line = n.new("ShaderNodeMapRange", Value=z, **{"From Min": dado_h + 0.03, "From Max": dado_h + 0.012, "To Min": 0.0, "To Max": 1.0})
            line2 = n.new("ShaderNodeMapRange", Value=z, **{"From Min": dado_h - 0.005, "From Max": dado_h + 0.012, "To Min": 0.0, "To Max": 1.0})
            band = n.math("MULTIPLY", (line, "Result"), (line2, "Result"))
            out = (n.mix((band, "Value"), out, shade(dado, -0.45)), 2)
        # Rain streaks run down from the top.
        wave = n.new("ShaderNodeTexWave", Scale=6.0, Distortion=9.0, Detail=3.0, _bands_direction="X", Vector=obj)
        st = n.new("ShaderNodeMapRange", Value=(wave, "Fac"), **{"From Min": 0.55, "From Max": 0.9, "To Min": 0.0, "To Max": streaks})
        stn = n.math("MULTIPLY", (st, "Result"), (mid, "Fac"))
        out = (n.mix((stn, "Value"), out, shade(color, -0.32)), 2)
        # Fallen render: rubble and brick showing through.
        if flaked > 0:
            cells = n.new("ShaderNodeTexVoronoi", Scale=9.0, Vector=obj)
            rub = n.mix((cells, "Distance"), shade(under, -0.18), shade(under, 0.08))
            lo = 0.74 - flaked * 0.25
            fm = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": lo, "From Max": lo + 0.02, "To Min": 0.0, "To Max": 1.0})
            footf = n.new("ShaderNodeMapRange", Value=z, **{"From Min": 0.2, "From Max": 1.4, "To Min": 1.0, "To Max": 0.4})
            fm2 = n.math("MULTIPLY", (fm, "Result"), (footf, "Result"))
            out = (n.mix((fm2, "Value"), out, (rub, 2)), 2)
        else:
            fm2 = None
        cracks = n.new("ShaderNodeTexVoronoi", Scale=2.2, Vector=obj, _feature="DISTANCE_TO_EDGE")
        crack = n.new("ShaderNodeMapRange", Value=(cracks, "Distance"), **{"From Min": 0.0, "From Max": 0.004, "To Min": 0.4, "To Max": 0.0})
        out = (n.mix((crack, "Result"), out, shade(color, -0.5)), 2)
        foot = n.new("ShaderNodeMapRange", Value=z, **{"From Min": 0.0, "From Max": 0.4, "To Min": 0.45, "To Max": 0.0})
        fn = n.math("MULTIPLY", (foot, "Result"), (mid, "Fac"))
        fn2 = n.math("MULTIPLY", (fn, "Value"), 1.6, clamp=True)
        out = (n.mix((fn2, "Value"), out, shade(color, -0.48)), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.25, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": grime, "To Max": 0.0})
        out = (n.mix((g, "Result"), out, shade(color, -0.55)), 2)
        h = n.math("SUBTRACT", (mid, "Fac"), (crack, "Result"))
        h = n.math("ADD", (h, "Value"), (fine, "Fac"))
        if fm2 is not None:
            h = n.math("SUBTRACT", (h, "Value"), (fm2, "Value"))
        bump = n.bump((h, "Value"), strength=0.22, distance=0.012)
        n.bsdf(**{"Base Color": out, "Roughness": 0.9, "Specular IOR Level": 0.25, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("stucco", color, name, dado, dado_h, flaked, grime, streaks, under), build)


def ashlar(color="#cfc3a6", name=None, worn=0.5):
    """Dressed limestone blocks of the region (a warm, slightly grey stone),
    per-block tone from the builder's `rand` attribute."""
    return M.limestone(color, name or f"ashlar-{color}", worn=worn)


def roof_tile(color="#a8573a", name="roof-tile"):
    """Fired clay roof tiles (tegulae and imbrices): orange-red to brown per
    tile (the `rand` attribute), paler dusty tops, lichen in yellow and
    grey-green spots, dark where one tile laps over the next."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        rnd = _random_attr(n)
        tone = n.ramp((rnd, "Fac"), [(0.0, shade(color, -0.25)), (0.3, shade(color, -0.08)), (0.55, color), (0.8, _toward(color, "#c07a4c", 0.5)), (0.92, _toward(color, "#8a5a44", 0.4)), (1.0, shade(color, -0.35))])
        mid = n.noise(7.0, 5.0, 0.6, obj)
        fine = n.noise(70.0, 4.0, 0.6, obj)
        out = (n.mix((mid, "Fac"), (tone, "Color"), shade(color, -0.2), "MULTIPLY"), 2)
        # Dust and weathering bleach what faces the sky.
        geo = n.new("ShaderNodeNewGeometry")
        sepN = n.new("ShaderNodeSeparateXYZ", Vector=(geo, "Normal"))
        up = n.new("ShaderNodeMapRange", Value=(sepN, "Z"), **{"From Min": 0.6, "From Max": 1.0, "To Min": 0.0, "To Max": 0.22})
        out = (n.mix((up, "Result"), out, "#c9ab8e"), 2)
        li = n.noise(11.0, 5.0, 0.7, obj)
        lm = n.new("ShaderNodeMapRange", Value=(li, "Fac"), **{"From Min": 0.66, "From Max": 0.7, "To Min": 0.0, "To Max": 0.7})
        lc = n.mix((mid, "Fac"), "#b8a24a", "#8e9278")
        out = (n.mix((lm, "Result"), out, (lc, 2)), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.06, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.6, "To Max": 0.0})
        out = (n.mix((g, "Result"), out, shade(color, -0.65)), 2)
        h = n.math("ADD", (fine, "Fac"), (lm, "Result"))
        bump = n.bump((h, "Value"), strength=0.25, distance=0.004)
        n.bsdf(**{"Base Color": out, "Roughness": 0.78, "Specular IOR Level": 0.3, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("roof-tile", color, name), build)


def marble(color="#dcd5c6", name=None, veins="#b0aa9c", worn=0.4):
    """A fine white stone (the local marble and travertine-limestone of the
    Lycus valley, used for columns, basins and thresholds): faint grey veins,
    a soft sheen where hands and feet have polished it, grime in the flutes."""

    def build():
        n = Nodes(name or f"marble-{color}")
        obj = n.coords()
        warp = n.noise(1.8, 4.0, 0.6, obj)
        comb = n.new("ShaderNodeVectorMath", _operation="ADD")
        n.link(obj[0], obj[1], comb, 0)
        n.link(warp, "Color", comb, 1)
        vw = n.new("ShaderNodeTexWave", Scale=2.2, Distortion=6.0, Detail=4.0, _bands_direction="DIAGONAL", Vector=(comb, "Vector"))
        vein = n.new("ShaderNodeMapRange", Value=(vw, "Fac"), **{"From Min": 0.9, "From Max": 1.0, "To Min": 0.0, "To Max": 0.6})
        big = n.noise(1.2, 4.0, 0.6, obj)
        base = n.mix((big, "Fac"), shade(color, -0.05), shade(color, 0.04))
        out = (n.mix((vein, "Result"), (base, 2), veins), 2)
        wm = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.5, "From Max": 0.75, "To Min": 0.0, "To Max": worn})
        out = (n.mix((wm, "Result"), out, "#b0a48c"), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.05, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.55, "To Max": 0.0})
        out = (n.mix((g, "Result"), out, "#6e6456"), 2)
        fine = n.noise(80.0, 4.0, 0.6, obj)
        bump = n.bump((fine, "Fac"), strength=0.08, distance=0.004)
        n.bsdf(**{"Base Color": out, "Roughness": 0.42, "Specular IOR Level": 0.45, "Subsurface Weight": 0.05, "Subsurface Radius": (0.4, 0.35, 0.3), "Normal": (bump, "Normal")})
        return n.mat

    return cached(("marble", color, name, veins, worn), build)


def bronze(name="bronze", patina=0.5):
    """Cast bronze, rubbed bright where it is handled, brown elsewhere, with
    green patina settling in the hollows."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        big = n.noise(8.0, 4.0, 0.6, obj)
        base = n.mix((big, "Fac"), "#6a4a26", "#a0783c")
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.04, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.35, "From Max": 0.9, "To Min": patina, "To Max": 0.0})
        out = n.mix((g, "Result"), (base, 2), "#4f6a52")
        rough = n.new("ShaderNodeMapRange", Value=(g, "Result"), **{"From Min": 0.0, "From Max": 0.5, "To Min": 0.32, "To Max": 0.8})
        n.bsdf(**{"Base Color": (out, 2), "Metallic": 0.85, "Roughness": (rough, "Result")})
        return n.mat

    return cached(("bronze", name, patina), build)


# ── liquids ────────────────────────────────────────────────────────────────
DYES = {
    # Madder red (Ammia's red), woad blue, a purple (madder over woad), and
    # the pale milky alum mordant bath.
    "madder": "#6e1812",
    "woad": "#1c2c56",
    "purple": "#3c1636",
    "alum": "#b9b6a4",
    # Fuller's earth in water: a thin white clay slurry.
    "fullers": "#c8c2ae",
}


def dye(kind="madder"):
    """A vat's liquor: opaque and dark with the dye, glossy, a thin scum of
    froth and wool fibres drifting at the edge."""
    color = DYES.get(kind, kind)

    def build():
        n = Nodes(f"dye-{kind}")
        obj = n.coords()
        film = n.noise(9.0, 4.0, 0.6, obj)
        fm = n.new("ShaderNodeMapRange", Value=(film, "Fac"), **{"From Min": 0.6, "From Max": 0.75, "To Min": 0.0, "To Max": 0.35})
        col = n.mix((fm, "Result"), color, _toward(color, "#d8d0c0", 0.45))
        rip = n.noise(22.0, 3.0, 0.5, obj)
        bump = n.bump((rip, "Fac"), strength=0.05, distance=0.004)
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.12, "Specular IOR Level": 0.55, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("dye", kind), build)


def river_water(tint="#4e5a4c", name="river"):
    """A lowland river after rain: opaque with silt (grey-green), glossy,
    streaked along the current (flowing west) with fine ripples."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        stretch = n.new("ShaderNodeVectorMath", _operation="MULTIPLY")
        n.link(obj[0], obj[1], stretch, 0)
        stretch.inputs[1].default_value = (0.25, 2.2, 1.0)
        flow = n.noise(2.0, 4.0, 0.6, (stretch, "Vector"))
        rip = n.noise(28.0, 3.0, 0.55, obj)
        col = n.mix((flow, "Fac"), shade(tint, -0.14), shade(tint, 0.1))
        h = n.math("ADD", (flow, "Fac"), (n.math("MULTIPLY", (rip, "Fac"), 0.5), "Value"))
        bump = n.bump((h, "Value"), strength=0.08, distance=0.01)
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.06, "Specular IOR Level": 0.5, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("river", tint, name), build)


def puddle():
    """Rain water standing in a hollow: a dark mirror, a little silty."""

    def build():
        n = Nodes("puddle")
        obj = n.coords()
        rip = n.noise(30.0, 3.0, 0.5, obj)
        bump = n.bump((rip, "Fac"), strength=0.03, distance=0.004)
        n.bsdf(**{"Base Color": hex_rgb("#58574f"), "Roughness": 0.05, "Specular IOR Level": 0.6, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("puddle",), build)


def soft_decal(color, opacity=0.8, name=None):
    """A stain lying in the ground or floor (spilt clay, a dye splash, wet
    earth): its colour fading out to a ragged edge. Expects UVs 0-1."""

    def build():
        n = Nodes(name or f"decal-{color}-{opacity}")
        uv = n.coords("UV")
        obj = n.coords()
        sub = n.new("ShaderNodeVectorMath", _operation="SUBTRACT", Vector=uv)
        sub.inputs[1].default_value = (0.5, 0.5, 0.0)
        d = n.new("ShaderNodeVectorMath", _operation="LENGTH", Vector=(sub, "Vector"))
        rag = n.noise(4.0, 4.0, 0.6, obj)
        wob = n.math("MULTIPLY", (n.math("SUBTRACT", (rag, "Fac"), 0.5), "Value"), 0.4)
        dd = n.math("ADD", (n.math("MULTIPLY", (d, "Value"), 2.0), "Value"), (wob, "Value"))
        a = n.new("ShaderNodeMapRange", Value=(dd, "Value"), **{"From Min": 0.78, "From Max": 0.35, "To Min": 0.0, "To Max": opacity})
        grain = n.noise(30.0, 3.0, 0.6, obj)
        col = n.mix((grain, "Fac"), shade(color, -0.1), shade(color, 0.08))
        n.bsdf(**{"Base Color": (col, 2), "Roughness": 0.85, "Alpha": (a, "Result")})
        return n.mat

    return cached(("decal", color, opacity, name), build)


def steam():
    """Steam rising off a hot vat: a faint scattering volume broken into
    wisps, thinning upward."""

    def build():
        mat = bpy.data.materials.new("vat-steam")
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        sc = nt.nodes.new("ShaderNodeVolumePrincipled")
        sc.inputs["Color"].default_value = (0.95, 0.95, 0.95, 1.0)
        sc.inputs["Anisotropy"].default_value = 0.3
        tc = nt.nodes.new("ShaderNodeTexCoord")
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 5.0
        noise.inputs["Detail"].default_value = 6.0
        noise.inputs["Distortion"].default_value = 0.8
        nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        wisp = nt.nodes.new("ShaderNodeMapRange")
        wisp.inputs["From Min"].default_value = 0.5
        wisp.inputs["From Max"].default_value = 0.8
        wisp.inputs["To Min"].default_value = 0.0
        wisp.inputs["To Max"].default_value = 1.2
        nt.links.new(noise.outputs["Fac"], wisp.inputs["Value"])
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
        fade = nt.nodes.new("ShaderNodeMapRange")
        fade.inputs["From Min"].default_value = 0.0
        fade.inputs["From Max"].default_value = 1.0
        fade.inputs["To Min"].default_value = 1.0
        fade.inputs["To Max"].default_value = 0.0
        nt.links.new(sep.outputs["Z"], fade.inputs["Value"])
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        nt.links.new(wisp.outputs["Result"], mul.inputs[0])
        nt.links.new(fade.outputs["Result"], mul.inputs[1])
        nt.links.new(mul.outputs["Value"], sc.inputs["Density"])
        nt.links.new(sc.outputs["Volume"], out.inputs["Volume"])
        return mat

    return cached(("steam",), build)


# ── stone, floors and paving ───────────────────────────────────────────────
def paver(color="#9a948a", name="paver", wet=0.0):
    """Hard grey limestone paving, each stone its own tone (`rand`), worn
    smooth and a little polished by wheels and feet, grime in the joints;
    `wet` darkens it and makes it shine (after rain)."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        rnd = _random_attr(n)
        tone = n.ramp((rnd, "Fac"), [(0.0, shade(color, -0.2)), (0.3, _toward(color, "#8e8a82", 0.4)), (0.6, color), (0.85, _toward(color, "#b0a48e", 0.4)), (1.0, shade(color, 0.08))])
        big = n.noise(1.4, 4.0, 0.6, obj)
        mid = n.noise(8.0, 5.0, 0.6, obj)
        fine = n.noise(60.0, 5.0, 0.7, obj)
        pits = n.new("ShaderNodeTexVoronoi", Scale=70.0, Vector=obj)
        out = (n.mix((mid, "Fac"), (tone, "Color"), shade(color, -0.22), "MULTIPLY"), 2)
        wm = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.45, "From Max": 0.75, "To Min": 0.0, "To Max": 0.3})
        out = (n.mix((wm, "Result"), out, shade(color, -0.3)), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.05, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.65, "To Max": 0.0})
        out = (n.mix((g, "Result"), out, shade(color, -0.6)), 2)
        rough = 0.72
        if wet > 0:
            # Wet stone: darker and richer, shining except where it has
            # begun to dry in patches.
            dry = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.55, "From Max": 0.7, "To Min": 0.0, "To Max": 1.0})
            out = (n.mix(wet * 0.55, out, "#000000", "MULTIPLY"), 2)
            out = (n.mix(wet * 0.25, out, "#3c3a36"), 2)
            rr = n.new("ShaderNodeMapRange", Value=(dry, "Result"), **{"From Min": 0.0, "From Max": 1.0, "To Min": 0.72 - 0.55 * wet, "To Max": 0.72 - 0.25 * wet})
            rough = (rr, "Result")
        h = n.math("ADD", (fine, "Fac"), (pits, "Distance"))
        bump = n.bump((h, "Value"), strength=0.25, distance=0.006)
        n.bsdf(**{"Base Color": out, "Roughness": rough, "Specular IOR Level": 0.4, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("paver", color, name, wet), build)


def signinum(color="#a8705a", name="signinum", dots=None, stains=0.4, stain="#6a1c18"):
    """Opus signinum: a floor of lime mortar with crushed tile, pinkish red,
    trowelled smooth and worn; `dots` inlays white tesserae in a lattice
    (`dots` = spacing in tiles); `stains` of dye in a workshop."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        big = n.noise(0.8, 4.0, 0.6, obj)
        mid = n.noise(6.0, 5.0, 0.6, obj)
        grit = n.new("ShaderNodeTexVoronoi", Scale=180.0, Vector=obj)
        gm = n.new("ShaderNodeMapRange", Value=(grit, "Distance"), **{"From Min": 0.0, "From Max": 0.25, "To Min": 0.55, "To Max": 0.0})
        base = n.mix((big, "Fac"), shade(color, -0.1), shade(color, 0.06))
        out = (n.mix((gm, "Result"), (base, 2), "#6a3a2a"), 2)
        chips = n.new("ShaderNodeTexVoronoi", Scale=60.0, Vector=obj, Randomness=1.0)
        cm = n.new("ShaderNodeMapRange", Value=(chips, "Distance"), **{"From Min": 0.05, "From Max": 0.12, "To Min": 0.5, "To Max": 0.0})
        out = (n.mix((cm, "Result"), out, "#d8c8b0"), 2)
        if dots:
            # White tesserae set in a diagonal lattice.
            sc = 1.0 / dots
            rot = n.new("ShaderNodeVectorRotate", _rotation_type="Z_AXIS", Vector=obj, Angle=math.radians(45))
            vs = n.new("ShaderNodeVectorMath", _operation="SCALE", Vector=(rot, "Vector"), Scale=sc)
            fr = n.new("ShaderNodeVectorMath", _operation="FRACTION", Vector=(vs, "Vector"))
            sub = n.new("ShaderNodeVectorMath", _operation="SUBTRACT", Vector=(fr, "Vector"))
            sub.inputs[1].default_value = (0.5, 0.5, 0.0)
            sep = n.new("ShaderNodeSeparateXYZ", Vector=(sub, "Vector"))
            ax = n.math("ABSOLUTE", (sep, "X"))
            ay = n.math("ABSOLUTE", (sep, "Y"))
            mx = n.math("MAXIMUM", (ax, "Value"), (ay, "Value"))
            d = n.new("ShaderNodeMapRange", Value=(mx, "Value"), **{"From Min": 0.06, "From Max": 0.05, "To Min": 0.0, "To Max": 1.0})
            out = (n.mix((d, "Result"), out, "#ece4d2"), 2)
        if stains > 0:
            st = n.noise(1.3, 4.0, 0.6, obj)
            sm = n.new("ShaderNodeMapRange", Value=(st, "Fac"), **{"From Min": 0.6, "From Max": 0.72, "To Min": 0.0, "To Max": stains})
            out = (n.mix((sm, "Result"), out, stain), 2)
        wear = n.new("ShaderNodeMapRange", Value=(mid, "Fac"), **{"From Min": 0.3, "From Max": 0.7, "To Min": 0.0, "To Max": 0.18})
        out = (n.mix((wear, "Result"), out, shade(color, -0.3)), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.2, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.45, "To Max": 0.0})
        out = (n.mix((g, "Result"), out, shade(color, -0.55)), 2)
        cracks = n.new("ShaderNodeTexVoronoi", Scale=1.1, Vector=obj, _feature="DISTANCE_TO_EDGE")
        cr = n.new("ShaderNodeMapRange", Value=(cracks, "Distance"), **{"From Min": 0.0, "From Max": 0.003, "To Min": 0.5, "To Max": 0.0})
        out = (n.mix((cr, "Result"), out, shade(color, -0.5)), 2)
        h = n.math("SUBTRACT", (mid, "Fac"), (cr, "Result"))
        h = n.math("ADD", (h, "Value"), (gm, "Result"))
        bump = n.bump((h, "Value"), strength=0.12, distance=0.006)
        n.bsdf(**{"Base Color": out, "Roughness": 0.55, "Specular IOR Level": 0.35, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("signinum", color, name, dots, stains, stain), build)


def pattern_image(name, arr):
    """A numpy RGB(A) array (top row first, 0-1 sRGB) as a packed image."""
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.dstack([arr, np.ones((h, w))])
    im = bpy.data.images.new(name, w, h, alpha=True)
    im.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).reshape(-1).astype(np.float32))
    im.pack()
    return im


def mosaic(image, cells_u, cells_v, name="mosaic"):
    """A floor of stone tesserae laid to `image` (one pixel per tessera,
    cells_u x cells_v over the UVs): each stone its own shade, grey grout
    between, a gently undulating, polished and worn surface."""

    def build():
        n = Nodes(name)
        uv = n.coords("UV")
        t = n.new("ShaderNodeTexImage", Vector=uv, _interpolation="Closest")
        t.image = image
        t.image.colorspace_settings.name = "sRGB"
        # The grid of tesserae: distance to the nearest cell edge.
        sc = n.new("ShaderNodeVectorMath", _operation="MULTIPLY", Vector=uv)
        sc.inputs[1].default_value = (cells_u, cells_v, 1.0)
        warp = n.noise(0.35, 2.0, 0.5, (sc, "Vector"))
        wv = n.new("ShaderNodeVectorMath", _operation="MULTIPLY_ADD", Vector=(warp, "Color"))
        wv.inputs[1].default_value = (0.18, 0.18, 0.0)
        n.link(sc, "Vector", wv, 2)
        fr = n.new("ShaderNodeVectorMath", _operation="FRACTION", Vector=(wv, "Vector"))
        sub = n.new("ShaderNodeVectorMath", _operation="SUBTRACT", Vector=(fr, "Vector"))
        sub.inputs[1].default_value = (0.5, 0.5, 0.0)
        sep = n.new("ShaderNodeSeparateXYZ", Vector=(sub, "Vector"))
        mx = n.math("MAXIMUM", (n.math("ABSOLUTE", (sep, "X")), "Value"), (n.math("ABSOLUTE", (sep, "Y")), "Value"))
        grout = n.new("ShaderNodeMapRange", Value=(mx, "Value"), **{"From Min": 0.36, "From Max": 0.46, "To Min": 0.0, "To Max": 1.0})
        # Per-tessera shade: a cell noise (white noise per cell).
        flo = n.new("ShaderNodeVectorMath", _operation="FLOOR", Vector=(wv, "Vector"))
        wn = n.new("ShaderNodeTexWhiteNoise", Vector=(flo, "Vector"), _noise_dimensions="3D")
        jm = n.new("ShaderNodeMapRange", Value=(wn, "Value"), **{"From Min": 0.0, "From Max": 1.0, "To Min": -0.1, "To Max": 0.08})
        col = n.new("ShaderNodeMix", _data_type="RGBA", _blend_type="ADD")
        n._in(col, 0, 1.0)
        n.link(t, "Color", col, 6)
        cj = n.new("ShaderNodeCombineColor", Red=(jm, "Result"), Green=(jm, "Result"), Blue=(jm, "Result"))
        n.link(cj, "Color", col, 7)
        out = (n.mix((grout, "Result"), (col, 2), "#8c8274"), 2)
        obj = n.coords()
        big = n.noise(0.9, 4.0, 0.6, obj)
        wear = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.45, "From Max": 0.75, "To Min": 0.0, "To Max": 0.2})
        out = (n.mix((wear, "Result"), out, "#8a8070"), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.2, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.4, "To Max": 0.0})
        out = (n.mix((g, "Result"), out, "#2a241e"), 2)
        rough = n.new("ShaderNodeMapRange", Value=(grout, "Result"), **{"From Min": 0.0, "From Max": 1.0, "To Min": 0.38, "To Max": 0.85})
        h = n.math("SUBTRACT", (big, "Fac"), (n.math("MULTIPLY", (grout, "Result"), 0.6), "Value"))
        bump = n.bump((h, "Value"), strength=0.2, distance=0.003)
        n.bsdf(**{"Base Color": out, "Roughness": (rough, "Result"), "Specular IOR Level": 0.4, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("mosaic", name), build)


def painted_plaster(image, name="painted-wall", soot=0.0):
    """Fresco on lime plaster, laid out by `image` over the UVs: faded,
    rubbed at shoulder height, hairline cracks, soot from lamps above."""

    def build():
        n = Nodes(name)
        uv = n.coords("UV")
        obj = n.coords()
        t = n.new("ShaderNodeTexImage", Vector=uv, _interpolation="Linear")
        t.image = image
        big = n.noise(0.9, 5.0, 0.6, obj)
        mid = n.noise(6.0, 5.0, 0.6, obj)
        fine = n.noise(70.0, 4.0, 0.6, obj)
        out = (t, "Color")
        fade =n.new("ShaderNodeMapRange", Value=(mid, "Fac"), **{"From Min": 0.4, "From Max": 0.75, "To Min": 0.0, "To Max": 0.14})
        out = (n.mix((fade, "Result"), out, "#e8dcc4"), 2)
        cracks = n.new("ShaderNodeTexVoronoi", Scale=1.7, Vector=obj, _feature="DISTANCE_TO_EDGE")
        crack = n.new("ShaderNodeMapRange", Value=(cracks, "Distance"), **{"From Min": 0.0, "From Max": 0.003, "To Min": 0.45, "To Max": 0.0})
        out = (n.mix((crack, "Result"), out, "#3a2e26"), 2)
        z = _world_z(n)
        if soot > 0:
            s = n.new("ShaderNodeMapRange", Value=z, **{"From Min": 1.6, "From Max": 3.4, "To Min": 0.0, "To Max": soot})
            sn = n.math("MULTIPLY", (s, "Result"), (big, "Fac"))
            out = (n.mix((sn, "Value"), out, "#2e2620"), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.3, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.4, "To Max": 0.0})
        out = (n.mix((g, "Result"), out, "#2a2018"), 2)
        h = n.math("SUBTRACT", (mid, "Fac"), (crack, "Result"))
        h = n.math("ADD", (h, "Value"), (n.math("MULTIPLY", (fine, "Fac"), 0.5), "Value"))
        bump = n.bump((h, "Value"), strength=0.12, distance=0.008)
        # Fresco has a faint polish (it was burnished while wet).
        n.bsdf(**{"Base Color": out, "Roughness": 0.62, "Specular IOR Level": 0.35, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("painted", name, soot), build)


def travertine():
    """The white terraces: a calcite crust, creamy white with faint ochre
    and grey streaks running down the little falls, and in every level
    pool (the skin's `wet` attribute) still water: pale turquoise where
    shallow, deeper blue-green toward the back (`depth`), glassy."""

    def build():
        n = Nodes("travertine")
        obj = n.coords()
        wet = n.new("ShaderNodeAttribute", _attribute_name="wet", _attribute_type="GEOMETRY")
        depth = n.new("ShaderNodeAttribute", _attribute_name="depth", _attribute_type="GEOMETRY")
        cover = n.new("ShaderNodeAttribute", _attribute_name="cover", _attribute_type="GEOMETRY")
        stretch = n.new("ShaderNodeVectorMath", _operation="MULTIPLY")
        n.link(obj[0], obj[1], stretch, 0)
        stretch.inputs[1].default_value = (7.0, 7.0, 0.8)
        drip = n.noise(1.0, 5.0, 0.6, (stretch, "Vector"))
        big = n.noise(0.7, 4.0, 0.6, obj)
        mid = n.noise(5.0, 5.0, 0.6, obj)
        fine = n.noise(45.0, 4.0, 0.6, obj)
        crust = n.mix((drip, "Fac"), "#dcd8cc", "#f6f4ee")
        stain = n.new("ShaderNodeMapRange", Value=(big, "Fac"), **{"From Min": 0.58, "From Max": 0.78, "To Min": 0.0, "To Max": 0.3})
        crust = (n.mix((stain, "Result"), (crust, 2), "#d8c49c"), 2)
        pool = n.mix((depth, "Fac"), "#c4e0da", "#78aaa8")
        pool2 = n.mix((n.math("MULTIPLY", (mid, "Fac"), 0.3), "Value"), (pool, 2), "#d0e6e0")
        # Water stands only where the crust is whole.
        wet_c = n.math("MULTIPLY", (wet, "Fac"), (n.new("ShaderNodeMapRange", Value=(cover, "Fac"), **{"From Min": 0.6, "From Max": 0.95, "To Min": 0.0, "To Max": 1.0}), "Result"))
        wm = n.new("ShaderNodeMapRange", Value=(wet_c, "Value"), **{"From Min": 0.3, "From Max": 0.7, "To Min": 0.0, "To Max": 1.0})
        col = n.mix((wm, "Result"), crust, (pool2, 2))
        rough = n.new("ShaderNodeMapRange", Value=(wm, "Result"), **{"From Min": 0.0, "From Max": 1.0, "To Min": 0.55, "To Max": 0.03})
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.1, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.2, "To Max": 0.0})
        col2 = n.mix((g, "Result"), (col, 2), "#a8a496")
        h = n.math("ADD", (drip, "Fac"), (n.math("MULTIPLY", (fine, "Fac"), 0.35), "Value"))
        h = n.math("MULTIPLY", (h, "Value"), (n.math("SUBTRACT", 1.0, (wm, "Result")), "Value"))
        bump = n.bump((h, "Value"), strength=0.3, distance=0.008)
        # A thin, broken crust where it spills onto the hillside.
        grain = n.noise(18.0, 4.0, 0.6, obj)
        alpha = n.new("ShaderNodeMapRange", Value=(n.math("ADD", (cover, "Fac"), (n.math("MULTIPLY", (grain, "Fac"), 0.35), "Value")), "Value"), **{"From Min": 0.35, "From Max": 0.75, "To Min": 0.0, "To Max": 1.0})
        n.bsdf(**{"Base Color": (col2, 2), "Roughness": (rough, "Result"), "Specular IOR Level": 0.5, "Normal": (bump, "Normal"), "Alpha": (alpha, "Result")})
        return n.mat

    return cached(("travertine",), build)


def vat_plaster(stain, base="#cfc3a8", name=None):
    """The plastered masonry of a dye vat or hearth: lime render, crazed and
    grubby, with the liquor's colour run down from the rim in streaks and
    splashed round the foot."""

    def build():
        n = Nodes(name or f"vat-plaster-{stain}-{base}")
        obj = n.coords()
        z = _world_z(n)
        big = n.noise(1.2, 4.0, 0.6, obj)
        mid = n.noise(6.0, 5.0, 0.6, obj)
        col = (n.mix((big, "Fac"), shade(base, -0.1), shade(base, 0.05)), 2)
        stretch = n.new("ShaderNodeVectorMath", _operation="MULTIPLY")
        n.link(obj[0], obj[1], stretch, 0)
        stretch.inputs[1].default_value = (9.0, 9.0, 0.7)
        run = n.noise(1.0, 4.0, 0.6, (stretch, "Vector"))
        rm = n.new("ShaderNodeMapRange", Value=(run, "Fac"), **{"From Min": 0.46, "From Max": 0.6, "To Min": 0.0, "To Max": 1.0})
        top = n.new("ShaderNodeMapRange", Value=z, **{"From Min": 0.15, "From Max": 0.62, "To Min": 0.0, "To Max": 0.9})
        streak = n.math("MULTIPLY", (rm, "Result"), (top, "Result"))
        col = (n.mix((streak, "Value"), col, _toward(stain, base, 0.2)), 2)
        foot = n.new("ShaderNodeMapRange", Value=z, **{"From Min": 0.0, "From Max": 0.16, "To Min": 0.75, "To Max": 0.0})
        sp = n.math("MULTIPLY", (foot, "Result"), (n.new("ShaderNodeMapRange", Value=(mid, "Fac"), **{"From Min": 0.48, "From Max": 0.58, "To Min": 0.0, "To Max": 1.0}), "Result"))
        col = (n.mix((sp, "Value"), col, stain), 2)
        cracks = n.new("ShaderNodeTexVoronoi", Scale=5.0, Vector=obj, _feature="DISTANCE_TO_EDGE")
        crack = n.new("ShaderNodeMapRange", Value=(cracks, "Distance"), **{"From Min": 0.0, "From Max": 0.005, "To Min": 0.5, "To Max": 0.0})
        col = (n.mix((crack, "Result"), col, shade(base, -0.5)), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.12, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.5, "To Max": 0.0})
        col = (n.mix((g, "Result"), col, shade(base, -0.6)), 2)
        h = n.math("SUBTRACT", (mid, "Fac"), (crack, "Result"))
        bump = n.bump((h, "Value"), strength=0.2, distance=0.008)
        rough = n.new("ShaderNodeMapRange", Value=(streak, "Value"), **{"From Min": 0.0, "From Max": 1.0, "To Min": 0.88, "To Max": 0.45})
        n.bsdf(**{"Base Color": col, "Roughness": (rough, "Result"), "Specular IOR Level": 0.3, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("vat-plaster", stain, base, name), build)


def inscribed(mask, color="#cfc6ae", name="inscribed"):
    """Weathered limestone with letters cut into it (`mask`: an image over
    the UVs, white where cut): the cuts in shadow, their edges crisp, the
    face grey with lichen."""

    def build():
        n = Nodes(name)
        obj = n.coords()
        uv = n.coords("UV")
        t = n.new("ShaderNodeTexImage", Vector=uv, _interpolation="Linear")
        t.image = mask
        mask.colorspace_settings.name = "Non-Color"
        sep = n.new("ShaderNodeSeparateColor", Color=(t, "Color"))
        big = n.noise(1.6, 4.0, 0.6, obj)
        mid = n.noise(8.0, 5.0, 0.6, obj)
        fine = n.noise(60.0, 5.0, 0.7, obj)
        col = (n.mix((big, "Fac"), shade(color, -0.12), shade(color, 0.05)), 2)
        col = (n.mix((n.math("MULTIPLY", (mid, "Fac"), 0.3), "Value"), col, shade(color, -0.3), "MULTIPLY"), 2)
        li = n.noise(12.0, 5.0, 0.7, obj)
        lm = n.new("ShaderNodeMapRange", Value=(li, "Fac"), **{"From Min": 0.64, "From Max": 0.69, "To Min": 0.0, "To Max": 0.55})
        col = (n.mix((lm, "Result"), col, "#9a9870"), 2)
        cut = n.math("MULTIPLY", (sep, "Red"), 0.9)
        col = (n.mix((cut, "Value"), col, shade(color, -0.68)), 2)
        ao = n.new("ShaderNodeAmbientOcclusion", Distance=0.06, _samples=8, _only_local=False)
        g = n.new("ShaderNodeMapRange", Value=(ao, "AO"), **{"From Min": 0.3, "From Max": 0.95, "To Min": 0.5, "To Max": 0.0})
        col = (n.mix((g, "Result"), col, shade(color, -0.6)), 2)
        h = n.math("SUBTRACT", (fine, "Fac"), (sep, "Red"))
        bump = n.bump((h, "Value"), strength=0.45, distance=0.01)
        n.bsdf(**{"Base Color": col, "Roughness": 0.86, "Specular IOR Level": 0.3, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("inscribed", name), build)


def papyrus():
    """Papyrus sheets: pale straw, the fibres crossing, lines of brown ink
    blurred where rain reached them."""

    def build():
        n = Nodes("papyrus")
        uv = n.coords("UV")
        obj = n.coords()
        f1 = n.new("ShaderNodeTexWave", Scale=60.0, Distortion=2.0, Detail=2.0, _bands_direction="X", Vector=obj)
        f2 = n.new("ShaderNodeTexWave", Scale=60.0, Distortion=2.0, Detail=2.0, _bands_direction="Y", Vector=obj)
        fib = n.math("MULTIPLY", (f1, "Fac"), (f2, "Fac"))
        col = (n.mix((fib, "Value"), "#c8b48a", "#e2d4ae"), 2)
        sep = n.new("ShaderNodeSeparateXYZ", Vector=uv)
        lines = n.new("ShaderNodeTexWave", Scale=9.0, Distortion=0.0, Detail=0.0, _bands_direction="Y", _wave_profile="SAW", Vector=uv)
        lm = n.new("ShaderNodeMapRange", Value=(lines, "Fac"), **{"From Min": 0.0, "From Max": 0.3, "To Min": 1.0, "To Max": 0.0})
        words = n.noise(40.0, 2.0, 0.5, uv)
        wm = n.new("ShaderNodeMapRange", Value=(words, "Fac"), **{"From Min": 0.45, "From Max": 0.55, "To Min": 0.0, "To Max": 1.0})
        margin = n.new("ShaderNodeMapRange", Value=(sep, "X"), **{"From Min": 0.1, "From Max": 0.14, "To Min": 0.0, "To Max": 1.0})
        margin2 = n.new("ShaderNodeMapRange", Value=(sep, "X"), **{"From Min": 0.9, "From Max": 0.86, "To Min": 0.0, "To Max": 1.0})
        ink = n.math("MULTIPLY", (lm, "Result"), (wm, "Result"))
        ink = n.math("MULTIPLY", (ink, "Value"), (margin, "Result"))
        ink = n.math("MULTIPLY", (ink, "Value"), (margin2, "Result"))
        blur = n.noise(3.0, 3.0, 0.5, uv)
        bl = n.new("ShaderNodeMapRange", Value=(blur, "Fac"), **{"From Min": 0.55, "From Max": 0.7, "To Min": 0.0, "To Max": 0.5})
        ink = n.math("MAXIMUM", (ink, "Value"), (n.math("MULTIPLY", (bl, "Result"), 0.6), "Value"))
        col = (n.mix((ink, "Value"), col, "#4a3222"), 2)
        n.bsdf(**{"Base Color": col, "Roughness": 0.8, "Subsurface Weight": 0.1, "Subsurface Radius": (0.4, 0.35, 0.2)})
        return n.mat

    return cached(("papyrus",), build)


# ── textiles ───────────────────────────────────────────────────────────────
def wool(color, name=None, blotch=0.0):
    """Dyed wool yarn: soft fuzz, a twist in the strands, the dye a little
    uneven; `blotch` for a batch that took the dye badly (dull, mottled)."""

    def build():
        n = Nodes(name or f"wool-{color}-{blotch}")
        obj = n.coords()
        twist = n.new("ShaderNodeTexWave", Scale=40.0, Distortion=2.0, Detail=2.0, _bands_direction="DIAGONAL", Vector=obj)
        mid = n.noise(5.0, 4.0, 0.6, obj)
        col = n.mix((twist, "Fac"), shade(color, -0.2), shade(color, 0.06))
        out = (n.mix((mid, "Fac"), (col, 2), shade(color, -0.12), "MULTIPLY"), 2)
        if blotch > 0:
            bl = n.noise(3.0, 5.0, 0.7, obj)
            bm = n.new("ShaderNodeMapRange", Value=(bl, "Fac"), **{"From Min": 0.45, "From Max": 0.6, "To Min": 0.0, "To Max": blotch})
            out = (n.mix((bm, "Result"), out, _toward(color, "#8a6a58", 0.6)), 2)
        bump = n.bump((twist, "Fac"), strength=0.4, distance=0.004)
        n.bsdf(**{"Base Color": out, "Roughness": 0.95, "Sheen Weight": 0.25, "Sheen Tint": out, "Sheen Roughness": 0.6, "Normal": (bump, "Normal")})
        return n.mat

    return cached(("wool", color, name, blotch), build)


# ── pattern images ─────────────────────────────────────────────────────────
def _hex(c):
    c = c.lstrip("#")
    return np.array([int(c[i : i + 2], 16) / 255.0 for i in (0, 2, 4)])


def mosaic_design(w, h, rng, kind="field"):
    """A Roman floor design, one pixel per tessera (w x h), as an sRGB
    array: a black outer band, a white band, a guilloche (a two-strand
    braid in red and yellow on black) or a meander border, and a field of
    intersecting circles, lozenges or a checker, with a rosette at the
    centre. Stones: white limestone, black, red and yellow ochre, grey."""
    white = _hex("#e6dfcf")
    black = _hex("#2a2622")
    red = _hex("#9a3a28")
    ochre = _hex("#c69a4a")
    grey = _hex("#8a8a84")
    img = np.zeros((h, w, 3))
    img[:] = white
    ys, xs = np.mgrid[0:h, 0:w]
    # Distance to the edge (in tesserae).
    e = np.minimum(np.minimum(xs, w - 1 - xs), np.minimum(ys, h - 1 - ys))
    img[e < 4] = black
    img[(e >= 4) & (e < 8)] = white
    b0, b1 = 8, 22
    band = (e >= b0) & (e < b1)
    if kind == "field":
        # Guilloche: two sinusoidal strands interlaced along the band.
        t = np.where(np.minimum(xs, w - 1 - xs) == e, ys, xs).astype(float)
        u = (e - b0) / (b1 - b0)  # 0..1 across the band
        img[band] = black
        for phase, col in ((0.0, red), (math.pi, ochre)):
            s = 0.5 + 0.34 * np.sin(t / 7.0 * math.pi + phase)
            strand = band & (np.abs(u - s) < 0.17)
            img[strand] = col
            edge = band & (np.abs(np.abs(u - s) - 0.17) < 0.045)
            img[edge] = white
    else:
        # A running meander (key pattern) in black on white.
        img[band] = white
        t = np.where(np.minimum(xs, w - 1 - xs) == e, ys, xs)
        u = e - b0
        k = t % 14
        mask = (u == 1) | (u == 12) | ((k == 1) & (u >= 1) & (u <= 9)) | ((k == 11) & (u >= 4) & (u <= 12)) | ((u == 9) & (k >= 1) & (k <= 8)) | ((u == 4) & (k >= 4) & (k <= 11))
        img[band & mask] = black
    img[(e >= b1) & (e < b1 + 3)] = white
    img[(e >= b1 + 3) & (e < b1 + 5)] = black
    inner = e >= b1 + 5
    ix = xs - (b1 + 5)
    iy = ys - (b1 + 5)
    if kind == "field":
        # Intersecting circles: four-petalled flowers on a white ground.
        r = 12.0
        cx = (ix % (2 * r)) - r
        cy = (iy % (2 * r)) - r
        d1 = np.hypot(cx - r, cy)
        d2 = np.hypot(cx + r, cy)
        d3 = np.hypot(cx, cy - r)
        d4 = np.hypot(cx, cy + r)
        inside = [(d < r) for d in (d1, d2, d3, d4)]
        petal = (inside[0].astype(int) + inside[1] + inside[2] + inside[3]) >= 2
        img[inner & petal] = grey
        rim = inner & petal & (np.minimum.reduce([np.abs(d - r) for d in (d1, d2, d3, d4)]) < 1.2)
        img[rim] = black
        dot = inner & (np.hypot(cx, cy) < 2.2)
        img[dot] = red
    else:
        # A checker of lozenges.
        s = 10
        a = ((ix + iy) // s) % 2
        b = ((ix - iy) // s) % 2
        img[inner & (a == b)] = _hex("#d0c6b0")
        img[inner & (a == b) & (((ix + iy) % s == 0) | ((ix - iy) % s == 0))] = black
    # A rosette at the centre.
    cx, cy = w / 2, h / 2
    rr = min(w, h) * 0.22
    d = np.hypot(xs - cx, ys - cy)
    ang = np.arctan2(ys - cy, xs - cx)
    petals = rr * (0.62 + 0.38 * np.abs(np.cos(ang * 4)))
    img[d < petals + 2] = black
    img[d < petals] = red
    img[d < petals * 0.55] = ochre
    img[d < rr * 0.18] = white
    # Stones are never quite one colour.
    img = img * (0.94 + rng.random((h, w, 1)) * 0.1)
    return np.clip(img, 0, 1)


def wall_design(w, h, px_per_tile, rng, panels=None):
    """A painted wall (w x h pixels, px_per_tile per tile, top row first):
    a black dado with splashed 'marble' spots, a main zone of red ochre
    panels framed in black with thin yellow lines, narrow black strips
    between them with a thin painted candelabrum, and a white cornice band."""
    red = _hex("#8e2e1e")
    black = _hex("#1e1a18")
    ochre = _hex("#c49a44")
    cream = _hex("#e6dcc4")
    img = np.zeros((h, w, 3))
    img[:] = red
    ys, xs = np.mgrid[0:h, 0:w]
    z = (h - ys) / px_per_tile  # height above the floor, tiles
    dado = z < 0.85
    img[dado] = black
    spots = dado & (rng.random((h, w)) < 0.012)
    img[spots] = _hex("#6a5a4c")
    img[(z >= 0.85) & (z < 0.9)] = ochre
    top = z > 2.35
    img[top] = cream
    img[(z > 2.3) & (z <= 2.35)] = black
    x_t = xs / px_per_tile
    width = w / px_per_tile
    if panels is None:
        n = max(1, int(round(width / 2.2)))
        panels = [(width * i / n, width * (i + 1) / n) for i in range(n)]
    for a, b in panels:
        strip = 0.28
        img[(x_t >= a) & (x_t < a + strip) & (z >= 0.9) & (z <= 2.3)] = black
        img[(x_t >= b - strip) & (x_t < b) & (z >= 0.9) & (z <= 2.3)] = black
        cx = a + strip / 2
        cand = (np.abs(x_t - cx) < 0.012) & (z > 1.0) & (z < 2.15)
        img[cand] = ochre
        for k in range(3):
            zz = 1.3 + k * 0.3
            img[(np.abs(x_t - cx) < 0.05) & (np.abs(z - zz) < 0.008)] = ochre
        pa, pb = a + strip + 0.12, b - strip - 0.12
        frame = (x_t >= pa) & (x_t < pb) & (z >= 1.05) & (z <= 2.15)
        inner = (x_t >= pa + 0.03) & (x_t < pb - 0.03) & (z >= 1.08) & (z <= 2.12)
        img[frame & ~inner] = ochre
        # A little bird or garland in the middle of the panel.
        mx, mz = (pa + pb) / 2, 1.62
        dd = np.hypot((x_t - mx) * 1.0, (z - mz) * 1.4)
        img[(dd < 0.07) & (dd > 0.05)] = _hex("#4a6a3a")
    img = img * (0.95 + rng.random((h, w, 1)) * 0.06)
    return np.clip(img, 0, 1)


def inscription(w, h, rng, numeral="V"):
    """A milestone's lines, as a mask (1 = cut): rows of worn letter-like
    marks (not a readable text), and the mile number cut larger below.
    `rng`: a random.Random."""
    nrng = np.random.default_rng(int(rng.random() * 1e9))
    img = np.zeros((h, w))
    rows = 6
    lh = h * 0.07
    y = h * 0.1
    for r in range(rows):
        x = w * (0.18 + rng.random() * 0.05)
        end = w * (0.82 - rng.random() * 0.08)
        while x < end:
            cw = lh * (0.55 + rng.random() * 0.3)
            kind = rng.random()
            y0, y1 = int(y), int(y + lh)
            x0, x1 = int(x), int(x + cw)
            t = max(1, int(lh * 0.14))
            if kind < 0.35:
                img[y0:y1, x0 : x0 + t] = 1
            if kind < 0.6:
                img[y0:y1, x1 - t : x1] = 1
            if kind > 0.3:
                img[y0 : y0 + t, x0:x1] = 1
            if 0.45 < kind < 0.8:
                img[y1 - t : y1, x0:x1] = 1
            if kind > 0.75:
                for k in range(y1 - y0):
                    xx = x0 + int((x1 - x0) * k / max(1, y1 - y0))
                    img[y0 + k, xx : xx + t] = 1
            x += cw + lh * 0.25
        y += lh * 1.45
    # The number: bold strokes.
    ny0, ny1 = int(h * 0.68), int(h * 0.86)
    t = max(2, int((ny1 - ny0) * 0.16))
    if numeral == "V":
        cx = w // 2
        half = int((ny1 - ny0) * 0.45)
        for k in range(ny1 - ny0):
            off = int(half * (1 - k / (ny1 - ny0)))
            img[ny0 + k, cx - off - t // 2 : cx - off + t // 2] = 1
            img[ny0 + k, cx + off - t // 2 : cx + off + t // 2] = 1
    else:
        n = len(numeral)
        gap = (ny1 - ny0) * 0.35
        x0 = w / 2 - (n - 1) * gap / 2
        for i in range(n):
            cx = int(x0 + i * gap)
            img[ny0:ny1, cx - t // 2 : cx + t // 2] = 1
    # Weathered: some strokes eroded.
    img *= nrng.random((h, w)) > 0.18
    return img
