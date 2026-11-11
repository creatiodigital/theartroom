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
  badge?: OrdersBadge | null; size?: 'menu' | 'drawer'; onNavigate?: () => void }`. The badge count is
  `aria-hidden` and its meaning is in visually hidden text ("…, 9 orders need attention").

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
  children; className? }` (a `<section aria-labelledby>`), and `PanelLink { href; children }` for the
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
- **Built** · `ui/Callout.tsx` · `{ tone: 'info' | 'plain' | 'amber' | 'red'; title?; children?; action? }`.
  `role="note"`; Warning (fill) for amber / red, Info (light) otherwise. Amber text `--admin-amber-text`.

### `SearchField`
- **Built** · `ui/SearchField.tsx` · `{ value; onChange(value); placeholder; label }` (label visually
  hidden, magnifier inside, 44 px below 900 px / 36 px above).

### `DataTable` + `EmptyState`
- **Built** · `ui/DataTable.tsx` · `{ children; className? }`: the table shell (gray header row, 14 px rows,
  `--color-gray-20` dividers, top-aligned, sideways scroll). Pages write their own rows and may turn
  them into phone cards through `className` (see `orders/Orders.module.scss`).
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
