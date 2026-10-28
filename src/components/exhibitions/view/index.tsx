'use client'

import { useProgress } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Info,
  Mouse,
  Touchpad,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import Monogram from '@/icons/monogram.svg'
import { preloadFloorMaterial } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { ArtworkPanel } from '@/components/editview/ArtworkPanel'
import { ArtworkModal } from '@/components/exhibitions/view/ArtworkModal/ArtworkModal'
import { ExitPrompt } from '@/components/exhibitions/ExitPrompt'
import { Scene } from '@/components/scene'
import { useWebGLAvailable } from '@/components/scene/webglSupport'
import { useCanEnterWalkthrough } from '@/hooks/useCanEnterWalkthrough'
import { useLoadExhibitionArtworks } from '@/hooks/useLoadExhibitionArtworks'
import { useGetExhibitionByUrlQuery } from '@/redux/slices/exhibitionApi'
import { setExhibition } from '@/redux/slices/exhibitionSlice'
import {
  bakeSettled,
  resetBakeProgress,
  setBakeProgress,
  useBakeProgress,
} from '@/components/scene/bake/bakeProgress'
import type { BakeRunnerProps } from '@/components/scene/bake/BakeRunner'
import { useCanBake } from '@/components/scene/bake/bakeSupport'
import { BakePageProvider, type BakePage } from '@/components/scene/bake/bakePage'
import {
  lookFor,
  shownStoredBake,
  useShownStoredBake,
  useStoredBakeFailed,
} from '@/components/scene/bake/bakedLook'
import { preloadStoredBake } from '@/components/scene/bake/BakedLighting'
import { useLightmapBytes } from '@/components/scene/bake/lightmapLoader'
import { useSceneFailed } from '@/components/scene/sceneFailure'
import { MonogramLoader } from '@/components/ui/MonogramLoader'
import { closeArtworkModal } from '@/redux/slices/dashboardSlice'
import {
  declineExit,
  hidePlaceholders,
  openExitPrompt,
  resetScene,
} from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { AppDispatch, RootState } from '@/redux/store'
import type { TExhibition } from '@/types/exhibition'
import { isBakeRecord } from '@/lib/bake/bakeRecord'
import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import { bakePageUrl } from '@/lib/bake/bakePageUrl'
import { Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import Tooltip from '@/components/ui/Tooltip/Tooltip'
import { BakeActions, BakeAdminBar } from './BakeAdmin/BakeAdmin'
import styles from './ExhibitionView.module.scss'
import { getConsent, CONSENT_CHANGE_EVENT } from '@/lib/consent'

const NavigationButton = () => {
  const router = useRouter()
  const dispatch = useDispatch()
  // Shared with the in-scene exit threshold: walking out of the corridor and
  // clicking this button raise the same single dialog.
  const promptOpen = useSelector((state: RootState) => state.scene.isExitPromptOpen)

  // Every in-scene exit lands here — the prompt's Leave button, the corner X
  // (which only opens that prompt), and walking into the exit corridor.
  //
  // It goes to the exhibitions index, NOT back to the exhibition just left.
  // Someone who has decided to leave a show has finished with it; returning them
  // to its own page offers the one thing they already declined. The index is
  // where the other exhibitions are.
  //
  // This also replaces a `sessionStorage` round trip that read back a
  // `returnUrl` written on entry — which was always this exhibition's own page,
  // so both branches landed in the same place anyway.
  const leave = () => {
    router.push('/exhibitions')
  }

  return (
    <>
      <div className={styles.navigationButtonWrapper}>
        <Tooltip label="Leave Exhibition" placement="left">
          <Button
            variant="ghost"
            onClick={() => dispatch(openExitPrompt())}
            className={styles.navigationButton}
            aria-label="Leave Exhibition"
          >
            <X size={20} strokeWidth={ICON_STROKE_WIDTH} />
          </Button>
        </Tooltip>
      </div>

      <ExitPrompt open={promptOpen} onLeave={leave} onCancel={() => dispatch(declineExit())} />
    </>
  )
}

interface ExhibitionViewPageProps {
  artistSlug: string
  exhibitionSlug: string
}

const VISITOR_LOADER_TITLE = 'Preparing the exhibition'
const BAKE_LOADER_TITLE = 'Lighting the room'
const BAKE_LOADER_NOTE =
  'This takes a few minutes. Keep this tab open and in front, with the display awake.'

// Asset loading is the first tenth of the bar; a bake on the page (minutes, not seconds) is the
// rest. Visitors, with no bake, get the whole bar for the assets.
const ASSET_SHARE = 0.1
// The admin's bake: the light is most of its part of the bar, storing it (seconds) the rest.
const BAKE_SHARE = 0.92
// A stored bake's maps are about half of a baked room's download: half the bar follows their
// bytes, the other half the room's assets counted by file.
const BAKE_MAPS_SHARE = 0.5
const NO_URLS: readonly string[] = []

/**
 * AR-161: what the visit page is for. `bake` / `review`: the admin's bake and review pages
 * (`?bake=1`, `?review=1`), on the saved draft; anyone else gets the visit.
 */
type PageMode = BakePage['mode']

interface LoadingOverlayProps {
  mode: PageMode
  /** Once the room is revealed with its stored bake on — never when the bake failed to go on. */
  onRevealed?: () => void
}

const LoadingOverlay = ({ mode, onRevealed }: LoadingOverlayProps) => {
  const { active, progress } = useProgress()
  const bake = useBakeProgress()
  // A stored bake that will be shown (`shownStoredBake`) only downloads (its files are assets) but
  // goes on after the artworks have loaded: the room stays covered until it is on
  // (`BakedLighting`). One that failed is not waited for: the room is back in today's look.
  const shownBake = useShownStoredBake()
  const storedBake = shownBake !== null
  const mapBytes = useLightmapBytes(shownBake ? shownBake.maps.map((m) => m.url) : NO_URLS)
  // Bake mode: the admin's bake.
  const bakes = mode === 'bake'
  // A crashed scene never finishes loading: step aside for its error message at once.
  const sceneFailed = useSceneFailed()

  // Today's look, after a stored bake failed, loads assets of its own (its floor): a second round
  // of loads to wait for. Assets are ready for a round once nothing has loaded for 100 ms.
  const assetsRound = useStoredBakeFailed() ? 1 : 0
  const [assetsReadyRound, setAssetsReadyRound] = useState(-1)
  useEffect(() => {
    if (!active && progress >= 100) {
      const timer = setTimeout(() => setAssetsReadyRound(assetsRound), 100)
      return () => clearTimeout(timer)
    }
  }, [active, progress, assetsRound])
  const assetsReady = assetsReadyRound === assetsRound

  const assets = Math.min(1, progress / 100)
  // Latched: once the room is ready the loader only fades, even if the bake store resets.
  const [done, setDone] = useState(false)
  // A stored bake that failed ends the bake wait (the room is in today's look). Bake mode never
  // reveals the room — the admin sees the bake in review, as stored — so only an error ends it there.
  const ready =
    sceneFailed || (mode !== 'bake' && assetsReady && (!(bakes || storedBake) || bakeSettled(bake)))
  useEffect(() => {
    if (ready) setDone(true)
  }, [ready])
  const revealedWithBake = done && !sceneFailed && storedBake && bake.phase === 'finished'
  useEffect(() => {
    if (revealedWithBake) onRevealed?.()
  }, [revealedWithBake, onRevealed])
  const fraction = bakes
    ? ASSET_SHARE * assets + (1 - ASSET_SHARE) * bake.fraction
    : storedBake
      ? (1 - BAKE_MAPS_SHARE) * assets + BAKE_MAPS_SHARE * mapBytes
      : assets

  return (
    <MonogramLoader
      progress={fraction}
      done={done}
      title={bakes ? BAKE_LOADER_TITLE : VISITOR_LOADER_TITLE}
      note={bakes ? BAKE_LOADER_NOTE : undefined}
    />
  )
}

type ReviewState = 'pending' | 'reviewed' | 'refused' | 'failed'

const REVIEW_STATUS: Record<ReviewState, string> = {
  pending: 'Loading the baked room…',
  reviewed: 'Reviewed. This bake can be published.',
  refused: 'The room changed since this bake. Bake again before publishing.',
  failed: "The review couldn't be recorded. Reload the page to try again.",
}

/** The review page's admin bar; reads the bake's progress itself (so the page doesn't re-render). */
const ReviewBar = ({
  review,
  bakeHref,
  editorHref,
}: {
  review: ReviewState
  bakeHref: string
  editorHref: string
}) => {
  // A failed bake leaves the room in today's look (`shownStoredBake`).
  const status = useStoredBakeFailed()
    ? "This bake couldn't be shown on the room. Bake again."
    : REVIEW_STATUS[review]
  return <BakeAdminBar status={status} bakeHref={bakeHref} editorHref={editorHref} />
}

const MobileExhibitionView = ({
  artistSlug,
  exhibitionSlug,
}: {
  artistSlug: string
  exhibitionSlug: string
}) => {
  return (
    <div className={styles.mobileOverlay}>
      <div className={styles.mobileOverlayContent}>
        <Text as="h2" size="lg" font="serif" className={styles.mobileOverlayTitle}>
          Step inside on a bigger screen
        </Text>
        <Text as="p" size="md" className={styles.mobileOverlayText}>
          This immersive space is best explored on a laptop or desktop, where there&apos;s room to
          roam — but you won&apos;t miss a thing in the meantime. The full exhibition, with every
          artwork, is right here on the exhibition page.
        </Text>
        <Link
          href={`/exhibitions/${artistSlug}/${exhibitionSlug}`}
          className={styles.mobileOverlayButton}
        >
          View the full exhibition
        </Link>
      </div>
    </div>
  )
}

// Nav help is dismissed globally — once a visitor learns the controls,
// they don't need to re-learn them per exhibition.
const NAVIGATION_HELP_STORAGE_KEY = 'the-art-room:navigation-help-dismissed'

// Media notice is dismissed PER exhibition: each exhibition with audio /
// video needs to warn the visitor fresh, since sound is exhibition-
// specific (the user has to know which rooms to turn the volume up for).
// Key shape: `${MEDIA_NOTICE_STORAGE_PREFIX}${exhibitionId}`.
const MEDIA_NOTICE_STORAGE_PREFIX = 'the-art-room:media-notice-dismissed:'

interface NavigationHelpModalProps {
  hidden?: boolean
  /** ID of the exhibition currently being viewed. */
  exhibitionId?: string
  /** True once `state.artworks.byId` has been populated for the current
   *  exhibition (vs. still holding the previous exhibition's data). Auto-
   *  show is gated on this so we don't read stale artworks and warn
   *  about media that isn't here. */
  artworksReady?: boolean
}

type ModalStep = 'none' | 'help' | 'media'

const NavigationHelpModal = ({ hidden, exhibitionId, artworksReady }: NavigationHelpModalProps) => {
  const [currentStep, setCurrentStep] = useState<ModalStep>('none')
  const [helpDismissed, setHelpDismissed] = useState(false)
  const [mediaDismissed, setMediaDismissed] = useState(false)
  const hasCheckedStorage = useRef(false)

  // Detect if exhibition has video or sound artworks
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const hasMediaArtworks = useMemo(() => {
    return Object.values(artworksById).some((artwork) => artwork.soundUrl || artwork.videoUrl)
  }, [artworksById])

  // The cookie banner and this guide are both "first visit" surfaces, and they
  // used to open on top of each other — an empty localStorage means no consent
  // decision AND no dismissal flag, which is exactly what a genuinely new
  // visitor has. Consent wins the race: it is a legal gate, it is site-wide and
  // it is answered once ever, whereas this guide is per-visitor and can wait the
  // moment it takes to click Accept or Decline.
  const [consentSettled, setConsentSettled] = useState(false)

  useEffect(() => {
    // Read in an effect rather than in the initial state, so the server and the
    // first client render agree (localStorage does not exist during SSR).
    if (getConsent() !== null) {
      setConsentSettled(true)
      return
    }
    const onDecision = () => setConsentSettled(true)
    window.addEventListener(CONSENT_CHANGE_EVENT, onDecision)
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onDecision)
  }, [])

  // Auto-show on mount: help first, then media. Gated on `artworksReady`
  // so navigating exhibition A → B doesn't trigger the media modal for B
  // based on A's still-cached artworks in Redux.
  useEffect(() => {
    if (!exhibitionId || !artworksReady || !consentSettled) return
    if (hasCheckedStorage.current) return
    hasCheckedStorage.current = true

    const isMobile = window.innerWidth < 1024
    if (isMobile) return

    try {
      const helpDone = localStorage.getItem(NAVIGATION_HELP_STORAGE_KEY) === 'true'
      const mediaKey = `${MEDIA_NOTICE_STORAGE_PREFIX}${exhibitionId}`
      const mediaDone = localStorage.getItem(mediaKey) === 'true'

      if (helpDone) setHelpDismissed(true)
      if (mediaDone) setMediaDismissed(true)

      if (!helpDone) {
        const timer = setTimeout(() => setCurrentStep('help'), 500)
        return () => clearTimeout(timer)
      } else if (!mediaDone && hasMediaArtworks) {
        const timer = setTimeout(() => setCurrentStep('media'), 500)
        return () => clearTimeout(timer)
      }
    } catch {
      setCurrentStep('help')
    }
  }, [exhibitionId, artworksReady, hasMediaArtworks, consentSettled])

  // Track if the current flow was manually triggered (info button)
  const manualTriggerRef = useRef(false)

  const handleCloseHelp = () => {
    setCurrentStep('none')
    // After help closes, show media notice if exhibition has media
    if (hasMediaArtworks && (manualTriggerRef.current || !mediaDismissed)) {
      setTimeout(() => setCurrentStep('media'), 300)
    }
    manualTriggerRef.current = false
  }

  const handleCloseMedia = () => {
    setCurrentStep('none')
    manualTriggerRef.current = false
  }

  const handleInfoClick = () => {
    manualTriggerRef.current = true
    setCurrentStep('help')
  }

  if (hidden) return null

  return (
    <>
      <Button
        variant="ghost"
        onClick={handleInfoClick}
        className={styles.infoButton}
        aria-label="Navigation help"
      >
        <Info size={20} strokeWidth={ICON_STROKE_WIDTH} />
      </Button>

      {/* Help Modal */}
      {currentStep === 'help' && (
        <div className={styles.infoOverlay} onClick={handleCloseHelp}>
          <div className={styles.infoPanel} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              onClick={handleCloseHelp}
              className={styles.infoPanelClose}
              aria-label="Close"
            >
              <X size={16} strokeWidth={ICON_STROKE_WIDTH} />
            </Button>
            <div className={styles.welcomeSection}>
              <Monogram className={styles.welcomeMonogram} />
              <Text as="h2" size="lg" font="sans" className={styles.welcomeTitle}>
                Welcome visitor
              </Text>
              <Text as="p" size="sm" className={styles.welcomeText}>
                You are about to enter an immersive virtual exhibition. Use the controls below to
                explore the space freely.
              </Text>
            </div>
            <Text as="h3" size="md" font="sans" className={styles.infoPanelTitle}>
              Controls
            </Text>
            <div className={styles.infoPanelContent}>
              <div className={styles.infoItem}>
                <div className={styles.infoKeysColumn}>
                  <div className={styles.infoKeys}>
                    <Text as="span" size="sm" className={styles.infoKey}>
                      W
                    </Text>
                    <Text as="span" size="sm" className={styles.infoKey}>
                      A
                    </Text>
                    <Text as="span" size="sm" className={styles.infoKey}>
                      S
                    </Text>
                    <Text as="span" size="sm" className={styles.infoKey}>
                      D
                    </Text>
                  </div>
                  <div className={styles.infoKeys}>
                    <span className={styles.infoKey}>
                      <ArrowUp size={14} strokeWidth={ICON_STROKE_WIDTH} />
                    </span>
                    <span className={styles.infoKey}>
                      <ArrowLeft size={14} strokeWidth={ICON_STROKE_WIDTH} />
                    </span>
                    <span className={styles.infoKey}>
                      <ArrowDown size={14} strokeWidth={ICON_STROKE_WIDTH} />
                    </span>
                    <span className={styles.infoKey}>
                      <ArrowRight size={14} strokeWidth={ICON_STROKE_WIDTH} />
                    </span>
                  </div>
                </div>
                <Text as="span" size="sm">
                  Walk inside the room
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Mouse size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Hold + Drag
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Rotate the view
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Touchpad size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Swipe Left / Right
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Rotate the view
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Touchpad size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Swipe Up / Down
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Walk forward / backward
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Mouse size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Single Click
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Auto focus on any artwork
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Mouse size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Double Click
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Show artwork details
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Volume2 size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Double Click
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Play sound
                </Text>
              </div>
            </div>
            <Text as="p" size="xs" className={styles.infoHint}>
              You can reopen this guide anytime by clicking the{' '}
              <Info size={12} strokeWidth={ICON_STROKE_WIDTH} style={{ verticalAlign: 'middle' }} />{' '}
              icon in the bottom-right corner.
            </Text>
            {!helpDismissed && (
              <Button
                variant="primary"
                size="regularSquared"
                label="Don't show this again"
                className={styles.dismissButton}
                onClick={() => {
                  try {
                    localStorage.setItem(NAVIGATION_HELP_STORAGE_KEY, 'true')
                  } catch {
                    // localStorage not available, ignore
                  }
                  setHelpDismissed(true)
                  handleCloseHelp()
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Media Notice Modal */}
      {currentStep === 'media' && (
        <div className={styles.infoOverlay} onClick={handleCloseMedia}>
          <div className={styles.infoPanel} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              onClick={handleCloseMedia}
              className={styles.infoPanelClose}
              aria-label="Close"
            >
              <X size={16} strokeWidth={ICON_STROKE_WIDTH} />
            </Button>
            <div className={styles.welcomeSection}>
              <Volume2
                size={32}
                strokeWidth={ICON_STROKE_WIDTH}
                style={{ margin: '0 auto var(--space-4)', display: 'block' }}
              />
              <Text as="h2" size="lg" font="sans" className={styles.welcomeTitle}>
                Sound & Video
              </Text>
              <Text as="p" size="sm" className={styles.welcomeText}>
                This exhibition contains artworks with audio and video. Make sure your volume is
                turned on for the full experience. You can mute all sounds at any time using the
                volume icon in the bottom-right corner.
              </Text>
            </div>
            <div className={styles.infoPanelContent}>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Volume2 size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Click
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Mute
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <VolumeX size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Click
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Unmute
                </Text>
              </div>
            </div>
            {!mediaDismissed && (
              <Button
                variant="primary"
                size="regularSquared"
                label="Don't show this again"
                className={styles.dismissButton}
                onClick={() => {
                  try {
                    if (exhibitionId) {
                      localStorage.setItem(`${MEDIA_NOTICE_STORAGE_PREFIX}${exhibitionId}`, 'true')
                    }
                  } catch {
                    // localStorage not available, ignore
                  }
                  setMediaDismissed(true)
                  handleCloseMedia()
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

export const ExhibitionViewPage = ({ artistSlug, exhibitionSlug }: ExhibitionViewPageProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const hasResetRef = useRef<string | null>(null)
  const searchParams = useSearchParams()
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const isArtworkModalOpen = useSelector((state: RootState) => state.dashboard.isArtworkModalOpen)
  const canEnterWalkthrough = useCanEnterWalkthrough()

  // AR-161: `?bake=1` bakes the room on the admin's machine and stores it as the draft bake;
  // `?review=1` shows the draft bake exactly as visitors will get it. Admins only — anyone else
  // gets the visit (the server enforces it too). Both work on the saved draft (`mode: 'edit'`).
  const { data: session, status: sessionStatus } = useSession()
  const asksBake = searchParams.get('bake') === '1'
  const asksAdminPage = asksBake || searchParams.get('review') === '1'
  const userType = session?.user?.userType
  const isAdmin = userType === 'admin' || userType === 'superAdmin'
  // A bake or review link waits for the session rather than starting a visit.
  const sessionPending = asksAdminPage && sessionStatus === 'loading'
  const mode: PageMode = asksAdminPage && isAdmin ? (asksBake ? 'bake' : 'review') : 'visit'
  const adminPage = mode !== 'visit'
  const previewToken = adminPage ? undefined : searchParams.get('preview') || undefined

  const { data, isLoading, fulfilledTimeStamp, error } = useGetExhibitionByUrlQuery(
    adminPage
      ? { url: exhibitionSlug, mode: 'edit' }
      : { url: exhibitionSlug, ...(previewToken && { preview: previewToken }) },
    {
      skip: !exhibitionSlug || sessionPending,
      refetchOnMountOrArgChange: adminPage,
    },
  )
  // The bake and review pages read the saved draft fresh: never a copy cached before they opened
  // (the editor's, say), and a later refetch never takes the room away.
  const [openedAt] = useState(() => Date.now())
  const fresh = !adminPage || (fulfilledTimeStamp ?? 0) >= openedAt
  const exhibition = fresh ? data : undefined
  const isApiLoading = sessionPending || isLoading || !fresh

  // AR-161: the draft bake, and whether it is a bake of the room as saved now.
  const draftBake = adminPage && isBakeRecord(exhibition?.bake) ? exhibition.bake : null
  const draftCurrent =
    !!draftBake &&
    !!exhibition?.bakeFingerprint &&
    draftBake.fingerprint === exhibition.bakeFingerprint
  // The bake the room shows: visitors' published one (or a preview's draft); in review the
  // draft, only when current; in bake mode none (the bake runs on the unlit room).
  const roomBake =
    mode === 'visit'
      ? (exhibition?.bake ?? null)
      : mode === 'review' && draftCurrent
        ? draftBake
        : null

  // Keyed on the SLUG, not a boolean. As a boolean this ran once per mount ever,
  // and moving between two exhibitions reuses this component — so switching
  // exhibitions reset nothing and the second one loaded on top of the first.
  // Keyed this way it still does not fire for same-exhibition navigation (the
  // artwork-detail round trip the note below protects), because the slug has not
  // changed.
  useEffect(() => {
    if (hasResetRef.current !== exhibitionSlug) {
      dispatch(resetWallView())
      dispatch(resetScene())
      // Close any stale artwork modal: isArtworkModalOpen lives in dashboardSlice and is
      // only cleared by the modal's own Close. Leaving via Order Print (router.push) leaves
      // it true, and Redux survives client navigation — so without this, the first
      // double-click after re-entering would render the modal instead of the sidebar.
      dispatch(closeArtworkModal())
      // Note: Do NOT call resetArtworks() here - artworks should persist across
      // same-exhibition navigation (e.g., when viewing artwork details and returning).
      // The useLoadExhibitionArtworks hook handles loading artworks when needed.
      dispatch(hidePlaceholders())
      hasResetRef.current = exhibitionSlug
    }
  }, [dispatch, exhibitionSlug])

  useEffect(() => {
    if (exhibition) {
      // Warm the texture cache for this exhibition's floor only — from an
      // effect (not render) so the loading manager's onStart doesn't fire
      // mid-render. Runs before the Scene mounts (it's gated on Redux
      // spaceId, set by the dispatch below), so ReflectiveFloor suspends on
      // this cached promise instead of starting its own load. AR-161: a baked
      // space's approved look shows the space's floor, not the stored one.
      const look = lookFor(
        mode,
        exhibition.spaceId,
        shownStoredBake(exhibition.spaceId, roomBake) !== null,
      )
      preloadFloorMaterial(look.baked ? look.space.floor.material : exhibition.floorMaterial)
      const exhibitionData: TExhibition = {
        id: exhibition.id,
        userId: exhibition.userId,
        name: exhibition.mainTitle,
        mainTitle: exhibition.mainTitle,
        url: exhibition.url,
        thumbnailUrl: exhibition.thumbnailUrl || '',
        spaceId: exhibition.spaceId,
        bannerUrl: exhibition.bannerUrl || '',
        startDate: exhibition.startDate || '',
        endDate: exhibition.endDate || '',
        exhibitionArtworksById: exhibition.exhibitionArtworksById || {},
        allExhibitionArtworkIds: exhibition.allExhibitionArtworkIds || [],
        status: exhibition.status,
        published: exhibition.published ?? false,
        hasPendingChanges: exhibition.hasPendingChanges ?? false,
        previewEnabled: exhibition.previewEnabled ?? false,
        ambientLightColor: exhibition.ambientLightColor ?? undefined,
        ambientLightIntensity: exhibition.ambientLightIntensity ?? undefined,
        skylightColor: exhibition.skylightColor ?? undefined,
        skylightIntensity: exhibition.skylightIntensity ?? undefined,
        ceilingLampColor: exhibition.ceilingLampColor ?? undefined,
        ceilingLampIntensity: exhibition.ceilingLampIntensity ?? undefined,
        trackLampColor: exhibition.trackLampColor ?? undefined,
        trackLampIntensity: exhibition.trackLampIntensity ?? undefined,
        trackLampsVisible: exhibition.trackLampsVisible ?? undefined,
        trackLampAngle: exhibition.trackLampAngle ?? undefined,
        trackLampDistance: exhibition.trackLampDistance ?? undefined,
        trackLampSettings: exhibition.trackLampSettings ?? undefined,
        panelSettings: exhibition.panelSettings ?? undefined,
        benchSettings: exhibition.benchSettings ?? undefined,
        ceilingLightMode: exhibition.ceilingLightMode ?? undefined,
        recessedLampColor: exhibition.recessedLampColor ?? undefined,
        recessedLampIntensity: exhibition.recessedLampIntensity ?? undefined,
        recessedLampAngle: exhibition.recessedLampAngle ?? undefined,
        recessedLampDistance: exhibition.recessedLampDistance ?? undefined,
        trackLampMaterialColor: exhibition.trackLampMaterialColor ?? undefined,
        windowLightColor: exhibition.windowLightColor ?? undefined,
        windowLightIntensity: exhibition.windowLightIntensity ?? undefined,
        windowTransparency: exhibition.windowTransparency ?? undefined,
        hdriRotation: exhibition.hdriRotation ?? undefined,
        // Floor customization
        floorReflectiveness: exhibition.floorReflectiveness ?? undefined,
        floorMaterial: exhibition.floorMaterial ?? undefined,
        floorTextureScale: exhibition.floorTextureScale ?? undefined,
        floorTextureOffsetX: exhibition.floorTextureOffsetX ?? undefined,
        floorTextureOffsetY: exhibition.floorTextureOffsetY ?? undefined,
        floorTemperature: exhibition.floorTemperature ?? undefined,
        floorNormalScale: exhibition.floorNormalScale ?? undefined,
        floorRotation: exhibition.floorRotation ?? undefined,
        // HDRI
        hdriEnvironment: exhibition.hdriEnvironment ?? undefined,
        // Camera settings
        cameraFOV: exhibition.cameraFOV ?? undefined,
        cameraElevation: exhibition.cameraElevation ?? undefined,
        // Wall & Ceiling
        wallColor: exhibition.wallColor ?? undefined,
        ceilingColor: exhibition.ceilingColor ?? undefined,
        windowFrameColor: exhibition.windowFrameColor ?? undefined,
        radiatorColor: exhibition.radiatorColor ?? undefined,
        // Autofocus groups
        autofocusGroups: exhibition.autofocusGroups ?? undefined,
        // AR-161: the baked light (published for visitors, the draft for the admin's review)
        bake: roomBake,
        bakeFingerprint: exhibition.bakeFingerprint,
      }
      dispatch(setExhibition(exhibitionData))
    }
  }, [exhibition, dispatch, roomBake, mode])

  // AR-161: a stored bake's files download with the room's, not after it (`preloadStoredBake`) —
  // only where the room will be shown (never on a phone, or without WebGL).
  const webglAvailable = useWebGLAvailable()
  const preloadBake = exhibition ? shownStoredBake(exhibition.spaceId, roomBake) : null
  useEffect(() => {
    if (preloadBake && canEnterWalkthrough && webglAvailable !== false)
      preloadStoredBake(preloadBake)
  }, [preloadBake, canEnterWalkthrough, webglAvailable])

  // by-url already delivers the (snapshot + live-enriched) exhibition
  // artworks — pass them through so the hook skips its own fetch. The bake
  // and review pages load the saved draft's placements, as the editor does.
  const { loadedExhibitionId } = useLoadExhibitionArtworks(
    exhibition?.id,
    adminPage ? 'edit' : undefined,
    adminPage ? undefined : exhibition?.exhibitionArtworks,
  )
  // Artworks are "ready" for the modal only when Redux holds the
  // current exhibition's data. Avoids the A→B navigation race where the
  // media warning would fire based on the previous exhibition's
  // artworks before the new ones land.
  const artworksReady = !!exhibition?.id && loadedExhibitionId === exhibition.id

  // Without WebGL nothing ever loads, so the loading overlay would sit on top
  // of the scene's "can't display" message forever, and the help modal would
  // explain controls for a room that never appears. Keep only the exit button
  // (`webglAvailable`, read above with the bake's downloads).

  // --- AR-161: the admin's bake and review pages -------------------------------------------
  const visitPath = `/exhibitions/${artistSlug}/${exhibitionSlug}/visit`
  const editorHref = `/exhibitions/${artistSlug}/${exhibitionSlug}/edit`
  const bakeHref = `${visitPath}${bakePageUrl(searchParams.toString(), 'bake')}`
  const reviewHref = `${visitPath}${bakePageUrl(searchParams.toString(), 'review')}`
  const bakedSpace = isBakedSpace(exhibition?.spaceId)
  const canBake = useCanBake(mode === 'bake')
  const [bakeError, setBakeError] = useState<string | null>(null)
  const exhibitionId = exhibition?.id
  const fingerprint = exhibition?.bakeFingerprint
  const spaceId = exhibition?.spaceId
  const runner = useMemo<BakeRunnerProps | null>(
    () =>
      mode === 'bake' && exhibitionId && fingerprint && spaceId
        ? {
            exhibitionId,
            fingerprint,
            spaceId,
            // The loader: the light first, then storing it; it never goes backwards.
            onProgress: ({ phase, fraction }) =>
              setBakeProgress(
                'running',
                phase === 'baking'
                  ? BAKE_SHARE * fraction
                  : BAKE_SHARE + (1 - BAKE_SHARE) * fraction,
              ),
            // Stored: review it, as visitors will get it — a fresh page (no bake left in memory),
            // replacing this one so Back doesn't bake again.
            onDone: () => {
              setBakeProgress('running', 1)
              window.location.replace(reviewHref)
            },
            onError: (bakeFailure) => setBakeError(bakeFailure.message),
          }
        : null,
    [mode, exhibitionId, fingerprint, spaceId, reviewHref],
  )
  // The loader's bake progress belongs to this page while it bakes.
  useEffect(() => {
    if (mode !== 'bake') return
    return () => resetBakeProgress()
  }, [mode])
  const bakePage = useMemo<BakePage>(
    () =>
      mode === 'bake' && runner
        ? { mode: 'bake', runner }
        : mode === 'review'
          ? { mode: 'review' }
          : { mode: 'visit' },
    [mode, runner],
  )

  // Review: once the room is revealed with this draft bake on, the admin has reviewed it — said
  // once, for this exact bake (the server refuses a bake that isn't current any more).
  const [review, setReview] = useState<ReviewState>('pending')
  const reviewedBake = useRef<string | null>(null)
  const reviewBakeId = mode === 'review' && draftCurrent ? draftBake!.id : null
  const markReviewed = useCallback(() => {
    if (!reviewBakeId || !exhibitionId || reviewedBake.current === reviewBakeId) return
    reviewedBake.current = reviewBakeId
    fetch(`/api/exhibitions/${encodeURIComponent(exhibitionId)}/bake/reviewed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bakeId: reviewBakeId }),
    })
      .then((response) =>
        setReview(response.ok ? 'reviewed' : response.status === 409 ? 'refused' : 'failed'),
      )
      .catch(() => setReview('failed'))
  }, [reviewBakeId, exhibitionId])

  if (error) {
    return <div className={styles.errorState}>Error loading exhibition</div>
  }

  if (!exhibition && !isApiLoading) {
    return <div className={styles.emptyState}>Exhibition not found</div>
  }

  // AR-161: a bake preview of a room whose bake doesn't match it (or was never made). The
  // room is not shown at all — never a room lit for another state of itself — so the 3D scene
  // doesn't mount; the response says why in `bakeStatus`.
  if (previewToken && exhibition?.bakeStatus && exhibition.bakeStatus !== 'current') {
    return (
      <div className={styles.previewNotice} role="status">
        <Text as="h2" size="lg" font="serif">
          {exhibition.bakeStatus === 'missing'
            ? "This exhibition hasn't been baked yet."
            : 'This preview is out of date — a new bake is needed.'}
        </Text>
      </div>
    )
  }

  // AR-161: the bake and review pages say plainly when there is no room to show.
  if (adminPage && exhibition) {
    const notice = (title: string, actions: React.ReactNode, detail?: string) => (
      <div className={styles.previewNotice} role="status">
        <Text as="h2" size="lg" font="serif">
          {title}
        </Text>
        {detail && (
          <Text as="p" size="sm">
            {detail}
          </Text>
        )}
        {actions}
      </div>
    )
    if (!bakedSpace) {
      return notice(
        "This exhibition's space isn't lit by a bake.",
        <BakeActions editorHref={editorHref} />,
      )
    }
    if (mode === 'bake' && canBake === false) {
      return notice("This computer can't bake the room.", <BakeActions editorHref={editorHref} />)
    }
    if (mode === 'bake' && (bakeError || !fingerprint)) {
      return notice(
        "The bake didn't finish. Nothing was saved.",
        <BakeActions bakeHref={bakeHref} editorHref={editorHref} />,
        bakeError ?? 'The room could not be read for baking.',
      )
    }
    if (mode === 'review' && !draftBake) {
      return notice(
        "This exhibition hasn't been baked yet.",
        <BakeActions bakeHref={bakeHref} bakeLabel="Bake the room" editorHref={editorHref} />,
      )
    }
    if (mode === 'review' && !draftCurrent) {
      return notice(
        'This preview is out of date — a new bake is needed.',
        <BakeActions bakeHref={bakeHref} editorHref={editorHref} />,
      )
    }
  }

  // Device, not just width: a 13" iPad held sideways is laptop-wide but has no
  // keyboard or mouse to walk the room with.
  if (!canEnterWalkthrough) {
    return <MobileExhibitionView artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
  }

  // Bake mode mounts the scene once this computer is known to be able to bake.
  const sceneReady = !!exhibition && (mode !== 'bake' || canBake === true)

  return (
    <>
      {!isArtworkPanelOpen && <NavigationButton />}
      {webglAvailable !== false && (
        <>
          <NavigationHelpModal
            hidden={isArtworkPanelOpen || mode === 'bake'}
            exhibitionId={exhibition?.id}
            artworksReady={artworksReady}
          />
          <LoadingOverlay
            key={mode}
            mode={mode}
            onRevealed={mode === 'review' ? markReviewed : undefined}
          />
        </>
      )}
      {mode === 'review' && (
        <ReviewBar review={review} bakeHref={bakeHref} editorHref={editorHref} />
      )}
      {sceneReady && (
        // Keyed by the mode: a bake and a review never share a scene.
        <BakePageProvider key={mode} value={bakePage}>
          <Scene hideLoader />
        </BakePageProvider>
      )}
      {isArtworkPanelOpen && <ArtworkPanel />}
      {isArtworkModalOpen && <ArtworkModal />}
    </>
  )
}
