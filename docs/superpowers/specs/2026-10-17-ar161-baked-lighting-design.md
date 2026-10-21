# Baked Lighting for Every 3D Exhibition — Design

**Ticket:** AR-161 · **Branch:** `feat/AR-161-improve-realism` · **Date:** 2026-10-17
**Revised:** 2026-10-18 — per-space rules, fixed camera per space, deterministic bake,
file-exact artwork images, bake preview link (see "Per-space rules" and "Review and the
bake preview link"). Where this revision and older text disagree, the revision wins.
**Spike commit:** `c484ef3b` (local, not pushed; everything since is uncommitted)

## Why

The 3D rooms must look like a real gallery photographed well: physically based
light, real bounce, soft corners, no fake ambient. A spike proved it can be done
in the browser: the admin's computer "bakes" the room's light (lamps, daylight,
bounces) into textures in ~45 s. Eduardo approved the Madrid result by eye
("wall colour excellent, floor, artworks, window light amazing"; corners fixed
2026-10-17).

The spike bakes on **every** page load, on whatever computer the visitor has, and
shows the old lighting while it works. That cannot ship. The bake must happen
once, on the admin's machine, be reviewed by the admin, and then be published to
visitors as finished lighting.

## What exists (the spike)

All under the dev-only `?ar161=baked-next` probe; production builds never enable it.

| Piece | Where |
|---|---|
| Light baker (lamps + shadows, instant-radiosity bounces, window daylight, near-field compensation, directional lightmap) | `src/components/scene/bake/LightBaker.ts`, `bakeShaders.ts` |
| Room ray-tracing data (BVH in float textures) | `src/components/scene/bake/gatherScene.ts` |
| Our own lightmap unwrap for walls/ceiling/props | `src/components/scene/bake/autoUnwrap.ts` |
| Runs the bake after load, swaps materials, meters exposure / white balance | `src/components/scene/bake/LoadTimeBake.tsx` |
| Look presets + URL flags (`PHYSICAL`, `NEXT`) | `src/components/scene/realismProbe.ts`, `RealismProbePanel.tsx` |
| Room environment capture for unbaked objects | `src/components/scene/RoomEnvironmentCapture.tsx` |
| White balance post effect | `src/components/scene/spaces/objects/Effects/WhiteBalanceEffect.ts` |
| Physically based lamps, floor, displays | edits in `spaces/objects/*` (see `git show c484ef3b --stat`) |

**The approved looks** (Eduardo, by eye — the flags become the only behaviour; no flags
in production):

- **Paris** (approved 2026-10-18, "perfect", on both Permanence and Kritzendorf with the
  same settings) and **Vienna** (approved 2026-10-18, "perfect… I love it", Florescere):
  `ar161=baked-next` + `ar161daylight=6&ar161unwrap=1&ar161lambert=1&ar161denoise=1&
  ar161propsbounce=1&ar161paint=0.9&ar161plastic=0.85&ar161plaster=1&ar161finebias=1&
  ar161edges=1&ar161nearfield=1&ar161tracklevel=4&ar161fullbounce=1&ar161bounces=8&
  ar161recessedlm=6800&ar161trackscale=0.5&ar161artbounce=1&ar161floor=parquet-whitewash&
  ar161floorscale=2.07&ar161floornormal=3&ar161floorrefl=0.09&ar161flooroffy=0.04&
  ar161floortemp=0&ar161corridor=1&ar161sun=5000&ar161sunportal=1&ar161sunaz=360&
  ar161glare=1&ar161ceilingcolor=ffffff&ar161emittervpls=4096&ar161artfile=1&ar161glasson=1`
  — with Permanence's room settings (`ar161lookfrom=the-beauty-of-permanence` on the
  other exhibitions; white walls #f3f1ea-ish are the artists' choice, not the space's).
- **Madrid** (approved 2026-10-16/17): `ar161daylight=6&ar161unwrap=1&ar161lambert=1&
  ar161denoise=1&ar161propsbounce=1&ar161paint=0.9&ar161plastic=0.85&ar161plaster=1&
  ar161finebias=1&ar161edges=1&ar161nearfield=1`. **Must be re-checked** under the
  per-space rules below (the common floor, white ceiling, glass on, file-exact images,
  fixed camera) before it ships.

What the flags mean, in one line each: daylight = window glass emits ×6; unwrap = our own
lightmap unwrap; lambert = exact cosine diffusers; denoise = jittered 4,096 VPLs; props
bounce at full res; white paint reflectance 0.9; plastic 0.85; plaster maps (tile 0.7 m);
fine shadow bias; full-res coverage-normalised edges; near-field corner rays; full float
bounces ×8; recessed 6,800 lm (rooms), standard 3,000 lm in corridors; track lamps ×0.5 at
slider 4; light measured at each artwork for mats/cards/meter; the common floor; sun
5,000 lx straight in at 35° only through the glass; realistic glare (bloom ÷10, lamp discs
brighter); white ceiling; 4,096 daylight VPLs (clean window frames); file-exact images;
window glass always on.

The full list of root causes found on Madrid, which will recur in the other spaces,
is in memory note `reference_ar161_bake_recipe.md`. Key ones: each space's
`lights/index.tsx` must mount the bake; multi-room spaces must mount every room's
lamps for the bake (`setBakeAllRooms`); a bake only advances while its tab is
visible (requestAnimationFrame).

## Goals

1. Every 3D space (Madrid, Paris, Vienna) renders with baked lighting and gives
   **the same exact result** as approved Madrid (Eduardo, 2026-10-17). The spaces'
   geometry and fixtures differ, so the recipe is re-applied and the light
   recalculated per space; each space is signed off by Eduardo's eye.
2. **Only admins bake**, on the admin's computer, from a **Bake** button in the 3D
   exhibition editor. Artists never see it. Visitors never bake.
3. **Two stages:** (1) bake → the admin reviews the result exactly as visitors
   will see it, rebakes if needed; (2) publish → visitors get that reviewed bake.
4. Visitors **never** see a draft view (unlit, half-lit, old lighting, or lighting
   that doesn't match the room) on any machine.
5. A new publish can never be served stale from any cache.
6. Then: bring the ~45 s bake down where possible without changing the look.

## Non-goals

- Baking on visitors' or artists' machines (their hardware is unknown).
- New artist-facing lighting controls. Artists keep only physically meaningful
  settings (paint colour, floor material, lamp placement/aim/on-off).
- Phones/tablets: the 3D room stays laptop-only (AR-160).
- Notifications by email: the existing **"Needs Review"** badge on the admin
  exhibitions page is the signal (Eduardo: "I get a badge").

## Anti-goals (a failure even if it "works")

- An exhibition goes live with a bake the admin didn't review, or with a bake made
  before the artist's latest change (a frame's shadow where the frame no longer is).
- Visitors ever see the unbaked or half-baked room.
- Raising exposure to brighten a dim room, or artworks looking washed out
  (physically based: a dim room gets more real light, never more exposure).
- Fake light (invisible fills, tints, gains) creeping back in.

## Per-space rules (Eduardo, 2026-10-17/18 — supersede the earlier per-exhibition controls)

> "We cannot do this for every single exhibition, we need a sweet spot for all of them
> using the same 3D space. Dedicated tweaks per space: yes, dedicated tweaks by
> exhibition: no." — "Imagine when we have 20 exhibitions?"

1. **Artwork images show exactly the original file — the sine qua non.** No light,
   exposure, white balance, tone curve, tint or glow on the image itself, even if it then
   doesn't match the room's light ("artists will look at this first"). Implemented:
   the image writes its texel plus an alpha marker; the last screen effect
   (`Effects/ArtworkFileEffect.ts`) restores it from the effect chain's input and forces
   alpha 1. Everything around the image — mat, frame, text card, wall — is physically lit,
   and mats and cards take the light measured at their own artwork (so they match).
   Verified per exhibition by comparing every work on screen against its file.
2. **Every look value belongs to the space**, validated on every exhibition hung in it:
   lamp ratings, daylight, sun, floor, paint reflectances, glare, bake quality.
3. **One floor for every room of every space** (`parquet-whitewash`: scale 2.07,
   normal 3, reflectiveness 0.09, offset y 0.04, temperature 0). Artists no longer choose
   the floor ("a real gallery won't change the floor per exhibition").
4. **Window glass always on** (no "show sky" / open window); the sky, daylight and
   ambient levels are not artist controls. Ceiling white.
5. **The camera is fixed per space — no auto mode** (2026-10-18). Exposure and white
   balance are constants of the space, stored with it (`spaceConfigs`), calibrated once
   from the approved reference bake (Paris ← Permanence, Vienna ← Florescere, Madrid ← its
   re-check) and changed only when the space changes (new model or a new approved look).
   They no longer depend on which works hang there. (Before: the meter re-measured each
   exhibition's brightest work, so the same room rendered 1–2% apart per exhibition.)
6. **The bake is deterministic**: a fixed random seed, restarted every bake, so the same
   room with the same lamps bakes identically every time.
7. **What artists may change** (it physically changes the light, so it's in the
   fingerprint): wall paint colours, decoration (display panels and their
   colours), **dim the recessed and track lamps a bit**, move track lamps along their
   track and rotate them, hide (switch off) track lamps, the lighting set
   (`ceilingLightMode`). **Not**: the floor, window/sky/daylight, ambient, exposure, white
   balance, any quality setting.
8. **Light level standard per space**: recessed downlights 6,800 lm in Paris/Vienna rooms
   (3,000 lm in corridors < 6 m wide), Madrid's round lamps 3,000 lm; track lamps ×0.5 at
   the standard slider (4); daylight ×6; sun 5,000 lx at 35°, straight in through each
   window's glass only.

## How it works

### The flow

```
artist saves ──► "Needs Review" badge (exists today: hasPendingChanges)
                        │
admin opens the 3D editor ──► [Bake]  (admin only, ~45 s, monogram loader)
                        │
              draft bake saved (R2 files + DB record, fingerprint of the room)
                        │
admin walks the room with the draft bake (visit view, review mode) ──► bake again?
                        │
admin publishes (existing dashboard action) ──► server checks the draft bake
                        │                       matches the room as it is NOW
                        ▼
publishedSnapshot carries the bake ──► visitors download it with the room
```

### The editor while editing

- The 3D editor keeps today's realtime lighting while artists and admins edit
  (instant feedback). The reviewed bake is the truth for what ships. (Builder's
  call, recorded.)
- **Artists set the mood, physically** (Eduardo, 2026-10-17): mood comes only from real
  light sources; never from exposure, ambient, tints or gains. What they may change is
  rule 7 above (revised 2026-10-18: recessed lamps are now dimmable "a bit" too; the
  window-intensity slider and the floor are no longer artist controls).
- Everything else in the lighting panels is hidden: sky type/rotation, ambient
  colour/intensity, window colour/transparency/intensity, floor material and every floor
  setting, shadow blur/spread/tightness, wall brightness, exposure. Every control that
  stays and changes light is in the fingerprint. The builder confirms each against the
  code.
- **Levels reset to the standard at rollout** (Eduardo, 2026-10-17). The stored
  levels were tuned blind under the old fake light (vivrière ceiling lamps 8,
  kritzendorf track lamps 1.4, florescere window 0.9; default 4). At rollout every
  exhibition's track-lamp and recessed-lamp power go back to the standard (slider
  default 4 = 100%) and every per-exhibition look setting the space now owns (floor,
  window intensity/colour/transparency, ceiling colour, ambient, sky) is ignored in
  favour of the space's values; lamp positions, rotations, on/off, wall colours, panels
  and the lighting set (`ceilingLightMode`) are untouched.
  - Track-lamp standard: set on Paris (×0.5 at slider 4, approved 2026-10-18).
  - Daylight: the approved Paris/Vienna glass radiance (window 4.2 × 0.3 × 6 = 7.56) is
    the space value for every exhibition.

### Stage 1 — Bake (admin, in the editor)

- A **Bake** button in the 3D exhibition edit panel (`src/components/editview/`),
  rendered only when `session.user.userType` is `admin` or `superAdmin` (the check
  `src/components/exhibitions/edit/index.tsx` already uses).
- The bake runs on the exhibition's **live (draft) data** — the same data the
  editor shows (`GET /api/exhibitions/by-url/[url]?mode=edit`) — in the same scene
  pipeline visitors get, so what is baked is what will be seen.
- While it runs: the **monogram loader** (below), with the line that it takes a few
  minutes (headless: Paris ~2 min, Vienna ~2.5 min) and that the tab must stay open,
  in front and the display awake (the bake stalls when the tab or display sleeps).
- The admin's machine must support WebGL2 with float render targets and
  `EXT_float_blend`. If it doesn't, the button explains why and does nothing.
- Output, uploaded when the bake finishes:
  - one HDR lightmap per receiver (walls, ceiling, floor, fixtures) and the
    directional maps for plaster walls/ceiling;
  - the camera the visitor render uses — the space's fixed exposure and white balance
    (rule 5), recorded with the bake so a later recalibration of the space marks the bake
    stale instead of silently changing it;
  - the **fingerprint** of the room it was baked from (see below) and bake stats.
- Stored as the exhibition's **draft bake**. Visitors are unaffected.

**Fingerprint.** A hash of everything that changes the light: space, wall/ceiling
colours, floor material, lamps (position, aim, on/off, settings), panels, windows,
artworks' placement and size. The server returns it with the edit-mode data when
the bake starts; the bake is saved with that value (so an artist saving during the
bake makes the bake stale, correctly). The server can recompute it from live data
at any time.

The fingerprint also includes a **baker version** (bumped whenever bake or
display code changes the result) and the **space model version** (GLB). A code or
model change therefore marks bakes stale like an artist edit does: the admin sees
"Needs Review" and rebakes before the next update. Visitors keep the published
bake meanwhile — except when the model geometry changed: lightmap UVs come from our
own unwrap of the geometry, so the bake also stores an unwrap hash, and a mismatch
on the visitor's side must never render a misaligned bake (rebake every affected
exhibition before such a model ships). (Builder's call, recorded.)

### Review and the bake preview link (revised 2026-10-18, Eduardo: "that's exactly it")

Who does what: about 90% of the time Eduardo edits and bakes himself, sharing his screen
with the artist; an artist who edits alone (e.g. Beatriz) says "I finished, please bake
it and give me a bake preview link".

- **Artists see their unbaked work only in the 3D editor**, logged in, with today's
  realtime lighting. There is no unbaked preview link any more.
- **Review view (admin):** after a bake, a "View baked room" action (next to Bake in the
  editor, and on the exhibition's dashboard row) opens the visit view with the latest
  saved draft + the latest bake — exactly the visitor render, so "approved in review" =
  "what ships". If something looks wrong: fix, bake again. Each bake replaces the draft
  bake.
- **Bake preview link** (replaces today's "Publish Preview" / "Copy Preview Link" on
  unbaked data): the admin copies a secret link (`…/visit?preview=<token>`) that shows
  the latest saved draft + the latest bake, for **unpublished and live** exhibitions —
  on a live one, visitors keep the published version until the admin publishes.
  "Update preview link" stays (new secret, old link dies).
- **Never a mismatched room** ("we don't want to risk a mismatch of a baked scene and a
  post-baked edited one"): if anything in the fingerprint changed after the bake, the
  review view and the preview link show a clear "This preview is out of date — a new
  bake is needed" instead of the room; the next bake makes the same link current again.
- Every bake has new file names, so neither the review view nor a preview link can be
  served a cached older bake.
- Rollout: existing preview links on unbaked exhibitions stop working.

### Stage 2 — Publish (admin)

- Publishing stays where it is (`AdminExhibitions.tsx`: "Publish exhibition" /
  "Update Exhibition", and the 3D space toggle `spacePublished`).
- The server refuses to publish the 3D room unless a draft bake exists **and** its
  fingerprint equals the live data's fingerprint now. The dashboard says why
  ("Bake again — the room changed since the last bake").
- The bake preview link above replaces "Publish Preview"; it never shows an unbaked or
  out-of-date room.
- On publish, the bake reference goes into `publishedSnapshot` together with the
  frozen positions and colours, so visitors always get lighting that matches what
  they see.
- Baking and publishing become **server-enforced admin-only**. Today
  `PUT /api/exhibitions/[id]` does not check roles on `published`,
  `spacePublished`, `previewEnabled` — any owner could self-publish via the API;
  only the UI hides it. (Also: `requireOwnership` lets only `superAdmin` through,
  so a plain `admin` not impersonating gets 403 — the builder must check what the
  publish actions need.)

### Caches

- Every bake gets a **new id**, and its files live under a new key, e.g.
  `{env}/exhibitions/{exhibitionId}/bakes/{bakeId}/wall.<ext>` (key builders in
  `src/lib/r2.ts`; `uploadToR2` sets immutable 1-year caching, which is right
  because a key is never reused).
- A new publish points the snapshot at new URLs, so no browser or CDN can serve old
  lighting. The exhibition API is already `no-cache` (`next.config.mjs`).
- Old bake files are deleted after the next successful publish (keep the published
  one and the current draft; delete the rest).

### Visitors

- `GET /api/exhibitions/by-url/[url]` returns the published bake (file URLs +
  meter values) from the snapshot.
- The scene downloads the bake files **as part of loading** (inside the same
  Suspense boundary as the room's assets), applies them to the materials (the
  spike's `patchStandard` / `patchPlaster` / MeshBasic swap), and only then reveals
  the room. No `LightBaker` code runs for visitors (and should not be in their
  bundle if avoidable).
- Exhibitions without a published bake (only during rollout) render as they do
  today.

### The monogram loader (Eduardo's pick, "beautiful")

- Full white screen. `src/icons/monogram.svg` (ring + "AR") in light grey; **red
  `#bd1622` rises through it from the bottom** at the real pace of the work, never
  going backwards. Mockup: option B in
  `.superpowers/brainstorm/19530-1792225350/content/loader-options.html`.
- **For everyone** (Eduardo, 2026-10-17): it replaces the visitor's current
  "Loading Exhibition N%" overlay (`src/components/exhibitions/view/index.tsx`) and
  is shown during the admin's bake.
  - Admin bake: one short line saying it takes a few minutes and to keep the tab open,
    in front, with the display awake.
  - Visitors: their own short line (no duration — they only download); the red
    tracks the whole load (room, artworks, lighting) as one fill.
  - Final wording to write; American spelling.
- When full, the white screen fades and the room appears.
- Brand rules: red only in marks (this is the mark); squared, ink-on-warm-white.

### Every space

- **Paris** (Permanence, Kritzendorf): approved 2026-10-18. **Vienna** (Florescere):
  approved 2026-10-18. **Madrid** (Vivrière): approved 2026-10-16/17 under the older
  rules — re-check with the common floor, white ceiling, glass on, file-exact images and
  its fixed camera, then Eduardo's eye.
- Before a space is called done: a full sweep of **every exhibition in it** (every room
  view + every artwork on screen vs its file) with the same settings.
- Fixes found while tuning Paris/Vienna (all shared code, all spaces get them): sky panels
  never cast shadows; the sun enters only through each window's glass (portal) and
  anything more than 0.5 m outside the glass is outdoors and casts no sun shadow (Vienna's
  floor/ceiling rectangles reach past room 2's window wall); recessed spotlights placed at
  their bulb's true world position (`worldMatrixOf` — Vienna's were at 2× and above the
  ceiling, **a production bug today**); the camera's light meter counts only light from the
  front of a work (`max(n·L, 0)`, not `|n·L|`); realistic glare; a neutralised floor (every
  wood texture is orange in linear light → beige-brown rooms); 4,096 daylight VPLs (clean
  window frames). The full list with causes is memory note `reference_ar161_bake_recipe.md`.
- Multi-room spaces (Vienna) bake every room's lamps (`setBakeAllRooms`); with the fixed
  camera the visitor's current room no longer affects the camera.

### Productionizing the spike

- The approved flags and the `PHYSICAL` + `NEXT` preset values become the only code
  path. Delete the probe (`realismProbe.ts`, `RealismProbePanel.tsx`, every
  `useRealismProbe` call site — the file itself says "remove before AR-161 merges")
  and the rejected experiments (`ar161filter`, `ar161gather`, `ar161disc`,
  `ar161fullbounce`, `ar161roomclip`, `ar161mindist`, `ar161vplcube`, ...).
  Keep the headless measuring tools out of the repo (scratchpad).
- Plaster maps (`public/assets/materials/plaster/*.jpg`, 6.5 MB, **never commit**)
  move to R2 and load via `assetUrl` (KTX2 if it holds the look).

### Speed pass (last)

Lower the bake time (headless today: Madrid ~45 s, Paris ~2 min, Vienna ~2.5 min) only
through changes
that measure identical against the approved look (e.g. fewer near-field rays,
coverage-normalised half-res bounce instead of full-res). If it can't go lower,
that's accepted ("if not, it's life").

## Constraints

- **Database:** new storage for draft/published bake — Eduardo OK'd "a new database
  field" (2026-10-17). Work on the **dev DB only**; `.env.local` currently points at
  the **PROD DB** (backup `.env.local.bak.prod-peek-2026-10-16`) — Eduardo restores
  the dev DB (`/restore-dev-db`) before any schema or write work. Never run or suggest migration commands; prod schema sync
  happens before release, by Eduardo.
- No new packages without approval.
- Tests: Playwright only; no WebGL in e2e. Cover roles (Bake hidden for artists;
  bake/publish APIs reject non-admins), publish refusal on a stale/missing bake,
  and cache-busting (new bake ⇒ new URLs). Visual quality is verified by headless
  A/B renders and Eduardo's eye.
- Run `pnpm build && pnpm start -p 3001` before any push (module/bundle changes).
- Git: this branch only; commit only when Eduardo says "commit"; never push without
  his word; never open PRs (base is `develop`).
- No exposure raise, ever; bloom stays on lamps and windows (realistic glare).
- **Local-only assets — never push before they're on R2:** `paris22.glb` (ship as a
  compressed `paris22_noq.glb`, like paris21), the `parquet-whitewash` floor and the
  plaster maps in `public/assets/materials/` (never commit `public/` images).

## Rollout

No date is fixed. The anti-goal stands: no space ships with a bake Eduardo hasn't
approved.

1. Ship Bake + storage + review + publish checks; visitors unchanged.
2. Admin bakes, reviews and publishes each live exhibition; each one switches to
   baked lighting the moment it's published with a bake.
3. When every live exhibition is baked: remove the old (unbaked) render path.

## Left to the builder

- Lightmap file format and encoding: **PNG with a log encoding** (the plan's `log8` /
  `signed8`), decoded to half-float — chosen over KTX2 (lossy 4×4 blocks band smooth
  light gradients; common KTX2 modes are 8-bit; HDR variants unverified in our stack).
  Eduardo: "I trust your decision". Must keep the HDR range, reproduce the live bake
  within ±1% on the junction/corner probes, no new packages; measure download size and
  GPU memory per space and report before release (KTX2 would win on GPU memory).
- Exact DB shape (a JSON field on `Exhibition` vs a small bake table), within
  "draft bake + published bake in the snapshot".
- The fingerprint's exact field list and hashing (everything in rule 7, plus the space's
  camera and look values, baker version, model version).

## Still open (Eduardo's call)

- **How much may artists dim** the recessed and track lamps ("a bit")? Proposal: down to
  50% of the standard, never above it.
- **The B&W fine-detail residual** (Kritzendorf, +4–5 levels at a distance, exact up
  close): root-caused 2026-10-18 — the GPU averages fine grain in linear light (sRGB
  texture + mipmaps) while every image viewer averages encoded values. Proposed fix:
  upload artwork textures without sRGB decoding, decode in the shader, so mipmaps average
  as Photoshop/browsers do. Not built.
