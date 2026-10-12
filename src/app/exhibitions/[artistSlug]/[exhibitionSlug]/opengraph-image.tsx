import { exhibitionSharePreview } from '@/lib/og/pagePreviews'

// The share preview for this page: its own main image, whole on white. See
// src/lib/og/sharePreview.ts.
export const alt = 'The Art Room'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/jpeg'

type ImageProps = { params: Promise<{ artistSlug: string; exhibitionSlug: string }> }

export default async function Image({ params }: ImageProps) {
  const { artistSlug, exhibitionSlug } = await params
  return exhibitionSharePreview(artistSlug, exhibitionSlug)
}
