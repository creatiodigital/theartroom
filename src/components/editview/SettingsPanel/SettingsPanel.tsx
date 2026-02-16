'use client'

import { useRef } from 'react'

import { Text } from '@/components/ui/Typography'
import { Icon } from '@/components/ui/Icon'

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
          <button className={styles.closeButton} onClick={onClose} aria-label="Close panel">
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.content}>{children}</div>
    </div>
  )
}

export default SettingsPanel
