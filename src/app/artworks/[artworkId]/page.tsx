import { ArtworkDetailPage } from '@/components/artwork/detail'

interface ArtworkPageProps {
  params: Promise<{ artworkId: string }>
  searchParams: Promise<{ ref?: string }>
}

const ArtworkPage = async ({ params, searchParams }: ArtworkPageProps) => {
  const { artworkId } = await params
  const { ref } = await searchParams
  const isInternal = ref === 'internal'

  return <ArtworkDetailPage artworkId={artworkId} isInternal={isInternal} />
}

export default ArtworkPage
