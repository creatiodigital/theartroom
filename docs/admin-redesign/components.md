# Admin components

Proposed shared components for the admin redesign. **Code Claude: when you build one, replace
"Proposed API" with the real props and file path**, so Design Claude designs against what exists.

Location: `src/components/admin/shell/` for the frame, `src/components/admin/ui/` for the pieces.
Styles: one `*.module.scss` per component, tokens only (see README).

---

## Frame

### `AdminLayout`

Replaces `DashboardLayout` **on admin pages only**. `DashboardLayout` is also used by the artist
dashboard (`src/components/dashboard/**`) and must keep working unchanged there.

- Carries over what `DashboardLayout` does for admin: the session check and redirect, the loading
  bar, and **ending an impersonation when an admin page is visible** (copy that `useEffect` exactly,
  including the `visibilitychange` handling and the reasons in its comment).
- Renders: `AdminSidebar` (≥ 900 px) or `AdminTopBar` + `AdminMenuDrawer` (< 900 px), then
  `PausedBanner` when purchases are paused, then the page content in a centred column.
- No more `backLink` / "← Back to Admin Dashboard": the menu replaces it. Detail pages (e.g. one
  order) keep a small in-page breadcrumb instead, e.g. "Orders / E8ACA170" (to be designed).
- **Built** · `src/components/admin/shell/AdminLayout.tsx` · `<AdminLayout>{children}</AdminLayout>`,
  no other props. Mounted once by `src/app/admin/layout.tsx` (pages do not wrap themselves). Wraps
  everything in `AdminShellProvider` (`AdminShellContext.tsx`), which exposes:
  - `useStorefrontSwitch(): { paused: boolean | null; error: string | null; toggling: boolean;
    requestToggle(): void; reload(): Promise<void> }`; `requestToggle` opens the shell's one
    pause / resume `ConfirmModal`.
  - `useAttentionCounts(): { metrics: Record<AttentionMetric, number> | null; error: string | null;
    reload(): Promise<void> }`; read on mount and on arriving at `/admin/dashboard` or `/admin/orders`.
  - Both exported from `@/components/admin/shell`. The menu model (items, icons, `isNavItemActive`,
    `ordersBadge`) is in `shell/adminNav.ts`.
  - Since step 14 it is a binding of `ShellFrame` (below): the impersonation-ending effect (unchanged),
    `AdminShellProvider`, the admin sidebar / top bar / drawer and `PausedBanner`. Same props, same output.

### `AdminSidebar`

Design: `designs/dashboard.dc.html`, the `<nav aria-label="Admin">` block.

- **Built** · `shell/AdminSidebar.tsx` · no props. User card is `shell/AdminUserCard.tsx`
  (`layout: 'sidebar' | 'drawer'`); the name comes from `session.user.name` (no last name in the session).

- 248 px, `--color-dark-surface`, padding 28/16/20 px, sections 28 px apart.
- Top: wordmark link to `/admin/dashboard`.
- Items, in this order:
  - **Dashboard** (`/admin/dashboard`)
  - **Sales**: Orders, Edition sales, Gift orders, Invoices, Payouts
  - **Gallery**: Exhibitions, Print presentations, Content, Users
- Then `StorefrontSwitch`, then the user card pinned to the bottom (`margin-top: auto`): initials
  avatar, name, role ("Super Admin" / "Admin" from `session.user.userType`), log-out icon button
  (reuse the logic of `ui/Logout`).
- Not sticky, not `100vh`: it is a column that grows with the page.

### `AdminNavItem`

States drawn in `designs/dashboard-states.dc.html` §2.

- **Built** · `shell/AdminNavItem.tsx` · `{ item: AdminNavItemDef; active: boolean;
  badge?: OrdersBadge | null; size?: 'menu' | 'drawer'; tone?: ShellTone; onNavigate?: () => void }`. The badge count is
  `aria-hidden` and its meaning is in visually hidden text ("…, 9 orders need attention").
  `tone` (step 14): `'dark'` (default, as above) or `'light'` (the studio: text `--color-text-primary`, compact
  `--studio-foot-text`, hover `--color-gray-15` + black, active `--studio-nav-active` + black 600). Also exports
  `navItemClassName({ tone?, size?, compact?, active? })`, so a `Button` row (the studio's Log out) looks like an item.

| State | Style |
| --- | --- |
| default | text `--admin-nav-text`, icon light |
| hover | bg `--admin-nav-hover`, text white |
| active | bg `--color-dark-surface-raised`, white, 600, icon `weight="fill"`, `aria-current="page"` |
| focus-visible | ring `0 0 0 2px #1a1a1a, 0 0 0 4px #fff` |

- Padding 10/12 px, radius 8, gap 12, icon 18.
- An item is active when the pathname starts with its href (so `/admin/orders/123` lights up Orders).
- Optional `badge` (number). Orders shows the **sum of the five attention counts**; hidden at 0;
  red (`--color-red-50`, white text) if refund-owed or needs-attention > 0, otherwise amber
  (`--color-amber-50`, black text). `aria-label` like "9 orders need attention".

### `AdminTopBar` + `AdminMenuDrawer` (< 900 px)

Design: `designs/dashboard-phone.dc.html`, `designs/dashboard-phone-menu.dc.html`.

- **Built** · `shell/AdminTopBar.tsx` · `{ menuOpen: boolean; onOpenMenu(): void; menuButtonRef }`;
  `shell/AdminMenuDrawer.tsx` · `{ onClose(): void }`. Both are driven by `AdminLayout`; nothing
  else renders them.

- Top bar: dark, wordmark + "Admin", menu button 44×44 (`List` icon) on the right; it carries the
  Orders badge as a dot/number when > 0.
- Drawer: full screen, dark, close button (`X`), same items at 48 px tall, user card + "Log out"
  text button at the bottom. Closes on navigation and on Escape; focus trapped while open.
- On phone the storefront switch moves out of the menu into the top of the dashboard page as a
  compact row ("Purchases open · Pause"). The paused banner shows on every page as on desktop.

### `StorefrontSwitch`

Design: states §3. Moves the purchases kill switch out of the dashboard body into the menu, so it
is reachable from every admin page.

- **Built** · `shell/StorefrontSwitch.tsx` · no props; reads `useStorefrontSwitch()`.

| State | Shows |
| --- | --- |
| loading | grey dot, "Checking…", disabled "Loading…" button |
| open | green dot (`--admin-live`), "Purchases open", red **Pause all purchases** button |
| paused | dark-red box (`--admin-paused-*`), "Purchases paused", "The public site is read-only.", white **Resume purchases** button |
| error | amber dot, "State unknown", the error text, **Retry** |

- Both buttons open the existing `ConfirmModal` with **exactly the current titles and messages**
  from `src/components/admin/dashboard/index.tsx`.
- Logic is today's `loadPausedState` / `handleTogglePurchases`. Move it into a hook
  `usePurchasesPaused()` (or a small context in `AdminLayout`) so the switch, the banner and the
  dashboard share one state and one request.

### `PausedBanner`

- **Built** · `shell/PausedBanner.tsx` · no props; reads `useStorefrontSwitch()`.

Full-width red bar at the top of the content area on every admin page while paused.
`role="status"`, pause icon, bold "Purchases are paused." + sentence, white "Resume purchases"
button (opens the same confirm dialog).

---

### Shared frame pieces (step 14)

The generic parts of the admin frame, used by the admin (`tone="dark"`) and the artist studio (`tone="light"`).
All in `src/components/admin/shell/`; the studio imports them by path (never through `shell/index.ts`, which pulls
in admin server actions).

- **`ShellFrame`** · `{ variant: 'admin' | 'studio'; wrap(frame): ReactNode; sidebar: ReactNode;
  topBar(menu: ShellMenuControls): ReactNode; drawer(onClose): ReactNode; banner?: ReactNode; topLine?: boolean;
  width?: 'list' | 'form'; children }`. Session gate (loading bar; unauthenticated → `/`), the drawer's state and
  effects (opens for the current path only, everything else `inert`, closes at 900 px and on navigation, body
  scroll locked, focus back to whatever opened it), the slots, the content column with the h1–h6 rule and the
  focus-ring scope. `wrap` puts the shell's providers inside the gate. `admin`: 36 px top, 1180 px column.
  `studio`: 40 px top, `width` `list` = `--studio-content-max-width` (1080) / `form` = `--studio-form-max-width`
  (880); `topLine` = the 3 px `--color-red-50` line over the whole frame (impersonating). Bottom padding 200 px (Q6).
  `ShellTone = 'dark' | 'light'`; `ShellMenuControls = { menuOpen; onOpenMenu(); menuButtonRef }`.
- **`ShellSidebar`** · `{ tone; label; children }`: the 248 px `<nav>` column (28/16/20 padding, sections 28 px
  apart). Dark: `--color-dark-surface`; light: white with a 1 px `--color-border-default` right edge.
- **`ShellTopBar`** · `ShellMenuControls & { tone; wordmark; accessory?; menuLabel; menuBadge? }`: the < 900 px bar,
  sticky, 44 px menu button (`List`); `accessory` sits before it (the studio's "Viewing as" pill), `menuBadge` on it
  (the admin's Orders badge).
- **`ShellDrawer`** · `{ tone; label; wordmark; onClose(); children }`: full-screen `role="dialog"`, 44 px × (focused
  on open), Escape closes.
- **`ShellWordmark`** · `{ tag; tone; size: 'menu' | 'bar'; layout: 'stacked' | 'inline'; href? }`: "The Art Room"
  (EB Garamond 500, 24 / 20 px) + its tag ("Admin" in `--color-dark-text-muted` on dark, "Artist studio" in
  `--color-red-50` on light). With `href` a `Link` that drops focus after a pointer click.

---

## Page pieces

### `AdminPageHeader`

(`ui/PageHeader` already exists for the public site; this is a separate admin one.)
Eyebrow (optional), `h1` title, one-line description (optional), actions slot on the right.
Wraps under 900 px.

- **Built** · `src/components/admin/ui/AdminPageHeader.tsx` · `{ eyebrow?: ReactNode; title: string;
  description?: ReactNode; actions?: ReactNode }`. Title 26 px on phone.

### `Panel`

White card: border `--color-border-default`, radius 8, padding 24, gap 18. Header = panel title
(13 px caps) + optional subtitle + optional action on the right (e.g. "All orders >" outline
link 32 px tall). Used for every block on the dashboard and, later, around every table.

- **Built** · `ui/Panel.tsx` · `Panel { title: string; subtitle?: ReactNode; action?: ReactNode;
  children; className?; flush?: boolean }` (`flush`, step 12a: rows run edge to edge, the header keeps its inset) (a `<section aria-labelledby>`), and `PanelLink { href; children }` for the
  "All orders >" action (outlined on desktop, plain text on phone). Phone: padding 18 px and the
  subtitle hidden, as in `dashboard-phone.dc.html`.

### `AttentionCard`

Design: states §1. Props: `label`, `icon`, `count: number | null`, `tone: 'red' | 'amber'`,
`zeroHint`, `href`.

- **Built** · `ui/AttentionCard.tsx` · `{ label; icon: Icon; count: number | null; failed?: boolean;
  tone: 'red' | 'amber'; zeroHint; href }` (`failed` turns the null-count hint into "Unavailable"). Phone: no icon, number first (`dashboard-phone.dc.html`).

| Case | Look |
| --- | --- |
| `count === null` | number "–" in `--color-gray-65`; hint "Loading…" while loading, "Unavailable" after a failure |
| `0` | white card, number `--color-text-secondary`, hint in green (e.g. "None to capture") |
| `> 0`, amber | bg `--admin-amber-bg`, border `--admin-amber-border`, number + hint `--color-yellow-70`, hint "Review now →" 600 |
| `> 0`, red | bg `--color-red-30`, border `--color-red-40`, number `--color-red-50`, hint `--color-red-70` |

Keep today's rule: tone only when count > 0. The five cards and their tones are the existing
`URGENT_COUNTERS`. Zero hints: Refund still owed → "Nothing owed"; Needs attention → "No flagged
orders"; New → "None to capture"; Awaiting placement at TPS → "All placed"; Delivered, artist not
paid → "All artists paid". When all five are 0, the section title gets a green "All clear" pill.
When counts fail: keep "–" and show one line under the row: red dot + error text + **Retry**.

### `PipelineList`

The seven fulfilment stages in order (`BUCKET_ORDER` minus cancelled / refunded / attention):
number circle, label, proportional bar (relative to the largest stage, empty at 0), count (grey
at 0, black above). Each row links to that stage on the Orders page. Under the list: pills for
Canceled (red pill when > 0) and Refunded. Counts come from `countByBucket()` on the same
`listOrders()` result the attention cards already use, so no new request.

- **Built** · `ui/PipelineList.tsx` · `{ buckets: Record<Bucket, number> | null; stageHref: (bucket: Bucket) => string }`. Counts
  come from `useAttentionCounts().buckets` (the shell's one `listOrders()`). Phone: no bars.

Stage labels: New · To place at TPS · At TPS · In production · Shipped · Delivered · Artist paid.

### `BarList`

Label (+ optional second line) · horizontal bar · value. Bars 8 px, `--color-dark-surface`
on a `--color-gray-20` track, width relative to the first (largest) row. Used for "Most viewed
artworks" (as a table: Artwork / Share / Views, artist on the second line, "no prints" flag in
`--color-yellow-70`) and "Visitors by country".

- **Built** · `ui/BarList.tsx` · `{ rows: { key; label; sublabel?; value }[]; emptyMessage;
  variant?: 'list' | 'table'; columns?: { label; share; value } }`; `table` renders the desktop table
  and the phone's stacked rows. The bar itself is `ui/Bar.tsx` (`{ value; max; size?: 'regular' | 'thin' }`,
  min 3% when > 0).

### `DonutChart`

Plain CSS `conic-gradient`, 168 px, 22 px ring, total in the middle ("577 / sessions"), legend
on the right with colour square, name, "n (pct%)". Greys from dark to light:
`#1a1a1a, #666666, #a3a3a3, #cccccc, #e6e6e6` (each square gets a 1px inner outline).
Needs `role="img"` with an `aria-label` that lists the values. No chart library.

- **Built** · `ui/DonutChart.tsx` · `{ title; segments: { label; value }[]; totalLabel }`. Grays are
  tokens `--admin-chart-1…5`. More than five segments: the fifth becomes "Other" (Q8). 120 px on phone.

### Analytics states

Design: states §5. Loading, not configured and error replace the four analytics panels with **one**
full-width panel (they share one request). Copy stays as in `AnalyticsSection.tsx`. "Empty" is per list.
The footnote ("Google Analytics, consenting visitors plus Google's modeling… Updated …") sits
under the panels in 12 px secondary text.

- **Built** · `src/components/admin/dashboard/AnalyticsPanels.tsx` (`TrafficChannelsPanel`,
  `ArtworkViewsPanel`, `CountriesPanel`, `AnalyticsStatePanel`, `AnalyticsFootnote`) fed by
  `useDashboardAnalytics()` (one request, module cache as before). `AnalyticsSection.tsx` is gone.

### `ConfirmModal` (restyle, admin only)

Design: states §4. Icon circle on the left (Warning in red for destructive, Play in grey for
resume), 18 px title, secondary message, buttons right-aligned: Cancel (secondary) + confirm
(danger or primary), 44 px tall. `busy` shows "Pausing…" / "Resuming…" rather than the generic
"Working…". `ConfirmModal` is shared with the public site and artist dashboard: add the look
behind a prop or an admin wrapper. Don't restyle it everywhere.

- **Built** as a separate `ui/AdminConfirmModal.tsx` · `{ title; message: ReactNode; confirmLabel;
  busyLabel?; destructive?; busy?; icon?: Icon (default Warning); onConfirm(); onCancel() }`. It uses
  the shared `Modal` with a new opt-in `tone="admin"` (dark backdrop, 8 px corners, dialog shadow);
  `ConfirmModal` and every other `Modal` are unchanged. It renders into the shell's dialog layer
  (`shell/AdminDialogContext.tsx`), which makes the rest of the page `inert` while it is open (Q5).
  The pause / resume dialog and the cleanup dialog both use it.

### Test-data cleanup

Design: states §6. Last thing on the dashboard, only when `DEV_CLEANUP_ALLOWED`. Dashed border
panel, amber "Test environment · {env}" badge, outline-red button (not filled, so it never looks
like the real Pause switch). Logic and dialogs unchanged.

- **Built** · `src/components/admin/dashboard/DevCleanupPanel.tsx` · `{ environment; result; onClear }`.

## List pieces (step 3)

### `StageTabs`
- **Built** · `ui/StageTabs.tsx` · `{ label; groups: { label; tabs: { id; label; count; step?; countTone?: 'red' | 'amber' }[] }[];
  selected: string | null; onSelect(id) }`. One `role="tablist"` per group, roving tabindex, arrow keys /
  Home / End across all groups, scrolls the selected tab into view under 900 px. `selected: null` = no
  tab selected (searching). Count: gray at 0, `--color-gray-25` above, dark when selected; tone wins.

### `Callout`
- **Built** · `ui/Callout.tsx` · `{ tone: 'info' | 'plain' | 'amber' | 'red'; icon?: Icon; role?: 'note' | 'alert'; title?; children?; action? }`
  (`role`, step 10: default `note`; `alert` for a refusal that just happened)
  (`icon`, step 8: replaces the tone's icon, always light, e.g. HandCoins on the payouts reminder).
  `role="note"`; Warning (fill) for amber / red, Info (light) otherwise. Amber text `--admin-amber-text`.

### `SearchField`
- **Built** · `ui/SearchField.tsx` · `{ value; onChange(value); placeholder; label }` (label visually
  hidden, magnifier inside, 44 px below 900 px / 36 px above).

### `DataTable` + `EmptyState`
- **Built** · `ui/DataTable.tsx` · `{ children; className? }`: the table shell (gray header row, 14 px rows,
  `--color-gray-20` dividers, top-aligned, sideways scroll). Pages write their own rows and may turn
  them into phone cards through `className` (see `orders/Orders.module.scss`).
  `<tfoot>` (step 7): 2 px `--color-border-default` top rule, `--color-gray-10` fill, 600, tabular figures;
  its `th` is 13 px and wraps (Invoices' "Total for {period}" row; Payouts reuses it).
- `ui/EmptyState.tsx` · `{ title; text? }` (Tray in a circle).

## Detail pieces (step 4)

### `AdminBreadcrumb`
- **Built** · `ui/AdminBreadcrumb.tsx` · `{ items: { label; href?; mono? }[] }` (Q4: `<nav aria-label="Breadcrumb"><ol>`,
  current item `aria-current="page"`; phones show only "← {parent}").

### `StatusPill`
- **Built** · `ui/StatusPill.tsx` · `{ label; tone?: 'dark' | 'red' | 'outline' }`.

### `ProgressSteps`
- **Built** · `ui/ProgressSteps.tsx` · `{ label; steps: { label; state: 'done' | 'current' | 'future'; when? }[]; end? }`
  (`end` = e.g. the red "Canceled" marker). Phones: "Step n of 7 · Label" + thin bar, full list in `<details>`.

### `CopyField` + `CopyButton`
- **Built** · `ui/CopyField.tsx` · `CopyField { label; value: ReactNode; copyValue; buttonLabel?; align?; className? }`
  (label 150 px, value mono, "Copied" for 2 s); `CopyButton { value; label; srSuffix?; size? }`.

### `AdminConfirmModal` (additions)
- `warning?: ReactNode` (amber box under the message) and `cancelLabel?: string` (default "Cancel").

## Sales pieces (step 5)

### `StatCard`
- **Built** · `ui/StatCard.tsx` · `{ label; value: ReactNode | null; hint?; tone?: 'plain' | 'amber'; size?: 'count' | 'money';
  pressed?; onSelect? }`. `null` shows "–". With `onSelect` it is a button with `aria-pressed` (pressed = 2 px dark edge).
  Count 32 px / money 28 px (26 / 22 on phones).

### `AdminSelect`
- **Built** · `ui/AdminSelect.tsx` · `{ label; hideLabel?; id?; value; onChange(value); disabled?; title?; minWidth?; children }`
  (native `<select>`; 36 px, 44 px under 900 px; full width on phones).

### `ListPanel`
- **Built** · `ui/ListPanel.tsx` · `{ label; toolbar?; count?; footnote?; children }` (`<section aria-label>`, toolbar row only
  when there is a toolbar or a count).

### `OffPlatformKindMark`
- **Built** · `ui/OffPlatformKindMark.tsx` · `{ kind: string }` (Gift / Palette / Printer, 16 px light, aria-hidden).

### Additions
- `AdminConfirmModal`: `size?: 'regular' | 'wide'` (760 px, body scrolls, title and buttons stay) and `icon?: Icon | null`
  (`null` = no icon circle).
- `StatusPill`: `tone` also `'green' | 'amber' | 'info' | 'gray'`; `shape?: 'pill' | 'tag'` (4 px corners).
- `EmptyState`: `action?: ReactNode`.

## Gift order pieces (step 6)

### `RowMenu`
- **Built** · `ui/RowMenu.tsx` · `{ label; groups: { label?; items: { id; label; hint?; tone?: 'danger'; disabled?; onSelect }[] }[];
  disabled?; width? = 190 }`. ⋮ trigger (36 px, 44 px under 900 px) with `aria-haspopup="menu"` / `aria-expanded`;
  `role="menu"` of `menuitem` buttons (disabled items stay focusable, `aria-disabled`); arrows / Home / End,
  Escape returns focus to the trigger, Tab closes; closes on outside click; fixed position that follows the
  trigger on scroll / resize and opens upward when short of room below (Q6). Not portaled (row-scoped locators work).

### `SegmentedControl`
- **Built** · `ui/SegmentedControl.tsx` · `{ label; options: { id; label }[]; value; onChange }` (`role="group"` of
  `aria-pressed` buttons; 34 px, 44 px under 900 px; full row on phones, words wrap).

### `AdminCheckbox`
- **Built** · `ui/AdminCheckbox.tsx` · `{ id; label; checked; onChange(checked) }` (native 16 px box; 44 px hit area on phones).

### Additions
- `CopyButton`: `icon?: Icon`; "Copied" only after the clipboard write succeeds.
- `EmptyState`: `text` takes a `ReactNode`.
- `Button`: `aria-disabled` pass-through.
- `Button` (step 7): `prefetch?: boolean`, passed to Next's `Link` with `href`; `false` for links to files
  (invoice PDFs).

## User pieces (step 9)

### `FeedbackBar`
- **Built** · `ui/FeedbackBar.tsx` · `{ tone: 'success' | 'error'; children; onDismiss() }` (`role="status"` /
  `role="alert"`, check / warning icon, 32 px × close; green on `--admin-success-border`, red as Callout).

### `PublishState`
- **Built** · `ui/PublishState.tsx` · `{ published: boolean }` (8 px dot `--admin-published-dot` + "Published" 600,
  or gray dot + "Unpublished" secondary).

### `initialsOf`
- `ui/initials.ts` · `initialsOf(name): string` (shared by the user card and the Users avatars).

### Additions
- `AdminConfirmModal`: `confirmDisabled?` (0.4 opacity, e.g. until CONFIRM is typed); `cancelLabel?: string | null`
  (`null` = no Cancel, e.g. a "Done" screen); `form?: string` instead of `onConfirm` (the confirm button submits
  that form, so Enter works in its fields).
- `AdminSelect`: `size?: 'toolbar' | 'form'` (`form` = 44 px at every width, for dialog fields).
- `StatusPill`: `icon?: Icon` (12 px filled mark before the label, e.g. Star on "Featured").
- `RowMenu`: groups with no items are left out (no caption, no divider).

## Print presentation pieces (step 11)

- `ui/Toggle` (public, shared): opt-in `tone?: 'default' | 'admin'` (40×24 admin switch), plus `id?`,
  `'aria-labelledby'?`, `'aria-describedby'?`; the default look is unchanged for the editor panels and Announcements.
- `StatusPill`: tone `'redSoft'` (light red, e.g. "Missing").
- `Bar`: `surface?: 'white' | 'gray'` (the track's colour; gray inside a gray status row).
- Token `--admin-preview-tile: #f0efec` (the work preview tile).

## Content list pieces (step 12b)

### `SortableList`
- **Built** · `ui/SortableList.tsx` · `{ rows: { id; title; sub?: ReactNode; thumb: ReactNode; actions: ReactNode;
  className?; marker? (a data-* attribute name put on the row) }[]; onDragEnd(event: DragEndEvent) }`. dnd-kit (pointer + keyboard
  sensors, closest-center, vertical strategy); each row: handle (`aria-label="Reorder {title}"`, DotsSixVertical bold,
  `touch-action: none`), position, thumb, title + sub, actions. `SORTABLE_KEYBOARD_HINT` is the footnote text.

### Additions (step 15)
- `SortableList`: `numbered?: boolean` (default true: the position number), `sortable?: boolean` (default true; false
  = no handles, an empty handle column so rows don't jump, e.g. while searching), and per row `href?: string` (the
  title becomes a link, prefetch off). Without them the output is unchanged.
- `StatusPill`: `dot?: boolean` (a 6 px dot before the label; green = the Published dot), e.g. "Selling prints".

## Page editor pieces (step 12c)

### `SaveBar`
- **Built** · `ui/SaveBar.tsx` · `{ dirty: boolean; saving: boolean; saved?: boolean; onSave(); onDiscard?(); failed?: boolean }`
  (fixed to the bottom of the content area, lined up with the 880 px column; status as a live region: "All changes
  saved" / "Unsaved changes" / "Saved"; with `failed` (Q80) the status is a red `role="alert"` "Not saved. Please try
  again." — the page passes it while it still holds exactly what the refused save sent; Discard only with `onDiscard`).

### `SaveBar` additions (step 16a)
- `onCancel?()` (an always-enabled outline Cancel before Save), `form?: string` (instead of `onSave`: Save becomes
  `type="submit" form={form}`, so the form's own submit, validation and Enter run), `width?: 'form' | 'list'` (880 /
  1080 px column), `failedMessage?: string` (the red text while `failed`; default "Not saved. Please try again.").

### Opt-in props on shared public components (their default output is unchanged)
- `RichTextEditor`: `tone?: 'default' | 'admin'` (grouped toolbar, the public RichText styles), `richTextVariant?:
  'default' | 'page'`, `labelledBy?`, `describedBy?`, `onReady?(html)` (the editor's own form of the loaded text).
- `ImageUploader`: `tone?: 'default' | 'admin'` (preview + Replace / Remove), `note?: ReactNode`.
- `Input`: `aria-describedby?`.

## Menu addition (step 13)

- `shell/adminNav.ts`: a Developer group (`API reference`, Code) shown when `showsDeveloperSection(userType)` (admin,
  super admin); `AdminNavItem` gains `compact` (13 px, 16 px icon; 18 px in the drawer). The side menu's foot holds the
  Developer group, then the user card; the drawer shows it as its last group.

## Artist studio shell (step 14)

`src/components/dashboard/shell/`, mounted once by `src/app/dashboard/layout.tsx`. Spec: artist.md §0.

- **`StudioRouteLayout`** · `{ children }`: `children` bare on `STUDIO_BARE_PATHS` (`/dashboard/login`,
  `/dashboard/change-password`, Q100), else `StudioLayout` = `ShellFrame variant="studio"` wrapped in
  `AdminDialogProvider` (so studio pages can use `AdminConfirmModal`), `topLine` while impersonating, `width` from
  `studioContentWidth(pathname)`, and a re-read of the user record on leaving Profile.
- **`StudioSidebar`** (no props) / **`StudioTopBar`** (`ShellMenuControls`; adds the "Viewing as {name}" pill, a
  `Button` 44 px tall with a 28 px pill, ellipsis, `aria-haspopup="dialog"`, opens the drawer) /
  **`StudioMenuDrawer`** · `{ onClose() }` ("Artist menu").
- **`StudioMenuBody`** · `{ layout: 'sidebar' | 'drawer'; onNavigate?() }`: one body for both: the impersonation card,
  `<nav aria-label="Artist">` items, then the foot (avatar, name, View my public page ↗, Change password, Log out).
- **`ImpersonationCard`** · `{ name; onStop(); layout: 'sidebar' | 'drawer' }`: `role="status"`, red eye circle,
  "Viewing as {name}", "You're signed in as an admin. Changes save to this account.", **Stop impersonating** (36 px;
  44 px in the drawer). Tokens `--studio-impersonation-*`.
- **`studioNav.ts`**: `STUDIO_HOME`, `STUDIO_BARE_PATHS`, `STUDIO_NAV_ITEMS` (Home `House`, Artworks `Images`, Profile
  `User`, Payouts `Bank`), `CHANGE_PASSWORD_ITEM` (`Key`, compact), `PROFILE_PATH`, `isStudioItemActive(pathname, href)`
  (Home: `/dashboard` and `/dashboard/exhibitions/*`; the rest: exact or prefix), `studioContentWidth(pathname)`.
- **`useStudioShell.ts`**: `useStudioImpersonation(): { name; stop(): Promise<void> } | null` (the old bar's condition
  and Stop, verbatim); `useStudioPerson(): { name; imageUrl: string | null; publicHref: string | null }` (RTK
  `useGetUserQuery`, the session name until it lands, Q96); `useRefreshPersonAfterProfile(pathname)`.
- Tokens: `--studio-content-max-width`, `--studio-form-max-width`, `--studio-nav-active`, `--studio-avatar`,
  `--studio-foot-text`, `--studio-impersonation-{surface,border,button-border,label,text}`.

## Artwork editor pieces (step 16a)

- `shared/ArtworkEditForm` gains `variant?: 'page' | 'overlay'` (default `overlay`: the wall view's View details, own h1 and
  Cancel / Save changes row; `page`: no h1, the On this page list, the form id `ARTWORK_EDIT_FORM_ID` for the save bar),
  `onRichTextReady?(field, html)` and `onVariantsDirtyChange?(count)` (display only, for the save bar).
- `EditorPanel` · `{ section: ArtworkSection; description?; aside?; children }`: `<section id aria-labelledby>`, white,
  radius 8, padding 24 (18 on phones), h2 18/700; `aside` (16b) sits on the head row's right, e.g. the print switch.
- `SectionNav` · `{ sections: ArtworkSection[] }`: "On this page", sticky, plain anchors, `aria-current` on the section in
  view; hidden under 900 px.
- `sections.ts`: `ARTWORK_SECTION` (ids and titles), `ARTWORK_EDIT_FORM_ID`, `panelTitleId`, `panelDescriptionId`.
- `LimitedVariantsEditor`: `onDirtyCountChange?(count)` (display only).
- `AdminCheckbox`: `description?: ReactNode` (a line under the label, tied with `aria-describedby`; without it the markup
  is unchanged).

## Print sales pieces (step 16b)

- `LockNote` · `{ children }`: a grey row (`--color-gray-15`, radius 8) with `LockSimple` 16 light, for the series-type
  lock and each live variant.
- `OptionChips` · `{ title; options: { id; label; pressed }[]; onToggle(id) }`: a `role="group"` of `aria-pressed` chips
  (dark with a check when pressed; 32 px, 44 px on phones), the printing restrictions / recommendations.
- `ImageUploader` (shared, admin tone): `align?: 'center' | 'start'` (default `center`, the page editor's banner as before;
  `start` top-aligns the preview and lets the side column take the row, for the artwork editor's print-size box).
- Token `--studio-note-surface: #f7f7f7` (the print-size box, Q113).

## Studio page pieces (step 17)

- `dashboard/StudioPanel` · `{ title; id?; description?; aside?; layout?: 'stack' | 'row'; className?; children }`: the studio
  forms' white panel (radius 8, padding 24), h2 15 px 700, description 13 px; `row` puts the content beside the text (e.g.
  Disconnect).
- `StudioPanel/studioPage.module.scss`: the studio form pages' shared classes (`.page`, `.withSaveBar` bottom room for the
  bar, `.field` / `.label` / `.help`, 44 px `.input`, `.prefixBox` / `.prefix` for a prefix inside a field, `.textarea`,
  button looks `.primary` / `.outline` / `.dangerOutline` / `.iconDanger`).
- `ImageUploader` (shared, admin tone): `adminPreview?: 'banner' | 'avatar' | 'signature'` (default `banner`, as before;
  `avatar` = 112 px circle, `signature` = 300×100 on a checkerboard, contained).
- `AdminSelect`: `aria-describedby?`.
- `SaveBar`: `cleanMessage?: string` (the status while nothing is unsaved; default "All changes saved"), e.g. Exhibition
  settings' "The new name isn't saved yet: use Save name.".

## 3D editor chrome (step 18-1)

`src/components/editorChrome/`, pure UI (no Redux, no requests, nothing from the scene); the wall view (18b) reuses it.

- `ToolPanel` · `{ title; description?; icon: Icon; tint: ToolTint; onClose(); save?: { saving; saved; onSave(); status:
  SaveStatus }; children }`: the floating right panel (384 px, radius 16, `--editor-panel-surface`), icon tile + title +
  line + ×, a scrolling body of cards, and the Save area (amber "Unsaved changes" dot, red `role="alert"` "Not saved. Please
  try again.", Saving… / Saved / Save). Stops mouse-down, pointer-down and wheel from reaching the room, as the old panel.
- `PanelCard` · `{ title?; level: 'card' | 'group'; aside?; children }`; `SliderRow` · `{ label; value; sliderValue; min; max;
  step?; onChange(value); disabled?; 'aria-label'?; ends?: [string, string]; track?: 'fill' | 'tone' }` (label + value chip,
  then the slider, optional end words); `SwitchRow` · `{ title; line?; checked; onChange; 'aria-label'?; stateText?;
  disabled? }`; `InfoLine`; `IconTile` · `{ icon; size: 32 | 40; tint }`.
- `useSaveTracking(key)` / `resetSaveTracking()`: the Save area's display-only status per "{exhibition}:{panel}" (Q131).
- `ui/Toggle`: `tone?: 'default' | 'admin' | 'editor'` (`editor` = 36×22, `role="switch"`). `ui/Slider`: `aria-valuetext?`.
  `ui/ColorPicker`: `variant?: 'default' | 'row' | 'inline'` + `name` (`row`: the whole row is the label that opens today's
  picker). Defaults unchanged.
- Tokens `--editor-*` (panel surface, shadows, tints, the attention dot).
- `PanelSection` (step 18-2) · a collapsible card: one head button (icon tile white closed / dark open, title, line, the main
  value in mono while closed, caret), the body only while open; its open state in localStorage under the caller's key
  (today's `section-*` keys, "1" / "0").
- `editview/LightingPanel/LampPicker` (step 18-2): the lamp grid (`radiogroup` of tiles, arrows stay in it), one grid per
  room on Vienna; the picked lamp is local UI state.
- `ChoiceTiles` (step 18-3) · `{ label; options: readonly { value; label }[]; value; onChange(value); columns? }`: a short
  list as tiles (a bench's Model), `radiogroup` with one tab stop; arrows / Home / End move and pick and don't reach the
  room; `onChange` only for a value other than `value`, as a native select. Long names wrap inside their tile.
- `ToolPanel` `footer?: ReactNode` (step 18-3): the footer of a panel without Save (the Artwork panel's View details).
  `ui/ColorPicker` `aria-label?` on the `row` / `inline` variants: a name with context where the visible one repeats
  ("Room 2 · Panel 1 color").

## Wall view chrome (step 18b)

`src/components/wallview/chrome/`, pure UI (no Redux, no requests); the wall view also imports `editorChrome`'s rows.

- `SegmentStrip` · `{ label; segments: { key; label; icon?; pressed?; onClick; disabled? }[] }`: a grey track of
  segments (`role="group"`); `pressed` = a choice (`aria-pressed`), without it an action; an icon segment is named by
  its label and shows it as its tooltip.
- `HelperSwitch` · `{ icon; title; line?; checked; onChange; disabled?; dependent? }`: a tile + name + line + the editor
  switch; `dependent` indents it (Lock guides); disabled dims the tile and words.
- `ItemThumb` · `{ artworkType?; imageUrl?; size: 'row' | 'group' }`: a wall item's image, or its type icon (decorative).
- Tokens: `--editor-row-selected`, `--editor-row-selected-text`, `--editor-row-selected-edge`, `--editor-segment-shadow`.
- 18b-2 · `TabStrip` · `{ label; tabs: { id; label }[]; selected; onSelect }` (`tablist`, arrows / Home / End stay in it,
  they don't move the work); `PanelGroup` · `{ title; aside?; disabled?; children }` (a captioned group; disabled dims and
  blocks the mouse, as the old `ui/Section`); `DistanceBox` · `{ label; itemLabel; top; right; bottom; left; size? }`;
  `SelectField` · `{ label; hideLabel?; ariaLabel?; options; value; onChange; disabled? }` (a caption + `ui/Select
  tone="editor"`); `NumberField` · `{ label } & NumberInputProps`; `ItemThumb` sizes `header`, `stack`.
- `ui/Select`: `tone?: 'default' | 'editor'`, `'aria-label'?`, `'aria-labelledby'?` (default unchanged).
  `ui/ColorPicker`: `variant="field"` (name above a 36px box with the swatch and hex) + `emptyLabel?` (a crossed swatch
  and e.g. "None"). `ui/NumberInput` (wall view only): `'aria-label'?`, `suffix?`, `size?: 'regular' | 'compact'`; the
  unused `icon`, `rotate`, `label`, `variant` props are gone. `ui/Section` is deleted (no user left).
