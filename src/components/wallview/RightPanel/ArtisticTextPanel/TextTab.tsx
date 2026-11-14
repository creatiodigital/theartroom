'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useId, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Mesh } from 'three'

import { RoomLanguageSwitch } from '@/components/exhibitions/RoomLanguageSwitch/RoomLanguageSwitch'
import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { spaceGltfUrl } from '@/components/scene/spaceAsset'
import { Button } from '@/components/ui/Button'
import { PanelGroup } from '@/components/wallview/chrome'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { wallTextFit, type WallTextFit, type WallTextStyle } from '@/components/wallview/textFit'
import { convert2DTo3D } from '@/components/wallview/utils'
import { secondLanguageOf } from '@/lib/roomLanguage'
import { editArtisticText } from '@/redux/slices/artworkSlice'
import { pushToHistory, updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import { setRoomLanguage } from '@/redux/slices/sceneSlice'
import { textFocusDone } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import { fontSizes } from './constants'
import tab from './TextTab.module.scss'

type TextTabProps = {
  /** The Text tab is the open one (a focus request waits for it). */
  active: boolean
}

const linesTooLong = (fit: WallTextFit) =>
  `${fit.linesOver} ${fit.linesOver === 1 ? 'line' : 'lines'} too long`

/**
 * The selected text's words (AR-182, docs/wall-languages; designs/wall-languages-editor §2): the
 * English text and, when the exhibition has a second language, its optional version (empty: the
 * English text shows). Written here only, never on the wall; each key updates the wall at once.
 * Typing in a field previews the wall in its language. A text that doesn't fit its box says by
 * how many lines, with two fixes: a taller box, or the largest text size at which both fit.
 */
export function TextTab({ active }: TextTabProps) {
  const dispatch = useDispatch()
  const englishId = useId()
  const secondId = useId()
  const englishRef = useRef<HTMLTextAreaElement>(null)

  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const focusRequest = useSelector((state: RootState) => state.wallView.textFocusRequest)
  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const language = secondLanguageOf(
    useSelector((state: RootState) => state.exhibition.secondLanguage),
  )
  const artwork = useSelector((state: RootState) =>
    currentArtworkId ? state.artworks.byId[currentArtworkId] : undefined,
  )
  const box = useSelector((state: RootState) =>
    currentArtworkId ? state.exhibition.exhibitionArtworksById[currentArtworkId] : undefined,
  )
  const isLocked = box?.locked ?? false

  const {
    fontSize,
    lineHeight,
    letterSpacing,
    fontFamily,
    fontWeight,
    textPaddingTop,
    textPaddingBottom,
    textPaddingLeft,
    textPaddingRight,
  } = useArtworkDetails(currentArtworkId!)

  // For a taller box's 3D placement, as Fit box to text.
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const { nodes } = useGLTF(
    spaceGltfUrl(getSpaceConfig(spaceId || 'paris').gltfPath),
  ) as unknown as {
    nodes: Record<string, Mesh>
  }
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes, currentWallId)

  // A text just placed, or double-clicked on the wall: the cursor goes in its English field.
  useEffect(() => {
    if (!active || !currentArtworkId || focusRequest !== currentArtworkId) return
    englishRef.current?.focus()
    dispatch(textFocusDone())
  }, [active, currentArtworkId, focusRequest, dispatch])

  if (!currentArtworkId || !artwork) return null

  const english = artwork.textContent ?? ''
  // The version for this exhibition's language; one written for another stays as it is, unseen.
  const second =
    language && artwork.textContentSecondLang === language.code
      ? (artwork.textContentSecond ?? '')
      : ''
  const otherLanguage =
    language &&
    !!artwork.textContentSecond?.trim() &&
    artwork.textContentSecondLang !== language.code
      ? secondLanguageOf(artwork.textContentSecondLang)
      : null

  const style: WallTextStyle = {
    fontSize: fontSize?.value ?? 16,
    lineHeight: lineHeight?.value ?? 1.4,
    letterSpacing: letterSpacing?.value ?? 0,
    fontFamily: fontFamily?.value ?? 'roboto',
    fontWeight: fontWeight?.value ?? 'regular',
    padTop: textPaddingTop?.value ?? 0,
    padBottom: textPaddingBottom?.value ?? 0,
    padLeft: textPaddingLeft?.value ?? 0,
    padRight: textPaddingRight?.value ?? 0,
  }
  const fitOf = (text: string, size = style.fontSize) =>
    box ? wallTextFit(text, { ...style, fontSize: size }, box.width2d, box.height2d) : null
  const englishFit = fitOf(english)
  const secondFit = language ? fitOf(second) : null
  const texts = [english, second].filter((text) => text.trim())

  const setEnglish = (value: string) =>
    dispatch(
      editArtisticText({ currentArtworkId, property: 'textContent', value: value || undefined }),
    )
  const setSecond = (value: string) => {
    if (!language) return
    // '' (not undefined): the wall save sends it, so a cleared version is cleared.
    dispatch(editArtisticText({ currentArtworkId, property: 'textContentSecond', value }))
    dispatch(
      editArtisticText({
        currentArtworkId,
        property: 'textContentSecondLang',
        value: language.code,
      }),
    )
  }

  // Taller: the longer text fits, the box's top edge stays where it is.
  const makeTaller = () => {
    if (!box) return
    const needed = Math.max(
      ...texts.map((text) => fitOf(text)?.height ?? 0),
      box.height2d - style.padTop - style.padBottom,
    )
    const height2d = Math.ceil(needed + style.padTop + style.padBottom)
    if (height2d <= box.height2d) return
    dispatch(pushToHistory())
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: {
          height2d,
          ...(boundingData
            ? convert2DTo3D(box.posX2d, box.posY2d, box.width2d, height2d, boundingData)
            : {}),
        },
      }),
    )
  }

  // Smaller: the largest size under today's at which every text fits (else the smallest).
  const makeSmaller = () => {
    const smaller = fontSizes
      .map((option) => option.value)
      .filter((value) => value < style.fontSize)
      .sort((a, b) => b - a)
    if (smaller.length === 0) return
    const size =
      smaller.find((value) => texts.every((text) => fitOf(text, value)?.fits !== false)) ??
      smaller[smaller.length - 1]
    dispatch(
      editArtisticText({
        currentArtworkId,
        property: 'fontSize',
        value: { label: String(size), value: size },
      }),
    )
  }

  // Under each field: "Fits the box", or what doesn't fit with the two fixes (they fit both).
  const fitLine = (fit: WallTextFit | null, text: string, name: string) => {
    if (!fit || !text.trim()) return null
    if (fit.fits) return <p className={tab.fits}>Fits the box</p>
    return (
      <div className={tab.warning} role="status">
        <p className={tab.warningText}>
          The {name} text doesn’t fit: {linesTooLong(fit)}
        </p>
        <div className={tab.fixes}>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.link}
            onClick={makeTaller}
            disabled={isLocked}
          >
            Make the box taller
          </Button>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.link}
            onClick={makeSmaller}
            disabled={isLocked}
          >
            Smaller text size
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {language && (
        <PanelGroup title="Preview on the wall">
          <RoomLanguageSwitch tone="panel" />
        </PanelGroup>
      )}

      <PanelGroup>
        <div className={tab.field}>
          <label htmlFor={englishId} className={tab.label}>
            {language ? 'English' : 'Text'}
          </label>
          <textarea
            id={englishId}
            ref={englishRef}
            lang="en"
            className={tab.textarea}
            rows={6}
            value={english}
            placeholder="Write the text as it should read on the wall…"
            onChange={(event) => setEnglish(event.target.value)}
            onFocus={() => language && dispatch(setRoomLanguage(null))}
          />
          {fitLine(englishFit, english, 'English')}
        </div>

        {language ? (
          <div className={tab.field}>
            <label htmlFor={secondId} className={tab.label}>
              {language.name}
            </label>
            <p id={`${secondId}-help`} className={styles.note}>
              Optional. Leave empty to show the English text.
            </p>
            <textarea
              id={secondId}
              lang={language.code}
              className={tab.textarea}
              rows={6}
              value={second}
              aria-describedby={`${secondId}-help`}
              onChange={(event) => setSecond(event.target.value)}
              onFocus={() => dispatch(setRoomLanguage(language.code))}
            />
            {otherLanguage && (
              <p className={styles.note}>
                This text also has a {otherLanguage.name} version, kept but not shown here. Writing
                a {language.name} version replaces it.
              </p>
            )}
            {fitLine(secondFit, second, language.name)}
          </div>
        ) : (
          <p className={styles.note}>
            Want this text in a second language too? Choose one in{' '}
            {exhibitionId ? (
              <a
                href={`/dashboard/exhibitions/${exhibitionId}/settings#exhibition-languages`}
                target="_blank"
                rel="noopener noreferrer"
                className={tab.inlineLink}
              >
                Exhibition settings › Languages
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              'Exhibition settings › Languages'
            )}
            .
          </p>
        )}
      </PanelGroup>
    </>
  )
}
