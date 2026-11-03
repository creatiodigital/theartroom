'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { useCanEnterWalkthrough } from '@/hooks/useCanEnterWalkthrough'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import styles from './EnterVirtualLink.module.scss'

/**
 * "→ Enter 3D room" under an exhibition card's "Visit exhibition" (owner, 2026-11-03: not
 * "exhibition" twice): straight into its 3D space — the gallery's difference, offered wherever an
 * exhibition is listed. For laptops and
 * desktops only, like the exhibition page's Enter button: CSS hides it elsewhere from the first
 * paint, and `useCanEnterWalkthrough` settles an iPad with a trackpad after hydration. It sits
 * above the card's stretched link, so it takes its own clicks. `className` gives it the card's
 * link style.
 */
export const EnterVirtualLink = ({ href, className }: { href: string; className?: string }) => {
  const canEnter = useCanEnterWalkthrough()
  if (!canEnter) return null
  return (
    <div className={styles.gate}>
      <Link href={href} className={className}>
        <ArrowRight size={16} strokeWidth={ICON_STROKE_WIDTH} />
        <span>Enter 3D room</span>
      </Link>
    </div>
  )
}
