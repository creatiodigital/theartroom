import { PrismaNeon } from '@prisma/adapter-neon'

import { PrismaClient } from '../generated/prisma/client'
import { PRIVATE_ARTWORK_OMIT } from './artworkFields'

// Supabase uses Neon under the hood, so we use the Neon adapter
// POSTGRES_PRISMA_URL is the connection pooler URL from Supabase
const connectionString = process.env.POSTGRES_PRISMA_URL

if (!connectionString) {
  throw new Error('POSTGRES_PRISMA_URL is required. Make sure Supabase is connected.')
}

// PrismaNeon expects a PoolConfig object with connectionString
const adapter = new PrismaNeon({ connectionString })

// The unique pieces' private prices are left out of every query unless one names them
// (PRIVATE_ARTWORK_OMIT, docs/unique-sales U1).
const createClient = () => new PrismaClient({ adapter, omit: { artwork: PRIVATE_ARTWORK_OMIT } })

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> }

const prisma = globalForPrisma.prisma || createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
