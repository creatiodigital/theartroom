# Take a peek: what arrives at your door

Owner's decisions, 2026-11-26. Designed with Design Claude. **Status: ready to build.**
Branch: `feat/AR-192-promotional-videos` (already created).

**Why:** no print has sold yet, so the site goes into promotional mode. A short video of a real print being
unboxed answers the main doubt about buying art online ("what will I actually get?"). It is shown as a small
looping circle that opens a modal, reused across the pages where a print can be bought, without becoming
tiresome or invasive.

Design canvas (source of truth for the drawings):
https://claude.ai/artifact/6bgANBsR3mtq5VctC9GR2S. Exports in `designs/` (read the source as the visual spec,
don't copy their markup or script, same as `docs/public-redesign/`):

| File | What it shows |
| --- | --- |
| `designs/Main.dc.html` | Homepage, Fine-art prints section, desktop: the full size |
| `designs/PhoneSection.dc.html` | The same section at 390 px |
| `designs/PlayerDesktop.dc.html` | The modal, desktop. Its `context` prop switches the button: `home` / `artwork` |
| `designs/PlayerPhone.dc.html` | The modal, phone |
| `designs/Component.dc.html` | The three sizes side by side, the copy and the rules |
| `designs/PrintsPlacement.dc.html` | Prints page: the full size under "Two kinds of prints" |
| `designs/ExhibitionPlacement.dc.html` | Exhibition page: the strip above the works (artist page: the same) |
| `designs/ArtworkPlacement.dc.html` | Artwork page: the inline size under Order a print |

Note: the boards draw the close and pause buttons round. **The square-corners rule wins**
(`docs/public-redesign/README.md`, "Square corners for visitors"): every button and the modal itself are square.
**The circle around the video loop is the one intended exception** (owner, 2026-11-26: "circle shape").

## The media (already in the repo)

`public/videos/take-a-peek/` (copied from the owner's Desktop › print-arrives):

| File | Use |
| --- | --- |
| `print-arrives-full.mp4` | The full video. 27.1 s, 1024 × 576, H.264, **no audio track**, 4.1 MB (recut 2026-11-26 at the original pace: nothing sped up), faststart. Opened in the modal only. |
| `print-arrives-preview.mp4` | The circle's loop: the **first second** of the full video, 640 × 360, no audio, 56 KB. |
| `print-arrives-preview.webm` | Same loop, VP9, 44 KB. List it first in `<source>`. |
| `print-arrives-poster.jpg` | First frame. `poster` for the loop and the still for reduced motion. |
| `print-arrives-thumb.gif` | Same second as a GIF (~950 KB). **Not used on the site** (20× the MP4); kept for emails. |

The full video is two edited takes joined: a gloved hand opens the shipping box, then the print comes out of its
tissue (black "carbon neutral" seal) and the camera ends on a close-up of the image (Elizabeth Mosler's beach
photograph). If these files move to `assets.theartroom.gallery` later, keep the names.

## The component: `TakeAPeek`

One shared public component (suggested: `src/components/ui/TakeAPeek/`), three sizes, one modal. Build it once.

**The circle (every size):** a `<video autoplay muted loop playsinline preload="metadata" poster=…>` with the
preview WebM + MP4, `object-fit: cover`, inside a ring: `border: 1.5px solid #1a1a1a` (`--public-text`),
4 px gap between ring and video (3 px at 56, 2 px at 44), `border-radius: 50%`.
- **A white play icon on top of the video, centred** (owner, 2026-11-26): Phosphor Play, fill, `#fff`, with
  `drop-shadow(0 1px 3px rgba(0,0,0,.5))` so it reads on the light box and paper; nudged 2–3 px right so the
  triangle looks centred; `pointer-events: none`. Size ≈ 30 % of the circle: **30 px** on 96, 26 on 84,
  19 on 56, 15 on 44. Same on every size; no other badge.
- Plays **only while on screen** (IntersectionObserver: play when ≥ 50 % visible, pause when not) and pauses
  while the tab is hidden.
- `prefers-reduced-motion: reduce`: no video at all, just the poster `<img>` in the ring.
- The whole thing (circle + words) is **one link-styled `<button>`** that opens the modal.
  `aria-label="Take a peek: watch what arrives at your door, 27 seconds"`; the video is `aria-hidden`.

**Copy (final, owner 2026-11-26):** label **TAKE A PEEK**, line **What arrives at your door**, duration
**0:27** (read it from the file's metadata rather than hard-coding if that's easy; else a constant next to the
file path).

| Size | Circle | Words | Where |
| --- | --- | --- | --- |
| `full` | 96 px (84 px on phones) | caps label 11 px `#666` · serif line 24 px (21 px phone) · duration 13 px `#666`; 20 px gap from the circle | Homepage Fine-art prints; Prints page |
| `strip` | 56 px, no badge | serif 18–19 px line + 14 px `#666` sub-line, ArrowRight at the end; hairlines `#d0d0d0` above and below, 14–16 px padding; full content width | Exhibition and artist pages |
| `inline` | 44 px, no badge | 14 px "Take a peek" + 12 px `#666` "What arrives at your door · 0:27" | Artwork page (and so the room's pop-up), cart |

Strip copy:
- Exhibition page: **"Works in this exhibition are also fine-art prints, approved by {artist name}."** /
  **"Take a peek at what arrives · 0:21"**
- Artist page: **"Works by {artist name} are also fine-art prints, approved by the artist."** / same sub-line.

(Not "Every work…": some works have no print.)

## The modal

Use the existing `Modal` with `tone="public"` and `showClose` (phones need the X). Dark backdrop as drawn
(`rgba(20,20,20,.94)`), white text.

- **Desktop:** the video at its own 16:9 shape, up to 1024 × 576, centred; under it, left: caps **TAKE A PEEK**,
  serif 30 px **What arrives at your door**, then 15 px `#bdbdbd`: **"Sent flat, wrapped in tissue and sealed.
  Archival fine-art paper, approved by the artist."** (owner 2026-11-26: no certificate here; open editions have none); right: the button.
- **Phone (< md):** full screen. X top right, the video full width cropped to **4:5** (`object-fit: cover`,
  centred; both takes are filmed from above with the action in the middle), the same words under it, the button
  full width at the bottom (48 px).
- `<video src=full preload="none" muted playsinline>`: it loads **only when the modal opens**, then plays once
  from the start. No sound control (the file has no audio). Our own square pause/play button bottom-left over the
  video, then a thin 2 px progress line (white on 35 % white). No native controls. At the end: stop on the last
  frame, the play button becomes a "replay" (Phosphor ArrowCounterClockwise); never auto-loop the full video.
- Esc, the X and a backdrop click close it; focus returns to the circle that opened it; the video pauses and
  resets on close.
- **The button depends on where it was opened** (a `cta` prop on the component):
  - homepage, Prints, exhibition, artist pages: outlined white **DISCOVER THE PRINTS** → `/prints`
    (on the Prints page itself: just close; no button);
  - artwork page and the room's pop-up: filled white **ORDER A PRINT OF {TITLE}** → the same target as that
    page's Order a print (open edition → print wizard; limited → its flow). Hidden when purchases are paused
    (`usePurchasesPaused`) or the work has no print;
  - cart: no button (they're already buying).

## Placements

| # | Page | Size | Where exactly | Code (starting point) |
| --- | --- | --- | --- | --- |
| P1 | Homepage | `full` | Fine-art prints, right column: after the lead paragraph, before the caption's hairline | `src/components/landing/HomePrints/HomePrints.tsx` |
| P2 | Artwork page + 3D room's artwork pop-up | `inline` | Right under **Order a print**, only when the work has a print on sale | `src/components/artwork/detail/ArtworkAvailabilityCard.tsx` (used by `ArtworkDetailBody`, which the room's pop-up shares) |
| P3 | Exhibition page | `strip` | Once, just above the first group of works that has at least one print; none if no work has a print | the exhibition page under `src/app/exhibitions/[artistSlug]/…` (not the room's `src/components/exhibitions/view/`) |
| P4 | Artist page | `strip` | Same rule, above the artist's works | `src/app/artists/[slug]` |
| P5 | Prints page | `full` | Under the "Two kinds of prints" text | `src/components/prints/index.tsx` |
| P6 | Cart | `inline` | Under the list of items, only when the cart has at least one print | `src/components/cart/CartPage` |

**Never:** About, Contact, legal pages, the checkout steps, between artworks inside a grid, works without a print,
or twice on one page. No pop-ups, sticky bars, auto-opening or sound.

## Measuring it (promotional mode)

Push to the dataLayer (GTM, AR-190) so the owner can see whether it helps:
`take_a_peek_open` `{ placement: 'home' | 'artwork' | 'room' | 'exhibition' | 'artist' | 'prints' | 'cart' }`,
`take_a_peek_complete` (video reached the end) and `take_a_peek_cta` `{ placement }` (button clicked).
Respect the existing consent handling: only what GTM already does after consent.

## Build order

Follow the public-redesign workflow (`docs/public-redesign/README.md`, "Workflow"): commit per step on your own,
type check + lint + unit tests of what you touched + a look in the browser per step, no E2E per step; one E2E run
at the end. Write a short Built line per step at the bottom of this file. Ask in `questions` below only if a wrong
guess would be costly.

1. **T1:** `TakeAPeek` (three sizes) + the modal + P1 homepage. Phone and desktop.
2. **T2:** P2 artwork page and room pop-up, with the `Order a print of {title}` button.
3. **T3:** P3 exhibition + P4 artist strips.
4. **T4:** P5 Prints page + P6 cart.
5. **T5:** dataLayer events; E2E: one spec that opens the modal from the homepage, checks the full video only
   requests after opening, and closes with Esc.

## Built

(Code Claude: one line per step.)

- **T1** (faaa1b5f): `TakeAPeek` in `src/components/ui/TakeAPeek/` (`size` full / strip / inline; `placement` picks the
  window's button: Discover the prints, none on `prints` and `cart`), `Modal surface="dark"`, Button `outlineInverse`;
  homepage P1. Checked at 1440 and 390: the full video is requested only after opening, Esc and × close, focus back on
  the circle, reduced motion shows the still. Two small departures: the loop is started by the on-screen check instead
  of `autoplay` (so a circle out of view never plays), and the window's button is 48 px (the artwork page's Order a
  print height) instead of 44. On phones the window is solid `#141414`, as drawn, so the page doesn't show through.
- **T2**: P2, `inline` right under Order a print in `ArtworkPurchase` (so the artwork page and the room's pop-up alike;
  not when sold out, since then there is no Order a print). Prop `order={{ title, onOrder }}`: the window's filled white
  ORDER A PRINT OF {TITLE} calls the page's own `usePrintWizard`; gone while purchases are paused. Button `inverse`. No
  bag icon (owner removed it from every Order button on 11-12); the button wraps a long title. Checked on the artwork
  page at 1440 and 390 (lands in the wizard); the room's pop-up not opened here (WebGL): our Escape is stopped at
  `document`, before the room's `window` listener, and the window is portalled to `<body>` above the pop-up. Worth
  one look in the room.
- **T3**: P3 + P4, `strip` inside the first section whose works have a print to order (`hasPrintOnSale`: on sale and not
  sold out), before its heading; none when purchases are paused, as the grids' buttons. Artist page: in Selected works.
  Checked at 1440 and 390 (The Beauty of Permanence; John Doe). To look at: the strip's bottom hairline and the section
  heading's top hairline sit 40 px apart (the board drew the heading without its hairlines).
- **T4**: P5 Prints page, `full` under the Two kinds text after a hairline, no button in its window; P6 cart, `inline`
  under the items, before Back to editions, no button (every cart line is a print, so any non-empty cart shows it).
  Checked at 1440 and 390.
- **T5**: dataLayer events through `track()` (so GA4 Consent Mode as every other event): `take_a_peek_open`,
  `take_a_peek_complete` (each time the video ends) and `take_a_peek_cta`, each with `{ placement }`; checked in dev.
  `e2e/take-a-peek.spec.ts`: from the homepage, the full video is not requested before opening, plays without native
  controls, Escape closes it and focus is back on the circle (passes alone, with `E2E_SKIP_AUTH=1`). Window caption
  without the certificate (owner, 11-26). The full E2E run is still owed before push.
- **T6**: certificate copy. Homepage lead, wizard summary (open edition: "A personal letter from the gallery included."),
  empty cart and the Take a peek caption as the table says. Searched the rest: the limited wizard, the in-production and
  delivered emails and the edition-number notice speak of a certificate only for limited editions (right as they are).
  Admin content left for the owner: see Questions Q1 (the Prints page text) and Q2 (the €6 supplement).
- **T6b**: one time promise. Both wizards' Learn more ("Made to order, it usually ships within 2 weeks, with tracking.",
  the delivery line gone), the checkout's review line (singular / plural) and both order-placed emails ("When it ships"
  / "When they ship" in the cart email, which always says "your prints"). `estimateDeliveryWindow` is kept but has no
  buyer-facing caller now; duty notices untouched. Emails checked in /dev/emails; the checkout line by type check only.
  The Online terms of sale wording is admin content (suggested text in T6b above).
- **Fix** (Part 1): the Take a peek styles layered on Button `bare` (and on its size class) now use two classes, so a
  production stylesheet order can't undo their padding, gaps and alignment (the same trap `CollapsibleSection` notes).
  The window's button moved into `PeekPlayer` for that. No visible change.
- **T7**: `PrintAnswers` (`src/components/artwork/detail/`) right under the Take a peek inline in `ArtworkPurchase`, so the
  artwork page and the room's pop-up, only while there is a print to order. Each row an `<h2>` holding the button
  (`aria-expanded`, `aria-controls`; Button got `id` and `aria-controls`), one open at a time, all closed at first;
  panels stay in the page with `inert` while shut, so the height eases open (not with reduced motion). The country
  count is `TPS_SUPPORTED_COUNTRIES.length` (38). Two departures, see Q3 and Q4. Checked at 1440 and 390. To look at:
  the last row's hairline and the print details' divider below it sit about 20 px apart.
- **T8**: Share redesigned and on (`SHOW_SHARE` gone): one row, SHARE · WhatsApp · Email, the messages as written, the
  link `SITE_URL` + path (new `src/lib/siteUrl.ts`; the artwork and Object pages built it from `window`, which would
  differ between server and browser), `share_click { method, type }` through `track()`. Artwork page and room pop-up
  (and Object pages, same info column): at its foot, where it was; exhibition: under Enter 3D room; artist: under the
  name (Q6). Checked at 1440 and 390, no console errors; Open Graph title and image are on all three pages, but the
  link-preview debugger needs a public URL: owed on the preview deploy.

**Media update (2026-11-26):** `public/videos/take-a-peek/*` replaced with the recut at normal speed (27.1 s). Set
`PEEK_DURATION_S = 27` in `src/components/ui/TakeAPeek/media.ts` and any "21" in labels; the files keep their names.

## Questions

- **Q1 (T6, owner, admin content; answered 2026-11-26, owner to edit in the admin):** the Prints page's text (Admin › Content › Prints), "Open editions." paragraph,
  ends "Each comes with a certificate of authenticity." (seen in the dev database; prod likely the same). Code can't
  change it: please edit it there, e.g. "Each comes with a personal letter from the gallery." The Online terms of sale
  say "where applicable, accompanied by a certificate of authenticity", which is already right.
- **Q2 (T6, owner, pricing; waiting for the owner's decision, options in the design side's note: €3 / €0 / €6 for open editions):** `TPS_COA_LETTER_SUPPLEMENT_CENTS` (€6, `src/lib/print-providers/printspace/
  pricing.ts`) is added to every print for "a premium COA design and the gallery letter". If open editions get no
  certificate, is the €6 still right for them (the letter alone may cost less)?
- **Q3 (T7, copy): resolved 2026-11-26.** The Shipping answer now reads "The shipping cost for your address is shown at
  checkout, before you pay. Delivery then usually takes a few days, depending on where you are." (then the duties
  line), as the spec above. The checkout keeps no delivery estimate.
- **Q4 (T7, copy):** "The frame and passepartout, if you chose them." shows for open editions only: limited editions
  are sold unframed (the limited wizard says so), so nothing can be chosen.
- **Q5 (T8, copy):** an exhibition whose 3D room isn't open yet would be shared as "…an exhibition by {artist} you can
  also walk through in 3D". It says "{Exhibition}, an exhibition by {Artist} at The Art Room" instead until the room
  is open.
- **Q6 (T8, placement):** the artist page's hero has no "N exhibitions · N works" line any more (counts removed
  2026-11-12), so Share sits under the artist's name.

---

# Part 2 · Buy with confidence (owner, 2026-11-26)

Same branch. Two more things on the pages where a print can be bought, so a buyer has every answer before ordering:
**folded answers** under Order a print, and **Share** (WhatsApp, Email). Plus a copy fix about certificates that is
**wrong on the live site today**. Designs: `designs/ArtworkReassurance.dc.html` (click a row) and `designs/Share.dc.html`.

## Facts the owner confirmed (2026-11-26) — the copy must match these

- **Certificate of authenticity: limited editions only.** Open editions get **no certificate**; they come with a
  **personal letter from the gallery**. (Owner: "AFAIK theprintspace allows a COA only for limited editions.")
- **Timing, said broadly so it never disappoints:** prints **usually ship within 2 weeks** of the order. No day ranges
  in this copy. (The checkout's per-country delivery estimate stays as it is.)
- **Shipped from the UK, Germany or the US**, with tracking, to the 38 countries in `TPS_SUPPORTED_COUNTRIES`.
- Returns, damage and cancellation exactly as the Online terms of sale (section 10, 11, 14).

## T6 · Certificate copy (fix first: it's live)

Every visitor-facing line that promises a certificate on **every** print, fix it so only limited editions get one:

| Where | Today | Make it |
| --- | --- | --- |
| `src/components/landing/HomePrints/HomePrints.tsx` (lead) | "…approved by the artist before it reaches your wall, and arrives with a certificate of authenticity. A limited edition is also numbered on the print, and its certificate carries the artist's printed signature." | "Each one is produced on archival fine-art paper by the labs museums rely on and approved by the artist before it reaches your wall. A limited edition is also numbered on the print and comes with a certificate of authenticity carrying the artist's printed signature." |
| `src/components/ui/TakeAPeek/PeekPlayer.tsx` (window caption) | "…approved by the artist, with a certificate of authenticity." | "Sent flat, wrapped in tissue and sealed. Archival fine-art paper, approved by the artist." |
| `src/components/PrintWizard/SummaryPanel.tsx` (open edition branch) | "Certificate of authenticity included." | "A personal letter from the gallery included." |
| `src/components/cart/EmptyCart/EmptyCart.tsx` | "Every print is made to order on archival fine-art paper and arrives with a Certificate of Authenticity." | "Every print is made to order on archival fine-art paper and approved by the artist." |

Search the rest of the public site and the buyer emails (`src/lib/emails/`) for "certificate" and make sure an
**open** edition is never promised one (the limited-edition lines are right). Ask in Questions if one is unclear.

**For the owner, not to change now:** `TPS_COA_LETTER_SUPPLEMENT_CENTS` in `src/lib/print-providers/printspace/pricing.ts`
says "Every print ships with a premium COA design and the gallery letter (decided 2026-07-24)" and adds €6 to every
print. If open editions get no COA, that supplement may be wrong for them. Add it to Questions; don't touch pricing.

## T6b · One promise about time, everywhere (owner: "let's be consistent")

The site gives five different time promises today (wizard "about two weeks" / limited wizard "about a week" /
"Delivery is typically 1–2 weeks" / checkout and order emails "{min}–{max} business days" from `estimateDeliveryWindow`,
EU 6–10 days end to end / terms "1–2 + 5–10 business days"). Replace them all with **one**, said broadly:

> **Made to order, it usually ships within 2 weeks. You get an email with tracking as soon as it ships.**

| Where | Today | Make it |
| --- | --- | --- |
| `src/components/PrintWizard/index.tsx` (~452–464, open) | "Most orders are dispatched within about two weeks; framed pieces can take a little longer." + "Delivery is typically 1–2 weeks." | "Made to order, it usually ships within 2 weeks, with tracking." (drop the delivery line) |
| `src/components/PrintWizard/LimitedWizard.tsx` (~360–362) | "Most editions are dispatched within about a week of purchase." + "Delivery is typically 1–2 weeks." | same line as above |
| `src/components/checkout/CartCheckout/CartCheckout.tsx` (~383) | "Your print is made to order and delivered in {min}–{max} business days." | "Your print is made to order and usually ships within 2 weeks, with tracking." (plural: "Your prints are… ship…") |
| `src/lib/emails/orderPlaced.ts` (~105), `cartOrderPlaced.ts` (~120) | "Expected delivery: {min}–{max} business days from today. Framed prints can occasionally take a few days longer…" | "**When it ships:** usually within 2 weeks. We'll email you tracking as soon as it does." |
| T7 folded answers | — | already says this |

`estimateDeliveryWindow` then has no buyer-facing caller: leave the function (admin may use it) but don't show its
numbers to buyers. Keep `mayOweImportDuty` and the duty notices as they are.

**For the owner (content in the admin, not code):** the **Online terms of sale**, section "Production and delivery
times", says "Order review: within 1–2 business days … Production: approximately 5–10 business days". Suggested
replacement, to edit in Admin › Content: *"Every print is made to order. It usually ships within 2 weeks of your order;
framed pieces can take a little longer. Delivery then depends on your destination. These are estimates, not guarantees."*

## T7 · Folded answers under Order a print

`designs/ArtworkReassurance.dc.html`. In the artwork page's info column (`ArtworkInfoColumn` / `ArtworkPurchase`, so the
room's pop-up gets it too), **after Order a print and the Take a peek inline**, only when the work has a print on sale.
Four rows, one open at a time, **all closed by default**:

- Row: full-width `<button aria-expanded aria-controls>` inside an `<h2>` (or the right heading level), 48 px min,
  label Lato 12 px caps `letter-spacing .12em` `#1a1a1a`, Phosphor Plus / Minus 16 px on the right; hairline `#e4e4e4`
  above the first and under each row. Panel: 14 px, line-height 1.65, `#444`, 18 px bottom padding. Square, no motion
  beyond a short height transition (none with reduced motion).
- Copy (final; `{…}` are the work's own values):

**WHAT'S IN THE BOX**
- Your print on archival fine-art paper. Unframed prints travel flat between card, wrapped in tissue and sealed.
- *limited edition only:* A certificate of authenticity with the same number as the print and the artist's printed signature.
- *open edition only:* A personal letter from the gallery.
- The frame and passepartout, if you chose them.

(Show only the line for this work's edition type. If a work offers both, show both, each with its "Limited editions:" /
"Open editions:" prefix as on the board.)

**PRODUCTION TIME**
- Every print is made to order, just for you, by our fine-art print partner. It usually ships within 2 weeks of your order.
- You get an email with tracking as soon as it ships.

**SHIPPING**
- Shipped with tracking from the UK, Germany or the US, to 38 countries: the EU, the UK, Switzerland, Norway, Iceland,
  Liechtenstein, the US, Canada, Australia, New Zealand, Japan and South Korea.
- The shipping cost for your address is shown at checkout, before you pay. Delivery then usually takes a few days, depending on where you are. Outside the EU,
  the UK and the US, import duties may apply on delivery (matches `mayOweImportDuty`).

(Build the country sentence from `TPS_SUPPORTED_COUNTRIES` count if easy; else keep it as written and add a comment.)

**RETURNS**
- If your print arrives damaged, faulty or not what you ordered, write to us within 7 days of delivery with a few
  photos, and we'll replace it or refund you.
- Because each print is made for you, we can't take it back for a change of mind. You can cancel free of charge until
  production starts.
- → Online terms of sale (`ArrowLink` to `/terms-of-sale`)

## T8 · Share (switch it back on, redesigned)

`src/components/ui/Share/Share.tsx` exists (Email + WhatsApp) and was switched off on 2026-08-27 (`SHOW_SHARE = false`)
because it was not well designed. Redesign it to `designs/Share.dc.html` and turn it back on:

- **One row, always open (no toggle):** caps label **SHARE** (Lato 12 px, `.16em`, `#666`), then two text links with
  icons, 22 px apart: **WhatsApp** (today's WhatsApp glyph, 16 px) and **Email** (Phosphor Envelope, light, 17 px);
  Lato 14 px `#333`, `.03em`, hover `#000`, **no underline**, 44 px tall hit area. Square, no pills or circles.
- WhatsApp: `https://wa.me/?text=` + encoded message, `target="_blank" rel="noopener noreferrer"`. Email: `mailto:?subject=…&body=…`.
- The link is the page's **canonical URL** (no `?from=`, no tracking parameters).
- Messages:
  - Artwork — WhatsApp: "{Title} by {Artist}, at The Art Room: {url}". Email subject "{Title} by {Artist} · The Art Room",
    body "I thought you'd like this: {Title} by {Artist}, at The Art Room.\n\n{url}".
  - Exhibition — "{Exhibition}, an exhibition by {Artist} you can also walk through in 3D: {url}"; subject
    "{Exhibition} · The Art Room".
  - Artist — "{Artist} at The Art Room: {url}"; subject "{Artist} · The Art Room".
- **Where (once per page):** artwork page and room pop-up, at the foot of the info column, 20 px under the folded answers;
  exhibition page, in the hero under Enter 3D room; **artist page** (new call site), in the hero under
  "N exhibitions · N works". Never on the homepage, lists, cart, checkout or legal pages.
- Remove `SHOW_SHARE` once it's back on everywhere. The pages already have Open Graph images, so WhatsApp shows a preview:
  check one artwork, one exhibition and one artist URL in a link-preview debugger and note it in Built.
- dataLayer: `share_click` `{ method: 'whatsapp' | 'email', type: 'artwork' | 'exhibition' | 'artist' }`.

## Build order (Part 2)

T6 → T6b → T7 → T8, same workflow as Part 1. Add a Built line for each under **Built** above.

---

# Part 3 · "Propose your exhibition" button on announcements (owner, 2026-11-26)

Design: `designs/Announcement.dc.html`. The homepage announcement ("Submissions Are Open") gets a button under its text
that opens the visitor's email app with a ready-made proposal. Announcements are admin content
(`Announcement` model, `src/components/landing/Announcement/Announcement.tsx`, "No button" today), so:

## T9 · Optional button on an announcement

- **Schema (needs the owner's OK before migrating, per the workflow; the owner asked for this feature on 2026-11-26):**
  two optional columns on `Announcement`: `buttonLabel String?` and `buttonUrl String?`. No button when either is empty.
- **Admin › Content › Announcements › edit:** two fields under the text, "Button label" and "Button link", with a help
  line: *"Optional. A web address, or mailto: to open the visitor's email app."* Accept `https://`, a site path (`/prints`)
  or `mailto:`; reject anything else.
- **Homepage:** under the announcement's text, 8 px extra top space: black filled button, square, 48 px tall,
  24 px side padding, Lato 12 px caps `.12em`, white; Phosphor Envelope (light, 17 px) before the label **only when the
  link is a `mailto:`**. Hover `#000`. Use the existing `Button` (`primary`, squared) if it matches; else the
  `OrderPrintButton` look in black. Full width on phones.
- `mailto:` opens in the same tab (no `target`); web links as today's links.
- dataLayer: `announcement_cta` `{ label }`.

**What the owner will type in the admin (for reference, not code):**
- Button label: **Propose your exhibition**
- Button link (one line; the app shows it decoded):
  `mailto:contact@theartroom.gallery?subject=Exhibition%20proposal&body=Hello%2C%0A%0AMy%20name%20is%20...%20and%20I%27d%20like%20to%20propose%20an%20exhibition%20at%20The%20Art%20Room.%0A%0AA%20few%20words%20about%20me%3A%0A%0AMy%20portfolio%20or%20a%20selection%20of%20images%3A%0A%0AThe%20body%20of%20work%20I%27d%20like%20to%20show%3A%0A%0AThank%20you%2C%0A`

Keep the email address written in the text too: some visitors have no email app set up and will copy it.

## Media reminder (owner, 2026-11-26)

**Use the normal-pace video** now in `public/videos/take-a-peek/` (27.1 s; the earlier 21 s cut was sped up and is gone
from the repo). Commit the replaced files and set `PEEK_DURATION_S = 27`.
