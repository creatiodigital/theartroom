'use client'

import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useRef, useState, useCallback, type RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Vector3, PerspectiveCamera, Mesh, Raycaster } from 'three'

import SceneContext from '@/contexts/SceneContext'
import { clearFocusTarget } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'

import {
  createMouseState,
  handleMouseMove,
  handleTouchMove,
  handleKeyPress,
  attachMouseHandlers,
  attachTouchHandlers,
  detachMouseHandlers,
  detachTouchHandlers,
  calculateMovementVector,
  type MouseState,
} from './helpers'

function detectCollisions(
  camera: PerspectiveCamera,
  movementVector: Vector3,
  wallRefs: RefObject<Mesh | null>[],
  windowRefs: RefObject<Mesh | null>[],
  glassRefs: RefObject<Mesh | null>[],
  collisionDistance: number,
): boolean {
  if (movementVector.lengthSq() === 0) return false

  const direction = movementVector.clone().normalize()
  const raycaster = new Raycaster(camera.position, direction, 0, 3)

  const meshes = [...wallRefs, ...windowRefs, ...glassRefs]
    .map((ref) => ref.current)
    .filter(Boolean) as Mesh[]

  const hits = raycaster.intersectObjects(meshes, true)

  return hits.some((hit) => hit.distance <= collisionDistance)
}

// Animation constants
const FOCUS_ANIMATION_SPEED = 3 // Higher = faster animation
const FOCUS_THRESHOLD = 0.01 // Distance threshold to consider animation complete
const FOCUS_PADDING = 1.2 // Padding factor to ensure artwork fits comfortably in view
const FOCUS_MIN_DISTANCE = 1.0 // Minimum distance from artwork

const MainCamera = () => {
  const [, setTick] = useState(0)
  const dispatch = useDispatch()

  const context = useContext(SceneContext)
  if (!context) {
    throw new Error('MainCamera must be used within a SceneContext.Provider')
  }

  const { wallRefs, windowRefs, glassRefs } = context

  const keysPressed = useRef<Record<string, boolean>>({})
  const mouseState: RefObject<MouseState> = useRef(createMouseState())
  const initialPositionSet = useRef(false)
  const rotationVelocity = useRef(0)
  const fov = useRef(50)

  // Focus animation state
  const isAnimating = useRef(false)
  const targetPosition = useRef<Vector3 | null>(null)
  const targetLookAt = useRef<Vector3 | null>(null)

  const dampingFactor = 0.6
  const collisionDistance = 1
  const moveSpeed = 0.03
  const cameraElevation = 1.6 // Average person's eye height in meters

  const wallCoordinates = useSelector((state: RootState) => state.wallView.currentWallCoordinates)
  const wallNormal = useSelector((state: RootState) => state.wallView.currentWallNormal)
  const focusTarget = useSelector((state: RootState) => state.scene.focusTarget)

  // Handle focus target changes - start animation
  useEffect(() => {
    if (focusTarget) {
      const { position, normal, width, height } = focusTarget
      
      // Calculate optimal viewing distance based on artwork size and camera FOV
      // Use the larger dimension to ensure entire artwork fits in view
      const artworkMaxDimension = Math.max(width, height)
      const fovRad = (fov.current * Math.PI) / 180
      // Calculate distance needed to fit artwork in view (using vertical FOV)
      const optimalDistance = Math.max(
        (artworkMaxDimension * FOCUS_PADDING) / (2 * Math.tan(fovRad / 2)),
        FOCUS_MIN_DISTANCE
      )
      
      // Calculate target camera position: offset from artwork along its normal
      const artworkPos = new Vector3(position.x, position.y, position.z)
      const normalVec = new Vector3(normal.x, normal.y, normal.z)
      
      // Camera positioned in front of artwork at the calculated distance
      const cameraTargetPos = artworkPos.clone().add(
        normalVec.clone().multiplyScalar(optimalDistance)
      )
      // Keep camera at eye height
      cameraTargetPos.y = cameraElevation
      
      // Look straight ahead - at the point on the wall at camera's eye height
      // This keeps the camera horizontal (no vertical tilt)
      const lookAtTarget = new Vector3(position.x, cameraElevation, position.z)
      
      targetPosition.current = cameraTargetPos
      targetLookAt.current = lookAtTarget
      isAnimating.current = true
    }
  }, [focusTarget])

  const onMouseMove = useCallback(
    (event: MouseEvent) => handleMouseMove(mouseState, setTick)(event),
    [mouseState],
  )
  const onMouseDown = useCallback(
    (event: MouseEvent) => attachMouseHandlers(onMouseMove, mouseState)(event),
    [onMouseMove],
  )
  const onMouseUp = useCallback(
    (event: MouseEvent) => detachMouseHandlers(onMouseMove, mouseState)(event),
    [onMouseMove],
  )
  const onTouchMove = useCallback(
    (event: TouchEvent) => handleTouchMove(mouseState, setTick)(event),
    [mouseState],
  )
  const onTouchStart = useCallback(
    (event: TouchEvent) => attachTouchHandlers(onTouchMove, mouseState)(event),
    [onTouchMove],
  )
  const onTouchEnd = useCallback(
    () => detachTouchHandlers(onTouchMove, mouseState)(),
    [onTouchMove],
  )
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => handleKeyPress(keysPressed, event.key, true),
    [],
  )
  const onKeyUp = useCallback(
    (event: KeyboardEvent) => handleKeyPress(keysPressed, event.key, false),
    [],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [onKeyDown, onKeyUp, onMouseDown, onMouseUp, onTouchStart, onTouchEnd])

  useFrame(({ camera }, delta) => {
    const cam = camera as PerspectiveCamera

    cam.fov = fov.current
    cam.updateProjectionMatrix()

    if (!initialPositionSet.current) {
      if (wallCoordinates && wallNormal) {
        // Position camera based on wall/placeholder coordinates
        const lookAt = new Vector3(wallCoordinates.x, cameraElevation, wallCoordinates.z)
        const offsetDistance = 5
        const offset = new Vector3(wallNormal.x * offsetDistance, 0, wallNormal.z * offsetDistance)
        const cameraPosition = lookAt.clone().add(offset)

        cam.position.set(cameraPosition.x, cameraElevation, cameraPosition.z)
        cam.lookAt(lookAt)
        cam.updateProjectionMatrix()
      } else {
        // Default position: center of floor (0, cameraElevation, 0), looking forward
        cam.position.set(0, cameraElevation, 0)
        cam.lookAt(new Vector3(0, cameraElevation, -5))
        cam.updateProjectionMatrix()
        console.log('MainCamera: Using default position (floor center)')
      }

      initialPositionSet.current = true
    }

    // Handle focus animation
    if (isAnimating.current && targetPosition.current && targetLookAt.current) {
      const lerpFactor = 1 - Math.exp(-FOCUS_ANIMATION_SPEED * delta)
      
      // Smoothly interpolate position
      cam.position.lerp(targetPosition.current, lerpFactor)
      
      // Smoothly interpolate rotation by looking at target
      // Create a temporary camera to get target quaternion
      const currentQuat = cam.quaternion.clone()
      cam.lookAt(targetLookAt.current)
      const targetQuat = cam.quaternion.clone()
      cam.quaternion.copy(currentQuat)
      cam.quaternion.slerp(targetQuat, lerpFactor)
      
      // Check if animation is complete
      const distanceToTarget = cam.position.distanceTo(targetPosition.current)
      if (distanceToTarget < FOCUS_THRESHOLD) {
        // Snap to final position
        cam.position.copy(targetPosition.current)
        cam.lookAt(targetLookAt.current)
        
        // Clean up
        isAnimating.current = false
        targetPosition.current = null
        targetLookAt.current = null
        dispatch(clearFocusTarget())
      }
      
      // Skip normal controls during animation
      return
    }

    if (Math.abs(mouseState.current?.deltaX ?? 0) > 0.5) {
      rotationVelocity.current += (mouseState.current?.deltaX ?? 0) * 0.002
    }

    rotationVelocity.current *= dampingFactor
    const rotationDelta = -rotationVelocity.current
    cam.rotateY(rotationDelta)

    const moveVector = calculateMovementVector(keysPressed, moveSpeed, cam)

    const wallRefsArray = wallRefs.current ?? []
    const windowRefsArray = windowRefs.current ?? []
    const glassRefsArray = glassRefs.current ?? []

    if (
      !detectCollisions(
        cam,
        moveVector,
        wallRefsArray,
        windowRefsArray,
        glassRefsArray,
        collisionDistance,
      )
    ) {
      cam.position.add(moveVector)
    }

    if (mouseState.current) {
      mouseState.current.deltaX = 0
    }
  })

  return null
}

export default MainCamera
