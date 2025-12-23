'use client'

import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { EditView } from '@/components/editview'
import { useGLTF } from '@react-three/drei'
import { useLoadExhibitionArtworks } from '@/hooks/useLoadExhibitionArtworks'
import { resetArtworks } from '@/redux/slices/artworkSlice'
import { useGetExhibitionByUrlQuery } from '@/redux/slices/exhibitionApi'
import { setExhibition } from '@/redux/slices/exhibitionSlice'
import { resetScene } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import { resetWizard } from '@/redux/slices/wizardSlice'
import type { AppDispatch } from '@/redux/store'
import type { TExhibition } from '@/types/exhibition'

interface ExhibitionEditPageProps {
  artistSlug: string
  exhibitionSlug: string
}

export const ExhibitionEditPage = ({ artistSlug, exhibitionSlug }: ExhibitionEditPageProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const hasResetRef = useRef(false)

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

  const {
    data: exhibition,
    isLoading,
    error,
  } = useGetExhibitionByUrlQuery(exhibitionSlug, {
    skip: !exhibitionSlug,
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
        // Lighting customization
        ambientLightColor: exhibition.ambientLightColor ?? undefined,
        ambientLightIntensity: exhibition.ambientLightIntensity ?? undefined,
      }
      dispatch(setExhibition(exhibitionData))
    }
  }, [exhibition, dispatch])

  // Load saved artworks from database
  useLoadExhibitionArtworks(exhibition?.id)

  // Redirect to home if not logged in
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

  // Check ownership: user must own the exhibition OR be an admin
  useEffect(() => {
    if (sessionStatus === 'authenticated' && exhibition) {
      const isOwner = session?.user?.id === exhibition.userId
      const isAdmin = session?.user?.userType === 'admin'

      if (!isOwner && !isAdmin) {
        router.push('/dashboard')
      }
    }
  }, [sessionStatus, session, exhibition, router])

  // Show loading while checking session or if unauthenticated (redirect pending)
  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated') {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Loading...
      </div>
    )
  }

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

  // Final ownership check before rendering
  const isOwner = session?.user?.id === exhibition.userId
  const isAdmin = session?.user?.userType === 'admin'

  if (!isOwner && !isAdmin) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Not authorized
      </div>
    )
  }

  return <EditView />
}
