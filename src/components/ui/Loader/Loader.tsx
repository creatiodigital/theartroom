'use client'

import { useEffect, useState } from 'react'
import { Html, useProgress } from '@react-three/drei'
import { Text } from '@/components/ui/Typography'

import styles from './Loader.module.scss'

/**
 * The scene's Suspense fallback: the loading bar and percentage.
 *
 * It does not read drei's `useProgress` with the hook. That store is written by THREE's loading
 * manager, and `useLoader` (useKTX2, useGLTF, useTexture) starts a download INSIDE the render of
 * the component that suspends on it; when nothing else is loading, the manager's `onStart` fires
 * right there, so a hook subscriber re-renders mid-render of another component: React's "Cannot
 * update a component (`Loader`) while rendering a different component (`MadridSpace`)". Paris,
 * Vienna and Madrid load their KTX2 textures that way, one after the other (they cannot be
 * preloaded: see MadridSpace). So the Loader subscribes itself and shows each value on the next
 * frame, outside any render.
 */
const Loader = () => {
  const [progress, setProgress] = useState(() => useProgress.getState().progress)

  useEffect(() => {
    let frame = 0
    const show = (next: number) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setProgress(next))
    }
    // What changed between the first render and this subscription.
    show(useProgress.getState().progress)
    const unsubscribe = useProgress.subscribe((state) => show(state.progress))
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [])

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
