'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'

import { EditView } from '@/components/editview'
import { useGetExhibitionByUrlQuery } from '@/redux/slices/exhibitionApi'
import { setExhibition } from '@/redux/slices/exhibitionSlice'
import type { AppDispatch } from '@/redux/store'
import type { TExhibition } from '@/types/exhibition'

const EditPageWrapper = () => {
  const params = useParams()
  const dispatch = useDispatch<AppDispatch>()

  // Extract the full URL from the route: /[handler]/exhibition/[slug]/edit
  // The slug param contains the exhibition URL (which is "handler/slug-title")
  const slug = params.slug as string

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

