/**
 * Step 21 (questions.md Q37, owner): what a (re-)invite sends. Someone who already signs in with
 * a password of their own (set, and no first-sign-in change pending) gets a link to set a new one;
 * their password keeps working until they use it. Everyone else (no password yet, or the
 * temporary one never replaced) gets a fresh temporary password, as every invite did before.
 * No sign-in date is stored, so "has their own password" is the account's own signal.
 */
export type InviteKind = 'set-password-link' | 'temporary-password'

export const inviteKind = (user: {
  password: string | null
  mustChangePassword: boolean
}): InviteKind =>
  user.password && !user.mustChangePassword ? 'set-password-link' : 'temporary-password'

/** How long the set-password link works (questions.md Q161). Forgot-password's is 1 hour. */
export const SET_PASSWORD_LINK_HOURS = 72
