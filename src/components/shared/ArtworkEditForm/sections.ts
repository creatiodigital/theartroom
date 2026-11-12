/** One panel of the artwork editor: its anchor and its title (artist.md §3). */
export type ArtworkSection = { id: string; title: string }

/** The studio page's save bar submits this form (`SaveBar form=`). */
export const ARTWORK_EDIT_FORM_ID = 'artwork-edit-form'

/**
 * The editor's panels, in page order. The id is the panel's anchor (the On this
 * page links), the title its h2 and its link text. Prefixed so they can't meet
 * the form's field ids (`title`, `author`, …) or anything in the wall view.
 */
export const ARTWORK_SECTION = {
  printSales: { id: 'artwork-section-print-sales', title: 'Print sales' },
  videoFile: { id: 'artwork-section-video-file', title: 'Video file' },
  image: { id: 'artwork-section-image', title: 'Artwork image' },
  poster: { id: 'artwork-section-image', title: 'Video poster' },
  ready: { id: 'artwork-section-ready', title: 'Ready to sell' },
  audioFile: { id: 'artwork-section-audio-file', title: 'Audio file' },
  details: { id: 'artwork-section-details', title: 'Details' },
  text: { id: 'artwork-section-text', title: 'Text content' },
  description: { id: 'artwork-section-description', title: 'Description' },
  where: { id: 'artwork-section-where', title: 'Where it shows' },
  media: { id: 'artwork-section-media', title: 'Supplementary media' },
} as const satisfies Record<string, ArtworkSection>

export const panelTitleId = (section: ArtworkSection) => `${section.id}-title`
export const panelDescriptionId = (section: ArtworkSection) => `${section.id}-description`
