'use client'

import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'

import { Scene } from '@/components/scene'
import { useLoadExhibitionArtworks } from '@/hooks/useLoadExhibitionArtworks'
import { resetArtworks } from '@/redux/slices/artworkSlice'
import { useGetExhibitionByUrlQuery } from '@/redux/slices/exhibitionApi'
import { setExhibition } from '@/redux/slices/exhibitionSlice'
import { hidePlaceholders, resetScene } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { AppDispatch } from '@/redux/store'
import type { TExhibition } from '@/types/exhibition'

interface ExhibitionViewPageProps {
  artistSlug: string
  exhibitionSlug: string
}

// Loading overlay that uses useProgress from drei - works OUTSIDE Canvas!
const LoadingOverlay = () => {
  const { active, progress } = useProgress()
  const [dismissed, setDismissed] = useState(false)
  
  // Dismiss overlay when loading is complete
  useEffect(() => {
    if (!active && progress >= 100) {
      // Small delay to ensure first frame has painted
      const timer = setTimeout(() => setDismissed(true), 100)
      return () => clearTimeout(timer)
    }
  }, [active, progress])
  
  if (dismissed) return null
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: '#ffffff',
        zIndex: 99999,
      }}
    >
      <div
        style={{
          width: '200px',
          height: '3px',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#333',
            transition: 'width 0.3s ease-out',
          }}
        />
      </div>
      <span style={{ fontSize: '12px', color: '#666' }}>
        {active ? `Loading 3D scene... ${Math.round(progress)}%` : 'Almost ready...'}
      </span>
    </div>
  )
}

export const ExhibitionViewPage = ({ artistSlug, exhibitionSlug }: ExhibitionViewPageProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const hasResetRef = useRef(false)

  const {
    data: exhibition,
    isLoading: isApiLoading,
    error,
  } = useGetExhibitionByUrlQuery(exhibitionSlug, {
    skip: !exhibitionSlug,
  })

  // Reset state and hide placeholders on mount (view mode only)
  useEffect(() => {
    if (!hasResetRef.current) {
      dispatch(resetWallView())
      dispatch(resetScene())
      dispatch(resetArtworks())
      dispatch(hidePlaceholders())
      hasResetRef.current = true
    }
  }, [dispatch])

  // Load exhibition into Redux
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
      }
      dispatch(setExhibition(exhibitionData))
    }
  }, [exhibition, dispatch])

  // Load saved artworks from database (preloads images)
  useLoadExhibitionArtworks(exhibition?.id)

  if (error) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Error loading exhibition
      </div>
    )
  }

  if (!exhibition && !isApiLoading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Exhibition not found
      </div>
    )
  }

  return (
    <>
      {/* Loading overlay - uses useProgress which works OUTSIDE Canvas */}
      <LoadingOverlay />
      
      {/* Scene renders as soon as exhibition data is available */}
      {exhibition && <Scene />}
    </>
  )
}
