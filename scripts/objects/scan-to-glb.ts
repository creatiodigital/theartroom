/**
 * An artist's scan (or model) → a .glb ready for "Upload .glb" on an Object (docs/objects O4).
 *
 *   npx tsx scripts/objects/scan-to-glb.ts <folder or file> [--name Name] [--turn 90]
 *        [--texture 2048] [--max-triangles 500000] [--out ~/Desktop/objects-glb]
 *
 * Takes what scanning apps export (RealityScan, Polycam, Scaniverse…): OBJ (+ .mtl and its
 * textures), FBX, GLB / glTF, USDZ. A folder: the first model file in it.
 *
 * 1. Blender (scripts/objects/prep-scan.py): one mesh, scan debris removed, +Y up in metres, the
 *    base on y = 0 and centred on it, `--turn` degrees about the vertical so the front faces the
 *    room (counterclockwise seen from above; check the `-front.png` preview), tangents for the
 *    normal map, and three previews.
 * 2. Above `--max-triangles`, simplified (meshoptimizer) down to it.
 * 3. glTF-Transform: each material's colour and normal maps at `--texture` px (default 2048, the
 *    gallery's size: phones hold every texture in memory) as WebP; metallic 0 (scans are
 *    photographed surfaces); meshopt in its lossless mode. Never quantized: the checker fails
 *    KHR_mesh_quantization, and the room's loaders expect float positions.
 * 4. The same checker as the upload window (lib/objects/glb.ts, the server's facts), and the real
 *    size: phone scans (RealityScan, Polycam with LiDAR or AR tracking) are in metres, usually
 *    within a few per cent; check one measure against a tape before trusting it for Details.
 *
 * Needs Blender (`/Applications/Blender.app` or BLENDER=/path/to/blender).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'

import { NodeIO, type Document, type Texture } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } from '@gltf-transform/extensions'
import {
  dedup,
  prune,
  reorder,
  simplify,
  weld,
  type ReorderOptions,
  type SimplifyOptions,
} from '@gltf-transform/functions'
import sharp from 'sharp'

import { boundsToCm, checkGlb, glbPasses } from '@/lib/objects/glb'
import { gatherServerGlbFacts } from '@/lib/objects/glbFacts.server'

// meshoptimizer comes with @gltf-transform/functions (no separate dependency), typed by the options
// that take it.
type Ready = { ready: Promise<void> }
const requireHere = createRequire(__filename)
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = createRequire(
  requireHere.resolve('@gltf-transform/functions'),
)('meshoptimizer') as {
  MeshoptEncoder: NonNullable<ReorderOptions['encoder']> & Ready
  MeshoptDecoder: Ready
  MeshoptSimplifier: SimplifyOptions['simplifier'] & Ready
}

const MODEL_TYPES = ['.obj', '.fbx', '.glb', '.gltf', '.usdz', '.usd', '.usdc']

type PrepResult = {
  before: Record<string, number | number[]>
  after: Record<string, number | number[]>
  removedDebrisFaces: number
  sizeCm: { h: number; w: number; d: number }
  materials: { name: string; baseColor: string | null; normal: string | null }[]
}

function args() {
  const [input, ...rest] = process.argv.slice(2)
  if (!input) {
    console.error(
      'Usage: npx tsx scripts/objects/scan-to-glb.ts <folder or file> [--name Name] [--turn 90] [--texture 2048] [--max-triangles 500000] [--out dir]',
    )
    process.exit(1)
  }
  const opt = (flag: string) => {
    const i = rest.indexOf(flag)
    return i >= 0 ? rest[i + 1] : undefined
  }
  const home = (p: string) => p.replace(/^~(?=$|\/)/, homedir())
  const source = path.resolve(home(input))
  const file = statSync(source).isDirectory()
    ? readdirSync(source)
        .filter((f) => MODEL_TYPES.includes(path.extname(f).toLowerCase()))
        .map((f) => path.join(source, f))[0]
    : source
  if (!file) throw new Error(`No model file (${MODEL_TYPES.join(' ')}) in ${source}`)
  const name = opt('--name') ?? path.basename(file, path.extname(file))
  return {
    file,
    name,
    turn: Number(opt('--turn') ?? 0),
    texture: Number(opt('--texture') ?? 2048),
    maxTriangles: Number(opt('--max-triangles') ?? 500_000),
    out: path.resolve(home(opt('--out') ?? '~/Desktop/objects-glb')),
  }
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function blenderPath() {
  const candidates = [process.env.BLENDER, '/Applications/Blender.app/Contents/MacOS/Blender']
  const found = candidates.find((c) => c && existsSync(c))
  if (!found) throw new Error('Blender not found: install it or set BLENDER=/path/to/blender')
  return found
}

/** Resize a texture to at most `size` px on its long side and store it as WebP. */
async function webpTexture(
  doc: Document,
  file: string,
  size: number,
  label: string,
  quality: number,
) {
  const meta = await sharp(file).metadata()
  const long = Math.max(meta.width ?? size, meta.height ?? size)
  const image = await sharp(file)
    .resize(
      long > size ? { width: size, height: size, fit: 'inside', kernel: 'lanczos3' } : undefined,
    )
    .removeAlpha()
    .webp({ quality })
    .toBuffer()
  return doc.createTexture(label).setImage(new Uint8Array(image)).setMimeType('image/webp')
}

async function main() {
  const a = args()
  mkdirSync(a.out, { recursive: true })
  const base = slug(a.name)
  const work = mkdtempSync(path.join(tmpdir(), `scan-${base}-`))
  const geometry = path.join(work, `${base}-geometry.glb`)
  const previews = path.join(a.out, `${base}-preview`)

  console.log(`\n${a.name}: ${a.file}`)
  const blender = execFileSync(
    blenderPath(),
    [
      '-b',
      '-P',
      path.join(__dirname, 'prep-scan.py'),
      '--',
      a.file,
      geometry,
      a.name,
      previews,
      String(a.turn),
      '0.005',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  const line = blender.split('\n').find((l) => l.startsWith('RESULT '))
  if (!line) {
    console.error(blender.slice(-4000))
    throw new Error('The Blender step did not finish')
  }
  const prep = JSON.parse(line.slice(7)) as PrepResult

  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  await MeshoptSimplifier.ready
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
  const doc = await io.read(geometry)

  // Too heavy for phones: simplify (welded first so the simplifier sees one surface).
  const triangles = Number(prep.after.triangles)
  if (triangles > a.maxTriangles) {
    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: a.maxTriangles / triangles, error: 0.001 }),
    )
  }

  // Textures: each material's colour and normal map, smaller, as WebP.
  const byName = new Map(prep.materials.map((m) => [m.name, m]))
  const textures: Texture[] = []
  for (const material of doc.getRoot().listMaterials()) {
    const src = byName.get(material.getName())
    material.setMetallicFactor(0)
    if (src?.baseColor && existsSync(src.baseColor)) {
      const t = await webpTexture(
        doc,
        src.baseColor,
        a.texture,
        `${material.getName()}_baseColor`,
        90,
      )
      material.setBaseColorTexture(t).setBaseColorFactor([1, 1, 1, 1])
      textures.push(t)
    }
    if (src?.normal && existsSync(src.normal)) {
      const t = await webpTexture(doc, src.normal, a.texture, `${material.getName()}_normal`, 95)
      material.setNormalTexture(t)
      textures.push(t)
    }
  }

  // WebP images need their extension declared (the validator refuses them otherwise); the room's
  // GLTFLoader reads it.
  if (textures.length) doc.createExtension(EXTTextureWebP).setRequired(true)
  doc.getRoot().getAsset().generator = 'The Art Room scan-to-glb (Blender + glTF-Transform)'
  await doc.transform(prune(), dedup(), reorder({ encoder: MeshoptEncoder }))
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  const outFile = path.join(a.out, `${base}.glb`)
  await io.write(outFile, doc)

  // The upload window's own checks, on the server's facts.
  const bytes = new Uint8Array(readFileSync(outFile))
  const facts = await gatherServerGlbFacts(bytes)
  const rows = checkGlb(facts)
  const cm = boundsToCm(facts.bounds)

  console.log('\nScan')
  console.log(
    `  ${prep.before.triangles} triangles, ${prep.before.parts} part(s), ${prep.before.holeEdges} hole edges, ` +
      `${prep.before.nonManifoldEdges} non-manifold edges; debris removed: ${prep.removedDebrisFaces} faces`,
  )
  console.log(
    `  textures: ${prep.materials.map((m) => `${m.name} (${[m.baseColor && 'colour', m.normal && 'normal'].filter(Boolean).join(' + ') || 'none'})`).join(', ')}`,
  )
  console.log('\nReal size (from the scan; check one measure against a tape)')
  console.log(`  Height ${cm?.h} cm × Width ${cm?.w} cm × Depth ${cm?.d} cm`)
  console.log('\nChecks (as the upload window)')
  for (const r of rows) console.log(`  ${r.status.toUpperCase().padEnd(4)} ${r.label}: ${r.detail}`)
  console.log(
    `\n${glbPasses(rows) ? 'Ready to upload' : 'NOT uploadable'}: ${outFile} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB, ${facts.triangles} triangles)`,
  )
  console.log(
    `Previews: ${previews}-front.png, -side.png, -angle.png (front = the side facing the room; --turn to change)\n`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
