# Exhibition Membership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an artwork appear on an exhibition page without being hung in that
exhibition's 3D room, and let the 3D room be published and unpublished
independently of the exhibition itself.

**Architecture:** `ExhibitionArtwork` currently stores membership and 3D
placement in one row with every placement column non-nullable. The placement
columns become nullable and a `showOnPage` boolean becomes the sole authority
over the public grid. The nullability is contained at a single seam — every
query feeding the wall editor or the 3D scene filters to placed rows and narrows
before mapping — so the ~25 files that read `wallId` / `posX3d` / `quaternionW`
are never touched. A second `Exhibition.spacePublished` flag gates the 3D alone.

**Tech Stack:** Next.js App Router (server components + route handlers), Prisma
on Postgres, Redux Toolkit for the wall editor, Playwright for tests, SCSS
modules.

**Spec:** `docs/superpowers/specs/2026-09-22-exhibition-membership-design.md`

## Global Constraints

- **Branch:** `feat/AR-151-publish-independently`. All commits for AR-151 stay on
  it. Never merge locally; never open a PR; never push until told.
- **Version:** bump `package.json` from `3.10.7` to `3.11.0` (new capability, no
  breaking change). Tags track `package.json` exactly.
- **Migrations:** edit `prisma/schema.prisma` freely, but **never run
  `prisma migrate` or `prisma db push`, and never propose a specific migrate
  command.** The owner runs every push, dev first then prod. Tasks that need a
  pushed schema STOP and hand off.
- **Tests:** Playwright only, in `/e2e/`. No Vitest/Jest. Never mount the 3D
  scene or the wizard — flat pages only. New specs are named `exhibition-*` or
  `artwork-*` so `pnpm test:e2e:gallery` picks them up.
- **E2E hygiene:** every fixture is deleted by run-end; leave zero strays. Run
  with `pnpm dev` stopped. Never send email from a test.
- **Spelling:** American — color, gray, center — in code, comments, UI copy.
- **UI:** use the `<Button/>` and `<Checkbox/>` components, never plain
  `<button>`. No emoji — `lucide-react` icons via the `Icon` component. No
  `!important`. No `var()` fallbacks in SCSS. Client-facing controls squared;
  dashboard and admin controls rounded.
- **No new dependencies** without explicit approval.

---

### Task 1: Schema, containment, and version bump

Makes twelve placement columns nullable, adds membership columns, and — in the
same task, because the build will not typecheck otherwise — narrows every query
that feeds the editor or the scene so the nullability never escapes the DB
boundary.

**Files:**
- Modify: `prisma/schema.prisma` (ExhibitionArtwork ~753-864, Exhibition ~667)
- Modify: `package.json:3`
- Modify: `src/lib/exhibitionArtworkMapper.ts` (add the narrowing helper)
- Modify: `src/app/api/exhibition-artworks/route.ts` (GET)
- Modify: `src/app/api/exhibitions/by-url/[url]/route.ts:30` and `:297`
- Modify: `src/lib/exhibitionSnapshot.ts:24`
- Modify: `src/app/exhibitions/[artistSlug]/[exhibitionSlug]/edit/page.tsx`

**Interfaces:**
- Produces: `toPlacedRows<T extends PlacementColumns>(rows: T[]): Placed<T>[]`
  exported from `src/lib/exhibitionArtworkMapper.ts`. Every later task that
  reads join rows for the editor or the scene calls this.
- Produces: `ExhibitionArtwork.showOnPage: boolean`, `.pageOrder: number | null`,
  `Exhibition.spacePublished: boolean`.
- `ExhibitionArtworkResponse` keeps `wallId: string` and every placement field
  non-nullable. **Do not change it.** That is the containment.

- [ ] **Step 1: Make the placement columns nullable and add the new columns**

In `prisma/schema.prisma`, model `ExhibitionArtwork`, change these twelve field
types to nullable and add the two membership fields directly beneath them:

```prisma
  // Placement — null when the work is in the show but not hung in the 3D room.
  // Cleared when the artist takes a work off a wall; never deleted with it.
  wallId      String?
  posX2d      Float?
  posY2d      Float?
  width2d     Float?
  height2d    Float?
  posX3d      Float?
  posY3d      Float?
  posZ3d      Float?
  quaternionX Float?
  quaternionY Float?
  quaternionZ Float?
  quaternionW Float?

  // Membership — the only thing that decides the public exhibition page.
  // Defaults true so every row that exists today comes out of the migration
  // already on its page: nothing in prod changes on deploy.
  showOnPage Boolean @default(true)
  // Per-exhibition grid position. Null falls back to the artist's library
  // order, which is what every row uses until a reorder UI exists.
  pageOrder  Int?
```

In model `Exhibition`, add beside `published`:

```prisma
  // Gates the 3D room alone: the "Enter Virtual Exhibition" button and the
  // /visit route. Defaults false so a new exhibition is page-first and the
  // room is revealed only when it is ready.
  spacePublished Boolean @default(false)
```

- [ ] **Step 2: Bump the version**

In `package.json`, change line 3 from `"version": "3.10.7",` to
`"version": "3.11.0",`.

- [ ] **Step 3: STOP — hand off the schema push**

Tell the owner: the schema is ready and needs pushing to the dev database, then
`pnpm db:generate`. Do not run either yourself. Wait for confirmation that the
push succeeded before continuing — every following step depends on the generated
client.

- [ ] **Step 4: Add the narrowing helper**

Append to `src/lib/exhibitionArtworkMapper.ts`:

```ts
/**
 * The twelve placement columns are nullable in the database because a work can
 * be in a show without hanging in its 3D room. Every consumer downstream of
 * `ExhibitionArtworkResponse` — the whole wall editor and the 3D scene — was
 * written against non-null coordinates and must stay that way.
 *
 * So the nullability stops here. Queries that feed the editor or the scene
 * filter on `wallId: { not: null }`, then pass their rows through this to
 * narrow. Prisma cannot infer that the filter guarantees the other eleven
 * columns, so the cast carries that knowledge in one place instead of at
 * twenty-five call sites.
 */
type PlacementColumns = {
  wallId: string | null
  posX2d: number | null
  posY2d: number | null
  width2d: number | null
  height2d: number | null
  posX3d: number | null
  posY3d: number | null
  posZ3d: number | null
  quaternionX: number | null
  quaternionY: number | null
  quaternionZ: number | null
  quaternionW: number | null
}

export type Placed<T extends PlacementColumns> = Omit<T, keyof PlacementColumns> & {
  wallId: string
  posX2d: number
  posY2d: number
  width2d: number
  height2d: number
  posX3d: number
  posY3d: number
  posZ3d: number
  quaternionX: number
  quaternionY: number
  quaternionZ: number
  quaternionW: number
}

export function toPlacedRows<T extends PlacementColumns>(rows: T[]): Placed<T>[] {
  return rows.filter((row) => row.wallId !== null) as Placed<T>[]
}
```

- [ ] **Step 5: Filter the four query sites**

Add `where: { wallId: { not: null } }` to the `exhibitionArtworks` include in
each of these, and pass the resulting rows through `toPlacedRows` before they
reach a mapper or a response body:

1. `src/app/api/exhibition-artworks/route.ts` — the GET that loads the editor
2. `src/app/api/exhibitions/by-url/[url]/route.ts:30` — the live path
3. `src/app/api/exhibitions/by-url/[url]/route.ts:297` — the legacy path
4. `src/lib/exhibitionSnapshot.ts:24` — the snapshot now serves the 3D scene
   only, so it captures placed rows only
5. `src/app/exhibitions/[artistSlug]/[exhibitionSlug]/edit/page.tsx` — the
   editor's server loader

For the snapshot, add this comment above the `where`:

```ts
      // Placed rows only. The snapshot's one job is freezing the 3D scene —
      // the public grid reads live membership and never looks in here.
      exhibitionArtworks: {
        where: { wallId: { not: null } },
```

- [ ] **Step 6: Verify the build is green**

Run: `pnpm typecheck`
Expected: PASS with no errors. If any error mentions `string | null` in a
wallview or scene file, a query site was missed — fix the query, do not
null-check the consumer.

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 7: Verify nothing regressed**

Run: `pnpm test:e2e:gallery`
Expected: PASS. Published exhibitions still render exactly as before, because
every existing row has `showOnPage` true by default.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma package.json src/lib/exhibitionArtworkMapper.ts \
  src/app/api/exhibition-artworks/route.ts \
  "src/app/api/exhibitions/by-url/[url]/route.ts" \
  src/lib/exhibitionSnapshot.ts \
  "src/app/exhibitions/[artistSlug]/[exhibitionSlug]/edit/page.tsx"
git commit -m "AR-151: separate exhibition membership from 3D placement in the schema

Placement columns become nullable so a work can be in a show without
hanging in its room. showOnPage defaults true, so every existing row
keeps its page and nothing changes in prod on deploy.

The nullability stops at the DB boundary: queries feeding the editor and
the scene filter to placed rows and narrow through toPlacedRows, leaving
ExhibitionArtworkResponse and its ~25 consumers untouched."
```

---

### Task 2: Taking a work off a wall stops removing it from the show

**Files:**
- Modify: `src/app/api/exhibition-artworks/route.ts:245-256`
- Test: `e2e/exhibition-membership-wall.spec.ts`

**Interfaces:**
- Consumes: `showOnPage` from Task 1.
- Produces: nothing new. Behavior change only.

- [ ] **Step 1: Write the failing test**

Create `e2e/exhibition-membership-wall.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

/**
 * Membership and placement are separate facts. The wall editor owns placement
 * and must never touch membership — an artist tidying a wall is not curating
 * the show.
 *
 * Talks to the position-sync endpoint directly. No WebGL.
 */
test.describe('the wall save and exhibition membership', () => {
  test('clearing a wall leaves the artwork in the exhibition', async ({ request }) => {
    const user = await prisma.user.findFirstOrThrow({ where: { userType: 'artist' } })
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: 'E2E Wall Membership',
        url: `e2e-wall-membership-${Date.now()}`,
        spaceId: 'paris',
        status: 'draft',
      },
    })
    const artwork = await prisma.artwork.create({
      data: { userId: user.id, name: 'E2E Wall Art', slug: `e2e-wall-art-${Date.now()}` },
    })
    await prisma.exhibitionArtwork.create({
      data: {
        exhibitionId: exhibition.id,
        artworkId: artwork.id,
        showOnPage: true,
        wallId: 'wall0',
        posX2d: 1, posY2d: 1, width2d: 1, height2d: 1,
        posX3d: 1, posY3d: 1, posZ3d: 1,
        quaternionX: 0, quaternionY: 0, quaternionZ: 0, quaternionW: 1,
      },
    })

    try {
      // An empty positions array is what the editor sends when the last work
      // is dragged off the wall.
      await request.post('/api/exhibition-artworks', {
        data: { exhibitionId: exhibition.id, positions: [] },
      })

      const row = await prisma.exhibitionArtwork.findUnique({
        where: {
          exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id },
        },
      })

      // The row survives, the membership survives, only the coordinates go.
      expect(row).not.toBeNull()
      expect(row?.showOnPage).toBe(true)
      expect(row?.wallId).toBeNull()
      expect(row?.posX3d).toBeNull()
    } finally {
      await prisma.exhibition.delete({ where: { id: exhibition.id } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })

  test('clearing a wall deletes a row that was never on the page', async ({ request }) => {
    const user = await prisma.user.findFirstOrThrow({ where: { userType: 'artist' } })
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: 'E2E Wall 3D Only',
        url: `e2e-wall-3donly-${Date.now()}`,
        spaceId: 'paris',
        status: 'draft',
      },
    })
    const artwork = await prisma.artwork.create({
      data: { userId: user.id, name: 'E2E 3D Only', slug: `e2e-3donly-${Date.now()}` },
    })
    await prisma.exhibitionArtwork.create({
      data: {
        exhibitionId: exhibition.id,
        artworkId: artwork.id,
        showOnPage: false,
        wallId: 'wall0',
        posX2d: 1, posY2d: 1, width2d: 1, height2d: 1,
        posX3d: 1, posY3d: 1, posZ3d: 1,
        quaternionX: 0, quaternionY: 0, quaternionZ: 0, quaternionW: 1,
      },
    })

    try {
      await request.post('/api/exhibition-artworks', {
        data: { exhibitionId: exhibition.id, positions: [] },
      })

      // Neither placed nor a member — nothing left worth keeping.
      const row = await prisma.exhibitionArtwork.findUnique({
        where: {
          exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id },
        },
      })
      expect(row).toBeNull()
    } finally {
      await prisma.exhibition.delete({ where: { id: exhibition.id } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e exhibition-membership-wall`
Expected: the first test FAILS — the row is deleted, so `row` is null and
`expect(row).not.toBeNull()` fails. The second test passes already (deletion is
current behavior).

- [ ] **Step 3: Replace the destructive sync**

In `src/app/api/exhibition-artworks/route.ts`, replace the block at 245-256
(from the `// Find artworks that were deleted` comment through the closing brace
of the `deleteMany` call) with:

```ts
    // A work absent from the payload has been taken off a wall. That clears its
    // PLACEMENT and nothing else — membership belongs to the artwork form's
    // checkbox, and an artist tidying a wall is not curating the show. Only a
    // row that is neither placed nor a member has nothing left worth keeping.
    const currentArtworkIds = positions.map((p) => p.artworkId)
    const unplacedArtworkIds = existingArtworkIds.filter((id) => !currentArtworkIds.includes(id))

    if (unplacedArtworkIds.length > 0) {
      await prisma.exhibitionArtwork.updateMany({
        where: { exhibitionId, artworkId: { in: unplacedArtworkIds }, showOnPage: true },
        data: {
          wallId: null,
          posX2d: null,
          posY2d: null,
          width2d: null,
          height2d: null,
          posX3d: null,
          posY3d: null,
          posZ3d: null,
          quaternionX: null,
          quaternionY: null,
          quaternionZ: null,
          quaternionW: null,
        },
      })

      await prisma.exhibitionArtwork.deleteMany({
        where: { exhibitionId, artworkId: { in: unplacedArtworkIds }, showOnPage: false },
      })
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:e2e exhibition-membership-wall`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/exhibition-artworks/route.ts e2e/exhibition-membership-wall.spec.ts
git commit -m "AR-151: taking a work off a wall no longer removes it from the show

The position sync deleted any row absent from the payload, so dragging a
work off a wall dropped it from the exhibition page too. It now clears
the placement and keeps the membership; a row that is neither placed nor
a member is still deleted."
```

---

### Task 3: The public grid reads live membership

**Files:**
- Modify: `src/lib/queries/getPublicExhibitionByUrl.ts`
- Test: `e2e/exhibition-page-membership.spec.ts`

**Interfaces:**
- Consumes: `showOnPage`, `pageOrder` from Task 1.
- Produces: `PublicExhibition.artworks` now sourced from live rows. The exported
  types `PublicExhibition` and `PublicExhibitionArtwork` are unchanged, so
  `ExhibitionProfilePage` needs no edit.

- [ ] **Step 1: Write the failing test**

Create `e2e/exhibition-page-membership.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

/**
 * The exhibition page shows what is checked into the show, not what is hung in
 * its 3D room. A work needs only its image and metadata to appear — placement
 * data is a 3D concern the grid never reads.
 *
 * Flat page: no WebGL.
 */
test.describe('the exhibition page artwork grid', () => {
  test('shows an artwork that is in the show but not hung in the room', async ({ page }) => {
    const user = await prisma.user.findFirstOrThrow({
      where: { userType: 'artist', published: true },
    })
    const stamp = Date.now()
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: 'E2E Page Membership',
        url: `e2e-page-membership-${stamp}`,
        spaceId: 'paris',
        status: 'published',
        published: true,
      },
    })
    const artwork = await prisma.artwork.create({
      data: {
        userId: user.id,
        name: 'E2E Unhung Work',
        title: `E2E Unhung ${stamp}`,
        slug: `e2e-unhung-${stamp}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/unhung.jpg',
      },
    })
    // Member, never placed: every placement column stays null.
    await prisma.exhibitionArtwork.create({
      data: { exhibitionId: exhibition.id, artworkId: artwork.id, showOnPage: true },
    })

    try {
      await page.goto(`/exhibitions/${user.handler}/${exhibition.url}`)
      await expect(page.getByText(`E2E Unhung ${stamp}`)).toBeVisible()
    } finally {
      await prisma.exhibition.delete({ where: { id: exhibition.id } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })

  test('hides an artwork that is hung in the room but unchecked', async ({ page }) => {
    const user = await prisma.user.findFirstOrThrow({
      where: { userType: 'artist', published: true },
    })
    const stamp = Date.now()
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: 'E2E Page 3D Only',
        url: `e2e-page-3donly-${stamp}`,
        spaceId: 'paris',
        status: 'published',
        published: true,
      },
    })
    const artwork = await prisma.artwork.create({
      data: {
        userId: user.id,
        name: 'E2E Hidden Work',
        title: `E2E Hidden ${stamp}`,
        slug: `e2e-hidden-${stamp}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/hidden.jpg',
      },
    })
    await prisma.exhibitionArtwork.create({
      data: {
        exhibitionId: exhibition.id,
        artworkId: artwork.id,
        showOnPage: false,
        wallId: 'wall0',
        posX2d: 1, posY2d: 1, width2d: 1, height2d: 1,
        posX3d: 1, posY3d: 1, posZ3d: 1,
        quaternionX: 0, quaternionY: 0, quaternionZ: 0, quaternionW: 1,
      },
    })

    try {
      await page.goto(`/exhibitions/${user.handler}/${exhibition.url}`)
      await expect(page.getByText(`E2E Hidden ${stamp}`)).toHaveCount(0)
    } finally {
      await prisma.exhibition.delete({ where: { id: exhibition.id } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e exhibition-page-membership`
Expected: the first test FAILS — the unhung work is absent from the grid.

- [ ] **Step 3: Filter the query to members**

In `src/lib/queries/getPublicExhibitionByUrl.ts`, change the `getExhibition`
include so it reads members rather than everything, and carry `pageOrder`:

```ts
      exhibitionArtworks: {
        // Membership, not placement. A work with no coordinates at all belongs
        // here; a work hung in the room but unchecked does not.
        where: { showOnPage: true },
        select: {
          pageOrder: true,
          artwork: { select: PUBLIC_ARTWORK_SELECT },
        },
      },
```

- [ ] **Step 4: Replace the loader body**

Replace the whole of `loadPublicExhibition` with:

```ts
async function loadPublicExhibition(url: string): Promise<PublicExhibition | null> {
  const exhibition = await getExhibition(url)
  if (!exhibition || !exhibition.published) return null

  // Live rows only. This page used to prefer `publishedSnapshot` for its
  // artwork list, which froze the grid at publish time — a checkbox would not
  // have taken effect until the next republish. The snapshot still exists and
  // still freezes the 3D scene for /visit; it simply has no say over the page.
  const artworks = exhibition.exhibitionArtworks
    .filter(
      (ea) => !ea.artwork.hiddenFromExhibition && ea.artwork.artworkType === 'image',
    )
    .sort((a, b) => {
      // Per-exhibition order when the artist has set one, otherwise the
      // artist's library order. Unordered rows sink below ordered ones.
      const aOrder = a.pageOrder ?? Number.POSITIVE_INFINITY
      const bOrder = b.pageOrder ?? Number.POSITIVE_INFINITY
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.artwork.order - b.artwork.order
    })
    .map((ea) => toPublicArtwork(ea.artwork))

  return {
    id: exhibition.id,
    mainTitle: exhibition.mainTitle,
    shortDescription: exhibition.shortDescription,
    description: exhibition.description,
    featuredImageUrl: exhibition.featuredImageUrl,
    url: exhibition.url,
    status: exhibition.status,
    startDate: exhibition.startDate,
    endDate: exhibition.endDate,
    spacePublished: exhibition.spacePublished,
    user: exhibition.user,
    artworks,
  }
}
```

Add `spacePublished: boolean` to the exported `PublicExhibition` type — Task 5
consumes it.

Delete the now-unused snapshot reconciliation: the `if (snapshot)` branch, the
`snapshotArtworkObjects` mapping, the `liveById` lookup and the
deleted-artwork fallback. Remove the `Prisma` import if nothing else uses it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:e2e exhibition-page-membership`
Expected: both tests PASS.

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Verify the existing gallery suite still passes**

Run: `pnpm test:e2e:gallery`
Expected: PASS. Published exhibitions render as before — their rows all have
`showOnPage` true.

- [ ] **Step 7: Commit**

```bash
git add src/lib/queries/getPublicExhibitionByUrl.ts e2e/exhibition-page-membership.spec.ts
git commit -m "AR-151: the exhibition grid reads live membership, not the snapshot

The grid was built from publishedSnapshot, freezing the artwork list at
publish time. It now reads rows where showOnPage is true, ordered by
pageOrder then library order, so curation takes effect immediately.

The snapshot keeps its real job: freezing the 3D scene for /visit."
```

---

### Task 4: The artwork save accepts exhibition membership

Server side only. The checkbox UI arrives in Task 5 and depends on this.

**Files:**
- Modify: `src/app/api/artworks/[id]/route.ts` (the PUT handler, from :214)
- Test: `e2e/artwork-exhibition-membership.spec.ts`

**Interfaces:**
- Consumes: `showOnPage` from Task 1.
- Produces: `PUT /api/artworks/[id]` accepts an optional
  `exhibitionIds: string[]` naming the exhibitions this artwork should appear
  in. Ids that do not exist, or that belong to another user, are dropped
  silently. Omitting the key leaves membership untouched.

- [ ] **Step 1: Write the failing test**

Create `e2e/artwork-exhibition-membership.spec.ts` with four cases: checking an
artwork into an exhibition creates a member row with no placement; unchecking a
hung work keeps its coordinates and sets `showOnPage` false; unchecking an
unhung work deletes the row; and an id belonging to another artist is dropped
while the rest of the save succeeds.

Build each case with `prisma.exhibition.create` + `prisma.artwork.create` as in
Task 2, sign in through the existing e2e auth helper, `PUT` to
`/api/artworks/<id>` with `{ exhibitionIds: [...] }`, then assert on
`prisma.exhibitionArtwork.findUnique`. Delete every fixture in a `finally`.

For the authorization case, create a second artist with their own exhibition,
send that exhibition's id, and assert no row was created for it while a legit id
sent in the same call did create one.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e artwork-exhibition-membership`
Expected: all four FAIL — the endpoint ignores `exhibitionIds` entirely.

- [ ] **Step 3: Implement the membership diff**

In the PUT handler, after `const requesterIsAdmin = ...` and the body
sanitization, before the artwork update:

```ts
    // Exhibition membership. The client sends the full desired set, so this is
    // a diff rather than an append.
    //
    // The requested ids are intersected with exhibitions that still exist AND
    // belong to this artwork's owner. Both halves matter: an exhibition deleted
    // while the form was open would otherwise fail the whole save on a foreign
    // key, and without the ownership check a caller could curate their artwork
    // into someone else's show. Never trust the list the form sent.
    if (Array.isArray(body.exhibitionIds)) {
      const requestedIds = [
        ...new Set(
          (body.exhibitionIds as unknown[]).filter(
            (value): value is string => typeof value === 'string',
          ),
        ),
      ]

      const ownedExhibitions = requestedIds.length
        ? await prisma.exhibition.findMany({
            where: { id: { in: requestedIds }, userId: existing.userId },
            select: { id: true },
          })
        : []
      const allowedIds = new Set(ownedExhibitions.map((e) => e.id))

      const rows = await prisma.exhibitionArtwork.findMany({
        where: { artworkId: id },
        select: { exhibitionId: true, wallId: true, showOnPage: true },
      })

      // Membership is `showOnPage`, not row existence — a 3D-only row exists
      // but is not a member, and re-checking it must flip the flag rather than
      // create a duplicate the unique constraint would reject.
      const memberIds = new Set(rows.filter((r) => r.showOnPage).map((r) => r.exhibitionId))
      const rowByExhibition = new Map(rows.map((r) => [r.exhibitionId, r]))

      const operations = []

      for (const exhibitionId of allowedIds) {
        if (memberIds.has(exhibitionId)) continue
        const row = rowByExhibition.get(exhibitionId)
        if (row) {
          // Hung but unchecked until now: keep the coordinates, add the page.
          operations.push(
            prisma.exhibitionArtwork.update({
              where: { exhibitionId_artworkId: { exhibitionId, artworkId: id } },
              data: { showOnPage: true },
            }),
          )
        } else {
          // Brand new membership: on the page, not hung anywhere.
          operations.push(
            prisma.exhibitionArtwork.create({
              data: { exhibitionId, artworkId: id, showOnPage: true },
            }),
          )
        }
      }

      for (const row of rows) {
        if (!row.showOnPage || allowedIds.has(row.exhibitionId)) continue
        if (row.wallId !== null) {
          // Still hanging in the room — keep the placement and the styling,
          // just take it off the page. This is the rare 3D-only state.
          operations.push(
            prisma.exhibitionArtwork.update({
              where: {
                exhibitionId_artworkId: { exhibitionId: row.exhibitionId, artworkId: id },
              },
              data: { showOnPage: false },
            }),
          )
        } else {
          // Neither on the page nor in the room: nothing left worth keeping.
          operations.push(
            prisma.exhibitionArtwork.delete({
              where: {
                exhibitionId_artworkId: { exhibitionId: row.exhibitionId, artworkId: id },
              },
            }),
          )
        }
      }

      if (operations.length > 0) await prisma.$transaction(operations)
    }
```

Add `exhibitionIds` to the list of keys stripped from `body` before it reaches
`prisma.artwork.update`, so Prisma does not reject an unknown field.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:e2e artwork-exhibition-membership`
Expected: all four PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/artworks/[id]/route.ts" e2e/artwork-exhibition-membership.spec.ts
git commit -m "AR-151: the artwork save can set which exhibitions show a work

PUT /api/artworks/[id] accepts exhibitionIds and diffs membership in one
transaction. Ids are intersected with exhibitions that exist and belong
to the artwork's owner, so a deleted exhibition cannot fail the save and
no one can curate a work into another artist's show."
```

---

### Task 5: The checkbox section on the artwork form

**Files:**
- Modify: `src/components/shared/ArtworkEditForm/index.tsx` (types ~79-115,
  defaults ~153, hydration ~177, render beside the Featured block at ~1397)
- Modify: `src/components/dashboard/artworks/edit/index.tsx` (fetch the
  artist's exhibitions, pass them down, include `exhibitionIds` in the save)
- Test: `e2e/artwork-exhibition-picker.spec.ts`

**Interfaces:**
- Consumes: the `exhibitionIds` contract from Task 4.
- Produces: `ArtworkEditForm` gains two optional props —
  `exhibitions?: { id: string; mainTitle: string; published: boolean }[]` and
  the `exhibitionIds: string[]` member of `ArtworkFormData`. The section renders
  only when `exhibitions` is supplied, so the wall-view `ArtworkEditModal` —
  which is already inside one exhibition — is unaffected.

- [ ] **Step 1: Write the failing test**

Create `e2e/artwork-exhibition-picker.spec.ts`: sign in as an artist with two
exhibitions, open `/dashboard/artworks/<id>/edit`, assert both titles appear
under an "Exhibitions" heading, check one, save, and assert via Prisma that a
member row exists for the checked exhibition and not the unchecked one. Delete
every fixture in a `finally`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e artwork-exhibition-picker`
Expected: FAIL — no "Exhibitions" heading on the form.

- [ ] **Step 3: Add the form state**

In `ArtworkEditForm/index.tsx`, add to the incoming-data type, to
`ArtworkFormData`, to the defaults object (`exhibitionIds: []`) and to the
hydration mapper (`exhibitionIds: data.exhibitionIds ?? []`). Add the optional
`exhibitions` prop to the component's props type.

- [ ] **Step 4: Render the section**

Insert directly after the Featured Artwork block (the one closing at ~1413),
matching its structure exactly:

```tsx
        {/* Exhibition membership. Deliberately separate from the 3D room: a
            work appears here because it was chosen for the show, not because
            it happens to hang on a wall. Renders only where the caller supplies
            the artist's exhibitions — the wall-view modal is already inside
            one show and has no use for it. */}
        {exhibitions && exhibitions.length > 0 && formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Exhibitions</h3>
            <p className={dashboardStyles.sectionDescription}>
              Choose which exhibitions show this artwork on their page.
            </p>
            {exhibitions.map((exhibition) => (
              <Checkbox
                key={exhibition.id}
                checked={formData.exhibitionIds.includes(exhibition.id)}
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
            ))}
            <span className={dashboardStyles.hint}>
              Independent of the 3D space. An artwork can appear on the page
              without hanging in the room.
            </span>
          </div>
        )}
```

- [ ] **Step 5: Wire the dashboard page**

In `src/components/dashboard/artworks/edit/index.tsx`, fetch the artist's
exhibitions alongside the artwork (`GET /api/exhibitions?userId=<ownerId>`),
hold them in state, pass them as the `exhibitions` prop, and include
`exhibitionIds: values.exhibitionIds` in the body at line 289.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test:e2e artwork-exhibition-picker`
Expected: PASS.

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/ArtworkEditForm/index.tsx \
  src/components/dashboard/artworks/edit/index.tsx \
  e2e/artwork-exhibition-picker.spec.ts
git commit -m "AR-151: choose an artwork's exhibitions from the artwork form

An Exhibitions section beside Featured Artwork, listing the artist's own
shows as checkboxes. Saves through the existing artwork PUT, so one Save
button writes metadata and membership together."
```

---

### Task 6: Publish and unpublish the 3D space on its own

**Files:**
- Modify: `src/app/api/exhibitions/by-url/[url]/route.ts` (the gate at ~80-104)
- Modify: `src/app/api/exhibitions/[id]/route.ts` (the publish block at ~299)
- Modify: `src/components/exhibitions/profile/index.tsx` (render the button
  conditionally)
- Modify: `src/components/admin/dashboard/AdminExhibitions.tsx` (two controls)
- Test: `e2e/exhibition-space-publish.spec.ts`

**Interfaces:**
- Consumes: `spacePublished` from Task 1, `PublicExhibition.spacePublished` from
  Task 3.
- Produces: `PATCH /api/exhibitions/[id]` accepts `spacePublished: boolean`.

- [ ] **Step 1: Write the failing test**

Create `e2e/exhibition-space-publish.spec.ts` covering: with
`spacePublished` false the exhibition page still renders its title and grid but
shows no "Enter Virtual Exhibition" button; an anonymous `GET
/api/exhibitions/by-url/<url>` returns 404; with `published` false everything is
hidden including the page; and switching `spacePublished` on through the PATCH
rebuilds `publishedSnapshot` (assert it is non-null and its `artworks` length
matches the placed rows).

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e exhibition-space-publish`
Expected: FAIL — the button renders and the API returns 200.

- [ ] **Step 3: Extend the by-url gate**

In `src/app/api/exhibitions/by-url/[url]/route.ts`, change the condition at line
81 from `if (!exhibition.published)` to `if (!exhibition.published || !exhibition.spacePublished)`
and add above it:

```ts
    // Two switches, one gate. `published` decides whether the exhibition exists
    // publicly at all; `spacePublished` decides only whether its 3D room is
    // open. This endpoint serves the room, so either being off closes it.
    //
    // Deliberately the same gate rather than a new one: it already lets the
    // owner and any admin through, which is what makes a room taken offline
    // for repairs still reachable by the person repairing it. Do NOT add a
    // notFound() to /visit/page.tsx — it would 404 before this code runs and
    // lock the owner out of their own room.
```

Add `spacePublished: true` to the route's `select` if it omits unknown fields.

- [ ] **Step 4: Rebuild the snapshot when the room is switched on**

In `src/app/api/exhibitions/[id]/route.ts`, after the `body.published` block:

```ts
    // --- 3D space publish logic ---
    if (body.spacePublished !== undefined) {
      data.spacePublished = body.spacePublished

      if (body.spacePublished === true) {
        // The snapshot freezes the room at the moment it is published. An
        // exhibition whose page went live weeks before its room was finished
        // still carries that empty early snapshot, so revealing the room has
        // to re-freeze it — otherwise visitors walk into the room as it was,
        // not as it is. Switching OFF deliberately leaves the snapshot alone,
        // so a room taken down for repairs is not lost.
        data.publishedSnapshot = await buildExhibitionSnapshot(id)
        data.hasPendingChanges = false
      }
    }
```

- [ ] **Step 5: Hide the button**

In `src/components/exhibitions/profile/index.tsx`, wrap the
`<EnterExhibitionButton ... />` in `{exhibition.spacePublished && ( ... )}`.
Render nothing in its place — the absence is the whole message.

- [ ] **Step 6: Two admin controls**

In `AdminExhibitions.tsx`, add a second control beside the existing publish
action, labeled **Publish 3D space** / **Unpublish 3D space**, PATCHing
`{ spacePublished: ... }`. Disable it whenever the exhibition is unpublished.
Keep the first control's label explicit — **Unpublish exhibition** — so it is
never mistaken for the 3D one.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test:e2e exhibition-space-publish`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/exhibitions/by-url/[url]/route.ts" \
  "src/app/api/exhibitions/[id]/route.ts" \
  src/components/exhibitions/profile/index.tsx \
  src/components/admin/dashboard/AdminExhibitions.tsx \
  e2e/exhibition-space-publish.spec.ts
git commit -m "AR-151: publish and unpublish the 3D space independently

spacePublished gates the Enter button and the scene API alone; the page,
its grid and every listing are untouched. Switching it on rebuilds the
snapshot so visitors get the room as it is, not as it was when the page
was published. Switching it off keeps the snapshot, so a room taken down
for repairs is not lost.

The gate extends the existing by-url check, which already lets the owner
through — that is what makes fix-then-verify possible."
```

---

### Task 7: Stop leaking unpublished exhibition titles

**Files:**
- Modify: `src/app/api/artworks/route.ts:85-91`
- Test: `e2e/artwork-api-exhibition-leak.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Response narrowing only.

- [ ] **Step 1: Write the failing test**

Create `e2e/artwork-api-exhibition-leak.spec.ts`: create an artist with one
published and one draft exhibition, and an artwork that is a member of both.
Call `GET /api/artworks?userId=<id>` with no session and assert the response
body contains the published title and **not** the draft title.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e artwork-api-exhibition-leak`
Expected: FAIL — the draft title is present.

- [ ] **Step 3: Filter the include**

In `src/app/api/artworks/route.ts`, replace the `exhibitionArtworks` include
with:

```ts
        exhibitionArtworks: {
          // This endpoint serves unauthenticated callers, and the include
          // carried every exhibition title an artwork belonged to — drafts
          // included. Membership is now a checkbox rather than a consequence
          // of hanging a work, so curating into a draft show would have put
          // that draft's name in a public response.
          //
          // The owner and admins still see their own drafts; everyone else
          // sees published shows only.
          where: viewerOwnsTarget ? {} : { exhibition: { published: true } },
          include: {
            exhibition: {
              select: { id: true, mainTitle: true },
            },
          },
        },
```

Above the query, derive the flag from the permission variables the route
already computes:

```ts
    // Mirrors the access rules resolved above: the target's own account, or an
    // admin acting on an artist, may see draft exhibition titles.
    const viewerOwnsTarget = requesterId === userId || isAdmin || isSuperAdmin
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:e2e artwork-api-exhibition-leak`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/artworks/route.ts e2e/artwork-api-exhibition-leak.spec.ts
git commit -m "AR-151: stop GET /api/artworks leaking draft exhibition titles

The endpoint serves anonymous callers and included every exhibition an
artwork belonged to, with no published filter. Membership by checkbox
would have widened that from rooms already built to anything started.
Owners and admins still see their drafts; nobody else does."
```

---

### Task 8: Make the two rare states visible

**Files:**
- Modify: `src/components/wallview/RightPanel/ArtisticImagePanel/ArtisticImagePanel.tsx`
- Modify: `src/components/admin/dashboard/AdminExhibitions.tsx`
- Test: `e2e/exhibition-state-markers.spec.ts`

**Interfaces:**
- Consumes: `showOnPage` (Task 1), `spacePublished` (Task 6).
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Create `e2e/exhibition-state-markers.spec.ts`: assert the admin exhibitions list
shows "3D room ready" for a published exhibition that has a placed artwork and
`spacePublished` false, and does not show it once `spacePublished` is true.
(The wall-editor marker is verified by hand — the editor is WebGL and is never
mounted in a test.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e exhibition-state-markers`
Expected: FAIL — no such text in the admin list.

- [ ] **Step 3: Add the admin marker**

In `AdminExhibitions.tsx`, where each row renders, show a quiet marker when the
exhibition is published, has at least one placed artwork, and `spacePublished`
is false:

```tsx
{/* Switching the room on is the norm; leaving it off is the exception. So
    the likelier mistake is finishing a room and forgetting to reveal it.
    This appears in that one state and no other. */}
{exhibition.published && exhibition.hasPlacedArtworks && !exhibition.spacePublished && (
  <span className={styles.readyMarker}>
    <Icon name="box" size={14} strokeWidth={ICON_STROKE_WIDTH} />
    3D room ready — not switched on
  </span>
)}
```

Add `hasPlacedArtworks` to the admin list payload in
`src/app/api/exhibitions/route.ts` via
`_count: { select: { exhibitionArtworks: { where: { wallId: { not: null } } } } }`,
and add the `.readyMarker` class to the admin SCSS module using existing color
tokens — no `var()` fallbacks, no `!important`.

- [ ] **Step 4: Add the wall-editor marker**

In `ArtisticImagePanel.tsx`, beside the existing `hiddenFromExhibition`
checkbox, show a marker when the selected artwork's row has `showOnPage` false:

```tsx
{/* Hung in the room but deliberately off the exhibition page. A legitimate
    state, and a rare one — so it should read as a decision, not as something
    forgotten. */}
{!showOnPage && (
  <span className={styles.offPageMarker}>
    <Icon name="eye-off" size={14} strokeWidth={ICON_STROKE_WIDTH} />
    Not shown on the exhibition page
  </span>
)}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:e2e exhibition-state-markers`
Expected: PASS.

- [ ] **Step 6: Full verification before handoff**

Run: `pnpm typecheck`
Run: `pnpm lint`
Run: `pnpm build` (SSR/RSC import-graph safety — several server components changed)
Run: `pnpm test:e2e`
Expected: all PASS, zero stray e2e fixtures left in the dashboard.

- [ ] **Step 7: Commit**

```bash
git add src/components/wallview/RightPanel/ArtisticImagePanel/ArtisticImagePanel.tsx \
  src/components/admin/dashboard/AdminExhibitions.tsx \
  src/app/api/exhibitions/route.ts \
  e2e/exhibition-state-markers.spec.ts
git commit -m "AR-151: surface the two states that are easy to get wrong silently

A built room that was never switched on, and a work hanging in a room but
kept off the page. Both legitimate, both rare, both invisible until now."
```

---

### Task 9: The three invariants nothing else covers

Three spec requirements that no earlier task's test reaches: an artwork living
in more than one show, the artist page never listing a draft, and an exhibition
being deleted without taking artworks with it.

**Files:**
- Test: `e2e/exhibition-membership-invariants.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-7. Adds no source changes — if any test
  here fails, the fix belongs in the task that owns that behavior.

- [ ] **Step 1: Write the three tests**

Create `e2e/exhibition-membership-invariants.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

/**
 * Invariants that fall between the feature tasks. Each one protects a promise
 * the design makes but no single endpoint owns.
 *
 * Flat pages only: no WebGL.
 */
test.describe('exhibition membership invariants', () => {
  test('one artwork appears on every exhibition it is checked into', async ({ page }) => {
    const user = await prisma.user.findFirstOrThrow({
      where: { userType: 'artist', published: true },
    })
    const stamp = Date.now()
    const makeExhibition = (suffix: string) =>
      prisma.exhibition.create({
        data: {
          userId: user.id,
          handler: user.handler,
          mainTitle: `E2E Shared ${suffix}`,
          url: `e2e-shared-${suffix}-${stamp}`,
          spaceId: 'paris',
          status: 'published',
          published: true,
        },
      })

    const first = await makeExhibition('one')
    const second = await makeExhibition('two')
    const artwork = await prisma.artwork.create({
      data: {
        userId: user.id,
        name: 'E2E Shared Work',
        title: `E2E Shared Work ${stamp}`,
        slug: `e2e-shared-work-${stamp}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/shared.jpg',
      },
    })
    // Member of both, hung in neither. The unique constraint is per
    // exhibition, so two rows for one artwork is the supported case.
    await prisma.exhibitionArtwork.createMany({
      data: [
        { exhibitionId: first.id, artworkId: artwork.id, showOnPage: true },
        { exhibitionId: second.id, artworkId: artwork.id, showOnPage: true },
      ],
    })

    try {
      for (const exhibition of [first, second]) {
        await page.goto(`/exhibitions/${user.handler}/${exhibition.url}`)
        await expect(page.getByText(`E2E Shared Work ${stamp}`)).toBeVisible()
      }
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: { in: [first.id, second.id] } } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })

  test('the artist page never lists an unpublished exhibition', async ({ page }) => {
    const user = await prisma.user.findFirstOrThrow({
      where: { userType: 'artist', published: true },
    })
    const stamp = Date.now()
    const draft = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: `E2E Draft Show ${stamp}`,
        url: `e2e-draft-show-${stamp}`,
        spaceId: 'paris',
        status: 'draft',
        published: false,
      },
    })

    try {
      await page.goto(`/artists/${user.handler}`)
      await expect(page.getByText(`E2E Draft Show ${stamp}`)).toHaveCount(0)
    } finally {
      await prisma.exhibition.delete({ where: { id: draft.id } })
    }
  })

  test('deleting an exhibition leaves its artworks and their other shows intact', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { userType: 'artist' } })
    const stamp = Date.now()
    const doomed = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: 'E2E Doomed',
        url: `e2e-doomed-${stamp}`,
        spaceId: 'paris',
        status: 'draft',
      },
    })
    const survivor = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: 'E2E Survivor',
        url: `e2e-survivor-${stamp}`,
        spaceId: 'paris',
        status: 'draft',
      },
    })
    const artwork = await prisma.artwork.create({
      data: { userId: user.id, name: 'E2E Survives', slug: `e2e-survives-${stamp}` },
    })
    await prisma.exhibitionArtwork.createMany({
      data: [
        { exhibitionId: doomed.id, artworkId: artwork.id, showOnPage: true },
        { exhibitionId: survivor.id, artworkId: artwork.id, showOnPage: true },
      ],
    })

    try {
      await prisma.exhibition.delete({ where: { id: doomed.id } })

      // Artworks belong to the user, never to an exhibition. Only the one
      // membership row cascades away.
      const stillThere = await prisma.artwork.findUnique({ where: { id: artwork.id } })
      expect(stillThere).not.toBeNull()

      const rows = await prisma.exhibitionArtwork.findMany({ where: { artworkId: artwork.id } })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.exhibitionId).toBe(survivor.id)
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: { in: [doomed.id, survivor.id] } } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })
})
```

- [ ] **Step 2: Run them**

Run: `pnpm test:e2e exhibition-membership-invariants`
Expected: all three PASS against the work from Tasks 1-7. A failure here is a
bug in the owning task, not in this test — fix it there.

- [ ] **Step 3: Commit**

```bash
git add e2e/exhibition-membership-invariants.spec.ts
git commit -m "AR-151: cover the invariants that fall between the feature tasks

One artwork across several shows, the artist page never listing a draft,
and an exhibition delete that leaves artworks and their other shows
alone."
```

---

### Task 10: The spacePublished backfill script

`showOnPage` needs no backfill — its column default does the work. `spacePublished`
does, because one default cannot be `false` for new exhibitions and `true` for
the ones already live.

**Files:**
- Create: `scripts/backfill-space-published.ts`

**Interfaces:**
- Consumes: `spacePublished` from Task 1.
- Produces: nothing importable. Operator tool.

- [ ] **Step 1: Write the script**

Create `scripts/backfill-space-published.ts`, following the shape of
`scripts/reconcile-r2.ts`:

```ts
/**
 * One-shot backfill for AR-151.
 *
 * `Exhibition.spacePublished` defaults to FALSE so a newly created exhibition
 * is page-first and its 3D room is revealed only when it is ready. Applied
 * naively that default would also darken every room already live in
 * production, because Postgres gives existing rows the column default.
 *
 * So: every exhibition that is currently published gets its room switched on,
 * restoring exactly the behavior visitors see today. Unpublished exhibitions
 * are left alone — their rooms were not reachable anyway, and their owners
 * should decide deliberately.
 *
 * Idempotent: re-running it changes nothing. Run once per database, after the
 * schema push and before announcing the release.
 *
 *   pnpm tsx scripts/backfill-space-published.ts          # dry run
 *   pnpm tsx scripts/backfill-space-published.ts --apply  # write
 */
import prisma from '../src/lib/prisma'

async function main() {
  const apply = process.argv.includes('--apply')

  const candidates = await prisma.exhibition.findMany({
    where: { published: true, spacePublished: false },
    select: { id: true, mainTitle: true, url: true },
  })

  if (candidates.length === 0) {
    console.log('Nothing to do — every published exhibition already has its 3D room on.')
    return
  }

  console.log(`${candidates.length} published exhibition(s) with the 3D room off:`)
  for (const exhibition of candidates) {
    console.log(`  ${exhibition.url}  ${exhibition.mainTitle}`)
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to switch these rooms on.')
    return
  }

  const { count } = await prisma.exhibition.updateMany({
    where: { published: true, spacePublished: false },
    data: { spacePublished: true },
  })
  console.log(`\nSwitched on ${count} room(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Verify the dry run against dev**

Run: `pnpm tsx scripts/backfill-space-published.ts`
Expected: it lists the dev database's published exhibitions and says "Dry run."
It must not write anything without `--apply`.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-space-published.ts
git commit -m "AR-151: add the spacePublished backfill script

spacePublished defaults false so new exhibitions are page-first, which
would otherwise darken every room already live. This switches the room
on for exhibitions that are already published, leaving drafts alone.
Dry run by default; idempotent."
```

---

## Release handoff

Not a task — the owner's steps, in order.

1. Test in dev. The owner confirms before anything is pushed.
2. Push the schema to the dev database, then prod at release time. The owner
   runs both; Claude never does.
3. Run `scripts/backfill-space-published.ts --apply` (Task 10) against prod
   after the schema push: it sets `spacePublished = true` wherever
   `published = true`, so live rooms do not go dark. New exhibitions keep the
   `false` default. Run it without `--apply` first to see what it would touch.
4. Open the PR — base **develop**, never main. The owner opens every PR.
5. Tag `3.11.0` to match `package.json`.

Note for the release: `origin/main` and `origin/develop` currently differ by
**zero files**, so this release contains AR-151 and nothing else.
