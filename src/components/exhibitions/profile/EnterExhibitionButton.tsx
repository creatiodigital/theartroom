'use client'

import { Button } from '@/components/ui/Button'

import styles from './EnterExhibitionButton.module.scss'

interface EnterExhibitionButtonProps {
  artistSlug: string
  exhibitionSlug: string
  visitUrl: string
  className?: string
}

// Carved out as a client island so the surrounding profile page can stay a
// server component: the click remembers which page the visitor came from.
//
// Every device gets it (AR-172). Phones and tablets walk the room with their
// own touch controls; it used to be laptops and desktops only, with a note in
// its place everywhere else.
export const EnterExhibitionButton = ({
  artistSlug,
  exhibitionSlug,
  visitUrl,
  className,
}: EnterExhibitionButtonProps) => {
  const rememberReturn = () => {
    try {
      sessionStorage.setItem(
        'the-art-room:internal-nav',
        JSON.stringify({
          from: 'exhibition',
          returnUrl: `/exhibitions/${artistSlug}/${exhibitionSlug}`,
        }),
      )
    } catch {}
  }

  return (
    <div className={styles.cta} onClick={rememberReturn}>
      <Button
        variant="primary"
        size="bigSquared"
        label="Enter 3D room"
        href={visitUrl}
        icon="box"
        className={className}
      />
    </div>
  )
}
