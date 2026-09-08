/**
 * Spaces offered to ARTISTS when creating an exhibition.
 *
 * Deliberately separate from `components/dashboard/constants.ts`, which is the ADMIN list —
 * the two are not kept in sync, and that is the point: a space can be available to the
 * gallery before it is offered to artists. Consult both when changing what is on offer.
 *
 * Unlike the admin list, `adminOnly` IS honoured here (`user/dashboard/index.tsx` filters on
 * it), so an entry can be added and hidden from artists by flagging it rather than commenting
 * it out.
 *
 * ⚠️ A space belongs here only once its GLB and bakes are on R2: production always resolves
 * assets to R2 (`NEXT_PUBLIC_LOCAL_ASSETS` is dev-only), so offering a space whose files are
 * missing would let an artist build an exhibition in an empty room.
 */
export const spaceOptions = [
  { label: 'Paris', value: 'paris', adminOnly: false },
  // Vienna added 2026-09-08 (AR-145): vienna11.glb + both bakes verified on R2.
  { label: 'Vienna', value: 'vienna', adminOnly: false },
  // NOTE: Madrid is offered to admins but NOT here, and always has been. Its assets ARE on
  // R2, so this is a product decision rather than a technical gap — add it if artists should
  // have it.
]
