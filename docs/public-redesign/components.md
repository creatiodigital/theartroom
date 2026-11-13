# Public site · shared pieces (step 22, before any page)

Build these once and reuse them. Names are suggestions; match the repo's conventions. Values come from the specs and
designs; when they disagree, the spec wins, then ask.

**Tokens** (add to the existing SCSS variables, don't duplicate): brand red `#bd1622` (wordmark, small labels only);
text `#1a1a1a` / body `#444` / secondary `#555`–`#888`; hairline `#ececec`; **render wall grey `#f2f2f2`** (behind
every print render and the home prints section); **off-white `#f8f8f6`** (bands, panels, summary boxes); field
background `#f5f5f3`. Fonts: EB Garamond (headings, titles in italics), Lato (text, 300/400/700). Body 16–17 px,
line height 1.7–1.75. Phosphor **light** for UI icons.

- **Links, no underline, ever** (global): plain links inherit colour; no `text-decoration` on any public link.
- **`ArrowLink`**: Phosphor `ArrowRight` (or `Cube` for "Enter 3D room") **first**, then the label; Lato 15 px,
  letter-spacing .03em, `#333`. Variant with a thin vertical divider between two links ("→ View exhibition | ⬡ Enter
  3D room").
- **`OrderPrintButton`**: exactly as README "Order print": outlined 38 px, Lato 12 px caps .12em, ShoppingBagOpen 16 px,
  **ORDER PRINT**; right of the caption on desktop, full width under it on phone; not rendered when the work has no
  print. Used on the exhibition, artist, Prints and artwork pages.
- **`SectionHeading`**: centered serif caps between two hairlines with a grey count under it ("10 works") — series,
  Works, Exhibitions on the artist page. And the left-aligned variant: serif title + optional ArrowLink on the right
  ("Current exhibitions · All exhibitions →").
- **`TextSection`**: two columns, a small grey caps label (360 px) on the left, readable text (max 760 px) on the
  right; one column on phone, label first. Used by the exhibition page (About the exhibition), artist page (About
  the artist), About, Contact.
- **`Band`**: full-width `#f8f8f6` section with serif heading, a line, and actions (feedback band, "Walk through the
  exhibition", "See the work for yourself", "Many more works are available as prints").
- **`ArtworkCard`**: framed render on `#f2f2f2` (1:1, contain), caption = title (serif italics) + year (+ artist and
  edition type on Prints), `OrderPrintButton`. 3 columns desktop, 2 on phone.
- **`ExhibitionRow`**: 340 px 3:2 image, artist small caps (omitted on the artist page), serif title 30, description
  clamped to 3 lines, the two ArrowLinks. Phone: image at content width, then text (2-line clamp).
- **`ListTools`** (Artists, Exhibitions): search field (50 px, `#f5f5f3`, MagnifyingGlass, clear ×) shown only above a
  threshold; "Showing N of M" + outlined **Show more** button above another; no infinite scroll.
- **Header**: unchanged layout; the current section's nav item in brand red.
- **Footer**: `home.md` §8 + README "Footer network icons" (brand icons, not Phosphor).
- **Checkout pieces** (step 34–36): numbered accordion step (circle number, title, grey summary when closed), option
  cards with photo, option list with inline descriptions, colour swatches, `StepIndicator` (Shipping → Review →
  Payment), summary panel `#f8f8f6`.
