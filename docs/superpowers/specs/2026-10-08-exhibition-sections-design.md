# Exhibition Sections — Design

**Ticket:** AR-155 · **Branch:** `feat/AR-155-add-sections` · **Date:** 2026-10-08

## Problem

An exhibition page shows every work in one undivided grid. A large show with
distinct bodies of work — Beatriz Salvatierra's has three: Magnolia, Mistery,
Memory — reads as one overwhelming wall of photos.

## Goal

Artists can split an exhibition page into titled sections. Sections are
optional; an exhibition without them looks exactly as it does today.

```
photo photo photo          ← works with no section, no heading
photo photo photo

────── Magnolia ──────
photo photo photo

────── Mistery ──────
photo photo photo

────── Memory ──────
photo photo photo
```

## Settled decisions

- Sections belong to one exhibition. Section membership is stored **per
  exhibition**, on `ExhibitionArtwork` — an artwork can sit in "Magnolia" in one
  show and in a different section (or none) in another. Within one exhibition a
  work is in at most one section.
- Default is no section.
- The artist orders sections by **drag and drop** (`@dnd-kit`, already a
  dependency — used by `src/components/dashboard/artworks/index.tsx`).
- Sections can be **renamed** and **deleted**.
- Renaming never touches artwork assignments (they reference the section by id).
- Deleting a section never deletes or hides an artwork; its works fall back to
  "no section" and stay on the page.

## Data model

```prisma
model ExhibitionSection {
  id           String     @id @default(uuid())
  exhibitionId String
  exhibition   Exhibition @relation(fields: [exhibitionId], references: [id], onDelete: Cascade)
  title        String
  order        Int
  createdAt    DateTime   @default(now())

  exhibitionArtworks ExhibitionArtwork[]

  @@index([exhibitionId])
}
```

- `Exhibition` gains `sections ExhibitionSection[]`.
- `ExhibitionArtwork` gains
  `sectionId String?` +
  `section ExhibitionSection? @relation(fields: [sectionId], references: [id], onDelete: SetNull)`.

`onDelete: SetNull` is what implements "delete a section → its works go to no
section": the database does it, so no cleanup code can miss a row.

**Prod impact:** one new table, one new nullable column. Every existing row
comes out with `sectionId = null` — every live page renders unchanged. The owner
runs the prod schema push alongside the deploy; Claude never does.

## Rules

| Rule | Where enforced |
|---|---|
| Title required, trimmed, ≤ 60 chars | Section API (create + rename) |
| No two sections in one exhibition with the same title (case-insensitive, after trim) | Section API (create + rename) |
| A work can only be assigned a section of the **same** exhibition | Artwork PATCH |
| Reorder payload must be exactly the exhibition's current set of section ids | Section reorder API |
| Only the exhibition's owner (or an admin impersonating them) or a superAdmin can manage its sections | Every section route, `requireOwnership` — the same check as the exhibition PUT in `src/app/api/exhibitions/[id]/route.ts` |
| A section with no visible works renders no heading | Public query |

Validation failures return 400 with a message the UI shows inline, following
the form validation flow (silent until submit, then all errors, then clear
live).

## API

All under the exhibition, all save immediately:

| Method | Route | Does |
|---|---|---|
| `GET` | `/api/exhibitions/[id]/sections` | Sections in order, each with its artwork count |
| `POST` | `/api/exhibitions/[id]/sections` | Create `{ title }`; appended (`order = max + 1`) |
| `PATCH` | `/api/exhibitions/[id]/sections/[sectionId]` | Rename `{ title }` |
| `DELETE` | `/api/exhibitions/[id]/sections/[sectionId]` | Delete; FK nulls assignments |
| `PUT` | `/api/exhibitions/[id]/sections/order` | `{ sectionIds: string[] }` → `order = index`, one transaction |

Every route checks the section belongs to `[id]` — a section id from another
exhibition is a 404, not a cross-exhibition write.

**Artwork save** (`src/app/api/artworks/[id]/route.ts`): the existing PATCH that
already takes `exhibitionIds` also takes
`exhibitionSections: Record<exhibitionId, sectionId | null>` and writes
`sectionId` in the same transaction as membership. A `sectionId` whose
`exhibitionId` doesn't match its key → 400. The artwork GET returns the same map
so the form can pre-select.

Unticking an exhibition follows the AR-151 rules: a work still hung in the room
keeps its row (`showOnPage = false`) and therefore its `sectionId`; a work not
hung anywhere loses its row, so re-ticking it starts at "No section". Section
choices sent for exhibitions that are not ticked are ignored.

## UI

### Exhibition edit page

`src/components/dashboard/exhibitions/settings/index.tsx` — new **Sections**
block between Short Description and Description, as its own component
(`ExhibitionSectionsEditor`).

- "Add section" text input + button. The new section lands at the bottom.
- One row per section: drag handle · title · Rename · Delete.
- Rename turns the title into an inline input; Enter / Save commits, Escape
  cancels.
- Delete always confirms via the existing confirm dialog. When the section has
  works: "4 artworks will move to no section. They stay on the page."
- Drop commits the new order immediately. On API failure the list snaps back
  to the last saved order and shows the error.
- Empty state hint: "Optional. Split this exhibition's page into titled groups."
- Dashboard surface → rounded controls, `<Button/>`, Lucide icons
  (`GripVertical`, `Pencil`, `Trash2`) with `ICON_STROKE_WIDTH`.

### Artwork edit page

`src/components/shared/ArtworkEditForm/index.tsx`, Exhibitions block.

- Under each **ticked** exhibition that **has sections**, a `SelectDropdown`:
  "No section" (default), then sections in page order.
- Exhibitions without sections show no dropdown — the form is unchanged until
  an artist creates one.
- Saved with the normal Save button, in the same request as `exhibitionIds`.
- The exhibitions list fetched by `src/components/dashboard/artworks/edit/index.tsx`
  (`/api/exhibitions?userId=`) gains `sections: { id, title }[]`, ordered.
- The wall-view panel gets nothing; it has no Exhibitions block today and
  sections don't touch the 3D room.

### Public exhibition page

`src/lib/queries/getPublicExhibitionByUrl.ts` and
`src/components/exhibitions/profile/index.tsx`.

- `PublicExhibition` gains
  `groups: { id: string | null; title: string | null; artworks: PublicExhibitionArtwork[] }[]`:
  first the no-section group (title `null`), then one group per section in
  order. Empty groups are dropped. Inside each group, the existing order
  (`pageOrder`, then the artist's library order).
- `artworks` stays, now the **flattened** groups — so the artwork page's
  previous/next (`getExhibitionNeighbours` in `src/app/artworks/[slug]/page.tsx`)
  walks the page in display order with no change to its code.
- The grouping lives in one pure helper (`groupBySection`) both outputs come
  from, so grid and arrows cannot drift.
- Render: one `ArtworkGrid` per group. Every titled group gets a heading —
  centered title with a hairline either side, styled from the page's existing
  type scale and the card caption hairline. No heading on the no-section group.
- No sections at all → one group → the page renders exactly as today.
- Live data, as since AR-151: changes appear without republishing.

## Out of scope

- Sections in the 3D room or the published snapshot.
- Section descriptions, images, or anchor navigation.
- Assigning sections from the exhibition page (bulk assignment).
- Reordering works within a section (`pageOrder` UI is still deferred).

## Testing

Playwright e2e, throwaway fixtures deleted by run end (0 strays), run with
`pnpm dev` stopped.

1. **Section management** — create three, rename one, drag to reorder, delete
   one; reload after each and assert it persisted.
2. **Rename keeps works** — assign works to a section, rename it, assert the
   same works sit under the new heading.
3. **Assign + public render** — set a section on the artwork edit page; the
   public page shows the heading with that work beneath it; no-section works
   come first with no heading.
4. **Delete keeps works** — delete a section that has works; they reappear in
   the no-section group, still on the page.
5. **Neighbours follow groups** — previous/next on the artwork page steps in
   grouped display order.
6. **Guards** — cross-exhibition `sectionId` on artwork PATCH → 400; duplicate
   title → 400; reorder with a foreign or missing id → 400; non-owner → 403.

Then the owner tests in dev. Local prod build before any push.

## Rollout

1. Owner tests in dev.
2. Commit on `feat/AR-155-add-sections` after the owner's OK; push only when told.
3. Prod: schema push (new table + nullable column) with the deploy — the owner
   runs it.
