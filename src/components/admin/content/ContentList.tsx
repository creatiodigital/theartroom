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
  /** Listed for super admins only: the page and its API are theirs alone (Q66). */
  superAdminOnly?: boolean
}

type ContentGroup = {
  title: string
  pages: ContentPage[]
}

/**
 * Routes unchanged. Gallery selection and its twin Home page prints are listed for super admins
 * only (Q66), as their pages let only them in. Gallery selection's line differs from the design's
 * (Q67): the selection is the whole of /prints.
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
        superAdminOnly: true,
      },
      {
        name: 'Home page prints',
        hint: 'The prints that rotate on the homepage',
        href: '/admin/content/home-prints',
        icon: ImageSquare,
        superAdminOnly: true,
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

type ContentListProps = {
  /** The session's `userType === 'superAdmin'`, the gallery-selection page's own check. */
  isSuperAdmin: boolean
}

/** The public site's pages and texts, as three panels of whole-row links. */
export const ContentList = ({ isSuperAdmin }: ContentListProps) => (
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
            {group.pages
              .filter((contentPage) => isSuperAdmin || !contentPage.superAdminOnly)
              .map(({ name, hint, href, icon: PageIcon }) => (
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
