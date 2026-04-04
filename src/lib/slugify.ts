import prisma from '@/lib/prisma'

/**
 * Turn a title into a URL-friendly base string.
 * e.g. "Ruelle inondée I" → "ruelle-inondee-i"
 */
function slugifyBase(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // remove special chars
      .trim()
      .replace(/\s+/g, '-') // spaces to hyphens
      .replace(/-+/g, '-') || 'artwork' // collapse hyphens, fallback
  )
}

/**
 * Generate a unique slug by checking the database.
 * e.g. "Ruelle inondée I" → "ruelle-inondee-i-38291"
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugifyBase(title)

  for (let attempts = 0; attempts < 10; attempts++) {
    const suffix = Math.floor(10000 + Math.random() * 90000)
    const slug = `${base}-${suffix}`

    const existing = await prisma.artwork.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!existing) return slug
  }

  // Fallback: use timestamp to guarantee uniqueness
  return `${base}-${Date.now()}`
}

/**
 * Simple sync version for scripts that handle uniqueness externally.
 */
export function generateSlug(title: string): string {
  const base = slugifyBase(title)
  const suffix = Math.floor(10000 + Math.random() * 90000)
  return `${base}-${suffix}`
}
