export const FONT_FAMILIES = ['lora', 'alegreya', 'manrope', 'roboto', 'garamond-glc', 'crimson'] as const
export type TFontFamily = (typeof FONT_FAMILIES)[number]

export const FONT_WEIGHTS = ['regular', 'italic', 'bold', 'bold-italic'] as const
export type TFontWeight = (typeof FONT_WEIGHTS)[number]

/**
 * Which style variants each font family supports.
 * Used to filter the weight selector options in the UI.
 */
export const FONT_FAMILY_WEIGHTS: Record<TFontFamily, readonly TFontWeight[]> = {
  lora: ['regular', 'italic', 'bold', 'bold-italic'],
  alegreya: ['regular', 'italic', 'bold', 'bold-italic'],
  manrope: ['regular', 'bold'],
  roboto: ['regular', 'italic', 'bold', 'bold-italic'],
  'garamond-glc': ['regular'],
  crimson: ['regular', 'italic', 'bold', 'bold-italic'],
}

export type TTextAlign = 'left' | 'center' | 'right'

export type TOption<T> = {
  value: T
  label: string
}
