'use client'

import { useEffect, useState } from 'react'
import { Text } from '@/components/ui/Typography'
import { RichText } from '@/components/ui/RichText'
import { LoadingBar } from '@/components/ui/LoadingBar'

interface PageData {
  id: string
  slug: string
  title: string
  content: string
  updatedAt: string
}

interface StaticPageContentProps {
  slug: string
}

export const StaticPageContent = ({ slug }: StaticPageContentProps) => {
  const [page, setPage] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const response = await fetch(`/api/pages/${slug}`)
        if (!response.ok) {
          throw new Error('Failed to fetch page content')
        }
        const data = await response.json()
        setPage(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchPage()
  }, [slug])

  if (loading) {
    return (
      <div>
        <LoadingBar />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <Text as="p">Failed to load content. Please try again later.</Text>
      </div>
    )
  }

  if (!page) {
    return (
      <div>
        <Text as="p">Content not found.</Text>
      </div>
    )
  }

  return (
    <div>
      <RichText content={page.content} />
    </div>
  )
}
