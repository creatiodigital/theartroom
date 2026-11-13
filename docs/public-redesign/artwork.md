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
