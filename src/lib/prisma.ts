import { PrismaNeon } from '@prisma/adapter-neon'

import { PrismaClient } from '../generated/prisma/client'

// Supabase uses Neon under the hood, so we use the Neon adapter
// POSTGRES_PRISMA_URL is the connection pooler URL from Supabase
const connectionString = process.env.POSTGRES_PRISMA_URL

if (!connectionString) {
  throw new Error('POSTGRES_PRISMA_URL is required. Make sure Supabase is connected.')
}

// PrismaNeon expects a PoolConfig object with connectionString
const adapter = new PrismaNeon({ connectionString })

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const prisma = globalForPrisma.prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma

