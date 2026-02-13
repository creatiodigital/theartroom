'use client'

import { memo } from 'react'
import { Text } from '@/components/ui/Typography'

import styles from './Measurements.module.scss'

type MeasurementsProps = {
  width: string
  height: string
  floorOffset?: number // Floor offset in meters
}

const Measurements = memo(({ width, height, floorOffset = 0 }: MeasurementsProps) => {
  // Calculate total height from floor to top of wall
  const totalHeight = (parseFloat(height) + floorOffset).toFixed(2)

  return (
    <>
      <Text font="dashboard" as="span" size="lg" className={styles.width}>{`${width} m`}</Text>
      <Text
        font="dashboard"
        as="span"
        size="lg"
        className={styles.height}
        style={
          floorOffset > 0
            ? {
                top: `calc(50% + ${(floorOffset * 100) / 2}px)`, // Shift down by half the offset to stay centered on total height
              }
            : undefined
        }
      >{`${totalHeight} m`}</Text>
    </>
  )
})

Measurements.displayName = 'Measurements'

export { Measurements }
export default Measurements
