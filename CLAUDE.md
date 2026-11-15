# The Art Room

## Admin (`/admin`)

The admin panel is being redesigned. Before any work under `/admin` (`src/app/admin/**`,
`src/components/admin/**`), read **[docs/admin-redesign/README.md](docs/admin-redesign/README.md)**,
then `components.md`, `pages.md` and `questions.md` in the same folder. The files in
`docs/admin-redesign/designs/` are the visual spec.

`docs/admin-redesign/` belongs to the design Claude. From the code side, only write the "Built"
status and notes in `pages.md`, the real props in `components.md`, and open points in
`questions.md`.

## Planned features (specs by the design Claude)

Each has a README with the owner's decisions, the design files and a build order. Read it before starting.
- **Second language for the 3D space:** `docs/wall-languages/README.md` (designs in `docs/wall-languages/designs/`).
- **Lightbox** (presentation option for image artworks): `docs/lightbox/README.md`.
- **Admin › Gallery › Feedback list:** `docs/admin-redesign/feedback-list.md` (step F1 in `docs/admin-redesign/pages.md`).
- Visitor-facing rule: no rounded corners on public/room windows and buttons (`docs/public-redesign/README.md`,
  "Square corners for visitors"); admin and studio unchanged.
