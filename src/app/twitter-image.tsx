import { avatarCard } from '@/lib/og/avatarCard'

// The default share preview: the stacked wordmark (THE / ART / ROOM) centered on white. Exhibition,
// artwork and artist pages override it with their own image.
export const alt = 'The Art Room'
export const size = { width: 1200, height: 600 }
export const contentType = 'image/png'

export default function TwitterImage() {
  return avatarCard(size)
}
