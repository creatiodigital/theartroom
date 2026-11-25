# Public site · Artwork page (`/artworks/{slug}`)

Approved by the owner 2026-11-11. Designs: `designs/artwork-desktop.dc.html`, `designs/artwork-phone.dc.html`
(drawn with Magnolia I). The point of this page is to **look closely at the work**: the image dominates, the
information stays small. **No underlines.** Order and Inquire behave exactly as today.

- **Agnostic of exhibitions.** An artwork can be in several exhibitions, and exhibitions change, so the page never
  names or links an exhibition: no back link, no "from the exhibition". The page looks and behaves the same with or
  without `?exhibition=…` in the address (keep the parameter only if something else needs it).
- **Image:** only the framed print render (as today), no thumbnails, no captions or notes under it. Background
  `#f2f2f2`, `object-fit: contain`. Desktop: the left column takes all the width the info column leaves, 760 px tall
  (cap it to the viewport height minus the header on short screens). Phone: full content width, square.
- **Info column (desktop 320 px, 56 px gap, sticky while scrolling):**
  - the artist in small caps (`#555`, links to the artist page), the title in EB Garamond 36, then the year and the
    size **each on its own line** (14 px `#888`);
  - today's technical lines (camera, lens, ISO…) **one per line**, as entered, 13 px `#999`, 8 px below the size;
  - a hairline, then the price in EB Garamond 30 with **Available** on the right (7 px green dot `#3c8a4a`, 13 px
    `#2f6b3a`; sold out / reserved states keep today's logic in the same spot, grey);
  - one line *"Limited edition of 30 · S1 · 22 × 33 cm"* (open editions: *"Open edition · …"*);
  - **Order a print**: black, 48 px, white caps 13 px, letter-spacing .12em, the bag icon; **Inquire**: outlined,
    46 px; then *"Not reserved until you pay: another collector may take it first."* 12 px `#999`.
  - Phone: the same blocks stacked under the image; the panel keeps a light `#f8f8f6` background there, and the note
    also says *"Frame, paper and size are chosen in the next step."*
- **More by the artist:** hairline, small grey caps *"More by the artist"*, the artist's name in EB Garamond 32,
  **→ View artist** on the right; 4 other works (2 on phone) as framed renders with title, year and the shared
  **Order print** button (README). Left edge aligned with the image (same 40 px page padding, max 1440 px).
- The footer stays the site-wide footer.

## Portrait works
Same page and layout (design: `designs/artwork-portrait-desktop.dc.html`, `designs/artwork-portrait-phone.dc.html`,
drawn with *Eglise de Saint Rémi*, open edition with a size range). The presentation renders are square, so a
portrait frame is narrow inside its square:
- Desktop: the image area is as tall as the window allows (viewport height minus header minus 64 px, min 640, max
  900; 860 on the board), the square render `contain`ed and centered, so the frame gets as tall as possible.
- Phone: the image area is **4:5** instead of square, render `object-fit: cover`: this only crops empty grey at the
  left and right of a portrait render, and the frame gets bigger. Landscape works stay square on phone.
- Open editions with a size range show the range as the size line (*"30 × 20 cm to 165.8 × 110.5 cm"*) and
  *"Open edition · {range}"* under the price.

## Below the work (Q-P13, Design Claude 2026-11-12)
Today's extras all stay; none of them sits next to the main image except the optional arrows.
- **Previous / next** (only when `SHOW_NEIGHBOUR_ARROWS` is on and the visitor came from a set, as today): two
  round 40 px white buttons, Phosphor `CaretLeft` / `CaretRight` 18 px, subtle shadow, centred vertically on the left
  and right edges of the image area, 16 px inside. `aria-label` "Previous work" / "Next work". Hidden when the flag is off.
- **Share:** at the foot of the info column, under the "Not reserved…" note, 16 px gap: a small text button, Phosphor
  `ShareNetwork` 16 px + *Share*, 13 px `#555`, no underline; today's behaviour (native share sheet, copy link fallback).
- **About the work** (description, then technique): after the two columns, 72 px gap, a `TextSection` like the
  content pages (small grey caps label left, text right, max 680 px). Label *About the work* for the description;
  if there is a technique text, a second `TextSection` labelled *Technique* under it (40 px gap). Either is omitted
  when empty. Today's story text, unchanged.
- **Details** (supplementary media from the editor, Q116): only when the work has some. Hairline, label *Details*
  (same `TextSection` label style), then **today's gallery unchanged** (Q-P18: no new viewer).
- Order on the page: the two columns → About the work → Technique → Details → More by the artist → footer.
- The 3D room overlay shows the same sections (same components), as `Same page inside the 3D room` says.

## Same page inside the 3D room
The room's artwork overlay (`ArtworkModal`) shows **exactly this page**, built from the same components, with only a close × added (`other-screens.md`).

## Info column, refined (owner 2026-11-25: "make this layout a little better")
Board: `docs/objects/designs/artwork-info-column.dc.html` (canvas "Objects", "Visitor · Artwork info column").
One rule for image works and Objects, in the shared `ArtworkInfoColumn`:
1. **Who and what** (no divider above): artist (caps, `--public-secondary`), title (h1), year, **size**, each on its own line, 14 px
   `--color-text-secondary`. Same fonts, colours and Inquire button as the live page: the board only moves things. The size moves **up**, right under the year, as this file always said ("the year and
   the size each on its own line"). Objects: `29 × 39 × 14 cm · 15 kg`. Pass it as a new `size` prop; image works
   use their size the same way. Bottom padding 24 px.
2. **How it is made**, under a divider: technique / materials lines (13 px, as today), then for Objects the edition
   line ("Edition 3 of 8 + 2 AP"). 20 px above and below. If empty, this block and its divider go.
3. **Actions**, under a divider: Inquire (outlined, as built). 24 px above. Nothing else changes here (whatever the
   column shows under Inquire today stays as it is).
- **Title, its line height and the year: one scale** (owner 2026-11-25: "a little ugly… the relation between the size
  of the title, the line height of the title, the size of the year"). Today: title 36 px / 1.1 (3.6 px of air between
  two lines, so descenders like the *p* of *puertas* nearly touch the line below), the year 14 px only 4 px under it:
  2.6× smaller and glued on. New, in `.title` / `.fact` (ArtworkDetail.module.scss), same fonts and colours:
  | | Desktop | Phone |
  |---|---|---|
  | Title (EB Garamond) | **32 px**, line-height **1.2** (38 px lines), `text-wrap: balance` | **28 px**, 1.2 |
  | Space title → year | **10 px** | 8 px |
  | Year, size (Lato, `#666`) | **15 px**, line-height 1.5 | 14 px |
  | Artist caps → title | 8 px (unchanged look) | 6 px |
  Title to year ≈ 2.1× instead of 2.6×, a two-line title reads as one block (*La memoria / de las puertas*), and the
  year sits clearly under it without floating. Applies everywhere the column is used (image works, Objects, the 3D
  room overlay). This replaces "EB Garamond 36" in the info column bullet above.
- **Remove the `cm | in` switch from the column** (`UnitsSwitch` in `ObjectDetailBody`): `units.md` keeps it in the
  footer only ("no switch after the artwork's size"). The size still follows the visitor's saved choice.
- **3D stage zoom** (`ModelViewer`, `.light .zoom`): one joined control instead of two separate 40 px boxes: white,
  1 px `#d6d6d2` outline around the pair and between the cells, cells 36 × 36 px (44 px hit area), 16 px icons,
  square corners, top right 16 px in. Reset view unchanged.
- The image page's print block (when the work sells prints) sits in block 3 above Inquire, unchanged.

**Built: Info column, refined** (2026-11-25, branch `feat/AR-191-add-3d-artworks`).
- `ArtworkInfoColumn` has the three blocks: who and what (artist, title, year, the new `size` line; 24 px under),
  how it is made (the technique / materials, 20 px above and below a divider; gone when empty), the actions (a
  divider, 24 px, then the print block or Inquire, the views, Share). `ArtworkInquire` lost its own divider: the
  block's is above it.
- Title scale in tokens: the board's 32 / 15 px are `--text-2xl` / `--text-sm` (30 / 14 px, the same 2.1× between
  title and year), line-height `--leading-tight` (1.2), `text-wrap: balance`, `--space-3` (12 px, the board's 10)
  before the year; phones `--text-2xl-mobile` (28 px), 8 px, 14 px, exactly as drawn. "The Old Cedar in November"
  breaks into two balanced lines.
- Image works (owner's answer, 2026-11-25): **not for sale** (or purchases paused), the sizes are the size line under
  the year ("30.0 × 20.0 cm to 40.9 × 27.2 cm", or the edition sizes joined by " · ", `artworkSizesText`) and the old
  "Open edition print" facts block is gone (`ArtworkPrintFacts` removed). **For sale**, no size line: the print
  block says the sizes, unchanged, so they never show twice.
- No `cm | in` anywhere in the column (owner: footer only): the Object's switch and the print block's kind line
  switch are gone. Sizes still follow the saved choice; weight always kg.
- 3D zoom (`ModelViewer` `.light .zoom`): one joined pair, white, `--color-gray-55` outline and divider (#d0d0d0, the
  nearest token to #d6d6d2), cells `--space-10` (40 px: the nearest token to 36 that keeps the 44 px hit area in
  reach), 16 px in from the top right. Reset view unchanged.
