import type { ComponentType, SVGProps } from 'react'

import { Text } from '@/components/ui/Typography'
import DoubleTap from '@/icons/gesture-double-tap.svg'
import Pinch from '@/icons/gesture-pinch.svg'
import SlideHorizontal from '@/icons/gesture-slide-horizontal.svg'
import SlideVertical from '@/icons/gesture-slide-vertical.svg'
import Tap from '@/icons/gesture-tap.svg'
import PhoneLandscape from '@/icons/phone-landscape.svg'

import styles from './TouchControlsGuide.module.scss'

type Gesture = {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  gesture: string
  action: string
}

// The finger's controls, in the order a visitor needs them: move, look, then the
// artworks. See MainCamera/navigation, touchGestures and tapTracker. A drag pulls
// the room along with the finger.
const GESTURES: Gesture[] = [
  { Icon: Tap, gesture: 'Tap anywhere in the room', action: 'Move there' },
  { Icon: SlideHorizontal, gesture: 'Slide left or right', action: 'Look around' },
  { Icon: SlideVertical, gesture: 'Slide up or down', action: 'Look up or down' },
  { Icon: Pinch, gesture: 'Pinch with two fingers', action: 'Step forward or back' },
  { Icon: Tap, gesture: 'Tap an artwork', action: 'Wall View: stand in front of it' },
  // Wall View (MainCamera): one finger or two move over the wall, the works square on; a pinch, or
  // the Exit Wall View button, leaves it.
  {
    Icon: SlideHorizontal,
    gesture: 'In Wall View, slide one or two fingers',
    action: 'Move over the wall: up, down and along',
  },
  { Icon: Pinch, gesture: 'In Wall View, pinch', action: 'Leave Wall View' },
  {
    Icon: DoubleTap,
    gesture: 'Double-tap an artwork',
    action: 'See its details, or play a sound piece',
  },
]

/** The controls section of the welcome guide, on phones and tablets. */
export const TouchControlsGuide = () => {
  return (
    <>
      <ul className={styles.gestures}>
        {GESTURES.map(({ Icon, gesture, action }) => (
          <li key={gesture} className={styles.gesture}>
            <span className={styles.icon}>
              <Icon aria-hidden focusable="false" />
            </span>
            <span className={styles.text}>
              <Text as="span" size="sm" className={styles.name}>
                {gesture}
              </Text>
              <Text as="span" size="sm" className={styles.action}>
                {action}
              </Text>
            </span>
          </li>
        ))}
      </ul>
      {/* Upright, a phone sees a narrow slice of the room; sideways, about three
        times as much. Shown only while the screen is upright. */}
      <div className={styles.rotateHint}>
        <span className={styles.icon}>
          <PhoneLandscape aria-hidden focusable="false" />
        </span>
        <Text as="span" size="sm" className={styles.action}>
          Hold your device sideways for a wider view.
        </Text>
      </div>
    </>
  )
}
