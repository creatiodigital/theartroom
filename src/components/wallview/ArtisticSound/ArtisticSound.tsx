'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Icon } from '@/components/ui/Icon'
import { editArtisticImage } from '@/redux/slices/artworkSlice'
import type { RootState } from '@/redux/store'

import styles from './ArtisticSound.module.scss'

interface ArtisticSoundProps {
  artworkId: string
}

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
]
const MAX_SOUND_SIZE = 3 * 1024 * 1024 // 3MB

const ArtisticSound = ({ artworkId }: ArtisticSoundProps) => {
  const dispatch = useDispatch()
  const artwork = useSelector((state: RootState) => state.artworks.byId[artworkId])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Stop audio on unmount (leaving scene, saving, switching views)
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const handleDoubleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()

      if (artwork?.soundUrl) {
        // Play/stop audio
        if (audioRef.current && isPlaying) {
          audioRef.current.pause()
          audioRef.current = null
          setIsPlaying(false)
          return
        }

        if (audioRef.current) {
          audioRef.current.pause()
        }

        const audio = new Audio(artwork.soundUrl)
        audio.addEventListener('ended', () => {
          setIsPlaying(false)
          audioRef.current = null
        })
        audio.play()
        audioRef.current = audio
        setIsPlaying(true)
      } else {
        // Check if artwork exists in DB before opening file picker
        try {
          const checkRes = await fetch(`/api/artworks/${artworkId}`)
          if (!checkRes.ok) {
            alert('Please save the exhibition first, then double-click to attach a sound file.')
            return
          }
        } catch {
          alert('Please save the exhibition first, then double-click to attach a sound file.')
          return
        }
        // Open file picker for upload
        fileInputRef.current?.click()
      }
    },
    [artwork?.soundUrl, isPlaying, artworkId],
  )

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''

      if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
        alert('Invalid file type. Accepted: MP3, M4A, OGG, WebM, WAV, AAC, FLAC.')
        return
      }
      if (file.size > MAX_SOUND_SIZE) {
        alert('File too large. Maximum size is 3MB.')
        return
      }

      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('sound', file)

        const res = await fetch(`/api/artworks/${artworkId}/sound`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          alert(data.error || 'Upload failed')
          return
        }

        const { url } = await res.json()
        dispatch(
          editArtisticImage({
            currentArtworkId: artworkId,
            property: 'soundUrl',
            value: url,
          }),
        )
      } catch {
        alert('Upload failed')
      } finally {
        setIsUploading(false)
      }
    },
    [artworkId, dispatch],
  )

  if (!artwork) return null

  const {
    soundIcon = 'volume-2',
    soundBackgroundColor = '#ffffff',
    soundIconColor = '#000000',
    soundIconSize = 24,
  } = artwork

  return (
    <div
      className={styles.sound}
      style={{ backgroundColor: soundBackgroundColor ?? undefined }}
      onDoubleClick={handleDoubleClick}
    >
      <Icon
        name={soundIcon}
        size={soundIconSize}
        color={isUploading ? '#999' : isPlaying ? '#e53e3e' : soundIconColor}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}

export default ArtisticSound
