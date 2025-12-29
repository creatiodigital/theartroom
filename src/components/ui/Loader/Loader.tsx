'use client'

import { Html, useProgress } from '@react-three/drei'

import styles from './Loader.module.scss'

const Loader = () => {
  const { progress } = useProgress()

  return (
    <Html center>
      <div className={styles.loader}>
        <div className={styles.progressContainer}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.percentage}>{Math.round(progress)}%</span>
      </div>
    </Html>
  )
}

export default Loader
