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
  /** Where the text sits in its box (ArtisticText's `justify-content`); unset: top. */
  verticalAlign?: 'top' | 'center' | 'bottom'
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

/**
 * How much of the box a text needs so it doesn't leave it, by where it sits (pure): the spacing
 * is room inside the box, and a text may run into it. Top: the top spacing, then the text. Bottom:
 * the text, then the bottom spacing. Middle: the text and its spacing centred (ArtisticText), so
 * the difference between the two spacings.
 */
export const neededHeight = (height: number, style: WallTextStyle) => {
  if (style.verticalAlign === 'bottom') return style.padBottom + height
  if (style.verticalAlign === 'center') return height + Math.abs(style.padTop - style.padBottom)
  return style.padTop + height
}

/**
 * The verdict for a measured height (pure). A text doesn't fit when it leaves its box (owner,
 * 2026-11-14: running into its spacing is fine, the wall shows that it fits), and only when at
 * least half a line is outside: the artist adjusts anything finer by eye.
 */
export const fitOf = (height: number, style: WallTextStyle, boxHeight: number): WallTextFit => {
  const line = style.fontSize * style.lineHeight
  const linesOver = line > 0 ? Math.round((neededHeight(height, style) - boxHeight) / line) : 0
  return linesOver >= 1 ? { fits: false, linesOver, height } : { fits: true, linesOver: 0, height }
}

/** The box height that gives the text all its top and bottom spacing (Make the box taller). */
export const comfortableHeight = (height: number, style: WallTextStyle) =>
  height + style.padTop + style.padBottom
