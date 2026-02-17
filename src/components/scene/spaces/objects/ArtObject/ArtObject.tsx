import { Display } from '@/components/scene/spaces/objects/Display'
import { SoundObject } from '@/components/scene/spaces/objects/SoundObject'
import { Stencil } from '@/components/scene/spaces/objects/Stencil'
import type { RuntimeArtwork } from '@/utils/artworkTransform'

interface ArtObjectProps {
  artwork: RuntimeArtwork
}

const ArtObject: React.FC<ArtObjectProps> = ({ artwork }) => {
  switch (artwork.artworkType) {
    case 'image':
      return <Display artwork={artwork} />
    case 'text':
      return <Stencil artwork={artwork} />
    case 'sound':
      return <SoundObject artwork={artwork} />
    default:
      return null
  }
}

export default ArtObject

