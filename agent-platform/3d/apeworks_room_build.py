# APE Agents — APEWORKS HQ room environment (Blender/bpy), modeled on the
# approved headquarters reference. Exports a static environment GLB the app
# loads around the interactive workstations + agents (R3F owns those).
#   pip install bpy && python3 agent-platform/3d/apeworks_room_build.py
import os
_REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bpy, math, mathutils

FRONT = os.path.join(_REPO, "agent-platform", "frontend")
GLB = os.path.join(FRONT, "public", "models", "apeworks-room.glb")
S = os.path.join(_REPO, "agent-platform", "3d")

def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def rgb(hexs):
    h = hexs.lstrip("#")
    return (lin(int(h[0:2],16)), lin(int(h[2:4],16)), lin(int(h[4:6],16)), 1.0)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def mat(name, hexs, rough=0.55, emis=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgb(hexs)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    if emis:
        b.inputs["Emission Color"].default_value = rgb(hexs)
        b.inputs["Emission Strength"].default_value = emis
    return m

M = {
    "wall":     mat("wall", "#F6F1E9", 0.62),
    "wallWarm": mat("wallWarm", "#FCF7EF", 0.6),
    "floor":    mat("floor", "#D9D2C7", 0.7),
    "orange":   mat("orange", "#EE7F1C", 0.45),
    "orangeLit":mat("orangeLit", "#FF9A3C", 0.4, emis=2.2),
    "charcoal": mat("charcoal", "#1E1B18", 0.4),
    "screen":   mat("screen", "#141210", 0.25),
    "amber":    mat("amber", "#FFB45C", 0.4, emis=3.0),
    "sky":      mat("sky", "#AFD4EE", 0.4, emis=1.6),
    "glass":    mat("glass", "#DCE9F0", 0.08, alpha=0.22),
    "rug":      mat("rug", "#C9C2B8", 0.9),
    "plant":    mat("plant", "#8FBF6B", 0.7),
    "plantD":   mat("plantD", "#6E9E4E", 0.7),
    "pot":      mat("pot", "#FBF6EE", 0.5),
    "book":     mat("book", "#22201D", 0.5),
    "ape":      mat("ape", "#EE7F1C", 0.45),
    "apeDark":  mat("apeDark", "#B85712", 0.5),
    "eye":      mat("eyeM", "#11100E", 0.2),
    "muzzle":   mat("muzzle", "#F9A23F", 0.45),
}

root = bpy.data.objects.new("APEWORKS_ROOM_ROOT", None)
sc.collection.objects.link(root)

# three.js coords in, blender out: (x, y, z)three -> (x, -z, y)blender
def box(name, dims, pos, material, bevel=0.0, rot_y=0.0, parent=root):
    w, h, d = dims; x, y, z = pos
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    o = bpy.context.active_object; o.name = name
    o.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    if rot_y:
        o.rotation_euler = (0, 0, rot_y)
    if bevel:
        bv = o.modifiers.new("bevel", "BEVEL")
        bv.width = min(bevel, min(w, h, d) / 2 - 0.002); bv.segments = 5
        bv.harden_normals = True
    o.data.materials.append(material)
    o.parent = parent
    return o

def cyl(name, r, h, pos, material, parent=root, verts=48):
    x, y, z = pos
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=(x, -z, y), vertices=verts)
    o = bpy.context.active_object; o.name = name
    o.data.materials.append(material); o.parent = parent
    return o

def ico(name, r, pos, material, parent=root, sub=1, squash=1.0):
    x, y, z = pos
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r, location=(x, -z, y), subdivisions=sub)
    o = bpy.context.active_object; o.name = name
    o.scale = (1, 1, squash)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(material); o.parent = parent
    return o

# ── shell: floor + back wall + left window wall + right wall ─────────────────
W, D, H = 15.0, 10.5, 5.4       # room width (x), depth (z), wall height
box("FLOOR", (W, 0.24, D), (0, -0.12, 0), M["floor"], 0.06)

# back wall (z = -D/2)
box("WALL_BACK", (W, H, 0.3), (0, H/2, -D/2 - 0.15), M["wall"], 0.08)
# right wall (x = +W/2)
box("WALL_RIGHT", (0.3, H, D), (W/2 + 0.15, H/2, 0), M["wall"], 0.08)
# left wall with window opening (z -3.6..2.4, y 0.95..4.25) built from 4 slabs
LX = -W/2 - 0.15
box("WALL_L_BACK",  (0.3, H, D/2 - 3.6), (LX, H/2, -D/2 + (D/2 - 3.6)/2), M["wall"], 0.06)
box("WALL_L_FRONT", (0.3, H, D/2 - 2.4), (LX, H/2, D/2 - (D/2 - 2.4)/2), M["wall"], 0.06)
box("WALL_L_SILL",  (0.3, 0.95, 6.0), (LX, 0.475, -0.6), M["wall"], 0.06)
box("WALL_L_HEAD",  (0.3, H - 4.25, 6.0), (LX, (H + 4.25)/2, -0.6), M["wall"], 0.06)
# window: frame + sky glow + orange roller bar (reference)
box("WINDOW_FRAME_B", (0.14, 0.1, 6.1), (LX + 0.1, 0.95, -0.6), M["wallWarm"])
box("WINDOW_SKY", (0.06, 3.3, 6.0), (LX + 0.02, 2.6, -0.6), M["sky"])
box("WINDOW_ROLLER", (0.22, 0.16, 6.3), (LX + 0.16, 4.32, -0.6), M["orange"], 0.05)

# ── logo wall (back, left-of-center): raised panel + ape mark + wordmark ─────
BZ = -D/2  # back wall inner face z
box("LOGO_PANEL", (6.0, 3.6, 0.12), (-2.2, 2.9, BZ + 0.06), M["wallWarm"], 0.07)
def ape_mark(cx, cy, cz, s, parent=root, name="LOGO"):
    g = bpy.data.objects.new(name + "_GRP", None); sc.collection.objects.link(g); g.parent = parent
    box(name + "_HEAD", (1.0*s, 0.82*s, 0.16*s), (cx, cy, cz), M["ape"], 0.05*s, parent=g)
    box(name + "_BROW", (0.9*s, 0.2*s, 0.2*s), (cx, cy + 0.22*s, cz + 0.02*s), M["ape"], 0.03*s, parent=g)
    box(name + "_EYE_L", (0.13*s, 0.16*s, 0.05*s), (cx - 0.22*s, cy + 0.06*s, cz + 0.08*s), M["eye"], parent=g)
    box(name + "_EYE_R", (0.13*s, 0.16*s, 0.05*s), (cx + 0.22*s, cy + 0.06*s, cz + 0.08*s), M["eye"], parent=g)
    box(name + "_MUZ", (0.52*s, 0.34*s, 0.14*s), (cx, cy - 0.2*s, cz + 0.06*s), M["muzzle"], 0.04*s, parent=g)
    box(name + "_NOS_L", (0.05*s, 0.05*s, 0.04*s), (cx - 0.1*s, cy - 0.12*s, cz + 0.14*s), M["eye"], parent=g)
    box(name + "_NOS_R", (0.05*s, 0.05*s, 0.04*s), (cx + 0.1*s, cy - 0.12*s, cz + 0.14*s), M["eye"], parent=g)
    box(name + "_MOUTH", (0.3*s, 0.05*s, 0.04*s), (cx, cy - 0.3*s, cz + 0.14*s), M["apeDark"], parent=g)
    box(name + "_EAR_L", (0.16*s, 0.3*s, 0.14*s), (cx - 0.56*s, cy + 0.02*s, cz), M["ape"], 0.04*s, parent=g)
    box(name + "_EAR_R", (0.16*s, 0.3*s, 0.14*s), (cx + 0.56*s, cy + 0.02*s, cz), M["ape"], 0.04*s, parent=g)
    return g
ape_mark(-2.2, 3.5, BZ + 0.22, 1.15)

def wordmark(text, size, pos, material, name):
    x, y, z = pos
    bpy.ops.object.text_add(location=(x, -z, y))
    o = bpy.context.active_object; o.name = name
    o.data.body = text
    o.data.size = size
    o.data.extrude = 0.02
    o.data.align_x = "CENTER"
    o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    o.data.materials.append(material); o.parent = root
    return o
wordmark("APEWORKS", 0.52, (-2.2, 2.35, BZ + 0.14), M["charcoal"], "WORDMARK")
wordmark("HEADQUARTERS", 0.24, (-2.2, 1.98, BZ + 0.14), M["charcoal"], "WORDMARK_SUB")

# backlit cove outline around the logo panel (thin emissive rim behind panel)
box("LOGO_GLOW", (6.24, 3.84, 0.05), (-2.2, 2.9, BZ + 0.025), M["amber"])

# ── mezzanine (upper right, y=3.0) + glass rail + stairs decor ───────────────
MY, MX0, MZ0 = 3.0, 1.6, -0.9   # slab top y, slab from x MX0..W/2, z -D/2..MZ0
box("MEZZ_SLAB", (W/2 - MX0, 0.26, D/2 + MZ0), ((MX0 + W/2)/2, MY - 0.13, (-D/2 + MZ0)/2), M["wall"], 0.07)
box("MEZZ_EDGE", (W/2 - MX0, 0.1, 0.12), ((MX0 + W/2)/2, MY - 0.05, MZ0 + 0.06), M["orange"])
# glass balustrade along front edge + left edge, orange handrail
box("MEZZ_GLASS_F", (W/2 - MX0, 0.85, 0.05), ((MX0 + W/2)/2, MY + 0.425, MZ0), M["glass"])
box("MEZZ_RAIL_F", (W/2 - MX0, 0.07, 0.09), ((MX0 + W/2)/2, MY + 0.85, MZ0), M["orange"], 0.02)
box("MEZZ_GLASS_L", (0.05, 0.85, D/2 + MZ0), (MX0, MY + 0.425, (-D/2 + MZ0)/2), M["glass"])
box("MEZZ_RAIL_L", (0.09, 0.07, D/2 + MZ0), (MX0, MY + 0.85, (-D/2 + MZ0)/2), M["orange"], 0.02)
# pendant lamp over the mezzanine
box("LAMP_CORD", (0.03, 1.5, 0.03), (4.6, H - 0.75, -3.0), M["charcoal"])
o = ico("LAMP_DOME", 0.42, (4.6, H - 1.55, -3.0), M["orange"], sub=2, squash=0.72)
box("LAMP_GLOW", (0.5, 0.06, 0.5), (4.6, H - 1.78, -3.0), M["amber"])

# stairs along the left wall rising toward the back landing (decor, reference)
STEPS, RUN, RISE = 9, 0.42, 0.18
for i in range(STEPS):
    box(f"STAIR_{i+1}", (1.5, 0.09, RUN), (-6.0, RISE*(i+1) - 0.045, 2.6 - RUN*i), M["orange"], 0.02)
    box(f"STAIR_B_{i+1}", (1.5, RISE*(i+1) - 0.09, RUN), (-6.0, (RISE*(i+1) - 0.09)/2, 2.6 - RUN*i), M["wallWarm"])
box("LANDING", (1.5, 0.14, 1.2), (-6.0, RISE*STEPS + 0.07, 2.6 - RUN*STEPS - 0.4), M["wallWarm"], 0.04)
ape_mark(-6.0, RISE*STEPS + 0.55, 2.6 - RUN*STEPS - 0.5, 0.42, name="FIGURINE")

# ── dashboard screen + orange door (back-right, under the mezzanine) ─────────
box("DASH_FRAME", (3.4, 1.5, 0.14), (4.2, 1.95, BZ + 0.07), M["wallWarm"], 0.06)
box("DASH_SCREEN", (3.1, 1.24, 0.05), (4.2, 1.95, BZ + 0.16), M["screen"], 0.03)
ape_mark(3.4, 2.1, BZ + 0.2, 0.5, name="DASH_LOGO")
for i, bh in enumerate((0.28, 0.44, 0.34, 0.58)):
    box(f"DASH_BAR_{i+1}", (0.16, bh, 0.03), (4.7 + i*0.28, 1.6 + bh/2, BZ + 0.2), M["amber"])
box("DOOR", (1.15, 2.45, 0.12), (6.6, 1.225, BZ + 0.1), M["orange"], 0.06)
box("DOOR_HANDLE", (0.06, 0.3, 0.06), (6.2, 1.25, BZ + 0.19), M["charcoal"], 0.015)

# ── soft furniture + decor ───────────────────────────────────────────────────
cyl("RUG", 2.3, 0.04, (-0.4, 0.02, 1.1), M["rug"], verts=64)
ico("POUF", 0.55, (3.6, 0.32, 1.3), M["orange"], sub=2, squash=0.62)          # agent bean bag
ico("POUF_2", 0.42, (5.2, 0.26, 2.6), M["muzzle"], sub=2, squash=0.62)
box("COFFEE_TABLE", (1.7, 0.4, 0.9), (0.2, 0.2, 3.3), M["wallWarm"], 0.1)
box("BOOK", (0.5, 0.07, 0.36), (-0.1, 0.435, 3.2), M["book"], 0.01)
box("ORANGE_BOX", (0.3, 0.18, 0.3), (0.6, 0.49, 3.45), M["orange"], 0.04)
def plant(name, pos, s=1.0, parent=root):
    x, y, z = pos
    cyl(name + "_POT", 0.3*s, 0.45*s, (x, y + 0.225*s, z), M["pot"], parent=parent)
    ico(name + "_LEAF1", 0.34*s, (x, y + 0.72*s, z), M["plant"], sub=1, parent=parent)
    ico(name + "_LEAF2", 0.26*s, (x + 0.18*s, y + 0.95*s, z + 0.06*s), M["plantD"], sub=1, parent=parent)
    ico(name + "_LEAF3", 0.22*s, (x - 0.2*s, y + 0.92*s, z - 0.08*s), M["plant"], sub=1, parent=parent)
plant("PLANT_L", (-6.3, 0, 3.9), 1.25)
plant("PLANT_R", (6.4, 0, 1.2), 1.1)
plant("PLANT_MEZZ", (6.6, MY, -4.4), 0.85)
plant("PLANT_WIN", (-6.4, 0, -4.4), 1.0)
# shelf on the mezzanine back wall with a mini ape
box("MEZZ_SHELF", (1.6, 0.08, 0.4), (2.9, MY + 1.5, BZ + 0.25), M["wallWarm"], 0.02)
ape_mark(2.9, MY + 1.85, BZ + 0.35, 0.34, name="SHELF_APE")

# ── agent slots (empties; the app parents workstations + apes here) ──────────
# 5 per floor max: ground floor slots 1–4 + mezzanine slot 5
SLOTS = {
    "AGENT_SLOT_1": ((-4.4, 0, -1.5), 0.42),   # by the window, angled in
    "AGENT_SLOT_2": ((-1.4, 0, -2.6), 0.06),   # under the logo wall
    "AGENT_SLOT_3": ((1.2, 0, -2.4), -0.1),    # shared table row
    "AGENT_SLOT_4": ((3.6, 0, 1.3), -0.5),     # pouf lounge (sit clip)
    "AGENT_SLOT_5": ((4.3, MY, -3.1), 0.1),    # mezzanine desk
}
for n, ((x, y, z), ry) in SLOTS.items():
    e = bpy.data.objects.new(n, None); e.location = (x, -z, y)
    e.rotation_euler = (0, 0, ry)
    e.empty_display_size = 0.2; sc.collection.objects.link(e); e.parent = root

# ── export GLB ───────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(GLB), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", export_yup=True,
                          export_apply=True, use_active_scene=True)
print("GLB WRITTEN", GLB, os.path.getsize(GLB), "bytes")

# ── approval render (app-like front three-quarter) ───────────────────────────
sc.render.engine = "CYCLES"; sc.cycles.samples = 48; sc.cycles.use_denoising = True
sc.cycles.device = "CPU"
sc.render.resolution_x = 1280; sc.render.resolution_y = 880
sc.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = rgb("#EFE9DF")
w.node_tree.nodes["Background"].inputs[1].default_value = 0.55
def area(name, pos3, power, size, color=(1,1,1)):
    x, y, z = pos3
    li = bpy.data.lights.new(name, "AREA"); li.energy = power; li.size = size; li.color = color
    o = bpy.data.objects.new(name, li); o.location = (x, -z, y)
    d = mathutils.Vector((0 - o.location.x, 0 - o.location.y, 1.6 - o.location.z))
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler(); sc.collection.objects.link(o)
area("sun", (-9, 7.5, 4.0), 3200, 6, (1.0, 0.95, 0.86))   # through the window
area("fill", (5, 6.0, 9.0), 1500, 7, (1.0, 0.97, 0.9))
cam = bpy.data.cameras.new("cam"); cam.lens = 32
co = bpy.data.objects.new("cam", cam); co.location = (6.5, -12.6, 5.6)
d = mathutils.Vector((-0.6 - 6.5, 0 - (-12.6), 1.9 - 5.6))
co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
sc.collection.objects.link(co); sc.camera = co
sc.render.filepath = os.path.join(S, "apeworks-room.png")
bpy.ops.render.render(write_still=True)
print("RENDER DONE")
