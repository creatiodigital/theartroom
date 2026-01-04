import 'dotenv/config'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),
  datasource: {
    // Use DIRECT_DATABASE_URL for CLI commands (db push, migrate)
    // This is the direct Postgres URL, not the Accelerate URL
    url: env('DIRECT_DATABASE_URL'),
  },
})
