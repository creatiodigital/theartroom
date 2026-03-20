/**
 * DB URL Migration Script
 * 
 * Updates asset URLs in the database to reflect the new R2 folder structure.
 * Only artwork URLs need updating (they move from /{handler}/ to /artists/{handler}/).
 * 
 * Usage: node scripts/migrate-r2-urls.mjs
 */

import pg from 'pg'
import dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const DATABASE_URL = process.env.POSTGRES_URL
if (!DATABASE_URL) {
  console.error('POSTGRES_URL not found in .env.local')
  process.exit(1)
}

console.log(`\n🔗 Connecting to: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`)

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Known system folders that do NOT get the artists/ prefix
const SYSTEM_PREFIXES = ['/exhibitions/', '/profiles/', '/slides/', '/artists/']

function addArtistsPrefix(url) {
  if (!url) return null
  if (url.includes('blob.vercel-storage.com')) return null
  if (SYSTEM_PREFIXES.some(prefix => url.includes(prefix))) return null

  const match = url.match(/^(https:\/\/[^/]+)\/(production|development)\/([^/]+)\/(.+)$/)
  if (!match) return null

  const [, domain, env, handler, rest] = match
  return `${domain}/${env}/artists/${handler}/${rest}`
}

async function migrate() {
  await client.connect()

  console.log('📋 Scanning artworks for URLs to update...\n')

  const { rows: artworks } = await client.query(
    'SELECT id, "imageUrl", "soundUrl", "videoUrl" FROM "Artwork"'
  )

  let updates = 0
  let skipped = 0

  for (const artwork of artworks) {
    const newImageUrl = addArtistsPrefix(artwork.imageUrl)
    const newSoundUrl = addArtistsPrefix(artwork.soundUrl)
    const newVideoUrl = addArtistsPrefix(artwork.videoUrl)

    if (newImageUrl || newSoundUrl || newVideoUrl) {
      const sets = []
      const params = []
      let paramIdx = 1

      if (newImageUrl) {
        sets.push(`"imageUrl" = $${paramIdx++}`)
        params.push(newImageUrl)
        console.log(`   🖼️  ${artwork.id}: imageUrl → .../${newImageUrl.split('/').slice(-2).join('/')}`)
      }
      if (newSoundUrl) {
        sets.push(`"soundUrl" = $${paramIdx++}`)
        params.push(newSoundUrl)
        console.log(`   🔊 ${artwork.id}: soundUrl → .../${newSoundUrl.split('/').slice(-2).join('/')}`)
      }
      if (newVideoUrl) {
        sets.push(`"videoUrl" = $${paramIdx++}`)
        params.push(newVideoUrl)
        console.log(`   🎬 ${artwork.id}: videoUrl → .../${newVideoUrl.split('/').slice(-2).join('/')}`)
      }

      params.push(artwork.id)
      await client.query(
        `UPDATE "Artwork" SET ${sets.join(', ')} WHERE id = $${paramIdx}`,
        params
      )
      updates++
    } else {
      skipped++
    }
  }

  console.log(`\n📊 Migration complete!`)
  console.log(`   Updated: ${updates} artworks`)
  console.log(`   Skipped: ${skipped} artworks (Vercel Blob, system folder, or already correct)`)

  await client.end()
}

migrate().catch(async (err) => {
  console.error('Migration failed:', err)
  await client.end()
  process.exit(1)
})
