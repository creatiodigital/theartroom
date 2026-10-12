import { ImageResponse } from 'next/og'

import { Monogram } from '@/components/brand/BrandMarks'

// The avatar's proportions (public/avatar.svg): the monogram's oval is 55% of
// the canvas's short side, centered.
const AVATAR_OVAL_SHARE = 0.55
// The oval within the Monogram viewBox (850.39 × 907.09): it fills 80.4% of
// the height and sits 0.67% of the height below the box's center.
const OVAL_HEIGHT_IN_BOX = 729.22 / 907.09
const OVAL_DROP_IN_BOX = 6.12 / 907.09

/**
 * The gallery's avatar at any size: the AR monogram centered on white, in the
 * same proportions as public/avatar.png on Instagram and Facebook. Used for
 * the default share preview and the home-screen icon. On a wide canvas it
 * stays centered so it survives the square crop WhatsApp and some feeds apply.
 */
export function monogramCard(size: { width: number; height: number }) {
  const markHeight = (Math.min(size.width, size.height) * AVATAR_OVAL_SHARE) / OVAL_HEIGHT_IN_BOX
  const markWidth = (markHeight * 850.39) / 907.09

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
      {/* Centered by its oval, not its box: lift it by the oval's drop. */}
      <div style={{ display: 'flex', marginTop: -2 * OVAL_DROP_IN_BOX * markHeight }}>
        <Monogram width={Math.round(markWidth)} height={Math.round(markHeight)} />
      </div>
    </div>,
    { ...size },
  )
}
