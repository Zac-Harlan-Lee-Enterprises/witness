"""Trim animation frames to their visible pixels and pack them into an atlas.

Each frame keeps its place in the original (untrimmed) frame, so the game
positions it exactly as before (Phaser trimmed frames): the entry is
[x, y, w, h, offset_x, offset_y] with the atlas rectangle and the offset of
the trimmed pixels inside the original frame.
"""
import numpy as np

PAD = 2


def visible_box(img, is_shadow):
    """Bounding box of what's visible: alpha for colour, darkening for multiply shadows."""
    mask = (img[:, :, 0] < 0.995) | (img[:, :, 2] < 0.995) if is_shadow else img[:, :, 3] > 0.004
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return 0, 0, 1, 1
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def pack_frames(frames, is_shadow, width=2048):
    """frames: list of (name, image). Returns (atlas, {name: [x, y, w, h, ox, oy]})."""
    trimmed = []
    for name, img in frames:
        x0, y0, x1, y1 = visible_box(img, is_shadow)
        trimmed.append((name, img[y0:y1, x0:x1], x0, y0))
    order = sorted(range(len(trimmed)), key=lambda i: -trimmed[i][1].shape[0])
    places = {}
    x = y = shelf = 0
    for i in order:
        h, w = trimmed[i][1].shape[:2]
        if x + w > width:
            x, y, shelf = 0, y + shelf + PAD, 0
        places[i] = (x, y)
        x += w + PAD
        shelf = max(shelf, h)
    height = y + shelf
    fill = 1.0 if is_shadow else 0.0
    atlas = np.full((max(1, height), width, 4), fill, dtype=np.float32)
    if not is_shadow:
        atlas[:, :, 3] = 0.0
    else:
        atlas[:, :, 3] = 1.0
    table = {}
    for i, (name, img, ox, oy) in enumerate(trimmed):
        px, py = places[i]
        h, w = img.shape[:2]
        atlas[py : py + h, px : px + w] = img
        table[name] = [px, py, w, h, ox, oy]
    used = max(px + trimmed[i][1].shape[1] for i, (px, _) in places.items()) if places else 1
    return atlas[:, : min(width, used + PAD)], table
