'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSelector } from 'react-redux'

import { Icon } from '@/components/ui/Icon'
import type { RootState } from '@/redux/store'

import styles from './ArtisticSound.module.scss'

interface ArtisticSoundProps {
  artworkId: string
}

const ArtisticSound = ({ artworkId }: ArtisticSoundProps) => {
  const artwork = useSelector((state: RootState) => state.artworks.byId[artworkId])
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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
    (e: React.MouseEvent) => {
      e.stopPropagation()

      if (!artwork?.soundUrl) return

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
    },
    [artwork?.soundUrl, isPlaying],
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
      <Icon name={soundIcon} size={soundIconSize} color={isPlaying ? '#e53e3e' : soundIconColor} />
    </div>
  )
}

export default ArtisticSound
