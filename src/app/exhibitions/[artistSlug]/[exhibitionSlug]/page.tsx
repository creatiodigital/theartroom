import { ExhibitionProfilePage } from '@/components/exhibitions/profile'

interface ExhibitionProfileProps {
  params: Promise<{ artistSlug: string; exhibitionSlug: string }>
}

const ExhibitionProfile = async ({ params }: ExhibitionProfileProps) => {
  const { artistSlug, exhibitionSlug } = await params
  return <ExhibitionProfilePage artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
}

export default ExhibitionProfile
