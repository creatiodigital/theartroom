/**
 * AR-182: a second language for the texts inside an exhibition's 3D room (docs/wall-languages).
 *
 * English is always the main language. An exhibition may offer ONE second language, for the room's
 * text artworks only; nothing else on the site is translated. A text artwork has one optional
 * second version, which doesn't record a language (owner, 2026-11-14): it is shown in whatever
 * second language the exhibition offers. A text without one shows its English text, so the room
 * is never half empty.
 */

export type SecondLanguage = {
  /** The stored code (`Exhibition.secondLanguage`). */
  code: string
  /**
   * The name in English: the dashboard and the editors, which are in English (the settings card,
   * the editors' switches, the wall editor's field), and the room's English welcome window
   * ("also available in French"). README, answers 2026-11-14.
   */
  name: string
  /** Its own name, for the visitor's switch in the room menu only, so its readers recognise it. */
  nativeName: string
}

/**
 * The languages an exhibition can offer besides English, in the owner's order (2026-11-14).
 * Only languages written in standard (Latin) characters (owner): every wall typeface ships Latin
 * glyphs with their accents; none has CJK, and not all have Greek or Cyrillic.
 */
export const SECOND_LANGUAGES: readonly SecondLanguage[] = [
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
]

/** The language with this code, or null for none or a code that isn't offered. */
export const secondLanguageOf = (code: string | null | undefined): SecondLanguage | null =>
  SECOND_LANGUAGES.find((language) => language.code === code) ?? null

export type RoomTextFields = {
  textContent?: string | null
  textContentSecond?: string | null
}

/**
 * The text a text artwork shows in the room. `roomLanguage` is the second language being shown,
 * null for English. In the second language: its second version, or its English text when it has
 * none (an empty one means "same in both languages").
 */
export const roomTextOf = (
  artwork: RoomTextFields,
  roomLanguage: string | null,
): string | undefined => {
  const second = artwork.textContentSecond
  if (roomLanguage && second?.trim()) return second
  return artwork.textContent ?? undefined
}

/**
 * The stored second version an editor sent (the wall save, the text page): an absent one leaves it
 * as it is; an empty one ("same in both languages") stores none.
 */
export const secondTextFields = (text: unknown): { textContentSecond?: string | null } => {
  if (text === undefined) return {}
  return { textContentSecond: typeof text === 'string' && text.trim() ? text : null }
}

/** The visitor's choice for this visit (the room menu's switch), per exhibition. */
const CHOICE_STORAGE_PREFIX = 'the-art-room:room-language:'
/** What the choice stores for English (a code is stored as itself). */
export const ENGLISH = 'en'

export const readRoomLanguageChoice = (exhibitionId: string): string | null => {
  try {
    return sessionStorage.getItem(`${CHOICE_STORAGE_PREFIX}${exhibitionId}`)
  } catch {
    return null
  }
}

export const storeRoomLanguageChoice = (exhibitionId: string, language: string | null) => {
  try {
    sessionStorage.setItem(`${CHOICE_STORAGE_PREFIX}${exhibitionId}`, language ?? ENGLISH)
  } catch {
    // Storage unavailable (private window, blocked site data): the choice lasts this page only.
  }
}

export type RoomLanguageOnEntryInput = {
  /** `Exhibition.secondLanguage`. */
  secondLanguage: string | null | undefined
  /** `Exhibition.secondLanguageVisible`: the visitor switch is on. */
  switchOn: boolean | undefined
  /** `?lang=` on the room's URL: a link may open the room in that language. */
  requested: string | null
  /** The visitor's choice earlier in this visit. */
  stored: string | null
  /** The browser's language (`navigator.language`), e.g. `fr-FR`. */
  browserLanguage: string | null | undefined
}

/**
 * The language the room opens in: the second language's code, or null for English.
 *
 * With the switch off, visitors only ever get English (editors preview in the editor). With it
 * on: the link's `?lang=`, then the visitor's choice earlier in this visit, then the browser's
 * language when it is the second language, then English.
 */
export const roomLanguageOnEntry = ({
  secondLanguage,
  switchOn,
  requested,
  stored,
  browserLanguage,
}: RoomLanguageOnEntryInput): string | null => {
  const language = secondLanguageOf(secondLanguage)
  if (!language) return null
  const pick = (code: string | null) =>
    code === language.code ? language.code : code === ENGLISH ? null : undefined

  if (!switchOn) return null

  const fromLink = pick(requested)
  if (fromLink !== undefined) return fromLink
  const fromVisit = pick(stored)
  if (fromVisit !== undefined) return fromVisit
  const browser = browserLanguage?.toLowerCase().split('-')[0]
  return browser === language.code ? language.code : null
}
