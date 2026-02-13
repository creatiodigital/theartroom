'use client'

import Image from 'next/image'

import styles from './Human.module.scss'

export type THuman = {
  humanWidth: number
  humanHeight: number
  position: 'left' | 'right'
  floorOffset?: number // Distance in pixels from wall bottom to floor level
}

const Human = ({ humanWidth, humanHeight, position, floorOffset = 0 }: THuman) => (
  <div className={`${styles.human} ${styles[position]}`} style={{ bottom: -floorOffset }}>
    <Image src="/assets/person.png" alt="person" width={humanWidth} height={humanHeight} />
  </div>
)

export default Human
