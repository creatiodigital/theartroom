'use client'

import { useSelector } from 'react-redux'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkTextHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkTextHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'
import type { TFontFamily, TFontWeight } from '@/types/fonts'

import { fontSizes, lineHeights, fontFamilies, fontWeights, letterSpacings } from './constants'

const ArtisticText = () => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const { handleEditArtworkText } = useArtworkTextHandlers(currentArtworkId || '')

  const { textColor, fontSize, lineHeight, fontWeight, letterSpacing, fontFamily } =
    useArtworkDetails(currentArtworkId!)

  return (
    <div className={styles.section}>
      <Text font="dashboard" as="h3" className={styles.title}>
        Text Styles
      </Text>
      <div className={styles.subsection}>
        <Text font="dashboard" as="h4" className={styles.subtitle}>
          Alignment
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              icon="textLeft"
              onClick={() => handleEditArtworkText('textAlign', 'left')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              icon="textCenter"
              onClick={() => handleEditArtworkText('textAlign', 'center')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              icon="textRight"
              onClick={() => handleEditArtworkText('textAlign', 'right')}
            />
          </div>
        </div>
      </div>

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
        </div>
      </div>
      <div className={styles.subsection}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>Color</Text>
            <ColorPicker
              textColor={textColor!}
              onColorSelect={(value) => handleEditArtworkText('textColor', value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArtisticText
