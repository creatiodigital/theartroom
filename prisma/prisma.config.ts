/**
 * Prisma Configuration for Prisma 7 with Supabase
 * 
 * Uses POSTGRES_URL_NON_POOLING for CLI commands (db push, migrate)
 * This is the direct database connection without connection pooling.
 * 
 * Quick commands:
 *   pnpm db:push     - Push schema changes to database
 *   pnpm db:generate - Regenerate Prisma client
 */
import dotenv from 'dotenv'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Load .env.local first (for local dev), then .env as fallback
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

// Supabase provides POSTGRES_URL_NON_POOLING for direct connection
// Fall back to POSTGRES_PRISMA_URL for generate command during build
const directUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL

// For Vercel build, if no URL is available, use a placeholder
// This allows prisma generate to work during build
const url = directUrl || 'postgresql://placeholder:placeholder@placeholder:5432/placeholder'

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),
  datasource: {
    url,
  },
})
