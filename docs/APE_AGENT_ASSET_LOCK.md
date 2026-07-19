# APE Agent — Master Asset Lock (v1)

`agent-platform/frontend/public/models/ape-agent-master.glb` is the **only approved
master character**. Approved and locked as v1.

- **3D source of truth:** `agent-platform/3d/ape_agent_master_build.py` — a
  deterministic Blender (bpy) build script. Running it regenerates the master GLB
  and a three-quarter approval render. Geometry changes happen ONLY here.
- **Checksum:** `docs/APE_AGENT_ASSET_HASH.txt` (SHA-256 of the GLB). Verify with
  `sha256sum agent-platform/frontend/public/models/ape-agent-master.glb`.
- **App loader:** `src/components/world/ApeAgentModel.tsx` via drei `useGLTF`.
- **Viewer / approval route:** `/dev/ape-glb` (side-by-side vs the approved
  reference `public/ape-reference.png`, Front / 3⁄4 / Side, 50% overlay).

## Rules

Do not recreate the ape procedurally in the app. Do not replace the GLB with a
similar asset. Do not edit individual mesh transforms inside the application.
Do not change the relative position, scale, or shape of any body part in-app.

The application may only:

1. Transform the root object (position / rotation / uniform scale / visibility).
2. Play approved animation clips.
3. Attach approved accessories to the named `SOCKET_*` empties baked into the GLB.
4. Switch between approved material variants.
5. Display status effects outside the character mesh.

Any geometry change requires: editing the Blender source script → regenerating the
GLB → new reference renders → visual approval → a new semantic version → updating
the checksum file.
