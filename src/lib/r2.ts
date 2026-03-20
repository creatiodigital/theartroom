import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import prisma from '@/lib/prisma'

// ── R2 client ────────────────────────────────────────────────────────────────

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

// ── Environment prefix ───────────────────────────────────────────────────────

function getEnvPrefix(): string {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

// ── Random suffix ────────────────────────────────────────────────────────────

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 10)
}

// ── Resolve artist handler from userId ───────────────────────────────────────

async function getArtistHandler(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { handler: true },
  })
  // Fallback to userId if handler is not found (shouldn't happen)
  return user?.handler ?? userId
}

// ── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload a file to R2.
 * @param key - The full object key (e.g. "production/artist-slug/abc123.webp")
 * @param body - File contents as Buffer
 * @param contentType - MIME type
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
  return `${PUBLIC_URL}/${key}`
}

// ── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a file from R2 by its public URL.
 * Handles multiple URL formats: custom domain, r2.dev, and legacy URLs.
 */
export async function deleteFromR2(url: string): Promise<void> {
  // Skip Vercel Blob URLs — they can't be deleted via R2
  if (url.includes('blob.vercel-storage.com')) {
    console.info('[R2] Skipping Vercel Blob URL (legacy):', url)
    return
  }

  // Extract the R2 object key by stripping any known URL prefix.
  // Handles both the custom domain and the r2.dev development URL.
  const key = url
    .replace(`${PUBLIC_URL}/`, '')
    .replace(/^https?:\/\/pub-[a-f0-9]+\.r2\.dev\//, '')
    .replace(/^https?:\/\/assets\.theartroom\.gallery\//, '')
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  )
}

// ── Presigned URL (for client-side uploads) ──────────────────────────────────

/**
 * Generate a presigned PUT URL for direct client-to-R2 uploads.
 * Used for large files (videos) that exceed Vercel's serverless body limit.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(r2, command, { expiresIn })
}

// ── Key builders ─────────────────────────────────────────────────────────────
// These build the R2 object key for each asset type.
// Structure: {env}/{artist-handler}/{artworkId}-{suffix}.{ext}

export async function buildArtworkImageKey(userId: string, artworkId: string): Promise<string> {
  const handler = await getArtistHandler(userId)
  return `${getEnvPrefix()}/artists/${handler}/${artworkId}-${randomSuffix()}.webp`
}

export async function buildArtworkVideoKey(
  userId: string,
  artworkId: string,
  ext: string,
): Promise<string> {
  const handler = await getArtistHandler(userId)
  return `${getEnvPrefix()}/artists/${handler}/${artworkId}-${randomSuffix()}.${ext}`
}

export async function buildArtworkSoundKey(
  userId: string,
  artworkId: string,
  ext: string,
): Promise<string> {
  const handler = await getArtistHandler(userId)
  return `${getEnvPrefix()}/artists/${handler}/${artworkId}-${randomSuffix()}.${ext}`
}

export async function buildProfileImageKey(userId: string): Promise<string> {
  const handler = await getArtistHandler(userId)
  return `${getEnvPrefix()}/profiles/${handler}/avatar-${randomSuffix()}.webp`
}

export async function buildExhibitionImageKey(exhibitionId: string): Promise<string> {
  // Look up exhibition URL slug for a readable path
  const exhibition = await prisma.exhibition.findUnique({
    where: { id: exhibitionId },
    select: { url: true },
  })
  const slug = exhibition?.url ?? exhibitionId
  return `${getEnvPrefix()}/exhibitions/${slug}/featured-${randomSuffix()}.webp`
}

export async function buildSlideImageKey(slideId: string): Promise<string> {
  return `${getEnvPrefix()}/slides/${slideId}/image-${randomSuffix()}.webp`
}
