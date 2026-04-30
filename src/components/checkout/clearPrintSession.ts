/**
 * Wipes the per-artwork sessionStorage stash used by the wizard →
 * checkout → payment handoff. Called when the buyer hits CLOSE so a
 * later visit starts from a clean slate rather than restoring stale
 * picks. Keys mirror what each step writes:
 *
 *   - print-quote:<slug>   — wizard config + quote + specs
 *   - print-address:<slug> — checkout shipping form
 *   - print-payment:<slug> — payment client-secret + stash
 */
export function clearPrintSession(slug: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(`print-quote:${slug}`)
    sessionStorage.removeItem(`print-address:${slug}`)
    sessionStorage.removeItem(`print-payment:${slug}`)
  } catch {
    // sessionStorage may be unavailable (private mode etc.) — nothing
    // to clean up in that case.
  }
}
