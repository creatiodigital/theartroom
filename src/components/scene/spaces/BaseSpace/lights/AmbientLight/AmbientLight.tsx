'use client'

import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

// Default values for BaseSpace
const DEFAULT_COLOR = '#e4e8f2'
const DEFAULT_INTENSITY = 1.5

const AmbientLight = () => {
  const ambientColor =
    useSelector((state: RootState) => state.exhibition.ambientLightColor) ?? DEFAULT_COLOR

  const ambientIntensity =
    useSelector((state: RootState) => state.exhibition.ambientLightIntensity) ?? DEFAULT_INTENSITY

  return <ambientLight intensity={ambientIntensity} color={ambientColor} />
}

export default AmbientLight
