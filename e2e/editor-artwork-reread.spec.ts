import { configureStore } from '@reduxjs/toolkit'
import { test, expect } from '@playwright/test'

import { buildArtworksBatch } from '../src/components/wallview/hooks/artworksBatch'
import { createNewArtwork } from '../src/factories/artworkFactory'
import { exhibitionFactory } from '../src/factories/exhibitionFactory'
import {
  REREAD_FIELDS,
  artworkDetailsPatch,
  hasHeldWorks,
  rereadActions,
  rereadOpenedWorks,
  rereadWhenBack,
  resetArtworkReread,
  takeStudioValuesForSave,
  type ServerArtwork,
} from '../src/hooks/artworkReread'
import { selectWallUnsaved } from '../src/redux/selectors/wallUnsaved'
import artworksReducer, {
  editArtwork,
  restoreArtwork,
  restoreArtworksSnapshot,
  snapshotArtworks,
} from '../src/redux/slices/artworkSlice'
import exhibitionReducer, {
  createArtworkPosition,
  restoreSnapshot,
  setExhibition,
  snapshotExhibition,
} from '../src/redux/slices/exhibitionSlice'
import wallViewReducer, {
  hideWallView,
  markWallSaved,
  showWallView,
} from '../src/redux/slices/wallViewSlice'
import type { TArtwork, TArtworkPosition } from '../src/types/artwork'

// "Edit artwork" in the 3D editor opens the work's studio editor in a new tab (questions.md
// Q139 a). The wall's Save writes each work's details from the editor's own copy, so when the
// editor's tab is back the opened works are re-read and compared on nine fields (Q153), and a
// difference is applied, unless the open wall has unsaved changes: then it waits for the wall to
// be saved or discarded. The real reducers and the real decision, in Node, with a fake read.

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

// A work as the page load stores it (mapToArtwork: text `|| undefined`, featured `?? false`).
const loadedWork = (id: string): TArtwork => ({
  ...createNewArtwork({ id, artworkType: 'image' }),
  name: id,
  artworkTitle: 'Alas para tres',
  author: 'John Doe',
  artworkYear: undefined,
  artworkDimensions: '98 x 130 cm',
  technique: undefined,
  description: undefined,
  textContent: undefined,
  featured: false,
  imageUrl: 'https://r2.example/a.webp',
  showFrame: true,
})

// The same work as GET /api/artworks/{id} returns it while nothing changed.
const savedWork = (): ServerArtwork => ({
  title: 'Alas para tres',
  author: 'John Doe',
  year: null,
  dimensions: '98 x 130 cm',
  technique: '',
  description: null,
  textContent: null,
  featured: false,
  imageUrl: 'https://r2.example/a.webp',
})

const loadedStore = () => {
  const store = makeStore()
  store.dispatch(setExhibition({ ...exhibitionFactory(), id: 'ex1' }))
  for (const id of ['a1', 'a2']) {
    store.dispatch(restoreArtwork(loadedWork(id)))
    store.dispatch(createArtworkPosition({ artworkId: id, artworkPosition: position(id) }))
  }
  return store
}

const openWall = (store: Store) => {
  store.dispatch(snapshotExhibition())
  store.dispatch(snapshotArtworks())
  store.dispatch(showWallView('w1'))
}

const title = (store: Store, id = 'a1') => store.getState().artworks.byId[id].artworkTitle

// A read that returns the studio's save for a1: a new title.
const studioSaved =
  (calls: string[] = []) =>
  async (id: string) => {
    calls.push(id)
    return { ...savedWork(), title: 'Alas para tres (II)' }
  }

test.describe('Edit artwork: the re-read on return (Q139 a, Q153)', () => {
  test.beforeEach(() => resetArtworkReread())

  test('the nine fields are the ones the wall view overlay mirrors after its own save', () => {
    expect(REREAD_FIELDS.map((field) => field.property)).toEqual([
      'artworkTitle',
      'author',
      'artworkYear',
      'artworkDimensions',
      'technique',
      'description',
      'textContent',
      'featured',
      'imageUrl',
    ])
  })

  test('a work the studio did not change gives no difference (empty, null and missing alike)', () => {
    expect(artworkDetailsPatch(loadedWork('a1'), savedWork())).toEqual({})
  })

  test('only the fields that differ are patched, stored as the page load stores them', () => {
    const patch = artworkDetailsPatch(loadedWork('a1'), {
      ...savedWork(),
      title: 'Huída',
      author: null,
      featured: true,
      year: '2024',
    })
    // Strict: a field the studio emptied is in the patch, as undefined.
    expect(patch).toStrictEqual({
      artworkTitle: 'Huída',
      author: undefined,
      featured: true,
      artworkYear: '2024',
    })
  })

  test('fields outside the nine are never read', () => {
    const patch = artworkDetailsPatch(loadedWork('a1'), {
      ...savedWork(),
      ...({ showFrame: false, frameColor: '#ffffff', posX2d: 0 } as ServerArtwork),
    })
    expect(patch).toEqual({})
  })

  test('the re-read writes change only those fields', () => {
    const store = loadedStore()
    for (const action of rereadActions('a1', { artworkTitle: 'Huída', featured: true })) {
      store.dispatch(action)
    }
    const work = store.getState().artworks.byId.a1
    expect(work.artworkTitle).toBe('Huída')
    expect(work.featured).toBe(true)
    expect(work.showFrame).toBe(true)
    expect(store.getState().exhibition.exhibitionArtworksById.a1.posX2d).toBe(400)
  })

  test('only works opened with Edit artwork are read', async () => {
    const store = loadedStore()
    const calls: string[] = []
    await rereadOpenedWorks(store, studioSaved(calls))
    expect(calls).toEqual([])

    rereadWhenBack('a1')
    await rereadOpenedWorks(store, studioSaved(calls))
    expect(calls).toEqual(['a1'])
  })

  test("with no wall open, the studio's save is applied", async () => {
    const store = loadedStore()
    rereadWhenBack('a1')
    await rereadOpenedWorks(store, studioSaved())

    expect(title(store)).toBe('Alas para tres (II)')
    expect(hasHeldWorks()).toBe(false)
  })

  test('with a wall open and nothing unsaved, it is applied and lights no dot', async () => {
    const store = loadedStore()
    openWall(store)
    rereadWhenBack('a1')
    await rereadOpenedWorks(store, studioSaved())

    expect(title(store)).toBe('Alas para tres (II)')
    expect(selectWallUnsaved(store.getState())).toBe(false)
    expect(hasHeldWorks()).toBe(false)
  })

  test('with a wall open and unsaved changes, the work is held and nothing is applied', async () => {
    const store = loadedStore()
    openWall(store)
    store.dispatch(editArtwork({ currentArtworkId: 'a2', property: 'showFrame', value: false }))
    expect(selectWallUnsaved(store.getState())).toBe(true)

    rereadWhenBack('a1')
    await rereadOpenedWorks(store, studioSaved())

    expect(title(store)).toBe('Alas para tres')
    expect(hasHeldWorks()).toBe(true)
  })

  test('after the wall is saved, the held work is read again and applied', async () => {
    const store = loadedStore()
    openWall(store)
    store.dispatch(editArtwork({ currentArtworkId: 'a2', property: 'showFrame', value: false }))
    rereadWhenBack('a1')
    await rereadOpenedWorks(store, studioSaved())
    expect(hasHeldWorks()).toBe(true)

    // An accepted Save: the dot clears, which is what triggers the next read.
    store.dispatch(markWallSaved(store.getState().wallView.wallEdits))
    await rereadOpenedWorks(store, studioSaved())

    expect(title(store)).toBe('Alas para tres (II)')
    expect(hasHeldWorks()).toBe(false)
  })

  test('after a discard, the held work is read again with no wall open', async () => {
    const store = loadedStore()
    openWall(store)
    store.dispatch(editArtwork({ currentArtworkId: 'a2', property: 'showFrame', value: false }))
    rereadWhenBack('a1')
    await rereadOpenedWorks(store, studioSaved())

    // Cancel: the snapshot comes back and the wall closes, which triggers the next read.
    store.dispatch(restoreSnapshot())
    store.dispatch(restoreArtworksSnapshot())
    store.dispatch(hideWallView())
    await rereadOpenedWorks(store, studioSaved())

    expect(title(store)).toBe('Alas para tres (II)')
    expect(hasHeldWorks()).toBe(false)
  })

  test('a failed read changes nothing', async () => {
    const store = loadedStore()
    rereadWhenBack('a1')
    await rereadOpenedWorks(store, async () => null)

    expect(title(store)).toBe('Alas para tres')
    expect(hasHeldWorks()).toBe(false)
  })
})

// ---- Q157 (a): the wall's save takes the studio's values first ----

// A text item on the same wall: the one field the wall itself edits is its text.
const textWork = (): TArtwork => ({
  ...createNewArtwork({ id: 't1', artworkType: 'text' }),
  name: 't1',
  artworkTitle: 'Notes',
  author: 'John Doe',
  artworkYear: undefined,
  artworkDimensions: undefined,
  technique: undefined,
  description: undefined,
  textContent: 'Wall text',
  featured: false,
  imageUrl: undefined,
})
const savedText = (): ServerArtwork => ({
  title: 'Notes',
  author: 'John Doe',
  year: null,
  dimensions: null,
  technique: null,
  description: null,
  textContent: 'Wall text',
  featured: false,
  imageUrl: null,
})

const openedWall = () => {
  const store = loadedStore()
  store.dispatch(restoreArtwork(textWork()))
  store.dispatch(createArtworkPosition({ artworkId: 't1', artworkPosition: position('t1') }))
  openWall(store)
  return store
}

// The server as the studio left it: a1, a2 and t1 as loaded, then `changes` over them. A work
// listed in `failing` can't be read.
const studio =
  (changes: Record<string, ServerArtwork> = {}, failing: string[] = [], calls: string[] = []) =>
  async (id: string): Promise<ServerArtwork | null> => {
    calls.push(id)
    if (failing.includes(id)) return null
    return { ...(id === 't1' ? savedText() : savedWork()), ...changes[id] }
  }

// What useSaveExhibition sends as `POST /api/artworks/batch`: its copy of the works is the
// render's (`rendered`, read with a selector before the click), the studio's values are read at
// the click, and the body goes through JSON as the request does. null: the save stopped there.
const saveRequestBody = async (
  store: Store,
  rendered: Record<string, TArtwork>,
  read: (id: string) => Promise<ServerArtwork | null>,
) => {
  const studioValues = await takeStudioValuesForSave(store.dispatch, read)
  if (!studioValues) return null
  const artworks = buildArtworksBatch({
    allArtworkIds: store.getState().artworks.allIds,
    artworksById: rendered,
    studioValues,
    uploadedUrls: new Map(),
    originalDimensions: new Map(),
  })
  return JSON.parse(JSON.stringify({ userId: 'u1', artworks })) as {
    artworks: Array<Record<string, unknown>>
  }
}
const sent = (body: Awaited<ReturnType<typeof saveRequestBody>>, id: string) =>
  body?.artworks.find((artwork) => artwork.id === id)

const editTheWall = (store: Store) =>
  store.dispatch(editArtwork({ currentArtworkId: 'a2', property: 'showFrame', value: false }))

test.describe('A wall save with a work changed in another tab (Q157 a)', () => {
  test.beforeEach(() => resetArtworkReread())

  test("edit the title in the studio, save the wall, and the studio's title survives", async () => {
    const store = openedWall()
    editTheWall(store)
    rereadWhenBack('a1')
    const read = studio({ a1: { title: 'Alas para tres (II)' } })
    await rereadOpenedWorks(store, read)
    expect(hasHeldWorks()).toBe(true)

    const rendered = store.getState().artworks.byId
    const body = await saveRequestBody(store, rendered, read)

    expect(sent(body, 'a1')?.title).toBe('Alas para tres (II)')
    expect(rendered.a1.artworkTitle).toBe('Alas para tres')
    expect(title(store)).toBe('Alas para tres (II)')
    // The line goes; the wall's own edit still waits for the save's answer.
    expect(hasHeldWorks()).toBe(false)
    expect(selectWallUnsaved(store.getState())).toBe(true)

    // Accepted: the dot clears, the re-read finds the server as the store is, the line stays gone.
    store.dispatch(markWallSaved(store.getState().wallView.wallEdits))
    await rereadOpenedWorks(store, read)
    expect(title(store)).toBe('Alas para tres (II)')
    expect(hasHeldWorks()).toBe(false)
  })

  test("a text item's text keeps the wall's copy; its other fields are the studio's", async () => {
    const store = openedWall()
    store.dispatch(
      editArtwork({ currentArtworkId: 't1', property: 'textContent', value: 'Wall text, edited' }),
    )
    rereadWhenBack('t1')
    const read = studio({ t1: { title: 'Notes (II)', textContent: 'Studio text' } })
    await rereadOpenedWorks(store, read)
    expect(hasHeldWorks()).toBe(true)

    const body = await saveRequestBody(store, store.getState().artworks.byId, read)

    expect(sent(body, 't1')?.textContent).toBe('Wall text, edited')
    expect(sent(body, 't1')?.title).toBe('Notes (II)')
    expect(store.getState().artworks.byId.t1.textContent).toBe('Wall text, edited')
  })

  test("the wall's own unsaved text edit is no change in another tab", async () => {
    const store = openedWall()
    rereadWhenBack('t1')
    store.dispatch(
      editArtwork({ currentArtworkId: 't1', property: 'textContent', value: 'Wall text, edited' }),
    )
    await rereadOpenedWorks(store, studio())

    expect(hasHeldWorks()).toBe(false)
    expect(store.getState().artworks.byId.t1.textContent).toBe('Wall text, edited')
  })

  test("a field emptied in the studio is sent empty, so the wall's old value doesn't come back", async () => {
    const store = openedWall()
    editTheWall(store)
    rereadWhenBack('a1')
    const read = studio({ a1: { author: null } })

    const body = await saveRequestBody(store, store.getState().artworks.byId, read)

    // The route writes `author || undefined`: null leaves the studio's empty author as it is.
    expect(sent(body, 'a1')?.author).toBeNull()
    expect(store.getState().artworks.byId.a1.author).toBeUndefined()
  })

  test('every opened work is read at the click, held or not yet', async () => {
    // A click on Save in the editor's window while it is behind: its focus and the click arrive
    // together, before any focus re-read could hold the work.
    const store = openedWall()
    editTheWall(store)
    rereadWhenBack('a1')
    const calls: string[] = []
    const read = studio({ a1: { title: 'Alas para tres (II)' } }, [], calls)

    const body = await saveRequestBody(store, store.getState().artworks.byId, read)

    expect(calls).toEqual(['a1'])
    expect(sent(body, 'a1')?.title).toBe('Alas para tres (II)')
    expect(sent(body, 'a2')?.title).toBe('Alas para tres')
  })

  test('with no work opened, a save reads nothing', async () => {
    const store = openedWall()
    editTheWall(store)
    const calls: string[] = []

    const body = await saveRequestBody(store, store.getState().artworks.byId, studio({}, [], calls))

    expect(calls).toEqual([])
    expect(sent(body, 'a1')?.title).toBe('Alas para tres')
  })

  test("a failed read stops the save: nothing is taken and the studio's edit isn't overwritten", async () => {
    const store = openedWall()
    editTheWall(store)
    rereadWhenBack('a1')
    rereadWhenBack('a2')
    const changed = { a1: { title: 'Alas para tres (II)' } }
    await rereadOpenedWorks(store, studio(changed))
    expect(hasHeldWorks()).toBe(true)

    const body = await saveRequestBody(
      store,
      store.getState().artworks.byId,
      studio(changed, ['a2']),
    )

    expect(body).toBeNull()
    expect(title(store)).toBe('Alas para tres')
    expect(hasHeldWorks()).toBe(true)
    expect(selectWallUnsaved(store.getState())).toBe(true)
  })

  test("the request keeps its fields; technique stays null and the image is the studio's", async () => {
    const store = openedWall()
    editTheWall(store)
    rereadWhenBack('a1')
    const read = studio({
      a1: { technique: 'Oil on canvas', imageUrl: 'https://r2.example/b.webp' },
    })

    const body = await saveRequestBody(store, store.getState().artworks.byId, read)
    const a1 = sent(body, 'a1')

    expect(Object.keys(a1 ?? {})).toEqual([
      'id',
      'name',
      'artworkType',
      'title',
      'author',
      'year',
      'technique',
      'dimensions',
      'description',
      'imageUrl',
      'textContent',
      'featured',
      'hiddenFromExhibition',
      'originalWidth',
      'originalHeight',
    ])
    // The route never writes either (artworks/batch/route.ts): the studio's technique and image
    // stay. The store takes both, so this editor shows them.
    expect(a1?.technique).toBeNull()
    expect(a1?.imageUrl).toBe('https://r2.example/b.webp')
    expect(store.getState().artworks.byId.a1.technique).toBe('Oil on canvas')
  })
})
