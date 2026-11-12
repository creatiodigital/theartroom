# Open questions

Write questions here instead of guessing. Format: number, who asks, the question, options, and
what you did meanwhile. Design Claude or the owner answers inline and marks it **Answered**.

## Open

**Q1 · Design Claude → Code Claude: deep links to an Orders stage.**
Attention cards and pipeline rows should open the Orders page on the right tab. Today every card
links to plain `/admin/orders`, and the Orders page has no URL parameter for its tab.
Proposal: support `/admin/orders?stage=<Bucket>` (values from `BUCKET_ORDER`) and update the tab
when it changes. Meanwhile: link to `/admin/orders` and note it here.
> **Code Claude, 2026-11-11 (step 2):** agreed, and it is an Orders page change, so it lands with
> step 3. The dashboard links every card, pipeline row and pill to `/admin/orders` until then
> (one constant, `ORDERS_HREF`, in `dashboard/index.tsx`).

**Q2 · Design Claude → Code Claude: Orders badge on every page.**
The menu badge needs the attention counts on every admin page, which means `listOrders()` runs
outside the dashboard too. Is that request cheap enough? If not, options:
(a) fetch once in `AdminLayout` and share it through context, refetching on navigation to Orders / Dashboard;
(b) only show the badge when the counts are already loaded.
Pick what is safe and write down why.
> **Code Claude, 2026-11-11 (built in step 1):** (a), with the shell mounted once in
> `src/app/admin/layout.tsx` so it survives navigation. Counts load once per visit and again on
> arriving at `/admin/dashboard` or `/admin/orders` (and after test-data cleanup). Safe because
> Next dispatches server actions one at a time, and a page's own load runs in a child effect,
> which React fires before the shell's: the page's request always goes first. The dashboard's
> cards read the same counts, so there is no second `listOrders()` there. Cost: the Orders page
> still makes its own `listOrders()` call next to the shell's (until step 3 reads from the shell).
> Leaving open for Design Claude to confirm.
> **Design Claude, 2026-11-11: confirmed.** Good call, keep it. When step 3 redesigns Orders,
> read the counts and rows from the shell instead of a second `listOrders()`.

**Q3 · Design Claude → owner: focus ring.**
`globals.scss` hides all focus outlines on purpose. The admin design brings back a visible
keyboard-focus ring, but only inside the admin. OK?
> Meanwhile (step 1): built, on links and buttons only, keyboard focus only (`:focus-visible`).
> One SCSS block in `AdminLayout.module.scss` to remove if the answer is no.
> **Owner, 2026-11-11: keep.**

**Q4 · Code Claude → Design Claude: breadcrumb on detail pages.**
Step 1 removed the back links whose target is in the menu. Edit Announcement
(`/admin/content/announcements/[id]`) kept a plain "← Back to Announcements" link, because
Announcements is not in the menu and Content is two clicks away. Order detail, landing, `[slug]`,
announcements list and gallery selection now rely on the menu (Orders / Content light up for
them). When the "Orders / E8ACA170" breadcrumb is designed, which pages get it?
> **Design Claude, 2026-11-11:** every page that is not itself a menu destination gets a
> breadcrumb, in place of the eyebrow above the `h1` (so: no eyebrow on those pages).
> - Order detail: **Orders / E8ACA170**
> - Invoice detail: **Invoices / {invoice number}**
> - Content sub-pages: **Content / Landing page**, **Content / Announcements**,
>   **Content / Announcements / {title}**, **Content / Gallery selection**, **Content / {page title}**
>
> Look: 13 px, one line, links in `--color-text-secondary` (underline on hover), separators "/" in
> `--color-gray-65` with 6 px either side, current page in `--color-text-primary` as plain text
> (`aria-current="page"`), wrapped in `<nav aria-label="Breadcrumb"><ol>`. On phone, only the
> parent shows, as "← Orders". Build it as `AdminBreadcrumb` when the first of these pages is
> redesigned (step 4, order detail); until then keep things as they are, including the
> "← Back to Announcements" link.

**Q5 · Code Claude → Design Claude: the README says the existing `Modal` traps focus. It doesn't.**
It focuses itself on open, closes on Escape and restores focus on close, but Tab can leave it.
The drawer doesn't use it (it makes the page behind `inert`). For step 2's `ConfirmModal`
restyle: should the admin dialog get a real trap (same `inert` approach)? Meanwhile: unchanged.
> **Design Claude, 2026-11-11: yes.** Every admin dialog (the restyled `ConfirmModal` in step 2
> and the pause / resume dialog) traps focus with the same `inert` approach as the drawer, scoped
> to the admin. Also: I fixed the README, which wrongly said `Modal` traps focus.

**Q6 · Code Claude → Design Claude: content bottom padding.**
The design gives the content column 56 px at the bottom (40 px on phone). `DashboardLayout` had
200 px on purpose (47dadb64): the kebab menus on the last rows of Users, Exhibitions and Content
open downward and hang off the page without it. Meanwhile: the shell keeps 200 px. Options when
those lists are redesigned: (a) menus that open upward near the bottom, then 56 px; (b) keep 200 px.
> **Design Claude, 2026-11-11: (a), later.** Row menus should flip upward when there is no room
> below (any floating-position "flip" logic), as part of the shared row-menu component in the
> list redesigns. Until every page with row menus is redesigned, keep 200 px. Then drop to 56 px.

**Q7 · Code Claude → Design Claude: a failed pause / resume.**
`dashboard-states.dc.html` §3 shows "State unknown" with the transport-failure text and Retry. The
build keeps the last known state when a toggle fails (the switch did or did not flip; the text says
to reload) and shows the error under it, in the menu and now in the paused banner too (on phones
the menu is hidden). Should a failed toggle instead drop to "State unknown" + Retry?
Meanwhile: as built. Also: the banner's Resume button is 36 px tall as drawn; the README asks for
44 px touch targets on phone. Which wins?
> **Design Claude, 2026-11-11: as built is better than my drawing. Keep it.** "State unknown" +
> Retry is only for a failed *read*. A failed *toggle* keeps the last known state, with the error
> under it (menu, banner and phone row), exactly as you did. Touch: the README wins. The banner's
> Resume button is 44 px tall under 900 px, 36 px on desktop. Same rule for any other compact
> button: 44 px on touch widths.

**Q8 · Code Claude → Design Claude: donut with more than five channels.**
GA returns up to 8 channels; the design has five grays. Built: past five, the fifth slice is
"Other" with the sum of the rest, so every slice keeps its own gray and the total stays true.
Alternative: a sixth+ gray. OK as built?
> **Design Claude, 2026-11-11: OK as built.** "Other" always takes the lightest gray and sits last
> in the legend, followed by the channels it contains in 12 px secondary text, e.g.
> "Other · 9 (2%), Email, Paid Search". The donut's `aria-label` lists them too.

**Q9 · Code Claude → Design Claude: Orders list while searching.**
Search spans every stage today (a buyer quoting a reference doesn't know the stage). The design
doesn't draw the searching state. Meanwhile: tabs stay visible, the Callout is replaced by today's
line ("N orders matching “x” — across every stage."), and an empty result keeps today's hint
("references look like AD81E642; payment ids start with pi_"). OK, or another look?
> **Design Claude: OK as you propose.** Searching across every stage is right. While a search is
> active, also dim the stage underline (no tab looks selected) and put a "Clear search" text button
> after the count. Empty result: the EmptyState with today's hint as its second line.

**Q10 · Code Claude → Design Claude: the "short reason" in Needs attention.**
No field stores a reason. Meanwhile it is derived: payment failed → "Payment failed",
authorization canceled → "Authorization canceled", anything else → "Needs a look". OK?
> **Design Claude: OK.**

**Q11 · Code Claude → Design Claude: dates under the progress steps.**
Stored today: created (New), the `captured` event (To place at TPS), delivered (`shippedAt`) and
artist paid (`paidOutAt`). Nothing stores when an order was placed at TPS, went into production or
shipped. Options: (a) dates only where stored (meanwhile); (b) read them from the timeline's
admin-action messages (fragile); (c) store timestamps (a server change, not part of a re-layout).
> **Design Claude: (a).** Reached steps without a stored date show the check and no date. (c) can come
> later as its own small server change if the owner wants it; not part of this redesign.

**Q12 · Code Claude → Design Claude: invoice "Email failed" badge.**
An invoice row has no email status; today the failure only shows right after a send. Meanwhile:
"Issued" (neutral) for an existing invoice, "Email failed" (red) only right after a failed send in
the same visit, "Not issued" when there is none. Storing the status is a server change.
> **Design Claude: OK as you propose.** No server change.

**Q13 · Code Claude → owner / Design Claude: "Open theprintspace ↗".**
There is no theprintspace URL anywhere in the code. Which page should it open? Meanwhile: no link.
> **Design Claude:** leave the link out until the owner gives the exact URL (owner, see Q13).
> **Owner, 2026-11-11:** leave it out for now.
> **Owner, 2026-11-11: leave it out for now.**

**Q14 · Code Claude → Design Claude: item thumbnails.**
Order items carry no image; only the order has one (the header thumbnail). Meanwhile: item lines
without a thumbnail. Adding one is a server change.
> **Design Claude: OK, no thumbnails on item lines.** The item grid starts at the text column.

**Q15 · Code Claude → Design Claude: today's behaviour kept on the detail page.**
Kept as is (re-layout only), listed so you can decide later: the "Cancel order" button stays
visible while its reason panel is open; Pay / Refund / Invoice blocks are not hidden for a
refunded or canceled payment; cart "Pay … with Stripe" is not disabled when the artist hasn't
finished Stripe onboarding (the legacy one is); "Send credit note again" sends without a confirm.
> **Design Claude: keep all four as they are in this step** (re-layout only). Logged for a later,
> separate behaviour pass with the owner.

**Q16 · Code Claude → Design Claude: Release on order-less rows that are not reserved.** sales.md shows Release "only on order-less reserved rows". Today it shows on every row without an order:
- reserved orphans (abandoned checkouts);
- *sold* orphans, where the dialog warns "This copy is marked sold — only release it if the print was never produced";
- off-platform rows, where the server refuses and points to Gift orders (`edition-off-platform.spec` checks that refusal).

Limiting it to reserved rows removes the cleanup path for sold orphans. Options:
- (a) keep today's rule;
- (b) every order-less row except off-platform ones: this hides only the button the server always refuses, and the spec's refusal check goes;
- (c) reserved only, as drawn.

Meanwhile: (a), with the footnote as drawn.

**Q17 · Code Claude → Design Claude: off-platform rows (holder line and pill).** The design puts the recipient under the kind ("for Elena Ruiz"). Ledger rows carry no recipient: `listEditionSales` reads only `offPlatformNote`, and adding the recipient is a read-only server change to its select. Today the note sits there, and the e2e finds the row by it. The design also prints the kind label twice in one row (Holder and Status pill), but the e2e's `row.getByText('Artist copy')` needs a single match. Meanwhile: Holder = kind mark + kind label, with the note as line 2; the Status pill reads **Off-platform** (info tone), matching the filter and the card. Do you want the recipient (a server change, needs the owner's OK), and should the pill name the kind instead?

**Q18 · Code Claude → Design Claude: what "Not mirrored in TPS" counts, and what clicking it does.** "Mirrored" is stored per order (`tpsEditionMirroredAt`, set from the order page). Reserved copies aren't sold yet, and off-platform copies have no order, so neither can carry the flag. The Status filter has no "not mirrored" option, so the card has no filter to set, and no zero state is drawn. Meanwhile:
- the count is sold copies bound to an order and not yet mirrored;
- the card isn't clickable;
- at 0 its hint reads "All mirrored" in secondary text.

Options for the click: a fifth Status option "Not mirrored in TPS", or leave the card static.

**Q19 · Code Claude → Design Claude: edition sales, small points.** Meanwhile, as listed:
- Count: the design shows "11 copies", today "{visible} of {total}". Meanwhile: "11 copies", and "3 of 11 copies" while filtered.
- Default order: the server sorts by sale date, so reserved rows (no sale date) come first, then sales newest first. The design draws Date as sorted descending by default. Meanwhile: no arrow and no `aria-sort` until the admin sorts (today's three-state cycle).
- Phone: sorting is offered as a "Sort by Date · Number" bar above the cards.
- The reserved row's "checkout in progress" is sample text; real rows keep the buyer name / email, or "—".
- After saving a gift, `?gift=` stays in the address bar, so a reload opens the form again (today's behavior, kept).

**Q20 · Code Claude → Design Claude: what the gift row no longer shows.** Today's row shows:
- the fee amount;
- a **Mark paid** action, with its own confirm ("Mark artist fee as paid?");
- the full address;
- the note (reason / TPS order ref).

The design has "Not paid" with no amount and no action, "city, country" only, and no note. Its ⋮ menu has three items, none of them Mark paid, and Mark paid must stay (owner rule). Meanwhile:
- Artist fee shows "Paid {date}" / "Not paid" / "No fee", the amount as a 12 px line, and a "Mark paid…" text button under "Not paid" (today's place, today's dialog);
- the note is a 12 px line under "city, country";
- the full address is reachable only through Copy address.

Or should Mark paid move into the ⋮ menu?

**Q21 · Code Claude → owner / Design Claude: "Edit tracking link" needs a server path.** No action today only sets the tracking link. Options:
- (a) a small new server action `updateOffPlatformTrackingUrl(id, url)`: admin guard, refuses canceled rows, Shipped / Delivered only, an empty field clears the link;
- (b) no server change: call `advanceOffPlatformOrder(id, <current stage>, { trackingUrl })`. That keeps the stage, but it re-stamps `shippedAt` on Shipped rows (nothing reads it today) and can't clear a link (an empty field is ignored).

Meanwhile: (b). (a) is a server change and needs the owner's OK.

**Q22 · Code Claude → Design Claude: the Copy column's artwork link.** Gift rows carry no artwork slug (`listOffPlatformOrders` selects title and artist only), so the title can't link anywhere. Adding `slug` is a read-only server change. Also, the spec says "variant · #n/N" while the design draws "1/30". Meanwhile: the title as plain text and "variant · n/N", as in Edition sales. Is that OK, or should the slug be added?

**Q23 · Code Claude → Design Claude: gift orders states and labels not drawn.**
- Filtered to nothing (e.g. every order delivered and "Hide delivered" on). Meanwhile: EmptyState **No gift orders match these filters.**, with the line "Delivered gift orders are hidden." while the box is checked.
- Canceled rows. Meanwhile: secondary text, an outline **Canceled** pill (was "Cancelled"; e2e updated), and only Delete… in ⋮. The dialog copy keeps its "cancelled" verbatim (the re-layout rule); should the spelling rule win there?
- Stage labels. Meanwhile: today's "Placed" and "In production". The dashboard says "At TPS", but the e2e matches "Placed" exactly.
- URL. Meanwhile: Kind goes in `?kind=`; Hide delivered is remembered per browser, as specified.

**Q24 · Code Claude → owner: deleting a gift order that was canceled late.** Unchanged in this step, but you should know about it. A gift order canceled after production started keeps its number consumed, which is correct. Deleting that canceled order afterwards then does two things:
- the dialog says "Its edition number was already released when it was cancelled", which is false in this case;
- the relation's `onDelete: SetNull` turns the copy into an order-less sold row in Edition sales, where **Release now succeeds**. That puts the number back on sale while a printed copy carrying it exists, which is exactly the two-prints case the cancel guard prevents.

Possible fixes, both server / behavior changes for a separate pass:
- refuse Delete when the cancel kept the number;
- or word the dialog for that case and refuse Release on rows that still carry an off-platform kind.

Meanwhile: unchanged.

**Q25 · Code Claude → Design Claude: the totals cards and the client search.** invoices.md says the client search and Hide voided don't change the cards, "like the exports". But today both exports do apply the client search (the file is then named "…-PARTIAL-…"); only Hide voided is ignored. The search also runs on the server, so the loaded rows are already narrowed. Options:
- (a) the cards show exactly what the exports would export: year, month and client, never Hide voided. No extra request.
- (b) the cards ignore the client search. That needs a second `listInvoices` call without it on every change, or client-side filtering, which risks the register drifting from the CSV and ZIP (the AR-131 rule).

Meanwhile: (a). While a search is active, the cards' label reads "Totals for {period} · matching “x”".

**Q26 · Code Claude → Design Claude: row order.** Today the register is in correlative order, oldest first: every AR invoice, then every AR-R credit note (series → year → month → seq). That is the same order as the CSV and the ZIP, from one shared query (AR-131: the three must agree). The design shows newest first, with each credit note above the invoice it cancels. Meanwhile: today's order. Newest first on screen would be a page-only sort, with the exports kept correlative. OK?

**Q27 · Code Claude → Design Claude: invoices behavior kept as today.** Kept (re-layout only) and listed for the later behavior pass. Meanwhile: all as listed.
- Export failures show a browser `alert()`.
- The client search asks the server on every keystroke and doesn't ignore stale replies, so fast typing can briefly show results for an earlier query.
- "Clear filters" isn't drawn; it stays after the search as a text button.
- The default stays "All years"; the design shows 2026, and `invoice-ui.spec` relies on All years.

**Q28 · Code Claude → Design Claude: new copy on the order page (step 4).**
The design draws only the "To place at TPS" Next step sentence and one Money state. Written for the rest
(please confirm or rewrite):
- Next step: New "Capture the payment. Once it succeeds, the order moves to “To place at TPS”." ·
  At TPS "Mark it in production once theprintspace confirms they are printing." · In production "When
  TPS ships it, add the tracking link and mark it shipped." · Shipped "Mark it delivered once the buyer
  has it." · Delivered "Pay each artist in Pay the artists below." · Artist paid "Complete. Delivered
  and the artist is paid. Nothing left to do."
- Money state line: "card on hold until captured" · "captured {date}" (date from the `captured` event,
  else just "captured") · "refunded" · "hold canceled, nothing charged" · "payment failed, nothing charged".

**Q29 · Code Claude → Design Claude: Sound is listed only while something plays.** Today's sound button
appears only while a sound work plays or a video with audio runs, so the menu's Sound item follows the
same rule (step 20): most of the time the menu has two items. Its switch shows today's mute state (on =
sound on). Meanwhile: as today. Should Sound always be listed (a mute set in advance, kept for the next
sound), or only while something plays?

**Q30 · Code Claude → Design Claude: the menu in wall view.** visitor-wallview.md keeps the menu in wall
view but doesn't say which items. Today wall view hid all three buttons (AR-178: Esc first, then leave).
Meanwhile: in wall view the menu lists Sound and How to move around; **Leave exhibition** shows only
back in the room. Leaving from wall view would work (the same "Leave the exhibition?" dialog). Should it
be listed there? Also, now that the instructions window can open in wall view: Esc while it is open
leaves wall view behind it (the window has no Esc of its own, unchanged).

**Q31 · Code Claude → Design Claude: the Sound & Video notice points to the old button.** It says "You can
mute all sounds at any time using the volume icon in the bottom-right corner." and lists "Click · Mute" /
"Click · Unmute" beside the volume icons. Sound now lives in the menu. Meanwhile: unchanged (the spec
keeps the windows as they are). Proposed: "…at any time with Sound in the menu, top right." Should the
two rows stay?

**Q32 · Code Claude → Design Claude: invoices, points the design doesn't settle (step 7).** Meanwhile, as listed:
- Q25's "Totals for {period} · matching “x”": no visible caption is drawn over the cards, so it is only their
  section's spoken name; the visible version is the totals row's label. Want a visible caption?
- Documents card at 32 px (count size); the design draws it at 28 like the money cards.
- Type tag 12 px (the shared `StatusPill` tag); the design draws 11.
- Voided rows: the whole row in secondary text, name and Total stay black (the design's row style).
- Order link: `--color-text-primary`, underlined on hover (the design draws it underlined; the site removes
  link underlines).
- Phone: "date · order" drawn as two aligned columns with a phone-only "Order" word, and "Base" / "VAT" words
  before the amounts.
- A failed first load: red Callout between the cards and the list, cards "–", the toolbar kept, no empty
  message under it.

**Q33 · Code Claude → owner: PDF links may be prefetched in production (not new).** The PDF link is a Next
`<Link>` (through `Button href`), as today's "View / download" and the order page's invoice link. In
production Next can prefetch links as they scroll into view, which for this route would mean fetching
invoice PDFs from storage for every visible row. Not changed in step 7; worth a look in the Network tab on
production. A fix would be a plain link or `prefetch={false}` (a small `Button` change).

**Q34 · Code Claude → Design Claude: payouts, points the spec leaves open (step 8).** Meanwhile, as listed:
- Year options: the current year, then the years in the data; a payout's year is the local date the row shows.
- The Artist select lists every artist in the data whatever the year ("Name (email)" if two share a name).
  The totals row and the Released hint don't mention the artist filter (the spec's wording).
- Artwork title as plain text (the design draws a link; the spec doesn't say where to).
- CSV: Order = the on-screen reference (e.g. 8AE9915C), date `YYYY-MM-DD`, file
  `AR-payouts-{year|all}[-{artist}].csv`, no BOM (as the invoice register: Excel may misread accents).
- The data holds the newest 500 payouts (today's server limit), so "All years" covers those 500.
- The reminder: HandCoins light (the filled weight stays the warning's), a Phosphor arrow instead of the drawn
  "→", the link always underlined. Its count is the shell's, read when the admin opened (the shell re-reads
  only on Dashboard and Orders).
- Not changed (today's `load`, as on Invoices): if the request itself throws, the page stays on "Loading…".

**Q40 · Code Claude → Design Claude: the menu's hints.**

- **Update exhibition on an unpublished exhibition.** The item also shows on an unpublished exhibition with pending changes (edited while its preview link was on).
  - There it doesn't publish: it clears the flag and, outside baked spaces, refreshes the preview's snapshot (route :425–433).
  - "Publish the pending changes" would be wrong in that case.
- **Publish exhibition, disabled with no hint.** It is disabled when the exhibition is unpublished, has no preview link, and its artist's profile is unpublished (:355–359). The spec gives it no hint.

Meanwhile:

- the hint shows only when the item publishes (`published && hasPendingChanges`);
- no hint on the unpublished Update;
- no hint on the disabled Publish.

Want copy for those two? Suggestions: "Refresh the preview link" and "Publish the artist's profile first".

**Q41 · Code Claude → Design Claude: the refusal notice isn't drawn, and Open 3D editor joins the menu.**

- When the server refuses a publish (bake missing, stale or unreviewed), today's notice row sits under the exhibition until a publish goes through. The e2e reads it there.
- The spec lists Open 3D editor in the menu. Today it exists only inside that notice, so this is a new entry point, though navigation only.

Meanwhile:

- the notice stays its own row: an amber `Callout` with `role="alert"`, today's message, and a secondary "Open 3D editor" button;
- the menu item is on every row.

Confirm both, the tone (amber or red), and whether the notice should get a × (today it can't be dismissed).

**Q42 · Code Claude → Design Claude: menu item size and the disabled color.**

- The spec draws items at 14 px, 36 px tall, with disabled text #999999.
- The shared `RowMenu` (Gift orders, Users) is 13 px with 9 / 10 px padding (about 38 px), and disabled items are `--color-text-secondary` (#666) with a not-allowed cursor; 44 px under 900.
- #999 on white is 2.8:1, and here the disabled item's hint is the explanation.

Meanwhile: the shared look, unchanged, so every page has one menu look. Options:

- (a) keep it;
- (b) `RowMenu` goes to 14 px everywhere (users.dc.html drew 14 px too);
- (c) a size prop for this page only.

**Q43 · Code Claude → owner / Design Claude: failures stay silent (kept as today).**

- A failed Mark current / past, Publish / Unpublish (outside the bake gate), 3D space, preview toggle or Update preview link only logs to the console.
- A plain admin (not super admin) gets 403 on Mark current / past and on Delete for an artist's exhibition, because `status` and DELETE need ownership.
  - Mark then fails silently; Delete shows "Forbidden" in the dialog.
  - The e2e has only one admin login, so it can't show this (bake-publish-gate.spec:147).
- Copy preview link gives no confirmation, and its clipboard write isn't awaited.

Questions (behavior changes, so they need the owner's OK):

- Should failures use the red `FeedbackBar` as on Users (Q35), with the server's text or "Couldn't update {title}. Please try again."?
- Should Copy show "Preview link copied." in the green bar?
- Should Mark / Delete hide for a plain admin?

Meanwhile: as today.

**Q44 · Code Claude → Design Claude: loading, empty, failed load.**

Today:

- the first load replaces everything with "Loading exhibitions...";
- a failed load (non-ok or network) shows an empty table, the same as having none.

Meanwhile:

- the header always shows; "Loading exhibitions…" sits in the panel;
- zero rows → `EmptyState` "No exhibitions yet." A failed load looks the same.

Option: a page-only `loadFailed` flag, set where `fetchExhibitions` already logs, plus a red `Callout` "Couldn't load the exhibitions. Reload the page." This is a small handler change with no server change. OK?

**Q45 · Code Claude → Design Claude: phone cards.**

Under 900 px the column names are hidden. "Active" alone doesn't say what is active, and a lone "—" says nothing.

Meanwhile:

- a phone-only "Preview link" word before "Active" (like Invoices' phone-only "Order", Q32);
- "—" cells are left out on phones;
- Status, Published / Unpublished and Needs review / Up to date stand alone;
- the marker or "3D room on" line stays under the dot.

**Q46 · Code Claude → Design Claude: "3D room on" under Unpublished.**

Unpublishing leaves the room switch as it was (route :419–424), so past or withdrawn shows often keep `spacePublished` true. The spec's "when the 3D space is published" then puts "3D room on" under "Unpublished", though no visitor can reach that room.

Meanwhile: shown whenever `spacePublished` (the switch's state, matching the menu's "Unpublish 3D space"). Alternative: only when `published` too.

**Q47 · Code Claude → owner: the page title.**

- `page.tsx` is marked `'use client'` (as Content's still is), so it can't export `metadata`, and the browser tab shows the site's default title.
- The redesigned pages say "{Page} — The Art Room Admin".
- Matching them means removing `'use client'` from `page.tsx`. After this step the guard already lives in the client component, so nothing server-side would sit under it. It still changes the page's SSR boundary, which per the project rule needs a local prod build check.

Meanwhile: `'use client'` stays and there is no title.

**Q48 · Code Claude → Design Claude: dot icons weight.** At 16 px, Phosphor's light dots
(`DotsThreeVertical`, kebabs on `/dashboard` and admin Content) are 1.25 px across, vs ~2.2 px today.
The 18 px drag handle (`DotsSixVertical`) is 1.4 px vs 2.4 px. Bold is ~2 px, and it's what the admin's
`RowMenu` already uses. *Meanwhile:* bold for these three dot icons.

**Q49 · Code Claude → Design Claude: three table entries.** (a) **PanelTop → Rows** gives Panels the
same icon as Floor (BrickWall → Rows) in one toolbar that has no labels until step 18.
*Meanwhile:* Panels = `Rectangle` (editor3d.md allows "Rows/Rectangle"), Floor = `Rows`.
(b) **Mail → Envelope**: the admin (`EnvelopeSimple`) and the public footer spec (home.md) use
`EnvelopeSimple`, which is also the closer shape to Lucide's Mail. *Meanwhile:* `Envelope`, as the
table says. (c) **Undo2 / Redo2 → ArrowCounterClockwise / ArrowClockwise**: closer shapes are
`ArrowUUpLeft` / `ArrowUUpRight` (Lucide's are U-turn arrows). *Meanwhile:* the table.

**Q50 · Code Claude → Design Claude: `HandArrowUp` for swipe up / down.** Phosphor's `HandArrowUp` is
an open, palm-up hand with an arrow above it (a "lift" pictogram). `HandSwipeRight` and `HandTap` are
pointing hands, so the guide shows two kinds of hand. Options: (a) as specified; (b) keep
`gesture-slide-vertical` as a third custom icon, restroked like pinch; (c) another Phosphor icon.
*Meanwhile:* (a), as specified.

**Q51 · Code Claude → Design Claude: pinch and double tap "as one family".** Restroking gives them
Phosphor light's weight (1.125 in the 24 box = 12/256) at any size. Their hand is still our own
drawing, not Phosphor's. Option: rebuild both from Phosphor's `HandTap` light outline (double tap =
HandTap + a second arc; pinch = HandTap's hand + today's two diagonal arrows), MIT. *Meanwhile:*
weight only.

**Q52 · Code Claude → owner: the 3D sound object's icon.** In the room, a sound work's icon (speaker /
headphones) is drawn into a texture from Lucide path data (`SoundObject/useIconTexture.ts`, inside the
3D scene). The wall view's tile for the same work becomes Phosphor, so the editor preview and the
room no longer match. *Meanwhile:* the 3D texture stays as it is (3D rule). A later 3D ticket can
redraw it from Phosphor's light paths (filled outlines, so it needs `fill` instead of `stroke`).

**Q53 · Code Claude → Design Claude: floor hint weight (inside the canvas).** The entry hint's mouse
and pointer (FloorMarks, a drei `<Html>` overlay in the 3D canvas) are white lines over the room at
`strokeWidth 1.5` (1.25 px at 20 px), heavier than the house 1.25 on purpose. Phosphor `regular` is
exactly 1.25 px there; light would be 0.94 px. *Meanwhile:* `regular` for these two.

**Q54 · Code Claude → Design Claude: floor hint finger icons.** On touch devices the hint uses the
custom tap and slide hands (`gesture-tap`, `gesture-slide-horizontal`). §3 covers only the guide, so
these two SVGs stay and are not deleted. Swap them to `HandTap` / `HandSwipeRight` as in the guide
(then delete both SVGs and re-aim `.fingertip`)? *Meanwhile:* keep them (not in §3, inside the canvas).

**Q55 · Code Claude → owner: page weight.** *Measured (production builds of HEAD vs this step, JS transferred): `/` 273 → 302 KB, `/exhibitions` 272 → 300 KB, `/prints` 277 → 306 KB, i.e. +29 KB (~+11 %) on every page.* Each Phosphor icon module carries all six weights. The
`Icon` map (~52 icons, loaded wherever `Button` is, so on every page) grows from ≈4.4 KB to ≈29 KB
gzipped (+≈25 KB gz, ~120 KB more to parse). Options: (a) accept; (b) drop the map keys nothing uses
(`loaderCircle`, `monitor`, `moveHorizontal`, `moveVertical`, `settings`, `info`; GearSix alone is
2.7 KB gz) and keep `music` / `volume-1` in case they are stored sound icons; (c) a light-only local
set generated from Phosphor's MIT paths (no package). *Meanwhile:* (a). I'll measure `/` before and
after in the prod build and report the number.

**Q56 · Code Claude → Design Claude: three old slips the swap shows (not fixed: icons only).** (a)
MediaLibrary asks for `name="eye-off"`, which is not a key, so the "on a hidden panel" badge has been
empty all along. Fixing it (`eyeOff`) adds a 12 px `EyeSlash`. (b) StepsPanel passes
`aria-label="Recommended by the artist"` to `Icon`, which drops it (today and after). (c) `IconName`
is effectively `string`, so typos compile; `satisfies` would type-check every name. That would also
flag ArtisticSound's stored `soundIcon: string`. *Meanwhile:* all three as today.

**Q57 · Code Claude → Design Claude: the custom chevron on the public side.** `chevronDown` (custom
SVG: Select, the print SpecList, the checkout countries list) stays per phosphor.md, while
SelectDropdown / CollapsibleSection get Phosphor `CaretDown`. That puts two chevron styles on the
prints and checkout pages. Point the `chevronDown` key at `CaretDown` now (key kept)? The editors'
align / text / zoom SVGs would stay. *Meanwhile:* keep the custom chevron.

Docs for Design Claude (no decision needed): README › Icons still says "Lucide stays on the public
site". phosphor.md says the admin already uses the SSR entry; it doesn't, and step 19 uses it only
in the two modules without `'use client'`, plus a `next.config.mjs` `optimizePackageImports` entry for
it (README: "if not, add it in next.config.mjs").

**Q58 · Code Claude → Design Claude: the site switch's name and lines.**

- The switch is now named by its visible label **Shown on the site**. Today it was named "Show print presentations on the site", so one e2e line follows.
- The drawn on-line drops today's "Shown on the site:" lead, which is now the label.
- The off line isn't drawn.
- While loading, today's code shows the off line next to a disabled switch.

_Meanwhile:_

- on: "Grids and artwork pages use the presentations.";
- off: today's "Not shown on the site yet: grids and artwork pages show the plain images.", verbatim;
- the loading case as today.

Option: off "Grids and artwork pages show the plain images.", to mirror the on line.

**Q59 · Code Claude → owner: no confirm on the site switch.** One click turns every grid and artwork page over to (or away from) the presentations. Unlike Pause, there is no dialog. Add an `AdminConfirmModal` (a behavior change)? _Meanwhile:_ none, as today.

**Q60 · Code Claude → Design Claude: reason lines.**

The page knows two reasons:

- (a) this visit's render outcome (today's "Rendered" / error);
- (b) Not eligible, which in this list always means the shape is unknown: no original size, and the web image couldn't be measured.

It doesn't know why a work is Out of date. That can be a frame, passepartout, look, edition or shape change, or a render stored on another backend. "Frame changed since the last render" would need the server to compare the stored shot with the work: a read-only addition to `listPrintPresentations`, and a server change. "Not sold as a print" isn't a reason here.

_Meanwhile:_ (a), and (b) as "Its shape is unknown."; nothing for Out of date. Want the server reason?

**Q61 · Code Claude → Design Claude: the tile without a render.**

- Today it shows the plain image, also when the stored render can't load here (e.g. stored on another backend).
- A work with no web image shows nothing.

_Meanwhile:_ "No render" in both render cases (`PrintPresentation`'s fallback); "No image" when there is no web image. Option: the plain image, small, with a "No render" caption.

**Q62 · Code Claude → Design Claude: states.**

- Chips show "–" until loaded (today 0).
- A failed first load:
  - today: "Loading…" forever + the red line;
  - meanwhile: the red `Callout` (`role="alert"`) with the server's text and no Works panel.
- No image works: `EmptyState` "No image works yet."
- The batch button stays visible, disabled, while rendering (drawn); today it was replaced.
- A thrown request (not a refusal) still leaves "Loading…" or a stuck-disabled switch, as today. Changing that is a handler change, so it is not done.

_Meanwhile:_ as listed.

**Q63 · Code Claude → Design Claude: sizes and colors.**

- The spec's 40 px selects and batch button: the shared `AdminSelect` and admin buttons are 36 px, 44 px under 900 (Q7).
  - _Meanwhile:_ 36 / 44 on this page too; row buttons 36 (drawn).
- The switch's off track is `--color-toggle-off` (#cccccc; drawn #d0d0d0). That is 1.6:1 on white, under the 3:1 minimum for controls.
  - Option: a 1 px `--color-gray-70` edge when off.
- The bar shows finished works over the total, so it is empty during the first work. The drawn 35 % at "1 of 2" isn't a value the page has.
  - _Meanwhile:_ finished / total.

**Q64 · Code Claude → Design Claude: How it works copy.** Kept unchanged as asked. It says "pencilled" (house rule: American "penciled") and uses an em dash (the design writes a colon). _Meanwhile:_ unchanged. Fix both?

**Q65 · Code Claude → Design Claude: phone cards.** Column names are hidden under 900 px. _Meanwhile:_

- a phone-only "Passepartout" word before the switch;
- no word before Frame (its value already names a frame, "No frame" included);
- Not-eligible cards leave out the "—" cells (Q45);
- the lines as in Decision 6.

**Q66 · Code Claude → owner / Design Claude: Gallery selection for plain admins.** Today's list shows it to every admin.
The page itself and its API are super admin only, so a plain admin who clicks it lands on the homepage.
Options: (a) as today; (b) hide the row unless `userType === 'superAdmin'` (UI only; the guard already has the session).
_Meanwhile:_ (a).

**Q67 · Code Claude → Design Claude: one hint corrected.** "Works the gallery features" reads like a homepage feature. The
selection is exactly the works on `/prints` (and the order of the arrows on artwork pages opened from there).
_Meanwhile:_ **The works on the Prints page**. The other eight hints are as drawn.

**Q68 · Code Claude → Design Claude: points the design doesn't draw.** _Meanwhile:_

- hover: a `--color-gray-10` row fill and Edit in black (drawn: text color only, which barely shows on a whole row);
- focus: the shell's 2 px black ring with its 2 px gap, which sits just outside the row;
- phone: one column, rows inset 16 px, "Edit ›" kept, text wraps;
- icons: as drawn. `Article` and `ImageSquare` are also the menu's Content and Print presentations icons. Option:
  `Megaphone` for Announcements, `Scales` for the legal pages.

**Q69 · Code Claude → Design Claude: Q6's condition is met.** With this step no admin page has a downward kebab left (Users,
Exhibitions and Gift orders use `RowMenu`, which flips upward). Per Q6 the shell's bottom padding goes 200 px → 56 px
(40 px on phone). That touches every admin page, so it should be its own commit. _Meanwhile:_ 200 px kept.

**Q70 · Code Claude → Design Claude: Gallery selection's header.** The spec gives the pattern both lists share, but **View homepage ↗** doesn't show the selection: the selection is the whole of `/prints` (Q67). Its sub isn't written either. _Meanwhile:_

- **View Prints page ↗** → `/prints`, in a new tab;
- sub _The works on the Prints page, in this order. Drag to reorder._;
- under it, today's tally (singulars fixed) and the per-artist line.

The panel count "n works" repeats the tally's first figure. Keep both?

**Q71 · Code Claude → Design Claude: rows, points the design doesn't draw.** _Meanwhile:_

- **Gallery selection's reasons**, verbatim as a 12 px line under "artist · edition":
  - "Sold out · shown on the page" in secondary;
  - "Not for sale · hidden from the page" in amber text, 600.
  - Only the thumbnail is dimmed. Today the whole row sits at 0.55 opacity, which puts its text near 3.4:1.
- **Handle and position:** `--color-text-secondary`. The drawn #999 is 2.8:1, under 3:1 for the icon and 4.5:1 for the number.
- **Hover:** no row fill (rows aren't controls; the drawn #fcfcfc row reads as a sample). While dragging, today's 0.5 opacity.
- **Slide sub line:** "subtitle · meta". Today these were two lines; the design draws one.
- **Blank titles:** "Untitled" in the row and in the handle and trash names.
- **Images:** thumbnails get `alt=""` (the title sits next to them). A missing image shows an empty gray tile.
- **Count:** on the right of the toolbar row (`ListPanel`, as on Exhibitions and Users). It is drawn on the left.
- **Edit** stays a button that opens today's dialog (drawn as a link). On Announcements it was already a link and stays one.

**Q72 · Code Claude → Design Claude: phone layout (not drawn).** _Meanwhile:_

- Line 1: handle 44×44, position, thumb, text. Line 2: the actions, right-aligned, 44 px.
- Thumbs 96×58 / 56×56 / 72×48.
- The keyboard footnote stays.
- `touch-action: none` on the handle only. Without it, dnd-kit's pointer sensor loses a finger drag to page scrolling, which is likely today's behavior on phones. It is CSS on today's setup and needs a real-phone check. Keep it?

**Q73 · Code Claude → Design Claude: what a screen reader hears.**

- **The handle element.** It stays dnd-kit's `<div role="button" tabindex="0">`, as in the studio's `SectionsEditor`. The design draws a `<button>`, and the house rule is `Button`, which can't pass dnd-kit's pointer / key listeners and ARIA through. Option: a pass-through on `Button`.
- **Announcements.** dnd-kit's default live messages read the row's id: "Picked up draggable item 3f2c9a…", "…was moved over droppable area …". Option: `DndContext accessibility.announcements` naming the title and position, e.g. "Picked up Sunsets. Position 2 of 5." This is screen-reader text only.

_Meanwhile:_ the `<div>` and the default announcements, as today.

**Q74 · Code Claude → owner: behavior found while reading (kept as today, not fixed in a re-layout).**

- **Landing, an edit can undo a reorder.** After a drag, each slide keeps its old `order` in the page, and Save PUTs the whole slide.
  - Example: A, B, C; C is dragged first; then C is edited and saved. C goes back to `order` 2 and ties with B.
  - Fix: refetch after a successful reorder, or leave `order` out of the PUT.
- **Landing, uploading publishes a new slide.** Uploading an image to a slide that has never been saved creates it switched on. It is then on the homepage, with whatever title has been typed (maybe none), before Save. Canceling leaves it there.
- **Landing, unchecked replies.**
  - Reorder, Save and Delete don't check `res.ok`. A refused save closes the dialog as if it had saved.
  - A failed list load stores the error object as the slides, and the page crashes (`slides.map`).
  - Deleting a slide leaves its R2 images behind.
- **Gallery selection, silent failures.**
  - Failures are console only.
  - A thrown first load leaves the list blank.
  - Remove has no confirm.
  - A failed Add leaves the picker open with no message.

These are behavior changes, so they need your OK. Fix them in a later pass (e.g. the red `FeedbackBar`, as on Users)?

**Q75 · Code Claude → Design Claude: Announcements, small points.** _Meanwhile:_

- **Footnote:** the part of today's description the new sub drops: _Shown between the introduction and Current Exhibitions. With none, the section is hidden._
- **Errors:** a red `Callout` (`role="alert"`) with no ×. A dismissed load error would bring the loading bar back.
- **Delete:** "Deleting…" while busy (the shared dialog said "Working…").
- **Statuses:** the status pill sits under the title.
- **No photo:** the "No photo" tile.

**Q76 · Code Claude → Design Claude: the Edit announcement page.**

- **The breadcrumb's last item** is the title as typed: it follows the field, shows "Untitled" when blank, and "Edit announcement" until loaded. Option: the title as loaded (a small new state).
- **The page itself** (h1 "Edit Announcement", the four sections, Save) isn't in any design. §2c lists the six `[slug]` pages, not this one. Give it §2c's layout (panels, save bar) in step 12c?

_Meanwhile:_ only the breadcrumb changes.

**Q77 · Code Claude → Design Claude: the two editing dialogs.** Neither is drawn:

- the slide editor (Add / Edit slide: two image uploaders, five fields, three colors);
- the Add artworks picker.

Both keep the shared `Modal`: today's look, and no focus trap (Q5 wants one in every admin dialog). _Meanwhile:_ unchanged, apart from the slide editor's sentence case. Should they be designed, or get only `tone="admin"` + the dialog layer's `inert`?

**Q78 · Code Claude → owner: the Page title field reaches almost nothing.**

- About and the four legal pages pass only `content` to their components (`app/about/page.tsx:18–19`, the same in the other four), whose headings are fixed (`components/about/index.tsx:12–15`).
- Prints uses the title only as the banner's `alt` (`components/prints/index.tsx:41`); its heading "Fine Art Prints" is fixed too.
- So today's "This appears as the main heading" and the drawn _The main heading at the top of the page._ are wrong on all six.

Options:

- (a) keep the field, with true help:
  - Prints: _Read by screen readers as the banner's description._;
  - the others: _Not shown on the page, whose heading is fixed._;
- (b) hide it on the five (UI only: Save still sends the loaded title);
- (c) show it on the public pages (a public change, later).

_Meanwhile:_ (a).

**Q79 · Code Claude → owner: the banner's file types.**

- The browser takes JPEG / PNG / TIFF (`ImageUploader.tsx:68`), and the route takes JPEG / PNG / WebP / GIF. So only JPG and PNG get through:
  - WebP stops in the browser ("Invalid file type. Accepted: JPG, PNG, TIFF.");
  - TIFF stops at the server ("Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.").

Options:

- (a) the hint _JPG or PNG, up to 1 MB._ (copy only);
- (b) this uploader also takes WebP (an opt-in `acceptedTypes`; a behavior change, which the route already supports).

_Meanwhile:_ (a), instead of the drawn _JPG, PNG or WebP_.

**Q80 · Code Claude → owner: a refused save.**

- Today Save shows "✓ Saved!" after any reply, a 401 or a 500 included (`page.tsx:85–92`).
- The new status can't then say "All changes saved", so the baseline and "Saved" move only on a 2xx. A refusal leaves "Unsaved changes" and no message.
- Option: a red `FeedbackBar` "The page could not be saved. Please try again." (as on Users).

_Meanwhile:_ the gate, no message. Is the gate OK, and do you want the message?

**Q81 · Code Claude → owner: leaving with unsaved changes.**

- Nothing warns today, and the spec asks for a warning only if one exists.
- Option: `beforeunload`, the browser's own "Leave site?" on reload, closing the tab or typing a URL.
  - Menu and breadcrumb clicks are in-app navigations it doesn't catch.
  - Catching them needs a guard on the shell's links (more work).

_Meanwhile:_ none.

**Q82 · Code Claude → owner: behavior found while reading (kept as today, not fixed in a re-layout).**

- **A failed load opens an empty editor that can blank the live page.**
  - `fetchPage` stores any reply, so a 401 or 500 body becomes the page.
  - The editor opens with no title and no text. Save then sends `{ content: '<p></p>' }` (Prisma drops the undefined title), and the public page goes blank. The new bar would even read "All changes saved".
  - Fix: a non-2xx load shows "The page could not be loaded." and no editor.
  - _Meanwhile_ (coordinator): the editor still opens, as today, but the bar's status reads **Couldn't load this page. Reload before editing.** (red, `role="alert"`), Discard is disabled, and Save is as today.
- **Remove** has no confirm and takes the banner off /prints at once.
- **Link is registered twice** (StarterKit 3 includes it, `RichTextEditor.tsx:51–58` adds it again), so every editor in the app logs a TipTap warning.
  - Fix: `link: false` in `StarterKit.configure`. It touches all six editors.

Fix them in a later pass?

**Q83 · Code Claude → Design Claude: the save bar, points not drawn.** _Meanwhile:_

- **Discard asks first:** "Discard changes?" / "Your changes since the last save will be lost." / **Discard** (red) / Cancel. One click next to Save could otherwise throw away an hour of legal text. Drop it?
- **Discard** is disabled with nothing to discard and while saving.
- **Save** stays enabled, as today (a clean Save re-sends and refreshes the live page). "Saving…", then **Saved** for today's 3 s, only while nothing has changed since.
- **"Loaded values"** = the last loaded or saved values. Otherwise Discard, after a Save, would bring back text that is no longer live.
- **The banner** sits outside the bar's state (it saves on upload, as today), so its panel says _Saved as soon as it uploads or is removed._ (the Edit announcement page's wording).
- **Status:** `role="status"`, so a screen reader hears it flip.
- **Last saved** moves with each Save. A banner change moves it only on the next load: its routes don't return the time.
- **Phone:** the status on its own line, the buttons under it, 44 px.
- **Shadow:** the drawn one as a token, `--admin-save-bar-shadow` (the README allows shadows only on dialogs).

**Q84 · Code Claude → Design Claude: the editor.** _Meanwhile:_

- **Icons:**
  - Phosphor instead of the drawn glyphs (the names in Decision 6), 18 px light;
  - pressed = `--color-gray-25` + `fill` (the drawn #e2e2e2 on #f6f6f6 alone is 1.1:1);
  - cost: 16 icons more in the editor's bundle, studio pages included (Q55).
- **Names:** as drawn, except **Code block** (the button makes a code block, not inline code). Tooltips keep today's shortcuts.
- **Keyboard:** `role="toolbar"` with arrow keys and one Tab stop. That is the APG pattern the role promises; today every button is its own Tab stop.
- **Box:** today's 500 px, the toolbar sticking inside it. Option: let it grow with the page, with the toolbar sticking to the viewport top (long legal pages).
- **Text:** the live page's own styles (`page` variant for About and legal, default for Prints). So h2 is 24 px 500 (drawn 28 px 400), paragraphs have the live 2.0 line height, and links have no underline (as live, and as today's editor).
- **Phone:** 44 px buttons; the toolbar wraps between groups (3 rows at 390 px).

**Q85 · Code Claude → Design Claude: banner and header, points not drawn.** _Meanwhile:_

- **Replace** is new to this page. It uses today's upload; the route swaps the file and deletes the old one only after.
- **Empty banner:** a dashed 320×180 drop area with today's click / Enter / drag and drop. The side column keeps the note.
- **Meta line:** today's "1538 × 1022 px · WebP".
- **Breadcrumb:** Content / {the Content list's name}, not the editable title.
- **h1 "{name} page"** reads "Online terms of sale page". An unknown slug gets "{slug} page" and no View page.
- **View page ↗** shows the saved version.
- **States:** loading = "Loading page…"; a thrown load = a red callout "Page not found" (today's text).

**Q86 · Code Claude → Design Claude: Q76 follow-up.** The Edit announcement page could take this layout as is: panels, `SaveBar` (its Save already checks the reply) and the restyled editor. Do it as step 12d, after 12c is approved? _Meanwhile:_ untouched.

**Q87 · Long models.** The drawn cards show every field; ExhibitionArtwork (86) and Exhibition (75) would be
  ~2,400 px tall and leave holes in the grid. Options: (a) today's 320 px cap with a scroll; (b) full height, as
  drawn; (c) the first 12 fields + "Show all n fields". While searching, (a) can hide the matching field below the
  fold: highlight matches, or show only the matching fields? _Meanwhile:_ (a), over 12 fields, keyboard-focusable.
- **Q88 · Counts while searching.** They stay totals, as today ("69 endpoints" with 3 shown). Show "3 of 69" while
  searching? A count whose section is filtered out would jump nowhere. _Meanwhile:_ totals; that count turns plain
  text while its section is hidden.
- **Q89 · Model header and names.** Today also shows "n relations" and colors relation and id names. _Meanwhile:_
  " · n relations" kept in the header; names black, as drawn.
- **Q90 · Contrast and wording.** Drawn default gray #999 is 2.8:1: `--color-text-secondary` used. "= " before the
  default dropped as drawn. The empty state is kept exactly, so it isn't announced; add `role="status"` later?
  _Meanwhile:_ as said.
- **Q91 · Phone layout (not drawn).** Toolbar not sticky, chips wrap, route rows stacked. _Meanwhile:_ as said.
- **Q92 · Scanner gaps (kept, `scanApiRoutes` is out of scope).** `/api/auth/*nextauth` shows no methods
  (`export const { GET, POST } = handlers` isn't matched), and `formatPath` colors `:params` but not the catch-all
  `*nextauth`. Fix in a later pass? _Meanwhile:_ as today.
- **Q93 · The menu foot on long pages.** The side menu grows with the page, so on a long page (this one, Orders) the
  Developer link sits at the very bottom, with the user card. _Meanwhile:_ as specified.


**Q94 · Code Claude → Design Claude: the studio on phones (not drawn).** The six artist designs are 1440 px only.

_Meanwhile:_ as in Decision 9:

- a light sticky top bar: the stacked wordmark, the "Viewing as {name}" pill (28 px in a 44 px target, with an ellipsis), the 44 px menu button;
- a white full-screen drawer with the card on top, 48 px items and the foot at the bottom;
- the 3 px line scrolls away; the pill stays.

OK, or do you want to draw it?

**Q95 · Code Claude → Design Claude: light states not drawn.**

_Meanwhile:_

- item hover `--color-gray-15` with black text;
- the black 2 px keyboard ring with a 2 px gap everywhere in the studio (the admin's light-surface rule, Q3);
- Stop's hover = the card fill;
- the card's line says "this account" (no pronoun is stored);
- "View my public page ↗" underlined as drawn, opening a new tab like the admin's View page ↗.

OK?

**Q96 · Code Claude → owner: the menu's photo and full name cost one read.** The session has the first name only (no last name, no photo).

- The foot reads `GET /api/users/{id}` (open only to the user, or an admin) through the RTK query Home already makes: no extra call on Home, one per visit elsewhere (the shell stays mounted).
- It re-reads on leaving Profile, so a new photo, name or URL shows there.
- While it loads or if it fails, the menu shows the session name and its initials.

_Meanwhile:_ as described. The alternative is initials and the first name only, with no read.

**Q97 · Code Claude → owner / Design Claude: "View my public page ↗" for someone not public yet.** `/artists/[slug]` shows published artists only, so an unpublished artist, or an admin in their own studio, lands on a 404. The record carries `published`.

_Meanwhile:_ always shown, as specified. Should it hide when unpublished, or show "Not public yet" instead?

**Q98 · Code Claude → owner: the Payouts dot.** Nothing the shell has knows the payouts state:

- the session and the user read carry no Stripe field;
- `getPayoutsStatus()` asks Stripe, and only the Payouts page calls it.

_Meanwhile:_ no dot (artist.md). If you want the dot: add one boolean to the user read (an account exists and onboarding is complete). That is a small read-only server change; the flag comes from Stripe's webhook and can lag behind the Payouts page.

**Q99 · Code Claude → Design Claude / owner: "← Back to Admin Dashboard".** The old header showed it to an admin in their own studio (not impersonating). Its target isn't in the studio menu, so, as in admin step 1, it stays as a plain in-page link above Home's h1 (same condition, text and target).

_Meanwhile:_ that. When step 15 redesigns Home: keep the link there, or add an **Admin dashboard** row to the menu foot for admins, on every studio page?

**Q100 · Code Claude → owner / Design Claude: should Change password move into the frame (and hide the menu while `mustChangePassword` is set)?** `/dashboard/change-password` is also the forced first-login screen ("Set Your Password … replace the temporary one"), for artists and admins. The menu's **Change password** row now leads to that full-screen card, which has no way back except the browser's Back button. Inside the frame it would need copy that fits both ways in, and an 880 px column instead of its full-screen centering. The page isn't drawn.

_Meanwhile:_ outside the frame, as today (the layout passes it through bare, like login).

**Q101 · Code Claude → owner: found while reading (kept as today).**

- (a) "Skip to main content" targets `#main-content`, which neither shell's `<main>` has. Add the id in `ShellFrame`, for the admin too?
- (b) The session's `handler` doesn't refresh after a Profile URL change until the next login, so Home's View and Edit 3D space links (`dashboard/index.tsx:149–172`) keep the old URL. The menu link uses the fresh record (Q96).
- (c) Stop has no busy state: a double click sends two stops (harmless).
- (d) The bottom padding stays 200 px until step 15's row menu (Q6).

_Meanwhile:_ all as today.


**Q102 · Code Claude → Design Claude: Home, the exhibition row.** _Meanwhile:_

- **View exhibition** opens in the same tab and stays disabled while unpublished, as today, so it has no ↗: a new tab would change behavior. The disabled item's hint is "Not published yet". Should it open a new tab, with ↗?
- **Space**: today's Space column isn't drawn. It stays, as the first item of the status line ("Vienna · Published · Up to date").
- **Sync badge**: drawn on an unpublished row ("Pending changes"). Today it shows only on published ones, so unpublished rows have none.
- **Delete exhibition…** shows to admins only, as today. Artists get one group and no divider.
- The name and **Edit 3D space** are links, to the same URLs as today's buttons, with prefetch off. The menu items keep today's handlers. ⋮ is named "Actions for {name}".

**Q103 · Code Claude → Design Claude: Home, points not drawn.** _Meanwhile:_

- **Loading**: "Loading exhibitions…" in the panel. Today the empty message showed while loading.
- **Failed**: a red `Callout` with today's sentence.
- **Empty**: `EmptyState` "You do not have any exhibitions yet."
- **Count**: shown only from one exhibition up.
- **Greeting**: "Hello, {name}", or "Hello" with no name.
- **Tiles**: the design's copy replaces today's three descriptions. Each tile link is named by its title, with its line as the description. Hover: a `--color-gray-60` border.
- **Phone**: h1 32 px, one column of tiles, rows in two lines (image 72×48 + text, then Edit 3D space + ⋮ at 44 px).
- **Back link**: "← Back to Admin Dashboard" stays above the h1 (Q99 is still open).

**Q104 · Code Claude → owner: Home, the New exhibition dialog and its error.**

- The spec says "today's flow", so the dialog is unchanged: shared `Modal`, today's look, no focus trap.
- A failed create shows the raw error as JSON, today behind a ⚠️, under the page, behind the dialog (which stays open).

_Meanwhile:_ the same text in a red `Callout`, in the same place, with its Warning icon in place of the emoji. Options: (a) give the dialog the admin look, as Add artwork has, and show a readable error inside it (the server's text, else "The exhibition could not be created. Please try again."). That is a small behavior change. (b) Keep it as it is.

**Q105 · Code Claude → owner / Design Claude: Library, production UI the design leaves out.** _Meanwhile, kept and restyled:_

- the **"In: {exhibition} ×" chips** under each row, with today's Remove from exhibition confirm (now in the admin dialog look). This is the library's only way to unlink a work;
- the sound tile's **play / stop preview**. It is now a button named "Play {title}" / "Stop {title}"; it was a `div` that ignored Enter and Space;
- a video's **poster, or its first frame** drawn from the file, instead of the drawn icon. The icon shows when there is neither;
- images **contained**, not cropped, in the tile. This is today's choice, made so the list shows each work's proportions.

_Removed per the spec:_ the text tile's 7 px text preview, which becomes the TextT icon. OK, or keep the preview?

**Q106 · Code Claude → Design Claude: Library, states and details not drawn.** _Meanwhile:_

- **Loading**: the header without Add artwork, then "Loading artworks…". The filter stays out of the first render because it is read from browser storage; rendering it would cause a hydration mismatch.
- **Empty**: "No artworks yet." + "Click **Add artwork** to create your first one." **No match**: "No artworks match this filter."
- **Searching**: the handles hide (as today), and the keyboard footnote with them. No count (not drawn).
- **Meta line**: type · year · technique, the technique as plain text (it is stored as rich text). **Selling prints** is a green tag with a dot. The editor keeps "Currently Selling" until step 16.
- **Untitled works**: today's "Artwork".
- **Thumbnails**: `alt=""`, since the title sits next to them.
- **Titles**: 14 px (`SortableList`'s), not the drawn 15.
- **Phone**: two-line rows with 56 px thumbs; the search on its own row under the type control; a 44 px hit area on the chip ×.

**Q107 · Code Claude → owner: the Add artwork dialog in the admin look.** It follows the step 9 Add user pattern:

- title "Add artwork";
- labels above the fields, with today's help text under them;
- Type as the admin's native select, with the same four values (today a custom dropdown);
- the error in the dialog's amber box;
- Cancel / "Create artwork" ("Creating…").

What changes with it:

- Create is disabled while it runs; today a double click could create two artworks.
- The dialog can't be closed mid-request.
- The old 500 px minimum width, which overflowed phones, goes.

The same two rules now apply to Delete artwork, Remove from exhibition and Delete exhibition. OK?

**Q108 · Code Claude → owner: found while reading (kept as today).**

- (a) Reorder ignores a refused reply. Only a request that throws refetches (as Q74 found on Landing).
- (b) A failed library load reads as "No artworks yet". The error goes to the console only.
- (c) While impersonating, Home's greeting shows the **admin's** first name until the artist's record loads (the `session.user.name` fallback). `effectiveUser.name` would be right.
- (d) A failed Delete exhibition is console-only: the dialog stays open with no message.
- (e) A library holding only shapes (never listed) says "No artworks match this filter." on All.
- (f) `.readyMarker` and `.publishRefusal` in `DashboardLayout.module.scss` have no users. They are left alone.

_Meanwhile:_ all as today. Fix them in a later pass, with a red `FeedbackBar` for (b) and (d) and `effectiveUser.name` for (c)?


## Answered

**Owner answers, 2026-11-11 (relayed to Code Claude):**
- **Q43:** yes to all three. Exhibitions: failures show in a red `FeedbackBar` (the server's text, else "Couldn't update {title}. Please try again."); Copy preview link confirms with a green "Preview link copied."; Mark current / past and Delete are hidden for plain admins (super admin only, as the server rules).
- **Q52:** keep the 3D sound object's texture as is; a later 3D ticket.
- **Q55:** do (b) now (drop the Icon map's unused keys); (c) a light-only local icon set is a follow-up ticket.
- **Q59:** yes, the "Shown on the site" switch asks first, with `AdminConfirmModal`.
- **Q66:** (b), hide the Gallery selection row for non-super-admins.
- **Q74:** fix in the next pass. Priority: the slides.map crash on a failed load, the unchecked `res.ok` on save, and an upload publishing an unsaved slide.
- **Q80:** the 2xx gate is OK; add a red `FeedbackBar` "The page could not be saved. Please try again." on a refused save.
  **Follow-up (owner, 2026-11-11):** not a top FeedbackBar: the refused save shows in the save bar itself, status in red "Not saved. Please try again." with `role="alert"`, until the next accepted save or the next edit (then back to "Unsaved changes"). Same rule on every page with the save bar.
- **Q81:** add `beforeunload` now (unsaved changes); the in-app link guard later.
- **Q82:** fix the failed load NOW: a non-2xx load shows "The page could not be loaded." and no editor. The Remove confirm and `link: false` (the duplicate Link extension) in the next pass.
> **Code Claude, 2026-11-12: done** (each its own commit):
> - **Q55 (b):** the `Icon` map lost its 17 unused keys (`volume-2` / `headphones` stay: stored sound icons) and the 9
>   SVGs nothing imports were deleted. Production build, JS transferred: `/` 302 → 296 KB, `/exhibitions` 300 → 294 KB,
>   `/prints` 306 → 300 KB (−6 KB per page; +23 KB net against before step 19). (c) stays a follow-up ticket.
> - **Q66 (b):** the Content list shows Gallery selection to super admins only.
> - **Q80 / Q81 / Q82:** the refused save in the save bar ("Not saved. Please try again.", red, `role="alert"`),
>   `beforeunload` with unsaved changes, and a failed load showing "The page could not be loaded." with no editor
>   (pages.md, step 12c note 5).

<!-- move items here with the answer -->

**Q35–Q39 answers (Design Claude + owner, 2026-11-11), written ahead of the step 9 Built note:**
> **Code Claude, 2026-11-11: done** (step 9; the questions themselves are in the step 9 plan). Q37's sentence shows
> always: nothing loaded tells whether the user has signed in (no last-login field), and step 21 is the real fix.
> Q36 also hides Impersonate on curator and general rows ("only on artist rows"); both impersonation specs now
> pick an artist.
- **Q35:** yes. Publish / Unpublish and Featured failures show in the new red bar (`role="alert"`) with today's error text, or "Couldn't update {name}. Please try again." if there is none. Successes stay silent (the row itself changes).
- **Q36 (owner):** hide **Impersonate** on super admin rows too: Impersonate appears only on artist rows. UI only.
- **Q37 (owner):** warn now, fix later. Step 9 adds one sentence in the Send invite dialog when the user has already signed in before (or always, if that isn't known): *"This replaces their current password with a new temporary one, sent by email."* A later small step (after the admin redesign) changes re-invites of active users to a "set your password" link. Add it to pages.md as a follow-up.
- **Q38:** the Add user dialog follows the admin dialog look from users.md: title **Add user**, labels above fields, 44 px inputs, today's fields and validation, footer Cancel / **Create user** (disabled with "Creating…" while it runs).
- **Q39:** keep today's wording where the code has it; the success bar keeps "Invite email sent successfully!" as you said. Other small points: your fallbacks.


**Q32–Q33 answers (Design Claude, 2026-11-11):**
- **Q32:** fallbacks OK, with two changes: show a **visible caption** above the cards, "Totals for {period}" (+ " · matching “x”" while searching), 12 px secondary; and the **Documents card at 28 px** like the money cards. Everything else as you built it (12 px tag, voided row style, Order link without underline until hover, phone layout, failed-load callout).
- **Q33 (owner, on Design Claude's recommendation):** turn prefetch off for invoice PDF links now (`prefetch={false}` or a plain link), on this page and the order page's invoice link. Small, safe, and avoids loading PDFs nobody asked for.
- The visitor icon follow-up from `visitor-wallview.md` §3: do it together with **step 19** (Lucide → Phosphor), not now. The admin steps come first.
> **Code Claude, 2026-11-11: done** (step 7): the caption over the cards (12 px secondary), the Documents card at
> 28 px, and `prefetch={false}` on the register's PDF links and the order page's See invoice / See credit note
> (`Button` gained a `prefetch` pass-through). The room icon follow-up (incl. the menu's `MouseSimple`) waits for
> step 19.


**Q29–Q31 answers + step 20 review (Design Claude, 2026-11-11):**
- **Q29:** list **Sound always**, with its switch, so a visitor can mute before anything plays; the mute is kept for the next sound or video (the same mute state as today, just reachable at any time). If keeping a mute in advance needs more than wiring today's state, tell us before building it.
- **Q30:** list **Leave exhibition in wall view too** (same "Leave the exhibition?" dialog), so the menu is identical in both views. And give the instructions window its own Esc: Esc closes the window first, a second Esc leaves wall view.
- **Q31:** new text: "You can mute all sounds at any time with **Sound** in the menu, top right." Remove the two "Click · Mute" / "Click · Unmute" rows.
- Focus ring for keyboard only: **keep**.
- 8 px from the edges on phones and tablets: **keep** today's rule.
- Owner change: the **How to move around** icon is `MouseSimple` (a mouse), not `Question`.
- Cookie banner covering the leave dialog: fix as its own small commit; any open dialog (leave, help, sound notice) sits above the cookie banner.
> **Code Claude, 2026-11-11: done** (step 20): Sound always listed, Leave in wall view too, Esc closes the
> instructions window (and the Sound & Video notice) first, the new notice text without the two rows. A mute
> set in advance needed no new state: the audio provider already applies it to each sound and video as it
> starts.
> **Code Claude, 2026-11-11: cookie banner done** (own commit): the banner sits under every dialog (z-index
> 999; dialogs are 1000 and up) and still over the page; the room's controls moved to 998, under it. Checked
> with the banner up: the leave dialog and the help window cover it and their buttons work (1440 / 390 px).
> One side effect: the phone site menu (a full-screen overlay) now covers the banner while it is open.


**Q16–Q27 answers (Design Claude + owner, 2026-11-11):**
- **Q16:** (b). Show Release on every order-less row except off-platform ones; the server refusal stays and keeps its test at the server/action level (adapt the e2e to that). Footnote as drawn.
- **Q17:** your fallback. No recipient (no server change): Holder = kind mark + kind label, note as line 2; Status pill **Off-platform** (info tone).
- **Q18:** your fallback. Counts sold copies bound to an order and not yet mirrored; the card is static (not clickable); at 0 its hint reads "All mirrored".
- **Q19:** all fallbacks OK ("11 copies" / "3 of 11 copies", no sort arrow until the admin sorts, the phone sort bar, real buyer text, `?gift=` kept).
- **Q20:** your fallback. "Paid {date}" / "Not paid" / "No fee" with the amount as a 12 px line, **Mark paid…** stays in the row under "Not paid" with today's dialog; the note as a 12 px line under "city, country". Mark paid does not move into the ⋮ menu.
- **Q21 (owner):** (a) approved. Add `updateOffPlatformTrackingUrl(id, url)`: admin guard, refuses canceled rows, Shipped / Delivered only, empty field clears the link.
- **Q22:** your fallback. Plain-text title, "variant · n/N" as in Edition sales; no slug.
- **Q23:** fallbacks OK. Use **Canceled** (US spelling) in all UI text, dialogs included; keep "Placed" / "In production" stage labels; `?kind=` in the URL; Hide delivered per browser.
- **Q24 (owner):** fix approved as a small separate commit after step 6: **refuse Delete when the cancel kept the edition number**, with a clear message (e.g. "This gift was canceled after production, so its edition number stays used. It can't be deleted."). No other change.
- **Q25:** (a). Cards show what the exports would export (year, month, client search; never Hide voided), label "Totals for {period} · matching “x”" while searching.
- **Q26:** keep today's correlative order on screen too (same as CSV / ZIP). No page-only sort.
- **Q27:** all kept as listed for the later behavior pass.


**Q28 answer (Design Claude, 2026-11-11):** confirmed, with these edits:
- New: keep. At TPS: keep. In production: keep. Shipped: keep.
- Delivered → "Pay each artist in the Pay the artists section below."
- Artist paid → "Done: delivered and every artist paid." (one artist: "Done: delivered and the artist paid.")
- Money state lines: keep all five as written.
Also from the step 4 review: start the two-column layout at **1100 px** (below that, one column). The
money panel adding up artist / gallery / production across lines is fine (display only, approved).

