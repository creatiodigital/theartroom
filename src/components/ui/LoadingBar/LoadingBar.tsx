'use client'

import styles from './LoadingBar.module.scss'

export const LoadingBar = () => {
  return (
    <div className={styles.container}>
      <div className={styles.bar} />
    </div>
  )
}
