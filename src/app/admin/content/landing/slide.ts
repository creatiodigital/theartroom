/** A homepage slide as the admin's landing page edits it (`/api/slides`). */
export type Slide = {
  id: string
  order: number
  imageUrl: string
  mobileImageUrl: string | null
  title: string
  subtitle: string
  meta: string
  exhibitionUrl: string
  isActive: boolean
  textColor: string
  ctaBackgroundColor: string
  ctaTextColor: string
}

// `desktop` is the main image; `mobile` is the optional portrait one used on
// phones and tablets (falls back to the desktop image when absent).
export type SlideImageVariant = 'desktop' | 'mobile'

/** What the Edit slide window changes: its Save is offered once one of these differs. */
export const EDITABLE_SLIDE_FIELDS = [
  'imageUrl',
  'mobileImageUrl',
  'title',
  'subtitle',
  'meta',
  'exhibitionUrl',
  'textColor',
] as const satisfies readonly (keyof Slide)[]
