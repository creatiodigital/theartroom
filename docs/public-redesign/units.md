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

## The switch (one style everywhere)
A soft **cm | in** switch (owner 2026-11-17: a grey word was "barely noticeable", a black-outlined switch "too
invasive"): a light track `#efefec` with 2 px padding, two cells 30 × 22 px, 12 px Lato, square corners. The chosen
cell is white with a 1 px `#d6d6d2` outline and bold `#1a1a1a` text; the other is `#888` on the track.
`role="radiogroup"` aria-label "Units", each cell `role="radio"` (arrow keys move, Enter/Space choose).

## Where it is
1. **Artwork page** (and the same info column in the 3D room's artwork details): 12 px after the size line,
   vertically centred: `22.2 × 33.3 cm [cm|in]`.
2. **Print configurator** (no footer there): top-right corner of the drawing area, 20 px in. It changes the
   drawing's labels, the edition cards' print size, the summary (sheet size, print size, paper border) and any size
   options/ranges.
3. **Footer, every page:** right end of the legal row, *Sizes in* + the switch.
- **Cart, checkout, payment, confirmation:** no switch of their own; they follow the saved choice.

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

## Build notes
- One helper `formatSize(cm, unit)` / `formatDimensions(w, h, unit)` used everywhere a size is shown today (search
  for `cm` in the public components); replace hand-built strings. Unit tests for rounding and ranges.
- A `UnitsProvider` (context) reading/writing localStorage; `useUnits()` returns `{ unit, setUnit }`.
- E2E: switch on the artwork page → the configurator, cart and checkout show inches; reload keeps it; footer switch
  back to cm.
