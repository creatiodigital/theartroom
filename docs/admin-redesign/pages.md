# Pages

Status: **To design** → **Designed** → **Built** → **Approved**.
Code Claude updates "Built" + notes; the owner sets "Approved".

## Build order

Do these in order, one PR each.

| # | Step | Design | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Shell**: tokens, Phosphor check, `AdminLayout`, `AdminSidebar`, `AdminNavItem`, `AdminTopBar` + drawer, `StorefrontSwitch`, `PausedBanner`, `usePurchasesPaused`. Switch **every** admin page from `DashboardLayout` to `AdminLayout` and delete their back links. Page bodies stay as they are. | dashboard, states, phone, phone-menu | Built | Biggest visible win: every page gets the new frame at once. See Built notes. |
| 2 | **Dashboard** body: `AdminPageHeader`, `Panel`, `AttentionCard`, `PipelineList`, `BarList`, `DonutChart`, analytics states, cleanup panel, `ConfirmModal` admin look. Remove the "Manage" hub cards (the menu replaces them). | dashboard, states, phone | Designed | Analytics data unchanged (`AnalyticsSection` logic). |
| 3 | Orders list | Orders tabs + table | To design | Sets the pattern for every list page (filter bar, table, badges, empty state). |
| 4 | Order detail | | To design | |
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
