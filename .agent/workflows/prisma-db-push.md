---
description: How to push database schema changes with Prisma
---

# Prisma Database Schema Push

This project uses Prisma Accelerate for runtime queries, but needs the direct database URL for CLI commands like `db push`.

## Prerequisites

Your `.env` file should have both:

- `DATABASE_URL` - Prisma Accelerate URL (for runtime)
- `DIRECT_DATABASE_URL` - Direct Postgres URL (for CLI commands)

## Push Schema Changes

// turbo

```bash
npx prisma db push --config prisma/prisma.config.ts
```

## Regenerate Prisma Client

After schema changes, regenerate the client:

// turbo

```bash
npx prisma generate
```

## Workflow for Adding New Database Fields

1. Edit `prisma/schema.prisma` to add new field
2. Run `npx prisma generate` to update TypeScript types
3. Run `npx prisma db push --config prisma/prisma.config.ts` to sync database
4. Update application code to use the new field
