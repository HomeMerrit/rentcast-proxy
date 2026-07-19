# APE Agent — Master Asset Lock (v1.3)

`agent-platform/frontend/public/models/ape-agent-master.glb` is the **only approved
master character**. Approved and locked as v1; v1.1 adds the rig and the 12
approved animation clips with the rest-pose geometry unchanged.

## v1.3 — earned accessories (app-side, GLB unchanged)

Growth-earned gear built from primitives in the app (accessory rule); the GLB
and its checksum are untouched:

- **Headset** — earned at growth level 3 ("Skilled"): dark band + accent ear
  cups + mic boom over the ear blocks.
- **Crown** — earned at level 7 ("Legend"), replacing the headset: small gold
  square crown with corner spikes + accent gem, perched on the head top.
- Anchoring note: gear is anchored to the character root at the head's rest
  coordinates (like `StatusFx`), NOT parented to the head sockets — the baked
  head-socket runtime basis is distorted by the clip bake (rotated ~90° about
  X with a non-uniform pose scale), which shears rigid child geometry. The
  head stays near rest in every approved clip, so a root anchor reads clean.
- Gear only renders on standing/desk poses — the `Sit` clip lowers the head
  away from the anchor, so lounging apes take their gear off.

## v1.2 — agent kit variants (approved)

Geometry and the default look are unchanged. The torso mesh gains a second
material slot, `legs`, on the faces below the leg notch (baked in the same
body orange, so the plain mascot renders identically). Approved per-agent
variants the app may apply:

- **Accent vest** — tint the torso's `body` slot to the agent's accent color
  (`avatarHue`); fur, arms, hands, head stay brand orange.
- **Brown legs** — when (and only when) the vest is applied, the `legs` slot
  tints to brand dark `#B85712` so the legs read as fur, not kit.
- **Jersey prints** — chest crest + squad label and back number attach as
  planes to `SOCKET_CHEST` / `SOCKET_BACK` (accessory rule; they ride the
  spine bone).
- **Status glyphs** — `StatusFx` floats outside the character mesh (FX rule).

## v1.1 — rig + animation

- Rigid-piece armature (`APE_RIG`): `root → pelvis → spine → head`, arm chains
  `arm_upper_L/R → arm_lower_L/R → hand_L/R`, `leg_L/R`, plus `eye_L/R` helper
  bones for Blink. Every mesh is 100% weighted to exactly one bone — pieces move
  as rigid blocks, never bend.
- Baked clips (30 fps): `Idle`, `Blink`, `Walk`, `Sit`, `Stand`, `WorkingDesk`,
  `Thinking`, `Waiting`, `CompletedNod`, `ErrorLow`, `TurnLeft`, `TurnRight`.
  `Sit`, `Stand`, `CompletedNod`, `ErrorLow`, `TurnLeft`, `TurnRight` are
  one-shots (play once, hold); the rest loop.
- `SOCKET_*` empties are bone-parented, so accessories follow the animation.
- App playback: `ApeAgentModel` maps agent status → clip via drei
  `useAnimations` (idle→Idle, working→WorkingDesk, thinking→Thinking,
  waiting→Waiting, completed→CompletedNod, error→ErrorLow) with 0.2–0.25 s
  crossfades. `/dev/ape-glb` has a clip preview bar.

- **3D source of truth:** `agent-platform/3d/ape_agent_master_build.py` — a
  deterministic Blender (bpy) build script. Running it regenerates the master GLB
  and a three-quarter approval render. Geometry changes happen ONLY here.
- **Checksum:** `docs/APE_AGENT_ASSET_HASH.txt` (SHA-256 of the GLB). Verify with
  `sha256sum agent-platform/frontend/public/models/ape-agent-master.glb`.
- **App loader:** `src/components/world/ApeAgentModel.tsx` via drei `useGLTF`.
- **Viewer / approval route:** `/dev/ape-glb` (side-by-side vs the approved
  reference `public/ape-reference.png`, Front / 3⁄4 / Side, 50% overlay).

## Environment assets (same lock discipline)

Environments follow the same pipeline as the character: a deterministic Blender
source script owns all appearance; the app only loads the GLB, lights it, and
parents interactive things to the baked `AGENT_SLOT_*` empties.

- **APEWORKS HQ room** — source `agent-platform/3d/apeworks_room_build.py` →
  `public/models/apeworks-room.glb`. 5 agent slots per floor max
  (`AGENT_SLOT_1..5`, slot 4 is the pouf/Sit slot, slot 5 is the mezzanine).
  Loader `ApeworksShell.tsx`; used by `WorkspaceRoom` (`/dev/workspace`).
- **APE AGENTS HQ exterior** — source `agent-platform/3d/apeworks_exterior_build.py` →
  `public/models/apeworks-exterior.glb`. The building is the mascot: cream head
  mass with eye windows + glowing pupils, orange muzzle entrance tower with
  portal + steps, glowing `APE AGENTS` facade sign, banana sculpture + antenna,
  dark `LET THE APES WORK.` wing, plaza (monolith HQ sign, company-status board,
  bollards, trees), delivery drone + branded van, dusk skyline. One baked slot,
  `AGENT_SLOT_DOOR`, for the greeter ape. Loader/scene
  `ApeworksExteriorScene.tsx`; approval route `/dev/exterior`; approval render
  `agent-platform/3d/apeworks-exterior.png`.

Both GLBs are checksummed in `docs/APE_AGENT_ASSET_HASH.txt` and change only via
their Blender source → regenerate → render → approval → checksum update.

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
