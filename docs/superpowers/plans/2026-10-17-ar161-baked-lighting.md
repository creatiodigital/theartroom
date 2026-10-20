# Baked Lighting for Every 3D Exhibition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revised 2026-10-18** for the spec revision (per-space rules, fixed camera per space, deterministic bake, file-exact artwork images, bake preview link). Tasks 1–2 are done; Tasks 3–5 are new; the old Tasks 3–18 are renumbered 6–22 (new: Task 10, the bake preview link).

**Goal:** Admins bake each exhibition's light once on their own machine, review it, share a bake preview link when needed, and publish it; every visitor in every space (Madrid, Paris, Vienna) gets that reviewed lighting with no bake, no draft view and no stale cache — and every exhibition in a space shares the space's one look and one camera.

**Architecture:** The spike's `LightBaker` stays the engine. A bake runs only in an admin-only "bake mode" of the visit page, encodes its lightmaps to PNG, stores them under a new bake id (local origin storage today, R2 once reachable), and saves a draft `BakeRecord` (with a fingerprint of everything that changes light) on `Exhibition.bake`. The review view and the bake preview link show the latest draft + that bake only while the fingerprint still matches; publishing copies the record into `publishedSnapshot` and is refused unless the bake is current and was reviewed. Visitors decode the published maps inside the scene's Suspense and apply them with the same material code the bake uses, with the space's fixed camera.

**Tech Stack:** Next.js App Router, React Three Fiber / three 0.175, Prisma (Postgres), Cloudflare R2 (S3 SDK, presigned PUT), Playwright (`e2e/`, no WebGL specs).

**Spec:** `docs/superpowers/specs/2026-10-17-ar161-baked-lighting-design.md` (read it first — especially "Per-space rules" and "Review and the bake preview link"; this plan argues from it).

## Global Constraints

- Branch `feat/AR-161-improve-realism` only. **Commit only when Eduardo says "commit"; never push without his word; never open PRs** (base would be `develop`). No `Co-Authored-By` lines.
- **`.env.local` points at the PROD DB** (backup `.env.local.bak.prod-peek-2026-10-16`). Eduardo keeps it there while he looks at the prod exhibitions; he runs `/restore-dev-db` himself. **No task that writes to a DB (schema sync, e2e runs, saving a bake) starts before he confirms the dev DB.** Phase A is read-only and may run as is.
- Schema: edit `prisma/schema.prisma` only. Never run or suggest a migration command; tell Eduardo "Schema updated — run your migration + client regen flow when ready" (he may authorize `pnpm db:push:dev` + `pnpm db:generate`). Prod sync (`pnpm db:push:prod`) is his, before the release.
- No new packages. Tests are Playwright specs in `e2e/` (pure Node assertions are fine inside them); **no spec may mount WebGL** (no `/visit`, no `/edit` page loads in e2e). Login rate limit: ~4 suite runs per 15 min.
- Physically based, always: no exposure raise, no auto camera (the space's fixed camera), no invisible lights, tints or gains; bloom stays on lamps and windows (realistic glare).
- **Artwork images show exactly their file** (sine qua non): never route them through lighting, exposure, white balance, tone mapping or bloom. Every task that touches the render path re-runs the per-artwork file comparison (`sweep.mjs`) on every exhibition of the affected spaces.
- **The approved looks** (spec, "What exists"): Paris + Vienna = the space query (`scratchpad/shoot/final.q`: approved flags + `ar161seed=1&ar161spacecamera=1`); Madrid = its approved flags until its re-check (Task 4). `ar161fullbounce=1&ar161bounces=8` is part of the approved look — do NOT delete it.
- Per-space constants live with the space (`spaceConfigs` in `src/components/scene/constants.tsx`): `camera` (Paris `{ exposure: 0.524, whiteBalance: [0.933, 1.01, 1.135] }`, Vienna `{ exposure: 0.588, whiteBalance: [0.916, 1.014, 1.153] }`, Madrid after Task 4) and, from Task 19, the look/ratings.
- Every visual change is judged by Eduardo's eye on live localhost links (one link with every fix, each verified by a bake + a measurement before it is sent); before a space is called done, the full sweep runs on every exhibition in it.
- **Storage today (2026-10-18, R2 unreachable from Spain on La Liga match days):** files are stored and served by the app itself; tomorrow they move to Cloudflare R2. Nothing is pushed until R2 holds `paris22_noq.glb`, the `parquet-whitewash` floor and the plaster maps. **(Pending Eduardo's confirmation of this reading — spec "Still open".)**
- UI copy: American spelling; squared controls; black CTAs; red `#bd1622` only in the monogram mark.
- Never commit images in `public/` (plaster maps, `parquet-whitewash`, `paris22.glb`).
- Before any push: `pnpm typecheck && pnpm lint`, `pnpm test:e2e` (stop `pnpm dev` first), then `pnpm build && pnpm start -p 3001` and walk the changed routes.

## Review Focus

1. **A visitor must never receive the draft bake.** The public `by-url` branch spreads the LIVE row (`...exhibition`) and overrides 3D fields from the snapshot one by one — `bake` must be overridden from the snapshot too, or every admin bake goes live before review. Pinned in Task 7.
2. **A bake preview link on a LIVE exhibition must not change what visitors see, and must never show a mismatched room.** Only a request with the valid token gets draft data + draft bake; a stale or missing bake answers `bakeStatus: 'stale' | 'missing'` with no lightmaps. Pinned in Task 10.
3. **An artist saves while the admin's bake runs.** The bake carries the fingerprint fetched at its start, so it is stale on arrival and review, preview and publish must refuse it. Pinned in Task 9.
4. **A text-only edit (title, description, page order, sections) must not stale the bake**, or every typo forces a rebake of minutes. Pinned in Task 6.
5. **The admin closes the tab or the display sleeps mid-bake.** Nothing partial may be saved: the draft is written only after every stored file is verified. Pinned in Task 8.

---

## Phase A — One look and one camera per space (on the spike, with Eduardo; read-only)

Uses the spike's URL-flag links on prod data (read-only visit pages). Tooling: session scratchpad `shoot/` (`sweep.mjs` with `VIEWS=vienna.views.json` for Vienna, `multicam.mjs`, `detcheck.sh`, `sampling.mjs`, `bloomcheck.mjs`, `meterside.mjs`, `artpeak.mjs`, `vgeo.mjs`, `vplan.mjs`, `vsunray.mjs`; copy forward from session `5b13370d…/scratchpad/shoot`). Headless bakes only advance while the Mac's display is awake and the dev server on :3001 is up.

### Task 1: Paris — DONE (approved 2026-10-18, "perfect", Permanence + Kritzendorf, same settings)

Fixes and their causes: recipe memory #24–31. Kept here for the record only.

### Task 2: Vienna — DONE (approved 2026-10-18, "perfect… I love it", Florescere)

Fixes made for Vienna (shared code, all spaces): recessed spotlights at their bulb's true world position (`RecessedLamp.tsx`, `worldMatrixOf`; a production bug today); the sun ignores casters more than `PORTAL_WALL_DEPTH` (0.5 m) outside a window's glass (`DISTANCE_FRAGMENT` `uOutside*`); the meter counts only light from the front (`spotIrradiance`, `max(n·L, 0)`). Paris re-swept identical after each.

### Task 3: Fixed camera per space + deterministic bake — BUILT, verification left

**Files (done, uncommitted):** `src/components/scene/bake/LightBaker.ts` (`SEEDED`, `seededRandom`, `this.random` reset in `prepare()`), `src/components/scene/bake/LoadTimeBake.tsx` (`SPACE_CAMERA`, `spaceCamera`, meter log `camera`/`meteredExposure`), `src/components/scene/spaces/types.ts` (`SpaceConfig.camera`), `src/components/scene/constants.tsx` (Paris and Vienna values).

- [x] Seeded bake proven: Permanence ×2 and Florescere ×2 → identical meter, 0 differing pixels.
- [x] Permanence sweep with `final.q`: camera `space` 0.524 = metered 0.524; 26/26 file-true, residuals unchanged.
- [ ] **Step 1:** Sweeps of Kritzendorf (`finalk.q`) and Florescere (`finalk.q`, `VIEWS=vienna.views.json`) once the dev server is back. Expected: Kritzendorf meter `camera: "space"`, exposure 0.524, WB [0.933, 1.01, 1.135] (its metered value is logged next to it); 40/40 file-true; Florescere identical to its seeded bake (0.588); 50/50 file-true; every view clean.
- [ ] **Step 2:** Send Eduardo the three links (one per exhibition); his eye decides.
- [ ] **Step 3: Commit** only on his word.

### Task 4: Madrid re-check under the per-space rules

**Files:** none expected (flags only); shared-code fixes only if a measurement demands one.

- [ ] **Step 1: Candidate link** = Madrid's approved flags + the space-independent rules: `ar161floor=parquet-whitewash&ar161floorscale=2.07&ar161floornormal=3&ar161floorrefl=0.09&ar161flooroffy=0.04&ar161floortemp=0&ar161ceilingcolor=ffffff&ar161glasson=1&ar161artfile=1&ar161artbounce=1&ar161glare=1&ar161emittervpls=4096&ar161fullbounce=1&ar161bounces=8&ar161seed=1` (+ `ar161sun=5000&ar161sunportal=1&ar161sunaz=360` if Madrid's windows take the sun cleanly — check patches with a top-down view).
- [ ] **Step 2: Full sweep** of Vivrière (Madrid views: entry default, window `[-3.5,1.6,-1,24]`, reverse `[1,1.6,-5.5,180]`, plus corners). Expected: every image file-true; no regressions on the reference numbers (junction −35% ±5%, corners clean).
- [ ] **Step 3:** Eduardo approves (one link, every fix in it). Then freeze Madrid's camera from the seeded bake's meter into `spaceConfigs.madrid.camera` and re-sweep with `ar161spacecamera=1` (identical by construction).
- [ ] **Step 4: Commit** only on his word.

### Task 5: B&W fine-detail sampling (pending Eduardo's go — spec "Still open")

**Files:** `src/components/scene/spaces/objects/Display/Display.tsx` (`configureTexture`), `src/components/scene/bake/LoadTimeBake.tsx` (`patchFileTrue`).

- [ ] **Step 1:** Behind `&ar161artencoded=1`: artwork maps uploaded without sRGB decoding (`NoColorSpace`, mips then average encoded values, like Photoshop/browsers), decoded to linear in the image shader before the file-exact write.
- [ ] **Step 2:** `sampling.mjs` on Kritzendorf #35/#26/#32 at 1, 2 and 3.4 texels per pixel. Expected: render mean = the file's **encoded-space** downscale within ±1 level at every scale (today: +4–5 at 3.4); full sweeps of all exhibitions still file-true.
- [ ] **Step 3:** Link to Eduardo; commit only on his word.

---

## Phase B — Store and gate the bake (server; TDD with Playwright Node specs)

### Task 6: Bake record type and room fingerprint

**Files:**
- Create: `src/lib/bake/bakeRecord.ts`, `src/lib/bake/fingerprint.ts`
- Test: `e2e/bake-fingerprint.spec.ts`

**Interfaces:**
- Produces (`bakeRecord.ts`, isomorphic — no Node imports):
  ```ts
  export const BAKER_VERSION = 1 // bump whenever bake or display code changes the result
  export type BakeSurface = 'wall' | 'ceiling' | 'floor' | 'props'
  export type BakeMapKind = 'light' | 'direction'
  export interface LightmapEncoding { format: 'log8' | 'signed8'; max: number; knee: number }
  export interface BakeMap { receiver: BakeSurface; kind: BakeMapKind; url: string; width: number; height: number; encoding: LightmapEncoding }
  export interface BakeRecord {
    id: string; fingerprint: string; bakerVersion: number; unwrapHash: string
    maps: BakeMap[]
    camera: { exposure: number; whiteBalance: [number, number, number] } // the space's fixed camera at bake time
    bakedAt: string; bakedBy: string; ms: number
    reviewedAt: string | null // set when the admin opened the review view on this exact bake (Task 8)
  }
  export function isBakeRecord(value: unknown): value is BakeRecord
  ```
- Produces (`fingerprint.ts`, server-only — `node:crypto`):
  ```ts
  export const LIGHT_FIELDS: readonly string[]
  export interface BakeFingerprintInput { exhibition: Record<string, unknown>; placed: Record<string, unknown>[]; spaceModelVersion: string; spaceLookVersion: string }
  export function computeBakeFingerprint(input: BakeFingerprintInput): string // sha256 hex
  export async function loadBakeFingerprint(exhibitionId: string): Promise<string>
  ```
- `LIGHT_FIELDS` = only what an artist may still change (spec rule 7) — the space owns the rest, and the renderer ignores those columns, so they must NOT stale a bake: `spaceId, wallColor, ceilingLightMode, trackLampIntensity, recessedLampIntensity, trackLampsVisible, trackLampSettings, panelSettings`. **Pending Eduardo (spec "Still open", question 1):** `windowFrameColor, radiatorColor` (proposed: artist decor → in), and `trackLampColor, trackLampAngle, trackLampDistance, recessedLampColor, recessedLampAngle, recessedLampDistance, trackLampMaterialColor` (proposed: space constants → out).
- `spaceLookVersion` = a short hash of the space's camera + look constants (`spaceConfigs[space].camera` now, plus Task 19's look block), from `src/lib/bake/spaceLookVersion.ts` (isomorphic; imported by the server fingerprint and by the bake). Recalibrating a space therefore stales its bakes.
- Placed rows: every `ExhibitionArtwork` column except `id, exhibitionId, createdAt, updatedAt, showOnPage, pageOrder, sectionId` and the video/sound playback columns; the `artwork` relation reduced to `{ artworkType, hiddenFromExhibition }`; rows sorted by `artworkId`.
- Canonical JSON: keys sorted at every level; `BAKER_VERSION`, `spaceModelVersion` and `spaceLookVersion` included. `spaceModelVersion` = the space GLB path including its `?v=` from the scene's space config; if that module is not server-importable, move the version map into `src/lib/bake/spaceModelVersion.ts` and import it from both sides.

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from '@playwright/test'
import { computeBakeFingerprint } from '@/lib/bake/fingerprint'
import { isBakeRecord } from '@/lib/bake/bakeRecord'

const base = {
  exhibition: { spaceId: 'madrid', wallColor: '#ffffff', mainTitle: 'A', description: 'x' },
  placed: [{ artworkId: 'a1', wallId: 'w1', posX3d: 1, showOnPage: true, pageOrder: 1, artwork: { artworkType: 'image', hiddenFromExhibition: false, title: 'T' } }],
  spaceModelVersion: 'madrid.glb?v=3',
  spaceLookVersion: 'look-1',
}
const fp = (patch: (b: typeof base) => void) => { const b = structuredClone(base); patch(b); return computeBakeFingerprint(b) }

test('stable and 64-hex', () => {
  expect(computeBakeFingerprint(base)).toMatch(/^[0-9a-f]{64}$/)
  expect(computeBakeFingerprint(structuredClone(base))).toBe(computeBakeFingerprint(base))
})
test('light changes stale the bake', () => {
  const f = computeBakeFingerprint(base)
  expect(fp((b) => { b.exhibition.wallColor = '#eeeeee' })).not.toBe(f)
  expect(fp((b) => { b.placed[0]!.posX3d = 1.1 })).not.toBe(f)
  expect(fp((b) => { b.spaceModelVersion = 'madrid.glb?v=4' })).not.toBe(f)
  expect(fp((b) => { b.spaceLookVersion = 'look-2' })).not.toBe(f) // the space was recalibrated
})
test('space-owned columns do not stale the bake', () => {
  const f = computeBakeFingerprint(base)
  expect(fp((b) => { Object.assign(b.exhibition, { floorMaterial: 'wood-planks', windowLightIntensity: 9, ambientLightIntensity: 2 }) })).toBe(f)
})
test('page-only changes do not stale the bake', () => {
  const f = computeBakeFingerprint(base)
  expect(fp((b) => { b.exhibition.mainTitle = 'B'; b.exhibition.description = 'y' })).toBe(f)
  expect(fp((b) => { b.placed[0]!.pageOrder = 9; b.placed[0]!.showOnPage = false })).toBe(f)
  expect(fp((b) => { b.placed[0]!.artwork.title = 'Other' })).toBe(f)
})
test('isBakeRecord rejects partial records', () => {
  expect(isBakeRecord({ id: 'x' })).toBe(false)
  expect(isBakeRecord(null)).toBe(false)
})
```

- [ ] **Step 2: Run, verify it fails** — `pnpm playwright test e2e/bake-fingerprint.spec.ts` → FAIL (modules missing).
- [ ] **Step 3: Implement `bakeRecord.ts` and `fingerprint.ts`** per Interfaces (`loadBakeFingerprint` reads the exhibition + placed rows with Prisma and calls `computeBakeFingerprint`).
- [ ] **Step 4: Run, verify it passes.**
- [ ] **Step 5: Commit** (on Eduardo's word): `AR-161: bake record type and room fingerprint`.

### Task 7: `Exhibition.bake`, snapshot, and who sees which bake

**Files:**
- Modify: `prisma/schema.prisma` (Exhibition: `bake Json? // draft BakeRecord; the published one lives in publishedSnapshot`)
- Modify: `src/lib/exhibitionSnapshot.ts` (no code change expected: the omit-spread carries `bake`; add a comment saying so, and omit `publishedSnapshot` from the spread so snapshots stop nesting)
- Modify: `src/app/api/exhibitions/by-url/[url]/route.ts`
- Modify: `src/types/exhibition.ts` (`TExhibition.bake?: BakeRecord | null; bakeFingerprint?: string`)
- Test: `e2e/bake-visibility.spec.ts`

**Interfaces:**
- Consumes: `BakeRecord`, `isBakeRecord`, `loadBakeFingerprint` (Task 6).
- Produces: `GET /api/exhibitions/by-url/[url]` returns `bake`:
  - public/preview snapshot branch → `snapshot.exhibition.bake ?? null` (**never** the live column; in baked spaces a valid preview token is answered by Task 10's branch instead);
  - legacy no-snapshot branch → `null`;
  - `?mode=edit` (owner/admin) → live `bake` (draft), plus `bakeFingerprint: string` **only when the caller is admin/superAdmin**.

- [ ] **Step 0: DB gate.** Confirm `.env.local` is on the dev DB; edit the schema; Eduardo runs his migration + `pnpm db:generate` (or authorizes `pnpm db:push:dev` + `pnpm db:generate`).
- [ ] **Step 1: Write the failing test** (`test.use({ storageState: 'e2e/.auth/admin.json' })` for the admin block, anonymous `request.newContext()` for the visitor block). Fixture: create via Prisma an exhibition owned by the e2e artist with `published: true, spacePublished: true`, a `publishedSnapshot` whose `exhibition.bake.id = 'pub'`, and live `bake.id = 'draft'`; delete it in `finally`.
  ```ts
  expect((await anon.get(`/api/exhibitions/by-url/${url}`).then(r => r.json())).bake.id).toBe('pub')
  const edit = await admin.get(`/api/exhibitions/by-url/${url}?mode=edit`).then(r => r.json())
  expect(edit.bake.id).toBe('draft')
  expect(edit.bakeFingerprint).toBe(await loadBakeFingerprint(id))
  const artistEdit = await artist.get(`/api/exhibitions/by-url/${url}?mode=edit`).then(r => r.json())
  expect(artistEdit.bakeFingerprint).toBeUndefined()
  ```
- [ ] **Step 2: Run, verify it fails** (`bake` is `'draft'` on the public read today, or missing).
- [ ] **Step 3: Implement** the three branches above.
- [ ] **Step 4: Run, verify it passes.**
- [ ] **Step 5: Commit** (on his word): `AR-161: draft and published bake on the exhibition`.

### Task 8: Store a bake (admin only, nothing partial) — local today, R2 tomorrow

**Files:**
- Create: `src/lib/bake/bakeStorage.ts` — one seam, two backends chosen by `BAKE_STORAGE` (`'local' | 'r2'`, default `'r2'`): `local` (development only; refuses when `NEXT_PUBLIC_APP_ENV === 'production'`) writes under `.bake-files/` at the repo root (add to `.gitignore`) and serves `GET /api/bake-files/[...key]` with `Cache-Control: public, max-age=31536000, immutable`; `r2` = the presigned PUTs below. Used today because R2 is unreachable (2026-10-18); `.env.local` gets `BAKE_STORAGE=local` — Eduardo sets it.
  ```ts
  export interface BakeUpload { file: string; url: string; method: 'PUT'; publicUrl: string }
  export async function createBakeUploads(exhibitionId: string, bakeId: string, files: string[]): Promise<BakeUpload[]>
  export async function bakeObjectSize(publicUrl: string): Promise<number | null>
  export async function deleteBakeObjects(exhibitionId: string, bakeId: string): Promise<void>
  ```
- Create: `src/app/api/bake-files/[...key]/route.ts` (`GET`, and `PUT` admin-only, local backend only; 404 when `BAKE_STORAGE !== 'local'`)
- Create: `src/app/api/exhibitions/[id]/bake/reviewed/route.ts` (`POST` body `{ bakeId }` → sets `bake.reviewedAt = now` only if `bake.id === bakeId` and `bake.fingerprint === await loadBakeFingerprint(id)`; else 409; admin only)
- Modify: `src/lib/r2.ts` — `buildExhibitionBakeKey(exhibitionId: string, bakeId: string, file: string): string` → `${getEnvPrefix()}/exhibitions/${exhibitionId}/bakes/${bakeId}/${file}`; `getPresignedUploadUrl(key, contentType, expiresIn = 3600, cacheControl?: string)` (signs `CacheControl` when given).
- Create: `src/app/api/exhibitions/[id]/bake/uploads/route.ts` (`POST`)
- Create: `src/app/api/exhibitions/[id]/bake/route.ts` (`PUT`)
- Test: `e2e/bake-api.spec.ts`

**Interfaces:**
- `POST /api/exhibitions/[id]/bake/uploads` body `{ files: string[] }` (names like `wall-light.png`, `[a-z-]+\.png`, ≤ 12) → `{ bakeId: string (randomUUID), uploads: { file: string; url: string; publicUrl: string }[] }`; presigned with `contentType: 'image/png'`, `cacheControl: 'public, max-age=31536000, immutable'`. Admin only (`requireAdminOrAbove`), 403 otherwise.
- `PUT /api/exhibitions/[id]/bake` body `BakeRecord` (without `bakedBy`; the server sets it from the session) → verifies `isBakeRecord`, every `maps[].url` lies under that exhibition's `bakes/{id}/` prefix, and every object exists (`bakeObjectSize` > 0); then writes `Exhibition.bake` with `reviewedAt: null`. **Does not touch `hasPendingChanges`.** Deletes the previous draft's objects if that draft is not the one in `publishedSnapshot`. Admin only. 400 on any failed check, draft unchanged.

- [ ] **Step 1: Write the failing test** (Prisma fixture exhibition as in Task 7):
  ```ts
  // artist cannot start or save a bake
  expect((await artist.post(`/api/exhibitions/${id}/bake/uploads`, { data: { files: ['wall-light.png'] } })).status()).toBe(403)
  expect((await artist.put(`/api/exhibitions/${id}/bake`, { data: record })).status()).toBe(403)
  // two bakes never share a key (cache-busting)
  const a = await admin.post(`/api/exhibitions/${id}/bake/uploads`, { data: { files: ['wall-light.png'] } }).then(r => r.json())
  const b = await admin.post(`/api/exhibitions/${id}/bake/uploads`, { data: { files: ['wall-light.png'] } }).then(r => r.json())
  expect(a.bakeId).not.toBe(b.bakeId)
  expect(a.uploads[0].publicUrl).toContain(`/exhibitions/${id}/bakes/${a.bakeId}/wall-light.png`)
  // nothing partial: a record pointing at an object never uploaded is refused, draft unchanged
  const res = await admin.put(`/api/exhibitions/${id}/bake`, { data: { ...record, id: a.bakeId, maps: [{ ...map, url: a.uploads[0].publicUrl }] } })
  expect(res.status()).toBe(400)
  expect((await prisma.exhibition.findUnique({ where: { id } }))!.bake).toBeNull()
  ```
  Plus one happy path that PUTs a tiny PNG to the presigned URL (Node `fetch`, header `Cache-Control` as signed), saves the record (200), and asserts `bake.id === a.bakeId` and `bake.bakedBy` is the admin's id. Clean the stored objects in `finally` (`deleteBakeObjects`). Run with `BAKE_STORAGE=local` today (R2 unreachable); the same spec must pass on `r2` before release.
- [ ] **Step 2: Run, verify it fails.**
- [ ] **Step 3: Implement** both routes and the r2 helpers.
- [ ] **Step 4: Run, verify it passes.**
- [ ] **Step 5: Commit** (on his word): `AR-161: admin-only bake upload`.

### Task 9: Publishing requires a current, reviewed bake (in baked spaces); publishing is admin-only

**Files:**
- Create: `src/lib/bake/bakedSpaces.ts` — `export const BAKED_SPACES: ReadonlySet<string> = new Set(['paris', 'vienna'])` (Madrid joins after Task 4's approval) and `isBakedSpace(spaceId: string | null | undefined): boolean`. The per-space switch: the Bake button, the bake preview link and the publish gate exist only in these spaces; every other space keeps today's publishing and preview unchanged.
- Modify: `src/app/api/exhibitions/[id]/route.ts` (PUT)
- Modify: `src/components/admin/dashboard/AdminExhibitions.tsx` (show the refusal)
- Test: `e2e/bake-publish-gate.spec.ts`

**Interfaces:**
- Consumes: `loadBakeFingerprint`, `isBakeRecord`, `deleteBakeObjects` (Task 8).
- Produces: PUT bodies carrying `published`, `spacePublished`, `previewEnabled` or `hasPendingChanges: false` require `requireAdminOrAbove` (403 otherwise; plain admins are no longer blocked by `requireOwnership` for these). Every other body keeps `requireOwnership`.
- Gate (only when `isBakedSpace(spaceId)`): if after this request the 3D room would be served to visitors from a newly built snapshot (`spacePublished` true — requested or current — together with `published: true`, `spacePublished: true` or `hasPendingChanges: false` on a published exhibition), then `bake` must be a `BakeRecord` whose `fingerprint === await loadBakeFingerprint(id)` **and** `reviewedAt !== null`. Else **409** `{ error: 'BAKE_REQUIRED' | 'BAKE_STALE' | 'BAKE_UNREVIEWED', message }` and nothing is written. Page-only publishes (room not public) pass without a bake. (`previewEnabled` no longer builds a snapshot in baked spaces — Task 10.)
- After a successful snapshot rebuild: delete the objects of the previously published bake if its id differs from the new one and from the current draft.
- Dashboard: on 409, show the message inline next to the action ("Bake the room before publishing it." / "The room changed since the last bake — bake it again." / "Open the baked room to review it before publishing."), with a link to the 3D editor.

- [ ] **Step 1: Write the failing test** (fixture: exhibition in `paris` owned by the e2e artist, `published: false`, `spacePublished: true`):
  ```ts
  expect((await artist.put(`/api/exhibitions/${id}`, { data: { published: true } })).status()).toBe(403)
  let r = await admin.put(`/api/exhibitions/${id}`, { data: { published: true } })
  expect(r.status()).toBe(409); expect((await r.json()).error).toBe('BAKE_REQUIRED')
  await prisma.exhibition.update({ where: { id }, data: { bake: { ...record, fingerprint: await loadBakeFingerprint(id), reviewedAt: null } } })
  r = await admin.put(`/api/exhibitions/${id}`, { data: { published: true } })
  expect(r.status()).toBe(409); expect((await r.json()).error).toBe('BAKE_UNREVIEWED')
  await prisma.exhibition.update({ where: { id }, data: { bake: { ...record, fingerprint: await loadBakeFingerprint(id), reviewedAt: new Date().toISOString() } } })
  // artist saves after the bake → stale
  await prisma.exhibition.update({ where: { id }, data: { wallColor: '#f0f0f0' } })
  r = await admin.put(`/api/exhibitions/${id}`, { data: { published: true } })
  expect(r.status()).toBe(409); expect((await r.json()).error).toBe('BAKE_STALE')
  // rebake + review → publish ships exactly that bake
  await prisma.exhibition.update({ where: { id }, data: { bake: { ...record, id: 'b2', fingerprint: await loadBakeFingerprint(id), reviewedAt: new Date().toISOString() } } })
  r = await admin.put(`/api/exhibitions/${id}`, { data: { published: true } })
  expect(r.status()).toBe(200)
  const snap = (await prisma.exhibition.findUnique({ where: { id } }))!.publishedSnapshot as { exhibition: { bake: { id: string } } }
  expect(snap.exhibition.bake.id).toBe('b2')
  ```
  Add: an exhibition with `spacePublished: false` publishes with no bake → 200; a title-only change after the bake leaves publish at 200; the same flow on a `madrid` exhibition (not a baked space) publishes with no bake → 200.
- [ ] **Step 2: Run, verify it fails.**
- [ ] **Step 3: Implement** `bakedSpaces.ts`, the role split, the gate, the cleanup, and the dashboard message.
- [ ] **Step 4: Run, verify it passes;** also re-run the existing exhibition specs (`pnpm test:e2e:gallery`) — none may regress.
- [ ] **Step 5: Commit** (on his word): `AR-161: publish only a current, reviewed, admin-made bake`.

### Task 10: The bake preview link (replaces the unbaked preview link in baked spaces)

**Files:**
- Modify: `src/app/api/exhibitions/by-url/[url]/route.ts` — a preview branch ahead of the snapshot branch.
- Modify: `src/components/exhibitions/view/index.tsx` — the out-of-date notice.
- Modify: `src/components/admin/dashboard/AdminExhibitions.tsx` — labels and availability.
- Test: `e2e/bake-preview.spec.ts`

**Interfaces:**
- Consumes: `isBakedSpace` (Task 9), `loadBakeFingerprint`, `isBakeRecord` (Task 6).
- Produces: `GET /api/exhibitions/by-url/[url]?preview=<token>`, when the exhibition's space is baked and the token is valid (fresh read: `previewEnabled && previewToken === token`, **published or not**): the LIVE draft — the same shape as the legacy no-snapshot branch (live `exhibitionArtworks` + public-safe artwork fields; never `originalImageUrl`, never `previewToken`) — plus `bakeStatus: 'current' | 'stale' | 'missing'` and `bake` = the draft `BakeRecord` only when `'current'` (fingerprint matches), else `null`. Any other request is answered exactly as today (published snapshot for visitors). Non-baked spaces keep today's preview behaviour.
- View: on a preview request with `bakeStatus !== 'current'`, the 3D scene does not mount; a full-page notice reads "This preview is out of date — a new bake is needed." (`'missing'`: "This exhibition hasn't been baked yet.").
- Dashboard (baked spaces): the "Publish Preview" / "Unpublish Preview" toggle becomes "Enable bake preview link" / "Disable bake preview link", available for published AND unpublished exhibitions; "Copy Preview Link" → "Copy bake preview link"; "Update Preview Link" unchanged (new secret, old link dies).

- [ ] **Step 1: Write the failing test** (fixture: `paris` exhibition, `published: true, spacePublished: true`, snapshot bake `pub`, live draft bake `draft` current, `previewEnabled: true`, token `tok`):
  ```ts
  const pub = await anon.get(`/api/exhibitions/by-url/${url}`).then((r) => r.json())
  expect(pub.bake.id).toBe('pub') // visitors: published, untouched by the preview
  const pv = await anon.get(`/api/exhibitions/by-url/${url}?preview=tok`).then((r) => r.json())
  expect(pv.bakeStatus).toBe('current'); expect(pv.bake.id).toBe('draft')
  expect(pv.wallColor).toBe(liveWallColor) // draft data, not the snapshot's
  expect(pv.previewToken).toBeUndefined()
  await prisma.exhibition.update({ where: { id }, data: { wallColor: '#e0e0e0' } })
  const stale = await anon.get(`/api/exhibitions/by-url/${url}?preview=tok`).then((r) => r.json())
  expect(stale.bakeStatus).toBe('stale'); expect(stale.bake).toBeNull()
  expect((await anon.get(`/api/exhibitions/by-url/${url}?preview=wrong`).then((r) => r.json())).bake.id).toBe('pub')
  ```
  Add: `previewEnabled: false` → the token is ignored (published answer); an unpublished exhibition with a wrong token → 404; no draft bake → `bakeStatus: 'missing'`.
- [ ] **Step 2: Run, verify it fails. Step 3: Implement** the branch, the notice and the dashboard labels. **Step 4: Run, verify it passes;** re-run `pnpm test:e2e:gallery`.
- [ ] **Step 5: Commit** (on his word): `AR-161: bake preview link`.

---

## Phase C — Bake once, show everywhere (client)

### Task 11: Lightmap codec

**Files:**
- Create: `src/components/scene/bake/lightmapCodec.ts`
- Test: `e2e/lightmap-codec.spec.ts`

**Interfaces:**
- Pure (testable in Node):
  ```ts
  export function chooseEncoding(pixels: Float32Array, kind: BakeMapKind): LightmapEncoding
  export function quantize(pixels: Float32Array, encoding: LightmapEncoding): Uint8ClampedArray // RGBA, A = 255
  export function dequantize(bytes: Uint8ClampedArray, encoding: LightmapEncoding): Float32Array // RGBA, A = 1
  ```
  `log8`: `byte = round(255 · ln(1 + v/knee) / ln(1 + max/knee))`, `max` = the map's 99.9th percentile ×1.05 (clamped above), `knee = max / 64`. `signed8` (direction maps, components in [−0.5, 0.5]): `byte = round((v + 0.5) · 255)`.
- Browser: `encodeLightmapPng(pixels, width, height, kind): Promise<{ blob: Blob; encoding: LightmapEncoding }>` (canvas `putImageData` → `toBlob('image/png')`, rows flipped to image order); `decodeLightmapPng(buffer: ArrayBuffer, map: BakeMap): Promise<DataTexture>` (`createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })` → canvas `getImageData` → `dequantize` → `DataUtils.toHalfFloat` → `DataTexture(…, RGBAFormat, HalfFloatType)`, `LinearFilter`, `flipY` matching the baked target, `channel` set by the caller).

- [ ] **Step 1: Write the failing test**
  ```ts
  test('log8 round trip within 1% above the knee', () => {
    const v = Float32Array.from({ length: 4096 }, (_, i) => (i % 4 === 3 ? 1 : 0.02 + (i / 4096) * 8))
    const e = chooseEncoding(v, 'light')
    const back = dequantize(quantize(v, e), e)
    for (let i = 0; i < v.length; i++) if (i % 4 !== 3 && v[i]! > e.knee) expect(Math.abs(back[i]! - v[i]!) / v[i]!).toBeLessThan(0.01)
  })
  test('signed8 keeps direction components to 1/255', () => { /* −0.5…0.5 round trip, |err| ≤ 1/255 */ })
  test('zero stays zero; alpha is opaque', () => { /* quantize(0) === 0; every 4th byte 255 */ })
  ```
- [ ] **Step 2: Run, verify it fails. Step 3: Implement. Step 4: Run, verify it passes.**
- [ ] **Step 5: Commit** (on his word): `AR-161: lightmap PNG codec`.

### Task 12: Bake output and the space camera out of `LoadTimeBake`

**Files:**
- Modify: `src/components/scene/bake/LightBaker.ts` — `exportMaps(): { receiver: BakeSurface; kind: BakeMapKind; pixels: Float32Array; width: number; height: number }[]` (from `outputs`/`dirOutputs` via `readFloat`); `totalSteps(): number` (the number of `yield`s `run()` will make, computed after `prepare`).
- Create: `src/components/scene/bake/meter.ts` — `bakeCamera(spaceId: string): { exposure: number; whiteBalance: [number, number, number] }` (the space's fixed camera from `spaceConfigs`; throws for a space without one — only baked spaces bake) and `meterBake(baker: LightBaker, scene: Object3D): { artPeakLux: number; paperWhite: number; meteredExposure: number }` (moved from `LoadTimeBake`'s finish; diagnostics only — it never sets the camera).
- Verification only (WebGL): headless — exporting, encoding and re-applying (Task 13) the maps must reproduce the live bake's junction profile within ±1% (`junction.mjs`, same camera, same column).

- [ ] **Step 1:** Add `exportMaps`, `totalSteps`, `bakeCamera`, `meterBake`; `LoadTimeBake` uses them (behaviour identical to `ar161spacecamera=1`).
- [ ] **Step 2:** Headless check: Permanence meter line identical (`exposure 0.524, camera "space"`), Florescere `0.588`; `totalSteps()` equals the counted yields.
- [ ] **Step 3: Commit** (on his word): `AR-161: export baked maps and meter`.

### Task 13: One unwrap and one material swap for bake, review and visitors

**Files:**
- Create: `src/components/scene/bake/receivers.ts` — `prepareReceivers(scene: Object3D, colors: { wall: string; ceiling: string }): { receivers: BakeReceiver[]; unwrapHash: string; restore: () => void }` (`BakeReceiver` = the existing receiver interface exported by `LightBaker.ts`, not the `BakeSurface` union) (the receiver-building block of `LoadTimeBake`: wall/ceiling `buildPropAtlas` with plaster tiling, floor, props atlas).
- Create: `src/components/scene/bake/applyBake.ts` — `applyBakedLighting(scene: Object3D, receivers: BakeReceiver[], maps: { receiver: BakeSurface; kind: BakeMapKind; texture: Texture }[], plaster: { normal: Texture; roughness: Texture }): () => void` (the material-swap block: floor `patchStandard`, props `patchStandard` on `channel 1`, walls/ceiling plaster `MeshStandardMaterial` + `patchPlaster`).
- Create: `src/components/scene/bake/hashUnwrap.ts` — `hashUnwrap(arrays: Float32Array[]): string` (FNV-1a over the float bits, hex).
- Test: `e2e/hash-unwrap.spec.ts`

- [ ] **Step 1: Write the failing test**
  ```ts
  const a = new Float32Array([0.1, 0.2, 0.3, 0.4])
  expect(hashUnwrap([a])).toBe(hashUnwrap([new Float32Array(a)]))
  const b = new Float32Array(a); b[2] = 0.30000001
  expect(hashUnwrap([b])).not.toBe(hashUnwrap([a]))
  expect(hashUnwrap([a, b])).not.toBe(hashUnwrap([b, a]))
  ```
- [ ] **Step 2: Run, verify it fails. Step 3:** Implement `hashUnwrap`; move the two blocks out of `LoadTimeBake` into `prepareReceivers` / `applyBakedLighting`; `LoadTimeBake` uses them (no behaviour change). `unwrapHash` = `hashUnwrap` over the `uv1` arrays of every unwrapped receiver, in receiver order.
- [ ] **Step 4: Run the test (passes) and the headless Madrid junction probe** — identical to before the move.
- [ ] **Step 5: Commit** (on his word): `AR-161: shared receivers, unwrap hash and material swap`.

### Task 14: Visitors and review apply a stored bake

**Files:**
- Create: `src/components/scene/bake/BakedLighting.tsx` — `<BakedLighting bake={BakeRecord} />`
- Create: `src/components/scene/bake/lightmapLoader.ts` — `class LightmapLoader extends Loader<DataTexture>` (fetch → `decodeLightmapPng`), used with r3f `useLoader` so it suspends inside the scene's existing `<Suspense>` (the room is not revealed before the maps are applied).
- Create: `src/components/scene/bake/bakeState.ts` — move `setMeteredExposure`/`useMeteredExposure`/`setMeteredWhiteBalance`/`useMeteredWhiteBalance` here from `realismProbe.ts`.
- Modify: `src/components/scene/spaces/ParisSpace/lights/index.tsx` (shared by all three spaces): mount `<BakedLighting bake={exhibition.bake} />` when the exhibition in Redux has a `bake` and the page is not in bake mode.

**Interfaces:**
- Consumes: `BakeRecord` (Task 6), codec (Task 11), `prepareReceivers`/`applyBakedLighting`/`hashUnwrap` (Task 13).
- Behaviour: load every map; `prepareReceivers`; if `unwrapHash !== bake.unwrapHash` → `captureError` (`src/lib/observability/captureError.ts`), restore, render nothing (today's look stays); else apply, `setMeteredExposure(bake.camera.exposure)`, `setMeteredWhiteBalance(bake.camera.whiteBalance)`, `requestRoomRecapture()`; undo everything on unmount.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Headless verification (WebGL, not e2e):** Permanence with a saved draft bake in review mode (Task 15) vs the live load-time bake (`final.q`, seeded): `junction.mjs` profiles within ±1%, screenshots visually identical, camera equal, every image file-true (`sweep.mjs`).
- [ ] **Step 3: Commit** (on his word): `AR-161: apply a stored bake`.

### Task 15: Bake mode and review mode (admin)

**Files:**
- Create: `src/components/scene/bake/BakeRunner.tsx` — runs `LightBaker` like `LoadTimeBake` (start delay, lamp-mount frames, frame budget), reports `onProgress(done / totalSteps)`, then `exportMaps` → `encodeLightmapPng` each → `POST …/bake/uploads` → PUT each blob to its upload URL (`BakeUpload.url`; R2: header `Cache-Control: public, max-age=31536000, immutable`) → `PUT …/bake` with the `BakeRecord` (fingerprint = the `bakeFingerprint` the page loaded with; `unwrapHash` and `camera` (= `bakeCamera(spaceId)`) from Tasks 12–13; `bakerVersion = BAKER_VERSION`) → `onDone()`.
- Modify: `src/components/exhibitions/view/index.tsx` — `?bake=1` and `?review=1` (admin only; anyone else gets the normal visit): both load `useGetExhibitionByUrlQuery({ url, mode: 'edit' })`; bake mode mounts `<BakeRunner>` (no `BakedLighting`) and on done navigates to `?review=1`; review mode shows the draft via `BakedLighting` only when `bake.fingerprint === bakeFingerprint` (else the same "out of date — a new bake is needed" notice as Task 10), calls `POST …/bake/reviewed { bakeId }` once the room is revealed, and shows a small admin bar: "Bake again" / "Back to editor". A "View baked room" link to `?review=1` also goes on the exhibition's dashboard row (baked spaces only).
- Modify: `src/redux/slices/exhibitionApi.ts` — `mode?: 'edit'` stays; `TExhibition` already carries `bake`/`bakeFingerprint` (Task 7).

- [ ] **Step 1:** Implement. If the GPU lacks float render targets / `EXT_float_blend`, bake mode shows "This computer can't bake the room." and does nothing.
- [ ] **Step 2: Manual + headless check on the dev DB** (a Paris exhibition, `BAKE_STORAGE=local`): bake → files under `…/bakes/{id}/` → draft saved → review loads it, sets `reviewedAt`, and matches Task 14's numbers. Closing the tab mid-bake leaves `bake` unchanged. A wall-colour change after the bake → review shows the out-of-date notice.
- [ ] **Step 3: Commit** (on his word): `AR-161: admin bake and review modes`.

### Task 16: The monogram loader, for everyone

**Files:**
- Create: `src/components/ui/MonogramLoader/MonogramLoader.tsx`, `MonogramLoader.module.scss`, `index.ts`
- Modify: `src/components/exhibitions/view/index.tsx` (replace `LoadingOverlay`), `BakeRunner` host (bake mode).

**Interfaces:**
- `<MonogramLoader progress={number /* 0..1 */} title={string} note?={string} done?={boolean} />`: `src/icons/monogram.svg` paths in grey `#ebe7e2`; the same paths in `#bd1622` clipped by a rect rising from the bottom of the mark (y from 825 to 95 in the SVG's 850.39 × 907.09 box) by `progress`; the displayed progress never decreases; on `done` the white screen fades (300 ms) and unmounts. Reference: mockup B, `.superpowers/brainstorm/19530-1792225350/content/loader-options-v2.html`.
- Visitor progress = drei `useProgress` (asset loads, which include the lightmap fetches via `useLoader`) until the scene's Suspense resolves, then done.
- Copy (Eduardo approves the words at the review step): visitors — title "Preparing the exhibition", no note; bake mode — title "Lighting the room", note "This takes a few minutes. Keep this tab open and in front, with the display awake."

- [ ] **Step 1:** Implement; keep the WebGL-unavailable path (`view/index.tsx:632`) able to dismiss the loader as today.
- [ ] **Step 2:** Headless screenshots at 0%, ~50%, done on a visit and in bake mode; Eduardo reviews wording and look live.
- [ ] **Step 3: Commit** (on his word): `AR-161: monogram loader`.

### Task 17: Bake controls in the 3D editor (admin only)

**Files:**
- Create: `src/components/editview/BakePanel/BakePanel.tsx` (+ scss, index)
- Modify: `src/components/editview/Menu/*` (entry shown only when `session.user.userType` is `admin` or `superAdmin`), `src/components/editview/EditView.tsx`, `src/redux/slices/dashboardSlice.ts` (`isBakePanelOpen`).

**Interfaces:**
- Status from the editor's edit-mode data: no `bake` → "Not baked yet"; `bake.fingerprint === bakeFingerprint` → "Bake is current — baked {date}" (+ "reviewed" when `reviewedAt`); else → "The room changed since the last bake."
- Shown only in baked spaces (`isBakedSpace`). Buttons: "Bake" (opens `/exhibitions/{artist}/{slug}/visit?bake=1` in a new tab), "View baked room" (opens `?review=1`; disabled without a bake).
- Server enforcement is Tasks 8–9; this is presentation only (no e2e: the editor mounts WebGL).

- [ ] **Step 1:** Implement. **Step 2:** Manual check as admin (panel present, statuses correct after a wall-colour change) and as the e2e artist (no entry). **Step 3: Commit** (on his word): `AR-161: bake panel in the editor`.

### Task 18: Artist controls — spec rule 7 only (part pending Eduardo, spec "Still open")

**Files:**
- Modify: `src/components/editview/LightingPanel/LightingPanel.tsx`, `WallCeilingPanel/WallCeilingPanel.tsx`, `FloorPanel/FloorPanel.tsx`, `WindowsPanel/WindowsPanel.tsx`, `src/components/editview/Menu/*` (no Floor entry in baked spaces)
- Create: `scripts/reset-light-levels.ts` (one-off, run by Eduardo at rollout)

- [ ] **Step 1: Keep (baked spaces):** wall paint colour; display panels and their colours; track lamps — per-lamp position/rotation/on-off (`trackLampSettings`); a dimmer for the track lamps (`trackLampIntensity`) and one for the recessed lamps (`recessedLampIntensity`) — **range pending Eduardo** (proposed 50–100% of the standard, slider 4 = 100%, never above); the lighting-set selector — **pending** (proposed: Paris/Vienna offer only `track-plafond`, the only calibrated set); window-frame and radiator colours — **pending** (proposed: kept, artist decor). **Hide** (don't render; DB fields and API stay): floor (whole panel), sky type/rotation, ambient colour/intensity, window colour/transparency/intensity, ceiling colour, shadow blur/spread/tightness, wall brightness, and — **pending** — lamp colour, beam angle, throw distance and track body colour (proposed: space constants). Confirm each against the code first. Non-baked spaces keep today's panels.
- [ ] **Step 2: Recessed dimming in the bake** (new code: the physical path ignores the stored recessed level except 0 = off): recessed lumens = space rating × `recessedLampIntensity / 4`, clamped to the agreed range; same for track (`trackscale` × level / 4). Headless: slider 2 (if within range) halves each lamp's direct light on the art; slider 4 reproduces the approved Paris/Vienna meters exactly.
- [ ] **Step 3: `scripts/reset-light-levels.ts`** — sets `trackLampIntensity = 4` and `recessedLampIntensity = 4` on every exhibition in a baked space (prints before/after per exhibition; `--dry-run` default, `--apply` to write). Never touches `trackLampSettings`, `ceilingLightMode`, wall colours or panels. Eduardo runs it (dev first, prod at rollout).
- [ ] **Step 4:** Before/after screenshots of each panel for Eduardo (exact kept/hidden list) before commit.
- [ ] **Step 5: Commit** (on his word): `AR-161: artist controls per space rules`.

---

## Phase D — The approved look becomes the only look

### Task 19: Retire the probe; the per-space approved look becomes the only baked look

Runs after Tasks 3–4 are approved (it deletes the A/B flags they need).

**Files:**
- Modify: `src/components/scene/spaces/types.ts` + `src/components/scene/constants.tsx` — `SpaceConfig.look?: SpaceLook` next to `camera`: `interface SpaceLook { recessedLumens: number; corridorLumens: number; roundLumens: number; trackScale: number; sunLux: number; sunElevationDeg: number; daylightGain: number; ceilingColor: string }` — Paris/Vienna `{ recessedLumens: 6800, corridorLumens: 3000, roundLumens: 3000, trackScale: 0.5, sunLux: 5000, sunElevationDeg: 35, daylightGain: 6, ceilingColor: '#ffffff' }`; Madrid from Task 4. `spaceLookVersion` (Task 6) hashes `camera` + `look`.
- Create: `src/components/scene/bake/commonFloor.ts` — the one floor for every room of every baked space: `{ material: 'parquet-whitewash', scale: 2.07, normal: 3, reflectiveness: 0.09, offsetY: 0.04, temperature: 0 }`; the floor component uses it in baked spaces whatever the exhibition stores.
- Create: `src/components/scene/bake/bakedLook.ts` — `useBakedLook(): LookState` where `LookState` is today's `RealismProbeState` reduced to the fields consumers still read; returns `APPROVED_LOOK` (+ the space's `look`/`camera`) when the space is baked AND (the Redux exhibition has a `bake` — published visit, review, bake preview — or the page is in bake mode), else `TODAY_LOOK` (byte-for-byte today's production branch, i.e. `PROBE_OFF`). The editor (`/edit`) always gets `TODAY_LOOK`.
- `APPROVED_LOOK` = `{ ...PROBE_DEFAULTS, ...PHYSICAL, ...NEXT, enabled: true, preset: 'baked-next', bake: true }` with every flag of the approved Paris/Vienna query hard-wired (spec "What exists"), window glass always on, file-exact images, the seed always on, the space camera always.
- Delete: `src/components/scene/realismProbe.ts`, `src/components/scene/RealismProbePanel.tsx`, `src/components/scene/bake/LoadTimeBake.tsx`, the `ar161lookfrom` / `ar161floor*` / `ar161wallcolor` / `ar161ceilingcolor` / `ar161glasson` previews in `src/components/exhibitions/view/index.tsx`, `bake/cove.ts` (rejected); every `useRealismProbe`/`probeUrlNumber`/`probePlasticColor` call site switches to `useBakedLook` or the approved constant; all `ar161*` URL reads go.
- In `LightBaker.ts`/`bakeShaders.ts`: hard-wire `edges`, `nearfield`, `denoise`, `lambert`, `finebias`, `propsbounce`, **`fullbounce` with 8 bounces**, `sunportal`, `emittervpls 4096`, `artbounce`, the seed; delete `filter`, `gather` (+ `gatherScene` usage except what `nearField` needs), `disc`, `roomclip`, `mindist`/`vplcube`/`vpls` overrides, `noPropShadow`/`noLampShadow`. Bump nothing (`BAKER_VERSION` stays 1 — no bake exists yet).
- Keep the `window.__ar161*` hooks dev-only (`NEXT_PUBLIC_APP_ENV !== 'production'`) for the headless tools.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** — `pnpm typecheck && pnpm lint`; `grep -rn "ar161\|useRealismProbe\|RealismProbe" src` returns only the dev-only debug hooks; headless: every exhibition of Paris, Vienna (and Madrid once approved) in review matches its approved link (junction ±1%, camera equal, full sweep file-true); an exhibition in a non-baked space renders exactly as production today (screenshot diff against `main`).
- [ ] **Step 3: Commit** (on his word): `AR-161: per-space approved look is the only baked look; probe removed`.

### Task 20: Local-only assets: served by the app today, R2 tomorrow

**Files:**
- Modify: `src/components/scene/constants.tsx` (Paris `gltfPath` → `/assets/spaces/paris/paris22_noq.glb`), the floor material registry (`parquet-whitewash`), `src/components/scene/bake/*` (plaster paths) — all through `assetUrl`/`spaceGltfUrl`, whose origin fallback serves `public/` when R2 is unreachable.

- [ ] **Step 1:** Make `paris22_noq.glb` (gltf-transform, as `paris21_noq`; node diff vs `paris22.glb` = nothing lost).
- [ ] **Step 2 (today):** everything loads from the app origin on localhost (`public/`, never committed). Check the Network tab: no R2 request blocks the room.
- [ ] **Step 3 (when R2 is reachable — Eduardo's go):** upload `paris22_noq.glb`, the floor maps and the plaster maps (KTX2 only if a converter is already installed and the look holds); verify with `NEXT_PUBLIC_LOCAL_ASSETS` unset that they load from R2 and the review render is unchanged; switch `BAKE_STORAGE` back to `r2`.
- [ ] **Step 4: Commit** (on his word): `AR-161: space assets on R2`.

---

## Phase E — Faster, then ship

### Task 21: Speed pass

- [ ] **Step 1:** Log per-phase timings in `stats` (direct, daylight, bounces, compose, near-field, encode, upload). Expected: a table for Madrid, Paris, Vienna.
- [ ] **Step 2:** Try, one at a time, each against the approved render (junction ±1%, screenshot diff, Eduardo's eye): near-field 128 spp; coverage-normalised half-res bounce instead of full-res `edges`; fewer bounce lights where the measured noise allows. Keep only what measures identical. If nothing does, keep today's times (Madrid ~45 s, Paris ~2 min, Vienna ~2.5 min).
- [ ] **Step 3: Commit** (on his word): `AR-161: faster bake`.

### Task 22: Release

- [ ] **Step 1:** `pnpm typecheck && pnpm lint`; stop `pnpm dev`; `pnpm test:e2e` (all green, nothing skipped); `pnpm build && pnpm start -p 3001` and walk: a visit with and without a bake, bake mode, review mode, a bake preview link (current and out of date), editor as admin and as artist, admin publish refusal. R2 reachable, `BAKE_STORAGE=r2`, Task 20 done.
- [ ] **Step 2:** Eduardo: commit/push/merge decisions; **`pnpm db:push:prod` before or with the deploy** (new `Exhibition.bake` column).
- [ ] **Step 2b:** Eduardo runs `scripts/reset-light-levels.ts --apply` against prod (levels back to the standard; lamp positions untouched).
- [ ] **Step 3: In production,** for each live 3D exhibition in a baked space (permanence, kritzendorf, florescere; vivriere once Madrid is approved): Bake → View baked room → Publish ("Update Exhibition"). Until published with a bake, each keeps today's look.
- [ ] **Step 4:** As an anonymous visitor: each room loads behind the monogram, never shows a draft, lightmap URLs are under `/bakes/{id}/`, meter/exposure as in review.
- [ ] **Step 5:** Update memory (`project_ar161_realism.md`, recipe) with what shipped.
