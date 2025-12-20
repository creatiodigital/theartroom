import { ExhibitionEditPage } from '@/components/exhibitions/edit'

interface ExhibitionEditProps {
  params: Promise<{ artistSlug: string; exhibitionSlug: string }>
}

const ExhibitionEdit = async ({ params }: ExhibitionEditProps) => {
  const { artistSlug, exhibitionSlug } = await params
  return <ExhibitionEditPage artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
}

export default ExhibitionEdit
