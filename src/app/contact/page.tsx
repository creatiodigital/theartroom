import type { Metadata } from 'next'

import { ContactPage } from '@/components/contact'
import { publicPageMetadata } from '@/lib/seo/pageMetadata'

export const metadata: Metadata = publicPageMetadata({
  path: '/contact',
  title: 'The Art Room Addresses and Contacts',
  description:
    'Get in touch with The Art Room. Inquire about exhibitions, artworks, or collaboration opportunities.',
})

const Contact = () => {
  return <ContactPage />
}

export default Contact
