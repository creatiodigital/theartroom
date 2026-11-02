// The space GLB paths (with their `?v=`), shared by the scene and the server fingerprint.
// Bare paths, not URLs — see spaceConfigs in src/components/scene/constants.tsx.
export const spaceGltfPaths: Record<string, string> = {
  paris: '/assets/spaces/paris/paris24_noq.glb',
  vienna: '/assets/spaces/vienna/vienna16.glb',
  madrid: '/assets/spaces/madrid/madrid12_noq.glb',
}

export function spaceModelVersion(spaceId: string): string {
  return spaceGltfPaths[spaceId] ?? ''
}
