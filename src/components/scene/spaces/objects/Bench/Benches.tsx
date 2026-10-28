'use client'

import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import { useSelector } from 'react-redux'
import type { Vector3 } from 'three'

import type { RootState } from '@/redux/store'

import {
  BENCHES_PER_ROOM,
  benchIndex,
  benchModelOf,
  benchModelUrl,
  benchStart,
  isBenchEnabled,
  useBenchRooms,
  type BenchSettings,
} from './benchSettings'

const Bench = ({
  index,
  settings,
  start,
}: {
  index: number
  settings: BenchSettings
  start: Vector3
}) => {
  const { scene } = useGLTF(benchModelUrl(benchModelOf(settings)))
  // A clone per bench: the cached scene can only sit in one place at a time.
  // Geometry and materials stay shared with the cache.
  const bench = useMemo(() => scene.clone(true), [scene])

  return (
    <primitive
      object={bench}
      name={`bench${index}`}
      position={[start.x + (settings.x ?? 0), start.y, start.z + (settings.z ?? 0)]}
      rotation={[0, ((settings.rotationY ?? 0) * Math.PI) / 180, 0]}
    />
  )
}

/** Every bench the exhibition has switched on, in every room of the space. */
const Benches = () => {
  const benchSettings = useSelector((state: RootState) => state.exhibition.benchSettings)
  const { rooms } = useBenchRooms()

  if (!benchSettings) return null

  return (
    <>
      {rooms.flatMap(({ room, centre }) =>
        Array.from({ length: BENCHES_PER_ROOM }, (_, slot) => {
          const index = benchIndex(room, slot)
          const settings = benchSettings[String(index)]
          if (!settings || !isBenchEnabled(settings)) return null
          return (
            // Per bench, so a model still loading never hides the others.
            <Suspense key={index} fallback={null}>
              <Bench index={index} settings={settings} start={benchStart(centre, slot)} />
            </Suspense>
          )
        }),
      )}
    </>
  )
}

export default Benches
