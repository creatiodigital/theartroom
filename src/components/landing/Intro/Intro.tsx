import { Text } from '@/components/ui/Typography'

import styles from './Intro.module.scss'

export const Intro = () => {
  return (
    <div className={styles.intro}>
      <Text as="h2" font="serif" size="3xl">
        Art beyond immediacy.
      </Text>
    </div>
  )
}
