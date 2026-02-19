'use client'

import { useGLTF } from '@react-three/drei'
import { useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { spaceConfigs, type SpaceKey } from '@/components/scene/constants'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { convert2DTo3D } from '@/components/wallview/utils'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkTextHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkTextHandlers'
import PresetSection from '@/components/wallview/RightPanel/PresetSection/PresetSection'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TFontFamily, TFontWeight } from '@/types/fonts'

import {
  fontSizes,
  lineHeights,
  fontFamilies,
  fontWeights,
  letterSpacings,
  textPaddings,
  textThicknessOptions,
} from './constants'

/** Map font-family keys to the CSS custom properties used in the 2D wall view */
const fontFamilyMap: Record<string, string> = {
  roboto: 'var(--font-wall1)',
  lora: 'var(--font-wall2)',
  lato: 'var(--font-sans)',
  'eb-garamond': 'var(--font-serif)',
  geist: 'var(--font-dashboard)',
  'playfair-display': 'var(--font-playfair)',
}

const ArtisticText = () => {
  const dispatch = useDispatch()
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const { handleEditArtworkText } = useArtworkTextHandlers(currentArtworkId || '')

  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  // Bounding data for 2D→3D coordinate conversion
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const gltfPath = spaceConfigs[spaceId || 'classic']?.gltfPath || '/assets/spaces/classic.glb'
  const { nodes } = useGLTF(gltfPath) as unknown as { nodes: Record<string, Mesh> }
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const {
    textContent,
    textColor,
    textBackgroundColor,
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    fontFamily,
    textPadding,
    textThickness,
  } = useArtworkDetails(currentArtworkId!)

  /**
   * Measure the text's natural (unconstrained) dimensions using an off-screen
   * element styled identically to the 2D ArtisticText content div, then resize
   * the artwork frame to snugly fit around the text + padding.
   */
  const handleWrapAroundText = useCallback(() => {
    if (!currentArtworkId || !textContent?.trim()) return

    const exhibitionArtwork = exhibitionArtworksById[currentArtworkId]
    if (!exhibitionArtwork) return

    const padding = textPadding?.value ?? 0
    const fSize = fontSize?.value ?? 16
    const lHeight = lineHeight?.value ?? 1
    const lSpacing = letterSpacing?.value ?? 0
    const fFamily = fontFamily?.value ?? 'roboto'
    const fWeight = fontWeight?.value ?? 'regular'

    // Content width = current artwork width minus padding on both sides
    const contentWidth = exhibitionArtwork.width2d - padding * 2

    // Create an off-screen measurement div with the same text styles
    // constrained to the current content width so text wraps the same way
    const measurer = document.createElement('div')
    measurer.style.position = 'absolute'
    measurer.style.top = '-9999px'
    measurer.style.left = '-9999px'
    measurer.style.visibility = 'hidden'
    measurer.style.whiteSpace = 'pre-wrap' // match the 2D content style
    measurer.style.wordWrap = 'break-word'
    measurer.style.overflowWrap = 'break-word'
    measurer.style.width = `${contentWidth}px` // constrain to current content width
    measurer.style.fontSize = `${fSize}px`
    measurer.style.lineHeight = String(lHeight)
    measurer.style.letterSpacing = `${lSpacing}px`
    measurer.style.fontFamily = fontFamilyMap[fFamily] ?? fontFamilyMap.roboto
    measurer.style.fontWeight = fWeight === 'bold' ? '600' : '400'

    // Use an inner span for tight bounding box measurement
    // (block-level scrollHeight often includes trailing line-height space)
    const span = document.createElement('span')
    span.innerText = textContent
    measurer.appendChild(span)

    document.body.appendChild(measurer)

    const measuredHeight = span.getBoundingClientRect().height

    document.body.removeChild(measurer)

    // Keep current width, only adjust height to fit text + padding
    const newHeight2d = measuredHeight + padding * 2

    // Keep artwork horizontally centered, adjust vertical center
    const oldCenterY = exhibitionArtwork.posY2d + exhibitionArtwork.height2d / 2
    const newPosY2d = oldCenterY - newHeight2d / 2

    const artworkPosition = {
      posY2d: newPosY2d,
      height2d: newHeight2d,
    }

    // Compute 3D coordinates (keep existing X and width)
    const coords3D = boundingData
      ? convert2DTo3D(exhibitionArtwork.posX2d, newPosY2d, exhibitionArtwork.width2d, newHeight2d, boundingData)
      : {}

    dispatch(pushToHistory())
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { ...artworkPosition, ...coords3D },
      }),
    )
  }, [
    currentArtworkId,
    textContent,
    exhibitionArtworksById,
    textPadding,
    fontSize,
    lineHeight,
    letterSpacing,
    fontFamily,
    fontWeight,
    boundingData,
    dispatch,
  ])

  // Hide all text styling fields if there's no text content
  if (!textContent || textContent.trim() === '') {
    return null
  }

  return (
    <>
      <div className={styles.section}>
        <div className={styles.subsection}>
          <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
            Text Align
          </Text>
          <div className={styles.row}>
            <div className={styles.item}>
              <Button
                size="small"
                variant="secondary"
                icon="textLeft"
                onClick={() => handleEditArtworkText('textAlign', 'left')}
              />
            </div>
            <div className={styles.item}>
              <Button
                size="small"
                variant="secondary"
                icon="textCenter"
                onClick={() => handleEditArtworkText('textAlign', 'center')}
              />
            </div>
            <div className={styles.item}>
              <Button
                size="small"
                variant="secondary"
                icon="textRight"
                onClick={() => handleEditArtworkText('textAlign', 'right')}
              />
            </div>
            <div className={styles.item}>
              <Button
                size="small"
                variant="secondary"
                icon="textJustify"
                onClick={() => handleEditArtworkText('textAlign', 'justify')}
              />
            </div>
          </div>
          <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
            Vertical Align
          </Text>
          <div className={styles.row}>
            <div className={styles.item}>
              <Button
                size="small"
                variant="secondary"
                icon="textVerticalTop"
                onClick={() => handleEditArtworkText('textVerticalAlign', 'top')}
              />
            </div>
            <div className={styles.item}>
              <Button
                size="small"
                variant="secondary"
                icon="textVerticalCenter"
                onClick={() => handleEditArtworkText('textVerticalAlign', 'center')}
              />
            </div>
            <div className={styles.item}>
              <Button
                size="small"
                variant="secondary"
                icon="textVerticalBottom"
                onClick={() => handleEditArtworkText('textVerticalAlign', 'bottom')}
              />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Button
              font="dashboard"
              fullWidth
              variant="secondary"
              label="Wrap around text"
              onClick={handleWrapAroundText}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <PresetSection presetType="text" />
      </div>

      <div className={styles.section}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Size (cm)
            </Text>
            <Select<number>
              options={fontSizes}
              value={fontSize?.value}
              onChange={(val) =>
                handleEditArtworkText('fontSize', { label: String(val), value: val })
              }
            />
          </div>

          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Line height
            </Text>

            <Select<number>
              options={lineHeights}
              value={lineHeight?.value}
              onChange={(val) =>
                handleEditArtworkText('lineHeight', { label: String(val), value: val })
              }
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Font Weight
            </Text>
            <Select<TFontWeight>
              options={fontWeights}
              value={fontWeight?.value}
              onChange={(val) => handleEditArtworkText('fontWeight', { label: val, value: val })}
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Letter Spacing
            </Text>
            <Select<number>
              options={letterSpacings}
              value={letterSpacing?.value}
              onChange={(val) =>
                handleEditArtworkText('letterSpacing', { label: String(val), value: val })
              }
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Font Family
            </Text>
            <Select<TFontFamily>
              options={fontFamilies}
              value={fontFamily?.value}
              onChange={(val) => handleEditArtworkText('fontFamily', { label: val, value: val })}
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Padding
            </Text>
            <Select<number>
              options={textPaddings}
              value={textPadding?.value ?? 0}
              onChange={(val) =>
                handleEditArtworkText('textPadding', { label: String(val), value: val })
              }
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Text Color
            </Text>
            <ColorPicker
              textColor={textColor!}
              onColorSelect={(value) => handleEditArtworkText('textColor', value)}
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Background
            </Text>
            <div className={styles.backgroundColorRow}>
              <ColorPicker
                textColor={textBackgroundColor ?? '#ffffff'}
                onColorSelect={(value) => handleEditArtworkText('textBackgroundColor', value)}
              />
              <Button
                size="small"
                variant={textBackgroundColor === undefined ? 'primary' : 'secondary'}
                label="None"
                onClick={() => {
                  handleEditArtworkText('textBackgroundColor', undefined)
                  handleEditArtworkText('textThickness', { label: '0', value: 0 })
                }}
              />
            </div>
          </div>
        </div>
        {textBackgroundColor !== undefined && (
          <div className={styles.row}>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>
                Thickness (cm)
              </Text>
              <Select<number>
                options={textThicknessOptions}
                value={textThickness?.value}
                onChange={(val) =>
                  handleEditArtworkText('textThickness', {
                    label: String(val),
                    value: val,
                  })
                }
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default ArtisticText
