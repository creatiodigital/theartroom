# Public site · Artists page (`/artists`)

Approved by the owner 2026-11-11. Designs: `designs/artists-desktop.dc.html`, `designs/artists-phone.dc.html`
(drawn as if there were 20 artists; real portraits and bios). Same header, footer, fonts and link style as
the home page (`home.md`).

- Title **Artists** (EB Garamond 52 / 38 on phone), one line: *"The artists we show, in current and past
  exhibitions."*
- **One compact row per artist** (no grid), separated by hairlines: 180 px portrait in **3:2** like the artists' own photos (132 px on phone), lightly cropped,
  name in EB Garamond 28, their exhibitions on one line in italics (all of them, joined by " · "; the line is
  omitted for an artist with none), the first sentences of their bio clamped to 2 lines, and
  **→ View artist** on the right (under the text on phone). The whole row links to the artist page.
  Order: alphabetical by last name.
- **Tools appear only when they help** (hidden with today's 4 artists):
  - From **9 artists**: **Search** above the list, left-aligned: a 50 px field, 420 px wide (full width on phone),
    background `#f5f5f3`, 1 px `#ececec` border (`#1a1a1a` on focus), MagnifyingGlass 19 px, placeholder
    *"Search by artist name"*, 16 px; a clear (×) button appears once there is text; filters by name
    as you type; empty state *"No artist matches “x”."*), and the count added to the intro line in grey
    (*"… past exhibitions. 20 artists."*). No tabs or other filters.
  - From **13 artists**: show the first 12, then *"Showing 12 of N artists"* and an outline **Show more
    artists** button that adds 12 more. No infinite scroll (keeps the footer reachable and the place when
    coming back).
- Optional later: a short "intro" field per artist to use instead of the bio's opening lines.
