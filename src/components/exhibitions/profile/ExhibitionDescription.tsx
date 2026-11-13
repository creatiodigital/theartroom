import { RichText } from '@/components/ui/RichText'

/**
 * The exhibition description (rich text), rendered by the page on the server
 * and handed to the client profile as a ready node — rendered inside the client
 * component, RichText would ship the HTML sanitizer (~90 kB gzipped) to every
 * visitor of the page.
 */
export const ExhibitionDescription = ({ description }: { description: string }) => (
  <RichText content={description} variant="page" />
)
