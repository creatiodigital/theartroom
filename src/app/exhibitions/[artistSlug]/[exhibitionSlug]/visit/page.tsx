import { ExhibitionViewPage } from '@/components/exhibitions/view'

interface ExhibitionVisitProps {
  params: Promise<{ artistSlug: string; exhibitionSlug: string }>
}

const ExhibitionVisit = async ({ params }: ExhibitionVisitProps) => {
  const { artistSlug, exhibitionSlug } = await params
  return <ExhibitionViewPage artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
}

export default ExhibitionVisit
