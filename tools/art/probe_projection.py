"""Render a checkered ground, a 1-tile cube and a 54-unit pole to verify
that tiles are square and height maps 1:1 up the screen."""
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import view  # noqa: E402

out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 8
# Checker ground 4x4 tiles.
bpy.ops.mesh.primitive_plane_add(size=4, location=(2, -2, 0))
plane = bpy.context.object
mat = bpy.data.materials.new("checker")
mat.use_nodes = True
nt = mat.node_tree
chk = nt.nodes.new("ShaderNodeTexChecker")
chk.inputs["Scale"].default_value = 4.0 * 1.0
coord = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(coord.outputs["Object"], chk.inputs["Vector"])
chk.inputs["Scale"].default_value = 0.5
nt.links.new(chk.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
plane.data.materials.append(mat)
# A pole 54 game units tall at game (48, 48).
bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=54 / 32, location=(48 / 32, -48 / 32, 27 / 32))
sun = bpy.data.lights.new("sun", "SUN")
sun_obj = bpy.data.objects.new("sun", sun)
scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (0.6, 0, 0.8)
view.setup_camera(scene, 64, 64, 384, 384, 3)
scene.render.filepath = out
scene.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
print("rendered", out)
