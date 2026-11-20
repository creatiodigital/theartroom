'use server'

import { getGalleryCommissionRates } from '@/lib/settings'

/**
 * The limited editions' commission rate for the editor's "Gallery keeps €X per print" hint. The editor
 * lives in the studio and inside the 3D wall editor, so it asks for the rate rather than threading
 * it through every parent. Advisory only: saving re-checks the margin on the server with the
 * setting as it is then. Not secret (any buyer price reveals it), so no session is required.
 */
export async function getGalleryRateForEditor(): Promise<number> {
  return (await getGalleryCommissionRates()).limited
}
