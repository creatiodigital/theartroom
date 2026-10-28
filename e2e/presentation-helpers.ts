import { rm } from 'fs/promises'

import type { PresentationSize } from '@/lib/printPresentation/record'
import {
  localPresentationPath,
  presentationPublicUrls,
  readLocalPresentationFile,
  writeLocalPresentationFile,
} from '@/lib/printPresentation/storage'

/**
 * Print-presentation fixtures for e2e: blank, transparent renders at the stored sizes, written on
 * the local backend (BAKE_STORAGE=local) under an artwork's real file names — and a stash, so a
 * real render already there is put back exactly as it was.
 */

const b64 = (s: string) => Buffer.from(s, 'base64')

/** Blank renders of two shot shapes: a wide one (1.25) and a tall one (0.5). */
export const BLANK = {
  wide: {
    aspect: 1.25,
    small: b64(
      'UklGRjoAAABXRUJQVlA4TC4AAAAvg8OzEAcQEREAUKT//ymi/6n//e9///vf//73v//973//+9///ve///3v//AA',
    ),
    large: b64(
      'UklGRo4AAABXRUJQVlA4TIEAAAAvB8dnEQcQEREQEiT+f28iov8Z//nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//8vw0A',
    ),
  },
  tall: {
    aspect: 0.5,
    small: b64(
      'UklGRmQAAABXRUJQVlA4TFgAAAAvg8PBEQcQEREQkCT9/09G9D/jP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//zn/7cC',
    ),
    large: b64(
      'UklGRi4BAABXRUJQVlA4TCIBAAAvB8eDEwcQEREAUKT//ymi/6n//e9///vf//73v//973//+9///ve///3vf//73//+97///e9///vf//73v//973//+9///ve///3vf//73//+97///e9///vf//73v//973//+9///ve///3vf//73//+97///e9///vf//73v//973//+9///ve///3vf//73//+97///e9///vf//73v//973//+9///ve///3vf//73//+97///e9///vf//73v//973//+9///ve///3vf//73//+97///e9///vf//73v//973//+9///ve///3vf//73//+97///e9///vf//73v//973//+9///ve///3vf//73//+97///e9///t/Gg==',
    ),
  },
} as const

export type BlankShape = keyof typeof BLANK

const SIZES: PresentationSize[] = ['large', 'small']

/** The local file behind one of an artwork's render URLs. */
const fileOf = (url: string) => localPresentationPath(url.split('/').slice(3))!

/** Writes a blank render of `shape` under the artwork's real names; returns its URLs. */
export async function writeBlankRender(
  artworkId: string,
  fingerprint: string,
  shape: BlankShape,
): Promise<Record<PresentationSize, string>> {
  const urls = presentationPublicUrls(artworkId, fingerprint)
  for (const size of SIZES) await writeLocalPresentationFile(fileOf(urls[size]), BLANK[shape][size])
  return urls
}

/** Removes the render files at the artwork's real names (to test a render that won't load). */
export async function removeRenderFiles(artworkId: string, fingerprint: string): Promise<void> {
  const urls = presentationPublicUrls(artworkId, fingerprint)
  for (const size of SIZES) await rm(fileOf(urls[size]), { force: true })
}

/** Keeps whatever render files the artwork has now; `restore` puts them back exactly. */
export async function stashRenderFiles(
  artworkId: string,
  fingerprint: string,
): Promise<{ restore: () => Promise<void> }> {
  const urls = presentationPublicUrls(artworkId, fingerprint)
  const kept = await Promise.all(SIZES.map((size) => readLocalPresentationFile(fileOf(urls[size]))))
  return {
    restore: async () => {
      for (const [i, size] of SIZES.entries()) {
        const bytes = kept[i]
        if (bytes) await writeLocalPresentationFile(fileOf(urls[size]), bytes)
        else await rm(fileOf(urls[size]), { force: true })
      }
    },
  }
}
