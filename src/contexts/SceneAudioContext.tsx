'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { PositionalAudio } from 'three'

type SceneAudioContextType = {
  /** ID of the artwork currently playing */
  playingId: string | null
  /** Register a PositionalAudio ref for coordination */
  play: (artworkId: string, audio: PositionalAudio) => void
  /** Stop any currently playing audio */
  stop: () => void
}

const SceneAudioContext = createContext<SceneAudioContextType>({
  playingId: null,
  play: () => {},
  stop: () => {},
})

export const useSceneAudio = () => useContext(SceneAudioContext)

export const SceneAudioProvider = ({ children }: { children: ReactNode }) => {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const currentAudioRef = useRef<PositionalAudio | null>(null)

  const stop = useCallback(() => {
    if (currentAudioRef.current?.isPlaying) {
      currentAudioRef.current.pause()
    }
    currentAudioRef.current = null
    setPlayingId(null)
  }, [])

  const play = useCallback((artworkId: string, audio: PositionalAudio) => {
    // Stop any currently playing sound first
    if (currentAudioRef.current?.isPlaying) {
      currentAudioRef.current.pause()
    }

    currentAudioRef.current = audio
    audio.play()
    setPlayingId(artworkId)
  }, [])

  // Stop all audio when the provider unmounts (leaving scene, navigating away)
  useEffect(() => {
    return () => {
      if (currentAudioRef.current?.isPlaying) {
        currentAudioRef.current.pause()
      }
      currentAudioRef.current = null
    }
  }, [])

  return (
    <SceneAudioContext.Provider value={{ playingId, play, stop }}>
      {children}
    </SceneAudioContext.Provider>
  )
}
