import Link from 'next/link'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import prisma from '@/lib/prisma'

import styles from './page.module.scss'

type ExhibitionWithUser = {
  id: string
  mainTitle: string
  url: string
  user: { name: string; lastName: string; handler: string }
}

export default async function Home() {
  // Fetch current public exhibitions
  const exhibitionData = await prisma.exhibition.findMany({
    where: {
      status: 'current',
      visibility: 'public',
    },
    include: {
      user: {
        select: {
          name: true,
          lastName: true,
          handler: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })
  const exhibitions = exhibitionData as unknown as ExhibitionWithUser[]

  // Fetch featured artists
  const featuredArtists = await prisma.user.findMany({
    where: {
      isFeatured: true,
    },
    orderBy: { name: 'asc' },
    take: 6,
  })

  return (
    <main className={styles.home}>
      <Header />
      <section className={styles.hero}>
        <h2>Welcome to Lumen Gallery</h2>
        <p>Discover and experience virtual art exhibitions</p>
      </section>

      {/* Current Exhibitions */}
      <section style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Exhibitions</h2>
        {exhibitions.length === 0 ? (
          <p>No current exhibitions at the moment.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {exhibitions.map((exhibition) => (
              <Link
                key={exhibition.id}
                href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
                style={{
                  display: 'block',
                  padding: '1.5rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'box-shadow 0.2s',
                }}
              >
                <h3 style={{ margin: 0 }}>{exhibition.mainTitle}</h3>
                <p style={{ margin: '0.5rem 0 0', color: '#666' }}>
                  by {exhibition.user.name} {exhibition.user.lastName}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured Artists */}
      <section style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Featured Artists</h2>
        {featuredArtists.length === 0 ? (
          <p>No featured artists at the moment.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            {featuredArtists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artists/${artist.handler}`}
                style={{
                  display: 'block',
                  padding: '1rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: 'inherit',
                  textAlign: 'center',
                }}
              >
                {artist.profileImageUrl && (
                  <img
                    src={artist.profileImageUrl}
                    alt={`${artist.name} ${artist.lastName}`}
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      margin: '0 auto 0.5rem',
                      display: 'block',
                    }}
                  />
                )}
                <h4 style={{ margin: 0 }}>
                  {artist.name} {artist.lastName}
                </h4>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </main>
  )
}
