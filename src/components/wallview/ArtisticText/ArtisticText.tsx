'use client'

import { useDispatch, useSelector } from 'react-redux'

import { Icon } from '@/components/ui/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import { useArtisticText } from '@/components/wallview/hooks/useArtisticText'
import { WALL_FONT_FAMILIES, WALL_FONT_STYLES, wallTextFit } from '@/components/wallview/textFit'
import Monogram from '@/icons/monogram.svg'
import { roomTextOf } from '@/lib/roomLanguage'
import { requestTextFocus } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './ArtisticText.module.scss'

interface ArtisticTextProps {
  artworkId: string
}

/**
 * A text on the wall. AR-182 (docs/wall-languages): the box is placed and sized here, and its
 * words are written in the panel's Text tab, never on the wall (as an image is added in the
 * library, not on the wall). A double-click opens that tab with the cursor in the English field.
 * The words shown follow the editor's English | French preview; what doesn't fit the box spills
 * out, as it would on the wall in the room, with how many lines are outside.
 */
const ArtisticText = ({ artworkId }: ArtisticTextProps) => {
  const dispatch = useDispatch()
  const roomLanguage = useSelector((state: RootState) => state.scene.roomLanguage)
  const box = useSelector((state: RootState) => state.exhibition.exhibitionArtworksById[artworkId])

  const artisticText = useArtisticText(artworkId)

  if (!artisticText) return null

  const {
    textContent,
    textContentSecond,
    textContentSecondLang,
    textAlign,
    textVerticalAlign,
    textColor,
    textBackgroundColor,
    fontSize,
    fontFamily,
    fontWeight,
    lineHeight,
    letterSpacing,
    textPaddingTop,
    textPaddingBottom,
    textPaddingLeft,
    textPaddingRight,
    showMonogram,
    monogramColor,
    monogramOpacity,
    monogramPosition,
    monogramOffset,
    monogramSize,
    showTextBorder,
    textBorderColor,
    textBorderOffset,
  } = artisticText

  const shownText = roomTextOf(
    { textContent, textContentSecond, textContentSecondLang },
    roomLanguage,
  )

  const verticalAlignMap: Record<'top' | 'center' | 'bottom', string> = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
  }

  const fontFamilyVariable = WALL_FONT_FAMILIES[fontFamily] ?? WALL_FONT_FAMILIES.roboto
  const resolvedStyle = WALL_FONT_STYLES[fontWeight] ?? WALL_FONT_STYLES.regular
  // Only apply vertical alignment when there's actual text content
  const hasContent = !!shownText?.trim()
  const justifyContentValue = hasContent
    ? (verticalAlignMap[textVerticalAlign] ?? 'flex-start')
    : 'center'

  // What spills out of the box (the Text tab offers the fixes).
  const fit =
    hasContent && box
      ? wallTextFit(
          shownText!,
          {
            fontSize,
            lineHeight,
            letterSpacing,
            fontFamily,
            fontWeight,
            padTop: textPaddingTop,
            padBottom: textPaddingBottom,
            padLeft: textPaddingLeft,
            padRight: textPaddingRight,
          },
          box.width2d,
          box.height2d,
        )
      : null

  return (
    <div
      className={styles.text}
      onDoubleClick={() => dispatch(requestTextFocus(artworkId))}
      style={{
        backgroundColor: textBackgroundColor ?? 'transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justifyContentValue,
        position: 'relative',
      }}
    >
      {!hasContent ? (
        <div className={styles.empty}>
          <Tooltip label="Write the text in the panel" placement="top">
            <span style={{ display: 'inline-flex' }}>
              <Icon name="type" size={40} color="#000000" />
            </span>
          </Tooltip>
        </div>
      ) : (
        <div
          style={{
            textAlign,
            color: textColor,
            fontFamily: fontFamilyVariable,
            fontWeight: resolvedStyle.weight,
            fontStyle: resolvedStyle.style,
            fontSize,
            lineHeight,
            letterSpacing: `${letterSpacing}px`,
            padding: `${textPaddingTop}px ${textPaddingRight}px ${textPaddingBottom}px ${textPaddingLeft}px`,
          }}
          className={styles.content}
        >
          {shownText}
        </div>
      )}
      {fit && !fit.fits && (
        <span className={styles.overflow} role="status">
          {fit.linesOver === 1 ? '1 line' : `${fit.linesOver} lines`} outside the box
        </span>
      )}
      {showTextBorder &&
        (() => {
          const insetPx = `${textBorderOffset * 4}px` // 1cm = 4px (WALL_SCALE 400 / 100)
          return (
            <div
              style={{
                position: 'absolute',
                top: insetPx,
                left: insetPx,
                right: insetPx,
                bottom: insetPx,
                border: `1px solid ${textBorderColor}`,
                pointerEvents: 'none',
              }}
            />
          )
        })()}
      {showMonogram && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            ...(monogramPosition === 'top'
              ? { top: `${(monogramOffset ?? 2) * 4}px` }
              : { bottom: `${(monogramOffset ?? 2) * 4}px` }),
            width: `${(monogramSize ?? 4) * 4}px`,
            opacity: monogramOpacity ?? 1.0,
            pointerEvents: 'none',
          }}
        >
          <Monogram
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              color: monogramColor ?? '#c0392b',
            }}
          />
        </div>
      )}
    </div>
  )
}

export default ArtisticText
