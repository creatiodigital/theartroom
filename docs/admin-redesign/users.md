# Users (`/admin/users`)

Design: `designs/users.dc.html` (actions menu drawn open on the second row; names and emails are sample
data). **UI only, except the NEW type filter.** Keep every handler, condition, confirm dialog (including
the "type CONFIRM" delete) and the Add user modal's fields and logic.

- Header: eyebrow *Gallery*, title **Users**, sub *Artists, admins and curators: invite, publish, feature,
  impersonate.*, primary **Add user** (plus icon), opening today's `AddArtistModal`, restyled with the
  admin dialog look (labels above fields, 44 px inputs, Cancel / **Create user**).
- Action feedback (today's `actionSuccess` / `actionError`) becomes a dismissible bar under the header:
  success green (`--color-green-30` / `--color-green-70`, check icon), error red (`--color-red-30` /
  `--color-red-70`), `role="status"` / `role="alert"`, with a 32 px × close button.
- Toolbar: **NEW Type** segmented control (All / Artists / Admins; Admins = admin + super admin; add a
  Curators option only if curators exist in the data), count on the right.
- Table columns: **Person** (36 px initials avatar on `--color-gray-20`, name 600, email 12 px secondary) ·
  **Type** (today's labels: Artist, Admin, Super Admin, …) · **Profile** (dot + Published green /
  Unpublished grey, as on Exhibitions) · **Featured** (amber badge "★ Featured" when featured, otherwise
  empty) · 36 px **⋮** button (`aria-label="Actions for {name}"`).
- **⋮ menu** (same component as Exhibitions), grouped:
  - **Account**: Send invite… (today's Invite, with its confirm), Impersonate / "Impersonating" (shown and
    disabled exactly as today; never for admins)
  - **Profile**: Publish / Unpublish, Set as featured / Remove featured
  - after a divider: **Delete user…** in red (super admin only, as today), today's confirm with CONFIRM
- Sentence case for every label. Phone: one card per user (avatar, name, email, type, badges, ⋮).
