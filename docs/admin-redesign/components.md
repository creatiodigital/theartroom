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

### `Panel`

White card: border `--color-border-default`, radius 8, padding 24, gap 18. Header = panel title
(13 px caps) + optional subtitle + optional action on the right (e.g. "All orders >" outline
link 32 px tall). Used for every block on the dashboard and, later, around every table.

### `AttentionCard`

Design: states §1. Props: `label`, `icon`, `count: number | null`, `tone: 'red' | 'amber'`,
`zeroHint`, `href`.

| Case | Look |
| --- | --- |
| `count === null` (loading or failed) | number "–" in `--color-gray-65`, hint "Loading…" |
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

Stage labels: New · To place at TPS · At TPS · In production · Shipped · Delivered · Artist paid.

### `BarList`

Label (+ optional second line) · horizontal bar · value. Bars 8 px, `--color-dark-surface`
on a `--color-gray-20` track, width relative to the first (largest) row. Used for "Most viewed
artworks" (as a table: Artwork / Share / Views, artist on the second line, "no prints" flag in
`--color-yellow-70`) and "Visitors by country".

### `DonutChart`

Plain CSS `conic-gradient`, 168 px, 22 px ring, total in the middle ("577 / sessions"), legend
on the right with colour square, name, "n (pct%)". Greys from dark to light:
`#1a1a1a, #666666, #a3a3a3, #cccccc, #e6e6e6` (each square gets a 1px inner outline).
Needs `role="img"` with an `aria-label` that lists the values. No chart library.

### Analytics states

Design: states §5. Loading, not configured and error replace the four analytics panels with **one**
full-width panel (they share one request). Copy stays as in `AnalyticsSection.tsx`. "Empty" is per list.
The footnote ("Google Analytics, consenting visitors plus Google's modeling… Updated …") sits
under the panels in 12 px secondary text.

### `ConfirmModal` (restyle, admin only)

Design: states §4. Icon circle on the left (Warning in red for destructive, Play in grey for
resume), 18 px title, secondary message, buttons right-aligned: Cancel (secondary) + confirm
(danger or primary), 44 px tall. `busy` shows "Pausing…" / "Resuming…" rather than the generic
"Working…". `ConfirmModal` is shared with the public site and artist dashboard: add the look
behind a prop or an admin wrapper. Don't restyle it everywhere.

### Test-data cleanup

Design: states §6. Last thing on the dashboard, only when `DEV_CLEANUP_ALLOWED`. Dashed border
panel, amber "Test environment · {env}" badge, outline-red button (not filled, so it never looks
like the real Pause switch). Logic and dialogs unchanged.
