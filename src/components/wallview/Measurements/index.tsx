'use client'

import { memo } from 'react'
import { Text } from '@/components/ui/Typography'

import styles from './Measurements.module.scss'

type MeasurementsProps = {
  width: string
  height: string
}

const Measurements = memo(({ width, height }: MeasurementsProps) => (
  <>
    <Text as="span" size="lg" className={styles.width}>{`${width} m`}</Text>
    <Text as="span" size="lg" className={styles.height}>{`${height} m`}</Text>
  </>
))

Measurements.displayName = 'Measurements'

export default Measurements
