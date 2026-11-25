import dynamic from 'next/dynamic'

export type { UploadedModel } from './ModelChecker'

/** Loaded when the team opens it: with it come three.js and the glTF validator (owner, Q-O8). */
export const ModelChecker = dynamic(() => import('./ModelChecker'), { ssr: false })
