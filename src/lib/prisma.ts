import { withAccelerate } from '@prisma/extension-accelerate'

import { PrismaClient } from '../generated/prisma/client'

const createClient = () =>
  new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL,
  }).$extends(withAccelerate())

type AcceleratedPrismaClient = ReturnType<typeof createClient>

declare global {
  var __prisma: AcceleratedPrismaClient | undefined
}

const prisma: AcceleratedPrismaClient =
  process.env.NODE_ENV === 'production' ? createClient() : (globalThis.__prisma ?? createClient())

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

export default prisma
