---
description: How to push database schema changes with Prisma
---

# Prisma Database Schema Push (Prisma 7 + Supabase)

> **This project uses Prisma 7 with Supabase.** The workflow below is specifically designed for this setup.

## ⚠️ Key Constraints

1. **Prisma 7 requires `--config` flag** - Without it, `prisma db push` will fail
2. **Two different URLs required**:
   - `POSTGRES_PRISMA_URL` = Connection pooler URL (runtime queries)
   - `POSTGRES_URL_NON_POOLING` = Direct connection (CLI commands)

> [!CAUTION]
> **Different URLs for different environments!**
>
> - **Local Development**: Uses URLs from `.env.local`
> - **Production**: Uses URLs from Vercel (injected automatically)
>
> Make sure you're pushing to the correct database!

---

## ✅ Standard Workflow

### Step 1: Edit the schema

Edit `prisma/schema.prisma` to add your new field:

```prisma
model Artwork {
  // ... existing fields
  newField String?  // New field
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

### Step 4: Update application code

Now add the field to:

- API routes (POST/PUT/GET)
- TypeScript types
- UI components
- Redux/state management

---

## 🔧 Troubleshooting

| Error                          | Cause                 | Fix                                                |
| ------------------------------ | --------------------- | -------------------------------------------------- |
| `datasource property required` | Missing --config flag | Use `pnpm db:push` instead of `npx prisma db push` |
| `Connection refused`           | Wrong database URL    | Check `.env.local` has correct `POSTGRES_*` URLs   |
| `Column not found`             | Schema not pushed     | Run `pnpm db:push`                                 |

---

## 📁 Required .env.local Structure

```env
# Supabase connection URLs (from Vercel/Supabase dashboard)
POSTGRES_PRISMA_URL="postgres://...?pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgres://..."
```

---

## 🚀 Quick Reference

```bash
# After editing schema.prisma:
pnpm db:generate  # Update TypeScript types
pnpm db:push      # Push to database
# Then update application code
```
