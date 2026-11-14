/**
 * AR-182: whether a wall text fits its box (docs/wall-languages rule 6). Only the words change
 * between languages: the box and the text size stay as the artist set them, so a longer
 * translation is the artist's to fix. The Text tab says when a text doesn't fit and offers to
 * make the box taller or the text smaller; the wall view shows what spills out.
 *
 * Measured as the wall view lays the text out (ArtisticText's content: its font, size, line
 * height, letter spacing, side spacing, `pre-wrap`), in wall pixels, off screen.
 */

/** The wall view's CSS font for each family key (app/fonts.ts). */
export const WALL_FONT_FAMILIES: Record<string, string> = {
  roboto: 'var(--font-wall-roboto)',
  lora: 'var(--font-wall-lora)',
  alegreya: 'var(--font-wall-alegreya)',
  manrope: 'var(--font-wall-manrope)',
  'garamond-glc': 'var(--font-wall-garamond-glc)',
  crimson: 'var(--font-wall-crimson)',
  'dm-sans': 'var(--font-wall-dm-sans)',
  'plus-jakarta-sans': 'var(--font-wall-plus-jakarta-sans)',
}

/** The CSS weight and style of each weight key. */
export const WALL_FONT_STYLES: Record<string, { weight: number; style: string }> = {
  regular: { weight: 400, style: 'normal' },
  italic: { weight: 400, style: 'italic' },
  bold: { weight: 700, style: 'normal' },
  'bold-italic': { weight: 700, style: 'italic' },
}

export type WallTextStyle = {
  fontSize: number
  lineHeight: number
  letterSpacing: number
  fontFamily: string
  fontWeight: string
  padTop: number
  padBottom: number
  padLeft: number
  padRight: number
}

export type WallTextFit = {
  fits: boolean
  /** Whole lines that fall outside the box (0 when it fits). */
  linesOver: number
  /** The text's own height, without the top and bottom spacing. */
  height: number
}

/** The height of `text` laid out in a box `boxWidth` wide, in wall pixels (null without a DOM). */
export const measureWallText = (
  text: string,
  style: WallTextStyle,
  boxWidth: number,
): number | null => {
  if (typeof document === 'undefined') return null
  const font = WALL_FONT_STYLES[style.fontWeight] ?? WALL_FONT_STYLES.regular
  const measurer = document.createElement('div')
  Object.assign(measurer.style, {
    position: 'absolute',
    top: '-9999px',
    left: '-9999px',
    visibility: 'hidden',
    boxSizing: 'border-box',
    width: `${boxWidth}px`,
    padding: `0 ${style.padRight}px 0 ${style.padLeft}px`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    wordWrap: 'break-word',
    fontFamily: WALL_FONT_FAMILIES[style.fontFamily] ?? WALL_FONT_FAMILIES.roboto,
    fontWeight: String(font.weight),
    fontStyle: font.style,
    fontSize: `${style.fontSize}px`,
    lineHeight: String(style.lineHeight),
    letterSpacing: `${style.letterSpacing}px`,
  } satisfies Partial<CSSStyleDeclaration>)
  measurer.textContent = text
  document.body.appendChild(measurer)
  const height = measurer.getBoundingClientRect().height
  document.body.removeChild(measurer)
  return height
}

/** Whether `text` fits a box of `boxWidth` × `boxHeight` (wall pixels); null without a DOM. */
export const wallTextFit = (
  text: string,
  style: WallTextStyle,
  boxWidth: number,
  boxHeight: number,
): WallTextFit | null => {
  if (!text.trim()) return { fits: true, linesOver: 0, height: 0 }
  const height = measureWallText(text, style, boxWidth)
  if (height === null) return null
  return fitOf(height, style, boxHeight)
}

/** The verdict for a measured height (pure: the rounding the Text tab reports). */
export const fitOf = (height: number, style: WallTextStyle, boxHeight: number): WallTextFit => {
  const available = boxHeight - style.padTop - style.padBottom
  // Half a pixel of slack: the browser rounds line boxes.
  if (height <= available + 0.5) return { fits: true, linesOver: 0, height }
  const line = style.fontSize * style.lineHeight
  const linesOver = Math.max(1, Math.ceil((height - available) / line - 0.05))
  return { fits: false, linesOver, height }
}
