import { Text } from '@/components/ui/Typography'

import styles from './PageHeader.module.scss'

type PageHeaderProps = {
  pageTitle: string
  pageSubtitle?: string
}

export const PageHeader = ({ pageTitle, pageSubtitle }: PageHeaderProps) => {
  return (
    <div className={styles.pageHeader}>
      <Text as="h1" font="serif" size="3xl" className={styles.title}>
        {pageTitle}
      </Text>
      {pageSubtitle && (
        <Text as="p" size="md" className={styles.subtitle}>
          {pageSubtitle}
        </Text>
      )}
    </div>
  )
}
