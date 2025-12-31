'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
<<<<<<< HEAD
import { LoadingBar } from '@/components/ui/LoadingBar'
import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
=======
import { Button } from '@/components/ui/Button'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { H1 } from '@/components/ui/Typography'
>>>>>>> develop

import styles from './ExhibitionProfile.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  description?: string
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

export const ExhibitionProfilePage = ({
  artistSlug,
  exhibitionSlug,
}: ExhibitionProfilePageProps) => {
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
<<<<<<< HEAD
        <div className="page-content">
=======
        <div className={styles.page}>
>>>>>>> develop
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
        <div className="page-content">
          <ErrorText>{error || 'Exhibition not found'}</ErrorText>
          <Link href="/exhibitions">← Back to Exhibitions</Link>
        </div>
        <Footer />
      </>
    )
  }

  const visitUrl = `/exhibitions/${artistSlug}/${exhibitionSlug}/visit`
  const artistName = `${exhibition.user.name} ${exhibition.user.lastName}`

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const startDate = formatDate(exhibition.startDate)
  const endDate = formatDate(exhibition.endDate)
  const dateRange =
    startDate && endDate ? `${startDate} – ${endDate}` : startDate || endDate || null

  return (
    <>
      <Header />
      <div className="page-content">
        <div className={styles.content}>
<<<<<<< HEAD
          <div className={styles.header}>
            <Text as="h1" className={styles.title}>
              {exhibition.mainTitle}
            </Text>
            <Link href={`/artists/${exhibition.user.handler}`} className={styles.artist}>
=======
          {/* Exhibition Title */}
          <H1 className={styles.title}>{exhibition.mainTitle}</H1>

          {/* Artist Name */}
          <p className={styles.artist}>
            by{' '}
            <Link href={`/artists/${exhibition.user.handler}`} className={styles.artistLink}>
>>>>>>> develop
              {artistName}
            </Link>
            <div className={styles.cta}>
              <Button
                variant="small"
                label="Enter Exhibition"
                href={visitUrl}
                iconRight={<ArrowRight size={16} />}
              />
            </div>
          </div>

<<<<<<< HEAD
          {dateRange && (
            <Text as="p" className={styles.dates}>
              {dateRange}
            </Text>
          )}
=======
          {/* Description placeholder - to be filled when we add description field */}
          <div className={styles.description}>
            <p>
              Welcome to this virtual exhibition. Step into the gallery and explore the artworks in
              an immersive 3D environment.
            </p>
          </div>
>>>>>>> develop

          {/* <div className={styles.badge}>
            <Badge
              label={exhibition.status === 'current' ? 'Now Showing' : 'Past Exhibition'}
              variant={exhibition.status === 'current' ? 'current' : 'past'}
              size="regular"
            />
          </div> */}

          {exhibition.description && (
            <RichText content={exhibition.description} className={styles.description} />
          )}
        </div>
      </div>
      <Footer />
    </>
  )
}
