'use client'

import { useSelector } from 'react-redux'

import { Checkbox } from '@/components/ui/Checkbox'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { Tooltip } from '@/components/ui/Tooltip'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkImageHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkImageHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

import { frameSizeOptions, frameThicknessOptions, passepartoutSizeOptions, passepartoutThicknessOptions } from './constants'

const ArtisticImage = () => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    showFrame,
    showArtworkInformation,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    passepartoutThickness,
    frameColor,
    frameSize,
    frameThickness,
    hiddenFromExhibition,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditArtisticImage } = useArtworkImageHandlers(currentArtworkId!)

  if (!imageUrl) return null

  return (
    <>
      {/* DISPLAY Section */}
      <div className={styles.section}>
        
        <Tooltip
          label="When enabled, visitors can double-click this artwork in the 3D exhibition to view its details"
          placement="left"
        >
          <Checkbox
            checked={showArtworkInformation!}
            onChange={(e) => handleEditArtisticImage('showArtworkInformation', e.target.checked)}
            label="Show information in exhibition"
          />
        </Tooltip>

        <Tooltip
          label="When enabled, this artwork won't appear in the exhibition's artwork grid on the public page"
          placement="left"
        >
          <Checkbox
            checked={hiddenFromExhibition ?? false}
            onChange={(e) => handleEditArtisticImage('hiddenFromExhibition', e.target.checked)}
            label="Hide in exhibition page"
          />
        </Tooltip>
      </div>

      {/* FRAME Section */}
      <div className={styles.section}>
        
        <Tooltip
          label="Add a picture frame around this artwork, visible in the 3D exhibition"
          placement="left"
        >
          <Checkbox
            checked={showFrame!}
            onChange={(e) => handleEditArtisticImage('showFrame', e.target.checked)}
            label="Add Frame"
          />
        </Tooltip>
        {showFrame && (
          <div className={styles.controlGroup}>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>Frame color</Text>
                <ColorPicker
                  textColor={frameColor!}
                  onColorSelect={(value) => handleEditArtisticImage('frameColor', value)}
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>Size (cm)</Text>
                <Select<number>
                  options={frameSizeOptions}
                  value={frameSize?.value}
                  onChange={(val) =>
                    handleEditArtisticImage('frameSize', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>Thickness (cm)</Text>
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
          </div>
        )}
      </div>

      {/* PASSEPARTOUT Section */}
      <div className={styles.section}>
        
        <Tooltip
          label="Add a mat border between the artwork and frame, like traditional gallery framing"
          placement="left"
        >
          <Checkbox
            checked={showPassepartout!}
            onChange={(e) => handleEditArtisticImage('showPassepartout', e.target.checked)}
            label="Add Passepartout"
          />
        </Tooltip>
        {showPassepartout && (
          <div className={styles.controlGroup}>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>Passepartout color</Text>
                <ColorPicker
                  textColor={passepartoutColor!}
                  onColorSelect={(value) => handleEditArtisticImage('passepartoutColor', value)}
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>Size (cm)</Text>
                <Select<number>
                  options={passepartoutSizeOptions}
                  value={passepartoutSize?.value}
                  onChange={(val) =>
                    handleEditArtisticImage('passepartoutSize', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>Thickness (cm)</Text>
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
          </div>
        )}
      </div>
    </>
  )
}

export default ArtisticImage
