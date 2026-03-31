import type { Metadata } from 'next'

import { ContactPage } from '@/components/contact'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Addresses and Contacts' },
  description:
    'Get in touch with The Art Room. Inquire about exhibitions, artworks, or collaboration opportunities.',
}

const Contact = () => {
  return <ContactPage />
}

export default Contact
