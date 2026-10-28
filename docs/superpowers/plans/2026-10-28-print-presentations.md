# Print Presentations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every artwork in every grid and on every artwork page as a photo of the real print: framed (open, or not for sale) or a numbered paper sheet (limited). The renders come from the admin's Chrome and are stored in R2.

**Architecture:**
- Pure modules in `src/lib/printPresentation/` hold the approved look, the per-artwork inputs and fingerprint, and the geometry. The spike's R3F scene becomes `PrintStudio`, which only the admin page uses.
- The admin page renders missing or out-of-date artworks one at a time in the browser, uploads two WebP sizes by presigned PUT (the room-bake pattern), and saves `Artwork.printPresentation`.
- Public pages ask `getPrintPresentations(ids)` for fresh records, gated by the `SiteSettings.printPresentationsEnabled` switch. `PrintPresentation` lays the surround over the unchanged original image.

**Tech Stack:** Next.js 16 (App Router), React 19, R3F 9 / drei 10 / three 0.175, Prisma (`db push` workflow), Cloudflare R2 (S3 SDK presign), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-print-presentations-design.md`. Read it first. Its "The look (APPROVED, locked)" section is binding.

## Global Constraints

- 🔒 The artwork image is never in the render and never altered. The surround has a transparent window, and the page places the original low-res file under it.
- The approved look is frozen. Move code from `src/components/printRender/PrintRenderSpike.tsx` as is: same constants, same seeded ranges, same PRNG draw order. Never retune. New PRNG draws are appended only. `WALL_IRRADIANCE = Math.PI * 0.995`, `SoftShadows size 180–300 samples 128`, `FRAMED_IMAGE_LONG_M = 0.5 + 2 * (0.045 + 0.003)`. The wood is `wooden-frame-medium` for every open edition.
- **No commits.** The owner's rule: "never commit unless the user explicitly says to commit". Each task ends with a report, not a commit. Never push. Never open PRs.
- Work on the current branch `feat/AR-167-improve-3d-experience`. Its uncommitted AR-167 bench work stays as it is; don't revert or "tidy" it.
- Database: edit `prisma/schema.prisma`, then run `pnpm db:generate`. Never run `db push` or any migrate command, and never suggest one. Ask the owner to run their DB step. Use only the dev/QA database.
- No new npm packages.
- Tests are Playwright specs in `e2e/` only. No unit-test frameworks. No WebGL in e2e. Pure-module specs import from `@/lib/...`, like `e2e/bake-fingerprint.spec.ts`.
- Dev server port is 3001, never 3000. The e2e config spawns its own server on 3001, so stop the running dev server before `pnpm test:e2e`.
- No R2 writes from development: test locally with `BAKE_STORAGE=local`. The first production upload happens only when the owner presses Render on prod.
- UI rules:
  - American spelling, no emoji (lucide icons), the `Button` component rather than a plain `<button>`
  - no `var()` fallbacks, no `!important`
  - client-facing UI is squared
  - never commit anything under `public/` (`public/print-surrounds/` is spike output)
- The 3D-room artwork pop-up (`ArtworkModal`) keeps the plain low-res image "for now". It must never receive a presentation.

## Review Focus

1. **Artwork not eligible** (not an image, or no `originalWidth`/`originalHeight`): no presentation, the page renders exactly as today, the admin list says "Not eligible", and Render all skips it. Pinned in Task 1 (`presentationInputs` → `null`) and Task 6 (status `ineligible`).
2. **Image replaced, or sale settings changed after rendering** (new ratio, `printEnabled` toggled, limited `editionSize` edited): the old record is out of date, and the public page falls back to the plain image instead of the wrong frame or wrong N. Pinned in Task 1 (the fingerprint changes) and Task 5 (stale record → plain).
3. **Render interrupted** (tab closed, an upload fails, the artwork is deleted mid-batch): no half-saved record, the row keeps its previous status, and the batch moves on. Pinned in Task 4 (PUT for an unknown artwork → 404; PUT with a non-current fingerprint → 409) and Task 6 (failed rows marked, queue continues).
4. **Extreme proportions** (panorama 4:1, tall 1:4): the window fractions stay inside (0, 1) and keep the image's aspect. Pinned in Task 2.
5. **Switch off but records present**: public pages show today's markup exactly, while the admin list still previews them. Pinned in Task 5 and Task 6.

---

### Task 1: The look and the per-artwork inputs (pure)

**Files:**
- Create: `src/lib/printPresentation/look.ts`
- Create: `src/lib/printPresentation/inputs.ts`
- Test: `e2e/print-presentation-look.spec.ts`

**Interfaces:**
- Produces (`look.ts`):
  - `export const LOOK_VERSION = 1`
  - `export type PresentationMode = 'framed' | 'limited'`
  - `export type Vec3 = [number, number, number]`
  - `export type Look`: the spike's `Look` type, unchanged. Fields: `key, keyShare, fills, softness, standoff, setBack, cornerLift, edgeLift, woodOffset, woodTileM, copy, barOffsets`.
  - `export const random: (seed: number) => () => number` (mulberry32, from the spike)
  - `export function makeLook(seed: number, mode: PresentationMode, edition: number): Look` (from the spike)
  - `export function seedForArtwork(artworkId: string): number`: 32-bit FNV-1a over the id, unsigned. Use `fnv1a` from `src/lib/bake/hash.ts` via `parseInt(fnv1a(id), 16)` if that yields the pinned value below; otherwise implement it inline.
- Produces (`inputs.ts`):
  - `export type PresentationSource = { id: string; artworkType: string | null; originalWidth: number | null; originalHeight: number | null; printEnabled: boolean; editionType: string; firstVariantEditionSize: number | null }`
  - `export type PresentationInputs = { mode: PresentationMode; edition: number | null; ratio: number; seed: number; fingerprint: string }`
  - `export function presentationInputs(src: PresentationSource): PresentationInputs | null`

- [ ] **Step 1: Pin the spike before moving anything.** Run a throwaway node/tsx snippet against the spike's current `makeLook`, and paste the JSON of `makeLook(1133590978, 'limited', 50)` and `makeLook(2812886702, 'framed', 50)` into the spec as `PINNED_LIMITED` and `PINNED_FRAMED`.

- [ ] **Step 2: Write the failing spec** `e2e/print-presentation-look.spec.ts`:
  - `seedForArtwork('683e76c1-2c50-4ed0-93d1-444fa8edef7f') === 1133590978` and `seedForArtwork('b30d64e2-4b49-418a-8b06-f25c20f22b6b') === 2812886702`
  - `makeLook(1133590978,'limited',50)` deep-equals `PINNED_LIMITED`, and the same for framed
  - `makeLook` returns `copy` in `[1, edition]` for 200 seeds
  - `presentationInputs`:
    - open + printEnabled → `framed`, `edition: null`
    - limited + printEnabled + `firstVariantEditionSize: 50` → `limited`, `edition: 50`
    - limited + `printEnabled: false` → `framed`
    - limited + no variant → `framed`
    - `artworkType: 'video'` → `null`
    - `originalWidth: null` → `null`
  - `ratio` is `originalWidth/originalHeight` rounded to 4 dp
  - `fingerprint` changes when ratio, mode or edition changes, and is equal for identical sources
  - ratio 4 and 0.25 return non-null inputs

- [ ] **Step 3: Run it.** `npx playwright test e2e/print-presentation-look.spec.ts` → FAIL (modules missing).

- [ ] **Step 4: Implement both modules.**
  - `fingerprint = fnv1a(canonicalJson([LOOK_VERSION, mode, edition, ratio4, seed]))`, using `canonicalJson` and `fnv1a` from `src/lib/bake/hash.ts`.
  - Point `PrintRenderSpike.tsx` at `look.ts`: delete its local copies and import them, so the dev studio keeps working.

- [ ] **Step 5: Run it again.** Same command → PASS. `pnpm typecheck` is clean.

- [ ] **Step 6: Report** to the owner what changed. No commit.

---

### Task 2: Studio geometry (pure)

**Files:**
- Create: `src/lib/printPresentation/geometry.ts`
- Test: `e2e/print-presentation-geometry.spec.ts`

**Interfaces:**
- Produces:
  - The spike's dimension constants, exported unchanged: `IMAGE_LONG_M, FRAME_FACE_M, FRAME_DEPTH_M, LIP_OVERLAP_M, FRAMED_IMAGE_LONG_M, PAPER_BORDER_M, PAPER_BOTTOM_M, PAPER_THICKNESS_M, WALL_IRRADIANCE, SHADOW_MARGIN, FOV, WOOD_BOUNCE, EASE_M`
  - `export function imageSize(ratio: number, long?: number): [number, number]`
  - `export function outerSize(mode: PresentationMode, ratio: number): [number, number]`
  - `export function shotSize(mode: PresentationMode, ratio: number, widthPx: number): { widthPx: number; heightPx: number; distance: number }`: camera distance and canvas height, from the spike
  - `export function frameOcclusion(o: { sheetW: number; sheetH: number; openW: number; openH: number; wallH: number; texels: number }): Uint8Array`: RGBA, from the spike's `useFrameOcclusion` body
  - `export function paperLift(look: Look, iw: number, ih: number): (x: number, y: number) => number`: from `usePaperSheet`
  - `export type PresentationWindow = { x: number; y: number; w: number; h: number }`: fractions of the shot
  - `export function windowFractions(rectPx: { x: number; y: number; w: number; h: number }, canvasW: number, canvasH: number): PresentationWindow`
- Consumes: `Look`, `PresentationMode` (Task 1).

- [ ] **Step 1: Write the failing spec:**
  - `outerSize('framed', 1.5)[0]` ≈ 0.75 (±1e-9), `outerSize('limited', 1.5)[0]` ≈ 0.62
  - `frameOcclusion` with sheetW 0.716, sheetH 0.5333, openW 0.71, openH 0.5273, wallH 0.02, texels 256:
    - the centre texel's red channel ≥ 254
    - the texel nearest the left wall at mid-height < 190
    - red increases monotonically along a mid-row from x = 0 to the centre
  - `paperLift(look, 0.5, 0.333)(0, 0) === 0`, and it is 0 at `(0.2499, 0)`
  - `windowFractions({x:150,y:100,w:900,h:600},1200,800)` deep-equals `{x:0.125,y:0.125,w:0.75,h:0.75}`
  - For ratios 4 and 0.25: the image size projected through `shotSize` gives fractions all in (0, 1), with `w/h` × canvas aspect within 0.5% of the ratio

- [ ] **Step 2: Run it.** `npx playwright test e2e/print-presentation-geometry.spec.ts` → FAIL.

- [ ] **Step 3: Implement it** by moving code out of `PrintRenderSpike.tsx`, then import it back into the spike.

- [ ] **Step 4: Run again** → PASS. `pnpm typecheck` is clean.

- [ ] **Step 5: Report.** No commit.

---

### Task 3: `PrintStudio`: the approved scene as a component

**Files:**
- Create: `src/components/printPresentation/studio/PrintStudio.tsx` (Canvas, lights, wall, piece selection, ready detection)
- Create: `src/components/printPresentation/studio/StudioFrame.tsx` (`useWood`, `barGeometry`, `StudioFrame`, `Framed`)
- Create: `src/components/printPresentation/studio/PaperSheet.tsx` (`Limited`, curled sheet, pencil number)
- Create: `src/components/printPresentation/studio/ArtworkWindow.tsx`
- Modify: `src/app/dev/print-render/page.tsx` (renders `PrintStudio` from URL params and keeps the `window.__printRenderWindow` / `__printRenderReady` globals for the capture script)
- Delete: `src/components/printRender/PrintRenderSpike.tsx`

**Interfaces:**
- Produces:
  - `export type StudioShot = { canvas: HTMLCanvasElement; window: PresentationWindow }`
  - `export function PrintStudio(props: { ratio: number; mode: PresentationMode; edition: number | null; seed: number; widthPx: number; onReady: (shot: StudioShot) => void }): JSX.Element`
  - `onReady` fires once: after Suspense resolves (textures, font) and at least 3 frames have rendered. The window rect comes from projecting the window mesh, converted with `windowFractions`.
  - The Canvas uses `flat`, `shadows`, `dpr={1}`, `gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}`, sized by `shotSize`.
- Consumes: Tasks 1–2.

- [ ] **Step 1: Split the spike** into the files above, behavior unchanged. `mode === 'limited'` requires `edition`; a null edition with limited mode is a programming error, so throw.

- [ ] **Step 2: Verify the visuals against the approved renders.** With `pnpm dev` on 3001, run the capture script (`.superpowers/prints/tools/printshot.mjs`, or the copy in the session scratchpad) for:
  - `framed-683e76c1-2c50-4ed0-93d1-444fa8edef7f` (w 6240, h 4160, seed 1133590978)
  - `limited-b30d64e2-4b49-418a-8b06-f25c20f22b6b` (w 6240, h 4160, seed 2812886702)

  Compare with `public/print-surrounds/<same name>.png`: `magick compare -metric RMSE a.png b.png null:` must report < 0.5%. Grain noise from PCSS sampling is allowed; any visible change is not.

  Also check the shot's outer edge (the spec's white-wall rule): the outermost row and column of each render all have R, G and B ≥ 251.

- [ ] **Step 3: Run checks.** `pnpm typecheck` and `pnpm lint` are clean.

- [ ] **Step 4: Report** with the two RMSE numbers. No commit.

---

### Task 4: Data model, record, storage, admin API

**Files:**
- Modify: `prisma/schema.prisma`:
  - `Artwork`: `printPresentation Json?`, with a comment pointing at `src/lib/printPresentation/record.ts`
  - `SiteSettings`: `printPresentationsEnabled Boolean @default(false)`
- Create: `src/lib/printPresentation/record.ts`
- Modify: `src/lib/settings.ts`: getter and setter for the switch
- Modify: `src/lib/r2.ts`: `buildPresentationKey`
- Create: `src/lib/printPresentation/storage.ts`
- Create: `src/lib/printPresentation/loadSources.ts`
- Create: `src/app/api/presentation-files/[...key]/route.ts` (dev-only local backend, mirrors `api/bake-files`)
- Create: `src/app/api/admin/print-presentations/[artworkId]/uploads/route.ts`
- Create: `src/app/api/admin/print-presentations/[artworkId]/route.ts`
- Modify: `src/app/api/artworks/[id]/route.ts` (DELETE also removes presentation files)
- Modify: `scripts/reconcile-r2.ts` (the presentation URLs count as referenced)
- Test: `e2e/print-presentation-api.spec.ts`

**Interfaces:**
- Produces:
  - `export type PresentationSize = 'large' | 'small'`, and `export const PRESENTATION_WIDTH_PX = { large: 1800, small: 900 } as const`
  - `export type PrintPresentationRecord = { fingerprint: string; mode: PresentationMode; edition: number | null; window: PresentationWindow; urls: Record<PresentationSize, string>; renderedAt: string }`
  - `export function isPrintPresentationRecord(x: unknown): x is PrintPresentationRecord`. The window fractions must be finite and in [0, 1].
  - `getPrintPresentationsEnabled(): Promise<boolean>` and `setPrintPresentationsEnabled(enabled: boolean): Promise<void>` in `settings.ts`, same shape as `purchasesPaused`
  - `buildPresentationKey(artworkId: string, fingerprint: string, size: PresentationSize): string` → `${getEnvPrefix()}/presentations/${artworkId}/${fingerprint}-${1800|900}.webp`
  - `createPresentationUploads(artworkId: string, fingerprint: string): Promise<Record<PresentationSize, { url: string; publicUrl: string }>>`
    - local backend (`bakeBackend() === 'local'`): `/api/presentation-files/presentations/{artworkId}/{fingerprint}-{px}.webp`
    - R2: `getPresignedUploadUrl(key, 'image/webp', 3600, BAKE_CACHE_CONTROL)` plus `publicUrlForKey`
  - `presentationPublicUrls(artworkId: string, fingerprint: string): Record<PresentationSize, string>`
  - `deletePresentationFiles(record: PrintPresentationRecord, artworkId: string): Promise<void>`
  - `type SourceRow = PresentationSource & { record: PrintPresentationRecord | null; title: string; artistName: string; imageUrl: string | null }`
  - `loadPresentationSources(where?: { ids?: string[] }): Promise<SourceRow[]>`: one query; `firstVariantEditionSize` comes from `limitedVariants: { where: { order: 0 }, select: { editionSize: true }, take: 1 }`. It does not reuse `SALE_SELECT`, whose variant filter is different.
  - `POST /api/admin/print-presentations/[artworkId]/uploads`, body `{ fingerprint }`:
    - 200 `Record<PresentationSize, { url, publicUrl }>`
    - 401/403 for non-admins (`requireAdminOrAbove`)
    - 404 for an unknown or ineligible artwork
    - 409 when the fingerprint ≠ `presentationInputs(source).fingerprint`
  - `PUT /api/admin/print-presentations/[artworkId]`, body `{ fingerprint, window }`. The server builds the record itself: urls from `presentationPublicUrls`, mode and edition from the inputs, `renderedAt` now. Clients never send URLs.
    - 409 for a stale fingerprint, 400 for an invalid window, 404 for an unknown artwork
    - On success it saves; if the previous record had a different fingerprint, it deletes the previous files after the save; it returns 200 `{ record }`
- Consumes: Tasks 1–2.

- [ ] **Step 1: Edit the schema and generate.** Run `pnpm db:generate`, then ask the owner to run their DB step on the dev database before Step 4.

- [ ] **Step 2: Write the failing spec** `e2e/print-presentation-api.spec.ts`, modelled on `e2e/bake-api.spec.ts`: flat API, no WebGL, cleanup in `afterAll` that restores `printPresentation` to null and deletes files. Cases:
  - unauthenticated POST → 401
  - admin POST with fingerprint `'nope'` → 409
  - admin POST with the current fingerprint (from `loadPresentationSources({ids:[id]})` + `presentationInputs`) → both URLs end in `-1800.webp` / `-900.webp`
  - PUT the 1-px WebP fixture to both URLs → 200
  - PUT the record → 200, and the DB row's `printPresentation` passes `isPrintPresentationRecord` with `urls.small` ending in `-900.webp`
  - PUT with `window.x = 1.2` → 400
  - PUT for id `'00000000-0000-0000-0000-000000000000'` → 404
  - `isPrintPresentationRecord` rejects a missing `urls.large` and a NaN window

- [ ] **Step 3: Run it.** `BAKE_STORAGE=local npx playwright test e2e/print-presentation-api.spec.ts` → FAIL.

- [ ] **Step 4: Implement** the files above.

- [ ] **Step 5: Run again** → PASS. `pnpm typecheck` and `pnpm lint` are clean. Run `npx playwright test e2e/artwork-delete-cascade.spec.ts` → PASS.

- [ ] **Step 6: Report**, including the DB step the owner ran. No commit.

---

### Task 5: Show presentations on every grid and artwork page

**Files:**
- Create: `src/lib/printPresentation/getPrintPresentations.ts`
- Create: `src/components/printPresentation/PrintPresentation.tsx` and `PrintPresentation.module.scss`
- Modify: `src/lib/queries/getPublicExhibitionByUrl.ts` (`PublicExhibitionArtwork.presentation`)
- Modify: `src/lib/queries/getPublicArtistByHandler.ts` (`PublicArtistArtwork.presentation`)
- Modify: `src/lib/queries/getGallerySelection.ts` (`GallerySelectionCard.presentation`, public selection only)
- Modify: `src/app/artworks/[slug]/page.tsx` and `src/components/artwork/detail/index.tsx` (pass `presentation` through)
- Modify: `src/components/artwork/ArtworkGrid/index.tsx` (replace the spike wrapper)
- Modify: `src/components/artwork/detail/ArtworkDetailBody.tsx` (replace the spike wrapper)
- Delete: `src/components/printRender/PrintPresentationPreview.tsx`
- Test: `e2e/print-presentation-pages.spec.ts`

**Interfaces:**
- Produces:
  - `export type PresentationView = { window: PresentationWindow; small: string; large: string }`
  - `export async function getPrintPresentations(artworkIds: string[]): Promise<Record<string, PresentationView>>`: returns `{}` when the switch is off; otherwise only records whose fingerprint equals the current `presentationInputs` fingerprint
  - `export function PrintPresentation(props: { view: PresentationView | null | undefined; size: PresentationSize; maxWidth?: number; children: ReactNode }): JSX.Element`
    - `view` null → returns `children` exactly as today
    - otherwise:
      - a wrapper `div[data-print-presentation]` at width 100%
      - the surround `img` (alt "", `aria-hidden`, `pointer-events: none`), in flow, sizing the card
      - a window `div` absolutely placed at the fractions, holding `children`, which fill it (width/height 100%)
  - `ArtworkGrid`'s `Artwork` type gains `presentation?: PresentationView | null` and uses size `small`
  - `ArtworkDetailBody` gains the prop `presentation?: PresentationView | null`, size `large`, `maxWidth` 860. `ArtworkModal` never passes it (leave a one-line comment with the owner's reason).
- Consumes: Tasks 1, 2, 4.

- [ ] **Step 1: Write the failing spec**, serial mode. Seed one fixture artwork's `printPresentation` directly via prisma with the current fingerprint, urls `/e2e-missing-surround-{small|large}.webp`. Nothing goes into `public/`; the 404 doesn't matter, because the assertions are on the DOM, and window `{x:0.2,y:0.2,w:0.6,h:0.6}`. Then:
  - Switch on, the fixture's exhibition grid: that card has `[data-print-presentation]`; its surround `img` src ends with the small URL; the window `div`'s computed `left`/`top` = 20% of the wrapper; the original image `src` is unchanged and sits inside the window
  - Switch on, the artwork page: the surround src ends with the large URL
  - Switch off: neither page has `[data-print-presentation]`
  - Record with fingerprint `'stale'`, switch on: no `[data-print-presentation]`
  - Artist profile and `/prints` (if the fixture is selected; otherwise skip with a reason): the card has `[data-print-presentation]`
  - `afterAll` restores the switch and the record

- [ ] **Step 2: Run it.** `npx playwright test e2e/print-presentation-pages.spec.ts` → FAIL.

- [ ] **Step 3: Implement it.** Each query calls `getPrintPresentations` once with its artwork ids and sets `presentation: map[id] ?? null`. Keep `ProtectedImage` and the detail page's raw `<img>` as they are, only filling the window.

- [ ] **Step 4: Run again** → PASS. Then `pnpm test:e2e:gallery` → no new failures. Specs already failing before this task must be named in the report.

- [ ] **Step 5: Report.** No commit.

---

### Task 6: Admin "Print presentations" page and render queue

**Files:**
- Create: `src/app/admin/print-presentations/page.tsx`, with metadata title `Print presentations — The Art Room Admin`, robots noindex
- Create: `src/app/admin/print-presentations/actions.ts`
- Create: `src/components/admin/print-presentations/index.tsx` (list, counts, switch, buttons)
- Create: `src/components/admin/print-presentations/RenderQueue.tsx`
- Create: `src/components/admin/print-presentations/capture.ts`
- Modify: `src/components/admin/dashboard/index.tsx` (link to `/admin/print-presentations`)
- Test: `e2e/admin-print-presentations.spec.ts`

**Interfaces:**
- Produces:
  - `export type PresentationStatus = 'missing' | 'current' | 'stale' | 'ineligible'`
  - `export type PresentationRow = { artworkId: string; title: string; artistName: string; imageUrl: string | null; status: PresentationStatus; inputs: PresentationInputs | null; view: PresentationView | null }`. `view` is present whenever a record exists, regardless of the switch; it is the admin's spot-check preview.
  - `listPrintPresentations(): Promise<{ ok: true; rows: PresentationRow[] } | { ok: false; error: string }>` (`requireAdminAction`)
  - `setPrintPresentationsSwitch(enabled: boolean): Promise<{ ok: true; enabled: boolean } | { ok: false; error: string }>`
  - `capture.ts`:
    - `supportsWebpAlpha(): Promise<boolean>`: encodes a 2×2 transparent canvas with `toBlob('image/webp')` and checks `blob.type === 'image/webp'`
    - `encodeShot(canvas: HTMLCanvasElement): Promise<Record<PresentationSize, Blob>>`: the large size is the canvas itself; the small size is drawn into a 900-wide 2D canvas (`imageSmoothingQuality = 'high'`); both use `toBlob('image/webp', 0.92)`
  - `RenderQueue`: `({ jobs, onRowDone, onFinished }: { jobs: PresentationRow[]; onRowDone: (artworkId: string, result: 'saved' | 'failed', error?: string) => void; onFinished: () => void })`
    - mounts one `PrintStudio` at a time, `key={artworkId}`, inside an offscreen fixed container (`left: -10000px`, never `display: none`), with `widthPx` 1800
    - on `onReady`: encode, POST uploads, PUT both blobs (headers like `bakeUploadHeaders` but `image/webp`), PUT the record, then unmount and take the next job
    - stop button: finishes the current job, then stops
- UI:
  - counts per status, the switch (`Toggle`), and a "Render missing and out of date" button
  - per row: the preview (`PrintPresentation` size small, or the plain thumbnail), status label (Missing / Up to date / Out of date / Not eligible), and a "Re-render" button
  - progress "n of N", and failed rows show their error
  - if `supportsWebpAlpha()` is false, the buttons are disabled with: "Rendering needs Chrome."
- Consumes: Tasks 1–5.

- [ ] **Step 1: Write the failing spec** (no WebGL; never presses Render):
  - an admin opens `/admin/print-presentations` and sees the counts plus the fixture row
  - a fixture with a current record shows "Up to date"; with fingerprint `'stale'` it shows "Out of date"; a video artwork, if the fixtures have one, shows "Not eligible"
  - toggling the switch flips `SiteSettings.printPresentationsEnabled` (read back via prisma), then restore
  - the artist login is redirected away from the page

- [ ] **Step 2: Run it.** `npx playwright test e2e/admin-print-presentations.spec.ts` → FAIL.

- [ ] **Step 3: Implement it.**

- [ ] **Step 4: Run again** → PASS. Typecheck and lint are clean.

- [ ] **Step 5: Manual render check**, with `BAKE_STORAGE=local` and Chrome on `pnpm dev`:
  1. Render the Florescere artworks from the admin page.
  2. Confirm the WebP files land under the local presentation root.
  3. Turn the switch on and compare the exhibition grid and an artwork page with the approved spike look (`?framed=1` screenshots in `.superpowers/prints/`).
  4. Close the tab mid-batch: no row is half-saved, and the next run continues.
  5. Report the time per artwork.

- [ ] **Step 6: Report** with screenshots. No commit.

---

### Task 7: Hide the benches, remove the spike, full verification

**Files:**
- Modify: `src/components/scene/spaces/objects/Bench/benchSettings.ts`: add `export const FURNITURE_PANEL_ENABLED = false`, with a comment that benches are paused (owner: "we will refine later") and that Design Connected has OK'd web use
- Modify: `src/components/editview/Menu/Menu.tsx`: the Furniture button renders only when `FURNITURE_PANEL_ENABLED`
- Delete: `src/app/dev/print-render/` (both files), and `public/print-surrounds/` (untracked spike output)
- Modify: memory `project_print_render_presentation.md` (state: built, not committed)

- [ ] **Step 1: Confirm the spike is gone.** `grep -rn "framed=\|PrintPresentationPreview\|PrintRenderSpike\|print-surrounds" src` → no matches.

- [ ] **Step 2: Run the checks.** `pnpm lint`, `pnpm typecheck`, and `pnpm build` (the local prod build) all pass.

- [ ] **Step 3: Run e2e.** Stop the dev server, then run:
  ```
  npx playwright test e2e/print-presentation-*.spec.ts e2e/admin-print-presentations.spec.ts e2e/bake-fingerprint.spec.ts
  pnpm test:e2e:gallery
  ```
  → all pass, or the failures already present before this work are listed.

- [ ] **Step 4: Report to the owner and ask about committing.** The report covers:
  - what's ready
  - the DB step needed on prod: `Artwork.printPresentation`, `SiteSettings.printPresentationsEnabled`, `Exhibition.benchSettings`
  - that the bench work ships hidden

  Then ask whether to commit. Commit only on their explicit "commit".

---

## Rollout (after the owner's commit, release and merge; not implementer tasks)

1. The owner runs their prod DB step: `Artwork.printPresentation`, `SiteSettings.printPresentationsEnabled`, `Exhibition.benchSettings`.
2. Release with the switch off. The site is unchanged.
3. The owner opens `/admin/print-presentations` on prod in Chrome and presses Render. This is the first production R2 upload, by the owner's hand.
4. Spot-check the previews on the admin list, then switch on.
