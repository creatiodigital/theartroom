'use client'

import c from 'classnames'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { secondLanguageOf, storeRoomLanguageChoice } from '@/lib/roomLanguage'
import { setRoomLanguage } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'

import styles from './RoomLanguageSwitch.module.scss'

type RoomLanguageSwitchProps = {
  /**
   * room: the visitor's room menu (square corners, docs/public-redesign README; the language's own
   * name); the choice is remembered for this visit. editor: the 3D editor's preview, top right;
   * panel: the wall view's Text tab, the 2D wall's preview. The editors' previews are never saved
   * or shown to visitors, and the editor always opens in English.
   */
  tone: 'room' | 'editor' | 'panel'
  className?: string
}

/**
 * AR-182: "English | French", the two languages of the room's wall texts (docs/wall-languages).
 * Every text artwork reads `scene.roomLanguage`, so a press changes them all at once, in place:
 * both texts came with the room's one load, nothing is fetched. Nothing renders when the
 * exhibition has no second language; whether it may show at all (the visitor switch) is the
 * caller's call. Only the 3D texts change: this control and the rest of the site stay English.
 */
export function RoomLanguageSwitch({ tone, className }: RoomLanguageSwitchProps) {
  const dispatch = useDispatch()
  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const secondLanguage = useSelector((state: RootState) => state.exhibition.secondLanguage)
  const roomLanguage = useSelector((state: RootState) => state.scene.roomLanguage)
  const language = secondLanguageOf(secondLanguage)
  if (!language) return null

  const choose = (code: string | null) => {
    dispatch(setRoomLanguage(code))
    if (tone === 'room' && exhibitionId) storeRoomLanguageChoice(exhibitionId, code)
  }

  // Visitors read the language's own name ("Français"); the editors, which are in English, its
  // English name (README, answers 2026-11-14).
  const options = [
    { code: null, lang: 'en', name: 'English' },
    {
      code: language.code,
      lang: language.code,
      name: tone === 'room' ? language.nativeName : language.name,
    },
  ]

  return (
    <div
      role="group"
      aria-label="Language of the texts in the room"
      className={c(styles.switch, styles[tone], className)}
    >
      {options.map((option) => {
        const pressed = (roomLanguage === language.code ? language.code : null) === option.code
        return (
          <Button
            key={option.name}
            variant="bare"
            font={tone === 'room' ? undefined : 'dashboard'}
            // In the room menu: two of its items (its arrow keys reach them), and a press leaves
            // the menu open. Elsewhere: two toggle buttons.
            {...(tone === 'room'
              ? { role: 'menuitemradio', 'aria-checked': pressed, tabIndex: -1 }
              : { 'aria-pressed': pressed })}
            className={c(styles.option, pressed && styles.pressed)}
            onClick={() => choose(option.code)}
          >
            {tone === 'room' ? <span lang={option.lang}>{option.name}</span> : option.name}
          </Button>
        )
      })}
    </div>
  )
}
