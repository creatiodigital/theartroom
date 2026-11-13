import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { test, expect } from '@playwright/test'

/**
 * Every icon name the code asks for exists in the icon map (questions.md Q146 i).
 *
 * `IconName` is `keyof` two `Record<string, …>` maps, so TypeScript accepts any string: the
 * media library asked for 'eye-off' (the key is 'eyeOff') and showed no icon, unnoticed. This
 * reads the source, as `font-family-wiring` does: the map's keys from `ui/Icon/Icon.tsx`, then
 * every literal `<Icon name="…">`, `<Button icon="…">`, `<Input icon="…">`, and the sound icons
 * a work can store (rendered as `<Icon name={soundIcon}>`).
 */

const ROOT = path.resolve(__dirname, '..')
const ICON_FILE = path.join(ROOT, 'src/components/ui/Icon/Icon.tsx')

const mapKeys = (source: string, mapName: string): string[] => {
  const start = source.indexOf(`const ${mapName}`)
  const open = source.indexOf('{', source.indexOf('=', start))
  const close = source.indexOf('\n}', open)
  return [...source.slice(open + 1, close).matchAll(/^\s*'?([A-Za-z][A-Za-z0-9-]*)'?\s*:/gm)].map(
    (m) => m[1],
  )
}

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(tsx|ts)$/.test(entry.name) ? [full] : []
  })

// The JSX tag an attribute at `index` belongs to: the last `<tag` opened before it (any case, so a
// plain `<input name="…">` after an `<Icon />` is not taken for the icon's).
const tagAt = (source: string, index: number): string | null => {
  const before = source.slice(Math.max(0, index - 2000), index)
  const tags = [...before.matchAll(/<([A-Za-z][A-Za-z0-9.]*)\b/g)]
  return tags.length ? tags[tags.length - 1][1] : null
}

type Use = { key: string; where: string }

const literalUses = (): Use[] => {
  const uses: Use[] = []
  for (const file of sourceFiles(path.join(ROOT, 'src'))) {
    if (file === ICON_FILE) continue
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(/\b(name|icon)=\{?\s*["']([A-Za-z][A-Za-z0-9-]*)["']/g)) {
      const tag = tagAt(source, m.index ?? 0)
      const attr = m[1]
      const counts =
        (tag === 'Icon' && attr === 'name') ||
        (tag !== null && ['Button', 'Input'].includes(tag) && attr === 'icon')
      if (!counts) continue
      const line = source.slice(0, m.index).split('\n').length
      uses.push({ key: m[2], where: `${path.relative(ROOT, file)}:${line}` })
    }
  }
  return uses
}

// The icons a sound can store (ArtisticSoundPanel's options), drawn by ArtisticSound.
const storedSoundIcons = (): Use[] => {
  const file = path.join(
    ROOT,
    'src/components/wallview/RightPanel/ArtisticSoundPanel/ArtisticSoundPanel.tsx',
  )
  const source = readFileSync(file, 'utf8')
  const block = source.slice(
    source.indexOf('const iconOptions'),
    source.indexOf(']', source.indexOf('const iconOptions')),
  )
  return [...block.matchAll(/value:\s*'([^']+)'/g)].map((m) => ({
    key: m[1],
    where: 'ArtisticSoundPanel iconOptions',
  }))
}

test.describe('icon names (Q146 i)', () => {
  const iconSource = readFileSync(ICON_FILE, 'utf8')
  const keys = new Set([
    ...mapKeys(iconSource, 'phosphorIcons'),
    ...mapKeys(iconSource, 'customIcons'),
  ])

  test('the icon map is read', () => {
    // A guard for the reader itself: the map has the keys every page uses.
    for (const key of ['close', 'arrowRight', 'eyeOff', 'chevronDown'])
      expect(keys.has(key)).toBe(true)
  })

  test('the scan finds the icon names the code uses', () => {
    const found = literalUses().map((use) => use.key)
    expect(found.length).toBeGreaterThan(10)
    expect(found).toContain('eyeOff')
    expect(found).toContain('close')
  })

  test('every literal icon name exists in the map', () => {
    const missing = literalUses().filter((use) => !keys.has(use.key))
    expect(missing).toEqual([])
  })

  test('every sound icon a work can store exists in the map', () => {
    const sounds = storedSoundIcons()
    expect(sounds.map((use) => use.key)).toEqual(['volume-2', 'headphones'])
    expect(sounds.filter((use) => !keys.has(use.key))).toEqual([])
  })
})
