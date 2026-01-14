'use client'

import { useRef } from 'react'

import { Text } from '@/components/ui/Typography'

import styles from './SettingsPanel.module.scss'

type SettingsPanelProps = {
  title: string
  children: React.ReactNode
}

const SettingsPanel = ({ title, children }: SettingsPanelProps) => {
  const panelRef = useRef(null)

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Text font="dashboard" as="h2" className={styles.title}>
        {title}
      </Text>

      <div className={styles.content}>{children}</div>
    </div>
  )
}

export default SettingsPanel
