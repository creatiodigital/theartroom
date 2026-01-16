'use client'

import { useState, useRef } from 'react'
import { useDispatch } from 'react-redux'

import { Icon } from '@/components/ui/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import { useArtisticText } from '@/components/wallview/hooks/useArtisticText'
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
  } = artisticText

  const fontFamilyMap: Record<'roboto' | 'lora' | 'lato' | 'eb-garamond' | 'geist', string> = {
    roboto: 'var(--font-wall1)',
    lora: 'var(--font-wall2)',
    lato: 'var(--font-sans)',
    'eb-garamond': 'var(--font-serif)',
    geist: 'var(--font-dashboard)',
  }
  const fontWeightMap: Record<'regular' | 'bold', number> = {
    regular: 400,
    bold: 600,
  }

  const verticalAlignMap: Record<'top' | 'center' | 'bottom', string> = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
  }

  const fontFamilyVariable = fontFamilyMap[fontFamily] ?? fontFamilyMap.roboto
  const fontWeightVariable = fontWeightMap[fontWeight]
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
            fontWeight: fontWeightVariable,
            fontSize,
            lineHeight,
            letterSpacing: `${letterSpacing}px`,
          }}
          className={`${styles.content} ${isEditing ? styles.editable : ''}`}
          contentEditable={isEditing}
          suppressContentEditableWarning={true}
          onBlur={handleBlur}
        >
          {textContent}
        </div>
      )}
    </div>
  )
}

export default ArtisticText
