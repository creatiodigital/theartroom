/**
 * One-time script to generate slugs for all existing artworks.
 * Run with: npx dotenv -e .env.local -- npx tsx scripts/generate-slugs.ts
 */
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../src/generated/prisma/client'

const connectionString = process.env.POSTGRES_PRISMA_URL
if (!connectionString) {
  throw new Error('POSTGRES_PRISMA_URL is required')
}

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

function slugifyBase(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'artwork'
  )
}

function generateSlug(title: string): string {
  const base = slugifyBase(title)
  const suffix = Math.floor(10000 + Math.random() * 90000)
  return `${base}-${suffix}`
}

async function main() {
  const artworks = await prisma.artwork.findMany({
    where: { slug: null },
    select: { id: true, title: true, name: true },
  })

  console.log(`Found ${artworks.length} artworks without slugs`)

  const usedSlugs = new Set<string>()

  for (const artwork of artworks) {
    const title = artwork.title || artwork.name || 'Untitled'
    let slug = generateSlug(title)

    while (usedSlugs.has(slug)) {
      slug = generateSlug(title)
    }
    usedSlugs.add(slug)

    await prisma.artwork.update({
      where: { id: artwork.id },
      data: { slug },
    })

    console.log(`  ${artwork.id} → ${slug}`)
  }

  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
