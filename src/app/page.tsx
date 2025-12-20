import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

import styles from './page.module.scss'

export default async function Home() {
  return (
    <main className={styles.home}>
      <Header />
      <section className={styles.hero}>
        <h2>Welcome to Lumen Gallery</h2>
        <p>Discover and experience virtual art exhibitions</p>
      </section>
      <Footer />
    </main>
  )
}
