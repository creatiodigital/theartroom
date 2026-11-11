'use client'

import c from 'classnames'

import styles from './PublishState.module.scss'

type PublishStateProps = {
  published: boolean
}

/**
 * Whether something is on the public site: a green dot + "Published" or a gray
 * dot + "Unpublished" (users.md Profile, exhibitions.md "On the site").
 */
export function PublishState({ published }: PublishStateProps) {
  return (
    <span className={c(styles.state, published ? styles.published : styles.unpublished)}>
      <span aria-hidden className={styles.dot} />
      {published ? 'Published' : 'Unpublished'}
    </span>
  )
}
