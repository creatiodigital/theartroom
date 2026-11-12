import { ListPageLoading } from '@/components/ui/Skeleton'

/**
 * other-screens.md "Loading states": the real title and line, then two placeholder rows. In the
 * (list) route group so it covers this page only, never an exhibition page or the 3D room.
 */
export default function Loading() {
  return (
    <ListPageLoading
      title="Exhibitions"
      subtitle="Explore our curated exhibitions, both current and past."
    />
  )
}
