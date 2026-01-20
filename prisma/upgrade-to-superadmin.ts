import 'dotenv/config'
import { withAccelerate } from '@prisma/extension-accelerate'

import { PrismaClient } from '../src/generated/prisma/index.js'

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())

async function main() {
  // Find the user by email
  const email = 'contact@creatio.art'

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    console.error('❌ User not found with email:', email)
    return
  }

  console.log('Found user:', user.name, user.lastName, '- Current type:', user.userType)

  // Upgrade to superAdmin
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { userType: 'superAdmin' },
  })

  console.log('✅ User upgraded to superAdmin:', updated.email)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
