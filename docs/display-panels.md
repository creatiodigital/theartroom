# Display panels

Freestanding thin walls the artist places inside a room — the temporary walling
a gallery wheels in to break up a hall and win extra hanging surface. Each panel
has a hangable face on **both** sides; the thin edges are never used.

Vienna has them as of `vienna13`. This is what Paris and Madrid need to get them.

---

## 1. Blender: what to author

Three objects per panel, **flat siblings** under an Empty whose name ends in
`room<n>`:

```
panelsRoom0                 ← Empty. Any name ending in room0 works
├── panel0                  ← the box. Visible, collidable
├── panelFront0             ← placeholder plane, normal pointing OUT of the front
└── panelBack0              ← placeholder plane, normal pointing OUT of the back
```

Collections do not export as glTF nodes — the Empty and real object parenting
do. Mirror whatever `trackLampsRoom0` is.

### Numbering: blocks of ten, one block per room

Room 0 uses `panel0`–`panel9`, room 1 uses `panel10`–`panel19`, and so on.

Gaps cost nothing: `getNodeIndices` collects whatever it finds and never assumes
the numbers are contiguous.

This is not cosmetic. **`wallId` is persisted per artwork as `panelFront0`.**
Renumber a panel after work has been hung on it and every one of those artworks
is orphaned, pointing at a wall that no longer exists. Sequential numbering
across rooms means adding one panel to room 0 shifts room 1 and silently breaks
every exhibition that used it. Blocks mean rooms never disturb each other.

### The five ways to get this wrong

1. **Duplicating a panel** gives you `panel0.001`. That does not match
   `^panel\d+$`, so it is never baked and never found: it renders at the room
   Empty's offset with no hangable faces, and nothing errors. Rename every copy
   and scan the outliner for any leftover `.00` suffix.
2. **Leading zeros.** `panel01` parses to index `1` and collides with `panel1` —
   two node names resolving to one index.
3. **Both placeholder normals pointing the same way.** Duplicating the front
   face to make the back keeps the original's normal, and artworks on the back
   then hang facing *into* the panel. Check with normals display on.
4. **The panel floating above the floor.** Room placeholders start at exactly
   y=0. A panel whose base sits even 13mm up reads as hovering, and the contact
   shadow beneath it makes the gap obvious.
5. **Assigning a material.** The panel's surface is generated in three.js from
   the artist's color, so any material, UV or texture in the GLB is dead weight.
   Author geometry only.

### Verify before trusting an export

A Vienna re-export once silently dropped `initialPoint0`, `invisibleWall0`,
`exit0` and `continue0`. Nothing errored, because every call site is
null-guarded. **Always diff node names against the previous GLB**, and check
parents, normals and the floor gap at the same time.

---

## 2. Code: what a new space needs

Vienna is the worked example — `ViennaSpace.tsx`.

1. **Register the families for world-baking.** Add `'panel'`, `'panelFront'` and
   `'panelBack'` to the space's `ROOM_PARENTED_PREFIXES`.

   Three entries, not one: the match is `^<prefix>\d+$`, so `'panel'` alone
   takes `panel0` and leaves the faces behind — the box moves to the room offset
   and its two hangable faces stay where they were. Skip this step entirely and
   the panel renders at the room Empty's offset, which in Vienna is ~21m.

2. **Collect the indices** during render, beside the lamp grouping:

   ```ts
   const panelIndices = useMemo(() => getNodeIndices(nodes, 'panel'), [nodes])
   ```

3. **Render them**, giving each a collision ref from `wallRefs` after the
   space's fixed slots:

   ```tsx
   {panelIndices.map((index, position) => (
     <Panel key={index} i={index} nodes={nodes} panelRef={wallRefs[3 + position]} />
   ))}
   ```

   `deriveSpaceRefs` already counts `panel` into the `walls` family, so the refs
   exist. Over-allocating is harmless; under-allocating silently drops collision.

Nothing else. The sidebar, the 2D canvas, persistence and the artwork transform
are all space-agnostic and pick the panels up automatically.

---

## 3. How it fits together

### One matrix, three readers

A panel's position and rotation are the artist's, stored per exhibition — but
the geometry is Blender's. That transform is built **once**, by `panelMatrix` in
`panelSettings.ts`, and read by three places that must never disagree:

| Reader | What it does with it |
|---|---|
| `Panel.tsx` | Sets it on the group holding the box and both faces |
| `ArtObjects` | Applies it to every artwork hung on the panel, at draw time |
| `Wall.tsx` | Applies it to place the wall-view camera, which needs world space |

If these were three separate calculations, the failure would be silent: you
would drag a panel across the room and the artworks would stay behind, floating
where it used to be, with nothing in the console. One source is the whole design.

### 🔒 Applied exactly ONCE, on the way out

`useBoundingData` is deliberately NOT in that table. It returns the face in its
own space and hands the matrix over **unapplied**, as `panelTransform`.

It used to apply it, and that was a real bug (2026-09-20). `convert2DTo3D` builds
the stored `posX3d/Y3d/Z3d` out of exactly that geometry, so a transformed
bounding box meant the matrix was baked into what went INTO the database — and
then `ArtObjects` applied it again coming out. A panel turned -90° put its
back-face works 3.3 m away, out by the windows. Quaternions were double-rotated
the same way.

It hid for weeks because the matrix is **identity until a panel is moved**, and
applying identity twice costs nothing. Worse, it spread: `Wall.tsx` recomputes 3D
from 2D every time a wall opens, so each visit to a moved panel's face silently
converted everything on it from panel-local to world.

**The invariant: what is stored describes the face, not the room. Moving a panel
must not change a single stored coordinate.** `e2e/panel-transform.spec.ts` holds
it there. A consumer that truly needs world space applies `panelTransform` at the
point of use — the wall-view camera is the only one.

`Panel.tsx` drives its group matrix by hand (`matrixAutoUpdate = false`) rather
than through position/rotation props precisely to avoid writing a second
implementation of the same transform.

### Why the Blender hierarchy cannot do this

Nesting the faces under the panel in Blender ties them together *while
modelling* and nothing more. R3F's `<primitive>` re-parents nodes into its own
graph and `useGLTF` caches them globally, so the first render after a page load
sees the authored parents and **every later mount sees `parent === null`**. A
tie that depended on it would work once and then quietly stop.

### Panels are off by default

`isPanelEnabled` defaults to **false** — the opposite of the track lamps. An
exhibition built before panels existed has no settings for them and must not
suddenly grow a six-metre wall through the middle of the room.

### Hiding a panel that holds artworks

Non-destructive. `wallId` is untouched and the work comes back when the panel is
switched on again. Two things follow, and both are deliberate:

- **`ArtObjects` drops them from the scene.** Left in, four framed works would
  hang in mid-air where the panel used to be.
- **`MediaLibrary` keeps them, marked.** The library normally hides anything
  already in the exhibition. A parked artwork is in the exhibition but on no
  wall, so filtering it out would make it invisible in the room *and* in the
  library at once — work missing with nowhere to look for it. It stays, dimmed,
  with an eye-off badge and "In use · panel hidden".

### Shadows

Panels do not cast real shadows and cannot. `<Canvas shadows={false}>`, and
enabling them fails to *link*: 22 spotlights against `MAX_TEXTURE_IMAGE_UNITS`
of 16. Screen-space AO was measured as a stand-in on 2026-09-07 and rejected —
47fps in an almost empty room against a bar of flat 60.

### ❌ A panel casts NO shadow on the floor (decided 2026-09-20)

It had a `ShadowDecal` quad laid flat under it. That was removed, and it should
not come back without a real view proving it helps.

The panel looked like it was floating, and three things turned out to be stacked
on top of each other. Only the first was an actual defect:

1. **The base and the floor were exactly coplanar**, both at y=0.0000 — two
   opaque surfaces fighting for the same pixels. The panel's bottom face is
   nearly edge-on from standing height, so the z-fight landed precisely on the
   seam and drew a broken line there. Being perfectly flush was the bug.
   `PANEL_FLOOR_SINK` now drops the box 3 mm below the floor.
2. **The shadow was eight times too wide** — 19 cm against an artwork's 2.4 cm,
   a soft pool rather than a contact line. Tightening it to 6.7 cm and darkening
   it did not fix the impression.
3. **The panel did not darken at its base.** That is the real cue, and it is
   what ambient occlusion would provide — unavailable here (47fps vs a bar of
   flat 60, rejected 2026-09-07). A surface lit identically at the floor and at
   eye height cannot read as resting on anything, so the floor decal was being
   asked to carry the whole illusion by itself and could not.

The grounding now lives in `panelSurface.ts`: the panel's own diffuse darkens
~22% over the bottom 30 cm, measured from each panel's own base. Two shader
instructions on a value already in scope — no extra pass, no texture unit, so
none of the reasons AO was rejected apply here.

🔒 Measure before believing "it is floating". The floor, the reflector plane and
every panel base all sit at y=0.0000. Nothing was ever actually off the ground.

---

## 4. Files

| File | Role |
|---|---|
| `Panel/panelSettings.ts` | The contract: types, defaults, face parsing, `panelMatrix`, footprint. Pure — unit-tested in `e2e/panel-transform.spec.ts` |
| `Panel/Panel.tsx` | The 3D object: box, both faces, contact shadow, collision |
| `editview/PanelsPanel` | The sidebar: per room, toggle / across / depth / turn / color |
| `useBoundingData` | Returns the face in its OWN space plus `panelTransform`, unapplied |
| `ArtObjects` | Moves and hides the artworks hanging on a panel |
| `MediaLibrary` | Marks artworks parked on a hidden panel |
