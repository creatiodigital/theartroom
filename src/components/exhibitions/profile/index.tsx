'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'

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
    return <PageLayout loading />
  }

  if (error || !exhibition) {
    return (
      <PageLayout>
        <ErrorText>{error || 'Exhibition not found'}</ErrorText>
        <Link href="/exhibitions">← Back to Exhibitions</Link>
      </PageLayout>
    )
  }

  const visitUrl = `/exhibitions/${artistSlug}/${exhibitionSlug}/visit?ref=internal`
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
    <PageLayout>
      <div className={styles.content}>
        <div className={styles.heroSection}>
          <div className={styles.heroCta}>
            <Text as="h1" size="2xl" className={styles.title}>
              {exhibition.mainTitle}
            </Text>
            <Link href={`/artists/${exhibition.user.handler}`} className={styles.artist}>
              {artistName}
            </Link>
            <Button
              size="regular"
              label="Enter Virtual Exhibition"
              href={visitUrl}
              iconLeft={<ArrowRight size={16} />}
              className={styles.button}
            />
          </div>

          
          <div className={styles.heroImageWrapper}>
            <img
              src="/assets/landing/carousel1.webp"
              alt={exhibition.mainTitle}
              className={styles.heroImage}
            />
          </div>
        </div>

        {dateRange && (
          <Text as="p" className={styles.dates}>
            {dateRange}
          </Text>
        )}

        {exhibition.description && (
          <RichText content={exhibition.description} className={styles.description} />
        )}
      </div>
    </PageLayout>
  )
}
