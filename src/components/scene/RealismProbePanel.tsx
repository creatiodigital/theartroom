'use client'

import { useEffect } from 'react'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

import { PROBE_FLOOR_MATERIALS } from './spaces/objects/Floor/ReflectiveFloor'
import {
  PROBE_AVAILABLE,
  PROBE_DEFAULTS,
  getEffectiveRealismProbe,
  getRealismProbe,
  setRealismProbe,
  type RealismProbeState,
} from './realismProbe'

/**
 * ⚠️ AR-161 REALISM PROBE PANEL — DEV-ONLY, THROWAWAY. DO NOT SHIP.
 *
 * lil-gui ships inside three (`examples/jsm/libs`), so this adds no dependency, and it is
 * imported dynamically so it never reaches a production chunk.
 *
 * Rendering only: it writes to the probe store, never to the exhibition. The "stored" folder
 * shows what the open exhibition has saved, read-only, so a tweak can be judged against it.
 */
export const RealismProbePanel = () => {
  const exhibition = useSelector((state: RootState) => state.exhibition)
  const stored = {
    ambientLightIntensity: exhibition.ambientLightIntensity ?? 1,
    ambientLightColor: exhibition.ambientLightColor ?? '#e4e8f2',
    wallBrightness: exhibition.wallBrightness ?? 1.8,
    trackLampIntensity: exhibition.trackLampIntensity ?? 4,
    recessedLampIntensity: exhibition.recessedLampIntensity ?? 4,
    ceilingLightMode: exhibition.ceilingLightMode ?? 'track-plafond',
    floorMaterial: exhibition.floorMaterial ?? 'concrete',
    space: exhibition.spaceId ?? 'paris',
  }
  const storedKey = JSON.stringify(stored)

  useEffect(() => {
    if (!PROBE_AVAILABLE) return
    let disposed = false
    let destroy: (() => void) | undefined

    import('three/examples/jsm/libs/lil-gui.module.min.js').then(({ GUI }) => {
      if (disposed) return
      const params: RealismProbeState = { ...getRealismProbe() }
      const gui = new GUI({ title: 'AR-161 realism probe (dev only)', width: 300 })
      gui.domElement.style.top = '72px'
      gui.domElement.style.zIndex = '1000'
      // Keep the camera still while using the panel. MainCamera already ignores mousedown and
      // wheel that start inside `[data-panel-overlay]`. Keys it does NOT filter, so arrow keys
      // in a number field would walk the camera: stop keydown here, before it reaches its
      // window listener. Keyup is left alone on purpose — swallowing it could leave a key
      // that was pressed in the scene stuck "down".
      gui.domElement.setAttribute('data-panel-overlay', '')
      gui.domElement.addEventListener('keydown', (event) => event.stopPropagation())

      const push = () => setRealismProbe({ ...params })
      gui.add(params, 'enabled').name('PROBE ON  (off = prod look)').onChange(push)
      gui
        .add(params, 'preset', {
          'physical + baked light (spike)': 'baked',
          'baked — next experiment': 'baked-next',
          'physical (no knobs)': 'physical',
          manual: 'manual',
        })
        .name('PRESET')
        .onChange(push)

      const art = gui.addFolder('Artworks')
      art.add(params, 'artworkLit').name('lit by the lamps').onChange(push)
      art.add(params, 'artworkGain', 0.5, 3, 0.05).name('lit gain').onChange(push)
      art.add(params, 'artworkNeutralTint').name('drop ambient tint').onChange(push)
      art
        .add(params, 'artworkMaterial', {
          'Lambert (no env)': 'lambert',
          'Standard (room bounce)': 'standard',
        })
        .name('lit material')
        .onChange(push)
      art.add(params, 'artworkRoughness', 0.2, 1, 0.01).name('paper roughness').onChange(push)

      const surf = gui.addFolder('Walls & ceiling (bake)')
      surf
        .add(params, 'surfaceMode', {
          current: 'current',
          'bake only (unlit)': 'unlit',
          'bake as lightmap': 'lightmap',
        })
        .name('mode')
        .onChange(push)
      surf.add(params, 'surfaceAlbedo', 0.5, 1, 0.01).name('paint albedo').onChange(push)
      surf.add(params, 'bakeStrength', 0.25, 3, 0.05).name('bake strength').onChange(push)

      surf.add(params, 'ceilingSeparate').name('ceiling: own values').onChange(push)
      surf.add(params, 'ceilingAlbedo', 0.5, 1, 0.01).name('ceiling albedo').onChange(push)
      surf.add(params, 'ceilingStrength', 0.25, 3, 0.05).name('ceiling strength').onChange(push)

      const floor = gui.addFolder('Floor (render only)')
      floor.add(params, 'floorOverride').name('override stored').onChange(push)
      floor
        .add(params, 'floorDebug', {
          'full material': 'normal',
          'colour only (unlit)': 'albedo',
          'lighting only': 'lighting',
          'reflection only': 'reflection',
        })
        .name('VIEW')
        .onChange(push)

      const floorTex = floor.addFolder('Texture')
      floorTex.add(params, 'floorMaterial', PROBE_FLOOR_MATERIALS).name('material').onChange(push)
      floorTex.add(params, 'floorTileMeters', 0.5, 6, 0.05).name('tile size (m)').onChange(push)
      floorTex.add(params, 'floorRotation', [0, 90]).name('rotation').onChange(push)
      floorTex.add(params, 'floorAnisotropy', [1, 2, 4, 8, 16]).name('anisotropy').onChange(push)

      const floorMat = floor.addFolder('Material')
      floorMat.add(params, 'floorRoughness', 0.05, 1, 0.01).name('roughness (sheen)').onChange(push)
      floorMat.add(params, 'floorMetalness', 0, 1, 0.01).name('metalness').onChange(push)
      floorMat.add(params, 'floorNormalScale', 0, 3, 0.05).name('normal (relief)').onChange(push)
      floorMat.add(params, 'floorAoIntensity', 0, 2, 0.05).name('AO intensity').onChange(push)
      floorMat.add(params, 'floorEnvIntensity', 0, 4, 0.05).name('env reflection').onChange(push)
      floorMat.add(params, 'floorBrightness', 0.4, 1, 0.01).name('brightness').onChange(push)
      floorMat.addColor(params, 'floorTint').name('tint').onChange(push)

      const floorMaps = floor.addFolder('Maps on/off')
      floorMaps.add(params, 'floorMapAlbedo').name('colour map').onChange(push)
      floorMaps.add(params, 'floorMapNormal').name('normal map').onChange(push)
      floorMaps.add(params, 'floorMapRoughness').name('roughness map').onChange(push)
      floorMaps.add(params, 'floorMapAo').name('AO map').onChange(push)
      floorMaps.add(params, 'floorMapMetalness').name('metalness map').onChange(push)
      floorMaps.close()

      const floorRefl = floor.addFolder('Reflection')
      floorRefl.add(params, 'floorReflections').name('reflection pass on').onChange(push)
      floorRefl
        .add(params, 'floorReflMode', {
          'drei (tints colour)': 'drei',
          'fresnel (adds gloss)': 'fresnel',
        })
        .name('blend')
        .onChange(push)
      floorRefl.add(params, 'floorFresnelF0', 0, 0.2, 0.005).name('fresnel F0').onChange(push)
      floorRefl.add(params, 'floorFixReflUv').name('fix stretched UVs').onChange(push)
      floorRefl.add(params, 'floorMixStrength', 0, 3, 0.01).name('strength').onChange(push)
      floorRefl.add(params, 'floorMirror', 0, 1, 0.005).name('mirror').onChange(push)
      floorRefl.add(params, 'floorMixBlur', 0, 4, 0.05).name('blur by roughness').onChange(push)
      floorRefl.add(params, 'floorBlur', 0, 1000, 10).name('blur size').onChange(push)
      floorRefl.add(params, 'floorMixContrast', 0, 3, 0.05).name('contrast').onChange(push)
      floorRefl
        .add(params, 'floorReflResolution', [256, 512, 1024, 2048])
        .name('resolution')
        .onChange(push)
      floorRefl.add(params, 'floorDepthScale', 0, 5, 0.05).name('contact sharpen').onChange(push)
      floorRefl.add(params, 'floorMinDepth', 0, 1, 0.01).name('depth min').onChange(push)
      floorRefl.add(params, 'floorMaxDepth', 0, 1.5, 0.01).name('depth max').onChange(push)

      const amb = gui.addFolder('Ambient light')
      amb.add(params, 'ambientOverride').name('override stored').onChange(push)
      amb.add(params, 'ambientIntensity', 0, 3, 0.05).name('intensity').onChange(push)
      amb.add(params, 'ambientNeutral').name('neutral white').onChange(push)
      amb.add(params, 'hemiIntensity', 0, 3, 0.05).name('hemisphere fill').onChange(push)
      amb.addColor(params, 'hemiSky').name('hemi from above').onChange(push)
      amb.addColor(params, 'hemiGround').name('hemi from below').onChange(push)
      amb.add(params, 'envCapture').name('environment = real room').onChange(push)
      amb.add(params, 'envOverride').name('override environment').onChange(push)
      amb.add(params, 'envIntensity', 0, 3, 0.05).name('environment').onChange(push)

      const key = gui.addFolder('Key light (directional, no shadow)')
      key.add(params, 'keyIntensity', 0, 5, 0.05).name('intensity (0 = off)').onChange(push)
      key.add(params, 'keyAzimuth', 0, 360, 1).name('direction °').onChange(push)
      key.add(params, 'keyElevation', 5, 85, 1).name('height °').onChange(push)
      key.addColor(params, 'keyColor').name('colour').onChange(push)

      const lamps = gui.addFolder('Lamps')
      lamps.add(params, 'lampScale', 0, 5, 0.05).name('spotlight ×').onChange(push)
      lamps.add(params, 'spotPenumbraOverride').name('override penumbra').onChange(push)
      lamps.add(params, 'spotPenumbra', 0, 1, 0.05).name('penumbra').onChange(push)
      lamps.add(params, 'spotNoCutoff').name('no 5 m cut-off').onChange(push)

      const out = gui.addFolder('Output')
      out
        .add(params, 'toneMapping', {
          'ACES Filmic (prod)': 'ACES_FILMIC',
          AgX: 'AGX',
          'Khronos Neutral': 'NEUTRAL',
        })
        .name('tone mapping')
        .onChange(push)
      out.add(params, 'exposure', 0.25, 3, 0.05).name('exposure').onChange(push)
      out.add(params, 'matchAcesBrightness').name('match ACES brightness').onChange(push)
      out.add(params, 'bloom').name('bloom').onChange(push)

      const info = gui.addFolder('Stored on this exhibition (read-only)')
      Object.entries(stored).forEach(([key, value]) => {
        info
          .add({ value: String(value) }, 'value')
          .name(key)
          .disable()
      })
      info.close()

      gui
        .add(
          {
            copy: () => {
              const text = JSON.stringify({ probe: getEffectiveRealismProbe(), stored }, null, 2)
              navigator.clipboard?.writeText(text).catch(() => undefined)
              console.info('[AR-161 probe]', text)
            },
          },
          'copy',
        )
        .name('Copy settings (paste to Claude)')
      gui
        .add(
          {
            reset: () => {
              Object.assign(params, PROBE_DEFAULTS)
              gui.controllersRecursive().forEach((c) => c.updateDisplay())
              push()
            },
          },
          'reset',
        )
        .name('Reset all')

      destroy = () => gui.destroy()
    })

    return () => {
      disposed = true
      destroy?.()
    }
    // Rebuilt when the open exhibition changes so the read-only folder is current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey])

  return null
}

export default RealismProbePanel
