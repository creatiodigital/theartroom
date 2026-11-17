# Visitor-side clarity audit (2026-11-17)

Owner: "audit the whole client side… tell me if you see other places, UI or UX, that are NOT clear to the users… be as
transparent, clear, as possible." Walked the live site (theartroom.gallery) as a buyer, desktop and phone, up to the
checkout address step (no order placed; the test cart item was removed), and read the code for what can't be reached
without paying. Each finding: what the visitor sees → why it's a problem → the fix. Owner decides; nothing is built yet.

## A. Money and trust (fix first)

**A1. Prices are shown without VAT; EU buyers pay 21% more at checkout.**
Artwork page €374 → wizard €374 → cart €374 "Shipping and taxes are calculated at checkout" → after the address,
+21% VAT (`getVatRate`: every EU country → 21%) + shipping: €374 becomes €452.54 + shipping. The same "bait" feeling
we just fixed for framing, but larger, and for every EU buyer. EU consumer price rules expect the price shown to
consumers to be the final price including VAT (Price Indication Directive 98/6/EC); `minimumPrice.ts` already notes
this. (Not legal advice: worth confirming with the gestor/lawyer.)
Fix: show prices **VAT included** everywhere (artwork page, wizard, cart). At checkout, a non-EU address removes the
VAT ("VAT not charged outside the EU: −€78.54"), a pleasant surprise instead of a bad one. One line under prices:
"VAT included. Shipping calculated by country."

**A2. The total appears only after name, email, phone and full address.**
Shipping and VAT depend only on the country and the size (`getQuote`), yet "Shipping and VAT: Calculated after the
address" stays even after choosing the country. People won't type their details to learn the price.
Fix: show shipping and the total as soon as the country is chosen; also a country picker in the cart
("Shipping to Spain: €18").

**A3. "Signed by the artist" is said three different ways.**
Home and Prints headline: "Every print, approved and **signed by the artist**." Limited-edition Learn more: "the
signature is on the certificate, **not the print**." Terms of sale: certificate "**where applicable**". A buyer expecting
a signed print will feel misled.
Fix: one true sentence everywhere, e.g. "Approved by the artist, with a certificate of authenticity hand-signed by the
artist." Make the terms say the same (or say exactly when it doesn't apply).

**A4. The pictures show frames the price doesn't include.**
Magnolia I's page shows a wood frame with a mat; the edition is "Sold unframed" (Print only). Open editions also show
a black frame next to an unframed "From" price.
Fix: limited editions show the unframed print (paper, border, number). Open editions: a small caption under the image,
"Shown with an optional frame."

**A5. Delivery time: three different promises.**
Checkout and order email (EU): "delivered in 6–10 business days". Wizard Learn more: "dispatched within about two
weeks… delivery typically 1–2 weeks" (up to ~4 weeks). Terms: 1–2 days review + 5–10 days production + transit.
Fix: one honest estimate per country from one source, shown on the artwork page ("Made to order · arrives in about
2–3 weeks"), the cart, checkout and the email.

**A6. "Made to order, can't be cancelled once in production" is only in the terms.**
The payment step only links the terms. This is the one rule most likely to cause a dispute.
Fix: one line above the pay button: "Made for you: once your print is in production the order can't be cancelled.
If it arrives damaged or wrong, we replace or refund it." (Also likely required before purchase under EU rules; check.)

**A7. A false promise on the Prints page.**
"Every option is shown in a live 3D preview" — the wizard now shows the 2D drawing. Fix: "…shown on a measured drawing,
so you see the exact size before you order."

## B. Clarity (fix soon)

- **B1. No prices before the artwork page.** Prints page and exhibition cards say "Order print" but no price; visitors
  open each work to learn the cost. Add "From €303" on each card.
- **B2. Works without "Order print" give no reason** (e.g. Cielo sobre Deauville, Alas para tres). Say "Original only ·
  Inquire" or "Not available as a print".
- **B3. Ten works are called "La memoria de las puertas"** (plus two "Oculus", 2025). Impossible to tell apart in lists,
  the cart and orders. Ask the artist for numbering (I, II…) or a place name.
- **B4. Variant names like "S1 22 x 33"** show in the wizard, cart and checkout ("LIMITED EDITION · S1 22 X 33").
  Rename to words (already specced: units.md, "Variant names").
- **B5. The wizard preview shows "1/30"** written on the print. The terms say the number is allocated at sale; a buyer
  may think they're getting no. 1. Show "—/30" or label it "example".
- **B6. Limited-edition rules are hidden in Learn more:** one per household; "price might rise as the edition sells".
  Put the price rise next to the price ("Price rises as the edition sells") — it's also a reason to buy now.
- **B7. 3D room: details are invisible.** Details open only on **double-click**, which nothing tells you; the controls
  guide is inside the menu; the wall view shows no title, price or way to order. Add a one-time hint on arrival
  ("Drag to look around · click a work to approach · double-click for details") and a small caption in wall view
  (title, artist, "Details / Order a print").
- **B8. Room loader**: ~15–18 s in my test with only a moving line (measured through a remote browser, so maybe
  slower than real). Show progress ("Loading 26 works… 60%").
- **B9. Inquire form** doesn't say what it's for or when you'll hear back, and asks for a phone. Add: "Questions about
  this work, a custom size or the original? We reply within N working days." Make phone optional.
- **B10. Contact page has nothing for buyers** (order questions, reply time). Add "Questions about an order? Write with
  your order number."
- **B11. Checkout country menu**: typing doesn't jump or filter in the long list.
- **B12. Cart link "Back to editions"** is unclear. "Change edition" or "Back to the artwork".
- **B13. The artwork page still has a cm | in switch** (decided: footer line + wizard only). Probably a deploy in progress.

## C. Polish

- **C1.** Exhibitions show "Current" but no dates. Add "Until 31 January 2027" (or "Ongoing").
- **C2.** Exhibition texts: Lucie Bonvalet's is in first person ("my watercolors"); Mathias Heizmann's opening isn't a
  description of the show. Ask for a third-person, two-line summary for listings.
- **C3.** The seller (The Art Room Gallery, S.L., NIF, address) is named only in the privacy policy. Add it to the terms of
  sale and the footer's legal row page.
- **C4.** Opportunity: unframed prints above a lab-cost threshold ship free (`TPS_FREE_PRINT_DELIVERY_FROM_CENTS`).
  If that covers most prints, say it: "Free shipping on unframed prints".

## Already clear (keep)
The card hold is explained plainly ("We'll hold your card now and charge it once your print enters production");
"Not reserved until you pay" for limited editions; the address warning; "Where we ship"; one-per-edition in the cart;
the new print block on the artwork page; "From" price = wizard's first price.
