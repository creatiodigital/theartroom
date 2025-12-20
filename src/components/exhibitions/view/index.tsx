'use client'

import { useEffect, useRef } from 'react'
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

export const ExhibitionViewPage = ({ artistSlug, exhibitionSlug }: ExhibitionViewPageProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const hasResetRef = useRef(false)

  const {
    data: exhibition,
    isLoading,
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

  // Load saved artworks from database
  useLoadExhibitionArtworks(exhibition?.id)

  if (isLoading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Error loading exhibition
      </div>
    )
  }

  if (!exhibition) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Exhibition not found
      </div>
    )
  }

  return <Scene />
}
