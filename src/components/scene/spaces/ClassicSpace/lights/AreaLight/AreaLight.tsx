'use client'

import { useRef, useEffect } from 'react'
import { RectAreaLight } from 'three'

const AreaLight: React.FC = () => {
  const rectAreaLightRef = useRef<RectAreaLight | null>(null)

  useEffect(() => {
    const light = rectAreaLightRef.current
    if (!light) return

    light.rotation.y = Math.PI
  }, [])

  return (
    <rectAreaLight
      ref={rectAreaLightRef}
      width={3}
      height={10}
      intensity={4}
      color="#ffffff"
      position={[-5.5, 6, -6.5]}
    />
  )
}

export default AreaLight
