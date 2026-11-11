# Public site · Order a print, cart, checkout, confirmation

Designed 2026-11-11 (owner happy with the day's work; confirm before building). Same flow, steps, data and logic as
today: configure → cart → shipping → review → payment → confirmation. **UI only.** No underlines.

Designs (`designs/`): `order-configure-open-size`, `order-configure-open-frame`, `order-configure-limited`,
`order-learn-more`, `cart`, `checkout-1-shipping`, `checkout-2-review`, `checkout-3-payment`, `order-confirmed`,
`order-unboxing-request` (all `.dc.html`).

## Order a print (`/artworks/{slug}/print`)
- Top bar: wordmark left; centre *"Order a print · *Title*, Artist"* (title in EB Garamond italics, the comma right
  after the title); cart and **Close** on the right.
- **Keep the 2D measurement drawing exactly**: outside dimensions above and left, image dimensions below and right,
  arrows as today. No caption under it.
- Left panel, open edition: three numbered steps **Print / Size / Frame**; a closed step shows its choice as a grey
  summary line ("30 × 20 cm · 3 cm border").
  - Size: *Print size (cm)* height × width fields (aspect locked), the range slider with min/max, the paper border
    slider; short help texts. **No preset sizes.**
  - Frame: *Print only | Framed*; **frame types as 4 photo cards** (today's helper photos /assets/helpers/*.jpg) with
    the selected one's description under them; moulding as colour swatches (White, Black, Oak, Walnut, Beech, Silver,
    Gold) + profile chips (Thin / Wide / Rounded…, from the data); **glass and hanging as option lists with the
    description written under each option** (replaces the hover pop-ups); mount as chips.
- Left panel, limited edition: *Choose your edition* cards (name, paper, sizes, *Edition of N · N left*, price).
- Right panel: edition type, title, artist; the summary list; price (EB Garamond 30); **Add to cart** (black, bag
  icon); shipping/taxes + certificate line; then a clear row **"What is an open / a limited edition?"** with an Info
  icon, grey sub-line *"Terms of sale and shipping"* and a caret, background `#f8f8f6`, opening the Learn more window.
- Limited editions keep *"Not reserved until you pay: another collector may take it first."*

## Learn more window
640 px sheet: small caps *About your print*, heading *Open edition* / *Limited edition* (EB Garamond 34), the artwork
and artist; sections **Terms of sale** and **Shipping** as serif 22 headings with today's bullets (dashes removed);
**→ Read the full terms of sale**. No monogram. Close top right.

## Cart
Items: thumbnail 120 px, title (serif italics), artist, edition (small caps), the specs in 3 short lines, **Edit**
(open editions) and **Remove**; price right; quantity stepper (limited editions fixed at 1, note *"One per limited
edition"*). Right: *Order summary* panel (`#f8f8f6`): subtotal, shipping/taxes line, **Continue to checkout**,
**→ Continue browsing**, and the limited-edition reservation warning with a lock icon.

## Checkout
- Step indicator: **Shipping → Review → Payment** (done steps get a check).
- Shipping: today's form and the address warning; right panel shows items and *"Shipping and VAT: Next step"*.
- Review: *Shipping to* block with **→ Change**, the items, summary with totals and **Continue to payment**.
- Payment: Card / PayPal choice cards, Stripe's element, the Stripe sentence with a lock icon, **← Back to review**;
  right: items, totals, **Pay €…** (lock icon), the terms-of-sale line. Confirm Stripe element styling options.

## Order confirmed (CartConfirmation)
Check circle; *"Thank you, your order is confirmed."* (EB Garamond 48); today's paragraph; **Order reference** box
(*"Also in your confirmation email"*); **What happens next**: 1 Order confirmed (authorized, nothing charged) · 2 In
production (payment taken) · 3 Shipped (tracking email); the edition-number notice (limited only, as today);
**Browse more prints** + **→ Visit the exhibitions**. Right: *Your order* (items, totals "Total, authorized",
shipping address). Finalizing / failed states: same layout, today's texts, no steps.

## "A small request" (UnboxingReminderModal)
520 px: camera icon in a soft circle, *A small request* (EB Garamond 32), today's two paragraphs (dash removed), the
reminder line, **Got it**. Logic unchanged (once per order).
