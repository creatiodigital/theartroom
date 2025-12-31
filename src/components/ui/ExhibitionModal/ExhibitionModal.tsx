'use client'

import React, { useState, useCallback, useEffect } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import type { TOption } from '@/types/artwork'

import styles from './ExhibitionModal.module.scss'

type ExhibitionModalProps = {
  creating: boolean
  onClose: () => void
  onCreate: (title: string, visibility: string, customUrl: string) => void
  selectedSpace: TOption<string> | null
  handleSelectSpace: (opt: TOption<string>) => void
  spaceOptions: TOption<string>[]
  userId: string
}

const slugify = (str: string): string =>
  str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()

export const ExhibitionModal = React.memo(
  ({
    creating,
    onClose,
    onCreate,
    selectedSpace,
    handleSelectSpace,
    spaceOptions,
    userId,
  }: ExhibitionModalProps) => {
    const [mainTitle, setMainTitle] = useState('')
    const [customUrl, setCustomUrl] = useState('')
    const [urlEdited, setUrlEdited] = useState(false)
    const [visibility, setVisibility] = useState<'public' | 'private'>('private')
    const [urlError, setUrlError] = useState('')
    const [checking, setChecking] = useState(false)

    // Auto-generate URL from title (unless manually edited)
    useEffect(() => {
      if (!urlEdited) {
        setCustomUrl(slugify(mainTitle))
      }
    }, [mainTitle, urlEdited])

    // Check URL availability when customUrl changes
    useEffect(() => {
      if (!customUrl || !userId) {
        setUrlError('')
        return
      }

      const checkUrl = async () => {
        setChecking(true)
        try {
          const response = await fetch(
            `/api/exhibitions/check-url?userId=${userId}&url=${encodeURIComponent(customUrl)}`,
          )
          const data = await response.json()

          if (!data.available) {
            setUrlError('This URL is already in use. Please choose a different name.')
          } else {
            setUrlError('')
          }
        } catch {
          // Silently fail - backend will catch duplicates anyway
          setUrlError('')
        } finally {
          setChecking(false)
        }
      }

      // Debounce the check
      const timeout = setTimeout(checkUrl, 300)
      return () => clearTimeout(timeout)
    }, [customUrl, userId])

    const handleUrlChange = (value: string) => {
      setUrlEdited(true)
      setCustomUrl(slugify(value))
    }

    const handleCreateClick = useCallback(() => {
      if (urlError || !customUrl) return
      onCreate(mainTitle, visibility, customUrl)
    }, [onCreate, mainTitle, visibility, customUrl, urlError])

    const canCreate = mainTitle.trim() && customUrl.trim() && !urlError && !checking

    return (
      <div className={styles.wrapper}>
        <div className={styles.content}>
          <div>
            <Text as="h3">Exhibition Title</Text>
            <Input
              id="exhibitionTitle"
              type="text"
              size="medium"
              value={mainTitle}
              onChange={(e) => setMainTitle(e.target.value)}
              placeholder="Exhibition name"
            />
          </div>

          <div>
            <Text as="h3">URL Slug</Text>
            <Input
              id="exhibitionUrl"
              type="text"
              size="medium"
              value={customUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="exhibition-url"
              variant={urlError ? 'error' : undefined}
            />
            <Text as="p" className={styles.urlPreview}>
              /exhibitions/your-name/<strong>{customUrl || 'exhibition-url'}</strong>
            </Text>
            <ErrorText>{urlError}</ErrorText>
            {checking && <Text as="p" className={styles.checking}>Checking availability...</Text>}
          </div>

          <div>
            <Text as="h3">Visibility</Text>
            <Select<string>
              options={[
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private' },
              ]}
              value={visibility}
              onChange={(val) => setVisibility(val as 'public' | 'private')}
            />
          </div>

          <div>
            <Text as="h3">Choose a Space</Text>
            <Select<string>
              options={spaceOptions}
              value={selectedSpace?.value}
              onChange={(val) => {
                const opt = spaceOptions.find((opt) => opt.value === val)
                if (opt) handleSelectSpace(opt)
              }}
              size="medium"
            />
          </div>
        </div>

        <div className={styles.ctas}>
          <Button variant="small" label="Cancel" onClick={onClose} />
          <Button
            variant="small"
            label={creating ? 'Creating...' : 'Create'}
            onClick={handleCreateClick}
            disabled={!canCreate}
          />
        </div>
      </div>
    )
  },
)

ExhibitionModal.displayName = 'ExhibitionModal'
export default ExhibitionModal
