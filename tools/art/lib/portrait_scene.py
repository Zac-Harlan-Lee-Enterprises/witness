"""The portrait studio: an 85 mm lens with shallow depth of field, warm
painterly light (a big soft key at about 45 degrees, a fill, a rim), and a
sunlit limestone wall far enough behind to fall softly out of focus.

The head stays facing -Y; the camera moves round it, so every portrait
looks a little to the side (toward the dialogue text, on screen right).
"""
import math

import bpy
from mathutils import Vector

from common import hex_rgb
import portrait_materials as PM

CM = 0.01


def _look(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def _area(name, loc, target, size, energy, color, size_y=None, shape="DISK"):
    data = bpy.data.lights.new(name, "AREA")
    data.shape = shape if size_y is None else "RECTANGLE"
    data.size = size
    if size_y is not None:
        data.size_y = size_y
    data.energy = energy
    data.color = hex_rgb(color)[:3]
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    _look(obj, target)
    return obj


class Studio:
    def __init__(self, scene, focus, turn_deg=22.0, frame_cm=31.0, centre=(0.0, 0.0, -1.2), size=512, samples=256, elev_cm=3.5, roll_deg=0.0):
        self.scene = scene
        r = scene.render
        r.resolution_x = size
        r.resolution_y = size
        r.resolution_percentage = 100
        r.film_transparent = False
        scene.cycles.samples = samples
        scene.cycles.adaptive_threshold = 0.015
        scene.cycles.max_bounces = 8
        scene.cycles.diffuse_bounces = 4
        scene.cycles.glossy_bounces = 4
        scene.cycles.transmission_bounces = 6
        scene.cycles.transparent_max_bounces = 16
        scene.cycles_curves.shape = "THICK"
        scene.cycles_curves.subdivisions = 2
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
        scene.view_settings.exposure = 0.2
        # Camera: 85 mm on full frame, far enough back to frame head and shoulders.
        cam_data = bpy.data.cameras.new("PortraitCam")
        cam_data.lens = 85.0
        cam_data.sensor_width = 36.0
        cam_data.sensor_fit = "HORIZONTAL"
        dist = frame_cm * CM * cam_data.lens / cam_data.sensor_width
        a = math.radians(turn_deg)
        c = Vector(centre) * CM
        cam = bpy.data.objects.new("PortraitCam", cam_data)
        scene.collection.objects.link(cam)
        cam.location = c + Vector((math.sin(a) * dist, -math.cos(a) * dist, elev_cm * CM))
        _look(cam, c)
        if roll_deg:
            # A slight tilt of the head (the out-of-focus wall hides that it is the camera).
            cam.rotation_euler.rotate_axis("Z", math.radians(roll_deg))
        cam_data.dof.use_dof = True
        cam_data.dof.focus_distance = (Vector(focus) - cam.location).length
        cam_data.dof.aperture_fstop = 3.2
        cam_data.dof.aperture_blades = 7
        scene.camera = cam
        self.camera = cam
        self.distance = dist
        self.centre = c

        head = c + Vector((0, 0, 0.03))
        side = -1.0 if turn_deg >= 0 else 1.0  # the side away from the camera

        def at(az_deg, el_deg, dist):
            az = math.radians(az_deg) * side
            el = math.radians(el_deg)
            return head + Vector((math.sin(az) * math.cos(el) * dist, -math.cos(az) * math.cos(el) * dist, math.sin(el) * dist))

        # Short lighting, as in painted portraits: a big soft key from the side
        # the face turns toward, about 45 degrees round and above, so the
        # near cheek falls into soft shadow with a triangle of light.
        _area("Key", at(42, 30, 1.15), head, 0.85, 62.0, "#ffe6cc")
        # Fill: broad and dim from the camera's side, cooler, like light from
        # the open sky (warm key, cool fill: the colour of shadow in daylight).
        _area("Fill", at(-80, 8, 1.4), head, 1.8, 9.0, "#d4dcea")
        # Rim: behind, on the shadow side, to separate hair and shoulder from the wall.
        _area("Rim", at(-150, 32, 1.1), head + Vector((0, 0.05, 0)), 0.35, 30.0, "#ffe2bc", size_y=1.1)
        # A soft pool of light on the wall behind, brighter on the lit side.
        wall_at = at(35, 30, 1.0)
        _area("Wall", Vector((wall_at.x, -0.2, 0.8)), Vector((wall_at.x * 0.4, 1.6, 0.0)), 1.2, 26.0, "#ffd9a8")
        # The wall.
        bpy.ops.mesh.primitive_plane_add(size=6.0, location=(0.0, 1.6, 0.0), rotation=(math.pi / 2, 0, 0))
        wall = bpy.context.object
        wall.data.materials.append(PM.backdrop())
        self.wall = wall
        # Floor bounce: warm earth below.
        bpy.ops.mesh.primitive_plane_add(size=6.0, location=(0.0, 0.0, -1.2))
        floor = bpy.context.object
        floor.data.materials.append(PM.cloth("#8a6f52", "linen", name="floor"))
        floor.visible_camera = False
        world = bpy.data.worlds.new("Studio")
        scene.world = world
        world.use_nodes = True
        # The surroundings: a cool sky above, warm earth and walls below and
        # around, so shadows are not one flat colour.
        nt = world.node_tree
        bg = nt.nodes["Background"]
        coord = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[0].color = hex_rgb("#6a5a48")
        ramp.color_ramp.elements[1].position = 0.75
        ramp.color_ramp.elements[1].color = hex_rgb("#5a6272")
        nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = 0.35

    def view(self, turn_deg, elev_cm):
        """Review: move the camera round the same point (the lights stay)."""
        a = math.radians(turn_deg)
        cam = self.camera
        cam.location = self.centre + Vector((math.sin(a) * self.distance, -math.cos(a) * self.distance, elev_cm * CM))
        _look(cam, self.centre)
