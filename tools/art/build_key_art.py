"""Render the menus' key art: the title screen's hero image and one image per
chapter for chapter select (see tools/art/lib/key_art.py and
key_art_shots.py).

    blender -b --factory-startup -P tools/art/build_key_art.py -- \
        [--shots title road-to-jericho ...] [--quality preview|final] \
        [--out public/art/key-art] [--raw tools/art/.cache/key-art]

Each shot is rendered to a 16-bit PNG under --raw (<quality>/<id>.png),
graded, and written to --out as <id>.webp and <id>-<half width>.webp
(final quality; a preview goes to <raw>/preview/ only). One Blender per
shot is simplest (`node scripts/art-build.mjs key-art` runs them so); the
script renders several in one process too.
"""
import argparse
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import key_art as K  # noqa: E402
import key_art_shots  # noqa: E402


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--shots", nargs="+", default=list(key_art_shots.SHOTS))
    p.add_argument("--quality", choices=["preview", "final"], default="final")
    p.add_argument("--out", default=os.path.join(HERE, "..", "..", "public", "art", "key-art"))
    p.add_argument("--raw", default=os.path.join(HERE, ".cache", "key-art"))
    p.add_argument("--regrade", action="store_true", help="grade the last render again, without rendering")
    return p.parse_args(argv)


def main():
    a = args()
    for sid in a.shots:
        shot = key_art_shots.SHOTS[sid]
        t0 = time.time()
        raw = os.path.join(a.raw, a.quality, f"{sid}.png")
        if not a.regrade:
            if shot.kind == "place":
                K.render_place(shot, a.quality, raw)
            else:
                K.render_film(shot, a.quality, raw, os.path.join(HERE, ".cache", "teaser-data"))
        out = a.out if a.quality == "final" else os.path.join(a.raw, "preview")
        paths = K.finish(shot, raw, out)
        print("KEY ART", sid, round(time.time() - t0, 1), "s", *paths, flush=True)


main()
