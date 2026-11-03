import prisma from '@/lib/prisma'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/**
 * The Enter button's colors from a slide form's body, each only if it's a #rrggbb color (they go
 * straight into the page's styles); anything else is left as it is.
 */
export function ctaColors(body: { ctaBackgroundColor?: unknown; ctaTextColor?: unknown }) {
  const { ctaBackgroundColor, ctaTextColor } = body
  return {
    ...(typeof ctaBackgroundColor === 'string' && HEX_COLOR.test(ctaBackgroundColor)
      ? { ctaBackgroundColor }
      : {}),
    ...(typeof ctaTextColor === 'string' && HEX_COLOR.test(ctaTextColor) ? { ctaTextColor } : {}),
  }
}

/** An exhibition page's path: /exhibitions/<artist>/<exhibition>. */
const EXHIBITION_PATH = /^\/exhibitions\/([^/]+)\/([^/]+)\/?$/

/**
 * The exhibition a slide's link opens, whatever site the link names (an admin may paste a full
 * staging or production URL, or a path) — or null when it opens something else.
 */
export function exhibitionOfUrl(
  url: string,
): { artistSlug: string; exhibitionSlug: string; path: string } | null {
  let pathname: string
  try {
    pathname = new URL(url, 'https://theartroom.gallery').pathname
  } catch {
    return null
  }
  const match = EXHIBITION_PATH.exec(pathname)
  if (!match) return null
  try {
    return {
      artistSlug: decodeURIComponent(match[1]),
      exhibitionSlug: decodeURIComponent(match[2]),
      path: `/exhibitions/${match[1]}/${match[2]}`,
    }
  } catch {
    return null
  }
}

/**
 * For each slide link that opens a published exhibition whose 3D space is published too, the way
 * straight into that space on this site (`…/visit`), by link. Links to anything else are absent,
 * and their slides get no "Enter 3D room" button.
 */
export async function visitUrlsFor(urls: string[]): Promise<Record<string, string>> {
  const targets = urls.flatMap((url) => {
    const target = exhibitionOfUrl(url)
    return target ? [{ url, ...target }] : []
  })
  if (targets.length === 0) return {}
  const open = await prisma.exhibition.findMany({
    where: {
      published: true,
      spacePublished: true,
      OR: targets.map((t) => ({ url: t.exhibitionSlug, user: { handler: t.artistSlug } })),
    },
    select: { url: true, user: { select: { handler: true } } },
  })
  const isOpen = new Set(open.map((e) => `${e.user.handler}/${e.url}`))
  return Object.fromEntries(
    targets
      .filter((t) => isOpen.has(`${t.artistSlug}/${t.exhibitionSlug}`))
      .map((t) => [t.url, `${t.path}/visit`]),
  )
}
