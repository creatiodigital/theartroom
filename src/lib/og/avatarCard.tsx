import { ImageResponse } from 'next/og'

import { StackedWordmark } from '@/components/brand/BrandMarks'

// The avatar's proportions (public/avatar.png): the longest line, ROOM, is 64%
// of the canvas's short side, so the three lines stay clear of a round crop.
const ROOM_SHARE = 0.64

/**
 * The gallery's avatar at any size: the wordmark on three lines (THE / ART /
 * ROOM), red on white, in the same proportions as public/avatar.png on
 * Instagram and Facebook. Used for the default share preview, the share
 * fallback and the home-screen / bookmark icon. On a wide canvas it stays
 * centered so it survives the square crop WhatsApp and some feeds apply.
 */
export function avatarCard(size: { width: number; height: number }) {
  const width = Math.round(Math.min(size.width, size.height) * ROOM_SHARE)

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}
    >
      <StackedWordmark width={width} />
    </div>,
    { ...size },
  )
}
