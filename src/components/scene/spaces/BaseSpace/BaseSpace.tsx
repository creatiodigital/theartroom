import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Mesh, BufferGeometry, MeshStandardMaterial, Texture, Color, DoubleSide } from 'three'
import type { GLTF } from 'three-stdlib'

import { Ceiling } from '@/components/scene/spaces/objects/Ceiling'
import { Floor } from '@/components/scene/spaces/objects/Floor'
import { Wall } from '@/components/scene/spaces/objects/Wall'
import { Lights } from '@/components/scene/spaces/ClassicSpace/lights'
import { Effects } from '@/components/scene/spaces/objects/Effects'

type GLTFResult = GLTF & {
  nodes: {
    floor: Mesh & { geometry: BufferGeometry }
    ceiling: Mesh & { geometry: BufferGeometry }
    wall0: Mesh & { geometry: BufferGeometry }
    [key: string]: Mesh
  }
  materials: {
    floorMaterial: MeshStandardMaterial & { 
      map?: Texture | null
      normalMap?: Texture | null
    }
    ceilingMaterial: MeshStandardMaterial & { 
      map?: Texture | null
    }
    wallMaterial?: MeshStandardMaterial & { 
      map?: Texture | null
    }
    [key: string]: MeshStandardMaterial | undefined
  }
}

type BaseSpaceProps = React.ComponentProps<'group'> & {
  wallRefs: React.RefObject<Mesh | null>[]
}

/**
 * Simple base space for testing materials and normal maps.
 * Uses explicit Floor/Ceiling/Wall components like other spaces.
 */
const BaseSpace: React.FC<BaseSpaceProps> = ({
  wallRefs,
  ...props
}) => {
  const { nodes, materials } = useGLTF('/assets/spaces/base.glb?v=5') as unknown as GLTFResult

  // Create wall/ceiling materials if missing, make ceiling double-sided
  useMemo(() => {
    // Debug logging
    console.log('=== BaseSpace Debug ===')
    console.log('All nodes:', Object.keys(nodes))
    console.log('nodes.floor:', nodes.floor)
    console.log('nodes.ceiling:', nodes.ceiling)
    console.log('nodes.wall0:', nodes.wall0)
    console.log('All materials:', Object.keys(materials))
    console.log('floorMaterial:', materials.floorMaterial)
    console.log('floorMaterial.map:', materials.floorMaterial?.map ? '✅' : '❌')
    console.log('ceilingMaterial:', materials.ceilingMaterial)
    console.log('wallMaterial:', materials.wallMaterial)
    
    if (!materials.wallMaterial) {
      materials.wallMaterial = new MeshStandardMaterial({
        color: new Color('#f5f5f5'),
        roughness: 0.9,
        metalness: 0,
      })
    }
    
    // Ensure ceiling is double-sided (so it's visible from below)
    if (materials.ceilingMaterial) {
      materials.ceilingMaterial.side = DoubleSide
    } else {
      materials.ceilingMaterial = new MeshStandardMaterial({
        color: new Color('#f5f5f5'),
        roughness: 0.9,
        metalness: 0,
        side: DoubleSide,
      })
    }
  }, [nodes, materials])

  return (
    <group {...props} dispose={null}>
      {/* Use same lighting as ClassicSpace (includes HDRI environment) */}
      <Lights />
      
      {/* Post-processing effects for enhanced visuals */}
      <Effects />
      
      {/* Explicit mesh components */}
      <Floor nodes={nodes} materials={materials} />
      <Ceiling nodes={nodes} materials={materials} />
      <Wall i={0} wallRef={wallRefs[0]} nodes={nodes} materials={materials} />
    </group>
  )
}

export default BaseSpace
