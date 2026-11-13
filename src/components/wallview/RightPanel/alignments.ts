import {
  AlignBottom,
  AlignBottomSimple,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignCenterVerticalSimple,
  AlignLeft,
  AlignRight,
  AlignTop,
  AlignTopSimple,
  type Icon,
} from '@phosphor-icons/react'

import type { TAlign } from '@/types/wizard'

type Alignment = { align: TAlign; label: string; icon: Icon }

/**
 * Place an item, or a group, on the wall (wallview.md §3–4): today's six alignments, in today's
 * order, each named for the strip's tooltip and accessible name (designs/wall-view-panels.dc.html).
 */
export const WALL_PLACES: readonly Alignment[] = [
  { align: 'verticalTop', label: 'Top of the wall', icon: AlignTopSimple },
  {
    align: 'verticalCenter',
    label: 'Middle of the wall (height)',
    icon: AlignCenterVerticalSimple,
  },
  { align: 'verticalBottom', label: 'Bottom of the wall', icon: AlignBottomSimple },
  { align: 'horizontalLeft', label: 'Left of the wall', icon: AlignLeft },
  { align: 'horizontalCenter', label: 'Center of the wall', icon: AlignCenterHorizontal },
  { align: 'horizontalRight', label: 'Right of the wall', icon: AlignRight },
]

/**
 * Line two or more works up with each other (wallview.md §4, "Line them up"), in the drawn order;
 * each is today's `alignArtworksInGroup` value (useAlignGroup: left edges, centers, right edges,
 * tops, middles, bottoms of the group's bounds).
 */
export const ELEMENT_ALIGNS: readonly Alignment[] = [
  { align: 'horizontalLeft', label: 'Align left edges', icon: AlignLeft },
  { align: 'horizontalCenter', label: 'Align centers', icon: AlignCenterHorizontal },
  { align: 'horizontalRight', label: 'Align right edges', icon: AlignRight },
  { align: 'verticalTop', label: 'Align tops', icon: AlignTop },
  { align: 'verticalCenter', label: 'Align middles', icon: AlignCenterVertical },
  { align: 'verticalBottom', label: 'Align bottoms', icon: AlignBottom },
]

/** A wall item's type, as its header and "On this wall" name it. */
export const TYPE_NAMES: Record<string, string> = {
  image: 'Image',
  text: 'Text',
  shape: 'Shape',
  video: 'Video',
  sound: 'Sound',
}
