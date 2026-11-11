'use client'

import { Gift, Palette, Printer, type Icon } from '@phosphor-icons/react'

import type { OffPlatformKind } from '@/lib/orders/offPlatformKinds'

/** sales.md §2: gift `Gift`, artist_copy `Palette`, test `Printer`. */
const KIND_ICONS: Record<OffPlatformKind, Icon> = {
  gift: Gift,
  artist_copy: Palette,
  test: Printer,
}

/**
 * The mark next to an off-platform kind's label (gallery gift, artist copy,
 * test print): Phosphor, 16px light, decorative. Nothing for an unknown kind.
 */
export function OffPlatformKindMark({ kind }: { kind: string }) {
  const KindIcon = KIND_ICONS[kind as OffPlatformKind]
  return KindIcon ? <KindIcon size={16} weight="light" aria-hidden /> : null
}
