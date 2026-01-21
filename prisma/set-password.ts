import 'dotenv/config'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'

import { PrismaClient } from '../src/generated/prisma/index.js'

const connectionString = process.env.POSTGRES_PRISMA_URL
if (!connectionString) throw new Error('POSTGRES_PRISMA_URL required')

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

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
        email: 'mathias@thefoundation.gallery',
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
        email: 'mathias@thefoundation.gallery',
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
