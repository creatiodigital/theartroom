'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { PositionalAudio } from 'three'

// Actions context — stable callbacks that never change reference
type SceneAudioActionsType = {
  play: (artworkId: string, audio: PositionalAudio) => void
  stop: () => void
  toggleMute: () => void
  registerVideoAudio: (artworkId: string, gainNode: GainNode, originalVolume: number) => void
  unregisterVideoAudio: (artworkId: string) => void
}

// State context — reactive state that triggers re-renders
type SceneAudioStateType = {
  playingId: string | null
  hasActiveAudio: boolean
  isMuted: boolean
}

const SceneAudioActionsContext = createContext<SceneAudioActionsType>({
  play: () => {},
  stop: () => {},
  toggleMute: () => {},
  registerVideoAudio: () => {},
  unregisterVideoAudio: () => {},
})

const SceneAudioStateContext = createContext<SceneAudioStateType>({
  playingId: null,
  hasActiveAudio: false,
  isMuted: false,
})

/** Use only the stable action callbacks — does NOT re-render on state changes */
export const useSceneAudioActions = () => useContext(SceneAudioActionsContext)

/** Use reactive audio state — WILL re-render on state changes */
export const useSceneAudioState = () => useContext(SceneAudioStateContext)

/** Use both actions and state (convenience, but causes re-renders on state change) */
export const useSceneAudio = () => {
  const actions = useContext(SceneAudioActionsContext)
  const state = useContext(SceneAudioStateContext)
  return { ...state, ...actions }
}

export const SceneAudioProvider = ({ children }: { children: ReactNode }) => {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [activeVideoIds, setActiveVideoIds] = useState<Set<string>>(new Set())
  const currentAudioRef = useRef<PositionalAudio | null>(null)

  // Track video gain nodes so we can mute/unmute them
  const videoGainNodes = useRef<Map<string, { gain: GainNode; originalVolume: number }>>(new Map())

  // Use a ref for isMuted so callbacks don't need it as a dependency
  const isMutedRef = useRef(isMuted)
  isMutedRef.current = isMuted

  const hasActiveAudio = playingId !== null || activeVideoIds.size > 0

  const stop = useCallback(() => {
    if (currentAudioRef.current?.isPlaying) {
      currentAudioRef.current.stop()
    }
    currentAudioRef.current = null
    setPlayingId(null)
  }, [])

  const play = useCallback((artworkId: string, audio: PositionalAudio) => {
    // Stop any currently playing sound first
    if (currentAudioRef.current?.isPlaying) {
      currentAudioRef.current.stop()
    }

    currentAudioRef.current = audio

    // Respect current mute state
    if (isMutedRef.current) {
      audio.setVolume(0)
    }

    audio.play()
    setPlayingId(artworkId)
  }, [])

  const registerVideoAudio = useCallback(
    (artworkId: string, gainNode: GainNode, originalVolume: number) => {
      videoGainNodes.current.set(artworkId, { gain: gainNode, originalVolume })
      setActiveVideoIds((prev) => {
        const next = new Set(prev)
        next.add(artworkId)
        return next
      })
      // Apply current mute state to the newly registered video
      if (isMutedRef.current) {
        gainNode.gain.value = 0
      }
    },
    [],
  )

  const unregisterVideoAudio = useCallback((artworkId: string) => {
    videoGainNodes.current.delete(artworkId)
    setActiveVideoIds((prev) => {
      const next = new Set(prev)
      next.delete(artworkId)
      return next
    })
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const willMute = !prev

      // Mute/unmute sound artwork (PositionalAudio)
      if (currentAudioRef.current) {
        currentAudioRef.current.setVolume(willMute ? 0 : 1)
      }

      // Mute/unmute all registered video audio
      videoGainNodes.current.forEach(({ gain, originalVolume }) => {
        gain.gain.value = willMute ? 0 : originalVolume
      })

      return willMute
    })
  }, [])

  // Stop all audio when the provider unmounts (leaving scene, navigating away)
  useEffect(() => {
    return () => {
      if (currentAudioRef.current?.isPlaying) {
        currentAudioRef.current.stop()
      }
      currentAudioRef.current = null
    }
  }, [])

  // Memoize the actions object — all callbacks are stable, so this never changes
  const actions = useMemo(
    () => ({ play, stop, toggleMute, registerVideoAudio, unregisterVideoAudio }),
    [play, stop, toggleMute, registerVideoAudio, unregisterVideoAudio],
  )

  // State changes when playingId, isMuted, or hasActiveAudio changes
  const state = useMemo(
    () => ({ playingId, hasActiveAudio, isMuted }),
    [playingId, hasActiveAudio, isMuted],
  )

  return (
    <SceneAudioActionsContext.Provider value={actions}>
      <SceneAudioStateContext.Provider value={state}>
        {children}
      </SceneAudioStateContext.Provider>
    </SceneAudioActionsContext.Provider>
  )
}
