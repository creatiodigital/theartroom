import { ExhibitionViewPage } from '@/components/exhibitions/view'

interface ExhibitionViewProps {
  params: Promise<{ artistSlug: string; exhibitionSlug: string }>
}

const ExhibitionView = async ({ params }: ExhibitionViewProps) => {
  const { artistSlug, exhibitionSlug } = await params
  return <ExhibitionViewPage artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
}

export default ExhibitionView
