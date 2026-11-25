import { getBounds, WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { inspect } from '@gltf-transform/functions'
import { validateBytes } from 'gltf-validator'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

import {
  externalUrisOf,
  readGlbJson,
  validatorFacts,
  type GlbFacts,
  type ValidatorReport,
} from './glb'

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * The server's facts about an uploaded .glb (docs/objects O4, Q-O8): the Khronos validator's
 * report, and @gltf-transform reading the whole file (meshopt decoded) for the bounds and the
 * texture sizes. Never trusts what the browser measured.
 */
export async function gatherServerGlbFacts(bytes: Uint8Array): Promise<GlbFacts> {
  const json = readGlbJson(bytes)
  const facts: GlbFacts = {
    sizeBytes: bytes.byteLength,
    isGlb: json !== null,
    validator: null,
    externalUris: json ? externalUrisOf(json) : [],
    extensionsUsed: json?.extensionsUsed ?? [],
    triangles: null,
    textures: [],
    bounds: null,
    opened: { ok: false, by: 'read', error: 'Not a .glb' },
  }

  try {
    const report = (await validateBytes(bytes, { format: 'glb', maxIssues: 50 })) as ValidatorReport
    const v = validatorFacts(report)
    facts.validator = v.validator
    facts.triangles = v.triangles
    facts.textures = v.textures
    if (v.extensionsUsed.length) facts.extensionsUsed = v.extensionsUsed
  } catch (error) {
    facts.validatorError = message(error)
  }

  if (!facts.isGlb) return facts

  try {
    await MeshoptDecoder.ready
    const io = new WebIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    const document = await io.readBinary(bytes)
    const root = document.getRoot()
    const scene = root.getDefaultScene() ?? root.listScenes()[0]
    if (scene) {
      const { min, max } = getBounds(scene)
      if ([...min, ...max].every(Number.isFinite)) {
        facts.bounds = {
          min: [min[0], min[1], min[2]],
          max: [max[0], max[1], max[2]],
        }
      }
    }
    // Texture sizes from the decoded file when the validator could not read them (e.g. KTX2).
    const textures = inspect(document).textures.properties
    if (textures.length && facts.textures.every((t) => t.width === null)) {
      facts.textures = textures.map((t) => {
        const [w, h] = (t.resolution ?? '').split('x').map(Number)
        return { mimeType: t.mimeType, width: w || null, height: h || null }
      })
    }
    facts.opened = { ok: true, by: 'read' }
  } catch (error) {
    facts.opened = { ok: false, by: 'read', error: `It could not be read: ${message(error)}` }
  }

  return facts
}
