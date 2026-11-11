'use client'

import Link from 'next/link'
import { Article, CaretRight, House, ImageSquare, type Icon } from '@phosphor-icons/react'

import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Panel } from '@/components/admin/ui/Panel'

import styles from './Content.module.scss'

type ContentPage = {
  name: string
  /** One line on what the page edits. */
  hint: string
  href: string
  icon: Icon
}

type ContentGroup = {
  title: string
  pages: ContentPage[]
}

/**
 * Every page listed for every admin, as before (Q66). Routes unchanged. The
 * Gallery selection line differs from the design's (Q67): the selection is
 * the whole of /prints.
 */
const CONTENT_GROUPS: ContentGroup[] = [
  {
    title: 'Home & curation',
    pages: [
      {
        name: 'Landing page',
        hint: 'Homepage slideshow',
        href: '/admin/content/landing',
        icon: House,
      },
      {
        name: 'Announcements',
        hint: 'The announcement on the homepage',
        href: '/admin/content/announcements',
        icon: Article,
      },
      {
        name: 'Gallery selection',
        hint: 'The works on the Prints page',
        href: '/admin/content/gallery-selection',
        icon: ImageSquare,
      },
    ],
  },
  {
    title: 'Pages',
    pages: [
      { name: 'About us', hint: 'Title and text', href: '/admin/content/about', icon: Article },
      {
        name: 'Prints',
        hint: 'Banner image, title and text',
        href: '/admin/content/prints',
        icon: Article,
      },
    ],
  },
  {
    title: 'Legal',
    pages: [
      {
        name: 'Terms and conditions',
        hint: 'Site terms',
        href: '/admin/content/terms',
        icon: Article,
      },
      {
        name: 'Online terms of sale',
        hint: 'Terms for buyers',
        href: '/admin/content/sale-terms',
        icon: Article,
      },
      {
        name: 'Privacy policy',
        hint: 'Personal data and cookies',
        href: '/admin/content/privacy',
        icon: Article,
      },
      {
        name: 'Accessibility policy',
        hint: 'Accessibility statement',
        href: '/admin/content/accessibility',
        icon: Article,
      },
    ],
  },
]

/** The public site's pages and texts, as three panels of whole-row links. */
export const ContentList = () => (
  <div className={styles.page}>
    <AdminPageHeader
      eyebrow="Gallery"
      title="Content"
      description="The pages and texts of the public site."
    />

    <div className={styles.groups}>
      {CONTENT_GROUPS.map((group) => (
        <Panel key={group.title} title={group.title} flush>
          <ul className={styles.list}>
            {group.pages.map(({ name, hint, href, icon: PageIcon }) => (
              <li key={href} className={styles.item}>
                <Link href={href} className={styles.row}>
                  <span className={styles.tile}>
                    <PageIcon size={18} weight="light" aria-hidden />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.hint}>{hint}</span>
                  </span>
                  <span className={styles.edit}>
                    Edit
                    <CaretRight size={14} weight="light" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  </div>
)
