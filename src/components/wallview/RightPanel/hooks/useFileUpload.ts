import type { ChangeEvent } from 'react'
import { useDispatch } from 'react-redux'

import { MAX_UPLOAD_SIZE } from '@/lib/imageConfig'
import { editArtisticImage } from '@/redux/slices/artworkSlice'
import { setArtworkUploadedTrue } from '@/redux/slices/wizardSlice'

export const useFileUpload = (currentArtworkId: string) => {
  const dispatch = useDispatch()

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    // Client-side size validation
    if (file && file.size > MAX_UPLOAD_SIZE) {
      alert('File too large. Maximum size is 5MB.')
      event.target.value = '' // Reset input
      return
    }

    if (file && currentArtworkId) {
      const imageUrl = URL.createObjectURL(file)
      dispatch(editArtisticImage({ currentArtworkId, property: 'imageUrl', value: imageUrl }))

      // Load image to get original dimensions for Match Ratio feature
      const img = new Image()
      img.onload = () => {
        dispatch(editArtisticImage({ currentArtworkId, property: 'originalWidth', value: img.naturalWidth }))
        dispatch(editArtisticImage({ currentArtworkId, property: 'originalHeight', value: img.naturalHeight }))
      }
      img.src = imageUrl
    }
  }

  const triggerFileUpload = () => {
    const fileInput = document.getElementById('file-upload')
    if (fileInput) {
      setTimeout(() => fileInput.click(), 0)
    } else {
      console.error('File input not found')
    }

    dispatch(setArtworkUploadedTrue())
  }

  return { handleFileChange, triggerFileUpload }
}
