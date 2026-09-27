"""Blender meshes from numpy arrays (fast bulk creation, custom normals)."""
import bpy
import numpy as np


def from_arrays(name, V, quads, N=None, material=None, collection=None, scale=0.01):
    """A mesh object from vertices (cm) and quads, with exact normals if given."""
    me = bpy.data.meshes.new(name)
    nv = len(V)
    nq = len(quads)
    me.vertices.add(nv)
    me.vertices.foreach_set("co", (np.asarray(V, np.float32) * scale).ravel())
    me.loops.add(nq * 4)
    me.loops.foreach_set("vertex_index", np.asarray(quads, np.int32).ravel())
    me.polygons.add(nq)
    me.polygons.foreach_set("loop_start", np.arange(0, nq * 4, 4, dtype=np.int32))
    me.update(calc_edges=True)
    me.polygons.foreach_set("use_smooth", np.ones(nq, dtype=bool))
    if N is not None:
        me.normals_split_custom_set_from_vertices(np.asarray(N, np.float32))
    me.update()
    obj = bpy.data.objects.new(name, me)
    if material is not None:
        me.materials.append(material)
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def micro_displace(obj, pixel=1.0):
    """Adaptive subdivision for true displacement: Cycles dices the mesh
    into micro-polygons about `pixel` pixels across where the camera sees
    it, and the material's displacement moves each one."""
    mod = obj.modifiers.new("micro", "SUBSURF")
    # Linear: the base mesh is already 0.75 mm and exact, and Catmull-Clark
    # patches (OpenSubdiv) made dicing a 450k-quad head take up to 25 minutes.
    mod.subdivision_type = "SIMPLE"
    mod.levels = 0
    mod.render_levels = 1
    mod.use_adaptive_subdivision = True
    mod.adaptive_space = "PIXEL"
    mod.adaptive_pixel_size = pixel
    return mod


def orient_quads(V, quads, N):
    """Flip quads whose winding points against the field's normals."""
    a = V[quads[:, 0]]
    b = V[quads[:, 1]]
    c = V[quads[:, 2]]
    fn = np.cross(b - a, c - a)
    n = N[quads].mean(axis=1)
    flip = np.einsum("ij,ij->i", fn, n) < 0
    if flip.mean() > 0.5:
        return quads[:, ::-1].copy()
    return quads


def set_attribute(obj, name, values, domain="POINT"):
    me = obj.data
    values = np.asarray(values, np.float32)
    if values.ndim == 1:
        attr = me.attributes.get(name) or me.attributes.new(name, "FLOAT", domain)
        attr.data.foreach_set("value", values)
    else:
        if values.shape[1] == 3:
            values = np.concatenate([values, np.ones((len(values), 1), np.float32)], 1)
        attr = me.attributes.get(name) or me.attributes.new(name, "FLOAT_COLOR", domain)
        attr.data.foreach_set("color", values.ravel())
    return attr
