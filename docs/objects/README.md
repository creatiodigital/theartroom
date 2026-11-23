# Objects: 3D artworks (sculptures, decorative pieces)

Owner's decisions, 2026-11-23. Planned with Design Claude. **Status: phase 1 (O1–O5) ready to build; Floor view
(O6) designed as a draft only, do not build yet.**
Design files in `designs/`: `objects-artwork-page-desktop.dc.html` + `-phone` (visitor page), `objects-library.dc.html` (Artwork library), `objects-pedestals.dc.html` (pedestal shapes, materials, panel), `objects-add-artwork.dc.html` (Add artwork
dialog), `objects-editor.dc.html` (Object editor, the main spec), `objects-floor-view-draft.dc.html` (later step).
Copy in the boards is final unless marked "(board note)".

## Principles
- **Name: Object** (visitor and artist facing). Type key `object` next to image, text, sound, video, shape.
- **The 3D space is a plus.** An Object is a full artwork without it: cover photo, photos and reels, details,
  description. Anyone must be able to explore an exhibition completely **without entering the 3D room**.
- **Not for sale for now.** Objects are not prints: no print sales, never in the checkout wizard. Business logic later.

## What an Object has (artist's editor, in this order)
1. **Cover photo** (required): the main thumbnail for library, grids, exhibition pages, sharing. Square crop for
   grids (artist can adjust), 4:5 on the artwork page. ≥ 2000 px short side, JPG/PNG/WebP ≤ 25 MB.
2. **Photos & reels**: ordered gallery that "sells" the piece. Each item gets a label: Front, Back, Side, Detail,
   In a room, Process, Reel. Reels = vertical 9:16 video ≤ 60 s; landscape video ≤ 3 min. Proposed limits for
   Objects: 40 photos, 6 videos (today's supplementary media: 60 items, 2 videos; see Q-O1).
3. **Details**: title, author, year, materials / technique (rich text), size H × W × D cm + weight kg,
   "size includes the base", edition (unique / number N of M + APs, shown "Edition 3/8 + 2 AP").
   Sizes follow `docs/public-redesign/units.md` (cm default, visitor switch).
4. **Technical info** (all optional, only filled ones shown): indoors / outdoors / both; display (floor, pedestal,
   wall, hanging); signed / marked; certificate; care and installation.
5. **Description**, **Where it shows**: as for images.
6. **In the 3D space** (last, framed as an extra): status Not yet → In preparation → Ready.
   - Artist: "Ask for a 3D model", optionally sending a scan/model (GLB, OBJ, FBX, STL) or we work from photos.
   - Ready: 3D preview (drag to turn), file, real size, size check against Details, "Ask for a change".
   - **Gallery team only**: upload / replace the cleaned `.glb`.

## The GLB contract (owner's clean-up in Blender)
- One `.glb`, **textures embedded** (WebP or KTX2), meshopt compression, **never quantize** (as in the spaces playbook).
- 1 unit = 1 m, +Y up, origin at the centre of the base, resting on y = 0. Real size = scale 100%.
- AO baked into the textures. Upload checks: size, triangle count, texture sizes, no external references, bounding
  box vs the Details size.
- Stored in R2 under the artwork like other media; deleting the artwork deletes the GLB and everything with it.

## In the 3D space (later step, drafted on board `Main`)
- Objects go on the **floor**, not walls. New **Floor view**: 2D plan (left) + live 3D (right), resizable.
  Open it like a wall: click a room's floor in the 3D editor, then Edit floor. The library is available there.
- The whole floor is the placeholder and takes every type: Image, Text, Shape, Video, Sound, plus **Pedestal** (W × D × H,
  shape: cube or any box, low slab, column; finishes). Owner chose "Pedestal" (same word in Spanish, widely understood). Not "Cube" (it is not always a
  cube), not "Plinth" (unfamiliar to many artists) and not "Support" (image
  artworks already have a Support card in the wall editor's Look tab). Flat items can lie on the floor or stand up. Everything can float: free **Height** (cm).
- **Pedestals** (board `objects-pedestals.dc.html`, interactive), all parametric, any size:
  - **Shapes (15)**: Cube (equal sides), Box, Slab (low), Long table (long and low), Cylinder, Disc (low round),
    Hexagon, Octagon, Tapered (box narrower at the top), Tapered round, Stepped (two tiers), Soft box (rounded
    corners), Half round (flat back, for a wall), Corner (quarter round), Table (top on four legs). A 16th tile,
    **More from the gallery**, lists GLB pedestals the gallery team adds later.
  - **Panel**: Shape (opens the picker) · Size (W / D / H, or Diameter / H for round shapes; Keep proportions) ·
    Edges (Sharp / Soft / Round) · **Material** · **Colour** (depends on the material) · Place (from two walls,
    height above floor, rotation) · On top (the attached Object) · Duplicate / Remove.
  - **Materials → colours**: Painted (12 colours + any colour; Matte / Satin / Gloss) · Wood (Birch, Ash, Oak,
    Cherry, Walnut, Ebonised) · Plastic (12 colours + any colour; Matte / Satin / Gloss) · Concrete (Light, Mid,
    Dark) · Stone (White marble, Travertine, Green marble, Black granite) · Metal (Brushed steel, Black steel, Brass,
    Copper, Corten) · Acrylic (Clear, Frosted, Smoke, tints + any colour) · Mirror (Silver, Smoked, Gold).
    Default: Painted, White, Matte. Wood reuses the frames' wood textures where they match.
- Objects: move, rotate (Y), scale proportionally only. **Snap to pedestals**: drop on a pedestal → sits on its top and
  moves with it; slide/raise while attached; Detach or drag off; Alt skips the snap.
- Plan tools mirror the wall view: snap to align, rulers/guides, groups, align/distribute, person for scale, plus
  snaps to walls and to wall artworks. No camera collisions with Objects. Tapping an Object opens its info.
- Lighting: Objects respond to room light (probes), cast/receive shadows, and are included in the room bake.

## Library and creation
- Library: Object filter; rows show cover, "2025 · Bronze · 64 × 38 × 31 cm", media count, and a 3D chip
  ("In the 3D space" / "3D model in preparation").
- Add artwork: type becomes cards (Image, Object, Text, Sound, Video); choosing Object explains it in one panel.

## Open questions
- **Q-O1** Media limits for Objects (40 photos / 6 videos proposed) vs today's 60 / 2.
- ~~Q-O2~~ Visitor artwork page: designed 2026-11-23 (O5).
- **Q-O3** Who can request a 3D model and whether it costs anything (business logic later).
- **Q-O4** Owner to confirm the pedestal shapes and materials on `objects-pedestals`, and send any GLB pedestals/tables.

## Data (one migration, phase 1)
On **`Artwork`** (all nullable / defaulted, so nothing changes for existing types):
```
artworkType        "object"            // new value next to image | text | sound | video
// Cover photo = the EXISTING imageUrl / originalImageUrl / originalWidth / originalHeight fields,
// so every grid, list and share card that already shows an image's picture shows the Object's cover.
coverCropX         Float?   // 0..1, centre of the square crop for grids (default 0.5)
coverCropY         Float?   // 0..1 (default 0.5)
heightCm           Float?
widthCm            Float?
depthCm            Float?
weightKg           Float?
sizeIncludesBase   Boolean  @default(false)
objectEdition      String?  // "unique" | "edition"  (NOT editionType: that one is the print edition)
objectEditionNo    Int?     // 3   → "Edition 3/8 + 2 AP"
objectEditionOf    Int?     // 8
objectArtistProofs Int?     // 2
placement          String?  // "indoors" | "outdoors" | "both"
displayMode        String?  // "floor" | "pedestal" | "wall" | "hanging"
signedNote         String?
certificateNote    String?
careNote           String?
modelUrl           String?  // R2 URL of the .glb (gallery team uploads)
modelSizeBytes     Int?
modelBoundsCm      Json?    // { h, w, d } read from the GLB on upload
modelStatus        String   @default("none") // "none" | "requested" | "ready"
modelRequestedAt   DateTime?
modelReadyAt       DateTime?
```
- Keep writing the legacy `dimensions` string for Objects ("64 × 38 × 31 cm", from H × W × D) so older displays
  work; the structured fields are the source of truth. Units switch per `docs/public-redesign/units.md`.
- On **`ArtworkMedia`**: `role String?` = "front" | "back" | "side" | "detail" | "room" | "process" | "reel"
  (labels in the editor: Front, Back, Side, Detail, In a room, Process, Reel). A reel is `kind: "video"` with a
  9:16 frame; store width/height as today so the page knows it is vertical.
- Object media limits (Q-O1, proposal until the owner answers): 40 images, 6 videos (reels ≤ 60 s, landscape
  ≤ 3 min). Image artworks keep today's 60 / 2. Put the per-type limits in `artworkMediaTypes.ts`.

## Order of work
Ship phase 1 so Objects can be shown on the site **without the 3D room**. Each step is shippable.

**O1 · Type and data.** Migration above; `TArtworkKind` gets `'object'`; `artworkFactory`, `artworkSlice`, the
artworks API (`/api/artworks`, `/api/artworks/[id]`, batch) accept and return the new fields. Audit every
`artworkType === …` branch (≈ 30 files, `grep -rn "artworkType ===\|TArtworkKind" src`): an Object must never
fall into an image-only path (print sales, print presentations, lightbox, TPS checkout). **Objects are not prints:
never in the print wizard, checkout or cart** (owner, 2026-11-23); `printEnabled` stays false and the editor has
no Print sales section.

**O2 · Library + Add artwork** (`objects-library`, `objects-add-artwork`). Add artwork: the Type select becomes
5 cards (Image, Object, Text, Sound, Video) with the Object explainer panel. Library: "Object" filter; Object rows
show the cover (square crop), "year · materials · H × W × D cm", "N photos · N reels" and the 3D chip
("In the 3D space" when `modelStatus = ready`, "3D model in preparation" when `requested`, none otherwise).

**O3 · Object editor** (`objects-editor`). Reuse `ArtworkEditForm` with its section conditions (`sections.ts`):
for `object` the sections are, in order, Cover photo · Photos & reels · Details · Technical info · Description ·
Where it shows · In the 3D space. Cover photo uses today's image upload (same limits, 25 MB) plus the square-crop
adjuster and the three "How it shows" previews. Photos & reels = `ArtworkMediaManager` with a role label per item,
drag to reorder, the per-type limits. Details/Technical info: fields above; only filled technical fields show on
the public page.

**O4 · The 3D model (GLB).** "In the 3D space" section:
- Artist: "Ask for a 3D model" sets `modelStatus = requested` + `modelRequestedAt`, optionally with an attached
  scan/model (GLB, OBJ, FBX, STL, stored as a private R2 file for the team) and notifies the gallery team
  (admin email, like other admin notifications). States: none → requested ("In preparation") → ready.
- **Gallery team only** (admin role): Upload / Replace `.glb`. Server-side checks with `@gltf-transform`
  (already a dependency): single binary .glb, no external URIs, textures embedded, ≤ 30 MB, triangle count and
  texture size reported, **no quantization** (spaces playbook §3.1). Read the bounding box → `modelBoundsCm`;
  show "Size check: matches / differs from the Details size" (warn, never block). R2 key under the artwork's
  folder (`buildArtworkMediaKey` style). Sets `modelStatus = ready`, `modelReadyAt`.
- Ready view: 3D preview (drag to turn, scroll to zoom; a small R3F canvas with `useGLTF`, neutral studio light),
  file, real size, size check, prepared date, "Ask for a change" (back to requested with a note).
- Deleting the artwork deletes the GLB and any request files (extend AR-189's cleanup); `scripts/reconcile-r2.ts`
  must protect `modelUrl` and request files.

**O5 · Visitors, without the 3D room** (owner: anyone must explore an exhibition fully without entering it).
Designs: `objects-artwork-page-desktop.dc.html` (interactive: click the views), `objects-artwork-page-phone.dc.html`.
- Objects show wherever images show: artist profile, exhibition pages, grids, "More by the artist", share cards
  (cover, square crop). Check `getPublicExhibitionByUrl` and `/api/exhibitions/by-url/[url]` (they filter
  `artworkType === 'image'` in three places) so Objects are listed. Objects never get the **Order print** button.
- **Artwork page for an Object** = the approved artwork page (`docs/public-redesign/artwork.md`: same header,
  two columns, sticky 320 px info column, no underlines, square corners, same footer), with these differences:
  - **Stage** (left, 760 px, `#f2f2f2`, `contain`): starts on the cover. Under it a row of **72 px square view
    thumbnails** (the photos labelled Front/Back/Side/Detail/In a room…, in the editor's order), selected = 1 px
    `#1a1a1a` outline; clicking one swaps the stage; a one-line caption under the row (the photo's label/caption,
    13 px `#888`). This is a deliberate exception to "no thumbnails" in artwork.md: a sculpture needs its sides.
  - When the 3D model is ready, a last thumbnail **3D** (cube icon) and an outlined button **Turn it around in 3D**
    in the info column both put the 3D model in the stage: drag to turn, scroll/pinch to come closer, **Reset view**,
    "Real size 64 × 38 × 31 cm". Load the GLB only on that click (never on page load). No model → no thumbnail, no
    button. Same R3F viewer as the editor's preview.
  - **Info column**: artist caps, title, year, size line "64 × 38 × 31 cm · 18 kg" with the cm / in switch
    (`units.md`), then materials, "Steel base, included in the size", "Edition 3 of 8 + 2 AP" (13 px `#999`).
    Hairline, then *"For price, availability and shipping, ask the gallery. We answer within two working days."*,
    **Inquire** as the black 48 px button (today's Inquire flow), the 3D button, Share. No price, no Order print.
  - Below the columns, in order: **About the work** (description), **Materials** (technique), **Details** (label /
    value rows: Size, Edition, Where it can stand, Display, Signed, Certificate, Care; only filled rows),
    **In motion** (the videos: reels 9:16 in a 4-column row on desktop, horizontal scroll 150 px wide on phone;
    autoplay muted when in view, tap for sound, duration chip), **Photographs** (the remaining photos, 3 columns 4:5
    on desktop, 2 on phone, caption under each), **More by the artist**, footer.
  - Phone: stage 390 × 488 (4:5) that swipes through the views with the 6-segment progress bar under it, "1 / 6"
    top right and a **3D** button bottom left; the info panel on `#f8f8f6` with Inquire and Turn it around in 3D
    full width; then the same sections stacked.
  - The 3D room's artwork overlay shows this same page (as artwork.md says for images).

**O6 · Floor view and placing Objects in the 3D room — later, not now.** Draft in `objects-floor-view-draft` and
"In the 3D space (later step)" above. For phase 1 the 3D scene and the wall editor must simply ignore Objects:
the wall view's library (`MediaLibrary`) does not offer them for walls.

## Where things live in the code today (starting points, checked 2026-11-23)
- Types: `src/types/artwork.ts` (`TArtworkKind`); schema `prisma/schema.prisma` (`Artwork` l.155, `ArtworkMedia`).
- Add artwork: `src/components/dashboard/AddArtworkModal/AddArtworkModal.tsx`.
- Library: `src/components/dashboard/artworks/index.tsx`.
- Editor: `src/components/shared/ArtworkEditForm/` (`index.tsx`, `sections.ts`, `ArtworkMediaManager.tsx`,
  `SectionNav.tsx`), page `src/app/dashboard/artworks/[id]/edit/page.tsx`.
- Media upload: `src/app/api/artwork-media/route.ts`, limits `src/lib/artwork/artworkMediaTypes.ts`,
  keys `src/lib/r2.ts` (`buildArtworkMediaKey`).
- Wall editor library: `src/components/wallview/MediaLibrary/MediaLibrary.tsx`.
- Public exhibition data: `src/lib/queries/getPublicExhibitionByUrl.ts`, `src/app/api/exhibitions/by-url/[url]/route.ts`.
- R2 reconcile: `scripts/reconcile-r2.ts`.

## For Code Claude
Follow the repo's admin-redesign rules for anything under `/admin`. Write "Built" notes per step at the end of
this file (step, PR, what differs from the board and why) and open points as new **Q-O** questions below; do not
change the decisions above without the owner.

## Built

**O1 · Type and data** (2026-11-23, branch `feat/AR-191-add-3d-artworks`, PR not opened yet).
- Schema: the `Artwork` fields and `ArtworkMedia.role` exactly as in "Data" (additive, all nullable / defaulted).
  Apply it to each database before deploying this code: a client generated from it reads the new columns on
  every artwork query.
- `TArtworkKind` has `'object'`; `TArtwork` carries the Object fields (`TArtworkObjectFields`); the slice counts
  objects; the factory gives a new Object the database defaults.
- Rules in `src/lib/artwork/objectArtwork.ts` (pure, client-safe): `parseObjectFields` (only the keys sent; null
  or '' clears; sizes on the 0.1 cm grid, weight to 10 g; N ≤ M; "unique" clears the numbers; signed /
  certificate one line ≤ 300, care multi-line ≤ 2000), `objectDimensionsText` ("64 × 38 × 31 cm"),
  `objectWriteData`. Covered by `e2e/object-fields.spec.ts` (pure, no server).
- `/api/artworks` (POST), `/api/artworks/[id]` (PUT) and `/api/artworks/batch` take the Object fields and
  return every field. Every save of an Object writes `printEnabled: false`, no price, edition type `open`, and
  rebuilds the legacy `dimensions` text when a size is sent. The type can't change into or out of `object`
  (400). Unknown types are refused (400). The 3D model fields are **not** writable through these routes: only
  O4's model routes will write them, so no request can point an artwork at someone else's file.
- Print paths: the catalog query (`purchasableArtworkWhere`) leaves Objects out, and checkout
  (`validateAndPriceItem`, `createPaymentIntent`) refuses an Object even if its row were ever wrong. Print
  presentations and the lightbox were already image-only.
- Media: per-type limits in `artworkMediaTypes.ts` (`mediaLimitsFor`: Objects 40 photos + 6 videos, the rest
  60 / 2), enforced by `/api/artwork-media`; `role` is returned with each item.
- Wall editor: its library (`MediaLibrary`) doesn't list Objects, and adding one to a wall is refused
  (`hangsOnWall`). The 3D scene only draws placed works and has no case for `object`.
- Audit of the other `artworkType` branches: wall editor and scene files only see placed works (no change);
  the dashboard type labels say "Object". Left for later steps, as planned: Add artwork cards and the library
  filter / cover row (O2); the editor's sections, the media manager's client-side limit (still 60) and writing
  `role` (O3); deleting the GLB and protecting it in `reconcile-r2.ts` (O4); the public `artworkType: 'image'`
  filters in `getPublicExhibitionByUrl`, `/api/exhibitions/by-url/[url]` and `getPublicArtistByHandler` (O5).
- For O3: the spec makes materials / technique rich text, but the artwork routes clean `technique` as one line
  of at most 200 characters (as for images). The Object editor will need its own rule there.
