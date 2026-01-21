import 'dotenv/config'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'

import { PrismaClient } from '../src/generated/prisma/index.js'

const connectionString = process.env.POSTGRES_PRISMA_URL
if (!connectionString) throw new Error('POSTGRES_PRISMA_URL required')

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const hashedPassword = await bcrypt.hash('nataliaNATALIA6344@t', 10)

  const admin = await prisma.user.create({
    data: {
      name: 'Eduardo',
      lastName: 'Plaza',
      handler: 'eduardo-plaza',
      email: 'contact@creatio.art',
      biography: 'Gallery Owner',
      password: hashedPassword,
      userType: 'superAdmin',
    },
  })

  console.log('✅ Super Admin user created:', admin.email)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
