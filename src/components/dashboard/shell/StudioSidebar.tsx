'use client'

import { ShellSidebar } from '@/components/admin/shell/ShellSidebar'
import { ShellWordmark } from '@/components/admin/shell/ShellWordmark'

import { StudioMenuBody } from './StudioMenuBody'
import { STUDIO_HOME } from './studioNav'

/** The studio's white side menu, 900px and up. artist-home.dc.html, `<nav aria-label="Artist">`. */
export function StudioSidebar() {
  return (
    <ShellSidebar tone="light" label="Artist">
      <ShellWordmark
        href={STUDIO_HOME}
        tag="Artist studio"
        tone="light"
        size="menu"
        layout="stacked"
      />
      <StudioMenuBody layout="sidebar" />
    </ShellSidebar>
  )
}
