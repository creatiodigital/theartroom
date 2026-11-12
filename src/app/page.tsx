import type { Metadata } from 'next'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { Text } from '@/components/ui/Typography'
import { Slideshow } from '@/components/landing/Slideshow'
import { Announcement } from '@/components/landing/Announcement/Announcement'
import { Intro } from '@/components/landing/Intro/Intro'
import { FeaturedArtists } from '@/components/landing/FeaturedArtists/FeaturedArtists'
import { HomePrints } from '@/components/landing/HomePrints/HomePrints'
import { HomeSectionHead, WideOnly } from '@/components/landing/HomeSectionHead/HomeSectionHead'
import { ExhibitionGrid } from '@/components/exhibitions/ExhibitionGrid'
import { FeedbackBand } from '@/components/feedback/FeedbackBand'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import { getHomePrints } from '@/lib/queries/getGallerySelection'
import { getHomepageAnnouncement } from '@/lib/queries/getHomepageAnnouncement'

import styles from './page.module.scss'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room' },
  description:
    'Explore curated virtual exhibitions in immersive 3D gallery spaces. Discover contemporary art beyond immediacy.',
}

// Render per request and read straight from the DB so admin edits (slides,
// exhibitions, featured artists) appear immediately. No data cache.
export const dynamic = 'force-dynamic'

const getSlides = async () => {
  const slidesData = await prisma.slide.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })
  return slidesData.map((slide) => ({
    id: slide.id,
    imageUrl: slide.imageUrl,
    mobileImageUrl: slide.mobileImageUrl,
    exhibitionUrl: slide.exhibitionUrl,
    meta: slide.meta,
    title: slide.title,
    subtitle: slide.subtitle,
    textColor: slide.textColor,
  }))
}

// Only the columns the cards use: a whole Exhibition row carries the frozen
// 3D snapshot and the bake, the bulk of its size.
const getExhibitions = () =>
  prisma.exhibition.findMany({
    where: {
      status: 'current',
      published: true,
    },
    select: {
      id: true,
      mainTitle: true,
      url: true,
      featuredImageUrl: true,
      shortDescription: true,
      spacePublished: true,
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

const getFeaturedArtists = async () => {
  return prisma.user.findMany({
    where: {
      isFeatured: true,
      published: true,
    },
    select: {
      id: true,
      name: true,
      lastName: true,
      handler: true,
      biography: true,
      profileImageUrl: true,
    },
    orderBy: { name: 'asc' },
  })
}

// The Fine-art prints section's works (Home page prints, home.md §5). FAILS SOFT, as the
// announcement: if the read fails, the homepage shows no prints section rather than an error.
const getHomePrintSlides = () =>
  getHomePrints().catch((err) => {
    captureError(err, { flow: 'content', stage: 'homepage-prints', level: 'warning' })
    return []
  })

export default async function Home() {
  // Independent reads, so in parallel rather than one after another.
  const [slides, exhibitions, featuredArtists, announcement, prints] = await Promise.all([
    getSlides(),
    getExhibitions(),
    getFeaturedArtists(),
    getHomepageAnnouncement(),
    getHomePrintSlides(),
  ])

  return (
    <main id="main-content" className={styles.home}>
      <Header borderless />

      <Text as="h1" className={styles.srOnly}>
        The Art Room
      </Text>

      {slides.length > 0 && <Slideshow slides={slides} />}

      {/* docs/public-redesign/home.md: introduction, current exhibitions, announcements, the
          rotating prints, artists, the feedback band. */}
      <div className={styles.content}>
        <Intro />

        <section className={styles.exhibitionsSection}>
          <HomeSectionHead
            title="Current exhibitions"
            rule
            link={{
              href: '/exhibitions',
              label: (
                <>
                  All<WideOnly> exhibitions</WideOnly>
                </>
              ),
            }}
          />
          {exhibitions.length === 0 ? (
            <Text as="p" className={styles.emptyText}>
              No current exhibitions at the moment.
            </Text>
          ) : (
            <ExhibitionGrid
              exhibitions={exhibitions.map((exhibition) => ({
                id: exhibition.id,
                mainTitle: exhibition.mainTitle,
                featuredImageUrl: exhibition.featuredImageUrl,
                shortDescription: exhibition.shortDescription,
                artistLabel: `${exhibition.user.name} ${exhibition.user.lastName}`,
                href: `/exhibitions/${exhibition.user.handler}/${exhibition.url}`,
                // Same rule as the exhibition page's Enter button: only once its 3D room is out.
                visitUrl: exhibition.spacePublished
                  ? `/exhibitions/${exhibition.user.handler}/${exhibition.url}/visit`
                  : null,
              }))}
            />
          )}
        </section>

        {/* Hidden when there's no announcement to show (AR-174). */}
        {announcement && <Announcement announcement={announcement} />}

        <HomePrints slides={prints} />

        <FeaturedArtists artists={featuredArtists} />

        <FeedbackBand />
      </div>

      <Footer />
    </main>
  )
}
