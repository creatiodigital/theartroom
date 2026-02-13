import type { TOption } from '@/types/artwork'

function toOptions<T extends string | number>(values: readonly T[]): TOption<T>[] {
  return values.map((v) => ({
    value: v,
    label: String(v),
  }))
}

export const fontSizes = toOptions(Array.from({ length: 23 }, (_, i) => i + 2) as number[])

export const lineHeights = toOptions(
  Array.from({ length: 11 }, (_, i) => +(1 + i * 0.1).toFixed(1)),
)

export const letterSpacings = toOptions([0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4] as const)

export const fontWeights: TOption<'regular' | 'bold'>[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'bold', label: 'Bold' },
]

export const fontFamilies: TOption<'roboto' | 'lora' | 'lato' | 'eb-garamond' | 'geist' | 'playfair-display'>[] = [
  { value: 'roboto', label: 'Roboto' },
  { value: 'lora', label: 'Lora' },
  { value: 'lato', label: 'Lato' },
  { value: 'eb-garamond', label: 'EB Garamond' },
  { value: 'geist', label: 'Geist' },
  { value: 'playfair-display', label: 'Playfair Display' },
]

export const textPaddings = toOptions(Array.from({ length: 25 }, (_, i) => i) as number[])
