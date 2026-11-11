# Orders: list and order detail

Approved by the owner 2026-11-11. Designs: `designs/orders.dc.html` (list, its `tab` prop / clickable tabs
show every stage) and `designs/order-detail.dc.html` (detail, "To place at TPS" stage). Names, emails,
addresses and invoice numbers in the designs are sample data.

**Rule kept from today:** list rows only *open* the order. Every action that moves money or state
(capture, mark placed, refund, pay artist, cancel, delete) happens on the detail page, behind its
existing confirm dialogs. Keep all existing logic, guards, confirm copy and error handling. This step
is a re-layout, not a behaviour change.

Reuse step 2 pieces: `AdminPageHeader`, `Panel`, `AdminConfirmModal`, tokens. New shared pieces this
step introduces (put them in `src/components/admin/ui/`, document them in components.md):
`StageTabs`, `Callout`, `SearchField`, `DataTable` (+ `EmptyState`), `AdminBreadcrumb` (spec in Q4),
`ProgressSteps`, `CopyField`, `StatusPill`.

---

## 1 · Orders list (`/admin/orders`)

- Header: eyebrow *Sales*, title **Orders**, sub *Every buyer order, from payment to artist payout.*
- **StageTabs**: one row, bottom border `--color-border-default`.
  - Left group: the 7 fulfillment buckets in `BUCKET_ORDER`, each `[step circle n] Label [count]`.
  - Right group, after a 1px divider: Canceled, Refunded, Needs attention (no step circle).
  - Selected: 2px `--color-dark-surface` underline, 600 weight, step circle dark. 44 px tall.
  - Count pill: 0 → `--color-gray-20` bg, `--color-gray-70`-ish text (#999 on #f0f0f0 is fine at 11px bold? No: use `--color-text-secondary`); >0 → `--color-gray-25` bg, black text; selected and >0 → dark bg, white text; Needs attention >0 → `--color-red-50` bg, white text, always.
  - Keep today's special case: Refunded turns amber only when > 1.
  - `role="tablist"` / `role="tab"` / `aria-selected`; arrow keys move between tabs.
  - Selected tab lives in the URL: `?stage=<Bucket>` (closes Q1). Dashboard cards and pipeline rows link with it.
  - Under 900 px: both groups scroll horizontally in one row (no wrap), selected tab scrolled into view.
- **Callout** under the tabs: icon + **bold first sentence** + the rest. Copy per bucket:

| Bucket | Tone | Text |
| --- | --- | --- |
| new | amber, Warning fill | **Capture the payment first.** The buyer paid and the card is on hold. Once the capture succeeds the order moves to “To place at TPS”. Never place at TPS before capturing. |
| to-place | info | **Place and pay the order at TPS.** Payment is captured, so you hold the buyer’s money. Order it on theprintspace, then mark it placed. |
| at-tps | info | **Waiting for TPS.** Mark it in production once theprintspace confirms they are printing. |
| production | info | **TPS is printing.** When they ship, add the tracking link and mark it shipped. |
| shipped | info | **On its way.** Mark delivered once the buyer has it. |
| delivered | info | **Pay the artist.** You can pay any time. The {PAYOUT_SAFE_WINDOW_DAYS}-day count is only a hint for buyer-dispute risk. |
| done | plain | **Complete.** Delivered and the artist is paid. Nothing left to do. |
| cancelled | plain | **Pulled out before delivery.** Buyer canceled, TPS rejected the file, prints disabled… Refunds, if needed, are on the order page. |
| refunded | plain | **Money returned.** The buyer was refunded. Nothing left to do. |
| attention | red, Warning fill | **Something went wrong.** Failed payments, rejected orders, refunds owed. Each case differs: open the order to sort it out. |

  Info/plain = white bg, default border, Info light icon. Amber = `--admin-amber-bg` / `--admin-amber-border`, text #5c4503. Red = `--color-red-30` / `--color-red-40`, text `--color-red-70`.
- **Panel** with toolbar: `SearchField` (magnifier icon inside, placeholder *Search reference, payment ID, buyer or artwork*, max 380 px), count on the right ("6 orders").
- **DataTable** (header row `--color-gray-15`, 12 px 600 secondary; rows 14 px padding, divider `--color-gray-20`, top-aligned; scrolls sideways inside the panel under ~760 px):

| Column | Content |
| --- | --- |
| Date | date; under it in New the hold countdown (`Hold 1 day · ~6 days left`, 12 px secondary; urgent/expired 600 `--color-red-50` + red dot); in Needs attention the short reason |
| Order | ref in Geist Mono 13/500 black, a link to the detail; line 2: artwork · variant (secondary) + `#n/N` in mono 12; up to 3 items then "+n more"; Replacement → small info badge "Replacement" (×n) |
| Buyer | name; email 12 px secondary |
| Shipped | only Shipped + Delivered |
| Artist payout | only Delivered + Artist paid: dot + text (green past the safe window / paid, amber before) |
| Total | right-aligned, tabular |
| Next step | right-aligned link-button with caret: label from `nextAction`. Dark (`--color-dark-surface`) for working stages, outline for done/canceled/refunded ("View"), red for Needs attention ("Resolve"). 36 px desktop, 44 px under 900 px |

- **EmptyState** inside the panel: circle with Tray icon, bold title, one secondary line. Copy per bucket in the design's `meta.empty`.
- **Phone (< 900 px)**: the table becomes a list of cards, one per order: line 1 ref (mono) + total right; line 2 artwork · variant; line 3 buyer name; hold/payout line if any; full-width next-step button at the bottom. Cards separated by dividers inside the panel.

## 2 · Order detail (`/admin/orders/[id]`)

- `AdminBreadcrumb`: **Orders / {ref}** (ref in mono). Replaces "back to all orders".
- Header: artwork thumbnail 96×72 (radius 4; first item's image), h1 **Order {ref}** (ref in Geist Mono 500),
  `StatusPill` with the current bucket label (dark; red for attention, outline for canceled/refunded),
  meta line *Placed {date, time} · {n} print(s) · **{total}** · {buyer}*, and **Copy reference** on the right.
- **Warnings** (between header and progress), full-width `Callout`s, only when they apply, copy carried
  over from today's `IssueBanner`s without emoji: red *Authorization expired, no payment collected*;
  red *Payment failed, card declined*; amber hold countdown (*Card on hold until {date}. Capture before then.*);
  amber *Refund needed* with the existing explanation and a **Refund the buyer** button.
- **ProgressSteps** panel: 7 steps, circles 28 px joined by a 2px line (dark up to the current step,
  `--color-gray-25` after). Done = dark filled circle with check; current = white with 2px dark ring +
  4px `--color-gray-20` halo, bold label; future = grey outline, secondary label. Date/time under each
  reached step. Canceled orders: show the steps reached, then a red "Canceled" end marker.
  Under it, the **Next step** box (`--color-gray-15`, radius 8): eyebrow "Next step", one sentence for the
  stage, **Cancel order** (outline) and the primary action (dark). The shipped flow keeps its inline
  tracking-URL field, shown inside this box. On Delivered, the box points to "Pay the artists" below.
- Two columns (`2fr / minmax(300px, 1fr)`, stack under 900 px: side column goes after the main column):
  - **Main**:
    - **Items · n prints**: per line thumbnail 72×54, title, *artist · edition type · variant · #n/N · Qty*,
      specs as a 3-column definition grid, money on the right (TPS, Artist, Gallery, Payout status dot).
    - **Pay the artists** (Delivered+ only): today's per-line payout controls, same layout as Items lines.
    - **For TPS placement**: header has **Open theprintspace ↗**. Per item a bordered block titled
      "{TITLE} · {ARTIST}" (12 px caps), each field a `CopyField` (label 150 px, value in mono, **Copy**
      button → "Copied" for 2 s). Recipient block with **Copy address** (whole address, one action).
    - **Timeline**: one row per event (dot, readable message, "kind · actor", time right). Newest first.
      Raw payloads behind a collapsed **Show raw event data** disclosure.
  - **Side**:
    - **Buyer**: name, email (mailto), country, ships-to address.
    - **Money**: *Paid by buyer* big (28/700), state line (e.g. "card on hold until captured", "captured
      {date}", "refunded {date}"), then Artist cut, Gallery cut, Production, Production shipping, Customer VAT.
    - **Invoice**: number (mono) + status badge (Sent green / Not issued neutral / Email failed red),
      See invoice, Send again, Issue credit note; credit note the same way under it when it exists.
    - **If something goes wrong**: **Reprint as a replacement…**, **Refund the buyer…** (red text), each
      opening today's flows.
    - **Test data** (dashed, only when `DEV_CLEANUP_ALLOWED`): badge "Staging only", today's copy, outline-red **Delete order**.
- Phone: one column; progress shows as a compact line "Step 2 of 7 · To place at TPS" with a thin bar,
  and the full list in a disclosure; Next step buttons full width, stacked (primary first).
