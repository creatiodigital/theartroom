import { GridPageLoading } from '@/components/ui/Skeleton'

/**
 * other-screens.md "Loading states": the real title and line, then placeholder works. (Prints has no
 * child routes, so this wraps only the Prints page. Exhibitions, Artists and the artwork page do:
 * theirs need their page in a route group first, or they would show while a child route loads.)
 */
export default function Loading() {
  return (
    <GridPageLoading
      title="Prints"
      subtitle="A selection of prints from our artists. Many more works are available as prints on each exhibition and artist page."
    />
  )
}
