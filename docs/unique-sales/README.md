# Unique pieces: selling originals (paintings, sculptures, Object editions)

Owner's decisions, 2026-11-23. Planned with Design Claude. **Status: approved by the owner 2026-11-23, ready to build
(steps U1–U5 below; U7 later; one way of selling per artwork, 2026-11-25). Branch per the owner's instructions.**
Designs in `designs/`: `unique-sales-list.dc.html` (Admin › Sales › Unique pieces, interactive tabs),
`unique-sale-record.dc.html` (one sale), `unique-availability.dc.html` (Available / Reserved / Sold everywhere), `unique-sales-tab.dc.html` (editor Sales tab).

## Decision 2026-11-25 (owner): one artwork = one way of selling — supersedes "both" everywhere below
Owner: "It's really confusing that the same artwork has a print or unique piece option. They should be separate
objects. Either we create the unique piece (as a sculpture), or we create a print for that sculpture as a separate
artwork."
- Every artwork is sold **one way only**: **Prints** (image works only, today's flow), **Unique piece** (image works
  — a painting, a drawing — and Objects), or **Not for sale** (Inquire only). Never two at once.
- The print of a painting or of a sculpture is **its own artwork**: a separate Image artwork made from a photo,
  with its own title, page and print sales. The original is another artwork, sold as a unique piece.
- So: **no** "Original" + "Prints" blocks on the same page, **no** "Stop print sales of this work" on a sale record,
  **no** Print image picker for Objects (old U6 is cancelled), and **Objects never sell prints** (O1's rule stays).

## Principle: two separate businesses
- **Prints**: unchanged. Checkout, Stripe, TPS, automatic statuses.
- **Unique pieces**: sold by **Inquire** and direct conversation (owner ⇄ buyer ⇄ artist). No "buy now", no cart,
  no checkout, no TPS, no PrintOrder. The owner keeps a **record** of each sale by hand; the system helps, it does
  not run the process. Precedent in the code: `OffPlatformOrder` (outside the print pipeline, still feeds payouts).

## Flow
1. **Inquiry**: today `/api/inquire` only emails the gallery. Also store it (new `Inquiry` row) so a sale can be
   started from it with buyer + artwork prefilled.
2. Negotiation happens outside the system.
3. Owner creates the **sale record** (status Agreed). The artwork shows **Reserved**.
4. **Payment**: Stripe one-time payment link created from the record for the agreed price (+ shipping when the
   buyer pays it). Paid by the buyer → record goes to Paid and the artwork to **Sold** automatically (the only
   automation). Or bank transfer (IBAN + reference UP-xxxx shown to copy), marked received by hand.
5. **Delivery** (below). 6. Delivered → artist share joins **Payouts**. 7. Closed.

## Statuses (manual, each change logged with date in the timeline)
Agreed → Paid → Shipped → Delivered → Closed. Side branches: Cancelled; Refund requested → Refunded.
"More" menu: back one step, refund requested, cancel (artwork back to Available).

## Certificate of authenticity (owner 2026-11-25)
Prints: theprintspace issues the COA, as today. **Unique pieces: The Art Room issues it.** In the sale record:
1. **Generated** from the record and the artwork (title, artist, year, materials, size, edition / unique, date,
   gallery details), as a PDF to print.
2. **Signed by the artist by hand**; a scan of the signed copy is uploaded to the record.
3. **The signed original travels with the piece** (a tick: "Packed with it").
4. **A copy goes to the buyer** by email from the record (the scan), logged in the timeline.
For an Object edition, one certificate per cast, with its number. Board: `unique-sale-record` › Documents.

## The sale record (`unique-sale-record`)
- **Artwork** (picked from the library; only works sold as **Unique piece**).
- **Buyer**: name, email, phone, country, delivery address.
- **Price**: agreed price, gallery commission % (**negotiated per sale**, required, no fixed default), artist /
  gallery split computed.
- **Payment**: method (Stripe link / bank transfer / other), link + copy, status, reference.
- **Delivery and risk** (one per sale; decides who pays if damaged):
  | Option | Risk |
  |---|---|
  | Buyer collects | buyer from handover |
  | Artist delivers in person | artist until handover |
  | Artist ships | artist pays if damaged |
  | Art shipper · **Arta** | Arta transit insurance |
  Shipping paid by Buyer / Gallery / Artist. **Condition photos before it leaves** (front, back, corners).
- **Arta** (https://www.arta.io, API: https://api-reference.arta.io): from the record, request quotes with origin
  (artist), destination (buyer), package size/weight and declared value; Arta returns quote types (Premium, Select,
  Parcel, Self Ship) with price and transit insurance. **Quotes are available from Agreed**, so the owner can tell
  the buyer the exact shipping cost and include it in the payment link. Book → Arta reference, pickup, tracking;
  Arta collection → Shipped. Check quote validity and EU/Spain coverage when integrating (not confirmed yet).
- **Documents**: buyer invoice, certificate of authenticity, shipping receipt, other.
- **Summary** (price, shipping, buyer paid, split, payout status) and **Timeline** with notes.

## Artwork editor: a **Sales** tab (board `unique-sales-tab.dc.html`, but read this section, it supersedes the board)
The artwork editor (image and object artworks) gets two tabs: **Artwork** (cover/image, photos and reels, details,
description, where it shows, 3D model for Objects) and **Sales**. The Sales tab starts with **one choice,
"How it is sold"** (a 3-way segmented control, today's admin/studio style):
- **Prints** (image works only): today's Print sales section, unchanged (series type, price, variants,
  restrictions, recommendations), then Ready to sell.
- **Unique piece** (image works and Objects):
  - a line: visitors see only **Inquire**; the gallery negotiates and sells;
  - **Suggested price** (€): **set by the artist**, seen by the gallery, **never shown publicly or returned by any
    public API**; prefills "Agreed price" on a new sale record, which shows the difference;
  - **Lowest acceptable** (€, optional): admin only, never shown to the artist's dashboard or the public;
  - for Object editions: "Edition 3 of 8" from Details (each cast = one sale record; "5 of 8 available" →
    "Sold out");
  - **Availability** Available / Reserved / Sold: admin editable (+ **Reserved until**); artist read-only +
    **Sold elsewhere…**; link to the open sale / **New sale of this work** (admin);
  - **Hide when sold**.
- **Not for sale**: nothing to set; the page shows the work and Inquire.
Objects show only **Unique piece** and **Not for sale** (no Prints option). A short help line under the choice:
*"Selling prints of this work? Create a separate Image artwork from a photo of it."*
**Locks:** leaving **Prints** is refused while the work has print orders or published edition numbers
(`editionLocked`), with that reason; leaving **Unique piece** is refused while a sale is open or the work is Sold.
Header chip shows the one mode: "Selling prints", "Unique · Reserved", or nothing.

## Availability on the artwork (`unique-availability`)
- The artwork's **How it is sold = Unique piece** turns this on. Not for sale → no status label (never "not for
  sale"), but **Inquire stays** so the gallery keeps the contact and can offer other works (owner, Q-U4).
- **Three states**: Available · Reserved · Sold. Set automatically by the sale record (Agreed → Reserved, Paid →
  Sold, Cancelled/Refunded → Available) and by hand in the admin editor. Manual Reserved asks **Reserved until**
  (7 days default) → reminder to the owner that day; never released automatically.
- Public artwork page, info column: an **Original** block (status line + Inquire, **no price and no "Price on
  request"**, decided from the White Cube reference below; the boards still show that line and a Prints block:
  ignore both). A unique piece's page never has a Prints block. Reserved: grey ring + "Reserved", text inviting to
  leave details, Inquire. Sold: **red dot** + "Sold", "Ask about similar works".
- **Reference: White Cube** (owner, 2026-11-23, whitecube.com artwork page): no price for unique pieces, not even
  "Price on request": just artist, title (italic), year, one outlined **Enquire**, then materials and size in
  cm | in, plus the **framed** size on its own line, a row of view thumbnails (front, angle, in a room with a person
  for scale, detail) and Share. **Decided (owner approval 2026-11-23):** no "Price on request" line, only Inquire;
  an optional **framed size** (H × W × D cm) in Details for images and objects, shown on its own line
  "… (framed)"; the status line (Reserved / Sold) stays as our own addition.
- **Inquiries on Reserved and Sold works are leads** (owner, 2026-11-23): Reserved keeps Inquire (outlined) with
  *"Another collector is finalising this work. Leave your details and we will tell you if it becomes available."*;
  Sold has *"Ask about similar works"*, which opens the same Inquire form. Every one is stored as an `Inquiry` with
  the work's status at that moment (`artworkStatusAtInquiry`), shown in admin with a tag ("asked while Reserved" /
  "asked after Sold"). If a reserved sale is cancelled, the sale record and the artwork say *"N people asked about
  this work while it was reserved"* with their contacts, so the owner can offer it to them first.
- Same mark after the year in every grid and in the 3D room info panel. Sold works stay visible; per-artwork
  **Hide when sold** (off by default).
- Editions of Objects: "3 of 8 available", then "Sold out".
- Artist side: sees the state read-only + **Sold elsewhere…** (date, optional price) → shows Sold, notifies the
  gallery, no sale record.

## Data (one migration, U1; ask the owner before running it, as for every migration)
- `Artwork`: `saleMode String @default("none")` (prints | unique | none; backfill `prints` where
  `printEnabled` is true, and keep `printEnabled` in step with it so the print pipeline is untouched), `suggestedPriceCents Int?` (artist), `lowestPriceCents Int?`
  (admin only), `framedHeightCm/WidthCm/DepthCm Float?`, `originalStatus String @default("available")`
  (available | reserved | sold), `reservedUntil DateTime?`, `hideWhenSold Boolean @default(false)`,
  `soldElsewhereAt DateTime?`, `soldElsewherePriceCents Int?`.
- `Inquiry`: artworkId, name, email, message, artworkStatusAtInquiry, createdAt, handledAt?, saleId?.
- `UniqueSale`: ref (UP-0001…), artworkId, inquiryId?, status, buyer fields + address Json, priceCents,
  commissionPct, artistCents, galleryCents, paymentMethod, stripePaymentLinkId?, paymentIntentId?, paidAt?,
  deliveryMethod (collect | artist_delivers | artist_ships | arta), riskNote, shippingCents, shippingPaidBy,
  artaRequestId?, artaShipmentId?, trackingUrl?, shippedAt?, deliveredAt?, closedAt?,
  artistPaidAt? (feeds Payouts), documents (R2 keys), events (timeline rows).
- Nothing touches `PrintOrder`, cart, checkout or TPS code.

## Owner answers (2026-11-23)
- **Q-U1 Seller of record: The Art Room Gallery SL.** The gallery sells and invoices the buyer for the full price
  (buyer invoice issued by The Art Room Gallery SL); the artist's share is paid through Payouts, like prints. The VAT
  treatment of each sale (e.g. margin scheme vs. standard) is for the gestor to confirm before the first sale.
- **Q-U2 Commission is negotiated per sale.** Entered on each sale record, required; nothing taken from the print
  pricing setting.
- **Q-U3 Reserved is shown publicly**, so nobody gets false hopes.
- **Q-U4 Inquire stays** even when Sell as unique is off: a contact with a potential collector, to offer other
  works.

## Still open
- **Q-U5** Artist terms must state "artist ships = artist pays if damaged" before the first sale.
- **Q-U6** Arta: account, pricing, EU/Spain coverage, quote validity (evaluate before integrating).
- **Q-U7** VAT treatment per sale (gestor), and whether the artist invoices the gallery or the gallery self-bills.

## Order of work
Each step is shippable on its own. Follow the repo's admin-redesign rules for `/admin` and the public-redesign rules
for visitor pages (square corners, no underlines). **Stop and ask the owner** before the migration (U1) and before
anything that moves money (U5's Stripe link).

**U1 · Data.** The migration above (`Artwork` fields, `Inquiry`, `UniqueSale` + `UniqueSaleEvent` for the
timeline, documents as R2 keys). Public queries and APIs must **never** return `suggestedPriceCents` or
`lowestPriceCents`; the artist's dashboard never returns `lowestPriceCents`. Add a test for both.

**U2 · Inquiries are stored.** `/api/inquire` keeps its admin email and also writes an `Inquiry` (with
`artworkStatusAtInquiry`). Admin › Sales › **Inquiries**: a plain list (date, artwork, name, email, message, tag
"asked while Reserved" / "asked after Sold", handled checkbox, "Start a sale" → new sale record prefilled). No board
yet: build it with the existing admin list pattern (Orders) and note it in Built notes.

**U3 · Artwork editor › Sales tab** (`unique-sales-tab`). `ArtworkEditForm` gets two tabs, **Artwork** and
**Sales**, for image and object artworks. The Sales tab opens with **How it is sold**
(Prints / Unique piece / Not for sale; Objects: no Prints), then only the chosen mode's settings (above). Move
Print sales, printing restrictions / recommendations and Ready to sell under Prints unchanged. Server: refuse
(400) any save that would make a work sell two ways, and the locks above. Add the optional **framed size** to
Details.

**U4 · Availability on the site** (`unique-availability`). Original block on the artwork page (Available /
Reserved / Sold, Inquire always; "Ask about similar works" when sold), the mark after the year in every grid and in
the 3D room's artwork overlay, Hide when sold, Object editions "N of M available" / "Sold out". No Prints block on a
unique piece's page. Daily job: email the owner when a
manual **Reserved until** date is reached (never release automatically).

**U5 · Admin › Sales › Unique pieces** (`unique-sales-list`, `unique-sale-record`).
- List with stage tabs and counts; sale record with the sections on the board. Statuses with a logged event per
  change and the artwork status kept in sync (Agreed → Reserved, Paid → Sold, Cancelled/Refunded → Available;
  for Object editions, count casts instead).
- Commission required per sale; split computed.
- Payment: **Stripe one-time payment link** for price + shipping when the buyer pays it, paid → Paid
  automatically through the webhook, in a **separate handler path** that never creates a `PrintOrder` or touches
  cart/checkout/TPS. Bank transfer: IBAN + reference UP-xxxx, marked received by hand. Ask before enabling in prod.
- Delivery and risk: the four options with their risk line; shipping cost and who pays; carrier/reference/tracking
  fields filled by hand (Arta included, manually, until U7); condition photos and documents uploaded to R2 (private
  bucket when configured).
- Buyer invoice: **upload a PDF only** for now; do not generate tax invoices until Q-U7 (VAT) is answered.
- Delivered → the artist share appears in **Payouts** (same manual tick + monthly artist-invoice batch as
  `OffPlatformOrder.artistPaidAt`). Closed when the artist is paid.
- "N people asked about this work while it was reserved" on a cancelled sale and on the artwork (from U2).

**U6 · Cancelled (owner 2026-11-25):** no prints of Objects; a print of a sculpture is a separate Image artwork.

**U7 · Arta (later, after Q-U6).** Quotes from the sale record (from Agreed), booking, tracking, webhooks. Until
then Arta is a manual delivery option.

## Where things live in the code today (starting points, checked 2026-11-23)
- Inquire: `src/app/api/inquire/route.ts`, email `src/lib/emails/inquiryAdminNotification`.
- Artwork editor: `src/components/shared/ArtworkEditForm/` (`index.tsx`, `sections.ts`, `SectionNav.tsx`).
- Precedent outside the print pipeline: `OffPlatformOrder` (schema) and the Gift orders admin page.
- Admin sales pages: `src/app/admin/orders`, `payouts`, `invoices`, `pricing`, `gift-orders`.
- Public artwork page: `src/app/artworks/[slug]/page.tsx`; spec `docs/public-redesign/artwork.md`.

## For Code Claude
Write a "Built" note per step at the end of this file (step, PR/commit, differences from the board and why), open
points as new **Q-U** questions, and don't change the owner's decisions above without asking.

## Built

**U1 · Data** (2026-11-25, branch `feat/AR-191-add-3d-artworks`, commit 37e1e07f; schema applied to the DEV
database with the owner's go-ahead the same day; **production still needs it before release**, additive only).
- `Artwork`: `saleMode` (default "none"), `suggestedPriceCents`, `lowestPriceCents`, `framedHeightCm/WidthCm/DepthCm`,
  `originalStatus` (default "available"), `reservedUntil`, `hideWhenSold`, `soldElsewhereAt`,
  `soldElsewherePriceCents`. New tables `Inquiry`, `UniqueSale`, `UniqueSaleEvent` (the timeline).
- **Private prices, by construction**: the Prisma client itself leaves `suggestedPriceCents`, `lowestPriceCents`
  and `soldElsewherePriceCents` out of every query (`PRIVATE_ARTWORK_OMIT` in `src/lib/artworkFields.ts`, applied as
  the client's global `omit` in `src/lib/prisma.ts`). A page that spreads a whole row (the artwork page does) cannot
  leak them; U3's editor routes will name them (`omit: { suggestedPriceCents: false }`), the artist's routes never
  the lowest. `e2e/unique-private-prices.spec.ts`: the client omits them; the artwork page, by-slug, by-id, library,
  artist page, exhibition page and by-url answers never carry them; the artist's dashboard never the lowest.
- **One way of selling, kept in step**: `saleMode` follows the print switch in the artwork save until the Sales tab
  (U3) writes it (`saleModeAfterPrintSwitch`: on → "prints", off turns "prints" into "none", a unique piece is left
  alone), so the print pipeline, which reads `printEnabled`, is untouched. `scripts/backfill-sale-mode.ts` (dry run,
  `--apply`) set the 102 dev works selling prints to "prints"; run it on production after the schema push.
- Differs from the Data list, and why:
  - `soldElsewherePriceCents` is private too (an artist's own sale price), left out with the two prices.
  - `Inquiry.artworkId` is optional, `onDelete: SetNull`: inquiries are leads and outlive a deleted work.
  - `UniqueSale` keeps its work (`onDelete: Restrict`): an artwork with a sale record can't be deleted. U5 should
    refuse that delete in words (today the database refuses it).
  - One link between an inquiry and a sale, `Inquiry.saleId` (the inquiry a sale started from, and the leads
    attached to it), not also `UniqueSale.inquiryId`: two foreign keys for one link could disagree.
  - `carrier` and `trackingRef` added now (U5 fills them by hand), so U5 needs no second migration.
  - `ref` ("UP-0001") is unique; U5 numbers it (next free number in a transaction, retry on a clash).
  - Object editions ("Edition 3 of 8", casts) are not modelled: Objects are always unique (owner, 2026-11-25).
