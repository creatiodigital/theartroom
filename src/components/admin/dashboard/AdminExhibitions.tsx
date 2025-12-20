'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'

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
    <div style={{ marginTop: '40px' }}>
      <h2 style={{ marginBottom: '20px' }}>Exhibition Management</h2>
      
      <table border={1} cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
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
                  style={{ color: 'blue', textDecoration: 'underline' }}
                >
                  {exhibition.mainTitle}
                </Link>
              </td>
              <td>{exhibition.user.name} {exhibition.user.lastName}</td>
              <td style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: exhibition.status === 'current' ? '#d4edda' : '#f8d7da',
                  color: exhibition.status === 'current' ? '#155724' : '#721c24',
                }}>
                  {exhibition.status}
                </span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: exhibition.visibility === 'public' ? '#cce5ff' : '#fff3cd',
                  color: exhibition.visibility === 'public' ? '#004085' : '#856404',
                }}>
                  {exhibition.visibility}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '8px' }}>
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
