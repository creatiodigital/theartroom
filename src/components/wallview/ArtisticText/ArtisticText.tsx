'use client'

import { useState, useRef } from 'react'
import { useDispatch } from 'react-redux'

import { Icon } from '@/components/ui/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import { useArtisticText } from '@/components/wallview/hooks/useArtisticText'
import Monogram from '@/icons/monogram.svg'
import { setEditingArtwork } from '@/redux/slices/dashboardSlice'

import styles from './ArtisticText.module.scss'

interface ArtisticTextProps {
  artworkId: string
}

const ArtisticText = ({ artworkId }: ArtisticTextProps) => {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const dispatch = useDispatch()

  const artisticText = useArtisticText(artworkId)

  if (!artisticText) return null

  const {
    textContent,
    textAlign,
    textVerticalAlign,
    handleArtisticTextChange,
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

  const fontFamilyMap: Record<string, string> = {
    roboto: 'var(--font-wall-roboto)',
    lora: 'var(--font-wall-lora)',
    alegreya: 'var(--font-wall-alegreya)',
    manrope: 'var(--font-wall-manrope)',
    'garamond-glc': 'var(--font-wall-garamond-glc)',
    crimson: 'var(--font-wall-crimson)',
  }

  // Map font weight/style values to CSS properties
  const fontStyleMap: Record<string, { weight: number; style: string }> = {
    regular: { weight: 400, style: 'normal' },
    italic: { weight: 400, style: 'italic' },
    bold: { weight: 700, style: 'normal' },
    'bold-italic': { weight: 700, style: 'italic' },
  }

  const verticalAlignMap: Record<'top' | 'center' | 'bottom', string> = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
  }

  const fontFamilyVariable = fontFamilyMap[fontFamily] ?? fontFamilyMap.roboto
  const resolvedStyle = fontStyleMap[fontWeight] ?? fontStyleMap.regular
  // Only apply vertical alignment when there's actual text content
  const hasContent = !!textContent?.trim()
  const justifyContentValue = hasContent
    ? (verticalAlignMap[textVerticalAlign] ?? 'flex-start')
    : 'center'

  const handleDoubleClick = () => {
    if (!isEditing) {
      setIsEditing(true)
      dispatch(setEditingArtwork(true))

      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.focus()
        }
      }, 0)
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    dispatch(setEditingArtwork(false))
    if (contentRef.current) {
      const updatedText = contentRef.current.innerText.trim()
      handleArtisticTextChange(updatedText)
    }
  }

  return (
    <div
      className={`${styles.text} ${isEditing ? styles.editing : ''}`}
      onDoubleClick={handleDoubleClick}
      style={{
        backgroundColor: textBackgroundColor ?? 'transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justifyContentValue,
        position: 'relative',
      }}
    >
      {!hasContent && !isEditing ? (
        <div className={styles.empty}>
          <Tooltip label="Double-click to start typing" placement="top">
            <span style={{ display: 'inline-flex' }}>
              <Icon name="type" size={40} color="#000000" />
            </span>
          </Tooltip>
        </div>
      ) : (
        <div
          ref={contentRef}
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
          className={`${styles.content} ${isEditing ? styles.editable : ''}`}
          contentEditable={isEditing}
          suppressContentEditableWarning={true}
          onBlur={handleBlur}
        >
          {textContent}
        </div>
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
