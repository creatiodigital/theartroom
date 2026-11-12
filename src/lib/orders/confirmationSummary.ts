import type { CartItem } from '@/lib/cart/types'
import type { CartTotals } from '@/lib/cart/validateCart'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'
import { summarizeConfig, type SpecsSummary, type WizardConfig } from '@/lib/print-providers'
import { loadProviderCatalog } from '@/lib/print-providers/loadCatalog'
import prisma from '@/lib/prisma'

/** The totals the confirmation's panel shows. */
export type DisplayTotals = Pick<
  CartTotals,
  'itemsPreTaxCents' | 'shippingCents' | 'customerVatCents' | 'vatRate' | 'totalCents'
>

/** The address lines the panel shows: never the buyer's email or phone. */
export type DisplayAddress = Pick<
  ShippingAddress,
  'fullName' | 'address1' | 'address2' | 'city' | 'stateOrRegion' | 'postalCode' | 'countryCode'
>

/** The order as the confirmation's "Your order" panel shows it (order-confirmed.dc.html). */
export type ConfirmationSummary = {
  items: CartItem[]
  totals: DisplayTotals
  address: DisplayAddress
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

/**
 * The "Your order" panel's data, read from the stored order (questions.md Q-P15 a, owner): its
 * lines, totals and shipping address. READ ONLY. Called by `ensureOrderAction` only after it has
 * verified the payment for that reference, so a page reached by a 3DS or PayPal return, or a
 * reload, shows the same panel as one paid in place.
 *
 * Cart orders only (they have item rows); null otherwise. Lines are rebuilt the way the admin and
 * the receipt rebuild them: title and artist from the work, the edition from its bound numbers,
 * the specs from the stored config (display only: [] if the catalog can't say), the stored line
 * amounts per unit. Totals as the receipt derives them (the VAT rate from the stored figures).
 */
export async function getConfirmationSummary(orderId: string): Promise<ConfirmationSummary | null> {
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: {
      shippingAddress: true,
      totalCents: true,
      productionShippingCents: true,
      customerVatCents: true,
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          artworkId: true,
          printConfig: true,
          quantity: true,
          productionCents: true,
          artistCents: true,
          galleryCents: true,
          artwork: {
            select: {
              slug: true,
              title: true,
              name: true,
              imageUrl: true,
              originalWidth: true,
              originalHeight: true,
            },
          },
          artistUser: { select: { name: true, lastName: true } },
          editionNumbers: {
            take: 1,
            select: { variantId: true, variant: { select: { name: true } } },
          },
        },
      },
    },
  })
  if (!order || order.items.length === 0) return null

  const items: CartItem[] = await Promise.all(
    order.items.map(async (it) => {
      const config = it.printConfig as unknown as WizardConfig
      let specsSummary: SpecsSummary = []
      try {
        const catalog = await loadProviderCatalog('printspace', {
          imageWidthPx: it.artwork.originalWidth ?? 1000,
          imageHeightPx: it.artwork.originalHeight ?? 1000,
        })
        specsSummary = summarizeConfig(catalog, config)
      } catch {
        // Display only: the line still shows without its specs.
      }
      const quantity = Math.max(1, it.quantity)
      const edition = it.editionNumbers[0]
      return {
        lineId: it.id,
        artworkSlug: it.artwork.slug,
        artworkId: it.artworkId,
        providerId: 'printspace',
        editionType: edition ? 'limited' : 'open',
        ...(edition ? { variantId: edition.variantId, editionName: edition.variant.name } : {}),
        config,
        quantity,
        // Stored per line; the panel multiplies back by the quantity.
        unitArtistCents: it.artistCents / quantity,
        unitProductionCents: it.productionCents / quantity,
        unitGalleryCents: it.galleryCents / quantity,
        thumbnailUrl: it.artwork.imageUrl ?? '',
        title: it.artwork.title || it.artwork.name,
        artistName: [it.artistUser.name, it.artistUser.lastName].filter(Boolean).join(' ').trim(),
        specsSummary,
      } satisfies CartItem
    }),
  )

  const shippingCents = order.productionShippingCents
  const customerVatCents = order.customerVatCents
  const itemsPreTaxCents = order.totalCents - shippingCents - customerVatCents
  const vatBase = itemsPreTaxCents + shippingCents
  const vatRate = vatBase > 0 ? Math.round((customerVatCents * 100) / vatBase) / 100 : 0

  const a = (order.shippingAddress ?? {}) as Record<string, unknown>
  return {
    items,
    totals: {
      itemsPreTaxCents,
      shippingCents,
      customerVatCents,
      vatRate,
      totalCents: order.totalCents,
    },
    address: {
      fullName: text(a.fullName),
      address1: text(a.address1),
      address2: text(a.address2),
      city: text(a.city),
      stateOrRegion: text(a.stateOrRegion),
      postalCode: text(a.postalCode),
      countryCode: text(a.countryCode),
    },
  }
}
