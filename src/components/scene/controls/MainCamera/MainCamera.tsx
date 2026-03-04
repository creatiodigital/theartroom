'use client'

import { useFrame, useThree } from '@react-three/fiber'
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Vector3, PerspectiveCamera, Mesh, Raycaster } from 'three'

import SceneContext from '@/contexts/SceneContext'
import { getSpaceConfig } from '@/components/scene/constants'
import { clearFocusTarget } from '@/redux/slices/sceneSlice'
import { clearReturnFromWallView } from '@/redux/slices/wallViewSlice'
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

  // Focus animation state
  const isAnimating = useRef(false)
  const targetPosition = useRef<Vector3 | null>(null)
  const targetLookAt = useRef<Vector3 | null>(null)

  const dampingFactor = 0.6
  const collisionDistance = 0.5
  const moveSpeed = 0.03

  // Get camera settings from Redux
  const cameraFOV = useSelector((state: RootState) => state.exhibition.cameraFOV ?? 50)
  const cameraElevation = useSelector((state: RootState) => state.exhibition.cameraElevation ?? 1.6)

  const wallCoordinates = useSelector((state: RootState) => state.wallView.currentWallCoordinates)
  const wallNormal = useSelector((state: RootState) => state.wallView.currentWallNormal)
  const returnFromWallView = useSelector((state: RootState) => state.wallView.returnFromWallView)
  const focusTarget = useSelector((state: RootState) => state.scene.focusTarget)
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) || 'paris'
  const spaceConfig = getSpaceConfig(spaceId)

  // Dynamic camera start from GLB initialPoint node (dispatched by space component)
  const initialCameraPosition = useSelector((state: RootState) => state.scene.initialCameraPosition)
  const initialCameraDirection = useSelector(
    (state: RootState) => state.scene.initialCameraDirection,
  )

  // Get camera ref for immediate positioning before first paint
  const camera = useThree((state) => state.camera) as PerspectiveCamera

  // Set camera position immediately when GLB data arrives — before paint, no visible jump
  useLayoutEffect(() => {
    if (initialCameraPosition && initialCameraDirection && !initialPositionSet.current) {
      const [px, pz] = initialCameraPosition
      const [dx, dz] = initialCameraDirection
      camera.position.set(px, cameraElevation, pz)
      camera.lookAt(new Vector3(px + dx, cameraElevation, pz + dz))
      camera.updateProjectionMatrix()
      initialPositionSet.current = true
    }
  }, [initialCameraPosition, initialCameraDirection, camera, cameraElevation])

  // Handle focus target changes - start animation
  useEffect(() => {
    if (focusTarget) {
      const { position, normal, width, height } = focusTarget

      // Calculate optimal viewing distance based on artwork size and camera FOV
      // Must account for artwork position relative to fixed camera eye height
      const fovRad = (cameraFOV * Math.PI) / 180
      const halfFov = fovRad / 2

      // Calculate vertical distance from camera to artwork extremes
      const artworkTop = position.y + height / 2
      const artworkBottom = position.y - height / 2

      // How far above/below eye level are the artwork extremes?
      const topOffset = artworkTop - cameraElevation
      const bottomOffset = cameraElevation - artworkBottom

      // The larger offset determines how far back we need to be
      const maxVerticalOffset = Math.max(topOffset, bottomOffset)

      // Distance needed to see the most extreme vertical point
      // tan(halfFov) = verticalOffset / distance => distance = verticalOffset / tan(halfFov)
      const distanceForVertical =
        maxVerticalOffset > 0
          ? (maxVerticalOffset * FOCUS_PADDING) / Math.tan(halfFov)
          : FOCUS_MIN_DISTANCE

      // Also check horizontal fit (use aspect ratio approximation)
      const aspectRatio = 16 / 9 // Approximate viewport aspect ratio
      const horizontalFov = 2 * Math.atan(Math.tan(halfFov) * aspectRatio)
      const distanceForHorizontal = (width * FOCUS_PADDING) / (2 * Math.tan(horizontalFov / 2))

      // Use the larger distance to ensure artwork fits both horizontally and vertically
      const optimalDistance = Math.max(
        distanceForVertical,
        distanceForHorizontal,
        FOCUS_MIN_DISTANCE,
      )

      // Calculate target camera position: offset from artwork along its normal
      const artworkPos = new Vector3(position.x, position.y, position.z)
      const normalVec = new Vector3(normal.x, normal.y, normal.z)

      // Camera positioned in front of artwork at the calculated distance
      const cameraTargetPos = artworkPos
        .clone()
        .add(normalVec.clone().multiplyScalar(optimalDistance))
      // Keep camera at eye height (no vertical tilt)
      cameraTargetPos.y = cameraElevation

      // Look straight ahead at the point on the wall at camera's eye height
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
  // Trackpad two-finger horizontal swipe → camera rotation
  const onWheel = useCallback(
    (event: WheelEvent) => {
      // Ignore if event is on a UI panel
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-panel-overlay]')) return

      event.preventDefault()

      // Horizontal swipe → rotation, vertical swipe → movement
      if (mouseState.current) {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
          // Horizontal dominant: rotate
          mouseState.current.deltaX += event.deltaX * -0.5
        } else if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          // Vertical dominant: walk forward/backward
          mouseState.current.wheelZ = (mouseState.current.wheelZ ?? 0) + event.deltaY * 0.002
        }
        setTick((tick) => tick + 1)
      }
    },
    [mouseState],
  )

  useEffect(() => {
    const attachHandlers = () => {
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      window.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mouseup', onMouseUp)
      window.addEventListener('touchstart', onTouchStart)
      window.addEventListener('touchend', onTouchEnd)
      window.addEventListener('wheel', onWheel, { passive: false })
    }

    const detachHandlers = () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('wheel', onWheel)
    }

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024
      if (isMobile) {
        detachHandlers()
      } else {
        attachHandlers()
      }
    }

    // Initial check
    handleResize()

    // Listen for resize
    window.addEventListener('resize', handleResize)

    return () => {
      detachHandlers()
      window.removeEventListener('resize', handleResize)
    }
  }, [onKeyDown, onKeyUp, onMouseDown, onMouseUp, onTouchStart, onTouchEnd, onWheel])

  useFrame(({ camera }, delta) => {
    const cam = camera as PerspectiveCamera

    cam.fov = cameraFOV
    cam.updateProjectionMatrix()

    // Returning from wall view — position camera to face the edited wall
    if (returnFromWallView) {
      dispatch(clearReturnFromWallView())
      if (wallCoordinates && wallNormal) {
        const lookAt = new Vector3(wallCoordinates.x, cameraElevation, wallCoordinates.z)
        const offsetDistance = 5
        const offset = new Vector3(wallNormal.x * offsetDistance, 0, wallNormal.z * offsetDistance)
        const cameraPosition = lookAt.clone().add(offset)
        cam.position.set(cameraPosition.x, cameraElevation, cameraPosition.z)
        cam.lookAt(lookAt)
        cam.updateProjectionMatrix()
        initialPositionSet.current = true
      }
      return
    }

    if (!initialPositionSet.current) {
      // Check if wallCoordinates have been updated from factory defaults
      const isDefaultWallCoords =
        wallCoordinates.x === 0 &&
        wallCoordinates.y === 0 &&
        wallCoordinates.z === 0 &&
        wallNormal.x === 0 &&
        wallNormal.y === 0 &&
        wallNormal.z === 1

      if (!isDefaultWallCoords && wallCoordinates && wallNormal) {
        // Position camera based on wall/placeholder coordinates (e.g. returning from wall view)
        const lookAt = new Vector3(wallCoordinates.x, cameraElevation, wallCoordinates.z)
        const offsetDistance = 5
        const offset = new Vector3(wallNormal.x * offsetDistance, 0, wallNormal.z * offsetDistance)
        const cameraPosition = lookAt.clone().add(offset)

        cam.position.set(cameraPosition.x, cameraElevation, cameraPosition.z)
        cam.lookAt(lookAt)
        cam.updateProjectionMatrix()
        initialPositionSet.current = true
      } else if (initialCameraPosition && initialCameraDirection) {
        // GLB initialPoint data arrived — set position (also handled by useLayoutEffect)
        const [px, pz] = initialCameraPosition
        const [dx, dz] = initialCameraDirection
        cam.position.set(px, cameraElevation, pz)
        cam.lookAt(new Vector3(px + dx, cameraElevation, pz + dz))
        cam.updateProjectionMatrix()
        initialPositionSet.current = true
      } else if (spaceConfig.defaultCameraPosition) {
        // Fallback: static space config
        const [x, z] = spaceConfig.defaultCameraPosition
        cam.position.set(x, cameraElevation, z)
        cam.lookAt(new Vector3(x, cameraElevation, z - 5))
        cam.updateProjectionMatrix()
        initialPositionSet.current = true
      }
      // If none matched, skip — don't default to (0,0,0), wait for data
      return
    }

    // Continuously update camera elevation (allows real-time adjustment)
    cam.position.y = cameraElevation

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

    // Add wheel-based forward/backward movement
    if (mouseState.current?.wheelZ) {
      const forward = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
      forward.y = 0
      forward.normalize()
      moveVector.add(forward.clone().multiplyScalar(-mouseState.current.wheelZ))
      mouseState.current.wheelZ = 0
    }

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
