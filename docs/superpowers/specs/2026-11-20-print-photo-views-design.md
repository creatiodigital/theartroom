# Print photo views: three more "photos" of every print

Date: 2026-11-20 · Builds on `docs/superpowers/specs/2026-10-28-print-presentations-design.md` (the framed presentation).

## Intent

The gallery has no physical prints to photograph. White Cube's print shop shows each print in several photos: framed,
the bare sheet at its corner, a couple of angled close-ups. The owner wants the same kind of set for every artwork, generated,
without copying White Cube. In the owner's words: "give the impression that those images are real photos taken from real
printed versions of the artworks". Success: a visitor takes them for photographs of the print.

Each artwork with a print presentation gets three more images, all rendered from the 3D scene:

1. **Sheet**: the unframed sheet lying on a white table, seen from the front at a corner of the sheet. One of four
   approved compositions is picked per work, plus a small random nudge, so visitors moving between works don't notice a
   pattern. A limited edition shows its pencilled number there; other works show a clean margin.
2. **Close**: an angled close-up inside the image, with real focus blur.
3. **Edge**: a second, wider close-up near the image's top edge, with the paper's margin beyond it.

Close-up angles, aim and blur vary per work (seeded), "not always the exact same angle". A wall shot with a human figure
is **out** for now.

## Decisions (the owner's)

- **The artwork is in these three renders (option A).** It takes the photo's light, the paper's grain and the focus blur,
  as a real print would. The light is neutral white (no tint), so the in-focus parts stay within a few shades of the file.
  The framed presentation keeps its rule unchanged: the artwork is never in that render, and the original file shows
  through a transparent window.
- **Straight-cut edge** (the lab trims prints to size): "as long as it looks real and it shows some small shadow
  underneath".
- **The real print's size and shape.** "Not all artworks have the same size, aspect ratio": the sheet is built at the
  work's print size (see Sizing).
- **Each photo fills the artwork page's grey box**, the same space the framed view has ("make all the new images fit the
  same space available for the framed version"): cover-cropped to the box's shape.
- **One Render press makes all four** (framed + three). The admin table and dashboard **preview only the framed one**
  ("I don't need to preview the close-ups and the unframed one").
- **Look approved 2026-11-20**: the close-ups "awesome", the corner shot "Perfect now!". Equal margins look unequal
  from that angle (the bottom one is foreshortened). The owner accepted it ("if it's the angle, never mind").
- **No pattern across works.** The owner: "I don't want users to notice the similarity when navigating over different
  artworks"; a single angle "looks suspicious, people will know this is 3D rendering". So: "create 3-4 versions and
  just pick randomly 1 of them when rendering", with a little variation on top.
- **The real current number.** The random `copy/N` (e.g. 13/100 with nothing sold) is "completely fake". Every render,
  framed view included, pencils the **next unsold copy** of the mandatory print size (today 1/N). Works sell slowly:
  after a sale the owner re-renders ("I don't mind going there and just hit re-render"), prompted by a warning on the
  admin dashboard homepage: "You have X artworks that need to be re-rendered".

## Goals

1. Every work that gets a framed presentation (image works with a known shape and a web image) also gets the three photos
   when it's rendered.
2. The artwork page shows the four images: the framed view first and selected, then the photos, in a 2 × 2 grid
   below the Inquire button to switch. With only the framed render, it shows that alone; with nothing, the raw image (no
   thumbnails either way).
3. A photo of an old image never shows: when the work's image or print changes, its photos are out of date and hidden
   until re-rendered.

## Non-goals

- Grids (exhibitions, artist featured works, prints page), the 3D room's artwork pop-up, cart, checkout, wizard and emails:
  framed view or plain image as today.
- The human-figure wall shot.
- Rendering automatically when an artist saves.
- A lightbox or zoom for the photos.

## Anti-goals (a failure even if it works)

- Anything that reads as CG: hard shadow edges, halos round blurred edges, visible repetition, a perfectly flat sheet.
- A colour cast or exposure shift on the artwork (neutral white light only; nothing raises exposure).
- A photo showing an outdated image or edition number.
- A heavier artwork page: the photos load only when asked for (thumbnails small, large on selection).

## The look (APPROVED, locked)

The approved renderer is the spike `src/components/printPresentation/photoViews/renderPhotoView.ts`. Its values are the
spec. Don't retune them; move them as they are.

- **Method: many passes averaged** (plain three.js, 256 passes, about 0.5 s per view on the owner's M4). Each pass moves:
  - the lens across its aperture (thin lens, focused on the target: real depth of field);
  - the key light across a 0.9 m softbox (a SpotLight with a 4096 shadow map: real soft shadows);
  - the room light to a new direction on a cosine-weighted dome (a DirectionalLight with a 2048 shadow map: real ambient
    occlusion under the lifted paper);
  - the pixel grid by a sub-pixel (antialiasing).

  Accumulation: float ping-pong running average, then sRGB output with 1.4/255 dither/noise and a 5% lens fall-off.
  No tone mapping. `EXPOSURE` 0.985: an unshadowed white surface lands just under white.
- **Paper**: `#fbfaf6`, 0.4 mm thick, roughness 0.92. Grain: a normal map from tileable noise (height in alpha, 3 cm tile,
  normalScale 0.35), which also modulates albedo ±2.5%. How it lies (seeded): edges lift 0.3–0.9 mm, corners 0.5–1.8 mm
  (the shot corner at least 1.6 mm, for its small shadow), a faint cockle.
- **Table**: `#ececea`, roughness 0.9, faint grain.
- **Pencil**: the framed render's metrics (Caveat, `EDITION_NUMBER_*`, size ×0.75), as a mask in the paper's own shader.
  Albedo `#9a9b9d` (lit like the paper), with broken strokes from the paper's tooth. The number: see "The pencilled
  number" below. It's the same in the framed view and the photos.
- **Light** (seeded per work, so a work's three photos share it): softbox to one side and behind
  (azimuth ±1.6–2.4 rad, elevation 0.85–1.1, 1.7–2.3 m away), taking 50–62% of the light; the dome takes the rest.
- **Shots** (3:2, full-frame sensor):
  - **sheet**: one of `SHEET_SHOTS` (90 mm lens), picked by the work's seed. Offsets are from the image's bottom-left
    corner:
    - **0, approved:** 2.5 cm right, 1 cm in; azimuth −0.42, elevation 0.62, 0.76 m, f/8.
    - **1, higher:** 3 cm, 2.5 cm; −0.6, 0.88, 0.8 m, f/8.
    - **2, lower:** 3.5 cm, 0.5 cm; −0.22, 0.5, 0.72 m, f/7.1.
    - **3, from the left:** 1 cm, 3 cm; −0.95, 0.66, 0.78 m, f/8.

    Then a seeded nudge: aim ±6 mm, azimuth ±0.04, elevation ±0.025, distance ±3 cm, camera roll ±0.02 rad.
    A sheet **without** a number may instead be shot at its bottom-right corner, mirrored (50%), for more variety.
    The guaranteed corner lift (≥ 1.6 mm, for the small shadow) goes on **the corner being shot**. The spike always
    put it on the bottom-left one. *(My call; builder check 2026-11-20.)*
    Versions 1–3 and the mirror were rendered for review on 2026-11-20 and accepted ("it's ok if the other
    screenshots get a randomly different angle"). Angles come from the work's seed, so a re-render (after a sale)
    changes only the number.
  - **close**: aim at the most detailed of 28 seeded points in the image's middle (u 0.22–0.78, v 0.25–0.7), scored on a
    96 px gradient map. Azimuth ±0.35, elevation 0.5–0.72, 0.4–0.5 m, 100 mm at f/3.5–5.6.
  - **edge**: the same scoring near the top (v 0.72–0.86). Azimuth ±(0.2–0.5), elevation 0.6–0.82, 0.48–0.6 m,
    75–90 mm at f/4–6.3.

## Sizing (the sheet in centimetres)

- **Limited edition with its mandatory print size** (`LimitedVariant` with `order: 0`):
  - fixed sheet: `computeSheetLayout` (sheet, minimum border, ratio) → image size and margins per axis;
  - otherwise the variant's `widthCm × heightCm` with `borderCm` on every side.
- **Everything else** (open editions, works not for sale, limited without a mandatory size): image 50 cm on its long
  side, clamped to the file's printable range (`getPrintLongEdgeBounds`), with a 5 cm margin all round. *(My call. It
  matches the approved renders. Note that the framed view's margins are wider, 9 cm and 10.5 cm.)*
- **Pencilled number**: only when the work's presentation is `limited`, and only if the bottom margin is at least 1.6 cm
  (otherwise there's no room under the image).

## The pencilled number (framed view and photos)

- **What:** `{next}/{N}`, where `next` is the lowest `EditionNumber.number` whose state is not `sold` (built: a reserved copy still counts as unsold, as the page's "Edition N of M" does) for the mandatory
  variant (`order: 0`), and N its edition size. It's read when the render runs. It replaces the seeded "copy within the
  first 20%" (`makeLook(...).copy`, `COPY_NUMBERS`) for the framed view too.
- **Sold out** (no available copy): no change and no warning. If a sold-out work must be rendered anyway (new image,
  new frame), it pencils `N/N`. *(My call.)*
- **Mandatory size not published yet** (no `EditionNumber` rows exist before publishing): pencils `1/N`. *(My call.)*
- **"A number is pencilled"** (a photo fingerprint input) means only: presentation `limited` and bottom margin
  ≥ 1.6 cm. It never depends on availability, so the last sale can't change a fingerprint.
- **The record stores the number it pencilled** (`copy`).
- **A sale never hides a render.** The framed fingerprint and the views fingerprint do **not** include the copy number
  (and the framed one stays frozen, see "Prod safety"):
  a sale doesn't make the page fall back to the plain image or drop the photos. The page keeps the previous render, one
  copy behind, until the owner re-renders.
- **Stale number:** `record.copy` is below the current `next`. It's an admin signal only:
  - the render page marks the row "Number sold" (or similar) and the black button includes it;
  - the **admin dashboard homepage** shows "You have X artworks that need to be re-rendered", linking to the render
    page. X counts every work that needs a render (out of date, missing photos, or a stale number); the dashboard
    shows nothing about presentations today (builder check).
- **The printed copy:** the lab numbers "next free" too, so as long as orders go to the lab in the order they were
  paid, the buyer gets the copy shown (or the next one, if two buyers pay within the same render window).

## Approaches considered

1. **Many passes averaged in the admin's browser (picked).** It uses the existing Render button and three.js. Depth of
   field and soft shadows come out physically right, with no halos. About 2 s more per work. No new packages.
2. **One pass plus a blur filter** (`@react-three/postprocessing`). Seconds per view, but the blur is faked from a depth
   map: halos round the paper's edge, the classic CG tell.
3. **Path tracer** (a new package, needs the owner's OK) or Blender. Minutes per view in a browser, a new dependency, and
   Blender can't run behind a prod admin button. For white paper on a white table, option 1 already looks right.

## How it's built

### Data: no migration

`Artwork.printPresentation` (JSON) gains an optional `views` part, saved by the same render:

```ts
views?: {
  fingerprint: string            // photoViewsFingerprint(...), see below
  urls: Record<'sheet' | 'close' | 'edge', { large: string; small: string }>
  renderedAt: string
}
```

`isPrintPresentationRecord` accepts records without `views` (every existing render) and validates `views` when present.

**`photoViewsFingerprint`** changes whenever a photo would look different:
- `PHOTO_LOOK_VERSION`
- the work's seed
- the sheet in cm (image size and the four margins)
- whether a number is pencilled and N (not the copy number: see above)
- **the web image URL**: the artwork is in these renders, so a re-uploaded image must re-render them

The framed fingerprint is unchanged, so existing framed renders stay current.

`currentInputs` / `presentationInputs` also yield the photo inputs (sheet, next copy, image URL, views fingerprint).
That needs `imageUrl`, the mandatory variant's sizes and its lowest unsold copy in `loadPresentationSources` (one
query, as today). The framed fingerprint is **not** changed (see "Prod safety"). Limited works need one re-render to
get the real number, and keep their current render until then.

### Rendering (admin's browser)

- The spike renderer moves to production code as is, minus the spike scaffolding. Suggested home:
  `src/components/printPresentation/photoViews/`. `PhotoRenderer` takes an already-loaded image.
- **`RenderQueue`**: per work, the framed studio shot as today, then the three photos from **one `PhotoRenderer`
  instance for the whole batch**: one long-lived WebGL context, not a new one per work, which matters given the
  batch-render context losses seen on prod. The image is loaded with `crossOrigin="anonymous"`; prod R2 CORS already
  serves the 3D rooms' textures.
- **Files per photo**: large 2400×1600 and small 600×400, WebP (q 0.9). A check refuses a blank or broken shot: not
  near-uniform, and neither all-black nor all-white. A failed photo fails the work, which stays as it was.
- **Storage**: `createPresentationUploads` returns the 2 framed + 6 photo upload URLs. The PUT verifies all 8 files exist,
  then saves framed + `views` in one record. Same R2 folder:
  `{env}/presentations/{id}/{viewsFp}-{view}-{2400|600}.webp`.
  - Replacing a render deletes the previous files, photos included.
  - `deletePresentationFiles`, `reconcile-r2` and artwork DELETE learn the new names.
- **Status**: a row is *Out of date* if either fingerprint no longer matches (e.g. the artist replaced the image),
  also *Out of date* when it has no `views` (built: one status for both), and flagged when its pencilled copy has sold. The black button and per-row
  Re-render render all four. The table preview stays the framed one only.
- **Admin work follows `CLAUDE.md`**: read `docs/admin-redesign/README.md`, then `components.md`, `pages.md` and
  `questions.md`, before touching `/admin`. The dashboard warning uses the redesign's own alert or notice pattern.

### Artwork page

- **Data**: `getPrintPresentations` returns the photos only when `views.fingerprint` matches the current inputs.
  Otherwise there are no photos, and the page shows the framed view alone, as today. The live read is the same as for
  the framed view.
- **Box**: the grey box (`.imageArea`) shows the selected image. The framed view is first and selected, with today's
  crop and fit. A photo fills the box: `object-fit: cover`, centred, wall background unchanged.
- **What shows (owner, 2026-11-20)**:

  | Stored for the work | The grey box | Thumbnails |
  |---|---|---|
  | framed render + the 3 photos (current) | the framed view, selected; a thumbnail swaps it | 4 |
  | framed render only (photos not rendered yet, or out of date) | the framed render | none |
  | nothing (or the framed render out of date) | the raw image, as today | none |

- **The four views go in a 2 × 2 grid below the Inquire button** (owner, 2026-11-20: "add the 4 views in two rows,
  1 + 1, 1 + 1, below the Inquire button"), in the info column, before Share. This replaces the earlier "under the
  description". The grid:
  - shows the framed view first (top left), then sheet, close, edge; each tile is half the column wide (minus the
    gap), square, cover-cropped;
  - each tile is a `Button` (per the project's rule) with `aria-pressed`; selecting one shows it large in the grey
    box. The selected tile has a 1 px dark outline;
  - square corners (visitor-facing rule);
  - appears whether or not the work is for sale: below `ArtworkAvailabilityCard`'s Inquire, or below
    `ArtworkPrintFacts`' Inquire;
  - is for tablets and desktop. Tablets keep this layout too ("mobile" from the owner means phones only, see
    `useIsPhone`).
- **Phones (owner, 2026-11-20)**: "render the four thumbnails in one row below the main photo, and allow the main
  photo to slide with the finger as in a carousel".
  - Four thumbnails in **one row directly under the grey box**, not in the info column (no 2 × 2 grid on phones).
  - The grey box is a **horizontal swipe carousel** of the four views: a native `scroll-snap` track (one slide per
    view, `scroll-snap-type: x mandatory`), no gesture library. Swiping updates the selected thumbnail; tapping a
    thumbnail scrolls to its slide.
  - Only when all four views exist; otherwise the single image, no row, no swipe (the three cases above).
  - The phone breakpoint is the project's existing one for phones (the builder picks the matching SCSS mixin).

  The large photo loads on selection. The small ones load lazily after the page.
- **Alt text**: "{title}, the print: framed", "… unframed, its corner", "… a detail", "… a detail at its top edge".
- Grids, the 3D room pop-up and admin lists are unchanged. The 3D room pop-up (`ArtworkModal`) shares
  `ArtworkDetailBody`, so it opts out of the photos explicitly.
- `docs/public-redesign/artwork.md` (11-11) says "only the framed print render, no thumbnails". The owner's 2026-11-20
  decisions here supersede it. The design Claude updates that file; the code side only logs it in questions.

### Tests (no WebGL in e2e)

- Unit: `photoViewsFingerprint` (each input changes it; the image URL in it), sheet sizing (fixed sheet, adaptive
  border, open clamp, the number rule), the record guard with and without `views`.
- E2E: an artwork with a fixture record (photos as plain stored images) → four thumbnails; selecting one swaps the box.
  Outdated `views` → no thumbnails. Update the admin and API specs for 8 files.

### 🔒 Prod safety: the current framed renders are never lost (owner, 2026-11-20)

"Make sure that when deploying to prod, I won't lose the current framed renders." Every existing framed render keeps
showing after the deploy, unchanged, until the owner re-renders it.
- **The framed fingerprint is frozen.** `presentationFingerprint` keeps its exact inputs and output for every existing
  render. That means no `LOOK_VERSION` bump and `COPY_NUMBERS` stays in the hash where it is today. The real copy
  number is tracked outside it, as `record.copy`. A record without `copy` (every render today) counts as "needs
  re-render" in the admin, and **keeps showing** on the pages.
- **Old records stay valid.** `isPrintPresentationRecord` accepts records without `views` and without `copy`.
- **Files.** A new render's files are stored and the record saved before the previous files are deleted (as today).
  Each render gets its own file names (a render id in the key), because a re-render after a sale keeps the same
  fingerprint and the files are served with a long cache. `reconcile-r2`, `deletePresentationFiles` and artwork
  DELETE know every new name, so the cleanup script never treats them as orphans.
- **Proof before release.** A read-only census recomputes, with the new code, the framed fingerprint of every stored
  render (staging DB, then prod, same recipe as the prod schema census). 100% must match the stored one; nothing is
  written. Plus a unit test: a frozen sample of real inputs → the exact fingerprints they have today.

### Rollout

No database step for the photos. The same release carries the two gallery commissions (open / limited, added
2026-11-20), whose new column `SiteSettings.galleryCommissionLimitedPct` must reach prod BEFORE the deploy (a read of it
fails until then and prices fall back). Release, then the owner re-renders artist by artist on prod (about 2 s more per work, and limited works
once more for the real number). Until a work is re-rendered, its page shows the framed view alone, with its old number.

## Left to the builder

The thumbnail row's exact sizes and spacing, within the public site's tokens and the square-corners rule. The blank-shot
thresholds. The WebP quality, if 0.9 proves heavy (the target is a few hundred KB per large photo). Keyboard
details of the thumbnail row.
