import type { TOption } from '@/types/artwork'
import type { TFontFamily, TFontWeight } from '@/types/fonts'

function toOptions<T extends string | number>(values: readonly T[]): TOption<T>[] {
  return values.map((v) => ({
    value: v,
    label: String(v),
  }))
}

export const fontSizes = toOptions([
  1, 1.5, 2, 2.5, 3, 3.5,
  ...Array.from({ length: 97 }, (_, i) => i + 4), // 4–100 cm
] as number[])

export const lineHeights = toOptions(
  [0.5, 0.6, 0.7, 0.8, 0.9, ...Array.from({ length: 11 }, (_, i) => +(1 + i * 0.1).toFixed(1))],
)

export const letterSpacings = toOptions([0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4] as const)

export const fontWeights: TOption<TFontWeight>[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'italic', label: 'Regular Italic' },
  { value: 'bold', label: 'Bold' },
  { value: 'bold-italic', label: 'Bold Italic' },
]

export const fontFamilies: TOption<TFontFamily>[] = [
  { value: 'lora', label: 'Lora' },
  { value: 'alegreya', label: 'Alegreya' },
  { value: 'manrope', label: 'Manrope' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'garamond-glc', label: 'Garamond GLC' },
]

export const textPaddings = toOptions(Array.from({ length: 25 }, (_, i) => i) as number[])

// Z-depth options for text card thickness (0-5 cm)
export const textThicknessOptions = [
  { label: '0', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
  { label: '9', value: 9 },
  { label: '10', value: 10 },
]
