'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { Button } from '@/components/ui/Button'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { H1 } from '@/components/ui/Typography'

import styles from './ExhibitionProfile.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  status: string
  visibility: string
  startDate?: string
  endDate?: string
  user: {
    name: string
    lastName: string
    handler: string
    biography?: string
  }
}

interface ExhibitionProfilePageProps {
  artistSlug: string
  exhibitionSlug: string
}

export const ExhibitionProfilePage = ({ artistSlug, exhibitionSlug }: ExhibitionProfilePageProps) => {
  const [exhibition, setExhibition] = useState<Exhibition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchExhibition = async () => {
      try {
        const response = await fetch(`/api/exhibitions/by-url/${exhibitionSlug}`)
        if (!response.ok) {
          setError('Exhibition not found')
          return
        }
        const data = await response.json()
        setExhibition(data)
      } catch {
        setError('Failed to load exhibition')
      } finally {
        setLoading(false)
      }
    }
    fetchExhibition()
  }, [exhibitionSlug])

  if (loading) {
    return (
      <>
        <Header />
        <div className={styles.page}>
          <LoadingBar />
        </div>
        <Footer />
      </>
    )
  }

  if (error || !exhibition) {
    return (
      <>
        <Header />
        <div className={styles.page}>
          <p className={styles.error}>{error || 'Exhibition not found'}</p>
          <Link href="/exhibitions">← Back to Exhibitions</Link>
        </div>
        <Footer />
      </>
    )
  }

  const visitUrl = `/exhibitions/${artistSlug}/${exhibitionSlug}/visit`
  const artistName = `${exhibition.user.name} ${exhibition.user.lastName}`

  // Format dates if available
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const startDate = formatDate(exhibition.startDate)
  const endDate = formatDate(exhibition.endDate)
  const dateRange = startDate && endDate ? `${startDate} – ${endDate}` : startDate || endDate || null

  return (
    <>
      <Header />
      <div className={styles.page}>
        <div className={styles.content}>
          {/* Exhibition Title */}
          <H1 className={styles.title}>{exhibition.mainTitle}</H1>

          {/* Artist Name */}
          <p className={styles.artist}>
            by{' '}
            <Link href={`/artists/${exhibition.user.handler}`} className={styles.artistLink}>
              {artistName}
            </Link>
          </p>

          {/* Date Range */}
          {dateRange && <p className={styles.dates}>{dateRange}</p>}

          {/* Status Badge */}
          <div className={styles.statusBadge}>
            {exhibition.status === 'current' ? 'Now Showing' : 'Past Exhibition'}
          </div>

          {/* Description placeholder - to be filled when we add description field */}
          <div className={styles.description}>
            <p>
              Welcome to this virtual exhibition. Step into the gallery and explore the artworks in an
              immersive 3D environment.
            </p>
          </div>

          {/* Enter Exhibition CTA */}
          <div className={styles.cta}>
            <Link href={visitUrl}>
              <Button variant="primary" label="Enter Exhibition" />
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
