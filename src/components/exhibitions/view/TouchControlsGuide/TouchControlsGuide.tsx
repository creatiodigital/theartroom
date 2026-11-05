import type { ComponentType, SVGProps } from 'react'

import { Text } from '@/components/ui/Typography'
import DoubleTap from '@/icons/gesture-double-tap.svg'
import Pinch from '@/icons/gesture-pinch.svg'
import SlideHorizontal from '@/icons/gesture-slide-horizontal.svg'
import SlideVertical from '@/icons/gesture-slide-vertical.svg'
import Tap from '@/icons/gesture-tap.svg'
import TwoFingerSlide from '@/icons/gesture-two-finger-slide.svg'
import PhoneLandscape from '@/icons/phone-landscape.svg'

import styles from './TouchControlsGuide.module.scss'

type Gesture = {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  gesture: string
  action: string
}

// The finger's controls (AR-172), in the order a visitor needs them: move,
// look, then the artworks. See MainCamera/touchGestures and tapTracker. The room
// follows the finger: sliding down draws it toward you, so you walk forward.
// Two fingers drag it too: sliding them right steps you left (AR-176).
const GESTURES: Gesture[] = [
  { Icon: SlideVertical, gesture: 'Slide down or up', action: 'Walk forward or back' },
  { Icon: SlideHorizontal, gesture: 'Slide left or right', action: 'Turn to look around' },
  { Icon: TwoFingerSlide, gesture: 'Slide two fingers left or right', action: 'Step sideways' },
  { Icon: Pinch, gesture: 'Pinch with two fingers', action: 'Zoom in or out' },
  { Icon: Tap, gesture: 'Tap an artwork', action: 'Go up to it' },
  {
    Icon: DoubleTap,
    gesture: 'Double-tap an artwork',
    action: 'See its details, or play a sound piece',
  },
]

/** The controls section of the welcome guide, on phones and tablets. */
export const TouchControlsGuide = () => (
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
