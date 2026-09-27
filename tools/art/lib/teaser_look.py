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


def sky(scene, azimuth, elevation, sun_strength=4.0, sky_strength=0.3, color="#fff1dc", angle=0.53, aerosol=1.2, air=1.0, ozone=1.0, haze_density=0.0, haze_color="#c9d3df", anisotropy=0.55, altitude=700.0, bounce=0.2, bounce_color="#d9c3a0"):
    """A clear sky with the sun at (azimuth, elevation) degrees, and haze."""
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
    nt.links.new(sk.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    if haze_density > 0:
        haze(scene, haze_density, haze_color, anisotropy)
    return sun


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
        # softer and browner, wavering along the face.
        zb = g.add(z, g.mul(g.noise(pos, 1.0 / 90.0, 2.0), 6.0))
        beds = g.noise(g.vec(0.0, 0.0, zb), 0.35, 3.0, 0.6)
        rock_col = g.mix(g.smooth(beds, 0.45, 0.62, 0.0, 0.7), rock_col, pal["band"])
        fine_beds = g.math("SINE", g.mul(zb, 2.3))
        rock_col = g.mix(g.mul(g.map(fine_beds, 0.6, 1.0), 0.25), rock_col, "#e2d2b2")
        col = g.mix(rock_f, col, rock_col)
        col = g.mix(g.mul(wet, 0.5), col, pal["gully"])
        col = g.mix(g.smooth(gorge, 0.82, 0.96), col, pal["floor"])
        # Sheep tracks along the contours: broken, irregular, pale.
        tr = g.math("FRACT", g.math("DIVIDE", g.add(z, g.mul(mid, 2.2)), 1.3))
        line = g.map(tr, 0.0, 0.16, 1.0, 0.0)
        broken = g.smooth(g.noise(pos, 1.0 / 30.0, 2.0, 0.5), 0.42, 0.58)
        tracks_base = g.mul(g.mul(line, broken), g.mul(g.smooth(slope, 0.18, 0.38), g.smooth(slope, 0.62, 0.8, 1.0, 0.0)))
        tracks = g.mul(tracks_base, g.fade(200.0, 520.0))
        tracks_bump = g.mul(tracks_base, g.fade(15.0, 70.0))
        col = g.mix(g.mul(tracks, 0.28), col, pal["track"])
        # Hollows hold shade and darker soil.
        col = g.mix(g.mul(wet, 0.25), col, "#6f604c", "MULTIPLY")
        # Far vegetation: sparse dark specks where shrubs would be.
        speck = g.map(g.voronoi(pos, 1.0 / 4.0), 0.08, 0.16, 1.0, 0.0)
        speck = g.mul(g.mul(speck, g.add(g.mul(wet, 0.9), 0.12)), g.map(g.distance(), 250.0, 420.0))
        col = g.mix(speck, col, pal["veg"])
        tread = g.math("MAXIMUM", road, g.mul(path, 0.7))
        col = g.mix(tread, col, pal["road"])
        var = g.map(g.noise(pos, 3.0, 5.0, 0.6), 0.3, 0.7, 0.9, 1.07)
        col = g.mix(1.0, col, g.rgb(var), "MULTIPLY")
        # Close up: fine grains and a thin crust over the dust.
        micro = g.fade(0.6, 5.0)
        grains = g.map(g.voronoi(pos, 140.0), 0.0, 0.35, 1.0, 0.0)
        col = g.mix(g.mul(g.mul(grains, 0.25), micro), col, "#7f6c56")
        crumb = g.noise(pos, 70.0, 4.0, 0.7)
        col = g.mix(g.mul(g.smooth(crumb, 0.55, 0.7, 0.0, 0.2), micro), col, "#ddd0b4")
        # Oil soaked into the dust long ago: dark, dull, a faint sheen left.
        oil = g.attr("oil")
        col = g.mix(g.mul(oil, 0.85), col, "#3f3226", "MULTIPLY")
        # Relief: stones and grit near, tracks and lumps further off.
        peb = g.mul(g.smooth(stones, 0.3, 0.7), g.mul(cover, g.fade(4.0, 18.0)))
        grit = g.mul(g.noise(pos, 40.0, 3.0, 0.7), g.fade(3.0, 12.0))
        lumps = g.mul(small, g.fade(80.0, 300.0))
        fine_h = g.mul(g.add(g.mul(grains, 0.3), g.mul(crumb, 0.3)), micro)
        h = g.add(g.add(peb, g.mul(grit, 0.4)), g.add(g.mul(lumps, 3.0), g.mul(tracks_bump, -1.5)))
        rough = g.mixf(g.mul(oil, 0.6), g.map(tread, 0.0, 1.0, 0.95, 0.84), 0.62)
        normal = g.bump(fine_h, 0.6, 0.002, normal=g.bump(h, 0.35, 0.05))
        g.principled(col, rough, 0.12, normal)
        return g.mat

    return M.cached(("teaser-ground", name), build)


