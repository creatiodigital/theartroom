import { Vector3, Quaternion, Mesh, BufferGeometry, Box3 } from 'three'

import type { TDimensions } from '@/types/geometry'

export const calculateAverageNormal = (placeholder: Mesh<BufferGeometry>): Vector3 => {
  const normal = new Vector3(0, 0, 0)

  // Defensive check for geometry attributes
  if (!placeholder.geometry?.attributes?.normal?.array) {
    console.warn('calculateAverageNormal: geometry normal attributes not available')
    return normal.set(0, 0, 1) // Default to facing +Z
  }

  const normalsArray = placeholder.geometry.attributes.normal.array as Float32Array

  for (let i = 0; i < normalsArray.length; i += 3) {
    normal.x += normalsArray[i]
    normal.y += normalsArray[i + 1]
    normal.z += normalsArray[i + 2]
  }

  return normal.normalize()
}

export const calculateDimensionsAndBasis = (boundingBox: Box3, normal: Vector3) => {
  const u = new Vector3()
  const v = new Vector3()

  // Check if normal is valid (non-zero)
  const normalLength = normal.length()
  if (!Number.isFinite(normalLength) || normalLength === 0) {
    console.warn('calculateDimensionsAndBasis: Invalid normal vector, using default')
    normal.set(0, 0, 1)
  }

  if (Math.abs(normal.y) < 1) {
    u.crossVectors(normal, new Vector3(0, 1, 0))
  } else {
    u.crossVectors(normal, new Vector3(1, 0, 0))
  }

  // Ensure u is valid before normalizing
  if (u.length() > 0) {
    u.normalize()
  } else {
    u.set(1, 0, 0)
  }

  v.crossVectors(normal, u)
  if (v.length() > 0) {
    v.normalize()
  } else {
    v.set(0, 1, 0)
  }

  const size = new Vector3()
  boundingBox.getSize(size)

  // Fallback if size is invalid
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) {
    console.warn('calculateDimensionsAndBasis: Invalid bounding box size')
    return { width: 0, height: 0, u, v }
  }

  let width = Math.abs(size.dot(u))
  let height = Math.abs(size.dot(v))

  // If projection gives zero, use bounding box dimensions directly
  // (happens when normals aren't available from compressed GLBs)
  if (width === 0 || height === 0) {
    // For vertical walls, width is typically X or Z, height is Y
    const maxHorizontal = Math.max(size.x, size.z)
    width = width === 0 ? maxHorizontal : width
    height = height === 0 ? size.y : height

    // Reset basis vectors for direct bounding box usage
    if (size.x >= size.z) {
      u.set(1, 0, 0)
    } else {
      u.set(0, 0, 1)
    }
    v.set(0, 1, 0)
  }

  return { width, height, u, v }
}

export const convert2DTo3D = (
  posX2d: number,
  posY2d: number,
  width2d: number,
  height2d: number,
  boundingData: TDimensions,
) => {
  const { boundingBox, normal, u, v, width, height } = boundingData

  const xRatio = 0.5 - posX2d / (width * 100)
  const yRatio = posY2d / (height * 100) - 0.5

  const center3D = boundingBox.getCenter(new Vector3())

  let posX3d = center3D.x + u.x * xRatio * width + v.x * yRatio * height
  let posY3d = center3D.y + u.y * xRatio * width + v.y * yRatio * height
  let posZ3d = center3D.z + u.z * xRatio * width + v.z * yRatio * height

  const adjustedWidth = (width2d / (width * 100)) * width
  const adjustedHeight = (height2d / (height * 100)) * height

  posX3d -= u.x * (adjustedWidth / 2)
  posY3d -= u.y * (adjustedWidth / 2)
  posZ3d -= u.z * (adjustedWidth / 2)

  posX3d += v.x * (adjustedHeight / 2)
  posY3d += v.y * (adjustedHeight / 2)
  posZ3d += v.z * (adjustedHeight / 2)

  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal)

  return {
    posX3d,
    posY3d,
    posZ3d,
    quaternionX: quaternion.x,
    quaternionY: quaternion.y,
    quaternionZ: quaternion.z,
    quaternionW: quaternion.w,
    width3d: adjustedWidth,
    height3d: adjustedHeight,
  }
}
