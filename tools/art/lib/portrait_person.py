"""One portrait: build a person (head, eyes, teeth, skin, hair, clothes) in
one expression, in the portrait studio, and render it.

The steps, all deterministic for a given id, appearance and expression:
1. parameters from the appearance, the casting table and the id (portrait_params);
2. the head and shoulders: MakeHuman's model moved to this person's shape
   and to the expression (portrait_face, portrait_mhhead);
3. regional skin maps on the rest shape, and wrinkles where the expression
   bunches the skin (portrait_mhskin);
4. teeth, gums and tongue (portrait_teeth);
5. clothes and head covering, on the rest shape (portrait_cloth);
6. hair grown on the head and kept under any covering (portrait_hair);
7. eyes turned to the camera, or a little away (portrait_eyes);
8. the studio: lens, lights, backdrop (portrait_scene).
"""
import math
import os
import time

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

import common
import portrait_cloth
import portrait_eyes
import portrait_face
import portrait_hair
import portrait_materials as PM
import portrait_mesh
import portrait_mhhead
import portrait_mhskin
import portrait_params
import portrait_scene
import portrait_sdf as S
import portrait_teeth

TURN_DEG = -22.0  # the camera stands this far round to the person's right: they face screen right
FRAME_CM = 28.0  # height of the picture at the face
MANTLE = ("#6e6452", "#4c4436")  # undyed wool with darker stripes, as the world's elders wear
# How much each wrinkle family deepens where the expression bunches the skin.
WRINKLE_GAIN = {"wf": 1.3, "wc": 1.1, "wg": 1.4, "wu": 0.6}


def log(*a):
    print("[portrait]", *a, flush=True)


def framing(head, P, frame_cm=None):
    """(picture height at the face in cm, what the camera looks at): from
    just below the crown to the top of the chest, so every head fills the
    picture alike whatever its size."""
    crown = float(head.V_rest[head.base.verts_of("body"), 2].max())
    chin = float(head.rest["menton"][2])
    tall = crown - chin
    top = crown - 0.3
    bottom = chin - (0.34 - 0.04 * P.child) * tall
    frame = frame_cm or (top - bottom)
    return frame, (0.0, 0.0, (top + bottom) / 2)


def camera_position(turn_deg=TURN_DEG, frame_cm=FRAME_CM, centre=(0, 0, 0), lens=85.0, sensor=36.0, elev_cm=3.5):
    dist = frame_cm * 0.01 * lens / sensor
    a = math.radians(turn_deg)
    c = Vector(centre) * 0.01
    return c + Vector((math.sin(a) * dist, -math.cos(a) * dist, elev_cm * 0.01))


def gaze_target(head, gaze, cam):
    """Where the eyes look: the camera, or a few degrees away from it. Both
    eyes turn to the same point, so they converge."""
    mid = (Vector(head.eye_centre(-1).tolist()) + Vector(head.eye_centre(1).tolist())) * 0.005
    d = cam - mid
    dx, dz = gaze
    if dx or dz:
        d = Matrix.Rotation(math.radians(dx), 3, "Z") @ d
        side = d.cross(Vector((0, 0, 1))).normalized()
        d = Matrix.Rotation(math.radians(dz), 3, side) @ d
    return mid + d


def _set_maps(obj, maps):
    for name, values in maps.items():
        portrait_mesh.set_attribute(obj, name, values)


def _normals(V, Q):
    a, b, c, d = V[Q[:, 0]], V[Q[:, 1]], V[Q[:, 2]], V[Q[:, 3]]
    fn = np.cross(c - a, d - b)
    N = np.zeros_like(V)
    for k in range(4):
        np.add.at(N, Q[:, k], fn)
    return (N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)).astype(np.float32)


def build(pid, appearance, player=False, chapter="", expression="neutral", samples=256, size=512, hair_quality=1.0, clay=False, frame_cm=None, turn=TURN_DEG, device="gpu", threads=0, aim=None, elev=None):
    """Build the scene for one person in one expression (replacing whatever
    was loaded). Returns (scene, params, marks): marks are the picture
    positions (pixels, top-left origin) of the eyes and the mouth, for
    review close-ups."""
    t0 = time.time()
    P = portrait_params.params_for(pid, appearance, player=player, chapter=chapter)
    log(portrait_params.describe(P), "expression", expression)
    a = appearance
    head = portrait_mhhead.MHHead(P, expression)
    V, Vr, Q, uv, used = head.skin_mesh()
    log("head", len(V), "vertices", f"{time.time() - t0:.1f}s")

    scene = common.reset(samples)
    # Generic kernels (specialised ones piled up over a run and starved everything else).
    prefs = bpy.context.preferences.addons["cycles"].preferences
    if hasattr(prefs, "kernel_optimization_level"):
        prefs.kernel_optimization_level = "OFF"
    scene.render.use_persistent_data = False
    if device == "cpu":
        scene.cycles.device = "CPU"
    if threads:
        scene.render.threads_mode = "FIXED"
        scene.render.threads = threads
    col = common.collection("portrait")
    skin_hex = a["skin"]

    # ── Skin ───────────────────────────────────────────────────────────────
    cav, _ = portrait_mhskin.occlusion(Vr, Q)
    maps = portrait_mhskin.maps(head, Vr, used, cav, skin_hex, beard=a["beard"])
    regions = maps.pop("_regions")
    bunch = portrait_mhskin.strain(Vr, V, Q)
    for fam, gain in WRINKLE_GAIN.items():
        maps[fam] = (maps[fam] + gain * bunch * regions[fam] * (1 - 0.85 * P.child)).astype(np.float32)
    show = os.environ.get("PORTRAIT_MASK")  # review: paint a mask on the skin
    if show:
        m = {
            "beard": lambda: portrait_mhskin.beard_mask(head, Vr, used),
            "brow": lambda: portrait_hair.brow_mask(head, Vr),
            "scalp": lambda: portrait_hair.scalp_mask(head, Vr, P.head_style),
            "lips": lambda: maps["lip"],
            "cav": lambda: cav,
            "mouth": lambda: maps["mouth"],
        }[show]()
        maps["albedo"] = (np.array([0.05, 0.05, 0.3], np.float32) * (1 - m[:, None]) + np.array([0.9, 0.8, 0.1], np.float32) * m[:, None]).astype(np.float32)
    detail = 1.0 + 0.3 * P.sun + 0.3 * P.age_t
    canthus = tuple(round(float(v), 2) for v in (abs(head.lid_point(1, 1.0, rest=True)[0]), head.lid_point(1, 1.0, rest=True)[2]))
    skin = PM.skin(pid, P.child, portrait_mhskin.subsurface_weight(skin_hex), detail, portrait_mhskin.darkness(skin_hex), age=P.age_t, canthus=canthus)
    obj = portrait_mesh.from_arrays("skin", V, Q, None, skin, col)
    _set_maps(obj, maps)
    sub = obj.modifiers.new("smooth", "SUBSURF")
    sub.levels = 0
    sub.render_levels = 2
    sub.quality = 3
    log("skin", f"{time.time() - t0:.1f}s")

    # ── Teeth, gums and tongue ────────────────────────────────────────────
    portrait_teeth.build(head, P, col, {"teeth": PM.teeth(P.age_t, P.child), "gum": PM.gum(skin_hex), "tongue": PM.tongue()})

    # ── Clothes and head covering (on the rest shape) ─────────────────────
    wool_head = a["headwear"] in ("band", "hood")
    style = P.head_style
    mats = {
        "tunic": PM.cloth(a["robe"], "wool", a["accent"], 0.062, 0.011, name="tunic"),
        "mantle": PM.cloth(MANTLE[0], "wool", MANTLE[1], 0.1, 0.02, name="mantle"),
        "headwear": PM.cloth(a["headwearColor"], "wool" if wool_head else "linen", name="headwear", uv="cloth_uv" if style == "wrap" else None),
        "cord": PM.cloth("#2c2621", "wool", name="cord"),
    }
    skip = os.environ.get("PORTRAIT_SKIP", "").split(",")  # review: e.g. hair,clothes
    clothes = portrait_cloth.Clothes(head, P, head_shape=head.without_ears)
    for name, (shape, key, lo, hi, vox) in clothes.parts.items():
        if "clothes" in skip:
            break
        Vc, Qc, Nc = S.polygonize(shape, lo, hi, vox)
        Qc = portrait_mesh.orient_quads(Vc, Qc, Nc)
        o = portrait_mesh.from_arrays(name, Vc, Qc, Nc, mats[key], col)
        extra = clothes.attributes(name, Vc)
        if extra:
            _set_maps(o, extra)
    log("clothes", f"{time.time() - t0:.1f}s")

    # ── Hair ───────────────────────────────────────────────────────────────
    field = head.sdf_grid("posed", lo=(-15, -17, -36), hi=(15, 15, 19), voxel=0.25)
    obstacle = None
    if clothes.obstacle is not None:
        obstacle = S.FieldGrid(clothes.obstacle, (-16, -17, -32), (16, 19, 23), 0.35)
    hair_hex = a["hair"]
    grey = P.grey
    hair_mats = {
        "hair": PM.hair(hair_hex, grey),
        "beard": PM.hair(hair_hex, min(1.0, grey * 1.15), name="beard"),
        "brow": PM.hair(hair_hex, grey * 0.7, name="brow"),
        "lash": PM.hair("#1a1410", 0.0, name="lash"),
    }
    if "hair" not in skip:
        portrait_hair.Hair(head, P, V, Q, _normals(V, Q), field, col, hair_mats, quality=hair_quality, obstacle=obstacle, V_rest=Vr, base_idx=used)
    log("hair", f"{time.time() - t0:.1f}s")

    # ── Eyes and the studio ────────────────────────────────────────────────
    frame, centre = framing(head, P, frame_cm)
    if aim is not None:
        centre = tuple(aim)
    elev_cm = 3.5 if elev is None else elev
    roll = 0.0
    if aim is None and elev is None and turn == TURN_DEG:
        # The portrait itself: each person sits a little differently.
        turn = TURN_DEG + P.pose_turn
        elev_cm += P.pose_elev
        roll = P.pose_roll
    cam = camera_position(turn_deg=turn, frame_cm=frame, centre=centre, elev_cm=elev_cm)
    portrait_eyes.Eyes(head, P, col, gaze_target(head, portrait_face.gaze(expression, P), cam))
    focus = Vector(head.eye_centre(-1 if turn < 0 else 1).tolist()) * 0.01 if aim is None else Vector(aim) * 0.01
    studio = portrait_scene.Studio(scene, focus=focus, turn_deg=turn, frame_cm=frame, centre=centre, size=size, samples=samples, elev_cm=elev_cm, roll_deg=roll)
    if clay:
        scene.view_layers[0].material_override = PM.clay()
    log("built", f"{time.time() - t0:.1f}s")

    def px(p_cm):
        v = world_to_camera_view(scene, studio.camera, Vector(p_cm) * 0.01)
        return (v.x * size, (1 - v.y) * size)

    eyes = [px(head.eye_centre(sx).tolist()) for sx in (-1, 1)]
    marks = {
        "eyes": ((eyes[0][0] + eyes[1][0]) / 2, (eyes[0][1] + eyes[1][1]) / 2),
        "mouth": px(head.stomion.tolist()),
        "studio": studio,
    }
    return scene, P, marks


def render(scene, path, retries=3, wait=45.0):
    """Render to a PNG. The GPU is shared with other renders: if it runs out
    of memory, wait and try again, and in the end render on the CPU."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path
    for attempt in range(retries + 1):
        try:
            bpy.ops.render.render(write_still=True)
            return path
        except RuntimeError as e:  # noqa: PERF203 - a few retries at most
            if attempt == retries:
                log("GPU render failed; rendering on the CPU:", str(e).splitlines()[0][:120])
                scene.cycles.device = "CPU"
                bpy.ops.render.render(write_still=True)
                return path
            log("render failed, retrying:", str(e).splitlines()[0][:120])
            time.sleep(wait)
    return path
