import { configureStore } from '@reduxjs/toolkit'
import { test, expect } from '@playwright/test'

import { keepAsCancelPoint, needsLinkCancelPoint } from '../src/components/wallview/wallBaseline'
import { createNewArtwork } from '../src/factories/artworkFactory'
import { exhibitionFactory } from '../src/factories/exhibitionFactory'
import { selectWallUnsaved } from '../src/redux/selectors/wallUnsaved'
import artworksReducer, {
  editArtwork,
  resetArtworks,
  restoreArtwork,
  restoreArtworksSnapshot,
  snapshotArtworks,
} from '../src/redux/slices/artworkSlice'
import exhibitionReducer, {
  clearHistory,
  createArtworkPosition,
  restoreSnapshot,
  setExhibition,
  snapshotExhibition,
  updateArtworkPosition,
} from '../src/redux/slices/exhibitionSlice'
import wallViewReducer, {
  hideWallView,
  markWallSaved,
  resetWallView,
  setWallSaving,
  showWallView,
  wallContentLoaded,
} from '../src/redux/slices/wallViewSlice'
import type { TArtworkPosition } from '../src/types/artwork'

// The wall view's Cancel point (questions.md Q146 a; docs/superpowers/plans/
// 2026-11-12-later-pass.md, item 3): Cancel returns to the wall as it was last saved or loaded.
// A placeholder's double-click takes it when the wall opens, a `?wallId=` link once the works are
// in the store, and every accepted save that keeps the wall open takes it again. Also the one
// saving flag both panels share (Q146 b). The real reducers in Node: no browser, no WebGL.

const makeStore = () =>
  configureStore({
    reducer: {
      artworks: artworksReducer,
      exhibition: exhibitionReducer,
      wallView: wallViewReducer,
    },
  })
type Store = ReturnType<typeof makeStore>

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

// The page: the exhibition first (setExhibition), then the works loader's actions.
const setExhibitionPage = (store: Store) =>
  store.dispatch(setExhibition({ ...exhibitionFactory(), id: 'ex1' }))
const loadWorks = (store: Store) => {
  store.dispatch(resetArtworks())
  for (const id of ['a1', 'a2']) {
    store.dispatch(
      restoreArtwork({
        ...createNewArtwork({ id, artworkType: 'image' }),
        name: id,
        showFrame: true,
      }),
    )
    store.dispatch(createArtworkPosition({ artworkId: id, artworkPosition: position(id) }))
  }
  store.dispatch(wallContentLoaded())
}

// Placeholder.tsx's double-click.
const openFromPlaceholder = (store: Store) => {
  store.dispatch(snapshotExhibition())
  store.dispatch(snapshotArtworks())
  store.dispatch(showWallView('w1'))
}

// exhibitions/edit/index.tsx's effect, as it runs on a render with `loadedExhibitionId`.
const linkEffect = (store: Store, loadedExhibitionId: string | null) => {
  const state = store.getState()
  if (
    needsLinkCancelPoint({
      isWallView: state.wallView.isWallView,
      hasCancelPoint: state.exhibition._snapshot !== null,
      exhibitionId: state.exhibition.id,
      loadedExhibitionId,
    })
  ) {
    keepAsCancelPoint(store.dispatch)
  }
}

const move = (store: Store, posX2d: number, artworkId = 'a1') =>
  store.dispatch(updateArtworkPosition({ artworkId, artworkPosition: { posX2d } }))
const frame = (store: Store, showFrame: boolean, artworkId = 'a1') =>
  store.dispatch(
    editArtwork({ currentArtworkId: artworkId, property: 'showFrame', value: showFrame }),
  )

// LeftPanel's Save, accepted (handleSaveProgress): the wall stays open.
const saveAccepted = (store: Store) => {
  const sentAt = store.getState().wallView.wallEdits
  keepAsCancelPoint(store.dispatch)
  store.dispatch(clearHistory())
  store.dispatch(markWallSaved(sentAt))
}

// RightPanel's View details, its save-first accepted (handleEditArtworkDetails).
const viewDetailsSaved = (store: Store) => {
  const sentAt = store.getState().wallView.wallEdits
  store.dispatch(markWallSaved(sentAt))
  keepAsCancelPoint(store.dispatch)
}

// LeftPanel's Cancel (handleCancel), the store's part.
const cancel = (store: Store) => {
  store.dispatch(restoreSnapshot())
  store.dispatch(restoreArtworksSnapshot())
  store.dispatch(hideWallView())
}

const posX = (store: Store, artworkId = 'a1') =>
  store.getState().exhibition.exhibitionArtworksById[artworkId]?.posX2d
const showsFrame = (store: Store, artworkId = 'a1') =>
  store.getState().artworks.byId[artworkId]?.showFrame

test.describe('Cancel returns to the last saved wall (Q146 a)', () => {
  test('after a Save, Cancel returns to what was saved, not to the wall as it opened', () => {
    const store = makeStore()
    setExhibitionPage(store)
    loadWorks(store)
    openFromPlaceholder(store)

    move(store, 480)
    frame(store, false)
    saveAccepted(store)
    move(store, 560)
    frame(store, false, 'a2')
    cancel(store)

    expect(posX(store)).toBe(480)
    expect(showsFrame(store)).toBe(false)
    expect(showsFrame(store, 'a2')).toBe(true)
    expect(store.getState().wallView.isWallView).toBe(false)
  })

  test('the new Save sequence still clears the dot and counts nothing itself', () => {
    const store = makeStore()
    setExhibitionPage(store)
    loadWorks(store)
    openFromPlaceholder(store)
    move(store, 480)
    const edits = store.getState().wallView.wallEdits

    saveAccepted(store)

    expect(store.getState().wallView.wallEdits).toBe(edits)
    expect(selectWallUnsaved(store.getState())).toBe(false)
  })

  test('after View details saves first, Cancel returns to what it saved', () => {
    const store = makeStore()
    setExhibitionPage(store)
    loadWorks(store)
    openFromPlaceholder(store)

    move(store, 480)
    viewDetailsSaved(store)
    move(store, 560)
    cancel(store)

    expect(posX(store)).toBe(480)
  })

  test('a linked wall takes its Cancel point once the works are in, and Cancel returns to them', () => {
    const store = makeStore()
    setExhibitionPage(store)
    loadWorks(store)
    // The link opens the wall: no placeholder, so no snapshot yet.
    store.dispatch(showWallView('w1'))
    linkEffect(store, 'ex1')
    expect(store.getState().exhibition._snapshot).not.toBeNull()

    move(store, 480)
    frame(store, false)
    cancel(store)

    expect(posX(store)).toBe(400)
    expect(showsFrame(store)).toBe(true)
  })

  test('a link that opens the wall before the works arrive takes no Cancel point of the empty store', () => {
    const store = makeStore()
    setExhibitionPage(store)
    // The link opens the wall at once (the loader's isReady starts true, Q151).
    store.dispatch(showWallView('w1'))
    linkEffect(store, null)
    expect(store.getState().exhibition._snapshot).toBeNull()
    expect(store.getState().artworks._snapshot).toBeNull()

    // The works arrive; the loader then says which exhibition it loaded.
    loadWorks(store)
    linkEffect(store, 'ex1')
    expect(store.getState().artworks._snapshot?.allIds).toEqual(['a1', 'a2'])

    move(store, 480)
    cancel(store)
    expect(posX(store)).toBe(400)
    expect(store.getState().artworks.allIds).toEqual(['a1', 'a2'])
  })

  test("the link effect waits for this exhibition's works, never another's", () => {
    const base = { isWallView: true, hasCancelPoint: false, exhibitionId: 'ex1' }
    expect(needsLinkCancelPoint({ ...base, loadedExhibitionId: null })).toBe(false)
    expect(needsLinkCancelPoint({ ...base, loadedExhibitionId: 'ex0' })).toBe(false)
    expect(
      needsLinkCancelPoint({ ...base, exhibitionId: undefined, loadedExhibitionId: null }),
    ).toBe(false)
    expect(needsLinkCancelPoint({ ...base, loadedExhibitionId: 'ex1' })).toBe(true)
  })

  test('a wall opened from a placeholder keeps its own Cancel point; no wall takes none', () => {
    const loaded = { exhibitionId: 'ex1', loadedExhibitionId: 'ex1' }
    expect(needsLinkCancelPoint({ ...loaded, isWallView: true, hasCancelPoint: true })).toBe(false)
    expect(needsLinkCancelPoint({ ...loaded, isWallView: false, hasCancelPoint: false })).toBe(
      false,
    )

    const store = makeStore()
    setExhibitionPage(store)
    loadWorks(store)
    openFromPlaceholder(store)
    move(store, 480)
    linkEffect(store, 'ex1')
    cancel(store)
    expect(posX(store)).toBe(400)
  })
})

test.describe('one wall save at a time (Q146 b): the store', () => {
  test('one saving flag for both panels, set and cleared by the save', () => {
    const store = makeStore()
    expect(store.getState().wallView.wallSaving).toBe(false)

    store.dispatch(setWallSaving(true))
    expect(store.getState().wallView.wallSaving).toBe(true)

    store.dispatch(setWallSaving(false))
    expect(store.getState().wallView.wallSaving).toBe(false)
  })

  test('the flag is no wall edit, and survives the wall closing until the save clears it', () => {
    const store = makeStore()
    setExhibitionPage(store)
    loadWorks(store)
    openFromPlaceholder(store)

    store.dispatch(setWallSaving(true))
    expect(selectWallUnsaved(store.getState())).toBe(false)
    // Save & close, accepted: the wall closes first, then the save's `finally` clears the flag.
    store.dispatch(hideWallView())
    expect(store.getState().wallView.wallSaving).toBe(true)
    store.dispatch(setWallSaving(false))
    expect(store.getState().wallView.wallSaving).toBe(false)
  })

  test('switching exhibition clears it', () => {
    const store = makeStore()
    store.dispatch(setWallSaving(true))
    store.dispatch(resetWallView())
    expect(store.getState().wallView.wallSaving).toBe(false)
  })
})
