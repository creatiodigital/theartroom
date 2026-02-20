type TAlignedArtwork = {
  x: number
  y: number
  width: number
  height: number
}

type HorizontalAlignment = 'top' | 'bottom' | 'center-horizontal'
type VerticalAlignment = 'left' | 'right' | 'center-vertical'

export interface AlignmentResult {
  horizontal: HorizontalAlignment[]
  vertical: VerticalAlignment[]
}

const tolerance = 8

export const areAligned = (
  artworkA: TAlignedArtwork,
  artworkB: TAlignedArtwork,
): AlignmentResult => {
  const directions: AlignmentResult = {
    horizontal: [],
    vertical: [],
  }

  // Check top alignment
  if (Math.abs(artworkA.y - artworkB.y) <= tolerance) {
    directions.horizontal.push('top')
  }

  // Check bottom alignment
  if (Math.abs(artworkA.y + artworkA.height - (artworkB.y + artworkB.height)) <= tolerance) {
    directions.horizontal.push('bottom')
  }

  // Check horizontal center alignment
  if (
    Math.abs(artworkA.y + artworkA.height / 2 - (artworkB.y + artworkB.height / 2)) <= tolerance
  ) {
    directions.horizontal.push('center-horizontal')
  }

  // Check left alignment
  if (Math.abs(artworkA.x - artworkB.x) <= tolerance) {
    directions.vertical.push('left')
  }

  // Check right alignment
  if (Math.abs(artworkA.x + artworkA.width - (artworkB.x + artworkB.width)) <= tolerance) {
    directions.vertical.push('right')
  }

  // Check vertical center alignment
  if (Math.abs(artworkA.x + artworkA.width / 2 - (artworkB.x + artworkB.width / 2)) <= tolerance) {
    directions.vertical.push('center-vertical')
  }

  return directions
}
