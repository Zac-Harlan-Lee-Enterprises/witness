"""One portrait: build a person (head, eyes, skin, hair, clothes) in the
portrait studio and render it.

The steps, all deterministic for a given id and appearance:
1. parameters from the appearance and id (portrait_params);
2. the head field (portrait_head), meshed finely; the shoulders, coarsely;
3. regional skin maps written onto the head mesh (portrait_skin);
4. eyes turned to the camera (portrait_eyes);
5. clothes and head covering (portrait_cloth), meshed;
6. hair grown on the head and kept under any covering (portrait_hair);
7. the studio: lens, lights, backdrop (portrait_scene).
"""
import math
import os
import time

import bpy
from mathutils import Vector

import common
import portrait_cloth
import portrait_eyes
import portrait_hair
import portrait_head
import portrait_materials as PM
import portrait_mesh
import portrait_params
import portrait_scene
import portrait_sdf as S
import portrait_skin

TURN_DEG = -22.0  # the camera stands this far round to the person's right: they face screen right
FRAME_CM = 28.0  # height of the picture at the face
CENTRE = (0.0, 0.0, -0.9)  # what the camera looks at (cm)
MANTLE = ("#6e6452", "#4c4436")  # undyed wool with darker stripes, as the world's elders wear


def log(*a):
    print("[portrait]", *a, flush=True)


def framing(P):
    """(picture height at the face in cm, what the camera looks at)."""
    frame = FRAME_CM * (1.0 - 0.08 * P.child)
    return frame, (CENTRE[0], CENTRE[1], CENTRE[2] + 0.4 * P.child)


def camera_position(turn_deg=TURN_DEG, frame_cm=FRAME_CM, centre=CENTRE, lens=85.0, sensor=36.0):
    dist = frame_cm * 0.01 * lens / sensor
    a = math.radians(turn_deg)
    c = Vector(centre) * 0.01
    return c + Vector((math.sin(a) * dist, -math.cos(a) * dist, 0.035))


def build(pid, appearance, player=False, voxel=0.08, samples=256, size=512, hair_quality=1.0):
    """Build the scene for one person (replacing whatever was loaded)."""
    t0 = time.time()
    P = portrait_params.params_for(pid, appearance, player=player)
    log(portrait_params.describe(P))
    a = appearance
    head = portrait_head.Head(P)
    V, Q, N = S.polygonize(head.shape, (-10, -14, -20), (10, 12, 16), voxel)
    Q = portrait_mesh.orient_quads(V, Q, N)
    body_shape = head.body()
    Vb, Qb, Nb = S.polygonize(body_shape, (-26, -13, -42), (26, 15, -6), 0.4)
    Qb = portrait_mesh.orient_quads(Vb, Qb, Nb)
    log("head", len(V), "vertices", f"{time.time() - t0:.1f}s")

    scene = common.reset(samples)
    col = common.collection("portrait")
    elder = a["build"] == "elder"
    weathered = 0.35 if elder else (0.05 if a["build"] == "child" else 0.15)
    alb, rough, pores = portrait_skin.maps(head, V, a["skin"], beard=a["beard"], weathered=weathered)
    skin = PM.skin(pid, weathered, P.child, portrait_skin.subsurface_weight(a["skin"]))
    obj = portrait_mesh.from_arrays("head", V, Q, N, skin, col)
    portrait_mesh.set_attribute(obj, "albedo", alb)
    portrait_mesh.set_attribute(obj, "rough", rough)
    portrait_mesh.set_attribute(obj, "pores", pores)
    body = portrait_mesh.from_arrays("body", Vb, Qb, Nb, skin, col)
    ab, rb, pb = portrait_skin.maps(head, Vb, a["skin"], beard=False, weathered=weathered)
    portrait_mesh.set_attribute(body, "albedo", ab)
    portrait_mesh.set_attribute(body, "rough", rb)
    portrait_mesh.set_attribute(body, "pores", pb)

    # Clothes and head covering.
    wool_head = a["headwear"] in ("band", "hood")
    mats = {
        "tunic": PM.cloth(a["robe"], "wool", a["accent"], 0.062, 0.011, name="tunic"),
        "mantle": PM.cloth(MANTLE[0], "wool", MANTLE[1], 0.1, 0.02, name="mantle"),
        "headwear": PM.cloth(a["headwearColor"], "wool" if wool_head else "linen", name="headwear"),
    }
    # The head sampled once on grids: clothes (over the head without its ears)
    # and hair are built on them.
    head_grid = S.GridShape(S.FieldGrid(head.shape, (-14, -16, -22), (14, 15, 19), 0.25))
    drape_grid = S.GridShape(S.FieldGrid(head.without_ears, (-14, -16, -22), (14, 15, 19), 0.3))
    log("head field", f"{time.time() - t0:.1f}s")
    clothes = portrait_cloth.Clothes(head, P, head_shape=drape_grid)
    for name, (shape, key, lo, hi, vox) in clothes.parts.items():
        Vc, Qc, Nc = S.polygonize(shape, lo, hi, vox)
        Qc = portrait_mesh.orient_quads(Vc, Qc, Nc)
        portrait_mesh.from_arrays(name, Vc, Qc, Nc, mats[key], col)
    log("clothes", f"{time.time() - t0:.1f}s")

    # Hair.
    field = S.FieldGrid(S.Union([head_grid, body_shape], 0.5), (-13, -15, -34), (13, 14, 17), 0.3)
    obstacle = None
    if clothes.obstacle is not None:
        obstacle = S.FieldGrid(clothes.obstacle, (-15, -16, -30), (15, 18, 21), 0.35)
    hair_hex = a["hair"]
    grey = P.grey
    hair_mats = {
        "hair": PM.hair(hair_hex, grey),
        "beard": PM.hair(hair_hex, min(1.0, grey * 1.15), name="beard"),
        "brow": PM.hair(hair_hex, grey * 0.7, name="brow"),
        "lash": PM.hair("#1a1410", 0.0, name="lash"),
    }
    portrait_hair.Hair(head, P, V, Q, N, field, col, hair_mats, quality=hair_quality, obstacle=obstacle)
    log("hair", f"{time.time() - t0:.1f}s")

    # Eyes, looking at the camera, and the studio.
    # Children are framed a little closer, so their faces fill the picture like an adult's.
    frame, centre = framing(P)
    cam = camera_position(frame_cm=frame, centre=centre)
    portrait_eyes.Eyes(head, P, col, cam)
    focus = Vector(head.eye_centre(-1 if TURN_DEG < 0 else 1).tolist()) * 0.01
    portrait_scene.Studio(scene, focus=focus, turn_deg=TURN_DEG, frame_cm=frame, centre=centre, size=size, samples=samples)
    log("built", f"{time.time() - t0:.1f}s")
    return scene, P


def render(scene, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path
