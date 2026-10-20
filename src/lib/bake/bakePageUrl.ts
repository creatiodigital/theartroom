/**
 * AR-161 — the admin's bake and review pages are the visit page with `?bake=1` / `?review=1`.
 * This page's query string with `mode` on and the other mode off; every other parameter kept.
 */
export const bakePageUrl = (search: string, mode: 'bake' | 'review'): string => {
  const params = new URLSearchParams(search)
  params.delete(mode === 'bake' ? 'review' : 'bake')
  params.delete(mode)
  params.set(mode, '1')
  return `?${params.toString()}`
}
