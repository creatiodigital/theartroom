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
| 7 | Invoices | invoices (spec: invoices.md) | Designed · approved by owner | Adds totals cards, Order column, totals row (NEW, approved). Invoice detail page: still to design. |
| 8 | Payouts | payouts (spec: payouts.md) | Designed · approved by owner | Adds export, waiting reminder, summary, filters, totals row (NEW, approved). |
| 9 | Users | users (spec: users.md) | Designed · approved by owner | UI only + NEW type filter (approved). |
| 10 | Exhibitions | exhibitions (spec: exhibitions.md) | Designed · approved by owner | UI only, no logic changes. |
| 11 | Print presentations | print-presentations (spec: gallery.md §1) | Designed · approved by owner | UI only. |
| 12 | Content + editors (landing, announcements, gallery selection, `[slug]`) | content, content-slideshow, content-editor (spec: gallery.md §2) | Designed · approved by owner | UI only, plus Discard + unsaved-state in the save bar (NEW, approved). Do as 12a list page, 12b sortable lists + announcements, 12c editor. |
| 13 | API reference (the only remaining route: no settings page exists; analytics and dev cleanup are on the dashboard) | api-reference (spec: developer.md) | Designed · approved by owner | UI only + NEW Developer link at the foot of the menu. Can be done any time after step 3. |
| 14 | **Artist shell**: light artist variant of the admin shell for `/dashboard/*` (not login); impersonation card in the menu + 3 px red top line replaces the red bar | artist-home (spec: artist.md §0) | Designed · approved by owner | Reuse the admin shell pieces, no copy. UI only. |
| 15 | Artist home + Artwork library | artist-home, artist-artworks (spec: artist.md §1–2) | Designed · approved by owner | UI only. |
| 16 | Artwork editor (`ArtworkEditForm`) | artist-artwork-edit (spec: artist.md §3) | Designed · approved by owner | UI only; same sections/conditions. Also used by admin edit, check both. |
| 17 | Profile, Payouts, Exhibition settings | artist-profile, artist-payouts, artist-exhibition-settings (spec: artist.md §4–6) | Designed · approved by owner | UI only. |
| 18 | 3D editor: toolbar (`editview/Menu`) + every panel, via one shared `EditorPanel` shell | editor-3d, editor-3d-panels (spec: editor3d.md) | Designed · approved by owner | Nothing inside the three.js canvas changes. UI only + NEW editing pill, lamp picker grid, folding benches (approved). Do after step 17. |
| 18b | Wall view: left panel, add bar, right panels (`wallview/LeftPanel`, `CreatePanel`, `RightPanel`) | wall-view, wall-view-panels (spec: wallview.md) | Designed · approved by owner | The wall itself does not change. UI only + approved: Layout/Look tabs, width/height sliders removed. Reuse the 3D editor's pieces from step 18. Do as 18b-1 left panel + add bar, 18b-2 right panels. |
| 19 | **Lucide → Phosphor, whole site**: swap the name→icon map in `components/ui/Icon/Icon.tsx` (light weight, size as today), then the ~25 files that import `lucide-react` directly; remove `lucide-react` and `ICON_STROKE_WIDTH` when nothing uses them | — | Approved by owner | Do after step 18 so the editor and the public site switch together. Check every public page and the 3D room afterwards. |
| 20 | Visitor 3D room: one top-right **menu button** (Sound, How to move around, Leave exhibition) replaces the X and the bottom-right buttons; labelled **Exit wall view** button top-left in wall view | visitor-room-menu, visitor-wall-exit (spec: visitor-wallview.md) | Built | Public side, independent of the admin work: can be done any time. See Built notes. |

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
