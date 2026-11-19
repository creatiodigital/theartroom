# Sales › Pricing: the gallery commission (owner 2026-11-18, proposal)

Owner: "We will set the gallery general cut percentage in the dashboard. Currently it's hardcoded in the code. No more.
A field and a save button somewhere where I decide if the gallery gets 40%, 30%, etc. That's all."
Today: `TPS_GALLERY_MARKUP_RATE = 0.25` in `lib/print-providers/printspace/pricing.ts`, read by `minimumPrice`,
`formatDisplayPrice`, `variantMargin`, `getQuote`, `validateAndPriceItem`, `buildCartItem`, `createPaymentIntent`.
Boards: `AdminPricing.dc.html`, `AdminPricingStates.dc.html` (alternative: `AdminPayoutsCommission.dc.html`), copies in
`designs/admin-pricing*.dc.html`.

## Where
A new page **Sales › Pricing** (`/admin/pricing`), last in the Sales group after Payouts, icon Phosphor `Percent`.
One card today; the natural home for later price settings (e.g. VAT-inclusive display). Alternative on the canvas: the
same card at the top of Payouts.

## The card: "Gallery commission"
- Sub: "Added on top of each artist's price, for every artist and every print." (It is a markup on the artist's
  price, not a share of the sale: at 25% the gallery keeps 20% of the artwork price. The example says so.)
- A number field (0–100, whole numbers or one decimal) with a `%` suffix, and **Save**: disabled until the value
  changes; while changed, a note "Not saved yet. Currently 25%." Otherwise "Last changed {date}."
- **Example** box that follows the field live: Artist's price €200 / Gallery commission (40%) €80 / Artwork price €280,
  then "The buyer also pays the print, shipping and VAT. The gallery keeps 28.6% of the artwork price."
- Footnote: "A change applies at once to every price on the site and to carts at checkout. Orders already placed keep
  the price they were paid at, and the artists' payouts don't change."
- **Save asks first** (admin dialog): "Change the gallery commission to 40%?" + the example before → after; Cancel /
  Change to 40%. After saving: green "Saved. Prices now use a 40% commission."

## Build notes
- Store it in `SiteSettings` (new column, e.g. `galleryCommissionPct`, default 25 = today's value). A server reader that
  fails safe to the last known value (never to 0).
- Replace every use of `TPS_GALLERY_MARKUP_RATE` with the stored value, read once per request on the server and passed
  down; the client never computes prices from its own copy.
- Orders already store their prices (snapshots): unchanged. Carts are re-priced at checkout as today.
- Record who changed it and when (for "Last changed"); admin only.
