'use client'

import { useSelector } from 'react-redux'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkTextHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkTextHandlers'
import PresetSection from '@/components/wallview/RightPanel/PresetSection/PresetSection'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'
import type { TFontFamily, TFontWeight } from '@/types/fonts'

import { fontSizes, lineHeights, fontFamilies, fontWeights, letterSpacings, textPaddings } from './constants'

const ArtisticText = () => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const { handleEditArtworkText } = useArtworkTextHandlers(currentArtworkId || '')

  const { textContent, textColor, textBackgroundColor, fontSize, lineHeight, fontWeight, letterSpacing, fontFamily, textPadding } =
    useArtworkDetails(currentArtworkId!)

  // Hide all text styling fields if there's no text content
  if (!textContent || textContent.trim() === '') {
    return null
  }

  return (
    <div className={styles.section}>
      <div className={styles.subsection}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Horizontal Alignment
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
        </div>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Vertical Alignment
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
      </div>

      <div className={styles.divider} />

      <PresetSection presetType="text" />

      <div className={styles.subsection}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>Font size</Text>
            <Select<number>
              options={fontSizes}
              value={fontSize?.value}
              onChange={(val) =>
                handleEditArtworkText('fontSize', { label: String(val), value: val })
              }
            />
          </div>

          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>Line height</Text>

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
            <Text font="dashboard" as="span" size="xs" className={styles.label}>Font Weight</Text>
            <Select<TFontWeight>
              options={fontWeights}
              value={fontWeight?.value}
              onChange={(val) => handleEditArtworkText('fontWeight', { label: val, value: val })}
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>Letter Spacing</Text>
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
            <Text font="dashboard" as="span" size="xs" className={styles.label}>Font Family</Text>
            <Select<TFontFamily>
              options={fontFamilies}
              value={fontFamily?.value}
              onChange={(val) => handleEditArtworkText('fontFamily', { label: val, value: val })}
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>Padding</Text>
            <Select<number>
              options={textPaddings}
              value={textPadding?.value ?? 12}
              onChange={(val) =>
                handleEditArtworkText('textPadding', { label: String(val), value: val })
              }
            />
          </div>
        </div>
      </div>
      <div className={styles.subsection}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>Text Color</Text>
            <ColorPicker
              textColor={textColor!}
              onColorSelect={(value) => handleEditArtworkText('textColor', value)}
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>Background</Text>
            <div className={styles.backgroundColorRow}>
              <ColorPicker
                textColor={textBackgroundColor ?? '#ffffff'}
                onColorSelect={(value) => handleEditArtworkText('textBackgroundColor', value)}
              />
              <Button
                size="small"
                variant={textBackgroundColor === undefined ? 'primary' : 'secondary'}
                label="None"
                onClick={() => handleEditArtworkText('textBackgroundColor', undefined)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArtisticText
