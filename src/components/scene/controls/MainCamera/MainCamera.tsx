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
import { Vector3, Quaternion, PerspectiveCamera, Mesh, Raycaster } from 'three'

import SceneContext from '@/contexts/SceneContext'
import { useBakedLook } from '@/components/scene/bake/bakedLook'
import { getSpaceConfig } from '@/components/scene/constants'
import { clearFocusTarget } from '@/redux/slices/sceneSlice'
import { clearReturnFromWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import {
  createMouseState,
  handleMouseMove,
  handleKeyPress,
  attachMouseHandlers,
  detachMouseHandlers,
  calculateMovementVector,
  type MouseState,
} from './helpers'
import {
  TOUCH_GLIDE_DECAY,
  beginTouch,
  createTouchGesture,
  endTouch,
  moveTouch,
} from './touchGestures'

function detectCollisions(
  camera: PerspectiveCamera,
  movementVector: Vector3,
  wallRefs: RefObject<Mesh | null>[],
  windowRefs: RefObject<Mesh | null>[],
  glassRefs: RefObject<Mesh | null>[],
  collisionDistance: number,
): boolean {
  if (movementVector.lengthSq() === 0) return false

  const meshes = [...wallRefs, ...windowRefs, ...glassRefs]
    .map((ref) => ref.current)
    .filter(Boolean) as Mesh[]

  if (meshes.length === 0) return false

  const raycaster = new Raycaster()

  // 1. Forward ray: check movement direction
  const direction = movementVector.clone().normalize()
  raycaster.set(camera.position, direction)
  raycaster.far = collisionDistance
  raycaster.near = 0
  if (raycaster.intersectObjects(meshes, true).length > 0) return true

  // 2. Lateral feeler rays: prevent drifting into walls from the side.
  //    These fire regardless of movement direction so the camera can never
  //    be within collisionDistance of any wall surface.
  const cameraForward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  cameraForward.y = 0
  cameraForward.normalize()
  const cameraRight = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
  cameraRight.y = 0
  cameraRight.normalize()

  const feelers = [
    cameraRight, // right
    cameraRight.clone().negate(), // left
    cameraForward.clone().add(cameraRight).normalize(), // front-right
    cameraForward.clone().sub(cameraRight).normalize(), // front-left
  ]

  for (const feeler of feelers) {
    raycaster.set(camera.position, feeler)
    raycaster.far = collisionDistance
    const hits = raycaster.intersectObjects(meshes, true)
    if (hits.length > 0) {
      // Only block if the movement has a component toward the nearby wall
      if (movementVector.dot(feeler) > 0) return true
    }
  }

  return false
}

// Animation constants
const FOCUS_DURATION = 1.2 // Animation duration in seconds
const FOCUS_PADDING = 1.08 // Padding factor to ensure artwork fits comfortably in view
const FOCUS_MIN_DISTANCE = 0.4 // Minimum distance from artwork
// Longest step one frame may take, whatever asks for it (the trackpad, a slide
// on a phone): the collision rays reach 0.7 m, so a step this short can never
// carry the camera past a wall they have not seen.
const MAX_STEP = 0.15

// Ease-out cubic: smooth deceleration, reaches target exactly at t=1
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

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
  const isReturningToElevation = useRef(false)

  // Touch (AR-172): the slide in progress, the meters it has asked to walk
  // since the last frame, and the walk's speed (meters per frame), kept so the
  // walk can ease out after the finger lifts.
  const touchGesture = useRef(createTouchGesture())
  const touchWalk = useRef(0)
  const walkVelocity = useRef(0)

  // Focus animation state
  const isAnimating = useRef(false)
  const targetPosition = useRef<Vector3 | null>(null)
  const targetLookAt = useRef<Vector3 | null>(null)
  const startPosition = useRef<Vector3 | null>(null)
  const startQuaternion = useRef<Quaternion | null>(null)
  const animationProgress = useRef(0)

  const dampingFactor = 0.6
  const collisionDistance = 0.7
  // Distance per frame AT 60fps — so 0.04 is ~2.4 units/second. Scaled by delta
  // below so walking speed is the same on every machine; it used to be applied
  // raw per frame, which made a 30fps client walk at literally half speed.
  // Kept unhurried on purpose (a gallery is not a game), but nudged up from
  // 0.03 because crossing a room at the old pace read as laborious.
  const moveSpeed = 0.04
  // Ceiling on the delta multiplier. A hitch or a backgrounded tab can hand
  // useFrame a huge delta; unclamped, that becomes a single giant step that
  // tunnels straight through `detectCollisions` (which raycasts a fixed 3
  // units) and puts the camera inside a wall. 1/30s caps one frame's travel at
  // double the 60fps step.
  const MAX_FRAME_DELTA = 1 / 30

  // Get camera settings from Redux — in a baked space's approved look (AR-161), the space's eye
  const look = useBakedLook()
  const storedFOV = useSelector((state: RootState) => state.exhibition.cameraFOV ?? 50)
  const storedElevation = useSelector((state: RootState) => state.exhibition.cameraElevation ?? 1.6)
  const cameraFOV = look.baked ? look.space.cameraFOV : storedFOV
  const cameraElevation = look.baked ? look.space.cameraElevation : storedElevation

  const wallCoordinates = useSelector((state: RootState) => state.wallView.currentWallCoordinates)
  const wallNormal = useSelector((state: RootState) => state.wallView.currentWallNormal)
  const returnFromWallView = useSelector((state: RootState) => state.wallView.returnFromWallView)
  const focusTarget = useSelector((state: RootState) => state.scene.focusTarget)
  const isExitPromptOpen = useSelector((state: RootState) => state.scene.isExitPromptOpen)
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

  // When cameraElevation changes (e.g. Eye Level slider), smoothly transition the camera
  useEffect(() => {
    if (initialPositionSet.current) {
      isReturningToElevation.current = true
    }
  }, [cameraElevation])

  // Handle focus target changes - start animation
  useEffect(() => {
    if (focusTarget) {
      const { position, normal, width, height } = focusTarget

      // Calculate optimal viewing distance based on artwork size and camera FOV
      // Use the camera's real aspect ratio so the calculation adapts to any window shape
      const fovRad = (cameraFOV * Math.PI) / 180
      const halfFov = fovRad / 2
      const aspectRatio = camera.aspect // actual viewport width / height

      // Distance needed so the artwork height fits in view
      const distanceForVertical =
        height / 2 > 0 ? ((height / 2) * FOCUS_PADDING) / Math.tan(halfFov) : FOCUS_MIN_DISTANCE

      // Distance needed so the artwork width fits in view
      const horizontalHalfFov = Math.atan(Math.tan(halfFov) * aspectRatio)
      const distanceForHorizontal =
        width / 2 > 0
          ? ((width / 2) * FOCUS_PADDING) / Math.tan(horizontalHalfFov)
          : FOCUS_MIN_DISTANCE

      // Use the larger distance to ensure artwork fits both horizontally and vertically.
      //
      // Except on a screen taller than it is wide — a phone or tablet held
      // upright. It sees so little across that fitting the width means backing
      // far away (a 2 m-wide work wants about 5 m on an upright phone, 1.45 m on
      // a laptop), so there it frames the height and lets the sides crop.
      const fitsWidth = aspectRatio >= 1
      const optimalDistance = Math.max(
        distanceForVertical,
        fitsWidth ? distanceForHorizontal : 0,
        FOCUS_MIN_DISTANCE,
      )

      // Calculate target camera position: offset from artwork along its normal
      const artworkPos = new Vector3(position.x, position.y, position.z)
      const normalVec = new Vector3(normal.x, normal.y, normal.z).normalize()

      // The glide flies straight there and checks no walls on the way, so the
      // spot itself must be inside the room: stop short of the first wall behind
      // the viewer, as far from it as walking would.
      const roomMeshes = [
        ...(wallRefs.current ?? []),
        ...(windowRefs.current ?? []),
        ...(glassRefs.current ?? []),
      ]
        .map((ref) => ref.current)
        .filter(Boolean) as Mesh[]
      const behind = new Raycaster(
        artworkPos.clone().add(normalVec.clone().multiplyScalar(0.05)),
        normalVec,
        0,
        optimalDistance + collisionDistance,
      ).intersectObjects(roomMeshes, true)[0]
      const viewingDistance = behind
        ? Math.max(
            FOCUS_MIN_DISTANCE,
            Math.min(optimalDistance, behind.distance + 0.05 - collisionDistance),
          )
        : optimalDistance

      // Camera positioned in front of artwork at the calculated distance
      const cameraTargetPos = artworkPos
        .clone()
        .add(normalVec.clone().multiplyScalar(viewingDistance))
      // Move camera to artwork center Y for perfect centering
      cameraTargetPos.y = position.y

      // Look straight at the artwork center
      const lookAtTarget = new Vector3(position.x, position.y, position.z)

      targetPosition.current = cameraTargetPos
      targetLookAt.current = lookAtTarget
      // Capture start state for smooth interpolation
      startPosition.current = camera.position.clone()
      startQuaternion.current = camera.quaternion.clone()
      animationProgress.current = 0
      isAnimating.current = true
      isReturningToElevation.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // One finger on the room: slide up or down to walk, left or right to turn
  // (see touchGestures). A turn rides the mouse drag's own path, momentum and all.
  const onTouchStart = useCallback((event: TouchEvent) => {
    // A finger landing stops a walk still easing out from the last slide.
    if (beginTouch(touchGesture.current, event)) walkVelocity.current = 0
  }, [])
  const onTouchMove = useCallback((event: TouchEvent) => {
    const { walk, turn } = moveTouch(touchGesture.current, event)
    touchWalk.current += walk
    if (turn && mouseState.current) mouseState.current.deltaX += turn
  }, [])
  const onTouchEnd = useCallback((event: TouchEvent) => {
    endTouch(touchGesture.current, event)
  }, [])
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
      window.addEventListener('touchstart', onTouchStart, { passive: true })
      window.addEventListener('touchmove', onTouchMove, { passive: true })
      window.addEventListener('touchend', onTouchEnd, { passive: true })
      window.addEventListener('touchcancel', onTouchEnd, { passive: true })
      window.addEventListener('wheel', onWheel, { passive: false })
    }

    const detachHandlers = () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('wheel', onWheel)
    }

    // Every device, every size (AR-172): this used to stand down below 1024px,
    // when phones and tablets were never let into the room.
    attachHandlers()
    return detachHandlers
  }, [onKeyDown, onKeyUp, onMouseDown, onMouseUp, onTouchStart, onTouchMove, onTouchEnd, onWheel])

  useFrame(({ camera, invalidate }, delta) => {
    const cam = camera as PerspectiveCamera

    cam.fov = cameraFOV
    cam.updateProjectionMatrix()

    // Freeze the visitor while the "Leave the exhibition?" dialog is up.
    // Window-level key and mouse listeners keep firing behind a modal, so
    // without this the scene drifts under the dialog while they read it.
    // Keys held when it opened are cleared too: their keyup may land on the
    // dialog and never reach us, which would leave the visitor walking the
    // moment it closes.
    if (isExitPromptOpen) {
      keysPressed.current = {}
      rotationVelocity.current = 0
      touchWalk.current = 0
      walkVelocity.current = 0
      if (mouseState.current) {
        mouseState.current.deltaX = 0
        mouseState.current.wheelZ = 0
      }
      return
    }

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

    // Smoothly return to default elevation only on lateral movement (turning/strafing)
    // Forward/backward movement keeps the focused elevation
    const hasLateralInput =
      keysPressed.current?.['a'] ||
      keysPressed.current?.['d'] ||
      keysPressed.current?.['arrowleft'] ||
      keysPressed.current?.['arrowright'] ||
      Math.abs(mouseState.current?.deltaX ?? 0) > 0.5

    if (hasLateralInput && Math.abs(cam.position.y - cameraElevation) > 0.01) {
      isReturningToElevation.current = true
    }

    if (isReturningToElevation.current) {
      cam.position.y += (cameraElevation - cam.position.y) * 0.03
      if (Math.abs(cam.position.y - cameraElevation) < 0.005) {
        cam.position.y = cameraElevation
        isReturningToElevation.current = false
      }
    }

    // Handle focus animation
    if (
      isAnimating.current &&
      targetPosition.current &&
      targetLookAt.current &&
      startPosition.current &&
      startQuaternion.current
    ) {
      // Advance progress based on real time
      animationProgress.current = Math.min(1, animationProgress.current + delta / FOCUS_DURATION)
      const t = easeOutCubic(animationProgress.current)

      // Smoothly interpolate position from start to target
      cam.position.lerpVectors(startPosition.current, targetPosition.current, t)

      // Compute target quaternion (what the camera would look like at the target)
      const tempCamPos = cam.position.clone()
      cam.position.copy(targetPosition.current)
      cam.lookAt(targetLookAt.current)
      const targetQuat = cam.quaternion.clone()
      cam.position.copy(tempCamPos)

      // Smoothly interpolate rotation from start to target
      cam.quaternion.slerpQuaternions(startQuaternion.current, targetQuat, t)

      // Check if animation is complete
      if (animationProgress.current >= 1) {
        cam.position.copy(targetPosition.current)
        cam.lookAt(targetLookAt.current)

        // Clean up
        isAnimating.current = false
        targetPosition.current = null
        targetLookAt.current = null
        startPosition.current = null
        startQuaternion.current = null
        animationProgress.current = 0
        dispatch(clearFocusTarget())
      }

      // Skip normal controls during animation — and drop what a finger asked
      // for meanwhile, rather than lurching once the glide ends.
      touchWalk.current = 0
      walkVelocity.current = 0
      return
    }

    if (Math.abs(mouseState.current?.deltaX ?? 0) > 0.5) {
      rotationVelocity.current += (mouseState.current?.deltaX ?? 0) * 0.002
    }

    rotationVelocity.current *= dampingFactor
    const rotationDelta = -rotationVelocity.current
    cam.rotateY(rotationDelta)

    // Frame-rate independent: `moveSpeed` is the per-frame distance at 60fps,
    // so scale it by how long this frame actually took. Clamped, or a hitch
    // becomes one huge step that tunnels through collision.
    const frameSpeed = moveSpeed * Math.min(delta, MAX_FRAME_DELTA) * 60
    const moveVector = calculateMovementVector(keysPressed, frameSpeed, cam)

    // Add wheel-based forward/backward movement (clamped to prevent wall pass-through)
    if (mouseState.current?.wheelZ) {
      const forward = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
      forward.y = 0
      forward.normalize()
      const clampedWheel = Math.max(-MAX_STEP, Math.min(MAX_STEP, -mouseState.current.wheelZ))
      moveVector.add(forward.clone().multiplyScalar(clampedWheel))
      mouseState.current.wheelZ = 0
    }

    // Touch walking: while the finger is down, exactly the distance it slid;
    // once it lifts, the slide's speed easing out.
    let touchStep = 0
    if (touchGesture.current.active) {
      touchStep = touchWalk.current
      // Smoothed, because move events and frames don't arrive in step: a frame
      // that saw no move would otherwise zero the speed the lift glides on.
      walkVelocity.current = walkVelocity.current * 0.5 + touchStep * 0.5
    } else if (walkVelocity.current !== 0) {
      touchStep = walkVelocity.current
      walkVelocity.current *= Math.pow(TOUCH_GLIDE_DECAY, Math.min(delta, MAX_FRAME_DELTA) * 60)
      if (Math.abs(walkVelocity.current) < 0.0005) walkVelocity.current = 0
    }
    touchWalk.current = 0
    if (touchStep !== 0) {
      const forward = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
      forward.y = 0
      forward.normalize()
      moveVector.add(forward.multiplyScalar(Math.max(-MAX_STEP, Math.min(MAX_STEP, touchStep))))
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
    } else {
      // Walked into a wall: a glide stops there rather than pressing on.
      walkVelocity.current = 0
    }

    if (mouseState.current) {
      mouseState.current.deltaX = 0
    }

    // Request next frame when there's active movement (frameloop="demand")
    const hasMovement =
      moveVector.lengthSq() > 0.00001 ||
      Math.abs(rotationVelocity.current) > 0.0001 ||
      walkVelocity.current !== 0 ||
      isAnimating.current ||
      isReturningToElevation.current
    if (hasMovement) {
      invalidate()
    }
  })

  return null
}

export default MainCamera
