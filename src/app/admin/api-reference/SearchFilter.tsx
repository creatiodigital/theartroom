'use client'

import { useState, useCallback } from 'react'

import { SearchField } from '@/components/admin/ui/SearchField'

interface SearchFilterProps {
  onFilterChange: (query: string) => void
}

export default function SearchFilter({ onFilterChange }: SearchFilterProps) {
  const [value, setValue] = useState('')

  // SearchField hands over the text itself (it was `e.target.value`).
  const handleChange = useCallback(
    (query: string) => {
      setValue(query)
      onFilterChange(query)
    },
    [onFilterChange],
  )

  return (
    <SearchField
      value={value}
      onChange={handleChange}
      placeholder="Search routes, models, fields…"
      label="Search routes, models and fields"
    />
  )
}
