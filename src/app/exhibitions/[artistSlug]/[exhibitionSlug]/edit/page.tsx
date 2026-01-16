import { ExhibitionEditPage } from '@/components/exhibitions/edit'

interface ExhibitionEditProps {
  params: Promise<{ artistSlug: string; exhibitionSlug: string }>
  searchParams: Promise<{ wallId?: string; artworkId?: string }>
}

const ExhibitionEdit = async ({ params, searchParams }: ExhibitionEditProps) => {
  const { artistSlug, exhibitionSlug } = await params
  const { wallId, artworkId } = await searchParams
  return (
    <ExhibitionEditPage
      artistSlug={artistSlug}
      exhibitionSlug={exhibitionSlug}
      initialWallId={wallId}
      initialArtworkId={artworkId}
    />
  )
}

export default ExhibitionEdit
