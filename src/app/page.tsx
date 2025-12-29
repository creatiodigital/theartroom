import Link from 'next/link'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { H2 } from '@/components/ui/Typography'
import prisma from '@/lib/prisma'

import styles from './page.module.scss'

// Force dynamic rendering and disable caching for fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  // const featuredArtists = await prisma.user.findMany({
  //   where: {
  //     isFeatured: true,
  //   },
  //   orderBy: { name: 'asc' },
  //   take: 6,
  // })

  return (
    <main className={styles.home}>
      <Header />
      <section className={styles.hero} />

      <div className={styles.content}>
        <section className={styles.exhibitionsSection}>
          <H2 className={styles.sectionHeading}>Exhibitions</H2>
          {exhibitions.length === 0 ? (
            <p className={styles.emptyText}>No current exhibitions at the moment.</p>
          ) : (
            <ul className={styles.exhibitionList}>
              {exhibitions.map((exhibition) => (
                <li key={exhibition.id} className={styles.exhibitionItem}>
                  <Link
                    href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
                    className={styles.exhibitionLink}
                  >
                    <span className={styles.exhibitionAuthor}>
                      {exhibition.user.name} {exhibition.user.lastName}
                    </span>
                    <span className={styles.exhibitionTitle}>{exhibition.mainTitle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Featured Artists - only show if there are any */}
        {/* {featuredArtists.length > 0 && (
          <section>
            <H2 className={styles.sectionHeading}>Featured Artists</H2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {featuredArtists.map((artist) => (
                <li key={artist.id} style={{ padding: 'var(--space-3) 0' }}>
                  <Link
                    href={`/artists/${artist.handler}`}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 'var(--font-regular)',
                      fontSize: 'var(--text-2xl)',
                    }}
                  >
                    {artist.name} {artist.lastName}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )} */}
      </div>

      <Footer />
    </main>
  )
}
