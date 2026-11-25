/** The Khronos glTF Validator's JS API (npm gltf-validator ships no types). */
declare module 'gltf-validator' {
  export function validateBytes(
    data: Uint8Array,
    options?: {
      uri?: string
      format?: 'glb' | 'gltf'
      maxIssues?: number
      ignoredIssues?: string[]
      externalResourceFunction?: (uri: string) => Promise<Uint8Array>
    },
  ): Promise<unknown>
  export function version(): string
}
