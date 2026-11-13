'use client'

import { useDispatch } from 'react-redux'
import { ArrowLeft } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'
import { requestArtworkViewExit } from '@/redux/slices/sceneSlice'

import styles from './RoomControls.module.scss'

/**
 * While the visitor stands in Wall View (a tap on a work frames it, and every move then travels
 * over its wall), the way out a mouse and keyboard have, with no pinch (AR-178, owner, 2026-11-07:
 * "that button 'Exit Wall View' is paramount"). Labelled, top-left (visitor-wallview.md §2,
 * approved 2026-11-11); the menu stays top-right. Escape and a pinch still leave too (MainCamera);
 * a click on the empty wall does not.
 */
export const ExitWallViewButton = () => {
  const dispatch = useDispatch()
  return (
    <div className={styles.exitWrap} data-panel-overlay>
      <Button
        variant="bare"
        className={styles.exitButton}
        onClick={() => dispatch(requestArtworkViewExit())}
      >
        <ArrowLeft size={18} weight="light" aria-hidden />
        Exit wall view
      </Button>
    </div>
  )
}
