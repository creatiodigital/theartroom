'use client'

import c from 'classnames'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Text } from '@/components/ui/Typography'
import { useCanEnterWalkthrough } from '@/hooks/useCanEnterWalkthrough'

import styles from './EnterExhibitionButton.module.scss'

interface EnterExhibitionButtonProps {
  artistSlug: string
  exhibitionSlug: string
  visitUrl: string
  className?: string
}

// Carved out as a client island so the surrounding profile page can stay a
// server component. The 3D walk-through is for laptops and desktops with a mouse
// or trackpad (the /visit route turns everything else away), so the real CTA is
// shown only there, with a friendly note in its place everywhere else — no tap
// that would only turn the visitor away.
//
// CSS makes the first call (the `walkthrough-device` mixin: width plus a
// hovering, fine pointer), so a phone never sees the button flash in. It cannot
// spot an iPad with a trackpad attached, which reports a laptop's pointer, so
// `useCanEnterWalkthrough` settles that one after hydration — the same check
// the /visit route uses.
export const EnterExhibitionButton = ({
  artistSlug,
  exhibitionSlug,
  visitUrl,
  className,
}: EnterExhibitionButtonProps) => {
  const canEnter = useCanEnterWalkthrough()

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
    <>
      {canEnter && (
        <div className={styles.desktopCta} onClick={rememberReturn}>
          <Button
            variant="primary"
            size="bigSquared"
            label="Enter Virtual Exhibition"
            href={visitUrl}
            icon="arrowRight"
            className={className}
          />
        </div>
      )}

      <div className={c(styles.mobileNotice, { [styles.mobileNoticeShown]: !canEnter })}>
        <span className={styles.mobileNoticeIcon}>
          <Icon name="monitor" size={22} color="currentColor" />
        </span>
        <div className={styles.mobileNoticeBody}>
          <Text as="span" size="xs" className={styles.mobileNoticeLabel}>
            Virtual exhibition
          </Text>
          <Text as="p" size="sm" className={styles.mobileNoticeText}>
            Also available as an immersive 3D space — open this page on a laptop or desktop to step
            inside.
          </Text>
        </div>
      </div>
    </>
  )
}
