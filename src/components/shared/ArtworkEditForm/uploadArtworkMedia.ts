/**
 * One file into an artwork's media (the house pattern): ask the server for a presigned URL, PUT
 * the file straight to R2, then tell the server it landed. The server never takes a URL from
 * here, only the key it minted itself. Throws with the server's message when a step is refused.
 */
export async function uploadArtworkMediaFile({
  artworkId,
  file,
  width,
  height,
  role,
}: {
  artworkId: string
  file: File
  width?: number
  height?: number
  /** Objects only: the view's label (Front, Reel…). */
  role?: string | null
}): Promise<void> {
  const reqRes = await fetch('/api/artwork-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'request-upload',
      artworkId,
      contentType: file.type,
      fileSize: file.size,
    }),
  })
  if (!reqRes.ok) throw new Error((await reqRes.json()).error ?? 'Upload refused')
  const { presignedUrl, key } = await reqRes.json()

  const put = await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!put.ok) throw new Error('The file could not be sent to storage')

  // Only the key goes back — the server rebuilds the URL from it.
  const doneRes = await fetch('/api/artwork-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'complete', artworkId, key, width, height, role }),
  })
  if (!doneRes.ok) throw new Error((await doneRes.json()).error ?? 'Upload failed')
}

/** A picked file's real size (and a video's length), read in the browser before upload. */
export function measureMedia(
  file: File,
): Promise<{ width?: number; height?: number; duration?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const done = (value: { width?: number; height?: number; duration?: number }) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }
    if (file.type.startsWith('image/')) {
      const img = new Image()
      img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => done({})
      img.src = url
      return
    }
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.onloadedmetadata = () =>
        done({ width: video.videoWidth, height: video.videoHeight, duration: video.duration })
      video.onerror = () => done({})
      video.src = url
      return
    }
    done({})
  })
}
