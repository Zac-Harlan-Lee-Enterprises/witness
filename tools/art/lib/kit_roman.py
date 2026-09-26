"""Greco-Roman towns of the province of Asia: Colossae and the Lycus valley
(Chapter 4, A Letter from Paul).

A place belongs here when its chapter is in ROMAN_CHAPTERS. Its style stays
the one its mood gives it (city, oasis, home: see place.py), so everything
shared keeps working, but its buildings, floors and much of its furniture
are Roman rather than Judean:

  - a town street (city): a frontage of stuccoed houses and shops under
    pitched roofs of terracotta tiles (tegulae and imbrices, antefixes at
    the eaves), a stoa of Ionic columns with its entablature and lean-to
    roof on a stylobate, big paving slabs, a public fountain, a fuller's
    yard, the town wall and its west gate, the foothills of Mount Cadmus
    (roman_town.py);
  - the Lycus valley (oasis): a paved highway between kerbstones with
    milestones, a stone bridge over the river, a dye works and a
    waystation of rubble and stucco under tiled roofs, wet meadows, and
    the white travertine terraces of Hierapolis across the valley
    (roman_valley.py);
  - rooms (home), in cutaway like every room: a dyer's workshop floored
    with red opus signinum, dye vats steaming, skeins drying; a peristyle
    house (Philemon's) with a painted wall, a mosaic floor, triclinium
    couches, bronze lampstands and a garden ringed by Ionic columns, seen
    at lamp-lighting (roman_rooms.py).

The kit is split by subject: roman_geom.py (geometry helpers, shared
materials), roman_materials.py (stucco, roof tile, marble, bronze, dyes,
river water, paving, signinum, mosaic, fresco, travertine, wool,
papyrus), roman_arch.py (tile roofs, the Ionic order, fronts, doors,
windows), roman_props.py (vats, amphorae, skeins, milestones,
lampstands, couches, fountains, tables, hearths, the story's props).

Overrides of shared builders call the shared one for any place that is
not Roman. The story's light: the road is walked as the rain comes down
the valley (`overcast`, wet stone; the game draws the rain), and the
gathering at Philemon's house is at lamp-lighting (`dusk`, lamps): see
LIGHT_PLANS and build_place.py.
"""
import math

from roman_arch import RomanArchitecture
from roman_geom import RomanGeometry
from roman_props import RomanProps
from roman_rooms import RomanRooms
from roman_town import RomanTown
from roman_valley import RomanValley

# Chapters set in Greco-Roman towns (their places are built by this kit).
ROMAN_CHAPTERS = {"letter-from-paul"}

# Each manifest variant and the light it is rendered in (build_place.py),
# and how people are lit there (their sheets' light), where the story
# needs other than the sun of the hour.
LIGHT_PLANS = {
    # Walked from mid-morning as the rain sweeps down the valley (hours
    # 11-14: always the morning set): rain cloud and wet stone.
    "lycus-road": ({"day": "overcast"}, "overcast"),
    # The gathering is at lamp-lighting (hour 18), and only then.
    "philemon-house": ({"day": "dusk"}, "lamp"),
}


class RomanKit(RomanGeometry, RomanArchitecture, RomanProps, RomanTown, RomanValley, RomanRooms):
    # ── which places, which light ───────────────────────────────────────────
    @property
    def roman(self):
        """A place in a Greco-Roman town (its chapter is in ROMAN_CHAPTERS)."""
        return self.data.get("chapter") in ROMAN_CHAPTERS

    @property
    def light_plan(self):
        """{variant: light} for build_place.py, or None for the default."""
        plan = LIGHT_PLANS.get(self.map.id) if self.roman else None
        return plan[0] if plan else None

    @property
    def people_light(self):
        """How people are lit here (the manifest's peopleLight), or None."""
        plan = LIGHT_PLANS.get(self.map.id) if self.roman else None
        return plan[1] if plan else None

    # ── tile kinds built with their structures ──────────────────────────────
    def tile_tile_roof(self):
        """Tiled roofs: built with the building they cover (a town house, a
        farm building), sloping to eaves over its front."""

    # ── columns ─────────────────────────────────────────────────────────────
    def _colonnade_rows(self):
        """Rows of columns close enough to carry a beam (3 tiles or less
        apart): (x0, x1, y)."""
        by_row = {}
        for x, y in self.map.tiles("column"):
            by_row.setdefault(y, []).append(x)
        out = []
        for y, xs in sorted(by_row.items()):
            xs.sort()
            if len(xs) >= 2 and all(b - a <= 3 for a, b in zip(xs, xs[1:])):
                out.append((xs[0], xs[-1] + 1, y))
        return out

    def tile_column(self):
        """Ionic columns: a stoa along a street (the columns on a stylobate,
        the entablature they carry and a lean-to tile roof back to the wall
        behind), or the ring of a peristyle garden in a house. The house is
        seen in cutaway, like its walls: its roof and the beams that carried
        it are cut away, so the columns stand to their capitals and nobody
        at the gathering is lost behind a beam. One sprite per column."""
        if self.style == "city":
            self._stoas()
            return
        painted = ("#8e2e1e", 1.05) if self.style == "home" else None
        for x, y in self.map.tiles("column"):
            name = f"column-{x}-{y}"
            objs, _top = self._ionic_column(name, x + 0.5, y + 0.5, 2.4, r=0.15, painted=painted)
            self.sprite(name, y + 0.72, objs, [(x, y)])

    def _stoas(self):
        m = self.map
        sty = 0.19
        for x0, x1, y in self._colonnade_rows():
            cy = y + 0.5 + sty
            tops = []
            for x in range(x0, x1):
                if m.kind(x, y) != "column":
                    continue
                name = f"column-{x}-{y}"
                objs, top = self._ionic_column(name, x + 0.5, cy, 2.75, r=0.17, z0=sty)
                tops.append(sty + top)
                self.sprite(name, cy + 0.26, objs, [(x, y)])
            z0 = max(tops)
            a, b = x0 + 0.5 - 0.45, x1 - 0.5 + 0.45
            name = f"stoa-{x0}-{y}"
            objs, z_top = self._entablature(name, a, b, cy, "x", z0, depth=0.36)
            # The wall behind: the first row of wall tiles to the north.
            wy = y
            while wy > 0 and m.kind((x0 + x1) // 2, wy) not in ("wall", "door", "gate"):
                wy -= 1
            y_wall = wy + 1.0
            y_eave = cy + 0.32
            z_eave = z_top - 0.02
            z_wall = z_eave + (y_eave - y_wall) * math.tan(math.radians(14.0))
            objs += self._tile_roof(f"{name}-roof", a - 0.1, b + 0.1, y_eave, z_eave, y_wall + 0.02, z_wall, ridge=False)
            # Antae: pilasters against the wall at each end of the stoa.
            bm, layer = self._rbm()
            for px in (a - 0.05, b - 0.3):
                self._cbox(bm, layer, px, y_wall, px + 0.35, y_wall + 0.28, 0.0, z0, chamfer=0.02)
                self._cbox(bm, layer, px - 0.03, y_wall, px + 0.38, y_wall + 0.32, z0 - 0.14, z0, chamfer=0.02)
            self.sprite(name, cy + 0.3, objs, [(x, y) for x in range(x0, x1)])
            self.sprite(f"{name}-antae", y_wall + 0.3, [self._obj(f"{name}-antae", bm, self._mat("marble"))], [(x0, wy), (x1 - 1, wy)])
