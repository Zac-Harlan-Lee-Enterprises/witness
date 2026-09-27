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

TURN_DEG = -24.0  # the camera stands this far round to the person's right: they face screen right
HEAD_FOLLOW = 0.5  # how much of the way to the camera the head turns on the neck
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
    # The head turns part of the way toward the camera on the neck (the
    # shoulders stay three-quarter on), so the eyes need not strain toward it.
    sitting = TURN_DEG + P.pose_turn if (aim is None and elev is None and turn == TURN_DEG) else turn
    head = portrait_mhhead.MHHead(P, expression, head_turn=HEAD_FOLLOW * sitting)
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
    # Everything so far faces forward; the head turns on the neck at the end
    # (turn_head). The eyes aim at where the camera is from the unturned head.
    seen_from = cam
    if head.twist is not None:
        seen_from = Vector(head.twist(np.array(cam * 100.0, np.float32), inverse=True)[0].tolist()) * 0.01
    eyes_obj = portrait_eyes.Eyes(head, P, col, gaze_target(head, portrait_face.gaze(expression, P), seen_from))
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
        "skin": obj,
        "head": head,
        "px": px,
        "gaze": gaze_check(head, eyes_obj, seen_from),
    }
    if head.twist is not None:
        turn_head(head.twist, col)
    return scene, P, marks


def _is_identity(M, eps=1e-6):
    return all(abs(M[i][j] - (1.0 if i == j else 0.0)) < eps for i in range(4) for j in range(4))


def turn_head(twist, col):
    """Turn the head on the neck: every object built (skin, eyes, teeth,
    hair, clothes) is moved by the twist, which turns the head rigidly above
    the jaw, leaves the shoulders, and eases between."""
    for o in col.objects:
        M = o.matrix_world.copy()
        Mi = M.inverted()
        if o.type == "MESH" and not _is_identity(M):
            # Placed objects (the eyes): moved whole, as the twist moves
            # their centre, so the patterns drawn in their own frame (the
            # iris) move with them.
            p0 = np.array(M.translation, np.float32) * 100.0
            p1 = twist(p0)[0]
            a = math.atan2(p1[1] - twist.axis_y, p1[0]) - math.atan2(p0[1] - twist.axis_y, p0[0])
            pivot = Vector((0.0, twist.axis_y * 0.01, 0.0))
            o.matrix_world = Matrix.Translation(pivot) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Translation(-pivot) @ M
            continue
        if o.type == "MESH":
            me = o.data
            n = len(me.vertices)
            co = np.empty(n * 3, np.float32)
            me.vertices.foreach_get("co", co)
            co = co.reshape(n, 3)
            world = (np.asarray(M, np.float32)[:3, :3] @ co.T).T + np.asarray(M.translation, np.float32)
            moved = twist(world * 100.0) * 0.01
            # How far each vertex turned, to turn its normal with it.
            ang = np.arctan2(moved[:, 1] - twist.axis_y * 0.01, moved[:, 0]) - np.arctan2(world[:, 1] - twist.axis_y * 0.01, world[:, 0])
            local = (np.asarray(Mi, np.float32)[:3, :3] @ moved.T).T + np.asarray(Mi.translation, np.float32)
            me.vertices.foreach_set("co", local.astype(np.float32).ravel())
            if me.has_custom_normals:
                nrm = np.empty(n * 3, np.float32)
                me.vertices.foreach_get("normal", nrm)
                nrm = nrm.reshape(n, 3)
                c, s = np.cos(ang), np.sin(ang)
                nx = c * nrm[:, 0] - s * nrm[:, 1]
                ny = s * nrm[:, 0] + c * nrm[:, 1]
                me.normals_split_custom_set_from_vertices(np.stack([nx, ny, nrm[:, 2]], 1))
            me.update()
        elif o.type == "CURVES":
            cv = o.data
            n = len(cv.position_data)
            co = np.empty(n * 3, np.float32)
            cv.position_data.foreach_get("vector", co)
            moved = twist(co.reshape(n, 3) * 100.0) * 0.01
            cv.position_data.foreach_set("vector", moved.astype(np.float32).ravel())
            cv.update_tag()


def gaze_check(head, eyes, cam):
    """Where each eye looks and where its pupil sits: `yaw` is how far
    (degrees) each eye's line of sight passes beside the camera, left or
    right (both near 0: the eyes converge on it); `across` is where the
    pupil is from the inner corner (0) to the outer (1); `height` how far down
    the opening between the lids the pupil is (0 at the upper lid, 1 at
    the lower: about a half means neither lid hides the iris)."""
    out = {"yaw": [], "across": [], "height": []}
    for sx in (-1, 1):
        c, d, R = eyes.pupils[sx]
        to_cam = (cam - c).normalized()
        a = math.degrees(math.atan2(d.x, -d.y) - math.atan2(to_cam.x, -to_cam.y))
        out["yaw"].append(round(float(a), 2))
        pupil = np.array((c + d * R) * 100.0, np.float32)
        inner = head.lid_point(sx, -1.0)
        outer = head.lid_point(sx, 1.0)
        # Across the eye as the lid points are measured (the head faces
        # forward here: the check runs before it turns).
        t = float((sx * pupil[0] - sx * inner[0]) / max(sx * outer[0] - sx * inner[0], 1e-6))
        out["across"].append(round(float(t), 3))
        u = max(-1.0, min(1.0, 2 * t - 1))
        up = head.lid_point(sx, u, upper=True)[2]
        lo = head.lid_point(sx, u, upper=False)[2]
        out["height"].append(round(float((up - pupil[2]) / max(up - lo, 1e-6)), 3))
    return out


def _srgb_to_lin(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lab(rgb):
    """CIE L*a*b* (D65) of an sRGB colour (0-1)."""
    r, g, b = _srgb_to_lin(rgb)
    X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    return (116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z)))


def delta_e(a, b):
    la, lb = _lab(a), _lab(b)
    return float(math.sqrt(sum((x - y) ** 2 for x, y in zip(la, lb))))


def hex_rgb01(h):
    h = h.lstrip("#")
    return [int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]


def rgb01_hex(c):
    return "#" + "".join(f"{int(round(max(0, min(1, v)) * 255)):02x}" for v in c)


def _quick(scene, path, size, samples, transparent=False, holdout=()):
    """A small render to a PNG, the scene's settings left as they were."""
    import imageio

    r = scene.render
    saved = (r.resolution_x, r.resolution_y, scene.cycles.samples, r.film_transparent, r.image_settings.color_mode)
    held = [(o, o.is_holdout) for o in holdout]
    try:
        r.resolution_x = r.resolution_y = size
        scene.cycles.samples = samples
        r.film_transparent = transparent
        for o, _ in held:
            o.is_holdout = True
        r.image_settings.file_format = "PNG"
        r.image_settings.color_mode = "RGBA" if transparent else "RGB"
        r.filepath = path
        bpy.ops.render.render(write_still=True)
        return imageio.load(path)
    finally:
        r.resolution_x, r.resolution_y, scene.cycles.samples, r.film_transparent, r.image_settings.color_mode = saved
        for o, v in held:
            o.is_holdout = v


def skin_tone(px):
    """The colour a person's skin reads as in a picture: the mean of its
    middle and lit tones (between the 40th and 80th percentiles of
    brightness), as one would pick it from a photograph; not the shadow
    side, not the highlights."""
    lum = px @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    lo, hi = np.percentile(lum, 40), np.percentile(lum, 80)
    m = (lum >= lo) & (lum <= hi)
    return [float(v) for v in px[m].mean(0)]


def face_region(marks, size, full):
    """A box on the face (from the brows to below the mouth, between the
    cheeks), in pixels of a `size` picture; `full` is the render's size."""
    k = size / full
    ex, ey = marks["eyes"]
    mx, my = marks["mouth"]
    span = max(my - ey, 1.0)
    x0, x1 = (min(ex, mx) - 0.95 * span) * k, (max(ex, mx) + 0.95 * span) * k
    y0, y1 = (ey - 0.55 * span) * k, (my + 0.35 * span) * k
    return int(max(0, x0)), int(max(0, y0)), int(min(size, x1)), int(min(size, y1))


def measure_skin(scene, marks, tmp, full, size=192, samples=24, mask=None):
    """The median colour (sRGB 0-1) of the face's visible skin in a quick
    render, and the mask of visible skin used (reused between passes)."""
    skin = marks["skin"]
    if mask is None:
        others = [o for o in scene.objects if o.type in ("MESH", "CURVES") and o is not skin]
        m = _quick(scene, os.path.join(tmp, "mask.png"), size, 6, transparent=True, holdout=others)
        mask = m[:, :, 3] > 0.97
    img = _quick(scene, os.path.join(tmp, "colour.png"), size, samples)
    x0, y0, x1, y1 = face_region(marks, size, full)
    sel = np.zeros_like(mask)
    sel[y0:y1, x0:x1] = True
    sel &= mask
    if sel.sum() < 20:
        return None, mask
    return skin_tone(img[sel][:, :3]), mask


def calibrate_skin(scene, marks, target_hex, tmp, full, gain=None, rounds=2):
    """Match the rendered skin to the person's colour in the game: measure
    the face in a quick render and scale the skin's colour (in linear
    light) until its median lands on `target_hex`. A known `gain` (the
    neutral portrait's) is applied as it is, so every expression of a
    person has the same skin. Returns (gain, measured sRGB)."""
    skin = marks["skin"]
    attr = skin.data.attributes["albedo"]
    n = len(attr.data)
    base = np.empty(n * 4, np.float32)
    attr.data.foreach_get("color", base)
    base = base.reshape(n, 4)

    def apply(g):
        a = base.copy()
        a[:, :3] = np.clip(a[:, :3] * np.asarray(g, np.float32), 0, 1)
        attr.data.foreach_set("color", a.ravel())
        skin.data.update()

    target = hex_rgb01(target_hex)
    others = [o for o in scene.objects if o.type in ("MESH", "CURVES") and o is not skin]
    mask = _quick(scene, os.path.join(tmp, "mask.png"), 192, 6, transparent=True, holdout=others)[:, :, 3] > 0.97
    if gain is not None:
        apply(gain)
        return list(gain), None, mask
    g = np.ones(3)
    measured = None
    for _ in range(rounds):
        apply(g)
        measured, mask = measure_skin(scene, marks, tmp, full, mask=mask)
        if measured is None:
            break
        log("skin measured", rgb01_hex(measured), "target", target_hex, "gain", [round(float(v), 3) for v in g])
        ratio = _srgb_to_lin(target) / np.maximum(_srgb_to_lin(measured), 1e-4)
        g = np.clip(g * ratio**1.1, 0.45, 1.8)
    apply(g)
    return [round(float(v), 4) for v in g], measured, mask


def face_colour(img, marks, mask, full):
    """The median colour (sRGB 0-1) of the visible face skin in a picture
    (reduced to the mask's size)."""
    import portrait_finish

    size = mask.shape[0]
    small = portrait_finish.resize(img, size, sharpen=0.0)
    x0, y0, x1, y1 = face_region(marks, size, full)
    sel = np.zeros_like(mask)
    sel[y0:y1, x0:x1] = True
    sel &= mask
    if sel.sum() < 20:
        return None
    return skin_tone(small[sel][:, :3])


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
