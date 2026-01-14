'use client'

import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Info, Mouse, X } from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { ArtworkPanel } from '@/components/editview/ArtworkPanel'
import { Scene } from '@/components/scene'
import { useLoadExhibitionArtworks } from '@/hooks/useLoadExhibitionArtworks'
import { resetArtworks } from '@/redux/slices/artworkSlice'
import { useGetExhibitionByUrlQuery } from '@/redux/slices/exhibitionApi'
import { setExhibition } from '@/redux/slices/exhibitionSlice'
import { hidePlaceholders, resetScene } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { AppDispatch, RootState } from '@/redux/store'
import type { TExhibition } from '@/types/exhibition'
import { Text } from '@/components/ui/Typography'
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
    <button
      className={styles.navigationButton}
      onClick={handleClick}
      aria-label="Close exhibition"
    >
      <X size={20} strokeWidth={ICON_STROKE_WIDTH} />
    </button>
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
        {active ? `Loading 3D scene... ${Math.round(progress)}%` : 'Almost ready...'}
      </Text>
    </div>
  )
}

const MobileOverlay = () => {
  const router = useRouter()

  return (
    <div className={styles.mobileOverlay}>
      <div className={styles.mobileOverlayContent}>
        <Text as="h2" size="xl" font="serif" className={styles.mobileOverlayTitle}>
          Desktop Experience
        </Text>
        <Text as="p" size="md" className={styles.mobileOverlayText}>
          This 3D exhibition is best viewed on a desktop or laptop computer.
        </Text>
        <button className={styles.mobileOverlayButton} onClick={() => router.back()}>
          Go Back
        </button>
      </div>
    </div>
  )
}

const InfoButton = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        className={styles.infoButton}
        onClick={() => setIsOpen(true)}
        aria-label="Navigation help"
      >
        <Info size={20} strokeWidth={ICON_STROKE_WIDTH} />
      </button>
      {isOpen && (
        <div className={styles.infoOverlay} onClick={() => setIsOpen(false)}>
          <div className={styles.infoPanel} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.infoPanelClose}
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              <X size={16} strokeWidth={ICON_STROKE_WIDTH} />
            </button>
            <Text as="h3" size="lg" font="sans" className={styles.infoPanelTitle}>
              How to Navigate
            </Text>
            <div className={styles.infoPanelContent}>
              <div className={styles.infoItem}>
                <div className={styles.infoKeysColumn}>
                  <div className={styles.infoKeys}>
                    <Text as="span" size="sm" className={styles.infoKey}>W</Text>
                    <Text as="span" size="sm" className={styles.infoKey}>A</Text>
                    <Text as="span" size="sm" className={styles.infoKey}>S</Text>
                    <Text as="span" size="sm" className={styles.infoKey}>D</Text>
                  </div>
                  <div className={styles.infoKeys}>
                    <span className={styles.infoKey}><ArrowUp size={14} strokeWidth={ICON_STROKE_WIDTH} /></span>
                    <span className={styles.infoKey}><ArrowLeft size={14} strokeWidth={ICON_STROKE_WIDTH} /></span>
                    <span className={styles.infoKey}><ArrowDown size={14} strokeWidth={ICON_STROKE_WIDTH} /></span>
                    <span className={styles.infoKey}><ArrowRight size={14} strokeWidth={ICON_STROKE_WIDTH} /></span>
                  </div>
                </div>
                <Text as="span" size="sm">Walk inside the room</Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Mouse size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">Hold + Drag</Text>
                </span>
                <Text as="span" size="sm">Rotate the view</Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Mouse size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">Single Click</Text>
                </span>
                <Text as="span" size="sm">Auto focus</Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Mouse size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">Double Click</Text>
                </span>
                <Text as="span" size="sm">Artwork details</Text>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export const ExhibitionViewPage = ({ artistSlug, exhibitionSlug }: ExhibitionViewPageProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const hasResetRef = useRef(false)
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)

  const {
    data: exhibition,
    isLoading: isApiLoading,
    error,
  } = useGetExhibitionByUrlQuery(exhibitionSlug, {
    skip: !exhibitionSlug,
  })

  useEffect(() => {
    if (!hasResetRef.current) {
      dispatch(resetWallView())
      dispatch(resetScene())
      dispatch(resetArtworks())
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
        visibility: exhibition.visibility,
        ambientLightColor: exhibition.ambientLightColor ?? undefined,
        ambientLightIntensity: exhibition.ambientLightIntensity ?? undefined,
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

  return (
    <>
      {!isArtworkPanelOpen && (
        <>
          <NavigationButton artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
          <InfoButton />
        </>
      )}
      <LoadingOverlay />
      <MobileOverlay />
      {exhibition && <Scene />}
      {isArtworkPanelOpen && <ArtworkPanel />}
    </>
  )
}
