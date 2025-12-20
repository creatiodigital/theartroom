import 'dotenv/config'
import { withAccelerate } from '@prisma/extension-accelerate'

import { PrismaClient } from '../src/generated/prisma/index.js'

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())

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
