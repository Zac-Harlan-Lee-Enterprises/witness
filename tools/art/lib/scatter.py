"""Scattering with Geometry Nodes: grass tufts on scrub, grit and pebbles on
the ground, leaves in tree crowns. Deterministic (seeded)."""
import bpy


def _socket(ng, name, in_out, kind):
    return ng.interface.new_socket(name=name, in_out=in_out, socket_type=kind)


def scatter(emitter, source, density, scale=(0.8, 1.2), seed=0, align=True, sink=0.0, keep=False, rotate_z_only=False, pick=False):
    """Replace (or join to) `emitter`'s faces with instances of `source` (an
    object, or a collection when `pick`), `density` per square unit. `sink`
    pushes instances inward along the normal by up to that distance (to fill
    a crown rather than coat it)."""
    ng = bpy.data.node_groups.new(f"scatter-{emitter.name}", "GeometryNodeTree")
    _socket(ng, "Geometry", "INPUT", "NodeSocketGeometry")
    _socket(ng, "Geometry", "OUTPUT", "NodeSocketGeometry")
    N = ng.nodes
    L = ng.links
    gin = N.new("NodeGroupInput")
    gout = N.new("NodeGroupOutput")
    dist = N.new("GeometryNodeDistributePointsOnFaces")
    dist.distribute_method = "RANDOM"
    dist.inputs["Density"].default_value = density
    dist.inputs["Seed"].default_value = seed
    L.new(gin.outputs[0], dist.inputs["Mesh"])
    points = dist.outputs["Points"]
    if sink > 0:
        setpos = N.new("GeometryNodeSetPosition")
        rnd = N.new("FunctionNodeRandomValue")
        rnd.data_type = "FLOAT"
        rnd.inputs["Min"].default_value = -sink
        rnd.inputs["Max"].default_value = 0.0
        rnd.inputs["Seed"].default_value = seed + 1
        scale_n = N.new("ShaderNodeVectorMath")
        scale_n.operation = "SCALE"
        L.new(dist.outputs["Normal"], scale_n.inputs[0])
        L.new(rnd.outputs["Value"], scale_n.inputs["Scale"])
        L.new(points, setpos.inputs["Geometry"])
        L.new(scale_n.outputs["Vector"], setpos.inputs["Offset"])
        points = setpos.outputs["Geometry"]
    inst = N.new("GeometryNodeInstanceOnPoints")
    L.new(points, inst.inputs["Points"])
    if pick:
        info = N.new("GeometryNodeCollectionInfo")
        info.inputs["Collection"].default_value = source
        info.inputs["Separate Children"].default_value = True
        info.inputs["Reset Children"].default_value = True
        L.new(info.outputs[0], inst.inputs["Instance"])
        inst.inputs["Pick Instance"].default_value = True
        rpick = N.new("FunctionNodeRandomValue")
        rpick.data_type = "INT"
        rpick.inputs["Min"].default_value = 0
        rpick.inputs["Max"].default_value = 99
        rpick.inputs["Seed"].default_value = seed + 5
        L.new(rpick.outputs["Value"], inst.inputs["Instance Index"])
    else:
        info = N.new("GeometryNodeObjectInfo")
        info.inputs["Object"].default_value = source
        L.new(info.outputs["Geometry"], inst.inputs["Instance"])
    rrot = N.new("FunctionNodeRandomValue")
    rrot.data_type = "FLOAT_VECTOR"
    rrot.inputs["Seed"].default_value = seed + 2
    if rotate_z_only:
        rrot.inputs["Min"].default_value = (0.0, 0.0, 0.0)
        rrot.inputs["Max"].default_value = (0.25, 0.25, 6.283)
    else:
        rrot.inputs["Min"].default_value = (0.0, 0.0, 0.0)
        rrot.inputs["Max"].default_value = (6.283, 6.283, 6.283)
    if align and rotate_z_only:
        L.new(rrot.outputs["Value"], inst.inputs["Rotation"])
    else:
        L.new(rrot.outputs["Value"], inst.inputs["Rotation"])
    rs = N.new("FunctionNodeRandomValue")
    rs.data_type = "FLOAT"
    rs.inputs["Min"].default_value = scale[0]
    rs.inputs["Max"].default_value = scale[1]
    rs.inputs["Seed"].default_value = seed + 3
    L.new(rs.outputs["Value"], inst.inputs["Scale"])
    # A random value per instance, kept through realizing as the "irand"
    # attribute, so materials can vary each stone, tuft or leaf.
    store = N.new("GeometryNodeStoreNamedAttribute")
    store.data_type = "FLOAT"
    store.domain = "INSTANCE"
    store.inputs["Name"].default_value = "irand"
    rv = N.new("FunctionNodeRandomValue")
    rv.data_type = "FLOAT"
    rv.inputs["Seed"].default_value = seed + 11
    L.new(inst.outputs["Instances"], store.inputs["Geometry"])
    L.new(rv.outputs["Value"], store.inputs["Value"])
    # Realised into real geometry, so the emitter alone decides visibility.
    realize = N.new("GeometryNodeRealizeInstances")
    L.new(store.outputs["Geometry"], realize.inputs["Geometry"])
    out = realize.outputs["Geometry"]
    if keep:
        join = N.new("GeometryNodeJoinGeometry")
        L.new(gin.outputs[0], join.inputs[0])
        L.new(realize.outputs["Geometry"], join.inputs[0])
        out = join.outputs[0]
    L.new(out, gout.inputs[0])
    mod = emitter.modifiers.new("scatter", "NODES")
    mod.node_group = ng
    return mod
