# Analytics: GA4 events (AR-185)

What visitors do on the public site, in GA4, so we can see where buyers stop. GA4 loads on Vercel
Production only (`NEXT_PUBLIC_GA_MEASUREMENT_ID`), under the cookie banner's Consent Mode v2.

## How it works

- Every event goes through `track()` in [src/lib/analytics/track.ts](../../src/lib/analytics/track.ts).
  The ecommerce helpers (cart lines → GA4 items, euros) are in
  [src/lib/analytics/events.ts](../../src/lib/analytics/events.ts).
- GA's scripts load late (`lazyOnload`). An event fired before then waits in `window.__arEvents`,
  and the GA init script ([GoogleAnalytics.tsx](../../src/components/analytics/GoogleAnalytics.tsx))
  sends it right after consent and `config`. Nothing is lost on a fast page.
- In development `track()` writes each event to the console as `[analytics] name {…}` and sends
  nothing.
- **No personal data:** no names, emails, addresses or card details. Address errors send field
  names only, and payment errors send Stripe's code only (e.g. `card_declined`).
- **Stripe's client secret:** after 3D Secure or PayPal, Stripe puts it in the URL. The init script
  sends GA a `page_location` without it.

### Internal traffic (you, the artists)

Anyone signed in as admin, artist or curator marks their browser as internal
([InternalTrafficMarker.tsx](../../src/components/analytics/InternalTrafficMarker.tsx)). From then
on every hit carries `traffic_type: internal`, even after signing out. On a phone or any browser
where you never sign in, open any page once with `?ar_internal=1`. `?ar_internal=0` clears it.

## The events

Ecommerce events use GA4's recommended names, so **Monetization → Ecommerce purchases** and the
checkout funnel fill in on their own. `value` is in euros and covers the items before VAT and
shipping, the same number the cart shows. `item_id` is the artwork slug; `item_brand` is the artist;
`item_category` is "Open edition" or "Limited edition"; `item_variant` is the edition name or the
size (H × W cm).

### Shop funnel

| Event | When | Parameters |
|---|---|---|
| `view_item` | An artwork with a print on offer is shown (artwork page, or its details in the 3D room) | `surface` page/room, `value` = lowest price, `items` |
| `inquire_open` | Inquire pressed | `item_id`, `surface`, `for_sale` |
| `generate_lead` | Inquiry sent | `item_id`, `lead_type` inquire |
| `inquire_error` | Inquiry failed to send | `item_id` |
| `print_wizard_open` | The print configurator opens | `item_id`, `item_category`, `source` artwork_page/room/cart_edit/direct, `value` = opening price |
| `print_option_change` | The buyer changes an option (sliders: once they settle) | `item_id`, `option` (paper, format, frameType, size, border…), `choice` |
| `print_help_open` | "What is an open/limited edition?" | `item_id` |
| `add_to_cart` | Added to the cart | `items`, `value`, `edit` (re-added from the cart's Edit) |
| `view_cart` | The cart page (also when empty, with value 0) | `items`, `value` |
| `remove_from_cart` | A line removed | `items`, `value` |
| `begin_checkout` | The checkout's address step, with a cart | `items`, `value` |
| `add_shipping_info` | Address accepted, the review shows shipping and VAT for the first time | `items`, `value`, `shipping`, `tax`, `ship_country` |
| `payment_step_view` | The payment step opens (Stripe ready) | as above |
| `add_payment_info` | Pay pressed | `value` |
| `purchase` | The order is confirmed (sent once per order) | `transaction_id` = order reference, `items`, `value`, `shipping`, `tax`, `ship_country` |
| `checkout_error` | Anything that stops the checkout | `step` address/review/payment/payment_return/confirmation, `reason`, and per case `fields`, `failed_lines`, `sold_out`, `ship_country` |

`checkout_error` reasons: `invalid_fields` (with `fields`, e.g. `phone,postalCode`),
`item_unavailable`, the server's message (sold out, can't ship to the destination, rate limit…),
`payment_unavailable`, Stripe's decline or error code, `verify_failed` (3DS/PayPal return),
`order_not_finalized`.

### 3D room

| Event | When | Parameters |
|---|---|---|
| `room_loaded` | The loader steps aside | `exhibition`, `load_ms`, `touch` |
| `room_load_abandon` | The visitor leaves before that | `exhibition`, `elapsed_ms`, `progress_pct`, `touch` |
| `room_error` | WebGL unavailable, scene crashed, exhibition failed to load or not found; a work's details failed to load (its print offer then never shows) | `reason`, `exhibition` or `item_id`, `touch` |
| `room_artwork_view` | Wall View frames a work (click or tap) | `exhibition`, `item_id` |
| `room_artwork_details` | A work's details open (double click or double tap) | `item_id` |
| `room_menu` | Help, About, Feedback or Leave in the menu | `action`, `exhibition` |
| `room_visit_end` | The visit ends (tab closed, Leave, a link) | `exhibition`, `seconds`, `works_viewed`, `details_opened`, `touch` |

A phone tab that iOS kills for memory sends nothing, so a visit that ends with no `room_visit_end`
and no `room_load_abandon` may be one of those.

### Whole site

| Event | When | Parameters |
|---|---|---|
| `consent_choice` | Accept or Decline in the cookie banner | `choice` |
| `units_change` | cm ⇄ in | `unit`, `area` (home, artwork, print_wizard…) |
| `email_click` | Any mailto link (Contact "Write to us", "Send a proposal", footer) | `area`, `link_text` |
| `feedback_submit` | Feedback sent (home or room) | `source` |
| `page_not_found` | The 404 page | `missing_path`, `from` (referring site) |
| `exception` | The error page | `description` (digest or error name), `fatal`, `page_path` |

GA4's automatic events stay as they are: `page_view` (also for in-app navigations),
`scroll`, outbound `click`, `form_start`.

## GA4 setup (one time, in analytics.google.com → Admin)

1. **Internal traffic.** Data collection and modification → Data filters → "Internal Traffic"
   (it already exists, in Testing). Leave it in Testing for a day, check in Reports that the
   dimension "Test data filter name" shows your visits, then set it to **Active**. Mark your
   phone first with `?ar_internal=1`. Filters only apply from then on, not to past data.
2. **Key events.** Data display → Events: mark `purchase` (usually already a key event),
   `add_to_cart`, `begin_checkout` and `generate_lead` as key events. Each event only shows
   up in the list after it has happened once.
3. **Custom dimensions** (Data display → Custom definitions → Create, scope Event) so the
   parameters show in reports: `source`, `surface`, `step`, `reason`, `option`, `choice`,
   `exhibition`, `area`, `action`, `ship_country`, `fields`, `unit`, `app_version`.
   **Custom metrics** (same page): `load_ms` (milliseconds), `elapsed_ms` (milliseconds),
   `seconds` (seconds), `works_viewed`, `details_opened`, `progress_pct` (standard).
4. **Redact the Stripe secret here too** (belt and braces). Data collection → Data streams →
   the web stream → Redact data → URL query parameters: `payment_intent_client_secret`.
5. **Enhanced measurement** (same stream): keep "Page changes based on browser history
   events" on; the app's in-page navigations depend on it. "Form interactions" is mostly
   your dashboard login: switch it off if it clutters the events.
6. **The funnel.** Explore → Funnel exploration, open funnel, steps: `view_item` →
   `print_wizard_open` → `add_to_cart` → `begin_checkout` → `add_shipping_info` →
   `payment_step_view` → `add_payment_info` → `purchase`. Break it down by Device category.

## Not tracked, on purpose

- **No GTM.** The events are sent from our code; GTM would only re-route them. It becomes
  useful with ad pixels (Pinterest, Meta). Those need ad consent, which the banner doesn't
  ask for today.
- **No session replays or heatmaps.**
- **No personal data** (see above).
- **Visitors who decline or ignore the banner** reach GA4 only as cookieless pings, which
  standard reports don't show at this traffic level. Vercel Analytics counts everyone
  (cookieless); compare its visitors with GA4's users to see the gap.
