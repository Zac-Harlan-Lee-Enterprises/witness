"""Any place in the game, built in 3D from its own scene data.

`Place(scene).build()` reads a scene exported by scripts/export-art-data.ts
(tile map, legend, mood, kind, entities) and builds everything in it, so the
art always matches the collision grid:

  - the terrain: one mesh over the whole map, shaped by a height field
    (hills, cliffs, the wadi, a spring's basin) and SHEARED so that every
    point lands on screen exactly where its tile is (see terrain.py), with
    one layered ground material (earth, road, paving bed, soil, floor...);
  - structures from regions of wall, roof and door tiles: stone houses and
    the city wall (city), mudbrick houses, porticos and courtyard walls
    (oasis), or a room seen in cutaway (home);
  - one builder per tile kind (`tile_<kind>` below): props, plants, rocks,
    furniture and ground dressing;
  - story entities by their sprite name (`entity_<sprite>`), rendered as
    `entity:<id>` sprites so the game draws them only while they are shown.

Each standing thing is a *sprite*: it gets its own render, and the game
sorts it by `base` (the ground line it stands on, in game units) against
people. Everything else is part of the ground layer.

To support a new tile kind (Wave 2 chapters add some), add a `tile_<kind>`
method to a kit (or here) with a docstring saying what it builds, and give
it a ground layer in GROUND if people walk on it. The build stops with a
clear error for any kind in a legend without a builder.

Coordinates: game tiles (x east, y south) -> Blender (x, -y); heights in
tiles. The screen position of a point is (x, y - z) in tiles.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import common
import lighting
import materials as M
import scatter
import terrain
from kit_ground import GroundKit
from kit_interior import InteriorKit
from kit_masonry import MasonryKit
from kit_mudbrick import MudbrickKit
from kit_plants import PlantsKit
from kit_props import PropsKit
from kit_roman import RomanKit
from kit_village import VillageKit

# Mirrors TILE_KINDS in src/domain/world.ts: which kinds block movement.
SOLID = {
    "wall", "roof", "water", "well", "olive", "palm", "rock", "cliff", "hill", "bush", "stall", "table",
    "jars", "cairn", "fence", "oven", "crate", "sacks", "basket", "loom", "cart", "tent", "trough",
    "crops", "reeds", "fig", "cloth", "void",
    # Chapter 3 (kit_village.py)
    "manger", "sheepfold", "terrace", "sheep", "hay", "campfire",
    # Chapter 4 (kit_roman.py)
    "tile-roof", "column", "vat", "amphorae", "couch", "milestone", "travertine", "garden", "lampstand",
    "fountain",
}
STRUCTURE = {"wall", "roof", "door"}

# Which ground layer each walkable kind is painted with, per style. Solid
# props stand on the layer of the ground around them. Layer 0 of a style is
# its base (baseTile or the first listed).
GROUND = {
    "city": {
        "layers": ["earth", "scrub", "path", "bed", "hillside"],
        # Only for a city on terrain (Colossae under Mount Cadmus); the
        # market's flat ground is its own (_ground_city).
        "kinds": {"paving": "bed", "gate": "bed", "steps": "bed", "sand": "earth", "scrub": "scrub", "hill": "hillside"},
    },
    "wilderness": {
        "layers": ["dust", "wscrub", "road", "wadi", "mud", "path", "hilltop", "rut"],
        "kinds": {"sand": "dust", "scrub": "wscrub", "road": "road", "wadi": "wadi", "mud": "mud",
                  "hill": "hilltop", "cliff": "hilltop", "rock": "hilltop", "bush": "hilltop", "cairn": "dust",
                  "well": "dust"},
    },
    "oasis": {
        "layers": ["earth", "grass", "path", "yard", "soil", "wet", "poolbed", "meadow", "lane", "setts", "sinter"],
        "kinds": {"sand": "path", "scrub": "grass", "paving": "yard", "soil": "soil", "crops": "soil",
                  "water": "poolbed", "reeds": "wet", "palm": "grass", "fig": "grass", "gate": "yard", "door": "yard",
                  "well": "yard", "trough": "yard", "cart": "yard", "sacks": "yard", "fence": "earth",
                  "basket": "yard", "loom": "yard", "oven": "yard", "jars": "yard", "wall": "earth", "roof": "earth",
                  # Chapter 4: the Lycus valley (kit_roman.py)
                  "grass": "meadow", "hill": "meadow", "road": "lane", "roman-road": "setts", "bridge": "setts",
                  "travertine": "sinter"},
    },
    "home": {
        "layers": ["floor", "hearth", "trodden"],
        "kinds": {"floor": "floor"},
    },
}

LAYER_LOOKS = {
    # city (kept as the market was first built)
    "earth": {"color": "#c8ac82", "ripple": 0.18, "grit": 0.35},
    "scrub": {"color": "#a8956a", "scale": "mid", "dark": 0.14, "light": 0.08},
    "path": {"color": "#d0b98f", "dark": 0.05, "light": 0.08},
    "bed": {"color": "#8a7658", "scale": "mid"},
    "yard": {"color": "#ab9471", "scale": "mid", "grit": 0.4, "dark": 0.08, "light": 0.06, "mottle": 0.25, "mottle_color": "#9a8262"},
    # wilderness
    "dust": {"color": "#d8c7a3", "ripple": 0.06, "grit": 0.5, "dark": 0.14, "light": 0.1, "chips": 0.35},
    "road": {"color": "#d2bf99", "grit": 0.55, "dark": 0.05, "light": 0.06},
    "wadi": {"color": "#d9ccb0", "grit": 0.6, "scale": "mid", "mottle": 0.35, "mottle_color": "#b3a488", "chips": 0.5},
    "mud": {"color": "#7a664c", "scale": "mid", "rough": 0.6, "mottle": 0.3, "mottle_color": "#5e4c38"},
    "hilltop": {"color": "#d0bf9b", "grit": 0.7, "scale": "mid", "mottle": 0.35, "mottle_color": "#b09c78"},
    "rut": {"color": "#bba886", "grit": 0.3, "dark": 0.06, "light": 0.03},
    "wscrub": {"color": "#c2b08a", "scale": "mid", "dark": 0.1, "light": 0.06, "mottle": 0.25, "mottle_color": "#a89a74", "chips": 0.3},
    # oasis
    "grass": {"color": "#8e8a55", "scale": "mid", "dark": 0.16, "light": 0.1, "mottle": 0.35, "mottle_color": "#6f7a3e"},
    "soil": {"color": "#6b5238", "streak": 0.45, "grit": 0.2, "rough": 0.85, "mottle": 0.3, "mottle_color": "#54402c"},
    "wet": {"color": "#6a5c44", "rough": 0.55, "scale": "mid"},
    "poolbed": {"color": "#a49a78", "scale": "mid", "mottle": 0.45, "mottle_color": "#6f7a58", "grit": 0.5, "rough": 0.6},
    # home
    "floor": {"color": "#a5875e", "grit": 0.35, "scale": "mid", "dark": 0.15, "light": 0.07, "chips": 0.15, "mottle": 0.3, "mottle_color": "#8e7050", "cracks": 0.3, "crack_scale": 2.2},
    "hearth": {"color": "#6a5848", "grit": 0.25, "scale": "mid", "mottle": 0.45, "mottle_color": "#40352c"},
    "trodden": {"color": "#b39670", "dark": 0.06, "light": 0.05, "grit": 0.12},
    # Chapter 4 (kit_roman.py): Mount Cadmus's grassy foothills; the Lycus
    # valley after rain (wet grass, a muddy lane, the gravel bed of the
    # highway, the white travertine of Hierapolis)
    "hillside": {"color": "#8a8456", "scale": "mid", "dark": 0.16, "light": 0.08, "mottle": 0.4, "mottle_color": "#6c6c40", "grit": 0.25, "chips": 0.2},
    "meadow": {"color": "#7c8448", "scale": "mid", "dark": 0.16, "light": 0.06, "mottle": 0.45, "mottle_color": "#626c3a", "grit": 0.15, "rough": 0.72},
    "lane": {"color": "#806c50", "grit": 0.5, "dark": 0.1, "light": 0.03, "mottle": 0.4, "mottle_color": "#5e4e3a", "rough": 0.42},
    "setts": {"color": "#6e675a", "grit": 0.55, "scale": "mid", "dark": 0.1, "light": 0.04, "rough": 0.5},
    "sinter": {"color": "#e2ded2", "grit": 0.08, "scale": "mid", "dark": 0.06, "light": 0.03, "mottle": 0.25, "mottle_color": "#d2cbb8", "rough": 0.55},
}


def B(x, y, z=0.0):
    """Game tile coordinates to Blender, on flat ground."""
    return Vector((x, -y, z))


# ── map reading ─────────────────────────────────────────────────────────────
class Map:
    def __init__(self, scene):
        self.id = scene["id"]
        self.rows = scene["layout"]
        self.legend = scene["legend"]
        self.h = len(self.rows)
        self.w = len(self.rows[0])
        self.entities = scene["entities"]
        self.exits = scene.get("exits", [])
        self.mood = scene.get("mood")
        self.kind_of_scene = scene.get("kind", "outdoor")

    def kind(self, x, y):
        if x < 0 or y < 0 or x >= self.w or y >= self.h:
            return "void"
        return self.legend[self.rows[y][x]]

    def runs(self, kind):
        """Horizontal runs of a tile kind: (x0, x1_exclusive, y)."""
        out = []
        for y in range(self.h):
            x = 0
            while x < self.w:
                if self.kind(x, y) == kind:
                    x0 = x
                    while x < self.w and self.kind(x, y) == kind:
                        x += 1
                    out.append((x0, x, y))
                else:
                    x += 1
        return out

    def tiles(self, kind):
        return [(x, y) for y in range(self.h) for x in range(self.w) if self.kind(x, y) == kind]

    def kinds(self):
        return sorted({self.legend[c] for row in self.rows for c in row})

    def walkable(self, x, y):
        return self.kind(x, y) not in SOLID

    def near(self, x, y, kinds, r=1):
        return any(self.kind(x + dx, y + dy) in kinds for dx in range(-r, r + 1) for dy in range(-r, r + 1))


class Sprite:
    """A standing thing rendered on its own and depth-sorted by the game.

    - `base`: the ground line it stands on (game units, y);
    - `conditional`: shown only while a story condition holds, so it must
      not cast shadows into the ground layer or onto other sprites; it
      carries its own shadow instead (a shadow catcher under it);
    - `flat`: lies on the ground (prints, a mat): anyone standing on it
      draws over it, so its base is its northern edge."""

    def __init__(self, sid, base, objects, tiles=None, conditional=False, flat=False, fade=False):
        self.id = sid
        self.base = base
        self.objects = objects
        self.tiles = tiles or []
        self.conditional = conditional
        self.flat = flat
        # A canopy (a palm's crown): the game fades it while someone walks behind it.
        self.fade = fade


def value_noise(w, h, cell, seed):
    rng = np.random.default_rng(seed)
    gw, gh = int(w / cell) + 3, int(h / cell) + 3
    g = rng.random((gh, gw))
    ys, xs = np.mgrid[0:h, 0:w] / cell
    x0 = xs.astype(int)
    y0 = ys.astype(int)
    tx = xs - x0
    ty = ys - y0
    tx = tx * tx * (3 - 2 * tx)
    ty = ty * ty * (3 - 2 * ty)
    a = g[y0, x0]
    b = g[y0, x0 + 1]
    c = g[y0 + 1, x0]
    d = g[y0 + 1, x0 + 1]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty


def style_for(scene):
    mood = scene.get("mood")
    if mood in GROUND:
        return mood
    return "home" if scene.get("kind") == "indoor" else "city"


# ── the builder ─────────────────────────────────────────────────────────────
def tile_builder(kind):
    """The method that builds a tile kind: tile_ plus the kind, dashes as
    underscores (tile-roof: tile_tile_roof)."""
    return "tile_" + kind.replace("-", "_")


class Place(VillageKit, RomanKit, GroundKit, MasonryKit, PropsKit, PlantsKit, MudbrickKit, InteriorKit):
    """Builds a whole place. Kits supply the tile builders; this class reads
    the map, shapes the terrain and dispatches. (VillageKit comes first: it
    builds the Judean hill village of Chapter 3 and hands everything else on
    to the kits after it.)"""

    def __init__(self, scene_data, seed=11):
        self.data = scene_data
        self.map = Map(scene_data)
        self.style = style_for(scene_data)
        self.rng = common.rng(seed)
        self.sprites = []
        self.ground_objects = []
        # Never seen by the camera, but cast shadows and bounce light (a room's
        # near wall and roof in cutaway).
        self.occluders = []
        # Extra lights the place brings (a lamp, the oven's glow).
        self.lights = []
        # Volumes (dust in a sun shaft), in the ground layer only.
        self.volumes = []
        self.exposure = 0.0
        # Extra exposure (EV) per lighting variant (a room lit only by lamps).
        self.variant_exposure = {}
        # Fires and lamps the game makes flicker: (kind, x, y, radius, variants), game units.
        self.flicker = []
        self.col_ground = common.collection("ground")
        self.heights = None
        self._materials()

    # ── the story's light ───────────────────────────────────────────────────
    @property
    def light_plan(self):
        """{set: light}: each set of the manifest and the light it is
        rendered in (lighting.PLACE_LIGHTS)."""
        return lighting.plan_for(self.map.id, self.style == "home")[0]

    @property
    def people_light(self):
        """How people are lit here (the manifest's peopleLight), or None."""
        return lighting.plan_for(self.map.id, self.style == "home")[1]

    # ── palette ─────────────────────────────────────────────────────────────
    def _materials(self):
        self.wood = M.wood("#6f5134", 5.0)
        self.dark = M.plain("#1f1812", 0.9, 0.1)
        if self.style == "city":
            self.limestone = M.limestone("#d8c39b", "ashlar")
            self.paving = M.limestone("#cfb993", "paving", worn=0.35)
            self.roof = M.plaster("#d4c19c", "roof-plaster")
        elif self.style == "oasis":
            self.limestone = M.limestone("#cdb892", "fieldstone", worn=0.6)
            self.paving = M.limestone("#c2aa84", "yard-paving", worn=0.75)
            self.roof = M.plaster("#b89a74", "roof-mud")
            self.brick = M.mudbrick("#a8845c", "#bf9f78", "mudbrick", 0.6)
            self.brick_bare = M.mudbrick("#a07a52", "#b8966c", "mudbrick-bare", 0.25)
            self.mudplaster = M.plaster("#bd9d74", "mud-plaster")
        elif self.style == "wilderness":
            self.limestone = M.limestone("#cfc1a0", "wild-limestone", worn=0.7)
            self.paving = self.limestone
            self.roof = M.plaster("#d4c19c", "roof-plaster")
        else:  # home
            self.limestone = M.limestone("#cdbb96", "house-stone", worn=0.5)
            self.paving = M.limestone("#c6b08a", "threshold", worn=0.5)
            self.roof = M.plaster("#d4c19c", "roof-plaster")
            self.plaster = M.lime_plaster("#dccdb0", "room-plaster", soot=0.55)

    def light_spots(self, variant):
        """The fires and lamps burning in a lighting variant, for the game to
        make flicker: kind ('hearth' or 'lamp'), centre and radius in game units."""
        return [
            {"kind": k, "x": round(x, 1), "y": round(y, 1), "radius": round(r, 1)}
            for k, x, y, r, vs in self.flicker
            if variant in vs
        ]

    # ── heights ─────────────────────────────────────────────────────────────
    def H(self, x, y):
        """Terrain height (tiles) under map point (x, y)."""
        return terrain.sample(self.heights, x, y) if self.heights is not None else 0.0

    def P(self, x, y, z=0.0):
        """The Blender point `z` above the terrain at map point (x, y): the
        terrain is sheared so that point shows on screen at (x, y - z)."""
        h = self.H(x, y)
        return Vector((x, -(y + h), h + z))

    # ── build ───────────────────────────────────────────────────────────────
    def build(self):
        m = self.map
        missing = [k for k in m.kinds() if not hasattr(self, tile_builder(k))]
        if missing:
            raise SystemExit(f"No builder for tile kinds {missing} in {m.id}: add Place.tile_<kind> (tools/art/lib)")
        self.heights = self.shape_heights(terrain.heights(self))
        self._ground()
        self._structures()
        for k in m.kinds():
            getattr(self, tile_builder(k))()
        self._entities()
        self._dressing()
        return self

    # ── ground ──────────────────────────────────────────────────────────────
    # (ground_spec, layer_look, shape_heights, ground_rock and shape_mask are
    # hooks with defaults in VillageKit, which every place has: the village
    # gives its places their own ground; the rest keep their style's.)
    def ground_layer_of(self, kind):
        g = self.ground_spec()
        if kind in g.get("kinds", {}):
            return g["kinds"][kind]
        return None

    def _masks(self, px=16):
        """Per-layer masks from the map (warped edges), as RGB images."""
        m = self.map
        g = self.ground_spec()
        names = g["layers"]
        W, Hh = m.w * px, m.h * px
        warp = (value_noise(W, Hh, 10, 3) - 0.5) * 7 + (value_noise(W, Hh, 3, 4) - 0.5) * 2.5
        warp2 = (value_noise(W, Hh, 10, 5) - 0.5) * 7 + (value_noise(W, Hh, 3, 6) - 0.5) * 2.5
        ys, xs = np.mgrid[0:Hh, 0:W]
        tx = np.clip(((xs + warp) / px).astype(int), 0, m.w - 1)
        ty = np.clip(((ys + warp2) / px).astype(int), 0, m.h - 1)
        layer_idx = np.zeros((m.h, m.w), dtype=np.int32)
        for y in range(m.h):
            for x in range(m.w):
                name = self.ground_layer_of(m.kind(x, y))
                if name is None:
                    # Solid props and structures stand on whatever surrounds them.
                    counts = {}
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nm = self.ground_layer_of(m.kind(x + dx, y + dy))
                            if nm:
                                counts[nm] = counts.get(nm, 0) + 1
                    name = max(counts, key=counts.get) if counts else names[0]
                layer_idx[y, x] = names.index(name) if name in names else 0
        li = layer_idx[ty, tx]
        chans = []
        import terrain as _t

        for i in range(1, len(names)):
            mask = _t._blur((li == i).astype(np.float64), max(1, px // 5)).astype(np.float32)
            chans.append(self._shape_mask(names[i], mask, W, Hh, px))
        images = []
        for k in range(0, len(chans), 3):
            img = np.zeros((Hh, W, 4), dtype=np.float32)
            for c in range(3):
                if k + c < len(chans):
                    img[..., c] = chans[k + c]
            img[..., 3] = 1.0
            im = bpy.data.images.new(f"mask-{m.id}-{k // 3}", W, Hh, alpha=True, float_buffer=True)
            im.colorspace_settings.name = "Non-Color"
            im.pixels.foreach_set(img[::-1].reshape(-1))
            im.pack()
            images.append(im)
        return names, images

    def _shape_mask(self, name, mask, W, Hh, px):
        """Soften and break up a layer's mask so layers blend like real ground."""
        shaped = self.shape_mask(name, mask, W, Hh, px)
        if shaped is not None:
            return shaped
        if name in ("scrub", "grass", "wscrub"):
            return mask * np.clip(value_noise(W, Hh, 6, 9) * 1.5, 0, 1)
        if name == "path":
            return mask * np.clip(value_noise(W, Hh, 12, 8) * 1.6 - 0.1, 0, 1)
        if name == "hilltop":
            return mask
        if name == "trodden":
            if self.style == "home":
                return self._near(("door",), 3.2, W, Hh, px, 12)
            return mask * np.clip(value_noise(W, Hh, 10, 12) * 1.4, 0, 1)
        if name == "hearth":
            return self._near(("oven",), 1.7, W, Hh, px, 14)
        if name == "rut":
            return self._ruts(W, Hh, px)
        return mask

    def _near(self, kinds, radius, W, Hh, px, seed):
        """A soft mask within `radius` tiles of the given kinds, broken up by noise."""
        m = self.map
        pts = [(x + 0.5, y + 0.5) for k in kinds for x, y in m.tiles(k)]
        if not pts:
            return np.zeros((Hh, W), dtype=np.float32)
        ys, xs = np.mgrid[0:Hh, 0:W] / px
        d = np.min([np.hypot(xs - x, ys - y) for x, y in pts], axis=0)
        near = np.clip(1 - d / radius, 0, 1) ** 0.8
        return (near * np.clip(value_noise(W, Hh, 9, seed) * 1.5 - 0.1, 0, 1)).astype(np.float32)

    def _ruts(self, W, Hh, px):
        """Two worn wheel tracks along each band of road, a gauge apart."""
        m = self.map
        out = np.zeros((Hh, W), dtype=np.float32)
        ys = np.arange(Hh) / px
        for x in range(m.w):
            y = 0
            while y < m.h:
                if m.kind(x, y) != "road":
                    y += 1
                    continue
                y0 = y
                while y < m.h and m.kind(x, y) == "road":
                    y += 1
                top, bot = y0, y
                for f in (0.3, 0.7):
                    c = top + (bot - top) * f
                    band = np.clip(1 - np.abs(ys - c) / 0.16, 0, 1)
                    out[:, x * px : (x + 1) * px] = np.maximum(out[:, x * px : (x + 1) * px], band[:, None])
        wob = value_noise(W, Hh, 20, 57)
        return out * np.clip(wob * 1.4 + 0.1, 0, 1)

    def _ground(self):
        m = self.map
        if self.style == "city" and self.heights is None and not self.village:
            return self._ground_city()
        names, images = self._masks()
        layers = [dict(self.layer_look(n)) for n in names]
        self._extra_masks(names, images)
        rock, red, macro = self.ground_rock()
        mat = M.ground_surface(f"ground-{m.id}", images, layers, rock=rock, red_mask=red, macro=macro)
        g = terrain.mesh(self, mat, self.col_ground)
        self.ground_objects.append(g)

    def _extra_masks(self, names, images):
        """Paths trodden by feet in the home and oasis styles (the 'path' and
        'trodden' layers follow walkable tiles next to doors and paving)."""
        return None

    def _red_mask(self, px=8):
        """Where the rock is stained red (cliff tiles, spreading a little)."""
        m = self.map
        W, Hh = m.w * px, m.h * px
        cl = np.zeros((m.h, m.w), dtype=np.float32)
        for x, y in m.tiles("cliff"):
            cl[y, x] = 1.0
        up = np.kron(cl, np.ones((px, px), dtype=np.float32))
        k = px * 2
        pad = np.pad(up, k, mode="edge")
        acc = np.zeros_like(up)
        for dy in range(-k, k + 1, 2):
            for dx in range(-k, k + 1, 2):
                acc += pad[k + dy : k + dy + Hh, k + dx : k + dx + W]
        acc /= ((2 * k) // 2 + 1) ** 2
        acc = np.clip(acc * 1.4 * (0.55 + 0.6 * value_noise(W, Hh, 14, 31)), 0, 1)
        img = np.zeros((Hh, W, 4), dtype=np.float32)
        img[..., 0] = acc
        img[..., 3] = 1.0
        im = bpy.data.images.new(f"red-{m.id}", W, Hh, alpha=True, float_buffer=True)
        im.colorspace_settings.name = "Non-Color"
        im.pixels.foreach_set(img[::-1].reshape(-1))
        im.pack()
        return im

    # ── the market's ground (kept exactly as first built) ──────────────────
    def _ground_city(self):
        m = self.map
        px = 16
        W, H = m.w * px, m.h * px
        warp = (value_noise(W, H, 10, 3) - 0.5) * 7 + (value_noise(W, H, 3, 4) - 0.5) * 2.5
        warp2 = (value_noise(W, H, 10, 5) - 0.5) * 7 + (value_noise(W, H, 3, 6) - 0.5) * 2.5
        ys, xs = np.mgrid[0:H, 0:W]
        tx = np.clip(((xs + warp) / px).astype(int), 0, m.w - 1)
        ty = np.clip(((ys + warp2) / px).astype(int), 0, m.h - 1)
        kinds = np.array([[m.kind(x, y) for x in range(m.w)] for y in range(m.h)])
        k = kinds[ty, tx]
        bed = np.isin(k, ["paving", "steps", "gate", "well"]).astype(np.float32)
        scrub = np.isin(k, ["scrub", "cloth"]).astype(np.float32)
        near = np.zeros((m.h, m.w), dtype=np.float32)
        for y in range(m.h):
            for x in range(m.w):
                if m.kind(x, y) in ("sand",) and m.near(x, y, ("paving", "door", "gate", "steps")):
                    near[y, x] = 1.0
        path = near[ty, tx] * np.clip(value_noise(W, H, 12, 8) * 1.6 - 0.2, 0, 1)
        img = np.zeros((H, W, 4), dtype=np.float32)
        img[..., 0] = bed
        img[..., 1] = scrub * np.clip(value_noise(W, H, 6, 9) * 1.4, 0, 1)
        img[..., 2] = path
        img[..., 3] = 1.0
        splat = bpy.data.images.new("splat", W, H, alpha=True, float_buffer=True)
        splat.colorspace_settings.name = "Non-Color"
        splat.pixels.foreach_set(img[::-1].reshape(-1))
        splat.pack()
        colors = {"sand": "#c8ac82", "scrub": "#a8956a", "bed": "#8a7658", "path": "#d0b98f"}
        mat = M.ground(splat, colors)
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=m.w * 4, y_subdivisions=m.h * 4, size=1.0)
        g = bpy.context.object
        g.name = "ground"
        g.scale = (m.w, m.h, 1)
        g.location = (m.w / 2, -m.h / 2, 0)
        g.data.materials.append(mat)
        for c in g.users_collection:
            c.objects.unlink(g)
        self.col_ground.objects.link(g)
        tex = bpy.data.textures.new("ground-disp", "CLOUDS")
        tex.noise_scale = 0.8
        common.add_modifier(g, "DISPLACE", texture=tex, strength=0.025, mid_level=0.5)
        self.ground_objects.append(g)

    # ── structures ──────────────────────────────────────────────────────────
    def _structures(self):
        """Regions of wall, roof and door tiles: what they are depends on the style."""
        if self.style == "city":
            self._buildings()
        elif self.style == "oasis":
            self.oasis_structures()
        elif self.style == "home":
            self.room_shell()
        elif self.map.tiles("wall") or self.map.tiles("roof"):
            self._buildings()

    def regions(self, kinds=STRUCTURE, exclude=()):
        m = self.map
        seen = set(exclude)
        out = []
        for y in range(m.h):
            for x in range(m.w):
                if (x, y) in seen or m.kind(x, y) not in kinds:
                    continue
                stack = [(x, y)]
                reg = []
                seen.add((x, y))
                while stack:
                    cx, cy = stack.pop()
                    reg.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if (nx, ny) not in seen and m.kind(nx, ny) in kinds:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
                out.append(sorted(reg))
        return out

    # Structure kinds are built by _structures; their tile builders only document it.
    def tile_wall(self):
        """Walls: built with their region (houses, the city wall, courtyard walls, a room)."""

    def tile_roof(self):
        """Roofs: built with their region (flat plaster, thatch over beams)."""

    def tile_door(self):
        """Doors: doorways in the walls of their region."""

    def tile_void(self):
        """Nothing: outside the map."""

    # ── entities ────────────────────────────────────────────────────────────
    def _entities(self):
        for e in self.map.entities:
            sprite = e.get("sprite") or ""
            maker = getattr(self, "entity_" + sprite.replace("-", "_"), None) if sprite else None
            if e["id"] == "cart" and self.style == "city":
                maker = self._cart
            if maker is None:
                continue
            sid = f"entity:{e['id']}"
            made = maker(sid, e["x"], e["y"], e)
            if made is None:
                continue
            objs, base, flat = made if isinstance(made, tuple) else (made, (e["y"] + 0.85) * 32, False)
            self.sprites.append(Sprite(sid, base, objs, [(e["x"], e["y"])], conditional=e.get("conditional", False), flat=flat))

    # ── dressing ────────────────────────────────────────────────────────────
    def _dressing(self):
        if self.style == "city":
            self._litter()
        else:
            self.dress()

    def dress(self):
        """Style-specific dressing over the whole place (overridden by kits)."""
        if self.style == "wilderness":
            self.dress_wilderness()
        elif self.style == "oasis":
            self.dress_oasis()
        elif self.style == "home":
            self.dress_home()

    # ── shared helpers ──────────────────────────────────────────────────────
    def _rand_attr(self, obj, value=None):
        me = obj.data
        attr = me.attributes.get("rand") or me.attributes.new("rand", "FLOAT", "FACE")
        rng = self.rng
        for i in range(len(me.polygons)):
            attr.data[i].value = rng.random() if value is None else value

    def _ellipsoid(self, name, centre, radii, mat, segments=14, rings=8):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
        bmesh.ops.scale(bm, vec=Vector(radii), verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(centre), verts=bm.verts)
        return common.mesh_object(name, bm, mat, None)

    def _lathe(self, name, profile, at, mat, segments=28, tilt=0.0, spin=0.0):
        obj = common.lathe(name, profile, segments, mat, None)
        obj.data.transform(Matrix.Translation(at) @ Matrix.Rotation(spin, 4, "Z") @ Matrix.Rotation(tilt, 4, "X"))
        return obj

    def _branch(self, name, a, b, r0, r1, mat, seg=8, bow=0.05):
        bm = bmesh.new()
        d = b - a
        n = 5
        rings = []
        side = d.orthogonal().normalized()
        up = d.cross(side).normalized()
        for k in range(n + 1):
            t = k / n
            c = a + d * t + up * math.sin(t * math.pi) * bow
            r = r0 + (r1 - r0) * t
            rings.append([bm.verts.new(c + (side * math.cos(math.tau * j / seg) + up * math.sin(math.tau * j / seg)) * r) for j in range(seg)])
        for p, q in zip(rings, rings[1:]):
            for j in range(seg):
                jj = (j + 1) % seg
                bm.faces.new((p[j], p[jj], q[jj], q[j]))
        return common.mesh_object(name, bm, mat, None)

    def to_ground(self, obj):
        """Move an object into the ground layer (seen, never sorted against people)."""
        for c in obj.users_collection:
            c.objects.unlink(obj)
        self.col_ground.objects.link(obj)
        self.ground_objects.append(obj)
        return obj

    def occluder(self, obj):
        """Hidden from the camera in every pass, but casting shadows and bouncing light."""
        obj["occluder"] = True
        self.occluders.append(obj)
        for c in obj.users_collection:
            c.objects.unlink(obj)
        self.col_ground.objects.link(obj)
        return obj

    def sprite(self, sid, base_row, objs, tiles, **kw):
        """Register a sprite whose ground line is map row `base_row` (tiles)."""
        sp = Sprite(sid, base_row * 32.0, objs, tiles, **kw)
        self.sprites.append(sp)
        return sp
