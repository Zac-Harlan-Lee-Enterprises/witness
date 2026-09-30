"""The teaser's light, air and landscape materials (EEVEE).

- `sky(scene, ...)`: Blender's multiple-scattering sky and a sun lamp in the
  same direction, the sun's size and warmth set per shot;
- `haze(scene, ...)`: aerial perspective, as a thin world volume lit by the
  sun (distant ridges fade into it, and it glows toward the sun);
- `ground(...)`: the wilderness ground, driven by attributes the land mesh
  carries per point (slope, wetness, the gorge, the road) and by the height
  (strata, the sheep tracks that contour every Judean hillside), with fine
  detail fading out with distance so nothing shimmers.

No image textures: every surface is procedural.
"""
import math

import bpy

import materials as M
from common import hex_rgb
from teaser_nodes import Graph


def sun_direction(azimuth_deg, elevation_deg):
    """Unit vector toward the sun: azimuth from east, counter-clockwise."""
    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    return (math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el))


def sky(scene, azimuth, elevation, sun_strength=4.0, sky_strength=0.3, color="#fff1dc", angle=0.53, aerosol=1.2, air=1.0, ozone=1.0, haze_density=0.0, haze_color="#c9d3df", anisotropy=0.55, altitude=700.0, bounce=0.2, bounce_color="#d9c3a0", horizon_color="#f2e2c8", horizon_height=0.22, horizon_amount=0.75, clouds=None):
    """A sky with the sun at (azimuth, elevation) degrees, haze toward the
    horizon and, with `clouds`, high cloud (see cloud_layer)."""
    for obj in [o for o in scene.objects if o.type == "LIGHT" and o.name.startswith("TeaserSun")]:
        bpy.data.objects.remove(obj, do_unlink=True)
    data = bpy.data.lights.new("TeaserSun", "SUN")
    data.energy = sun_strength
    data.color = hex_rgb(color)[:3]
    data.angle = math.radians(angle)
    sun = bpy.data.objects.new("TeaserSun", data)
    scene.collection.objects.link(sun)
    from mathutils import Vector

    to_sun = Vector(sun_direction(azimuth, elevation))
    sun.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()
    if bounce > 0:
        # Light thrown back up by the sunlit ground: warm, soft, shadowless,
        # from below and opposite the sun (screen-space GI can't reach far).
        bd = bpy.data.lights.new("TeaserSunBounce", "SUN")
        bd.energy = sun_strength * bounce
        bd.color = hex_rgb(bounce_color)[:3]
        bd.use_shadow = False
        bo = bpy.data.objects.new("TeaserSunBounce", bd)
        scene.collection.objects.link(bo)
        up = Vector(sun_direction(azimuth + 180.0, -30.0))
        bo.rotation_euler = up.to_track_quat("Z", "Y").to_euler()
    world = bpy.data.worlds.get("TeaserSky") or bpy.data.worlds.new("TeaserSky")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    sk = nt.nodes.new("ShaderNodeTexSky")
    sk.sky_type = "MULTIPLE_SCATTERING"
    sk.sun_disc = False
    sk.sun_elevation = math.radians(elevation)
    sk.sun_rotation = math.atan2(to_sun.x, to_sun.y)
    sk.altitude = altitude
    sk.air_density = air
    sk.aerosol_density = aerosol
    sk.ozone_density = ozone
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = sky_strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    # Dust and haze thicken toward the horizon: the clear sky fades, low
    # down, into a warm pale band (tinted by the sun's side).
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    band = nt.nodes.new("ShaderNodeMapRange")
    band.inputs["From Min"].default_value = 0.0
    band.inputs["From Max"].default_value = horizon_height
    band.inputs["To Min"].default_value = horizon_amount
    band.inputs["To Max"].default_value = 0.0
    band.interpolation_type = "SMOOTHSTEP"
    nt.links.new(sep.outputs["Z"], band.inputs["Value"])
    mixc = nt.nodes.new("ShaderNodeMix")
    mixc.data_type = "RGBA"
    nt.links.new(band.outputs["Result"], mixc.inputs[0])
    nt.links.new(sk.outputs["Color"], mixc.inputs[6])
    # The band: the sky's own brightness near the horizon, warmed.
    lum = nt.nodes.new("ShaderNodeRGBToBW")
    nt.links.new(sk.outputs["Color"], lum.inputs[0])
    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.blend_type = "MULTIPLY"
    tint.inputs[0].default_value = 1.0
    nt.links.new(lum.outputs[0], tint.inputs[6])
    tint.inputs[7].default_value = hex_rgb(horizon_color)
    comb = nt.nodes.new("ShaderNodeVectorMath")
    comb.operation = "SCALE"
    nt.links.new(tint.outputs[2], comb.inputs[0])
    comb.inputs["Scale"].default_value = 1.7
    nt.links.new(comb.outputs[0], mixc.inputs[7])
    colour = mixc.outputs[2]
    if clouds:
        colour = cloud_layer(nt, tc.outputs["Generated"], colour, to_sun, **clouds)
    nt.links.new(colour, bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    if haze_density > 0:
        haze(scene, haze_density, haze_color, anisotropy)
    return sun


def cloud_layer(nt, direction, sky, to_sun, kind="cirrus", cover=0.35, color="#fff4e6", shade="#b9b4b4", brightness=2.2, scale=1.0, wind=20.0, seed=0.0, height=0.02):
    """High cloud painted into the sky (the world shader): a layer at the
    height of the cloud deck seen in perspective (direction.xy / z), so it
    thins and crowds toward the horizon as real cloud does.

    kind: "cirrus" (fibrous mares' tails, drawn out along the wind),
    "alto" (altocumulus: a mottled sheet of small puffs) or "both".
    Lit by the sun: brighter and warmer toward it (forward scattering),
    greyer and darker on the side away; always brighter than the sky behind."""
    nodes, links = nt.nodes, nt.links

    def node(kind_, **inputs):
        n = nodes.new(kind_)
        for k, v in inputs.items():
            if isinstance(v, bpy.types.NodeSocket):
                links.new(v, n.inputs[k])
            else:
                n.inputs[k].default_value = v
        return n

    sep = node("ShaderNodeSeparateXYZ", Vector=direction)
    z = sep.outputs["Z"]
    zc = node("ShaderNodeMath", **{})
    zc.operation = "MAXIMUM"
    links.new(z, zc.inputs[0])
    zc.inputs[1].default_value = height
    # Onto the deck: (x, y) / z, turned so the wind blows along u.
    a = math.radians(wind)
    rot = node("ShaderNodeVectorRotate", Vector=direction, Angle=a)
    rot.rotation_type = "Z_AXIS"
    rs = node("ShaderNodeSeparateXYZ", Vector=rot.outputs[0])
    u = node("ShaderNodeMath", **{})
    u.operation = "DIVIDE"
    links.new(rs.outputs["X"], u.inputs[0])
    links.new(zc.outputs[0], u.inputs[1])
    v = node("ShaderNodeMath", **{})
    v.operation = "DIVIDE"
    links.new(rs.outputs["Y"], v.inputs[0])
    links.new(zc.outputs[0], v.inputs[1])
    uv = node("ShaderNodeCombineXYZ", X=u.outputs[0], Y=v.outputs[0], Z=seed)
    dens = None
    if kind in ("cirrus", "both"):
        # Fibres: noise stretched far along the wind, warped, in streaks.
        st = node("ShaderNodeVectorMath", Vector=uv.outputs[0])
        st.operation = "MULTIPLY"
        st.inputs[1].default_value = (0.25 * scale, 3.2 * scale, 1.0)
        fib = node("ShaderNodeTexNoise", Vector=st.outputs[0], Scale=1.6, Detail=8.0, Roughness=0.62, Distortion=0.6)
        body = node("ShaderNodeTexNoise", Vector=uv.outputs[0], Scale=0.7 * scale, Detail=3.0, Roughness=0.5)
        f = node("ShaderNodeMapRange", Value=fib.outputs["Fac"], **{"From Min": 0.52, "From Max": 0.75})
        b = node("ShaderNodeMapRange", Value=body.outputs["Fac"], **{"From Min": 0.62 - cover * 0.3, "From Max": 0.72 - cover * 0.2})
        m = node("ShaderNodeMath")
        m.operation = "MULTIPLY"
        links.new(f.outputs[0], m.inputs[0])
        links.new(b.outputs[0], m.inputs[1])
        dens = m.outputs[0]
    if kind in ("alto", "both"):
        puff = node("ShaderNodeTexVoronoi", Vector=uv.outputs[0], Scale=9.0 * scale, Randomness=0.9)
        puff.feature = "SMOOTH_F1"
        pf = node("ShaderNodeMapRange", Value=puff.outputs["Distance"], **{"From Min": 0.55, "From Max": 0.2})
        sheet = node("ShaderNodeTexNoise", Vector=uv.outputs[0], Scale=0.9 * scale, Detail=4.0, Roughness=0.55)
        sh = node("ShaderNodeMapRange", Value=sheet.outputs["Fac"], **{"From Min": 0.6 - cover * 0.25, "From Max": 0.7 - cover * 0.2})
        wisp = node("ShaderNodeTexNoise", Vector=uv.outputs[0], Scale=14.0 * scale, Detail=6.0, Roughness=0.6)
        w = node("ShaderNodeMapRange", Value=wisp.outputs["Fac"], **{"From Min": 0.35, "From Max": 0.65, "To Min": 0.55, "To Max": 1.0})
        m = node("ShaderNodeMath")
        m.operation = "MULTIPLY"
        links.new(pf.outputs[0], m.inputs[0])
        links.new(sh.outputs[0], m.inputs[1])
        m2 = node("ShaderNodeMath")
        m2.operation = "MULTIPLY"
        links.new(m.outputs[0], m2.inputs[0])
        links.new(w.outputs[0], m2.inputs[1])
        if dens is None:
            dens = m2.outputs[0]
        else:
            mx = node("ShaderNodeMath")
            mx.operation = "MAXIMUM"
            links.new(dens, mx.inputs[0])
            links.new(m2.outputs[0], mx.inputs[1])
            dens = mx.outputs[0]
    # Thin and fade toward the horizon, where the haze swallows them.
    fade = node("ShaderNodeMapRange", Value=z, **{"From Min": 0.015, "From Max": 0.16})
    fade.interpolation_type = "SMOOTHSTEP"
    d2 = node("ShaderNodeMath")
    d2.operation = "MULTIPLY"
    links.new(dens, d2.inputs[0])
    links.new(fade.outputs[0], d2.inputs[1])
    d2.use_clamp = True
    # Their light: the sky's own brightness behind them, raised, warm toward
    # the sun and grey away from it.
    dot = node("ShaderNodeVectorMath", Vector=direction)
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = tuple(to_sun)
    toward = node("ShaderNodeMapRange", Value=dot.outputs["Value"], **{"From Min": -0.2, "From Max": 1.0})
    toward.interpolation_type = "SMOOTHSTEP"
    tint = nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    links.new(toward.outputs[0], tint.inputs[0])
    tint.inputs[6].default_value = hex_rgb(shade)
    tint.inputs[7].default_value = hex_rgb(color)
    lum = node("ShaderNodeRGBToBW", Color=sky)
    glow = node("ShaderNodeMath")
    glow.operation = "MULTIPLY"
    links.new(lum.outputs[0], glow.inputs[0])
    gain = node("ShaderNodeMapRange", Value=toward.outputs[0], **{"To Min": brightness * 0.7, "To Max": brightness * 1.5})
    links.new(gain.outputs[0], glow.inputs[1])
    lit = node("ShaderNodeVectorMath", Vector=tint.outputs[2])
    lit.operation = "SCALE"
    links.new(glow.outputs[0], lit.inputs["Scale"])
    out = nodes.new("ShaderNodeMix")
    out.data_type = "RGBA"
    links.new(d2.outputs[0], out.inputs[0])
    links.new(sky, out.inputs[6])
    links.new(lit.outputs[0], out.inputs[7])
    return out.outputs[2]


def haze(scene, density, color="#c9d3df", anisotropy=0.55, ground=0.0, scale_height=900.0, size=60000.0, centre=(0.0, 0.0)):
    """Aerial perspective: a vast box of thin, sunlit air whose density falls
    off with height (thicker in the valleys). EEVEE absorbs the sky's light
    in a world volume, so the air is an object instead."""
    for obj in [o for o in scene.objects if o.name == "TeaserHaze"]:
        bpy.data.objects.remove(obj, do_unlink=True)
    me = bpy.data.meshes.new("TeaserHaze")
    s = size / 2
    lo, hi = ground - 1500.0, ground + 6000.0
    verts = [(centre[0] + x, centre[1] + y, z) for z in (lo, hi) for y in (-s, s) for x in (-s, s)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    me.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new("TeaserHaze", me)
    scene.collection.objects.link(obj)
    g = Graph("teaser-haze")
    _, _, z = g.xyz(g.position())
    falloff = g.math("EXPONENT", g.math("DIVIDE", g.sub(ground, z), scale_height))
    dens = g.mul(g.math("MINIMUM", falloff, 3.0), density)
    vol = g.node("ShaderNodeVolumePrincipled", {"Color": color, "Density": dens, "Anisotropy": anisotropy})
    g.nt.links.new(vol.outputs["Volume"], g.out.inputs["Volume"])
    me.materials.append(g.mat)
    obj.visible_shadow = False
    return obj


def eevee(scene, samples=64, volume_end=20000.0, volume_tile="4", preview=False):
    """EEVEE for film: ray-traced reflections and GI (screen space with the
    world as fallback), soft shadows, volumetrics reaching the horizon."""
    scene.render.engine = "BLENDER_EEVEE"
    e = scene.eevee
    e.taa_render_samples = samples
    e.use_raytracing = True
    e.ray_tracing_method = "SCREEN"
    e.use_shadows = True
    e.shadow_ray_count = 1 if preview else 3
    e.shadow_step_count = 6 if preview else 12
    e.shadow_resolution_scale = 0.5 if preview else 1.0
    e.use_fast_gi = True
    e.fast_gi_method = "GLOBAL_ILLUMINATION"
    e.fast_gi_resolution = "2" if not preview else "4"
    e.fast_gi_distance = 0.0
    e.volumetric_start = 0.5
    e.volumetric_end = volume_end
    e.volumetric_tile_size = "8" if preview else volume_tile
    e.volumetric_samples = 32 if preview else 96
    e.volumetric_sample_distribution = 0.92
    e.use_volumetric_shadows = True
    e.volumetric_shadow_samples = 8 if preview else 24
    e.clamp_surface_indirect = 10.0
    e.use_overscan = True
    e.overscan_size = 0.06
    opts = e.ray_tracing_options
    for k, v in (("resolution_scale", "2" if preview else "1"), ("use_denoise", True), ("denoise_temporal", True), ("denoise_bilateral", True), ("screen_trace_quality", 0.5 if preview else 0.85)):
        try:
            setattr(opts, k, v)
        except (AttributeError, TypeError):
            pass
    r = scene.render
    r.film_transparent = False
    r.use_persistent_data = True
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass


def dust(scene, lo, hi, density=0.02, color="#e8dcc8", anisotropy=0.6, name="TeaserDust", noise=0.5):
    """Dust hanging in the air of a street or a room (a box from lo to hi):
    it shows the sunbeams. Thinner toward the top, a little uneven."""
    me = bpy.data.meshes.new(name)
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    verts = [(x, y, z) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    me.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, me)
    scene.collection.objects.link(obj)
    g = Graph(f"{name}-mat")
    pos = g.position()
    _, _, z = g.xyz(pos)
    fall = g.map(z, z0, z1, 1.0, 0.25)
    uneven = g.map(g.noise(pos, 0.35, 3.0, 0.5), 0.3, 0.7, 1.0 - noise, 1.0 + noise)
    dens = g.mul(g.mul(fall, uneven), density)
    vol = g.node("ShaderNodeVolumePrincipled", {"Color": color, "Density": dens, "Anisotropy": anisotropy})
    g.nt.links.new(vol.outputs["Volume"], g.out.inputs["Volume"])
    me.materials.append(g.mat)
    obj.visible_shadow = False
    return obj


GROUND = {
    "soil": "#b0936c", "chalk": "#cdb993", "crust": "#94795a", "rock": "#d4bf98", "rock_dark": "#9c8060",
    "red": "#ae7652", "gully": "#8c7152", "road": "#cfbb94", "veg": "#5c5a44", "floor": "#cdbc98",
    "gravel": "#6f5c46", "track": "#d3c19c", "band": "#b89a72",
}


def ground(name="judean-ground", palette=None):
    """The wilderness: tan soil and pale chalk, grey-brown crust, limestone
    ledges on steep ground (banded by strata), reddish rock in places, darker
    soil where water runs, the road trodden pale, and the sheep tracks that
    contour the slopes (faded out with distance so they never shimmer)."""
    pal = dict(GROUND)
    pal.update(palette or {})

    def build():
        g = Graph(name)
        pos = g.position()
        _, _, z = g.xyz(pos)
        slope, wet, gorge = g.attr("slope"), g.attr("wet"), g.attr("gorge")
        road, path = g.attr("road"), g.attr("path")
        big = g.noise(pos, 1.0 / 420.0, 3.0, 0.5)
        mid = g.noise(pos, 1.0 / 60.0, 4.0, 0.55)
        small = g.noise(pos, 1.0 / 6.0, 4.0, 0.6)
        redz = g.noise(pos, 1.0 / 1100.0, 2.0, 0.5)
        col = g.mix(g.smooth(big, 0.4, 0.66), pal["soil"], pal["chalk"])
        col = g.mix(g.smooth(redz, 0.55, 0.7, 0.0, 0.5), col, pal["red"])
        col = g.mix(g.smooth(mid, 0.48, 0.72, 0.0, 0.45), col, pal["crust"])
        # Gravel and flint over the soil (desert pavement): single stones near,
        # their average tone further off.
        cover = g.smooth(g.noise(pos, 1.0 / 25.0, 3.0, 0.5), 0.3, 0.7, 0.25, 0.75)
        stones = g.map(g.voronoi(pos, 16.0, 1.0), 0.0, 0.32, 1.0, 0.0)
        near_stones = g.mixf(g.fade(10.0, 45.0), 0.32, g.smooth(stones, 0.35, 0.6))
        col = g.mix(g.mul(near_stones, cover), col, pal["gravel"])
        # Limestone where the ground stands steep: the risers of the benches,
        # the gorge's walls. Pale, streaked darker downward by weathering.
        rock_f = g.smooth(g.add(slope, g.mul(small, 0.3)), 0.62, 0.95)
        streak = g.noise(g.vmath("MULTIPLY", pos, (1.0, 1.0, 0.3)), 0.12, 5.0, 0.6)
        blotch = g.noise(pos, 0.08, 3.0, 0.5)
        rock_col = g.mix(g.smooth(g.add(g.mul(streak, 0.6), g.mul(blotch, 0.4)), 0.35, 0.7, 0.25, 1.0), pal["rock_dark"], pal["rock"])
        # Strata: beds of uneven thickness, some harder and paler, some
        # softer and browner, wavering along the face and pinching out.
        zb = g.add(z, g.mul(g.noise(pos, 1.0 / 90.0, 2.0), 6.0))
        beds = g.noise(g.vec(0.0, 0.0, zb), 0.35, 3.0, 0.6)
        rock_col = g.mix(g.smooth(beds, 0.45, 0.62, 0.0, 0.7), rock_col, pal["band"])
        thin = g.noise(g.vmath("MULTIPLY", pos, (0.02, 0.02, 1.0)), 1.1, 3.0, 0.6)
        rock_col = g.mix(g.mul(g.smooth(thin, 0.56, 0.68), g.smooth(g.noise(pos, 1.0 / 25.0, 2.0), 0.4, 0.6)), rock_col, "#e2d2b2")
        # Vertical joints between blocks, dark in their depths; desert
        # varnish streaking down the face from the lips of the beds; pale
        # fresh scars where blocks have spalled away.
        x_, y_, _ = g.xyz(pos)
        joints = g.voronoi(g.vmath("MULTIPLY", pos, (1.0, 1.0, 0.12)), 0.22, 1.0, "Distance", "DISTANCE_TO_EDGE")
        joint = g.map(joints, 0.0, 0.05, 1.0, 0.0)
        rock_col = g.mix(g.mul(joint, 0.6), rock_col, "#5e5044")
        varnish = g.noise(g.vmath("MULTIPLY", pos, (1.6, 1.6, 0.08)), 0.5, 4.0, 0.6)
        rock_col = g.mix(g.mul(g.smooth(varnish, 0.5, 0.72), 0.55), rock_col, "#6a5a4a", "MULTIPLY")
        scar = g.smooth(g.noise(g.vmath("ADD", pos, (40.0, 7.0, 3.0)), 1.0 / 7.0, 3.0, 0.6), 0.64, 0.7)
        rock_col = g.mix(g.mul(scar, 0.6), rock_col, "#e8dcc2")
        _ = (x_, y_)
        col = g.mix(rock_f, col, rock_col)
        col = g.mix(g.mul(wet, 0.5), col, pal["gully"])
        col = g.mix(g.smooth(gorge, 0.82, 0.96), col, pal["floor"])
        # Sheep tracks along the contours: broken, irregular, pale.
        tr = g.math("FRACT", g.math("DIVIDE", g.add(z, g.mul(mid, 2.2)), 1.3))
        line = g.map(tr, 0.0, 0.16, 1.0, 0.0)
        broken = g.smooth(g.noise(pos, 1.0 / 30.0, 2.0, 0.5), 0.42, 0.58)
        tracks_base = g.mul(g.mul(line, broken), g.mul(g.smooth(slope, 0.18, 0.38), g.smooth(slope, 0.62, 0.8, 1.0, 0.0)))
        tracks = g.mul(tracks_base, g.fade(200.0, 520.0))
        # For relief the mask (built from the mesh's slope attribute) only
        # scales the bump's strength: in the height its kinks at every
        # triangle edge showed as a faint grid over the slopes.
        tracks_line = g.mul(line, broken)
        tracks_mask = g.mul(g.mul(g.smooth(slope, 0.18, 0.38), g.smooth(slope, 0.62, 0.8, 1.0, 0.0)), g.fade(15.0, 70.0))
        col = g.mix(g.mul(tracks, 0.4), col, pal["track"])
        # Each track's riser, just below it, a line of shade: from afar the
        # tracks read as the fine contour lines of every Judean hillside.
        riser = g.mul(g.mul(g.map(tr, 0.16, 0.22, 0.0, 1.0), g.map(tr, 0.3, 0.42, 1.0, 0.0)), g.mul(broken, g.mul(g.smooth(slope, 0.18, 0.38), g.fade(40.0, 520.0))))
        col = g.mix(g.mul(riser, 0.25), col, "#7a6650")
        # Far off, where the mesh no longer carries them: hard beds of rock
        # cropping out along the contours in broken pale bands with a shaded
        # foot, and broad patches of pale chalk and darker crust.
        far_f = g.map(g.distance(), 120.0, 400.0)
        zb2 = g.add(z, g.mul(g.noise(pos, 1.0 / 60.0, 2.0), 4.0))
        stratum = g.math("FRACT", g.math("DIVIDE", zb2, 9.5))
        crop = g.mul(g.map(stratum, 0.0, 0.07, 1.0, 0.0), g.smooth(g.noise(pos, 1.0 / 45.0, 3.0), 0.5, 0.62))
        crop = g.mul(g.mul(crop, far_f), g.smooth(slope, 0.15, 0.45))
        col = g.mix(g.mul(crop, 0.5), col, "#e0d2b4")
        foot = g.mul(g.mul(g.map(stratum, 0.07, 0.12, 0.0, 1.0), g.map(stratum, 0.12, 0.2, 1.0, 0.0)), g.mul(far_f, g.smooth(slope, 0.15, 0.45)))
        col = g.mix(g.mul(g.mul(foot, g.smooth(g.noise(pos, 1.0 / 45.0, 3.0), 0.5, 0.62)), 0.35), col, "#6e5c48")
        patches = g.noise(pos, 1.0 / 220.0, 4.0, 0.6)
        col = g.mix(g.mul(g.smooth(patches, 0.52, 0.66), g.mul(far_f, 0.35)), col, "#d9c9a8")
        col = g.mix(g.mul(g.smooth(patches, 0.42, 0.3), g.mul(far_f, 0.3)), col, "#8a7258")
        # Hollows hold shade and darker soil.
        col = g.mix(g.mul(wet, 0.25), col, "#6f604c", "MULTIPLY")
        # Far vegetation: sparse dark specks where shrubs would be.
        speck = g.map(g.voronoi(pos, 1.0 / 4.0), 0.08, 0.16, 1.0, 0.0)
        speck = g.mul(g.mul(speck, g.add(g.mul(wet, 0.9), 0.12)), g.map(g.distance(), 250.0, 420.0))
        col = g.mix(speck, col, pal["veg"])
        tread = g.math("MAXIMUM", road, g.mul(path, 0.7))
        col = g.mix(tread, col, pal["road"])
        # The road: a compacted crust, finely cracked, darker in the ruts.
        rut = g.attr("rut")
        crack = g.map(g.voronoi(pos, 8.0, 1.0, "Distance", "DISTANCE_TO_EDGE"), 0.0, 0.02, 1.0, 0.0)
        broken_c = g.smooth(g.noise(pos, 1.3, 3.0), 0.45, 0.62)
        crust_h = g.mul(crack, broken_c)
        crust_mask = g.mul(tread, g.fade(1.5, 14.0))
        crust = g.mul(crust_h, crust_mask)
        col = g.mix(g.mul(crust, 0.28), col, "#8c7a60")
        col = g.mix(g.mul(rut, 0.4), col, "#a08a6a")
        # Far off: the stony skin of the slopes, rock breaking through where steep.
        far = g.map(g.distance(), 60.0, 250.0)
        scree = g.smooth(g.noise(pos, 1.0 / 7.0, 4.0, 0.65), 0.52, 0.7)
        stony = g.mul(g.mul(scree, far), g.add(0.35, g.mul(g.smooth(slope, 0.2, 0.6), 0.65)))
        col = g.mix(g.mul(stony, 0.7), col, "#7e6c56")
        bright = g.mul(g.mul(g.smooth(g.noise(pos, 1.0 / 5.0, 3.0), 0.62, 0.72), far), g.smooth(slope, 0.3, 0.7))
        col = g.mix(g.mul(bright, 0.5), col, "#dccdb0")
        # Stones lying on the slopes at every distance: each stone's own
        # size decides how far off it still shows (big ones far, grit near),
        # so no slope reads as clean sand.
        for scale, near_, far_, amount, tone in ((1.6, 25.0, 140.0, 0.55, "#e0d3b6"), (5.0, 8.0, 50.0, 0.5, "#8a7560"), (0.45, 60.0, 400.0, 0.4, "#d8cbae")):
            cells = g.voronoi(pos, scale, 1.0, "Distance")
            pick = g.xyz(g.voronoi(pos, scale, 1.0, "Color"))[0]
            stone = g.mul(g.map(cells, 0.12, 0.3, 1.0, 0.0), g.math("GREATER_THAN", pick, 0.55))
            col = g.mix(g.mul(g.mul(stone, amount), g.fade(near_, far_)), col, tone)
        # Tone varies in patches, never in ripples: the fine variation
        # fades out before it could alias into a dune's ripples.
        var = g.mixf(g.fade(8.0, 40.0), g.map(g.noise(pos, 1.0 / 14.0, 4.0, 0.55), 0.3, 0.7, 0.9, 1.08), g.map(g.noise(pos, 3.0, 5.0, 0.6), 0.3, 0.7, 0.9, 1.07))
        col = g.mix(1.0, col, g.rgb(var), "MULTIPLY")
        # Close up: fine grains and a thin crust over the dust.
        micro = g.fade(1.0, 12.0)
        grains = g.map(g.voronoi(pos, 140.0), 0.0, 0.35, 1.0, 0.0)
        col = g.mix(g.mul(g.mul(grains, 0.4), micro), col, "#7f6c56")
        # Small stones set in the trodden dust.
        grit_cells = g.voronoi(pos, 34.0, 1.0, "Distance")
        grit_pick = g.voronoi(pos, 34.0, 1.0, "Color")
        embedded = g.mul(g.map(grit_cells, 0.0, 0.2, 1.0, 0.0), g.math("GREATER_THAN", g.xyz(grit_pick)[0], 0.72))
        col = g.mix(g.mul(embedded, micro), col, g.mix(g.xyz(grit_pick)[1], "#8a7658", "#d6c8a8"))
        crumb = g.noise(pos, 70.0, 4.0, 0.7)
        col = g.mix(g.mul(g.smooth(crumb, 0.55, 0.7, 0.0, 0.2), micro), col, "#ddd0b4")
        # Oil soaked into the dust long ago: dark, dull, a faint sheen left.
        oil = g.attr("oil")
        col = g.mix(g.mul(oil, 0.85), col, "#3f3226", "MULTIPLY")
        # Relief: stones and grit near, tracks and lumps further off.
        peb = g.mul(g.smooth(stones, 0.3, 0.7), g.mul(cover, g.fade(4.0, 18.0)))
        grit = g.mul(g.noise(pos, 40.0, 3.0, 0.7), g.fade(3.0, 12.0))
        lumps = g.mul(small, g.fade(80.0, 300.0))
        fine_h = g.mul(g.add(g.add(g.mul(grains, 0.3), g.mul(crumb, 0.3)), g.mul(embedded, 0.8)), micro)
        h = g.add(g.add(peb, g.mul(grit, 0.4)), g.mul(lumps, 3.0))
        rough = g.mixf(g.mul(oil, 0.6), g.map(tread, 0.0, 1.0, 0.95, 0.84), 0.62)
        normal = g.bump(h, 0.35, 0.05)
        normal = g.bump(g.math("ABSOLUTE", tracks_line), g.mul(tracks_mask, 0.5), -0.075, normal=normal)
        normal = g.bump(crust_h, g.mul(crust_mask, 0.3), -0.05, normal=normal)
        normal = g.bump(joints, g.mul(rock_f, 0.5), 0.3, normal=normal)
        normal = g.bump(fine_h, 0.6, 0.002, normal=normal)
        g.principled(col, rough, 0.12, normal)
        return g.mat

    return M.cached(("teaser-ground", name), build)


