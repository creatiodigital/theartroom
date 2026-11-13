import { ListPageLoading } from '@/components/ui/Skeleton'

/**
 * other-screens.md "Loading states": the real title, then two placeholder rows. In the (list) route
 * group so it covers this page only, never an artist's page.
 */
export default function Loading() {
  return <ListPageLoading title="Artists" />
}
