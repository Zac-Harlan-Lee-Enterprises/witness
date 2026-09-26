"""The game's camera, reproduced in Blender.

The game draws the world in an oblique three-quarter view: the ground is
not foreshortened (a tile is a square on screen) and a thing `h` units tall
rises `h` units up the screen. In Blender that is an orthographic camera
looking north and down at 45 degrees, whose pixels are 1/sin(45) wider than
tall, so the foreshortened ground is stretched back to square.

Units: 1 Blender unit = 1 tile = 32 game units. Game x runs east (Blender
+X); game y runs south (Blender -Y); height is Blender +Z.
"""
import math

import bpy

TILE = 32.0
TILT = math.radians(45.0)


def game_to_blender(gx, gy, gz=0.0):
    """Game units (x east, y south, z up) to Blender units."""
    return (gx / TILE, -gy / TILE, gz / TILE)


def setup_camera(scene, centre_sx, centre_sy, width_px, height_px, ppu):
    """Aim the orthographic camera so the image centre is game screen point
    (centre_sx, centre_sy), where screen y = game y - height. `ppu` is
    output pixels per game unit."""
    cam = scene.camera
    if cam is None:
        data = bpy.data.cameras.new("GameCamera")
        cam = bpy.data.objects.new("GameCamera", data)
        scene.collection.objects.link(cam)
        scene.camera = cam
    cam.data.type = "ORTHO"
    cam.data.sensor_fit = "HORIZONTAL"
    ppb = ppu * TILE  # pixels per Blender unit
    cam.data.ortho_scale = width_px / ppb
    cam.data.clip_start = 0.01
    cam.data.clip_end = 400.0
    height_above = 40.0
    cam.location = (centre_sx / TILE, -centre_sy / TILE - height_above, height_above)
    cam.rotation_euler = (TILT, 0.0, 0.0)
    r = scene.render
    r.resolution_x = int(width_px)
    r.resolution_y = int(height_px)
    r.resolution_percentage = 100
    r.pixel_aspect_x = 1.0 / math.sin(TILT)
    r.pixel_aspect_y = 1.0
    return cam


def screen_of(gx, gy, gz=0.0):
    """Where a game-space point lands on screen (game units)."""
    return (gx, gy - gz)


def setup_figure_camera(scene, lift_units, width_px, height_px, ppu, tilt_deg=32.0):
    """A camera for people: a little lower than the world camera (so faces
    read), still mapping height 1:1 up the screen. The image centre is
    `lift_units` above the feet (the origin)."""
    cam = scene.camera
    if cam is None:
        data = bpy.data.cameras.new("FigureCamera")
        cam = bpy.data.objects.new("FigureCamera", data)
        scene.collection.objects.link(cam)
        scene.camera = cam
    tilt = math.radians(tilt_deg)
    cam.data.type = "ORTHO"
    cam.data.sensor_fit = "HORIZONTAL"
    cam.data.ortho_scale = width_px / (ppu * TILE)
    cam.data.clip_start = 0.01
    cam.data.clip_end = 400.0
    # Looking north and down at `tilt` above the horizon.
    d = (0.0, math.cos(tilt), -math.sin(tilt))
    target = (0.0, 0.0, lift_units / TILE)
    cam.location = (target[0] - d[0] * 40, target[1] - d[1] * 40, target[2] - d[2] * 40)
    cam.rotation_euler = (math.pi / 2 - tilt, 0.0, 0.0)
    r = scene.render
    r.resolution_x = int(width_px)
    r.resolution_y = int(height_px)
    r.resolution_percentage = 100
    r.pixel_aspect_x = 1.0 / math.cos(tilt)
    r.pixel_aspect_y = 1.0
    return cam
