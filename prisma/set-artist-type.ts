import 'dotenv/config'
import { PrismaNeon } from '@prisma/adapter-neon'

import { PrismaClient } from '../src/generated/prisma/index.js'

const connectionString = process.env.POSTGRES_PRISMA_URL
if (!connectionString) throw new Error('POSTGRES_PRISMA_URL required')

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Update Mathias to be an artist
  const user = await prisma.user.update({
    where: { handler: 'mathias-heizmann' },
    data: {
      userType: 'artist',
    },
  })

  console.log('✅ Updated user to artist:', user.name, user.userType)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
