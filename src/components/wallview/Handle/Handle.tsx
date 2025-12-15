'use client'

import c from 'classnames'

import type { TDirection } from '@/types/wallView'

import styles from './Handle.module.scss'

type THandleProps = {
  direction: TDirection
  onMouseDown: React.MouseEventHandler<HTMLDivElement>
}

const Handle = ({ direction, onMouseDown }: THandleProps) => (
  <div className={c([styles.handle, styles[direction]])} onMouseDown={onMouseDown} />
)

export default Handle
