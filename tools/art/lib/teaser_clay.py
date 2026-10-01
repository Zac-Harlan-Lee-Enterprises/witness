"""Fired clay for the teaser, seen close (the remedy flask fills the frame
in shot 2; the broken oil jar lies a metre from the lens in shot 6).

Common pottery of the period was thrown on the wheel from an iron-rich
clay tempered with grit and fired in a kiln whose heat never reached every
pot alike. So no two square centimetres match:

- the colour of the firing: orange-red where the air reached it, dull
  grey-brown "fire clouds" where it did not, pale blushes;
- the wheel's rings: shallow spiral ridges round the body, wavering;
- temper: white specks of lime and darker grits in the surface, fine pits
  where lime burst out ("lime spalling");
- a slip wiped thin in places, a faint sheen where hands have rubbed it;
- dust settled low and in the pores.

`fired_clay(...)` is the outer surface; `clay_core(...)` a broken edge,
with the grey core of a pot fired too briefly to oxidise right through
(point attribute `depth`: 0 at the outer face, 1 at the inner);
`wobble(obj, ...)` puts a potter's hand into a lathed shape (nothing
thrown is perfectly round or perfectly upright).

Coordinates are the object's own, in metres, the pot standing on z = 0.
"""
from mathutils import Vector
from mathutils import noise as mnoise

import teaser_city as C
from teaser_nodes import Graph


def fired_clay(name, base="#b0724a", reduced="#6e5a4a", pale="#caa27e", dust=0.35, sheen=0.0, ring_pitch=0.007, scale=1.0):
    """The outer surface of a thrown, fired pot (see the module's notes).
    `scale` enlarges every feature for bigger pots."""

    def build():
        g = Graph(name)
        pos = g.coords("Object")
        _, _, z = g.xyz(pos)
        p = g.vmath("SCALE", pos, scale=1.0 / scale)
        # The firing: oxidised body, fire clouds, pale blushes.
        body = g.mix(g.map(g.noise(p, 9.0, 4.0, 0.55), 0.3, 0.7), base, g.hsv(base, 0.5, 1.05, 1.08))
        cloud = g.smooth(g.noise(g.vmath("ADD", p, (3.1, 0.4, 7.7)), 4.0, 4.0, 0.6), 0.52, 0.68)
        col = g.mix(g.mul(cloud, 0.9), body, reduced)
        blush = g.smooth(g.noise(g.vmath("ADD", p, (9.3, 2.2, 1.1)), 6.0, 3.0, 0.5), 0.58, 0.7)
        col = g.mix(g.mul(blush, 0.5), col, pale)
        # Slip wiped thin: patches a little lighter and yellower.
        slip = g.smooth(g.noise(p, 18.0, 3.0, 0.6), 0.55, 0.66)
        col = g.mix(g.mul(slip, 0.3), col, "#c79a74")
        # Temper: white lime specks, dark grits, and pits where lime burst.
        lime = g.map(g.voronoi(g.vmath("ADD", p, (1.3, 0.0, 0.0)), 420.0), 0.0, 0.12, 1.0, 0.0)
        lime_pick = g.math("GREATER_THAN", g.xyz(g.voronoi(g.vmath("ADD", p, (1.3, 0.0, 0.0)), 420.0, 1.0, "Color"))[0], 0.8)
        col = g.mix(g.mul(g.mul(lime, lime_pick), 0.85), col, "#e6ddcc")
        grit = g.map(g.voronoi(p, 650.0), 0.0, 0.15, 1.0, 0.0)
        grit_pick = g.math("GREATER_THAN", g.xyz(g.voronoi(p, 650.0, 1.0, "Color"))[1], 0.8)
        col = g.mix(g.mul(g.mul(grit, grit_pick), 0.7), col, "#4a3a30")
        spall = g.map(g.voronoi(g.vmath("ADD", p, (0.0, 5.5, 0.0)), 140.0), 0.0, 0.1, 1.0, 0.0)
        spall_pick = g.math("GREATER_THAN", g.xyz(g.voronoi(g.vmath("ADD", p, (0.0, 5.5, 0.0)), 140.0, 1.0, "Color"))[2], 0.88)
        pits = g.mul(spall, spall_pick)
        col = g.mix(g.mul(pits, 0.6), col, "#5a4232")
        # Dust: low down, and in every pore and ring.
        low = g.map(z, 0.0, 0.18 * scale, dust, 0.0)
        pores = g.map(g.voronoi(p, 900.0), 0.0, 0.25, 1.0, 0.0)
        col = g.mix(g.add(low, g.mul(pores, 0.18)), col, "#cdb898")
        # The wheel's rings, wavering round the pot.
        wave = g.add(g.mul(z, 6.2832 / (ring_pitch * scale)), g.mul(g.noise(p, 8.0, 2.0), 3.0))
        rings = g.mul(g.math("SINE", wave), g.map(g.noise(p, 5.0, 2.0), 0.35, 0.75, 0.05, 1.0))
        col = g.mix(g.mul(g.map(rings, -1.0, 1.0), 0.06), col, "#8a5a3a", "MULTIPLY")
        h = g.add(g.mul(rings, 0.5), g.add(g.mul(g.noise(p, 90.0, 4.0, 0.6), 0.4), g.mul(pits, -1.2)))
        h = g.add(h, g.mul(lime, g.mul(lime_pick, 0.4)))
        rough = g.map(slip, 0.0, 1.0, 0.86 - sheen, 0.78 - sheen)
        g.principled(col, rough, 0.3, g.bump(h, 0.45, 0.0008 * scale))
        return g.mat

    return C._cached(name, build)


def clay_core(name, base="#b0724a", core="#5e5650"):
    """A fresh break through the wall: coarse, granular, its grits sharp,
    and a grey core between orange skins (attribute `depth`, 0..1)."""

    def build():
        g = Graph(name)
        pos = g.coords("Object")
        depth = g.attr("depth")
        mid = g.mul(g.smooth(depth, 0.18, 0.38), g.smooth(depth, 0.82, 0.62))
        col = g.mix(g.mul(mid, 0.85), base, core)
        grain = g.noise(pos, 700.0, 3.0, 0.7)
        col = g.mix(g.mul(g.map(grain, 0.4, 0.8), 0.35), col, "#e2d6c4")
        grit = g.map(g.voronoi(pos, 500.0), 0.0, 0.2, 1.0, 0.0)
        pick = g.math("GREATER_THAN", g.xyz(g.voronoi(pos, 500.0, 1.0, "Color"))[0], 0.7)
        col = g.mix(g.mul(grit, pick), col, "#ece4d6")
        g.principled(col, 0.95, 0.2, g.bump(g.add(grain, g.mul(grit, pick)), 0.7, 0.0004))
        return g.mat

    return C._cached(name, build)


def wobble(obj, amount=0.0012, lean=0.004, seed=0):
    """Push a lathed pot's vertices off true: a slow wobble round its body
    (a thrown pot is never quite round), a slight lean with height."""
    o = Vector((seed * 1.37, seed * 0.71, seed * 2.3))
    me = obj.data
    for v in me.vertices:
        c = v.co
        r = (c.x * c.x + c.y * c.y) ** 0.5
        if r < 1e-5:
            continue
        n = mnoise.noise(Vector((c.x * 9.0, c.y * 9.0, c.z * 14.0)) + o)
        k = 1.0 + amount * n / max(r, 0.01)
        v.co = Vector((c.x * k + lean * c.z, c.y * k, c.z))
    me.update()
    return obj


