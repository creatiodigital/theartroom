import { ArtistLoginPage } from '@/components/artists/login'

interface PageProps {
  params: Promise<{ handler: string }>
}

export default async function Page({ params }: PageProps) {
  const { handler } = await params
  return <ArtistLoginPage handler={handler} />
}
