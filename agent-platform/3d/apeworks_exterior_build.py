# APE Agents — HQ EXTERIOR (Blender/bpy), modeled on the approved "APE AGENTS
# HQ" comp: the building IS the mascot's head — cream rounded mass with eye
# windows, the orange muzzle as the entrance tower, banana sculpture on the
# roof, dark "LET THE APES WORK." wing, plaza props (monolith sign, status
# board, delivery drone + van), dusk skyline. Exports a static GLB the app
# loads; R3F owns camera/lighting/FX.
#   pip install bpy && python3 agent-platform/3d/apeworks_exterior_build.py
import os
_REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bpy, math, mathutils

FRONT = os.path.join(_REPO, "agent-platform", "frontend")
GLB = os.path.join(FRONT, "public", "models", "apeworks-exterior.glb")
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
    "plaza":    mat("plaza", "#59504A", 0.32),          # damp dusk concrete
    "path":     mat("path", "#8A7D6C", 0.45),
    "grass":    mat("grass", "#4E7A3C", 0.85),
    "cream":    mat("cream", "#F2E9DA", 0.5),
    "creamDim": mat("creamDim", "#E4D9C6", 0.55),
    "towerDark":mat("towerDark", "#2A2622", 0.45),
    "charcoal": mat("charcoal", "#1E1B18", 0.4),
    "glassDark":mat("glassDark", "#1B222B", 0.12, emis=0.22),  # lit interiors
    "orange":   mat("orange", "#E07A1F", 0.42),
    "orangeDeep":mat("orangeDeep", "#C3641A", 0.48),
    "glow":     mat("glow", "#FF9A3C", 0.4, emis=2.6),   # rim/portal light lines
    "amber":    mat("amber", "#FFB45C", 0.4, emis=3.2),  # signage glow
    "pupil":    mat("pupil", "#FFAA46", 0.3, emis=4.0),
    "signGlow": mat("signGlow", "#FFB042", 0.35, emis=9.0),
    "banana":   mat("banana", "#FFA028", 0.4, emis=1.3),
    "white":    mat("white", "#EDE8E0", 0.5, emis=0.35),
    "good":     mat("good", "#3FBF6F", 0.4, emis=1.6),
    "warn":     mat("warn", "#FFB020", 0.4, emis=1.6),
    "screen":   mat("screen", "#12100E", 0.25),
    "barLight": mat("barLight", "#CFC9BE", 0.5, emis=0.3),
    "city":     mat("city", "#2E3742", 0.6, emis=0.12),
    "cityFar":  mat("cityFar", "#3A4552", 0.6, emis=0.16),
    "cityWin":  mat("cityWin", "#FFC97E", 0.4, emis=1.4),
    "plant":    mat("plantX", "#5E9A44", 0.75),
    "plantD":   mat("plantDX", "#477A31", 0.75),
    "trunk":    mat("trunk", "#5E4430", 0.7),
    "tire":     mat("tire", "#15130F", 0.6),
    "muzzleM":  mat("muzzleM", "#F9A23F", 0.45),
    "eyeM":     mat("eyeMX", "#11100E", 0.2),
}

root = bpy.data.objects.new("APEWORKS_EXTERIOR_ROOT", None)
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

def grp(name, pos=(0, 0, 0), ry=0.0, parent=root):
    x, y, z = pos
    g = bpy.data.objects.new(name, None)
    g.location = (x, -z, y); g.rotation_euler = (0, 0, ry)
    sc.collection.objects.link(g); g.parent = parent
    return g

def wordmark(text, size, pos, material, name, align="CENTER", extrude=0.03, parent=root):
    x, y, z = pos
    bpy.ops.object.text_add(location=(x, -z, y))
    o = bpy.context.active_object; o.name = name
    o.data.body = text
    o.data.size = size
    o.data.extrude = extrude
    o.data.align_x = align
    o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    o.data.materials.append(material); o.parent = parent
    return o

def ape_mark(cx, cy, cz, s, parent=root, name="MARK"):
    g = grp(name + "_GRP", parent=parent)
    box(name + "_HEAD", (1.0*s, 0.82*s, 0.16*s), (cx, cy, cz), M["orange"], 0.05*s, parent=g)
    box(name + "_BROW", (0.9*s, 0.2*s, 0.2*s), (cx, cy + 0.22*s, cz + 0.02*s), M["orange"], 0.03*s, parent=g)
    box(name + "_EYE_L", (0.13*s, 0.16*s, 0.05*s), (cx - 0.22*s, cy + 0.06*s, cz + 0.08*s), M["eyeM"], parent=g)
    box(name + "_EYE_R", (0.13*s, 0.16*s, 0.05*s), (cx + 0.22*s, cy + 0.06*s, cz + 0.08*s), M["eyeM"], parent=g)
    box(name + "_MUZ", (0.52*s, 0.34*s, 0.14*s), (cx, cy - 0.2*s, cz + 0.06*s), M["muzzleM"], 0.04*s, parent=g)
    box(name + "_MOUTH", (0.3*s, 0.05*s, 0.04*s), (cx, cy - 0.3*s, cz + 0.14*s), M["orangeDeep"], parent=g)
    box(name + "_EAR_L", (0.16*s, 0.3*s, 0.14*s), (cx - 0.56*s, cy + 0.02*s, cz), M["orange"], 0.04*s, parent=g)
    box(name + "_EAR_R", (0.16*s, 0.3*s, 0.14*s), (cx + 0.56*s, cy + 0.02*s, cz), M["orange"], 0.04*s, parent=g)
    return g

def tree(name, pos, s=1.0, parent=root):
    x, y, z = pos
    cyl(name + "_TRUNK", 0.14*s, 1.5*s, (x, y + 0.75*s, z), M["trunk"], parent=parent, verts=16)
    ico(name + "_C1", 0.85*s, (x, y + 1.9*s, z), M["plant"], sub=2, parent=parent)
    ico(name + "_C2", 0.6*s, (x + 0.5*s, y + 2.35*s, z + 0.15*s), M["plantD"], sub=2, parent=parent)
    ico(name + "_C3", 0.5*s, (x - 0.5*s, y + 2.3*s, z - 0.2*s), M["plant"], sub=2, parent=parent)

TER = 0.75                      # terrace the building sits on

# ── ground: plaza + walkway + lawns ──────────────────────────────────────────
box("PLAZA", (160, 0.2, 160), (0, -0.1, 0), M["plaza"])
box("WALKWAY", (6.4, 0.24, 16), (0.8, -0.08, 15), M["path"], 0.03)
box("LAWN_L", (10, 0.26, 9), (-12.5, -0.06, 13.5), M["grass"], 0.05)
box("LAWN_R", (8, 0.26, 6), (10.5, -0.06, 15.5), M["grass"], 0.05)
box("LAWN_SIGN", (7, 0.26, 3.4), (8.6, -0.06, 9.6), M["grass"], 0.05)

# terrace platform under the whole building + glowing base rim on its front
box("TERRACE", (24, TER, 13.6), (1.4, TER/2, 0.4), M["creamDim"], 0.1)
box("TERRACE_GLOW", (23.6, 0.09, 0.1), (1.4, 0.22, 7.15), M["glow"])

# ── the HEAD building ────────────────────────────────────────────────────────
HW, HH, HD = 13.0, 11.0, 9.0    # width, height, depth
HZ = 4.5                        # front face z
box("HEAD_BODY", (HW, HH, HD), (0, TER + HH/2, 0), M["cream"], 1.2)

# face composition (per comp): sign owns the far-left of the facade, the
# muzzle rises center-right with the eye windows tucked either side of it
MX = 0.8                        # muzzle center x
# eye windows: dark rounded glass + glowing square pupil
for ex, side in ((-1.75, "L"), (3.5, "R")):
    box(f"EYE_{side}_GLASS", (2.6, 2.6, 0.5), (ex, TER + 7.75, HZ - 0.05), M["glassDark"], 0.6)
    box(f"EYE_{side}_PUPIL", (0.58, 0.58, 0.1), (ex, TER + 7.65, HZ + 0.24), M["pupil"], 0.06)

# muzzle: orange entrance tower + nose block with nostrils
box("MUZZLE_BASE", (4.8, 6.6, 1.9), (MX, TER + 3.3, HZ + 0.85), M["orange"], 0.5)
box("MUZZLE_NOSE", (3.4, 2.5, 2.4), (MX, TER + 7.5, HZ + 1.0), M["orange"], 0.35)
box("NOSTRIL_L", (0.6, 0.6, 0.12), (MX - 0.85, TER + 7.9, HZ + 2.22), M["eyeM"], 0.05)
box("NOSTRIL_R", (0.6, 0.6, 0.12), (MX + 0.85, TER + 7.9, HZ + 2.22), M["eyeM"], 0.05)

# entrance portal: recessed dark glass + glowing orange frame + canopy lip
PZ = HZ + 1.8                   # muzzle front face
box("PORTAL_GLASS", (2.9, 3.3, 0.18), (MX, TER + 1.75, PZ - 0.05), M["glassDark"], 0.08)
box("PORTAL_FRAME_L", (0.2, 3.7, 0.16), (MX - 1.62, TER + 1.9, PZ + 0.03), M["glow"], 0.04)
box("PORTAL_FRAME_R", (0.2, 3.7, 0.16), (MX + 1.62, TER + 1.9, PZ + 0.03), M["glow"], 0.04)
box("PORTAL_FRAME_T", (3.44, 0.2, 0.16), (MX, TER + 3.85, PZ + 0.03), M["glow"], 0.04)
box("PORTAL_DOOR_SEAM", (0.05, 3.1, 0.06), (MX, TER + 1.7, PZ + 0.06), M["charcoal"])

# entry steps: terrace down to the walkway
STEPS, RISE = 5, TER / 5
for i in range(STEPS):
    sy = TER - RISE * (i + 1)
    box(f"STEP_{i+1}", (7.4, RISE, 0.55), (MX, sy + RISE/2, 7.2 + 0.55 * i + 0.275), M["creamDim"], 0.03)
box("STEP_GLOW", (7.0, 0.05, 0.08), (MX, TER - 0.03, 7.18), M["glow"])

# left-face signage: APE AGENTS glow + tagline (embedded so the face bevel
# never swallows the letters)
wordmark("APE", 1.12, (-4.3, TER + 8.35, HZ - 0.05), M["signGlow"], "SIGN_APE", extrude=0.15)
wordmark("AGENTS", 0.48, (-4.55, TER + 7.55, HZ - 0.05), M["signGlow"], "SIGN_AGENTS", extrude=0.15)
for i, line in enumerate(("AUTONOMOUS", "PRODUCTIVE", "ELITE")):
    wordmark(line, 0.32, (-4.45, TER + 6.3 - i * 0.48, HZ - 0.05), M["charcoal"], f"SIGN_TAG_{i+1}", extrude=0.1)

# roof: parapet glow rims + greenery + banana mast
RT = TER + HH                   # roof top y
box("ROOF_RIM_F", (10.4, 0.09, 0.12), (0, RT + 0.04, HZ - 1.15), M["glow"])
box("ROOF_RIM_L", (0.12, 0.09, 6.4), (-HW/2 + 1.15, RT + 0.04, 0), M["glow"])
box("ROOF_HEDGE_1", (3.4, 0.5, 1.0), (-3.4, RT + 0.25, -0.6), M["plant"], 0.12)
box("ROOF_HEDGE_2", (2.2, 0.5, 1.0), (2.6, RT + 0.25, -1.4), M["plantD"], 0.12)
tree("ROOF_TREE_1", (-4.3, RT, -2.2), 0.55)
tree("ROOF_TREE_2", (3.8, RT, -2.6), 0.45)

# banana sculpture: lower half of a vertical torus (smile arc, tips up)
box("MAST_BASE", (1.6, 0.9, 1.6), (0.6, RT + 0.45, -1.0), M["towerDark"], 0.12)
cyl("MAST_POLE", 0.09, 1.6, (0.6, RT + 1.7, -1.0), M["charcoal"], verts=16)
bpy.ops.mesh.primitive_torus_add(major_radius=1.35, minor_radius=0.38,
                                 location=(0.6, 1.0, RT + 3.1),
                                 rotation=(math.radians(90), 0, 0),
                                 major_segments=48, minor_segments=24)
ban = bpy.context.active_object; ban.name = "BANANA"
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.6, 1.0, RT + 3.1 - 1.1))
cut = bpy.context.active_object; cut.scale = (4, 4, 2.2)
bpy.ops.object.transform_apply(scale=True)
bo = ban.modifiers.new("cut", "BOOLEAN"); bo.operation = "INTERSECT"; bo.object = cut
bpy.context.view_layer.objects.active = ban
bpy.ops.object.modifier_apply(modifier="cut")
bpy.data.objects.remove(cut, do_unlink=True)
ban.data.materials.append(M["banana"]); ban.parent = root
ico("BANANA_TIP_L", 0.38, (0.6 - 1.35, RT + 3.1, -1.0), M["banana"], sub=2)
ico("BANANA_TIP_R", 0.38, (0.6 + 1.35, RT + 3.1, -1.0), M["banana"], sub=2)
cyl("ANTENNA", 0.035, 1.5, (0.6, RT + 3.6, -1.0), M["charcoal"], verts=12)
ico("ANTENNA_TIP", 0.09, (0.6, RT + 4.4, -1.0), M["glow"], sub=1)

# ── the RIGHT WING tower: glass floors + dark "LET THE APES WORK." block ─────
TX, TWW, TWD = 8.6, 5.6, 7.0    # center x, width, depth
for f, fy in enumerate((0.0, 3.0)):
    y0 = TER + fy
    box(f"WING_SLAB_{f+1}", (TWW, 0.4, TWD), (TX, y0 + 0.2, 0), M["cream"], 0.18)
    box(f"WING_GLASS_{f+1}", (TWW - 0.5, 2.25, TWD - 0.5), (TX, y0 + 1.5, 0), M["glassDark"], 0.5)
    box(f"WING_RIM_{f+1}", (TWW - 0.3, 0.07, 0.1), (TX, y0 + 0.42, TWD/2 - 0.1), M["glow"])
    box(f"WING_PLANTER_{f+1}", (TWW - 1.6, 0.28, 0.5), (TX, y0 + 2.75, TWD/2 - 0.45), M["plantD"], 0.08)
box("WING_SLAB_3", (TWW, 0.4, TWD), (TX, TER + 6.0 + 0.2, 0), M["cream"], 0.18)
box("WING_TOP", (TWW, 4.6, TWD - 0.4), (TX, TER + 6.4 + 2.3, 0), M["towerDark"], 0.55)
box("WING_TOP_RIM", (TWW - 0.4, 0.09, 0.1), (TX, TER + 6.7, TWD/2 - 0.35), M["glow"])
for i, (line, m) in enumerate((("LET", M["white"]), ("THE", M["white"]),
                               ("APES", M["white"]), ("WORK.", M["amber"]))):
    wordmark(line, 0.62, (TX - 1.6, TER + 10.1 - i * 0.85, TWD/2 - 0.2), m, f"WING_TXT_{i+1}", align="LEFT")
box("WING_ROOF_HEDGE", (3.4, 0.45, 1.2), (TX, TER + 11.25, -1.2), M["plantD"], 0.1)

# ── plaza props ──────────────────────────────────────────────────────────────
# APE AGENTS HQ monolith sign (right of the walkway)
sg = grp("SIGN_HQ", (7.6, 0, 10.2), ry=-0.12)
box("SIGN_HQ_BODY", (4.6, 1.5, 0.5), (0, 0.95, 0), M["charcoal"], 0.1, parent=sg)
box("SIGN_HQ_GLOW", (4.7, 0.08, 0.4), (0, 0.16, 0), M["glow"], parent=sg)
ape_mark(-1.65, 0.95, 0.28, 0.55, parent=sg, name="SIGN_HQ_APE")
wordmark("APE AGENTS HQ", 0.4, (0.6, 0.82, 0.29), M["amber"], "SIGN_HQ_TXT", parent=sg)

# COMPANY STATUS board (left lawn, angled toward the approach)
sb = grp("STATUS_BOARD", (-11.6, 0, 8.2), ry=0.45)
for px in (-1.9, 1.9):
    cyl(f"SB_POST_{int(px)}", 0.09, 1.1, (px, 0.55, -0.1), M["charcoal"], parent=sb, verts=16)
box("SB_PANEL", (4.8, 3.1, 0.24), (0, 2.55, 0), M["charcoal"], 0.1, parent=sb)
box("SB_SCREEN", (4.4, 2.7, 0.06), (0, 2.55, 0.14), M["screen"], 0.04, parent=sb)
box("SB_TRIM", (4.9, 0.09, 0.2), (0, 4.15, 0), M["glow"], parent=sb)
wordmark("COMPANY STATUS", 0.26, (-2.0, 3.6, 0.18), M["white"], "SB_TITLE", align="LEFT", parent=sb)
for i, dm in enumerate((M["good"], M["good"], M["good"], M["warn"])):
    ry_ = 3.1 - i * 0.52
    ico(f"SB_DOT_{i+1}", 0.09, (-1.85, ry_, 0.18), dm, sub=1, parent=sb)
    box(f"SB_ROW_{i+1}", (3.1, 0.16, 0.04), (-0.1, ry_, 0.18), M["barLight"], parent=sb)

# walkway bollard lights
for i, bz in enumerate((9.6, 12.6, 15.6, 18.6)):
    for sx in (-1, 1):
        cyl(f"BOLLARD_{i}_{'L' if sx<0 else 'R'}", 0.09, 0.7, (0.8 + sx * 3.8, 0.35, bz), M["charcoal"], verts=16)
        box(f"BOLLARD_TIP_{i}_{'L' if sx<0 else 'R'}", (0.14, 0.1, 0.14), (0.8 + sx * 3.8, 0.75, bz), M["glow"], 0.03)

# delivery van (right side, branded flank toward the approach)
vn = grp("VAN", (14.0, 0, 9.5), ry=-0.45)
box("VAN_BODY", (4.5, 2.2, 2.2), (0, 1.45, 0), M["charcoal"], 0.28, parent=vn)
box("VAN_CAB", (1.1, 1.5, 2.0), (2.5, 1.05, 0), M["towerDark"], 0.22, parent=vn)
box("VAN_SHIELD", (0.5, 0.9, 1.7), (2.95, 1.65, 0), M["glassDark"], 0.12, parent=vn)
box("VAN_STRIPE", (4.3, 0.14, 0.06), (0, 1.0, 1.12), M["glow"], parent=vn)
ape_mark(-0.4, 1.75, 1.06, 0.75, parent=vn, name="VAN_APE")
for wx in (-1.4, 1.4):
    for wz in (-1.0, 1.0):
        w = cyl(f"VAN_WHEEL_{wx}_{wz}", 0.42, 0.3, (wx, 0.42, wz), M["tire"], parent=vn, verts=24)
        w.rotation_euler = (math.radians(90), 0, 0)
box("VAN_TAIL", (0.1, 0.5, 0.12), (-2.28, 1.5, 0.9), M["glow"], parent=vn)

# delivery drone + hanging INSIGHT PACKAGE crate (upper left)
dr = grp("DRONE", (-11.5, 10.5, 4.0), ry=0.3)
box("DRONE_BODY", (1.5, 0.5, 1.1), (0, 0, 0), M["charcoal"], 0.14, parent=dr)
box("DRONE_TOP", (0.8, 0.25, 0.7), (0, 0.35, 0), M["towerDark"], 0.08, parent=dr)
for ax in (-1, 1):
    for az in (-1, 1):
        box(f"DRONE_ARM_{ax}_{az}", (0.9, 0.1, 0.12), (ax * 0.95, 0.2, az * 0.7),
            M["charcoal"], 0.02, rot_y=ax * az * 0.5, parent=dr)
        cyl(f"DRONE_ROTOR_{ax}_{az}", 0.5, 0.05, (ax * 1.35, 0.32, az * 0.95), M["tire"], parent=dr, verts=24)
        box(f"DRONE_TIP_{ax}_{az}", (0.16, 0.06, 0.16), (ax * 1.35, 0.4, az * 0.95), M["glow"], parent=dr)
box("DRONE_CABLE", (0.04, 1.5, 0.04), (0, -1.0, 0), M["charcoal"], parent=dr)
box("CRATE", (1.5, 1.2, 1.2), (0, -2.35, 0), M["towerDark"], 0.08, parent=dr)
box("CRATE_BAND_1", (1.56, 0.12, 1.26), (0, -1.95, 0), M["orange"], parent=dr)
box("CRATE_BAND_2", (1.56, 0.12, 1.26), (0, -2.75, 0), M["orange"], parent=dr)
box("CRATE_LABEL", (0.9, 0.5, 0.05), (0, -2.35, 0.62), M["amber"], 0.02, parent=dr)

# trees + shrubs around the plaza
tree("TREE_L1", (-10.5, 0, 15.0), 1.5)
tree("TREE_L2", (-14.5, 0, 15.5), 1.2)
tree("TREE_R1", (12.5, 0, 14.5), 1.4)
tree("TREE_R2", (17.0, 0, 10.0), 1.1)
tree("TREE_BL", (-13.5, 0, -2.0), 1.6)
for i, (bx, bz) in enumerate(((-8.5, 8.6), (5.2, 8.4), (-6.2, 9.6), (12.2, 8.2))):
    ico(f"SHRUB_{i+1}", 0.55, (bx, 0.4, bz), M["plantD"] if i % 2 else M["plant"], sub=2, squash=0.8)

# ── dusk skyline backdrop ────────────────────────────────────────────────────
towers = ((-24, 3.2, 14, -22), (-19, 2.6, 19, -25), (-14, 3.6, 10, -21),
          (-8, 2.4, 16, -26), (-2, 3.0, 12, -24), (4, 2.6, 21, -27),
          (10, 3.4, 15, -22), (16, 2.4, 18, -25), (21, 3.0, 11, -21),
          (26, 2.6, 16, -24), (30, 3.4, 9, -20), (-29, 2.8, 12, -19))
for i, (tx, tw, th, tz) in enumerate(towers):
    m = M["city"] if i % 2 == 0 else M["cityFar"]
    box(f"SKY_TWR_{i+1}", (tw, th, tw * 0.9), (tx, th/2, tz), m, 0.08)
    if i % 3 == 0:
        box(f"SKY_WIN_{i+1}", (tw * 0.55, th * 0.5, 0.06), (tx, th * 0.55, tz + tw * 0.45 + 0.04), M["cityWin"])

# ── slot for a greeter ape at the door (app parents an agent here) ───────────
e = bpy.data.objects.new("AGENT_SLOT_DOOR", None)
e.location = (3.2, -6.7, TER); e.rotation_euler = (0, 0, -0.3)
e.empty_display_size = 0.2; sc.collection.objects.link(e); e.parent = root

# ── export GLB ───────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(GLB), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", export_yup=True,
                          export_apply=True, use_active_scene=True)
print("GLB WRITTEN", GLB, os.path.getsize(GLB), "bytes")

# ── approval render (dusk, comp-like front three-quarter) ────────────────────
sc.render.engine = "CYCLES"; sc.cycles.samples = 48; sc.cycles.use_denoising = True
sc.cycles.device = "CPU"
sc.render.resolution_x = 1280; sc.render.resolution_y = 880
sc.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = rgb("#39435C")
w.node_tree.nodes["Background"].inputs[1].default_value = 0.4
def area(name, pos3, power, size, color=(1,1,1), aim=(0, 6, 0)):
    x, y, z = pos3
    li = bpy.data.lights.new(name, "AREA"); li.energy = power; li.size = size; li.color = color
    o = bpy.data.objects.new(name, li); o.location = (x, -z, y)
    ax, ay, az = aim
    d = mathutils.Vector((ax - o.location.x, -az - o.location.y, ay - o.location.z))
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler(); sc.collection.objects.link(o)
area("sunset", (-26, 10, 24), 9500, 12, (1.0, 0.72, 0.5), aim=(0, 7, 0))      # low warm sun
area("skyfill", (8, 26, 22), 4200, 18, (0.72, 0.8, 1.0), aim=(0, 4, 0))       # cool sky fill
area("rim", (24, 14, -10), 3600, 8, (0.9, 0.95, 1.0), aim=(4, 8, 0))          # cool back rim
cam = bpy.data.cameras.new("cam"); cam.lens = 30
co = bpy.data.objects.new("cam", cam); co.location = (-7.5, -33.0, 6.4)
d = mathutils.Vector((1.8 - (-7.5), 0 - (-33.0), 6.8 - 6.4))
co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
sc.collection.objects.link(co); sc.camera = co
sc.render.filepath = os.path.join(S, "apeworks-exterior.png")
bpy.ops.render.render(write_still=True)
print("RENDER DONE")
