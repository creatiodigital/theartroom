# Public site · the remaining screens (step 39)

Owner: "we cannot leave anything out". These public screens have no board of their own; build them **from the
patterns already designed** (tokens, fields, buttons, panels in `components.md` and `order-flow.md`). Same rules: no
underlines, arrow before links, EB Garamond titles, Lato text, Phosphor light, UI only.

| Screen (route / component) | How it looks |
|---|---|
| **Single-artwork print path** (`/artworks/[slug]/print/checkout`, `/payment`, `/confirmation`) | Exactly the cart checkout's designs (`checkout-*`, `order-confirmed`): same step indicator, panels, texts. One look for both paths. |
| **Artwork details in the 3D room** (`exhibitions/view/ArtworkModal`, which uses `ArtworkDetailBody`) | **Exactly the artwork page** (`artwork.md`, `artwork-*` designs, landscape and portrait rules included), inside the overlay: same image area, same info column, same texts, same purchase block (price, availability, edition line, Order a print, Inquire), same "More by the artist" if the page has it. Build it from the **same components** as the artwork page so the two can never drift; the overlay only adds the close × (top right, radius 10, like the room menu) and fills the screen (full screen on phone). No exhibition named or linked, as on the page. |
| **Inquire** (`ui/InquireSidebar`) | Right-hand panel 440 px (full screen on phone): serif title *Inquire about this work*, the work's thumbnail + title + artist, the fields in the checkout style (48 px, `#dcdcdc`), black **Send inquiry**, today's success text in the same panel. Keep today's honeypot and logic. |
| **Added to cart** (`PrintWizard/CartAddedModal`) | 480 px window: small check circle, *Added to your cart*, one item row (thumbnail, title, edition, price), black **View cart**, **→ Continue browsing**. |
| **Empty cart** (`/cart` with no items) | Serif *Your cart is empty.*, one grey line, **→ Browse the prints**, **→ Visit the exhibitions**. |
| **404** (`app/not-found.tsx`) | **Designed**: see "Design: 404, error, passwords, cookie banner, loading" below and `designs/remaining-screens.dc.html`. |
| **Error** (`app/error.tsx`, `global-error.tsx`) | **Designed**: see "Design: 404, error, passwords, cookie banner, loading" below and `designs/remaining-screens.dc.html`. |
| **Reset password / change password** (`/reset-password`, `auth/ChangePasswordPage`) | **Designed**: see "Design: 404, error, passwords, cookie banner, loading" below and `designs/remaining-screens.dc.html`. |
| **Cookie banner** (`ui/CookieBanner`) | **Designed**: see "Design: 404, error, passwords, cookie banner, loading" below and `designs/remaining-screens.dc.html`. |
| **Loading states** (any public page) | **Designed**: see "Design: 404, error, passwords, cookie banner, loading" below and `designs/remaining-screens.dc.html`. |

## Design: 404, error, passwords, cookie banner, loading

Board: `designs/remaining-screens.dc.html` (canvas board "Visitors · 404, error, password, cookie banner, loading
(step 39)"). These replace the five rows above for 404, Error, Reset/change password, Cookie banner and Loading.
Owner approved without review ("I trust you"): build as drawn.

### 404 (`app/not-found.tsx`) and error (`app/error.tsx`, `app/global-error.tsx`)

- Normal header and footer. Content left-aligned with the header's content edge (desktop: 160 px from the left
  edge of the page; phone: 24 px), vertically centered in the space between header and footer. No images.
- Small grey caps label (11.5 px, letter-spacing .14em, `#999`): **Page not found** / **Error**.
- Serif title, 52 px desktop / 36 px phone, weight 400:
  - 404: *This page doesn’t exist.*
  - Error: *Something went wrong.*
- One line, 18 px / 16 px, `#555`:
  - 404: *It may have moved, or the link may be incomplete.*
  - Error: *Please try again in a moment.*
- Actions, side by side on desktop (gap 28 px), stacked on phone (gap 14 px):
  - 404: **→ Back to the home page** (`/`), **→ Exhibitions** (`/exhibitions`).
  - Error: black **Try again** button (50 px, caps 13 px; calls today's `reset()`), **→ Back to the home page**.
- `global-error.tsx` cannot use the layout: same words and the same title/line/button, no header or footer.
- Keep `not-found` returning a real 404 status and `noindex`.

### Reset password (`/reset-password`) and Set your password (`auth/ChangePasswordPage`)

- Reset password: public header and footer, a centered 420 px column (full width minus 24 px gutters on phone),
  no card. Top padding 88 px desktop / 40 px phone.
  - Serif title 40 / 32 px: *Reset your password*. Line under it, 16 px `#555`: *Choose a new password for your
    account.*
  - Fields in the checkout style: label 13 px `#555` above, box 48 px, 1 px `#dcdcdc` border (black when focused,
    `#bd1622` on error), radius 0, with a show/hide eye button (Phosphor `Eye` / `EyeSlash`, 18 px, `#888`,
    `aria-label` "Show password" / "Hide password").
  - **New password**, then the live checklist, then **Confirm password**.
  - Live checklist under New password, 13 px, gap 6 px. Each rule is grey `#888` with an empty circle until met,
    then green `#2f6b3a` with a check. Rules, from `src/utils/password.ts` (do not duplicate the regexes; reuse
    them): *At least 8 characters* · *One uppercase letter* · *One lowercase letter* · *One number*.
    The list is `aria-live="polite"`.
  - Mismatch: red border on Confirm password and the line *Passwords don’t match.* (13 px, `#bd1622`) under it,
    shown on blur or submit, not while typing.
  - Black full-width **Reset password** button (50 px). Server errors (expired or invalid link) as one red line
    under the button, with **→ Request a new link** when the link has expired (only if that route exists today;
    otherwise just the red line).
  - Done state replaces the form in the same place: black 44 px circle with a white check, serif *Your password is
    updated.*, line *You can now sign in with your new password.*, **→ Back to the home page**.
- Set your password (studio, first sign-in with a temporary password, `/dashboard/change-password`): the studio
  look, not the public one. Background `#fafaf9`, a white 460 px card (1 px `#ececec`, padding 36 px), 80 px from the
  top, no header. Inside: the red logo (the real SVG `src/icons/logo.svg`, about 20 px tall; the board only shows it as text), sans title 26 px bold *Set your password*, line *For security, replace the temporary password
  with one of your own.*, then exactly the same fields, eye buttons, checklist, mismatch line and black full-width
  **Set password** button. Keep today's logic and redirect.
- One shared `PasswordFields` component (two fields + eye buttons + checklist + mismatch line) used by both screens.

### Cookie banner (`ui/CookieBanner`)

- Keep today's logic, storage (`getConsent` / `setConsent`), the footer "Cookie settings" event and the
  `aria-labels`. Only the look and the words change.
- Desktop: white card fixed bottom-left, 24 px from the left and bottom, width 380 px, radius 14, padding 20 px,
  shadow `0 12px 36px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.05)`. Phone: 12 px from the left, right and bottom
  (full width minus 24 px).
- Content, gap 14 px:
  - Serif heading 20 px: *Cookies*.
  - Text 14 px, line-height 1.6, `#444`: *We use analytics cookies to understand how the gallery is explored and
    to improve it. Declining won’t affect your visit.*
  - Two buttons in a two-column grid, gap 10 px: **Accept** and **Decline**. **Equal weight**: identical style,
    both outlined (1 px `#1a1a1a`, transparent background, 44 px tall, caps 12 px, letter-spacing as the other
    caps buttons), same width; hover fills both the same way (`#f5f5f3`). Neither is black-filled, neither is
    first in focus by default (tab order Accept, then Decline, as drawn).
  - **→ Privacy policy** as an arrow link under the buttons (opens in a new tab, as today).
- No "The Art Room" bold prefix any more; no other choices.

### Loading states

- Calm grey placeholders, no spinners and no shimmer animation (a still block; if anything, a very slow opacity
  pulse 0.6 → 1 over 1.6 s, disabled under `prefers-reduced-motion`). Color `#f2f2f2`, square corners.
- Blocks sit exactly where the real content will be, at the real sizes, so nothing jumps when it loads. Headings
  that are known (page titles like *Exhibitions*) are shown as real text, not as blocks.
- Drawn on the board for two shapes, reuse the same idea everywhere:
  - **List pages** (`exhibitions/loading.tsx`, and the same for Artists, Prints): the real page title, then two
    rows: a 340 × 227 image block, and on the right a short label line, a title bar, three text lines and the
    link line.
  - **Artwork page** (`artworks/[slug]/loading.tsx`): the big image block on the left, and in the 320 px column
    the label, title, two short lines, a hairline, the price block, a text line, the Order print button block
    (48 px) and the Inquire block.
- Images loading inside a finished page: the image box keeps its aspect ratio with the same `#f2f2f2` background
  until the image appears (fade in 200 ms).
- Buttons that are working (Send, Pay, Reset password…) keep their size and show their working text (*Sending…*),
  no spinner inside the button.
