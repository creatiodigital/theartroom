import Image from 'next/image'

import styles from './Human.module.scss'

export type THuman = {
  humanWidth: number
  humanHeight: number
}

const Human = ({ humanWidth, humanHeight }: THuman) => (
  <div className={styles.human}>
    <Image src="/assets/person.png" alt="person" width={humanWidth} height={humanHeight} />
  </div>
)

export default Human
