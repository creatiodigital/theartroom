# Public site · Exhibitions page (`/exhibitions`)

Approved by the owner 2026-11-11. Designs: `designs/exhibitions-desktop.dc.html`, `designs/exhibitions-phone.dc.html`
(today's 4 exhibitions, real images and texts). Same header, footer, fonts and link style as the home and
Artists pages (`home.md`, `artists.md`). Goal: far less space per exhibition (today one exhibition takes
about a full screen).

- Title **Exhibitions** (EB Garamond 52 / 38 on phone), the existing line: *"Explore our curated exhibitions,
  both current and past."* The Exhibitions nav item is shown active in the wordmark red `#bd1622`.
- **Groups:** a **Current** heading (13 px small caps, letter-spacing .16em, followed by the count in grey,
  on a 1 px `#1a1a1a` rule), then the rows. A **Past** group with the same heading and rows appears below only
  when at least one exhibition has closed. Inside each group: newest first.
- **One compact row per exhibition** (no alternating left/right layout, no large images), separated by hairlines
  `#ececec`, 28 px vertical padding:
  - featured image **340 px wide, 3:2**, `object-fit: cover`;
  - the artist in small caps (12 px, `#777`), the title in EB Garamond 30, the description in Lato 15 / 1.6
    `#666` **clamped to 3 lines** (the full text stays on the exhibition's own page);
  - today's action row unchanged in content: **→ View exhibition | Cube Enter 3D room** (Phosphor light,
    arrow first, no underline, 15 px, `#333`, letter-spacing .03em, thin grey divider). Nothing on top of the image.
  - The image and title link to the exhibition page.
- **Phone:** each exhibition is stacked: the featured image **full bleed** (edge to edge, 3:2), then below it the
  artist (small caps), the title (EB Garamond 27), the description clamped to 2 lines, and the action row.
  44 px between exhibitions, no hairlines.
- **Tools appear only when they help** (hidden with today's 4), same rules and styles as the Artists page:
  - from **9 exhibitions**: search field *"Search by exhibition or artist"* (filters title and artist name);
  - from **13 exhibitions**: show 8 per group, then *"Showing 8 of N"* and an outline **Show more exhibitions**
    button (adds 8). No infinite scroll.
- UI only: data, links and the 3D room entry stay as today.
