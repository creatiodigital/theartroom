# Exhibition membership, independent of the 3D space

**Date:** 2026-09-22
**Status:** Design approved, not yet implemented
**Ticket:** AR-151

## Problem

An artwork appears on a public exhibition page if, and only if, it is hung on a
wall in that exhibition's 3D room. The two facts are stored as one thing.

`ExhibitionArtwork` carries both the membership ("this work is in this show")
and the placement (`wallId`, the 2D rect, the 3D position, the quaternion). Every
placement field is non-nullable, so "in the exhibition, not hung in the 3D room"
cannot be represented at all.

Three behaviors follow from that, all of them unwanted:

1. The wall editor's save (`POST /api/exhibition-artworks`) deletes any join row
   whose artwork is absent from the payload. Dragging a work off a wall removes
   it from the show.
2. The public grid is built from those same rows, so the grid is always exactly
   the wall contents.
3. `Exhibition.published` is a single boolean gating the exhibition page *and*
   the `/visit` route. Taking a broken 3D room offline takes the entire
   exhibition with it.

The goal is to treat the 3D space as an optional attachment to an exhibition,
never a precondition for it. An exhibition is a page with artworks on it; the
room is something you switch on when it is ready.

The motivation is operational. Building a 3D room takes substantially longer
than preparing a 2D gallery, so a show is often ready to go public well before
its space is. Today that forces a choice between rushing the room and holding
the exhibition back. After this change the exhibition goes live on its own
schedule and the room follows when it is ready — from the visitor's side the
only difference is that the "Enter Virtual Exhibition" button is not there yet.

## Decisions

Settled during design; recorded here so they are not re-litigated.

| Question | Decision |
|---|---|
| What decides page visibility? | A per-artwork checkbox, and nothing else. |
| Does placing a work in 3D put it on the page? | Yes, by default — `showOnPage` defaults to `true`. The 3D-only case is an explicit uncheck and is expected to be rare. |
| Does removing a work from a wall remove it from the show? | No. Placement is cleared; membership is untouched. |
| Grid order across multiple exhibitions | Per-exhibition `pageOrder`, falling back to the artist's library order. |
| 3D switched off — what happens to `/visit`? | Button hidden, route 404s, scene API 404s. |
| Can the 3D be live while the page is not? | No. `/visit` requires `published && spacePublished`. |
| Do existing prod exhibitions change on deploy? | No. That constraint drives the migration design below. |

## Data model

### `ExhibitionArtwork`

```prisma
// Placement — nullable. Null means the work is in the show but is not
// hung in the 3D room.
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

// Membership — the only thing that decides the public grid.
showOnPage  Boolean @default(true)
pageOrder   Int?
```

An explicit `showOnPage` boolean is required rather than treating row existence
as membership: a work that is hung in 3D but deliberately kept off the page still
needs a row to hold its coordinates.

`@@unique([exhibitionId, artworkId])` is already scoped per exhibition, so one
artwork belonging to several of an artist's shows needs no schema change.

Every other column on the table — the frame, passepartout, text, sound, video and
shape settings — stays exactly as it is. Those are per-exhibition display
properties and they ride along with the row, which means a work pulled off a wall
and later re-hung keeps its styling.

### `Exhibition`

```prisma
spacePublished Boolean @default(false)
```

New exhibitions are page-first: the room is hidden until switched on.

### Row lifecycle

A row exists when a work is a member, or is placed, or both. A row that is
neither is deleted.

| State | `showOnPage` | Placement | How it arises |
|---|---|---|---|
| Both (normal) | `true` | set | Hang the work in the room. |
| Page only | `true` | `null` | Check the box without hanging it, or pull a hung work off a wall. |
| 3D only (rare) | `false` | set | Deliberately uncheck a hung work. |
| — | `false` | `null` | Row deleted. |

## Containing the nullability

Making twelve columns nullable would otherwise ripple through the ~25 files that
read `wallId` / `posX3d` / `quaternionW` — the entire wall editor and the 3D
scene.

It does not have to. `ExhibitionArtworkResponse` in
`src/lib/exhibitionArtworkMapper.ts` is the single seam between the API and every
downstream consumer, and it declares `wallId: string`. **That type does not
change.** Instead, every query that feeds the editor or the scene filters to
placed rows (`wallId: { not: null }`) and narrows before mapping.

The nullability therefore lives entirely at the DB boundary. The editor and the
scene never see a null placement, and none of those 25 files are touched.

Queries that must filter to placed rows:

- `GET /api/exhibition-artworks` — the wall editor's load
- `GET /api/exhibitions/by-url/[url]` — the visit scene, on both its live and
  snapshot paths
- `buildExhibitionSnapshot` — the snapshot now serves the 3D scene only, so it
  captures placed rows only
- the `/edit` route loader

## Behavior changes

### The wall save stops deleting membership

`src/app/api/exhibition-artworks/route.ts:251` currently `deleteMany`s any
artwork absent from the payload. It instead:

- nulls the placement fields on rows whose `showOnPage` is `true`
- deletes the row only when `showOnPage` is `false` (nothing left worth keeping)

### The public grid reads live membership

`src/lib/queries/getPublicExhibitionByUrl.ts` reads live rows where
`showOnPage = true`, ordered by `pageOrder` then `artwork.order`.

A page-only artwork renders identically to a hung one, with no gaps. The grid
already draws entirely from `Artwork` — `PUBLIC_ARTWORK_SELECT` is image plus
metadata plus the resolved sale — and reads nothing from the join row but
membership and order. The frame, passepartout and text settings on
`ExhibitionArtwork` are 3D display properties that the 2D grid never touches.
So a work that has never been placed needs no placement data to appear
correctly on the page.

The `if (snapshot)` branch that currently sources the artwork list from
`publishedSnapshot` is removed. This is what makes a checkbox take effect
immediately rather than at the next republish. The snapshot continues to serve
the 3D scene through `by-url`, unchanged.

This removes roughly half of that file, including the snapshot/live
reconciliation and the fallback that renders an artwork deleted from the library
out of frozen snapshot metadata. That fallback goes away with the branch: an
artwork removed from the library is removed from the grid, which is the
behavior the checkbox model implies.

### Deleting an exhibition must stay safe

An exhibition can be deleted from the DB at any time. Nothing may break for
missing data.

**Cascades cleanly.** Both foreign keys into `Exhibition` are `onDelete: Cascade`
— `ExhibitionArtwork` (schema:756) and `WallGuide` (schema:980) — so membership
rows, placements and guides all go with it. `DELETE /api/exhibitions/[id]` also
clears the R2 featured image and calls `revalidateTag('exhibitions')` +
`revalidatePath('/')`.

**Survives correctly.** Artworks belong to `User`, never to an exhibition, so
deleting a show never deletes art. Under this design an artwork simply loses one
membership row and drops off that one page; its other exhibitions are untouched.
`autofocusGroups` and `publishedSnapshot` are JSON columns on the exhibition
itself and go with it. `SelectedPrint`, `PageContent` and `SiteSettings` hold no
exhibition references.

**One dangling reference, pre-existing.** `Slide.exhibitionUrl` is a plain string
typed by hand in the admin (`src/app/admin/content/landing/page.tsx:404`) with no
foreign key. Deleting an exhibition leaves the homepage hero slide pointing at a
dead URL. Nothing crashes — the page renders and the string is just a string —
but a visitor clicking the hero gets a 404. Not caused by this feature; recorded
here because the delete-safety question surfaced it. Fix is a separate ticket:
either validate the URL against live exhibitions when saving a slide, or hide
slides whose target no longer resolves.

**One hazard this feature introduces.** The artwork `PATCH` receives
`exhibitionIds: string[]` from the client. Before writing, the server must
intersect that list with exhibitions that (a) still exist and (b) belong to the
artwork's owner, silently dropping anything else:

- an exhibition deleted while the form was open would otherwise throw a foreign
  key violation and fail the whole save
- without the ownership check, a caller could curate an artwork into another
  artist's exhibition — a write-side authorization hole, not merely a data bug

This is validated server-side regardless of what the form sends.

### Unpublished exhibitions must not leak

An unpublished exhibition must be invisible everywhere, including as a bare
title. Two places matter.

**The artist page is already correct.** `getPublicArtistByHandler.ts:61` filters
`exhibitions: { where: { published: true } }`, and `src/app/artists/[slug]/page.tsx`
is its only consumer. No change needed — but it gets a regression test, because
this is now a stated invariant rather than an incidental detail.

**`GET /api/artworks` leaks and must be fixed here.** The endpoint serves
unauthenticated callers by design (`src/app/api/artworks/route.ts:68`) and
includes, with no `published` filter:

```js
exhibitionArtworks: { include: { exhibition: { select: { id: true, mainTitle: true } } } }
```

So `GET /api/artworks?userId=<artist>` returns the titles of that artist's draft
exhibitions to anyone. The exposure is ids and titles only, but it is precisely
what the publish switch is supposed to prevent.

**This feature widens it**, which is why the fix belongs in this change rather
than a separate ticket. Today an exhibition title only rides along when the
artwork is actually hung in that room. Once a checkbox creates membership,
curating an artwork into a draft show puts that draft's title in a public
response — the leak grows from "rooms you have built" to "anything you have
started".

Fix: filter that include to `exhibition: { published: true }` unless the
requester is the owner or an admin, mirroring the permission logic already in
the route. No client currently reads the field — the wall editor's
`exhibitionArtworks` is Redux state, not this response, and nothing consumes
`mainTitle` from it — but filtering is safe whether or not a consumer exists,
where deleting the include is not.

### Two independent publish switches

`published` keeps its exact current meaning and needs no new code. It already
gates all five public surfaces:

| Surface | Source |
|---|---|
| Homepage listing | `src/app/page.tsx:45` |
| `/exhibitions` listing | `src/app/exhibitions/page.tsx:21` |
| Artist profile's show list | `src/lib/queries/getPublicArtistByHandler.ts:61` |
| The exhibition page itself | `getPublicExhibitionByUrl` |
| Sitemap | `src/app/sitemap.ts:10` |

### The two unpublish operations

"Unpublish" now names two different actions, and the difference must be
unmistakable in the UI as well as in the data.

| Operation | Switch | Effect |
|---|---|---|
| **Unpublish the exhibition** | `published = false` | The whole show leaves the site. The page 404s, it drops out of the homepage, the `/exhibitions` listing, the artist's profile and the sitemap, and `/visit` 404s with it. Nothing public remains. |
| **Unpublish only the 3D space** | `spacePublished = false` | The room alone goes. The page, its artwork grid and every listing are untouched; only the "Enter Virtual Exhibition" button disappears and `/visit` 404s. |

The full state matrix:

| `published` | `spacePublished` | What the public sees |
|---|---|---|
| `true` | `true` | Page, grid, button, `/visit` — everything. |
| `true` | `false` | Page and grid. No button, `/visit` 404s. |
| `false` | either | Nothing. Page 404s, listings drop it, `/visit` 404s. |

`spacePublished` is meaningless while `published` is false, which is why the
admin control for it is disabled in that state.

**`spacePublished` survives a full unpublish/republish cycle.** Taking the whole
exhibition down and putting it back restores the state it was in, 3D included —
the switch is not silently reset. `publishedSnapshot` is cleared on unpublish and
rebuilt on republish, so the room that comes back is the current one.

`spacePublished` gates the 3D and nothing else:

- the "Enter Virtual Exhibition" button is not rendered
- `GET /api/exhibitions/by-url/[url]` returns 404 for the public

**`spacePublished` is enforced in the same place, and in the same way, as
`published`** — extending the existing gate in `by-url` rather than adding a new
one. That is deliberate, not incidental: that gate already lets the owner and
any admin through (`isOwner || isAdminOrAbove`, route.ts:98-102), so mirroring it
means a room switched off for repairs is still reachable by the person repairing
it.

Do **not** add a blunt `notFound()` to `/visit/page.tsx`. It would 404 before the
API is ever consulted, locking the owner out of the very room they took offline
to fix. There is no such guard there today for unpublished exhibitions either;
all gating lives in the API, and both switches should stay consistent about that.

This is what makes the repair loop work: switch off → fix → verify at `/visit` as
the owner → switch back on, with visitors seeing only the button disappear and
reappear.

**Switching the 3D on rebuilds `publishedSnapshot`** and clears
`hasPendingChanges`, exactly as publishing does. Without this, an exhibition
published on Monday with an empty room and finished on Friday would serve
Monday's empty snapshot. Switching it off leaves the snapshot alone, so
switching back on after a glitch does not lose the room.

`spaceId` stays required. An exhibition always *has* an associated space; the
space is hidden, never detached, so revealing it later is one toggle and never a
re-association.

Creating an exhibition therefore still asks for a 3D space, exactly as it does
today — no change to that flow. The space is simply never revealed if the
artist does not want it.

This is also what covers an artist who wants **no 3D at all**. They create the
exhibition, check artworks into it from the artwork form, and publish. The
room is never switched on, so no visitor ever sees a button for it and the
artist never opens the wall editor. That case needs no special-casing, no
"2D-only" exhibition type and no nullable `spaceId` — it is just
`spacePublished` left at its default.

## User interface

### Artwork edit form

A new section in `src/components/shared/ArtworkEditForm/index.tsx`, beside the
existing "Featured Artwork" block at line 1397 and built the same way:

```
Exhibitions
Choose which of this artist's exhibitions show this artwork.
  [x] Vienna — Interiors
  [x] Paris — Light Studies
  [ ] Spring Collection 2026
```

The form carries `exhibitionIds: string[]`. The existing artwork `PATCH` diffs it
server-side inside a transaction, so this is one Save button and one atomic
write rather than a second endpoint with its own failure mode. Unchecking a box
sets `showOnPage = false` when the work is hung in the room, leaving its
placement and styling intact; when the work is not hung, the row is deleted.

The form is already shared between the artist dashboard and admin, so both
surfaces get the section without extra work.

### Admin publish controls

`src/components/admin/dashboard/AdminExhibitions.tsx:97` already PATCHes
`{ published }`. It becomes two clearly distinct controls side by side —
**Unpublish exhibition** and **Unpublish 3D space** — with the 3D one disabled
while the exhibition is unpublished, so the dependency is visible rather than
discovered by clicking. The labels must not be ambiguous about which one takes
the whole show down.

**Ready-but-hidden marker.** The list flags any exhibition that is published, has
at least one artwork placed in its room, and still has `spacePublished = false`:
*"3D room ready — not switched on."* Since switching the room on is the norm and
leaving it off the exception, the likelier mistake is finishing a room and
forgetting to reveal it. The marker only ever appears in that one state.

### Wall editor marker

A work that is placed but has `showOnPage = false` gets a quiet marker in the
wall editor. The state is legitimate but rare, so it should read as deliberate
rather than as something forgotten.

## Migration and rollout

The constraint is that nothing changes in prod on deploy.

- **`showOnPage @default(true)`** gives every existing row — every work currently
  hung in a 3D room — a checked box automatically. Postgres applies the default
  to existing rows, so no backfill script is needed and no live exhibition page
  changes.
- **`spacePublished @default(false)`** would otherwise darken every live room,
  because one column default cannot be `false` for new exhibitions and `true` for
  existing ones. A small script under `scripts/` sets `spacePublished = true`
  wherever `published = true`, following the `scripts/reconcile-r2.ts` pattern
  rather than loose SQL.

Because the default handles membership, there is no window in which a live
exhibition page serves an empty grid, so this ships in one deploy rather than
the two-step sequence considered during design.

Per project rules, the schema push and the script run are the owner's to execute,
against dev first and prod at release time.

## Testing

Playwright specs in `/e2e/`, no WebGL mounting (isolation pattern):

- an artwork checked into an exhibition appears on the page without being placed
- pulling a placed work off a wall leaves it on the page
- unchecking a placed work removes it from the page but leaves it in the room
- an artwork checked into two of an artist's exhibitions appears on both
- `spacePublished = false` hides the button, 404s `/visit`, and leaves the page
  and grid intact
- `published = false` still hides everything, 3D included
- an unpublished exhibition never appears in the artist page's show list
- an anonymous `GET /api/artworks?userId=<artist>` returns no unpublished
  exhibition titles, including for an artwork curated into a draft show
- deleting an exhibition leaves its artworks intact, still visible on the
  other exhibitions they belong to
- an artwork PATCH naming a deleted or someone else's exhibition drops that
  id and still saves the rest
- switching the 3D on rebuilds the snapshot

## Out of scope

- **The reorder UI.** `pageOrder` ships as a column so it is never a retrofit,
  but until there is a drag-to-reorder screen it stays null and the grid falls
  back to library order. That screen is its own piece of work.
- **`hiddenFromExhibition`.** This global flag now overlaps the checkbox —
  unchecking everywhere does the same job more precisely. It is left alone here
  and retired separately. Two controls point at the same outcome in the interim.
