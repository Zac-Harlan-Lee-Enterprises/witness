"""How a world figure moves: joint rotations for every frame a sheet shows.

Rotations are degrees about the character's own axes at each joint, in the
parent's frame (world_body.rot): X is the person's left, so a limb swung
forward is a negative rotation about X and a knee bent a positive one;
Y points backward, so a positive rotation about Y tips the top of a bone
toward the person's right... (see world_body for the frame). Returned as
MakeHuman bone names -> 3x3, plus a root transform (4x4) for the whole body.

- **Walk**: an eight-frame cycle from the left heel's contact, after
  normative adult gait (hip, knee and ankle angles through the stride),
  a little shortened for someone walking in a long tunic: the heel strikes
  and the foot rolls flat, the knee takes the weight (a small flexion just
  after contact), the stance leg extends behind as the body passes over it,
  the toe pushes off and the swing knee folds to about 55°. The pelvis turns
  and drops toward the swinging leg; the chest turns against it; the arms
  swing opposite the legs, the elbows bending as the arm comes forward; the
  head stays level and looks ahead. The body rises and falls because the
  feet stay on the ground (the build lifts the whole figure onto the
  lowest sole, frame by frame).
- **Standing**: weight on the right leg, the left knee a little soft, the
  hips tilted a few degrees and the shoulders tilted back against them
  (contrapposto), the head a touch off level; the breath frame lifts the
  chest and shoulders.
- **Talking**: the free hand lifted in a gesture, the head raised a little.
- **Sitting** (cross-legged on the ground) and **lying** (on the back, a
  knee raised).
"""
import math

import numpy as np

from world_body import rot

# Normative sagittal gait, degrees through the cycle (0 = heel strike):
# hip flexion (+ forward), knee flexion, ankle dorsiflexion (+ toes up).
_GAIT = {
    "hip": [(0.0, 24.0), (0.1, 21.0), (0.2, 12.0), (0.3, 4.0), (0.4, -4.0), (0.5, -9.0), (0.6, -3.0), (0.7, 11.0), (0.8, 21.0), (0.9, 26.0)],
    "knee": [(0.0, 3.0), (0.1, 15.0), (0.2, 16.0), (0.3, 9.0), (0.4, 5.0), (0.5, 9.0), (0.6, 34.0), (0.7, 56.0), (0.75, 58.0), (0.8, 48.0), (0.9, 18.0)],
    "ankle": [(0.0, 0.0), (0.05, -6.0), (0.1, -3.0), (0.2, 3.0), (0.3, 7.0), (0.4, 9.0), (0.5, 4.0), (0.6, -14.0), (0.65, -16.0), (0.7, -9.0), (0.8, 0.0), (0.9, 2.0)],
    # The toes bend up as the heel lifts, and flatten again.
    "toe": [(0.0, 0.0), (0.4, 0.0), (0.5, 18.0), (0.6, 30.0), (0.68, 8.0), (0.75, 0.0)],
}
# A walk in a long tunic: a shorter stride than the laboratory's.
STRIDE = 0.72


def _curve(name, q):
    """Periodic Catmull-Rom through the gait table at phase q (0-1)."""
    pts = _GAIT[name]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    n = len(pts)
    q %= 1.0
    k = max(i for i in range(n) if xs[i] <= q)
    x0, x1 = xs[k], xs[(k + 1) % n] + (1.0 if k == n - 1 else 0.0)
    t = (q - x0) / (x1 - x0)
    p0, p1, p2, p3 = ys[(k - 1) % n], ys[k], ys[(k + 1) % n], ys[(k + 2) % n]
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t**3)


def _T(x=0.0, y=0.0, z=0.0):
    M = np.eye(4)
    M[:3, 3] = (x, y, z)
    return M


def _R4(R, about=(0, 0, 0)):
    M = np.eye(4)
    M[:3, :3] = R
    c = np.asarray(about, float)
    M[:3, 3] = c - R @ c
    return M


def curl(R, hand, amount):
    """Bend the fingers of `hand` ("L"/"R") by `amount` (0 open … 1 a fist)."""
    s = 1.0 if hand == "L" else -1.0
    for f in range(1, 6):
        for k in range(1, 4):
            bone = f"finger{f}-{k}.{hand}"
            if f == 1:
                # The thumb folds across, less.
                R[bone] = rot(y=s * 18.0 * amount if k == 1 else 0.0, x=-22.0 * amount)
            else:
                R[bone] = rot(y=s * (30.0 if k == 1 else 42.0) * amount)
    return R


def pose(walk=None, breath=0.0, talk=0, hand="R", rest=None, carry="none", J=None, height=1.7):
    """(rotations {MakeHuman bone: 3x3}, root 4x4) for one frame. `J` is the
    body's landmarks (world_body.Body.J), `height` its height (m)."""
    R = {}
    root = np.eye(4)
    rise = float(breath)
    if rest == "sit":
        # Cross-legged: thighs forward and out, shins folded in, hands on the knees.
        for side, sgn in (("L", 1), ("R", -1)):
            R[f"upperleg01.{side}"] = rot(x=-84.0, z=sgn * 42.0)
            R[f"lowerleg01.{side}"] = rot(x=138.0, z=-sgn * 38.0)
            R[f"foot.{side}"] = rot(x=28.0)
            R[f"upperarm01.{side}"] = rot(x=-26.0, y=sgn * 8.0)
            R[f"lowerarm01.{side}"] = rot(x=-50.0, z=-sgn * 14.0)
            curl(R, side, 0.35)
        R["spine04"] = rot(x=4.0 - 0.6 * rise)
        R["spine02"] = rot(x=-3.0 - 1.0 * rise)
        R["neck01"] = rot(x=-4.0)
        R["head"] = rot(x=6.0)
        if talk:
            k = 1.0 if talk == 1 else 0.75
            s = -1.0 if hand == "R" else 1.0
            R[f"upperarm01.{hand}"] = rot(x=-40.0 * k, y=10.0 * s)
            R[f"lowerarm01.{hand}"] = rot(x=-70.0 * k, z=10.0 * k * s)
            curl(R, hand, 0.2)
        return R, root
    if rest == "lie":
        # On the back: one knee a little raised, arms by the sides.
        R["upperleg01.L"] = rot(x=-14.0)
        R["lowerleg01.L"] = rot(x=26.0)
        R["foot.L"] = rot(x=-10.0)
        R["foot.R"] = rot(x=-25.0)
        R["upperarm01.L"] = rot(y=14.0)
        R["upperarm01.R"] = rot(y=-10.0, x=-8.0)
        R["lowerarm01.L"] = rot(x=-12.0)
        R["lowerarm01.R"] = rot(x=-40.0)
        curl(R, "L", 0.3)
        curl(R, "R", 0.4)
        R["spine02"] = rot(x=-1.5 * rise)
        R["head"] = rot(z=12.0, x=-6.0 + (3.0 if talk else 0.0))
        if J is not None:
            pivot = np.asarray(J["pelvis"], float)
            root = _R4(rot(x=-90.0), pivot)
        return R, root
    if walk is not None:
        p = walk
        for side, q in (("L", p), ("R", (p + 0.5) % 1.0)):
            hip = _curve("hip", q) * STRIDE
            knee = _curve("knee", q) * 0.88
            ankle = _curve("ankle", q) * STRIDE
            R[f"upperleg01.{side}"] = rot(x=-hip)
            R[f"lowerleg01.{side}"] = rot(x=knee)
            R[f"foot.{side}"] = rot(x=-ankle)
            toe = _curve("toe", q)
            for t in range(1, 6):
                R[f"toe{t}-1.{side}"] = rot(x=-toe)
            # The arm swings with the opposite leg: forward as that leg does.
            opp = _curve("hip", (q + 0.5) % 1.0) * STRIDE
            sgn = 1 if side == "L" else -1
            R[f"upperarm01.{side}"] = rot(x=-0.62 * opp + 1.5, y=sgn * 3.0)
            R[f"lowerarm01.{side}"] = rot(x=-(8.0 + 0.45 * max(0.0, opp)))
            curl(R, side, 0.28)
        ph = 2 * math.pi * p
        # The pelvis turns forward with the swinging leg and drops on its side.
        turn = 4.0 * math.cos(ph)
        drop = 3.0 * math.sin(2 * ph)
        sway = 0.012 * height * math.sin(ph)
        root = _T(sway, 0, 0) @ _R4(rot(y=drop * 0.6, z=turn), J["pelvis"] if J is not None else (0, 0, 0.9))
        # The chest turns back against it; the head looks ahead.
        R["spine04"] = rot(x=2.0, z=-turn * 0.6)
        R["spine02"] = rot(x=1.0, y=-drop * 0.4, z=-turn * 0.9)
        R["neck01"] = rot(z=turn * 0.3)
        R["head"] = rot(x=-2.0, z=turn * 0.2)
    else:
        # Standing at ease: weight on the right leg (contrapposto).
        R["upperleg01.L"] = rot(x=-4.0, y=-1.5)
        R["lowerleg01.L"] = rot(x=8.0)
        R["foot.L"] = rot(x=-4.0)
        R["upperleg01.R"] = rot(y=-1.5)
        root = _R4(rot(y=-2.2), J["pelvis"] if J is not None else (0, 0, 0.9)) @ _T(-0.008 * height, 0, 0)
        R["spine04"] = rot(y=1.4, x=-0.8 * rise)
        R["spine02"] = rot(y=1.4, x=-1.4 * rise)
        R["neck01"] = rot(y=-1.0)
        R["head"] = rot(y=-1.2, x=1.5)
        for side, sgn in (("L", 1), ("R", -1)):
            R[f"clavicle.{side}"] = rot(y=-sgn * 1.2 * rise)
            R[f"upperarm01.{side}"] = rot(y=sgn * (1.0 + 0.6 * rise), x=-2.0)
            R[f"lowerarm01.{side}"] = rot(x=-10.0)
            curl(R, side, 0.3)
    if talk:
        k = 1.0 if talk == 1 else 0.75
        s = -1.0 if hand == "R" else 1.0
        R[f"upperarm01.{hand}"] = rot(x=-26.0 * k, y=10.0 * s)
        R[f"lowerarm01.{hand}"] = rot(x=-64.0 * k, z=12.0 * k * s)
        curl(R, hand, 0.15)
        R["head"] = rot(x=2.5 * k, y=-1.2)
    return R, root


def carry_pose(R, carry, rest, breath=0.0):
    """Arms held for what the person carries (standing)."""
    if rest is not None:
        return R
    if carry == "lamp":
        # The lamp held up before him, lighting the way.
        R["upperarm01.R"] = rot(x=-36.0, y=-14.0)
        R["lowerarm01.R"] = rot(x=-82.0, z=6.0)
        curl(R, "R", 0.5)
    elif carry == "lamb":
        for side, sgn in (("L", 1), ("R", -1)):
            R[f"upperarm01.{side}"] = rot(x=-22.0, y=sgn * 6.0)
            R[f"lowerarm01.{side}"] = rot(x=-78.0, z=-sgn * 24.0)
            curl(R, side, 0.4)
    elif carry == "tablets":
        R["upperarm01.L"] = rot(x=-14.0 + (2.0 if breath else 0.0), y=6.0)
        R["lowerarm01.L"] = rot(x=-116.0, z=-38.0)
        curl(R, "L", 0.3)
    elif carry in ("staff", "oar"):
        R["upperarm01.R"] = rot(x=-12.0, y=-4.0)
        R["lowerarm01.R"] = rot(x=-38.0)
        curl(R, "R", 0.85)
    elif carry in ("basket", "jar"):
        curl(R, "L", 0.8)
    elif carry == "bread":
        R["upperarm01.R"] = rot(x=-8.0)
        R["lowerarm01.R"] = rot(x=-70.0, z=-8.0)
        curl(R, "R", 0.3)
    elif carry == "spindle":
        R["upperarm01.L"] = rot(x=-18.0, y=4.0)
        R["lowerarm01.L"] = rot(x=-95.0, z=-10.0)
        R["upperarm01.R"] = rot(x=-10.0)
        R["lowerarm01.R"] = rot(x=-52.0)
        curl(R, "L", 0.6)
        curl(R, "R", 0.5)
    return R
