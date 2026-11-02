'use client'

import { useRef, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLoader, useThree } from '@react-three/fiber'
import { DoubleSide, TextureLoader, type WebGLProgramParametersWithUniforms } from 'three'

import type { RootState } from '@/redux/store'
import { configurePlaster, PLASTER } from '@/components/scene/bake/applyBake'
import { BAKE_DEBUG, useBakedLook } from '@/components/scene/bake/bakedLook'
import { PLASTER_TILE } from '@/components/scene/bake/receivers'
import {
  chooseCurrentArtworkId,
  addArtworkToGroup,
  removeGroup,
} from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RuntimeArtwork } from '@/utils/artworkTransform'

type ShapeObjectProps = {
  artwork: RuntimeArtwork
}

/** Matte paint: fully diffuse, no specular highlight. */
const SHAPE_ROUGHNESS = 0.95

/**
 * The wall's plaster under the paint, where it continues (the bake's unwrap, `autoUnwrap`): the
 * point's world position on the plane it faces, in plaster tiles — the wall's own uv2 there, so
 * the relief runs on through the shape at the same size and place.
 */
const PLASTER_UV = /* glsl */ `#include <uv_vertex>
  {
    vec3 plasterNormal = normalize( mat3( modelMatrix ) * vec3( 0.0, 0.0, 1.0 ) );
    vec3 plasterHelper = abs( plasterNormal.y ) < 0.9 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
    vec3 plasterU = normalize( cross( plasterHelper, plasterNormal ) );
    vec3 plasterV = normalize( cross( plasterNormal, plasterU ) );
    vec3 plasterAt = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
    vec2 plasterUv = vec2( dot( plasterAt, plasterU ), dot( plasterAt, plasterV ) ) / ${PLASTER_TILE.toFixed(2)};
    vNormalMapUv = plasterUv;
    vRoughnessMapUv = plasterUv;
  }`

const plasterUnderPaint = (shader: WebGLProgramParametersWithUniforms) => {
  shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', PLASTER_UV)
}

/**
 * Eduardo 2026-11-02: a shape "looks fake, because there is no texture at all. This shape is
 * supposed to be paint on the wall… the shape should look like a 'continuation' of the wall" —
 * "I don't want to see a different bump size, but just as if the wall was painted with this
 * color". In a baked room (the walls' plaster, `applyBake`): the wall's own normal and roughness
 * maps, at the wall's own coordinates (`PLASTER_UV`), so only the color changes. The rest of its
 * light as before.
 *
 * In development and staging (`BAKE_DEBUG`), to compare: `?shapeplaster=0` the flat paint.
 */
const plasterUnderShapes = (): boolean =>
  typeof window !== 'undefined' &&
  !(BAKE_DEBUG && new URLSearchParams(window.location.search).get('shapeplaster') === '0')

const PaintOnPlaster = ({ color, opacity }: { color: string; opacity: number }) => {
  const gl = useThree((s) => s.gl)
  const [normal, roughness] = useLoader(TextureLoader, [PLASTER.normal, PLASTER.roughness])
  // The walls' very textures (the loader's cache), set up as the walls read them.
  const plaster = useMemo(
    () => configurePlaster({ normal: normal!, roughness: roughness! }, gl),
    [normal, roughness, gl],
  )
  return (
    <meshStandardMaterial
      color={color}
      normalMap={plaster.normal}
      roughnessMap={plaster.roughness}
      roughness={1}
      metalness={0}
      side={DoubleSide}
      transparent={opacity < 1}
      opacity={opacity}
      onBeforeCompile={plasterUnderPaint}
      customProgramCacheKey={() => 'shape-plaster'}
    />
  )
}

// Constants for click detection
const CLICK_MAX_DISTANCE = 5
const CLICK_MAX_DURATION = 300

const ShapeObject = ({ artwork }: ShapeObjectProps) => {
  const dispatch = useDispatch()

  const { id, width, height, position, quaternion, shapeType, shapeColor, shapeOpacity } = artwork

  const isEditMode = useSelector((state: RootState) => state.dashboard.isEditMode)
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const handlePointerDown = useCallback(
    (e: { stopPropagation: () => void; clientX: number; clientY: number }) => {
      if (!isEditMode) return
      e.stopPropagation()
      pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
    },
    [isEditMode],
  )

  const handlePointerUp = useCallback(
    (e: { stopPropagation: () => void; clientX: number; clientY: number }) => {
      if (!isEditMode || !pointerDownRef.current) return
      e.stopPropagation()

      const dx = e.clientX - pointerDownRef.current.x
      const dy = e.clientY - pointerDownRef.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const duration = Date.now() - pointerDownRef.current.time
      pointerDownRef.current = null

      if (dist < CLICK_MAX_DISTANCE && duration < CLICK_MAX_DURATION) {
        dispatch(chooseCurrentArtworkId(id))
        dispatch(removeGroup())
        dispatch(addArtworkToGroup(id))
        dispatch(showWizard())
      }
    },
    [isEditMode, id, dispatch],
  )

  const look = useBakedLook()
  const onPlaster = useMemo(() => look.baked && plasterUnderShapes(), [look.baked])
  const color = shapeColor ?? '#000000'
  const opacity = shapeOpacity ?? 1
  const type = shapeType ?? 'rectangle'

  // Read rotation from exhibition position
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const rotationDeg = exhibitionArtworksById[id]?.rotation ?? 0
  const rotationRad = (rotationDeg * Math.PI) / 180

  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        rotation={[0, 0, rotationRad]}
        scale={type === 'circle' ? [width, height, 1] : undefined}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {type === 'circle' ? (
          <circleGeometry args={[0.5, 64]} />
        ) : (
          <planeGeometry args={[width, height]} />
        )}
        {/* Standard, not Basic. A shape fakes a painted section of the wall it
            sits on, so it has to take the same light the wall does — and
            `meshBasicMaterial` is unlit by definition: it ignores every light
            in the scene and paints the raw color, which is why a spotlight
            used to stop dead at a shape's edge.

            Standard also lights per fragment, so the pool of a track lamp
            falls across the shape properly rather than being interpolated
            between a plane's four corners. High roughness, no metalness: matte
            paint, no sheen. */}
        {onPlaster ? (
          <PaintOnPlaster color={color} opacity={opacity} />
        ) : (
          <meshStandardMaterial
            color={color}
            roughness={SHAPE_ROUGHNESS}
            metalness={0}
            side={DoubleSide}
            transparent={opacity < 1}
            opacity={opacity}
          />
        )}
      </mesh>
    </group>
  )
}

export default ShapeObject
