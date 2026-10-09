# Exhibition Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an artist split an exhibition page into titled, reorderable sections and assign each artwork to one section per exhibition.

**Architecture:** A new `ExhibitionSection` table owned by an exhibition, plus a nullable `ExhibitionArtwork.sectionId` with `onDelete: SetNull` (deleting a section returns its works to "no section" at the database level). Five small section routes under `/api/exhibitions/[id]/sections` save every change immediately; the existing artwork `PUT` carries the per-exhibition section choice. The public page query groups live rows through one pure helper, and the flattened groups keep feeding the artwork page's previous/next arrows.

**Tech Stack:** Next.js App Router route handlers, Prisma (Postgres), React client components, `@dnd-kit/core` + `@dnd-kit/sortable` (already dependencies), SCSS modules, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-08-exhibition-sections-design.md`

## Global Constraints

- Branch: `feat/AR-155-add-sections`. **No commits** until the owner has tested locally and said OK; **never push** until told.
- Never run `prisma migrate` or `prisma db push` against any database. The owner syncs the dev DB schema after Task 1 and the prod schema with the deploy. `pnpm db:generate` (client only) is fine.
- Tests are Playwright e2e in `/e2e/` only — no Vitest/Jest. Every fixture deleted by run end (0 strays). Run e2e with `pnpm dev` **stopped** (the runner owns port 3001). Never port 3000.
- No new dependencies.
- American spelling in code, comments and UI copy ("color", "center").
- Dashboard UI: rounded controls, always `<Button/>` (never a plain `<button>`), Lucide icons with `ICON_STROKE_WIDTH` from `@/lib/iconConfig`, no emoji.
- SCSS: `var(--token)` only, no fallbacks, no `!important`.
- Form validation flow: silent on arrival → errors shown on submit → cleared live as the user types.
- Section title: required, trimmed, **≤ 60 chars**, unique per exhibition case-insensitively.
- Public client-facing surfaces stay squared; reuse existing tokens only.

## Review Focus

1. **A section id from exhibition A sent for exhibition B on the artwork save** → 400, nothing written (not even the other fields' membership diff). Test in Task 3.
2. **The wall-view `ArtworkEditModal` save** sends `exhibitionSections` it was populated with → must be a no-op, never clearing a section. Test in Task 3 (PUT with the GET payload echoed back leaves `sectionId` unchanged).
3. **Reorder payload that drops, duplicates, or adds a foreign id** → 400, order unchanged. Test in Task 2.
4. **A failed drag-reorder save** → list snaps back to the last saved order with an error shown. Covered by code in Task 5 (`handleDragEnd` restore); no e2e (would need a forced 500).
5. **Case/whitespace duplicate title on rename** ("magnolia " vs "Magnolia") → 400; renaming a section to its own name with different case is allowed. Test in Task 2.

---

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `ExhibitionSection` model, `Exhibition.sections`, `ExhibitionArtwork.sectionId` |
| `src/lib/exhibitionSections.ts` (new) | Pure: `SECTION_TITLE_MAX`, `validateSectionTitle`, `groupBySection` |
| `src/lib/exhibitionSectionAccess.ts` (new) | `requireExhibitionOwner(exhibitionId)` — 404/403 guard for section routes |
| `src/app/api/exhibitions/[id]/sections/route.ts` (new) | `GET` list, `POST` create |
| `src/app/api/exhibitions/[id]/sections/[sectionId]/route.ts` (new) | `PATCH` rename, `DELETE` |
| `src/app/api/exhibitions/[id]/sections/order/route.ts` (new) | `PUT` reorder |
| `src/app/api/artworks/[id]/route.ts` | `GET` returns `exhibitionSections`; `PUT` validates + writes `sectionId` |
| `src/app/api/exhibitions/route.ts` | `GET` list includes ordered `sections` |
| `src/lib/queries/getPublicExhibitionByUrl.ts` | `groups` + flattened `artworks` |
| `src/components/exhibitions/profile/index.tsx` + `.module.scss` | Render one grid per group with heading |
| `src/components/dashboard/exhibitions/settings/SectionsEditor.tsx` + `.module.scss` (new) | Add / rename / delete / drag-reorder |
| `src/components/dashboard/exhibitions/settings/index.tsx` | Mount `SectionsEditor` |
| `src/components/shared/ArtworkEditForm/index.tsx` | `exhibitionSections` form field + per-exhibition dropdown |
| `src/components/dashboard/artworks/edit/index.tsx` | Feed `sections` into the exhibitions list; widen change handler |
| `src/components/wallview/ArtworkEditModal/index.tsx` | Widen change handler type only |
| `e2e/exhibition-sections-api.spec.ts` (new) | Section routes |
| `e2e/artwork-exhibition-sections.spec.ts` (new) | Artwork PUT/GET section field |
| `e2e/exhibition-page-sections.spec.ts` (new) | Public grouping + neighbours |
| `e2e/exhibition-sections-editor.spec.ts` (new) | Settings UI |
| `e2e/artwork-section-picker.spec.ts` (new) | Artwork form dropdown |

---

### Task 1: Schema + pure helpers

**Files:**
- Modify: `prisma/schema.prisma` (models `Exhibition` ~line 667, `ExhibitionArtwork` ~line 761)
- Create: `src/lib/exhibitionSections.ts`

**Interfaces:**
- Produces: Prisma model `exhibitionSection` (`id`, `exhibitionId`, `title`, `order`, `createdAt`); `exhibitionArtwork.sectionId: string | null`.
- Produces: `SECTION_TITLE_MAX = 60`; `validateSectionTitle(raw: unknown, takenTitles: string[]): { title: string } | { error: string }`; `type SectionGroup<T> = { id: string | null; title: string | null; artworks: T[] }`; `groupBySection<T>(rows: { sectionId: string | null; artwork: T }[], sections: { id: string; title: string }[]): SectionGroup<T>[]`.

- [ ] **Step 1: Add the model and relations to `prisma/schema.prisma`**

Inside `model Exhibition { ... }`, next to `exhibitionArtworks`, add:

```prisma
  // Optional titled groups on the public page, in artist order. See
  // docs/superpowers/specs/2026-10-08-exhibition-sections-design.md
  sections               ExhibitionSection[]
```

Inside `model ExhibitionArtwork { ... }`, directly under `pageOrder  Int?`, add:

```prisma
  // Which titled section of the page this work sits in, per exhibition. Null =
  // no section (listed first, no heading). SetNull is what makes deleting a
  // section return its works to "no section" instead of losing them.
  sectionId  String?
  section    ExhibitionSection? @relation(fields: [sectionId], references: [id], onDelete: SetNull)
```

Below `model ExhibitionArtwork`'s closing brace, add:

```prisma
model ExhibitionSection {
  id           String     @id @default(uuid())
  exhibitionId String
  exhibition   Exhibition @relation(fields: [exhibitionId], references: [id], onDelete: Cascade)
  title        String
  // Position on the page, 0-based. Rewritten wholesale by the reorder route.
  order        Int
  createdAt    DateTime   @default(now())

  exhibitionArtworks ExhibitionArtwork[]

  @@index([exhibitionId])
}
```

- [ ] **Step 2: Regenerate the client and format**

Run: `pnpm db:generate && npx prisma format --config prisma/prisma.config.ts`
Expected: "Generated Prisma Client", schema formatted, no errors.

- [ ] **Step 3: Create `src/lib/exhibitionSections.ts`**

```ts
import { sanitizeLine } from '@/utils/sanitizeLine'

/** Hard cap on a section title. The input's `maxLength` matches it. */
export const SECTION_TITLE_MAX = 60

/**
 * Clean and check a section title against the titles already taken in the same
 * exhibition. Duplicates are compared trimmed and case-insensitively — two
 * "Magnolia" headings on one page would read as a mistake. The caller passes
 * the OTHER sections' titles (exclude the one being renamed).
 */
export function validateSectionTitle(
  raw: unknown,
  takenTitles: string[],
): { title: string } | { error: string } {
  const title = typeof raw === 'string' ? sanitizeLine(raw) : ''
  if (!title) return { error: 'Section name is required.' }
  if (title.length > SECTION_TITLE_MAX) {
    return { error: `Section name must be ${SECTION_TITLE_MAX} characters or fewer.` }
  }
  const key = title.toLocaleLowerCase()
  if (takenTitles.some((taken) => taken.trim().toLocaleLowerCase() === key)) {
    return { error: 'This exhibition already has a section with that name.' }
  }
  return { title }
}

export type SectionGroup<T> = { id: string | null; title: string | null; artworks: T[] }

/**
 * The public page's layout, in one place: works with no section first (no
 * heading), then one group per section in the artist's order. `rows` must
 * already be in display order — each group keeps it. A row pointing at a
 * section not in `sections` falls back to no section rather than vanishing.
 * Empty groups are dropped, so a section with no visible works gets no heading.
 *
 * The grid renders `groups`; the artwork page's previous/next walks the same
 * groups flattened, so the two can never disagree.
 */
export function groupBySection<T>(
  rows: { sectionId: string | null; artwork: T }[],
  sections: { id: string; title: string }[],
): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = [
    { id: null, title: null, artworks: [] },
    ...sections.map((s) => ({ id: s.id, title: s.title, artworks: [] as T[] })),
  ]
  const byId = new Map(groups.map((g) => [g.id, g]))
  for (const row of rows) {
    const group = (row.sectionId && byId.get(row.sectionId)) || byId.get(null)!
    group.artworks.push(row.artwork)
  }
  return groups.filter((g) => g.artworks.length > 0)
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: STOP — owner syncs the dev DB schema**

Tell the owner the schema has one new table (`ExhibitionSection`) and one new nullable column (`ExhibitionArtwork.sectionId`) and wait for them to confirm the dev DB is synced. Every e2e from Task 2 on needs it. Do not run any schema command yourself.

---

### Task 2: Section API routes

**Files:**
- Create: `src/lib/exhibitionSectionAccess.ts`
- Create: `src/app/api/exhibitions/[id]/sections/route.ts`
- Create: `src/app/api/exhibitions/[id]/sections/[sectionId]/route.ts`
- Create: `src/app/api/exhibitions/[id]/sections/order/route.ts`
- Test: `e2e/exhibition-sections-api.spec.ts`

**Interfaces:**
- Consumes: `validateSectionTitle` (Task 1), `requireOwnership` from `@/lib/authUtils` (returns `{ session, error }`, `error` is a 401/403 `NextResponse` or null; allows the owner, someone impersonating them, or a superAdmin).
- Produces (HTTP, used by Task 5):
  - `GET /api/exhibitions/[id]/sections` → `200 SectionDto[]`
  - `POST /api/exhibitions/[id]/sections` body `{ title }` → `201 SectionDto` | `400 { error }`
  - `PATCH /api/exhibitions/[id]/sections/[sectionId]` body `{ title }` → `200 SectionDto` | `400` | `404`
  - `DELETE /api/exhibitions/[id]/sections/[sectionId]` → `200 { ok: true }` | `404`
  - `PUT /api/exhibitions/[id]/sections/order` body `{ sectionIds: string[] }` → `200 SectionDto[]` | `400`
  - `SectionDto = { id: string; title: string; order: number; artworkCount: number }` (`artworkCount` counts `showOnPage` rows only).
  - All return `404` for a missing exhibition and `403` for a non-owner.

- [ ] **Step 1: Write the failing spec `e2e/exhibition-sections-api.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * The section routes under /api/exhibitions/[id]/sections. Every change saves
 * on its own; the rules that matter are the ones a person would trip over:
 * duplicate names, renames keeping the works, deletes never losing a work,
 * reorders that can't be smuggled a foreign or missing id, and no access to
 * another artist's show.
 *
 * Talks to the routes directly. No WebGL.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function fixtureOwner() {
  return prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
}

async function createExhibition(userId: string, handler: string) {
  return prisma.exhibition.create({
    data: {
      userId,
      handler,
      mainTitle: 'E2E Sections API',
      url: `e2e-sections-api-${stamp()}`,
      spaceId: 'paris',
      status: 'current',
    },
    select: { id: true },
  })
}

test('create appends, rejects blank, long and duplicate names', async ({ request }) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler)
  const base = `/api/exhibitions/${exhibition.id}/sections`
  try {
    const first = await request.post(base, { data: { title: '  Magnolia  ' } })
    expect(first.status()).toBe(201)
    expect(await first.json()).toMatchObject({ title: 'Magnolia', order: 0, artworkCount: 0 })

    const second = await request.post(base, { data: { title: 'Mistery' } })
    expect((await second.json()).order).toBe(1)

    expect((await request.post(base, { data: { title: '   ' } })).status()).toBe(400)
    expect((await request.post(base, { data: { title: 'x'.repeat(61) } })).status()).toBe(400)
    const dup = await request.post(base, { data: { title: 'magnolia' } })
    expect(dup.status()).toBe(400)
    expect((await dup.json()).error).toMatch(/already has a section/)

    const list = await (await request.get(base)).json()
    expect(list.map((s: { title: string }) => s.title)).toEqual(['Magnolia', 'Mistery'])
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
  }
})

test('rename keeps its works; case-only rename of itself is allowed; duplicate is not', async ({
  request,
}) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler)
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Rename Work', slug: `e2e-rename-work-${stamp()}` },
  })
  const [mistery, memory] = await Promise.all([
    prisma.exhibitionSection.create({
      data: { exhibitionId: exhibition.id, title: 'Mistery', order: 0 },
    }),
    prisma.exhibitionSection.create({
      data: { exhibitionId: exhibition.id, title: 'Memory', order: 1 },
    }),
  ])
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: exhibition.id,
      artworkId: artwork.id,
      showOnPage: true,
      sectionId: mistery.id,
    },
  })
  const url = (id: string) => `/api/exhibitions/${exhibition.id}/sections/${id}`
  try {
    const renamed = await request.patch(url(mistery.id), { data: { title: 'Mystery' } })
    expect(renamed.status()).toBe(200)
    expect(await renamed.json()).toMatchObject({ title: 'Mystery', artworkCount: 1 })

    const row = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: { exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id } },
    })
    expect(row.sectionId, 'rename must not touch assignments').toBe(mistery.id)

    expect((await request.patch(url(mistery.id), { data: { title: 'MYSTERY' } })).status()).toBe(
      200,
    )
    expect((await request.patch(url(mistery.id), { data: { title: 'memory ' } })).status()).toBe(
      400,
    )
    expect((await request.patch(url(memory.id), { data: { title: '' } })).status()).toBe(400)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.delete({ where: { id: artwork.id } })
  }
})

test('delete returns its works to no section and keeps them on the page', async ({ request }) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler)
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Delete Work', slug: `e2e-delete-work-${stamp()}` },
  })
  const section = await prisma.exhibitionSection.create({
    data: { exhibitionId: exhibition.id, title: 'Memory', order: 0 },
  })
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: exhibition.id,
      artworkId: artwork.id,
      showOnPage: true,
      sectionId: section.id,
    },
  })
  try {
    const res = await request.delete(`/api/exhibitions/${exhibition.id}/sections/${section.id}`)
    expect(res.status()).toBe(200)

    const row = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: { exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id } },
    })
    expect(row.sectionId).toBeNull()
    expect(row.showOnPage).toBe(true)
    expect(await prisma.artwork.findUnique({ where: { id: artwork.id } })).not.toBeNull()
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.delete({ where: { id: artwork.id } })
  }
})

test('reorder accepts exactly the current set and rejects anything else', async ({ request }) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler)
  const other = await createExhibition(owner.id, owner.handler)
  const [a, b, c] = await Promise.all(
    ['A', 'B', 'C'].map((title, order) =>
      prisma.exhibitionSection.create({ data: { exhibitionId: exhibition.id, title, order } }),
    ),
  )
  const foreign = await prisma.exhibitionSection.create({
    data: { exhibitionId: other.id, title: 'Foreign', order: 0 },
  })
  const url = `/api/exhibitions/${exhibition.id}/sections/order`
  try {
    const ok = await request.put(url, { data: { sectionIds: [c.id, a.id, b.id] } })
    expect(ok.status()).toBe(200)
    expect((await ok.json()).map((s: { title: string }) => s.title)).toEqual(['C', 'A', 'B'])

    for (const sectionIds of [
      [c.id, a.id], // missing one
      [c.id, a.id, a.id], // duplicate
      [c.id, a.id, foreign.id], // foreign
      'nope',
    ]) {
      expect((await request.put(url, { data: { sectionIds } })).status()).toBe(400)
    }
    const stored = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: exhibition.id },
      orderBy: { order: 'asc' },
    })
    expect(stored.map((s) => s.title)).toEqual(['C', 'A', 'B'])
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: { in: [exhibition.id, other.id] } } })
  }
})

test('a section id from another exhibition is a 404 on rename and delete', async ({ request }) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler)
  const other = await createExhibition(owner.id, owner.handler)
  const foreign = await prisma.exhibitionSection.create({
    data: { exhibitionId: other.id, title: 'Foreign', order: 0 },
  })
  const url = `/api/exhibitions/${exhibition.id}/sections/${foreign.id}`
  try {
    expect((await request.patch(url, { data: { title: 'Hijack' } })).status()).toBe(404)
    expect((await request.delete(url)).status()).toBe(404)
    expect(await prisma.exhibitionSection.findUnique({ where: { id: foreign.id } })).not.toBeNull()
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: { in: [exhibition.id, other.id] } } })
  }
})

test("another artist's exhibition is 403 on every route", async ({ request }) => {
  const stranger = await prisma.user.findFirstOrThrow({
    where: { userType: 'artist', handler: { not: fixtures.artistSlug } },
    select: { id: true, handler: true },
  })
  const exhibition = await createExhibition(stranger.id, stranger.handler)
  const section = await prisma.exhibitionSection.create({
    data: { exhibitionId: exhibition.id, title: 'Theirs', order: 0 },
  })
  const base = `/api/exhibitions/${exhibition.id}/sections`
  try {
    expect((await request.get(base)).status()).toBe(403)
    expect((await request.post(base, { data: { title: 'Mine' } })).status()).toBe(403)
    expect(
      (await request.patch(`${base}/${section.id}`, { data: { title: 'Mine' } })).status(),
    ).toBe(403)
    expect((await request.delete(`${base}/${section.id}`)).status()).toBe(403)
    expect(
      (await request.put(`${base}/order`, { data: { sectionIds: [section.id] } })).status(),
    ).toBe(403)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
  }
})
```

- [ ] **Step 2: Run it to verify it fails**

Run (with `pnpm dev` stopped): `pnpm test:e2e e2e/exhibition-sections-api.spec.ts`
Expected: FAIL — every request 404s (routes don't exist).

- [ ] **Step 3: Create `src/lib/exhibitionSectionAccess.ts`**

```ts
import { NextResponse } from 'next/server'

import { requireOwnership } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

/**
 * The gate every section route goes through: the exhibition must exist and the
 * caller must be allowed to edit it — the same `requireOwnership` check the
 * exhibition PUT uses (owner, admin impersonating the owner, or superAdmin).
 */
export async function requireExhibitionOwner(
  exhibitionId: string,
): Promise<{ error: NextResponse | null }> {
  const exhibition = await prisma.exhibition.findUnique({
    where: { id: exhibitionId },
    select: { userId: true },
  })
  if (!exhibition) {
    return { error: NextResponse.json({ error: 'Exhibition not found' }, { status: 404 }) }
  }
  const { error } = await requireOwnership(exhibition.userId)
  return { error: error ?? null }
}

/** What every section route returns per section. Counts page members only. */
export const SECTION_DTO_SELECT = {
  id: true,
  title: true,
  order: true,
  _count: { select: { exhibitionArtworks: { where: { showOnPage: true } } } },
} as const

export type SectionDto = { id: string; title: string; order: number; artworkCount: number }

export function toSectionDto(row: {
  id: string
  title: string
  order: number
  _count: { exhibitionArtworks: number }
}): SectionDto {
  return { id: row.id, title: row.title, order: row.order, artworkCount: row._count.exhibitionArtworks }
}
```

- [ ] **Step 4: Create `src/app/api/exhibitions/[id]/sections/route.ts`**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { validateSectionTitle } from '@/lib/exhibitionSections'
import {
  requireExhibitionOwner,
  SECTION_DTO_SELECT,
  toSectionDto,
} from '@/lib/exhibitionSectionAccess'
import prisma from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

/* ------------------------ GET ------------------------ */
export async function GET(_req: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const { error } = await requireExhibitionOwner(id)
    if (error) return error

    const sections = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: id },
      select: SECTION_DTO_SELECT,
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(sections.map(toSectionDto))
  } catch (error) {
    console.error('[GET /api/exhibitions/[id]/sections] error:', error)
    return NextResponse.json({ error: 'Failed to load sections' }, { status: 500 })
  }
}

/* ------------------------ POST ------------------------ */
export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const { error } = await requireExhibitionOwner(id)
    if (error) return error

    const body = (await request.json().catch(() => ({}))) as { title?: unknown }
    const existing = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: id },
      select: { title: true, order: true },
    })
    const result = validateSectionTitle(
      body.title,
      existing.map((s) => s.title),
    )
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

    // New sections land at the bottom of the page.
    const order = existing.reduce((max, s) => Math.max(max, s.order), -1) + 1
    const section = await prisma.exhibitionSection.create({
      data: { exhibitionId: id, title: result.title, order },
      select: SECTION_DTO_SELECT,
    })
    return NextResponse.json(toSectionDto(section), { status: 201 })
  } catch (error) {
    console.error('[POST /api/exhibitions/[id]/sections] error:', error)
    return NextResponse.json({ error: 'Failed to create section' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Create `src/app/api/exhibitions/[id]/sections/[sectionId]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { validateSectionTitle } from '@/lib/exhibitionSections'
import {
  requireExhibitionOwner,
  SECTION_DTO_SELECT,
  toSectionDto,
} from '@/lib/exhibitionSectionAccess'
import prisma from '@/lib/prisma'

type Context = { params: Promise<{ id: string; sectionId: string }> }

// A section is only ever addressed through its own exhibition. An id from a
// different show is "not found" here, never a cross-exhibition write.
const notFound = () => NextResponse.json({ error: 'Section not found' }, { status: 404 })

/* ------------------------ PATCH (rename) ------------------------ */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id, sectionId } = await context.params
    const { error } = await requireExhibitionOwner(id)
    if (error) return error

    const section = await prisma.exhibitionSection.findFirst({
      where: { id: sectionId, exhibitionId: id },
      select: { id: true },
    })
    if (!section) return notFound()

    const body = (await request.json().catch(() => ({}))) as { title?: unknown }
    // Compare against the OTHER sections only, so "Mistery" → "MISTERY" is fine.
    const others = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: id, id: { not: sectionId } },
      select: { title: true },
    })
    const result = validateSectionTitle(
      body.title,
      others.map((s) => s.title),
    )
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

    // Only the title changes. Works reference the section by id, so every
    // assignment survives a rename untouched.
    const updated = await prisma.exhibitionSection.update({
      where: { id: sectionId },
      data: { title: result.title },
      select: SECTION_DTO_SELECT,
    })
    return NextResponse.json(toSectionDto(updated))
  } catch (error) {
    console.error('[PATCH /api/exhibitions/[id]/sections/[sectionId]] error:', error)
    return NextResponse.json({ error: 'Failed to rename section' }, { status: 500 })
  }
}

/* ------------------------ DELETE ------------------------ */
export async function DELETE(_req: NextRequest, context: Context) {
  try {
    const { id, sectionId } = await context.params
    const { error } = await requireExhibitionOwner(id)
    if (error) return error

    const section = await prisma.exhibitionSection.findFirst({
      where: { id: sectionId, exhibitionId: id },
      select: { id: true },
    })
    if (!section) return notFound()

    // `onDelete: SetNull` on ExhibitionArtwork.sectionId returns every work in
    // this section to "no section". No artwork row is deleted or hidden.
    await prisma.exhibitionSection.delete({ where: { id: sectionId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/exhibitions/[id]/sections/[sectionId]] error:', error)
    return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Create `src/app/api/exhibitions/[id]/sections/order/route.ts`**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  requireExhibitionOwner,
  SECTION_DTO_SELECT,
  toSectionDto,
} from '@/lib/exhibitionSectionAccess'
import prisma from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

/* ------------------------ PUT (reorder) ------------------------ */
export async function PUT(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const { error } = await requireExhibitionOwner(id)
    if (error) return error

    const body = (await request.json().catch(() => ({}))) as { sectionIds?: unknown }
    const requested = body.sectionIds
    const current = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: id },
      select: { id: true },
    })
    const currentIds = new Set(current.map((s) => s.id))

    // The new order must be a permutation of exactly this exhibition's
    // sections: nothing dropped, nothing doubled, nothing from another show.
    const valid =
      Array.isArray(requested) &&
      requested.every((v): v is string => typeof v === 'string') &&
      requested.length === currentIds.size &&
      new Set(requested).size === requested.length &&
      requested.every((sectionId) => currentIds.has(sectionId))
    if (!valid) {
      return NextResponse.json(
        { error: 'The section list changed. Reload the page and try again.' },
        { status: 400 },
      )
    }

    await prisma.$transaction(
      (requested as string[]).map((sectionId, order) =>
        prisma.exhibitionSection.update({ where: { id: sectionId }, data: { order } }),
      ),
    )

    const sections = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: id },
      select: SECTION_DTO_SELECT,
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(sections.map(toSectionDto))
  } catch (error) {
    console.error('[PUT /api/exhibitions/[id]/sections/order] error:', error)
    return NextResponse.json({ error: 'Failed to reorder sections' }, { status: 500 })
  }
}
```

- [ ] **Step 7: Run the spec to verify it passes**

Run (with `pnpm dev` stopped): `pnpm test:e2e e2e/exhibition-sections-api.spec.ts`
Expected: 6 passed.

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Do not commit.

---

### Task 3: Artwork save + load carry the section

**Files:**
- Modify: `src/app/api/artworks/[id]/route.ts` (GET ~line 200–213; PUT membership block ~line 366–457)
- Test: `e2e/artwork-exhibition-sections.spec.ts`

**Interfaces:**
- Consumes: `exhibitionArtwork.sectionId`, `exhibitionSection` (Task 1).
- Produces: `GET /api/artworks/[id]` response gains `exhibitionSections: Record<string, string | null>` (keyed by exhibition id, `showOnPage` rows only). `PUT /api/artworks/[id]` accepts optional `exhibitionSections: Record<string, string | null>` alongside `exhibitionIds`; a section id that doesn't belong to its key's exhibition → `400 { error: 'That section belongs to a different exhibition.' }` with nothing written.

- [ ] **Step 1: Write the failing spec `e2e/artwork-exhibition-sections.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * The artwork PUT carries one section per ticked exhibition in
 * `exhibitionSections`, beside `exhibitionIds`. The GET returns the same map so
 * the form can pre-select. A section id from a different exhibition is refused
 * outright — and echoing the GET payload back (what the wall-view modal does)
 * must never change anything.
 *
 * Talks to the route directly. No WebGL.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function setup() {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
  const mk = (name: string) =>
    prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: name,
        url: `e2e-art-sections-${stamp()}`,
        spaceId: 'paris',
        status: 'current',
      },
      select: { id: true },
    })
  const showA = await mk('E2E Sections Show A')
  const showB = await mk('E2E Sections Show B')
  const sectionA = await prisma.exhibitionSection.create({
    data: { exhibitionId: showA.id, title: 'Magnolia', order: 0 },
  })
  const sectionB = await prisma.exhibitionSection.create({
    data: { exhibitionId: showB.id, title: 'Memory', order: 0 },
  })
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Sections Work', slug: `e2e-sections-work-${stamp()}` },
    select: { id: true },
  })
  const cleanup = async () => {
    await prisma.exhibition.deleteMany({ where: { id: { in: [showA.id, showB.id] } } })
    await prisma.artwork.deleteMany({ where: { id: artwork.id } })
  }
  return { showA, showB, sectionA, sectionB, artwork, cleanup }
}

const row = (exhibitionId: string, artworkId: string) =>
  prisma.exhibitionArtwork.findUnique({
    where: { exhibitionId_artworkId: { exhibitionId, artworkId } },
  })

test('ticking an exhibition with a section stores it, and GET returns it', async ({ request }) => {
  const s = await setup()
  try {
    const res = await request.put(`/api/artworks/${s.artwork.id}`, {
      data: {
        exhibitionIds: [s.showA.id, s.showB.id],
        exhibitionSections: { [s.showA.id]: s.sectionA.id, [s.showB.id]: null },
      },
    })
    expect(res.status()).toBe(200)
    expect((await row(s.showA.id, s.artwork.id))?.sectionId).toBe(s.sectionA.id)
    expect((await row(s.showB.id, s.artwork.id))?.sectionId).toBeNull()

    const got = await (await request.get(`/api/artworks/${s.artwork.id}`)).json()
    expect(got.exhibitionSections).toEqual({ [s.showA.id]: s.sectionA.id, [s.showB.id]: null })
  } finally {
    await s.cleanup()
  }
})

test('changing and clearing the section of an existing member', async ({ request }) => {
  const s = await setup()
  await prisma.exhibitionArtwork.create({
    data: { exhibitionId: s.showA.id, artworkId: s.artwork.id, showOnPage: true },
  })
  try {
    await request.put(`/api/artworks/${s.artwork.id}`, {
      data: { exhibitionIds: [s.showA.id], exhibitionSections: { [s.showA.id]: s.sectionA.id } },
    })
    expect((await row(s.showA.id, s.artwork.id))?.sectionId).toBe(s.sectionA.id)

    await request.put(`/api/artworks/${s.artwork.id}`, {
      data: { exhibitionIds: [s.showA.id], exhibitionSections: { [s.showA.id]: null } },
    })
    expect((await row(s.showA.id, s.artwork.id))?.sectionId).toBeNull()
  } finally {
    await s.cleanup()
  }
})

test('a section from a different exhibition is a 400 and writes nothing', async ({ request }) => {
  const s = await setup()
  try {
    const res = await request.put(`/api/artworks/${s.artwork.id}`, {
      data: {
        name: 'Should Not Save',
        exhibitionIds: [s.showA.id],
        exhibitionSections: { [s.showA.id]: s.sectionB.id },
      },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toMatch(/different exhibition/)
    expect(await row(s.showA.id, s.artwork.id), 'no membership created').toBeNull()
    const artwork = await prisma.artwork.findUniqueOrThrow({ where: { id: s.artwork.id } })
    expect(artwork.name).toBe('E2E Sections Work')
  } finally {
    await s.cleanup()
  }
})

test('echoing the GET payload back changes nothing (wall-view modal save)', async ({
  request,
}) => {
  const s = await setup()
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: s.showA.id,
      artworkId: s.artwork.id,
      showOnPage: true,
      sectionId: s.sectionA.id,
    },
  })
  try {
    const got = await (await request.get(`/api/artworks/${s.artwork.id}`)).json()
    const res = await request.put(`/api/artworks/${s.artwork.id}`, {
      data: { exhibitionIds: got.exhibitionIds, exhibitionSections: got.exhibitionSections },
    })
    expect(res.status()).toBe(200)
    expect((await row(s.showA.id, s.artwork.id))?.sectionId).toBe(s.sectionA.id)
  } finally {
    await s.cleanup()
  }
})

test('a PUT without exhibitionSections leaves existing sections alone', async ({ request }) => {
  const s = await setup()
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: s.showA.id,
      artworkId: s.artwork.id,
      showOnPage: true,
      sectionId: s.sectionA.id,
    },
  })
  try {
    await request.put(`/api/artworks/${s.artwork.id}`, {
      data: { exhibitionIds: [s.showA.id] },
    })
    expect((await row(s.showA.id, s.artwork.id))?.sectionId).toBe(s.sectionA.id)
  } finally {
    await s.cleanup()
  }
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e e2e/artwork-exhibition-sections.spec.ts`
Expected: FAIL — `exhibitionSections` is undefined in the GET and `sectionId` stays null.

- [ ] **Step 3: GET returns the map**

In `src/app/api/artworks/[id]/route.ts`, change the `memberOf` query and response:

```ts
    const memberOf = await prisma.exhibitionArtwork.findMany({
      where: { artworkId: id, showOnPage: true },
      select: { exhibitionId: true, sectionId: true },
    })

    return NextResponse.json({
      ...artwork,
      exhibitionIds: memberOf.map((m) => m.exhibitionId),
      // The section each show places this work in (null = no section), so the
      // Exhibitions picker pre-selects instead of resetting on every save.
      exhibitionSections: Object.fromEntries(memberOf.map((m) => [m.exhibitionId, m.sectionId])),
      limitedVariants: artwork.limitedVariants.map((v) => ({
```

- [ ] **Step 4: PUT validates the map**

Inside `if (Array.isArray(body.exhibitionIds)) {`, directly after `const allowedIds = new Set(ownedExhibitions.map((e) => e.id))`, add:

```ts
      // The section per ticked exhibition. Absent → sections are left exactly
      // as they are. Entries for exhibitions that aren't ticked are ignored.
      // A section must belong to the exhibition it is filed under — checked
      // here, before any write is queued, so a bad id fails the whole save.
      const requestedSections = new Map<string, string | null>()
      if (body.exhibitionSections && typeof body.exhibitionSections === 'object') {
        for (const [exhibitionId, sectionId] of Object.entries(
          body.exhibitionSections as Record<string, unknown>,
        )) {
          if (!allowedIds.has(exhibitionId)) continue
          if (sectionId === null || typeof sectionId === 'string') {
            requestedSections.set(exhibitionId, sectionId || null)
          }
        }
      }
      const namedSectionIds = [...requestedSections.values()].filter(
        (v): v is string => v !== null,
      )
      if (namedSectionIds.length) {
        const found = await prisma.exhibitionSection.findMany({
          where: { id: { in: namedSectionIds } },
          select: { id: true, exhibitionId: true },
        })
        const ownerOf = new Map(found.map((s) => [s.id, s.exhibitionId]))
        for (const [exhibitionId, sectionId] of requestedSections) {
          if (sectionId !== null && ownerOf.get(sectionId) !== exhibitionId) {
            return NextResponse.json(
              { error: 'That section belongs to a different exhibition.' },
              { status: 400 },
            )
          }
        }
      }
      const sectionData = (exhibitionId: string) =>
        requestedSections.has(exhibitionId)
          ? { sectionId: requestedSections.get(exhibitionId) ?? null }
          : {}
```

- [ ] **Step 5: PUT writes the section with the membership**

In the same block, add `sectionId: true` to the `rows` select:

```ts
        select: { exhibitionId: true, wallId: true, showOnPage: true, sectionId: true },
```

Replace the `for (const exhibitionId of allowedIds) { ... }` loop with:

```ts
      for (const exhibitionId of allowedIds) {
        const row = rowByExhibition.get(exhibitionId)
        if (memberIds.has(exhibitionId)) {
          // Already on the page — only the section may have changed. Skip the
          // write when it hasn't, so echoing the GET back is a true no-op.
          const next = sectionData(exhibitionId)
          if ('sectionId' in next && next.sectionId !== row?.sectionId) {
            membershipOperations.push(
              prisma.exhibitionArtwork.update({
                where: { exhibitionId_artworkId: { exhibitionId, artworkId: id } },
                data: next,
              }),
            )
          }
          continue
        }
        if (row) {
          // Hung but unchecked until now: keep the coordinates, add the page.
          membershipOperations.push(
            prisma.exhibitionArtwork.update({
              where: { exhibitionId_artworkId: { exhibitionId, artworkId: id } },
              data: { showOnPage: true, ...sectionData(exhibitionId) },
            }),
          )
        } else {
          // Brand new membership: on the page, not hung anywhere.
          membershipOperations.push(
            prisma.exhibitionArtwork.create({
              data: { exhibitionId, artworkId: id, showOnPage: true, ...sectionData(exhibitionId) },
            }),
          )
        }
      }
```

The removal loop below it stays as is.

- [ ] **Step 6: Run the new spec plus the existing membership specs**

Run: `pnpm test:e2e e2e/artwork-exhibition-sections.spec.ts e2e/artwork-exhibition-membership.spec.ts e2e/exhibition-membership-invariants.spec.ts`
Expected: all pass (5 new + existing unchanged).

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Do not commit.

---

### Task 4: Public page groups works by section

**Files:**
- Modify: `src/lib/queries/getPublicExhibitionByUrl.ts`
- Modify: `src/components/exhibitions/profile/index.tsx` (~line 104–114)
- Modify: `src/components/exhibitions/profile/ExhibitionProfile.module.scss`
- Test: `e2e/exhibition-page-sections.spec.ts`

**Interfaces:**
- Consumes: `groupBySection`, `SectionGroup` (Task 1).
- Produces: `PublicExhibition.groups: SectionGroup<PublicExhibitionArtwork>[]`; `PublicExhibition.artworks` = groups flattened (display order). `getExhibitionNeighbours` in `src/app/artworks/[slug]/page.tsx` is unchanged and inherits the order.

- [ ] **Step 1: Write the failing spec `e2e/exhibition-page-sections.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

/**
 * The public exhibition page splits its grid by section: works with no section
 * first (no heading), then each section in the artist's order under its own
 * heading. An empty section shows no heading. The artwork page's previous/next
 * walks the same order.
 *
 * Flat pages: no WebGL.
 */
test('groups works under section headings in order, and arrows follow the groups', async ({
  page,
}) => {
  const user = await prisma.user.findFirstOrThrow({
    where: { userType: 'artist', published: true },
  })
  const stamp = Date.now()
  const exhibition = await prisma.exhibition.create({
    data: {
      userId: user.id,
      handler: user.handler,
      mainTitle: 'E2E Page Sections',
      url: `e2e-page-sections-${stamp}`,
      spaceId: 'paris',
      status: 'current',
      published: true,
    },
  })
  const [first, second, empty] = await Promise.all(
    [`E2E First ${stamp}`, `E2E Second ${stamp}`, `E2E Empty ${stamp}`].map((title, order) =>
      prisma.exhibitionSection.create({ data: { exhibitionId: exhibition.id, title, order } }),
    ),
  )
  const mkWork = (label: string) =>
    prisma.artwork.create({
      data: {
        userId: user.id,
        name: label,
        title: `${label} ${stamp}`,
        slug: `e2e-${label.toLowerCase().replace(/\s+/g, '-')}-${stamp}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/section.jpg',
      },
    })
  const loose = await mkWork('Loose Work')
  const inFirst = await mkWork('First Work')
  const inSecond = await mkWork('Second Work')
  await prisma.exhibitionArtwork.createMany({
    data: [
      // Created in the "wrong" order on purpose — the page must not care.
      { exhibitionId: exhibition.id, artworkId: inSecond.id, showOnPage: true, sectionId: second.id },
      { exhibitionId: exhibition.id, artworkId: inFirst.id, showOnPage: true, sectionId: first.id },
      { exhibitionId: exhibition.id, artworkId: loose.id, showOnPage: true },
    ],
  })

  try {
    await page.goto(`/exhibitions/${user.handler}/${exhibition.url}`)

    await expect(page.locator('[data-section-heading]')).toHaveText([first.title, second.title])
    await expect(page.getByText(empty.title)).toHaveCount(0)

    const firstRegion = page.getByRole('region', { name: first.title })
    const secondRegion = page.getByRole('region', { name: second.title })
    await expect(firstRegion.getByText(inFirst.title!)).toBeVisible()
    await expect(secondRegion.getByText(inSecond.title!)).toBeVisible()
    await expect(page.getByText(loose.title!)).toBeVisible()
    await expect(firstRegion.getByText(loose.title!)).toHaveCount(0)
    await expect(secondRegion.getByText(loose.title!)).toHaveCount(0)

    // Arrows walk loose → first section → second section.
    const context = `?exhibition=${encodeURIComponent(exhibition.url)}`
    await page.goto(`/artworks/${loose.slug}${context}`)
    await expect(page.getByRole('link', { name: /^Next work:/ })).toHaveAttribute(
      'href',
      `/artworks/${inFirst.slug}${context}`,
    )
    await page.goto(`/artworks/${inFirst.slug}${context}`)
    await expect(page.getByRole('link', { name: /^Next work:/ })).toHaveAttribute(
      'href',
      `/artworks/${inSecond.slug}${context}`,
    )
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.deleteMany({ where: { id: { in: [loose.id, inFirst.id, inSecond.id] } } })
  }
})

test('an exhibition without sections renders no headings', async ({ page }) => {
  const user = await prisma.user.findFirstOrThrow({
    where: { userType: 'artist', published: true },
  })
  const stamp = Date.now()
  const exhibition = await prisma.exhibition.create({
    data: {
      userId: user.id,
      handler: user.handler,
      mainTitle: 'E2E No Sections',
      url: `e2e-no-sections-${stamp}`,
      spaceId: 'paris',
      status: 'current',
      published: true,
    },
  })
  const artwork = await prisma.artwork.create({
    data: {
      userId: user.id,
      name: 'Plain Work',
      title: `E2E Plain ${stamp}`,
      slug: `e2e-plain-${stamp}`,
      artworkType: 'image',
      imageUrl: 'https://example.invalid/plain.jpg',
    },
  })
  await prisma.exhibitionArtwork.create({
    data: { exhibitionId: exhibition.id, artworkId: artwork.id, showOnPage: true },
  })
  try {
    await page.goto(`/exhibitions/${user.handler}/${exhibition.url}`)
    await expect(page.getByText(`E2E Plain ${stamp}`)).toBeVisible()
    await expect(page.locator('[data-section-heading]')).toHaveCount(0)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.delete({ where: { id: artwork.id } })
  }
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e e2e/exhibition-page-sections.spec.ts`
Expected: first test FAILS (no `[data-section-heading]`); second passes.

- [ ] **Step 3: Query returns groups**

In `src/lib/queries/getPublicExhibitionByUrl.ts`:

Add the import:

```ts
import { groupBySection, type SectionGroup } from '@/lib/exhibitionSections'
```

In `getExhibition`, add `sections` beside `exhibitionArtworks` and `sectionId` to its select:

```ts
      sections: {
        select: { id: true, title: true },
        orderBy: { order: 'asc' },
      },
      exhibitionArtworks: {
        // Membership, not placement. A work with no coordinates at all belongs
        // here; a work hung in the room but unchecked does not.
        where: { showOnPage: true },
        select: {
          pageOrder: true,
          sectionId: true,
          artwork: { select: PUBLIC_ARTWORK_SELECT },
        },
      },
```

In `type PublicExhibition`, after `artworks: PublicExhibitionArtwork[]`, add:

```ts
  /** The grid's layout: works with no section first (title null), then one
   *  group per section in the artist's order. Empty groups are left out.
   *  `artworks` is exactly these groups flattened. */
  groups: SectionGroup<PublicExhibitionArtwork>[]
```

In `loadPublicExhibition`, replace the `const artworks = ...` chain and its `.map(...)` with:

```ts
  const ordered = exhibition.exhibitionArtworks
    .filter((ea) => !ea.artwork.hiddenFromExhibition && ea.artwork.artworkType === 'image')
    .sort((a, b) => {
      // Per-exhibition order when the artist has set one, otherwise the
      // artist's library order. Unordered rows sink below ordered ones.
      const aOrder = a.pageOrder ?? Number.POSITIVE_INFINITY
      const bOrder = b.pageOrder ?? Number.POSITIVE_INFINITY
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.artwork.order - b.artwork.order
    })

  // Sections split the page; the flattened groups are the one display order the
  // artwork page's previous/next arrows also walk.
  const groups = groupBySection(
    ordered.map((ea) => ({ sectionId: ea.sectionId, artwork: toPublicArtwork(ea.artwork) })),
    exhibition.sections,
  )
  const artworks = groups.flatMap((g) => g.artworks)
```

And add `groups,` to the returned object after `artworks,`.

- [ ] **Step 4: Render one grid per group**

In `src/components/exhibitions/profile/index.tsx`, replace the block

```tsx
        {exhibition.artworks.length > 0 && (
          <div className={styles.artworksSection}>
            ...
          </div>
        )}
```

with:

```tsx
        {exhibition.artworks.length > 0 && (
          <div className={styles.artworksSection}>
            {/* One grid per section, no-section works first with no heading.
                The slug rides along on every card link, so the artwork page
                can offer arrows through THIS exhibition's sequence. */}
            {exhibition.groups.map((group) => (
              <section
                key={group.id ?? 'unsectioned'}
                className={styles.group}
                aria-label={group.title ?? undefined}
              >
                {group.title && (
                  <Text as="h2" className={styles.groupHeading} data-section-heading>
                    {group.title}
                  </Text>
                )}
                <ArtworkGrid
                  artworks={group.artworks}
                  artistName={artistName}
                  exhibitionSlug={exhibitionSlug}
                />
              </section>
            ))}
          </div>
        )}
```

If `Text` does not forward `data-*` attributes (check `src/components/ui/Typography`), use a plain `<h2 className={styles.groupHeading} data-section-heading>` instead.

- [ ] **Step 5: Heading styles**

Append to `src/components/exhibitions/profile/ExhibitionProfile.module.scss`:

```scss
.group + .group {
  margin-top: var(--space-10);

  @include breakpoint(lg) {
    margin-top: var(--space-16);
  }
}

// Centered section title with a hairline either side — the same border token
// as the card caption rule, so the page keeps one line weight.
.groupHeading {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  margin: 0 0 var(--space-8);
  font-family: var(--font-serif);
  font-size: var(--text-xl-mobile);
  font-weight: 400;
  color: var(--color-text-primary);
  text-align: center;

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-top: 1px solid var(--color-border-default);
  }

  @include breakpoint(lg) {
    font-size: var(--text-xl);
    margin-bottom: var(--space-10);
  }
}
```

Check each token exists (`grep -rn -- "--space-16\|--text-xl-mobile\|--color-border-default" src/styles`); swap for the nearest existing token if one is missing.

- [ ] **Step 6: Run the new spec plus the existing page/neighbour specs**

Run: `pnpm test:e2e e2e/exhibition-page-sections.spec.ts e2e/exhibition-page-membership.spec.ts e2e/artwork-neighbours.spec.ts`
Expected: all pass.

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Do not commit.

---

### Task 5: Sections editor on the exhibition settings page

**Files:**
- Create: `src/components/dashboard/exhibitions/settings/SectionsEditor.tsx`
- Create: `src/components/dashboard/exhibitions/settings/SectionsEditor.module.scss`
- Modify: `src/components/dashboard/exhibitions/settings/index.tsx` (between the Short Description section and the Description section, ~line 372)
- Test: `e2e/exhibition-sections-editor.spec.ts`

**Interfaces:**
- Consumes: the five routes and `SectionDto` shape from Task 2; `SECTION_TITLE_MAX` (Task 1).
- Produces: `<SectionsEditor exhibitionId={string} />`.

- [ ] **Step 1: Write the failing spec `e2e/exhibition-sections-editor.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'
import { seedCookieConsent } from './consent-helpers'

/**
 * The Sections block on the exhibition settings page. Every action saves on
 * its own — add, rename, delete, drag — so each test reloads and reads the DB
 * to prove it stuck. Dragging uses dnd-kit's keyboard sensor (focus the
 * handle, Space, arrow, Space) — the same code path as a mouse drop, and far
 * steadier in a headless browser.
 *
 * No WebGL: the settings page is plain DOM.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function createExhibition() {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
  const exhibition = await prisma.exhibition.create({
    data: {
      userId: owner.id,
      handler: owner.handler,
      mainTitle: 'E2E Sections Editor',
      url: `e2e-sections-editor-${stamp()}`,
      spaceId: 'paris',
      status: 'current',
    },
    select: { id: true },
  })
  return { owner, exhibition }
}

const titlesInDb = async (exhibitionId: string) =>
  (
    await prisma.exhibitionSection.findMany({
      where: { exhibitionId },
      orderBy: { order: 'asc' },
      select: { title: true },
    })
  ).map((s) => s.title)

test('add sections, with errors on blank and duplicate names', async ({ page }) => {
  const { exhibition } = await createExhibition()
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/exhibitions/${exhibition.id}/settings`)
    await expect(page.getByRole('heading', { name: 'Sections' })).toBeVisible()

    const input = page.getByLabel('New section name')
    const add = page.getByRole('button', { name: 'Add section' })

    await add.click()
    await expect(page.getByText('Section name is required.')).toBeVisible()
    await input.fill('M')
    await expect(page.getByText('Section name is required.')).toHaveCount(0)

    await input.fill('Magnolia')
    await add.click()
    await expect(page.locator('[data-section-row]', { hasText: 'Magnolia' })).toBeVisible()
    await expect(input).toHaveValue('')

    await input.fill('Mistery')
    await input.press('Enter')
    await expect(page.locator('[data-section-row]', { hasText: 'Mistery' })).toBeVisible()

    await input.fill('magnolia')
    await add.click()
    await expect(page.getByText('This exhibition already has a section with that name.')).toBeVisible()

    await expect.poll(() => titlesInDb(exhibition.id)).toEqual(['Magnolia', 'Mistery'])
    await page.reload()
    await expect(page.locator('[data-section-row]')).toHaveCount(2)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
  }
})

test('rename keeps the works in the section', async ({ page }) => {
  const { owner, exhibition } = await createExhibition()
  const section = await prisma.exhibitionSection.create({
    data: { exhibitionId: exhibition.id, title: 'Mistery', order: 0 },
  })
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Editor Work', slug: `e2e-editor-work-${stamp()}` },
  })
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: exhibition.id,
      artworkId: artwork.id,
      showOnPage: true,
      sectionId: section.id,
    },
  })
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/exhibitions/${exhibition.id}/settings`)

    const row = page.locator(`[data-section-id="${section.id}"]`)
    await row.getByRole('button', { name: 'Rename' }).click()
    const field = row.getByLabel('Section name')
    await field.fill('Mystery')
    await field.press('Enter')
    await expect(row).toContainText('Mystery')

    await expect.poll(() => titlesInDb(exhibition.id)).toEqual(['Mystery'])
    const member = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: { exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id } },
    })
    expect(member.sectionId).toBe(section.id)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.delete({ where: { id: artwork.id } })
  }
})

test('drag to reorder persists', async ({ page }) => {
  const { exhibition } = await createExhibition()
  await prisma.exhibitionSection.createMany({
    data: ['Magnolia', 'Mistery', 'Memory'].map((title, order) => ({
      exhibitionId: exhibition.id,
      title,
      order,
    })),
  })
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/exhibitions/${exhibition.id}/settings`)

    const handle = page.getByRole('button', { name: 'Drag to reorder Memory' })
    await handle.focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Space')

    await expect.poll(() => titlesInDb(exhibition.id)).toEqual(['Memory', 'Magnolia', 'Mistery'])
    await page.reload()
    await expect(page.locator('[data-section-row]')).toHaveText([/Memory/, /Magnolia/, /Mistery/])
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
  }
})

test('delete asks first, says how many works move, and keeps them', async ({ page }) => {
  const { owner, exhibition } = await createExhibition()
  const section = await prisma.exhibitionSection.create({
    data: { exhibitionId: exhibition.id, title: 'Memory', order: 0 },
  })
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Editor Delete', slug: `e2e-editor-delete-${stamp()}` },
  })
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: exhibition.id,
      artworkId: artwork.id,
      showOnPage: true,
      sectionId: section.id,
    },
  })
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/exhibitions/${exhibition.id}/settings`)

    await page
      .locator(`[data-section-id="${section.id}"]`)
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(page.getByText('1 artwork will move to no section. It stays on the page.')).toBeVisible()
    await page.getByRole('button', { name: 'Delete section' }).click()

    await expect(page.locator('[data-section-row]')).toHaveCount(0)
    await expect.poll(() => titlesInDb(exhibition.id)).toEqual([])
    const member = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: { exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id } },
    })
    expect(member.sectionId).toBeNull()
    expect(member.showOnPage).toBe(true)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.delete({ where: { id: artwork.id } })
  }
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e e2e/exhibition-sections-editor.spec.ts`
Expected: FAIL — no "Sections" heading.

- [ ] **Step 3: Create `SectionsEditor.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { SECTION_TITLE_MAX } from '@/lib/exhibitionSections'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import dashboardStyles from '../../DashboardLayout/DashboardLayout.module.scss'
import styles from './SectionsEditor.module.scss'

type Section = { id: string; title: string; order: number; artworkCount: number }

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  return data?.error || fallback
}

function SectionRow({
  section,
  onRename,
  onDelete,
}: {
  section: Section
  onRename: (id: string, title: string) => Promise<string | null>
  onDelete: (section: Section) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.title)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    setDraft(section.title)
    setError('')
    setEditing(true)
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setSaving(true)
    const message = await onRename(section.id, draft)
    setSaving(false)
    if (message) setError(message)
    else setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      data-section-row
      data-section-id={section.id}
      className={styles.row}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${section.title}`}
      >
        <GripVertical size={18} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
      </div>

      {editing ? (
        <form className={styles.renameForm} onSubmit={save}>
          <Input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
            }}
            maxLength={SECTION_TITLE_MAX}
            invalid={!!error}
            autoFocus
            aria-label="Section name"
          />
          <Button
            font="dashboard"
            variant="primary"
            label={saving ? 'Saving...' : 'Save'}
            type="submit"
            disabled={saving}
          />
          <Button
            font="dashboard"
            variant="secondary"
            label="Cancel"
            onClick={() => setEditing(false)}
            disabled={saving}
          />
          {error && <ErrorText>{error}</ErrorText>}
        </form>
      ) : (
        <>
          <span className={styles.title}>{section.title}</span>
          <span className={styles.count}>
            {section.artworkCount === 1 ? '1 artwork' : `${section.artworkCount} artworks`}
          </span>
          <Button font="dashboard" variant="secondary" label="Rename" onClick={startEditing} />
          <Button
            font="dashboard"
            variant="secondary"
            label="Delete"
            onClick={() => onDelete(section)}
          />
        </>
      )}
    </div>
  )
}

/**
 * The exhibition's page sections. Every action saves on its own — there is no
 * pending state for the page's main Save button to forget — so a section exists
 * the moment it is created and the artwork form can offer it right away.
 */
export const SectionsEditor = ({ exhibitionId }: { exhibitionId: string }) => {
  const base = `/api/exhibitions/${exhibitionId}/sections`
  const [sections, setSections] = useState<Section[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [listError, setListError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Section | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch(base)
      if (cancelled) return
      if (res.ok) setSections(await res.json())
      else setListError(await readError(res, 'Failed to load sections'))
    })()
    return () => {
      cancelled = true
    }
  }, [base])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setAdding(true)
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })
    setAdding(false)
    if (!res.ok) {
      setAddError(await readError(res, 'Failed to add section'))
      return
    }
    const created: Section = await res.json()
    setSections((prev) => [...prev, created])
    setNewTitle('')
  }

  const handleRename = useCallback(
    async (id: string, title: string): Promise<string | null> => {
      const res = await fetch(`${base}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) return readError(res, 'Failed to rename section')
      const updated: Section = await res.json()
      setSections((prev) => prev.map((s) => (s.id === id ? updated : s)))
      return null
    },
    [base],
  )

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    const res = await fetch(`${base}/${pendingDelete.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) {
      setListError(await readError(res, 'Failed to delete section'))
    } else {
      const removedId = pendingDelete.id
      setSections((prev) => prev.filter((s) => s.id !== removedId))
    }
    setPendingDelete(null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const previous = sections
    const oldIndex = previous.findIndex((s) => s.id === active.id)
    const newIndex = previous.findIndex((s) => s.id === over.id)
    const next = arrayMove(previous, oldIndex, newIndex)
    setSections(next)
    setListError('')

    const res = await fetch(`${base}/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionIds: next.map((s) => s.id) }),
    })
    if (!res.ok) {
      // Snap back to what is actually saved, and say why.
      setSections(previous)
      setListError(await readError(res, 'Failed to reorder sections'))
    }
  }

  const deleteMessage = (section: Section) =>
    section.artworkCount === 0
      ? 'It has no artworks.'
      : section.artworkCount === 1
        ? '1 artwork will move to no section. It stays on the page.'
        : `${section.artworkCount} artworks will move to no section. They stay on the page.`

  return (
    <div className={dashboardStyles.section}>
      <h3 className={dashboardStyles.sectionTitle}>Sections</h3>
      <p className={dashboardStyles.sectionDescription}>
        Optional. Split this exhibition&apos;s page into titled groups. Drag to change their order.
      </p>

      {sections.length > 0 && (
        <div className={styles.list}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  onRename={handleRename}
                  onDelete={setPendingDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
      {listError && <ErrorText>{listError}</ErrorText>}

      <form className={styles.addForm} onSubmit={handleAdd}>
        <Input
          type="text"
          value={newTitle}
          onChange={(e) => {
            setNewTitle(e.target.value)
            setAddError('')
          }}
          placeholder="e.g. Magnolia"
          maxLength={SECTION_TITLE_MAX}
          invalid={!!addError}
          aria-label="New section name"
        />
        <Button
          font="dashboard"
          variant="secondary"
          label={adding ? 'Adding...' : 'Add section'}
          type="submit"
          disabled={adding}
        />
      </form>
      {addError && <ErrorText>{addError}</ErrorText>}

      {pendingDelete && (
        <ConfirmModal
          title={`Delete "${pendingDelete.title}"?`}
          message={deleteMessage(pendingDelete)}
          confirmLabel="Delete section"
          destructive
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
```

Note: the blank-title error comes from the server (`validateSectionTitle`) on submit, which is the "errors on submit" step of the form validation flow; typing clears it.

- [ ] **Step 4: Create `SectionsEditor.module.scss`**

```scss
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
}

.dragHandle {
  display: flex;
  cursor: grab;
  color: var(--color-text-secondary);
  touch-action: none;
}

.title {
  flex: 1;
  color: var(--color-text-primary);
}

.count {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.renameForm {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.addForm {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
```

Check tokens exist (`--radius-sm`, `--text-sm`, `--color-surface-subtle`) with `grep -rn -- "--radius-sm:\|--text-sm:\|--color-surface-subtle:" src/styles`; use the nearest existing token if one is missing.

- [ ] **Step 5: Mount it in the settings page**

In `src/components/dashboard/exhibitions/settings/index.tsx`, add the import:

```ts
import { SectionsEditor } from './SectionsEditor'
```

and insert, immediately before `<div className={dashboardStyles.section}>` whose title is "Description":

```tsx
      <SectionsEditor exhibitionId={exhibition.id} />
```

- [ ] **Step 6: Run the spec to verify it passes**

Run: `pnpm test:e2e e2e/exhibition-sections-editor.spec.ts`
Expected: 4 passed. If the keyboard drag test is flaky, check the handle has `tabIndex=0` (dnd-kit `attributes` sets it) and that focus lands on it before Space.

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Do not commit.

---

### Task 6: Section dropdown on the artwork form

**Files:**
- Modify: `src/components/shared/ArtworkEditForm/index.tsx` (type `Artwork` ~line 108; `ArtworkFormData` ~line 151; `getInitialFormData`/`populateFormData` ~175/205; props ~226–229; Exhibitions block ~1438–1466)
- Modify: `src/components/shared/ArtworkEditForm/ArtworkEditForm.module.scss`
- Modify: `src/components/dashboard/artworks/edit/index.tsx` (~43–45, ~120–132, ~149)
- Modify: `src/components/wallview/ArtworkEditModal/index.tsx` (~119)
- Modify: `src/app/api/exhibitions/route.ts` (GET `include`, ~line 145)
- Test: `e2e/artwork-section-picker.spec.ts`

**Interfaces:**
- Consumes: `GET /api/artworks/[id]` → `exhibitionSections`; `PUT` accepts it (Task 3).
- Produces: `GET /api/exhibitions` rows gain `sections: { id: string; title: string }[]` (ordered); `export type ArtworkFormValue = string | boolean | string[] | Record<string, string | null>`; `ArtworkFormData.exhibitionSections: Record<string, string | null>`; `exhibitions` prop type `{ id: string; mainTitle: string; published: boolean; sections: { id: string; title: string }[] }[]`.

- [ ] **Step 1: Write the failing spec `e2e/artwork-section-picker.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'
import { seedCookieConsent } from './consent-helpers'

/**
 * The section dropdown under each ticked exhibition on the artwork form. It
 * appears only for ticked exhibitions that have sections, pre-selects the
 * saved section, and saves with the normal Save button.
 *
 * `SelectDropdown` is a button (named by the selected label) that opens a
 * listbox of `role="option"` items.
 *
 * No WebGL: the dashboard edit form is plain DOM.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function setup() {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
  const mk = (mainTitle: string) =>
    prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle,
        url: `e2e-picker-sections-${stamp()}`,
        spaceId: 'paris',
        status: 'current',
        published: true,
      },
      select: { id: true },
    })
  const withSections = await mk('E2E Picker With Sections')
  const without = await mk('E2E Picker Without Sections')
  const magnolia = await prisma.exhibitionSection.create({
    data: { exhibitionId: withSections.id, title: 'E2E Magnolia', order: 0 },
  })
  await prisma.exhibitionSection.create({
    data: { exhibitionId: withSections.id, title: 'E2E Memory', order: 1 },
  })
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Picker Sections Work', slug: `e2e-pick-sec-${stamp()}` },
    select: { id: true },
  })
  const cleanup = async () => {
    await prisma.exhibition.deleteMany({ where: { id: { in: [withSections.id, without.id] } } })
    await prisma.artwork.deleteMany({ where: { id: artwork.id } })
  }
  return { withSections, without, magnolia, artwork, cleanup }
}

test('choose a section for a ticked exhibition and save', async ({ page }) => {
  const s = await setup()
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${s.artwork.id}/edit`)

    const withRow = page.locator(`[data-exhibition-row="${s.withSections.id}"]`)
    const withoutRow = page.locator(`[data-exhibition-row="${s.without.id}"]`)

    // Unticked: no dropdown anywhere.
    await expect(withRow.locator('[aria-haspopup="listbox"]')).toHaveCount(0)

    await page.locator('label', { hasText: 'E2E Picker With Sections' }).click()
    await page.locator('label', { hasText: 'E2E Picker Without Sections' }).click()

    // Ticked + has sections → dropdown; ticked + no sections → none.
    await expect(withoutRow.locator('[aria-haspopup="listbox"]')).toHaveCount(0)
    await withRow.getByRole('button', { name: 'No section' }).click()
    await expect(page.getByRole('option')).toHaveText(['No section', 'E2E Magnolia', 'E2E Memory'])
    await page.getByRole('option', { name: 'E2E Magnolia' }).click()

    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForURL('**/dashboard/artworks', { timeout: 15000 })

    const member = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: {
        exhibitionId_artworkId: { exhibitionId: s.withSections.id, artworkId: s.artwork.id },
      },
    })
    expect(member.sectionId).toBe(s.magnolia.id)
  } finally {
    await s.cleanup()
  }
})

test('the saved section is pre-selected and survives an unrelated save', async ({ page }) => {
  const s = await setup()
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: s.withSections.id,
      artworkId: s.artwork.id,
      showOnPage: true,
      sectionId: s.magnolia.id,
    },
  })
  try {
    await seedCookieConsent(page)
    await page.goto(`/dashboard/artworks/${s.artwork.id}/edit`)

    const withRow = page.locator(`[data-exhibition-row="${s.withSections.id}"]`)
    await expect(withRow.getByRole('button', { name: 'E2E Magnolia' })).toBeVisible()

    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForURL('**/dashboard/artworks', { timeout: 15000 })

    const member = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: {
        exhibitionId_artworkId: { exhibitionId: s.withSections.id, artworkId: s.artwork.id },
      },
    })
    expect(member.sectionId).toBe(s.magnolia.id)
  } finally {
    await s.cleanup()
  }
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e e2e/artwork-section-picker.spec.ts`
Expected: FAIL — no `[data-exhibition-row]`.

- [ ] **Step 3: Exhibitions list includes sections**

In `src/app/api/exhibitions/route.ts` GET, inside `include: { ... }` beside `user`, add:

```ts
        // For the artwork form's per-exhibition section dropdown. Titles only;
        // drafts are already filtered out above for anyone but the owner.
        sections: {
          select: { id: true, title: true },
          orderBy: { order: 'asc' },
        },
```

- [ ] **Step 4: Form data + types in `ArtworkEditForm/index.tsx`**

In the local `Artwork` type, after `exhibitionIds?: string[]`, add:

```ts
  /** The section each member exhibition places this work in (null = none).
   *  Keyed by exhibition id; same source as `exhibitionIds`. */
  exhibitionSections?: Record<string, string | null>
```

In `ArtworkFormData`, after `exhibitionIds: string[]`, add:

```ts
  /** Section per exhibition, keyed by exhibition id. Only ticked exhibitions'
   *  entries are applied on save. */
  exhibitionSections: Record<string, string | null>
```

In `getInitialFormData`, after `exhibitionIds: [],` add `exhibitionSections: {},`.
In `populateFormData`, after `exhibitionIds: data.exhibitionIds ?? [],` add `exhibitionSections: data.exhibitionSections ?? {},`.

Above `type ArtworkEditFormProps`, add:

```ts
/** Every value shape the form's single change handler carries. */
export type ArtworkFormValue = string | boolean | string[] | Record<string, string | null>
```

In `ArtworkEditFormProps`, change:

```ts
  onFormChange: (field: string, value: ArtworkFormValue) => void
  /** The artist's own exhibitions, for the Exhibitions checkbox section. Renders
   *  only when this is supplied — the wall-view ArtworkEditModal is already
   *  inside one exhibition and has no use for a cross-exhibition picker. Each
   *  carries its sections, in page order, for the per-exhibition dropdown. */
  exhibitions?: {
    id: string
    mainTitle: string
    published: boolean
    sections: { id: string; title: string }[]
  }[]
```

Add the import beside the other UI imports:

```ts
import { SelectDropdown } from '@/components/ui/SelectDropdown/SelectDropdown'
```

(Use `@/components/ui/SelectDropdown` instead if that folder has an `index.ts`; check with `ls src/components/ui/SelectDropdown`.)

- [ ] **Step 5: Render the dropdown**

Replace the `{exhibitions.map((exhibition) => ( <Checkbox ... /> ))}` inside the Exhibitions block with:

```tsx
            {exhibitions.map((exhibition) => {
              const ticked = formData.exhibitionIds.includes(exhibition.id)
              return (
                <div key={exhibition.id} data-exhibition-row={exhibition.id}>
                  <Checkbox
                    checked={ticked}
                    onChange={(e) =>
                      onFormChange(
                        'exhibitionIds',
                        e.target.checked
                          ? [...formData.exhibitionIds, exhibition.id]
                          : formData.exhibitionIds.filter((id) => id !== exhibition.id),
                      )
                    }
                    label={
                      exhibition.published
                        ? exhibition.mainTitle
                        : `${exhibition.mainTitle} (draft)`
                    }
                  />
                  {/* Only when the work is on this show's page and the show has
                      sections to offer — otherwise the form reads as before. */}
                  {ticked && exhibition.sections.length > 0 && (
                    <SelectDropdown
                      className={styles.sectionSelect}
                      options={[
                        { value: '', label: 'No section' },
                        ...exhibition.sections.map((s) => ({ value: s.id, label: s.title })),
                      ]}
                      value={formData.exhibitionSections[exhibition.id] ?? ''}
                      onChange={(value) =>
                        onFormChange('exhibitionSections', {
                          ...formData.exhibitionSections,
                          [exhibition.id]: value || null,
                        })
                      }
                    />
                  )}
                </div>
              )
            })}
```

Change the hint below it to:

```tsx
            <span className={dashboardStyles.hint}>
              Independent of the 3D space. An artwork can appear on the page
              without hanging in the room. Sections are set up on each
              exhibition&apos;s settings page.
            </span>
```

Check the file's SCSS import name (`styles` vs another) with `grep -n "module.scss" src/components/shared/ArtworkEditForm/index.tsx` and use it. Append to `ArtworkEditForm.module.scss`:

```scss
.sectionSelect {
  max-width: 320px;
  margin: var(--space-2) 0 var(--space-3) var(--space-8);
}
```

- [ ] **Step 6: Feed sections in and widen the handlers**

In `src/components/dashboard/artworks/edit/index.tsx`:

- Import the type: add `type ArtworkFormValue` to the existing import from `@/components/shared/ArtworkEditForm`.
- Change the `exhibitions` state type to
  `{ id: string; mainTitle: string; published: boolean; sections: { id: string; title: string }[] }[]`.
- In the fetch, type the response the same way and map `sections: ex.sections ?? []`.
- Change `const handleChange = (field: string, value: string | boolean | string[]) => {` to `const handleChange = (field: string, value: ArtworkFormValue) => {`.

In `src/components/wallview/ArtworkEditModal/index.tsx`, change its `handleChange` signature the same way and import `type ArtworkFormValue` from wherever that file imports `ArtworkEditForm`.

- [ ] **Step 7: Run the spec plus the existing picker spec**

Run: `pnpm test:e2e e2e/artwork-section-picker.spec.ts e2e/artwork-exhibition-picker.spec.ts`
Expected: all pass.

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Do not commit.

---

### Task 7: Full verification and owner hand-off

**Files:** none new.

- [ ] **Step 1: Gallery e2e group**

Run (with `pnpm dev` stopped): `pnpm test:e2e:gallery`
Expected: all pass. Every new spec deletes its exhibitions and artworks in `finally`; confirm 0 strays by checking the dev DB has no `Exhibition` whose `url` starts with `e2e-sections-`, `e2e-art-sections-`, `e2e-page-sections-`, `e2e-no-sections-` or `e2e-picker-sections-`, and no `Artwork` whose `slug` starts with `e2e-` from this run (use `e2e/cleanup-helpers.ts` if it offers a stray check).

- [ ] **Step 2: Local prod build**

Run: `pnpm build`
Expected: build succeeds (new route segments + `SectionsEditor` client component compile under the prod import graph).

- [ ] **Step 3: Hand off to the owner**

Report: what changed, the five new e2e spec files and their results, and the manual test path —
1. `/dashboard/exhibitions/<id>/settings` → add Magnolia / Mistery / Memory, rename one, drag to reorder, delete one with works.
2. `/dashboard/artworks/<id>/edit` → tick the exhibition, pick a section, Save.
3. The public exhibition page → headings in order, no-section works first.
4. Open a work from the grid → previous/next follow the grouped order.

Remind the owner the prod schema push (new table + nullable column) must ship with the deploy. Do not commit until they say OK.
