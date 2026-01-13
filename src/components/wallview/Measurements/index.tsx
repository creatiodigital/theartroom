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
    <Text font="dashboard" as="span" size="lg" className={styles.width}>{`${width} m`}</Text>
    <Text font="dashboard" as="span" size="lg" className={styles.height}>{`${height} m`}</Text>
  </>
))

Measurements.displayName = 'Measurements'

export { Measurements }
export default Measurements
