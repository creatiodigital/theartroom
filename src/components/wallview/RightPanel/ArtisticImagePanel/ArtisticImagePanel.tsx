'use client'

import { useSelector } from 'react-redux'

import { Checkbox } from '@/components/ui/Checkbox'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Text } from '@/components/ui/Typography'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkImageHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkImageHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

import { frameThicknessOptions, passepartoutThicknessOptions } from './constants'

const ArtisticImage = () => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    artworkTitle,
    description,
    author,
    artworkYear,
    artworkDimensions,
    showFrame,
    showArtworkInformation,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutThickness,
    frameColor,
    frameThickness,
    featured,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditArtwork, handleEditArtisticImage } = useArtworkImageHandlers(currentArtworkId!)

  return (
    <>
      {imageUrl && (
        <>
          <div className={styles.subsection}>
            <div className={styles.row}>
              <div className={styles.item}>
                <Checkbox
                  checked={showArtworkInformation!}
                  onChange={(e) =>
                    handleEditArtisticImage('showArtworkInformation', e.target.checked)
                  }
                  label="Display Information"
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.item}>
                <Checkbox
                  checked={featured ?? false}
                  onChange={(e) =>
                    handleEditArtwork('featured', e.target.checked)
                  }
                  label="Feature on artist profile"
                />
              </div>
            </div>
          </div>

          {showArtworkInformation && (
            <div className={styles.section}>
              <div className={styles.subsection}>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <Text as="span" size="xs" className={styles.label}>Author</Text>
                    <Input
                      id="artworkAuthor"
                      value={author || ''}
                      onChange={(e) => handleEditArtwork('author', e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <Text as="span" size="xs" className={styles.label}>Title</Text>
                    <Input
                      id="artworkTitle"
                      value={artworkTitle || ''}
                      onChange={(e) => handleEditArtwork('artworkTitle', e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <Text as="span" size="xs" className={styles.label}>Year</Text>
                    <Input
                      id="artworkYear"
                      value={artworkYear || ''}
                      onChange={(e) => handleEditArtwork('artworkYear', e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <Text as="span" size="xs" className={styles.label}>Description</Text>
                    <Textarea
                      value={description || ''}
                      onChange={(e) => handleEditArtwork('description', e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <Text as="span" size="xs" className={styles.label}>Dimensions</Text>
                    <Input
                      id="artworkDimensions"
                      value={artworkDimensions || ''}
                      onChange={(e) => handleEditArtwork('artworkDimensions', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.section}>
            <Text as="h3" font="sans" className={styles.title}>
              Features
            </Text>

            <div className={styles.subsection}>
              <div className={styles.row}>
                <div className={styles.item}>
                  <Checkbox
                    checked={showFrame!}
                    onChange={(e) => handleEditArtisticImage('showFrame', e.target.checked)}
                    label="Add Frame"
                  />
                </div>
              </div>

              {showFrame && (
                <div className={styles.row}>
                  <div className={styles.item}>
                    <Text as="span" size="xs" className={styles.label}>Color</Text>
                    <ColorPicker
                      textColor={frameColor!}
                      onColorSelect={(value) => handleEditArtisticImage('frameColor', value)}
                    />
                  </div>
                  <div className={styles.item}>
                    <Text as="span" size="xs" className={styles.label}>Thickness</Text>
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

            <div className={styles.subsection}>
              <div className={styles.row}>
                <div className={styles.item}>
                  <Checkbox
                    checked={showPassepartout!}
                    onChange={(e) => handleEditArtisticImage('showPassepartout', e.target.checked)}
                    label="Add Passepartout"
                  />
                </div>
              </div>

              {showPassepartout && (
                <div className={styles.row}>
                  <div className={styles.item}>
                    <Text as="span" size="xs" className={styles.label}>Color</Text>
                    <ColorPicker
                      textColor={passepartoutColor!}
                      onColorSelect={(value) => handleEditArtisticImage('passepartoutColor', value)}
                    />
                  </div>
                  <div className={styles.item}>
                    <Text as="span" size="xs" className={styles.label}>Thickness</Text>
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
          </div>
        </>
      )}
    </>
  )
}

export default ArtisticImage
