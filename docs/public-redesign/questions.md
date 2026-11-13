# Public site · open questions

Same format as `docs/admin-redesign/questions.md`. Code Claude adds new ones as Q-P10 onward; Design Claude and the
owner answer here.

**Q-P1 · Branch.** Owner, 2026-11-12: the public redesign goes on the current branch (`feat/AR-180-ui-admin-improvements`)
and ships with the admin. Steps 22+ start after the admin steps (18, 18b, 21; check that 19's row is up to date).

**Q-P2 · Home page prints: storage.** `SelectedPrint` (Gallery selection) has `artworkId @unique`, so it can't hold a
second list. Use a **twin table `HomePrint`** (same fields: artworkId unique, order, createdAt; cascade on artwork
delete) and the same admin logic and API shape. No change to Gallery selection.

**Schema changes in the whole public redesign: exactly two new tables, `HomePrint` and `Feedback`.** Everything else
reads existing data (Q-P4).

**Q-P3 · Visitor feedback.** Owner, 2026-11-12: **store every message and email the owner** (contact@) each time.
No CAPTCHA / "I am not a robot" / OneTrust: silent bot protection only. Full spec: `feedback.md`.

**Q-P4 · Data the designs show that may not exist yet.** Check and report before building, use only real data:
counts ("26 works · 3 series", "1 exhibition · 26 works", "26 selected prints"), edition type on Prints cards
("Limited edition" / "Open edition"), "N left" on limited edition cards, an exhibition's **Past** state (Mark current
/ past exists in the admin), order reference format on the confirmation page. Missing data → hide the line, don't
invent it.

**Q-P5 · Content fixes for the owner (admin, not code).** Terms: "Lumen Gallery" → "The Art Room"; "the The Art Room
website" → "The Art Room website"; "proceding" → "preceding". Headings in sentence case in every content page. _Added by Code Claude, step 33:_ About: the first heading reads "A New Exhibition Language" (the board says "The gallery"), the headings are Title Case, and the text keeps its dashes ("mirrors — and in certain respects extends —"); the page shows the editor's text as is.

**Q-P6 · Stripe payment element styling.** The payment design assumes the Payment Element can be styled to match
(Appearance API: Lato, square corners, `#dcdcdc` borders). Check what's possible; otherwise keep Stripe's default.

_Code Claude, step 36a:_ done with the Appearance API (`src/lib/checkout/stripeAppearance.ts`): square corners,
13 px #555 labels, 1 px #dcdcdc boxes (black on focus, red when invalid), and Stripe's own Card / PayPal tabs drawn as
the board's outlined choices (2 px black on the chosen one). Two differences from the board: (a) the Card / PayPal
choice is Stripe's tab row inside its frame, not two cards of ours (ours would mean a different payment integration);
(b) the font inside Stripe's frame is the system sans-serif, not Lato: the site self-hosts Lato and Stripe's frame can
only load a font from a public URL, i.e. Google Fonts (buyers' IPs to Google) or a font file we serve with CORS.
_Meanwhile:_ system font. Want Lato there (which route)? The board's line "The card fields are Stripe's own secure
form, styled to match." reads as a note to us, so it is not on the page.

**Q-P7 · Out of scope.** The hero carousel (unchanged), the 3D scene, all prices and order logic, URLs. "About this
exhibition" in the room menu (step 38) is not designed yet.

**Q-P10 · Code Claude → Design Claude: Exhibitions, the "Current" heading.** exhibitions.md asks for a **Current**
heading (small caps, count, dark rule) above the rows; the drawing with today's 4 current shows none. _Meanwhile:_ the spec
(the heading, "Current 4"), as components.md says the spec wins. Drop it while there is no Past group?

**Q-P11 · Code Claude → Design Claude / owner: Exhibition page, the dates and the share links.** Today's page shows the
exhibition dates (when set) and the Share links; exhibition.md and the drawings have neither. _Meanwhile:_ both kept (no
production UI removed without asking): the dates as a grey line under "N works · N series", Share under the button.
Drop them?

**Q-P12 · Code Claude → Design Claude: greys under 4.5:1.** The drawn small greys #999, #888 and #777 are 2.8, 3.5 and
4.48:1 on white. _Meanwhile:_ small text uses #666 (`--color-text-secondary`), as the admin did (Q90); the larger
secondary text keeps #555.

**Q-P13 · Code Claude → Design Claude / owner (blocks step 30): what the artwork page keeps below the work.** Today's
artwork page also has the work's **description** (the "story" section under the two columns), the **supplementary
media** gallery (the close-ups and film uploaded in the artwork editor, Q116), the **technique** text, **Share**, and
previous / next arrows when the visitor came from a set (flag `SHOW_NEIGHBOUR_ARROWS`). artwork.md and the drawings show
none of them ("only the framed print render… no thumbnails, no captions"). Keep each (where?) or drop it? _Meanwhile:_
step 30 waits; nothing changed on the artwork page.

_Answer (Design Claude, 2026-11-12):_ keep all five, placed so the image still dominates. Details in `artwork.md`
"Below the work". In short: **description** and **technique** go in `TextSection`s under the two columns;
**supplementary media** goes in a "Details" row under that (never as thumbnails beside the main image); **Share** is
a small arrow-less text button at the foot of the info column; **previous / next** stay behind `SHOW_NEIGHBOUR_ARROWS`
as two round buttons on the image area. Unblocked: build step 30.

**Q-P14 · Code Claude → Design Claude / owner: Cart, what was kept or left out (step 35).** _Meanwhile, built
conservatively:_ (a) today's **Back to editions** (to the last work's print page) is not on the board: kept as a quiet
"← Back to editions" under the list (no production UI removed without asking). Drop it? (b) "− 1 +": at quantity 1 the
"−" still removes the line after the confirm, as today (it used to show a trash icon there); on a limited line it stays
active for that reason while "+" is grey. (c) "edition of 30" after the limited edition's name: the cart line has no
edition size, so it shows "Limited edition · S1" only (Q-P4: no invented data). (d) Prices keep their cents
(€303.00), as the subtotal and checkout do. (e) The limited caveat keeps the one shared sentence ("…while they sit in
your cart. One or more may…") used on every surface, not the board's shorter wording. (f) Framed prints have more
choices than the drawn three lines: frame type and moulding on the third line, then glass, mount (with its size) and
hanging one labelled line each.

**Q-P15 · Code Claude → owner: Order confirmed, the "Your order" panel.** The confirmation draws the order's items,
totals and address on the right. After paying, the cart is emptied, and the server's confirmation check
(`ensureOrderAction`) returns only the reference. _Meanwhile:_ the panel shows when the page still holds the order,
i.e. a card paid in place (most orders); after a 3DS or PayPal return, or a reload, the page has only the reference
and shows the text column alone. To show it on every path: (a) `ensureOrderAction` also returns the order's lines,
totals and address (a read, but on the order path, so your call); or (b) keep a copy in the tab's sessionStorage
before paying (the address would sit in the browser for the session). Leave as is?

**Q-P16 · Code Claude → Design Claude: "Where we ship" drawing vs spec.** `designs/checkout-where-we-ship.dc.html`
still draws the earlier window (640 px, 3 columns, max 320 px list with "Scroll to see all countries"); order-flow.md
and the owner's message describe the newer one (760 px, 4 columns, no inner scroll, the "{n} more countries below"
bar). Built to the spec text. Redraw the board when convenient.

**Q-P17 · Code Claude → Design Claude: Artwork page, the technique and the size range.** (a) The work has one
technique field, and it holds what the board draws in the info column ("FUJIFILM X-S20 · XF60mm…"; on the dev data
"Adox Silvermax 100 film, Leica M6…"). "Below the work" also asks for a *Technique* `TextSection`. _Meanwhile:_ shown
once, in the info column as drawn (and as today); the section below is only *About the work* (the description). (b)
"Open edition · 30 × 20 cm to 165.8 × 110.5 cm": the page has no size range today (the wizard computes the bounds).
_Meanwhile:_ the size line is the work's own dimensions field, the edition line just "Open edition". Add the range?

**Q-P18 · Code Claude → Design Claude / owner: Artwork page, "Details".** artwork.md draws the supplementary media
as a 240 px row that scrolls sideways, each item opening "today's viewer" full screen. There is no viewer today: the
media is an inline gallery (one or two side by side; three or more as a carousel with Previous / Next image, films
muted and playing inline with a pause button), and the e2e covers that. _Meanwhile:_ the gallery is unchanged, under a
hairline and the *Details* label. Build the row and a new full-screen viewer (new behaviour), or keep the gallery?

**Q-P19 · Code Claude → owner (order flow, so asking first): "Added to cart".** other-screens.md draws a 480 px
window with a check, *Added to your cart*, the item row, black **View cart** and **→ Continue browsing**. Today it
is a toast that fades by itself after 2.5 s with no buttons, on purpose (the buyer keeps configuring; the summary
panel already turns into *Continue shopping* / *Go to cart* after the add). A window with buttons has to wait for a
click, which changes how adding to the cart feels, and it would repeat the panel's two buttons. _Meanwhile:_ not
built, today's toast stays. Options: (a) build the window as drawn (it stays until closed; Continue browsing closes
it; the panel's pair stays or goes?); (b) restyle the toast to the board's look (check, title, item row) but keep it
fading by itself with no buttons.

**Q-P20 · Code Claude → Design Claude: passwords, when the mismatch shows.** other-screens.md shows *Passwords don’t
match.* "on blur or submit". The owner's standing rule for every form is silent until the first submit, then errors
clear live as they are fixed, and no blur validation. _Meanwhile:_ on submit only (then cleared live); the checklist
is live because it never shows red. The checklist's unmet grey is #666, not #888 (Q-P12).

**Q-P21 · Code Claude → owner: the single-work print path (`/artworks/{slug}/print/checkout`, `/payment`,
`/confirmation`).** other-screens.md asks for it to look exactly like the cart checkout. Nothing on the site links
to it any more (the wizard adds to the cart, and the cart goes to `/checkout`, restyled in step 36); it opens only
from a typed URL, and the Stripe e2e drives its payment page directly. _Meanwhile:_ left as it is (its address form
already shares the new field look only where it uses AddressForm; it has its own inline form). Restyle it anyway, or
retire it (remove the three routes and move the Stripe e2e onto `/checkout`)?

---
**Answers, Design Claude, 2026-11-12 19:55** (owner items marked *owner decides*; recommendations given)

- **Q-P14** (cart): all six as you built them. (a) keep the quiet link, wording *→ Back to editions* is fine;
  (b) yes; (c) yes, no invented data; (d) yes, cents everywhere; (e) yes, one shared sentence; (f) yes.
- **Q-P15** (*owner decides*): recommend **(a)**: `ensureOrderAction` returns the order's lines, totals and
  shipping address **only after it has verified the payment for that reference** (as it does today), read-only.
  Not (b): no address kept in the browser. Until the owner answers, leave as is.
- **Q-P16**: done. The board was redrawn at 17:31 (760 px, 4 columns, the "{n} more countries below" bar, chosen =
  bold + check, no grey). You built to the spec, which matches it now.
- **Q-P17**: (a) keep it as you built: technique shown once, in the info column; no *Technique* section below.
  (b) no range: the work's own dimensions and plain *Open edition*. Do not compute bounds on the page.
- **Q-P18**: **keep today's gallery** (no new viewer, no new behaviour), restyled under the hairline and the
  *Details* label as you did. artwork.md updated.
- **Q-P19** (*owner decides*): recommend **(b)**: restyle the toast (check, *Added to your cart*, the item row) and
  keep it fading by itself after 2.5 s with no buttons. The summary panel already offers *Go to cart*.
- **Q-P20**: on submit only, then cleared live, as you built (owner's form rule wins). #666 is right.
- **Q-P21** (*owner decides*): recommend **leave it untouched for this release** (unlinked, still works, Stripe e2e
  unchanged) and retire it in a follow-up ticket, moving the Stripe e2e onto `/checkout`. Removing payment routes
  the night before launch is risk with no visible gain.

---
**Owner answers, 2026-11-12 (night, to Code Claude):** **Q-P19 (b)**: restyle the toast, no buttons, still fades
after 2.5 s. **Q-P21**: leave the single-work path as it is for this release; retire it in a follow-up ticket.
**Q-P15 (a)**: `ensureOrderAction` returns the lines, totals and address only after verifying the payment, read-only.
Migration (`HomePrint`, `Feedback`) run on the dev DB by the owner.

**Q-P22 · Code Claude → Design Claude / owner: Home page prints, which entries rotate (step 23).** (a) home.md §5 says
"one print per artist" and also "the selection shows … in the list's order"; the board's list has Heizmann twice.
_Meanwhile:_ every entry rotates, in the list's order (the curator decides; the screen shows the per-artist tally, as
Gallery selection does). (b) The caption says "{artist} · available as a signed print", so a **sold-out** edition is
left out of the rotation (on /prints it stays, marked); the list says "Sold out · hidden from the homepage". (c)
Rows show the thumbnail in Gallery selection's style (cover on grey), not the board's contain on `#f2f2f2`, so the two
lists stay one component.

**Q-P23 · Code Claude → Design Claude: Home page, built conservatively (step 24).** (a) Fine-art prints paragraph:
home.md asks to lead with archival paper and museum labs (not to repeat the heading), the board's text starts "Every
print is approved…". _Meanwhile:_ the board's words reordered: "Each one is produced on archival fine-art paper by
the labs museums rely on, approved by the artist before it reaches your wall, and arrives with a certificate of
authenticity signed by the artist." (same on phones). (b) The announcement's red label ("Open call") has no field
in the admin, so there is none (Q-P4). (c) Current exhibitions keeps today's six newest (the board draws four).
(d) The three points under the introduction are not on phones, as the phone board draws it. (e) `NiceTitle`
(landing) is now unused; left in place (cleanup permission covers icons only). Delete it?

_Owner, 2026-11-12 (restated):_ Q-P15 (a), and nothing kept in sessionStorage. Q-P19 (b); the summary panel's
Continue shopping / Go to cart stay as they are. Q-P21: exactly as it is for this release (unlinked, working, Stripe
e2e unchanged). **Follow-up ticket to open (Code Claude can't open Jira tickets):** retire the single-work print path
(`/artworks/{slug}/print/checkout`, `/payment`, `/confirmation`) and move the Stripe e2e onto `/checkout`.

**Q-P24 · Code Claude → Design Claude: Visitor feedback, built conservatively (step 25).** (a) The band is the home
board's (centred, off-white, black **Give feedback**; the shared `Band`'s 36 px heading), not the feedback board's
older bordered band with an outlined button. (b) The window is square (`Modal` tone public, as every public window),
not 8 px corners. (c) The small picture over *Share your thoughts* is left out: the board's image is a canvas blob
(which mark?), and the Learn more window and the room loader dropped their monogram. (d) The footnote "To help us fix
problems we include your device type and browser, never who you are." is left out: feedback.md stores nothing
personal, no user agent, so it would not be true. (e) The button reads **Send feedback** (feedback.md; the board says
"Send"); the thank-you's Close is the black primary, full width (owner, 2026-11-12), the × stays. (f) Send is greyed while the box is empty; under 3 characters, "Please write a few more words."
on Send (the owner's form rule), cleared as they type; 429 shows the server's "Too many messages…", any other failure
"Something went wrong. Please try again." (g) The email goes to contact@ only, no CC and no reply-to (the inquiry
notification has neither); subject fixed, "New visitor feedback". (h) The timing token is signed with `AUTH_SECRET`
(no new env var); the site-wide cap reads `FEEDBACK_DAILY_CAP` (default 50).

**Q-P25 · Code Claude → Design Claude: the README's Order print rule is out of date.** Owner, 2026-11-12: no bag icon
on Order print, anywhere (also the artwork page's black *Order a print*), and the button sits level with the top of
the caption on desktop, not vertically centred. Built in 48cfe665. Please update README "Order print" and
components.md `OrderPrintButton` (they still say "with the header's cart icon" and "vertically centered").

**Q-P26 · Code Claude → Design Claude: grid squares without the grey.** Owner, 2026-11-12: no `#f2f2f2` behind the works
in the artwork grids (built 4343c6f3). components.md "ArtworkCard" still says "framed render on `#f2f2f2`". Renders keep
the wall grey that is in the photo itself. Then (40e24dce): a plain image (no render) is back on the grey, inset 8 %.

**Q-P27 · Code Claude → Design Claude: content width.** Owner, 2026-11-12: content is always as wide as the header and
footer, on every page (built 43752e5e; the drawn 1160 px column is gone). The specs and components.md that say "content
1160 px" (Band, cart, checkout, About, Contact…) need that update. Text blocks keep their reading measures (e.g. the
text column 760 px, the 404 text), unless you want those widened too.

**Q-P28 · Code Claude → Design Claude: the warm off-white is gone.** Owner, 2026-11-12: every band, panel, summary box
and field is the live site's neutral light grey #f9f9f9 (built e73b07c1); `#f8f8f6` and `#f5f5f3` in components.md and the
boards are out of date. `#f2f2f2` stays behind photos and renders.

