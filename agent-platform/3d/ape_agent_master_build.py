# APE Agents — master character build (Blender/bpy). Locked v1 source of truth.
# Regenerates the production GLB + a three-quarter approval render:
#   pip install bpy && python3 agent-platform/3d/ape_agent_master_build.py
import os
_REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# APE Agents — master character build in Blender, exported to GLB.
# Blender owns appearance; the app loads the GLB. Built to the V2 locked spec.
# Coordinate mapping (spec is three.js Y-up): three (x, y, z) -> blender (x, -z, y).
import bpy, math, mathutils

FRONT = os.path.join(_REPO, "agent-platform", "frontend")
GLB = os.path.join(FRONT, "public", "models", "ape-agent-master.glb")
S = os.path.join(_REPO, "agent-platform", "3d")

def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def rgb(hexs):
    h = hexs.lstrip("#")
    return (lin(int(h[0:2],16)), lin(int(h[2:4],16)), lin(int(h[4:6],16)), 1.0)

# monochrome body — the reference is ONE orange; tonal variation comes from light/AO,
# not from different material colours (avoids seam/panel lines)
COL = {
    "body": "#E36618", "face": "#E36618", "innerEar": "#A6470B",
    "nostril": "#241204", "eye": "#11100E", "hi": "#FFFFFF",
}

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def mat(name, hexs, rough=0.48, emis=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgb(hexs)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    if emis:
        b.inputs["Emission Color"].default_value = rgb(hexs)
        b.inputs["Emission Strength"].default_value = emis
    return m
M = {k: mat(k, v, 0.11 if k == "eye" else 0.48) for k, v in COL.items() if k != "hi"}
M["hi"] = mat("hi", "#FFFFFF", 0.3, emis=1.2)

root = bpy.data.objects.new("APE_AGENT_ROOT", None)
sc.collection.objects.link(root)

def box(name, dims, pos, bevel, material, parent=root):
    w, h, d = dims; x, y, z = pos
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    o = bpy.context.active_object; o.name = name
    o.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bv = o.modifiers.new("bevel", "BEVEL")
        bv.width = min(bevel, min(w, h, d) / 2 - 0.002); bv.segments = 6
        bv.harden_normals = True
    o.data.materials.append(material)
    o.parent = parent
    return o

def cutter(dims, pos):
    w, h, d = dims; x, y, z = pos
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    o = bpy.context.active_object; o.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    return o

def carve(target, c):
    m = target.modifiers.new("carve", "BOOLEAN")
    m.operation = "DIFFERENCE"; m.solver = "EXACT"; m.object = c
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(c, do_unlink=True)

# ── BODY — squat & wide: shorter overall, wide torso, long thick arms ─────────
# body + legs are ONE seamless mass: the torso runs to the floor and a notch is carved
# from the bottom to form two legs — no leg/body seam line, just a clean gap
tor = box("TORSO", (1.50, 1.22, 1.04), (0, 0.61, 0), 0.13, M["body"])  # 20% shorter lower half
carve(tor, cutter((0.32, 0.67, 1.3), (0, 0.0, 0.04)))
# arm with a SMALLER hand block at the bottom (hand narrower than the arm)
box("ARM_L", (0.54, 0.92, 0.64), (-1.11, 0.78, 0.0), 0.12, M["body"])
box("ARM_R", (0.54, 0.92, 0.64), (1.11, 0.78, 0.0), 0.12, M["body"])
box("HAND_L", (0.42, 0.40, 0.52), (-1.11, 0.26, 0.02), 0.09, M["body"])
box("HAND_R", (0.42, 0.40, 0.52), (1.11, 0.26, 0.02), 0.09, M["body"])

# ── HEAD — giant near-cube, dropped 0.20 so the whole character reads shorter ──
# deeper head + the rectangular FACE PANEL that frames the eyes and full upper face
# (slightly proud of the head front, same colour — its edge is the visible frame)
box("HEAD_BLOCK", (1.92, 1.58, 1.22), (0, 2.50, 0), 0.13, M["body"])
box("FACE_PANEL", (1.62, 0.94, 0.65), (0, 2.52, 0.725), 0.06, M["body"])  # 4x thick slab — front at z 1.05
# brow bar sitting right on top of the eyes
box("BROW", (1.70, 0.30, 0.60), (0, 2.93, 1.05), 0.07, M["body"])  # 3x deep visor, rooted in the panel

# bigger eyes, fully visible just under the brow, sitting ON the thick panel's front
box("EYE_L", (0.26, 0.40, 0.06), (-0.45, 2.55, 1.075), 0.055, M["eye"])
box("EYE_R", (0.26, 0.40, 0.06), (0.45, 2.55, 1.075), 0.055, M["eye"])
def highlight(name, pos):
    x, y, z = pos
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.038, location=(x, -z, y))
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.shade_smooth(); o.data.materials.append(M["hi"]); o.parent = root
highlight("EYE_HIGHLIGHT_L", (-0.50, 2.645, 1.12))
highlight("EYE_HIGHLIGHT_R", (0.40, 2.645, 1.12))

# ── MUZZLE — ONE flat-fronted mass: NO horizontal seam between nose and mouth.
# A narrow bridge (rises between the eyes) and a wide mouth pad share the SAME front
# plane and are unioned into one piece; then sharp SQUARE nostril holes and a single
# 90° MOUTH cutout are carved (bevel applied first so the cutouts stay crisp), each
# backed by a dark inset.
def _raw(dims, pos):
    w, h, d = dims; x, y, z = pos
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    o = bpy.context.active_object; o.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    return o
def _union(a, b):
    m = a.modifiers.new("u", "BOOLEAN"); m.operation = "UNION"; m.solver = "EXACT"; m.object = b
    bpy.context.view_layer.objects.active = a
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(b, do_unlink=True)
# muzzle at ~70% (30% smaller = younger face); still wider than tall
FZ = 1.43  # 2x projection beyond the panel; deeper blocks stay rooted into it
muz = _raw((0.68, 0.38, 0.64), (0, 2.16, FZ - 0.32))          # bridge: small, 25% shorter
_union(muz, _raw((0.88, 0.30, 0.64), (0, 1.90, FZ - 0.32)))   # + wider mouth pad, same front
muz.name = "MUZZLE"
_bv = muz.modifiers.new("b", "BEVEL"); _bv.width = 0.05; _bv.segments = 6; _bv.harden_normals = True
bpy.context.view_layer.objects.active = muz
bpy.ops.object.modifier_apply(modifier=_bv.name)
muz.data.materials.append(M["body"])
# square nostrils sitting HIGH on the bridge, near its top edge
carve(muz, cutter((0.12, 0.12, 0.24), (-0.17, 2.22, FZ)))
carve(muz, cutter((0.12, 0.12, 0.24), (0.17, 2.22, FZ)))
box("NOSTRIL_L", (0.11, 0.11, 0.10), (-0.17, 2.22, FZ - 0.11), 0.012, M["nostril"])
box("NOSTRIL_R", (0.11, 0.11, 0.10), (0.17, 2.22, FZ - 0.11), 0.012, M["nostril"])
# MOUTH = the 90° step itself: a full-width chin strip set STRAIGHT BACK beneath the
# pad, edge to edge — the ledge shadow across the whole muzzle IS the mouth line.
box("MUZZLE_CHIN", (0.88, 0.15, 0.50), (0, 1.66, FZ - 0.38), 0.04, M["body"])  # shorter, stays rooted

# ears — carve a square recess, drop a darker inner box into it
for side, sx in (("L", -1), ("R", 1)):
    ear = box("EAR_" + side, (0.45, 0.62, 0.31), (sx * 1.085, 2.47, 0.015), 0.095, M["body"])
    carve(ear, cutter((0.17, 0.22, 0.16), (sx * 1.085, 2.47, 0.12)))
    box("EAR_INNER_" + side, (0.15, 0.20, 0.08), (sx * 1.085, 2.47, 0.06), 0.02, M["innerEar"])

# group all head parts under one empty and drop it, so the character reads short & squat
HEAD = bpy.data.objects.new("HEAD", None); sc.collection.objects.link(HEAD); HEAD.parent = root
for _n in ("HEAD_BLOCK", "FACE_PANEL", "BROW", "EYE_L", "EYE_R", "EYE_HIGHLIGHT_L", "EYE_HIGHLIGHT_R",
           "MUZZLE", "MUZZLE_CHIN", "NOSTRIL_L", "NOSTRIL_R",
           "EAR_L", "EAR_R", "EAR_INNER_L", "EAR_INNER_R"):
    _ob = bpy.data.objects.get(_n)
    if _ob:
        _ob.parent = HEAD
        _ob.matrix_parent_inverse = HEAD.matrix_world.inverted()
HEAD.location = (0, 0, -0.53)  # head dropped further to sit on the 20%-shorter body

# ── attachment sockets (empties) ──────────────────────────────────────────────
SOCKETS = {
    "SOCKET_HEAD_TOP": (0, 3.51, 0), "SOCKET_TEMPLE_L": (-0.9, 2.9, 0.3),
    "SOCKET_TEMPLE_R": (0.9, 2.9, 0.3), "SOCKET_EAR_L": (-1.3, 2.67, 0.0),
    "SOCKET_EAR_R": (1.3, 2.67, 0.0), "SOCKET_CHEST": (0, 1.4, 0.42),
    "SOCKET_HAND_L": (-0.86, 0.55, 0.1), "SOCKET_HAND_R": (0.86, 0.55, 0.1),
    "SOCKET_BACK": (0, 1.5, -0.42), "SOCKET_FLOOR_STATUS": (0, 0.02, 0),
}
for n, (x, y, z) in SOCKETS.items():
    e = bpy.data.objects.new(n, None); e.location = (x, -z, y)
    e.empty_display_size = 0.1; sc.collection.objects.link(e); e.parent = root

# ── export GLB (model only; app supplies camera + lights) ─────────────────────
import os
os.makedirs(os.path.dirname(GLB), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", export_yup=True,
                          export_apply=True, use_active_scene=True)
print("GLB WRITTEN", GLB, os.path.getsize(GLB), "bytes")

# ── quick three-quarter comparison render (matches app: root rotated -16deg) ──
root.rotation_euler = (0, 0, math.radians(-16))
sc.render.engine = "CYCLES"; sc.cycles.samples = 64; sc.cycles.use_denoising = True
sc.cycles.device = "CPU"
sc.render.resolution_x = 1000; sc.render.resolution_y = 1000
sc.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[1].default_value = 0.5
def area(name, pos3, power, size, color=(1,1,1)):
    x, y, z = pos3
    li = bpy.data.lights.new(name, "AREA"); li.energy = power; li.size = size; li.color = color
    o = bpy.data.objects.new(name, li); o.location = (x, -z, y)
    d = mathutils.Vector((0 - o.location.x, 0 - o.location.y, 1.82 - o.location.z))
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler(); sc.collection.objects.link(o)
area("key", (-4.5, 6.2, 5.0), 1400, 5)
area("fill", (4.5, 3.5, 4.0), 450, 4, (1.0, 0.92, 0.8))
area("rim", (1.5, 5.0, -4.5), 600, 3)
cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.ortho_scale = 4.8
co = bpy.data.objects.new("cam", cam); co.location = (5.2, -7.0, 4.15)
d = mathutils.Vector((0 - 5.2, 0 - (-7.0), 1.82 - 4.15))
co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
sc.collection.objects.link(co); sc.camera = co
sc.render.filepath = os.path.join(S, "ape-agent-three-quarter.png")
bpy.ops.render.render(write_still=True)
print("RENDER DONE")
