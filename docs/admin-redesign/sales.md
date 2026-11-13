# Edition sales and Gift orders

Approved by the owner 2026-11-11, including the new parts marked **NEW**. Designs:
`designs/edition-sales.dc.html`, `designs/gift-orders.dc.html` (row menu drawn open on the second row).
Names, emails, addresses and dates are sample data.

Same pieces as Orders (`orders.md`): `AdminPageHeader`, `Callout`, `Panel` with toolbar, `DataTable`,
`EmptyState`, `StatusPill`, `AdminConfirmModal`, 44 px touch rule, phone = cards. Keep every existing
action, guard, confirm dialog and copy. Where the design shows sample text for something that exists
today (e.g. edition numbers), the real data wins: artist copies keep whatever numbering they have now
("AP 1" in the design is only sample).

---

## 1 · Edition sales (`/admin/edition-sales`)

- Header: eyebrow *Sales*, title **Edition sales**, sub *Every numbered copy reserved or sold. Our
  authoritative ledger, newest first.*
- **NEW summary cards** (same card as the dashboard's, no icons): **Sold** ("numbered copies"),
  **Reserved** ("held at checkout"), **Off-platform** ("gifts, artist copies, tests"),
  **Not mirrored in TPS** (amber tone when > 0, hint *Mark them sold at TPS too*). Counts over the
  whole ledger, not the current filter. Clicking a card sets the matching filter.
- Toolbar: Artwork select (min 220 px), Variant select (disabled with title *Choose an artwork first*
  until an artwork is picked), **NEW Status** select (Any status / Sold / Reserved / Off-platform),
  today's Clear when filters are set, count on the right ("11 copies"). Filters live in the URL.
- Table columns: **Date** (sortable, `aria-sort`, arrow shows direction) · **Artwork · variant**
  (title link 600 black, "artist · variant" 12 px secondary) · **Number** (sortable, Geist Mono 13) ·
  **Holder** (buyer name + email; off-platform rows: kind icon + kind label, recipient as the second
  line) · **Status** pill (Sold `--color-green-30`/`--color-green-70`, Reserved `--color-yellow-30`/
  `--color-yellow-70`, off-platform kinds `--color-badge-info-*`) · **In TPS** ("Mirrored" in green 600, or
  "—" in `--color-text-secondary`) · **Order** (mono link, right).
- **Release** (outline, red text, 32 px / 44 px touch) only on order-less reserved rows, in the Order
  column; footnote under the table: *Release frees a reserved number that has no order (an abandoned
  checkout), putting it back on sale.* Release keeps its confirm dialog.
- The "Add an off-platform copy" dialog opened by `?gift=<variantId>` keeps all fields and checks;
  restyle it as an `AdminConfirmModal`-style form dialog (wide size), same labels.
- Empty: *No numbered copies yet.* / with filters: *No copies match these filters.* + Clear.

## 2 · Gift orders (`/admin/gift-orders`)

- Header: eyebrow *Sales*, title **Gift orders**, sub *Gifts, artist copies and test prints, produced
  at TPS outside the paid pipeline.*
- Info `Callout`: **No payment, invoice or buyer emails.** *The edition number is used up in the ledger
  and the parcel goes through the same stages as an order. To create one, use* **Create gift order**
  *on any on-sale variant of an artwork.*
- Toolbar: **NEW Kind** segmented control (All / Gallery gifts / Artist copies / Test prints),
  **NEW Hide delivered** checkbox (on by default, remembered per browser), count on the right.
- Table columns: **Date** · **Kind** (Phosphor icon + label: gift `Gift`, artist_copy `Palette`, test
  `Printer`, light 16 px; replaces today's Lucide marks) · **Copy** (artwork link, "variant · #n/N")
  · **Recipient** (name, "city, country", then a small **Copy address for TPS** button with a Copy
  icon → "Copied" for 2 s) · **Status** (pill: dark for "To place at TPS", grey for the other stages;
  tracking link under it when set) · **Artist fee** ("Paid {date}" green 600 / "Not paid" / "No fee"
  secondary) · **Next step** (dark button with the existing next label, then a 36 px **⋮** button).
- **⋮ menu** (`role="menu"`, flips upward near the bottom, see Q6): **NEW Edit tracking link** (only
  once shipped; opens the existing tracking-URL field), **Cancel gift order…**, **Delete…** (red).
  Each keeps its current confirm dialog.
- Empty: *No gift orders yet.* / *Create one from* **Create gift order** *on an artwork’s variant.*
