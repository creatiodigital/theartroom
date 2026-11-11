# Payouts (`/admin/payouts`)

Approved by the owner 2026-11-11, including the parts marked **NEW**. Design: `designs/payouts.dc.html`
(sample data). Same pieces as Orders. Data stays `listArtistPayouts()`; nothing server-side changes
except the CSV export if you choose to build it server-side (a client-side CSV of the loaded rows is fine).

- Header: eyebrow *Sales*, title **Payouts** (was "Artist payouts"), sub *Every payout released to an
  artist, for tax records and accounting. Newest first.* Right: **NEW Export CSV** (outline, download
  icon): the rows matching the current filters, columns Date paid, Artist, Artist email, Artwork,
  Source (order / cart line), Method, Transfer ID, Amount, Currency, Order.
- **NEW waiting reminder** (amber `Callout`, `HandCoins` icon), only when the shell's
  `deliveredUnpaid` count > 0: **{n} delivered order(s) are waiting for their artist payout.** *Pay them
  from the order page.* + link **Open Delivered orders →** (`/admin/orders?stage=delivered`).
- **NEW summary cards** for the current filters: **Released** (sum, "in {year}" or "all time"),
  **Payouts** (count, "{n} artists"), **Via Stripe** (count, "{n} paid manually").
- Toolbar: **NEW Year** select (default: current year; "All years"), **NEW Artist** select
  ("All artists" + every artist in the data), count on the right.
- Table: **Date paid** · **Artist** (name + email) · **Artwork** (title; "· cart line" in 12 px secondary
  when `source === 'item'`) · **Method**: "Stripe" (info badge) with the `transferId` under it in Geist
  Mono 11 px (shortened with an ellipsis in the middle, full ID in `title`), or "Manual" (grey badge)
  when `transferId` is null · **Amount** right, tabular, 600 · **Order** (mono link, right).
- **NEW totals row** (`tfoot`): "Total released in {year}" / "Total released", amount.
- Empty: keep today's message; with filters: *No payouts match these filters.*
