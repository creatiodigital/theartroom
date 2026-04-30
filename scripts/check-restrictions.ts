/**
 * Inspect printOptions on the e2e fixture artworks AND who owns them.
 * Run with: npx dotenv -e .env.local -- npx tsx scripts/check-restrictions.ts
 */
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../src/generated/prisma/client'

const connectionString = process.env.POSTGRES_PRISMA_URL
if (!connectionString) throw new Error('POSTGRES_PRISMA_URL is required')

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const slugs = ['landscape-and-river-52416', 'hivers-landscape-82478']
  for (const slug of slugs) {
    const a = await prisma.artwork.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        printProvider: true,
        printEnabled: true,
        printOptions: true,
        user: { select: { email: true } },
      },
    })
    console.log(JSON.stringify(a, null, 2))
  }
  console.log('---')
  console.log('E2E_ARTIST_EMAIL =', process.env.E2E_ARTIST_EMAIL ?? '(unset)')
  await prisma.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
