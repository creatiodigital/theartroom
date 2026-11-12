import { configureStore, type UnknownAction } from '@reduxjs/toolkit'
import { test, expect } from '@playwright/test'
import { Mesh, PlaneGeometry } from 'three'

import { faceBoundingData } from '../src/components/wallview/hooks/useBoundingData'
import { convert2DTo3D } from '../src/components/wallview/utils'
import { createNewArtwork } from '../src/factories/artworkFactory'
import { exhibitionFactory } from '../src/factories/exhibitionFactory'
import { selectWallUnsaved } from '../src/redux/selectors/wallUnsaved'
import artworksReducer, {
  createArtwork,
  deleteArtwork,
  editArtisticImage,
  editArtisticText,
  editArtwork,
  restoreArtwork,
  restoreArtworksSnapshot,
  snapshotArtworks,
} from '../src/redux/slices/artworkSlice'
import exhibitionReducer, {
  addAutofocusGroup,
  clearHistory,
  clearSnapshot,
  createArtworkPosition,
  deleteArtworkPosition,
  pushToHistory,
  redo,
  removeAutofocusGroup,
  restoreSnapshot,
  setArtworkZOrder,
  setExhibition,
  snapshotExhibition,
  toggleArtworkLocked,
  undo,
  updateArtworkPosition,
} from '../src/redux/slices/exhibitionSlice'
import wallViewReducer, {
  addArtworkToGroup,
  addGuide,
  chooseCurrentArtworkId,
  clearAlignedPairs,
  closeArtworkEditModal,
  createArtworkGroup,
  decreaseScaleFactor,
  deselectGuide,
  editArtworkGroup,
  hideHuman,
  hideRulers,
  hideWallView,
  increaseScaleFactor,
  markWallSaved,
  openArtworkEditModal,
  removeGroup,
  removeGuide,
  resetPan,
  resetWallView,
  selectGuide,
  setActiveAutofocusGroupId,
  setAlignedPairs,
  setGuides,
  setPanPosition,
  setShiftKeyDown,
  setSizeLocked,
  setWallCoordinates,
  setWallDimensions,
  showHuman,
  showRulers,
  showWallView,
  startDragging,
  startResizing,
  stopDragging,
  stopResizing,
  toggleGuidesLocked,
  toggleSnap,
  updateGuidePosition,
  wallContentLoaded,
  zoomAtPoint,
} from '../src/redux/slices/wallViewSlice'
import { showWizard } from '../src/redux/slices/wizardSlice'
import type { RootState } from '../src/redux/store'
import type { TArtworkPosition } from '../src/types/artwork'

// The wall view's "Unsaved changes" (questions.md Q142; plan
// docs/superpowers/plans/2026-11-12-wall-unsaved-flag.md). One display-only value in the store:
// set only by the edits the wall's Save sends, never by what runs when a wall opens (the wall
// recomputes every item's 3D position on mount), cleared by an accepted save, Cancel and opening
// a wall, kept by a refused save and by an edit made while a save is out.
//
// The real reducers in Node: no browser, no WebGL. The page itself (the dot, the red line,
// "Leave site?") is checked in the browser (Q149).

const makeWallStore = () =>
  configureStore({
    reducer: {
      artworks: artworksReducer,
      exhibition: exhibitionReducer,
      wallView: wallViewReducer,
    },
  })
type WallStore = ReturnType<typeof makeWallStore>

// The selector only reads `wallView`, which this store has as the app's does.
const unsaved = (store: WallStore) => selectWallUnsaved(store.getState() as unknown as RootState)
const edits = (store: WallStore) => store.getState().wallView.wallEdits

// A wall as the GLB has it: a 4 × 3 m placeholder facing the room.
const wallData = () => {
  const geometry = new PlaneGeometry(4, 3)
  geometry.translate(0, 1.5, 0)
  geometry.computeBoundingBox()
  const mesh = new Mesh(geometry)
  mesh.name = 'w1'
  mesh.updateMatrixWorld(true)
  const data = faceBoundingData(mesh, null, undefined)
  if (!data) throw new Error('the test wall gave no geometry')
  return data
}

const position = (artworkId: string): TArtworkPosition => ({
  artworkId,
  wallId: 'w1',
  posX2d: 400,
  posY2d: 300,
  width2d: 200,
  height2d: 150,
  posX3d: 0,
  posY3d: 0,
  posZ3d: 0,
  quaternionX: 0,
  quaternionY: 0,
  quaternionZ: 0,
  quaternionW: 1,
})

// The editor page's load (useLoadExhibitionArtworks), before any wall is open.
const loadExhibition = (store: WallStore) => {
  store.dispatch(setExhibition({ ...exhibitionFactory(), id: 'ex1' }))
  for (const id of ['a1', 'a2']) {
    store.dispatch(restoreArtwork({ ...createNewArtwork({ id, artworkType: 'image' }), name: id }))
    store.dispatch(createArtworkPosition({ artworkId: id, artworkPosition: position(id) }))
  }
}

// Double-clicking a placeholder (Placeholder.tsx).
const openWall = (store: WallStore, wallId = 'w1') => {
  store.dispatch(snapshotExhibition())
  store.dispatch(snapshotArtworks())
  store.dispatch(showWallView(wallId))
}

const openedStore = () => {
  const store = makeWallStore()
  loadExhibition(store)
  openWall(store)
  return store
}

// A drag of a1 (useMoveArtwork): the new 2D place and the 3D one derived from it.
const drag = (store: WallStore, posX2d = 480) => {
  const pos = store.getState().exhibition.exhibitionArtworksById.a1
  store.dispatch(
    updateArtworkPosition({
      artworkId: 'a1',
      artworkPosition: {
        posX2d,
        posY2d: pos.posY2d,
        ...convert2DTo3D(posX2d, pos.posY2d, pos.width2d, pos.height2d, wallData()),
      },
    }),
  )
}

test.describe('wall view unsaved changes (Q142): the store', () => {
  test('the mount recompute sends only the nine derived 3D keys', () => {
    const keys = Object.keys(convert2DTo3D(400, 300, 200, 150, wallData())).sort()
    expect(keys).toEqual(
      [
        'height3d',
        'posX3d',
        'posY3d',
        'posZ3d',
        'quaternionW',
        'quaternionX',
        'quaternionY',
        'quaternionZ',
        'width3d',
      ].sort(),
    )
  })

  test('opening a wall shows no dot, nor does anything that runs when it opens', () => {
    const store = openedStore()
    const data = wallData()

    // Guides.tsx's fetch, Wall.tsx's dimensions and coordinates.
    store.dispatch(setGuides([{ id: 'g1', wallId: 'w1', orientation: 'vertical', position: 1 }]))
    store.dispatch(setWallDimensions({ width: 4, height: 3 }))
    store.dispatch(
      setWallCoordinates({ coordinates: { x: 0, y: 1.5, z: 0 }, normal: { x: 0, y: 0, z: 1 } }),
    )
    // Wall.tsx:201, once per item on the wall, and the once-on-mount one at :216.
    for (const id of ['a1', 'a2']) {
      const pos = store.getState().exhibition.exhibitionArtworksById[id]
      const new3D = convert2DTo3D(pos.posX2d, pos.posY2d, pos.width2d, pos.height2d, data)
      store.dispatch(updateArtworkPosition({ artworkId: id, artworkPosition: { ...new3D } }))
    }
    const current = store.getState().exhibition.exhibitionArtworksById.a1
    const new3DCoordinate = convert2DTo3D(
      current.posX2d,
      current.posY2d,
      current.width2d,
      current.height2d,
      data,
    )
    store.dispatch(
      updateArtworkPosition({ artworkId: 'a1', artworkPosition: { ...new3DCoordinate } }),
    )

    expect(edits(store)).toBe(0)
    expect(unsaved(store)).toBe(false)
  })

  test('opening a wall from the ?wallId= link shows no dot', () => {
    const store = makeWallStore()
    loadExhibition(store)
    // exhibitions/edit/index.tsx:185–190: no snapshot, then the linked work selected.
    store.dispatch(showWallView('w1'))
    store.dispatch(chooseCurrentArtworkId('a1'))
    store.dispatch(addArtworkToGroup('a1'))
    store.dispatch(showWizard())

    expect(unsaved(store)).toBe(false)
  })

  test('a ?wallId= link that opens the wall before the works arrive shows no dot', () => {
    // Known race (questions.md Q142): the loader's "ready" starts true, so the link can open the wall
    // before the fetch resolves. The load's own writes then reach an open wall; the load's end
    // (useLoadExhibitionArtworks → wallContentLoaded) clears them.
    const store = makeWallStore()
    store.dispatch(setExhibition({ ...exhibitionFactory(), id: 'ex1' }))
    store.dispatch(showWallView('w1'))
    for (const id of ['a1', 'a2']) {
      store.dispatch(
        restoreArtwork({ ...createNewArtwork({ id, artworkType: 'image' }), name: id }),
      )
      store.dispatch(createArtworkPosition({ artworkId: id, artworkPosition: position(id) }))
    }
    expect(edits(store)).toBeGreaterThan(0)
    store.dispatch(wallContentLoaded())

    expect(unsaved(store)).toBe(false)
    // And the next real edit still shows the dot.
    drag(store)
    expect(unsaved(store)).toBe(true)
  })

  test('zoom, pan, helpers, guides, selection and drag state show no dot', () => {
    const store = openedStore()
    const actions: UnknownAction[] = [
      increaseScaleFactor(),
      decreaseScaleFactor(),
      zoomAtPoint({
        direction: 'in',
        cursorXRatio: 0.5,
        cursorYRatio: 0.5,
        containerWidth: 800,
        containerHeight: 600,
      }),
      setPanPosition({ deltaX: 0.01, deltaY: 0.01 }),
      resetPan(),
      showHuman(),
      hideHuman(),
      showRulers(),
      hideRulers(),
      toggleSnap(),
      toggleGuidesLocked(),
      addGuide({ id: 'g2', wallId: 'w1', orientation: 'horizontal', position: 1.2 }),
      updateGuidePosition({ id: 'g2', position: 1.4 }),
      selectGuide('g2'),
      deselectGuide(),
      removeGuide('g2'),
      chooseCurrentArtworkId('a1'),
      addArtworkToGroup('a1'),
      addArtworkToGroup('a2'),
      createArtworkGroup({ groupX: 0, groupY: 0, groupWidth: 600, groupHeight: 150 }),
      editArtworkGroup({ groupX: 10, groupY: 10 }),
      removeGroup(),
      // A click on a work (useMoveArtwork): history, then selection.
      pushToHistory(),
      chooseCurrentArtworkId('a2'),
      startDragging(),
      setAlignedPairs([]),
      stopDragging(),
      startResizing(),
      clearAlignedPairs(),
      stopResizing(),
      setShiftKeyDown(true),
      setShiftKeyDown(false),
      setSizeLocked({ artworkId: 'a1', value: true }),
      setActiveAutofocusGroupId('none'),
      setActiveAutofocusGroupId(null),
      showWizard(),
    ]
    for (const action of actions) store.dispatch(action)

    expect(edits(store)).toBe(0)
    expect(unsaved(store)).toBe(false)
  })

  // Each kind of edit the wall's Save sends, as its call site dispatches it.
  const EDITS: {
    name: string
    /** State the exhibition was loaded with (before the wall opens: not an edit). */
    loaded?: (store: WallStore) => void
    /** Steps after the wall opens, marked saved, before the edit itself. */
    setup?: (store: WallStore) => void
    edit: (store: WallStore) => void
  }[] = [
    {
      name: 'adding an item from the add bar',
      edit: (store) => {
        store.dispatch(createArtwork({ id: 'n1', artworkType: 'text' }))
        store.dispatch(createArtworkPosition({ artworkId: 'n1', artworkPosition: position('n1') }))
      },
    },
    {
      name: 'adding a work from the library',
      edit: (store) => {
        store.dispatch(restoreArtwork(createNewArtwork({ id: 'lib1', artworkType: 'image' })))
        store.dispatch(
          createArtworkPosition({ artworkId: 'lib1', artworkPosition: position('lib1') }),
        )
      },
    },
    {
      name: 'a Look edit (a frame)',
      edit: (store) =>
        store.dispatch(
          editArtisticImage({ currentArtworkId: 'a1', property: 'showFrame', value: true }),
        ),
    },
    {
      name: 'typing on the wall',
      edit: (store) =>
        store.dispatch(
          editArtisticText({ currentArtworkId: 'a1', property: 'textContent', value: 'Hello' }),
        ),
    },
    {
      name: 'a shape or preset edit',
      edit: (store) =>
        store.dispatch(
          editArtwork({ currentArtworkId: 'a1', property: 'shapeOpacity', value: 0.5 }),
        ),
    },
    {
      name: 'deleting an item',
      edit: (store) => {
        store.dispatch(deleteArtwork({ artworkId: 'a2' }))
        store.dispatch(deleteArtworkPosition({ artworkId: 'a2' }))
      },
    },
    { name: 'dragging an item', edit: (store) => drag(store) },
    {
      name: 'resizing an item',
      edit: (store) =>
        store.dispatch(
          updateArtworkPosition({
            artworkId: 'a1',
            artworkPosition: {
              width2d: 260,
              height2d: 195,
              ...convert2DTo3D(400, 300, 260, 195, wallData()),
            },
          }),
        ),
    },
    {
      name: 'turning a shape',
      edit: (store) =>
        store.dispatch(
          updateArtworkPosition({ artworkId: 'a1', artworkPosition: { rotation: 45 } }),
        ),
    },
    {
      name: 'Move to front',
      edit: (store) => store.dispatch(setArtworkZOrder({ artworkId: 'a1', zOrder: 5 })),
    },
    {
      name: 'Lock artwork',
      edit: (store) => store.dispatch(toggleArtworkLocked({ artworkId: 'a1' })),
    },
    {
      name: 'a new autofocus group',
      edit: (store) =>
        store.dispatch(
          addAutofocusGroup({ id: 'gr1', name: 'Group 1', wallId: 'w1', artworkIds: ['a1', 'a2'] }),
        ),
    },
    {
      name: 'removing an autofocus group',
      loaded: (store) =>
        store.dispatch(
          addAutofocusGroup({ id: 'gr0', name: 'Group 1', wallId: 'w1', artworkIds: ['a1', 'a2'] }),
        ),
      edit: (store) => store.dispatch(removeAutofocusGroup('gr0')),
    },
    {
      name: 'undo',
      setup: (store) => {
        store.dispatch(pushToHistory())
        drag(store)
        store.dispatch(markWallSaved(edits(store)))
      },
      edit: (store) => store.dispatch(undo()),
    },
    {
      name: 'redo',
      setup: (store) => {
        store.dispatch(pushToHistory())
        drag(store)
        store.dispatch(undo())
        store.dispatch(markWallSaved(edits(store)))
      },
      edit: (store) => store.dispatch(redo()),
    },
  ]

  for (const { name, loaded, setup, edit } of EDITS) {
    test(`${name} shows the dot`, () => {
      const store = makeWallStore()
      loadExhibition(store)
      loaded?.(store)
      openWall(store)
      setup?.(store)
      expect(unsaved(store), 'clean before the edit').toBe(false)

      edit(store)

      expect(unsaved(store)).toBe(true)
    })
  }

  test('an accepted save clears the dot', () => {
    const store = openedStore()
    drag(store)
    const sentAt = edits(store)
    // LeftPanel's Save, accepted: the snapshot and history go, then the save is marked.
    store.dispatch(clearSnapshot())
    store.dispatch(clearHistory())
    store.dispatch(markWallSaved(sentAt))

    expect(unsaved(store)).toBe(false)
  })

  test('an edit made while the save is out keeps the dot after it is accepted', () => {
    const store = openedStore()
    drag(store, 480)
    const sentAt = edits(store)
    drag(store, 520)
    store.dispatch(markWallSaved(sentAt))
    expect(unsaved(store)).toBe(true)

    store.dispatch(markWallSaved(edits(store)))
    expect(unsaved(store)).toBe(false)
  })

  test('an older save accepted late never hides a newer one', () => {
    const store = openedStore()
    drag(store, 480)
    const first = edits(store)
    drag(store, 520)
    const second = edits(store)
    store.dispatch(markWallSaved(second))
    store.dispatch(markWallSaved(first))

    expect(store.getState().wallView.wallEditsSaved).toBe(second)
    expect(unsaved(store)).toBe(false)
  })

  test('a refused save keeps the dot', () => {
    const store = openedStore()
    drag(store)
    const sentAt = edits(store)
    // Refused: the handlers dispatch nothing new (only the red line, component state).
    expect(sentAt).toBeGreaterThan(0)

    expect(unsaved(store)).toBe(true)
  })

  test('Save & close leaves the wall without a dot', () => {
    const store = openedStore()
    drag(store)
    store.dispatch(clearSnapshot())
    store.dispatch(clearHistory())
    store.dispatch(hideHuman())
    store.dispatch(hideWallView())

    expect(unsaved(store)).toBe(false)
  })

  test('Cancel clears the dot, and the wall reopens without one', () => {
    const store = openedStore()
    drag(store)
    store.dispatch(restoreSnapshot())
    store.dispatch(restoreArtworksSnapshot())
    store.dispatch(hideHuman())
    store.dispatch(hideWallView())
    expect(unsaved(store)).toBe(false)

    openWall(store)
    expect(unsaved(store)).toBe(false)
  })

  test('opening another wall, or another exhibition, clears the dot', () => {
    const store = openedStore()
    drag(store)
    store.dispatch(showWallView('w2'))
    expect(unsaved(store)).toBe(false)

    drag(store)
    expect(unsaved(store)).toBe(true)
    store.dispatch(resetWallView())
    expect(unsaved(store)).toBe(false)
  })

  test('edits made before a wall opens (the page load, the 3D editor) never show', () => {
    const store = makeWallStore()
    loadExhibition(store)
    drag(store)
    store.dispatch(editArtwork({ currentArtworkId: 'a1', property: 'showFrame', value: true }))
    expect(edits(store)).toBe(0)

    openWall(store)
    expect(unsaved(store)).toBe(false)
  })

  test("the View details overlay's copy of its own accepted save shows no dot", () => {
    const store = openedStore()
    store.dispatch(openArtworkEditModal('a1'))
    // ArtworkEditModal/index.tsx after its PUT: the saved fields, and the sound upload.
    store.dispatch(editArtwork({ currentArtworkId: 'a1', property: 'artworkTitle', value: 'T' }))
    store.dispatch(editArtwork({ currentArtworkId: 'a1', property: 'textContent', value: 'x' }))
    store.dispatch(editArtwork({ currentArtworkId: 'a1', property: 'featured', value: true }))
    store.dispatch(
      editArtwork({ currentArtworkId: 'a1', property: 'imageUrl', value: 'https://r2/x' }),
    )
    store.dispatch(
      editArtwork({ currentArtworkId: 'a1', property: 'soundUrl', value: 'https://r2/s' }),
    )
    store.dispatch(closeArtworkEditModal())

    expect(unsaved(store)).toBe(false)
  })

  test('an arrow-key move while the overlay is open still counts', () => {
    const store = openedStore()
    store.dispatch(openArtworkEditModal('a1'))
    // Wall.tsx's window arrow keys: the 2D place plus its 3D.
    drag(store, 401)

    expect(unsaved(store)).toBe(true)
  })

  test("the save's own image and video addresses show no dot", () => {
    const store = openedStore()
    // useSaveExhibition after an upload, in the middle of a save.
    store.dispatch(
      editArtisticImage({ currentArtworkId: 'a1', property: 'imageUrl', value: 'https://r2/i' }),
    )
    store.dispatch(
      editArtisticImage({ currentArtworkId: 'a1', property: 'videoUrl', value: 'https://r2/v' }),
    )

    expect(unsaved(store)).toBe(false)
  })
})
