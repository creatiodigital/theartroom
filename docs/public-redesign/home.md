# Public site · Home page

Approved by the owner 2026-11-11. **Separate branch, after the admin redesign is finished.** Designs:
`designs/home-desktop.dc.html`, `designs/home-phone.dc.html` (images are low-res captures; the real page
uses the full files).

## Principles (apply to every public page)

- **An art portal first, never a poster shop.** The work leads; prints are presented like a gallery's
  editions (one at a time, with the story of how they're made). No prices, cart buttons, grids of products
  or carousels of merchandise on the home page.
- **The 3D room is a quiet plus**, never the headline. Each exhibition has one front door: its exhibition
  page. The room is promoted there, not around it.
- **Links** (All exhibitions, All artists, Discover the prints, the email link, View exhibition, Enter 3D room) all
  use today's action style: Phosphor icon **first** (`ArrowRight`, or `Cube` for the room), Lato 15–16 px,
  slight letter spacing, `#333`, **no underline**.
- Lato for text, EB Garamond for headings, red only for the wordmark and small labels. Body text
  16–19 px in `#444`, generous space between sections.

## Order

1. **Hero carousel: unchanged** from today.
2. **Introduction**: `h2` **"Step inside the work."** (EB Garamond 52 / 36 on phone), then: *"The Art Room is an
   online gallery for contemporary art. Each exhibition is carefully curated, and can also be visited as a room you
   walk through, at your own pace."* Then three equal points
   with thin dividers: **Curated exhibitions** / **Walk the rooms** / **Signed prints**, one line each (see
   design).
3. **Current exhibitions**: 2 × 2 grid (one column on phone), 4:3 image, artist in small caps, title in
   EB Garamond 32, description clamped to 3 lines, today's action row, kept by the owner: **→ View exhibition | ⬡ Enter 3D room** (Phosphor
   `ArrowRight` / `Cube`, a thin divider between). Nothing on top of the image.
   Heading row with **All exhibitions →**.
4. **Announcements**: today's newest switched-on announcement (same rule as now), shown large: image 3:2
   left, then label (small caps, red, e.g. "Open call"), title, text. Its action is its own (for the
   submissions call: **Write to contact@theartroom.gallery →**, a `mailto:`). No "All stories", no "Read"
   unless there is something to open. Hidden when there is no announcement.
5. **Fine-art prints**: section background **`#f2f2f2`, the exact wall grey of the presentation renders**,
   with no inner panel. Left: the artwork's **existing print presentation render with the artwork
   composited**, exactly as on the artwork page. Right: small caps "Fine-art prints", `h2` **"Every print,
   approved and signed by the artist."**, the quality paragraph (lead with archival paper and museum labs to
   avoid repeating the heading), a divider, the current work's *title*, year and "{artist} · available as a
   signed print", then **Discover the prints →**. **Rotates**: one print per artist, about 6 s each, a soft
   cross-fade of the picture and its caption together; only prints that have a render; no dots, no arrows.
   Pause the rotation for `prefers-reduced-motion` (show one, chosen at random per visit).
   **Which artworks rotate is chosen in the admin**: Content › **Home page prints**, a sibling of Gallery
   selection with the **same exact logic** (sortable list, Add artworks picker, Remove), its own list,
   independent of the Prints page; the selection shows only in this homepage section, in the list's
   order. Artworks without a print presentation render are skipped on the homepage until rendered (the
   list shows them with a "No render yet" badge).
6. **Artists**: today's artists as 3:2 portraits (their photos are landscape) in a row of four (two per row on phone), name in EB Garamond only (no exhibition
   line: an artist may have several exhibitions, or none). Heading row with **All artists →**.
7. **We'd love to hear from you**: the feedback band already designed (`FeedbackStates` in the admin redesign
   canvas), background `#f8f8f6`.
8. **Footer** (site-wide), approved by the owner 2026-11-11 (no repeated page links): top border, two rows.
   **Top row**: left, the **wordmark logo**: the real SVG `src/icons/logo.svg` (red, never typed text), **exactly the header size: `width: var(--logo-width)` (160 px), also on phone**, one line
   *"An online gallery for contemporary art."* and the contact email as a link; right,
   the social links as **plain icons, no circles or borders** (22 px, `#333`, 22 px apart), using **today's brand icons** (filled Instagram, Facebook and Pinterest logos, thin envelope for email; see README "Footer network icons", which overrides earlier drafts), each with an `aria-label`. The email link has no underline.
   **Bottom row** under a hairline: the legal links inline (13 px, sentence case, grey) on the left,
   "© 2026 The Art Room" on the right. Phone: brand, icons, then legal links and © stacked.

Removed from the home page: the old "Announcements" two-column block above the exhibitions, and the
"Featured artists" thumbnail list (replaced by section 6).
