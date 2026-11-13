# Developer · API & database reference (`/admin/api-reference`)

Approved by the owner 2026-11-11. Design: `designs/api-reference.dc.html` (sample routes and models).
**UI only, plus one NEW menu link.** Keep `scanApiRoutes`, `parseSchema`, the auth gate, the filter logic
(`SearchFilter`, the three `useMemo` filters) and the "No results matching …" state.

Step 13 is closed with this page alone: there is no settings route; analytics and dev cleanup already
live on the dashboard (step 2).

- **NEW** menu link: a **Developer** group at the foot of the admin menu, above anything pinned to the
  bottom, with one item **API reference** (Phosphor `Code`), 13 px, shown only to admins and up
  (same check as the page). Delete the page's own back link (the shell replaces it).
- Header: eyebrow *Developer*, title **API & database reference**, sub *Auto-generated from route
  handlers and the Prisma schema.*
- Sticky toolbar under the header (page background, so it reads as part of the page): today's search as
  `ui/SearchField` "Search routes, models, fields…", and on the right the four counts as chips:
  **n endpoints**, **n resources**, **n models**, **n enums**. Endpoints, models and enums are anchor
  links to their sections; resources is plain text.
- **API endpoints**: one white panel per group (grid, min 520 px columns): header = group name (700) +
  "n routes"; rows = method badges (Geist Mono 11/500, radius 3: GET blue `--color-badge-info-*`, POST
  green, PUT/PATCH amber, DELETE red) in a 132 px column, then the path in Geist Mono 13 with
  `:params` in `#9a5b00` (today's `formatPath`).
- **Database models**: card grid (min 340 px): header = model name in mono + "n fields"; field rows in
  mono 12.5: name, PK (amber) / UQ (blue) tags, type right-aligned in `#2e6b8a`, default in grey,
  truncated with today's `title` tooltip.
- **Enums**: card grid (min 280 px): name in mono, values as grey mono chips.
- Use `--font-admin-mono` (Geist Mono) from step 3 for all code text.
