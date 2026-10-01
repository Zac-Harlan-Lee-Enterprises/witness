"""The game's people (people.py) in the teaser: placed anywhere in a set,
walking along paths with their feet planted, or standing (the man lying in
the shade is a body of his own: teaser_body.py).

`Figure(appearance)` builds a person exactly as the game's sheets do and
`place(W, **pose)` poses them and puts them at the world transform W.

`Walker` moves a figure along a path with foot locking: from the walk cycle
itself it measures how far the body travels while a foot is on the ground,
so the stance foot stays exactly where it was set down (no sliding), and
the walker's speed is whatever the stride and cadence make it.
"""
import math

import numpy as np
from mathutils import Matrix, Vector

import people as P


class Figure:
    def __init__(self, appearance, name, marks=()):
        self.appearance = appearance
        self.person = P.Person(appearance, marks=marks, name=name)
        self._track = None

    @property
    def objects(self):
        return [part.obj for part in self.person.parts]

    def place(self, W, **pose):
        """Pose the person (people.Person.pose arguments) and move them to W."""
        self.person.pose(**pose)
        for part in self.person.parts:
            if part.bone is not None:
                part.obj.matrix_world = W @ part.obj.matrix_basis.copy()
            else:
                part.obj.matrix_world = W
        lamp = getattr(self.person, "lamp_light", None)
        if lamp is not None:
            light, _ = lamp
            light.matrix_world = W @ light.matrix_basis.copy()

    def stride(self, samples=120):
        """(phases, body travel) through one walk cycle, from the stance foot:
        body travel at phase p is how far the body moves forward (character
        -Y) while the foot on the ground stays put."""
        if self._track is not None:
            return self._track
        per = self.person
        H = per.H
        J = per.J
        ps = np.linspace(0.0, 1.0, samples + 1)
        feet = []
        for p in ps:
            R = P.pose_rotations(p, 0.0, 0, hand="R")
            mats = per._forward(R)
            here = []
            for s in ("L", "R"):
                m = mats[P.BONE_INDEX[f"foot_{s}"]]
                ank = m @ J[f"ankle_{s}"].to_4d()
                toe = m @ J[f"toe_{s}"].to_4d()
                sole = min(ank.z - 0.042 * H, toe.z - 0.012 * H)
                here.append((sole, (ank.y + toe.y) / 2))
            feet.append(here)
        travel = [0.0]
        for i in range(samples):
            (sl0, yl0), (sr0, yr0) = feet[i]
            (_, yl1), (_, yr1) = feet[i + 1]
            # The foot on the ground carries the body: it slides back under
            # the hips (+Y) exactly as far as the body moves forward.
            dy = (yl1 - yl0) if sl0 <= sr0 else (yr1 - yr0)
            travel.append(travel[-1] + max(0.0, dy))
        self._track = (ps, np.array(travel))
        return self._track

    def stride_length(self):
        return float(self.stride()[1][-1])


def facing(theta):
    """Rotation that turns a person (who faces -Y) to face angle theta
    (radians from +X, counter-clockwise)."""
    return Matrix.Rotation(theta + math.pi / 2, 4, "Z")


class Walker:
    """A figure walking a path at a cadence (cycles per second), feet planted.

    path: (N, 2) points in metres; ground(x, y) -> z; start: arc length at
    t = 0; phase: walk phase at t = 0."""

    def __init__(self, figure, path, ground, cadence=0.9, start=0.0, phase=0.0, scale=None):
        self.figure = figure
        self.path = np.asarray(path, dtype=np.float64)
        seg = np.linalg.norm(np.diff(self.path, axis=0), axis=1)
        self.s = np.concatenate([[0.0], np.cumsum(seg)])
        self.ground = ground
        self.cadence = cadence
        self.start = start
        self.phase = phase
        ps, travel = figure.stride()
        self.ps, self.travel = ps, travel
        self.length = float(travel[-1])

    def distance(self, t):
        cycles = self.phase + self.cadence * t
        whole = math.floor(cycles)
        frac = cycles - whole
        base = self.phase - math.floor(self.phase)
        d = whole * self.length + float(np.interp(frac, self.ps, self.travel))
        d0 = float(np.interp(base, self.ps, self.travel))
        return self.start + d - d0, frac

    def point(self, s):
        x = float(np.interp(s, self.s, self.path[:, 0]))
        y = float(np.interp(s, self.s, self.path[:, 1]))
        return x, y

    def heading(self, s, look=0.6):
        x0, y0 = self.point(s - look)
        x1, y1 = self.point(s + look)
        return math.atan2(y1 - y0, x1 - x0)

    def at(self, t):
        s, frac = self.distance(t)
        x, y = self.point(s)
        z = float(self.ground(x, y))
        W = Matrix.Translation(Vector((x, y, z))) @ facing(self.heading(s))
        self.figure.place(W, walk=frac)
        return Vector((x, y, z))


def standing(figure, at, theta, breath=0.0, talk=0):
    W = Matrix.Translation(Vector(at)) @ facing(theta)
    figure.place(W, breath=breath, talk=talk)
