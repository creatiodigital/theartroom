import type { ReactNode } from 'react'
// The SSR entry: this module has no 'use client' (it is rendered by the room's client view).
import { DeviceRotate, HandArrowUp, HandSwipeRight, HandTap } from '@phosphor-icons/react/dist/ssr'

import { Text } from '@/components/ui/Typography'
// Phosphor has no pinch and no double tap: these two stay ours, drawn at Phosphor light's weight.
import DoubleTap from '@/icons/gesture-double-tap.svg'
import Pinch from '@/icons/gesture-pinch.svg'

import styles from './TouchControlsGuide.module.scss'

type Gesture = {
  icon: ReactNode
  gesture: string
  action: string
}

// Phosphor light, at the tile's 30 px (the CSS sets it too).
const ICON = { size: 30, weight: 'light', 'aria-hidden': true, focusable: 'false' } as const
const tap = <HandTap {...ICON} />
const slideHorizontal = <HandSwipeRight {...ICON} />
const slideVertical = <HandArrowUp {...ICON} />
const pinch = <Pinch aria-hidden focusable="false" />
const doubleTap = <DoubleTap aria-hidden focusable="false" />

// The finger's controls, in the order a visitor needs them: move, look, then the
// artworks. See MainCamera/navigation, touchGestures and tapTracker. A drag pulls
// the room along with the finger.
const GESTURES: Gesture[] = [
  { icon: tap, gesture: 'Tap anywhere in the room', action: 'Move there' },
  { icon: slideHorizontal, gesture: 'Slide left or right', action: 'Look around' },
  { icon: slideVertical, gesture: 'Slide up or down', action: 'Look up or down' },
  { icon: pinch, gesture: 'Pinch with two fingers', action: 'Step forward or back' },
  { icon: tap, gesture: 'Tap an artwork', action: 'Wall View: stand in front of it' },
  // Wall View (MainCamera): one finger or two move over the wall, the works square on; a pinch, or
  // the Exit Wall View button, leaves it.
  {
    icon: slideHorizontal,
    gesture: 'In Wall View, slide one or two fingers',
    action: 'Move over the wall: up, down and along',
  },
  { icon: pinch, gesture: 'In Wall View, pinch', action: 'Leave Wall View' },
  {
    icon: doubleTap,
    gesture: 'Double-tap an artwork',
    action: 'See its details, or play a sound piece',
  },
]

/** The controls section of the welcome guide, on phones and tablets. */
export const TouchControlsGuide = () => {
  return (
    <>
      <ul className={styles.gestures}>
        {GESTURES.map(({ icon, gesture, action }) => (
          <li key={gesture} className={styles.gesture}>
            <span className={styles.icon}>{icon}</span>
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
          <DeviceRotate {...ICON} />
        </span>
        <Text as="span" size="sm" className={styles.action}>
          Hold your device sideways for a wider view.
        </Text>
      </div>
    </>
  )
}
