/**
 * R2 Bucket Migration Script
 * 
 * Copies all objects from `theartroom-assets` to `theartroom`
 * with the new folder structure (adds `artists/` prefix for artist folders).
 * 
 * Old structure: production/{artist-handler}/{file}
 * New structure: production/artists/{artist-handler}/{file}
 * 
 * Folders that stay the same: exhibitions/, profiles/, slides/
 * 
 * Usage: node scripts/migrate-r2-bucket.mjs
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY

const SOURCE_BUCKET = 'theartroom-assets'
const DEST_BUCKET = 'theartroom'

// Known system folders (these keep their path, no `artists/` prefix)
const SYSTEM_FOLDERS = ['exhibitions/', 'profiles/', 'slides/']

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
})

async function listAllObjects(bucket) {
  const objects = []
  let continuationToken

  do {
    const response = await r2.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    )
    if (response.Contents) {
      objects.push(...response.Contents)
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return objects
}

function getNewKey(key) {
  // Split into env prefix and rest: "production/mathias-heizmann/file.webp"
  const parts = key.split('/')
  if (parts.length < 2) return key // safety

  const envPrefix = parts[0] // "production" or "development"
  const secondPart = parts[1] // "mathias-heizmann" or "exhibitions" etc.

  // Check if this is a system folder (exhibitions, profiles, slides)
  const isSystemFolder = SYSTEM_FOLDERS.some(f => secondPart + '/' === f)

  if (isSystemFolder) {
    // Keep the same path
    return key
  }

  // It's an artist folder — add "artists/" prefix
  // production/mathias-heizmann/file.webp → production/artists/mathias-heizmann/file.webp
  return `${envPrefix}/artists/${parts.slice(1).join('/')}`
}

async function migrate() {
  console.log(`\n📦 Listing objects in source bucket: ${SOURCE_BUCKET}`)
  const objects = await listAllObjects(SOURCE_BUCKET)
  console.log(`   Found ${objects.length} objects\n`)

  if (objects.length === 0) {
    console.log('No objects to migrate.')
    return
  }

  // Show migration plan
  console.log('📋 Migration plan:')
  for (const obj of objects) {
    const newKey = getNewKey(obj.Key)
    const changed = newKey !== obj.Key ? ' ← MOVED' : ''
    console.log(`   ${obj.Key} → ${newKey}${changed}`)
  }

  console.log(`\n🚀 Starting migration...\n`)

  let copied = 0
  let skipped = 0
  let errors = 0

  for (const obj of objects) {
    const newKey = getNewKey(obj.Key)

    try {
      // Get the source object metadata to preserve content type
      const headResponse = await r2.send(
        new HeadObjectCommand({
          Bucket: SOURCE_BUCKET,
          Key: obj.Key,
        })
      )

      // Copy object to new bucket
      await r2.send(
        new CopyObjectCommand({
          Bucket: DEST_BUCKET,
          Key: newKey,
          CopySource: `${SOURCE_BUCKET}/${obj.Key}`,
          ContentType: headResponse.ContentType,
          CacheControl: 'public, max-age=31536000, immutable',
          MetadataDirective: 'REPLACE',
        })
      )
      copied++
      console.log(`   ✅ ${obj.Key} → ${newKey}`)
    } catch (err) {
      errors++
      console.error(`   ❌ Failed: ${obj.Key} →`, err.message)
    }
  }

  console.log(`\n📊 Migration complete!`)
  console.log(`   Copied: ${copied}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Errors: ${errors}`)
  console.log(`\n⚠️  Next steps:`)
  console.log(`   1. Switch custom domain from ${SOURCE_BUCKET} → ${DEST_BUCKET}`)
  console.log(`   2. Update R2_BUCKET_NAME in .env.local and Vercel`)
  console.log(`   3. Update r2.ts key builders to add artists/ prefix`)
  console.log(`   4. Run the DB URL migration script`)
  console.log(`   5. Delete old bucket ${SOURCE_BUCKET}`)
}

migrate().catch(console.error)
