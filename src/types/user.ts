import type { TRequestStatus } from './api'
import type { TExhibition } from './exhibition'

export type TUser = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  userType: string
  email: string
  profileImageUrl?: string
  isFeatured?: boolean
}

export type TUserState = TUser & {
  status: TRequestStatus
  error: string | null
  exhibitionsById: Record<string, TExhibition>
  allExhibitionIds: string[]
}

