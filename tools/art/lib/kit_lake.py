"""The Sea of Galilee (Chapter 2): the shore at Capernaum, the open lake,
the boats, and a fisher family's house.

Kinds built here:

  ground   `shingle`  a beach of rounded basalt and limestone pebbles, wet
                      and dark at the water's edge
           `deck`     the planked deck of the boat you are aboard
           `jetty`    a landing stage of big dressed basalt blocks, running
                      out into the lake, with pierced mooring stones
  solid    `lake`     open water: a surface that refracts, reflects the sky
                      and darkens with depth over a bed that falls away
           `shallows` shallow water over pebbles, with foam where it laps
           `hull`, `mast`, `boat`   the boats (lake_boats.py)
           `nets`     nets hung between poles to dry (floats and sinkers)
           `rack`     a rack of split fish drying on trestles

and the story's props (`entity_<sprite>`): jars of salted fish, a bailer,
rope, an oar, a pile of net, jars floating in the lake, a towline, a
basket of fish.

The lakeside is its own style, `lake` (any scene with lake water or a
boat's deck): its houses are the black basalt of Capernaum, not mudbrick,
laid dry in rough courses and roofed with beams, branches and packed mud;
lanes and yards are paved with basalt. A room in a Galilee chapter (the
`home` style) gets basalt walls and a basalt-cobbled earth floor.

Heights: every surface people stand on is the terrain (heights in tiles,
sheared to the view as terrain.py explains): the beach slopes down to the
waterline, the jetty stands above the water, a boat's deck is a plateau
inside its hull, and the beds of the shallows and the lake fall away under
the water surface, so a point found with `P` is always on what is walked on.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import lake_materials as L
import materials as M
import scatter
import terrain
from lake_boats import BoatsMixin
from lake_houses import HousesMixin

# Mirrors TILE_KINDS in src/domain/world.ts: which lake kinds block movement.
LAKE_SOLID = {"lake", "shallows", "hull", "mast", "boat", "nets", "rack"}
WATER = {"lake", "shallows"}
# Chapters set on the lake: dark basalt country.
GALILEE = {"storm-on-galilee"}

# The water surface (tiles, relative to the dry ground of the shore) and the
# top of the jetty. Aboard, the deck is the ground and the lake stands
# below it (the freeboard).
Z_SHORE_WATER = -0.12
Z_JETTY = 0.3
# How far the joints between the jetty's top blocks go down.
JOINT = 0.06
Z_OPEN_WATER = -0.34

LAKE_GROUND = {
    "lake": {
        "layers": ["soil", "grass", "path", "yard", "shingle", "bed", "silt", "reedbed", "deck", "jetty"],
        "kinds": {
            "scrub": "grass",
            "sand": "path",
            "paving": "yard",
            "shingle": "shingle",
            "shallows": "bed",
            "lake": "silt",
            "reeds": "reedbed",
            "palm": "grass",
            "fig": "grass",
            "olive": "grass",
            "deck": "deck",
            "hull": "deck",
            "mast": "deck",
            "jetty": "jetty",
            "door": "path",
            "wall": "soil",
            "roof": "soil",
        },
    },
}

LAKE_LOOKS = {
    # Dark basalt soil, brown-black, with grit.
    "soil": {"color": "#9a8a72", "grit": 0.45, "scale": "mid", "dark": 0.14, "light": 0.08, "mottle": 0.3, "mottle_color": "#5a4b3c"},
    # The lake shore's grass in summer: dry and gold, green in patches where it is watered.
    "grass": {"color": "#bfae78", "scale": "mid", "dark": 0.16, "light": 0.1, "mottle": 0.4, "mottle_color": "#7e8a4c"},
    # Paths trodden bare: brown earth with basalt grit.
    "path": {"color": "#aa9c84", "grit": 0.55, "dark": 0.08, "light": 0.08, "mottle": 0.2, "mottle_color": "#827260"},
    "yard": {"color": "#978974", "grit": 0.5, "scale": "mid", "dark": 0.1, "light": 0.06},
    # Under the pebbles: coarse grey grit.
    "shingle": {"color": "#8e877c", "grit": 0.7, "scale": "mid", "dark": 0.12, "light": 0.1, "mottle": 0.35, "mottle_color": "#a09684", "rough": 0.8},
    # The bed under shallow water: pebbles in pale sand, a little weed.
    "bed": {"color": "#a89c80", "grit": 0.6, "scale": "mid", "mottle": 0.5, "mottle_color": "#4d5a3a", "chips": 0.4, "rough": 0.7},
    # The deep bed: silt.
    # The deep bed carries the colour of the depths (the water only absorbs).
    "silt": {"color": "#3f6e69", "scale": "mid", "mottle": 0.35, "mottle_color": "#2f5a5c", "rough": 0.8},
    "reedbed": {"color": "#4a4230", "scale": "mid", "mottle": 0.5, "mottle_color": "#3a4426", "rough": 0.5},
    "deck": {"color": "#7a6450"},
    "jetty": {"color": "#242220", "rough": 0.9},
}

# A fisher family's room in basalt country.
GALILEE_HOME_LOOKS = {
    "floor": {"color": "#6e5c48", "grit": 0.45, "scale": "mid", "dark": 0.16, "light": 0.08, "chips": 0.2, "mottle": 0.35, "mottle_color": "#54463a", "cracks": 0.25, "crack_scale": 2.2},
    "hearth": {"color": "#3e3632", "grit": 0.25, "scale": "mid", "mottle": 0.45, "mottle_color": "#2a2420"},
    "trodden": {"color": "#7a6752", "dark": 0.06, "light": 0.05, "grit": 0.12},
}


def is_lake(scene):
    """A lakeside or on-the-lake scene (water of the lake, or a boat's deck)."""
    kinds = set(scene.get("legend", {}).values())
    return bool(kinds & {"lake", "shallows", "deck", "hull"})


def _smooth(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _contour(H, level, K):
    """Where the height field crosses `level`: segments ((x, y), (x, y)) in
    map tiles, by marching squares over the sample grid."""
    Hh, W = H.shape
    d = H - level
    segs = []

    def cross(ax, ay, bx, by, da, db):
        t = da / (da - db)
        return ((ax + (bx - ax) * t) / K, (ay + (by - ay) * t) / K)

    for j in range(Hh - 1):
        for i in range(W - 1):
            c = (d[j, i], d[j, i + 1], d[j + 1, i + 1], d[j + 1, i])
            signs = [v > 0 for v in c]
            if all(signs) or not any(signs):
                continue
            pts = []
            corners = ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))
            for k in range(4):
                a, b = k, (k + 1) % 4
                if signs[a] != signs[b]:
                    pts.append(cross(*corners[a], *corners[b], c[a], c[b]))
            if len(pts) == 2:
                segs.append((pts[0], pts[1]))
            elif len(pts) == 4:
                segs.append((pts[0], pts[1]))
                segs.append((pts[2], pts[3]))
    return segs


def _chain(segs):
    """Join segments that share end points into polylines."""
    key = lambda p: (round(p[0], 4), round(p[1], 4))  # noqa: E731
    ends = {}
    for idx, (a, b) in enumerate(segs):
        ends.setdefault(key(a), []).append((idx, 0))
        ends.setdefault(key(b), []).append((idx, 1))
    used = [False] * len(segs)
    lines = []
    for start in range(len(segs)):
        if used[start]:
            continue
        used[start] = True
        line = [segs[start][0], segs[start][1]]
        for forward in (True, False):
            while True:
                tip = line[-1] if forward else line[0]
                nxt = None
                for idx, end in ends.get(key(tip), []):
                    if not used[idx]:
                        nxt = (idx, end)
                        break
                if nxt is None:
                    break
                idx, end = nxt
                used[idx] = True
                other = segs[idx][1 - end]
                if forward:
                    line.append(other)
                else:
                    line.insert(0, other)
        lines.append(line)
    return lines


def _distance(mask, K):
    """Distance (tiles) from every sample to the nearest sample where `mask`
    is true: a two-pass chamfer transform on the sample grid."""
    INF = 1e9
    h, w = mask.shape
    d = np.where(mask, 0.0, INF)
    a, b = 1.0, math.sqrt(2.0)
    for j in range(h):
        row = d[j]
        if j > 0:
            up = d[j - 1]
            row = np.minimum(row, up + a)
            row[1:] = np.minimum(row[1:], up[:-1] + b)
            row[:-1] = np.minimum(row[:-1], up[1:] + b)
        for i in range(1, w):
            if row[i - 1] + a < row[i]:
                row[i] = row[i - 1] + a
        d[j] = row
    for j in range(h - 1, -1, -1):
        row = d[j]
        if j < h - 1:
            dn = d[j + 1]
            row = np.minimum(row, dn + a)
            row[1:] = np.minimum(row[1:], dn[:-1] + b)
            row[:-1] = np.minimum(row[:-1], dn[1:] + b)
        for i in range(w - 2, -1, -1):
            if row[i + 1] + a < row[i]:
                row[i] = row[i + 1] + a
        d[j] = row
    return d / K


# The lights (lighting.LIGHTS) in which a place's lamps burn, and those of
# the day: a thing tagged with them (obj["variants"], build_place.py) exists
# only in those lights (a flame after dark, a dark wick by day).
AFTER_DARK = "night,lamplight"
BY_DAY = "day,late"


def only(obj, lights):
    """This thing (or light) exists only in these lights."""
    obj["variants"] = lights
    return obj


class LakeKit(BoatsMixin, HousesMixin):
    # ── hooks called by place.py ────────────────────────────────────────────
    def regional_materials(self):
        """Materials for the lakeside style, and basalt for a Galilee room."""
        self.galilee = self.data.get("chapter") in GALILEE or self.style == "lake"
        if not self.galilee:
            return
        self.basalt = L.basalt("#55514c", "basalt", dust=0.55)
        self.basalt_dressed = L.basalt("#4e4a45", "basalt-dressed", dust=0.4, lichen=0.12)
        self.mortar = L.mud_mortar()
        if self.style == "lake":
            # Stone builders shared with other places use `limestone` and
            # `paving`: here they are basalt.
            self.limestone = L.basalt("#4e4a45", "basalt-fieldstone", dust=0.5, lichen=0.3)
            self.paving = L.basalt("#57524b", "basalt-flags", dust=0.6, lichen=0.1)
            self.roof = M.plaster("#8c7a62", "roof-mud-basalt")
            self.mudplaster = M.plaster("#7c6a56", "mud-plaster-basalt")
            self.brick = self.limestone
            self.brick_bare = self.limestone
        elif self.style == "home":
            self.looks = dict(GALILEE_HOME_LOOKS)
            self.limestone = L.basalt("#4a4640", "house-basalt", dust=0.2, lichen=0.0)
            self.paving = L.basalt("#4e4a44", "threshold-basalt", dust=0.25, lichen=0.0)
            # Inside, the stones were daubed with mud plaster, smoothed by hand
            # and smoked by the oven and the lamp.
            self.plaster = M.lime_plaster("#9a8468", "room-mud-plaster", soot=0.7, grime=0.6)
            self.wall_stone = L.basalt("#3e3b37", "wall-basalt", dust=0.15, lichen=0.0)
            self.wall_cut = L.basalt("#34322f", "wall-basalt-cut", dust=0.0, lichen=0.0)

    def layer_look(self, name):
        """A ground layer's look: a Galilee room's own (earth and basalt),
        else as the kits after this one say."""
        own = getattr(self, "looks", {}).get(name)
        return own if own is not None else super().layer_look(name)

    def lamp_flame(self, name, at, size, power, light_at=None, radius=30.0):
        """A small oil lamp's flame at `at` that burns only after dark: a dark
        wick by day, a flame and its light by night, a pool the game makes
        flicker. Returns the (wick, flame) objects for the lamp's sprite."""
        rx, rz = size
        wick = only(self._ellipsoid(f"{name}-wick", at, (rx, rx, rz * 0.5), M.plain("#2a2018", 0.9), 8, 6), BY_DAY)
        flame = only(self._ellipsoid(f"{name}-flame", at, (rx, rx, rz), M.emissive("#ffc070", 36.0), 8, 6), AFTER_DARK)
        where = light_at if light_at is not None else at + Vector((0.0, -0.05, 0.07))
        only(self.add_light(f"{name}-light", "POINT", where, power, "#ffae5c", radius=0.035), AFTER_DARK)
        self.flicker.append(("lamp", at.x * 32, (-at.y - at.z) * 32, radius, AFTER_DARK.split(",")))
        return [wick, flame]

    # ── heights ─────────────────────────────────────────────────────────────
    def lake_heights(self):
        """The height field of a lakeside or a boat (see the module notes)."""
        m = self.map
        K = terrain.K
        W, Hh = m.w * K + 1, m.h * K + 1
        xs = np.clip((np.arange(W) / K).astype(int), 0, m.w - 1)
        ys = np.clip((np.arange(Hh) / K).astype(int), 0, m.h - 1)
        kinds = np.array([[m.kind(x, y) for x in range(m.w)] for y in range(m.h)])
        afloat = self._afloat_boat_tiles()
        wet_tile = np.isin(kinds, list(WATER))
        for x, y in afloat:
            wet_tile[y, x] = True
        inside = self._deck_mask(W, Hh, K)
        seed = sum(ord(c) for c in m.id)
        # The shoreline wanders a little across the tiles (a warped reading
        # of the map), as a real one does; the jetty and the deck keep theirs.
        wx = terrain._fbm(W, Hh, seed + 31, (22, 9, 4)) * 0.32
        wy = terrain._fbm(W, Hh, seed + 32, (22, 9, 4)) * 0.32
        gx = np.clip((np.arange(W)[None, :] / K + wx).astype(int), 0, m.w - 1)
        gy = np.clip((np.arange(Hh)[:, None] / K + wy).astype(int), 0, m.h - 1)
        jetty = (kinds == "jetty")[ys][:, xs]
        # Under the jetty where it stands in the water, the bed goes on as if
        # the jetty were not there (it stands on it).
        jetty_wet_tile = np.zeros_like(wet_tile)
        for x, y in m.tiles("jetty"):
            left = next((k for k in range(x - 1, -1, -1) if m.kind(k, y) != "jetty"), None)
            right = next((k for k in range(x + 1, m.w) if m.kind(k, y) != "jetty"), None)
            if any(k is not None and m.kind(k, y) in WATER for k in (left, right)):
                jetty_wet_tile[y, x] = True
        # Round off the tiles' corners: blur the wet tiles and cut at half.
        wet_soft = terrain._blur(wet_tile[gy, gx].astype(float), int(K * 0.45))
        wet_soft += terrain._fbm(W, Hh, seed + 33, (10, 4)) * 0.12
        wet = ((wet_soft > 0.5) & ~jetty) | jetty_wet_tile[ys][:, xs]
        wet &= ~inside
        shingle = np.isin(kinds, ["shingle", "boat", "jetty"])[gy, gx] & ~wet
        reeds = (kinds == "reeds")[gy, gx]
        lake = terrain._blur((kinds == "lake")[gy, gx].astype(float), int(K * 0.6)) > 0.5
        noise = terrain._fbm(W, Hh, seed + 3, (16, 6, 2.5))
        zw = self.z_water()
        d_land = _distance(~wet, K)
        d_water = _distance(wet, K)
        d_lake = _distance(lake, K)
        H = 0.012 * noise
        # The beach falls to the waterline, which lies a little inside the
        # water tiles, so the last row of shingle is dry.
        beach = zw + 0.014 + 0.07 * np.power(np.maximum(d_water, 0.0), 0.9) + 0.008 * noise
        H = np.where(shingle, np.minimum(beach, 0.0), H)
        H = np.where(reeds, np.minimum(H, zw + 0.03 + 0.05 * d_water), H)
        # Under the water the bed shelves away, gently in the shallows,
        # then faster where the lake proper begins.
        bed = zw + 0.012 - 0.17 * np.power(d_land, 0.85) - 0.55 * _smooth(1.2 - d_lake) * np.minimum(1.0, d_land / 2.5)
        bed = bed + 0.03 * noise
        bed = np.maximum(bed, -3.2)
        H = np.where(wet, bed, H)
        # Soften the beach and the beds; then the jetty and the deck, which
        # have edges, go on top.
        H = terrain._blur(H, 2)
        # The jetty's blocks stand on it: the terrain there is the bottom of
        # the joints between them.
        H = np.where(jetty, Z_JETTY - JOINT, H)
        if inside.any():
            H = np.where(inside, 0.0, H)
        # No folds: going south, fall at most one tile per tile (raise the
        # bed south of the jetty and the boat into a slope under the water).
        ds = 1.0 / K
        for j in range(1, Hh):
            H[j] = np.maximum(H[j], H[j - 1] - ds)
        return H

    def z_water(self):
        return Z_OPEN_WATER if self.map.tiles("deck") else Z_SHORE_WATER

    def _afloat_boat_tiles(self):
        """Tiles of boats that float (mostly water around them)."""
        out = []
        for fp in self.boat_footprints():
            if fp["afloat"]:
                out += fp["tiles"]
        return out

    # ── the ground ──────────────────────────────────────────────────────────
    def lake_ground(self):
        """The shore's (or the boat's) ground: heights, the layered ground
        material, the water over the lake and the shallows, the wet band and
        the foam along the waterline."""
        self.heights = self.lake_heights()
        names, images = self._masks()
        # The bed goes from pale pebbles to the silt of the depths over a few
        # metres, not at a tile's edge.
        self._soften_masks(names, images, {"silt": 22, "bed": 8, "reedbed": 6})
        from place import LAYER_LOOKS

        layers = [dict(LAYER_LOOKS[n]) for n in names]
        mat = M.ground_surface(f"ground-{self.map.id}", images, layers, macro=0.12)
        g = terrain.mesh(self, mat, self.col_ground)
        if self.map.tiles("deck"):
            self._plank_the_deck(g)
        self.ground_objects.append(g)
        self._water()
        if self.map.tiles("shingle"):
            self._waterline()

    @staticmethod
    def _soften_masks(names, images, radii):
        """Blur some ground layers' masks (radius in mask pixels, 16 a tile)."""
        for name, r in radii.items():
            if name not in names or names.index(name) == 0:
                continue
            i = names.index(name) - 1
            img, ch = images[i // 3], i % 3
            w, h = img.size
            px = np.empty(w * h * 4, dtype=np.float32)
            img.pixels.foreach_get(px)
            px = px.reshape(h, w, 4)
            px[..., ch] = np.clip(terrain._blur(px[..., ch].astype(np.float64), r), 0, 1).astype(np.float32)
            img.pixels.foreach_set(px.reshape(-1))
            img.update()
            img.pack()

    def _plank_the_deck(self, g):
        """Aboard: the terrain inside the bulwarks is the deck, planked fore and
        aft; the rest is the lake bed far below."""
        g.data.materials.append(L.planks("#a8916f", "deck-planks", along="X", width=0.19, length=2.6, worn=0.5))
        o = self.family_outline()
        for poly in g.data.polygons:
            c = poly.center
            mx = c.x
            # Map y of a terrain point: undo the shear (Blender y = -(y + h), z = h).
            my = -c.y - c.z
            half = float(np.interp(mx, o["x"], o["half"], left=0.0, right=0.0))
            if abs(my - o["cy"]) < half - 0.1 and c.z > -0.05:
                poly.material_index = 1

    def _water(self):
        cells = [(x, y) for k in WATER for x, y in self.map.tiles(k)]
        cells += self._afloat_boat_tiles()
        if not cells:
            return
        zw = self.z_water()
        deep = bool(self.map.tiles("deck"))
        mat = L.lake_water(density=0.45 if deep else 0.55)
        # Far past the map's edges, so no ray finds the water body's sides.
        w = terrain.water_surface(self, cells, zw, mat, self.col_ground, margin=8.0)
        # Deep enough to reach the bed everywhere (the body tints what is seen through it).
        for mod in w.modifiers:
            if mod.type == "SOLIDIFY":
                mod.thickness = 3.6
        # No water inside a floating hull: cut its waterline out of the lake.
        for k, fp in enumerate(fp for fp in self.boat_footprints() if fp["afloat"]):
            cutter = self._hull_cutter(f"cut-{k}", fp, zw)
            if cutter is None:
                continue
            mod = w.modifiers.new(f"cut{k}", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.solver = "EXACT"
            mod.object = cutter
        common.bake_modifiers(w)
        for o in [o for o in bpy.data.objects if o.name.startswith("cut-")]:
            bpy.data.objects.remove(o, do_unlink=True)
        # Refracting water would shade its own bed black (no caustics): light
        # passes through it to the stones below.
        w.visible_shadow = False
        self.ground_objects.append(w)
        self.water_obj = w
        # Past the map's edges the bed goes on, deep and silty.
        m = self.map
        silt = M.ground_surface("deep-silt", [], [dict(LAKE_LOOKS["silt"])])
        z = -3.4
        bed = common.box("deep-bed", (m.w + 20, m.h + 20, 0.1), Vector((m.w / 2, -(m.h / 2 + z), z - 0.05)), silt, None)
        self.to_ground(bed)

    def _hull_cutter(self, name, fp, zw):
        """A prism the shape of a floating hull at its waterline (a little
        inside the planking), standing through the water surface."""
        L, B = fp["length"], fp["beam"]
        cx, cy = fp["centre"]
        xf = self._boat_xf(cx, cy, zw, zw, fp["heading"])
        ring = []
        n = 48
        for side in (1, -1):
            for i in range(n + 1):
                u = i / n if side > 0 else 1 - i / n
                hb, sheer, keel = self.hull_shape(u, L, B)
                if keel >= -0.02 or sheer <= keel:
                    w = 0.0
                else:
                    c = max(0.0, 1 - (-keel) / (sheer - keel)) ** (1 / 1.35)
                    w = hb * math.sqrt(max(0.0, 1 - c * c)) ** 0.72
                ring.append((-L / 2 + u * L, side * max(0.0, w - 0.03)))
        if max(abs(y) for _, y in ring) < 0.05:
            return None
        bm = bmesh.new()
        low = [bm.verts.new(xf @ Vector((x, y, -1.2))) for x, y in ring]
        high = [bm.verts.new(xf @ Vector((x, y, 0.5))) for x, y in ring]
        m = len(ring)
        for i in range(m):
            j = (i + 1) % m
            bm.faces.new((low[i], low[j], high[j], high[i]))
        bm.faces.new(high)
        bm.faces.new(low[::-1])
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        obj = common.mesh_object(name, bm, None, None, smooth=False)
        obj.hide_render = True
        return obj

    def _waterline(self):
        """Where the water meets the shingle: a lacy band of foam just on the
        water, and the wet dark band of pebbles just above it."""
        H = self.heights
        K = terrain.K
        zw = self.z_water()
        segs = _contour(H, zw, K)
        if not segs:
            return
        # Chain the segments into polylines along the shore.
        lines = _chain(segs)
        foam = bmesh.new()
        fuv = foam.loops.layers.uv.new("UVMap")
        wetb = bmesh.new()
        wuv = wetb.loops.layers.uv.new("UVMap")
        m = self.map
        for line in lines:
            if len(line) < 3:
                continue
            pts = [Vector((x, y)) for x, y in line]
            # Only along the beach (not the jetty's foot, not reeds).
            n = len(pts)
            prev_f = prev_w = None
            for i, p in enumerate(pts):
                a = pts[max(0, i - 1)]
                b = pts[min(n - 1, i + 1)]
                t = (b - a)
                if t.length < 1e-6:
                    continue
                t.normalize()
                nrm = Vector((-t.y, t.x))
                # Point the normal downhill (toward the water).
                probe = p + nrm * 0.15
                if terrain.sample(H, probe.x, probe.y) > terrain.sample(H, p.x, p.y):
                    nrm = -nrm
                k = m.kind(int(p.x), int(p.y))
                on_beach = k in ("shingle", "shallows", "boat", "lake")
                wob = 0.5 + 0.5 * math.sin(i * 0.9) * math.sin(i * 0.37 + 1.0)
                fw = (0.16 + 0.12 * wob) if on_beach else 0.03
                inner = p - nrm * 0.03
                outer = p + nrm * fw
                row_f = [foam.verts.new(self._on_water(inner, zw + 0.004)), foam.verts.new(self._on_water(outer, zw + 0.004))]
                ww = 0.55 + 0.3 * wob
                up = p - nrm * ww
                row_w = [wetb.verts.new(self.P(p.x, p.y, 0.004)), wetb.verts.new(self.P(up.x, up.y, 0.004))]
                if prev_f is not None:
                    f = foam.faces.new((prev_f[0], prev_f[1], row_f[1], row_f[0]))
                    for loop, (u, v) in zip(f.loops, ((i - 1, 0.0), (i - 1, 1.0), (i, 1.0), (i, 0.0))):
                        loop[fuv].uv = (u * 0.2, v)
                    g = wetb.faces.new((prev_w[0], prev_w[1], row_w[1], row_w[0]))
                    for loop, (u, v) in zip(g.loops, ((i - 1, 0.0), (i - 1, 1.0), (i, 1.0), (i, 0.0))):
                        loop[wuv].uv = (u * 0.2, v)
                prev_f, prev_w = row_f, row_w
        bmesh.ops.recalc_face_normals(foam, faces=foam.faces)
        bmesh.ops.recalc_face_normals(wetb, faces=wetb.faces)
        fo = common.mesh_object("shore-foam", foam, L.foam(), self.col_ground)
        fo.visible_shadow = False
        self.ground_objects.append(fo)
        wo = common.mesh_object("wet-shingle", wetb, L.wet_band(), self.col_ground)
        wo.visible_shadow = False
        self.ground_objects.append(wo)

    def _on_water(self, p, z):
        """A point on the flat water surface at height z over map point p (sheared)."""
        return Vector((p.x, -(p.y + z), z))

    # ── walkable kinds ──────────────────────────────────────────────────────
    def tile_shingle(self):
        """A shingle beach: thousands of rounded pebbles, mostly dark basalt
        with pale limestone among them, bigger stones and cobbles scattered,
        small white snail shells and bits of reed washed up in a line at the
        water's edge; the pebbles run on under the water into the shallows."""
        m = self.map
        afloat = set(self._afloat_boat_tiles())
        beach = m.tiles("shingle") + [(x, y) for x, y in m.tiles("boat") if (x, y) not in afloat]
        cells = beach + m.tiles("shallows")
        if not cells:
            return
        lib = self._lake_library()
        zw = self.z_water()
        # Dense small pebbles over the beach (a pebble 1-3 cm is a few
        # pixels: low-poly), fewer under the water where they are dimmed.
        em = self.emitter("pebbles-fine", beach, sub=2, z=0.004)
        em["wet_z"] = zw
        scatter.scatter(em, lib["pebbles"], 300.0, (0.014, 0.032), seed=201, rotate_z_only=True, pick=True)
        em2 = self.emitter("pebbles-mid", cells, sub=2, z=0.006)
        em2["wet_z"] = zw
        scatter.scatter(em2, lib["pebbles"], 60.0, (0.03, 0.06), seed=203, rotate_z_only=True, pick=True)
        # Cobbles, fewer and sunk into the rest.
        em3 = self.emitter("cobbles", cells, sub=1, z=-0.004)
        em3["wet_z"] = zw
        scatter.scatter(em3, lib["cobbles"], 3.2, (0.06, 0.13), seed=205, rotate_z_only=True, pick=True)
        # A drift line of snail shells and reed bits a little above the water.
        H = self.heights
        drift = [(x, y) for x, y in m.tiles("shingle") if m.near(x, y, WATER, 1)]
        if drift:
            em4 = self.emitter("drift", drift, sub=4, keep=lambda x0, y0: abs(terrain.sample(H, x0 + 0.12, y0 + 0.12) - (zw + 0.05)) < 0.03, z=0.01)
            scatter.scatter(em4, lib["shells"], 60.0, (0.008, 0.014), seed=207, rotate_z_only=False, pick=True)
            scatter.scatter(self.emitter("drift-reed", drift, sub=4, keep=lambda x0, y0: abs(terrain.sample(H, x0 + 0.12, y0 + 0.12) - (zw + 0.06)) < 0.025, z=0.01), lib["reedbits"], 9.0, (0.6, 1.2), seed=209, rotate_z_only=True, pick=True)

    def _lake_library(self):
        """Hidden source meshes for the shore's scatter: pebbles, cobbles,
        shells, bits of reed."""
        if getattr(self, "_lake_lib", None):
            return self._lake_lib
        lib = bpy.data.collections.new("lake-library")
        bpy.context.scene.collection.children.link(lib)
        lib.hide_render = True
        rng = self.rng
        out = {}

        def col(name):
            c = bpy.data.collections.new(name)
            lib.children.link(c)
            return c

        peb = col("pebbles")
        mat = L.pebbles()
        for t in range(10):
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
            sx = 1.0
            sy = 0.55 + rng.random() * 0.4
            sz = 0.3 + rng.random() * 0.3
            ph = rng.random() * 9
            for v in bm.verts:
                nn = 0.08 * math.sin(v.co.x * 3 + ph) + 0.06 * math.sin(v.co.y * 4 + ph * 2)
                v.co = Vector((v.co.x * sx * (1 + nn), v.co.y * sy * (1 + nn), v.co.z * sz * (1 + nn) + sz * 0.55))
            o = common.mesh_object(f"pebble{t}", bm, mat, None)
            for c in o.users_collection:
                c.objects.unlink(o)
            peb.objects.link(o)
        out["pebbles"] = peb
        cob = col("cobbles")
        for t in range(6):
            bm = bmesh.new()
            layer = bm.faces.layers.float.new("rand")
            import rocks

            rocks.stone_mesh(bm, 700 + t * 13, (1.0, 0.75 + rng.random() * 0.2, 0.55), flat=0.6, blocky=0.25, n=18, sink=0.35, detail=1)
            r = rng.random()
            for f in bm.faces:
                f[layer] = r
            o = common.mesh_object(f"cobble{t}", bm, mat, None)
            common.add_modifier(o, "SUBSURF", levels=1, render_levels=1)
            common.bake_modifiers(o)
            for c in o.users_collection:
                c.objects.unlink(o)
            cob.objects.link(o)
        out["cobbles"] = cob
        sh = col("shells")
        smat = L.shell()
        for t in range(3):
            o = common.lathe(f"shell{t}", [(0.0, 0.0), (0.5, 0.2), (0.35, 1.0), (0.2, 1.8), (0.0, 2.6)], 10, smat, None)
            for c in o.users_collection:
                c.objects.unlink(o)
            sh.objects.link(o)
        out["shells"] = sh
        rb = col("reedbits")
        rmat = M.plain("#8c7a56", 0.85)
        for t in range(4):
            bm = bmesh.new()
            ln = 0.08 + rng.random() * 0.1
            a = rng.random() * math.tau
            d = Vector((math.cos(a), math.sin(a), 0.0))
            s = Vector((-d.y, d.x, 0.0)) * 0.004
            v = [bm.verts.new(-d * ln / 2 - s), bm.verts.new(d * ln / 2 - s), bm.verts.new(d * ln / 2 + s), bm.verts.new(-d * ln / 2 + s)]
            bm.faces.new(v)
            o = common.mesh_object(f"reedbit{t}", bm, rmat, None, smooth=False)
            for c in o.users_collection:
                c.objects.unlink(o)
            rb.objects.link(o)
        out["reedbits"] = rb
        self._lake_lib = out
        return out

    def tile_deck(self):
        """The deck of the boat you are aboard: planked fore and aft, pegged,
        worn pale down the middle (the terrain inside the hull, planked by the
        ground material); built with the boat (lake_boats.py)."""

    def tile_jetty(self):
        """A jetty of big dressed basalt blocks running out into the lake:
        the top a pavement of worn slabs, the sides and the end coursed
        blocks going down into the water, wet and slimed at the waterline,
        pierced mooring stones along its edge, a boat's rope made fast."""
        m = self.map
        cells = set(m.tiles("jetty"))
        if not cells:
            return
        xs = [c[0] for c in cells]
        ys = [c[1] for c in cells]
        x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
        self.jetty_box = (x0, x1, y0, y1)
        rng = self.rng
        zw = self.z_water()
        stone = L.basalt("#3e3c38", "jetty-basalt", dust=0.28, lichen=0.18, wet_below=zw + 0.06)
        top = bmesh.new()
        tl = top.faces.layers.float.new("rand")
        # The pavement: rows of slabs across the jetty.
        y = y0 + 0.02
        while y < y1 - 0.05:
            h = 0.42 + rng.random() * 0.22
            h = min(h, y1 - 0.02 - y)
            x = x0 + 0.03
            while x < x1 - 0.05:
                w = 0.55 + rng.random() * 0.7
                w = min(w, x1 - 0.03 - x)
                if w > 0.12:
                    self._jetty_slab(top, tl, x + 0.012, y + 0.012, w - 0.024, h - 0.024, rng)
                x += w
            y += h
        bmesh.ops.recalc_face_normals(top, faces=top.faces)
        obj = common.mesh_object("jetty-top", top, stone, self.col_ground, smooth=False)
        common.add_modifier(obj, "BEVEL", width=0.028, segments=3, limit_method="ANGLE")
        self.ground_objects.append(obj)
        # The sides and the end: courses of blocks from the top down to the bed.
        faces = bmesh.new()
        fl = faces.faces.layers.float.new("rand")
        bottom = zw - 0.9
        for side_x, sign in ((x0, -1), (x1, 1)):
            self._block_face(faces, fl, "x", side_x, sign, y0 + 0.3, y1, bottom, rng)
        self._block_face(faces, fl, "y", y1, 1, x0, x1, bottom, rng)
        fobj = common.mesh_object("jetty-faces", faces, stone, self.col_ground, smooth=False)
        common.add_modifier(fobj, "BEVEL", width=0.02, segments=2, limit_method="ANGLE")
        self.ground_objects.append(fobj)
        # Mooring stones: pierced blocks along the east edge, by the boats.
        for my in range(y0 + 3, y1 - 1, 4):
            self._mooring_stone(f"moor-{my}", x1 - 0.22, my + 0.5, stone)

    def _jetty_slab(self, bm, layer, x, y, w, h, rng):
        """One dressed block of the jetty's top course: squared by hand, not
        quite true, set a little proud or sunk against its neighbours (the
        bevel on the whole course rounds its worn edges)."""
        top = Z_JETTY + (rng.random() - 0.5) * 0.024
        bot = Z_JETTY - 0.32

        def j(a=0.008):
            return (rng.random() - 0.5) * 2 * a

        pts = []
        for z in (bot, None):
            for yy in (y, y + h):
                for xx in (x, x + w):
                    zz = top + j(0.006) if z is None else z
                    pts.append(self._at(xx + j(), yy + j(), zz, Z_JETTY))
        v = [bm.verts.new(p) for p in pts]
        r = rng.random()
        for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            f = bm.faces.new([v[i] for i in q])
            f[layer] = r

    def _at(self, x, y, z, base=None):
        """The Blender point at height z (absolute, tiles) of something whose
        base is a surface at height `base` over map point (x, y): sheared by
        the base, so the thing shows over its own tiles and stands upright.
        Without a base, a point of a flat surface at height z."""
        b = z if base is None else base
        return Vector((x, -(y + b), z))

    def _block_face(self, bm, layer, axis, at, sign, a0, a1, bottom, rng):
        """Coursed blocks forming a jetty's side (axis 'x': the face at x=`at`,
        running from y=a0 to a1) or its end (axis 'y': at y=`at`, x from a0
        to a1), from the pavement down to `bottom`."""
        z = Z_JETTY - 0.05
        course = 0
        while z > bottom:
            hgt = 0.34 + rng.random() * 0.14
            p = a0 + (0.3 if course % 2 else 0.0) * rng.random()
            while p < a1 - 0.05:
                ln = min(0.6 + rng.random() * 0.6, a1 - p)
                out = 0.02 + rng.random() * 0.04
                r = rng.random()
                if axis == "x":
                    xa, xb = (at - out, at + 0.35) if sign < 0 else (at - 0.35, at + out)
                    self._block(bm, layer, xa, xb, p + 0.012, p + ln - 0.012, z - hgt + 0.012, z, r)
                else:
                    self._block(bm, layer, p + 0.012, p + ln - 0.012, at - 0.35, at + out, z - hgt + 0.012, z, r)
                p += ln
            z -= hgt
            course += 1

    def _block(self, bm, layer, x0, x1, y0, y1, z0, z1, r):
        """A box between map x0..x1, y0..y1 and heights z0..z1 (absolute),
        sheared to the view."""
        c = [self._at(x, y, z, Z_JETTY) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
        v = [bm.verts.new(p) for p in c]
        quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        for q in quads:
            f = bm.faces.new([v[i] for i in q])
            f[layer] = r

    def _mooring_stone(self, name, x, y, mat):
        """A mooring stone: a squared basalt block with a hole bored through
        it for a boat's rope."""
        z = Z_JETTY
        body = common.box(name, (0.34, 0.3, 0.26), self._at(x, y, z + 0.12, z), mat, None, bevel=0.05)
        hole = common.box(f"{name}-hole", (0.4, 0.1, 0.11), self._at(x, y, z + 0.14, z), None, None)
        mod = body.modifiers.new("hole", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = hole
        common.bake_modifiers(body)
        bpy.data.objects.remove(hole)
        self._rand_attr(body)
        self.to_ground(body)

    # ── water ───────────────────────────────────────────────────────────────
    def tile_lake(self):
        """Open water: the surface (refracting, reflecting the sky, a light
        chop from the wind) and its body, darker and bluer with depth over a
        silty bed; laid with the ground (lake_ground)."""

    def tile_shallows(self):
        """Shallow water over pebbles and pale sand, weed in patches, foam
        where it laps the shingle; laid with the ground (lake_ground)."""

    # ── nets and racks ──────────────────────────────────────────────────────
    def tile_nets(self):
        """Nets hung to dry: on a pole between two forked posts outdoors (the
        head rope with its floats along the top, the foot rope with its
        stone sinkers hanging below), or on pegs along a room's wall."""
        for x0, x1, y in self.map.runs("nets"):
            name = f"nets-{x0}-{y}"
            if self.style == "home":
                self.sprite(name, y + 0.5, self._wall_nets(name, x0, x1, y), [(x, y) for x in range(x0, x1)])
            else:
                self.sprite(name, y + 0.72, self._drying_net(name, x0, x1, y), [(x, y) for x in range(x0, x1)])

    def _drying_net(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        post = M.wood("#5e4a36", 3.0)
        cy = y + 0.5
        h = 1.85
        for px in (x0 + 0.12, x1 - 0.12):
            objs.append(self._branch(f"{name}-post{px:.1f}", self.P(px, cy, -0.1), self.P(px + (rng.random() - 0.5) * 0.04, cy, h), 0.04, 0.032, post, 7, bow=0.0))
            # The fork at the top.
            for s in (-1, 1):
                objs.append(self._branch(f"{name}-fork{px:.1f}{s}", self.P(px, cy, h - 0.1), self.P(px + s * 0.07, cy, h + 0.08), 0.02, 0.014, post, 5, bow=0.0))
        objs.append(self._branch(f"{name}-pole", self.P(x0 + 0.02, cy, h), self.P(x1 - 0.02, cy, h + 0.02), 0.028, 0.026, post, 8, bow=-0.02))
        # The net: draped over the pole, hanging in folds front and back.
        objs += self._hung_net(name, x0 + 0.08, x1 - 0.08, cy, h, rng)
        return objs

    def _hung_net(self, name, xa, xb, cy, h, rng, sides=(-1, 1), drop=1.5, mesh=0.075):
        """A net hanging over a bar at height h between xa and xb: each side
        a sheet with folds, gathered and sagging, its floats at the top and
        sinkers along the bottom."""
        objs = []
        mat = L.net("#8c7658", mesh=mesh, thread=0.11, veil=0.1, name=f"net-{mesh}")
        floats = M.plain("#8a6a44", 0.85)
        sink = L.basalt("#55524c", "sinker-stone", dust=0.0, lichen=0.0)
        for s in sides:
            bm = bmesh.new()
            uv = bm.loops.layers.uv.new("UVMap")
            nu, nv = int((xb - xa) * 16), 16
            grid = []
            for j in range(nv + 1):
                t = j / nv
                row = []
                for i in range(nu + 1):
                    u = i / nu
                    x = xa + (xb - xa) * u
                    fold = 0.05 * math.sin(u * (xb - xa) * 9.0 + s) * (0.2 + t) + 0.02 * math.sin(u * 31 + t * 5)
                    ln = drop * (0.85 + 0.15 * math.sin(u * 5.0 + s * 2))
                    z = h - t * ln
                    out = s * (0.02 + t * 0.07 + fold)
                    row.append(bm.verts.new(self.P(x, cy + out, z)))
                grid.append(row)
            for j in range(nv):
                for i in range(nu):
                    f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                    for loop, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                        loop[uv].uv = (ii / nu * (xb - xa), jj / nv * drop)
            bottom = [v.co.copy() for v in grid[nv]]
            objs.append(common.mesh_object(f"{name}-net{s}", bm, mat, None))
            # Sinkers along the bottom edge (only the near side shows them well).
            for k in range(int((xb - xa) / 0.28)):
                u = (k + 0.5) / int((xb - xa) / 0.28)
                p = bottom[int(u * nu)]
                objs.append(self._ellipsoid(f"{name}-sink{s}{k}", p + Vector((0, 0, -0.02)), (0.022, 0.018, 0.028), sink, 8, 6))
        # Floats on the head rope, over the bar.
        for k in range(int((xb - xa) / 0.2)):
            x = xa + (k + 0.5) * 0.2
            objs.append(self._ellipsoid(f"{name}-float{k}", self.P(x, cy, h + 0.04), (0.035, 0.025, 0.02), floats, 10, 6))
        return objs

    def _wall_nets(self, name, x0, x1, y):
        """Nets hung from pegs along a room's back wall, bunched in heavy folds."""
        rng = self.rng
        objs = []
        peg = M.wood("#5e4a36", 3.0)
        wall_y = y + 0.15
        h = 1.9
        for px in [x0 + 0.1 + k * 0.45 for k in range(int((x1 - x0) / 0.45) + 1)]:
            objs.append(self._branch(f"{name}-peg{px:.1f}", self.P(px, wall_y - 0.02, h), self.P(px, wall_y + 0.12, h - 0.02), 0.018, 0.015, peg, 5, bow=0.0))
        objs += self._hung_net(name, x0 + 0.05, x1 - 0.05, wall_y + 0.1, h, rng, sides=(1,), drop=1.55, mesh=0.07)
        return objs

    def tile_rack(self):
        """A fish-drying rack: two trestles carrying poles, split and salted
        fish hung over them in rows to dry, a few on a reed mat on top."""
        for x0, x1, y in self.map.runs("rack"):
            name = f"rack-{x0}-{y}"
            self.sprite(name, y + 0.8, self._fish_rack(name, x0, x1, y), [(x, y) for x in range(x0, x1)])

    def _fish_rack(self, name, x0, x1, y):
        rng = self.rng
        objs = []
        timber = M.wood("#6a5540", 3.2)
        cy = y + 0.5
        h = 1.05
        for px in (x0 + 0.1, x1 - 0.1):
            for s in (-1, 1):
                objs.append(self._branch(f"{name}-leg{px:.1f}{s}", self.P(px, cy + s * 0.28, 0.0), self.P(px, cy + s * 0.02, h + 0.05), 0.026, 0.022, timber, 6, bow=0.0))
        poles = (cy - 0.16, cy + 0.16)
        for k, py in enumerate(poles):
            objs.append(self._branch(f"{name}-pole{k}", self.P(x0 + 0.02, py, h - 0.06 + k * 0.02), self.P(x1 - 0.02, py, h - 0.05 + k * 0.02), 0.018, 0.018, timber, 6, bow=-0.015))
        ropes = L.rope("#9c8660", "rack-cord")
        # Split fish hung head down over the poles.
        for k, py in enumerate(poles):
            x = x0 + 0.14
            while x < x1 - 0.14:
                size = 0.2 + rng.random() * 0.08
                objs += self._split_fish(f"{name}-f{k}-{x:.2f}", self.P(x, py, h - 0.08 + k * 0.02), size, rng, hang=True)
                x += 0.13 + rng.random() * 0.05
        _ = ropes
        return objs

    def _split_fish(self, name, top, size, rng, hang=True, lie_angle=0.0):
        """A fish split open along its back and salted: the two sides spread
        flat, the pale flesh facing out, the silver skin behind. Hung head
        down from `top`, or lying flat (hang=False) at `top`."""
        bm = bmesh.new()
        nu, nv = 8, 4
        grid = []
        for j in range(nv + 1):
            t = j / nv - 0.5
            row = []
            for i in range(nu + 1):
                u = i / nu
                # Outline: widest a third of the way down, a notched tail.
                w = size * 0.42 * math.sin(math.pi * min(1.0, u * 1.08)) ** 0.7 * (1.0 if u < 0.85 else 0.6 + (u - 0.85) * 3)
                x = u * size
                yv = t * 2 * w
                z = 0.012 * math.cos(t * math.pi) * (1 - u)
                row.append(Vector((x, z, yv)))
            grid.append(row)
        verts = []
        for row in grid:
            vr = []
            for p in row:
                if hang:
                    q = Vector((p.z, -p.y - 0.004, -p.x))
                else:
                    ca, sa = math.cos(lie_angle), math.sin(lie_angle)
                    q = Vector((p.x * ca - p.z * sa, p.x * sa + p.z * ca, p.y + 0.004))
                vr.append(bm.verts.new(top + q))
            verts.append(vr)
        for j in range(nv):
            for i in range(nu):
                bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
        dried = 0.3 + rng.random() * 0.6
        mat = L.fish("#9aa0a4", "#4c535c", "#dcb892", round(dried, 1), name=f"fish-dried-{round(dried, 1)}")
        o = common.mesh_object(name, bm, mat, None)
        common.add_modifier(o, "SOLIDIFY", thickness=0.006)
        return [o]

    # ── the shore's other kinds, in basalt country ──────────────────────────
    def _as_oasis(self, fn):
        """Run a shared builder as if in the oasis (green grass, stones and
        gravel in the scatter library), then come back to the lakeside."""
        style = self.style
        self.style = "oasis"
        try:
            return fn()
        finally:
            self.style = style

    def _library(self):
        """The shared scatter library, with the oasis's green grass and
        stones for the lakeside (its stones and grit are basalt here)."""
        if self.style != "lake" or getattr(self, "_lib", None):
            return super()._library()
        lib = self._as_oasis(lambda: super(LakeKit, self)._library())
        dark = L.basalt("#4a4640", "scatter-basalt", dust=0.4, lichen=0.2)
        grit = L.basalt("#55504a", "grit-basalt", dust=0.5, lichen=0.0)
        for key, mat in (("stones", dark), ("gravel", grit)):
            for o in lib[key].objects:
                o.data.materials.clear()
                o.data.materials.append(mat)
        return lib

    def tile_scrub(self):
        """Lakeside grass in summer: dry and golden, thick, green in patches
        where the ground holds water, on dark soil strewn with basalt grit and
        small stones."""
        if self.style != "lake":
            return super().tile_scrub()
        from place import value_noise

        m = self.map
        lib = self._library()
        cells = m.tiles("scrub")
        if not cells:
            return
        sub = 4
        field = value_noise(m.w * sub + 4, m.h * sub + 4, 6, 121)
        fine = value_noise(m.w * sub + 4, m.h * sub + 4, 2, 123)

        def green(x0, y0):
            return field[int(y0 * sub), int(x0 * sub)] > 0.6

        def thick(x0, y0):
            return fine[int(y0 * sub), int(x0 * sub)] > 0.3

        em = self.emitter("grass-dry", cells, sub, lambda x0, y0: not green(x0, y0) and thick(x0, y0), z=0.012)
        scatter.scatter(em, lib["tufts"], 46.0, (0.6, 1.35), seed=131, rotate_z_only=True, pick=True)
        em = self.emitter("grass-green", cells, sub, green, z=0.012)
        scatter.scatter(em, lib["green"], 50.0, (0.55, 1.2), seed=133, rotate_z_only=True, pick=True)
        scatter.scatter(self.emitter("scrub-grit", cells), lib["gravel"], 22.0, (0.008, 0.02), seed=135, rotate_z_only=True, pick=True)
        scatter.scatter(self.emitter("scrub-stones", cells), lib["stones"], 1.1, (0.03, 0.08), seed=137, rotate_z_only=True, pick=True)

    def tile_sand(self):
        """Trodden earth (the paths down to the shore, the yards before the
        houses): packed brown earth with basalt grit ground into it, small
        stones kicked to the edges, a few tufts where feet go less."""
        if self.style != "lake":
            return super().tile_sand()
        m = self.map
        lib = self._library()
        cells = m.tiles("sand")
        if not cells:
            return
        scatter.scatter(self.emitter("path-grit", cells), lib["gravel"], 70.0, (0.008, 0.022), seed=141, rotate_z_only=True, pick=True)
        scatter.scatter(self.emitter("path-pebbles", cells), lib["pebbles"], 6.0, (0.01, 0.03), seed=143, rotate_z_only=True, pick=True)
        edge = [(x, y) for x, y in cells if m.near(x, y, ("scrub", "wall", "roof"), 1)]
        if edge:
            scatter.scatter(self.emitter("path-edge-stones", edge), lib["stones"], 1.6, (0.03, 0.07), seed=145, rotate_z_only=True, pick=True)
            scatter.scatter(self.emitter("path-edge-tufts", edge, 3, lambda x0, y0: (x0 * 7.3 + y0 * 3.1) % 1.0 < 0.3), lib["tufts"], 14.0, (0.5, 1.0), seed=147, rotate_z_only=True, pick=True)

    def tile_paving(self):
        """A lane of basalt flags, rough-dressed and laid close, worn smooth
        and dusty, with earth and weeds in the joints (lakeside)."""
        if self.style != "lake":
            return super().tile_paving()
        m = self.map
        rng = self.rng
        spacing = 0.38
        nx = int(m.w / spacing) + 2
        ny = int(m.h / spacing) + 2
        grid = [[(i * spacing + (rng.random() - 0.5) * spacing * 0.5, j * spacing + (rng.random() - 0.5) * spacing * 0.5) for i in range(nx + 1)] for j in range(ny + 1)]
        bm = bmesh.new()
        layer = bm.faces.layers.float.new("rand")
        used = set()
        for j in range(ny):
            for i in range(nx):
                if (i, j) in used:
                    continue
                cx = (grid[j][i][0] + grid[j + 1][i + 1][0]) / 2
                cy = (grid[j][i][1] + grid[j + 1][i + 1][1]) / 2
                if m.kind(int(cx), int(cy)) != "paving":
                    continue
                corners = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
                if rng.random() < 0.25 and i + 1 < nx and (i + 1, j) not in used:
                    ccx = (grid[j][i + 1][0] + grid[j + 1][i + 2][0]) / 2
                    if m.kind(int(ccx), int(cy)) == "paving":
                        corners = [grid[j][i], grid[j][i + 2], grid[j + 1][i + 2], grid[j + 1][i]]
                        used.add((i + 1, j))
                used.add((i, j))
                # A few flags lifted or lost, mostly at the lane's edges.
                edge = m.near(int(cx), int(cy), ("scrub", "sand", "grass"), 1) and (cy - int(cy) < 0.2 or cy - int(cy) > 0.8)
                if rng.random() < (0.12 if edge else 0.03):
                    continue
                self._flag(bm, layer, corners, rng, gap=0.022)
        obj = common.mesh_object("lane-flags", bm, self.paving, self.col_ground, smooth=True)
        self.ground_objects.append(obj)
        lib = self._library()
        em = self.emitter("lane-weeds", m.tiles("paving"), 3, lambda x0, y0: (x0 * 5.1 + y0 * 11.7) % 1.0 < 0.18, z=0.03)
        scatter.scatter(em, lib["green"], 8.0, (0.3, 0.6), seed=151, rotate_z_only=True, pick=True)

    def tile_rock(self):
        """Rocks: black basalt boulders on the lakeside, rounded by weather,
        lichened, half sunk in the ground or the shingle."""
        if self.style != "lake":
            return super().tile_rock()
        rng = self.rng
        mat = L.basalt("#3f3c38", "boulder-basalt", dust=0.35, lichen=0.35, wet_below=self.z_water() + 0.05)
        for x, y in self.map.tiles("rock"):
            name = f"rock-{x}-{y}"
            big = 0.34 + rng.random() * 0.14
            objs = [self.boulder(f"{name}-0", self.P(x + 0.5, y + 0.55), (big, big * 0.8, big * 0.62), mat, rng.random() * 10, flat=0.7, blocky=0.3, sink=0.3)]
            for i in range(1 + int(rng.random() * 3)):
                s = 0.08 + rng.random() * 0.1
                a = rng.random() * math.tau
                objs.append(self.boulder(f"{name}-{i + 1}", self.P(x + 0.5 + math.cos(a) * 0.4, y + 0.6 + math.sin(a) * 0.25), (s, s * 0.85, s * 0.6), mat, rng.random() * 10, flat=0.7, blocky=0.3))
            for o in objs:
                common.add_modifier(o, "SUBSURF", levels=1, render_levels=1)
            self.sprite(name, y + 0.8, objs, [(x, y)])

    def tile_basket(self):
        """Baskets: of the day's catch on the lakeside (silver musht and
        barbels), of small salted fish packed for the winter in a Galilee
        house; elsewhere as before."""
        if not getattr(self, "galilee", False):
            return super().tile_basket()
        for x, y in self.map.tiles("basket"):
            name = f"basket-{x}-{y}"
            objs = []
            for i in range(2 if self.style == "home" else 1 + int(self.rng.random() * 2)):
                objs += self._fish_basket(f"{name}-{i}", self.P(x + 0.32 + i * 0.36, y + 0.5 + (i % 2) * 0.14), 0.9 + self.rng.random() * 0.2, dried=self.style == "home")
            self.sprite(name, y + 0.85, objs, [(x, y)])

    def _fish_basket(self, name, at, size, dried=False, count=None):
        """A round wicker basket heaped with fish."""
        rng = self.rng
        objs = [self._lathe(f"{name}-basket", [(0.1 * size, 0), (0.16 * size, 0.04 * size), (0.19 * size, 0.16 * size), (0.2 * size, 0.2 * size), (0.19 * size, 0.21 * size)], at, M.straw("#a38a5a"), 26)]
        n = count or (16 if dried else 9)
        for k in range(n):
            a = rng.random() * math.tau
            r = rng.random() ** 0.6 * 0.12 * size
            ln = (0.1 if dried else 0.2 + rng.random() * 0.1) * size
            p = at + Vector((math.cos(a) * r, math.sin(a) * r, 0.18 * size + (0.12 * size - r) * 0.5 + rng.random() * 0.02))
            objs.append(self._whole_fish(f"{name}-f{k}", p, ln, rng.random() * math.tau, dried))
        return objs

    def _whole_fish(self, name, at, length, angle, dried=False):
        """A whole fish lying on its side: a tapered body with a forked tail."""
        bm = bmesh.new()
        prof = [(0.0, 0.0), (0.06, 0.4), (0.22, 0.62), (0.5, 0.55), (0.75, 0.26), (0.84, 0.12), (0.9, 0.2), (1.0, 0.42)]
        rings = []
        for t, w in prof:
            x = (t - 0.5) * length
            hw = w * length * 0.3
            ring = []
            for k in range(8):
                a = math.tau * k / 8
                ring.append(bm.verts.new(Vector((x, math.cos(a) * hw * 0.35, math.sin(a) * hw))))
            rings.append(ring)
        for a, b in zip(rings, rings[1:]):
            for k in range(8):
                bm.faces.new((a[k], a[(k + 1) % 8], b[(k + 1) % 8], b[k]))
        # Lying on its side: the flat of the body up.
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(angle, 3, "Z"))
        bmesh.ops.translate(bm, vec=at, verts=bm.verts)
        mat = L.fish("#8e9496", "#434b52", "#d6b48c", 0.8 if dried else 0.0, name=f"fish-whole-{int(dried)}", whole=True)
        return common.mesh_object(name, bm, mat, None)

    def tile_sacks(self):
        """Sacks: of salt at the salter's (one open, the grey-white crystals
        showing); elsewhere as before."""
        if self.style != "lake":
            return super().tile_sacks()
        for x, y in self.map.tiles("sacks"):
            name = f"sacks-{x}-{y}"
            objs = self._sacks(name, x, y)
            for o in objs:
                if o.name.endswith("-grain"):
                    o.data.materials.clear()
                    o.data.materials.append(L.salt())
            self.sprite(name, y + 0.9, objs, [(x, y)])

    def tile_mat(self):
        """Mats: in a Galilee room one plaited rush mat over each block of
        mat tiles, lying a little unevenly on the cobbled floor, its bound
        edges curling up where it has been rolled; elsewhere as before."""
        if not getattr(self, "galilee", False) or self.style != "home":
            return super().tile_mat()
        m = self.map
        cells = set(m.tiles("mat"))
        seen = set()
        for c in sorted(cells):
            if c in seen:
                continue
            block, todo = [], [c]
            while todo:
                t = todo.pop()
                if t in seen or t not in cells:
                    continue
                seen.add(t)
                block.append(t)
                todo += [(t[0] + 1, t[1]), (t[0] - 1, t[1]), (t[0], t[1] + 1), (t[0], t[1] - 1)]
            x0 = min(x for x, _ in block)
            x1 = max(x for x, _ in block) + 1
            y0 = min(y for _, y in block)
            y1 = max(y for _, y in block) + 1
            w, h = x1 - x0 - 0.3, y1 - y0 - 0.25
            cx, cy = (x0 + x1) / 2 + 0.04, (y0 + y1) / 2
            nx, ny = 36, 24
            bm = bmesh.new()
            uvl = bm.loops.layers.uv.new("UVMap")
            rng = self.rng
            ph = rng.random() * 6.0
            verts = []
            for j in range(ny + 1):
                row = []
                for i in range(nx + 1):
                    s_, t_ = i / nx, j / ny
                    # Lies over the cobbles: a slow unevenness, and the ends
                    # curl up a little where it has been rolled.
                    z = 0.012 + 0.006 * math.sin(s_ * 5.1 + ph) * math.sin(t_ * 4.3 + ph * 0.7)
                    z += 0.03 * max(0.0, 0.12 - s_) / 0.12 + 0.02 * max(0.0, s_ - 0.9) / 0.1
                    # A slight skew: it was not laid square.
                    x = cx - w / 2 + s_ * w + 0.04 * (t_ - 0.5)
                    y = cy - h / 2 + t_ * h
                    row.append(bm.verts.new(self.P(x, y, z)))
                verts.append(row)
            for j in range(ny):
                for i in range(nx):
                    f = bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
                    for loop, (a_, b_) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                        loop[uvl].uv = (a_ / nx, b_ / ny)
            o = common.mesh_object(f"rush-mat-{x0}-{y0}", bm, L.rush_mat(), None)
            o["mat_w"] = w
            o["mat_h"] = h
            common.add_modifier(o, "SOLIDIFY", thickness=0.008, offset=-1.0)
            common.bake_modifiers(o)
            self.to_ground(o)

    def tile_trough(self):
        """Troughs: the salter's brine tubs on the lakeside, wide and shallow,
        of wood hooped with rope, fish lying in the brine; elsewhere as before."""
        if self.style != "lake":
            return super().tile_trough()
        rng = self.rng
        for x0, x1, y in self.map.runs("trough"):
            name = f"tubs-{x0}-{y}"
            objs = []
            for k in range(x1 - x0):
                c = self.P(x0 + k + 0.5, y + 0.52)
                tub = self._lathe(f"{name}-{k}", [(0.0, 0.0), (0.36, 0.0), (0.4, 0.28), (0.42, 0.32), (0.38, 0.32), (0.34, 0.06), (0.0, 0.06)], c, M.wood("#6a5238", 6.0), 32)
                objs.append(tub)
                objs.append(self._ellipsoid(f"{name}-brine{k}", c + Vector((0, 0, 0.25)), (0.36, 0.36, 0.004), L.brine(), 28, 4))
                for h in (0.08, 0.22):
                    objs.append(self._lathe(f"{name}-hoop{k}{h}", [(0.375 + h * 0.08, h - 0.015), (0.385 + h * 0.08, h), (0.375 + h * 0.08, h + 0.015)], c, L.rope("#8c7a58", "hoop-rope"), 32))
                for q in range(5):
                    objs.append(self._whole_fish(f"{name}-fish{k}{q}", c + Vector(((rng.random() - 0.5) * 0.4, (rng.random() - 0.5) * 0.4, 0.255)), 0.2 + rng.random() * 0.06, rng.random() * 6.28, dried=False))
            self.sprite(name, y + 0.88, objs, [(x, y) for x in range(x0, x1)])

    def dress_lake(self):
        """The lakeside's litter of life: fallen fronds under the palms, wet
        earth by the tubs, straw on the paving (as an oasis), and on the
        beach stone anchors and lost net floats."""
        self.dress_oasis()
        m = self.map
        rng = self.rng
        shingle = [(x, y) for x, y in m.tiles("shingle") if not m.near(x, y, ("boat", "jetty"), 1)]
        if not shingle:
            return
        floats = M.plain("#8a6a44", 0.85)
        for k in range(6):
            x, y = shingle[int(rng.random() * len(shingle))]
            self.to_ground(self._ellipsoid(f"lost-float{k}", self.P(x + rng.random(), y + rng.random(), 0.015), (0.035, 0.028, 0.018), floats, 10, 6))
        for k in range(2):
            x, y = shingle[int(rng.random() * len(shingle))]
            st = common.box(f"beach-anchor{k}", (0.32, 0.24, 0.09), self.P(x + 0.5, y + 0.5, 0.04), L.basalt("#4c4843", "anchor-stone", dust=0.2, lichen=0.3), None, bevel=0.04)
            st.rotation_euler = (0.05, 0.08, rng.random() * 3)
            common.bake_modifiers(st)
            self.to_ground(st)

    # ── the story's props ───────────────────────────────────────────────────
    def floor_z(self, x, y):
        """How far above the terrain something lying on tile (x, y) rests: on
        top of the jetty's blocks (the terrain is the bottom of their joints)."""
        if self.map.kind(x, y) == "jetty":
            return JOINT
        return super().floor_z(x, y)

    def _flat(self, e):
        """Whether an entity lies low enough to be walked over (not solid)."""
        return e is not None and e.get("solid") is False

    def entity_net_pile(self, name, x, y, e=None):
        """A pile of net: on the beach or a deck, a heap with its floats; in a
        room, a net spread across a mat for mending, the torn part pulled
        tight in new knots, a netting needle lying on it."""
        rng = self.rng
        if self.style == "home":
            c = self.P(x + 0.5, y + 0.5, 0.03)
            bm = bmesh.new()
            uv = bm.loops.layers.uv.new("UVMap")
            nx, ny = 16, 12
            grid = []
            for j in range(ny + 1):
                row = []
                for i in range(nx + 1):
                    u, v = i / nx - 0.5, j / ny - 0.5
                    z = 0.012 + 0.02 * max(0.0, math.sin(u * 9 + v * 4)) + (0.25 if u > 0.3 else 0.0) * (u - 0.3)
                    row.append(bm.verts.new(c + Vector((u * 1.3, -v * 0.8, z))))
                grid.append(row)
            for j in range(ny):
                for i in range(nx):
                    f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                    for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                        loop[uv].uv = (a / nx * 1.3, b / ny * 0.8)
            objs = [common.mesh_object(f"{name}-net", bm, L.net("#94805f", mesh=0.06, thread=0.12, veil=0.22, name="net-mending"), None)]
            objs.append(self._net_heap(f"{name}-heap", c + Vector((0.55, 0.05, -0.01)), 0.45, 0.5, rng))
            objs.append(self._branch(f"{name}-needle", c + Vector((-0.1, -0.1, 0.03)), c + Vector((0.08, -0.14, 0.03)), 0.008, 0.006, M.wood("#a8885a", 3.0), 5, bow=0.0))
            return objs, y * 32.0, True
        c = self.P(x + 0.5, y + 0.55, self.floor_z(x, y))
        objs = [self._net_heap(f"{name}-heap", c, 0.7, 0.85, rng)]
        if self._flat(e):
            return objs, y * 32.0, True
        return objs

    def entity_fish_jars(self, name, x, y, e=None):
        """Jars of salted fish: tall jars with narrow necks, stoppered with
        clay, a rope tied round each."""
        rng = self.rng
        objs = []
        clay = M.terracotta("#b0764e", 0.35)
        for k in range(3):
            px = x + 0.24 + k * 0.27
            py = y + 0.45 + (k % 2) * 0.16
            size = 0.9 + rng.random() * 0.12
            prof = [(0.03, 0), (0.1, 0.05), (0.14, 0.18), (0.145, 0.3), (0.11, 0.42), (0.05, 0.5), (0.045, 0.56), (0.06, 0.58)]
            c = self.P(px, py, self.floor_z(x, y))
            objs.append(self._lathe(f"{name}-{k}", [(r * size, h * size) for r, h in prof], c, clay, 28, tilt=(rng.random() - 0.5) * 0.05))
            objs.append(self._ellipsoid(f"{name}-stop{k}", c + Vector((0, 0, 0.585 * size)), (0.05 * size, 0.05 * size, 0.022), M.plain("#7a6048", 0.9), 12, 6))
            for h in (0.18, 0.36):
                objs.append(self._lathe(f"{name}-cord{k}{h}", [(0.148 * size, h * size - 0.01), (0.152 * size, h * size), (0.148 * size, h * size + 0.01)], c, L.rope("#9c8660", "jar-cord"), 24))
        return objs

    def entity_bailer(self, name, x, y, e=None):
        """A bailing scoop carved from one piece of wood: a deep bowl with a
        short handle, lying where it will be grabbed."""
        c = self.P(x + 0.5, y + 0.55, self.floor_z(x, y) + 0.005)
        wood = M.wood("#8a6a48", 4.0)
        bowl = self._lathe(f"{name}-bowl", [(0.0, 0.0), (0.06, 0.0), (0.11, 0.03), (0.13, 0.08), (0.125, 0.085)], c, wood, 22)
        bowl.data.transform(Matrix.Translation(c) @ Matrix.Rotation(1.35, 4, "Y") @ Matrix.Translation(-c))
        handle = self._branch(f"{name}-handle", c + Vector((-0.02, 0, 0.09)), c + Vector((-0.2, 0.02, 0.07)), 0.02, 0.016, wood, 6, bow=0.0)
        objs = [bowl, handle]
        return (objs, y * 32.0, True) if self._flat(e) else objs

    def entity_rope(self, name, x, y, e=None):
        """A coil of heavy rope, its end trailing."""
        c = self.P(x + 0.5, y + 0.55, self.floor_z(x, y))
        mat = L.rope("#9c8660", "coil-rope")
        objs = [self._coil(f"{name}-coil", c, 0.24, mat, self.rng, turns=6)]
        end = [c + Vector((0.24, 0.0, 0.03)), c + Vector((0.38, -0.12, 0.012)), c + Vector((0.46, -0.2, 0.012))]
        objs.append(self._tube(f"{name}-end", end, 0.016, mat, seg=6))
        return (objs, y * 32.0, True) if self._flat(e) else objs

    def entity_oar(self, name, x, y, e=None):
        """A spare oar lying on the deck; on the beach, leaning into the boat
        it was lent to."""
        oar = M.wood("#8a6c4c", 3.0)
        if not self.map.tiles("deck") and self.map.near(x, y, ("boat",), 1):
            a = self.P(x + 0.1, y + 0.8, 0.02)
            b = self.P(x + 1.3, y - 0.4, 0.55)
        else:
            a = self.P(x - 0.4, y + 0.5, self.floor_z(x, y) + 0.03)
            b = self.P(x + 1.5, y + 0.35, self.floor_z(x, y) + 0.03)
        objs = [self._oar(f"{name}-oar", a, b, oar, blade=0.62, r=0.026)]
        return (objs, y * 32.0, True) if self._flat(e) else objs

    def entity_floating_jars(self, name, x, y, e=None):
        """Jars thrown overboard, bobbing low in the water and tilted."""
        rng = self.rng
        zw = self.z_water()
        clay = M.terracotta("#b0764e", 0.0)
        objs = []
        for k in range(3):
            px, py = x + 0.2 + rng.random() * 0.8, y + 0.2 + rng.random() * 0.7
            c = self._at(px, py, zw - 0.3, zw)
            prof = [(0.03, 0), (0.1, 0.05), (0.14, 0.18), (0.145, 0.3), (0.11, 0.42), (0.05, 0.5), (0.045, 0.56), (0.06, 0.58)]
            objs.append(self._lathe(f"{name}-{k}", prof, c, clay, 24, tilt=1.1 + rng.random() * 0.4, spin=rng.random() * 6.28))
        return objs

    def entity_towline(self, name, x, y, e=None):
        """A towline: aboard, from your rail across the water to the little
        boat's bow, dipping into the lake between; ashore, lying along the
        shingle from their boat down to the water, still wet."""
        mat = L.rope("#8a7858", "towline", wet=0.8)
        pts = []
        o = self.family_outline() if self.map.tiles("deck") else None
        if o is not None:
            zw = self.z_water()
            ry = o["cy"] - float(np.interp(x + 0.5, o["x"], o["half"]))
            for k in range(13):
                t = k / 12
                my = ry - (ry - (y - 0.7)) * t
                z = max(0.8 * (1 - t) + zw * t - 0.25 * math.sin(math.pi * t), zw - 0.02)
                pts.append(Vector((x + 0.5 + 0.15 * math.sin(t * 3), -my, z)))
        else:
            for k in range(14):
                t = k / 13
                pts.append(self.P(x + 0.5 + 0.3 * math.sin(t * 4), y - 0.4 + t * 1.6, 0.02))
        return [self._tube(f"{name}-rope", pts, 0.02, mat, seg=6)], y * 32.0, True

    def entity_fish_basket(self, name, x, y, e=None):
        """A basket of the day's catch."""
        return self._fish_basket(name, self.P(x + 0.5, y + 0.55, self.floor_z(x, y)), 1.0)

    def entity_lamp(self, name, x, y, e=None):
        """A lamp: on the lakeside, Grandmother's clay lamp set down on the
        jetty's stones, burning (it is there only at night, and its light is
        in the night's ground); elsewhere as before."""
        if self.style != "lake":
            return super().entity_lamp(name, x, y, e)
        c = self.P(x + 0.45, y + 0.55, self.floor_z(x, y))
        body = self._ellipsoid(f"{name}-lamp", c + Vector((0, 0, 0.03)), (0.075, 0.055, 0.03), M.terracotta("#b2714a", 0.1), 16, 8)
        nozzle = self._ellipsoid(f"{name}-nozzle", c + Vector((0.075, 0, 0.035)), (0.035, 0.026, 0.02), M.terracotta("#a8683f", 0.1), 10, 6)
        flame = self._ellipsoid(f"{name}-flame", c + Vector((0.095, 0, 0.085)), (0.014, 0.014, 0.036), M.emissive("#ffc070", 40.0), 8, 6)
        return [body, nozzle, flame]

    def entity_vessels(self, name, x, y, e=None):
        """On the lakeside, the salter's measuring jars: a big jar that holds
        eight measures and a small one that holds five, each marked with a
        row of scratched strokes, a dipper beside them; elsewhere as before."""
        if self.style != "lake":
            return super().entity_vessels(name, x, y, e)
        objs = []
        c = self.P(x + 0.38, y + 0.55)
        big = [(0.1, 0), (0.2, 0.06), (0.24, 0.24), (0.22, 0.42), (0.13, 0.52), (0.11, 0.56), (0.13, 0.58)]
        objs.append(self._lathe(f"{name}-big", big, c, M.terracotta("#a86a48", 0.4), 32))
        small = [(0.06, 0), (0.12, 0.05), (0.14, 0.16), (0.12, 0.27), (0.07, 0.33), (0.06, 0.36), (0.075, 0.38)]
        objs.append(self._lathe(f"{name}-small", small, c + Vector((0.42, -0.06, 0)), M.terracotta("#b87c56", 0.3), 28))
        mark = M.plain("#3a2a1c", 0.9)
        for k in range(8):
            objs.append(common.box(f"{name}-m8-{k}", (0.012, 0.004, 0.05), c + Vector((-0.1 + k * 0.028, -0.235, 0.3)), mark, None))
        for k in range(5):
            objs.append(common.box(f"{name}-m5-{k}", (0.01, 0.004, 0.04), c + Vector((0.37 + k * 0.024, -0.2, 0.18)), mark, None))
        objs.append(self._lathe(f"{name}-dipper", [(0.0, 0.0), (0.05, 0.0), (0.07, 0.04), (0.072, 0.05)], c + Vector((0.2, -0.3, 0)), M.terracotta("#9c6444", 0.2), 18))
        return objs

    # ── a Galilee room by day and by lamplight ──────────────────────────────
    def dress_home(self):
        """A fisher family's room: rushes on the floor as anywhere, and in
        Galilee basalt cobbles set in the beaten earth, a string of small
        fish drying along the back wall, two oars leaning against it, and a
        clay lamp on the table that burns after dark."""
        super().dress_home()
        if not getattr(self, "galilee", False):
            return
        # Dark basalt and smoked mud plaster give back less light than
        # limestone and lime: the eye opens a little further.
        self.exposure += 0.35
        m = self.map
        rng = self.rng
        # Basalt cobbles set close in the beaten earth over the floor (bare
        # earth in worn patches), laid as a surface just over the floor and
        # under whatever stands on it (not the oven's hearth).
        inside = [(x, y) for y in range(m.h) for x in range(m.w) if m.kind(x, y) not in ("wall", "door", "void", "oven")]
        bm = bmesh.new()
        # Fine enough to follow the floor's own unevenness, and a little over
        # it, so none of the floor beneath shows through.
        k = 6
        for x, y in inside:
            g = [[bm.verts.new(self.P(x + i / k, y + j / k, 0.012)) for i in range(k + 1)] for j in range(k + 1)]
            for j in range(k):
                for i in range(k):
                    bm.faces.new((g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]))
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        cob = common.mesh_object("floor-cobbles", bm, L.cobble_floor(), None, smooth=False)
        self.to_ground(cob)
        back = min((y for y in range(m.h) if any(m.kind(x, y) == "floor" for x in range(m.w))), default=2)
        # A cord along the back wall, small fish split and hung on it.
        cord_mat = L.rope("#8c7a58", "fish-cord")
        xa, xb = 6.4, 9.6
        pts = [self.P(xa + (xb - xa) * t / 12, back + 0.06, 1.95 - 0.18 * math.sin(math.pi * t / 12)) for t in range(13)]
        self.to_ground(self._tube("fish-cord", pts, 0.008, cord_mat, seg=5))
        for k in range(11):
            t = (k + 0.5) / 11
            p = pts[0].lerp(pts[-1], t)
            p.z = 1.95 - 0.18 * math.sin(math.pi * t) - 0.01
            for o in self._split_fish(f"cord-fish{k}", p, 0.13 + rng.random() * 0.04, rng, hang=True):
                self.to_ground(o)
        # Oars leaning on the back wall.
        oar = M.wood("#8a6c4c", 3.0)
        for k, x in enumerate((12.35, 12.75)):
            a = self.P(x, back + 0.55, 0.02)
            b = self.P(x + 0.25, back + 0.08, 2.35)
            self.to_ground(self._oar(f"wall-oar{k}", b, a, oar, blade=0.6, r=0.026))
        # A lamp on the table.
        tables = m.runs("table")
        if tables:
            x0, x1, y = tables[0]
            c = self.P(x0 + 0.35, y + 0.42, 0.445)
            objs = [self._ellipsoid("table-lamp", c + Vector((0, 0, 0.028)), (0.07, 0.05, 0.028), M.terracotta("#b2714a", 0.1), 16, 8)]
            objs.append(self._ellipsoid("table-lamp-nozzle", c + Vector((0.068, 0, 0.032)), (0.034, 0.025, 0.018), M.terracotta("#a8683f", 0.1), 10, 6))
            objs += self.lamp_flame("table-lamp", c + Vector((0.088, 0, 0.078)), (0.013, 0.034), 16.0, c + Vector((0.088, -0.05, 0.13)), radius=40.0)
            self.sprite("table-lamp", y + 0.92, objs, [(x0, y)])
        self._room_after_dark()

    def _room_after_dark(self):
        """A room at night: no daylight in at the door, only a little
        moonlight; the lamps and the oven's embers light it, and the bounce
        of daylight off the floor and walls becomes a dim, warm lamp-bounce.
        (The moon's strength and the exposure are the `lamplight` light's.)"""
        for light in list(self.lights):
            if light.name == "door-daylight":
                night = self.add_light("door-moonlight", light.data.type, light.location.copy(), 9.0, "#9eb8eb")
            elif light.name in ("room-fill", "front-bounce"):
                night = self.add_light(f"{light.name}-lamps", light.data.type, light.location.copy(), light.data.energy * 0.1, "#ffb873")
            else:
                continue
            only(light, BY_DAY)
            night.rotation_euler = light.rotation_euler.copy()
            if light.data.type == "AREA":
                night.data.shape = light.data.shape
                night.data.size = light.data.size
                if light.data.shape in ("RECTANGLE", "ELLIPSE"):
                    night.data.size_y = light.data.size_y
            only(night, AFTER_DARK)
        # The dust glowing in the sunbeams is there only while the sun is.
        for shaft in self.volumes:
            only(shaft, BY_DAY)
