import Image from 'next/image'

import { isSafeImageSrc } from '@/lib/imageSafety'

import styles from './prints.module.scss'

type Props = {
  imageUrl: string | null
  alt: string
}

export const PrintsBanner = ({ imageUrl, alt }: Props) => {
  if (!imageUrl || !isSafeImageSrc(imageUrl)) return null

  return (
    <div className={styles.banner}>
      <Image src={imageUrl} alt={alt} fill priority sizes="100vw" className={styles.bannerImage} />
    </div>
  )
}
