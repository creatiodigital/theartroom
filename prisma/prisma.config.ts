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
// This is required for CLI commands like db push
const directUrl = process.env.POSTGRES_URL_NON_POOLING

if (!directUrl) {
  throw new Error('POSTGRES_URL_NON_POOLING is required for Prisma CLI commands. Check your .env.local file.')
}

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),
  datasource: {
    url: directUrl,
  },
})


