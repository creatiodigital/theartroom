/**
 * Who may send a PUT /api/exhibitions/[id] body. Publishing — whatever puts the show,
 * its 3D room or its preview link in front of people — is the gallery's call (an admin);
 * everything else is the owner's work (the owner, an admin impersonating them, or a
 * superAdmin).
 */
export interface ExhibitionUpdateRoles {
  /** requireAdminOrAbove */
  admin: boolean
  /** requireOwnership */
  owner: boolean
}

const isPublishKey = (key: string, body: Record<string, unknown>): boolean =>
  key === 'published' ||
  key === 'spacePublished' ||
  key === 'previewEnabled' ||
  (key === 'hasPendingChanges' && body.hasPendingChanges === false)

/**
 * A publish-only body needs an admin; a body without publish keys needs the owner; a body
 * mixing both needs both, so an admin can't make the owner's edits by adding a publish key.
 */
export function exhibitionUpdateRoles(body: Record<string, unknown>): ExhibitionUpdateRoles {
  const keys = Object.keys(body)
  const publishes = keys.some((key) => isPublishKey(key, body))
  const edits = keys.some((key) => !isPublishKey(key, body))
  return { admin: publishes, owner: edits || !publishes }
}
