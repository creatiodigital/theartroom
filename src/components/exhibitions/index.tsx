'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

import { EmptyState } from '@/components/ui/EmptyState'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'

import styles from './exhibitions.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  status: string
  featuredImageUrl: string | null
  user: {
    name: string
    lastName: string
    handler: string
  }
}

const ExhibitionCard = ({ exhibition }: { exhibition: Exhibition }) => (
  <li className={styles.listItem}>
    <Link
      href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
      className={styles.exhibitionLink}
    >
      <div className={styles.imageWrapper}>
        {exhibition.featuredImageUrl ? (
          <Image
            src={exhibition.featuredImageUrl}
            alt={exhibition.mainTitle}
            fill
            sizes="(max-width: 768px) 100vw, 55vw"
            className={styles.image}
          />
        ) : (
          <div className={styles.imagePlaceholder} />
        )}
      </div>
      <div className={styles.info}>
        <Text as="span" font="serif" size="3xl" className={styles.exhibitionTitle}>
          {exhibition.mainTitle}
        </Text>
        <Text as="span" font="serif" size="xl" className={styles.artistName}>
          {exhibition.user.name} {exhibition.user.lastName}
        </Text>
      </div>
    </Link>
  </li>
)

export const ExhibitionsPage = () => {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchExhibitions = async () => {
      try {
        const response = await fetch('/api/exhibitions?published=true')
        if (response.ok) {
          const data = await response.json()
          setExhibitions(data)
        }
      } catch (error) {
        console.error('Failed to fetch exhibitions:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchExhibitions()
  }, [])

  const currentExhibitions = exhibitions.filter((e) => e.status === 'current')
  const pastExhibitions = exhibitions.filter((e) => e.status === 'past')

  return (
    <PageLayout loading={loading}>
      <section className={styles.section}>
        {currentExhibitions.length === 0 ? (
          <EmptyState message="No current exhibitions." />
        ) : (
          <ul className={styles.list}>
            {currentExhibitions.map((exhibition) => (
              <ExhibitionCard key={exhibition.id} exhibition={exhibition} />
            ))}
          </ul>
        )}
      </section>

      {pastExhibitions.length > 0 && (
        <section className={styles.section}>
          <Text as="h2" className={styles.sectionTitle}>
            Past
          </Text>
          <ul className={styles.list}>
            {pastExhibitions.map((exhibition) => (
              <ExhibitionCard key={exhibition.id} exhibition={exhibition} />
            ))}
          </ul>
        </section>
      )}
    </PageLayout>
  )
}
