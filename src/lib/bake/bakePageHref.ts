/**
 * AR-161 — where the editor's Bake panel sends the admin: the visit page in bake mode
 * (`?bake=1`) or review mode (`?review=1`). The one place those links are built.
 */
export const bakePageHref = (
  artistSlug: string,
  exhibitionSlug: string,
  mode: 'bake' | 'review',
): string =>
  `/exhibitions/${encodeURIComponent(artistSlug)}/${encodeURIComponent(exhibitionSlug)}/visit?${mode}=1`
