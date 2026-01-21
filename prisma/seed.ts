import 'dotenv/config'
import { PrismaNeon } from '@prisma/adapter-neon'

import { PrismaClient } from '../src/generated/prisma/index.js'

const connectionString = process.env.POSTGRES_PRISMA_URL
if (!connectionString) throw new Error('POSTGRES_PRISMA_URL required')

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.create({
    data: {
      name: 'Mathias',
      lastName: 'Heizmann',
      handler: 'mathias-heizmann',
      biography: 'A simple biography',
      email: 'edoplaza@gmail.com',
      userType: 'artist',
    },
  })
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
