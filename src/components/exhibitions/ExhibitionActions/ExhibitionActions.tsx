import { ArrowLink, ArrowLinkDivider, ArrowLinkRow } from '@/components/ui/ArrowLink'

interface ExhibitionActionsProps {
  /** The exhibition page. */
  href: string
  /** Straight into the 3D room, when the exhibition's space is published; else no such link. */
  visitUrl?: string | null
  className?: string
}

/**
 * "→ View exhibition | Enter 3D room" under an exhibition (AR-174; docs/public-redesign/exhibitions.md,
 * components.md "ArrowLink"): the homepage grid, the artist profile and the /exhibitions list. Each
 * is a link of its own, so the card around it must never be one.
 */
export const ExhibitionActions = ({ href, visitUrl, className }: ExhibitionActionsProps) => (
  <ArrowLinkRow className={className}>
    <ArrowLink href={href}>View exhibition</ArrowLink>
    {visitUrl && (
      <>
        <ArrowLinkDivider />
        <ArrowLink href={visitUrl} icon="cube">
          Enter 3D room
        </ArrowLink>
      </>
    )}
  </ArrowLinkRow>
)
