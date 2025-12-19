import { AuthButton } from '@/components/ui/AuthButton'

import styles from './page.module.scss'

export default async function Home() {
  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <h1 className={styles.logo}>Lumen Gallery</h1>
        <AuthButton />
      </header>
      <section className={styles.hero}>
        <h2>Welcome to Lumen Gallery</h2>
        <p>Discover and experience virtual art exhibitions</p>
      </section>
    </main>
  )
}
