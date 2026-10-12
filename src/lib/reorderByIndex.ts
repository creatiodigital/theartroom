import { Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'

// Tables whose 0-based `order` column is rewritten wholesale by a
// drag-and-drop reorder. Identifiers can't be bound as query parameters, so
// the table and scope column are restricted to these literals.
type OrderedTable = 'Artwork' | 'Slide' | 'SelectedPrint' | 'ExhibitionSection'
type ScopeColumn = 'userId' | 'exhibitionId'

/**
 * Sets each row's `order` to its index in `ids`, in ONE statement.
 *
 * Not a $transaction of per-row updates: each statement costs a full
 * round-trip to the database, and Prisma aborts a transaction after 5s
 * (P2028). An artist with 83 artworks crossed that from iad1 to eu-west-2
 * and every artwork reorder 500'd (AR-158). One UPDATE ... FROM unnest() is
 * a single round-trip whatever the list size, and atomic on its own.
 *
 * Ids that no longer exist, or fall outside `scope`, match nothing and are
 * skipped instead of failing the whole save. Returns the number of rows
 * updated.
 */
export function reorderByIndex(
  table: OrderedTable,
  ids: string[],
  scope?: { column: ScopeColumn; value: string },
): Promise<number> {
  const orders = ids.map((_, index) => index)
  const scopeFilter = scope
    ? Prisma.sql`AND t.${Prisma.raw(`"${scope.column}"`)} = ${scope.value}`
    : Prisma.empty
  return prisma.$executeRaw`
    UPDATE ${Prisma.raw(`"${table}"`)} AS t
    SET "order" = v.ord
    FROM unnest(${ids}::text[], ${orders}::int[]) AS v(id, ord)
    WHERE t.id = v.id ${scopeFilter}
  `
}
