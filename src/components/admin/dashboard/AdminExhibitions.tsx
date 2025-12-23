'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'

import styles from './AdminDashboard.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  handler: string
  status: string
  visibility: string
  user: {
    id: string
    name: string
    lastName: string
    handler: string
  }
}

export const AdminExhibitions = () => {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [loading, setLoading] = useState(true)

  const fetchExhibitions = useCallback(async () => {
    try {
      const response = await fetch('/api/exhibitions')
      if (response.ok) {
        const data = await response.json()
        setExhibitions(data)
      }
    } catch (error) {
      console.error('Failed to fetch exhibitions:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExhibitions()
  }, [fetchExhibitions])

  const handleToggleStatus = async (exhibitionId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'current' ? 'past' : 'current'
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const handleToggleVisibility = async (exhibitionId: string, currentVisibility: string) => {
    const newVisibility = currentVisibility === 'public' ? 'hidden' : 'public'
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update visibility:', error)
    }
  }

  if (loading) return <div>Loading exhibitions...</div>

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Exhibition Management</h2>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Exhibition</th>
            <th>Artist</th>
            <th>Status</th>
            <th>Visibility</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {exhibitions.map((exhibition) => (
            <tr key={exhibition.id}>
              <td>
                <Link
                  href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
                  className={styles.exhibitionLink}
                >
                  {exhibition.mainTitle}
                </Link>
              </td>
              <td>
                {exhibition.user.name} {exhibition.user.lastName}
              </td>
              <td>
                <span className={`${styles.statusBadge} ${styles[exhibition.status]}`}>
                  {exhibition.status}
                </span>
              </td>
              <td>
                <span className={`${styles.statusBadge} ${styles[exhibition.visibility]}`}>
                  {exhibition.visibility}
                </span>
              </td>
              <td>
                <div className={styles.actions}>
                  <Button
                    variant="small"
                    label={exhibition.status === 'current' ? 'Mark Past' : 'Mark Current'}
                    onClick={() => handleToggleStatus(exhibition.id, exhibition.status)}
                  />
                  <Button
                    variant="small"
                    label={exhibition.visibility === 'public' ? 'Hide' : 'Make Public'}
                    onClick={() => handleToggleVisibility(exhibition.id, exhibition.visibility)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
