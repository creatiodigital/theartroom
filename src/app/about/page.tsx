import type { Metadata } from 'next'

import { AboutPage } from '@/components/about'

export const metadata: Metadata = {
  title: { absolute: 'About The Art Room' },
  description:
    'Learn about The Art Room — a virtual exhibition space dedicated to showcasing contemporary art in immersive 3D environments.',
}

const About = () => {
  return <AboutPage />
}

export default About
