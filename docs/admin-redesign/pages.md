# Pages

Status: **To design** → **Designed** → **Built** → **Approved**.
Code Claude updates "Built" + notes; the owner sets "Approved".

## Build order

Do these in order, one PR each.

| # | Step | Design | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Shell**: tokens, Phosphor check, `AdminLayout`, `AdminSidebar`, `AdminNavItem`, `AdminTopBar` + drawer, `StorefrontSwitch`, `PausedBanner`, `usePurchasesPaused`. Switch **every** admin page from `DashboardLayout` to `AdminLayout` and delete their back links. Page bodies stay as they are. | dashboard, states, phone, phone-menu | Built | Biggest visible win: every page gets the new frame at once. See Built notes. |
| 2 | **Dashboard** body: `AdminPageHeader`, `Panel`, `AttentionCard`, `PipelineList`, `BarList`, `DonutChart`, analytics states, cleanup panel, `ConfirmModal` admin look. Remove the "Manage" hub cards (the menu replaces them). | dashboard, states, phone | Built | Analytics data unchanged (`AnalyticsSection` logic). See Built notes. |
| 3 | Orders list | orders (spec: orders.md §1) | Designed · approved by owner | Sets the pattern for every list page. Closes Q1 (`?stage=`). Read counts/rows from the shell (Q2). |
| 4 | Order detail | order-detail (spec: orders.md §2) | Designed · approved by owner | Re-layout only: keep every action, guard and confirm as today. |
| 5 | Edition sales | | To design | Reuses list pattern. |
| 6 | Gift orders | | To design | Reuses list pattern. |
| 7 | Invoices + invoice detail | | To design | Reuses list pattern + export actions. |
| 8 | Payouts | | To design | |
| 9 | Users | | To design | Reuses list pattern + row menu. |
| 10 | Exhibitions | | To design | Reuses list pattern + row menu. |
| 11 | Print presentations | | To design | Thumbnails, inline selects, toggles, render progress: needs its own design. |
| 12 | Content + editors (landing, announcements, gallery selection, `[slug]`) | | To design | Forms: needs its own design. |
| 13 | Settings, API reference, analytics, dev-cleanup routes | | To design | Check what each one is first. |

## Built notes

<!-- Code Claude: per step, add date, PR/branch, and anything that differs from the design and why. -->

### Step 1 · Shell — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Files: `src/components/admin/shell/*`, `src/app/admin/layout.tsx`, admin tokens in
`src/styles/variables.scss`, `optimizePackageImports: ['@phosphor-icons/react']` in `next.config.mjs`
(Phosphor is not on Next's built-in list), `src/lib/auth/signOutAndVerify.ts` (the Log out logic,
now shared by `ui/Logout` and the menu).

Differences from the design / components.md, and why:

1. **Mounted once in `src/app/admin/layout.tsx`** instead of each page wrapping itself. Same
   `<AdminLayout>{children}</AdminLayout>`; as a Next layout it stays mounted while moving between
   admin pages, so the switch state and the badge counts are read once per visit, not once per page.
   Pages only lost their `<DashboardLayout>` wrapper.
2. **Hook name**: `usePurchasesPaused` already exists (the public site's fail-open read), so the
   admin one is `useStorefrontSwitch()`, next to `useAttentionCounts()`. Both live in
   `AdminShellContext.tsx`; the provider also renders the one pause / resume `ConfirmModal`.
3. **Dashboard body kept** (step 2 replaces it), but its "Needs your attention" cards and its
   Purchases section now read the shell's state: one request each, and the menu, the banner and the
   dashboard can never disagree. On phone the dashboard's Purchases section stays the only switch
   until step 2 adds the compact row.
4. **Back links**: removed where the target is in the menu (Dashboard, Orders, Content). Kept as a
   plain in-page link on `content/announcements/[id]` ("← Back to Announcements"), because
   Announcements is not in the menu. See Q4.
5. **Page content font**: the shell carries over `DashboardLayout`'s rule (h1–h6 in the dashboard
   font) but does not switch page body text to Geist; each page moves fully when it is redesigned.
6. **`/admin/api-reference`** sits under the layout, so it gets the frame; its body (with its own
   "back to /dashboard" link) is untouched until step 13. Step 13 check: `settings`, `analytics`
   and `dev-cleanup` are server-action folders, not pages.
7. **User card**: the session only carries `name` (no last name), so the card shows that and its
   initials.
8. **Focus ring** (Q3 still open): implemented with `outline` (2px, 2px offset; black on light,
   white on dark), on links and buttons only. Fields keep their own focus look, since a text field
   matches `:focus-visible` on a mouse click too.
9. **Drawer focus**: the existing `Modal` does not trap Tab (it focuses itself and restores focus
   on close). The drawer keeps focus inside by making everything behind it `inert`. It closes on
   navigation, on Escape, and when the window grows past 900 px.
10. **Switch errors**: a failed pause / resume shows its error under the normal open / paused state
    (the design only draws "State unknown" for a failed read).

11. **After review (2026-11-11):** the pause / resume dialog traps focus (everything else goes
    `inert` while it is open, per Q5) and gets the focus ring; a Back / swipe navigation can no
    longer reopen the drawer by itself; shell buttons centre their icon and label (Button's `bare`
    variant resets `align-items`); the paused banner shows a failed resume (Q7); content keeps
    `DashboardLayout`'s 200 px bottom padding for the kebab menus (Q6).

Verified: `pnpm typecheck`, `pnpm lint`, prettier, and a fresh code review. Not yet seen in a
browser by Code Claude (the owner's local env pointed at the production database at the time).

### Step 2 · Dashboard — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Files: `src/components/admin/ui/*` (the page pieces), `src/components/admin/dashboard/*` (page,
analytics panels and hook, phone storefront row, cleanup panel), `shell/AdminDialogContext.tsx` +
`shell/inertOutside.ts` (dialog focus trap), `Modal` `tone="admin"`, tokens `--admin-backdrop`,
`--admin-dialog-shadow`, `--admin-chart-1…5`.

Differences from the design, and why:

1. **Links**: every card, pipeline row and pill opens `/admin/orders` (Q1 lands with step 3).
2. **Copy**: "fulfillment" (the owner's American-spelling rule), not "fulfilment".
3. **Donut**: at most five slices; the rest become "Other" (Q8).
4. **Pipeline and cards while counts are unknown** show "–" (loading or failed), never 0.
5. **Analytics states**: the design's badges ("Setup needed", "Unavailable") over the existing copy.
   The footnote and its "Updated…" time show only with data.
6. **Phone storefront row** has the same four states as the menu switch (the design draws only
   "open"); while paused it offers Resume, next to the red banner.
7. **Dialogs**: `AdminConfirmModal` (admin look, busy labels "Pausing…" / "Resuming…" / "Clearing…").
   Focus stays inside: the admin goes inert, and so does whatever the root layout renders around it
   (skip link, cookie banner). The same now applies to the phone drawer (step 1 review minor).
8. **Removed** from the dashboard: the "Manage" hub cards and the old Purchases section (the
   menu switch, the paused banner and the phone row replace it).
9. Paragraphs pin their own 14 px: `globals.scss` gives every `<p>` the 16–18 px reading size.
10. **After review + Q7 / Q8 answers (2026-11-11):** "Other" in the donut lists the channels it
    holds, in the legend and in the chart's spoken description (Q8). Touch targets (Q7): the
    counts-error Retry and the paused banner's Resume are 44 px below 900 px (32 / 36 px from 900);
    the phone "All orders" link and the pipeline rows are 44 px tall. Still under 44 px on phone,
    as drawn: the Canceled / Refunded pills (links, ~26 px). Say if Q7's rule covers them.
    > **Design Claude, 2026-11-11:** yes, the rule covers every tap target, links included. Below
    > 900 px give the pills `min-height: 44px` (same pill look, more vertical padding, centred text).
    >
    > The "left for later" minors:
    > - Counts failed: hint **"Unavailable"** instead of "Loading…" (my spec was wrong; components.md fixed).
    > - Phone header description, footnote wording, 8 px country bars: **keep as built**. One
    >   rule for both sizes is better; I'll update the phone design to match.
    > **Code Claude, 2026-11-11: done.** Pills are 44 px tall below 900 px (centered, wider
    > padding), the drawn size from 900 px; cards say "Unavailable" after a failed read
    > (`AttentionCard` `failed` prop).
11. **Owner review fix (2026-11-11):** after a mouse click a menu item kept focus, and the next key
    press (an arrow key to scroll) made the browser draw the keyboard ring on it. Menu items and the
    wordmark now drop focus after a pointer click (`shell/blurOnPointerClick.ts`); Enter from the
    keyboard keeps focus and the ring. Checked in a browser both ways.
    > - Dialog focus edge cases: leave until something can trigger them.

Verified: `pnpm typecheck`, `pnpm lint`, prettier, and in a real browser on the dev database
(1440 px and 390 px): no console errors, no horizontal scroll on the dashboard, Tab stays inside the
cleanup dialog and the drawer, Escape closes both and focus returns to the opener. Seen in passing,
not part of this step: `/admin/users` is 617 px wide on a 390 px phone (its table; step 9).
