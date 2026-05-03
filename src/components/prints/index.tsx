'use client'

import { useEffect, useMemo, useState } from 'react'

import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'

import { PrintCard } from './PrintCard'
import { PrintsBanner } from './PrintsBanner'
import styles from './prints.module.scss'
import type { PrintArtwork, PrintsPageContent } from './types'

// Toolbar (artist filter, sort, search) is parked until the catalog grows —
// see PrintsToolbar.tsx. Re-wire state + `<PrintsToolbar />` below when needed.

export const PrintsPage = () => {
  const [artworks, setArtworks] = useState<PrintArtwork[]>([])
  const [pageContent, setPageContent] = useState<PrintsPageContent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Parallel fetches: the prints catalog and the CMS page (banner + copy).
    // We don't block the catalog on the CMS response — missing content
    // just hides the banner/description sections.
    Promise.all([
      fetch('/api/prints').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/pages/prints').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([printsData, pageData]) => {
        setArtworks(Array.isArray(printsData) ? printsData : [])
        if (pageData && typeof pageData === 'object' && 'slug' in pageData) {
          setPageContent({
            title: pageData.title,
            content: pageData.content ?? '',
            bannerImageUrl: pageData.bannerImageUrl ?? null,
          })
        }
      })
      .catch((error) => {
        console.error('Failed to load prints page:', error)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const sorted = useMemo(() => {
    return [...artworks].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [artworks])

  const hasDescription =
    !!pageContent?.content && pageContent.content.trim() !== '' && pageContent.content !== '<p></p>'

  return (
    <PageLayout loading={loading}>
      <PageHeader
        pageTitle="Prints"
        pageSubtitle="Museum-grade prints of selected works, hand-signed by the artist."
      />

      <div className={styles.intro}>
        <PrintsBanner
          imageUrl={pageContent?.bannerImageUrl ?? null}
          alt={pageContent?.title || 'Fine Art Prints'}
        />
        <div className={styles.description}>
          <Text as="h2" font="serif" size="3xl" className={styles.descriptionTitle}>
            Fine Art Prints
          </Text>
          {hasDescription && <RichText content={pageContent!.content} />}
        </div>
      </div>

      <div className={styles.sectionHeader}>
        <Text as="h2" font="serif" size="2xl" className={styles.sectionTitle}>
          Selected Works
        </Text>
      </div>

      {sorted.length === 0 ? (
        <EmptyState message="Very soon we will showcase a selection of works as signed, limited-edition prints — produced on archival, gallery-grade paper and shipped worldwide." />
      ) : (
        <div className={styles.grid}>
          {sorted.map((artwork) => (
            <PrintCard key={artwork.id} artwork={artwork} />
          ))}
        </div>
      )}
    </PageLayout>
  )
}
