/**
 * One-time migration script to convert existing admin(s) to superAdmin
 *
 * Run with: npx ts-node scripts/convert-admin-to-superadmin.ts
 *
 * This script should be run ONCE after deploying the schema changes.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config()

const { withAccelerate } = require('@prisma/extension-accelerate')
const { PrismaClient } = require('../src/generated/prisma')

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())

async function main() {
  console.log('Converting existing admin users to superAdmin...')

  // Find all admins
  const admins = await prisma.user.findMany({
    where: { userType: 'admin' },
    select: { id: true, email: true, name: true },
  })

  if (admins.length === 0) {
    console.log('No admin users found.')
    return
  }

  console.log(`Found ${admins.length} admin user(s):`)
  admins.forEach((a: { name: string; email: string }) => console.log(`  - ${a.name} (${a.email})`))

  // Convert all to superAdmin
  const result = await prisma.user.updateMany({
    where: { userType: 'admin' },
    data: { userType: 'superAdmin' },
  })

  console.log(`\n✅ Converted ${result.count} user(s) to superAdmin.`)
}

main()
  .catch((e: Error) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
