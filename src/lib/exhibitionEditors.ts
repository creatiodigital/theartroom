/**
 * Who can edit an exhibition (AR-182, docs/wall-languages rule 5): today the artist who owns it
 * (or an admin impersonating them) and the admins; later curators and gallery planners too, so
 * callers ask "can edit this exhibition", never "is the artist".
 *
 * Pure, for the client's choices (what a page shows). It is not an access gate: the API routes
 * enforce their own (`requireOwnership`, `isAdminOrAbove` in authUtils).
 */
type SessionLike =
  | {
      user?: { id?: string; userType?: string } | null
      impersonating?: { id: string } | null
    }
  | null
  | undefined

export const canEditExhibition = (
  session: SessionLike,
  exhibitionUserId: string | null | undefined,
): boolean => {
  if (!session?.user || !exhibitionUserId) return false
  const { userType } = session.user
  if (userType === 'admin' || userType === 'superAdmin') return true
  const effectiveUserId = session.impersonating?.id || session.user.id
  return effectiveUserId === exhibitionUserId
}
