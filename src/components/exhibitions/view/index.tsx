'use client'

import { useProgress } from '@react-three/drei'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react'
import { useDispatch, useSelector } from 'react-redux'
import c from 'classnames'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  HandArrowUp,
  HandSwipeRight,
  List,
  MouseSimple,
  SpeakerHigh,
  X,
} from '@phosphor-icons/react'

import { preloadFloorMaterial } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { bakedFloor } from '@/lib/bake/commonFloor'
import { ArtworkModal } from '@/components/exhibitions/view/ArtworkModal/ArtworkModal'
import { RoomLoader } from '@/components/exhibitions/view/RoomLoader'
import {
  RoomAboutPanel,
  type RoomAbout,
} from '@/components/exhibitions/view/RoomAbout/RoomAboutPanel'
import { ExitPrompt } from '@/components/exhibitions/ExitPrompt'
import { FeedbackWindow } from '@/components/feedback/FeedbackWindow'
import { Scene } from '@/components/scene'
import { useWebGLAvailable } from '@/components/scene/webglSupport'
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice'
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
import { closeArtworkModal, hideArtworkPanel } from '@/redux/slices/dashboardSlice'
import {
  declineExit,
  hidePlaceholders,
  resetScene,
  setRoomLanguage,
} from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { AppDispatch, RootState } from '@/redux/store'
import type { TExhibition } from '@/types/exhibition'
import { isBakeRecord, type BakeRecord } from '@/lib/bake/bakeRecord'
import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import { bakePageUrl } from '@/lib/bake/bakePageUrl'
import { Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { BakeActions, BakeAdminBar } from './BakeAdmin/BakeAdmin'
import { ExitWallViewButton } from './RoomControls/ExitWallViewButton'
import { RoomMenu } from './RoomControls/RoomMenu'
import { TouchControlsGuide } from './TouchControlsGuide/TouchControlsGuide'
import styles from './ExhibitionView.module.scss'
import { getConsent, CONSENT_CHANGE_EVENT } from '@/lib/consent'
import { readRoomLanguageChoice, roomLanguageOnEntry, secondLanguageOf } from '@/lib/roomLanguage'

/**
 * Leaving the exhibition, from the menu's Leave exhibition and from the leave dialog's Leave.
 *
 * It goes to the exhibitions index, NOT back to the exhibition just left.
 * Someone who has decided to leave a show has finished with it; returning them
 * to its own page offers the one thing they already declined. The index is
 * where the other exhibitions are.
 *
 * This also replaces a `sessionStorage` round trip that read back a
 * `returnUrl` written on entry — which was always this exhibition's own page,
 * so both branches landed in the same place anyway.
 */
const useLeaveExhibition = () => {
  const router = useRouter()
  return useCallback(() => router.push('/exhibitions'), [router])
}

/**
 * The leave dialog, always mounted, raised by walking into the exit corridor: that walk can happen by
 * accident, so leaving that way stays a decision. The menu's Leave exhibition leaves at once: it is
 * already two deliberate clicks (owner, 2026-11-11).
 */
const LeavePrompt = () => {
  const dispatch = useDispatch()
  const promptOpen = useSelector((state: RootState) => state.scene.isExitPromptOpen)
  const promptSource = useSelector((state: RootState) => state.scene.exitPromptSource)
  const leave = useLeaveExhibition()

  return (
    <ExitPrompt
      open={promptOpen}
      restartsAtEntrance={promptSource === 'walk'}
      onLeave={leave}
      onCancel={() => dispatch(declineExit())}
    />
  )
}

interface ExhibitionViewPageProps {
  /** "About this exhibition" in the room menu (room-about.md): the exhibition page's data. */
  about?: RoomAbout | null
  artistSlug: string
  exhibitionSlug: string
}

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
  /** AR-182: once the loader steps aside (the room is shown, or its error message). */
  onDone?: () => void
  /** The visitor's loader (room-loader.md): the exhibition's title and artist. */
  title?: string
  artist?: string
}

const LoadingOverlay = ({ mode, onRevealed, onDone, title, artist }: LoadingOverlayProps) => {
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
  useEffect(() => {
    if (done) onDone?.()
  }, [done, onDone])
  const revealedWithBake = done && !sceneFailed && storedBake && bake.phase === 'finished'
  useEffect(() => {
    if (revealedWithBake) onRevealed?.()
  }, [revealedWithBake, onRevealed])
  const fraction = bakes
    ? ASSET_SHARE * assets + (1 - ASSET_SHARE) * bake.fraction
    : storedBake
      ? (1 - BAKE_MAPS_SHARE) * assets + BAKE_MAPS_SHARE * mapBytes
      : assets

  // The admin's bake keeps the monogram ("Lighting the room"); visitors see the exhibition's title
  // card (room-loader.md, step 38b). Same fraction and done either way.
  if (bakes) {
    return (
      <MonogramLoader
        progress={fraction}
        done={done}
        title={BAKE_LOADER_TITLE}
        note={BAKE_LOADER_NOTE}
      />
    )
  }
  return <RoomLoader progress={fraction} done={done} title={title} artist={artist} />
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

// Media notice is dismissed PER exhibition: each exhibition with audio /
// video needs to warn the visitor fresh, since sound is exhibition-
// specific (the user has to know which rooms to turn the volume up for).
// Key shape: `${MEDIA_NOTICE_STORAGE_PREFIX}${exhibitionId}`.
/**
 * Whether this exhibition has a work with sound or video: the room's only sources of audio. The
 * store holds this exhibition's works alone (useLoadExhibitionArtworks resets it on a new one).
 */
const useHasSoundOrVideo = () => {
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  return useMemo(
    () => Object.values(artworksById).some((artwork) => artwork.soundUrl || artwork.videoUrl),
    [artworksById],
  )
}

const MEDIA_NOTICE_STORAGE_PREFIX = 'the-art-room:media-notice-dismissed:'

// AR-182: the language window's "Don't show again", per exhibition, in this browser.
const LANGUAGE_WELCOME_STORAGE_PREFIX = 'the-art-room:language-welcome-dismissed:'
const languageWelcomeDismissed = (exhibitionId: string) => {
  try {
    return localStorage.getItem(`${LANGUAGE_WELCOME_STORAGE_PREFIX}${exhibitionId}`) === 'true'
  } catch {
    return false
  }
}

/** What the room menu's "How to move around" calls: today's help button handler. */
interface NavigationHelpHandle {
  open: () => void
  /** Closes the guide or the media notice, whichever is up (the menu button: owner, 2026-11-13). */
  close: () => void
}

interface NavigationHelpModalProps {
  ref?: Ref<NavigationHelpHandle>
  hidden?: boolean
  /** ID of the exhibition currently being viewed. */
  exhibitionId?: string
  /** True once `state.artworks.byId` has been populated for the current
   *  exhibition (vs. still holding the previous exhibition's data). Auto-
   *  show is gated on this so we don't read stale artworks and warn
   *  about media that isn't here. */
  artworksReady?: boolean
  /**
   * AR-182: the second language's English name while the exhibition shows visitors the language
   * switch: the welcome window says the room is also available in it, once the loader is gone.
   */
  languageName?: string | null
  /** AR-182: the loader has stepped aside. */
  revealed?: boolean
}

type ModalStep = 'none' | 'help' | 'media' | 'language'

const NavigationHelpModal = ({
  ref,
  hidden,
  exhibitionId,
  artworksReady,
  languageName,
  revealed,
}: NavigationHelpModalProps) => {
  // Phones and tablets are taught their finger's controls; everything else the
  // keyboard, mouse and trackpad (AR-172).
  const isTouch = useIsTouchDevice()
  const [currentStep, setCurrentStep] = useState<ModalStep>('none')
  const [mediaDismissed, setMediaDismissed] = useState(false)
  const hasCheckedStorage = useRef(false)
  // AR-182: the welcome window comes first, once per entry; the media notice waits for it.
  const [languageShown, setLanguageShown] = useState(false)
  const [mediaAfterLanguage, setMediaAfterLanguage] = useState(false)

  const hasMediaArtworks = useHasSoundOrVideo()

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

  // On entry, only the media notice, where there is sound or video. The controls guide no longer
  // opens by itself: words on the floor teach the walk on every entry (MainCamera's hint), and the
  // guide waits behind the help button. Gated on `artworksReady` so navigating exhibition A → B
  // doesn't trigger the media modal for B based on A's still-cached artworks in Redux.
  useEffect(() => {
    if (!exhibitionId || !artworksReady || !consentSettled) return
    if (hasCheckedStorage.current) return
    hasCheckedStorage.current = true
    // AR-182: the language window opens first, unless "Don't show again" was chosen here.
    const welcomesInLanguage = !!languageName && !languageWelcomeDismissed(exhibitionId)

    try {
      const mediaKey = `${MEDIA_NOTICE_STORAGE_PREFIX}${exhibitionId}`
      const mediaDone = localStorage.getItem(mediaKey) === 'true'
      if (mediaDone) setMediaDismissed(true)
      if (!mediaDone && hasMediaArtworks) {
        // AR-182: after the language window, when there is one.
        if (welcomesInLanguage) {
          setMediaAfterLanguage(true)
          return
        }
        const timer = setTimeout(() => setCurrentStep('media'), 500)
        return () => clearTimeout(timer)
      }
    } catch {
      if (hasMediaArtworks) {
        if (welcomesInLanguage) setMediaAfterLanguage(true)
        else setCurrentStep('media')
      }
    }
  }, [exhibitionId, artworksReady, hasMediaArtworks, consentSettled, languageName])

  // AR-182: "This exhibition is also available in French", once the room is shown (after the
  // loader and the cookie banner), before the media notice. In English: the site is English.
  useEffect(() => {
    if (!languageName || languageShown || !revealed || !consentSettled || !artworksReady) return
    if (!exhibitionId || languageWelcomeDismissed(exhibitionId)) return
    setLanguageShown(true)
    setCurrentStep('language')
  }, [languageName, languageShown, revealed, consentSettled, artworksReady, exhibitionId])

  // The keyboard lands on OK (Button takes no ref: the dialog finds it).
  const languageDialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (currentStep === 'language')
      languageDialogRef.current
        ?.querySelector<HTMLElement>('button')
        ?.focus({ preventScroll: true })
  }, [currentStep])

  const handleCloseLanguage = () => {
    setCurrentStep('none')
    if (mediaAfterLanguage) {
      setMediaAfterLanguage(false)
      setTimeout(() => setCurrentStep('media'), 300)
    }
  }

  // Closes it as OK does, and it never opens again for this exhibition in this browser.
  const handleLanguageNeverAgain = () => {
    try {
      if (exhibitionId) {
        localStorage.setItem(`${LANGUAGE_WELCOME_STORAGE_PREFIX}${exhibitionId}`, 'true')
      }
    } catch {
      // Storage unavailable: it shows again on the next visit.
    }
    handleCloseLanguage()
  }

  const handleCloseHelp = () => {
    setCurrentStep('none')
    // After help closes, the media notice follows, unless the visitor asked not to see it again.
    if (hasMediaArtworks && !mediaDismissed) {
      setTimeout(() => setCurrentStep('media'), 300)
    }
  }

  const handleCloseMedia = () => setCurrentStep('none')

  // Escape closes the open window first (Q30): caught on `document`, before the camera's `window`
  // listener, which would otherwise leave Wall View behind it. A second Escape leaves Wall View.
  const closeOnEscape = useRef(() => {})
  useEffect(() => {
    closeOnEscape.current =
      currentStep === 'help'
        ? handleCloseHelp
        : currentStep === 'language'
          ? handleCloseLanguage
          : handleCloseMedia
  })
  const windowOpen = !hidden && currentStep !== 'none'
  useEffect(() => {
    if (!windowOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeOnEscape.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [windowOpen])

  const handleInfoClick = () => setCurrentStep('help')

  // The help button moved into the room menu (visitor-wallview.md §1): its item calls this.
  useImperativeHandle(ref, () => ({ open: handleInfoClick, close: handleCloseMedia }))

  if (hidden) return null

  return (
    <>
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
              <X size={20} weight="light" aria-hidden />
            </Button>
            {/* The controls alone, no welcome and no title: the guide no longer greets visitors on
                entry (the floor's hint does), it opens from the help button (AR-177, owner, 2026-11-05). */}
            {isTouch ? (
              <TouchControlsGuide hasSound={hasMediaArtworks} />
            ) : (
              <div className={styles.infoPanelContent}>
                <div className={styles.infoItem}>
                  <span className={styles.infoKeyWide}>
                    <MouseSimple size={14} weight="light" aria-hidden />
                    <Text as="span" size="sm">
                      Click anywhere
                    </Text>
                  </span>
                  <Text as="span" size="sm">
                    Move there
                  </Text>
                </div>
                <div className={styles.infoItem}>
                  <div className={styles.infoKeysColumn}>
                    <div className={styles.infoKeys}>
                      <Text as="span" size="sm" className={styles.infoKey}>
                        W
                      </Text>
                      <Text as="span" size="sm" className={styles.infoKey}>
                        S
                      </Text>
                    </div>
                    <div className={styles.infoKeys}>
                      <span className={styles.infoKey}>
                        <ArrowUp size={14} weight="light" aria-hidden />
                      </span>
                      <span className={styles.infoKey}>
                        <ArrowDown size={14} weight="light" aria-hidden />
                      </span>
                    </div>
                  </div>
                  <Text as="span" size="sm">
                    Walk forward / backward
                  </Text>
                </div>
                {/* AR-176: these always stepped sideways without turning (only the mouse
                    and trackpad turn); one "walk" row hid it. */}
                <div className={styles.infoItem}>
                  <div className={styles.infoKeysColumn}>
                    <div className={styles.infoKeys}>
                      <Text as="span" size="sm" className={styles.infoKey}>
                        A
                      </Text>
                      <Text as="span" size="sm" className={styles.infoKey}>
                        D
                      </Text>
                    </div>
                    <div className={styles.infoKeys}>
                      <span className={styles.infoKey}>
                        <ArrowLeft size={14} weight="light" aria-hidden />
                      </span>
                      <span className={styles.infoKey}>
                        <ArrowRight size={14} weight="light" aria-hidden />
                      </span>
                    </div>
                  </div>
                  <Text as="span" size="sm">
                    Step left / right
                  </Text>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoKeyWide}>
                    <MouseSimple size={14} weight="light" aria-hidden />
                    <Text as="span" size="sm">
                      Hold + Drag
                    </Text>
                  </span>
                  <Text as="span" size="sm">
                    Look around, up or down
                  </Text>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoKeyWide}>
                    <HandSwipeRight size={14} weight="light" aria-hidden />
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
                    <HandArrowUp size={14} weight="light" aria-hidden />
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
                    <MouseSimple size={14} weight="light" aria-hidden />
                    <Text as="span" size="sm">
                      Single Click
                    </Text>
                  </span>
                  <Text as="span" size="sm">
                    Wall View: stand in front of an artwork
                  </Text>
                </div>
                {/* Wall View (MainCamera): the mouse's drag, a swipe and the keys all move over the
                    wall, never turning; Escape or the Exit Wall View button leaves it. */}
                <div className={styles.infoItem}>
                  <span className={styles.infoKeyWide}>
                    <MouseSimple size={14} weight="light" aria-hidden />
                    <Text as="span" size="sm">
                      Drag, Swipe or Arrows
                    </Text>
                  </span>
                  <Text as="span" size="sm">
                    In Wall View: move over the wall
                  </Text>
                </div>
                <div className={styles.infoItem}>
                  <Text as="span" size="sm" className={styles.infoKey}>
                    Esc
                  </Text>
                  <Text as="span" size="sm">
                    Leave Wall View
                  </Text>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoKeyWide}>
                    <MouseSimple size={14} weight="light" aria-hidden />
                    <Text as="span" size="sm">
                      Double Click
                    </Text>
                  </span>
                  <Text as="span" size="sm">
                    Show artwork details
                  </Text>
                </div>
                {/* Only where a work has sound or video (owner, 2026-11-13). */}
                {hasMediaArtworks && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoKeyWide}>
                      <SpeakerHigh size={14} weight="light" aria-hidden />
                      <Text as="span" size="sm">
                        Double Click
                      </Text>
                    </span>
                    <Text as="span" size="sm">
                      Play sound
                    </Text>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AR-182: the language window (designs/wall-languages-visitor §3); Esc and the backdrop
          close it as OK does. It doesn't switch the language: the room menu does. */}
      {currentStep === 'language' && languageName && (
        <div className={styles.infoOverlay} onClick={handleCloseLanguage}>
          <div
            ref={languageDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-language-welcome"
            className={c(styles.infoPanel, styles.languageWelcome)}
            onClick={(e) => e.stopPropagation()}
          >
            <Text
              as="h2"
              id="room-language-welcome"
              size="lg"
              font="serif"
              className={styles.languageWelcomeTitle}
            >
              This exhibition is also available in {languageName}
            </Text>
            <Text as="p" size="sm" className={styles.languageWelcomeText}>
              Open the menu
              <span className={styles.menuKey} aria-hidden>
                <List size={15} weight="light" />
              </span>
              to switch languages.
            </Text>
            <div className={styles.languageWelcomeActions}>
              <Button
                variant="primary"
                size="regularSquared"
                label="OK"
                className={styles.dismissButton}
                onClick={handleCloseLanguage}
              />
              <Button
                variant="bare"
                label="Don't show again"
                className={styles.languageWelcomeNever}
                onClick={handleLanguageNeverAgain}
              />
            </div>
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
              <X size={20} weight="light" aria-hidden />
            </Button>
            <div className={styles.welcomeSection}>
              <SpeakerHigh
                size={32}
                weight="light"
                style={{ margin: '0 auto var(--space-4)', display: 'block' }}
                aria-hidden
              />
              <Text as="h2" size="lg" font="sans" className={styles.welcomeTitle}>
                Sound & Video
              </Text>
              <Text as="p" size="sm" className={styles.welcomeText}>
                This exhibition contains artworks with audio and video. Make sure your volume is
                turned on for the full experience. You can mute all sounds at any time with{' '}
                <strong>Sound</strong> in the menu, top right.
              </Text>
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

export const ExhibitionViewPage = ({
  artistSlug,
  exhibitionSlug,
  about,
}: ExhibitionViewPageProps) => {
  const [aboutOpen, setAboutOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // AR-182: the loader has stepped aside (the language window waits for it).
  const [roomRevealed, setRoomRevealed] = useState(false)
  const onLoaderDone = useCallback(() => setRoomRevealed(true), [])
  // AR-176: the page behind the room, so a phone held sideways can paint Safari's strip above it
  // black (globals.scss, `room-page`).
  useEffect(() => {
    document.documentElement.classList.add('room-page')
    return () => document.documentElement.classList.remove('room-page')
  }, [])
  const dispatch = useDispatch<AppDispatch>()
  const hasResetRef = useRef<string | null>(null)
  const searchParams = useSearchParams()
  const isArtworkModalOpen = useSelector((state: RootState) => state.dashboard.isArtworkModalOpen)
  const hasSoundOrVideo = useHasSoundOrVideo()
  const currentArtworkId = useSelector((state: RootState) => state.scene.currentArtworkId)
  const inArtworkView = useSelector((state: RootState) => state.scene.inArtworkView)
  const isTouch = useIsTouchDevice()
  // The room menu's "How to move around" opens the controls guide through this.
  const helpRef = useRef<NavigationHelpHandle>(null)
  const leaveExhibition = useLeaveExhibition()

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
  // The open work as a photo of the print, for its pop-ups (AR-174); none → its plain image.
  const currentPresentation = currentArtworkId
    ? exhibition?.presentations?.[currentArtworkId]
    : undefined

  // AR-161: the draft bake, and whether it is a bake of the room as saved now.
  const draftBake = adminPage && isBakeRecord(exhibition?.bake) ? exhibition.bake : null
  const draftCurrent =
    !!draftBake &&
    !!exhibition?.bakeFingerprint &&
    draftBake.fingerprint === exhibition.bakeFingerprint
  // The bake the room shows: visitors' published one (or a preview's draft); in review the
  // draft, only when current; in bake mode none (the bake runs on the unlit room).
  //
  // AR-169 Quick bake (`?bake=1&bakequality=quick`): once it finishes, the page shows it the way
  // review shows a stored bake — its maps live in this tab only; nothing was uploaded or saved.
  const [quickBake, setQuickBake] = useState<BakeRecord | null>(null)
  const roomBake =
    quickBake ??
    (mode === 'visit'
      ? (exhibition?.bake ?? null)
      : mode === 'review' && draftCurrent
        ? draftBake
        : null)
  // What the page shows: a finished quick bake is shown like review (the URL stays the bake's, so
  // nothing marks it reviewed).
  const shownMode: PageMode = quickBake ? 'review' : mode

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
      // it true, and Redux survives client navigation — so without this, the room would
      // open with a work's details already over it.
      dispatch(closeArtworkModal())
      // The editor's side panel, should it come here still open: the room never shows it
      // (its details open straight away), and it would keep the room's buttons hidden.
      dispatch(hideArtworkPanel())
      // Note: Do NOT call resetArtworks() here - artworks should persist across
      // same-exhibition navigation (e.g., when viewing artwork details and returning).
      // The useLoadExhibitionArtworks hook handles loading artworks when needed.
      dispatch(hidePlaceholders())
      hasResetRef.current = exhibitionSlug
    }
  }, [dispatch, exhibitionSlug])

  // AR-182: the language the room's texts open in (docs/wall-languages), decided once per
  // exhibition (after the reset above). Visitors only, while the exhibition shows them the switch;
  // editors preview in the editor. Both languages come with the room's one load, so switching
  // needs no request.
  const requestedLanguage = searchParams.get('lang')
  const languageDecidedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!exhibition?.id) return
    if (languageDecidedFor.current === exhibition.id) return
    languageDecidedFor.current = exhibition.id
    dispatch(
      setRoomLanguage(
        roomLanguageOnEntry({
          secondLanguage: exhibition.secondLanguage,
          switchOn: exhibition.secondLanguageVisible,
          requested: requestedLanguage,
          stored: readRoomLanguageChoice(exhibition.id),
          browserLanguage: navigator.language,
        }),
      ),
    )
  }, [
    dispatch,
    exhibition?.id,
    exhibition?.secondLanguage,
    exhibition?.secondLanguageVisible,
    requestedLanguage,
  ])

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
      preloadFloorMaterial(
        look.baked
          ? bakedFloor(look.space.floor, exhibition.floorMaterial).material
          : exhibition.floorMaterial,
      )
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
        secondLanguage: exhibition.secondLanguage ?? null,
        secondLanguageVisible: exhibition.secondLanguageVisible ?? false,
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
        daylightLevel: exhibition.daylightLevel ?? undefined,
        fillLightLevel: exhibition.fillLightLevel ?? undefined,
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
  // only where the room will be shown (never without WebGL).
  const webglAvailable = useWebGLAvailable()
  const preloadBake = exhibition ? shownStoredBake(exhibition.spaceId, roomBake) : null
  useEffect(() => {
    if (preloadBake && webglAvailable !== false) preloadStoredBake(preloadBake)
  }, [preloadBake, webglAvailable])

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
            // A quick bake: shown here, never stored.
            onPreview: (preview) => {
              setBakeProgress('running', 1)
              setQuickBake(preview)
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
      shownMode === 'bake' && runner
        ? { mode: 'bake', runner }
        : shownMode === 'review'
          ? { mode: 'review' }
          : { mode: 'visit' },
    [shownMode, runner],
  )
  // The quick bake's page: Bake (the real one, stored) without the quick parameter.
  const fullBakeSearch = new URLSearchParams(searchParams.toString())
  fullBakeSearch.delete('bakequality')
  const fullBakeHref = `${visitPath}${bakePageUrl(fullBakeSearch.toString(), 'bake')}`

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

  // AR-182: the second language visitors can switch to: only while the exhibition shows them the
  // switch, in the visitor's room (not the bake or review pages).
  const visitorLanguage =
    mode === 'visit' && exhibition?.secondLanguageVisible
      ? secondLanguageOf(exhibition.secondLanguage)
      : null

  // Bake mode mounts the scene once this computer is known to be able to bake.
  const sceneReady = !!exhibition && (mode !== 'bake' || canBake === true)

  // The room's one menu (visitor-wallview.md §1), in place of the corner X and the help and sound
  // buttons; the same in the room and in Wall View (Q30):
  // - Sound: only where a work has sound or video (owner, 2026-11-13; was always, Q29), inside the
  //   room's audio provider; never without WebGL (nothing plays).
  // - How to move around: where the help button was (WebGL not unavailable, not the bake page).
  // - Leave exhibition: always (in Wall View too, Q30); it leaves at once, without the dialog.
  const helpShown = webglAvailable !== false && shownMode !== 'bake'
  // About this exhibition: the visitor's room only (not bake or review); it closes back to the
  // menu button.
  const aboutShown = !!about && mode !== 'bake' && mode !== 'review'
  const closeAbout = () => {
    setAboutOpen(false)
    document
      .querySelector<HTMLElement>('[data-panel-overlay] > button[aria-label="Menu"]')
      ?.focus({ preventScroll: true })
  }
  // Send feedback (feedback.md, room-about.md): the visitor's room only, as About; the window
  // returns focus to the menu button itself.
  const feedbackShown = !!exhibition?.id && mode !== 'bake' && mode !== 'review'
  // Any press of the menu button closes every window open over the room (owner, 2026-11-13): About,
  // feedback, the controls guide (or its media notice) and an artwork's details. Wall View is a
  // mode, not a window: it stays.
  const closeRoomWindows = () => {
    setAboutOpen(false)
    setFeedbackOpen(false)
    helpRef.current?.close()
    if (isArtworkModalOpen) dispatch(closeArtworkModal())
  }
  const roomMenu = (sound: boolean) => (
    <RoomMenu
      sound={sound}
      onHelp={helpShown ? () => helpRef.current?.open() : undefined}
      onLeave={leaveExhibition}
      onAbout={aboutShown ? () => setAboutOpen(true) : undefined}
      onFeedback={feedbackShown ? () => setFeedbackOpen(true) : undefined}
      onButtonPress={closeRoomWindows}
      languageSwitch={!!visitorLanguage}
    />
  )

  return (
    <>
      <LeavePrompt />
      {/* Wall View's way out, top-left; the menu stays top-right (visitor-wallview.md §2). */}
      {inArtworkView && !isArtworkModalOpen && <ExitWallViewButton />}
      {webglAvailable !== false && (
        <>
          <NavigationHelpModal
            ref={helpRef}
            hidden={shownMode === 'bake'}
            exhibitionId={exhibition?.id}
            artworksReady={artworksReady}
            languageName={visitorLanguage?.name ?? null}
            revealed={roomRevealed}
          />
          <LoadingOverlay
            key={shownMode}
            mode={shownMode}
            title={about?.title ?? exhibition?.mainTitle}
            artist={about?.artistName}
            onRevealed={mode === 'review' ? markReviewed : undefined}
            onDone={onLoaderDone}
          />
        </>
      )}
      {mode === 'review' && (
        <ReviewBar review={review} bakeHref={bakeHref} editorHref={editorHref} />
      )}
      {quickBake && (
        <BakeAdminBar
          title="Quick bake — a preview on this computer only"
          status="Not saved: visitors never see it. Bake when the room is right."
          bakeHref={fullBakeHref}
          bakeLabel="Bake"
          editorHref={editorHref}
        />
      )}
      {sceneReady ? (
        // Keyed by the mode: a bake and a review never share a scene (a finished quick bake is
        // shown in a fresh one, as review shows a stored bake). The menu renders inside it, in its
        // audio provider, for Sound; until it mounts, the page renders the menu itself (no Sound
        // then: there is no audio to switch yet), so Leave is always there.
        <BakePageProvider key={shownMode} value={bakePage}>
          <Scene hideLoader overlay={roomMenu(webglAvailable !== false && hasSoundOrVideo)} />
        </BakePageProvider>
      ) : (
        roomMenu(false)
      )}
      {/* On a phone or tablet the room holds still while an artwork's details are
          open: a slide or tap would walk away from the work being read about. This
          catches those touches; the details sit above it. */}
      {isTouch && isArtworkModalOpen && <div className={styles.touchShield} aria-hidden />}
      {/* About this exhibition: on a phone or tablet the room's gestures pause while it is open. */}
      {aboutShown && aboutOpen && about && (
        <>
          {isTouch && <div className={styles.touchShield} aria-hidden />}
          <RoomAboutPanel about={about} onClose={closeAbout} />
        </>
      )}
      {/* The feedback window over the room: its presses and keys are its own, never the room's. */}
      {feedbackShown && feedbackOpen && exhibition?.id && (
        <div data-panel-overlay onKeyDown={(event) => event.stopPropagation()}>
          <FeedbackWindow
            source="room"
            exhibitionId={exhibition.id}
            onClose={() => setFeedbackOpen(false)}
          />
        </div>
      )}
      {/* The work as a photo of the print, as the grids show it, or its plain image when it has no
          current render (AR-174). */}
      {isArtworkModalOpen && <ArtworkModal presentation={currentPresentation} />}
    </>
  )
}
