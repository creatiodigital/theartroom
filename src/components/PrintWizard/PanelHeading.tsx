'use client'

import { UnitsSwitch } from '@/components/ui/UnitsSwitch'

import styles from './PrintWizard.module.scss'

/**
 * The left panel's heading in both configurators: the title, the cm | in choice at the right end
 * of its line, and a line saying what the panel is for (owner, 2026-11-17: the switch moved here
 * from the drawing's corner). The same saved choice as the footer's and the artwork page's; the
 * steps, the drawing and the summary all follow it.
 */
export const PanelHeading = ({ title, intro }: { title: string; intro: string }) => (
  <header className={styles.panelHeading}>
    <div className={styles.panelTitleRow}>
      <h2 className={styles.panelTitle}>{title}</h2>
      <UnitsSwitch className={styles.panelUnits} />
    </div>
    <p className={styles.panelIntro}>{intro}</p>
  </header>
)
