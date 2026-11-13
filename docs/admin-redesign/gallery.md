# Gallery pages: Print presentations and Content

Approved by the owner 2026-11-11. **UI only, unless marked NEW.** Keep every handler, condition,
confirm dialog and saved value as today. Designs (sample data):
`designs/print-presentations.dc.html`, `designs/content.dc.html`, `designs/content-slideshow.dc.html`,
`designs/content-editor.dc.html`.

---

## 1 · Print presentations (`/admin/print-presentations`)

- Header: eyebrow *Gallery*, title **Print presentations**, sub *Every work shown as a photo of its print,
  in the frame picked for it.* Under it a closed `<details>` **How it works** holding the rest of today's
  explanation, unchanged.
- **Settings panel**:
  - The "shown on the site" switch as a row: 40×24 switch (`role="switch"`) + **Shown on the site** (600)
    and today's one-line text under it (both on/off texts as today). Divider under it.
  - **Artist** select (label above, 12 px 600 secondary), the four counts as chips (`<strong>n</strong> label`;
    Missing and Out of date get their status tint when > 0, others white with border), and
    **Render missing and out of date (n)** (dark) on the right. "Rendering needs Chrome." stays as today.
  - While rendering: a status row (`role="status"`, `--color-gray-15`, radius 8): *Rendering x of y…*,
    a 6 px progress bar, **Stop** ("Stopping after this work…" while stopping).
- **Table**: **Work** (104×104 preview tile, `#f0efec` background, with today's render image inside;
  "No render" when there is none; then title 600, artist and presentation type 12 px secondary) ·
  **Frame** (today's select, 40 px) · **Passepartout** (today's switch; same rules, e.g. off with "No
  frame") · **Status** badge: Missing `--color-red-30`/`--color-red-70`, Out of date
  `--color-yellow-30`/`--color-yellow-70`, Up to date `--color-green-30`/`--color-green-70`, Not eligible
  grey. A 12 px reason line under the badge only if the code already knows the reason (otherwise none) ·
  render button: dark **Render** (missing) / dark **Re-render** (out of date) / outline **Re-render**
  (up to date); none for not eligible. Not-eligible rows show "—" in Frame and Passepartout.

## 2 · Content (`/admin/content`)

- Header: eyebrow *Gallery*, title **Content**, sub *The pages and texts of the public site.*
- The table with a ⋮ menu (whose only item was Edit) becomes **three grouped panels** of link rows
  (whole row is the link, 56 px, icon tile 34 px, name 600, one 12 px line, "Edit ›" on the right):
  - **Home & curation**: Landing page (*Homepage slideshow*), Announcements (*The announcement on the
    homepage*), Gallery selection (*Works the gallery features*)
  - **Pages**: About us (*Title and text*), Prints (*Banner image, title and text*)
  - **Legal**: Terms and conditions, Online terms of sale, Privacy policy, Accessibility policy
    (one-line hints in the design; adjust if inaccurate). Routes unchanged.
- Sub-pages get `AdminBreadcrumb` **Content / {page}** (closes the Q4 Announcements back link: replace it
  with **Content / Announcements / {title}**).

### 2a · Sortable lists: Landing page slideshow, Gallery selection

Design: `content-slideshow.dc.html`. Same pattern for both.
- Header: title (**Homepage slideshow** / **Gallery selection**), one-line sub (*The slides at the top of
  the homepage, in this order. Drag to reorder.*), actions: **View homepage ↗** (outline, opens the
  public homepage in a new tab) + the primary (**Add slide** / **Add artworks**). Gallery selection keeps
  its "n works · n artists" summary (and the per-artist line) under the title.
- One panel, count at the top, rows: drag handle (DotsSixVertical bold, 32×44, `aria-label="Reorder
  {title}"`), position number, thumbnail (slideshow 160×96, gallery selection 72×72), title 600 + sub line,
  then actions: slideshow **Edit** (outline with pencil) + 36 px red trash button (`aria-label="Delete
  slide {title}"`, today's confirm); gallery selection **Remove** (outline).
- Keep the existing dnd-kit setup; make sure its keyboard sensor is on, and show the footnote
  *Keyboard: focus the handle, press Space, move with the arrow keys, Space again to drop.*

### 2b · Announcements

Same list pattern without drag: photo thumbnail 96×64, title 600, status badge (**On the homepage** green /
today's other statuses grey), **Edit** + trash button. Header: title **Announcements**, sub (one line):
*Only the newest switched-on announcement with a title and a photo shows on the homepage.*, primary
**New announcement**.

### 2c · Page editor: About us, Prints, and the four legal pages

Design: `content-editor.dc.html` (Prints shown). One layout for all six; content column max 880 px.
- Breadcrumb, h1 **{Page} page**, under it *Last saved {date, time}* if the page has an updated time
  (otherwise omit), **View page ↗** on the right.
- Panels (white, radius 8, padding 24), label 15 px 700 above the field, help text 12 px secondary
  **under** the field (replaces today's grey footer strips):
  - **Banner image** (only pages that have one, e.g. Prints): preview 320×180 + size/format line +
    **Replace** (upload icon) / **Remove** (red text) + *JPG, PNG or WebP, up to 1 MB.* Keep today's
    uploader logic and limits.
  - **Page title**: 44 px input.
  - **Content**: today's editor. Toolbar restyled: groups (text style · headings + paragraph · lists ·
    quote/code/divider/link · undo/redo) with 1 px dividers, 32 px buttons, pressed state
    `--color-gray-25`, every button has an `aria-label`; toolbar sticks to the top of the editor while
    scrolling. Editor text uses the public site's fonts (Lato body, EB Garamond headings) so it reads like
    the live page.
- **Save bar** fixed to the bottom of the viewport (inside the content column area, white, top border):
  **NEW** amber dot + *Unsaved changes* when the form is dirty (otherwise *All changes saved*, secondary),
  **NEW Discard** (outline, resets to the loaded values) and **Save changes** (dark; "Saving…" while busy).
  Keep today's save logic; warn before leaving with unsaved changes only if that exists today.
