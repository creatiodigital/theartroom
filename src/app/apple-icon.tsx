import { avatarCard } from '@/lib/og/avatarCard'

// The home-screen and Safari bookmark icon: the gallery's avatar.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return avatarCard(size)
}
