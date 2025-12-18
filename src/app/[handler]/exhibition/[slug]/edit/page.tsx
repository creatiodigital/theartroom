'use client'

import { useParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'

import { EditView } from '@/components/editview'
import { useGLTF } from '@react-three/drei'
import { resetArtworks } from '@/redux/slices/artworkSlice'
import { useGetExhibitionByUrlQuery } from '@/redux/slices/exhibitionApi'
import { setExhibition } from '@/redux/slices/exhibitionSlice'
import { resetScene } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import { resetWizard } from '@/redux/slices/wizardSlice'
import type { AppDispatch } from '@/redux/store'
import type { TExhibition } from '@/types/exhibition'

const EditPageWrapper = () => {
  const params = useParams()
  const dispatch = useDispatch<AppDispatch>()
  const hasResetRef = useRef(false)

  // Extract the full URL from the route: /[handler]/exhibition/[slug]/edit
  // The slug param contains the exhibition URL (which is "handler/slug-title")
  const slug = params.slug as string

  // Reset all exhibition-related state when page loads
  // This ensures complete isolation between exhibitions
  useEffect(() => {
    if (!hasResetRef.current) {
      // Reset all Redux state
      dispatch(resetWallView())
      dispatch(resetScene())
      dispatch(resetArtworks())
      dispatch(resetWizard())

      // Clear GLTF cache for all space types
      useGLTF.clear('/assets/spaces/classic.glb')
      useGLTF.clear('/assets/spaces/modern.glb')

      hasResetRef.current = true
    }
  }, [dispatch])

  const { data: exhibition, isLoading, error } = useGetExhibitionByUrlQuery(slug, {
    skip: !slug,
  })

  useEffect(() => {
    if (exhibition) {
      // Convert API response to TExhibition format
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

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
  }

  if (error) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Error loading exhibition</div>
  }

  if (!exhibition) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Exhibition not found</div>
  }

  return <EditView />
}

export default EditPageWrapper

