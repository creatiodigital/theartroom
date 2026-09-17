import { test, expect } from '@playwright/test'
import { BoxGeometry, Group, Mesh, Vector3 } from 'three'

import {
  bakeWorldTransforms,
  worldMatrixOf,
} from '../src/components/scene/spaces/objects/nodeIndices'

/**
 * Where a wall placeholder IS, in world space, has two readers that must agree:
 * the scene (which draws the dashed outline and the click target) and the wall
 * editor (which measures the wall, converts artwork to 3D, and hands
 * `MainCamera` the point to park in front of on Save & close).
 *
 * Vienna is the space that can tell them apart: its placeholders hang off a room
 * Empty ~20 m up the z axis rather than sitting at the origin.
 */

// Verbatim from vienna11.glb — `placeholdersRoom1`, the Empty that owns the
// four walls of the room the visitor arrives in.
const ROOM1_EMPTY = new Vector3(5.219140529632568, 3.5898969173431396, 19.829601287841797)
// Likewise verbatim — `placeholder4`, the wall straight ahead on arrival.
const PLACEHOLDER4_LOCAL = new Vector3(1.6945133209228516, -1.3741748332977295, -8.187623023986816)
// Its authored world position: what Blender shows, and the only answer either
// reader may give.
const PLACEHOLDER4_WORLD = PLACEHOLDER4_LOCAL.clone().add(ROOM1_EMPTY)

const viennaRoom1 = () => {
  const empty = new Group()
  empty.name = 'placeholdersRoom1'
  empty.position.copy(ROOM1_EMPTY)

  const placeholder = new Mesh(new BoxGeometry(4, 3, 0.05))
  placeholder.name = 'placeholder4'
  placeholder.position.copy(PLACEHOLDER4_LOCAL)
  empty.add(placeholder)

  return { nodes: { placeholder4: placeholder }, placeholder }
}

const positionFrom = (node: Mesh) => new Vector3().setFromMatrixPosition(worldMatrixOf(node))

test('a baked placeholder resolves to its authored world position, not twice the room offset', () => {
  const { nodes, placeholder } = viennaRoom1()

  // What the scene does before it draws anything: fold the Empty's offset into
  // the node, because R3F would drop it.
  expect(bakeWorldTransforms(nodes, ['placeholder'])).toBe(1)

  // The bug: the node keeps its parent, so composing the parent chain again
  // added `ROOM1_EMPTY` a second time — z ≈ 31.5 instead of 11.6, which put the
  // wall (and the camera parked 5 m in front of it) outside the building.
  const resolved = positionFrom(placeholder)
  expect(resolved.x).toBeCloseTo(PLACEHOLDER4_WORLD.x, 5)
  expect(resolved.y).toBeCloseTo(PLACEHOLDER4_WORLD.y, 5)
  expect(resolved.z).toBeCloseTo(PLACEHOLDER4_WORLD.z, 5)
})

test('baking is what the scene draws, so both readers land on the same point', () => {
  const { nodes, placeholder } = viennaRoom1()
  bakeWorldTransforms(nodes, ['placeholder'])

  // The scene copies `node.position` into a fresh <mesh> at the scene root.
  // That is the outline the artist clicks; the editor must measure the same one.
  expect(positionFrom(placeholder).equals(placeholder.position)).toBe(true)
})

test('an unbaked placeholder still resolves through its parent chain', () => {
  // Paris and Madrid never call `bakeWorldTransforms`, so for them the Empty's
  // offset still lives above the node and has to be composed in.
  const { nodes, placeholder } = viennaRoom1()
  void nodes

  const resolved = positionFrom(placeholder)
  expect(resolved.x).toBeCloseTo(PLACEHOLDER4_WORLD.x, 5)
  expect(resolved.y).toBeCloseTo(PLACEHOLDER4_WORLD.y, 5)
  expect(resolved.z).toBeCloseTo(PLACEHOLDER4_WORLD.z, 5)
})
