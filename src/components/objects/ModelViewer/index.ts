import dynamic from 'next/dynamic'

export type { ModelViewerResult } from './ModelViewer'

/** Client-only and loaded on demand: three.js arrives only where a model is shown. */
export const ModelViewer = dynamic(() => import('./ModelViewer'), { ssr: false })
