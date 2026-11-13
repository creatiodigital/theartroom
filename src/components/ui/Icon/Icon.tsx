import type { Icon as PhosphorIcon, IconWeight } from '@phosphor-icons/react'
// The SSR entry: this module has no 'use client', and Phosphor's default entry creates a React
// context when it loads, which a server component can't do. Its icons work on the client too.
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle,
  Cube,
  Eye,
  EyeSlash,
  Headphones,
  Image,
  LinkSimple,
  Pause,
  PencilSimple,
  Play,
  SpeakerHigh,
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

// Type for custom SVG icons
type CustomSvgIcon = FC<SVGProps<SVGSVGElement>>

// Phosphor icons registry. The keys are the names callers (and stored sound works) use: never
// rename one. Stored sound works hold 'volume-2' or 'headphones' only: the schema default and
// the only two options ArtisticSoundPanel has ever offered. Unused keys were dropped (Q55 b):
// each Phosphor icon here ships in every page that has a Button.
const phosphorIcons: Record<string, PhosphorIcon> = {
  'alert-circle': WarningCircle,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  box: Cube,
  camera: Camera,
  'check-circle': CheckCircle,
  close: X,
  eye: Eye,
  eyeOff: EyeSlash,
  headphones: Headphones,
  image: Image,
  link: LinkSimple,
  pause: Pause,
  play: Play,
  square: Square,
  'square-pen': PencilSimple,
  'trash-2': Trash,
  type: TextT,
  video: VideoCamera,
  'volume-2': SpeakerHigh,
}

// Custom SVG icons registry
const customIcons: Record<string, CustomSvgIcon> = {
  chevronDown: ChevronDown,
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
