# 3D spaces playbook: adding or re-exporting a baked space

Use this when a new exhibition space comes out of Blender, or when an existing one (Madrid, Paris,
Vienna) is re-exported. It covers what to author, what must never change, how the space is wired
into the code, how its light is calibrated, and how we know it's done.

The look is AR-161's baked, physically based light, which Eduardo approved for all four reference
exhibitions on 2026-10-19 (Vivrière, Permanence, Kritzendorf, Florescere). The binding product
rules are in `docs/superpowers/specs/2026-10-17-ar161-baked-lighting-design.md`. Where this doc
and the spec disagree, the code wins; the known differences are listed in §9.

---

## 1. What a "space" is, and what it owns

A **space** is a room model (one GLB) plus the light and look values that come with it. An
**exhibition** is one artist's show hung in a space. Many exhibitions share a space.

> "Dedicated tweaks per space: yes, dedicated tweaks by exhibition: no." — Eduardo, 2026-10-17

| Owned by the **space** (one sweet spot for every exhibition hung in it) | Owned by the **exhibition** (the artist, in the editor) |
|---|---|
| Geometry, fixtures, windows, placeholders (the GLB) | Wall paint color |
| Lamp ratings, corridor rule, track scale | Decoration: display panels and their colors, window-frame and radiator colors |
| Daylight gain, sun (lux, elevation, azimuth), window glass color and brightness | Dimming the ceiling lamps and the track lamps (50–100%, slider 2–4) |
| Ceiling color, paint and plastic reflectances | Moving, rotating and switching off track lamps |
| Lamp colors, track beam angle, track body color, eye height and FOV | The lighting set (`ceilingLightMode`), which is hidden in baked spaces: each space has one calibrated set |
| The fixed camera: exposure and white balance | |
| The floor: **one common floor for every room of every space** (`COMMON_FLOOR`) | |

**Two rules sit above everything else:**

1. **Artwork images show exactly their file.** No light, exposure, white balance, tone curve or
   glow touches the image, even when it then doesn't match the room ("artists will look at this
   first"). Mats, frames, text cards and walls stay physically lit.
2. **Physically based, never biased.** That means no ambient fill, no invisible lights, no tints
   and no gains, and **never raise exposure**. A dim room gets more or stronger real fixtures.
   Bloom stays on, as a subtle glow.

---

## 2. Blender: what to author and what not to break

Blender now owns **geometry only**. Light comes from fixtures the code turns into lamps, and it is
baked in the admin's browser. Don't bake lighting in Blender, and don't rely on Blender lights or
emission: the scene never mounts them.

### 2.1 Node names the code relies on

Indices are `0…N`, numbered without `.001` suffixes. Gaps are tolerated, but don't create them.

| Node(s) | What the code does with it |
|---|---|
| `wall0` | **All walls in one mesh.** The bake's wall receiver, the corridor ray tests and the collision. Rendered with its **position only**, so apply rotation and scale. |
| `ceiling0` | The ceiling receiver (one mesh, position only, so apply transforms). |
| `floor0` | Hidden. Only its **bounding box** counts: the rendered and baked floor is a flat plane the code builds over that box, carrying the common floor. |
| `placeholder{i}` | Hangable surfaces. An artwork stores the placeholder's **name** (`wallId`) and its own **world** position. Paris and Madrid hard-code 4. New spaces must count them from the model (`countNodes`, as Vienna does). |
| `panel{i}`, `panelFront{i}`, `panelBack{i}` | Display panels, numbered in blocks of ten per room. See `docs/display-panels.md`. |
| `windowGlass{i}` | Daylight emitter **and** the sun's portal. Must be a flat, vertical rectangle aligned to the x or z axis: the code takes the thinnest horizontal axis of its bounding box as the window's normal. |
| `windowLight{i}` | Sky panel. When it sits within 3 m of a `windowGlass`, it is that window's sky (drawn, not an emitter). With no glass nearby, it is a light well that emits itself. It never casts a shadow. |
| `windowFrame{i}`, `windowHandle{i}`, `radiator{i}`, `singleSocket{i}`, `doubleSwitch{i}` | Fixtures. Auto-unwrapped into one shared lightmap atlas. Their bounce albedo is the average of their material colors. |
| `trackLampArm{i}` → `trackLampBody{i}` → `trackLampBulb{i}` | A track lamp, as a parent chain. In scripts, move only the root. |
| `recessedLampBody{i}` → `recessedLampBulb{i}` | A recessed downlight. Baked as a 90° diffuser at the space's rating. |
| `roundLampBody{i}` → `roundLampBulb{i}` | A round plafond lamp (Madrid's only fixture). Also a 90° diffuser. |
| `room{n}`, or an Empty whose name ends in `Room{n}` | Room membership for multi-room light culling, and the per-room editor sections. Parent lamps, placeholders and panels under it. |
| `initialPoint0` | Spawn point: the position, plus a facing taken from the plane's face normal **negated**. |
| `invisibleWall0` | Collision barrier, and also the exit trigger. |
| `leftExit0` (Paris, Madrid) or `exit0` (Vienna), and `continue0` | Exit and wayfinding signs. The sign's name is passed per space. |

The code creates its own names at runtime: `artworkImage`, `artworkDisplay`, `textCard`, `floor`
and `ceiling`. Don't author these.

**Names that change the bake:**
- Anything whose own name, or any parent's name, contains `lamp` or `bulb` casts **no shadow**,
  and neither does anything named `glass` or `windowLight{i}`. Never give architecture such a name.
- Every call site that reads `initialPoint0`, `invisibleWall0`, `exit0`/`leftExit0` and `continue0`
  is **null-guarded**. If one is missing, the scene loads without an error but has no spawn point,
  no wall and no exit. Only a node diff catches this.

### 2.2 What must never move once the space is live

- **`placeholder*`**: no change to name, position, rotation or scale. Moving one leaves the hung
  works where they were while the wall walks away. Renaming one orphans them.
- **The wall surfaces that works hang on**, plus `floor0` and `ceiling0`, because the works are
  pinned in world space.
- **Panel numbering**, for the same reason.
- Lock placeholders in Blender (`lock_location/rotation/scale`). Locks stop Object-Mode drags only,
  not Edit-Mode edits, renames or deletion.

Everything else can change freely: fixtures, the ceiling height, more lamps, new openings. Eduardo
may change geometry as long as the placeholders stay. A new model version makes every bake in the
space stale on its own (§3.3).

### 2.3 Geometry pitfalls that already bit us

| Pitfall | Why it matters to the bake | What to do |
|---|---|---|
| **Single-plane walls and ceiling** (no thickness) | Both faces share the same lightmap texels, so light behind a wall shows on its front | Close the model: leave no lit, hidden area behind a hanging wall. The sun is one-sided (room-center rule). |
| Works or frames within **~3 cm** of a single-plane wall | The bounce lights' 3 cm bias lets light from behind leak through (an open window's sky panel lit the works beside it) | Keep emitters, sky panels and sunlit floor away from the back of a hanging wall |
| Frames **0.5–2.5 cm** off the wall | A blanket shadow bias swallowed their shadows | Fixed: a texel-scaled fine bias. Check the stand-off per wall with `framedepth.mjs`. |
| **Floor or ceiling rectangles reaching outside the rooms** (Vienna: one 30 × 36 m quad) | The ceiling outside room 2's window wall shadowed every sun ray, and the ceiling median meter reading becomes meaningless (Vienna: 16 lx) | The sun ignores casters more than 0.5 m outside the glass. Keep the wall plus reveal outside the glass under 0.5 m (Paris and Vienna are ~0.32 m). Better: keep `floor0`/`ceiling0` within the building. |
| **Sky panels behind windows** (`windowLight0` is 2 m out and larger than the hole) | As a shadow caster it blocked the sun entirely. As an emitter it double-counted the glass. | Handled by name: never a caster, and it counts as the window's sky when within 3 m of glass |
| **Open model edges** | The sun got in sideways onto hidden floor, and the bounce leaked through a single-plane wall ("warm blob on the wrong wall") | Close the shell. The sun now enters only through the glass rectangle (portal). |
| **Wall UV charts touching** | Bilinear bleed: bright slivers, edge lines, corner smudges | The bake ignores Blender UVs on walls and ceiling: we use our own unwrap with 3-texel gaps. Blender UVs on `wall0`/`ceiling0` matter only for today's realtime look (§4, last row). |
| Floor UVs | Not used by the bake: the floor is a code-generated plane with clean 0–1 UVs | No action needed |
| **Room Empties off the origin** | `<primitive>` drops the Empty, so a family rendered 21 m out (Vienna room B) | Handled by `bakeWorldTransforms`. Recessed lamps use `worldMatrixOf`; `getWorldPosition` put Vienna's recessed spotlights at 2× height. ⚠️ `RoundLamp` still uses `getWorldPosition`, so check it before a multi-room space uses round lamps. |
| **Excluded collections** (Blender scripting) | `matrix_world` stays at identity (floor reads z 0..0, lamps read negative z) | Un-exclude the collection, or read `matrix_basis`/`location` |
| **Export drops nodes** | Hiding a collection plus "visible objects only" dropped `initialPoint0`, `invisibleWall0`, `exit0` and `continue0` | Export every collection, then run the diff in §2.4 |
| 97% of the triangles are lamps | Not a frame-rate problem. Cost is pixels × realtime lights. | Don't decimate for performance. Multi-room spaces need light culling (§4). |

### 2.4 After every export: the diff

Compare the new GLB against the **previous** one by parsing the JSON chunk: bytes 20 onwards, with
the chunk length at byte 12. Check:
1. **Node names both ways.** Old → new catches losses; new → old catches renames, because a rename
   shows up as one loss plus one addition.
2. **Placeholder translation, rotation and scale.** Expect 0 changes in a live space.
3. **Counts:** lamps per family and per room, windows and glass, `initialPoint0`, `invisibleWall0`,
   and the exit and continue signs.
4. **Room Empty translations.**

Run `node .superpowers/tools/ar161-measure/glbdiff.mjs <old.glb> <new.glb>`. It prints node names
lost and added, per-family counts, `extensionsUsed`, and every changed transform, with the
must-not-move nodes (placeholders, rooms, spawn, barrier, exits, wall/ceiling/floor) listed
separately. It exits 1 when a node is lost, a must-not-move node moved, or the file is quantized.
paris21 → paris22 showed `windowLight1` added and `initialPoint0`/`invisibleWall0` moved: intended,
but confirm it with Eduardo every time.

---

## 3. Shipping the model

### 3.1 Compress safely: meshopt FILTER, **never quantize**

The `gltf-transform meshopt` CLI **always quantizes**. Quantizing bakes a ~10.5× compensating
scale into every node, while the spaces read **position only**. Walls and ceiling then vanish
(they render blank white), and `placeholder*` scale changes, which relocates the hung art. Use the
SDK without quantize; every package needed is already installed:

```js
// the full script: .superpowers/tools/ar161-measure/make-noq-glb.mjs (createRequire on package.json)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(src)            // await MeshoptEncoder.ready / MeshoptDecoder.ready first
doc.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER })
await io.write(out, doc)
```

Then diff the original against `_noq`. Node count, names, translation, rotation and scale must
have **0 mismatches**, and `extensionsUsed` must be `EXT_meshopt_compression` only (no
`KHR_mesh_quantization`). The result for paris22 was 5.20 → 2.07 MB.

⚠️ FILTER is lossy too, on normals and positions. Paris's baked views move 2–6 levels on 1–7% of
pixels compared with the uncompressed GLB. The meters are equal and the images are still
file-exact. **Eduardo accepted `_noq` for Paris on 2026-10-20** (bake and visitors use the same
geometry, so the room is self-consistent; −3.1 MB per visit). Re-bake after switching a space to
its `_noq` file. Today Vienna ships uncompressed (`vienna14.glb?v=1`).

### 3.2 Name, test locally, upload

1. **Never reuse a file name.** The HTTP cache and drei's GLTF cache both key on the URL, R2 sets
   one-year `immutable` caching, and the upload script skips an object whose remote size already
   matches. Use `<space>NN.glb`, then `<space>NN_noq.glb`, or bump `?v=N`.
2. **Test before uploading.** Put the file in `public/assets/spaces/<space>/`, add its exact path
   to `NEXT_PUBLIC_LOCAL_ASSETS` in `.env.local` (dev only), restart the dev server (:3001), and
   tick DevTools "Disable cache".
3. **Upload** with
   `npx dotenv -e .env.local -- npx tsx scripts/upload-3d-assets.ts --only=spaces/<space>/<file> --dry-run`,
   then run it again without `--dry-run`. Always restrict with `--only`: unrestricted, it uploads
   every local file whose size differs. Check with a `HEAD` on
   `https://assets.theartroom.gallery/app/assets/spaces/<space>/<file>`: expect 200, the right
   size, and `model/gltf-binary`.
4. **Never push code that points at a file that isn't on R2.** That caused the AR-127 outage and
   the 2026-09-20 Vienna 404. GLBs fall back to the app origin (`spaceGltfUrl`: one HEAD probe,
   then `public/`). Floor, plaster and space textures have **no** fallback.
5. `*.glb` files are gitignored. `public/assets/materials/` is untracked and *not* ignored, so
   stage commits by explicit path and never commit `public/` images.
6. Reads and writes to R2 fail independently, and Spanish ISPs block Cloudflare on La Liga days.
   Test both before concluding "R2 is down".

### 3.3 The model version: bakes go stale on their own

- `spaceGltfPaths` in `src/lib/bake/spaceModelVersion.ts` is the **one place** a space's model path
  lives. The bare path string, including any `?v=`, *is* the model version, and it is part of
  every bake fingerprint. Changing it makes every draft bake in the space **stale**: the editor
  says "The room changed since the last bake", and publishing refuses with `BAKE_STALE`.
- A published bake also carries an **unwrap hash** plus tolerant uv statistics for browsers that
  differ by one ulp. If the new geometry changes the wall, ceiling, floor or fixture unwrap, a
  visitor's browser rejects the old bake and shows **today's unbaked look** rather than a
  misaligned one. So before shipping a new model of a live space, plan to re-bake, review and
  republish every exhibition in it.

---

## 4. Wiring a new space in code, in order

| # | Where | What |
|---|---|---|
| 1 | `src/lib/bake/spaceModelVersion.ts` | Add `spaceGltfPaths.<space>` (the bare path). |
| 2 | `src/components/scene/constants.tsx` | Add the key to `SpaceKey`, a `spaceConfigs` entry (`displayName`, `gltfPath`, `camera`, `look` from `spaceLooks`) and a `spaceComponents` dynamic import. |
| 3 | `src/components/scene/spaces/<Name>Space/` | Copy `ViennaSpace` for a multi-room space or `ParisSpace` for a single room. It **must render `<Lights />`, and that lights index must mount `<RoomBake />`**. Root cause #1: Madrid's own `lights/index.tsx` didn't, so Madrid never baked. Paris and Madrid each have a `lights/index.tsx`; Vienna imports Paris's. Also render `<Effects enabled />`, `wall0` through `Wall`, `ceiling0` through `Ceiling`, `floor0` → `ReflectiveFloor`, `Windows`, `Radiator`, the lamp components of the calibrated set, `Switch`, `SingleSocket`, placeholders counted from the model, the exit sign (with its node name), `invisibleWall0`, panels, `ExitTrigger`, `initialPoint0` and `ArtObjects`. For room-parented families, call `groupNodesByRoom` **first** and then `bakeWorldTransforms`. |
| 4 | `src/config/spaceConfig.ts` | Features: `hasTrackLamps`, `hasRecessedLamps`, `hasLamps`, `trackLampOffsetAxes`. Add `alwaysLitLamps` for lamps in a corridor that **connects** rooms, listing **both** numberings (`recessedLampBody` and `roundLampBody`), or the exemption covers only one lighting set. |
| 5 | Multi-room culling | `useActiveRoom` switches off the lights of rooms you aren't in. Culling is proven necessary: 60 → 45 fps without it. The bake must still see **every** room's lamps: `BakeWait` calls `setBakeAllRooms(true)` for a few frames and `useActiveRoom` honors it. This is automatic as long as every lamp component goes through `useActiveRoom`. Verify that `[AR-161 bake]` `lamps` equals all rooms' lamps (Vienna: 22 → 42 once fixed). |
| 6 | `src/lib/bake/spaceLooks.ts` | Add `{ camera, look }`. Start from `PARIS_VIENNA` (recessed + track) or `MADRID` (round lamps only), with a provisional camera copied from the closest space. `bakeCamera()` throws for a space without one. Calibrate this entry in §5. |
| 7 | `src/lib/bake/bakedSpaces.ts` | Add the space to `BAKED_SPACES`. Bake mode refuses spaces outside it. In production this set is the switch for the Bake button, the bake preview link, the publish gate, and hiding the editor controls the space owns (`isBakedSpace` in `LightingPanel`, `WallCeilingPanel`, `FloorPanel` and `Menu`). **Don't release the branch until Eduardo approves the look.** |
| 8 | `src/components/dashboard/constants.ts` **and** `src/components/user/dashboard/constants.ts` | The space pickers for admins and artists. Keep the two lists identical. Add the space only once its assets are on R2 and its look is approved. |
| 9 | `scripts/reset-light-levels.ts` | Reads `BAKED_SPACES`. Its `CALIBRATED_SET` is `track-plafond`; if the new space is calibrated on another set, adjust the warning. |
| 10 | ⚠️ Open decision: today's look | The editor's realtime preview and the fallback for a failed bake render "today's look". In the three existing spaces that look still uses the old **Blender-baked** wall and ceiling textures (`bw2`/`bc2`, `mwall2`/`mceiling2`, `bgw1`/`bgc1` `.ktx2`), which also serve as the provisional surface under the loader. A new space has none. Decide with Eduardo before building: either one Blender bake for the editor preview only, or plain paint under realtime lamps in today's look. |

Run `pnpm typecheck`, and before any push `pnpm build && pnpm start -p 3001`. Use the dev DB only.

---

## 5. Calibration, step by step

Work on the **dev DB**, with the dev server on :3001. Bake headless or in a browser that is in
front, with the display awake: the bake only advances on `requestAnimationFrame`, and a sleeping
Mac stalls it. Run one headless bake at a time. Make **one change per step**, and give Eduardo
live links so he picks by eye.

### 5.1 Values a space owns, and how to choose them physically

| Value (`SpaceLook`) | Paris / Vienna | Madrid | How to choose |
|---|---|---|---|
| `recessedLumens` | 17,000 (6,800 → 10,000 on 2026-10-20/21, → 17,000 on 2026-10-21) | 3,000 (no recessed lamps) | Real fixture ratings. A dim room gets **more or stronger fixtures**, never exposure. Paris at 6,800 read "nice, but pretty dark still" (Eduardo, 2026-10-20): its on-screen walls were ≈ 118 against Madrid's 146, and the downlights give only ≈ 60% of the wall light (track lamps and the sun give the rest), so 10,000 lm aims at about Madrid's brightness. Vienna followed (2026-10-21): near-white walls and white passepartouts lit mostly by bounce read brownish-grey. Then both went to 1.7× (17,000 lm, track ×0.85): the fixed camera shows white only under ~340 lx, and an artist must be able to show a white passepartout as white (Eduardo). Solve from a measured linear model: Paris gave wall ≈ 17 lx per 1,000 lm recessed + 34 lx per track unit, and art ≈ 23 + 17.7 per 1,000 lm + 114 per track unit. |
| `corridorLumens` | 3,000 | — (no rule) | Circulation keeps standard fixtures. A corridor is any spot where the free span across x or z at eye height is < 6 m (`zones.ts`). The corridor lamps follow the ceiling-lamp dimmer. |
| `roundLumens` | 3,000 | 3,000 | Opal plafond diffuser |
| `trackScale` | 0.85 (0.5 until 2026-10-21) | 0.5 (inert) | 0.5 put art near the museum level (~200 lx) at slider 4; ×1.7 since 2026-10-21, with the downlights, so whites read white at the fixed camera |
| `sunLux` / `sunElevationDeg` / `sunAzimuthDeg` | 5,000 / 35 / 360 (straight in) | same | A hazy sun through the glass only. At 40,000 lx, the bounce off the sun patch hijacked the camera (exposure 0.19); at 10,000 lx, the patch on the nearest work set the camera. |
| `daylightGain` | 6 | 6 | Eduardo's pick of 25 / 12 / 6. The glass emits `windowIntensity × 0.3 × gain` = 4.2 × 0.3 × 6 = **7.56**. |
| `windowColor` / `windowIntensity` | `#f5fbff` / 4.2 | `#f2f2f2` / 4.2 | Taken from the reference exhibition's stored values |
| `ceilingColor` | `#ffffff` | `#ffffff` | White, with albedo 0.85. A cream ceiling plus the floor's bounce read as sepia. |
| `paintReflectance` / `plasticReflectance` | 0.9 / 0.85 | same | White paint and switch plastic. The authored `#d8d8d8` only looked white under the old ×1.5 ambient tint. |
| `lampColor`, `trackLampColor`, `trackLampAngle`, `trackBodyColor` | `#ffffff`, `#fffeeb`, 0.8 rad, `#ffffff` | `#ffffff`, `#ffffff`, 0.45, `#ffffff` (inert) | Taken from the reference exhibition (Paris: Permanence) |
| `cameraFOV` / `cameraElevation` | 50 / 1.6 m | same | |
| `floor` | `COMMON_FLOOR` | same | **Not a per-space choice.** The floor is `parquet-whitewash` (albedo 0.40, R/B 1.37), scale 2.07, offset y 0.04, normal ×1, roughness 1, temperature 1 (beige, the warmest tint, 2026-10-21: R/B ×1.32). Every wood texture is orange in linear light (R/B 2.6–5.1), which painted the whole room beige-brown. The boards' size and placement are the artist's since AR-163 (`bakedFloorTiling`). |

**Also fixed, and the same in every space** (constants in `LightBaker.ts` and `bakeShaders.ts`):
- Lamps: exact-cosine diffusers, a 1,024 cube shadow map for wide lamps, and a fine shadow bias.
- Bounce: 4,096 jittered VPLs × 8 bounces accumulated in float32, plus the radiosity tail.
- 4,096 daylight VPLs, full-resolution coverage-normalized bounce, and 256-spp near-field corner
  rays.
- Seed `0x161`, restarted every bake.
- Plaster maps (0.7 m tile) on walls and ceiling.
- Bloom 0.6 above threshold 2.0.
- No ambient light, and the room itself as the environment.

There is **no** glare flag any more: the window glow is just bloom on the bright glass, at Madrid's
approved strength. The lighting set is one per space: Paris and Vienna use `track-plafond`, and
Madrid uses round lamps.

### 5.2 The procedure

1. **Reference exhibition.** Choose a real, representative show with delicate light prints if
   possible. The references so far: Paris ← *The Beauty of Permanence* (Kritzendorf validated it),
   Vienna ← *Florescere*, Madrid ← *Vivrière*. Copy real shows read-only from prod into the dev DB
   (`arcopy-manifest.json` / `arcopy-delete.mjs` in the tools folder).
2. **Reset levels** (`scripts/reset-light-levels.ts`: dry run, then `--apply`). Both dimmers go
   to 4, because levels are part of the fingerprint.
3. **Bake** as admin with `…/visit?bake=1`. The page moves on to `?review=1` by itself. In the dev
   console, read:
   - `[AR-161 meter]`: `artPeakLux`, `wallMedianLux`, `ceilingMedianLux`, `bounceLux`,
     `artToWall`, `paperWhite`, `meteredExposure` and `whiteBalance`;
   - `[AR-161 sun]`: `windows` must equal the glass count;
   - `[AR-161 corridor]` lamps, `[AR-161 bake]` lamps (every room), and `[AR-161 wall atlas]`.
4. **Adjust physically, one value per step.** Use fixtures and ratings first (in Blender, or
   `recessedLumens`/`trackScale`), then the sun, then surface reflectances. Never touch exposure
   to brighten.
5. **Freeze the camera.** Once Eduardo approves the look, copy the reference bake's
   `meteredExposure` and `whiteBalance` into `spaceLooks.<space>.camera`. The meter is
   diagnostics only: it puts the brightest work's paper white at 0.76, the top of Khronos
   Neutral's identity range, and **only ever stops down**, so exposure is ≤ 1. Madrid overrode
   it: metered 0.435 was set by 2–3 sun-lit works and darkened the room by ~11%, so 0.56 keeps the
   approved room brightness. Images are file-exact either way. Changing the camera changes
   `spaceLookVersion`, so **re-bake after freezing**.
6. **Prove determinism.** Bake the same exhibition twice: the meter lines must be identical, with
   0 differing pixels (`detcheck.sh` method).
7. **Sweep every exhibition in the space** with the same settings (§5.4), then give Eduardo the
   review links.

### 5.3 Acceptance: Eduardo's four rules, plus the measurements

| Rule (Eduardo, 2026-10-19) | Measured by |
|---|---|
| 1. A little, really subtle window glow, the same as Madrid's approved | `bloomcheck.mjs`: glow mean/max levels. Madrid 5.3/128 is the reference; Permanence 3.5/83, Vienna 5.1/89. |
| 2. Sun patches on the floor | `windows` count in `[AR-161 sun]`; window and top-down views |
| 3. Enough soft light, no black junctures | Junction column profile (`shoot19.mjs`, `JUNCTION=…`): no crisp 1-texel line and a smooth dip (ground truth is ≈ −30% at a wall–ceiling corner). Corner views. |
| 4. Images never altered | `sweep.mjs`: **every** artwork against its file. Expect N/N file-exact, MAE median ≈ 1–3 levels. `sampling.mjs` for fine-grain B&W. |

Also:
- `artToWall` ≈ 1.3–1.8.
- Mats, cards and walls neutral, with no warm cast (`cardcheck.mjs`).
- No window-frame blotches.
- The admin review render matches what visitors get.

### 5.4 Approved reference numbers

These come from the Task 19 baselines on the dev copies. The Paris rows were measured with 6,800 lm
downlights; re-read them from the `[AR-161 meter]` line of the first 10,000 lm bake.

| Space | Reference | Camera exposure | White balance [r, g, b] | Metered | Meter: art peak / wall / ceiling (lx) | Art/wall | Paper white | Images |
|---|---|---|---|---|---|---|---|---|
| Paris | Permanence | **0.524** | **[0.933, 1.01, 1.135]** | 0.526 | 380 / 226 / 146 (bounce 161) | 1.68 | 0.757 | 26/26 |
| Paris | Kritzendorf (same camera) | 0.524 | (space) | 0.507 | 394 / 236 / 154 | 1.67 | 0.785 | 40/40 |
| Vienna | Florescere | **0.588** | **[0.916, 1.014, 1.153]** | 0.586 | 341 / 145 / 16\* (bounce 100) | — | — | 50/50 |
| Madrid | Vivrière | **0.56** | **[0.92, 1.015, 1.126]** | 0.435 | 460 / 261 / 185 (bounce 189) | 1.76 | 0.979 | 34/34 |

\*Vienna's ceiling median is an artifact: the ceiling rectangle extends outside the rooms.

Headless bake times: Madrid ~45 s, Paris ~2 min, Vienna ~2.5 min. Download size of a stored bake
(16-bit log PNGs): Paris 15.4 MB, Vienna 22.0 MB, Madrid 16.6 MB.

---

## 6. Once a space is live: the admin flow

1. **Run the reset script** once at rollout, before baking. It writes only the two dimmers.
2. **Bake.** In the 3D editor, open the **Baked lighting** menu entry and click **Bake**. This is admin only, and needs WebGL2
   with `EXT_color_buffer_float` and `EXT_float_blend`. The monogram loader runs, the maps upload
   straight from the browser to R2 under new file names, and the draft bake is saved. If anything
   fails, nothing partial is saved.
3. **Review: "View baked room"** (`?review=1`) shows exactly what visitors will see. Opening it
   stamps the bake as reviewed.
4. **Publish** from the dashboard. The server refuses with `BAKE_REQUIRED`, `BAKE_STALE` or
   `BAKE_UNREVIEWED`.
5. **Bake preview link** (dashboard: "Enable/Copy bake preview link"): the latest saved draft plus
   the latest bake, for unpublished **and** live shows.
   - If anything in the fingerprint changed after the bake, it shows "This preview is out of
     date — a new bake is needed".
   - Publishing clears the link; re-enable it when needed.

**Out-of-date rule:** the fingerprint covers whatever the artist may still change (walls, dimmers,
track lamps, panels, frame and radiator colors, placements), plus the baker version, the model
version and the space's look version. Any change means bake again.

**Display panels are baked** (AR-163, 2026-10-21), like the walls, on their own atlas
(`panels-light.png`). Before that they were lit in realtime, and changed brightness as the visitor
walked: Vienna's per-room lamp culling and the room capture's bounce both followed the visitor. A
room that shows a panel carries a marker in its fingerprint, so its older bakes read "out of date";
until it is baked again, its stored bake still applies, with the panels in realtime as before.

---

## 7. Things we learned the hard way

| Symptom | Cause | Fix (now built in unless noted) |
|---|---|---|
| A space never bakes | Its `lights/index.tsx` didn't mount the bake | Every lights index mounts `<RoomBake />` |
| Half of Vienna's lamps missing from the bake | Room culling unmounted the far room's lamps | `setBakeAllRooms` while gathering |
| **Black corners** (wall–ceiling, verticals) | Two stacked defects: a crisp 1-texel line (half-res bounce averaging an empty texel at the chart edge), and a broad ~50 cm dip (the 0.5 m VPL distance clamp) | Full-res coverage-normalized bounce, plus near-field rays (Kollig–Keller) |
| **Gray band at wall tops** | three's smoothstep spot falloff under-lights near the horizon compared with a real diffuser | Exact cosine emission for 90° diffusers |
| **Yellow spots** in a row along wall tops | Bounce VPLs sat at ceiling texel centers in a regular grid | Jitter within the texel, 4,096 VPLs, float accumulation (a bilateral filter caused streaks; rejected) |
| **Horizontal lines on walls** | Shadow acne from a 170° perspective shadow map | 1,024 cube distance map for wide lamps |
| Bright sliver at a pilaster top, edge lines, corner smudge | The model's wall UV charts touch (bleed) | Our own unwrap with 3-texel gaps |
| Black switch and socket rims | 1 cm charts had no half-res bounce texel | Bounce at full res on every receiver |
| Room ~25–45% too dark | Half-float accumulation loses ~25% of the bounce, and 3 bounces lose ~20% | float32, 8 bounces, radiosity tail |
| **Warm blob on the wrong wall** | The sky panel cast shadows and blocked the sun, which got in sideways through an open edge onto a hidden floor and leaked through a single-plane wall | Sky panels never cast shadows; the sun enters only through the glass (portal) |
| Vienna's room-2 windows got no sun | The single ceiling rectangle outside the window wall shadowed every ray | Casters more than 0.5 m outside the glass are ignored for the sun |
| **Beige-brown rooms**, sepia ceiling, warm mats | Every wood floor is orange in linear light, and its bounce colors everything (plus a cream stored ceiling) | `parquet-whitewash` common floor, white ceiling |
| **Window-frame blotches** | 384 daylight VPLs (~9 cm apart) sat farther apart than the frame is from the glass | 4,096 emitter VPLs |
| Window halo | Bloom on the very bright glass | Kept, at Madrid's subtle level. Eduardo wants the glow; the ÷10 "glare" variant was dropped. |
| Window glass 6× dimmer for visitors than in the bake | The stored bake didn't brighten the glass | `brightenWindows` runs on every path, once per material |
| **Recessed lamps at 2× height**, above the ceiling (also a prod bug) | `getWorldPosition` on world-baked nodes still parented to an off-origin room Empty | `worldMatrixOf(body) × bulb.matrix` |
| **Meter counting lamps behind walls** (+113 lx on one Vienna work) | `|n·L|` | `max(n·L, 0)` |
| Near-white prints burned (247/255) | The meter used room-average bounce | Light measured at each artwork |
| Mats differed on identical walls (211 vs 236) | Bounce on the art came from one environment snapshot at the visitor | Per-artwork measured light on mats, frames and cards |
| Cards whiter and bluer than the mats | The cards took the room-capture IBL | Cards take their nearest artwork's measured light |
| A whole room ~27 levels too bright (frameless works) | The art-light patch climbed to the shared parent | Patched only within the work's own `artworkDisplay` group |
| Washed-out pictures over the white page | The image's alpha marker leaked to the canvas | The final `ArtworkFileEffect` forces alpha 1 |
| **B&W prints brighter at a distance** (+4–5 levels) | sRGB textures plus mipmaps average in linear light, while viewers average encoded values | Encoded sampling (`ARTWORK_ENCODED_SAMPLING`), decoded in the shader |
| Same room 1–2% apart between exhibitions | Camera metered per exhibition, plus unseeded random numbers | Fixed camera per space, seeded bake |
| Uneven light on the art (Madrid 132–207 lx) | Works between too few downlights | More or real fixtures, never exposure (Eduardo's call per space) |
| Headless bake never finishes | The Mac display slept, which stalls `rAF` | Keep the display awake (`caffeinate`) |
| Walls blank white after compression | meshopt quantize baked a ~10.5× scale into transforms | FILTER without quantize (§3.1) |
| No spawn point, wall or exit, with no error | Export skipped a hidden collection | Node diff (§2.4) |
| New node "missing" after a re-export | Same file name was served from the cache | A new name every export |

---

## 8. Tools and history

**History**, in reading order:
- Memory notes in `~/.claude/projects/-Users-creatio-Desktop-the-art-room/memory/`:
  - `reference_ar161_bake_recipe.md` (every root cause) and `project_ar161_realism.md`;
  - the `feedback_artwork_images_file_exact`, `feedback_per_space_not_per_exhibition` and
    `feedback_physically_based_3d` notes;
  - `reference_ktx2_meshopt_spike`, `reference_glb_export_silent_node_loss` and
    `reference_space_blend_traps`;
  - `project_vienna_light_culling`, `project_vienna_scene_budget`, `project_glb_r2_fallback` and
    `reference_blender_mcp_setup` (Blender ≥ 5.1, port 9876).
- Spec and plan: `docs/superpowers/specs/2026-10-17-ar161-baked-lighting-design.md`,
  `docs/superpowers/plans/2026-10-17-ar161-baked-lighting.md`.
- Execution ledger with every ruling: `.superpowers/sdd/2026-10-17-ar161-baked-lighting/progress.md`.
  The task reports sit next to it: 19 has the per-space constants, 18 the artist controls, 15
  bake and review, 14 the stored bake, and 20 the assets on R2.

**Measuring tools:** `.superpowers/tools/ar161-measure/`. These are **not in git**, because
`.superpowers/` is ignored.
- They run Playwright headless Chromium (Metal) against :3001, one at a time.
- For `review=1` and `bake=1`, set `STATE=e2e/.auth/admin.json`.
- They need the dev-only hooks `window.__ar161Scene`, `__ar161Camera`, `__ar161Bake` and
  `__ar161Bloom`, which exist only in non-production builds.
- The query files (`*.q`) are historical spike flag strings. Today the query is just `review=1`
  (or `bake=1`).

| Status | Tool | Measures |
|---|---|---|
| **Current** | `sweep.mjs <slug> <queryFile> <out>` | Every artwork against its file, plus room views (`VIEWS=madrid.views.json` / `vienna.views.json`; Paris is built in) |
| | `multicam.mjs` | Many camera views from one load |
| | `shoot19.mjs … <live\|review\|bake>` | Bake and review flows, mid-bake loader shots, `JUNCTION=` column profile, `MATS=` |
| | `cmp19.mjs` | View-by-view pixel diff against a baseline, artwork images masked |
| | `sampling.mjs` | Texture sampling against the original file (linear-light and encoded downscales) |
| | `bloomcheck.mjs` | Window glow: bloom on minus bloom off, mean/max levels |
| | `bundlecheck.mjs` | Visit-page JavaScript; `LightBaker` must not be in it |
| | `detcheck.sh` | Bakes twice, compares meters and pixels |
| | `cardcheck.mjs <slug> <query>` | Card, mat and wall pixels next to each other |
| | `exlevels.mjs`, `cors-read.mjs` | Read-only: the 3D exhibitions on the database, and the R2 CORS rules (the app's R2 key can't read CORS: edit it in the Cloudflare dashboard, bucket `theartroom` → Settings → CORS Policy) |
| | `glbdiff.mjs <old.glb> <new.glb>` | Node names, counts, must-not-move transforms, quantization (§2.4) |
| | `make-noq-glb.mjs` | meshopt FILTER compression without quantize (§3.1) |
| **Needs the live baker** (`__ar161Baker` exists only between the end of a `?bake=1` run and its redirect: adapt before use) | `artpeak.mjs` | Peak light per work, by source |
| | `framedepth.mjs` | Frame stand-off from the wall |
| | `gather.mjs` | Monte-Carlo ground truth at a junction |
| | `dumpfull.mjs`, `bakedump.mjs` | Lightmaps and coverage |
| **Geometry and scene probes** (hard-coded slugs: edit them) | `flooruv.mjs`, `geoprobe.mjs`, `sunray.mjs`, `vsunray.mjs`, `vgeo.mjs`, `vplan.mjs`, `vlamps.mjs`, `pick.mjs`, `lampcolors.mjs`, `matshade.mjs` | UVs, sun rays, layout, lamp placement, mat pixels |
| **Historical** (pass `ar161*` flags or need `LoadTimeBake`, both gone): read them for method only | `shoot.mjs`, `junction.mjs` (raw-lightmap mode), `artlux.mjs`, `dump2.mjs`, `stored*.mjs`, `meterside.mjs`, `bakecheck*.mjs`, `t13cmp.sh`, `base19.sh` | |

`prodlook-2026-10-19/` holds read-only snapshots of the four prod exhibitions' stored room settings.

---

## 9. Where the sources disagree

The code was trusted in every case below.

- The spec's approved-look strings include `ar161glare=1` (bloom ÷10). Since 2026-10-19 every space
  uses Madrid's unmodified bloom (0.6), as recorded in the ledger and Task 19.
- Spec rule 3 gives the floor "normal 3, reflectiveness 0.09". The approved render never used
  either, so `COMMON_FLOOR` has normal ×1, roughness 1 and metalness 0.
- Notes saying Blender owns "clean 0–1 floor UVs" and wall and ceiling UVs: the bake uses its own
  unwrap and a code-generated floor plane.
- "Geometry only, no Blender light bakes": true for the baked look, but today's look in the
  existing spaces still uses their old Blender textures (see §4, row 10).
- The meshopt spike measured `_noq` as pixel-identical under the old Blender-baked look. Under the
  in-browser bake, FILTER shifts Paris by 2–6 levels on 1–7% of pixels (Task 20).
