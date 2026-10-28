# AR-167 — Gallery benches

Date: 2026-10-28 · Branch: `feat/AR-167-improve-3d-experience` · Status: building step by step

## 1. Why

Mathias, an artist with a show in the gallery, told Eduardo the 3D rooms feel **too empty**. One answer is
what real galleries have: one or two simple benches in the middle of a room. Placed by the artist, at their
exact real size, baked with the room so they sit on the floor with real shadows.

Ghost visitors (see-through 3D people) were tried in the same ticket and **dropped**. Eduardo: "it's
terrible", "the effect looks cheap". Don't re-propose them.

## 2. What (Eduardo's decisions)

- **Four benches per room** (Eduardo, after seeing them: "quite small, we will need more of them per room"; they are at exact real size, the rooms are large): Paris and Madrid 4, Vienna 8 (2 rooms).
- **The artist picks the model** from two real benches, shown as **Odes** and **Black** (Eduardo dropped Maro and Ka: "the only ones acceptable"):
  plain short names ("do not over complicate").
- **Exact real size, fixed**: no resize, no scale. "This needs to be exact."
- **Baked with the room**: cast and receive shadows, take the room's bounced light.
- **No collision**: the visitor walks through them (camera at eye height glides over a ~45 cm bench).
- **No clamping**: sliders aren't limited to the room. If an artist pushes a bench into a wall, it's theirs
  to fix.

## 3. The Furniture panel (3D edit page)

Next to Lighting, Floor, Display Panels, etc. Per bench: **a toggle** (off by default), **a model picker**,
and **sliders to move it across, into the room, and turn it**. It mirrors the Display Panels panel
(`PanelsPanel`, `Panel/panelSettings.ts`: `enabled`, `x`, `z`, `rotationY`), grouped by room the same way,
with the same Save button.

- **Each bench picks its own model** (my call: Eduardo didn't answer either way). Switching to one model per
  show is a small change.
- **Persistence**: a JSON column on `Exhibition`, `benchSettings`, keyed by bench index (blocks of ten per
  room, like panels): `{ enabled, model, x, z, rotationY }`.
- **Visible to artists**, like Display Panels (Eduardo: "the artist will position them by hand").
- **Starting position** when switched on (my call): a 2 × 2 group around the room's centre (2.5 m across,
  2 m deep), long side along x.

## 4. Models

Sources in `public/assets/furniture/{odes,black}/` (raw downloads: never commit). **Nothing is uploaded to R2** (Eduardo): the GLBs stay local for now; where they're hosted for release is his call.

| Model | L × D × H | What | Source |
|---|---|---|---|
| Odes | 182 × 60 × 45 cm | ribbed sculpted wood, 37k tris | Design Connected OBJ (cm, Z-up) |
| Black | 191 × 52 × 45 cm | black metal U-slab, wood seat inlay, 324 tris | FBX 7.4 with full PBR maps; no real units |

- Design Connected models are real products, in centimeters, "accurately scaled": convert ×0.01 and nothing
  else. Their FBX files are FBX 6 (Blender can't import them), so use the OBJ.
- Black isn't a catalog product and its file has no units (14 m as stored): scaled uniformly to a 45 cm seat
  height (my call, pending Eduardo's real size).
- Verify every bounding box after conversion against the table.
- GLB: long side along x, feet at y = 0, centered. Textures ≤ 2K, compressed like the rooms' assets.
- Textures used as authored (physically based rule: no tints or gains).

## 5. Baking

- ⚠️ Don't add `benchSettings` to `LIGHT_FIELDS` as is: the fingerprint writes `null` for an absent field, which
  would stale **every** existing bake. Add it conditionally, only when a bench is on.
- Receivers: append a `benches` receiver **last** (`receivers.ts`), add it to `BakeSurface`/`BAKE_SURFACES`/
  `isMap` (`bakeRecord.ts`), the `prepareReceivers` flags (`storedBake.ts`), and `applyBake.ts` beside
  props/panels. It is the 6th near-field receiver: exactly the cap (`uLM0..uLM5`). Update the receiver lists in
  `e2e/bake-near-field.spec.ts` and `e2e/bake-save.spec.ts`.
- **Benches change the light**: `benchSettings` joins the fingerprint, with the same treatment as
  `PANELS_BAKED` / `showsPanels` in `fingerprint.ts`. A room with no bench on keeps its fingerprint and its
  bake. Adding, moving or switching a bench makes the bake out of date, as changing lamps does today.
- In the bake like the panels: casters automatically (the baker takes any visible mesh), and receivers with
  their own lightmap, patched with `LIGHTS_OFF` + lightmap in the baked look.
- In the edit page (realtime look) a bench shows without its baked shadow, like panels.
- ⚠️ The dev database is shared with staging. Bake a test exhibition, not a real artist's show, unless Eduardo
  says otherwise.

## 6. Order of work

1. ✅ The models at exact size in a room (test link `?bench=maro|ka|odes|black`).
2. ✅ **Furniture panel, trial** (Eduardo is still choosing models): the panel, Redux `benchSettings`,
   `Benches` rendering in every space. Editor only, nothing saved: no column, no API, no publish.
   Files: `editview/FurniturePanel/`, `scene/spaces/objects/Bench/{benchSettings.ts,Benches.tsx}`, mounted in
   `scene/Space.tsx`. Room centre = mean of the room's placeholders; benches start in a 2 × 2 group.
2b. ✅ **Saving** (Eduardo asked for Save to see the bake): `benchSettings Json?` column, PUT allowlist,
   edit + visit loaders, by-url snapshot branch, Save button. Fingerprint: enabled benches only, outside
   LIGHT_FIELDS (tests in `e2e/bake-fingerprint.spec.ts`). Benches cast in the bake automatically.
   ⏳ Needs Eduardo's DB step for the new column.
3. **Benches as receivers**: their own surfaces take the baked light (today they cast into the bake but
   stay realtime-lit themselves).

## 7. Constraints

- Every artwork image renders exactly as its file. Nothing alters it.
- Physically based room: no new lights, no ambient, no exposure change, no tints.
- Cost judged on the DPR line (`ScenePerfHud`), not fps.
- Existing exhibitions look and behave exactly as before while no bench is on.
- New `Exhibition` column: the prod schema must be synced before release (project rule). Schema changes are
  applied by Eduardo's own migration step, never by a command I choose.
- Testing follows the project rules (Playwright only; no WebGL in e2e).
- No new npm packages without Eduardo's OK.
