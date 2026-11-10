/**
 * Validate an audio upload by its bytes, not by the content-type the browser
 * claimed — the file lands in the public bucket on our own domain (see
 * `isValidVideoType` for the same reasoning). Covers every format the sound
 * route allowlists:
 *
 *   MP3           an ID3 tag ("ID3"), or straight into an MPEG frame (sync word)
 *   AAC (ADTS)    MPEG frame sync as well
 *   M4A / MP4     "ftyp" at offset 4 (ISO base media)
 *   OGG           "OggS"
 *   WebM          EBML magic 1A 45 DF A3
 *   WAV           "RIFF" … "WAVE"
 *   FLAC          "fLaC"
 */
export function isValidAudioType(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  const ascii = (start: number, end: number) => buffer.toString('latin1', start, end)

  if (ascii(0, 3) === 'ID3') return true
  // MPEG audio frame sync: 11 set bits (MP3 frames and AAC ADTS headers).
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true
  if (ascii(4, 8) === 'ftyp') return true
  if (ascii(0, 4) === 'OggS') return true
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return true
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return true
  if (ascii(0, 4) === 'fLaC') return true

  return false
}
