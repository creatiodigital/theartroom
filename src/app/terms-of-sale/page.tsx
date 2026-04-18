import type { Metadata } from 'next'

import { TermsOfSalePage } from '@/components/terms-of-sale'

export const metadata: Metadata = {
  title: { absolute: 'Online Terms of Sale — The Art Room' },
  description:
    'The terms and conditions that apply when you purchase a printed artwork from The Art Room.',
}

const TermsOfSale = () => <TermsOfSalePage />

export default TermsOfSale
