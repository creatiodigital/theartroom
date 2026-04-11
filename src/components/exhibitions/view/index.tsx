'use client'

import { useProgress } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { ArtworkPanel } from '@/components/editview/ArtworkPanel'
import { Scene } from '@/components/scene'
import { useLoadExhibitionArtworks } from '@/hooks/useLoadExhibitionArtworks'
import { useGetExhibitionByUrlQuery } from '@/redux/slices/exhibitionApi'
import { setExhibition } from '@/redux/slices/exhibitionSlice'
import { hidePlaceholders, resetScene } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { AppDispatch, RootState } from '@/redux/store'
import type { TExhibition } from '@/types/exhibition'
import { Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import Tooltip from '@/components/ui/Tooltip/Tooltip'
import styles from './ExhibitionView.module.scss'

interface NavigationButtonProps {
  artistSlug: string
  exhibitionSlug: string
}

const NavigationButton = ({ artistSlug, exhibitionSlug }: NavigationButtonProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isInternal = searchParams.get('ref') === 'internal'

  const handleClick = () => {
    if (isInternal) {
      router.push(`/exhibitions/${artistSlug}/${exhibitionSlug}`)
    } else {
      router.push('/')
    }
  }

  return (
    <div className={styles.navigationButtonWrapper}>
      <Tooltip label="Leave Exhibition" placement="left">
        <button
          className={styles.navigationButton}
          onClick={handleClick}
          aria-label="Leave Exhibition"
        >
          <X size={20} strokeWidth={ICON_STROKE_WIDTH} />
        </button>
      </Tooltip>
    </div>
  )
}

interface ExhibitionViewPageProps {
  artistSlug: string
  exhibitionSlug: string
}

const LoadingOverlay = () => {
  const { active, progress } = useProgress()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!active && progress >= 100) {
      const timer = setTimeout(() => setDismissed(true), 100)
      return () => clearTimeout(timer)
    }
  }, [active, progress])

  if (dismissed) return null

  return (
    <div className={styles.loadingOverlay}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
      <Text as="span">
        {active ? `Loading Exhibition ${Math.round(progress)}%` : 'Almost ready...'}
      </Text>
    </div>
  )
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
          3D Exhibition Available
        </Text>
        <Text as="p" size="md" className={styles.mobileOverlayText}>
          Visit this page on a laptop or desktop to explore the full 3D exhibition experience.
        </Text>
        <Link
          href={`/exhibitions/${artistSlug}/${exhibitionSlug}`}
          className={styles.mobileOverlayButton}
        >
          Go to Exhibition Page
        </Link>
      </div>
    </div>
  )
}

const NAVIGATION_HELP_STORAGE_KEY = 'the-art-room:navigation-help-dismissed'
const MEDIA_NOTICE_STORAGE_KEY = 'the-art-room:media-notice-dismissed'

interface NavigationHelpModalProps {
  hidden?: boolean
}

type ModalStep = 'none' | 'help' | 'media'

const NavigationHelpModal = ({ hidden }: NavigationHelpModalProps) => {
  const [currentStep, setCurrentStep] = useState<ModalStep>('none')
  const [helpDismissed, setHelpDismissed] = useState(false)
  const [mediaDismissed, setMediaDismissed] = useState(false)
  const hasCheckedStorage = useRef(false)

  // Detect if exhibition has video or sound artworks
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const hasMediaArtworks = useMemo(() => {
    return Object.values(artworksById).some((artwork) => artwork.soundUrl || artwork.videoUrl)
  }, [artworksById])

  // Auto-show on mount: help first, then media
  useEffect(() => {
    if (hasCheckedStorage.current) return
    hasCheckedStorage.current = true

    const isMobile = window.innerWidth < 1024
    if (isMobile) return

    try {
      const helpDone = localStorage.getItem(NAVIGATION_HELP_STORAGE_KEY) === 'true'
      const mediaDone = localStorage.getItem(MEDIA_NOTICE_STORAGE_KEY) === 'true'

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
  }, [hasMediaArtworks])

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
      <button className={styles.infoButton} onClick={handleInfoClick} aria-label="Navigation help">
        <Info size={20} strokeWidth={ICON_STROKE_WIDTH} />
      </button>

      {/* Help Modal */}
      {currentStep === 'help' && (
        <div className={styles.infoOverlay} onClick={handleCloseHelp}>
          <div className={styles.infoPanel} onClick={(e) => e.stopPropagation()}>
            <button className={styles.infoPanelClose} onClick={handleCloseHelp} aria-label="Close">
              <X size={16} strokeWidth={ICON_STROKE_WIDTH} />
            </button>
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
            <button className={styles.infoPanelClose} onClick={handleCloseMedia} aria-label="Close">
              <X size={16} strokeWidth={ICON_STROKE_WIDTH} />
            </button>
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
                    localStorage.setItem(MEDIA_NOTICE_STORAGE_KEY, 'true')
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

const useIsMobile = (breakpoint = 1024) => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  )

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}

export const ExhibitionViewPage = ({ artistSlug, exhibitionSlug }: ExhibitionViewPageProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const hasResetRef = useRef(false)
  const searchParams = useSearchParams()
  const previewToken = searchParams.get('preview') || undefined
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const isMobile = useIsMobile()

  const {
    data: exhibition,
    isLoading: isApiLoading,
    error,
  } = useGetExhibitionByUrlQuery(
    { url: exhibitionSlug, ...(previewToken && { preview: previewToken }) },
    {
      skip: !exhibitionSlug,
    },
  )

  useEffect(() => {
    if (!hasResetRef.current) {
      dispatch(resetWallView())
      dispatch(resetScene())
      // Note: Do NOT call resetArtworks() here - artworks should persist across
      // same-exhibition navigation (e.g., when viewing artwork details and returning).
      // The useLoadExhibitionArtworks hook handles loading artworks when needed.
      dispatch(hidePlaceholders())
      hasResetRef.current = true
    }
  }, [dispatch])

  useEffect(() => {
    if (exhibition) {
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
        // Autofocus groups
        autofocusGroups: exhibition.autofocusGroups ?? undefined,
      }
      dispatch(setExhibition(exhibitionData))
    }
  }, [exhibition, dispatch])

  useLoadExhibitionArtworks(exhibition?.id)

  if (error) {
    return <div className={styles.errorState}>Error loading exhibition</div>
  }

  if (!exhibition && !isApiLoading) {
    return <div className={styles.emptyState}>Exhibition not found</div>
  }

  if (isMobile) {
    return <MobileExhibitionView artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
  }

  return (
    <>
      {!isArtworkPanelOpen && (
        <NavigationButton artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
      )}
      <NavigationHelpModal hidden={isArtworkPanelOpen} />
      <LoadingOverlay />
      {exhibition && <Scene hideLoader />}
      {isArtworkPanelOpen && <ArtworkPanel />}
    </>
  )
}
