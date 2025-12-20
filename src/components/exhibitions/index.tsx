'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

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
      <div style={{ padding: '2rem', minHeight: '60vh', maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem' }}>Exhibitions</h1>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {/* Current Exhibitions */}
            <section style={{ marginBottom: '3rem' }}>
              <h2
                style={{
                  marginBottom: '1rem',
                  borderBottom: '2px solid #333',
                  paddingBottom: '0.5rem',
                }}
              >
                Current
              </h2>
              {currentExhibitions.length === 0 ? (
                <p style={{ color: '#666' }}>No current exhibitions.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {currentExhibitions.map((exhibition) => (
                    <li
                      key={exhibition.id}
                      style={{ padding: '0.75rem 0', borderBottom: '1px solid #eee' }}
                    >
                      <Link
                        href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <strong>{exhibition.mainTitle}</strong>
                        <span style={{ color: '#666' }}>
                          {' '}
                          — {exhibition.user.name} {exhibition.user.lastName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Past Exhibitions */}
            <section>
              <h2
                style={{
                  marginBottom: '1rem',
                  borderBottom: '2px solid #333',
                  paddingBottom: '0.5rem',
                }}
              >
                Past
              </h2>
              {pastExhibitions.length === 0 ? (
                <p style={{ color: '#666' }}>No past exhibitions.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {pastExhibitions.map((exhibition) => (
                    <li
                      key={exhibition.id}
                      style={{ padding: '0.75rem 0', borderBottom: '1px solid #eee' }}
                    >
                      <Link
                        href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <strong>{exhibition.mainTitle}</strong>
                        <span style={{ color: '#666' }}>
                          {' '}
                          — {exhibition.user.name} {exhibition.user.lastName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
      <Footer />
    </>
  )
}
