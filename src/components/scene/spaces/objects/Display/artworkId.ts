import type { Object3D } from 'three'

/**
 * Which artwork an `artworkImage` mesh shows: `Display` writes the artwork's id into the image
 * mesh's `userData`, and anything that keeps data per artwork (AR-161: the light a bake measured
 * at each work) finds the work by it — never by mesh identity or scene order, since images load
 * late, one at a time, and can be hidden.
 */
const ARTWORK_ID_KEY = 'artworkId'

export const artworkUserData = (artworkId: string) => ({ [ARTWORK_ID_KEY]: artworkId })

export const artworkIdOf = (image: Object3D): string | undefined => {
  const id = image.userData[ARTWORK_ID_KEY]
  return typeof id === 'string' && id ? id : undefined
}

/**
 * The name of `Display`'s own root group: an artwork's image, paper, mat, frame and support all
 * hang below it, and nothing of another artwork does. Per-artwork data that lights the parts
 * around an image (AR-161: the bake's measured light on its mat, frame and backing) finds them by it.
 */
export const ARTWORK_DISPLAY_NAME = 'artworkDisplay'

/** The display an artwork image belongs to: its nearest `ARTWORK_DISPLAY_NAME` ancestor. */
export const artworkDisplayOf = (image: Object3D): Object3D | null => {
  for (let o = image.parent; o; o = o.parent) if (o.name === ARTWORK_DISPLAY_NAME) return o
  return null
}
