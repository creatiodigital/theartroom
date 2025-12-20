import 'dotenv/config'
import { withAccelerate } from '@prisma/extension-accelerate'
import bcrypt from 'bcryptjs'

import { PrismaClient } from '../src/generated/prisma/index.js'

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())

async function main() {
  // Hash the password
  const hashedPassword = await bcrypt.hash('mathias1234@', 10)

  // First, try to find user by handler (since email might be different)
  const existingUser = await prisma.user.findUnique({
    where: { handler: 'mathias-heizmann' },
  })

  if (existingUser) {
    // Update existing user with new email and password
    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        email: 'mathias@lumengallery.com',
        password: hashedPassword,
      },
    })
    console.log('✅ Updated user credentials:', user.email)
  } else {
    // Create new user
    const user = await prisma.user.create({
      data: {
        name: 'Mathias',
        lastName: 'Heizmann',
        handler: 'mathias-heizmann',
        biography: 'A simple biography',
        email: 'mathias@lumengallery.com',
        userType: 'artist',
        password: hashedPassword,
      },
    })
    console.log('✅ Created user with credentials:', user.email)
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
