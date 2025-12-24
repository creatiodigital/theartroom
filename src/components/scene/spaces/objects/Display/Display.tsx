import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useDispatch, useSelector } from 'react-redux'
import { DoubleSide, MeshStandardMaterial, SRGBColorSpace } from 'three'

import { Frame } from '@/components/scene/spaces/objects/Frame'
import { Passepartout } from '@/components/scene/spaces/objects/Passepartout'
import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { showArtworkPanel } from '@/redux/slices/dashboardSlice'
import { setCurrentArtwork } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { RuntimeArtwork } from '@/utils/artworkTransform'

type DisplayProps = {
  artwork: RuntimeArtwork
}

type ArtworkImageProps = {
  url: string
  width: number
  height: number
}

const ArtworkImage = ({ url, width, height }: ArtworkImageProps) => {
  const texture = useTexture(url)
  texture.colorSpace = SRGBColorSpace
  
  return (
    <mesh castShadow receiveShadow renderOrder={2}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial 
        map={texture} 
        side={DoubleSide} 
        roughness={1}
        metalness={0}
        toneMapped={true}
      />
    </mesh>
  )
}

const Display = ({ artwork }: DisplayProps) => {
  const {
    position,
    quaternion,
    width,
    height,
    showArtworkInformation,
    imageUrl,
    showFrame,
    frameColor,
    frameThickness,
    showPassepartout,
    passepartoutColor,
    passepartoutThickness,
  } = artwork

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const dispatch = useDispatch()

  // Use the ambient light hook for frame and passepartout colors
  const frameAmbientColor = useAmbientLightColor(frameColor ?? '#ffffff')
  const passepartoutAmbientColor = useAmbientLightColor(passepartoutColor ?? '#ffffff')

  const handleClick = () => {
    if (!isPlaceholdersShown && showArtworkInformation) {
      dispatch(showArtworkPanel())
      dispatch(setCurrentArtwork(artwork.id))
    }
  }

  const planeWidth = width || 1
  const planeHeight = height || 1

  // Frame material with ambient light applied
  const frameMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: frameAmbientColor,
      roughness: 0.3,
      metalness: 0.1,
    })
  }, [frameAmbientColor])

  // Passepartout material with ambient light applied
  const passepartoutMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: passepartoutAmbientColor,
      roughness: 1,
    })
  }, [passepartoutAmbientColor])

  const frameT = (showFrame ? frameThickness?.value : 0) || 0
  const passepartoutT = (showPassepartout ? passepartoutThickness?.value : 0) || 0

  const innerWidth = planeWidth - (frameT + passepartoutT) / 50
  const innerHeight = planeHeight - (frameT + passepartoutT) / 50

  return (
    <group position={position} quaternion={quaternion} onDoubleClick={handleClick}>
      <mesh renderOrder={1}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {!imageUrl && (
        <mesh renderOrder={2}>
          <planeGeometry args={[innerWidth, innerHeight]} />
          <meshBasicMaterial color="white" side={DoubleSide} />
        </mesh>
      )}

      {imageUrl && (
        <ArtworkImage 
          url={imageUrl} 
          width={innerWidth} 
          height={innerHeight} 
        />
      )}

      {showFrame && frameThickness?.value && (
        <Frame
          width={planeWidth}
          height={planeHeight}
          thickness={frameThickness.value / 100}
          material={frameMaterial}
        />
      )}

      {showPassepartout && passepartoutThickness?.value && frameThickness?.value && (
        <Passepartout
          width={planeWidth - frameThickness.value / 50}
          height={planeHeight - frameThickness.value / 50}
          thickness={passepartoutThickness.value / 100}
          material={passepartoutMaterial}
        />
      )}
    </group>
  )
}

export default Display
