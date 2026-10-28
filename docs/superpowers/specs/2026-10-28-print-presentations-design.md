# Print presentations: every artwork shown as a photo of the real print

Date: 2026-10-28 · Branch: `feat/AR-167-improve-3d-experience` (owner's call: "use the current branch for this, no matter if the name does not fit")

## Intent

The gallery is 100% virtual. The owner wants it to feel like everything exists in real life, the artworks as much as the 3D rooms. Today every grid and artwork page shows the bare image file. Instead, each artwork should look like a photograph of the real print hanging on a white wall, the way Perrotin or White Cube print shops present theirs:

- **Open editions, and artworks not for sale** → a **framed** print: wooden frame, the sheet with its paper margin straight behind it (no mat), soft shadows, the frame shading the paper inside it.
- **Limited editions** → an **unframed sheet** held a few millimetres off the wall, a pencilled "copy/N" at the bottom left (no signature), soft shadows.

Success: a visitor can't tell it's rendered. No two pieces in a grid look identical, because each "hangs" and catches the light slightly differently.

## The one rule that is never broken

**The artwork image is never in the render and never altered** (no light, shadow, tint, resampling or re-encoding by the renderer). The render is a *surround* with a transparent window where the image goes. The page places the original image file underneath, exactly in that window. Only the frame, paper, pencil number and shadows are rendered.

## Goals

1. **Every artwork surface shows the presentation:**
   - every grid: exhibition grids, the artist profile's featured works, the prints page. All of them render through `src/components/artwork/ArtworkGrid`.
   - every individual artwork page (`src/components/artwork/detail/ArtworkDetailBody.tsx`). The presentation replaces the full-size image. No zoom.
2. **Production readiness:** all current production artworks are rendered before it goes live, and new or changed artworks can be rendered on demand.
3. **Never broken:** an artwork without an up-to-date presentation shows today's image.

## Non-goals

- 3D rooms, including the artwork pop-up inside them, the artwork library, admin and dashboard lists, cart and checkout, print wizard, inquire sidebar, emails, OG/social images. These keep the plain image.
- Automatic rendering when an artist saves an artwork (possible later).
- Choosing the frame per artwork. **TODO** (owner, 2026-10-28): when rendering an item, choose which frame it is rendered with — "not all artworks will look ok in dark wood". Five frames: the three wood textures we already have (`wooden-frame-light`, `-medium`, `-dark`), plus an off-white and a black painted wood. For now every open edition is framed in dark wood (`wooden-frame-dark`). The per-work pick is built (admin "Frame color" column, `Artwork.presentationFrame`, default `wood-dark`); only the other four frames are left.
- An optional frame for limited editions. **TODO** (owner, 2026-10-28): the numbered sheet stays unframed by default; later it can be shown framed too, picked per work.
- Benches/AR-167 furniture (paused, "we will refine later").

## Anti-goals (failure even if it "works")

- Any change to the artwork's pixels by the renderer.
- Visible repetition: the same shadow or the same wood on every piece.
- Hard CG edges or gray bands. Shadows must fade softly. The wall must read as pure white on the #fff page, with no visible box around a card. The approved renders meet this as the owner judged them: their outer edge pixels measure 251–255 (shadow tails reach the crop). Keep that framing; don't retune the light to chase 255. Add a check that a render's outer edge stays within that range.
- A broken or empty card while a presentation is missing or loading.

## The look (APPROVED, locked)

The source of truth is the spike studio `src/components/printRender/PrintRenderSpike.tsx`, approved by the owner on 2026-10-28 ("perfect, works for me"). Productionize it as is. Do not retune values. Key facts a builder must keep:

- **Scene:** R3F `<Canvas flat shadows>`, alpha, `preserveDrawingBuffer`, camera dead-on, FOV 30, the shot cropped to the piece plus `SHADOW_MARGIN` 0.06 of its long side.
- **Light:**
  - Every light is set by its **share** of the wall's irradiance. The shares sum to `WALL_IRRADIANCE = π·0.995`, which puts the wall just at white without clipping. Verified: 0.98 → 253, 0.90 → 244.
  - A key light upper-left plus two faint fills from below and the right, all casting shadows. The hemisphere light provides the rest.
  - `SoftShadows size 180–300, samples 128`.
- **Seeded variation per artwork:**
  - Seed = FNV-1a of the artwork id, run through mulberry32. The same artwork always gets the same shot.
  - Seeded values: light positions and shares, softness, standoff (paper 6–13 mm, frame 2–6 mm), sheet set-back in the frame 15–25 mm, limited-paper corner curl, wood tile size and per-bar wood offsets, and the limited copy number (1..N).
  - The order in which values are drawn from the PRNG is part of the look. Append new draws at the end; never insert.
- **Framed:**
  - `StudioFrame` is its own mitered bars, not the gallery `Frame` component. The bars use true-scale planar UVs in metres of board, grain along each bar, eased edges of 0.8 mm, satin finish (roughness 0.55 × map, normalScale 0.8), and the `wooden-frame-medium` textures. Every open edition uses this one wood. The owner calls it "oak" ("all in oak wood for open editions … medium, the one you just used"), not the gallery's `wooden-frame-light`. The frame does not follow the frame the artist chose in the 3D room; the owner is comfortable with that for now ("we will refine later").
  - Same outer size as the old mat version: `FRAMED_IMAGE_LONG_M` = 0.596, paper margin 6 cm (7.5 cm at the bottom), lip overlap 3 mm.
  - The sheet uses an analytic **ambient-occlusion `aoMap`** from the frame's inner walls (view factor `(1 − d/√(d²+h²))/2` per wall, wood bounce 0.3). It dims only the ambient light.
- **Limited:**
  - Paper `#f9f8f4`, 0.4 mm thick, curled border, `noReceive`. The paper never shadows itself; that was an artifact.
  - Pencil number in Caveat, color `#8a8a88`, placed via `PrintWizard/editionNumberMetrics`, casting no shadow.
- **Shadows:** everything casts and receives shadows except the image window. The window mesh uses `NoBlending`, opacity 0, `depthTest:false`, renderOrder 10. It reports its exact pixel rect.

## How it works

### 1. The studio (production)

Move the spike into a real module, for example `src/components/printPresentation/studio/`, rendering one artwork from `{ ratio, mode, edition, seed }`. It is used only by the admin page below. Remove the dev route `src/app/dev/print-render/`.

Output per artwork:
- one render at **1800 px wide**, enough for the artwork page (max 860 CSS px) on retina screens
- a **900 px** copy for grids, downscaled from the same render, so both share one window rect
- both encoded as **WebP with alpha**
- the window rect stored as **fractions** of the image: `{ x, y, w, h }`

### 2. Which presentation an artwork gets

- **Limited** only when the artwork is for sale (`printEnabled`), its `editionType` is `'limited'`, and it has an `order: 0` variant, draft or published. N = that variant's `editionSize`; the owner said N is "just a reference". Sale state beyond that, such as a variant temporarily unblocked by an admin or sold out, does not change the mode.
- Everything else → **framed**: open editions, artworks not yet for sale (the owner: "for artworks that are not yet being sold, treat them as open editions"), and limited editions with no variant yet.
- Only `printEnabled`, `editionType`, and the order-0 variant's `editionSize` feed the mode and N, so only those mark a presentation out of date. Those are rare, deliberate changes.
- Only artworks whose `artworkType` is image, with `originalWidth`/`originalHeight` known, get a presentation. Others keep today's view.

### 3. Fingerprint (what makes a presentation out of date)

`fingerprint = hash(LOOK_VERSION, mode, N, ratio rounded to 4 dp, seed)`. `LOOK_VERSION` is a constant bumped whenever the studio's look changes, which marks every presentation out of date. Out of date = the stored fingerprint differs from the one computed now.

### 4. Storage (new R2 category, nothing existing touched)

- Uploads go from the admin's browser by **presigned PUT**, reusing the room-bake machinery (`src/lib/bake/bakeStorage.ts`, `bakeUpload.ts`, the `exhibitions/[id]/bake/uploads` route pattern):
  - a new admin-only route issues the URLs
  - keys follow the `r2.ts` conventions (env prefix), e.g. `{env}/presentations/{artworkId}/{fingerprint}-{1800|900}.webp`
  - long-cache headers like bakes; a new fingerprint means a new file name, so nothing is ever stale in a cache
- The low-res and high-res artwork images are unchanged. The low-res is what sits in the window.
- Replacing a presentation deletes the previous files. Deleting an artwork deletes its presentation files.
- **`scripts/reconcile-r2.ts` must know the new category**, or it will report or remove presentations as orphans.

### 5. Data

- A new nullable field on `Artwork`, for example `printPresentation Json?`: `{ fingerprint, mode, urls: { large, small }, window: { x, y, w, h }, renderedAt }`. The owner runs their own DB step; never suggest migration commands.
- A new `SiteSettings` boolean, for example `printPresentationsEnabled @default(false)`, is the go-live switch. It's toggled in admin settings like `purchasesPaused`.

### 6. The admin page "Print presentations"

- Admin-only (`requireAdminOrAbove`), under `src/app/admin/`.
- Lists every eligible artwork across all artists: thumbnail, artist, title, mode, and a status of **missing / up to date / out of date**, plus counts.
- **"Render all missing and out of date":** renders one artwork at a time in the admin's browser, uploads both files, saves the record, with a progress bar. It can be left running, and stopping it loses nothing already done. Each row also has a single **Re-render**.
- Runs in Chrome. The owner uses Chrome only. Safari's canvas can't encode WebP and silently returns PNG, so the page checks that `canvas.toBlob('image/webp')` really returns WebP and refuses to start otherwise.
- About 5 s per artwork. Must survive hundreds in one session: no WebGL context leak, and drei `SoftShadows` must leave the global shader chunk as it found it.
- The on/off switch lives here or in admin settings.

### 7. The pages

- One component, the production version of `src/components/printRender/PrintPresentationPreview.tsx`:
  - the surround image is the in-flow layer that sizes the card
  - the original image is absolutely positioned under it at the window fractions
  - the surround has `pointer-events: none`, so links and clicks work as today
- Used in `ArtworkGrid` (small file) and `ArtworkDetailBody` (large file). When the switch is off, or the record is missing or out of date, it renders exactly today's markup.
- The data queries for those surfaces must include the presentation. The exhibition grid already reads live artwork rows (`src/lib/queries/getPublicExhibitionByUrl.ts`, since AR-151). Presentations are never frozen into a published snapshot.
- `ArtworkDetailBody` is also rendered by the artwork pop-up inside the 3D room (`src/components/exhibitions/view/ArtworkModal`). **The pop-up keeps the plain low-res image** (owner: "Let's show the current low res… for now" — may change later, so keep the opt-out a one-line switch). Why: the pop-up opens over the 3D room, where the piece hangs in the frame the artist chose there (e.g. black). Showing the presentation's wood frame on top of it would be misleading. `ArtworkDetailBody` gets an explicit opt-out that the pop-up uses, so the standalone artwork page shows the presentation and the pop-up doesn't.
- Keep each image's `ProtectedImage` behaviors, such as right-click protection, on the original image.

## Rollout

1. Build on this branch. Test locally against the dev database.
2. Staging (shares the dev DB): render everything from the admin page, check every grid and artwork page.
3. Owner's DB step on prod: the new `Artwork` field, the `SiteSettings` flag, and **`Exhibition.benchSettings`**. The paused bench work (AR-167) lives on the same branch by the owner's choice, so it ships with this release. Exhibition queries select every column, so prod 500s without that column. The bench Furniture panel is hidden behind a switch until benches are ready. The Design Connected bench models are never committed.
4. Release with the switch **off**. The site looks exactly as today.
5. Owner opens the admin page on prod and renders everything. Spot-check on prod with the switch still off (an admin-only preview is the builder's call).
6. Switch **on**.

R2: the first upload to production only happens when the owner presses the button in step 5.

## Testing

- **Unit:**
  - seed and PRNG stability (the same id gives the same look, and the draw order is pinned)
  - mode and N resolution
  - fingerprint changes on ratio, mode, N and `LOOK_VERSION`, and only on those
  - window-fraction math
  - AO view factor
- **E2E (Playwright only, no WebGL in e2e):**
  - pages with a seeded presentation record show the surround over the original in the right place
  - pages without one, or with the switch off, look like today
  - admin list statuses
  - the presign route rejects non-admins and bad keys
- **Manual:** owner judges renders on staging.

## Spike cleanup

Delete `src/app/dev/print-render/`, the `?framed=` preview flag, and `public/print-surrounds/` (never committed). The spike's capture scripts live outside the repo.

## Decided by Claude (owner to check)

- The limited-vs-framed rule in section 2, from the owner's "treat not-yet-sold as open editions".
- The bench work ships hidden on the same branch (owner: "use the same bench branch").

- The admin's browser renders, because Vercel has no GPU. This reuses the bake upload machinery.
- Two file sizes, 1800 and 900 px, WebP with alpha.
- Limited N from the `order: 0` variant. A limited artwork with no variant yet shows as framed.
- The go-live switch lives in `SiteSettings`.
- New artist uploads wait for the admin's render button and show today's image until then.
- The field and setting names above are suggestions.

## Left to the builder

Module layout, how the admin page hosts the canvas (one re-keyed canvas or a fresh one per artwork), retry/backoff on uploads, and where exactly in the grid and artwork queries the field is selected.
