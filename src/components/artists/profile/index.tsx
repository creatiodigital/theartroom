'use client'

interface ArtistProfilePageProps {
  slug: string
}

export const ArtistProfilePage = ({ slug }: ArtistProfilePageProps) => {
  return (
    <div>
      <h1>Artist Profile</h1>
      <p>Viewing artist: {slug}</p>
    </div>
  )
}
