---
description: How to push database schema changes with Prisma
---

# Prisma Database Schema Push (Prisma 7 + Accelerate)

> **This project uses Prisma 7 with Prisma Accelerate.** The workflow below is specifically designed for this setup.

## ⚠️ Key Constraints

1. **Prisma 7 requires `--config` flag** - Without it, `prisma db push` will fail
2. **Accelerate caches the schema** - After pushing, wait 5-10 minutes before testing
3. **Two different URLs required**:
   - `DATABASE_URL` = Accelerate URL (runtime) - starts with `prisma+postgres://`
   - `DIRECT_DATABASE_URL` = Direct Postgres URL (CLI) - starts with `postgres://`

---

## ✅ Bulletproof Workflow

### Step 1: Edit the schema

Edit `prisma/schema.prisma` to add your new field:

```prisma
model Artwork {
  // ... existing fields
  featured Boolean @default(false)  // New field
}
```

### Step 2: Generate Prisma client

// turbo

```bash
pnpm db:generate
```

This updates TypeScript types so your IDE recognizes the new field.

### Step 3: Push to database

// turbo

```bash
pnpm db:push
```

This syncs your schema with the actual database.

### Step 4: Wait for Accelerate cache (CRITICAL)

**Prisma Accelerate caches the schema. You MUST wait 5-10 minutes before the new field works at runtime.**

Signs the cache hasn't refreshed:

- Error `P6001` with model name in meta
- "Invalid request to Prisma Accelerate" errors

### Step 5: Update application code

Now add the field to:

- API routes (POST/PUT/GET)
- TypeScript types
- UI components
- Redux/state management

---

## 🔧 Troubleshooting

| Error                            | Cause                                   | Fix                                                |
| -------------------------------- | --------------------------------------- | -------------------------------------------------- |
| `P6001: Invalid request`         | Accelerate schema cache not refreshed   | Wait 5-10 minutes                                  |
| `URL must start with prisma://`  | Wrong DATABASE_URL in .env              | Use Accelerate URL (prisma+postgres://)            |
| `datasource property required`   | Missing --config flag                   | Use `pnpm db:push` instead of `npx prisma db push` |
| `Unknown property datasourceUrl` | Tried to use direct URL in PrismaClient | PrismaClient only accepts `accelerateUrl`          |

---

## 📁 Required .env Structure

```env
# Prisma Accelerate URL (for RUNTIME queries)
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_KEY"

# Direct Postgres URL (for CLI commands like db:push)
DIRECT_DATABASE_URL="postgres://user:pass@host:5432/database?sslmode=require"
```

**NEVER** swap these URLs. The app will break.

---

## 🚀 Quick Reference

```bash
# After editing schema.prisma:
pnpm db:generate  # Update TypeScript types
pnpm db:push      # Push to database
# Wait 5-10 minutes for Accelerate cache
# Then update application code
```
