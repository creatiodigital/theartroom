import { PageIntro } from '@/components/ui/PageIntro'
import { PageLayout } from '@/components/ui/PageLayout'

import { ExhibitionGroups, type ListedExhibition } from './ExhibitionGroups'
import styles from './exhibitions.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  status: string
  featuredImageUrl: string | null
  shortDescription: string | null
  spacePublished: boolean
  user: {
    name: string
    lastName: string
    handler: string
  }
}

interface ExhibitionsPageProps {
  exhibitions: Exhibition[]
}

/** /exhibitions (docs/public-redesign/exhibitions.md): one compact row per exhibition. */
export const ExhibitionsPage = ({ exhibitions }: ExhibitionsPageProps) => {
  const listed: ListedExhibition[] = exhibitions.map((exhibition) => {
    const href = `/exhibitions/${exhibition.user.handler}/${exhibition.url}`
    return {
      id: exhibition.id,
      href,
      // Same rule as the exhibition page's Enter button: only once its 3D room is out.
      visitUrl: exhibition.spacePublished ? `${href}/visit` : null,
      title: exhibition.mainTitle,
      artistName: `${exhibition.user.name} ${exhibition.user.lastName}`.trim(),
      description: exhibition.shortDescription,
      imageUrl: exhibition.featuredImageUrl,
      status: exhibition.status,
    }
  })

  return (
    <PageLayout>
      <div className={styles.page}>
        <PageIntro title="Exhibitions" subtitle="Explore our curated exhibitions." />
        <ExhibitionGroups exhibitions={listed} />
      </div>
    </PageLayout>
  )
}
