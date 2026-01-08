/**
 * Prisma Configuration for Prisma 7 with Accelerate
 * 
 * IMPORTANT: This project uses Prisma Accelerate for runtime queries.
 * 
 * - DATABASE_URL (in .env): Prisma Accelerate URL - used at RUNTIME for queries
 * - DIRECT_DATABASE_URL (in .env): Direct Postgres URL - used here for CLI commands
 * 
 * The datasource URL here uses DIRECT_DATABASE_URL because Prisma CLI commands
 * (like db push, migrate) need direct database access, not Accelerate.
 * 
 * Quick commands:
 *   pnpm db:push     - Push schema changes to database
 *   pnpm db:generate - Regenerate Prisma client
 */
import 'dotenv/config'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),
  datasource: {
    // Uses DIRECT_DATABASE_URL for CLI commands (db push, migrate)
    // This bypasses Prisma Accelerate which caches the schema
    url: env('DIRECT_DATABASE_URL'),
  },
})
