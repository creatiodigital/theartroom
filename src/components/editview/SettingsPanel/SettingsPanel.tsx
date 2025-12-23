'use client'

import { useRef } from 'react'

import { Button } from '@/components/ui/Button'

import styles from './SettingsPanel.module.scss'

type SettingsPanelProps = {
  title: string
  children: React.ReactNode
  onClose: () => void
}

const SettingsPanel = ({ title, children, onClose }: SettingsPanelProps) => {
  const panelRef = useRef(null)

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <h2 className={styles.title}>{title}</h2>

      <div className={styles.content}>
        {children}
      </div>

      <div className={styles.cta}>
        <Button variant="outline" label="Close" onClick={onClose} />
      </div>
    </div>
  )
}

export default SettingsPanel
