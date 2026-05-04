'use client'

import { useRef } from 'react'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

import styles from './SettingsPanel.module.scss'

type SettingsPanelProps = {
  title: string
  children: React.ReactNode
  onClose?: () => void
}

const SettingsPanel = ({ title, children, onClose }: SettingsPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className={styles.header}>
        <Text font="dashboard" as="h2" className={styles.title}>
          {title}
        </Text>
        {onClose && (
          <Button
            variant="ghost"
            icon="close"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close panel"
          />
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.content}>{children}</div>
    </div>
  )
}

export default SettingsPanel
