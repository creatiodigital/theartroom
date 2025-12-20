import 'dotenv/config'
import { withAccelerate } from '@prisma/extension-accelerate'
import bcrypt from 'bcryptjs'

import { PrismaClient } from '../src/generated/prisma/index.js'

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())

async function main() {
  const hashedPassword = await bcrypt.hash('admin1234@', 10)

  const admin = await prisma.user.create({
    data: {
      name: 'Eduardo',
      lastName: 'Plaza',
      handler: 'eduardo-plaza',
      email: 'contact@creatio.art',
      biography: 'Gallery Administrator',
      password: hashedPassword,
      userType: 'admin',
    },
  })

  console.log('✅ Admin user created:', admin.email)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
