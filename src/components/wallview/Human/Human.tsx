'use client'

import Image from 'next/image'

import styles from './Human.module.scss'

export type THuman = {
  humanWidth: number
  humanHeight: number
  position: 'left' | 'right'
}

const Human = ({ humanWidth, humanHeight, position }: THuman) => (
  <div className={`${styles.human} ${styles[position]}`}>
    <Image src="/assets/person.png" alt="person" width={humanWidth} height={humanHeight} />
  </div>
)

export default Human
