# Pages

Status: **To design** → **Designed** → **Built** → **Approved**.
Code Claude updates "Built" + notes; the owner sets "Approved".

## Build order

Do these in order, one PR each.

| # | Step | Design | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Shell**: tokens, Phosphor check, `AdminLayout`, `AdminSidebar`, `AdminNavItem`, `AdminTopBar` + drawer, `StorefrontSwitch`, `PausedBanner`, `usePurchasesPaused`. Switch **every** admin page from `DashboardLayout` to `AdminLayout` and delete their back links. Page bodies stay as they are. | dashboard, states, phone, phone-menu | Built | Biggest visible win: every page gets the new frame at once. See Built notes. |
| 2 | **Dashboard** body: `AdminPageHeader`, `Panel`, `AttentionCard`, `PipelineList`, `BarList`, `DonutChart`, analytics states, cleanup panel, `ConfirmModal` admin look. Remove the "Manage" hub cards (the menu replaces them). | dashboard, states, phone | Built | Analytics data unchanged (`AnalyticsSection` logic). See Built notes. |
| 3 | Orders list | orders (spec: orders.md §1) | Built | Sets the pattern for every list page. Closes Q1 (`?stage=`). Read counts/rows from the shell (Q2). |
| 4 | Order detail | order-detail (spec: orders.md §2) | Built | Re-layout only: keep every action, guard and confirm as today. |
| 5 | Edition sales | edition-sales (spec: sales.md §1) | Built | Adds summary cards + status filter (NEW, approved). |
| 6 | Gift orders | gift-orders (spec: sales.md §2) | Built | Adds kind filter, Hide delivered, row ⋮ menu (NEW, approved). |
| 7 | Invoices | invoices (spec: invoices.md) | Built | Adds totals cards, Order column, totals row (NEW, approved). Invoice detail page: still to design. |
| 8 | Payouts | payouts (spec: payouts.md) | Built | Adds export, waiting reminder, summary, filters, totals row (NEW, approved). |
| 9 | Users | users (spec: users.md) | Built | UI only + NEW type filter (approved). |
| 10 | Exhibitions | exhibitions (spec: exhibitions.md) | Built | UI only, no logic changes. |
| 11 | Print presentations | print-presentations (spec: gallery.md §1) | Built | UI only. |
| 12 | Content + editors (landing, announcements, gallery selection, `[slug]`) | content, content-slideshow, content-editor (spec: gallery.md §2) | Built (12a, 12b, 12c) | UI only, plus Discard + unsaved-state in the save bar (NEW, approved). Do as 12a list page, 12b sortable lists + announcements, 12c editor. |
| 13 | API reference (the only remaining route: no settings page exists; analytics and dev cleanup are on the dashboard) | api-reference (spec: developer.md) | Built | UI only + NEW Developer link at the foot of the menu. Can be done any time after step 3. |
| 14 | **Artist shell**: light artist variant of the admin shell for `/dashboard/*` (not login); impersonation card in the menu + 3 px red top line replaces the red bar | artist-home (spec: artist.md §0) | Built | Reuse the admin shell pieces, no copy. UI only. See Built notes. |
| 15 | Artist home + Artwork library | artist-home, artist-artworks (spec: artist.md §1–2) | Built (15a, 15b) | UI only. See Built notes. |
| 16 | Artwork editor (`ArtworkEditForm`) | artist-artwork-edit (spec: artist.md §3) | Built (16a, 16b) | UI only; same sections/conditions. No admin editor exists: the form's other user is the wall view's View details overlay (Q109). See Built notes. |
| 17 | Profile, Payouts, Exhibition settings | artist-profile, artist-payouts, artist-exhibition-settings (spec: artist.md §4–6) | Designed · approved by owner | UI only. |
| 18 | 3D editor: toolbar (`editview/Menu`) + every panel, via one shared `EditorPanel` shell | editor-3d, editor-3d-panels (spec: editor3d.md) | Designed · approved by owner | Nothing inside the three.js canvas changes. UI only + NEW editing pill, lamp picker grid, folding benches (approved). Do after step 17. |
| 18b | Wall view: left panel, add bar, right panels (`wallview/LeftPanel`, `CreatePanel`, `RightPanel`) | wall-view, wall-view-panels (spec: wallview.md) | Designed · approved by owner | The wall itself does not change. UI only + approved: Layout/Look tabs, width/height sliders removed. Reuse the 3D editor's pieces from step 18. Do as 18b-1 left panel + add bar, 18b-2 right panels. |
| 19 | **Lucide → Phosphor, whole site** (front and back), remove `lucide-react` | — (spec: phosphor.md) | Approved by owner · **do next, right after step 20** | Icons only. Mapping table in phosphor.md. `grep -r lucide src` must be empty at the end. |
| 20 | Visitor 3D room: one top-right **menu button** (Sound, How to move around, Leave exhibition) replaces the X and the bottom-right buttons; labelled **Exit wall view** button top-left in wall view | visitor-room-menu, visitor-wall-exit (spec: visitor-wallview.md) | Built | Public side, independent of the admin work: can be done any time. See Built notes. |
| 21 | Follow-up (server): re-inviting a user who already signs in sends a "set your password" link instead of replacing their password (Q37) | — | Approved by owner | After the admin redesign. Small, behaviour change. |

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

### Step 3 · Orders list — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Files: `src/components/admin/orders/index.tsx` + `Orders.module.scss`, `src/app/admin/orders/page.tsx`
(Suspense), new pieces `ui/StageTabs`, `ui/Callout`, `ui/SearchField`, `ui/DataTable`, `ui/EmptyState`,
Geist Mono as `--font-admin-mono` (its own variable: public pages already read `--font-mono`),
`Button` gains a `tabIndex` pass-through (roving tabindex in the tabs).

1. **`?stage=<Bucket>`** selects the tab (`router.replace`, no history entries; anything else → New).
   Dashboard cards, pipeline rows and pills link with it (refund owed → Canceled, where those
   orders sit). Closes Q1.
2. **Rows come from the shell** (Q2): the shell's one `listOrders()` feeds the menu badge, the tab
   counts and the list; it re-reads on arriving here, and the previous rows stay on screen meanwhile.
3. **Search** spans every stage (Q9): no tab looks selected, the callout becomes today's line
   ("N orders matching “x” — across every stage."), "Clear search" after the count, and the empty
   result keeps today's hint. Clicking a tab ends the search.
4. **Phone cards** are the same `<tr>` restyled with CSS grid (one copy in the DOM, so screen readers
   and e2e locators see one row): ref + total / items / buyer / hold or payout / full-width button.
   The date and email hide there.
5. **Needs-attention reason** under the date (Q10): Payment failed / Authorization canceled / Needs a look.
6. **Hold line** spelled out: "Hold 1 day · ~6 days left" / "Hold expired" (tooltips kept).
7. **Payout column** keeps today's text ("9d since delivered · 5d to safe window").
8. **Replacement badge** reads "Replacement" (×n); `e2e/order-reorder.spec.ts` updated to match.
9. Tab accessible names stay "To place at TPS 6" (the step circle is hidden from screen readers), so
   the specs' tab lookups are unchanged.

Verified: typecheck, lint, prettier; browser (dev DB, 1440 / 390): tabs, arrow keys, `?stage=`, search,
empty search, phone cards, no horizontal scroll, no console errors. e2e for the list
(`order-payout-bucket`, `order-reorder`, `order-capture-place`) not run yet: they need port 3001 free.

### Step 4 · Order detail — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Files: `src/components/admin/orders/detail/*` (replaces `OrderDetail.tsx`): `AdminOrderDetail.tsx` holds
every state, handler, guard and dialog (moved verbatim: all 256 lines of the old state/handler block are
in it), plus render-only sections (header, warnings, progress + next step, items, pay the artists, TPS
placement, timeline, buyer, money, invoice, recovery, test data). New pieces: `AdminBreadcrumb`,
`StatusPill`, `ProgressSteps`, `CopyField` (+ `CopyButton`). `AdminConfirmModal` gains `warning` and
`cancelLabel`; all six dialogs use it (titles, messages and labels unchanged). `bucketOf` accepts the
three fields it reads (type change only).

1. **Renamed per orders.md**: "Refund buyer (€X)" → "Refund the buyer…", "Re-order (reprint)" →
   "Reprint as a replacement…". The Refund-needed callout's "Refund the buyer" opens the same refund
   panel, scrolls to it and focuses its reason. e2e updated (`order-refund`, `order-cancel-refund-creditnote`,
   `order-reorder`); `invoice-ui` now finds the number inside the Invoice panel (it moved after the timeline).
2. **Warnings**: emoji dropped; "the Danger zone below" → "the Test data panel below" (the panel's new
   name; it exists only outside production, as before). Hold title from orders.md, today's body after it.
3. **Invoice badge** (Q12): one badge: Voided (credit note) / Email failed (this visit) / Issued. "Send
   invoice again" keeps its label (the design says "Send again").
4. **Money**: for carts, Artist cut, Gallery cut and Production are summed from the lines (the old page
   showed them only per line). State line wording is new (Q28).
5. **Next step sentence** per stage is new copy, except "To place" (Q28). Delivered links to
   "Pay the artist(s)" below.
6. **Narrow desktop**: two columns from 900 px leave the main column ~256–450 px next to the menu, so
   copy fields, item lines and the timeline use container queries. If it feels cramped, moving the
   switch to 1100 px is one line.
7. Header thumbnail is `object-fit: contain` (never crops the artwork); future step numbers use
   `--color-text-secondary` (the drawn #999 fails contrast); the safe-window glyphs became icons.
8. Kept as today (Q15): Cancel trigger visible with its panel open; Pay/Refund/Invoice not gated by a
   terminal payment; cart Pay ignores onboarding; "Send credit note again" without confirm.

### Step 5 · Edition sales — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Plan: `docs/superpowers/plans/2026-11-11-admin-edition-sales.md` (its contract and fallbacks; Q16–Q19 open).
Files: `src/components/admin/edition-sales/*`, new `ui/StatCard`, `ui/AdminSelect`, `ui/ListPanel`,
`ui/OffPlatformKindMark`; `AdminConfirmModal` gains `size="wide"` and `icon={null}`; `StatusPill` gains
green / amber / info / gray tones and a `tag` shape; `EmptyState` gains `action`.

1. **Kept**: every state, effect and handler (checked line by line: the only differences are the
   artwork / variant filters, which moved into the URL), both dialogs' copy, every form id and check.
   `e2e/edition-off-platform.spec.ts` passes unchanged.
2. **NEW, built**: summary cards (Sold / Reserved / Off-platform set the Status filter, pressing again
   clears it; "Not mirrored in TPS" amber above 0, not clickable per Q18's fallback); Status filter;
   filters in the URL (`?artwork=&variant=&status=`, keeps `?gift=`); empty / no-match / failed states;
   phone cards on the same `<tr>` with a "Sort by Date · Number" bar.
3. **Release** (Q16 answer (b)): on every order-less row except off-platform ones, which the server always
   refuses. That refusal now lives in `lib/editions/releaseRefusal.ts` (same checks and messages, used by the
   action) and `edition-off-platform.spec` checks it there, plus that gift rows show no Release.
   Off-platform rows: kind mark + label + note, pill "Off-platform" (Q17). Count "{n} copies" /
   "{v} of {n} copies" (Q19).
4. **Sort**: the column name is the button's name and `aria-sort` carries the direction (was "Sort by
   date (desc)").
5. One status per copy: anything with an off-platform kind counts as Off-platform, so the three cards
   always add up to the ledger.

Verified: typecheck, lint, prettier; `edition-off-platform` e2e 1/1 (before and after Q16); browser (dev DB,
1440 / 390, read-only): no console errors, no horizontal scroll, the Sold card sets `?status=sold`.

### Step 6 · Gift orders — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Plan: `docs/superpowers/plans/2026-11-11-admin-gift-orders.md` + answers Q20–Q23. Files:
`src/components/admin/gift-orders/*`, new `ui/RowMenu`, `ui/SegmentedControl`, `ui/AdminCheckbox`;
`CopyButton` gains `icon` and shows "Copied" only once the clipboard write succeeds; `EmptyState.text`
takes a node; `Button` passes `aria-disabled`; token `--admin-menu-shadow`.

1. **Kept**: every state, effect and handler (checked line by line; the only move is the "Copied" state
   into `CopyButton`), all five dialogs (now `AdminConfirmModal`), the next-step rules, Copy address text.
2. **NEW, built**: Kind filter (`?kind=`), Hide delivered (on by default, remembered per browser, hides
   delivered rows only), count, ⋮ row menu (Edit tracking link on Shipped / Delivered, Cancel gift
   order…, Delete… on canceled rows), Edit tracking link dialog backed by the new server action
   `updateOffPlatformTrackingUrl` (Q21 (a): admin guard, refuses canceled, Shipped / Delivered only,
   empty clears; stage and dates untouched).
3. **Q20**: "Paid {date}" / "Not paid" / "No fee", amount line, **Mark paid…** under "Not paid" (today's
   dialog); note under "city, country"; the full address only through Copy address.
4. **Q23**: "Canceled" everywhere, including four server messages that show in this page's dialogs
   ("This order is canceled — …", "Already canceled.", "Only canceled gift orders can be deleted …").
5. **RowMenu** follows its trigger on scroll / resize (fixed position, opens upward when short of room
   below, per Q6), so a click that first scrolls the item into view still lands.
6. e2e `edition-off-platform.spec`: Cancel through the ⋮ menu, "Canceled", `/tracking/i`.

Verified: typecheck, lint, prettier; `edition-off-platform` e2e 1/1; browser (dev DB, 1440 / 390,
read-only): no console errors, no horizontal scroll (the dev DB had no gift orders; the e2e run covers
rows, menu and dialogs).

### Q24 fix — 2026-11-11 (own commit after step 6)

`deleteCancelledOffPlatformOrder` refuses a canceled gift whose edition number is still bound to it (canceled
after production): "This gift was canceled after production, so its edition number stays used. It can’t be
deleted." No other change. `edition-off-platform.spec` now tries Delete on its canceled-after-shipping gift and
expects the refusal and the order to remain.

### Step 7 · Invoices — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Plan: `docs/superpowers/plans/2026-11-11-admin-invoices.md` + answers Q25–Q27. Files:
`src/components/admin/invoices/index.tsx` + new `Invoices.module.scss`, `ui/DataTable.module.scss` (`tfoot`),
`app/admin/invoices/page.tsx` (title "Invoices — The Art Room Admin"), `ui/Button` (`prefetch` pass-through),
`orders/detail/InvoicePanel.tsx` (prefetch off).

1. **Kept**: the whole logic block (state, auth redirect, `load`, both exports with their file names, busy
   labels, disabled rules and `alert()`s, Hide voided) is byte-identical to before (diffed); the filters'
   handlers, the year-clears-month rule, Clear filters, the three empty messages and the PDF URL are
   today's. No server, query or route change.
2. **NEW, built**: totals cards under a visible caption "Totals for {period}" (+ "· matching “x”"), all four
   at 28 px (Q25 (a), Q32: what the exports would export; never Hide voided), the Order column
   (mono link to the order), the `tfoot` totals row for the rows shown ("Total for {November 2026 | 2026 |
   all years}", "· matching “x”" while searching), the footnote always shown.
3. **Number cell**: mono number + Invoice / Credit note tag; a voided invoice is struck through with "Voided by
   {credit note}"; a credit note says "Cancels {invoice}" when known. The number's text appears once per
   row (the PDF link names it through `aria-label` only), so `invoice-ui.spec`'s strict lookup still works.
   A voided invoice's number does appear twice on the page (its row and its credit note's "Cancels" line).
4. **Order** stays correlative, as the CSV and ZIP (Q26). Default All years; Clear filters as a text button;
   `alert()` on export failure; the per-keystroke search (Q27).
5. **Loading**: "Loading…" only while there is nothing to show; a reload keeps rows, cards and totals on
   screen with the list `aria-busy`. A failed first load: red Callout, cards "–", no empty message (today said
   "No invoices yet." under the error); the toolbar stays, since a filter change re-runs the load.
6. **PDF links never prefetch** (Q33): the register's PDF links and the order page's "See invoice" / "See
   credit note" pass `prefetch={false}`, so production never fetches a PDF before the click.
7. **Phone** (< 900 px): the same `<tr>` as cards (number + tag, client, date and order, Base / VAT and Total,
   full-width PDF); the totals row becomes a summary block.

Verified: typecheck, lint, prettier; the logic block diffed against HEAD; `e2e/invoice-ui.spec.ts` 1/1 on
port 3001 (again after Q32 / Q33); browser on my own `pnpm dev` (dev DB, read-only), 1440 and 390 px: cards = the Total column =
the totals row = the exported CSV (€1,303.82, 3 rows), Year enables Month and clearing it clears Month,
Nov 2026 empty state, no-match message + Clear filters, Hide voided, no console errors, no horizontal
scroll. The dev DB has no credit notes, so the "Voided by" / "Cancels" lines were not seen live.

### Step 8 · Payouts — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Plan: `docs/superpowers/plans/2026-11-11-admin-payouts.md`. Files: `src/components/admin/payouts/index.tsx`
+ new `Payouts.module.scss`, `app/admin/payouts/page.tsx` (title "Payouts — The Art Room Admin"), new
`src/lib/csv.ts` (the invoice register's two CSV field helpers, moved unchanged; `invoiceCsv.ts` imports
them), new `src/lib/payouts/payoutCsv.ts`, `ui/Callout` (`icon`).

1. **Kept**: the session redirect, `load()` and its effect are byte-identical; data is still
   `listArtistPayouts()` (no server change); today's empty message; the order link.
2. **NEW, built**: Export CSV (in the browser, from the filtered rows: Date paid, Artist, Artist email,
   Artwork, Source, Method, Transfer ID, Amount, Currency, Order); the waiting reminder (amber, HandCoins,
   only when the shell's delivered-unpaid count > 0, singular / plural, link to Orders · Delivered);
   summary cards (Released, Payouts, Via Stripe; 28 px like Invoices); Year (default this year) and
   Artist filters; the totals row ("Total released in {year}" / "Total released").
3. **Method**: Stripe (info tag) with the transfer ID under it in mono 11 px, shortened in the middle, full
   ID on hover; Manual (gray tag). "· cart line" (was "· cart item").
4. **One set of rows** (year + artist) feeds the cards, the count, the totals row and the CSV.
5. **States**: "Loading…"; a failed load → red Callout, cards "–", no empty message; filtered to nothing →
   "No payouts match these filters.".
6. **Phone** (< 900 px): the same `<tr>` as cards (date + amount, artist, artwork, method, order); the
   totals row becomes a summary block.
7. **CSV safety**: artist-controlled text goes through the register's formula neutralization; CRLF, no
   BOM, as the invoice register. The invoice register's export is byte-identical before and after the
   helper move (exported on the dev DB both times).

Verified: typecheck, lint, prettier; logic diffed against HEAD; browser on my own `pnpm dev` (dev DB,
read-only) at 1440 and 390 px: cards = table = totals row = exported CSV, Year and Artist filters, no
console errors, no horizontal scroll. The dev DB has one payout (manual) and no delivered-unpaid orders,
so the Stripe tag with its transfer ID and the waiting reminder were not seen live. No e2e opens this page.

### Step 9 · Users — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Plan: `docs/superpowers/plans/2026-11-11-admin-users.md` + answers Q35–Q39. Files: `admin/AdminUsers/index.tsx`
+ new `Users.module.scss`, `admin/AddArtistModal/*`, `app/admin/users/page.tsx` (`<Suspense>`, title "Users —
The Art Room Admin"), new `ui/FeedbackBar`, `ui/PublishState`, `ui/initials.ts` (moved from `AdminUserCard`),
additions to `ui/AdminConfirmModal`, `ui/AdminSelect`, `ui/StatusPill`, `ui/RowMenu`; tokens
`--admin-published-dot`, `--admin-success-border`.

1. **Kept**: every state, effect, handler, request, refetch and confirm (incl. the type-CONFIRM delete), the
   Add user fields, validation and submit, the auth guard, today's success text "Invite email sent
   successfully!" (now in a dismissible bar, 4 s as before). The row menu's own open / close state moved into
   `RowMenu` (as Gift orders); the inline Featured handler became `handleToggleFeatured` (same request).
2. **NEW, built**: the Type filter (All / Artists / Admins, Curators only if any exist) in `?type=`; the count.
3. **Answers applied**: failed Publish / Featured show in a red bar with the server's text or "Couldn't update
   {name}. Please try again." (Q35); Impersonate only on artist rows (Q36); the Send invite dialog says "This
   replaces their current password with a new temporary one, sent by email." (Q37: always, since nothing
   loaded tells whether the user has signed in; the real fix is step 21); Add user / Create user /
   "Creating…" (Q38).
4. **Menu** (`RowMenu`, groups): Account (Send invite…, Impersonate / Impersonating), Profile (Publish /
   Unpublish, Set as featured / Remove featured), then Delete user… in red (super admin only). The trigger is
   "Actions for {name}". Sentence case: "Send invite email", "Delete user…", etc.; "Super Admin" stays.
5. **Dialogs** are `AdminConfirmModal` (focus trapped): they can't be closed while their request runs, and
   Create user is disabled while it runs (today a second press got a 409).
6. **Phone**: one card per user on the same `<tr>`; the page is 390 px wide at 390 (was 617 px).
7. **e2e**: both impersonation specs find the trigger by its new name and pick an *artist* (Q36 hides
   Impersonate elsewhere).

Verified: typecheck, lint, prettier; the logic diffed against HEAD (the changes listed above only);
`impersonation-session` + `impersonation-dashboard` 6 passed, 1 skipped (it needs two artists with
exhibitions; the dev DB has one); browser on my own `pnpm dev` (dev DB, read-only: menus and dialogs
opened and canceled) at 1440 and 390 px: filter and `?type=`, both row menus, the Send invite dialog's
sentence, the Add user dialog, no console errors, no horizontal scroll.

### Step 10 · Exhibitions — Built 2026-11-11 · committed after my checks (owner: steps 10, 11, 13 reviewed together later)

Plan: `docs/superpowers/plans/2026-11-11-admin-exhibitions.md`. Files: new `src/components/admin/exhibitions/`
(`index.tsx` = today's page guard, `ExhibitionsList.tsx`, `Exhibitions.module.scss`), `app/admin/exhibitions/page.tsx`
(renders it; still `'use client'`, Q47), `ui/Callout` (`role`); `admin/dashboard/AdminExhibitions.tsx` removed (moved).

1. **Kept**: today's logic (state, load, every handler and request, the delete dialog's CONFIRM rule and
   messages, the bake refusal notice) moved verbatim — diffed: the only removals are the kebab's open state
   and outside-click effect, which `RowMenu` owns now. The guard moved verbatim.
2. **Layout per exhibitions.md**: Exhibition (title link + "artist · space") · Status (Current green, Past
   gray, Draft outlined, other values blue) · On the site (Published / Unpublished dot, then today's "3D room
   ready, not switched on" marker or "3D room on") · Preview link · Changes ("Needs review" amber, the colour
   fix) · ⋮ "Actions for {title}".
3. **Menu** (`RowMenu`, groups Exhibition / 3D room / Preview / Delete exhibition…): every item's label rule
   and shown / disabled condition is today's; sentence case; hints "Publish the pending changes" (only when it
   publishes, Q40) and "Publish the exhibition first" (on the disabled 3D item). **Open 3D editor** joins the
   menu, as the spec lists (today only in the refusal notice; navigation only, Q41).
4. **Refusal notice** (a publish refused over the bake): not drawn; kept as the next row, now an amber
   `Callout` with `role="alert"` and today's text + Open 3D editor (Q41).
5. **Phone**: one card per exhibition on the same `<tr>`. The 200 px bottom padding stays (Content's menus).

Verified: typecheck, lint, prettier; logic diffed against HEAD; `bake-publish-gate` + `exhibition-state-markers`
15/15 on port 3001 (unchanged specs); browser on my own `pnpm dev` (dev DB, read-only: one menu opened and
closed) at 1440 and 390 px: menu groups and hints, Escape returns focus to ⋮, no console errors, no horizontal
scroll. Seen in passing: two "E2E Leak …" exhibitions from an older e2e run (≈ 2026-11-04) sit on the dev DB.

### Step 13 · API reference — Built 2026-11-11 · committed after my checks (owner: steps 10, 11, 13 reviewed together later)

Plan: `docs/superpowers/plans/2026-11-11-admin-api-reference.md`. Files: `app/admin/api-reference/*` (page title +
noindex, `ReferenceContent`, `SearchFilter` on `ui/SearchField`, SCSS), the shell's menu (`adminNav.ts`, `AdminNavItem`,
`AdminSidebar`, `AdminMenuDrawer`), tokens `--admin-code-param`, `--admin-code-type`.

1. **Kept**: the gate, `scanApiRoutes()` / `parseSchema()`, the three filters and the "No results matching …" state
   (diffed: identical). `SearchFilter` takes the text from `SearchField` instead of the event (same state and callback).
   The page's own "← Dashboard" link is gone (the menu replaces it).
2. **NEW menu link**: a **Developer** group at the foot of the menu (side menu and phone drawer), one item **API
   reference** (Code), 13 px, for admin and super admin only (the page's roles).
3. **Layout per developer.md**: header; sticky toolbar (from 900 px) with the search and the four counts as chips
   (endpoints / models / enums jump to their sections; a chip goes plain while its section is filtered out); endpoint
   panels with method badges and `:params` coloured; model cards (PK / UQ, types, defaults with today's tooltip; long
   models keep today's 320 px cap and scroll, Q87); enum cards. Defaults in secondary gray (the drawn #999 fails
   contrast, Q90).

Verified: typecheck, lint, prettier; logic diffed against HEAD; browser on my own `pnpm dev` (dev DB, read-only) at
1440 and 390 px: chips, search, the empty state, the menu link on the side menu and in the phone drawer, no console
errors, no horizontal scroll. No e2e opens this page.

### Step 12c · Page editor — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Plan: `docs/superpowers/plans/2026-11-11-admin-content-editor.md`. Files: `app/admin/content/[slug]/page.tsx` + SCSS,
new `ui/SaveBar`, opt-in props on the shared `ui/RichTextEditor` (`tone="admin"`, `richTextVariant`, `labelledBy`,
`describedBy`, `onReady`), `ui/ImageUploader` (`tone="admin"`, `note`) and `ui/Input` (`aria-describedby`), token
`--admin-save-bar-shadow`, new `e2e/admin-page-editor.spec.ts` (read-only: nothing is saved).

1. **Kept**: the guard, the banner upload / remove handlers and the save request are unchanged (diffed); uploads
   and removals still go live at once. The shared editor / uploader / input render exactly as before wherever the
   new props aren't passed (studio artwork editor, exhibition settings, profile, wall view dialog, landing slides,
   announcements).
2. **Layout per gallery.md §2c**: breadcrumb Content / {page}, h1 "{Page} page", "Last saved {date, time}"
   (`updatedAt`), View page ↗; panels with the label above and help under the field (Banner image only on Prints,
   with Replace / Remove and "JPG or PNG, up to 1 MB." — WebP is refused today, Q79); the toolbar in five labelled
   groups, 32 px buttons (44 on phones), arrow keys, sticky in the editor; the text in the public site's fonts and
   styles (the public RichText classes, About / legal in their page variant).
3. **NEW save bar** (approved): "Unsaved changes" when the title or text differs from what was loaded or last
   saved (the editor's own rewrite of the loaded text doesn't count); Discard asks, then restores title and text
   (no request); Save sends today's request, and "Saved" / Last saved / the baseline move only when the server
   accepts (today "Saved" showed even after a refusal, Q80); no warning on leaving (Q81). After a failed load the
   bar reads "Couldn't load this page. Reload before editing." and Discard is off; Save behaves as today (Q82).
4. **Found, not fixed (Q82, owner)**: a failed load opens an empty editor, and saving then blanks the live page;
   Remove has no confirm; the editor registers Link twice (a console warning on every editor).
5. **After Q80 / Q81 / Q82, 2026-11-11 (own commit):** a refused or unanswered save shows in the save bar itself: the
   status turns red, `role="alert"`, "Not saved. Please try again.", until the next edit (back to "Unsaved changes") or
   the next accepted save (Q80 follow-up; `SaveBar` `failed`, its `error` prop is gone). With unsaved changes,
   reloading, closing the tab or typing a URL raises the browser's own "Leave site?" (`beforeunload`, Q81); menu and
   breadcrumb links are not caught yet. A non-2xx or failed load shows the header, View page ↗ and a red callout
   "The page could not be loaded." (`role="alert"`), with no banner, title, editor or save bar (Q82), so an error body
   can no longer be saved over the live page. Remove's confirm and `link: false` wait for the next pass.
   Verified: the page's e2e (now with a `beforeunload` test) on port 3001; the refused save and the failed load seen
   in a browser with faked 500s (route interception), nothing saved.

Verified: typecheck, lint, prettier; logic diffed against HEAD; the shared components' removed lines are only two
imports (extended) and two defaults that now sit behind `tone`; the new spec 7/7 (one locator fixed: the title
field by its role, as its panel is also named "Page title"); browser on my own `pnpm dev` (dev DB, read-only) at
1440 and 390 px: Prints and About editors, "All changes saved" on open, the studio profile's editor unchanged, no
console errors, no horizontal scroll.

### Step 12b · Sortable lists + Announcements — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Plan: `docs/superpowers/plans/2026-11-11-admin-content-lists.md`. Files: new `ui/SortableList` (the one dnd-kit list both
pages use), `app/admin/content/landing/page.tsx` + SCSS, `admin/GallerySelection/{index,SelectionList}.tsx` + SCSS,
`app/admin/content/gallery-selection/page.tsx`, `app/admin/content/announcements/page.tsx` + SCSS, the edit page
`announcements/[id]/page.tsx` (breadcrumb only), `e2e/gallery-selection-admin.spec.ts` (one line).

1. **Kept**: each page's logic in place and diffed against HEAD: the landing page's 232 lines differ only by the
   sensors block (now in `SortableList`, same sensors, collision rule, strategy, drag style); gallery selection's
   load / reorder / remove and picker mount, the announcements' gate / load / create / delete and the four status
   texts are unchanged. Delete dialogs moved to `AdminConfirmModal` with their messages. The slide editor and the
   Add artworks picker keep today's dialogs (Q77).
2. **Layout per gallery.md §2a / §2b**: breadcrumbs Content / Landing page · Gallery selection · Announcements ·
   Announcements / {title} (replaces "← Back to Announcements", Q4); headers with View homepage ↗ (Gallery
   selection: View Prints page ↗, Q70) and the primary action; rows with a drag handle ("Reorder {title}"),
   position, thumbnail, title + line, Edit / trash or Remove; the keyboard footnote (the keyboard sensor was
   already on). Announcements: photo, title, status ("On the homepage" green, the rest gray), Edit, trash.
3. **Phone**: two-line rows, 44 px controls, `touch-action: none` on the handle (Q72; check on a real phone).
4. **Found, not fixed (Q74, owner)**: reorder-then-edit can undo the move; an image uploaded to an unsaved slide
   goes live at once; reorder / save / delete ignore the server's reply; a failed slide load crashes the page;
   deleting a slide leaves its R2 images; gallery selection fails silently.

Verified: typecheck, lint, prettier; logic diffed against HEAD; `gallery-selection-admin` + `gallery-selection`
16/16; browser on my own `pnpm dev` (dev DB, read-only: no drag, nothing pressed) at 1440 and 390 px: breadcrumbs,
headings, handle names, the announcement statuses, the edit page's breadcrumb, no console errors, no horizontal
scroll.

### Step 12a · Content list — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Plan: `docs/superpowers/plans/2026-11-11-admin-content-list.md`. Files: new `src/components/admin/content/`
(`index.tsx` = today's page guard, `ContentList.tsx`, `Content.module.scss`), `app/admin/content/page.tsx` (renders
it; still `'use client'`), `ui/Panel` (`flush`); `admin/dashboard/ContentManagement.tsx` removed (only the page used it).

1. **Same nine routes**, no data and no conditions, as today (every admin sees all nine; Q66). The table with a
   one-item ⋮ menu becomes three panels of whole-row links: Home & curation (Landing page, Announcements,
   Gallery selection), Pages (About us, Prints), Legal (the four policies). Sentence case.
2. **Hints**: as drawn, checked against what each page edits, except Gallery selection: "The works on the
   Prints page" (the selection is the whole of `/prints`; Q67).
3. **Phone**: one column; panels side by side from 900 px.
4. Sub-page breadcrumbs come with 12b / 12c. With this step no admin page has a downward kebab left (Q69: the
   shell's 200 px bottom padding can go, as its own commit).
5. **After Q66 (b), 2026-11-11 (own commit):** the Gallery selection row is listed for super admins only (the page and
   its API let only them in); plain admins see eight rows. The guard passes the session's `userType`.

Verified: typecheck, lint, prettier; the guard diffed against HEAD; the nine hrefs identical to today's; browser
on my own `pnpm dev` (dev DB, read-only) at 1440 and 390 px: nine rows, a row opens its page, no console
errors, no horizontal scroll. No e2e opens this page.

### Step 11 · Print presentations — Built 2026-11-11 · committed after my checks (owner: steps 10, 11, 13 reviewed together later)

Plan: `docs/superpowers/plans/2026-11-11-admin-print-presentations.md`. Files: `admin/print-presentations/index.tsx`
+ its SCSS, `ui/Toggle` (opt-in `tone="admin"`, `id`, `aria-labelledby`, `aria-describedby`), `ui/StatusPill`
(`redSoft`), `ui/Bar` (`surface="gray"`), token `--admin-preview-tile`, `e2e/admin-print-presentations.spec.ts`.

1. **Kept**: the whole logic block (state, `load`, `saveSetting`, `toggleSwitch`, the render queue's
   start / row done / finished, every disabled rule) is byte-identical (diffed), and so is the `<RenderQueue>`
   wiring. The render pipeline, the studio canvas, capture, the preview component, the server actions and the
   API were not touched. Today's explanation is unchanged, now in a closed "How it works".
2. **Layout per gallery.md §1**: the "Shown on the site" switch row (no confirm, as today, Q59), the Artist
   select (now the admin's native select), the four counts as chips (Missing / Out of date tinted above 0),
   Render missing and out of date (stays visible but disabled while rendering), the status row with a bar
   and Stop; the table Work (104 px tile with today's render, "No render" / "No image") · Frame · Passepartout
   · Status · Render / Re-render.
3. **Reason lines** only where the code knows the reason: this visit's render result, and Not eligible =
   "Its shape is unknown." (in this list a work is ineligible only when its shape can't be read; Q60).
4. **e2e**: the Artist filter is a native select now (`selectOption(artistId)`), the count reads "n Up to
   date", the switch is found by its visible name.

Verified: typecheck, lint, prettier; logic and queue wiring diffed against HEAD; `admin-print-presentations`
9 passed, 1 skipped (no image work of unknown shape on the dev DB); browser on my own `pnpm dev` (dev DB,
strictly read-only: no switch, select or button touched) at 1440 and 390 px: chips, statuses, How it works,
no console errors, no horizontal scroll. The render status row is checked in code only (rendering writes).

### Step 19 · Lucide → Phosphor, whole site — Built 2026-11-11 (done right after step 10, owner) · not committed yet

Plan: `docs/superpowers/plans/2026-11-11-icons-phosphor.md` (inventory, mapping table, Q48–Q57). Three parts,
three commits after the owner's look: (1) `ui/Icon` map + public / studio / admin files, (2) the room (menu
help icon MouseSimple / HandTap by touch, the desktop and touch guides, the Sound & Video notice per
visitor-wallview.md §3), the editors / wall view chrome and the floor hint, (3) `lucide-react` removed
(package.json + lockfile: only its three blocks), `src/lib/iconConfig.ts` deleted, Phosphor's SSR entry in
`optimizePackageImports`.

1. **Same icons, Phosphor's drawing**: light at today's sizes; dot icons (⋮, drag handles) and check marks
   bold (Q48). `Icon` keeps every key (sound works store `volume-2` / `headphones`); `strokeWidth` → `weight`.
   Every icon is `aria-hidden` (Lucide added it by itself). Server-rendered files use the SSR entry.
2. **Inside the 3D canvas**: only the floor hint (an HTML overlay): `Cursor` + `MouseSimple` (regular, Q53)
   and the ripple aimed at the new tip (4 → 3.85 px). The sound object's 3D texture is untouched (Q52).
3. **SVGs**: pinch and double-tap restroked to Phosphor light's weight; `gesture-slide-vertical` and
   `phone-landscape` deleted (no other importer); `gesture-tap` / `gesture-slide-horizontal` stay (floor hint).
4. **Page weight** (Q55): +29 KB JS on every page measured (production builds, before vs after).
   **After Q55 (b), 2026-11-12 (own commit):** 17 unused `Icon` keys and 9 orphan SVGs removed: `/` 302 → 296 KB,
   `/exhibitions` 300 → 294 KB, `/prints` 306 → 300 KB.

Verified: typecheck, lint, prettier, no `lucide` left in `src` or `package.json`; production build (tree-shaking
works: no unused Phosphor icon in the output); 19 e2e specs that show icons, 92/92; the 3D suite: in its
default production mode 3 room tests fail on the Vercel analytics scripts (`/_vercel/*`, 404 outside Vercel,
nothing to do with this step), in dev mode 4/4; browser on my own `pnpm dev` (dev DB, read-only) at 1440 and
390 px across public pages, the artist studio, admin, the room (hint, menu, both guides) and the editor:
no Lucide left, no console errors, no horizontal scroll. Seen in passing (as before): the desktop guide's
"Drag, Swipe or Arrows" pill is narrower than its label. Docs note for Design Claude: README's Icons section
still says "Lucide stays on the public site".

### Step 20 · Visitor room menu + Exit wall view — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements` (not committed yet)

Plan: `docs/superpowers/plans/2026-11-11-visitor-room-menu.md`. Files: new
`src/components/exhibitions/view/RoomControls/` (`RoomMenu`, `ExitWallViewButton`, one SCSS module),
`exhibitions/view/index.tsx` and its SCSS (the X, the help button and the old Exit Wall View removed),
`scene/index.tsx` (`FloatingMuteButton` removed; a new `overlay` prop renders the menu outside the
3D canvas), `styles/mixins.scss` (the shared button look; the old `$room-button-bg` had no other users).
Nothing inside the three.js `<Canvas>` changed.

1. **Kept**: every handler, unchanged and in one place each: Sound is today's `toggleMute`; How to move
   around is today's `handleInfoClick` (the help window and the Sound & Video notice that follows it
   are untouched); Leave exhibition is today's `openExitPrompt('button')` (same dialog, same
   `/exhibitions` destination); Exit wall view is today's `requestArtworkViewExit()`. Esc and pinch
   still leave wall view; a click on the empty wall still does not.
2. **Items (after Q29 / Q30)**: the same menu in the room and in wall view. **Sound** is always listed
   (its switch is today's mute; a mute set before anything plays holds for the next sound or video,
   which the audio provider already applied to each one as it starts); it is left out only without
   WebGL. **How to move around**: not without WebGL, not on the bake page. **Leave exhibition**:
   always. Before the room has mounted the page renders the menu itself (no Sound there), so Leave is
   always reachable where the X was.
3. **Escape** closes the instructions window or the Sound & Video notice first (Q30); only the next
   Escape leaves wall view.
4. **Nothing reaches the room**: while the menu is open, a transparent layer catches the outside click
   (it closes the menu and does not walk or select a work); keys pressed in the menu don't walk; Esc
   closes the menu and does not also leave wall view. The menu closes if the leave dialog opens.
5. **Focus**: first item on open, back to the menu button on every close (the leave dialog's Stay
   returns there too). Arrows / Home / End move, Tab closes. Both buttons draw a focus ring for the
   keyboard only (white + dark, seen over any wall): the room's old buttons had none. Remove the
   `:focus-visible` block in `RoomControls.module.scss` if unwanted.
6. **Look**: per the spec (radius 10, not the wall-exit design's pill; the menu, not that design's old
   bottom-right buttons). On phones and tablets both buttons sit 8 px from the edges plus the safe
   area, today's rule for the room's corner buttons (the design shows ~14 px). Switch off track:
   `--color-toggle-off`. Item hover / keyboard focus: `--color-gray-20`.
7. **Sound & Video notice** (Q31): "…You can mute all sounds at any time with **Sound** in the menu, top
   right."; the two "Click · Mute / Unmute" rows are gone.
8. **Owner follow-up (2026-11-11, own commit):** the menu's Leave exhibition leaves at once, with no
   "Leave the exhibition?" dialog: the dialog was there because the single-click X was easy to hit by
   accident, and the menu is already two clicks. Walking out through the exit corridor still raises
   the dialog (Stay restarts at the entrance), unchanged.

Verified: typecheck, lint, prettier; browser on my own `pnpm dev` (dev DB, read-only, the Vivrière room):
after the Q29–Q31 answers, two rooms (with and without media): Sound listed and switching in both,
the same three items in wall view, Esc closing the help window and then the notice before leaving wall
view, the new notice text. Before them, 1440 px and 390 px touch: no old buttons left, menu open / closed, items, Esc / arrows / End / Tab and
focus return, outside tap closes, How to move around opens the guide (then the Sound & Video notice,
as today), Leave exhibition opens the dialog and Stay returns focus to the menu button. Wall view at
1440 px: Exit wall view top-left and leaving through it, the menu with Sound + How to move around, Esc
closes only the menu; at 390 px: Exit wall view top-left (8 px) and leaving through it. No console
errors, no horizontal scroll. Seen in passing, not part of this
step: the cookie banner sits above the leave dialog and covers its Stay / Leave buttons until consent
is given (fixed in its own commit).

### Step 14 · Artist studio shell — Built 2026-11-11 · branch `feat/AR-180-ui-admin-improvements`

Plan: `docs/superpowers/plans/2026-11-11-artist-shell.md` (contract, decisions, Q94–Q101). Files: new shared frame
pieces `admin/shell/Shell{Frame,Wordmark,Sidebar,TopBar,Drawer}` (`AdminLayout.module.scss` became
`ShellFrame.module.scss`), `AdminNavItem` (`tone`, `navItemClassName`), the admin bindings re-expressed on them
(`AdminLayout`, `AdminSidebar`, `AdminTopBar`, `AdminMenuDrawer`: same props and output), new
`dashboard/shell/*` (`StudioLayout` + `StudioRouteLayout`, `StudioSidebar`, `StudioTopBar`, `StudioMenuDrawer`,
`StudioMenuBody`, `ImpersonationCard`, `studioNav`, `useStudioShell`), new `app/dashboard/layout.tsx`, tokens
`--studio-*`, the six studio page components (wrappers and back links out); `DashboardLayout.tsx` / `index.ts` and
`ui/Logout` deleted (no users left; `DashboardLayout.module.scss` stays for its shared page classes, minus the frame
rules); e2e: two impersonation lines, two comments, new `studio-shell.spec.ts`.

1. **One frame, two tones, no copy.** `ShellFrame` holds what was generic in `AdminLayout` (session gate, loading
   screen, drawer state and effects, slots, content column, focus-ring scope); the admin keeps only its own parts
   (the impersonation-ending effect, verbatim; `AdminShellProvider`; `PausedBanner`). The wordmark's three copies are
   one `ShellWordmark`. The studio binds the same pieces with `tone="light"`.
2. **Mounted once** in `app/dashboard/layout.tsx`, so the menu and its user read persist across studio pages.
   `/dashboard/login` and `/dashboard/change-password` pass through bare (the forced first-login screen stays as
   today; Q100).
3. **Menu** per artist.md §0: Home, Artworks, Profile, Payouts (Phosphor light, fill when active). Home is lit on
   `/dashboard` and on an exhibition's settings; Artworks on the artwork editor. No Payouts dot: nothing the shell
   has knows the payouts state (Q98). The foot: avatar (photo, else initials), full name, **View my public page ↗**
   (new tab), Change password, Log out (today's `signOutAndVerify`).
4. **Name and photo** come from the user record through the RTK query Home already makes (no extra call on Home),
   re-read once on leaving Profile; the session name meanwhile or after a failure (Q96).
5. **Impersonation**: the red bar became the menu's card (`role="status"`, "Viewing as {name}", one line, **Stop
   impersonating**) plus a 3 px red top line; on phones a "Viewing as {name}" pill in the top bar opens the drawer.
   The condition and Stop are today's, verbatim (Stop navigates only after the impersonation has ended). The studio
   never ends an impersonation itself; going back to an admin page still does (`AdminLayout`'s effect, unchanged).
6. **Content width**: 1080 px for Home, Artworks and the artwork editor, 880 px for Profile, Payouts and Exhibition
   settings (the frame picks it from the path). Bottom padding stays 200 px until step 15's row menu (Q6 / Q101 d).
7. **Back links**: "← Back to Dashboard" and "← Back to Library" are gone (the menu lights the page). Home's
   "← Back to Admin Dashboard" for an admin in their own studio stays as a plain in-page link (Q99).
8. **Phone** (not drawn, Q94): light sticky top bar (stacked wordmark, the pill, 44 px menu button), white full-screen
   drawer with the card on top, 48 px items, the foot at the bottom; focus returns to whatever opened it.

Verified: typecheck, lint, prettier; the `AdminLayout` effect, Stop and `useEffectiveUser` diffed against HEAD
(identical); e2e on port 3001 (both impersonation specs, both logout specs, the studio page specs that load inside
the frame, the new `studio-shell.spec`): 88 passed, 2 skipped (they need data the dev DB lacks); browser on my own
`pnpm dev` (dev DB, read-only) at 1440 and 390 px: every studio page's active item and width, no horizontal scroll,
no console errors; the admin drawer pixel-identical to before, the admin side menu identical apart from counts still
loading in one shot.

### Step 15a · Artist Home — Built 2026-11-12 · branch `feat/AR-180-ui-admin-improvements`

Plan: `docs/superpowers/plans/2026-11-12-artist-home-artworks.md` (contract, decisions, Q102–Q108). Files:
`dashboard/index.tsx` + new `Home.module.scss`, `admin/shell/ShellFrame.module.scss` (studio bottom padding),
`DashboardLayout.module.scss` (the rules Home was the last user of: `.table` and its two refusal rules, five `kebab*`,
three `delete*`), `e2e/impersonation-dashboard.spec.ts` (two lines).

1. **Kept**: every state, effect, handler, request and condition (diffed: the only removals are the kebab's open state
   and its outside-click effect, which `RowMenu` owns; RTK's `isLoading` is read from the existing query). Delete
   exhibition… is shown to admins only, View exhibition is disabled while unpublished and opens in the same tab, the
   sync badge shows on published rows only, today's Space stays (Q102). The New exhibition dialog is today's (Q104).
2. **Layout per artist.md §1**: serif h1 **Hello, {name}** (EB Garamond 40/400, 32 on phones) + the drawn sub; three tile
   links (Artworks, Profile, Payouts; the design's copy; Payouts neutral, Q98); the **My exhibitions** panel (h2, "{n}
   exhibitions", New exhibition) with rows: 96×64 featured image (gray tile without one), the name linking to its
   settings, space · `PublishState` · Up to date / Pending changes, an outline **Edit 3D space** link, and ⋮
   "Actions for {name}" (`RowMenu`: View exhibition, Exhibition settings, Edit 3D space, then Delete exhibition…). Links
   go to the handlers' own URLs with prefetch off.
3. **Delete exhibition** is `AdminConfirmModal` with today's text (the warning line in the amber box); it can't be
   closed while the request runs (Q107). A failed create shows today's text in a red `Callout` (no emoji; Q104).
4. **States (not drawn, Q103)**: "Loading exhibitions…" during the first load (today the empty message showed then); a
   failed load = red `Callout` with today's sentence; empty = `EmptyState` with today's sentence.
5. **Phone**: one column of tiles; rows in two lines (image + text, then Edit 3D space and ⋮ at 44 px).
6. **Bottom padding**: with Home on `RowMenu` (it flips upward), no studio page has a downward menu, so the studio's
   content ends 56 px down (40 px on phones). The admin keeps 200 px until Q69.
7. **e2e**: `impersonation-dashboard` reads the exhibition names from the "My exhibitions" region's links and the
   greeting as the h1 "Hello, {first}".

Verified: typecheck, lint, prettier; logic diffed against HEAD; e2e on port 3001 (`impersonation-dashboard`,
`impersonation-session`, `studio-shell`, `artist-logout`, with 15b's specs: 27 passed, 1 skipped: the user-switch test
needs two artists with exhibitions, and it holds both changed lines, so their locators were run in the browser pass
instead: 6 names from the region's links, h1 "Hello, John"); browser on my own `pnpm dev` (dev DB, read-only) at 1440
and 390 px, as the artist and as an admin in their own studio: tiles, rows, badges, the last row's ⋮ opening upward,
Escape back to ⋮, New exhibition opened and canceled, the admin's Delete exhibition… dialog (on a faked row) opened and
canceled with no request, "Loading exhibitions…" and the failed Callout (route interception), the bottom padding
(56 / 40 px) on every studio page, no horizontal scroll, no console errors.

### Step 15b · Artwork library — Built 2026-11-12 · branch `feat/AR-180-ui-admin-improvements`

Same plan. Files: `dashboard/artworks/index.tsx` + `artworks.module.scss` (rewritten), `AddArtworkModal.tsx` + its
SCSS, `ui/SortableList` (`href`, `numbered`, `sortable`), `ui/StatusPill` (`dot`), `e2e/confirm-dialog.spec.ts` (one
line + comments).

1. **Kept**: every state, effect and handler (diffed: the only removal is the dnd-kit sensors block, now inside
   `SortableList`, same sensors; the hydration comment updated); the stored type filter, the 300 ms search, drag only
   while not searching, the slot-preserving reorder and its request; Add artwork's submit is byte-identical.
2. **Layout per artist.md §2**: header **Artwork library** + sub + **Add artwork**; a panel with the Type segmented
   control (today's filter) and the search; `SortableList` rows: handle, 64 px thumb, title (link to the editor),
   "type · year · technique" (technique as plain text), the green **Selling prints** tag where today says "Currently
   Selling", outline **Edit**, red trash "Delete {title}"; the keyboard footnote.
3. **Kept although not drawn (Q105)**: the "In: {exhibition} ×" chips with today's Remove confirm, the sound play /
   stop preview (now a real button, "Play {title}" / "Stop {title}"), a video's poster or first frame, contained (not
   cropped) images. The text tile's 7 px preview became the TextT icon, as the spec says.
4. **Dialogs**: Delete artwork? and Remove from exhibition? are `AdminConfirmModal` with today's sentences (errors in
   the amber box); Add artwork takes the admin dialog look (labels above, today's help, the admin select, Cancel /
   Create artwork). All three keep their confirm disabled and can't be closed while the request runs (Q107).
5. **States (Q106)**: loading = header + "Loading artworks…" (no toolbar: the stored filter must not reach the first
   render); empty = "No artworks yet." + "Click **Add artwork** to create your first one."; no match = today's sentence;
   searching hides the handles and the footnote.
6. **Phone**: two-line rows (56 px thumb), the search under the type control, 44 px targets, no horizontal scroll (the
   old 500 px Add artwork dialog is gone).
7. **e2e**: `confirm-dialog` finds the trash as `/^delete /i` (it is "Delete {title}" now).

Verified: typecheck, lint, prettier; logic diffed against HEAD (library and Add artwork); e2e on port 3001
(`confirm-dialog`, `studio-shell`, `limited-variant-delete-ui`, `artwork-exhibition-picker`, `artwork-section-picker`,
`gallery-selection-admin`: all passed, in the same run as 15a's); browser (dev DB, read-only) at 1440 and 390 px: 498
rows with thumbs, chips and Selling prints tags, Image filter, no-match search (handles hidden), a keyboard pick-up
cancelled with Escape sends nothing, the three dialogs opened and canceled, Play ⇄ Stop on a faked sound row, a stored
"image" filter reloads with no hydration warning, landing and gallery selection lists unchanged, no horizontal scroll,
no console errors.

### Step 16a · Artwork editor, frame and panels — Built 2026-11-12 · branch `feat/AR-180-ui-admin-improvements`

Plan: `docs/superpowers/plans/2026-11-12-artist-artwork-editor.md` (contract, decisions, Q109–Q117; owner answers in
questions.md). Files: `dashboard/artworks/edit/index.tsx` + new `ArtworkEditPage.module.scss`; `shared/ArtworkEditForm/`
`index.tsx` + SCSS, new `EditorPanel`, `SectionNav`, `sections.ts`, `ArtworkMediaManager` (render only),
`LimitedVariantsEditor` (one display-only callback); `ui/SaveBar` (`onCancel`, `form`, `width`, `failedMessage`);
`ui/AdminCheckbox` (`description`); six e2e lines.

1. **Two users, one form** (Q109): no admin page renders the editor. The studio page passes `variant="page"`; the wall
   view's View details overlay keeps the default `"overlay"` (its own h1 "Edit image" / "Edit text" / …, the same
   panels, and its own Cancel / Save changes row; no save bar, no list). `wallview/ArtworkEditModal` is untouched.
2. **Kept**: every state, effect, handler, request, validation and condition (diffed: the form's logic is identical
   apart from three new props; the variants editor gains only `onDirtyCountChange`; the media manager's logic is
   identical). The named render conditions equal today's expressions. Sections keep today's order; Printing
   restrictions / recommendations sit inside the Artwork image panel they already followed.
3. **Layout per artist.md §3**: breadcrumb Artworks / {title}, h1 the saved title, type + **Selling prints** (the
   library's rule); **On this page** (sticky, 190 px, hidden under 900 px, light scroll spy) listing only the panels that
   render; white panels with h2 18/700, labels above fields, help under, 44 px inputs; Featured and the exhibition boxes
   as `AdminCheckbox`; the uploader in its admin look (Replace / Remove); Supplementary media as a dashed area. The print
   sections keep their old inner look inside the new panels until 16b.
4. **Save bar** (Q110): "Unsaved changes" compares what a save would send with what was loaded (the editors' own
   rewrite of loaded text doesn't count; a picked or removed image and the variants editor's "Unsaved" count do; sound
   and video uploads save at once and don't). **Save changes** submits the real form (title check, Enter, scroll to
   the error unchanged); **Cancel** is today's. A refused save turns the bar red, "Not saved. Please try again.", until
   the next edit; if the new image was uploaded and the details refused, it reads "Not saved: the new image was
   uploaded, the details were not. Please try again." (owner, Q117). The server's reason stays in the red callout at the
   end of the form. Display-only lines added to the handlers: the baseline after a load and after Put on sale's reload,
   and what a refused save sent.
5. **Leave warning** (Q111): `beforeunload` while unsaved, as the page editor. In-app links aren't caught.
6. **Supplementary media drop** (Q116): left out. The upload function would take a dropped list, but today's two client
   checks (busy / at the limit, the picker's type filter) sit outside it: its own later step.
7. **e2e**: the editor's Save is "Save changes" (`limited-variant-delete-ui`, `artwork-exhibition-picker`,
   `artwork-section-picker`).

Verified: typecheck, lint, prettier; logic diffed against HEAD (page, form, variants editor, media manager); e2e on
port 3001 (`limited-variant-delete-ui`, `artwork-exhibition-picker`, `artwork-section-picker`, `studio-shell`,
`admin-page-editor`, `edition-off-platform`, `invoice-ui`): 24 passed; browser on
my own `pnpm dev` (dev DB; every save and upload intercepted, nothing written) at 1440 and 390 px: text, image (print
off, open, limited) and video artworks all open on "All changes saved" with the right panels in the list; title,
technique, Featured and a variant edit flip the bar and undoing returns it; a refused save turns it red and the next
edit clears it; the half-save sentence after a faked upload and a refused save; an empty title sends nothing; Enter
submits; "Leave site?" with unsaved changes; the overlay opened from wall view (Edit image, panels, Cancel / Save
changes) and canceled; the page editor's save bar and the invoices checkbox unchanged; no horizontal scroll, no console
errors. The dev DB has no sound work, so the Audio file panel was checked in code only.

### Step 16b · Artwork editor, print sales — Built 2026-11-12 · branch `feat/AR-180-ui-admin-improvements`

Same plan. Files: `shared/ArtworkEditForm/index.tsx` + SCSS (Print sales, the print-size box, the restrictions /
recommendations rows, Ready to sell, the print sizes dialog), new `LockNote` and `OptionChips`, `EditorPanel` (an
`aside` slot), `LimitedVariantsEditor` + SCSS (the variants table), `ui/ImageUploader` (opt-in top alignment), token
`--studio-note-surface`, `DashboardLayout.module.scss` (`.field`, no users left), one e2e line.

1. **Kept**: the form's logic is identical; every handler and `disabled` expression in the variants editor's render is
   today's (33 of 33); the restriction / recommendation groups keep their props and `handleToggle`, and a pressed chip
   is today's checked box, so the saved values are identical; the print switch is the admin `Toggle` with today's
   onChange and `disabled`.
2. **Print sales**: the panel's head carries the switch ("Enable this artwork for print sales"), today's sentence under
   it; the series-type lock as a grey row with a lock icon (`LockNote`), the locked series type as a read-only field
   with a "Locked" tag; the price with a € prefix; low resolution as an amber callout with today's lines.
3. **Print-size box** (Q113, owner): a neutral grey box (`--studio-note-surface` #f7f7f7, hairline border, dark text)
   beside the image: "Sell as print", today's sentences, the Smallest / Your max table, **More info on print sizes**
   (today's dialog, restyled). The image row is top-aligned as drawn; the Prints banner keeps its centered row.
4. **Printing restrictions / recommendations**: `<details>` rows with the drawn one-liners and Show / Hide options; the
   checkboxes are toggle chips (`aria-pressed`, a check while pressed; for restrictions pressed = offered, as today's
   checked boxes).
5. **Ready to sell**: text left, **Ready to sell** (dark) or **Unblock** (super admin) right, today's dialog.
6. **Edition variants** (Q114): one bordered table, head "Variant · Status"; each row's header is a button with today's
   badges as tags ("Currently selling", "{n} sold"); live variants open with "This variant is on sale and frozen." in a
   lock row; fields labelled, 44 px; Add variant / Apply saved variant with icons. The delete dialog stays the shared
   `ConfirmModal` (the wall view overlay has no admin dialog layer).
7. **e2e**: `limited-variant-delete-ui` finds "Add variant" without the "+".

Verified: typecheck, lint, prettier; logic diffed against 16a (form logic identical, the variants editor's 33 handler /
`disabled` expressions identical, chips fed today's checked values and `handleToggle`); e2e on port 3001
(`limited-variant-delete-ui`, `limited-variant-sheet-editor`, `artwork-exhibition-picker`, `artwork-section-picker`,
`admin-page-editor`, `studio-shell`, `variant-templates-scope`): 33 passed; browser on my own `pnpm dev` (dev DB, every
non-GET request refused locally, nothing written) at 1440 and 390 px: open edition (switch, the grey print-size box, a
restriction chip off and on again flips the bar and back, Ready to sell and print sizes dialogs opened and closed),
low resolution (switch off, amber note), limited edition (two live variants as frozen rows, the series lock), the Prints
banner editor unchanged, no horizontal scroll, no console errors. After the first look two fixes went in: paragraphs
pin their own size (the box at 13 px, the dialog at 14 px, not the site's 16–18 px), and the image row top-aligns as
drawn (opt-in, the banner keeps its centered row).
