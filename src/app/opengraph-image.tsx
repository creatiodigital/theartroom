import { monogramCard } from '@/lib/og/monogramCard'

// The default share preview: the AR monogram centered on white. Exhibition,
// artwork and artist pages override it with their own image.
export const alt = 'The Art Room'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return monogramCard(size)
}
