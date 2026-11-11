# Exhibitions (`/admin/exhibitions`)

Approved by the owner 2026-11-11. Design: `designs/exhibitions.dc.html` (actions menu drawn open on the
first row; titles and artists are sample data). **UI only: no logic changes.** Every menu item keeps its
label logic, its conditions (shown / hidden / disabled), its handler and its confirm dialog. Nothing new.

- Header: eyebrow *Gallery*, title **Exhibitions**, sub *Exhibition pages, their 3D rooms and preview
  links.* The inner "Exhibition Management" heading goes away. Count above the table ("6 exhibitions").
- Columns (same information as today, regrouped):

| Column | Shows | Same as today's |
| --- | --- | --- |
| Exhibition | title (600, links to the public page as today) + "artist · space" (12 px secondary) | Exhibition, Artist, Space |
| Status | badge with the status value capitalized: current → **Current** (green), past → **Past** (grey), draft → **Draft** (outlined), any other value → capitalized in info blue | Status |
| On the site | dot + **Published** (green dot, black) / **Unpublished** (grey dot, secondary). Under it: the existing "3D room ready, not switched on" warning (amber 600, Cube icon) in exactly today's condition; otherwise, when the 3D space is published, "3D room on" (12 px secondary) | Visibility (+ ready marker) |
| Preview link | **Active** (info badge) / "—" in exactly today's condition | Preview |
| Changes | **Needs review** (amber: `--color-yellow-30`/`--color-yellow-70`) / **Up to date** (green), shown in exactly today's condition, otherwise "—" | Review (colour fix only: needs review was green) |
| (actions) | 36 px ⋮ button, `aria-label="Actions for {title}"`, `aria-haspopup="menu"` | Actions |

- **Actions menu**: 264 px, white, radius 8, soft shadow, opens under the button (flips up near the
  bottom, Q6). Items are 36 px tall, 14 px. Grouped with 11 px caps labels and dividers:
  - **Exhibition**: Publish / Update exhibition (when it updates, a 12 px hint under the label:
    "Publish the pending changes"), Unpublish exhibition, Mark current / Mark past.
  - **3D room**: Publish / Unpublish 3D space (disabled exactly as today; add a 12 px hint under it
    when disabled: "Publish the exhibition first"), Open 3D editor.
  - **Preview**: Publish / Unpublish preview or Enable / Disable bake preview link, Copy preview link,
    Update preview link, View baked room (each only in today's conditions).
  - Last, after a divider: **Delete exhibition…** in red, with today's confirm.
  Disabled items: `aria-disabled`, text #999999, no hover.
  Keyboard: arrow keys move, Escape closes and returns focus to the ⋮ button.
- Use sentence case for every label ("Mark current", not "Mark Current").
- Phone: each exhibition becomes a card (title, artist · space, the four badges in a wrap row, ⋮ at
  the top right).
