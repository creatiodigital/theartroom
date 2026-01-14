'use client'

import { useSelector } from 'react-redux'

import { Checkbox } from '@/components/ui/Checkbox'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkImageHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkImageHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

import { frameThicknessOptions, passepartoutThicknessOptions } from './constants'

const ArtisticImage = () => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    showFrame,
    showArtworkInformation,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutThickness,
    frameColor,
    frameThickness,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditArtisticImage } = useArtworkImageHandlers(currentArtworkId!)

  if (!imageUrl) return null

  return (
    <>
      <div className={styles.section}>
        <Checkbox
          checked={showArtworkInformation!}
          onChange={(e) => handleEditArtisticImage('showArtworkInformation', e.target.checked)}
          label="Display Information"
        />
      </div>

      <div className={styles.section}>
        <Checkbox
          checked={showFrame!}
          onChange={(e) => handleEditArtisticImage('showFrame', e.target.checked)}
          label="Add Frame"
        />
        {showFrame && (
          <div className={styles.row}>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>Color</Text>
              <ColorPicker
                textColor={frameColor!}
                onColorSelect={(value) => handleEditArtisticImage('frameColor', value)}
              />
            </div>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>Thickness</Text>
              <Select<number>
                options={frameThicknessOptions}
                value={frameThickness?.value}
                onChange={(val) =>
                  handleEditArtisticImage('frameThickness', {
                    label: String(val),
                    value: val,
                  })
                }
              />
            </div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <Checkbox
          checked={showPassepartout!}
          onChange={(e) => handleEditArtisticImage('showPassepartout', e.target.checked)}
          label="Add Passepartout"
        />
        {showPassepartout && (
          <div className={styles.row}>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>Color</Text>
              <ColorPicker
                textColor={passepartoutColor!}
                onColorSelect={(value) => handleEditArtisticImage('passepartoutColor', value)}
              />
            </div>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>Thickness</Text>
              <Select<number>
                options={passepartoutThicknessOptions}
                value={passepartoutThickness?.value}
                onChange={(val) =>
                  handleEditArtisticImage('passepartoutThickness', {
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

export default ArtisticImage
