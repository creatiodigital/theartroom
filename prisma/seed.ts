import 'dotenv/config'
import { PrismaNeon } from '@prisma/adapter-neon'

import { PrismaClient } from '../src/generated/prisma/index.js'

const connectionString = process.env.POSTGRES_PRISMA_URL
if (!connectionString) throw new Error('POSTGRES_PRISMA_URL required')

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Generic seed user — uses the project's standard "John Doe"
  // placeholder so it can't be confused with any real artist. The
  // created row is the side-effect we care about; the return value
  // is unused, hence the underscore prefix.
  const _user = await prisma.user.create({
    data: {
      name: 'John',
      lastName: 'Doe',
      handler: 'john-doe',
      biography: 'Placeholder seed user.',
      email: 'john-doe@example.com',
      userType: 'artist',
    },
  })
  void _user
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
