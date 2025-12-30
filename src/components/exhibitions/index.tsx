'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

import { EmptyState } from '@/components/ui/EmptyState'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { H2 } from '@/components/ui/Typography'

import styles from './exhibitions.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  status: string
  user: {
    name: string
    lastName: string
    handler: string
  }
}

export const ExhibitionsPage = () => {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchExhibitions = async () => {
      try {
        const response = await fetch('/api/exhibitions?visibility=public')
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
    <>
      <Header />
      <div className={styles.page}>
        {loading ? (
          <LoadingBar />
        ) : (
          <>
            {/* Current Exhibitions */}
            <section className={styles.section}>
              <H2 className={styles.sectionTitle}>Current</H2>
              {currentExhibitions.length === 0 ? (
                <EmptyState message="No current exhibitions." />
              ) : (
                <ul className={styles.list}>
                  {currentExhibitions.map((exhibition) => (
                    <li key={exhibition.id} className={styles.listItem}>
                      <Link
                        href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
                        className={styles.exhibitionLink}
                      >
                        <span className={styles.exhibitionTitle}>{exhibition.mainTitle}</span>
                        <span className={styles.artistName}>
                          {' '}
                          — {exhibition.user.name} {exhibition.user.lastName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Past Exhibitions - only show if there are any */}
            {pastExhibitions.length > 0 && (
              <section className={styles.section}>
                <H2 className={styles.sectionTitle}>Past</H2>
                <ul className={styles.list}>
                  {pastExhibitions.map((exhibition) => (
                    <li key={exhibition.id} className={styles.listItem}>
                      <Link
                        href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
                        className={styles.exhibitionLink}
                      >
                        <span className={styles.exhibitionTitle}>{exhibition.mainTitle}</span>
                        <span className={styles.artistName}>
                          {' '}
                          — {exhibition.user.name} {exhibition.user.lastName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      <Footer />
    </>
  )
}
