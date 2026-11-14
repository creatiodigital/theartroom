# Public site redesign

**Same branch as the admin redesign** (`feat/AR-180-ui-admin-improvements`), released together with it. The steps
continue the admin numbering (22 onward) and start once the admin steps are done. Build order, status and
dependencies: **`pages.md`**. Shared pieces to build first: **`components.md`**. Open points: **`questions.md`**.

**Workflow, owner's instructions 2026-11-12 (speed first, this goes to production ASAP; applies from now on,
remaining admin work included):**

- **Commit on your own.** Plan, build, check, commit, move to the next step. Do **not** stop to ask "commit?".
- **Stop and ask only when it really matters:** a question the specs and designs don't answer and a wrong guess would
  be costly; a database migration (the `HomePrint` and `Feedback` tables); anything in the order / payment flow that
  changes behaviour; deleting data or files beyond the agreed cleanup rule. Everything else: pick the most
  conservative option, note it in `questions.md`, keep going. Batch non-blocking questions; don't wait for answers.
- **No E2E after each commit.** Per step run only what is fast: type check, lint, the unit tests of what you touched,
  and a quick look in the browser. **One full E2E run at the very end** (plus the order-flow checks on staging), and
  fix what it finds then.
- After each commit, add one short line to the Built notes in `pages.md` (what changed, anything to look at). The
  owner reviews in batches when he can.

**Ask instead of guessing.** The
`designs/*.dc.html` files are the visual spec: read their source, don't copy their markup or script.

| # | Page | Spec | Designs | Status |
|---|---|---|---|---|
| 1 | Home page | `home.md` | `designs/home-desktop.dc.html`, `designs/home-phone.dc.html` | Designed · approved by owner |
| 1b | Admin · Content › **Home page prints** (sibling of Gallery selection, same exact logic) | `home.md` §5 | `designs/home-prints-admin.dc.html` | Designed · approved by owner |
| 1c | Visitor feedback: "We'd love to hear from you" band, the feedback window (one text box, no names or questions), thank-you state, Feedback in the 3D room menu | `feedback.md` | `designs/feedback-band-and-window.dc.html`, `designs/feedback-phone.dc.html`, `designs/feedback-in-room.dc.html` | Designed · approved by owner (stored + emailed to the owner, silent bot protection; the admin Feedback page is parked) |
| 1d | Artists page | `artists.md` | `designs/artists-desktop.dc.html`, `designs/artists-phone.dc.html` | Designed · approved by owner |
| 1e | Exhibitions page | `exhibitions.md` | `designs/exhibitions-desktop.dc.html`, `designs/exhibitions-phone.dc.html` | Designed · approved by owner |
| 2 | Exhibition page (the 3D room's main entrance) | `exhibition.md` | `designs/exhibition-desktop.dc.html`, `designs/exhibition-phone.dc.html` | Designed · approved by owner |
| 2b | Artist page | `artist.md` | `designs/artist-desktop.dc.html`, `designs/artist-phone.dc.html` | Designed · approved by owner |
| 2c | Prints page | `prints.md` | `designs/prints-desktop.dc.html`, `designs/prints-phone.dc.html` | Designed · approved by owner |
| 2d | Content pages (Terms, Terms of sale, Privacy, Accessibility…): one rich-text template | `legal.md` | `designs/legal-desktop.dc.html`, `designs/legal-phone.dc.html` | Designed · approved by owner |
| 2e | Artwork page (agnostic of exhibitions; portrait works too) | `artwork.md` | `designs/artwork-*.dc.html` | Designed · approved by owner |
| 2f | About and Contact | `about-contact.md` | `designs/about-*.dc.html`, `designs/contact-*.dc.html` | Designed · approved by owner |
| 2g | Order a print, Learn more, cart, checkout (3 steps), order confirmed, unboxing request | `order-flow.md` | `designs/order-*.dc.html`, `designs/cart.dc.html`, `designs/checkout-*.dc.html` | Designed · approved by owner |
| 3 | "About this exhibition" and "Send feedback" in the room's menu | `room-about.md` | `designs/room-about-exhibition.dc.html` | Designed · requested by owner |
| 3b | 3D room loader, type only | `room-loader.md` | `designs/room-loader.dc.html` (Option A2) | Designed, approved |
| 4 | The remaining public screens (print path, room details, Inquire, cart states, 404, errors, password, cookie banner, loading) | `other-screens.md` | built from existing patterns; `designs/remaining-screens.dc.html` for 404, error, password, cookie banner, loading | Designed, approved |

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

### Square corners for visitors (owner, 2026-11-14)

On the **public site and in the 3D room** (everything a visitor sees), **modals/windows and buttons have no rounded
corners** (`border-radius: 0`). That covers dialogs and sheets (Where we ship, Learn more, Added to cart, feedback,
the room's welcome window, About this exhibition panel), every button (black, outlined, the room menu button, the
cookie banner buttons, the language switch) and small key-like chips. **The admin and the artist studio are not
affected**: keep their radii. Boards drawn before this rule may still show rounded corners: the rule wins.

### The logo: always the real SVG (owner, 2026-11-12)

Every "THE ART ROOM" on the public site is the **real logo file `src/icons/logo.svg`** (the same paths as
`Wordmark` in `src/components/brand/BrandMarks.tsx`), red `#bd1622`, with `aria-label="The Art Room"` on its link.
Never type it as text in EB Garamond or any font, even where a board shows it as text: the boards only stand in for it.
That covers the **header** (desktop and the phone menu), the **footer** top row, the order-flow and checkout top bars,
the password screens, the 404 and error pages, and any new screen. Today's header, footer, phone menu, print wizard and
checkout already import `logo.svg`: keep them that way when restyling. (The studio and admin shells keep `ShellWordmark`.)
