import Link from 'next/link'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { Text } from '@/components/ui/Typography'
import { Slideshow } from '@/components/landing/Slideshow'
import prisma from '@/lib/prisma'

import styles from './page.module.scss'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ExhibitionWithUser = {
  id: string
  mainTitle: string
  url: string
  user: { name: string; lastName: string; handler: string }
}

export default async function Home() {
  const slidesData = await prisma.slide.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })

  const slides = slidesData.map((slide) => ({
    id: slide.id,
    imageUrl: slide.imageUrl,
    exhibitionUrl: slide.exhibitionUrl,
    meta: slide.meta,
    title: slide.title,
    subtitle: slide.subtitle,
  }))

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

  return (
    <main className={styles.home}>
      <Header />

      <Text as="h1" className={styles.srOnly}>
        The Foundation Art Gallery
      </Text>

      {slides.length > 0 && <Slideshow slides={slides} />}

      <div className={styles.content}>
        <section className={styles.exhibitionsSection}>
          <Text as="h2" font="sans" size="lg" className={styles.sectionHeading}>
            Exhibitions
          </Text>
          {exhibitions.length === 0 ? (
            <Text as="p" className={styles.emptyText}>
              No current exhibitions at the moment.
            </Text>
          ) : (
            <ul className={styles.exhibitionList}>
              {exhibitions.map((exhibition) => (
                <li key={exhibition.id} className={styles.exhibitionItem}>
                  <Link
                    href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
                    className={styles.exhibitionLink}
                  >
                    <Text as="span" font="serif" size="xl">
                      {exhibition.mainTitle}
                    </Text>
                    <Text as="span" font="serif" size="lg" className={styles.exhibitionAuthor}>
                      {exhibition.user.name} {exhibition.user.lastName}
                    </Text>
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
                      fontFamily: 'var(--font-serif)',
                      fontWeight: 'var(--font-regular)',
                      fontSize: 'var(--text-lg)',
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
