'use client'

import Link from 'next/link'
import { ShoppingBag } from '@phosphor-icons/react'

import { useCart } from '@/lib/cart/useCart'

import styles from './CartIcon.module.scss'

export const CartIcon = () => {
  const { count } = useCart()

  return (
    <Link
      href="/cart"
      className={styles.cartLink}
      aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
    >
      <ShoppingBag size={24} weight="light" aria-hidden />
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count}
        </span>
      )}
    </Link>
  )
}
