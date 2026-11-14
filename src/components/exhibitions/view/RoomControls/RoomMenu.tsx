'use client'

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useSelector } from 'react-redux'
import {
  ChatCircle,
  HandTap,
  Info,
  List,
  MouseSimple,
  SignOut,
  SpeakerHigh,
  SpeakerSlash,
  X,
} from '@phosphor-icons/react'
import c from 'classnames'

import { RoomLanguageSwitch } from '@/components/exhibitions/RoomLanguageSwitch/RoomLanguageSwitch'
import { Button } from '@/components/ui/Button'
import { useSceneAudioActions, useSceneAudioState } from '@/contexts/SceneAudioContext'
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice'
import type { RootState } from '@/redux/store'

import styles from './RoomControls.module.scss'

interface RoomMenuProps {
  /**
   * Lists Sound: only where the exhibition has a work with sound or video (owner, 2026-11-13), the
   * menu sits inside the scene's audio provider and the room can show (never without WebGL). Listed,
   * it shows before anything plays, so a visitor can mute first (Q29).
   */
  sound: boolean
  /** Opens the controls guide. Left out where today's help button was not shown (no WebGL, bake). */
  onHelp?: () => void
  /** Leaves the exhibition at once (no dialog: the menu is already two clicks); in Wall View too (Q30). */
  onLeave: () => void
  /** Opens "About this exhibition" (room-about.md); listed first. Absent: no item. */
  onAbout?: () => void
  /** Opens the feedback window (feedback.md); after How to move around. Absent: no item. */
  onFeedback?: () => void
  /** Every press of the menu button, opening or closing the menu: the room closes its open windows. */
  onButtonPress?: () => void
  /**
   * AR-182: English | French as the first row (designs/wall-languages-visitor §1), only while the
   * exhibition shows its visitors the language switch. A press changes every wall text at once
   * and leaves the menu open.
   */
  languageSwitch?: boolean
}

const ICON = { size: 20, weight: 'light', 'aria-hidden': true } as const

/**
 * The room's one menu, top-right in the room and in Wall View (visitor-wallview.md §1): Sound, How
 * to move around, Leave exhibition, in place of the corner X and the sound and help buttons. The
 * same menu in the room and in Wall View (Q30).
 *
 * Sound reads and switches the scene's audio, so the menu renders inside `Scene`'s audio provider
 * (its `overlay`) once the room is mounted. Rendered outside it (before the room mounts) it has no
 * Sound item. A mute set before anything plays holds for the next sound or video: the provider
 * applies it to each one as it starts (Q29).
 *
 * Nothing in it reaches the room: the camera's mouse and wheel skip `[data-panel-overlay]`, its
 * touches and clicks count only on the canvas, and the keys pressed inside the menu stop here (the
 * camera listens on `window`). Escape closes the menu and does not also leave Wall View.
 */
export const RoomMenu = ({
  sound,
  onHelp,
  onLeave,
  onAbout,
  onFeedback,
  onButtonPress,
  languageSwitch = false,
}: RoomMenuProps) => {
  const [open, setOpen] = useState(false)
  // The leave dialog (also raised by walking into the exit corridor) takes over: the menu closes.
  const exitPromptOpen = useSelector((state: RootState) => state.scene.isExitPromptOpen)
  if (open && exitPromptOpen) setOpen(false)
  const { isMuted } = useSceneAudioState()
  const { toggleMute } = useSceneAudioActions()
  // The same switch the instructions window uses: a finger's controls, or the mouse's.
  const isTouch = useIsTouchDevice()

  // Button takes no ref: the wrapper finds the trigger (its own button) and the items.
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const trigger = () => wrapRef.current?.querySelector<HTMLElement>(':scope > button') ?? null
  const items = () =>
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
  const focusItem = (item: HTMLElement | undefined) => item?.focus({ preventScroll: true })

  const close = () => {
    trigger()?.focus({ preventScroll: true })
    setOpen(false)
  }

  // What was used last: a key, or a finger or the mouse, kept on the wrapper (`data-input`). The
  // focus comes back to the button in code (this menu's close; About and Feedback on theirs), and a
  // phone shows a focus moved in code as keyboard focus: after a tap the button wore the keyboard
  // ring (owner, 2026-11-14). The ring is for keyboards, so it shows only after a key.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const onKey = () => {
      wrap.dataset.input = 'keyboard'
    }
    const onPointer = () => {
      wrap.dataset.input = 'pointer'
    }
    // Capture: before the room or the menu stops a key on its way.
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [])

  // Focus goes to the first item on open.
  useLayoutEffect(() => {
    if (open) focusItem(items()[0])
  }, [open])

  // Escape, wherever the focus is: caught on `document`, before the camera's `window` listener
  // would also take it as "leave Wall View".
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      trigger()?.focus({ preventScroll: true })
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Focus is back on the button BEFORE the action runs: a window it opens may record the focused
  // element to return to, and this item is unmounting.
  const choose = (action: () => void) => {
    close()
    action()
  }

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The keys are the menu's here, never the room's (no walking while choosing).
    event.stopPropagation()
    const list = items()
    const current = list.indexOf(document.activeElement as HTMLElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusItem(list[current === -1 ? 0 : (current + 1) % list.length])
        break
      case 'ArrowUp':
        event.preventDefault()
        focusItem(list[current <= 0 ? list.length - 1 : current - 1])
        break
      case 'Home':
        event.preventDefault()
        focusItem(list[0])
        break
      case 'End':
        event.preventDefault()
        focusItem(list[list.length - 1])
        break
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        // Not prevented: from the button, Tab carries on as if the menu had never opened.
        close()
        break
    }
  }

  return (
    <div ref={wrapRef} className={styles.menuWrap} data-panel-overlay>
      {/* First, so the button and the panel sit above it. A click outside the menu closes it and
          does nothing in the room (no walk, no selection). */}
      {open && <div className={styles.scrim} onClick={close} aria-hidden />}
      <Button
        variant="bare"
        className={styles.menuButton}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          onButtonPress?.()
          if (open) close()
          else setOpen(true)
        }}
      >
        {open ? <X {...ICON} /> : <List {...ICON} />}
      </Button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Menu"
          className={styles.panel}
          onKeyDown={onPanelKeyDown}
        >
          {languageSwitch && (
            <>
              <div className={styles.languageRow}>
                <RoomLanguageSwitch tone="room" />
              </div>
              <div role="separator" className={styles.separator} />
            </>
          )}
          {onAbout && (
            <Button
              variant="bare"
              role="menuitem"
              tabIndex={-1}
              className={styles.item}
              onClick={() => choose(onAbout)}
            >
              <Info {...ICON} />
              About this exhibition
            </Button>
          )}
          {sound && (
            // Today's sound button: the same toggle. The menu stays open.
            <Button
              variant="bare"
              role="menuitemcheckbox"
              aria-checked={!isMuted}
              tabIndex={-1}
              className={styles.item}
              onClick={toggleMute}
            >
              {isMuted ? <SpeakerSlash {...ICON} /> : <SpeakerHigh {...ICON} />}
              Sound
              <span className={c(styles.switch, !isMuted && styles.switchOn)} aria-hidden />
            </Button>
          )}
          {onHelp && (
            <Button
              variant="bare"
              role="menuitem"
              tabIndex={-1}
              className={styles.item}
              onClick={() => choose(onHelp)}
            >
              {isTouch ? <HandTap {...ICON} /> : <MouseSimple {...ICON} />}
              How to move around
            </Button>
          )}
          {onFeedback && (
            <Button
              variant="bare"
              role="menuitem"
              tabIndex={-1}
              className={styles.item}
              onClick={() => choose(onFeedback)}
            >
              <ChatCircle {...ICON} />
              Send feedback
            </Button>
          )}
          {(sound || onHelp || onAbout || onFeedback) && (
            <div role="separator" className={styles.separator} />
          )}
          <Button
            variant="bare"
            role="menuitem"
            tabIndex={-1}
            className={styles.item}
            onClick={() => choose(onLeave)}
          >
            <SignOut {...ICON} />
            Leave exhibition
          </Button>
        </div>
      )}
    </div>
  )
}
