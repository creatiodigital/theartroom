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
- **Selling** (update 2026-11-23): like every artwork, an Object can be sold as **print** (a photograph of it, through
  checkout) and/or as **unique** (by inquiry). Both live in the editor's **Sales** tab (`docs/unique-sales/README.md`).

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
- **Snapping, exactly** (owner, 2026-11-23):
  - What touches the top is the Object's **bounding-box bottom centre** (from `modelBoundsCm`), not the mesh origin,
    so a slightly-off origin never sinks or floats the piece. The origin (centre of the base) is the **rotation
    pivot**, which is why the upload checker tests it.
  - First drop: **centred** on the top. Then it slides on the top with snaps to centre, edges and centre lines.
    The top follows the pedestal's shape (round for Cylinder/Disc, smaller for Tapered, upper tier for Stepped,
    tabletop for Table, the outline for Half round/Corner).
  - Overhang is allowed (amber footprint outline as a warning). It **detaches** when the footprint's centre leaves
    the top; Alt-drag never snaps.
  - **Several Objects per pedestal** (owner): each snaps and slides on its own; footprints avoid overlapping each
    other.
  - Stored **relative to the pedestal** (offset from the top's centre, rotation, lift). Moving or rotating the
    pedestal carries its Objects; changing its height keeps them on the top; resizing keeps their offset and
    re-centres any that would fall off. **Lift** works while attached ("On Pedestal 1 + 10 cm").
  - **Un-snap**: drag off the top (lands on the floor where dropped), **Detach** in the Object's panel (stays in place,
    free), or Alt-drag. To re-attach, drag it back onto a top.
- **Grouping**, two kinds:
  - Pedestal + its Objects (automatic): the pedestal leads. In the list the Objects are indented under it. Clicking
    the pedestal selects it and its Objects (move/rotate together); clicking an Object selects only it. Deleting a
    pedestal asks "Also remove <Object>, or keep it on the floor?".
  - Groups you make (as on walls): select several, **Group** ⌘G / **Ungroup** ⇧⌘G, double-click to work inside;
    one collapsible row in the list; a group moves/rotates/aligns as one block and carries its pedestals' Objects.
    Autofocus groups work as on walls. Positions are stored Object → pedestal → group → room.
- Plan tools mirror the wall view: snap to align, rulers/guides, groups, align/distribute, person for scale, plus
  snaps to walls and to wall artworks. No camera collisions with Objects. Tapping an Object opens its info.
- Lighting: Objects respond to room light (probes), cast/receive shadows, and are included in the room bake.

## Library and creation
- Library: Object filter; rows show cover, "2025 · Bronze · 64 × 38 × 31 cm", media count, and a 3D chip
  ("In the 3D space" / "3D model in preparation").
- Add artwork: type becomes cards (Image, Object, Text, Sound, Video); choosing Object explains it in one panel.

## Open questions
- **Q-O1** Media limits for Objects: 40 photos / 6 videos (built). Design Claude recommends keeping them;
  **waiting for the owner's confirmation** (an earlier note here wrongly marked it answered).
- ~~Q-O2~~ Visitor artwork page: designed 2026-11-23 (O5).
- ~~Q-O3~~ **Answered 2026-11-25 (owner, to Code): artists never request a 3D model; they send their .glb files to
  the gallery directly**, and the gallery team uploads them. The request flow is removed (Built, 2026-11-25). The
  sections above that describe "Ask for a 3D model", "In preparation", "Ask for a change", the request files and the
  two emails are the old design.
- **Q-O4** Owner to confirm the pedestal shapes and materials on `objects-pedestals`, and send any GLB pedestals/tables.
- **Q-O5** (Code, O2) The boards' sand / stone colours (Object tile `#ece9e3`, explainer `#f6f4f0`, its figure
  `#6f685f`, the 3D chips `#e8eef8`/`#1f3b6b` and `#f4f1ea`/`#6b5a2e`) are not design tokens. O2 uses the nearest
  existing ones (see Built O2). Add them as studio tokens with the exact values? (Owner.)
- **Q-O6** (Code, O3) Video file size for Objects: raised from the supplementary media's 20 MB to 50 MB (the video
  artworks' limit), since a 60 s phone reel is often 30–40 MB. Keep 50 MB? (Owner.)
- **Q-O7** (Code, O3) The board's cover line says "JPG, PNG or WebP"; today's image upload (the print-master
  pipeline) takes JPG, PNG and TIFF, so the editor says that. Accept WebP covers for Objects? (Owner.)
- **Q-O8** (Owner, 2026-11-23, for O4) A **GLB checker before upload**: "I don't want to just upload any glb and see
  only after it is not good." Plan: (1) in the browser, before anything is sent, load the file with the room's own
  loaders (GLTFLoader + meshopt + KTX2), render it in the preview, and show a report with pass / warn / fail rows:
  it loads and renders; one binary .glb, nothing external, textures inside; no quantization (spaces playbook §3.1);
  meshopt; file size; triangles, meshes, materials; texture count, sizes and formats; real size in cm against the
  Details size; base resting on y = 0 and centred; Upload is enabled only with no fail. (2) The server checks the same
  again with `@gltf-transform` (already a dependency) and refuses a fail. Open: also run the official Khronos glTF
  Validator (npm `gltf-validator`, a new package) for spec-level breakage? Needs the owner's OK.
- **Q-O9** (Code, O5) Sizes on the visitor page follow `units.md` ("one decimal, always"): "64.0 × 38.0 × 31.0 cm";
  the boards show "64 × 38 × 31 cm". And the weight follows the cm | in switch: kg with cm, lb with inches ("18 kg",
  "39.7 lb"; `units.md` covers lengths only). Keep both? (Owner.)

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
- Object media limits (Q-O1, built; owner to confirm): 40 images, 6 videos (reels ≤ 60 s, landscape
  ≤ 3 min). Image artworks keep today's 60 / 2. Put the per-type limits in `artworkMediaTypes.ts`.

## Order of work
Ship phase 1 so Objects can be shown on the site **without the 3D room**. Each step is shippable.

**O1 · Type and data.** Migration above; `TArtworkKind` gets `'object'`; `artworkFactory`, `artworkSlice`, the
artworks API (`/api/artworks`, `/api/artworks/[id]`, batch) accept and return the new fields. Audit every
`artworkType === …` branch (≈ 30 files, `grep -rn "artworkType ===\|TArtworkKind" src`): an Object must never
fall into an image-only path by accident (print presentations, lightbox, TPS checkout).
**Update 2026-11-23 (owner): an Object CAN sell prints of a photograph of it**, and can be sold as unique (see
`docs/unique-sales/README.md`, editor **Sales** tab). The print source is the photo chosen in Sales › Print image
(`printImageMediaId` → one of its ArtworkMedia images, or a print-only upload); from there it is an ordinary print:
same wizard, checkout, TPS. Until the Sales tab is built, keep `printEnabled` false for Objects.

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
  of at most 200 characters (as for images). (O3: no change needed: images already save rich text there; the 200
  characters include the tags, as for images.)

**O2 · Library + Add artwork** (2026-11-23, same branch).
- Add artwork: the Type select is now five cards (Image, Object, Text, Sound, Video; Phosphor light icons, Cube
  for Object), radios hidden with the focus ring on the card. Choosing Object shows the explainer panel with the
  board's copy. The old help line under the select is gone (the board has none). Differs from the board: the
  dialog is today's admin dialog (560 px, board 600), so the cards are a bit narrower; on a phone they wrap
  three + two. Labels 14 px (`--text-sm`), board 13 px.
- Library: description "Everything you can show in your exhibitions." (board copy; was "hang"). Filter
  All · Image · Object · Text · Sound · Video (remembered as before). An Object row shows its cover cropped square
  at `coverCropX/Y` (other types stay contained), or a cube on the warm tile with no cover; the meta line
  "year · materials · H × W × D cm"; "8 photos · 2 reels" (reel = a vertical video or one labelled Reel); the 3D
  chip ("In the 3D space" for `ready`, "3D model in preparation" for `requested`, none otherwise).
  `GET /api/artworks` adds `objectMedia: { photos, videos, reels }` to Object rows (one extra query, only when
  there are Objects).
- Colours, nearest existing tokens (Q-O5): ready chip `--editor-tint-bake` / `-icon`, preparing chip
  `--editor-tint-benches` / `-icon` (the 3D room editor's tints), the explainer and the empty Object tile on
  `--studio-nav-active` (the other types' tile), the explainer's figure box `--studio-avatar`, figure
  `--color-text-secondary`.
- Seen in Chrome (dialog desktop + phone, an Object row through the API: print sales off, "64 × 38 × 31 cm").
  Not seen with data: a cover photo and the 3D chips (no Object has them yet). Until O3, Create artwork for an
  Object opens today's editor (Details only).

**O3 · Object editor** (2026-11-23, same branch).
- `ArtworkEditForm` for `object`: Cover photo · Photos & reels · Details · Technical info · Description · Where it
  shows (On this page lists them). "In the 3D space" comes with O4. No Print sales, no Supplementary media.
- Cover photo: today's image upload (saved with the form, as for images) in a 4:5 preview with the **square crop**:
  a dashed square over the photo, the rest veiled; drag it or focus it and use the arrow keys (it moves along the
  long side only: it is the largest square). Saved as `coverCropX/Y` = the square's centre; a new photo starts
  centred. "How it shows": grid (square crop), artwork page (4:5, whole photo), lists. Checked in the browser: at
  least 2000 px on the short side, up to 25 MB. Differs from the board: no separate "Adjust square crop" button
  (the square is always adjustable, with a help line); formats say JPG, PNG or TIFF (Q-O7).
- Photos & reels: tiles 4:5 (reels 9:16), label top left, duration on videos, drag handle top right (keyboard as the
  other lists); clicking a tile opens a small window: Label (No label, Front, Back, Side, Detail, In a room, Process;
  Reel for videos), Caption, Remove. A vertical video is labelled Reel on upload. Checked in the browser: 40 photos,
  6 videos, a reel up to 60 s, a landscape video up to 3 min. The board draws no editing controls; the window and
  the handle are additions.
- `/api/artwork-media`: the artist may now manage their **own Object's** media (still admin-only for other types);
  `PATCH` saves a label / caption or the whole order; uploads take `role`; Object videos up to 50 MB (Q-O6); the
  upload rate limit counts presigns only (60 an hour) so an Object's 40 photos fit in one batch.
- Details: Author, Year, Materials / technique (rich text), Size (H / W / D cm, weight kg, "Size includes the base",
  "Visitors see it as 64 × 38 × 31 cm…"), Edition (Unique piece / Edition, number / of / + artist's proofs,
  "Shown as “Edition 3/8 + 2 AP”"). Technical info: Where it can stand, Display (Floor, **Pedestal**, Wall, Hanging:
  the README's word, the board says Plinth), Signed / marked, Certificate, Care and installation. Clicking a pressed
  choice clears it (all optional). Clearing the edition clears its numbers.
- Header: "Object" and the 3D chip (shared `ObjectSpaceChip`, also in the library).
- Seen in Chrome with the e2e artist: an Object with a cover, two photos and a reel, uploaded through the API; the
  crop moved by keyboard and saved (0.4 = the top for a 4:5 photo); Save kept every field; then deleted.

**O4 · The 3D model, with the GLB checker** (2026-11-23, same branch; owner's answers to Q-O5–Q-O8 the same day:
tokens added with the board's exact values, 50 MB videos and JPG/PNG/TIFF covers kept, the Khronos validator added
and loaded only when the upload dialog opens).
- **Checker** (`lib/objects/glb.ts`, one set of rules for both sides): one binary .glb · ≤ 30 MB · Khronos glTF
  Validator (errors fail, warnings warn) · opens (browser: the 3D room's loaders, meshopt + KTX2, drawn and its
  shaders compiled; server: @gltf-transform reads and decodes it) · nothing external · not quantized
  (KHR_mesh_quantization fails) · meshopt (warn if not) · textures (warn: not WebP/KTX2, above 4096 px; fail above
  8192 px) · triangles (warn above 500,000) · real size from the bounds (warn if it looks like the wrong unit) ·
  size check against Details (1 cm or 3 %; warn, never block) · base on y = 0 (0.5 cm) · origin at the centre of the
  base (1 cm or 2 %). Fails block; warnings show but never block.
- **Upload / Replace .glb** (gallery team only): the dialog checks the file before anything is sent and shows the
  preview beside the rows; Upload is off while any row fails. The server reads the stored file back, runs the same
  rules on its own facts, and on a fail deletes it and shows its rows. A pass stores `modelUrl`, size, bounds,
  `ready`, the date, removes the replaced file and emails the artist if they had asked.
- **Artist**: Not yet → "Ask for a 3D model" (note, optional GLB/OBJ/FBX/STL up to 200 MB) → In preparation ("Asked
  23 Nov · we will email you when it is ready") → Ready: the preview (drag to turn, scroll to zoom), 3D model,
  Real size, Size check, Prepared, "Ask for a change" (a note, required; back to In preparation). The gallery gets
  an email for each request (note, file name and size, a link to the editor; never a file address).
- The files artists send are not in a table: they sit under `model-requests/<env>/<artworkId>/` in the main bucket
  with a secret key, like the print masters (the private bucket takes no browser uploads), listed for the team only
  and deleted with the artwork. `reconcile-r2.ts` keeps `modelUrl` and never reads that prefix.
- Differs from the board: no "To place it, open an exhibition's 3D editor and drag it…" line (the Floor view is O6,
  not built); the file line says "GLB · 6.4 MB" (the original file name is not kept).
- Checked: `e2e/object-glb.spec.ts` (the rules, and the server's facts on a real .glb from the repo); in Chrome with
  the e2e artist and admin (emails off): a request with an STL, a broken .glb (four fails, Upload off), a real .glb
  (Ready to upload · 2 warnings, stored at 44.9 × 185.3 × 40.6 cm, size check matches), the artist's ready view, the
  artist refused the team's file list (403), and after deleting the Object both files answer 404.

**O5 · Visitors, without the 3D room** (2026-11-24, same branch).
- Objects show where images show: the exhibition page's grid (`getPublicExhibitionByUrl`), the artist page and More
  by the artist (`getPublicArtistByHandler`), with their cover cropped square at the artist's crop and "2025 ·
  Object" on the year line; never Order print (no sale). The share image is the cover's square crop.
  `/api/exhibitions/by-url/[url]` stays image-only: it is the 3D room's data (placed works only, O6).
- The artwork page for an Object (`components/artwork/object/`), in the approved page's frame and styles: the stage
  (the cover, then the labelled photos Front, Back, Side, Detail, In a room, Process, in the editor's order; contain
  on the grey) with 72 px tiles under it and the view's label · caption; the info column (artist, title, year, size
  · weight with cm | in, materials, "Base included in the size", "Edition 3 of 8 + 2 AP"; the ask line, Inquire in
  black, Turn it around in 3D, Share; no price). The 3D model loads only on that click (or the 3D tile): drag to turn,
  scroll to come closer, Reset view, Real size. Below: About the work, Materials, Details (only filled rows), In
  motion (reels four across, a landscape film two; silent while in view, a tap for sound; none for visitors who ask
  for less motion), Photographs (the unlabelled photos, 3 across 4:5), More by the artist. Phones: the 4:5 stage
  swipes, "1 / 5" and the 3D / Photos button on it, the progress bar under it; the sections stacked.
- Differs from the board: the info column is not sticky (the artwork page's own rule since 2026-11-12); the 3D model
  is a mode of the stage, not one more swipe on phones ("Photos" goes back); labelled photos appear once, as views,
  and the Photographs are the unlabelled ones (the board shows some in both); Display reads "On a pedestal".
- The 3D room's overlay never opens an Object in phase 1 (Objects are not placed until O6), so it is unchanged.
- Checked: `e2e/object-fields.spec.ts` (+ sizes, weight, edition wording, card crop); in Chrome with a full test
  Object (cover, four views, two photographs, a reel, the real .glb): desktop page, the 3D mode, the phone page,
  the artist page's card and the share image; then deleted.
- Q-O9 applied 2026-11-24 (the design Claude's proposal, from the owner): sizes in cm as entered, no forced ".0"
  ("64 × 38 × 31 cm", "64.5 × 38 × 31 cm"); inches with one decimal ("25.2 × 15.0 × 12.2 in"); weight always in kg
  ("Prices, weights and anything not a dimension are unchanged", units.md).
- Before release (2026-11-24): full E2E 1044 passed, 0 failed (17 skipped, as before); source lint and type check
  clean; the three emails rendered and read (not sent); "Ask for a change" clicked through (an empty note refused,
  the model kept, a second request while In preparation refused); the editor checked at phone width.

**O6 · The Floor view and Objects in the 3D room** (2026-11-24, same branch; owner: "proceed", "do all of them
till the end", so built from the draft board and the rules above).
- **Data**: `Exhibition.floorLayout` (JSON, like the benches; schema change, the owner applies it): Objects and
  pedestals with their room, place (world metres), turn, height; an Object on a pedestal is stored relative to it
  (offset from the top's centre, turn, lift), so the pedestal carries it. `lib/floor/*` holds the rules (pure,
  tested in `e2e/floor-layout.spec.ts`). Saved by the exhibition PUT (only the owner's own Objects kept), frozen in
  the snapshot, served by `/api/exhibitions/by-url` with each Object's model (`floorArtworks`), in the bake
  fingerprint once anything stands there; deleting an Object takes it off every floor.
- **In the room** (editor and visitors): pedestals built from their parameters (15 shapes, edges, 8 materials and
  their colours, finish), Objects from their `.glb` (bounding-box bottom centre on the spot, turn, scale). Meshes,
  so the bake counts them as casters, as it does the benches ("Casts a shadow" off: skipped). A click on an Object
  opens its page in the room's window (`/api/artworks/by-slug/[slug]/object`).
- **Floor view**: the 3D editor's new **Floor plan** tool ("Floor" was taken: the floor's material). Left: the room (a picker when there are several), Cancel /
  Save / Save & close, undo / redo, zoom and Fit, the helpers (rulers, snap to align, snap to pedestals, person for
  scale), On this floor (Objects under their pedestal, filters). Middle: the plan (walls from the hanging walls,
  footprints and outlines turned as they stand, distances to the west and north walls, a turning handle) beside the
  live 3D: the editor's own canvas, so the room never reloads (resizable divider; it outlines what is picked and
  shows the 1.70 m person). Bottom: From library (only Objects with a ready model can be added) and Pedestal; click
  to add in the middle of the room or drag onto the plan. Right: the picked item's panel, as the boards draw it.
  Several picked: align, distribute, Group / Ungroup (⌘G / ⇧⌘G; clicking a member picks the group). Keys: arrows
  (Shift: 10 cm), Delete, ⌘D (pedestal), ⌘Z / ⇧⌘Z, Escape.
- **Snapping**: on release an Object lands on the pedestal under its centre (the highest top), centred the first
  time and sliding afterwards; Alt never snaps; off the top it stands on the floor; overhang outlined in amber.
  While dragging: snap to the other items' centres, the room's centre lines and the walls.
- Differs from the board: the Floor plan tool opens room 1 (a picker for the others) rather than "click a room's floor,
  then Edit floor" (a clickable floor would stop click-to-walk); the 3D side is the editor's camera (walk as usual),
  no "Eye level / Orbit" switch yet; the board's word "Plinth" is "Pedestal" (owner).
- **Not built yet**: images, text, shapes, video and sound on the floor (the board's other add buttons: they live in
  the wall rows' save flow, a larger change); snapping to wall artworks; autofocus groups on the floor;
  double-click to work inside a group; footprints on one pedestal avoiding each other; Objects receiving baked
  light (they are lit by the room's environment and cast in the bake); "More from the gallery" GLB pedestals.
- **Seen in a browser** (2026-11-24, dev DB with `floorLayout`, a draft exhibition in Paris): a pedestal added, an
  Object from the library added in the middle lands on it centred at 90 cm; the pedestal made a Ø 120 cm walnut
  cylinder and moved 3 m from its panel, the Object rides along; Save keeps both (shape, material, colour,
  attachment); the live 3D draws the pedestal and the Object's model at true size on its top. Dragging the Object
  off every top puts it back on the floor (height 0). On the plan a pedestal carrying an Object writes its name a
  line lower. Not clicked in a browser: an Object in the visitor's room (WebGL clicks are not scripted).

**No requests: "In preparation" removed** (2026-11-25, same branch; owner: "remove that whole feature 'in
preparation'. Artists will not request for this. They will send me directly the glb files"; Q-O3).
- The editor's In the 3D space shows the ready model (preview, file, real size, size check, "Added by The Art Room ·
  date"); no "Not in the 3D space yet" box (owner, same day: "remove this"), so the artist sees the section only once
  the model is in; the gallery team always sees it. The Gallery team box (Upload / Replace
  .glb through the checker) is unchanged. The section now sits right after the Cover photo (owner, same day: "the
  most important part"), and the upload window scrolls (title and Cancel · Upload stay).
- Removed: "Ask for a 3D model" and "Ask for a change" (and their window), the In preparation box and chip, the
  request files (`model-requests/<env>/<artworkId>/`, the `/api/artworks/[id]/model-request` route), the gallery's
  request email and the artist's "ready" email (uploading a model sends no email), and `Artwork.modelRequestedAt`.
  `modelStatus` is "none" | "ready". The size check reads "Matches / Differs from the size in Details".
- Schema: one column fewer (`modelRequestedAt`); the dev database still has it until the owner's next push.

**Always a unique piece: no Edition, no artist's proofs** (2026-11-25, same branch; owner: "We don't have artist's
proofs, remove that", then "they will be sold as unique pieces", "always").
- Removed: the editor's Edition row (Unique piece / Edition, Number / of, + artist's proofs), the "Shown as …" line,
  the visitor page's edition (info column and Details), and `Artwork.objectEdition`, `objectEditionNo`,
  `objectEditionOf`, `objectArtistProofs` (four columns fewer; the dev database keeps them until the owner's next
  push). Nothing says "Unique piece" on the page: every Object is one.
- For the design Claude: `docs/unique-sales/README.md` still sells "Object editions" ("Edition 3 of 8",
  "5 of 8 available", counting casts); those parts no longer apply, an Object is always one sale.

**Cover photo = the image upload, no square crop** (2026-11-25, same branch; owner: "we cannot have a different
uploader just for 3D objects", "it's a cover image, same as the rest").
- The editor's Cover photo is the image artworks' own panel and uploader (square preview, the photo whole, the same
  limits and note: JPEG, PNG, TIFF, at least 1200 × 1200 px, up to 200 MB); only its title and line differ.
- Removed: the dashed square crop and "How it shows", the 2000 px / 25 MB cover limits, `Artwork.coverCropX` /
  `coverCropY` (two columns fewer; the dev database keeps them until the owner's next push). Grids, the studio
  library and the share image show an Object's cover whole, like any picture; the grid's year line still says
  "Object". On the Object page the cover's view thumbnail is centred, like the other views.
- The gallery team's upload box has no "Gallery team only" eyebrow (owner, same day: "remove this"); only admins see
  it anyway.

**No "Size includes the base"** (2026-11-25, same branch; owner: "bases are just for reference. The measurements are
just for the sculptures, not supplementary bases"). Removed the editor's checkbox, the visitor page's "Base included
in the size" / ", with base", and `Artwork.sizeIncludesBase` (one column fewer; the dev database keeps it until the
owner's next push). H × W × D is always the sculpture alone.

**No Technical info** (2026-11-25, same branch; owner: "Remove this too. We will not fill that info here").
Removed the editor's Technical info section (Where it can stand, Display, Signed / marked, Certificate, Care and
installation), its rows on the visitor page (Details keeps Size · weight), and `Artwork.placement`, `displayMode`,
`signedNote`, `certificateNote`, `careNote` (five columns fewer; the dev database keeps them until the owner's
next push).

**Upload window: more light, warnings in plain words** (2026-11-25; owner: "add more light", "explain those warnings").
The .glb preview has a neutral studio around the model (three's RoomEnvironment, built in the browser) and a
stronger key light plus a fill, so metal and dark materials read. The validator's warnings are grouped by kind and
written out (e.g. normal maps without stored tangents: the room works them out; fine to upload); the size check says
the room uses the model's own size and what to correct.

**Sizes: the artist's Details only; never the .glb** (2026-11-25; owner: "I cannot rely on the glb object
dimensions", "remove that validation", "These fields are the ones to be displayed on the artwork page", "do not rely
on glb", "on the 3D space, the artist will make sure to resize that glb to closely match the real size").
- Removed the Size check (upload window, the ready model's facts, the server's rules); the model's own size is
  shown as "Model size" (information; the odd-scale warning stays).
- The artwork page shows only Details (Height × Width × Depth, weight); its "Real size" line from the model is gone.
- In the 3D room an Object starts at the model's own size; the artist resizes it on the Floor plan ("100% is the size
  of the uploaded model").

**Floor plan: once per Object; the keys walk the room** (2026-11-25; owner: "Do not allow to add more than once a 3D
object! unless it's a pedestal", "I cannot navigate in this 3D space with the keys or arrows").
- An Object (a unique piece) goes on an exhibition's floor once, in any room: its library row then reads "Already on
  the floor" and is off; adding it anyway picks the one already there. The server keeps the first copy only
  (`parseFloorLayout`). Pedestals repeat freely.
- The arrows and WASD walk the live 3D as in the editor, except while something is picked and the mouse is not over
  the 3D: then the arrows move the pick on the plan (Shift: 10 cm).

**Floor plan and the 3D viewer, 2026-11-25 (owner's review)**
- The Floor plan's live 3D is a helper for placing Objects: no wall placeholders while it is open (put back on close).
  The keys and mouse walk it as in the 3D editor (W levels the head while walking, as everywhere).
- The picked Object's size is shown and set in cm, Height × Width × Depth (in proportion: change one, the others
  follow; "Back to the uploaded size"); the header shows it at all times.
- Every text button in the Floor plan is the library Button (secondary / primary / danger, small).
- The artwork page's 3D button reads "View in 3D". The 3D viewer zooms between 75 % and 150 % of the framed
  distance, and Reset view glides back to the starting angle; the model no longer blinks on a re-render (its cache
  was freed by Strict Mode's test cleanup and reloaded, hidden meanwhile).
