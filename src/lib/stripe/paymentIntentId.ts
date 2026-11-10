/**
 * True for a string shaped like a Stripe PaymentIntent id (`pi_` + letters,
 * digits, underscores). The public entry points that look a PaymentIntent up —
 * the confirmation page and the two confirmation server actions — take the id
 * from the URL or from the caller, so anything else is refused before it costs
 * a Stripe request.
 */
export const isPaymentIntentId = (value: unknown): value is string =>
  typeof value === 'string' && /^pi_[A-Za-z0-9_]{1,250}$/.test(value)
