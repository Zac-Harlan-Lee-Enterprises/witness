"""Render character sprite sheets, their cast-shadow sheets, sheets for
people at rest (sitting, lying) and overlay sheets for story marks.

    # Everything these scenes need that is not built yet (idempotent):
    blender -b --factory-startup -P tools/art/build_people.py -- \
        --out public/art/people --scenes miriam-house jerusalem-market jericho-road jericho

    # Or particular people, as before:
    blender -b --factory-startup -P tools/art/build_people.py -- \
        --out public/art/people --who player:look-1 hadassah crowd:crowd-0 \
        [--ppu 3] [--samples 64] [--variants day late]

Sheets (ids in people.json):
  <id>              standing (and walking, for the player and passers-by)
  <id>+<mark>       standing with a mark that changes the body (a torn hem)
  <id>~sit, ~lie    at rest: rows down/left/right/up (lying: where the head
                    is), columns idle, breath, talk
  <sheet>@<mark>    an overlay: only the mark (the water skin, a bandage,
                    the spare cloak), rendered with the body as a holdout so
                    whatever the body hides stays hidden; same frames as its
                    sheet, drawn over it by the game. Rag bandages are made
                    from the player's own tunic, so there is one per tunic
                    colour: <sheet>@rag-bandaged-<rrggbb>.

Standing sheet layout (frames FRAME_W x FRAME_H game units, feet at FOOT_Y):
    rows 0-3: down, left, right, up
    columns:  0 idle, 1 breath, 2 blink, 3 talk, 4 talk (mouth half),
              5-12 walk cycle (8 frames, from left-foot contact) — walkers only
    row 4:    turning in-betweens: down-left, down-right, up-left, up-right
Lighting variants: day, late (the sun of the places), night (the moon),
indoor (a lamp and a window, for rooms), overcast (soft skylight under rain
cloud) and lamp (lampstands at lamp-lighting; a house lit by its lamps at
night). A place with pre-rendered art says which it needs (its manifest's
peopleLight, or each set's own, else its variants). People are seen from a slightly lower camera than the
world (faces read) with height still 1:1 on screen; shadows lie on the
ground and use the world camera.
"""
import argparse
import json
import math
import os
import sys
import tempfile

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
sys.path.insert(0, HERE)
import common  # noqa: E402
import downsample_people  # noqa: E402
import imageio  # noqa: E402
import lighting  # noqa: E402
import materials as M  # noqa: E402
import world_person  # noqa: E402
import repack_people  # noqa: E402
import shadow_edges  # noqa: E402
import view  # noqa: E402

FRAME_W = 44
FRAME_H = 68
FOOT_Y = 62
# People at rest are drawn with the world camera (45°), not the figure
# camera: lying or sitting, they lie along the ground, which the figure
# camera foreshortens (a man lying on the road came out about 1 m long,
# shorter than his own shadow).
REST_TILT = 45.0
REST_W = 84
REST_H = 96
REST_Y = 60
SHADOW_BOX = {"day": (-64, -42, 20, 12), "late": (-12, -66, 150, 14), "indoor": (-28, -18, 28, 12), "overcast": (-30, -20, 26, 12), "lamp": (-30, -20, 30, 14), "night": (-44, -66, 20, 12)}
REST_SHADOW_BOX = {"day": (-70, -46, 48, 36), "late": (-40, -50, 110, 36), "indoor": (-46, -40, 46, 36), "overcast": (-48, -40, 48, 36), "lamp": (-48, -40, 48, 36), "night": (-56, -72, 48, 36)}
# Lights after dark: a lamp carried at the belt burns in these.
DARK = {"night", "lamp"}
SHADOW_PPU = 1.0
DIRECTIONS = [("down", 0.0), ("left", -90.0), ("right", 90.0), ("up", 180.0)]
# Lying: the row names where the head is.
HEAD_DIRECTIONS = [("down", 180.0), ("left", 90.0), ("right", -90.0), ("up", 0.0)]
TURNS = [("down-left", -45.0), ("down-right", 45.0), ("up-left", -135.0), ("up-right", 135.0)]
STILL = [("idle", {}), ("breath", {"breath": 1}), ("blink", {"blink": True}), ("talk", {"talk": 1}), ("talk2", {"talk": 2})]
WALK = [(f"walk{i}", {"walk": i / 8.0}) for i in range(8)]
REST = [("idle", {}), ("breath", {"breath": 1}), ("talk", {"talk": 1})]
# Marks that change the body itself get a sheet of their own; the rest are overlays.
BASE_MARKS = {"torn-hem"}
# Which build of the figures a sheet was rendered with, recorded per light in
# people.json (`figure`; the game ignores it, tests/content/art-assets.test.ts
# checks every sheet is current). Raise it when a change to the figures means
# every sheet must be rendered again (`--force`).
#   1  MakeHuman bodies with simulated clothes (ADR-0017)
#   2  a soft fill light for people; supple, gathered outer garments
FIGURE = 2


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--who", nargs="+", default=[])
    p.add_argument("--scenes", nargs="+", default=[])
    p.add_argument("--ppu", type=float, default=3.0)
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--variants", nargs="+", default=None)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--only", nargs="+", default=None, help="only sheets whose id is one of these")
    p.add_argument("--force", action="store_true", help="render the chosen sheets again even where people.json has them")
    return p.parse_args(argv)


class Job:
    """One sheet to render: whose, in what pose, with which marks."""

    def __init__(self, sid, pid, key, appearance, walks, variants, pose="stand", marks=(), overlay=None, rag=None, of=None, chapter=""):
        self.id = sid
        self.pid = pid
        self.key = key
        self.appearance = appearance
        self.walks = walks and pose == "stand"
        self.variants = list(variants)
        self.pose = pose
        self.marks = tuple(sorted(marks))
        self.overlay = overlay
        self.rag = rag
        self.of = of
        # The chapter (a portrait identity reads it: Colossae's people are Greeks and Phrygians).
        self.chapter = chapter


def lookup(data, who):
    """(id, key, appearance, walks) for 'player:look-1', 'crowd:crowd-0' or a character id."""
    if who.startswith("player:"):
        p = next(p for p in data["players"] if p["id"] == who.split(":", 1)[1])
        return f"player-{p['id']}", p["key"], p["appearance"], True
    if who.startswith("crowd:"):
        c = next(c for c in data["crowd"] if c["id"] == who.split(":", 1)[1])
        return c["id"], c["key"], c["appearance"], True
    c = next(c for c in data["characters"] if c["id"] == who)
    return c["id"], c["key"], c["appearance"], False


def rag_hex(color):
    return color.lstrip("#").lower()


def scene_lights(s):
    """The lights people are seen in at a place: as its pre-rendered art
    says (its manifest's peopleLight, else each set's own peopleLight or
    the set's name), else as its light plan will (lighting.PLACE_LIGHTS:
    so people can be rendered before or beside their place)."""
    path = os.path.join(HERE, "..", "..", "public", "art", s["id"], "manifest.json")
    if os.path.exists(path):
        art = json.load(open(path))
        if art.get("peopleLight"):
            return [art["peopleLight"]]
        return sorted({v.get("peopleLight", name) for name, v in art["variants"].items()})
    plan, light = lighting.plan_for(s["id"], s["kind"] == "indoor")
    if isinstance(light, str):
        return [light]
    if isinstance(light, dict):
        return sorted({light.get(name, name) for name in plan})
    return sorted(plan)


def plan(data, scenes):
    """Every sheet the given scenes need: who appears, standing or at rest,
    with which marks, in which light."""
    by_id = {s["id"]: s for s in data["scenes"]}
    wanted = [by_id[s] for s in scenes]
    light = scene_lights
    jobs = {}

    def add(job):
        if job.id in jobs:
            for v in job.variants:
                if v not in jobs[job.id].variants:
                    jobs[job.id].variants.append(v)
        else:
            jobs[job.id] = job

    tunics = [rag_hex(p["appearance"]["robe"]) for p in data["players"]]
    # Chapters may reuse a name for someone else (two different Kalliases):
    # such people get a sheet id naming their chapter too.
    names = {}
    for ch in data["characters"]:
        names.setdefault(ch["id"], set()).add(ch["key"])
    for ch in data["characters"]:
        who = ch["id"] if len(names[ch["id"]]) == 1 else f"{ch['id']}.{ch['chapter']}"
        for ap in ch["appears"]:
            if ap["scene"] not in scenes:
                continue
            variants = light(by_id[ap["scene"]])
            for pose in ap["poses"]:
                base = who if pose == "stand" else f"{who}~{pose}"
                add(Job(base, who, ch["key"], ch["appearance"], False, variants, pose, chapter=ch["chapter"]))
                for mark in ap["marks"]:
                    if mark in BASE_MARKS:
                        add(Job(f"{base}+{mark}", who, ch["key"], ch["appearance"], False, variants, pose, marks=[mark], chapter=ch["chapter"]))
                    elif mark == "rag-bandaged":
                        for t in tunics:
                            add(Job(f"{base}@rag-bandaged-{t}", who, ch["key"], ch["appearance"], False, variants, pose, overlay=mark, rag="#" + t, of=base, chapter=ch["chapter"]))
                    else:
                        add(Job(f"{base}@{mark}", who, ch["key"], ch["appearance"], False, variants, pose, overlay=mark, of=base, chapter=ch["chapter"]))
    variants = sorted({v for s in wanted for v in light(s)})
    # Each chapter's marks, in the lights of that chapter's places.
    marks = {}
    for c in data["chapters"]:
        lights = {v for sid in c["scenes"] if sid in scenes for v in light(by_id[sid])}
        for m in c["playerMarks"] if lights else []:
            marks.setdefault(m, set()).update(lights)
    for p in data["players"]:
        base = f"player-{p['id']}"
        add(Job(base, base, p["key"], p["appearance"], True, variants))
        for mark, lights in sorted(marks.items()):
            if mark in BASE_MARKS:
                add(Job(f"{base}+{mark}", base, p["key"], p["appearance"], True, sorted(lights), marks=[mark]))
            else:
                add(Job(f"{base}@{mark}", base, p["key"], p["appearance"], True, sorted(lights), overlay=mark, of=base))
    crowd_variants = sorted({v for s in wanted if s.get("crowd") for v in light(s)})
    if crowd_variants:
        for c in data["crowd"]:
            add(Job(c["id"], c["id"], c["key"], c["appearance"], True, crowd_variants))
    return list(jobs.values())


# Full shade multiplies the ground by this (cool, like the baked shadows).
SHADE = np.array([0.42, 0.45, 0.56])


def shadow_grey(alpha):
    """A shadow as an opaque tint on white (drawn with multiply blending)."""
    a = np.clip(alpha, 0, 1)
    rgb = 1.0 - a[:, :, None] * (1.0 - SHADE)[None, None, :]
    return np.dstack([rgb, np.ones_like(a)])


def render_frame(scene, path, tries=6):
    """Render one frame and load it, retrying after a pause if the GPU could
    not finish it (out of memory while other jobs share it)."""
    import time

    scene.render.filepath = path
    for attempt in range(tries):
        try:
            bpy.ops.render.render(write_still=True)
            break
        except RuntimeError as error:
            if attempt == tries - 1 or "Command buffer" not in str(error):
                raise
            print("RENDER RETRY", attempt + 1, os.path.basename(path), flush=True)
            time.sleep(20 * (attempt + 1))
    return imageio.load(path)


def forget(manifest, job):
    """Drop what people.json records of a job's sheets in its lights (and the
    person's half-resolution copies), so they are rendered and packed again."""
    e = manifest.get(job.id)
    if not e:
        return
    atlas = e.setdefault("atlas", {})
    for v in job.variants:
        e.get("figure", {}).pop(v, None)
        f = e["sheets"].pop(v, None)
        if f:
            atlas.pop(f, None)
        s = e.get("shadows", {}).pop(v, None)
        if s:
            atlas.pop(s["sheet"], None)
    e.pop("low", None)
    for k in [k for k in atlas if k.endswith("-low.webp")]:
        del atlas[k]


def render(job, a, manifest, tmp):
    scene = common.reset(a.samples)
    build_marks = set(job.marks) | ({job.overlay} if job.overlay else set())
    app = dict(job.appearance)
    if job.pose != "stand" and app.get("carry") != "lamb":
        # At rest the hands are empty (and Menashe's jar was broken on the road);
        # a newborn lamb stays in the lap.
        app["carry"] = "none"
    person = world_person.Person(
        app,
        marks=build_marks,
        rag=job.rag or "#3e6b73",
        name=job.pid,
        pid=job.pid,
        player=job.pid.startswith("player-"),
        chapter=job.chapter,
        rest=None if job.pose == "stand" else job.pose,
    )
    bpy.ops.mesh.primitive_plane_add(size=24.0, location=(0, 0, 0))
    ground = bpy.context.object
    ground.is_shadow_catcher = True
    ground.data.materials.append(M.shadow_catcher())
    rest = None if job.pose == "stand" else job.pose
    if rest:
        cols, rows, turns = REST, (HEAD_DIRECTIONS if rest == "lie" else DIRECTIONS), []
        fw_u, fh_u, foot = REST_W, REST_H, REST_Y
    else:
        cols, rows, turns = STILL + (WALK if job.walks else []), DIRECTIONS, TURNS
        fw_u, fh_u, foot = FRAME_W, FRAME_H, FOOT_Y
    fw, fh = int(fw_u * a.ppu), int(fh_u * a.ppu)
    n_cols = max(len(cols), len(turns))
    n_rows = len(rows) + (1 if turns else 0)
    entry = manifest.get(job.id) or {
        "appearance": job.key,
        "sheets": {},
        "frameWidth": fw,
        "frameHeight": fh,
        "originX": fw / 2,
        "originY": foot * a.ppu,
        "ppu": a.ppu,
        "columns": [c[0] for c in cols],
        "rows": [r[0] for r in rows],
        "turns": [t[0] for t in turns],
    }
    if job.pose != "stand":
        entry["pose"] = job.pose
    if job.marks:
        entry["marks"] = list(job.marks)
    if job.overlay:
        entry["overlay"] = {"mark": job.overlay, "of": job.of}
        if job.rag:
            entry["overlay"]["rag"] = job.rag.lower()
    mark_parts = [p for p in person.parts if p.mark is not None]
    body_parts = [p for p in person.parts if p.mark is None]
    todo = [v for v in job.variants if v not in entry["sheets"]]

    def poses():
        for r, (dname, yaw) in enumerate(rows):
            for c, (cname, spec) in enumerate(cols):
                yield r, c, f"{dname}-{cname}", dict(spec, yaw=math.radians(yaw), rest=rest)
        for c, (tname, yaw) in enumerate(turns):
            yield len(rows), c, tname, {"yaw": math.radians(yaw)}

    if todo:
        # The clothes are simulated once for every frame the sheet shows
        # (the same in every light).
        person.prepare([spec for _, _, _, spec in poses()])
    for variant in todo:
        lighting.setup(scene, variant)
        # A soft fill from the camera's side, so faces under headwear and
        # hands read at game size (lighting.PEOPLE_FILL); off for the shadows.
        fill = lighting.people_fill(scene, variant)
        # Exposed as the places in that light are (at night, the eye adapts).
        scene.view_settings.exposure = -1.4 + lighting.ev(variant)
        # 1. The person (no ground), from the figure camera. An overlay shows
        #    only its mark; the body is a holdout, hiding what it hides.
        ground.hide_render = True
        for part in body_parts:
            part.obj.visible_camera = True
            part.obj.is_holdout = bool(job.overlay)
        for part in mark_parts:
            part.obj.visible_camera = True
            part.obj.hide_render = job.overlay is not None and part.mark != job.overlay
            if part.obj.get("night_only") and variant not in DARK:
                part.obj.hide_render = True
        view.setup_figure_camera(scene, foot - fh_u / 2, fw, fh, a.ppu, tilt_deg=REST_TILT if rest else 32.0)
        sheet = np.zeros((fh * n_rows, fw * n_cols, 4), dtype=np.float32)
        for r, c, label, spec in poses():
            person.pose(**spec)
            sheet[r * fh : (r + 1) * fh, c * fw : (c + 1) * fw] = render_frame(scene, os.path.join(tmp, f"{job.id}-{variant}-{label}.png"))
        name = f"{job.id}-{variant}.webp"
        imageio.save(sheet, os.path.join(a.out, name), "WEBP", 90)
        entry["sheets"][variant] = name
        entry.setdefault("figure", {})[variant] = FIGURE
        if job.overlay:
            continue
        # 2. Its shadow on the ground, from the world camera (the key's alone).
        if fill is not None:
            fill.hide_render = True
        ground.hide_render = False
        for part in person.parts:
            part.obj.visible_camera = False
            part.obj.is_holdout = False
        l, t, rgt, b = (REST_SHADOW_BOX if rest else SHADOW_BOX)[variant]
        sw, sh = int((rgt - l) * SHADOW_PPU), int((b - t) * SHADOW_PPU)
        view.setup_camera(scene, (l + rgt) / 2, (t + b) / 2, sw, sh, SHADOW_PPU)
        shots = []
        for r, c, label, spec in poses():
            person.pose(**spec)
            img = render_frame(scene, os.path.join(tmp, f"{job.id}-s-{variant}-{label}.png"))
            shots.append((r, c, shadow_grey(img[:, :, 3])))
        # A soft light's shadow can reach past the box: it fades out beyond it.
        framed, margin = shadow_edges.add_margin([s for _, _, s in shots])
        sw, sh = sw + 2 * margin, sh + 2 * margin
        ssheet = np.ones((sh * n_rows, sw * n_cols, 4), dtype=np.float32)
        for (r, c, _), frame in zip(shots, framed):
            ssheet[r * sh : (r + 1) * sh, c * sw : (c + 1) * sw] = frame
        sname = f"{job.id}-shadow-{variant}.webp"
        imageio.save(ssheet, os.path.join(a.out, sname), "WEBP", 62)
        entry.setdefault("shadows", {})[variant] = {
            "sheet": sname,
            "frameWidth": sw,
            "frameHeight": sh,
            "originX": -l * SHADOW_PPU + margin,
            "originY": -t * SHADOW_PPU + margin,
            "ppu": SHADOW_PPU,
        }
    manifest[job.id] = entry
    return bool(todo)


def main():
    a = args()
    data = json.load(open(os.path.join(HERE, "data", "chapter.json")))
    os.makedirs(a.out, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="witness-people-")
    manifest_path = os.path.join(a.out, "people.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    jobs = plan(data, a.scenes) if a.scenes else []
    for who in a.who:
        pid, key, app, walks = lookup(data, who)
        jobs.append(Job(pid, pid, key, app, walks, a.variants or ["day", "late"]))
    if a.variants and a.scenes:
        for j in jobs:
            j.variants = [v for v in j.variants if v in a.variants]
    if a.only:
        jobs = [j for j in jobs if j.id in a.only]
    if a.force and not a.dry_run:
        for job in jobs:
            forget(manifest, job)
    for job in jobs:
        missing = [v for v in job.variants if v not in manifest.get(job.id, {}).get("sheets", {})]
        print("PLAN", job.id, "pose", job.pose, "marks", job.marks, "overlay", job.overlay, "missing", missing)
    if a.dry_run:
        return
    for job in jobs:
        if render(job, a, manifest, tmp):
            json.dump(manifest, open(manifest_path, "w"), indent=1, sort_keys=True)
            # Trim every frame to what is visible and pack the sheets into atlases,
            # then make the half-resolution copies phones load (only what changed).
            repack_people.repack(a.out)
            downsample_people.downsample(a.out)
            manifest = json.load(open(manifest_path))
            print("PERSON DONE", job.id)
    print("PEOPLE DONE")


if __name__ == "__main__":
    main()
