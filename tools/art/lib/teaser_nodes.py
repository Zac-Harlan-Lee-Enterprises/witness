"""A small language for shader graphs: every call returns an output socket,
and every input may be a socket, a number, a colour (hex) or a vector, so
a material reads like the arithmetic it is:

    g = Graph("stone")
    n = g.noise(g.position(), scale=4.0)
    col = g.mix(g.map(n, 0.4, 0.6), "#c2ab86", "#d8cbb0")
    g.principled(base=col, roughness=0.9)

Used by the teaser's materials (EEVEE and Cycles alike).
"""
import bpy

from common import hex_rgb


class Graph:
    def __init__(self, name):
        self.mat = bpy.data.materials.new(name)
        self.mat.use_nodes = True
        self.nt = self.mat.node_tree
        self.nt.nodes.clear()
        self.out = self.nt.nodes.new("ShaderNodeOutputMaterial")

    # ── plumbing ────────────────────────────────────────────────────────────
    def node(self, kind, inputs=None, **props):
        n = self.nt.nodes.new(kind)
        for k, v in props.items():
            setattr(n, k, v)
        for k, v in (inputs or {}).items():
            self.set(n.inputs[k], v)
        return n

    def set(self, socket, v):
        if isinstance(v, bpy.types.NodeSocket):
            self.nt.links.new(v, socket)
        elif isinstance(v, str):
            c = hex_rgb(v)
            socket.default_value = c if len(socket.default_value) == 4 else c[:3]
        elif isinstance(v, (int, float)):
            try:
                socket.default_value = v
            except TypeError:
                n = len(socket.default_value)
                socket.default_value = [v] * n if n != 4 else [v, v, v, 1.0]
        else:
            socket.default_value = v

    # ── inputs ──────────────────────────────────────────────────────────────
    def position(self):
        return self.node("ShaderNodeNewGeometry").outputs["Position"]

    def normal(self):
        return self.node("ShaderNodeNewGeometry").outputs["Normal"]

    def coords(self, kind="Object"):
        return self.node("ShaderNodeTexCoord").outputs[kind]

    def uv(self):
        return self.coords("UV")

    def attr(self, name, out="Fac"):
        return self.node("ShaderNodeAttribute", attribute_name=name, attribute_type="GEOMETRY").outputs[out]

    def object_random(self):
        return self.node("ShaderNodeObjectInfo").outputs["Random"]

    def distance(self):
        """Distance from the camera (to fade detail that would shimmer)."""
        return self.node("ShaderNodeCameraData").outputs["View Distance"]

    def xyz(self, v):
        n = self.node("ShaderNodeSeparateXYZ", {"Vector": v})
        return n.outputs["X"], n.outputs["Y"], n.outputs["Z"]

    def vec(self, x=0.0, y=0.0, z=0.0):
        return self.node("ShaderNodeCombineXYZ", {"X": x, "Y": y, "Z": z}).outputs[0]

    def rgb(self, r, g=None, b=None):
        return self.node("ShaderNodeCombineColor", {"Red": r, "Green": g if g is not None else r, "Blue": b if b is not None else r}).outputs[0]

    # ── textures ────────────────────────────────────────────────────────────
    def noise(self, v, scale=1.0, detail=4.0, rough=0.55, lac=2.0, out="Fac", dims="3D"):
        return self.node("ShaderNodeTexNoise", {"Vector": v, "Scale": scale, "Detail": detail, "Roughness": rough, "Lacunarity": lac}, noise_dimensions=dims).outputs[out]

    def voronoi(self, v, scale=1.0, rand=1.0, out="Distance", feature="F1", metric="EUCLIDEAN", dims="3D"):
        n = self.node("ShaderNodeTexVoronoi", {"Vector": v, "Scale": scale, "Randomness": rand}, feature=feature, distance=metric, voronoi_dimensions=dims)
        return n.outputs[out]

    def wave(self, v, scale=1.0, distortion=0.0, detail=2.0, kind="BANDS", direction="Z", profile="SIN", out="Fac"):
        n = self.node("ShaderNodeTexWave", {"Vector": v, "Scale": scale, "Distortion": distortion, "Detail": detail}, wave_type=kind, bands_direction=direction, wave_profile=profile)
        return n.outputs[out]

    def white(self, v, out="Value", dims="3D"):
        return self.node("ShaderNodeTexWhiteNoise", {"Vector": v}, noise_dimensions=dims).outputs[out]

    # ── arithmetic ──────────────────────────────────────────────────────────
    def math(self, op, a, b=0.0, c=None, clamp=False):
        n = self.node("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.set(n.inputs[0], a)
        self.set(n.inputs[1], b)
        if c is not None:
            self.set(n.inputs[2], c)
        return n.outputs[0]

    def add(self, a, b):
        return self.math("ADD", a, b)

    def sub(self, a, b):
        return self.math("SUBTRACT", a, b)

    def mul(self, a, b):
        return self.math("MULTIPLY", a, b)

    def vmath(self, op, a, b=None, scale=None):
        n = self.node("ShaderNodeVectorMath", operation=op)
        self.set(n.inputs[0], a)
        if b is not None:
            self.set(n.inputs[1], b)
        if scale is not None:
            self.set(n.inputs["Scale"], scale)
        return n.outputs[1] if op in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else n.outputs[0]

    def map(self, v, fmin=0.0, fmax=1.0, tmin=0.0, tmax=1.0, clamp=True, interp="LINEAR"):
        n = self.node("ShaderNodeMapRange", {"Value": v, "From Min": fmin, "From Max": fmax, "To Min": tmin, "To Max": tmax}, clamp=clamp, interpolation_type=interp)
        return n.outputs["Result"]

    def smooth(self, v, fmin, fmax, tmin=0.0, tmax=1.0):
        return self.map(v, fmin, fmax, tmin, tmax, interp="SMOOTHSTEP")

    def fade(self, near, far):
        """1 near the camera, 0 beyond `far`."""
        return self.map(self.distance(), near, far, 1.0, 0.0)

    def mix(self, fac, a, b, blend="MIX", clamp=True):
        n = self.node("ShaderNodeMix", data_type="RGBA", blend_type=blend, clamp_result=clamp)
        self.set(n.inputs[0], fac)
        self.set(n.inputs[6], a)
        self.set(n.inputs[7], b)
        return n.outputs[2]

    def mixf(self, fac, a, b):
        n = self.node("ShaderNodeMix", data_type="FLOAT")
        self.set(n.inputs[0], fac)
        self.set(n.inputs[2], a)
        self.set(n.inputs[3], b)
        return n.outputs[0]

    def ramp(self, fac, stops, interp="LINEAR"):
        n = self.node("ShaderNodeValToRGB")
        n.color_ramp.interpolation = interp
        self.set(n.inputs["Fac"], fac)
        els = n.color_ramp.elements
        while len(els) < len(stops):
            els.new(0.5)
        for el, (p, c) in zip(els, stops):
            el.position = p
            el.color = hex_rgb(c) if isinstance(c, str) else c
        return n.outputs["Color"]

    def hsv(self, col, h=0.5, s=1.0, v=1.0):
        return self.node("ShaderNodeHueSaturation", {"Color": col, "Hue": h, "Saturation": s, "Value": v}).outputs[0]

    def bump(self, height, strength=0.3, distance=0.02, normal=None):
        n = self.node("ShaderNodeBump", {"Height": height, "Strength": strength, "Distance": distance})
        if normal is not None:
            self.set(n.inputs["Normal"], normal)
        return n.outputs["Normal"]

    # ── surfaces ────────────────────────────────────────────────────────────
    def principled(self, base="#808080", roughness=0.8, spec=0.35, normal=None, **extra):
        inputs = {"Base Color": base, "Roughness": roughness, "Specular IOR Level": spec}
        if normal is not None:
            inputs["Normal"] = normal
        inputs.update(extra)
        n = self.node("ShaderNodeBsdfPrincipled", inputs)
        self.nt.links.new(n.outputs["BSDF"], self.out.inputs["Surface"])
        return n

    def emission(self, color, strength):
        n = self.node("ShaderNodeEmission", {"Color": color, "Strength": strength})
        self.nt.links.new(n.outputs[0], self.out.inputs["Surface"])
        return n

    def surface(self, shader):
        self.nt.links.new(shader, self.out.inputs["Surface"])

    def displacement(self, height, scale=0.05, midlevel=0.5):
        n = self.node("ShaderNodeDisplacement", {"Height": height, "Scale": scale, "Midlevel": midlevel})
        self.nt.links.new(n.outputs[0], self.out.inputs["Displacement"])
        return n
