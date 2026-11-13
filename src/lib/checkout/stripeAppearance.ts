import type { Appearance } from '@stripe/stripe-js'

/**
 * Stripe's Payment Element drawn in the checkout's style (docs/public-redesign/questions.md Q-P6,
 * designs/checkout-3-payment.dc.html): square corners, 13 px #555 labels, 1 px #dcdcdc boxes that turn
 * black on focus, and the Card / PayPal tabs as outlined choices with a 2 px black border on the
 * chosen one. Look only: the element, its fields and its payment methods are Stripe's.
 *
 * The font is the visitor's system sans-serif: Lato is self-hosted by the site and does not reach
 * Stripe's frame, and loading it from Google Fonts there would send buyers' addresses to Google.
 * Values are literal colours: the frame cannot read the site's CSS variables.
 */
export const STRIPE_APPEARANCE: Appearance = {
  theme: 'stripe',
  variables: {
    borderRadius: '0px',
    colorPrimary: '#1a1a1a',
    colorText: '#1a1a1a',
    colorTextSecondary: '#555555',
    colorTextPlaceholder: '#888888',
    colorDanger: '#cc0000',
    fontSizeBase: '15px',
  },
  rules: {
    '.Label': { fontSize: '13px', color: '#555555', marginBottom: '6px' },
    '.Input': { border: '1px solid #dcdcdc', boxShadow: 'none', padding: '13px 14px' },
    '.Input:focus': { border: '1px solid #1a1a1a', boxShadow: 'none' },
    '.Input--invalid': { border: '1px solid #cc0000', boxShadow: 'none' },
    '.Tab': { border: '1px solid #dcdcdc', boxShadow: 'none', padding: '16px 18px' },
    '.Tab:hover': { border: '1px solid #1a1a1a', boxShadow: 'none' },
    '.Tab:focus': { boxShadow: '0 0 0 2px #1a1a1a' },
    '.Tab--selected': { border: '2px solid #1a1a1a', boxShadow: 'none' },
    '.Tab--selected:hover': { border: '2px solid #1a1a1a', boxShadow: 'none' },
    '.Tab--selected:focus': { border: '2px solid #1a1a1a', boxShadow: '0 0 0 2px #1a1a1a' },
  },
}
