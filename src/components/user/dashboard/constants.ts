/**
 * Spaces offered to ARTISTS when creating an exhibition.
 *
 * A separate file from `components/dashboard/constants.ts` (the ADMIN list) because the two
 * dashboards import their own — but they are held to the SAME contents by policy: every
 * space carries the same privileges for admins and artists alike. Decided 2026-09-08
 * (AR-145), when adding Vienna surfaced that Madrid had been offered to admins only since
 * this file was created. Nothing in code enforces the match, so change both together.
 *
 * `adminOnly` IS honoured here (`user/dashboard/index.tsx` filters on it) — unlike in the
 * admin list, where it is inert. It stays as the mechanism for hiding a space from artists
 * without deleting its entry, should the parity policy ever need an exception.
 *
 * ⚠️ A space belongs here only once its GLB and bakes are on R2: production always resolves
 * assets to R2 (`NEXT_PUBLIC_LOCAL_ASSETS` is dev-only), so offering a space whose files are
 * missing would let an artist build an exhibition in an empty room.
 */
export const spaceOptions = [
  { label: 'Paris', value: 'paris', adminOnly: false },
  // Madrid added 2026-09-08 (AR-145). Its assets were already on R2 and always had been —
  // it had simply never been offered to artists.
  { label: 'Madrid', value: 'madrid', adminOnly: false },
  // Vienna added 2026-09-08 (AR-145): vienna11.glb + both bakes verified on R2.
  { label: 'Vienna', value: 'vienna', adminOnly: false },
]
