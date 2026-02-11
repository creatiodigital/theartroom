import { Text } from '@/components/ui/Typography'

import styles from './Intro.module.scss'

export const Intro = () => {
  return (
    <div className={styles.intro}>
      <Text as="h2" font="serif" size="3xl">
        Step inside and explore artists{'\u2019'} work.
      </Text>
    </div>
  )
}
