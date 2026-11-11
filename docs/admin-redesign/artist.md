# Artist studio (`/dashboard/*`)

Approved by the owner 2026-11-11. **UI only.** Keep every handler, condition, validation, confirm
dialog, uploader limit and saved value as today. Where a design shows a placeholder ("today's …"),
use today's real text. Designs (sample data, artist "Jane Doe"):
`designs/artist-home.dc.html`, `artist-artworks.dc.html`, `artist-artwork-edit.dc.html`,
`artist-profile.dc.html`, `artist-payouts.dc.html`, `artist-exhibition-settings.dc.html`.

## 0 · Artist shell (replaces `DashboardLayout` for `/dashboard/*`, not login)

Reuse the admin shell pieces (`AdminLayout` structure, nav item, phone top bar + drawer, focus
handling) with an **artist variant**, not a copy:
- **Light menu**: white, 1 px right border `#eaeaea`; brand "The Art Room" (EB Garamond 24) with the
  label **Artist studio** (11 px caps, `--color-red-50`).
- Items: **Home** (`/dashboard`), **Artworks** (`/dashboard/artworks`), **Profile**
  (`/dashboard/profile`), **Payouts** (`/dashboard/payouts`). Phosphor light, fill when active; active
  row `#f2f0ec`, black, 600. Exhibition settings keeps **Home** active, and the artwork editor keeps
  **Artworks** active.
- Payouts shows an 8 px amber dot (`aria-label="Not set up"`) **only if** the shell already knows the
  payouts status cheaply. Otherwise leave it out (do not add a new request just for the dot).
- Bottom of the menu: avatar (photo or initials) + name, **View my public page ↗** (today's public
  artist URL), **Change password** (`/dashboard/change-password`), **Log out** (today's handler).
- **Impersonation** (replaces the red full-width "Viewing as … / Stop Impersonating" bar). Same
  condition and same Stop handler as today:
  - a card at the top of the menu, under the brand: background `#fbeeee`, border `#f0c9cc` with
    a 3 px `--color-red-50` left border, radius 8. It holds a 32 px red circle with a filled Eye icon,
    **VIEWING AS** (11 px caps) over the name (700), the line *You're signed in as an admin.
    Changes save to her account.* (use neutral wording such as "this account" if no pronoun is
    known), and a full-width outline **Stop impersonating** button in red text. Give it `role="status"`.
  - plus a 3 px `--color-red-50` line across the very top of the page (decorative,
    `aria-hidden`).
  - On phone the card sits at the top of the drawer, and the top bar shows a small red
    "Viewing as {name}" pill that opens the drawer.
- Content column: max 1080 px (lists) / 880 px (forms), padding 40.

## 1 · Home (`/dashboard`)

- `h1` **Hello, {first name}** in EB Garamond 40/400 (the only serif heading on these pages); sub
  *Your exhibitions, artworks and profile, all in one place.*
- Three shortcut cards (they replace today's "My Profile", "Payouts" and "My Artworks" sections),
  linking to their pages: Artworks / Profile / Payouts, each with a 36 px icon tile, one line of text
  and a "… →" call to action (see design). The Payouts tile is amber only under the same rule as
  the menu dot; otherwise neutral.
- **My exhibitions** panel: title + count, primary **New exhibition** (today's flow). Rows: 96×64
  featured image (fallback grey), name (link to settings) and under it the Published/Unpublished
  dot + **Up to date** (green) / **Pending changes** (amber) badge, an outline **Edit 3D space**
  button, and a ⋮ menu (same component as admin Exhibitions) with View exhibition ↗, Exhibition
  settings, Edit 3D space, a divider, then **Delete exhibition…** (red, today's confirm modal in the
  admin dialog look).

## 2 · Artwork library (`/dashboard/artworks`)

- Header: **Artwork library**, sub *Everything you can hang in your exhibitions. Drag to change
  the order.*, primary **Add artwork** (today's `AddArtworkModal`, admin dialog look).
- Toolbar: All / Image / Text / Sound / Video as a segmented control (today's filter), and
  `ui/SearchField` "Search by title or content".
- Rows: drag handle (keep today's sorting; keyboard sensor on, with the keyboard footnote as in
  Content), 64 px thumbnail (an icon on `#f2f0ec` for text, sound and video), title (link to edit),
  type + meta line (year, technique or duration, if already loaded), the green **Selling prints** badge
  where today shows "Currently Selling", outline **Edit**, and a 36 px red trash button
  (`aria-label="Delete {title}"`, today's confirm).

## 3 · Artwork editor (`/dashboard/artworks/[id]/edit`, `ArtworkEditForm`)

Same form, same fields, same conditions (which sections show for which type stays exactly as today).
Restyle only:
- Breadcrumb **Artworks / {title}**, `h1` the title, then type + Selling prints badge.
- Left **On this page** list (sticky, 190 px, hidden under 900 px): anchors to the sections that are
  rendered, with the current one marked (`aria-current`, scroll spy optional).
- Each section is a white panel (radius 8, padding 24, `h2` 18/700). Labels go above fields (12 px 600)
  and help text goes under them. Inputs are 44 px.
  - **Print sales**: the enable switch becomes a row switch on the right; the series-type lock
    message becomes a grey info row with a lock icon; series type shows as a read-only field with a
    "Locked" tag when locked; price field has a € prefix; edition variants is restyled as a small
    table.
  - **Artwork image**: preview + file line + Replace / Remove; the print size info ("Print size
    range for this file", resolution, smallest sellable, *More info on print sizes*) becomes a blue
    info box (`--color-badge-info-*`). **Printing restrictions** and **Printing recommendations** are
    `<details>` rows (title, one-line hint, "Show options" + caret); the options inside become toggle
    chips if that keeps today's values, otherwise just restyle them.
  - **Ready to sell** (only when it shows today): text left, **Ready to sell** (dark) or **Unblock**
    (outline, super admin only) right.
  - **Details**: Title (+ today's help), Author + Year in one row, Technique / medium editor,
    Dimensions; Text content and audio/video file sections in the same panel style for those types.
  - **Description**: today's editor with the restyled toolbar from Content (Lato in the editor).
  - **Where it shows**: Featured artwork checkbox "Feature on artist profile" and today's Exhibitions
    block.
  - **Supplementary media**: today's uploader as a dashed drop area.
- Save bar fixed to the bottom of the content area as in Content: *Unsaved changes* (amber dot) when
  dirty / *All changes saved*, **Cancel** (today's behaviour) and **Save changes**.

## 4 · Profile (`/dashboard/profile`)

- Header **Profile**, sub *How you appear to visitors on your public artist page.*, outline **View my
  public page ↗**.
- Panels: **Profile picture** (112 px round preview, Replace / Remove, today's hint), **Artist
  signature** (today's text; preview on a checkerboard so transparency shows; today's hint under),
  **About you** (First / Last name in one row with today's help, Profile URL with a
  `theartroom.gallery/artists/` prefix inside the field (keep today's live hint if you prefer),
  Email address), **Biography** (restyled editor).
- Save bar as in the editor (Discard only if it is cheap to reset the form; otherwise leave it out).

## 5 · Payouts (`/dashboard/payouts`)

Keep `statusHeadline`, `statusBody`, `renderPrimaryAction`, every state and every label.
- Header **Payouts**, sub *We pay you for every sale through Stripe, straight to your bank account.*
- Status panel: 44 px icon tile (amber Bank when not connected / in progress, green Check when
  complete), headline + body, primary action. When not connected: country select (label above, 44 px)
  and the "can't be changed later" line as an amber warning with a Warning icon, then the primary
  action under a divider. The "in progress … refresh" note stays as a grey note.
- **Disconnect** panel: text left, outline red **Disconnect Stripe…** right (today's confirm).

## 6 · Exhibition settings (`/dashboard/exhibitions/[id]/settings`)

- Breadcrumb **My exhibitions / {name}**, `h1` **Exhibition settings**, under it Published dot +
  sync badge (if the page has them; otherwise omit), actions **View exhibition ↗** and **Edit 3D
  space** (outline).
- **Name and address** panel: Exhibition name (read-only look + **Edit name** button → today's edit
  / Cancel flow) and the URL slug field with today's prefix inside the field.
- **Featured image**: 320×180 preview, Replace / Remove (today's uploader).
- **Short description**: counter `n / 400` top-right (`aria-live="polite"`; amber at 360+, red over
  400 if today allows typing past it), today's textarea.
- **Sections** (`SectionsEditor`): bordered list, rows with drag handle, name, outline **Rename**,
  red trash (`aria-label="Delete section {name}"`); inline rename as today; the add row is input
  "e.g. Magnolia" + **Add section**.
- **Description**: restyled editor.
- Save bar as above (only if the page saves with one button today; if fields save one by one, keep
  that and skip the bar).
