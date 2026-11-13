# Public site · Order a print, cart, checkout, confirmation

Approved by the owner 2026-11-11. Same flow, steps, data and logic as
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

## Checkout v2 (owner, 2026-11-13): replaces the layout of Shipping, Review and Payment
Design: `designs/checkout-v2.dc.html` (supersedes the layout of `checkout-1-shipping`, `checkout-2-review`,
`checkout-3-payment`; their texts, fields and behaviour stay). **Layout only: no change to how orders or payments work.**
- **No step indicator at all.** Remove the 1-2-3 circles and the Shipping/Review/Payment row. The page title stays
  *Checkout* (EB Garamond 52, 48 px top padding); each step's own heading says where you are.
- **Same two columns on every step, as in the cart**: grid `1fr 520px`, gap 96 px, page padding 100 px, 48 px below
  the title, `align-items: start`.
  - **Left, always: the order.** Serif 30 *Your order* with **→ Edit cart** on the right (same line), then the item
    rows (96 px thumbnail `#f2f2f2` contain, title serif italic 20, artist 14 `#555`, edition small caps 11.5 `#888`,
    spec line 13 `#999`, price right 16; hairline `#ececec` between rows), then the totals: *Items*; on Shipping
    *Shipping and VAT: Calculated after the address* (grey); from Review on *Shipping*, *VAT (21%)*, a hairline and
    *Total* with the amount in EB Garamond 30. The column is `position: sticky; top: 24px`.
  - **Right: the step.** Its heading (serif 30, same line and size as *Your order*, so both columns start together),
    then:
    - **Shipping**: today's address form, Country first with *Not sure we ship to you? Where we ship* under it;
      Email + Phone side by side; Address with *Enter address manually*; Apartment; City full width; State + Postal code
      side by side; black full-width **Continue to review**.
    - **Review**: *Check your order*; the *Shipping to* block (small caps label, **→ Change**, name, address, email ·
      phone) between hairlines; one line *Your prints are made to order and shipped in 7–10 working days.*; black
      **Continue to payment**; the limited-edition note 12.5 px `#999`.
    - **Payment**: *Payment*; Card / PayPal choice; Stripe's fields; black **Pay €{total}** with the lock icon; the
      Stripe + *Online terms of sale* line; **← Back to review**.
- **Phone**: one column. Under the title, the order folds into a bar (`#f8f8f6`): *Your order · 2 prints ⌄* and the
  current total; tap opens the same order block. Then the step. Email/Phone and State/Postal stack.
- Order confirmed keeps its own design (`order-confirmed`).

## "Where we ship" window (`checkout/AddressForm/ShippingCountriesModal`)
Design: `designs/checkout-where-we-ship.dc.html` (owner asked 2026-11-12; build as drawn). Same window style as the
Learn more window (square, shadow `0 30px 80px rgba(0,0,0,.25)`, dim backdrop `rgba(20,20,20,.45)`).
Keep today's logic: the list comes from `countryCodes`, picking a country sets it on the form and closes.

- **Header** (32 / 36 px padding, hairline under it): small grey caps *Delivery*, EB Garamond 34 *Where we ship*,
  15 px `#555` *We deliver to {n} countries. Choose yours to continue.*; **× Close** top right (icon + word, as Learn more).
- **Find your country**: a 48 px field in the checkout style with Phosphor `MagnifyingGlass` 18 px. Typing filters
  the list live (case- and accent-insensitive, matches the start of any word: "king" finds United Kingdom). Focused
  when the window opens on desktop, not on phone (no keyboard jump). Enter picks the only match.
- **Nobody may miss a country (owner 2026-11-12).** Desktop window **760 px wide, 4 columns**, rows 36 px: all
  of today's 38 countries are visible at once, **no inner scrolling**, nothing hidden. (Max height: viewport minus
  64 px top/bottom.)
- **List**: 4 columns desktop, 2 on phone, 15 px, 12 px side padding, hover/focus `#f5f5f3` (the only grey row). The
  country currently chosen in the form has **no background**: bold text (700) and a check (Phosphor `Check` 16 px)
  on the right, with `aria-current="true"`. Owner 2026-11-12: chosen and hovered must not look alike. Arrow keys move between rows.
- **When it does not fit** (phone always; desktop only if the list grows or the window is short): replaces today's
  faint "Scroll to see all countries". The last visible row fades, and right under it a **full-width bar** 40 px,
  `#f5f5f3`, 14 px `#1a1a1a`, caret-down 16 px: ***{n} more countries below*** (live count of the countries below the fold).
  It is a button: tap/click scrolls the list smoothly down one view. It disappears once the end is reached. On
  phone the bar stays pinned above the footer while the list scrolls.
- **No match**: instead of the list, serif 22 *We don’t ship to “{query}” yet.* and 15 px `#555` *Tell us where you
  are and it moves up our list.*
- **Footer** (hairline above): 14 px `#555` *Not on the list yet? We add new countries as we grow.* and
  **→ Tell us where you are** = `mailto:contact@theartroom.gallery?subject=Shipping%20to%20my%20country` (no dash
  sentence any more).
- **Phone**: full screen, 2 columns, the bar above, close is the × only.

## "A small request" (UnboxingReminderModal)
520 px: camera icon in a soft circle, *A small request* (EB Garamond 32), today's two paragraphs (dash removed), the
reminder line, **Got it**. Logic unchanged (once per order).
