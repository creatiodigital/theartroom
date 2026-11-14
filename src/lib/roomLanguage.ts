/**
 * AR-182: a second language for the texts inside an exhibition's 3D room (docs/wall-languages).
 *
 * English is always the main language. An exhibition may offer ONE second language, for the room's
 * text artworks only; nothing else on the site is translated. A text with no version in the
 * room's language shows its English text, so the room is never half empty.
 */

export type SecondLanguage = {
  /** The stored code (`Exhibition.secondLanguage`, `Artwork.textContentSecondLang`). */
  code: string
  /** The name in its own language: the dashboard's list, the room's switch. */
  name: string
  /** The name in English: the room's welcome window ("also available in French"). */
  englishName: string
}

/**
 * The languages an exhibition can offer, in the owner's order (2026-11-14). Only languages
 * written in standard (Latin) characters (owner): every wall typeface ships Latin glyphs with
 * their accents; none has CJK, and not all have Greek or Cyrillic.
 */
export const SECOND_LANGUAGES: readonly SecondLanguage[] = [
  { code: 'fr', name: 'Français', englishName: 'French' },
  { code: 'it', name: 'Italiano', englishName: 'Italian' },
  { code: 'de', name: 'Deutsch', englishName: 'German' },
  { code: 'es', name: 'Español', englishName: 'Spanish' },
  { code: 'pt', name: 'Português', englishName: 'Portuguese' },
]

/** The language with this code, or null for none or a code that isn't offered. */
export const secondLanguageOf = (code: string | null | undefined): SecondLanguage | null =>
  SECOND_LANGUAGES.find((language) => language.code === code) ?? null

export type RoomTextFields = {
  textContent?: string | null
  textContentSecond?: string | null
  textContentSecondLang?: string | null
}

/**
 * The text a text artwork shows in the room. `roomLanguage` is the second language being shown,
 * null for English. A version written for another language (the exhibition's language changed
 * since) stays hidden; an empty one means "same in both languages". Either way: English.
 */
export const roomTextOf = (
  artwork: RoomTextFields,
  roomLanguage: string | null,
): string | undefined => {
  const second = artwork.textContentSecond
  if (roomLanguage && artwork.textContentSecondLang === roomLanguage && second?.trim()) {
    return second
  }
  return artwork.textContent ?? undefined
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
  /** The viewer can edit this exhibition: the preview link works for them with the switch off. */
  canEdit: boolean
  /** `?lang=` on the room's URL (the editors' preview link opens the room in that language). */
  requested: string | null
  /** The visitor's choice earlier in this visit. */
  stored: string | null
  /** The browser's language (`navigator.language`), e.g. `fr-FR`. */
  browserLanguage: string | null | undefined
}

/**
 * The language the room opens in: the second language's code, or null for English.
 *
 * With the switch off, visitors only ever get English; an editor gets the second language only
 * by asking for it (the dashboard's preview link). With it on: the link's `?lang=`, then the
 * visitor's choice earlier in this visit, then the browser's language when it is the second
 * language, then English.
 */
export const roomLanguageOnEntry = ({
  secondLanguage,
  switchOn,
  canEdit,
  requested,
  stored,
  browserLanguage,
}: RoomLanguageOnEntryInput): string | null => {
  const language = secondLanguageOf(secondLanguage)
  if (!language) return null
  const pick = (code: string | null) =>
    code === language.code ? language.code : code === ENGLISH ? null : undefined

  if (!switchOn) return canEdit && requested === language.code ? language.code : null

  const fromLink = pick(requested)
  if (fromLink !== undefined) return fromLink
  const fromVisit = pick(stored)
  if (fromVisit !== undefined) return fromVisit
  const browser = browserLanguage?.toLowerCase().split('-')[0]
  return browser === language.code ? language.code : null
}
