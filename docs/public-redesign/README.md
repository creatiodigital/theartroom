# Public site redesign

**Next update after the admin redesign (`docs/admin-redesign/`) is finished.** Work on its own branch.
Same workflow as the admin: Design Claude designs on the canvas and writes the spec here; Code Claude
builds one page per commit, plans first, and stops before each commit for the owner's browser check.

| # | Page | Spec | Designs | Status |
|---|---|---|---|---|
| 1 | Home page | `home.md` | `designs/home-desktop.dc.html`, `designs/home-phone.dc.html` | Designed · approved by owner |
| 1b | Admin · Content › **Home page prints** (sibling of Gallery selection, same exact logic) | `home.md` §5 | `designs/home-prints-admin.dc.html` | Designed · approved by owner |
| 1c | Visitor feedback: "We'd love to hear from you" band, the feedback window (one text box, no names or questions), thank-you state, Feedback in the 3D room menu | — (see designs) | `designs/feedback-band-and-window.dc.html`, `designs/feedback-phone.dc.html`, `designs/feedback-in-room.dc.html` | Designed · approved by owner (needs a server endpoint to store messages; the admin Feedback page is parked) |
| 1d | Artists page | `artists.md` | `designs/artists-desktop.dc.html`, `designs/artists-phone.dc.html` | Designed · approved by owner |
| 1e | Exhibitions page | `exhibitions.md` | `designs/exhibitions-desktop.dc.html`, `designs/exhibitions-phone.dc.html` | Designed · approved by owner |
| 2 | Exhibition page (the 3D room's main entrance) | `exhibition.md` | `designs/exhibition-desktop.dc.html`, `designs/exhibition-phone.dc.html` | Designed · approved by owner |
| 2b | Artist page | `artist.md` | `designs/artist-desktop.dc.html`, `designs/artist-phone.dc.html` | Designed · approved by owner |
| 2c | Prints page | `prints.md` | `designs/prints-desktop.dc.html`, `designs/prints-phone.dc.html` | Designed · approved by owner |
| 2d | Content pages (Terms, Terms of sale, Privacy, Accessibility…): one rich-text template | `legal.md` | `designs/legal-desktop.dc.html`, `designs/legal-phone.dc.html` | Designed · approved by owner |
| 2e | Artwork page (agnostic of exhibitions; portrait works too) | `artwork.md` | `designs/artwork-*.dc.html` | Designed · approved by owner |
| 2f | About and Contact | `about-contact.md` | `designs/about-*.dc.html`, `designs/contact-*.dc.html` | Designed · owner happy, confirm before build |
| 2g | Order a print, Learn more, cart, checkout (3 steps), order confirmed, unboxing request | `order-flow.md` | `designs/order-*.dc.html`, `designs/cart.dc.html`, `designs/checkout-*.dc.html` | Designed · owner happy, confirm before build |
| 3 | "About this exhibition" in the room's menu | — | — | Proposed, to design |

Principle for every page: **an art portal first, never a poster shop**; the 3D room is a quiet plus.

Text rule for every page: **no underlines** — not on names, links, the footer email or anything else. Links are
recognised by the Phosphor ArrowRight in front of them (or by being a button).

**Order print (one component, everywhere).** Every artwork that can be printed shows the same button under it,
wherever the work appears on the public site: exhibition page, artist page, Prints page, and any future list of
works. Outlined, 38 px high, 1 px `#1a1a1a` border, white background, Lato 12 px uppercase, letter-spacing .12em,
`#1a1a1a`, with the header's cart icon (Phosphor ShoppingBagOpen, light, 16 px) before the words **ORDER PRINT**,
14 px side padding, square corners. On desktop it sits on the right of the caption (title, year), vertically
centered; on phone it sits under the caption, full width. Same link as today's Order Print. Works without a print
show no button and no placeholder. Build it once as a shared component and reuse it.

**Footer network icons.** Keep the brand icons the site uses today (the filled Instagram, Facebook and Pinterest
logos in the footer, 24-unit viewBox, `currentColor`), not Phosphor versions. Email keeps today's thin envelope
outline. Plain icons, no circles, no labels.

**Design canvas (source of truth for the drawings).** All boards, admin and public, live on the shared canvas
https://claude.ai/code/artifact/6d16f4cf-4c5c-4839-9cbd-65e8360d4772 (images are stored there). The `.dc.html` files
in `designs/` are copies; their images only load inside the canvas. A full copy of every board is in
`docs/design-canvas/`.
