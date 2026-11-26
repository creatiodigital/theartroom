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
| `print-arrives-full.mp4` | The full video. 21.2 s, 1024 × 576, H.264, **no audio track**, 3 MB, faststart. Opened in the modal only. |
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
  `aria-label="Take a peek: watch what arrives at your door, 21 seconds"`; the video is `aria-hidden`.

**Copy (final, owner 2026-11-26):** label **TAKE A PEEK**, line **What arrives at your door**, duration
**0:21** (read it from the file's metadata rather than hard-coding if that's easy; else a constant next to the
file path).

| Size | Circle | Words | Where |
| --- | --- | --- | --- |
| `full` | 96 px (84 px on phones) | caps label 11 px `#666` · serif line 24 px (21 px phone) · duration 13 px `#666`; 20 px gap from the circle | Homepage Fine-art prints; Prints page |
| `strip` | 56 px, no badge | serif 18–19 px line + 14 px `#666` sub-line, ArrowRight at the end; hairlines `#d0d0d0` above and below, 14–16 px padding; full content width | Exhibition and artist pages |
| `inline` | 44 px, no badge | 14 px "Take a peek" + 12 px `#666` "What arrives at your door · 0:21" | Artwork page (and so the room's pop-up), cart |

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
  Archival fine-art paper, approved by the artist, with a certificate of authenticity."**; right: the button.
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

## Questions

(none yet)
