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
import { useDispatch, useSelector, useStore } from 'react-redux'
import { Vector2, Vector3, Quaternion, PerspectiveCamera, Mesh, Raycaster, type Ray } from 'three'

import SceneContext from '@/contexts/SceneContext'
import { useBakedLook } from '@/components/scene/bake/bakedLook'
import { getSpaceConfig } from '@/components/scene/constants'
import { useIsPhone } from '@/hooks/useIsPhone'
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice'
import { clearFocusTarget, setInArtworkView } from '@/redux/slices/sceneSlice'
import { clearReturnFromWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TFocusTarget } from '@/types/scene'

import FloorMarks, { createFloorMarks, type WalkHint } from './FloorMarks'
import {
  createMouseState,
  dragging,
  handleKeyPress,
  moveMouse,
  pressMouse,
  releaseMouse,
  calculateMovementVector,
  wallMoveKeys,
  type MouseState,
} from './helpers'
import {
  FLOAT_DOWN_S,
  FLOOR_Y,
  FOCUS_GLIDE_MIN_S,
  GLIDE_MAX_S,
  HINT_BEYOND,
  HINT_DISTANCE,
  HINT_MAX_S,
  LOOK_GRAB_SCALE,
  MIN_TOUCH_SLIDE_TURN,
  LOOK_INERTIA_S,
  LOOK_REST_SPEED,
  LOOK_SMOOTHING_S,
  LOOK_VELOCITY_SMOOTHING_S,
  MAX_LOOK_SPEED,
  MAX_PAN_SPEED,
  NO_SHIFT,
  PITCH_LEVEL_RATE,
  PINCH_SMOOTHING_S,
  PITCH_LIMIT,
  REFIT_SETTLE_S,
  SHIFT_RELEASE_RATE,
  SHOW_FLOOR_RINGS,
  SWIPE_GAP_MS,
  WALL_CLEARANCE,
  WALL_VIEW_FLOOR_GAP,
  WALL_VIEW_KEY_SPEED,
  WALL_VIEW_UNKNOWN_RISE,
  artworkViewNearest,
  artworkViewPadding,
  clamp,
  closeUpBlocks,
  easeInOutCubic,
  easeOutCubic,
  exitDepth,
  fitDistance,
  forwardOf,
  glideDuration,
  isShifted,
  lensShiftFor,
  rightOf,
  createSwipe,
  readSwipe,
  viewOffsetFor,
  viewingDistance,
  limitStep,
  wallExtent,
  wallScroll,
  wallViewLimits,
  wrapAngle,
  yawOf,
  type LensShift,
  type Range,
} from './navigation'
import { hangingSurface } from './hangingSurfaces'
import {
  firstRoomHit,
  safeDestination,
  setRoomMeshes,
  settleBeside,
  surfaceNormal,
  tapDestination,
} from './roomRays'
import {
  beginTouch,
  createTouchGesture,
  endTouch,
  looking,
  moveTouch,
  pinching,
  sliding,
} from './touchGestures'

function detectCollisions(
  camera: PerspectiveCamera,
  movementVector: Vector3,
  meshes: Mesh[],
  collisionDistance: number,
  // A phone, which may stand nearer a wall than the rays reach (Artwork View up close): a ray's
  // wall stops only a move toward it (`closeUpBlocks`).
  closeUp = false,
): boolean {
  if (movementVector.lengthSq() === 0) return false
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
      const normal = closeUp ? surfaceNormal(hits[0], feeler) : null
      if (normal) {
        // Up close: only a move toward the wall it met (its gap measured straight out from it).
        if (closeUpBlocks(movementVector, normal, hits[0].distance * -normal.dot(feeler))) {
          return true
        }
      } else if (movementVector.dot(feeler) > 0) {
        // Only block if the movement has a component toward the nearby wall
        return true
      }
    }
  }

  return false
}

// Longest step one frame may take, whatever asks for it (the trackpad, a pinch): the collision
// rays reach 0.7 m, so a step this short can never carry the camera past a wall they have not seen.
const MAX_STEP = 0.15

/** A mouse event this soon after a touch (ms) is the browser's echo of the tap, not a mouse. */
const TOUCH_ECHO_MS = 800

/**
 * A walk or a turn to stand in front of a work, eased from where the camera was to where it goes.
 * A walk keeps the heading (the visitor may look around as they go); the glide to a work turns to
 * face it. Either levels the head and eases the lens shift to what the end wants.
 */
type Glide = {
  kind: 'walk' | 'focus'
  fromX: number
  fromZ: number
  toX: number
  toZ: number
  elapsed: number
  duration: number
  ease: (t: number) => number
  yawFrom: number
  yawTo: number
  pitchFrom: number
  shiftFrom: LensShift
  shiftTo: LensShift
  /**
   * A glide to a work: the eye's height on the way (in Wall View it keeps the height it rose or sank
   * to; coming from a walk, eye height). A walk leaves the height alone: out of Wall View the eye
   * floats down by itself (`FLOAT_DOWN_S`).
   */
  heightFrom: number | null
  heightTo: number
  /** A glide to a work: the Artwork View it arrives in. */
  view: ArtworkViewState | null
}

/** Standing in front of a work (Artwork View, the owner's "Wall View"): which, facing it along `yaw`. */
type ArtworkViewState = {
  artworkId: string
  yaw: number
  /** How far the eye stands from the work's wall (m): a finger's slide over it moves this much wall. */
  depth: number
  /**
   * The eye's four limits on the work's placeholder (`wallViewLimits`): along it (measured along
   * the view's right) and up it. Null when the placeholder can't be found: then only the walls stop
   * a move along, and up it the eye keeps between the floor and `WALL_VIEW_UNKNOWN_RISE`.
   */
  limits: { along: Range; height: Range } | null
}

type Pan = { x: number; y: number }

const lerpShift = (a: LensShift, b: LensShift, t: number): LensShift => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

const MainCamera = () => {
  const dispatch = useDispatch()
  // Read when a work is tapped, not watched: which placeholder it hangs on.
  const store = useStore<RootState>()

  const context = useContext(SceneContext)
  if (!context) {
    throw new Error('MainCamera must be used within a SceneContext.Provider')
  }

  const { wallRefs, windowRefs, glassRefs } = context

  const keysPressed = useRef<Record<string, boolean>>({})
  const mouseState: RefObject<MouseState> = useRef(createMouseState())
  const initialPositionSet = useRef(false)
  const isReturningToElevation = useRef(false)

  // Where the camera looks: its heading and its head's tilt, applied every frame, each easing
  // toward where the hand has turned it (`LOOK_SMOOTHING_S`). Anything else that turns the camera
  // (the entrance respawn, the return from wall view) is adopted: the orientation last applied is
  // kept to notice it.
  const yaw = useRef(0)
  const pitch = useRef(0)
  const yawTarget = useRef(0)
  const pitchTarget = useRef(0)
  // How fast a drag is turning and tilting the head (radians per second), read while it drags and
  // carried on, slowing, once it lets go (`LOOK_INERTIA_S`).
  const turnVelocity = useRef(0)
  const tiltVelocity = useRef(0)
  const applied = useRef(new Quaternion())
  /** A finger's grab of the room since the last frame (px), right and down positive. */
  const touchGrab = useRef({ x: 0, y: 0 })
  // In Wall View every move travels over the wall, along it and up or down, never turning: the
  // pixels grabbed since the last frame (right and down positive), the meters asked and not yet
  // moved (eased, as every look is), and the move's speed (m/s), carried on and slowing once the
  // finger or the mouse lets go.
  const panGrab = useRef<Pan>({ x: 0, y: 0 })
  const panPending = useRef<Pan>({ x: 0, y: 0 })
  const panVelocity = useRef<Pan>({ x: 0, y: 0 })
  // The swipe in progress (one finger on a Magic Mouse, two on a trackpad), read by `readSwipe`.
  const swipe = useRef(createSwipe())

  const glide = useRef<Glide | null>(null)
  const artworkView = useRef<ArtworkViewState | null>(null)
  const shift = useRef<LensShift>(NO_SHIFT)
  /**
   * The Exit Wall View button, Escape, a pinch or a trackpad's pinch asked to leave Wall View
   * (handled next frame): a step back from the wall, floating down to eye height.
   */
  const exitAsked = useRef(false)
  /** A pinch that left Wall View: the rest of it walks nowhere, until the fingers lift. */
  const pinchLeft = useRef(false)
  /** The same for a trackpad's pinch: when its last scroll came (ms), until it pauses. */
  const trackpadPinchLeftAt = useRef(Number.NEGATIVE_INFINITY)
  /** Whether the page was last told the visitor is in Wall View (for its Exit button). */
  const toldInView = useRef(false)
  /** Whether the mouse was last seen over a work (laptops and desktops: the cursor). */
  const hoverOverObject = useRef(false)
  /** A tap or click on the room waiting for the frame (client px). */
  const pendingTap = useRef<{ x: number; y: number } | null>(null)

  // Touch: the gesture in progress, and the meters a pinch has asked to walk and not yet walked
  // (taken a share each frame, `PINCH_SMOOTHING_S`, so the step glides and eases to a stop).
  const touchGesture = useRef(createTouchGesture())
  const pinchPending = useRef(0)
  const lastTouchAt = useRef(-Infinity)

  const marks = useRef(createFloorMarks())
  // The entry hint: unchecked, due at `hintAt` (s, the scene clock), showing, or done (timed out,
  // or the visitor already walked).
  const [hint, setHint] = useState<WalkHint | null>(null)
  const hintPhase = useRef<'unchecked' | 'due' | 'showing' | 'done'>('unchecked')
  const hintAt = useRef(0)
  /** How long the hint has been seen (s): it counts only while nothing covers the room. */
  const hintSeen = useRef(0)
  /** Whether the room is uncovered (no notice or guide over it), checked a few times a second. */
  const roomUncovered = useRef(false)
  const uncoveredCheckedAt = useRef(-Infinity)
  const isTouch = useIsTouchDevice()

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
  const exitNonce = useSelector((state: RootState) => state.scene.artworkViewExitNonce)
  const isExitPromptOpen = useSelector((state: RootState) => state.scene.isExitPromptOpen)
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) || 'paris'
  const spaceConfig = getSpaceConfig(spaceId)

  // Dynamic camera start from GLB initialPoint node (dispatched by space component)
  const initialCameraPosition = useSelector((state: RootState) => state.scene.initialCameraPosition)
  const initialCameraDirection = useSelector(
    (state: RootState) => state.scene.initialCameraDirection,
  )

  // Get camera ref for immediate positioning before first paint
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const gl = useThree((state) => state.gl)
  const getThree = useThree((state) => state.get)

  // What the handlers (stable callbacks) need of the latest render.
  const isPhone = useIsPhone()
  const latest = useRef({ isArtworkPanelOpen, isExitPromptOpen, isPhone })
  useEffect(() => {
    latest.current = { isArtworkPanelOpen, isExitPromptOpen, isPhone }
  })

  // The room's solid surfaces, for the taps' walks and the works' taps alike (`roomRays`).
  const meshesOfRoom = useCallback(
    () =>
      [...(wallRefs.current ?? []), ...(windowRefs.current ?? []), ...(glassRefs.current ?? [])]
        .map((ref) => ref.current)
        .filter(Boolean) as Mesh[],
    [wallRefs, windowRefs, glassRefs],
  )
  useEffect(() => {
    setRoomMeshes(meshesOfRoom)
    return () => setRoomMeshes(() => [])
  }, [meshesOfRoom])

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

  // ---------------------------------------------------------------------------
  // Artwork View

  /** The work the visitor stands in front of, or is gliding to. */
  const currentView = useCallback(() => glide.current?.view ?? artworkView.current, [])

  /** Steps back from the work: the lens shift eases home in the frame loop (`SHIFT_RELEASE_RATE`). */
  const leaveArtworkView = useCallback(() => {
    if (glide.current?.kind === 'focus') {
      glide.current = null
      dispatch(clearFocusTarget())
    }
    artworkView.current = null
  }, [dispatch])

  /**
   * What Artwork View last framed, and on a screen of which shape: a phone turned re-fits it, unless
   * the visitor has `moved` over the wall since (the work in sight is no longer that one).
   */
  const framed = useRef<{ target: TFocusTarget; aspect: number; moved: boolean } | null>(null)
  /** A phone turned in Artwork View: its new shape, and when it was last seen to change (s). */
  const reshaping = useRef<{ aspect: number; at: number } | null>(null)

  // A tap on a work: stand in front of it, level, at eye height, squarely facing its wall, as close
  // as frames all of it on this screen, and let the lens shift center it (no rising to a high work,
  // no tilting down to a low one, so nothing floats or keystones). Already in Wall View, the eye
  // keeps the height it rose or sank to over the wall, and frames the work from there.
  const focusOn = (target: TFocusTarget) => {
    const { position, normal, width, height } = target

    const n = new Vector3(normal.x, 0, normal.z)
    if (n.lengthSq() < 1e-6) return
    n.normalize()
    // The work's face, which the screen frames: an unframed print stands out on its support.
    const center = new Vector3(position.x, position.y, position.z).addScaledVector(
      n,
      target.front ?? 0,
    )

    // A phone may stand nearer than walking does: held sideways its screen is short, and a small
    // work or a wall text fills it, readable, only from close up.
    const nearest = artworkViewNearest(isPhone)
    const fitted = fitDistance(
      width,
      height,
      cameraFOV,
      camera.aspect,
      nearest,
      artworkViewPadding(isPhone),
    )

    // The glide flies straight there and checks no walls on the way, so the spot itself must be
    // inside the room: stop short of the first wall behind the viewer, as far from it as walking
    // would. An upright phone would step far back to fit a wide work across: it stops at a limit
    // and the work's sides crop, as they would for an eye (no lens widens).
    const behind = firstRoomHit(
      center.clone().addScaledVector(n, 0.05),
      n,
      fitted + WALL_CLEARANCE,
      meshesOfRoom(),
    )
    const roomLimit = behind ? behind.distance + 0.05 - WALL_CLEARANCE : Infinity
    const depth = viewingDistance(fitted, roomLimit, camera.aspect, nearest)

    const eyeHeight = currentView() ? camera.position.y : cameraElevation
    const yawTo = yawOf(-n.x, -n.z)
    const right = rightOf(yawTo)
    const spot = settleBeside(
      new Vector3(center.x + n.x * depth, eyeHeight, center.z + n.z * depth),
      new Vector3(right.x, 0, right.z),
    )
    // The placeholder the work hangs on: the eye's four limits over it.
    const wallId = store.getState().exhibition.exhibitionArtworksById[target.artworkId]?.wallId
    const surface = wallId ? hangingSurface(wallId) : null
    const extent = surface ? wallExtent(surface, right) : null

    const turn = wrapAngle(yawTo - yaw.current)
    const distance = Math.hypot(spot.x - camera.position.x, spot.z - camera.position.z)
    const interrupted = !!glide.current
    turnVelocity.current = 0
    tiltVelocity.current = 0
    glide.current = {
      kind: 'focus',
      fromX: camera.position.x,
      fromZ: camera.position.z,
      toX: spot.x,
      toZ: spot.z,
      elapsed: 0,
      // Long enough for the walk and for the turn: half a turn takes the longest glide.
      duration: Math.max(
        glideDuration(distance, FOCUS_GLIDE_MIN_S),
        (Math.abs(turn) / Math.PI) * GLIDE_MAX_S,
      ),
      ease: interrupted ? easeOutCubic : easeInOutCubic,
      yawFrom: yaw.current,
      yawTo: yaw.current + turn,
      pitchFrom: pitch.current,
      shiftFrom: shift.current,
      shiftTo: lensShiftFor(spot, yawTo, center),
      heightFrom: camera.position.y,
      heightTo: eyeHeight,
      view: {
        artworkId: target.artworkId,
        yaw: yawTo,
        depth,
        limits: extent ? wallViewLimits(extent) : null,
      },
    }
    framed.current = { target, aspect: camera.aspect, moved: false }
    reshaping.current = null
  }

  useEffect(() => {
    if (focusTarget) focusOn(focusTarget)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget])

  // The Exit Wall View button (the page's): a step back from the wall, next frame.
  const seenExitNonce = useRef(exitNonce)
  useEffect(() => {
    if (exitNonce === seenExitNonce.current) return
    seenExitNonce.current = exitNonce
    exitAsked.current = true
  }, [exitNonce])

  // Leaving the room leaves Wall View: the page's button goes with it.
  useEffect(
    () => () => {
      dispatch(setInArtworkView(false))
    },
    [dispatch],
  )

  // ---------------------------------------------------------------------------
  // Walking where a tap lands

  const raycaster = useRef(new Raycaster())
  const pointer = useRef(new Vector2())

  /** The ray from the eye through a point on the screen (client px), as the visitor sees it. */
  const rayAt = useCallback(
    (x: number, y: number): Ray => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.current.set(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1,
      )
      // The camera's own projection, lens shift and all, so a tap lands where it is seen.
      raycaster.current.setFromCamera(pointer.current, camera)
      return raycaster.current.ray
    },
    [gl, camera],
  )

  /**
   * Whether an object that answers taps (a work, a text, a sound) is the first thing along a ray,
   * before the floor and the walls: its own tap handles it, the room does nothing.
   */
  const objectFirst = useCallback(
    (ray: Ray) => {
      const objects = getThree().internal.interaction
      if (objects.length === 0) return false
      raycaster.current.ray.copy(ray)
      raycaster.current.near = 0
      raycaster.current.far = Infinity
      const object = raycaster.current.intersectObjects(objects, true)[0]
      if (!object) return false
      const wall = firstRoomHit(ray.origin, ray.direction, object.distance, meshesOfRoom())
      const toFloor =
        ray.direction.y < -1e-4 ? (FLOOR_Y - ray.origin.y) / ray.direction.y : Infinity
      return !wall && object.distance <= toFloor + 0.01
    },
    [getThree, meshesOfRoom],
  )

  const dismissHint = useCallback(() => {
    if (hintPhase.current === 'done') return
    if (hintPhase.current === 'showing') {
      // Fades out (`leaving`), then goes.
      setHint((shown) => shown && { ...shown, leaving: true })
      setTimeout(() => setHint(null), 700)
    }
    hintPhase.current = 'done'
  }, [])

  /** Glides to a spot on the floor, keeping the heading, the head levelling as it goes. */
  const walkTo = useCallback(
    (spot: Vector3, now: number) => {
      leaveArtworkView()
      const interrupted = !!glide.current
      glide.current = {
        kind: 'walk',
        fromX: camera.position.x,
        fromZ: camera.position.z,
        toX: spot.x,
        toZ: spot.z,
        elapsed: 0,
        duration: glideDuration(Math.hypot(spot.x - camera.position.x, spot.z - camera.position.z)),
        // Taken over from a glide already moving, it starts at speed rather than from rest.
        ease: interrupted ? easeOutCubic : easeInOutCubic,
        yawFrom: yaw.current,
        yawTo: yaw.current,
        pitchFrom: pitch.current,
        shiftFrom: shift.current,
        shiftTo: NO_SHIFT,
        heightFrom: null,
        heightTo: cameraElevation,
        view: null,
      }
      pinchPending.current = 0
      marks.current.tap = { x: spot.x, z: spot.z, at: now }
      dismissHint()
    },
    [camera, leaveArtworkView, dismissHint, cameraElevation],
  )

  /**
   * Leaves Wall View from where the visitor is on the wall: a little farther back (`exitDepth`),
   * facing it still, the lens shift easing home and the eye floating down to its height. Where the
   * room behind leaves no room for the step, it leaves where it stands.
   */
  const exitArtworkView = (now: number) => {
    const view = currentView()
    if (!view) return
    const forward = forwardOf(view.yaw)
    const back = exitDepth(view.depth) - view.depth
    const spot = safeDestination(
      camera.position.clone(),
      camera.position.x - forward.x * back,
      camera.position.z - forward.z * back,
    )
    if (spot) walkTo(spot, now)
    else leaveArtworkView()
  }

  /**
   * A tap or click on the room: walk where it landed, unless a work there answers it. In Wall View,
   * a mode of its own (AR-178, owner, 2026-11-07: "make the wall view mode a 'special' view on its own"),
   * only a work answers (it frames that one): a tap on the wall or the floor around it walks
   * nowhere. Wall View is left on purpose: its Exit button, Escape, a pinch.
   */
  const handleTap = useCallback(
    (x: number, y: number, now: number) => {
      const ray = rayAt(x, y)
      if (objectFirst(ray) || currentView()) return
      const spot = tapDestination(ray.clone(), camera.position.clone())
      if (spot) walkTo(spot, now)
    },
    [rayAt, objectFirst, currentView, camera, walkTo],
  )

  // ---------------------------------------------------------------------------
  // Input

  const onMouseDown = useCallback((event: MouseEvent) => {
    if (performance.now() - lastTouchAt.current < TOUCH_ECHO_MS) return
    // A press on a UI panel over the room is the panel's.
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-panel-overlay]')) return
    if (event.button !== 0 || !mouseState.current) return
    // A hand on the room stops a turn still carrying on from the last drag.
    turnVelocity.current = 0
    tiltVelocity.current = 0
    pressMouse(
      mouseState.current,
      event.clientX,
      event.clientY,
      event.target instanceof HTMLCanvasElement,
      performance.now(),
    )
  }, [])
  const onMouseMove = useCallback((event: MouseEvent) => {
    if (performance.now() - lastTouchAt.current < TOUCH_ECHO_MS || !mouseState.current) return
    moveMouse(
      mouseState.current,
      event.clientX,
      event.clientY,
      event.target instanceof HTMLCanvasElement,
    )
  }, [])
  const onMouseUp = useCallback((event: MouseEvent) => {
    if (event.button !== 0 || !mouseState.current) return
    if (performance.now() - lastTouchAt.current < TOUCH_ECHO_MS) {
      mouseState.current.pressed = false
      return
    }
    const click = releaseMouse(mouseState.current, performance.now())
    if (click) pendingTap.current = click
  }, [])

  const onTouchStart = useCallback((event: TouchEvent) => {
    lastTouchAt.current = performance.now()
    beginTouch(touchGesture.current, event, performance.now())
    // A finger landing stops a pinch's step, a turn or a move over the wall still easing out.
    pinchPending.current = 0
    panPending.current = { x: 0, y: 0 }
    panVelocity.current = { x: 0, y: 0 }
    turnVelocity.current = 0
    tiltVelocity.current = 0
    pinchLeft.current = false
  }, [])
  const onTouchMove = useCallback(
    (event: TouchEvent) => {
      lastTouchAt.current = performance.now()
      const { walk, grabX, grabY, slideX, slideY } = moveTouch(touchGesture.current, event)
      const gesture = touchGesture.current
      // In Wall View, one finger or two move over the wall, the works square on (AR-178, owner,
      // 2026-11-07: "like a spider"; "exactly the same if done with 2 fingers"); a pinch leaves it.
      if (currentView()) {
        if (pinching(gesture)) {
          if (!pinchLeft.current) exitAsked.current = true
          pinchLeft.current = true
          return
        }
        panGrab.current.x += grabX + slideX
        panGrab.current.y += grabY + slideY
        return
      }
      // The pinch that left Wall View walks nowhere: it asked to step back, and has.
      if (pinchLeft.current) return
      pinchPending.current += walk
      // A finger grabs the room as the mouse does.
      touchGrab.current.x += grabX
      touchGrab.current.y += grabY
    },
    [currentView],
  )
  const onTouchEnd = useCallback((event: TouchEvent) => {
    lastTouchAt.current = performance.now()
    const tap = endTouch(touchGesture.current, event, performance.now())
    if (tap) pendingTap.current = tap
  }, [])

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const target = event.target as HTMLElement | null
      const typing = !!target?.closest('input, textarea, select, [contenteditable="true"]')
      // In Wall View, Escape leaves it, as the Exit Wall View button does; the walking keys move
      // over the wall instead (the frame reads them, `wallMoveKeys`).
      if (
        !typing &&
        key === 'escape' &&
        currentView() &&
        !latest.current.isExitPromptOpen &&
        !latest.current.isArtworkPanelOpen
      ) {
        exitAsked.current = true
        return
      }
      handleKeyPress(keysPressed, event.key, true)
    },
    [currentView],
  )
  const onKeyUp = useCallback(
    (event: KeyboardEvent) => handleKeyPress(keysPressed, event.key, false),
    [],
  )
  // A swipe on the Magic Mouse (one finger) or trackpad (two), or a wheel: turn or walk; in Wall
  // View, move over the wall
  const onWheel = useCallback(
    (event: WheelEvent) => {
      // Ignore if event is on a UI panel
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-panel-overlay]')) return

      event.preventDefault()
      if (!mouseState.current) return

      // The trackpad brings its own momentum: a turn carrying on from a drag gives way to it.
      turnVelocity.current = 0
      tiltVelocity.current = 0

      // In Wall View a swipe drags the wall both ways at once, as it scrolls a page; a trackpad's
      // pinch (the browser sends it as a wheel with Ctrl) leaves it, as a pinch does on a phone.
      const now = performance.now()
      if (currentView()) {
        if (event.ctrlKey) {
          exitAsked.current = true
          trackpadPinchLeftAt.current = now
          return
        }
        const grab = wallScroll(event.deltaX, event.deltaY)
        panGrab.current.x += grab.x
        panGrab.current.y += grab.y
        return
      }

      // The pinch that left Wall View walks nowhere, until it pauses.
      if (event.ctrlKey && now - trackpadPinchLeftAt.current < SWIPE_GAP_MS) {
        trackpadPinchLeftAt.current = now
        return
      }

      // The swipe's way is read from its last moments (`readSwipe`), so a turn's momentum never keeps
      // the next swipe from walking, nor a walk's from turning; a wobble midway changes nothing.
      const { grabX, walkY } = readSwipe(swipe.current, event.deltaX, event.deltaY, now)
      mouseState.current.grabX += grabX
      mouseState.current.wheelZ += walkY * 0.002
    },
    [currentView],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('wheel', onWheel)
    }
  }, [
    onKeyDown,
    onKeyUp,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
  ])

  // Leaving the room puts the cursor back.
  useEffect(
    () => () => {
      gl.domElement.style.cursor = ''
    },
    [gl],
  )

  /** Adopts a heading something else gave the camera (`lookAt`): level, and nothing under way. */
  const adoptHeading = (cam: PerspectiveCamera) => {
    const forward = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    yaw.current = yawTarget.current = yawOf(forward.x, forward.z)
    pitch.current = pitchTarget.current = 0
    turnVelocity.current = 0
    tiltVelocity.current = 0
    if (glide.current?.kind === 'focus') dispatch(clearFocusTarget())
    glide.current = null
    artworkView.current = null
    shift.current = NO_SHIFT
  }

  /** The lens as it should be this frame: the eye's own, shifted in Artwork View. */
  const applyLens = (cam: PerspectiveCamera, width: number, height: number) => {
    cam.fov = cameraFOV
    if (isShifted(shift.current) && width > 0 && height > 0) {
      const offset = viewOffsetFor(shift.current, cam.fov, width, height)
      cam.setViewOffset(width, height, offset.x, offset.y, width, height)
    } else if (cam.view?.enabled) {
      cam.clearViewOffset()
    } else {
      cam.updateProjectionMatrix()
    }
  }

  useFrame((state, delta) => {
    const cam = state.camera as PerspectiveCamera
    const { width, height } = state.size
    const dt = Math.min(delta, MAX_FRAME_DELTA)
    const frames = dt * 60
    const now = state.clock.elapsedTime

    // Something else turned the camera since the last frame: carry on from its heading.
    if (!cam.quaternion.equals(applied.current)) adoptHeading(cam)

    // The page shows its Exit Wall View button while the visitor is in Wall View (or on the way).
    const inView = !!currentView()
    if (inView !== toldInView.current) {
      toldInView.current = inView
      dispatch(setInArtworkView(inView))
    }

    // A phone turned in Artwork View (or on its way there): once its screen has settled in its new
    // shape (Safari resizes in steps as its bars move), stand where the work fits this one.
    const fit = framed.current
    if (
      isPhone &&
      fit &&
      currentView()?.artworkId === fit.target.artworkId &&
      Math.abs(cam.aspect - fit.aspect) > 0.01
    ) {
      if (!reshaping.current || reshaping.current.aspect !== cam.aspect) {
        reshaping.current = { aspect: cam.aspect, at: now }
      } else if (now - reshaping.current.at >= REFIT_SETTLE_S) {
        focusOn(fit.target)
      }
    } else {
      reshaping.current = null
    }

    const finish = () => {
      cam.rotation.set(pitch.current, yaw.current, 0, 'YXZ')
      applied.current.copy(cam.quaternion)
      applyLens(cam, width, height)
    }

    // Freeze the visitor while the "Leave the exhibition?" dialog is up.
    // Window-level key and mouse listeners keep firing behind a modal, so
    // without this the scene drifts under the dialog while they read it.
    // Keys held when it opened are cleared too: their keyup may land on the
    // dialog and never reach us, which would leave the visitor walking the
    // moment it closes. A walk under way stops where it is.
    if (isExitPromptOpen) {
      keysPressed.current = {}
      yawTarget.current = yaw.current
      pitchTarget.current = pitch.current
      turnVelocity.current = 0
      tiltVelocity.current = 0
      pinchPending.current = 0
      touchGrab.current = { x: 0, y: 0 }
      panGrab.current = { x: 0, y: 0 }
      panPending.current = { x: 0, y: 0 }
      panVelocity.current = { x: 0, y: 0 }
      pendingTap.current = null
      if (glide.current?.kind === 'walk') glide.current = null
      if (mouseState.current) {
        mouseState.current.wheelZ = 0
        mouseState.current.grabX = 0
        mouseState.current.grabY = 0
      }
      finish()
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
        adoptHeading(cam)
        initialPositionSet.current = true
      }
      finish()
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
        adoptHeading(cam)
        initialPositionSet.current = true
      } else if (initialCameraPosition && initialCameraDirection) {
        // GLB initialPoint data arrived — set position (also handled by useLayoutEffect)
        const [px, pz] = initialCameraPosition
        const [dx, dz] = initialCameraDirection
        cam.position.set(px, cameraElevation, pz)
        cam.lookAt(new Vector3(px + dx, cameraElevation, pz + dz))
        adoptHeading(cam)
        initialPositionSet.current = true
      } else if (spaceConfig.defaultCameraPosition) {
        // Fallback: static space config
        const [x, z] = spaceConfig.defaultCameraPosition
        cam.position.set(x, cameraElevation, z)
        cam.lookAt(new Vector3(x, cameraElevation, z - 5))
        adoptHeading(cam)
        initialPositionSet.current = true
      }
      // If none matched, skip — don't default to (0,0,0), wait for data
      if (!initialPositionSet.current) return
      finish()
      return
    }

    // Every entry (AR-177, owner, 2026-11-05: "always"): a word on how to walk, a little after the room
    // appears; gone at the first walk, or after a while. It waits while a notice or the guide
    // covers the room (the Sound & Video notice opens on entry), and its time runs only while seen.
    if (hintPhase.current === 'unchecked') {
      hintPhase.current = 'due'
      hintAt.current = now + 1.2
    }
    if (
      (hintPhase.current === 'due' || hintPhase.current === 'showing') &&
      now - uncoveredCheckedAt.current > 0.25
    ) {
      uncoveredCheckedAt.current = now
      const rect = gl.domElement.getBoundingClientRect()
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      roomUncovered.current = top === gl.domElement
    }
    if (hintPhase.current === 'due' && now >= hintAt.current && roomUncovered.current) {
      hintPhase.current = 'showing'
      hintSeen.current = 0
      // On the floor's nearest stretch the eye sees (the screen's bottom edge is that far ahead,
      // eye height over the half lens), a little beyond it, or short of a wall nearer than that.
      const ahead = new Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
      const nearestSeen = cameraElevation / Math.tan((cameraFOV * Math.PI) / 360)
      const wanted = Math.max(HINT_DISTANCE, nearestSeen + HINT_BEYOND)
      const wall = firstRoomHit(cam.position, ahead, wanted + WALL_CLEARANCE, meshesOfRoom())
      const reach = wall ? Math.max(1, wall.distance - WALL_CLEARANCE) : wanted
      setHint({
        x: cam.position.x + ahead.x * reach,
        z: cam.position.z + ahead.z * reach,
        // Anywhere in the room moves you: the floor walks there, a wall walks up to it (AR-177, owner,
        // 2026-11-05).
        lines: isTouch
          ? [
              { gesture: 'tap', text: 'Tap anywhere in the room to move' },
              { gesture: 'drag-finger', text: 'Drag to look around' },
            ]
          : [
              { gesture: 'click', text: 'Click anywhere in the room to move' },
              { gesture: 'drag-mouse', text: 'Drag to look around' },
            ],
      })
    } else if (hintPhase.current === 'showing') {
      if (roomUncovered.current) hintSeen.current += dt
      if (hintSeen.current > HINT_MAX_S) dismissHint()
    }

    // When the Eye Level slider changes, the camera settles at the new height. Artwork View frames
    // a high work with the lens, not by rising; only in Wall View does the visitor raise or lower
    // the eye over the wall, and out of it the eye floats back down to its height.
    if (isReturningToElevation.current) {
      cam.position.y += (cameraElevation - cam.position.y) * 0.03
      if (Math.abs(cam.position.y - cameraElevation) < 0.005) {
        cam.position.y = cameraElevation
        isReturningToElevation.current = false
      }
    } else if (!currentView() && cam.position.y !== cameraElevation) {
      cam.position.y += (cameraElevation - cam.position.y) * (1 - Math.exp(-dt / FLOAT_DOWN_S))
      if (Math.abs(cam.position.y - cameraElevation) < 0.001) cam.position.y = cameraElevation
    }

    const mouse = mouseState.current

    // A tap or click waiting since the last frame: the camera is still where the visitor saw it.
    if (pendingTap.current) {
      const { x, y } = pendingTap.current
      pendingTap.current = null
      handleTap(x, y, now)
    }

    // The Exit Wall View button, Escape or a pinch: a step back from the wall, floating down.
    if (exitAsked.current) {
      exitAsked.current = false
      exitArtworkView(now)
    }

    // The glide in progress.
    const g = glide.current
    if (g) {
      g.elapsed += dt
      const t = Math.min(1, g.elapsed / g.duration)
      const e = g.ease(t)
      const x = g.fromX + (g.toX - g.fromX) * e
      const z = g.fromZ + (g.toZ - g.fromZ) * e
      if (g.kind === 'walk') {
        // The way there was checked before setting off; this is the last word, should a corner
        // the straight line grazed come too near: the walk ends at the last safe point.
        const step = new Vector3(x - cam.position.x, 0, z - cam.position.z)
        if (detectCollisions(cam, step, meshesOfRoom(), collisionDistance, isPhone)) {
          glide.current = null
        } else {
          cam.position.set(x, cam.position.y, z)
        }
      } else {
        cam.position.set(x, cam.position.y, z)
        yaw.current = yawTarget.current = g.yawFrom + (g.yawTo - g.yawFrom) * e
        // A focus glide turns the camera itself: a drag meanwhile is dropped, not saved up.
        if (mouse) {
          mouse.grabX = 0
          mouse.grabY = 0
        }
        touchGrab.current = { x: 0, y: 0 }
      }
      if (g.heightFrom !== null) cam.position.y = g.heightFrom + (g.heightTo - g.heightFrom) * e
      pitch.current = pitchTarget.current = g.pitchFrom * (1 - e)
      shift.current = lerpShift(g.shiftFrom, g.shiftTo, e)
      if (t >= 1 && glide.current === g) {
        glide.current = null
        if (g.view) {
          yaw.current = yawTarget.current = g.yawTo
          artworkView.current = g.view
          dispatch(clearFocusTarget())
        }
      }
    } else if (!artworkView.current && isShifted(shift.current)) {
      // Stepped back from a work some other way: the lens comes home, gently.
      const keep = Math.pow(1 - SHIFT_RELEASE_RATE, frames)
      shift.current = { x: shift.current.x * keep, y: shift.current.y * keep }
      if (!isShifted(shift.current)) shift.current = NO_SHIFT
    }

    // Turning: a drag, a finger, the trackpad's swipe, each grabbing the room. Where the head is
    // headed; the view eases after it below, every frame alike. A pixel dragged turns the head by
    // the angle a pixel spans at the middle of this screen with this lens (`LOOK_GRAB_SCALE` of it).
    const tanHalf = Math.tan((cameraFOV * Math.PI) / 360)
    const grabRate = height > 0 ? (tanHalf / (height / 2)) * LOOK_GRAB_SCALE : 0
    // In Wall View the mouse grabs the wall, not the room: its drag moves over it (below).
    const view = artworkView.current
    const onWall = !!view && !glide.current
    if (onWall && mouse) {
      panGrab.current.x += mouse.grabX
      panGrab.current.y += mouse.grabY
      mouse.grabX = 0
      mouse.grabY = 0
    }
    // A finger turns at least `MIN_TOUCH_SLIDE_TURN` for a slide across the screen.
    const touchTurnRate = width > 0 ? Math.max(grabRate, MIN_TOUCH_SLIDE_TURN / width) : grabRate
    const turned = (mouse?.grabX ?? 0) * grabRate + touchGrab.current.x * touchTurnRate
    yawTarget.current += turned

    // Frame-rate independent: `moveSpeed` is the per-frame distance at 60fps,
    // so scale it by how long this frame actually took. Clamped, or a hitch
    // becomes one huge step that tunnels through collision. In Wall View the keys move over the
    // wall instead (below).
    const frameSpeed = moveSpeed * frames
    const moveVector = currentView()
      ? new Vector3()
      : calculateMovementVector(keysPressed, frameSpeed, cam)

    // Add wheel-based forward/backward movement (clamped to prevent wall pass-through)
    const forward = new Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
    if (mouse?.wheelZ) {
      const clampedWheel = Math.max(-MAX_STEP, Math.min(MAX_STEP, -mouse.wheelZ))
      moveVector.addScaledVector(forward, clampedWheel)
      mouse.wheelZ = 0
    }

    // A pinch's step: the distance the fingers spread, walked a share each frame, so it glides
    // evenly however the touch events fall, and eases to a stop once they lift. Along the heading,
    // never the tilt.
    if (pinchPending.current !== 0) {
      const share = 1 - Math.exp(-dt / PINCH_SMOOTHING_S)
      const pinchStep = clamp(pinchPending.current * share, -MAX_STEP, MAX_STEP)
      pinchPending.current -= pinchStep
      if (Math.abs(pinchPending.current) < 0.0005) pinchPending.current = 0
      moveVector.addScaledVector(forward, pinchStep)
    }

    // In Wall View (Artwork View), every move travels over the wall, never turning: a finger or two,
    // the mouse's drag, a swipe or a wheel (each a grab of the wall, px), or the keys. A pixel moves
    // the eye the width a pixel spans on the wall at this distance, so the wall keeps (nearly,
    // `LOOK_GRAB_SCALE`) under the hand: a slide right brings the wall right, the eye steps left; a
    // slide down brings it down, the eye rises. Eased as every look is; a hand's move carries on,
    // slowing, once it lets go (a swipe has the Mac's own momentum). Along the wall the eye walks, up
    // it the eye rises or sinks, inside the placeholder's four limits. Not while the glide to the
    // work is arriving.
    const wallStep = new Vector3()
    if (view && onWall) {
      const perPx = grabRate * view.depth
      const keys = wallMoveKeys(keysPressed)
      const keySpeed = WALL_VIEW_KEY_SPEED * 2 * view.depth * tanHalf
      const asked = {
        x: -panGrab.current.x * perPx + keys.x * keySpeed * dt,
        y: panGrab.current.y * perPx + keys.y * keySpeed * dt,
      }
      const handOn =
        looking(touchGesture.current) ||
        sliding(touchGesture.current) ||
        (!!mouse && dragging(mouse))
      const pending = panPending.current
      const velocity = panVelocity.current
      for (const axis of ['x', 'y'] as const) {
        if (handOn && dt > 0) {
          const read = 1 - Math.exp(-dt / LOOK_VELOCITY_SMOOTHING_S)
          velocity[axis] += (asked[axis] / dt - velocity[axis]) * read
          velocity[axis] = clamp(velocity[axis], -MAX_PAN_SPEED, MAX_PAN_SPEED)
        } else if (velocity[axis] !== 0) {
          pending[axis] += velocity[axis] * dt
          velocity[axis] *= Math.exp(-dt / LOOK_INERTIA_S)
          if (Math.abs(velocity[axis]) < 0.01) velocity[axis] = 0
        }
        pending[axis] += asked[axis]
      }
      const ease = 1 - Math.exp(-dt / LOOK_SMOOTHING_S)
      const step = {
        x: clamp(pending.x * ease, -MAX_STEP, MAX_STEP),
        y: clamp(pending.y * ease, -MAX_STEP, MAX_STEP),
      }
      // The placeholder's four limits; a work whose placeholder can't be found keeps between the
      // floor and a rise, and only the walls stop it along.
      const right = rightOf(view.yaw)
      const along = cam.position.x * right.x + cam.position.z * right.z
      const allowed = {
        x: view.limits ? limitStep(along, step.x, view.limits.along) : step.x,
        y: limitStep(
          cam.position.y,
          step.y,
          view.limits?.height ?? {
            min: FLOOR_Y + WALL_VIEW_FLOOR_GAP,
            max: cameraElevation + WALL_VIEW_UNKNOWN_RISE,
          },
        ),
      }
      for (const axis of ['x', 'y'] as const) {
        // At a limit the move stops there, rather than pressing on.
        if (allowed[axis] !== step[axis]) pending[axis] = velocity[axis] = 0
        else pending[axis] -= step[axis]
        if (Math.abs(pending[axis]) < 0.0005) pending[axis] = 0
      }
      if (allowed.x !== 0 || allowed.y !== 0) {
        if (framed.current) framed.current.moved = true
        // Along a placeholder that is found, its own ends stop the eye, never the room around it
        // (an isolated wall, a panel); without one, the walls do.
        if (view.limits) wallStep.set(right.x * allowed.x, 0, right.z * allowed.x)
        else moveVector.add(new Vector3(right.x * allowed.x, 0, right.z * allowed.x))
        wallStep.y = allowed.y
      }
    } else {
      panPending.current = { x: 0, y: 0 }
      panVelocity.current = { x: 0, y: 0 }
    }
    panGrab.current = { x: 0, y: 0 }

    if (moveVector.lengthSq() > 0) {
      // Walking another way takes over from a glide.
      if (glide.current) {
        if (glide.current.kind === 'focus') dispatch(clearFocusTarget())
        glide.current = null
      }
      if (detectCollisions(cam, moveVector, meshesOfRoom(), collisionDistance, isPhone)) {
        // Walked into a wall: a pinch's glide, or a move along the wall, stops there.
        pinchPending.current = 0
        panPending.current = { x: 0, y: 0 }
        panVelocity.current = { x: 0, y: 0 }
      } else {
        cam.position.add(moveVector)
      }
    }
    cam.position.add(wallStep)

    // The head: it tilts only while the visitor stands still, and levels as soon as they move.
    const moving =
      !!glide.current ||
      moveVector.lengthSq() > 0 ||
      wallStep.lengthSq() > 0 ||
      pinchPending.current !== 0
    const tilt = ((mouse?.grabY ?? 0) + touchGrab.current.y) * grabRate
    if (mouse) mouse.grabY = 0
    touchGrab.current = { x: 0, y: 0 }
    let tilted = 0
    if (!moving && tilt !== 0) {
      const before = pitchTarget.current
      pitchTarget.current = clamp(pitchTarget.current + tilt, -PITCH_LIMIT, PITCH_LIMIT)
      tilted = pitchTarget.current - before
    } else if (moving && !glide.current && pitchTarget.current !== 0) {
      pitchTarget.current *= Math.pow(1 - PITCH_LEVEL_RATE, frames)
      if (Math.abs(pitchTarget.current) < 0.001) pitchTarget.current = 0
    }

    // Inertia: while a drag looks around, its speed is read (eased, so a drag held still before
    // letting go comes to rest); once it lets go, the head carries on at that speed, slowing.
    const handOn = (!!mouse && dragging(mouse)) || looking(touchGesture.current)
    if (handOn && dt > 0) {
      const read = 1 - Math.exp(-dt / LOOK_VELOCITY_SMOOTHING_S)
      turnVelocity.current += (turned / dt - turnVelocity.current) * read
      tiltVelocity.current += (tilted / dt - tiltVelocity.current) * read
      turnVelocity.current = clamp(turnVelocity.current, -MAX_LOOK_SPEED, MAX_LOOK_SPEED)
      tiltVelocity.current = clamp(tiltVelocity.current, -MAX_LOOK_SPEED, MAX_LOOK_SPEED)
    } else if (turnVelocity.current !== 0 || tiltVelocity.current !== 0) {
      yawTarget.current += turnVelocity.current * dt
      if (moving) {
        tiltVelocity.current = 0
      } else {
        const before = pitchTarget.current
        pitchTarget.current = clamp(before + tiltVelocity.current * dt, -PITCH_LIMIT, PITCH_LIMIT)
        // At the tilt's limit the head stops there, rather than pressing on.
        if (pitchTarget.current === before) tiltVelocity.current = 0
      }
      const keep = Math.exp(-dt / LOOK_INERTIA_S)
      turnVelocity.current *= keep
      tiltVelocity.current *= keep
      if (Math.abs(turnVelocity.current) < LOOK_REST_SPEED) turnVelocity.current = 0
      if (Math.abs(tiltVelocity.current) < LOOK_REST_SPEED) tiltVelocity.current = 0
    }

    // The view follows the head's heading and tilt, eased over time: the same share of the way
    // each frame for the same time passed, so it moves evenly however the input arrived.
    const follow = 1 - Math.exp(-dt / LOOK_SMOOTHING_S)
    yaw.current += (yawTarget.current - yaw.current) * follow
    if (Math.abs(yawTarget.current - yaw.current) < 1e-5) yaw.current = yawTarget.current
    pitch.current += (pitchTarget.current - pitch.current) * follow
    if (Math.abs(pitchTarget.current - pitch.current) < 1e-5) pitch.current = pitchTarget.current

    if (mouse) mouse.grabX = 0

    // Under the mouse, where a click would walk (laptops and desktops): the ring follows it (when
    // the floor shows rings), or over a work, the cursor says it can be clicked. In Wall View, off a
    // work, a hand says the wall can be grabbed.
    if (!isTouch && mouse) {
      if (mouse.hoverMoved || moving) {
        mouse.hoverMoved = false
        let spot: Vector3 | null = null
        let overObject = false
        if (mouse.hover && !mouse.pressed) {
          const ray = rayAt(mouse.hover.x, mouse.hover.y)
          overObject = objectFirst(ray)
          if (!overObject && SHOW_FLOOR_RINGS)
            spot = tapDestination(ray.clone(), cam.position.clone())
        }
        marks.current.hover = spot ? { x: spot.x, z: spot.z } : null
        hoverOverObject.current = overObject
      }
      const cursor = hoverOverObject.current
        ? 'pointer'
        : onWall
          ? mouse.pressed
            ? 'grabbing'
            : 'grab'
          : ''
      if (gl.domElement.style.cursor !== cursor) gl.domElement.style.cursor = cursor
    }

    finish()
  })

  return <FloorMarks marks={marks.current} hint={hint} />
}

export default MainCamera
