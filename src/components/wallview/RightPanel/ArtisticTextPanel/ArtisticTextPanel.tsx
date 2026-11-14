'use client'

import { useGLTF } from '@react-three/drei'
import { useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Mesh } from 'three'
import {
  AlignBottomSimple,
  AlignCenterVerticalSimple,
  AlignTopSimple,
  TextAlignCenter,
  TextAlignJustify,
  TextAlignLeft,
  TextAlignRight,
} from '@phosphor-icons/react'

import { SwitchRow } from '@/components/editorChrome'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { DistanceBox, PanelGroup, SegmentStrip, SelectField } from '@/components/wallview/chrome'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import {
  comfortableHeight,
  measureWallText,
  type WallTextStyle,
} from '@/components/wallview/textFit'
import { convert2DTo3D } from '@/components/wallview/utils'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkTextHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkTextHandlers'
import PresetSection from '@/components/wallview/RightPanel/PresetSection/PresetSection'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TFontFamily, TFontWeight } from '@/types/fonts'
import { FONT_FAMILY_WEIGHTS } from '@/types/fonts'

import {
  fontSizes,
  lineHeights,
  fontFamilies,
  fontWeights,
  letterSpacings,
  textPaddings,
  textThicknessOptions,
} from './constants'
import { spaceGltfUrl } from '@/components/scene/spaceAsset'

// Today's text-align values, named and drawn as in designs/wall-view-panels.dc.html.
const TEXT_ALIGNS = [
  { value: 'left', label: 'Align left', icon: TextAlignLeft },
  { value: 'center', label: 'Center', icon: TextAlignCenter },
  { value: 'right', label: 'Align right', icon: TextAlignRight },
  { value: 'justify', label: 'Justify', icon: TextAlignJustify },
] as const

const VERTICAL_ALIGNS = [
  { value: 'top', label: 'Top', icon: AlignTopSimple },
  { value: 'center', label: 'Middle', icon: AlignCenterVerticalSimple },
  { value: 'bottom', label: 'Bottom', icon: AlignBottomSimple },
] as const

// The Style select's words in sentence case (constants.ts keeps its own; the value is what saves).
const STYLE_LABELS: Record<string, string> = {
  regular: 'Regular',
  italic: 'Regular italic',
  bold: 'Bold',
  'bold-italic': 'Bold italic',
}

const ArtisticText = ({
  disabled,
  part = 'look',
}: {
  disabled?: boolean
  /**
   * look: the Look tab's groups; fit: only "Fit box to text", which the Layout tab shows under
   * Size (wallview.md §3). Both read and handle exactly as before.
   */
  part?: 'look' | 'fit'
}) => {
  const dispatch = useDispatch()
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const { handleEditArtworkText } = useArtworkTextHandlers(currentArtworkId || '')

  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  // Display only: the pressed alignment segments (the factory's defaults: 'left', 'top').
  const textAlign = useSelector((state: RootState) =>
    currentArtworkId ? state.artworks.byId[currentArtworkId]?.textAlign : undefined,
  )
  const textVerticalAlign = useSelector((state: RootState) =>
    currentArtworkId ? state.artworks.byId[currentArtworkId]?.textVerticalAlign : undefined,
  )

  // Bounding data for 2D→3D coordinate conversion
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const gltfPath = spaceGltfUrl(getSpaceConfig(spaceId || 'paris').gltfPath)
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
    textPaddingTop,
    textPaddingBottom,
    textPaddingLeft,
    textPaddingRight,
    textThickness,
    textBackgroundTexture,
    showTextBorder,
    textBorderColor,
    textBorderOffset,
    showMonogram,
    monogramColor,
    monogramOpacity,
    monogramPosition,
    monogramOffset,
    monogramSize,
  } = useArtworkDetails(currentArtworkId!)

  // AR-182: the text's second-language version (fitted too, whatever the exhibition's language).
  const secondText = useSelector((state: RootState) =>
    currentArtworkId ? state.artworks.byId[currentArtworkId]?.textContentSecond : undefined,
  )

  // Filter font weight options based on selected family's supported variants
  const filteredWeights = useMemo(() => {
    const family = (fontFamily?.value ?? 'roboto') as TFontFamily
    const supported = FONT_FAMILY_WEIGHTS[family] ?? FONT_FAMILY_WEIGHTS.roboto
    return fontWeights.filter((w) => supported.includes(w.value))
  }, [fontFamily?.value])

  /**
   * Measure the text's natural (unconstrained) dimensions using an off-screen
   * element styled identically to the 2D ArtisticText content div, then resize
   * the artwork frame to snugly fit around the text + padding.
   */
  const handleWrapAroundText = useCallback(() => {
    if (!currentArtworkId || !textContent?.trim()) return

    const exhibitionArtwork = exhibitionArtworksById[currentArtworkId]
    if (!exhibitionArtwork) return

    // AR-182: measured as the wall lays the text out (textFit: its font, size, line height,
    // letter spacing and its own left and right spacing), the box fitting the longer of the
    // English text and its second-language version with their top and bottom spacing. It used a
    // single legacy padding, so the text wrapped at another width than the wall shows.
    const style: WallTextStyle = {
      fontSize: fontSize?.value ?? 16,
      lineHeight: lineHeight?.value ?? 1,
      letterSpacing: letterSpacing?.value ?? 0,
      fontFamily: fontFamily?.value ?? 'roboto',
      fontWeight: fontWeight?.value ?? 'regular',
      padTop: textPaddingTop?.value ?? 0,
      padBottom: textPaddingBottom?.value ?? 0,
      padLeft: textPaddingLeft?.value ?? 0,
      padRight: textPaddingRight?.value ?? 0,
    }
    const heights = [textContent, secondText]
      .filter((text): text is string => !!text?.trim())
      .map((text) => measureWallText(text, style, exhibitionArtwork.width2d))
      .filter((height): height is number => height !== null)
    if (heights.length === 0) return

    // Keep current width, only adjust height to fit text + its top and bottom spacing
    const newHeight2d = comfortableHeight(Math.max(...heights), style)

    // Keep artwork horizontally centered, adjust vertical center
    const oldCenterY = exhibitionArtwork.posY2d + exhibitionArtwork.height2d / 2
    const newPosY2d = oldCenterY - newHeight2d / 2

    const artworkPosition = {
      posY2d: newPosY2d,
      height2d: newHeight2d,
    }

    // Compute 3D coordinates (keep existing X and width)
    const coords3D = boundingData
      ? convert2DTo3D(
          exhibitionArtwork.posX2d,
          newPosY2d,
          exhibitionArtwork.width2d,
          newHeight2d,
          boundingData,
        )
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
    secondText,
    exhibitionArtworksById,
    textPaddingTop,
    textPaddingBottom,
    textPaddingLeft,
    textPaddingRight,
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

  if (part === 'fit') {
    return (
      <Button
        variant="bare"
        font="dashboard"
        className={styles.link}
        onClick={handleWrapAroundText}
      >
        Fit box to text
      </Button>
    )
  }

  return (
    <>
      <PanelGroup title="Type" disabled={disabled}>
        <SelectField<TFontFamily>
          label="Font family"
          options={fontFamilies}
          value={fontFamily?.value}
          onChange={(val) => handleEditArtworkText('fontFamily', { label: val, value: val })}
        />
        <div className={styles.grid2}>
          <SelectField<number>
            label="Size (cm)"
            options={fontSizes}
            value={fontSize?.value}
            onChange={(val) =>
              handleEditArtworkText('fontSize', { label: String(val), value: val })
            }
          />
          <SelectField<number>
            label="Line height"
            options={lineHeights}
            value={lineHeight?.value}
            onChange={(val) =>
              handleEditArtworkText('lineHeight', { label: String(val), value: val })
            }
          />
          <SelectField<TFontWeight>
            label="Style"
            options={filteredWeights.map((w) => ({
              value: w.value,
              label: STYLE_LABELS[w.value] ?? w.label,
            }))}
            value={fontWeight?.value}
            onChange={(val) => handleEditArtworkText('fontWeight', { label: val, value: val })}
          />
          <SelectField<number>
            label="Letter spacing"
            options={letterSpacings}
            value={letterSpacing?.value}
            onChange={(val) =>
              handleEditArtworkText('letterSpacing', { label: String(val), value: val })
            }
          />
        </div>
      </PanelGroup>

      <PanelGroup title="Alignment" disabled={disabled}>
        <div className={styles.alignRow}>
          <SegmentStrip
            label="Text align"
            segments={TEXT_ALIGNS.map(({ value, label, icon }) => ({
              key: value,
              label,
              icon,
              pressed: (textAlign ?? 'left') === value,
              onClick: () => handleEditArtworkText('textAlign', value),
            }))}
          />
          <SegmentStrip
            label="Vertical align"
            segments={VERTICAL_ALIGNS.map(({ value, label, icon }) => ({
              key: value,
              label,
              icon,
              pressed: (textVerticalAlign ?? 'top') === value,
              onClick: () => handleEditArtworkText('textVerticalAlign', value),
            }))}
          />
        </div>
      </PanelGroup>

      <PanelGroup title="Colors" disabled={disabled}>
        <div className={styles.grid2}>
          <ColorPicker
            variant="field"
            name="Text"
            textColor={textColor!}
            onColorSelect={(value) => handleEditArtworkText('textColor', value)}
          />
          <div className={styles.colorWithNone}>
            <ColorPicker
              variant="field"
              name="Background"
              textColor={textBackgroundColor ?? '#ffffff'}
              onColorSelect={(value) => handleEditArtworkText('textBackgroundColor', value)}
              emptyLabel={textBackgroundColor === undefined ? 'None' : undefined}
            />
            <Button
              variant="bare"
              font="dashboard"
              className={styles.link}
              aria-pressed={textBackgroundColor === undefined}
              aria-label="Background: none"
              onClick={() => {
                handleEditArtworkText('textBackgroundColor', undefined)
                handleEditArtworkText('textThickness', { label: '0', value: 0 })
              }}
            >
              None
            </Button>
          </div>
        </div>
        {textBackgroundColor !== undefined && (
          <SelectField<number>
            label="Thickness (cm)"
            options={textThicknessOptions}
            value={textThickness?.value}
            onChange={(val) =>
              handleEditArtworkText('textThickness', {
                label: String(val),
                value: val,
              })
            }
          />
        )}
      </PanelGroup>

      <PanelGroup title="Inner spacing" disabled={disabled}>
        <DistanceBox
          label="Inner spacing"
          itemLabel="text"
          top={
            <SelectField<number>
              label="Inner spacing, top"
              hideLabel
              options={textPaddings}
              value={textPaddingTop?.value ?? 0}
              onChange={(val) =>
                handleEditArtworkText('textPaddingTop', { label: String(val), value: val })
              }
            />
          }
          bottom={
            <SelectField<number>
              label="Inner spacing, bottom"
              hideLabel
              options={textPaddings}
              value={textPaddingBottom?.value ?? 0}
              onChange={(val) =>
                handleEditArtworkText('textPaddingBottom', { label: String(val), value: val })
              }
            />
          }
          left={
            <SelectField<number>
              label="Inner spacing, left"
              hideLabel
              options={textPaddings}
              value={textPaddingLeft?.value ?? 0}
              onChange={(val) =>
                handleEditArtworkText('textPaddingLeft', { label: String(val), value: val })
              }
            />
          }
          right={
            <SelectField<number>
              label="Inner spacing, right"
              hideLabel
              options={textPaddings}
              value={textPaddingRight?.value ?? 0}
              onChange={(val) =>
                handleEditArtworkText('textPaddingRight', { label: String(val), value: val })
              }
            />
          }
        />
      </PanelGroup>

      <PanelGroup title="Extras" disabled={disabled}>
        <SwitchRow
          title="Paper texture"
          checked={!!textBackgroundTexture}
          onChange={(e) => {
            handleEditArtworkText('textBackgroundTexture', e.target.checked ? 'paper' : undefined)
          }}
        />
        {textBackgroundTexture && (
          <div className={styles.extraOptions}>
            <SelectField<string>
              label="Texture"
              options={[{ label: 'Plain paper', value: 'paper' }]}
              value={textBackgroundTexture}
              onChange={(val) => handleEditArtworkText('textBackgroundTexture', val)}
            />
          </div>
        )}

        <SwitchRow
          title="Border"
          checked={!!showTextBorder}
          onChange={(e) => handleEditArtworkText('showTextBorder', e.target.checked)}
        />
        {showTextBorder && (
          <div className={styles.extraOptions}>
            <ColorPicker
              variant="inline"
              name="Border color"
              textColor={textBorderColor ?? '#c9a96e'}
              onColorSelect={(value) => handleEditArtworkText('textBorderColor', value)}
            />
            <SelectField<number>
              label="Border offset (cm)"
              options={Array.from({ length: 36 }, (_, i) => {
                const val = Number((0.5 + i * 0.1).toFixed(1))
                return { label: String(val), value: val }
              })}
              value={textBorderOffset?.value ?? 1.2}
              onChange={(val) =>
                handleEditArtworkText('textBorderOffset', {
                  label: String(val),
                  value: val,
                })
              }
            />
          </div>
        )}

        <SwitchRow
          title="Monogram"
          checked={!!showMonogram}
          onChange={(e) => handleEditArtworkText('showMonogram', e.target.checked)}
        />
        {showMonogram && (
          <div className={styles.extraOptions}>
            <ColorPicker
              variant="inline"
              name="Color"
              aria-label="Monogram color"
              textColor={monogramColor ?? '#c0392b'}
              onColorSelect={(value) => handleEditArtworkText('monogramColor', value)}
            />
            <div className={styles.grid2}>
              <SelectField<number>
                label="Opacity"
                options={[
                  { label: '10%', value: 0.1 },
                  { label: '20%', value: 0.2 },
                  { label: '30%', value: 0.3 },
                  { label: '40%', value: 0.4 },
                  { label: '50%', value: 0.5 },
                  { label: '60%', value: 0.6 },
                  { label: '70%', value: 0.7 },
                  { label: '80%', value: 0.8 },
                  { label: '90%', value: 0.9 },
                  { label: '100%', value: 1.0 },
                ]}
                value={monogramOpacity?.value ?? 1.0}
                onChange={(val) =>
                  handleEditArtworkText('monogramOpacity', {
                    label: String(val),
                    value: val,
                  })
                }
              />
              <SelectField<string>
                label="Position"
                options={[
                  { label: 'Top center', value: 'top' },
                  { label: 'Bottom center', value: 'bottom' },
                ]}
                value={monogramPosition ?? 'bottom'}
                onChange={(val) =>
                  handleEditArtworkText('monogramPosition', val as 'top' | 'bottom')
                }
              />
              <SelectField<number>
                label="Offset (cm)"
                options={[
                  { label: '0', value: 0 },
                  { label: '1', value: 1 },
                  { label: '2', value: 2 },
                  { label: '3', value: 3 },
                  { label: '4', value: 4 },
                ]}
                value={monogramOffset?.value ?? 2}
                onChange={(val) =>
                  handleEditArtworkText('monogramOffset', {
                    label: String(val),
                    value: val,
                  })
                }
              />
              <SelectField<number>
                label="Size (cm)"
                ariaLabel="Monogram size (cm)"
                options={[
                  { label: '1', value: 1 },
                  { label: '1.5', value: 1.5 },
                  { label: '2', value: 2 },
                  { label: '2.5', value: 2.5 },
                  { label: '3', value: 3 },
                  { label: '3.5', value: 3.5 },
                  { label: '4', value: 4 },
                  { label: '4.5', value: 4.5 },
                  { label: '5', value: 5 },
                  { label: '6', value: 6 },
                  { label: '7', value: 7 },
                  { label: '8', value: 8 },
                  { label: '9', value: 9 },
                  { label: '10', value: 10 },
                ]}
                value={monogramSize?.value ?? 4}
                onChange={(val) =>
                  handleEditArtworkText('monogramSize', {
                    label: String(val),
                    value: val,
                  })
                }
              />
            </div>
          </div>
        )}
      </PanelGroup>

      <PanelGroup title="Preset" disabled={disabled}>
        <PresetSection presetType="text" />
      </PanelGroup>
    </>
  )
}

export default ArtisticText
