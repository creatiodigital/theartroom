'use client'

import { useDispatch, useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { hidePlaceholders, showPlaceholders } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './Menu.module.scss'

export const Menu = () => {
  const dispatch = useDispatch()

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)

  const togglePlaceholders = () => {
    if (isPlaceholdersShown) {
      dispatch(hidePlaceholders())
    } else {
      dispatch(showPlaceholders())
    }
  }

  const handleClose = () => {
    // Reset wallView state to prevent stale data when switching exhibitions
    dispatch(resetWallView())
    // Navigate to dashboard
    window.location.href = '/dashboard'
  }

  return (
    <div className={styles.menu}>
      <ButtonIcon
        icon="close"
        onClick={handleClose}
        // onClick={() => dispatch(hideEditMode())}
      />
      <ButtonIcon
        icon={isPlaceholdersShown ? 'preview' : 'placeholder'}
        onClick={() => togglePlaceholders()}
      />
    </div>
  )
}

export default Menu
