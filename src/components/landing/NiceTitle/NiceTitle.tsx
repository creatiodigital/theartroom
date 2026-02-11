import styles from './NiceTitle.module.scss'
import { Text } from '@/components/ui/Typography'

interface NiceTitleProps {
  title: string
  align?: 'center' | 'left'
}

export const NiceTitle = ({ title, align = 'center' }: NiceTitleProps) => {
  return (
    <div className={`${styles.niceTitle} ${align === 'left' ? styles.left : ''}`}>
      {align === 'center' && <span className={styles.line} />}
      <Text as="h2" font="sans" size="lg" className={styles.title}>{title}</Text>
      <span className={styles.line} />
    </div>
  )
}
