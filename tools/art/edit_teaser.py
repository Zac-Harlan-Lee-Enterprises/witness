"""Cut the teaser's rendered shots together and encode the film.

    blender -b --factory-startup -P tools/art/edit_teaser.py -- \
        [--quality preview|final] [--frames tools/art/.cache/teaser] \
        [--out public/art/teaser/chapter-1] [--sheet path.png] [--mp4-mb 12]

Reads the graded frames build_teaser.py wrote (<frames>/<quality>/shot<N>/),
lays the shots end to end in Blender's sequencer (a fade up from black at
the start, a short dip to black before the title, a fade out at the end)
and encodes, with Blender's own FFmpeg (no other tools needed):

  teaser.mp4    H.264, yuv420p, no audio (plays everywhere, Safari included);
                encoded again at a lower quality until it fits --mp4-mb
  teaser.webm   VP9, no audio
  poster.webp   a still for before the film plays (and for reduced motion)

and, with --sheet, a contact sheet of 16 frames across the film. The music
is the game's own (synthesised in the browser), so the files carry no sound.
"""
import argparse
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import imageio  # noqa: E402
import teaser_shots  # noqa: E402

FPS = 24
FADE_IN = 18
DIP = 8  # frames either side of the cut into the title
FADE_OUT = 30


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--quality", choices=["preview", "final"], default="preview")
    p.add_argument("--frames", default=os.path.join(HERE, ".cache", "teaser"))
    p.add_argument("--out", default=None)
    p.add_argument("--sheet", default=None)
    p.add_argument("--mp4-mb", type=float, default=12.0)
    p.add_argument("--poster", nargs=2, type=int, default=[8, 96], help="shot and frame for the poster")
    p.add_argument("--no-webm", action="store_true")
    return p.parse_args(argv)


def timeline(frames, quality):
    """[(shot, folder, n_frames, start)] in film order."""
    out = []
    start = 1
    for sid, spec in sorted(teaser_shots.SHOTS.items()):
        folder = os.path.join(frames, quality, f"shot{sid}")
        files = sorted(f for f in os.listdir(folder) if f.endswith(".png")) if os.path.isdir(folder) else []
        if len(files) < spec.frames:
            raise SystemExit(f"shot {sid}: {len(files)} of {spec.frames} frames rendered in {folder}")
        out.append((sid, folder, files[: spec.frames], start))
        start += spec.frames
    return out, start - 1


def strips(se):
    return se.strips if hasattr(se, "strips") else se.sequences


def build_edit(scene, cuts, total, size):
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = total
    se = scene.sequence_editor_create()
    last = len(cuts) - 1
    for i, (sid, folder, files, start) in enumerate(cuts):
        s = strips(se).new_image(f"shot{sid}", os.path.join(folder, files[0]), 1 + (i % 2), start)
        for f in files[1:]:
            s.elements.append(f)
        end = start + len(files)
        s.blend_type = "ALPHA_OVER"
        # Fades by the strip's opacity over the black background.
        keys = []
        if i == 0:
            keys += [(start, 0.0), (start + FADE_IN, 1.0)]
        if i == last - 1:
            keys += [(end - DIP, 1.0), (end - 1, 0.0)]
        if i == last:
            keys += [(start, 0.0), (start + DIP, 1.0), (end - FADE_OUT, 1.0), (end - 1, 0.0)]
        for frame, value in keys:
            s.blend_alpha = value
            s.keyframe_insert("blend_alpha", frame=frame)
        if not keys:
            s.blend_alpha = 1.0


def encode(scene, path, container, codec, crf, preset="BEST", size=None):
    r = scene.render
    try:
        r.image_settings.media_type = "VIDEO"
    except (AttributeError, TypeError):
        pass
    r.image_settings.file_format = "FFMPEG"
    f = r.ffmpeg
    f.format = container
    f.codec = codec
    f.audio_codec = "NONE"
    f.constant_rate_factor = "CUSTOM"
    f.custom_constant_rate_factor = crf
    f.ffmpeg_preset = preset
    f.gopsize = FPS * 2
    f.use_max_b_frames = True
    f.max_b_frames = 2
    r.use_sequencer = True
    r.use_compositing = False
    r.filepath = path
    # Blender names the file itself (appending frame numbers) unless told not to.
    r.use_file_extension = False
    bpy.ops.render.render(animation=True)
    return os.path.getsize(path)


def poster(cuts, shot, frame, path, width=1280):
    for sid, folder, files, _ in cuts:
        if sid == shot:
            img = imageio.load(os.path.join(folder, files[min(frame, len(files) - 1)]))
            h, w = img.shape[:2]
            k = max(1, w // width)
            small = imageio.downsample(img, k) if k > 1 else img
            small[:, :, 3] = 1.0
            imageio.save(small, path, "WEBP", 80)
            return


def contact_sheet(cuts, total, path, n=16, cols=4, width=480):
    picks = np.linspace(1, total, n + 2)[1:-1].astype(int)
    tiles = []
    for p in picks:
        for sid, folder, files, start in cuts:
            if start <= p < start + len(files):
                img = imageio.load(os.path.join(folder, files[p - start]))
                k = max(1, img.shape[1] // width)
                tiles.append(imageio.downsample(img, k) if k > 1 else img)
                break
    h, w = tiles[0].shape[:2]
    rows = (len(tiles) + cols - 1) // cols
    gap = 6
    sheet = np.zeros((rows * h + (rows + 1) * gap, cols * w + (cols + 1) * gap, 4), dtype=np.float32)
    sheet[..., 3] = 1.0
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        y = gap + r * (h + gap)
        x = gap + c * (w + gap)
        sheet[y : y + h, x : x + w, :3] = t[:h, :w, :3]
    imageio.save(sheet, path, "PNG")


def main():
    a = args()
    out = a.out or os.path.join(HERE, ".cache", "teaser", a.quality, "film")
    os.makedirs(out, exist_ok=True)
    cuts, total = timeline(a.frames, a.quality)
    first = imageio.load(os.path.join(cuts[0][1], cuts[0][2][0]))
    size = (first.shape[1], first.shape[0])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.view_settings.view_transform = "Standard"
    build_edit(scene, cuts, total, size)
    mp4 = os.path.join(out, "teaser.mp4")
    crf = 26 if a.quality == "final" else 30
    for attempt in range(6):
        size_b = encode(scene, mp4, "MPEG4", "H264", crf)
        print("MP4", crf, round(size_b / 1e6, 2), "MB", flush=True)
        if size_b <= a.mp4_mb * 1e6:
            break
        crf += 2
    if not a.no_webm:
        webm = os.path.join(out, "teaser.webm")
        size_w = encode(scene, webm, "WEBM", "WEBM", crf + 4)
        print("WEBM", crf + 4, round(size_w / 1e6, 2), "MB", flush=True)
    poster(cuts, a.poster[0], a.poster[1], os.path.join(out, "poster.webp"))
    if a.sheet:
        contact_sheet(cuts, total, a.sheet)
    print("EDIT DONE", total, "frames", round(total / FPS, 2), "s", flush=True)


main()
