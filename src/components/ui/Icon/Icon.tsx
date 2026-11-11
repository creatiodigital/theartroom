import type { Icon as PhosphorIcon, IconWeight } from '@phosphor-icons/react'
// The SSR entry: this module has no 'use client', and Phosphor's default entry creates a React
// context when it loads, which a server component can't do. Its icons work on the client too.
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowLineDown,
  ArrowLineLeft,
  ArrowLineRight,
  ArrowLineUp,
  ArrowRight,
  ArrowsHorizontal,
  ArrowsVertical,
  Armchair,
  Camera,
  CheckCircle,
  CircleNotch,
  Cube,
  Eye,
  EyeSlash,
  FolderSimplePlus,
  GearSix,
  GridFour,
  Headphones,
  House,
  Image,
  Info,
  Lightbulb,
  LinkSimple,
  LockSimple,
  Magnet,
  Monitor,
  MusicNotes,
  Pause,
  PencilSimple,
  // Aliased: the custom `person.svg` below is imported as `Person`.
  Person as PersonStanding,
  Play,
  Plus,
  Printer,
  Rectangle,
  Rows,
  Ruler,
  Selection,
  SelectionBackground,
  SelectionForeground,
  Shapes,
  SpeakerHigh,
  SpeakerLow,
  Square,
  TextT,
  Trash,
  VideoCamera,
  WarningCircle,
  X,
} from '@phosphor-icons/react/dist/ssr'
import type { FC, SVGProps } from 'react'

// Custom SVG icons, kept as they are (not in Phosphor, or kept by the redesign's step 19)
import ChevronDown from '@/icons/chevron-down.svg'
import DistributeHorizontal from '@/icons/distribute-horizontal.svg'
import DistributeVertical from '@/icons/distribute-vertical.svg'
import Drop from '@/icons/drop.svg'
import Expand from '@/icons/expand.svg'
import Grid from '@/icons/grid.svg'
import HorizontalCenter from '@/icons/horizontal-center.svg'
import HorizontalLeft from '@/icons/horizontal-left.svg'
import HorizontalRight from '@/icons/horizontal-right.svg'
import Loading from '@/icons/loading.svg'
import Move from '@/icons/move.svg'
import Painting from '@/icons/painting.svg'
import Person from '@/icons/person.svg'
import Picture from '@/icons/picture.svg'
import Placeholder from '@/icons/placeholder.svg'
import PositionBottom from '@/icons/position-bottom.svg'
import PositionCenterH from '@/icons/position-center-h.svg'
import PositionCenterV from '@/icons/position-center-v.svg'
import PositionLeft from '@/icons/position-left.svg'
import PositionRight from '@/icons/position-right.svg'
import PositionTop from '@/icons/position-top.svg'
import Preview from '@/icons/preview.svg'
import Reset from '@/icons/reset.svg'
import TextCenter from '@/icons/text-center.svg'
import TextLeft from '@/icons/text-left.svg'
import TextJustify from '@/icons/text-justify.svg'
import TextRight from '@/icons/text-right.svg'
import TextVerticalBottom from '@/icons/text-vertical-bottom.svg'
import TextVerticalCenter from '@/icons/text-vertical-center.svg'
import TextVerticalTop from '@/icons/text-vertical-top.svg'
import Text from '@/icons/text.svg'
import VerticalBottom from '@/icons/vertical-bottom.svg'
import VerticalCenter from '@/icons/vertical-center.svg'
import VerticalTop from '@/icons/vertical-top.svg'
import ZoomIn from '@/icons/zoom-in.svg'
import ZoomOut from '@/icons/zoom-out.svg'

// Type for custom SVG icons
type CustomSvgIcon = FC<SVGProps<SVGSVGElement>>

// Phosphor icons registry. The keys are the names callers (and stored sound works) use: never
// rename one.
const phosphorIcons: Record<string, PhosphorIcon> = {
  'alert-circle': WarningCircle,
  armchair: Armchair,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowTopFromLine: ArrowLineUp,
  arrowBottomFromLine: ArrowLineDown,
  arrowLeftFromLine: ArrowLineLeft,
  arrowRightFromLine: ArrowLineRight,
  'brick-wall': Rows,
  box: Cube,
  camera: Camera,
  'check-circle': CheckCircle,
  close: X,
  eye: Eye,
  eyeOff: EyeSlash,
  gallery: FolderSimplePlus,
  'grid-2x2': GridFour,
  headphones: Headphones,
  house: House,
  'human-standing': PersonStanding,
  image: Image,
  info: Info,
  light: Lightbulb,
  link: LinkSimple,
  loaderCircle: CircleNotch,
  lock: LockSimple,
  magnet: Magnet,
  monitor: Monitor,
  moveHorizontal: ArrowsHorizontal,
  moveVertical: ArrowsVertical,
  music: MusicNotes,
  'panel-bottom-dashed': Selection,
  pause: Pause,
  plus: Plus,
  play: Play,
  'bring-to-front': SelectionForeground,
  // Not Rows: the editor's Floor button (brick-wall) already has it (Q49).
  'panel-top': Rectangle,
  printer: Printer,
  redo: ArrowClockwise,
  ruler: Ruler,
  'send-to-back': SelectionBackground,
  settings: GearSix,
  shapes: Shapes,
  square: Square,
  'square-pen': PencilSimple,
  'trash-2': Trash,
  type: TextT,
  undo: ArrowCounterClockwise,
  video: VideoCamera,
  'volume-1': SpeakerLow,
  'volume-2': SpeakerHigh,
}

// Custom SVG icons registry
const customIcons: Record<string, CustomSvgIcon> = {
  chevronDown: ChevronDown,
  distributeHorizontal: DistributeHorizontal,
  distributeVertical: DistributeVertical,
  drop: Drop,
  grid: Grid,
  horizontalLeft: HorizontalLeft,
  horizontalCenter: HorizontalCenter,
  horizontalRight: HorizontalRight,
  expand: Expand,
  loading: Loading,
  move: Move,
  painting: Painting,
  person: Person,
  positionLeft: PositionLeft,
  positionTop: PositionTop,
  positionBottom: PositionBottom,
  positionCenterV: PositionCenterV,
  positionCenterH: PositionCenterH,
  positionRight: PositionRight,
  preview: Preview,
  picture: Picture,
  placeholder: Placeholder,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  reset: Reset,
  text: Text,
  textLeft: TextLeft,
  textCenter: TextCenter,
  textRight: TextRight,
  textJustify: TextJustify,
  textVerticalTop: TextVerticalTop,
  textVerticalCenter: TextVerticalCenter,
  textVerticalBottom: TextVerticalBottom,
  verticalBottom: VerticalBottom,
  verticalCenter: VerticalCenter,
  verticalTop: VerticalTop,
}

// Merge both registries for type inference
const _allIcons = { ...phosphorIcons, ...customIcons }

export type IconName = keyof typeof _allIcons

export type IconProps = {
  name: IconName
  size?: number
  color?: string
  weight?: IconWeight
}

const Icon = ({ name, size = 24, color = 'currentColor', weight = 'light' }: IconProps) => {
  // Check if it's a Phosphor icon
  const PhosphorIconComponent = phosphorIcons[name as keyof typeof phosphorIcons]
  if (PhosphorIconComponent) {
    // Every Icon is decorative: hidden from screen readers (Phosphor doesn't do it on its own).
    return <PhosphorIconComponent size={size} color={color} weight={weight} aria-hidden />
  }

  // Fallback to custom SVG icon
  const CustomIconComponent = customIcons[name as keyof typeof customIcons]
  if (CustomIconComponent) {
    return <CustomIconComponent width={size} height={size} fill={color} />
  }

  return null
}

export default Icon
