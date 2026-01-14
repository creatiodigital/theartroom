import { ArtworkEditPage } from '@/components/dashboard/artworks/edit'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnUrl?: string }>
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params
  const { returnUrl } = await searchParams
  return <ArtworkEditPage artworkId={id} returnUrl={returnUrl} />
}
