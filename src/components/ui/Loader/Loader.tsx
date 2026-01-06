'use client'

import { Html, useProgress } from '@react-three/drei'
import { Text } from '@/components/ui/Typography'

import styles from './Loader.module.scss'

const Loader = () => {
  const { progress } = useProgress()

  return (
    <Html center>
      <div className={styles.loader}>
        <div className={styles.progressContainer}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>
        <Text as="span" size="xs" className={styles.percentage}>
          {Math.round(progress)}%
        </Text>
      </div>
    </Html>
  )
}

export default Loader
