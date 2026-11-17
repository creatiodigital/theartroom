# Public site · sizes in cm or inches

Owner 2026-11-17: "Our site only shows dimensions in cm. Everywhere. Some people will want inches… a switch… saved in
local storage… default cm… **do not set this by IP or country: the user will decide.**" Design: canvas board
"Visitors · sizes in cm or inches" (`UnitsSwitch.dc.html`), copy in `designs/units-switch.dc.html`. Square-corners rule
applies (visitor UI).

## The rule
- One preference for the whole public site: **`cm` (default) or `in`**, chosen only by the visitor. Never inferred
  from IP, country, locale or browser language.
- Saved in `localStorage` (key e.g. `tar.units`, in try/catch; if storage fails, cm). Read on load, so every page
  shows the chosen unit; changing it updates the current page at once (a small context/store, no reload).
- Server-rendered pages render cm first and switch after hydration if the saved choice is inches (avoid layout jump:
  the size text keeps its place).

## Inches are for visitors only (owner 2026-11-17)
"Inches will be only final user side." Everything editors use stays **cm only, with no switch**: the 3D wall view
edit mode (its many dimensions), the 2D wall editor, the studio, the artist dashboard, the admin. The visitor's
saved choice never changes what an editor sees, even in the same browser.

## The switch: one, in the footer (owner 2026-11-17, replaces every earlier placement)
"As this is a very minor feature, let's try the footer… Do not use a dropdown, as we only have 2 options." (The header
and the soft-track switch were tried and dropped the same day.)
- **Plain text, no dropdown, no track:** **`Sizes in cm | in`**. The chosen unit is **bold** `#2b2b2b`, the other is
  the row's grey; the `|` is a light grey divider (`#c8c8c4`), not clickable. Hover/focus on the other unit: brand red
  + underline, like the footer links.
- **Where: a line of its own** (owner 2026-11-17: "do not mix footer links with this, add a new line just for this").
  A new footer row **after the legal links and before the ©**, with a **divider above and below** (the same hairlines as
  every other part of the footer), on the left. Only *Sizes in cm | in* on that line, 14 px, the legal row's grey
  (`--color-text-secondary`), the chosen unit bold. Same on phones.
- **The print wizard keeps its own switch** (owner 2026-11-17, "on the configurator, we will keep the original
  switch"): the wizard has no footer, so the soft `cm | in` switch stays in the **top-right corner of the drawing**
  (track `#efefec`, 2 px padding, cells 30 × 22 px, 12 px, square corners; chosen cell white with a 1 px `#d6d6d2`
  outline and bold text). Not in the sidebar. Both switches change the same saved choice.
- **Nowhere else:** no switch in the header or after the artwork's size.
- **Accessibility:** `role="radiogroup"` aria-label "Units", each unit `role="radio"` with `aria-checked`, arrow keys
  move, Enter/Space choose.
- Board: "Visitors · sizes in cm or inches" (`UnitsSwitch.dc.html`), copy in `designs/units-switch.dc.html`.

## The configurator's inputs (open editions)
The Size step has typed fields and sliders (screenshot from the owner, 2026-11-17: *HEIGHT (CM) 30.0 × WIDTH (CM)
20.0*, a long-edge slider *30.0 × 20.0 cm … 150.0 × 100.0 cm*, *PAPER BORDER 3 cm* slider). In inches mode:
- **Labels:** *HEIGHT (IN)*, *WIDTH (IN)*; the help line unchanged.
- **Fields show inches** with one decimal (30.0 × 20.0 cm → *11.8 × 7.9*). What the buyer **types is read in
  inches** (`parseLengthInput`) and converted to cm internally; the aspect lock works the same (change one, the other
  follows), in cm underneath.
- **Long-edge slider:** same track and steps underneath in cm; its end labels and live value in inches
  (*11.8 × 7.9 in … 59.1 × 39.4 in*).
- **Paper border slider:** value in inches (*3 cm → 1.2 in*); same steps underneath.
- **Clamping and validation** (min/max size, file resolution) stay in cm; error texts show the limits in the chosen
  unit (*"The largest print for this file is 59.1 × 39.4 in."*).
- Switching units while typing keeps the size: the field re-renders the same size in the other unit (no rounding
  drift: always convert from the stored cm, never from the shown inches).
- Anything sent to the cart, the server or the print lab is still the cm value, exactly as today.

## What converts
Every size the visitor sees: artwork sizes, size ranges ("11.8 × 7.9 in to 65.3 × 43.5 in"), the configurator's
drawing and summary, frame/passepartout/border widths shown in the configurator, cart and checkout item lines,
the order confirmation page, the 3D room's artwork details, exhibition and prints pages where a size appears.
- **Inches with one decimal** (`cm / 2.54`, rounded to 0.1). Keep the "×" sign and the unit once at the end:
  `8.7 × 13.1 in`.
- **Not converted:** edition **names** written by artists (e.g. "S1 22 x 33") are names, shown as entered.
  Prices, weights and anything not a dimension are unchanged.
- **Emails, invoices, PDFs** (no browser setting): show both, cm first: `30 × 20 cm (11.8 × 7.9 in)`.
- **Storage and orders stay in cm**: only the display changes. Nothing sent to the server or to the print lab changes.

## Artwork page: the print, its sizes and its price together (owner 2026-11-17)
Owner: "better organize the info… open edition close to the dimensions… explaining the prints can go from this to
that… the same for limited edition, explaining we have 1, 2, 3… available… I don't want to make users guess… do not
be too verbose either." Board: "Visitors · artwork page: the print, its sizes and its price" (`ArtworkSizesLabel.dc.html`),
copy in `designs/artwork-sizes-label.dc.html`.
The info column becomes two parts. **The work:** artist, title, year (the size lines no longer sit under the year).
A hairline. **The print:** what kind, its sizes, the price, Order a print, Inquire, the caveat.
- **Kind:** *OPEN EDITION PRINT* / *LIMITED EDITION PRINT*: 12 px, letter-spaced uppercase, bold `#3a3a3a`. This
  replaces today's "Open edition" / "Limited edition · S1 · Edition of 30" lines under the price.
- **Open edition:** two rows, *Smallest* / *Largest* (`#8a8a8a`) + the size (`#2b2b2b`), then *or any size in
  between.* (14 px grey). Price **From €303** ("From" small, grey) + Available; under it *Size, paper and frame are
  chosen next.* (13 px).
- **Limited, 2+ variants:** *Available in two sizes:* (three, four…), then one row per variant, smallest first,
  hairlines between: the size (16 px) over *Medium · Edition of 30 · 28 left* (13 px grey), the price on the right
  (serif 24 px). Available under the rows. Visitors never see the word "variant": each is "a size". If two variants
  share a size (different paper), the count says *versions* instead of *sizes* and the row shows the paper.
- **Limited, one variant:** no count sentence: the size, *Edition of 30 · 28 left*, then the price + Available.
- Sizes in the visitor's unit. Same block in the 3D room's artwork details. Sold-out rows stay listed, saying
  *Sold out* instead of the price.

## Variant names: words, not sizes (owner 2026-11-17)
"We will need to better name the variants. Something like medium, big, etc., not 22 x 33." A size written inside a
name can't follow the cm | in switch, and the real size is already shown next to the name. So:
- In the variant editor, the **Name** field suggests words: placeholder *e.g. Small, Medium, Large*, help line
  *"The size is shown next to the name, in the visitor's unit. Don't write it in the name."*
- If a name looks like a size (digits with x/×, or cm/in), show that help line in the warning colour. It's a hint,
  not a block: the artist can still save.
- Existing names (e.g. *S1 22 x 33*) aren't changed automatically; the owner or artist renames them.

## Build notes
- One helper `formatSize(cm, unit)` / `formatDimensions(w, h, unit)` used everywhere a size is shown today (search
  for `cm` in the public components); replace hand-built strings. Unit tests for rounding and ranges.
- A `UnitsProvider` (context) reading/writing localStorage; `useUnits()` returns `{ unit, setUnit }`.
- E2E: footer switch → in: artwork page, wizard, cart and checkout show inches; reload keeps it; footer → cm.

## Later: unique works (owner 2026-11-17)
Next year, when The Art Room sells unique works (paintings etc.), the artwork's fixed **height and width** fields come
back (hidden today). Today an artwork's size is a free-text `Artwork.dimensions String?`, which the switch can only show
as typed. When those fields return, store them as **numbers in cm** (height, width, and optional depth for objects),
so the same formatter converts them like every other size. Until then, free-text dimensions are shown as entered.
Each artwork will then say what it is: **a unique artwork** (one physical piece, fixed size, sold once) or **a print**
(today's editions and the print flow). Only unique works need the fixed height/width; prints keep their sizes per
edition/option.
