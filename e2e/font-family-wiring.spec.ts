import fs from 'node:fs'
import path from 'node:path'

import { test, expect } from '@playwright/test'

import { FONT_FAMILIES, FONT_FAMILY_WEIGHTS, type TFontWeight } from '../src/types/fonts'

// Adding a font family means editing SIX separate lists, and the failure when
// one is missed is silent and asymmetric: the 2D editor reads a CSS variable,
// the 3D scene reads a .ttf off disk. Miss the Stencil map and the wall text
// looks right to the artist while rendering as Roboto in the room they publish.
//
// So rather than trust six hand-maintained lists to agree, this walks
// FONT_FAMILIES — the one list that defines what exists — and proves every
// other place knows about each entry. Pure string/file assertions: no browser,
// no dev server, no WebGL.

const ROOT = path.join(__dirname, '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const SOURCES = {
  appFonts: 'src/app/fonts.ts',
  layout: 'src/app/layout.tsx',
  options: 'src/components/wallview/RightPanel/ArtisticTextPanel/constants.ts',
  panelMap: 'src/components/wallview/RightPanel/ArtisticTextPanel/ArtisticTextPanel.tsx',
  canvasMap: 'src/components/wallview/ArtisticText/ArtisticText.tsx',
  stencilMap: 'src/components/scene/spaces/objects/Stencil/Stencil.tsx',
}

// The .ttf a given family+weight must ship, matching the naming already in
// public/fonts. `regular` is the bare stem so `roboto-regular.ttf` stays the
// shape it has always had.
const fontFile = (family: string, weight: TFontWeight) => `public/fonts/${family}-${weight}.ttf`

test('every font family declares at least a regular weight', () => {
  for (const family of FONT_FAMILIES) {
    expect(FONT_FAMILY_WEIGHTS[family], `${family} has no weight list`).toBeTruthy()
    expect(FONT_FAMILY_WEIGHTS[family], `${family} must support regular`).toContain('regular')
  }
})

test('every font family ships a .ttf for every weight it claims', () => {
  // This is the one the 3D scene depends on. A family that claims `bold` but
  // ships no bold file falls back silently and the artist never sees why.
  const missing: string[] = []
  for (const family of FONT_FAMILIES) {
    for (const weight of FONT_FAMILY_WEIGHTS[family]) {
      // Garamond GLC predates the convention and ships as `garamont-glc.ttf`.
      if (family === 'garamond-glc') continue
      const rel = fontFile(family, weight)
      if (!fs.existsSync(path.join(ROOT, rel))) missing.push(rel)
    }
  }
  expect(missing, `missing font files:\n${missing.join('\n')}`).toEqual([])
})

test('every font family is offered in the sidebar dropdown', () => {
  const options = read(SOURCES.options)
  for (const family of FONT_FAMILIES) {
    expect(options, `${family} missing from fontFamilies options`).toContain(`'${family}'`)
  }
})

test('every font family maps to a CSS variable in both 2D renderers', () => {
  // The dropdown preview and the wall canvas keep separate copies of this map.
  // Either one drifting shows the artist the wrong typeface.
  for (const [label, file] of [
    ['dropdown preview', SOURCES.panelMap],
    ['wall canvas', SOURCES.canvasMap],
  ] as const) {
    const src = read(file)
    for (const family of FONT_FAMILIES) {
      expect(src, `${family} missing from the ${label} CSS-var map`).toMatch(
        new RegExp(`['"]?${family}['"]?\\s*:\\s*'var\\(--font-wall-`),
      )
    }
  }
})

test('every CSS variable a renderer asks for is actually registered and mounted', () => {
  // A var that is never registered resolves to nothing and the browser silently
  // falls back to a system font — no error, just wrong type.
  const appFonts = read(SOURCES.appFonts)
  const layout = read(SOURCES.layout)
  const canvas = read(SOURCES.canvasMap)

  const used = [...canvas.matchAll(/var\((--font-wall-[a-z0-9-]+)\)/g)].map((m) => m[1])
  expect(used.length, 'no wall font vars found — did the map move?').toBeGreaterThan(0)

  for (const cssVar of new Set(used)) {
    expect(appFonts, `${cssVar} is never registered in app/fonts.ts`).toContain(cssVar)
  }

  // Registering is not enough: the variable only reaches the DOM if its font
  // object is in the <body> className.
  const registered = [...appFonts.matchAll(/export const (wallFont\d+)\s*=/g)].map((m) => m[1])
  for (const name of registered) {
    expect(layout, `${name} is registered but never mounted in layout.tsx`).toContain(
      `${name}.variable`,
    )
  }
})

test('every font family resolves to a real .ttf path in the 3D scene', () => {
  // Stencil holds its own map of family -> weight -> '/fonts/x.ttf'. Every path
  // it names must exist, or troika 404s and drops back to the default face.
  const stencil = read(SOURCES.stencilMap)

  for (const family of FONT_FAMILIES) {
    expect(stencil, `${family} missing from the Stencil font map`).toMatch(
      new RegExp(`['"]?${family}['"]?\\s*:\\s*\\{`),
    )
  }

  const paths = [...stencil.matchAll(/'(\/fonts\/[^']+\.ttf)'/g)].map((m) => m[1])
  expect(paths.length, 'no /fonts paths found — did the map move?').toBeGreaterThan(0)

  const missing = [...new Set(paths)].filter(
    (p) => !fs.existsSync(path.join(ROOT, 'public', p.replace(/^\//, ''))),
  )
  expect(missing, `Stencil points at files that do not exist:\n${missing.join('\n')}`).toEqual([])
})
