'use client'

import { useDispatch, useSelector } from 'react-redux'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
// import { hideEditMode } from '@/redux/slices/dashboardSlice'
import { hidePlaceholders, showPlaceholders } from '@/redux/slices/sceneSlice'
import { useGetUserQuery } from '@/redux/slices/userApi'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './Menu.module.scss'

const hardcodedId = '915a1541-f132-4fd1-a714-e34527485054'

export const Menu = () => {
  const dispatch = useDispatch()

  const { data: userData } = useGetUserQuery(hardcodedId)

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

    if (userData?.handler) {
      // Use hard navigation to ensure 3D canvas is properly unmounted
      window.location.href = `/${userData.handler}/dashboard`
    } else {
      window.location.href = '/'
    }
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
