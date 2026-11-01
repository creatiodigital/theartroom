'use client'

import { useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useState } from 'react'
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

// Models whose download has started, outside render. A download first started by `useGLTF` in
// render updates the scene's <Loader /> (drei's useProgress) mid-render — React's "Cannot update
// a component (`Loader`) while rendering a different component" (see `spaceAsset.ts`). A bench
// mounts once its model is in flight, and `useGLTF` then suspends on that same cache entry.
const started = new Set<string>()

/** Every bench the exhibition has switched on, in every room of the space. */
const Benches = () => {
  const benchSettings = useSelector((state: RootState) => state.exhibition.benchSettings)
  const { rooms } = useBenchRooms()

  const shown = useMemo(
    () =>
      benchSettings
        ? rooms.flatMap(({ room, centre }) =>
            Array.from({ length: BENCHES_PER_ROOM }, (_, slot) => {
              const index = benchIndex(room, slot)
              const settings = benchSettings[String(index)]
              if (!settings || !isBenchEnabled(settings)) return []
              const url = benchModelUrl(benchModelOf(settings))
              return [{ index, settings, start: benchStart(centre, slot), url }]
            }).flat(),
          )
        : [],
    [benchSettings, rooms],
  )

  // Start each model's download here, then render the benches that use it.
  const [, setStarted] = useState(0)
  useEffect(() => {
    const fresh = [...new Set(shown.map((b) => b.url))].filter((url) => !started.has(url))
    if (!fresh.length) return
    fresh.forEach((url) => {
      useGLTF.preload(url)
      started.add(url)
    })
    setStarted((n) => n + 1)
  }, [shown])

  return (
    <>
      {shown.map(({ index, settings, start, url }) =>
        started.has(url) ? (
          // Per bench, so a model still loading never hides the others.
          <Suspense key={index} fallback={null}>
            <Bench index={index} settings={settings} start={start} />
          </Suspense>
        ) : null,
      )}
    </>
  )
}

export default Benches
