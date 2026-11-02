import { Matrix4, PerspectiveCamera, Plane, Vector3, Vector4, type Camera } from 'three'

/** `mirrorCamera`'s camera and scratch: one per mirror, reused every frame. */
export const mirrorScratch = () => ({
  virtual: new PerspectiveCamera(),
  cameraPosition: new Vector3(),
  view: new Vector3(),
  lookAt: new Vector3(),
  aim: new Vector3(),
  rotation: new Matrix4(),
  plane: new Plane(),
  clip: new Vector4(),
  q: new Vector4(),
})
export type MirrorScratch = ReturnType<typeof mirrorScratch>

/**
 * The camera mirrored in a plane (three's `Reflector`, in world space): `w.virtual` set to draw what
 * the plane reflects, its near plane on the plane (Lengyel's oblique projection: nothing behind the
 * mirror draws), and `textureMatrix` world → the mirror image's UV. False, and nothing changed, when
 * the camera is behind the plane: nothing to reflect.
 *
 * The camera's world matrix must be current (it is otherwise refreshed only when it draws).
 */
export const mirrorCamera = (
  camera: Camera,
  planePoint: Vector3,
  normal: Vector3,
  w: MirrorScratch,
  textureMatrix: Matrix4,
): boolean => {
  w.cameraPosition.setFromMatrixPosition(camera.matrixWorld)
  w.view.subVectors(planePoint, w.cameraPosition)
  if (w.view.dot(normal) > 0) return false
  w.view.reflect(normal).negate().add(planePoint)
  w.rotation.extractRotation(camera.matrixWorld)
  w.lookAt.set(0, 0, -1).applyMatrix4(w.rotation).add(w.cameraPosition)
  w.aim.subVectors(planePoint, w.lookAt).reflect(normal).negate().add(planePoint)

  const virtual = w.virtual
  virtual.position.copy(w.view)
  virtual.up.set(0, 1, 0).applyMatrix4(w.rotation).reflect(normal)
  virtual.lookAt(w.aim)
  virtual.far = (camera as PerspectiveCamera).far
  virtual.layers.mask = camera.layers.mask
  virtual.updateMatrixWorld()
  virtual.projectionMatrix.copy(camera.projectionMatrix)

  // World → the mirror image's UV.
  textureMatrix
    .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    .multiply(virtual.projectionMatrix)
    .multiply(virtual.matrixWorldInverse)

  // The near plane on the mirror (Lengyel's oblique projection), as three's Reflector.
  w.plane.setFromNormalAndCoplanarPoint(normal, planePoint)
  w.plane.applyMatrix4(virtual.matrixWorldInverse)
  w.clip.set(w.plane.normal.x, w.plane.normal.y, w.plane.normal.z, w.plane.constant)
  const p = virtual.projectionMatrix.elements
  w.q.set(
    (Math.sign(w.clip.x) + p[8]!) / p[0]!,
    (Math.sign(w.clip.y) + p[9]!) / p[5]!,
    -1,
    (1 + p[10]!) / p[14]!,
  )
  w.clip.multiplyScalar(2 / w.clip.dot(w.q))
  p[2] = w.clip.x
  p[6] = w.clip.y
  p[10] = w.clip.z + 1
  p[14] = w.clip.w
  return true
}
