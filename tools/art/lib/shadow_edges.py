"""Cast-shadow frames that end in white, not at the edge of their box.

A person's shadow sheet is an opaque tint on white, multiplied onto the
ground, one frame per pose, each cut to its light's shadow box (SHADOW_BOX in
build_people.py). A soft light (a window, a lamp, an overcast sky) throws a
shadow wider than its box, and a frame that ends while the shadow is still
grey prints the box on the floor as a faint rectangle round the person.

So a sheet whose shadows reach an edge gets a margin round every frame: the
shade at each edge carried on outward and faded to white, as a soft shadow
would have gone on fading. The fade starts INSET pixels inside the box and
ends at the margin's outer edge, one gentle ramp; the rest of what was
rendered is kept as it is. (Fading only inside the box would have to reach
12 pixels in to survive WebP compression, as far as the feet from the
nearest edge, and a ramp as short as 8 pixels still showed the box.)
"""
import numpy as np

# Pixels (game units at 1 ppu) added round each frame of a sheet that needs
# it, and how far inside the box the fade begins (the feet are at least 12
# from every edge of every box, so their contact shadow is untouched).
MARGIN = 12
INSET = 4
# A frame whose outermost ring is at least this white needs no margin.
WHITE = 0.985


def ring_is_white(frame):
    """Whether the outermost pixels of a full frame are (all but) white."""
    rgb = frame[:, :, :3]
    ring = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    return bool(ring.min() >= WHITE)


def with_margin(frame, margin=MARGIN, inset=INSET):
    """A full shadow frame with `margin` pixels added on every side: the
    shade at its edges carried on outward, fading from `inset` pixels inside
    the frame to white by the margin's last pixel."""
    h, w = frame.shape[:2]
    shade = np.pad(1.0 - frame[:, :, :3], ((margin, margin), (margin, margin), (0, 0)), mode="edge")
    ys = np.arange(h + 2 * margin, dtype=np.float32)[:, None] + 0.5 - margin
    xs = np.arange(w + 2 * margin, dtype=np.float32)[None, :] + 0.5 - margin
    # Signed distance of each pixel's centre from the original frame's edge:
    # how far inside it (positive), or outside it (negative).
    dx = np.maximum(np.maximum(-xs, xs - w), 0.0)
    dy = np.maximum(np.maximum(-ys, ys - h), 0.0)
    inside = np.minimum(np.minimum(xs, w - xs), np.minimum(ys, h - ys))
    signed = np.where((dx > 0) | (dy > 0), -np.hypot(dx, dy), inside)
    t = np.clip((signed + margin - 1) / (inset + margin - 1), 0.0, 1.0)
    keep = t * t * (3.0 - 2.0 * t)
    out = np.ones((h + 2 * margin, w + 2 * margin, 4), dtype=np.float32)
    # rgb = 1 - density * (1 - shade colour): scaling the darkening scales the density.
    out[:, :, :3] = 1.0 - shade * keep[:, :, None]
    return out


def add_margin(frames, margin=MARGIN, inset=INSET):
    """A sheet's full frames and the margin added to each: none when every
    frame's shadow fades out inside its box (so running it again changes
    nothing), else `margin` round all of them (a sheet's frames share a size)."""
    if all(ring_is_white(f) for f in frames):
        return list(frames), 0
    return [with_margin(f, margin, inset) for f in frames], margin
