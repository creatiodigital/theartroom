import { ArtworkEditPage } from '@/components/dashboard/artworks/edit'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  return <ArtworkEditPage artworkId={id} />
}
