// The space GLB paths (with their `?v=`), shared by the scene and the server fingerprint.
// Bare paths, not URLs — see spaceConfigs in src/components/scene/constants.tsx.
// AR-181 (paris25, madrid14, vienna17): `initialPoint0` moved toward the room in Blender, nothing
// else; a first tap aimed to one side stalled at the entrance corridor's walls. The geometry
// decodes identically to the previous files (madrid14_noq is madrid12_noq's binary as is), so
// published bakes still fit; drafts read stale and need a bake before their next publish.
export const spaceGltfPaths: Record<string, string> = {
  paris: '/assets/spaces/paris/paris25_noq.glb',
  vienna: '/assets/spaces/vienna/vienna17.glb',
  madrid: '/assets/spaces/madrid/madrid14_noq.glb',
}

export function spaceModelVersion(spaceId: string): string {
  return spaceGltfPaths[spaceId] ?? ''
}
