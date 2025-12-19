import { ArtistProfilePage } from "@/components/artists/profile"

interface ArtistProfileProps {
  params: Promise<{ slug: string }>
}

const ArtistProfile = async ({ params }: ArtistProfileProps) => {
  const { slug } = await params
  return <ArtistProfilePage slug={slug} />
}

export default ArtistProfile
