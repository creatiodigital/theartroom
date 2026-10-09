import { sanitizeLine } from '@/utils/sanitizeLine'

/** Hard cap on a section title. The input's `maxLength` matches it. */
export const SECTION_TITLE_MAX = 60

/**
 * Clean and check a section title against the titles already taken in the same
 * exhibition. Duplicates are compared trimmed and case-insensitively — two
 * "Magnolia" headings on one page would read as a mistake. The caller passes
 * the OTHER sections' titles (exclude the one being renamed).
 */
export function validateSectionTitle(
  raw: unknown,
  takenTitles: string[],
): { title: string } | { error: string } {
  const title = typeof raw === 'string' ? sanitizeLine(raw) : ''
  if (!title) return { error: 'Section name is required.' }
  if (title.length > SECTION_TITLE_MAX) {
    return { error: `Section name must be ${SECTION_TITLE_MAX} characters or fewer.` }
  }
  const key = title.toLocaleLowerCase()
  if (takenTitles.some((taken) => taken.trim().toLocaleLowerCase() === key)) {
    return { error: 'This exhibition already has a section with that name.' }
  }
  return { title }
}

export type SectionGroup<T> = { id: string | null; title: string | null; artworks: T[] }

/**
 * The public page's layout, in one place: works with no section first (no
 * heading), then one group per section in the artist's order. `rows` must
 * already be in display order — each group keeps it. A row pointing at a
 * section not in `sections` falls back to no section rather than vanishing.
 * Empty groups are dropped, so a section with no visible works gets no heading.
 *
 * The grid renders `groups`; the artwork page's previous/next walks the same
 * groups flattened, so the two can never disagree.
 */
export function groupBySection<T>(
  rows: { sectionId: string | null; artwork: T }[],
  sections: { id: string; title: string }[],
): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = [
    { id: null, title: null, artworks: [] },
    ...sections.map((s) => ({ id: s.id, title: s.title, artworks: [] as T[] })),
  ]
  const byId = new Map(groups.map((g) => [g.id, g]))
  for (const row of rows) {
    const group = (row.sectionId && byId.get(row.sectionId)) || byId.get(null)!
    group.artworks.push(row.artwork)
  }
  return groups.filter((g) => g.artworks.length > 0)
}
