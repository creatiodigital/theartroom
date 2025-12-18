/**
 * KTX2 Loader Initialization
 *
 * This module sets up KTX2 texture support for GLTF loading.
 * It creates a temporary WebGL context to detect GPU capabilities,
 * then configures the global GLTF loader to use KTX2.
 */

import { GLTFLoader, KTX2Loader } from 'three-stdlib'
import { WebGLRenderer } from 'three'

const KTX2_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/gh/pmndrs/drei-assets/basis/'

let isInitialized = false
let ktx2Loader: KTX2Loader | null = null

/**
 * Initialize the KTX2 loader with GPU support detection.
 * This creates a temporary WebGLRenderer to detect supported texture formats.
 *
 * Safe to call multiple times - only initializes once.
 */
export function initKTX2Loader(): void {
  if (isInitialized) return
  if (typeof window === 'undefined') return // Skip on server

  try {
    // Create a temporary canvas and WebGLRenderer
    const tempCanvas = document.createElement('canvas')
    const renderer = new WebGLRenderer({ canvas: tempCanvas })

    // Initialize KTX2 loader
    ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath(KTX2_TRANSCODER_PATH)
    ktx2Loader.detectSupport(renderer)

    // Clean up the temporary renderer
    renderer.dispose()

    isInitialized = true
    console.log('KTX2 loader initialized successfully')
  } catch (error) {
    console.warn('Failed to initialize KTX2 loader:', error)
  }
}

/**
 * Get the initialized KTX2 loader instance.
 * Returns null if initKTX2Loader() hasn't been called or failed.
 */
export function getKTX2Loader(): KTX2Loader | null {
  return ktx2Loader
}

/**
 * Configure a GLTFLoader instance to use KTX2.
 * This is called automatically by useGLTF when you use the loader callback.
 */
export function configureGLTFLoader(loader: GLTFLoader): void {
  if (ktx2Loader) {
    loader.setKTX2Loader(ktx2Loader)
  }
}
