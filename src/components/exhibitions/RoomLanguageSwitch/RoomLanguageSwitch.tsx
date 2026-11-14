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
   * room: the visitor's room menu (square corners, docs/public-redesign README); the choice is
   * remembered for this visit. editor: the 3D editor, beside the toolbar, so the artist sees how
   * both languages sit on the walls while arranging them; nothing is remembered.
   */
  tone: 'room' | 'editor'
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

  const options = [
    { code: null, name: 'English' },
    { code: language.code, name: language.name },
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
            font="dashboard"
            aria-pressed={pressed}
            className={c(styles.option, pressed && styles.pressed)}
            onClick={() => choose(option.code)}
          >
            {option.name}
          </Button>
        )
      })}
    </div>
  )
}
