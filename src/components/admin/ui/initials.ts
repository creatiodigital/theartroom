/** Up to two capital initials from a name, e.g. "Elena Ruiz Soler" → "ER" (the admin's avatars). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
