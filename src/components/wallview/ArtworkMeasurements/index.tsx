'use client'

import { memo } from 'react'
import { Text } from '@/components/ui/Typography'

import styles from './ArtworkMeasurements.module.scss'

type ArtworkMeasurementsProps = {
  width2d: number
  height2d: number
}

const ArtworkMeasurements = memo(({ width2d, height2d }: ArtworkMeasurementsProps) => {
  // Convert from 2D scale to meters (same as right panel: value / 100)
  const widthMeters = (width2d / 100).toFixed(2)
  const heightMeters = (height2d / 100).toFixed(2)

  return (
    <>
      <Text font="dashboard" as="span" size="sm" className={styles.width}>
        {`${widthMeters} m`}
      </Text>
      <Text font="dashboard" as="span" size="sm" className={styles.height}>
        {`${heightMeters} m`}
      </Text>
    </>
  )
})

ArtworkMeasurements.displayName = 'ArtworkMeasurements'

export { ArtworkMeasurements }
export default ArtworkMeasurements
